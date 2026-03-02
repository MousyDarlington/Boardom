'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const CheckersGame = require('./CheckersGame'); // for RED/BLACK constants only
const { calculateNewRatings } = require('./EloRating');

const WORKER_SCRIPT = path.join(__dirname, 'GameWorker.js');

const QUEUE_TIMEOUT_MS = 90 * 1000;   // 90 seconds before bot match
const BOT_MATCH_DELAY_MS = 1500;      // brief UI notice before game starts
const RECONNECT_TIMEOUT_MS = 120 * 1000; // 120 seconds to rejoin after disconnect

class Matchmaker {
  constructor(io, userStore) {
    this.io = io;
    this.userStore = userStore;       // { getUser, updateUser, ensureBotUser }
    this.casualQueue = [];            // socket refs
    this.rankedQueue = [];            // socket refs
    this.lobbies = new Map();         // code -> { host, guest, hostUsername }
    this.games = new Map();           // gameId -> lightweight GameData
    this.playerToGame = new Map();    // socketId -> gameId
    this.queueTimers = new Map();     // socketId -> timeoutId
    this.workers = new Map();         // gameId -> Worker thread
    this.troubleQueue = [];           // socket refs for Trouble
    this.scrabbleQueue = [];          // socket refs for Scrabble
    this.scrabbleDictionaryPath = null; // path to dictionary file for workers
    this.matchCodes = new Map();      // matchCode -> gameId
    this.usernameToGame = new Map();  // username -> gameId
    this.pausedGames = new Map();     // gameId -> { pausedAt, timers, disconnectedPlayers }
    this.troubleLobbies = new Map();  // code -> { host, players: [{ socket, username }], hostUsername, createdAt }
  }

  /* ---------- helpers ---------- */

  _genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  _uniqueCode() {
    let code;
    do { code = this._genCode(); } while (this.lobbies.has(code) || this.troubleLobbies.has(code) || this.matchCodes.has(code));
    return code;
  }

  _hasActiveGame(socket) {
    if (!socket.username) return false;
    const gameId = this.usernameToGame.get(socket.username);
    if (!gameId) return false;
    const gd = this.games.get(gameId);
    if (!gd) { this.usernameToGame.delete(socket.username); return false; }
    const pause = this.pausedGames.get(gameId);
    const isPaused = pause && pause.disconnectedPlayers.has(socket.username);
    if (!isPaused) return false; // Not paused — don't block queue joins
    socket.emit('game:activeGameExists', { matchCode: gd.matchCode, paused: true });
    return true;
  }

  _removeFromQueues(socket) {
    this.casualQueue = this.casualQueue.filter(s => s.id !== socket.id);
    this.rankedQueue = this.rankedQueue.filter(s => s.id !== socket.id);
    this.scrabbleQueue = this.scrabbleQueue.filter(s => s.id !== socket.id);
    this._cancelQueueTimer(socket.id);
  }

  _cosmeticsOf(username) {
    const u = this.userStore.getUser(username);
    return {
      board: u?.equippedBoard || 'default',
      pieces: u?.equippedPieces || 'default',
      badge: u?.equippedBadge || null
    };
  }

  /* ---------- Socket lookup (replaces direct socket storage) ---------- */

  _getSocket(socketId) {
    return this.io.sockets.sockets.get(socketId) || null;
  }

  /* ---------- Worker lifecycle ---------- */

  _spawnWorker(gameId, initPayload) {
    const worker = new Worker(WORKER_SCRIPT);
    this.workers.set(gameId, worker);

    worker.on('message', (msg) => this._handleWorkerMessage(gameId, msg));
    worker.on('error', (err) => {
      console.error(`Worker error for game ${gameId}:`, err);
      this._handleWorkerCrash(gameId);
    });
    worker.on('exit', (code) => {
      this.workers.delete(gameId);
      if (code !== 0 && this.games.has(gameId)) {
        console.error(`Worker exited with code ${code} for game ${gameId}`);
        this._handleWorkerCrash(gameId);
      }
    });

    worker.postMessage({ type: 'init', payload: initPayload });
  }

  _handleWorkerMessage(gameId, msg) {
    switch (msg.type) {
      case 'started':
        for (const psd of msg.payload.playerStartData) {
          const sock = this._getSocket(psd.socketId);
          if (sock) sock.emit(psd.event, psd.data);
        }
        break;

      case 'emit':
        for (const target of msg.payload.targets) {
          const sock = this._getSocket(target.socketId);
          if (sock) sock.emit(target.event, target.data);
        }
        break;

      case 'gameOver': {
        // 1. Relay game-over events to human players
        for (const target of msg.payload.overTargets) {
          const sock = this._getSocket(target.socketId);
          if (sock) sock.emit(target.event, target.data);
        }
        // 2. Process rewards on main thread
        const gd = this.games.get(gameId);
        if (gd) this._processGameOverRewards(gd, msg.payload);
        // 3. Clean up
        this._cleanupGameMaps(gameId);
        this._terminateWorker(gameId);
        break;
      }

      case 'rejoinState': {
        const sock = this._getSocket(msg.payload.socketId);
        if (sock) sock.emit(msg.payload.event, msg.payload.data);
        break;
      }

      case 'chatBroadcast':
        for (const sid of msg.payload.targets) {
          const sock = this._getSocket(sid);
          if (sock) sock.emit('chat:game', msg.payload.msg);
        }
        break;
    }
  }

  _handleWorkerCrash(gameId) {
    const gd = this.games.get(gameId);
    if (!gd) return;
    const reason = 'Game ended due to server error';
    const event = gd.gameType === 'scrabble' ? 'scrabble:over'
                : gd.gameType === 'trouble' ? 'trouble:over'
                : 'game:over';
    for (const p of gd.players) {
      if (!p.isBot) {
        const sock = this._getSocket(p.id);
        if (sock) sock.emit(event, { winner: null, reason });
      }
    }
    this._cleanupGameMaps(gameId);
  }

  _terminateWorker(gameId) {
    const worker = this.workers.get(gameId);
    if (worker) {
      worker.postMessage({ type: 'destroy' });
      setTimeout(() => {
        if (this.workers.has(gameId)) {
          worker.terminate();
          this.workers.delete(gameId);
        }
      }, 1000);
    }
  }

  _cleanupGameMaps(gameId) {
    const gd = this.games.get(gameId);
    if (!gd) return;
    if (gd.matchCode) this.matchCodes.delete(gd.matchCode);
    for (const p of gd.players) {
      if (p.username) this.usernameToGame.delete(p.username);
      this.playerToGame.delete(p.id);
      if (!p.isBot) {
        const sock = this._getSocket(p.id);
        if (sock) sock.leave(gameId);
      }
    }
    this._clearPauseState(gameId);
    this.games.delete(gameId);
  }

  /* ---------- Post-game rewards (main thread) ---------- */

  _processGameOverRewards(gd, overPayload) {
    if (gd.gameType === 'checkers') {
      const { winner } = overPayload;
      const redPlayer = gd.players.find(p => p.color === CheckersGame.RED);
      const blackPlayer = gd.players.find(p => p.color === CheckersGame.BLACK);
      if (!redPlayer || !blackPlayer) return;

      if (gd.type === 'ranked' && winner) {
        const winnerUsername = winner === CheckersGame.RED ? redPlayer.username : blackPlayer.username;
        const loserUsername = winner === CheckersGame.RED ? blackPlayer.username : redPlayer.username;
        const winnerUser = this.userStore.getUser(winnerUsername);
        const loserUser = this.userStore.getUser(loserUsername);
        if (winnerUser && loserUser) {
          const result = calculateNewRatings(
            winnerUser.rating, loserUser.rating,
            winnerUser.wins + winnerUser.losses,
            loserUser.wins + loserUser.losses
          );
          this.userStore.updateUser(winnerUsername, { rating: result.winnerNew, wins: winnerUser.wins + 1 });
          this.userStore.updateUser(loserUsername, { rating: result.loserNew, losses: loserUser.losses + 1 });
        }
      } else if (gd.type === 'casual' && winner) {
        const wName = winner === CheckersGame.RED ? redPlayer.username : blackPlayer.username;
        const lName = winner === CheckersGame.RED ? blackPlayer.username : redPlayer.username;
        const wu = this.userStore.getUser(wName);
        const lu = this.userStore.getUser(lName);
        if (wu) this.userStore.updateUser(wName, { wins: wu.wins + 1 });
        if (lu) this.userStore.updateUser(lName, { losses: lu.losses + 1 });
      }

      // Award coins
      if (winner) {
        const wName = winner === CheckersGame.RED ? redPlayer.username : blackPlayer.username;
        const lName = winner === CheckersGame.RED ? blackPlayer.username : redPlayer.username;
        const wUser = this.userStore.getUser(wName);
        const lUser = this.userStore.getUser(lName);
        if (wUser && !wUser.isBot) this.userStore.updateUser(wName, { coins: (wUser.coins || 0) + 10 });
        if (lUser && !lUser.isBot) this.userStore.updateUser(lName, { coins: (lUser.coins || 0) + 3 });
      }

      this._decrementTrials(redPlayer.username);
      this._decrementTrials(blackPlayer.username);

    } else if (gd.gameType === 'trouble') {
      const { placements } = overPayload;
      const placementRewards = [20, 12, 6, 3];
      for (let rank = 0; rank < placements.length; rank++) {
        const playerIdx = placements[rank];
        const username = gd.players[playerIdx]?.username;
        const user = this.userStore.getUser(username);
        if (!user || user.isBot) continue;
        const reward = placementRewards[rank] || 3;
        this.userStore.updateUser(username, { coins: (user.coins || 0) + reward });
      }
      for (const p of gd.players) this._decrementTrials(p.username);

    } else if (gd.gameType === 'scrabble') {
      const { winnerIdx } = overPayload;
      for (let i = 0; i < gd.players.length; i++) {
        const username = gd.players[i].username;
        const user = this.userStore.getUser(username);
        if (!user || user.isBot) continue;
        const reward = i === winnerIdx ? 20 : 5;
        this.userStore.updateUser(username, { coins: (user.coins || 0) + reward });
      }
      for (const p of gd.players) this._decrementTrials(p.username);
    }
  }

  /* ---------- Queue-timeout → bot matching ---------- */

  _startQueueTimer(socket, type) {
    this._cancelQueueTimer(socket.id);
    const tid = setTimeout(() => this._onQueueTimeout(socket, type), QUEUE_TIMEOUT_MS);
    this.queueTimers.set(socket.id, tid);
  }

  _cancelQueueTimer(socketId) {
    const tid = this.queueTimers.get(socketId);
    if (tid) { clearTimeout(tid); this.queueTimers.delete(socketId); }
  }

  _onQueueTimeout(socket, type) {
    this.queueTimers.delete(socket.id);
    const inQueue = this.casualQueue.some(s => s.id === socket.id)
                 || this.rankedQueue.some(s => s.id === socket.id);
    if (!inQueue) return;

    this._removeFromQueues(socket);
    socket.emit('queue:update', { type, status: 'bot_matching' });
    const tid = setTimeout(() => this._matchWithBot(socket, type), BOT_MATCH_DELAY_MS);
    this.queueTimers.set(socket.id, tid);
  }

  _matchWithBot(socket, type, botName) {
    this.queueTimers.delete(socket.id);
    const user = this.userStore.getUser(socket.username);
    const playerRating = user?.rating || 1200;

    // Bot rating within ±150 of the player for a fair match
    const variance = Math.floor((Math.random() - 0.5) * 300);
    const botRating = Math.max(800, playerRating + variance);

    const botUsername = botName || `checkers_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const botSocketId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.userStore.ensureBotUser(botUsername, botRating);

    // Bot descriptor — no real socket, worker creates the actual BotPlayer
    const botDesc = {
      id: botSocketId,
      username: botUsername,
      isBot: true,
      botRating,
      botName: botUsername
    };

    this._startGame(socket, botDesc, type);
  }

  /** Instant bot match from the lobby menu (casual, no queue). */
  playBot(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this._matchWithBot(socket, 'casual', 'Botty McBotFace');
  }

  /* ---------- Casual queue ---------- */

  joinCasual(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.casualQueue.push(socket);
    socket.emit('queue:update', { type: 'casual', position: this.casualQueue.length });
    if (this.casualQueue.length >= 2) {
      const p1 = this.casualQueue.shift();
      const p2 = this.casualQueue.shift();
      this._startGame(p1, p2, 'casual');
    } else {
      this._startQueueTimer(socket, 'casual');
    }
  }

  /* ---------- Ranked queue ---------- */

  joinRanked(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.rankedQueue.push(socket);
    socket.emit('queue:update', { type: 'ranked', position: this.rankedQueue.length });
    if (!this._tryMatchRanked()) {
      this._startQueueTimer(socket, 'ranked');
    }
  }

  _tryMatchRanked() {
    if (this.rankedQueue.length < 2) return false;
    this.rankedQueue.sort((a, b) => {
      const ra = this.userStore.getUser(a.username)?.rating || 1200;
      const rb = this.userStore.getUser(b.username)?.rating || 1200;
      return ra - rb;
    });
    let bestDiff = Infinity, bestI = 0;
    for (let i = 0; i < this.rankedQueue.length - 1; i++) {
      const ra = this.userStore.getUser(this.rankedQueue[i].username)?.rating || 1200;
      const rb = this.userStore.getUser(this.rankedQueue[i + 1].username)?.rating || 1200;
      const diff = Math.abs(ra - rb);
      if (diff < bestDiff) { bestDiff = diff; bestI = i; }
    }
    const p1 = this.rankedQueue.splice(bestI, 1)[0];
    const p2 = this.rankedQueue.splice(bestI, 1)[0];
    this._startGame(p1, p2, 'ranked');
    return true;
  }

  /* ---------- Private lobby ---------- */

  createLobby(socket) {
    if (this._hasActiveGame(socket)) return;
    for (const [code, lobby] of this.lobbies) {
      if (lobby.host.id === socket.id) {
        this.lobbies.delete(code);
        break;
      }
    }
    const code = this._uniqueCode();
    this.lobbies.set(code, {
      host: socket,
      guest: null,
      hostUsername: socket.username
    });
    socket.emit('lobby:created', { code });
  }

  joinLobby(socket, code) {
    code = (code || '').toUpperCase().trim();
    const lobby = this.lobbies.get(code);
    if (!lobby) return socket.emit('lobby:error', { message: 'Lobby not found' });
    if (lobby.host.id === socket.id) return socket.emit('lobby:error', { message: 'Cannot join your own lobby' });
    if (lobby.guest) return socket.emit('lobby:error', { message: 'Lobby is full' });

    lobby.guest = socket;
    this.lobbies.delete(code);
    this._startGame(lobby.host, socket, 'private');
  }

  leaveLobby(socket) {
    for (const [code, lobby] of this.lobbies) {
      if (lobby.host.id === socket.id) {
        this.lobbies.delete(code);
        return;
      }
    }
  }

  /* ---------- Trouble Private Lobby ---------- */

  createTroubleLobby(socket) {
    if (this._hasActiveGame(socket)) return;
    for (const [code, lobby] of this.troubleLobbies) {
      if (lobby.host.id === socket.id) {
        for (const p of lobby.players) {
          if (p.socket.id !== socket.id) {
            p.socket.emit('troubleLobby:disbanded', { message: 'Host cancelled the lobby' });
          }
        }
        this.troubleLobbies.delete(code);
        break;
      }
    }
    const code = this._uniqueCode();
    const username = socket.username || socket.guestName || 'Host';
    const lobbyData = {
      host: socket,
      hostUsername: username,
      players: [{ socket, username }],
      createdAt: Date.now()
    };
    this.troubleLobbies.set(code, lobbyData);
    socket.emit('troubleLobby:created', { code, players: [{ username }] });
  }

  joinTroubleLobby(socket, code) {
    code = (code || '').toUpperCase().trim();
    const lobby = this.troubleLobbies.get(code);
    if (!lobby) return socket.emit('troubleLobby:error', { message: 'Lobby not found' });
    if (lobby.players.some(p => p.socket.id === socket.id)) {
      return socket.emit('troubleLobby:error', { message: 'Already in this lobby' });
    }
    if (lobby.players.length >= 4) {
      return socket.emit('troubleLobby:error', { message: 'Lobby is full' });
    }

    const username = socket.username || socket.guestName || 'Guest';
    lobby.players.push({ socket, username });

    const playerList = lobby.players.map(p => ({ username: p.username }));
    for (const p of lobby.players) {
      p.socket.emit('troubleLobby:updated', { players: playerList, code });
    }

    if (lobby.players.length >= 4) {
      this._launchTroubleLobby(code);
    }
  }

  startTroubleLobby(socket, code) {
    code = (code || '').toUpperCase().trim();
    const lobby = this.troubleLobbies.get(code);
    if (!lobby) return socket.emit('troubleLobby:error', { message: 'Lobby not found' });
    if (lobby.host.id !== socket.id) {
      return socket.emit('troubleLobby:error', { message: 'Only the host can start the game' });
    }
    if (lobby.players.length < 2) {
      return socket.emit('troubleLobby:error', { message: 'Need at least 2 players to start' });
    }
    this._launchTroubleLobby(code);
  }

  _launchTroubleLobby(code) {
    const lobby = this.troubleLobbies.get(code);
    if (!lobby) return;
    this.troubleLobbies.delete(code);
    const humanSockets = lobby.players.map(p => p.socket);
    this._startTroubleGame(humanSockets, 'private');
  }

  leaveTroubleLobby(socket) {
    for (const [code, lobby] of this.troubleLobbies) {
      const idx = lobby.players.findIndex(p => p.socket.id === socket.id);
      if (idx === -1) continue;

      if (lobby.host.id === socket.id) {
        for (const p of lobby.players) {
          if (p.socket.id !== socket.id) {
            p.socket.emit('troubleLobby:disbanded', { message: 'Host left the lobby' });
          }
        }
        this.troubleLobbies.delete(code);
      } else {
        lobby.players.splice(idx, 1);
        const playerList = lobby.players.map(p => ({ username: p.username }));
        for (const p of lobby.players) {
          p.socket.emit('troubleLobby:updated', { players: playerList, code });
        }
      }
      return;
    }
  }

  resolveCodeType(code) {
    code = (code || '').toUpperCase().trim();
    if (this.lobbies.has(code)) return { type: 'checkers', code };
    if (this.troubleLobbies.has(code)) return { type: 'trouble', code };
    return null;
  }

  leaveQueue(socket) {
    this._removeFromQueues(socket);
    socket.emit('queue:left');
  }

  /* ========== CHECKERS GAME LIFECYCLE ========== */

  /**
   * Start a checkers game. sock1/sock2 can be real Socket.IO sockets
   * or bot descriptors ({ id, username, isBot, botRating, botName }).
   */
  _startGame(sock1, sock2, type) {
    const flip = Math.random() < 0.5;
    const redInfo = flip ? sock1 : sock2;
    const blackInfo = flip ? sock2 : sock1;

    const gameId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const matchCode = this._uniqueCode();

    const buildPlayer = (info, color) => {
      const isBot = !!info.isBot;
      return {
        id: info.id,
        username: info.username || 'Guest',
        isBot,
        color,
        rating: this.userStore.getUser(info.username)?.rating || 1200,
        cosmetics: this._cosmeticsOf(info.username),
        ...(isBot ? { botRating: info.botRating || 1200, botName: info.botName || info.username } : {})
      };
    };

    const players = [
      buildPlayer(redInfo, CheckersGame.RED),
      buildPlayer(blackInfo, CheckersGame.BLACK)
    ];

    const gameData = { id: gameId, matchCode, gameType: 'checkers', type, players, startedAt: Date.now() };
    this.games.set(gameId, gameData);
    this.matchCodes.set(matchCode, gameId);

    for (const p of players) {
      this.playerToGame.set(p.id, gameId);
      if (!p.isBot && p.username) this.usernameToGame.set(p.username, gameId);
    }

    // Join real sockets to Socket.IO room
    for (const p of players) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }

    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'checkers', gameTypeStr: type, players
    });
  }

  getGameForSocket(socketId) {
    const gid = this.playerToGame.get(socketId);
    return gid ? this.games.get(gid) : null;
  }

  /* ---------- Checkers action relays ---------- */

  selectPiece(socket, row, col) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'selectPiece', payload: { socketId: socket.id, row, col } });
  }

  makeMove(socket, fr, fc, tr, tc) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'makeMove', payload: { socketId: socket.id, fromRow: fr, fromCol: fc, toRow: tr, toCol: tc } });
  }

  resign(socket) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'resign', payload: { socketId: socket.id } });
  }

  /* ---------- Chat (unified for all game types) ---------- */

  gameChat(socket, message) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'chat', payload: { socketId: socket.id, username: socket.username || 'Guest', text: message } });
  }

  troubleGameChat(socket, message) { this.gameChat(socket, message); }
  scrabbleGameChat(socket, message) { this.gameChat(socket, message); }

  /* ---------- Disconnect ---------- */

  handleDisconnect(socket) {
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this.scrabbleQueue = this.scrabbleQueue.filter(s => s.id !== socket.id);

    // Clean up lobbies
    for (const [code, lobby] of this.lobbies) {
      if (lobby.host.id === socket.id) {
        this.lobbies.delete(code);
        break;
      }
    }

    // Clean up trouble lobbies
    this.leaveTroubleLobby(socket);

    // Handle active game — pause instead of end
    const gd = this.getGameForSocket(socket.id);
    if (!gd) return;

    const username = socket.username;
    if (!username) {
      // Anonymous player can't rejoin — end immediately
      this._forceEndOnDisconnect(gd, socket);
      return;
    }

    this._pauseGameForPlayer(gd, username, socket);
  }

  _forceEndOnDisconnect(gd, socket) {
    // Tell worker to resign on behalf of the disconnected player
    const worker = this.workers.get(gd.id);
    if (worker) {
      worker.postMessage({ type: 'resign', payload: { socketId: socket.id } });
    }
  }

  _pauseGameForPlayer(gd, username, socket) {
    const gameId = gd.id;

    // Initialize pause state if not already paused
    if (!this.pausedGames.has(gameId)) {
      this.pausedGames.set(gameId, {
        pausedAt: Date.now(),
        timers: new Map(),
        disconnectedPlayers: new Set()
      });
    }

    const pause = this.pausedGames.get(gameId);
    pause.disconnectedPlayers.add(username);

    // Start reconnect timer
    const timerId = setTimeout(() => this._onReconnectTimeout(gameId, username), RECONNECT_TIMEOUT_MS);
    pause.timers.set(username, timerId);

    // Tell worker to pause bots
    const worker = this.workers.get(gameId);
    if (worker) {
      worker.postMessage({ type: 'playerDisconnect', payload: { socketId: socket.id, username } });
    }

    // Notify remaining connected players
    this._notifyPause(gd, username);

    // Remove socket from playerToGame (but keep usernameToGame for rejoin lookup)
    this.playerToGame.delete(socket.id);
  }

  _notifyPause(gd, disconnectedUsername) {
    const pause = this.pausedGames.get(gd.id);
    const timeRemaining = RECONNECT_TIMEOUT_MS / 1000;
    const eventName = gd.gameType === 'scrabble' ? 'scrabble:paused'
                    : gd.gameType === 'trouble' ? 'trouble:paused'
                    : 'game:paused';

    for (const p of gd.players) {
      if (p.username === disconnectedUsername || p.isBot) continue;
      if (pause && pause.disconnectedPlayers.has(p.username)) continue;
      const sock = this._getSocket(p.id);
      if (sock) sock.emit(eventName, { disconnectedPlayer: disconnectedUsername, timeRemaining, matchCode: gd.matchCode });
    }
  }

  _onReconnectTimeout(gameId, username) {
    const gd = this.games.get(gameId);
    if (!gd) return;

    const pause = this.pausedGames.get(gameId);
    if (pause) {
      pause.timers.delete(username);
      pause.disconnectedPlayers.delete(username);
    }

    // Find the disconnected player and tell the worker to end (resign on their behalf)
    const player = gd.players.find(p => p.username === username);
    if (!player) return;

    const worker = this.workers.get(gameId);
    if (worker) {
      worker.postMessage({ type: 'resign', payload: { socketId: player.id } });
    }
  }

  /* ---------- Rejoin ---------- */

  attemptRejoin(socket, matchCode) {
    const username = socket.username;
    if (!username) return false;

    let gameId = null;
    if (matchCode) {
      gameId = this.matchCodes.get(matchCode.toUpperCase().trim());
    } else {
      gameId = this.usernameToGame.get(username);
    }

    if (!gameId) return false;

    const gd = this.games.get(gameId);
    if (!gd) {
      if (!matchCode) this.usernameToGame.delete(username);
      return false;
    }

    const pause = this.pausedGames.get(gameId);
    if (!pause || !pause.disconnectedPlayers.has(username)) return false;

    const playerIdx = gd.players.findIndex(p => p.username === username);
    if (playerIdx === -1) return false;

    return this._rejoinGame(gd, socket, username, playerIdx, pause);
  }

  _rejoinGame(gd, socket, username, playerIdx, pause) {
    const oldSocketId = gd.players[playerIdx].id;

    // Update main-thread maps
    this.playerToGame.delete(oldSocketId);
    gd.players[playerIdx].id = socket.id;
    this.playerToGame.set(socket.id, gd.id);
    socket.join(gd.id);

    // Cancel reconnect timer and check if all players are back
    if (pause) {
      const tid = pause.timers.get(username);
      if (tid) { clearTimeout(tid); pause.timers.delete(username); }
      pause.disconnectedPlayers.delete(username);

      if (pause.disconnectedPlayers.size === 0) {
        this.pausedGames.delete(gd.id);
        // Notify other human players of resume
        const eventName = gd.gameType === 'scrabble' ? 'scrabble:resumed'
                        : gd.gameType === 'trouble' ? 'trouble:resumed'
                        : 'game:resumed';
        for (const p of gd.players) {
          if (p.username !== username && !p.isBot) {
            const sock = this._getSocket(p.id);
            if (sock) sock.emit(eventName, { reconnectedPlayer: username });
          }
        }
      }
    }

    // Tell worker to update socketId mapping, resume bots, and send rejoin state
    const worker = this.workers.get(gd.id);
    if (worker) {
      worker.postMessage({
        type: 'playerRejoined',
        payload: { oldSocketId, username, newSocketId: socket.id }
      });
    }

    return true;
  }

  /* ---------- Trial management ---------- */

  _decrementTrials(username) {
    const user = this.userStore.getUser(username);
    if (!user || user.isBot || !user.trials) return;
    let changed = false;
    for (const key of Object.keys(user.trials)) {
      if (key.startsWith('_')) continue;
      if (user.trials[key] > 0) {
        user.trials[key]--;
        changed = true;
        if (user.trials[key] <= 0) {
          delete user.trials[key];
          if (user.equippedBoard === key) user.equippedBoard = 'default';
          if (user.equippedPieces === key) user.equippedPieces = 'default';
        }
      }
    }
    if (changed) this.userStore.updateUser(username, { trials: user.trials });
  }

  /* ---------- Pause state cleanup ---------- */

  _clearPauseState(gameId) {
    const pause = this.pausedGames.get(gameId);
    if (pause) {
      for (const tid of pause.timers.values()) clearTimeout(tid);
      this.pausedGames.delete(gameId);
    }
  }

  /* ========== TROUBLE GAME ========== */

  joinTroubleQueue(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this.troubleQueue.push(socket);
    socket.emit('queue:update', { type: 'trouble', position: this.troubleQueue.length });

    if (this.troubleQueue.length >= 4) {
      const players = this.troubleQueue.splice(0, 4);
      this._startTroubleGame(players, 'casual');
    } else if (this.troubleQueue.length >= 2) {
      this._startTroubleQueueTimer();
    }
  }

  _startTroubleQueueTimer() {
    if (this._troubleQueueTimer) return;
    this._troubleQueueTimer = setTimeout(() => {
      this._troubleQueueTimer = null;
      if (this.troubleQueue.length >= 2) {
        const players = this.troubleQueue.splice(0, Math.min(4, this.troubleQueue.length));
        this._startTroubleGame(players, 'casual');
      }
    }, 15000);
  }

  playTroubleBot(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this._startTroubleGame([socket], 'casual');
  }

  _startTroubleGame(humanSockets, type) {
    const playerCount = 4; // Always 4 players, fill with bots
    const gameId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const matchCode = this._uniqueCode();

    // Build player configs — humans first, then bot-fill
    const players = [];
    for (const sock of humanSockets) {
      const username = sock.username || sock.guestName || 'Guest';
      players.push({
        id: sock.id,
        username,
        isBot: false,
        rating: this.userStore.getUser(username)?.rating || 1200,
        cosmetics: this._cosmeticsOf(username)
      });
    }

    while (players.length < playerCount) {
      const botRating = 1200 + Math.floor((Math.random() - 0.5) * 300);
      const botUsername = `trouble_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const botSocketId = `bot_${botUsername}`;
      this.userStore.ensureBotUser(botUsername, botRating);
      players.push({
        id: botSocketId,
        username: botUsername,
        isBot: true,
        botRating,
        botName: botUsername,
        rating: botRating,
        cosmetics: this._cosmeticsOf(botUsername)
      });
    }

    const gameData = { id: gameId, matchCode, gameType: 'trouble', type, players, startedAt: Date.now() };
    this.games.set(gameId, gameData);
    this.matchCodes.set(matchCode, gameId);

    for (const p of players) {
      this.playerToGame.set(p.id, gameId);
      if (!p.isBot && p.username) this.usernameToGame.set(p.username, gameId);
    }

    for (const p of players) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }

    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'trouble', gameTypeStr: type, players
    });
  }

  /* ---------- Trouble action relays ---------- */

  troubleRollDice(socket) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'troubleRoll', payload: { socketId: socket.id } });
  }

  troubleMakeMove(socket, tokenIdx) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'troubleMove', payload: { socketId: socket.id, tokenIdx } });
  }

  troubleResign(socket) {
    const gameId = this.playerToGame.get(socket.id);
    if (!gameId) return;
    const gd = this.games.get(gameId);
    if (!gd || gd.gameType !== 'trouble') return;

    // Replace with bot instead of ending the game
    const playerIdx = gd.players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1) return;
    this._replaceTroublePlayerWithBot(gd, playerIdx, socket);
  }

  _replaceTroublePlayerWithBot(gd, playerIdx, oldSocket) {
    const botRating = 1200;
    const botUsername = `trouble_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const botSocketId = `bot_${botUsername}`;
    this.userStore.ensureBotUser(botUsername, botRating);

    // Clean up old socket from maps
    this.playerToGame.delete(oldSocket.id);
    if (oldSocket.username) this.usernameToGame.delete(oldSocket.username);
    const sock = this._getSocket(oldSocket.id);
    if (sock) sock.leave(gd.id);

    // Update player entry in game data
    gd.players[playerIdx] = {
      id: botSocketId,
      username: botUsername,
      isBot: true,
      botRating,
      botName: botUsername,
      rating: botRating,
      cosmetics: this._cosmeticsOf(botUsername)
    };

    this.playerToGame.set(botSocketId, gd.id);

    // Tell worker to create the bot
    const worker = this.workers.get(gd.id);
    if (worker) {
      worker.postMessage({
        type: 'replaceWithBot',
        payload: { playerIndex: playerIdx, botRating, botName: botUsername, botSocketId }
      });
    }
  }

  /* ========== SCRABBLE GAME ========== */

  setScrabbleDictionaryPath(dictPath) {
    this.scrabbleDictionaryPath = dictPath;
  }

  joinScrabbleQueue(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this.scrabbleQueue.push(socket);
    socket.emit('queue:update', { type: 'scrabble', position: this.scrabbleQueue.length });

    if (this.scrabbleQueue.length >= 4) {
      const players = this.scrabbleQueue.splice(0, 4);
      this._startScrabbleGame(players, 'casual');
    } else if (this.scrabbleQueue.length >= 2) {
      this._startScrabbleQueueTimer();
    }
  }

  _startScrabbleQueueTimer() {
    if (this._scrabbleQueueTimer) return;
    this._scrabbleQueueTimer = setTimeout(() => {
      this._scrabbleQueueTimer = null;
      if (this.scrabbleQueue.length >= 2) {
        const players = this.scrabbleQueue.splice(0, Math.min(4, this.scrabbleQueue.length));
        this._startScrabbleGame(players, 'casual');
      }
    }, 15000);
  }

  playScrabbleBot(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this._startScrabbleGame([socket], 'casual');
  }

  _startScrabbleGame(humanSockets, type) {
    const playerCount = Math.max(2, humanSockets.length);
    const gameId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const matchCode = this._uniqueCode();

    const players = [];
    for (const sock of humanSockets) {
      const username = sock.username || sock.guestName || 'Guest';
      players.push({
        id: sock.id,
        username,
        isBot: false,
        rating: this.userStore.getUser(username)?.rating || 1200,
        cosmetics: this._cosmeticsOf(username)
      });
    }

    while (players.length < playerCount) {
      const botRating = 1200 + Math.floor((Math.random() - 0.5) * 300);
      const botUsername = `scrabble_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const botSocketId = `bot_${botUsername}`;
      this.userStore.ensureBotUser(botUsername, botRating);
      players.push({
        id: botSocketId,
        username: botUsername,
        isBot: true,
        botRating,
        botName: botUsername,
        rating: botRating,
        cosmetics: this._cosmeticsOf(botUsername)
      });
    }

    const gameData = { id: gameId, matchCode, gameType: 'scrabble', type, players, startedAt: Date.now() };
    this.games.set(gameId, gameData);
    this.matchCodes.set(matchCode, gameId);

    for (const p of players) {
      this.playerToGame.set(p.id, gameId);
      if (!p.isBot && p.username) this.usernameToGame.set(p.username, gameId);
    }

    for (const p of players) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }

    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'scrabble', gameTypeStr: type, players,
      gameConfig: { dictionaryPath: this.scrabbleDictionaryPath }
    });
  }

  /* ---------- Scrabble action relays ---------- */

  scrabblePlaceTiles(socket, placements) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'scrabblePlace', payload: { socketId: socket.id, placements } });
  }

  scrabbleExchangeTiles(socket, tileIndices) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'scrabbleExchange', payload: { socketId: socket.id, tileIndices } });
  }

  scrabblePass(socket) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'scrabblePass', payload: { socketId: socket.id } });
  }

  scrabbleResign(socket) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'resign', payload: { socketId: socket.id } });
  }

  /* ---------- Stats ---------- */

  getOnlineCount() {
    return this.io.engine?.clientsCount || 0;
  }

  getQueueCounts() {
    return {
      casual: this.casualQueue.length,
      ranked: this.rankedQueue.length,
      trouble: this.troubleQueue.length,
      scrabble: this.scrabbleQueue.length
    };
  }

  getActiveGameCount() {
    return this.games.size;
  }
}

module.exports = Matchmaker;
