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
    this.cahQueue = [];               // socket refs for CAH
    this.cahLobbies = new Map();      // code -> { host, players: [{ socket, username }], hostUsername, packType, maxRounds, createdAt }
    this.c4Queue = [];              // Connect Four queue
    this.poolQueue = [];            // 8-Ball Pool queue
    this.battleshipQueue = [];      // Battleship queue
    this.mancalaQueue = [];         // Mancala queue
    this.warQueue = [];
    this.c8Queue = [];
    this.gfQueue = [];
    this.bjQueue = [];
    this.grQueue = [];
    this.htQueue = [];
    this.spQueue = [];
    this.pkQueue = [];
    this.hlQueue = [];
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
    do { code = this._genCode(); } while (this.lobbies.has(code) || this.troubleLobbies.has(code) || this.cahLobbies.has(code) || this.matchCodes.has(code));
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
    this.cahQueue = this.cahQueue.filter(s => s.id !== socket.id);
    this.warQueue = this.warQueue.filter(s => s.id !== socket.id);
    this.c8Queue = this.c8Queue.filter(s => s.id !== socket.id);
    this.gfQueue = this.gfQueue.filter(s => s.id !== socket.id);
    this.bjQueue = this.bjQueue.filter(s => s.id !== socket.id);
    this.grQueue = this.grQueue.filter(s => s.id !== socket.id);
    this.htQueue = this.htQueue.filter(s => s.id !== socket.id);
    this.spQueue = this.spQueue.filter(s => s.id !== socket.id);
    this.pkQueue = this.pkQueue.filter(s => s.id !== socket.id);
    this.hlQueue = this.hlQueue.filter(s => s.id !== socket.id);
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

  _getCosmetics(username) {
    if (!username) return {};
    const user = this.userStore.getUser(username);
    if (!user) return {};
    return {
      board: user.equippedBoard || 'default',
      pieces: user.equippedPieces || 'default',
      badge: user.equippedBadge || null,
      site: user.equippedSiteTheme || 'default'
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
      console.error(`Worker error for game ${gameId}:`, err.message, err.stack);
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

      case 'serialized':
        if (this._serializeCallbacks && this._serializeCallbacks.has(gameId)) {
          const cb = this._serializeCallbacks.get(gameId);
          this._serializeCallbacks.delete(gameId);
          cb(msg.payload);
        }
        break;

      case 'restored':
        console.log(`Game ${msg.payload.gameId} worker restored`);
        break;
    }
  }

  _handleWorkerCrash(gameId) {
    const gd = this.games.get(gameId);
    if (!gd) return;
    const reason = 'Game ended due to server error';
    const event = gd.gameType === 'scrabble' ? 'scrabble:over'
                : gd.gameType === 'trouble' ? 'trouble:over'
                : gd.gameType === 'cah' ? 'cah:over'
                : gd.gameType === 'c4' ? 'c4:over'
                : gd.gameType === 'battleship' ? 'bs:over'
                : gd.gameType === 'mancala' ? 'mancala:over'
                : gd.gameType === 'war' ? 'war:over'
                : gd.gameType === 'crazy8' ? 'c8:over'
                : gd.gameType === 'gofish' ? 'gf:over'
                : gd.gameType === 'blackjack' ? 'bj:over'
                : gd.gameType === 'ginrummy' ? 'gr:over'
                : gd.gameType === 'hearts' ? 'ht:over'
                : gd.gameType === 'spades' ? 'sp:over'
                : gd.gameType === 'poker' ? 'pk:over'
                : gd.gameType === 'higherlower' ? 'hl:over'
                : gd.gameType === 'pool' ? 'pool:over'
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

    } else if (gd.gameType === 'cah') {
      const { winnerIdx } = overPayload;
      for (let i = 0; i < gd.players.length; i++) {
        const username = gd.players[i].username;
        const user = this.userStore.getUser(username);
        if (!user || user.isBot) continue;
        const reward = i === winnerIdx ? 15 : 5;
        this.userStore.updateUser(username, { coins: (user.coins || 0) + reward });
      }
      for (const p of gd.players) this._decrementTrials(p.username);

    } else if (gd.gameType === 'c4' || gd.gameType === 'battleship' || gd.gameType === 'mancala') {
      // 2-player games: 10 coins winner, 3 loser
      const winnerIdx = gd.gameType === 'c4' ? overPayload.winnerIdx : overPayload.winner;
      if (typeof winnerIdx === 'number') {
        for (let i = 0; i < gd.players.length; i++) {
          const p = gd.players[i];
          if (p.isBot) continue;
          const user = this.userStore.getUser(p.username);
          if (!user) continue;
          const isWinner = i === winnerIdx;
          this.userStore.updateUser(p.username, {
            coins: (user.coins || 0) + (isWinner ? 10 : 3),
            wins: isWinner ? (user.wins || 0) + 1 : user.wins,
            losses: isWinner ? user.losses : (user.losses || 0) + 1
          });
        }
      }
      for (const p of gd.players) this._decrementTrials(p.username);

    } else if (['war', 'crazy8', 'gofish', 'blackjack', 'ginrummy', 'hearts', 'spades', 'poker', 'higherlower', 'pool'].includes(gd.gameType)) {
      // Card games: give winner coins
      const { winner } = overPayload;
      if (typeof winner === 'number' && gd.players[winner]) {
        const winnerUser = this.userStore.getUser(gd.players[winner].username);
        if (winnerUser && !gd.players[winner].isBot) {
          winnerUser.coins = (winnerUser.coins || 0) + 10;
          winnerUser.wins = (winnerUser.wins || 0) + 1;
          this.userStore.updateUser(gd.players[winner].username, winnerUser);
        }
      }
      for (const p of gd.players) {
        if (p.isBot || (typeof winner === 'number' && p.playerIndex === winner)) continue;
        const u = this.userStore.getUser(p.username);
        if (u) {
          u.coins = (u.coins || 0) + 3;
          u.losses = (u.losses || 0) + 1;
          this.userStore.updateUser(p.username, u);
        }
      }
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

  _setQueueTimer(socket, callback) {
    this._cancelQueueTimer(socket.id);
    const tid = setTimeout(callback, QUEUE_TIMEOUT_MS);
    this.queueTimers.set(socket.id, tid);
  }

  _clearQueueTimer(socket) {
    this._cancelQueueTimer(socket.id);
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
    if (this.cahLobbies.has(code)) return { type: 'cah', code };
    return null;
  }

  leaveQueue(socket) {
    this._removeFromQueues(socket);
    this.c4Queue = this.c4Queue.filter(s => s.id !== socket.id);
    this.poolQueue = this.poolQueue.filter(s => s.id !== socket.id);
    this.battleshipQueue = this.battleshipQueue.filter(s => s.id !== socket.id);
    this.mancalaQueue = this.mancalaQueue.filter(s => s.id !== socket.id);
    this.warQueue = this.warQueue.filter(s => s.id !== socket.id);
    this.c8Queue = this.c8Queue.filter(s => s.id !== socket.id);
    this.gfQueue = this.gfQueue.filter(s => s.id !== socket.id);
    this.bjQueue = this.bjQueue.filter(s => s.id !== socket.id);
    this.grQueue = this.grQueue.filter(s => s.id !== socket.id);
    this.htQueue = this.htQueue.filter(s => s.id !== socket.id);
    this.spQueue = this.spQueue.filter(s => s.id !== socket.id);
    this.pkQueue = this.pkQueue.filter(s => s.id !== socket.id);
    this.hlQueue = this.hlQueue.filter(s => s.id !== socket.id);
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
    this.cahQueue = this.cahQueue.filter(s => s.id !== socket.id);
    this.c4Queue = this.c4Queue.filter(s => s.id !== socket.id);
    this.poolQueue = this.poolQueue.filter(s => s.id !== socket.id);
    this.battleshipQueue = this.battleshipQueue.filter(s => s.id !== socket.id);
    this.mancalaQueue = this.mancalaQueue.filter(s => s.id !== socket.id);
    this.warQueue = this.warQueue.filter(s => s.id !== socket.id);
    this.c8Queue = this.c8Queue.filter(s => s.id !== socket.id);
    this.gfQueue = this.gfQueue.filter(s => s.id !== socket.id);
    this.bjQueue = this.bjQueue.filter(s => s.id !== socket.id);
    this.grQueue = this.grQueue.filter(s => s.id !== socket.id);
    this.htQueue = this.htQueue.filter(s => s.id !== socket.id);
    this.spQueue = this.spQueue.filter(s => s.id !== socket.id);
    this.pkQueue = this.pkQueue.filter(s => s.id !== socket.id);
    this.hlQueue = this.hlQueue.filter(s => s.id !== socket.id);

    // Clean up lobbies
    for (const [code, lobby] of this.lobbies) {
      if (lobby.host.id === socket.id) {
        this.lobbies.delete(code);
        break;
      }
    }

    // Clean up trouble lobbies
    this.leaveTroubleLobby(socket);

    // Clean up CAH lobbies
    this.leaveCAHLobby(socket);

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
                    : gd.gameType === 'cah' ? 'cah:paused'
                    : gd.gameType === 'c4' ? 'c4:paused'
                    : gd.gameType === 'battleship' ? 'bs:paused'
                    : gd.gameType === 'mancala' ? 'mancala:paused'
                    : gd.gameType === 'war' ? 'war:paused'
                    : gd.gameType === 'crazy8' ? 'c8:paused'
                    : gd.gameType === 'gofish' ? 'gf:paused'
                    : gd.gameType === 'blackjack' ? 'bj:paused'
                    : gd.gameType === 'ginrummy' ? 'gr:paused'
                    : gd.gameType === 'hearts' ? 'ht:paused'
                    : gd.gameType === 'spades' ? 'sp:paused'
                    : gd.gameType === 'poker' ? 'pk:paused'
                    : gd.gameType === 'higherlower' ? 'hl:paused'
                    : gd.gameType === 'pool' ? 'pool:paused'
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
                        : gd.gameType === 'cah' ? 'cah:resumed'
                        : gd.gameType === 'c4' ? 'c4:resumed'
                        : gd.gameType === 'battleship' ? 'bs:resumed'
                        : gd.gameType === 'mancala' ? 'mancala:resumed'
                        : gd.gameType === 'war' ? 'war:resumed'
                        : gd.gameType === 'crazy8' ? 'c8:resumed'
                        : gd.gameType === 'gofish' ? 'gf:resumed'
                        : gd.gameType === 'blackjack' ? 'bj:resumed'
                        : gd.gameType === 'ginrummy' ? 'gr:resumed'
                        : gd.gameType === 'hearts' ? 'ht:resumed'
                        : gd.gameType === 'spades' ? 'sp:resumed'
                        : gd.gameType === 'poker' ? 'pk:resumed'
                        : gd.gameType === 'higherlower' ? 'hl:resumed'
                        : gd.gameType === 'pool' ? 'pool:resumed'
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

  /* ========== CARDS AGAINST HUMANITY GAME ========== */

  joinCAHQueue(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.cahQueue = this.cahQueue.filter(s => s.id !== socket.id);
    this.cahQueue.push(socket);
    socket.emit('queue:update', { type: 'cah', position: this.cahQueue.length });

    if (this.cahQueue.length >= 6) {
      const players = this.cahQueue.splice(0, 6);
      this._startCAHGame(players, 'casual');
    } else if (this.cahQueue.length >= 3) {
      this._startCAHQueueTimer();
    }
  }

  _startCAHQueueTimer() {
    if (this._cahQueueTimer) return;
    this._cahQueueTimer = setTimeout(() => {
      this._cahQueueTimer = null;
      if (this.cahQueue.length >= 3) {
        const players = this.cahQueue.splice(0, Math.min(8, this.cahQueue.length));
        this._startCAHGame(players, 'casual');
      }
    }, 15000);
  }

  playCAHBot(socket) {
    if (this._hasActiveGame(socket)) return;
    this._removeFromQueues(socket);
    this.cahQueue = this.cahQueue.filter(s => s.id !== socket.id);
    this._startCAHGame([socket], 'casual');
  }

  createCAHLobby(socket, options) {
    if (this._hasActiveGame(socket)) return;
    // Remove existing lobby by this host
    for (const [code, lobby] of this.cahLobbies) {
      if (lobby.host.id === socket.id) {
        for (const p of lobby.players) {
          if (p.socket.id !== socket.id) {
            p.socket.emit('cahLobby:disbanded', { message: 'Host cancelled the lobby' });
          }
        }
        this.cahLobbies.delete(code);
        break;
      }
    }
    const code = this._uniqueCode();
    const username = socket.username || socket.guestName || 'Host';
    const packType = (options && options.packType === 'adult') ? 'adult' : 'pg13';
    const maxRounds = Math.max(3, Math.min(25, (options && options.maxRounds) || 10));
    const lobbyData = {
      host: socket,
      hostUsername: username,
      players: [{ socket, username }],
      packType,
      maxRounds,
      createdAt: Date.now()
    };
    this.cahLobbies.set(code, lobbyData);
    socket.emit('cahLobby:created', { code, players: [{ username }], packType, maxRounds });
  }

  joinCAHLobby(socket, code) {
    code = (code || '').toUpperCase().trim();
    const lobby = this.cahLobbies.get(code);
    if (!lobby) return socket.emit('cahLobby:error', { message: 'Lobby not found' });
    if (lobby.players.some(p => p.socket.id === socket.id)) {
      return socket.emit('cahLobby:error', { message: 'Already in this lobby' });
    }
    if (lobby.players.length >= 8) {
      return socket.emit('cahLobby:error', { message: 'Lobby is full (max 8 players)' });
    }

    const username = socket.username || socket.guestName || 'Guest';
    lobby.players.push({ socket, username });

    const playerList = lobby.players.map(p => ({ username: p.username }));
    for (const p of lobby.players) {
      p.socket.emit('cahLobby:updated', { players: playerList, code, packType: lobby.packType, maxRounds: lobby.maxRounds });
    }
  }

  startCAHLobby(socket, code) {
    code = (code || '').toUpperCase().trim();
    const lobby = this.cahLobbies.get(code);
    if (!lobby) return socket.emit('cahLobby:error', { message: 'Lobby not found' });
    if (lobby.host.id !== socket.id) {
      return socket.emit('cahLobby:error', { message: 'Only the host can start the game' });
    }
    if (lobby.players.length < 3) {
      return socket.emit('cahLobby:error', { message: 'Need at least 3 players to start' });
    }
    this._launchCAHLobby(code);
  }

  _launchCAHLobby(code) {
    const lobby = this.cahLobbies.get(code);
    if (!lobby) return;
    this.cahLobbies.delete(code);
    const humanSockets = lobby.players.map(p => p.socket);
    this._startCAHGame(humanSockets, 'private', lobby.packType, lobby.maxRounds);
  }

  leaveCAHLobby(socket) {
    for (const [code, lobby] of this.cahLobbies) {
      const idx = lobby.players.findIndex(p => p.socket.id === socket.id);
      if (idx === -1) continue;

      if (lobby.host.id === socket.id) {
        for (const p of lobby.players) {
          if (p.socket.id !== socket.id) {
            p.socket.emit('cahLobby:disbanded', { message: 'Host left the lobby' });
          }
        }
        this.cahLobbies.delete(code);
      } else {
        lobby.players.splice(idx, 1);
        const playerList = lobby.players.map(p => ({ username: p.username }));
        for (const p of lobby.players) {
          p.socket.emit('cahLobby:updated', { players: playerList, code, packType: lobby.packType, maxRounds: lobby.maxRounds });
        }
      }
      return;
    }
  }

  _startCAHGame(humanSockets, type, packType, maxRounds) {
    packType = packType || 'pg13';
    maxRounds = maxRounds || 10;

    const minPlayers = 3;
    const gameId = `cah_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

    // Fill with bots if under minimum
    while (players.length < minPlayers) {
      const botRating = 1200;
      const botUsername = `cah_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

    const gameData = { id: gameId, matchCode, gameType: 'cah', type, players, startedAt: Date.now() };
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
      gameId, matchCode, gameType: 'cah', gameTypeStr: type, players,
      gameConfig: { packType, maxRounds }
    });
  }

  /* ---------- CAH action relays ---------- */

  cahSubmitCards(socket, cardIndices) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'cahSubmit', payload: { socketId: socket.id, cardIndices } });
  }

  cahPickWinner(socket, submissionIdx) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'cahPick', payload: { socketId: socket.id, submissionIdx } });
  }

  cahResign(socket) {
    const gameId = this.playerToGame.get(socket.id);
    const worker = gameId && this.workers.get(gameId);
    if (worker) worker.postMessage({ type: 'resign', payload: { socketId: socket.id } });
  }

  /* ========== CONNECT FOUR GAME ========== */

  /* ---- Connect Four Queue ---- */
  joinC4Queue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.c4Queue = this.c4Queue.filter(s => s.id !== socket.id);
    this.c4Queue.push(socket);
    socket.emit('queue:joined', { game: 'c4' });
    this._matchC4();
    this._setQueueTimer(socket, () => this.playC4Bot(socket));
  }

  _matchC4() {
    while (this.c4Queue.length >= 2) {
      const p1 = this.c4Queue.shift();
      const p2 = this.c4Queue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startC4Game([p1, p2], 'casual');
    }
  }

  playC4Bot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.c4Queue = this.c4Queue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startC4Game([socket], 'bot');
  }

  _startC4Game(sockets, type) {
    const gameId = 'c4_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();

    const playerData = sockets.map((s, i) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));

    // Add bot if solo
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_c4_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['DropMaster','FourSight','GridBot','ConnectAI','ColumnKing','DiscDrop'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }

    const gd = { gameId, matchCode, type, gameType: 'c4', players: playerData, c4Game: null };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }

    // Join real sockets to Socket.IO room
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }

    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'c4', gameTypeStr: type,
      players: playerData
    });
  }

  /* ---- Connect Four Actions ---- */
  c4MakeMove(socket, col) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'c4Move', payload: { socketId: socket.id, col } });
  }

  c4Resign(socket) { this.resign(socket); }

  /* ========== 8-BALL POOL GAME ========== */

  /* ---- Pool Queue ---- */
  joinPoolQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.poolQueue = this.poolQueue.filter(s => s.id !== socket.id);
    this.poolQueue.push(socket);
    socket.emit('queue:joined', { game: 'pool' });
    this._matchPool();
    this._setQueueTimer(socket, () => this.playPoolBot(socket));
  }

  _matchPool() {
    while (this.poolQueue.length >= 2) {
      const p1 = this.poolQueue.shift();
      const p2 = this.poolQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startPoolGame([p1, p2], 'casual');
    }
  }

  playPoolBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.poolQueue = this.poolQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startPoolGame([socket], 'bot');
  }

  _startPoolGame(sockets, type) {
    const gameId = 'pool_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();

    const playerData = sockets.map((s, i) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));

    // Add bot if solo
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_pool_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['CueMaster','ShotBot','RackAttack','PoolShark','BankShot','SideSpinner'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }

    const gd = { gameId, matchCode, type, gameType: 'pool', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }

    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }

    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'pool', gameTypeStr: type,
      players: playerData
    });
  }

  /* ---- Pool Actions ---- */
  poolShoot(socket, angle, power) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'poolShoot', payload: { socketId: socket.id, angle, power } });
  }

  poolPlaceCue(socket, x, y) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'poolPlaceCue', payload: { socketId: socket.id, x, y } });
  }

  poolResign(socket) { this.resign(socket); }

  /* ========== BATTLESHIP GAME ========== */

  /* ---- Battleship Queue ---- */
  joinBattleshipQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.battleshipQueue = this.battleshipQueue.filter(s => s.id !== socket.id);
    this.battleshipQueue.push(socket);
    socket.emit('queue:joined', { game: 'battleship' });
    this._matchBattleship();
    this._setQueueTimer(socket, () => this.playBattleshipBot(socket));
  }

  _matchBattleship() {
    while (this.battleshipQueue.length >= 2) {
      const p1 = this.battleshipQueue.shift();
      const p2 = this.battleshipQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startBattleshipGame([p1, p2], 'casual');
    }
  }

  playBattleshipBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.battleshipQueue = this.battleshipQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startBattleshipGame([socket], 'bot');
  }

  _startBattleshipGame(sockets, type) {
    const gameId = 'bs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();

    const playerData = sockets.map((s, i) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));

    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_bs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['Admiral','Captain','Commander','Ensign','Navigator','Helmsman'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }

    const gd = { gameId, matchCode, type, gameType: 'battleship', players: playerData, bsGame: null };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }

    // Join real sockets to Socket.IO room
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }

    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'battleship', gameTypeStr: type,
      players: playerData
    });
  }

  /* ---- Battleship Actions ---- */
  bsPlaceShip(socket, shipName, row, col, horizontal) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bsPlaceShip', payload: { socketId: socket.id, shipName, row, col, horizontal } });
  }

  bsAutoPlace(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bsAutoPlace', payload: { socketId: socket.id } });
  }

  bsSetReady(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bsSetReady', payload: { socketId: socket.id } });
  }

  bsFireShot(socket, row, col) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bsFireShot', payload: { socketId: socket.id, row, col } });
  }

  battleshipResign(socket) { this.resign(socket); }

  /* ========== MANCALA GAME ========== */

  /* ---- Mancala Queue ---- */
  joinMancalaQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.mancalaQueue = this.mancalaQueue.filter(s => s.id !== socket.id);
    this.mancalaQueue.push(socket);
    socket.emit('queue:joined', { game: 'mancala' });
    this._matchMancala();
    this._setQueueTimer(socket, () => this.playMancalaBot(socket));
  }

  _matchMancala() {
    while (this.mancalaQueue.length >= 2) {
      const p1 = this.mancalaQueue.shift();
      const p2 = this.mancalaQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startMancalaGame([p1, p2], 'casual');
    }
  }

  playMancalaBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.mancalaQueue = this.mancalaQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startMancalaGame([socket], 'bot');
  }

  _startMancalaGame(sockets, type) {
    const gameId = 'mn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();

    const playerData = sockets.map((s, i) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));

    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_mn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['SeedSower','StoneKing','PitMaster','MancalaMind','SowBot','HarvestAI'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }

    const gd = { gameId, matchCode, type, gameType: 'mancala', players: playerData, mancalaGame: null };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }

    // Join real sockets to Socket.IO room
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }

    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'mancala', gameTypeStr: type,
      players: playerData
    });
  }

  /* ---- Mancala Actions ---- */
  mancalaMakeMove(socket, pitIdx) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'mancalaMove', payload: { socketId: socket.id, pitIdx } });
  }

  mancalaResign(socket) { this.resign(socket); }

  /* ========== WAR ========== */
  joinWarQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.warQueue = this.warQueue.filter(s => s.id !== socket.id);
    this.warQueue.push(socket);
    socket.emit('queue:joined', { game: 'war' });
    this._matchWar();
    this._setQueueTimer(socket, () => this.playWarBot(socket));
  }

  _matchWar() {
    while (this.warQueue.length >= 2) {
      const p1 = this.warQueue.shift();
      const p2 = this.warQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startWarGame([p1, p2], 'casual');
    }
  }

  playWarBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.warQueue = this.warQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startWarGame([socket], 'bot');
  }

  _startWarGame(sockets, type) {
    const gameId = 'wr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_wr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['WarLord','BattleBot','CardGeneral','WarMachine','DeckCommander','CardSoldier'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'war', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'war', gameTypeStr: type,
      players: playerData
    });
  }

  warPlayRound(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'warPlay', payload: { socketId: socket.id } });
  }

  warResign(socket) { this.resign(socket); }

  /* ========== CRAZY EIGHTS ========== */
  joinC8Queue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.c8Queue = this.c8Queue.filter(s => s.id !== socket.id);
    this.c8Queue.push(socket);
    socket.emit('queue:joined', { game: 'crazy8' });
    this._matchC8();
    this._setQueueTimer(socket, () => this.playC8Bot(socket));
  }

  _matchC8() {
    while (this.c8Queue.length >= 2) {
      const p1 = this.c8Queue.shift();
      const p2 = this.c8Queue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startC8Game([p1, p2], 'casual');
    }
  }

  playC8Bot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.c8Queue = this.c8Queue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startC8Game([socket], 'bot');
  }

  _startC8Game(sockets, type) {
    const gameId = 'c8_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_c8_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['CrazyBot','EightBall','WildCard','SuitSwapper','CrazyAce','CardCrazy'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'crazy8', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'crazy8', gameTypeStr: type,
      players: playerData
    });
  }

  c8PlayCard(socket, cardIndex, chosenSuit) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'c8Play', payload: { socketId: socket.id, cardIndex, chosenSuit } });
  }

  c8DrawCard(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'c8Draw', payload: { socketId: socket.id } });
  }

  c8Resign(socket) { this.resign(socket); }

  /* ========== GO FISH ========== */
  joinGfQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.gfQueue = this.gfQueue.filter(s => s.id !== socket.id);
    this.gfQueue.push(socket);
    socket.emit('queue:joined', { game: 'gofish' });
    this._matchGf();
    this._setQueueTimer(socket, () => this.playGfBot(socket));
  }

  _matchGf() {
    while (this.gfQueue.length >= 2) {
      const p1 = this.gfQueue.shift();
      const p2 = this.gfQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startGfGame([p1, p2], 'casual');
    }
  }

  playGfBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.gfQueue = this.gfQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startGfGame([socket], 'bot');
  }

  _startGfGame(sockets, type) {
    const gameId = 'gf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_gf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['FishBot','GoFisher','DeepSea','ReelMaster','CatchBot','PondKing'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'gofish', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'gofish', gameTypeStr: type,
      players: playerData
    });
  }

  gfAskForCard(socket, targetIdx, rank) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'gfAsk', payload: { socketId: socket.id, targetIdx, rank } });
  }

  gfResign(socket) { this.resign(socket); }

  /* ========== BLACKJACK ========== */
  joinBjQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.bjQueue = this.bjQueue.filter(s => s.id !== socket.id);
    this.bjQueue.push(socket);
    socket.emit('queue:joined', { game: 'blackjack' });
    this._matchBj();
    this._setQueueTimer(socket, () => this.playBjBot(socket));
  }

  _matchBj() {
    while (this.bjQueue.length >= 2) {
      const p1 = this.bjQueue.shift();
      const p2 = this.bjQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startBjGame([p1, p2], 'casual');
    }
  }

  playBjBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.bjQueue = this.bjQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startBjGame([socket], 'bot');
  }

  _startBjGame(sockets, type) {
    const gameId = 'bj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_bj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['DealerBot','BlackjackAce','CardCounter','HitMeBot','21Master','JackBot'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'blackjack', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'blackjack', gameTypeStr: type,
      players: playerData
    });
  }

  bjPlaceBet(socket, amount) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bjBet', payload: { socketId: socket.id, amount } });
  }

  bjHit(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bjHit', payload: { socketId: socket.id } });
  }

  bjStand(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bjStand', payload: { socketId: socket.id } });
  }

  bjDouble(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'bjDouble', payload: { socketId: socket.id } });
  }

  bjResign(socket) { this.resign(socket); }

  /* ========== GIN RUMMY ========== */
  joinGrQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.grQueue = this.grQueue.filter(s => s.id !== socket.id);
    this.grQueue.push(socket);
    socket.emit('queue:joined', { game: 'ginrummy' });
    this._matchGr();
    this._setQueueTimer(socket, () => this.playGrBot(socket));
  }

  _matchGr() {
    while (this.grQueue.length >= 2) {
      const p1 = this.grQueue.shift();
      const p2 = this.grQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startGrGame([p1, p2], 'casual');
    }
  }

  playGrBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.grQueue = this.grQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startGrGame([socket], 'bot');
  }

  _startGrGame(sockets, type) {
    const gameId = 'gr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_gr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['GinMaster','RummyBot','MeldKing','KnockBot','GinAce','CardMelder'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'ginrummy', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'ginrummy', gameTypeStr: type,
      players: playerData
    });
  }

  grDrawFromPile(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'grDrawPile', payload: { socketId: socket.id } });
  }

  grDrawFromDiscard(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'grDrawDiscard', payload: { socketId: socket.id } });
  }

  grDiscard(socket, cardIndex) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'grDiscard', payload: { socketId: socket.id, cardIndex } });
  }

  grKnock(socket, cardIndex) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'grKnock', payload: { socketId: socket.id, cardIndex } });
  }

  grResign(socket) { this.resign(socket); }

  /* ========== HEARTS ========== */
  joinHtQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.htQueue = this.htQueue.filter(s => s.id !== socket.id);
    this.htQueue.push(socket);
    socket.emit('queue:joined', { game: 'hearts' });
    this._matchHt();
    this._setQueueTimer(socket, () => this.playHtBot(socket));
  }

  _matchHt() {
    while (this.htQueue.length >= 4) {
      const players = [];
      for (let i = 0; i < 4; i++) {
        const p = this.htQueue.shift();
        this._clearQueueTimer(p);
        players.push(p);
      }
      this._startHtGame(players, 'casual');
    }
  }

  playHtBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.htQueue = this.htQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startHtGame([socket], 'bot');
  }

  _startHtGame(sockets, type) {
    const gameId = 'ht_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    while (playerData.length < 4) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_ht_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + playerData.length;
      const botNames = ['HeartBreaker','QueenDodger','TrickTaker','HeartBot','SuitAvoider','CardSweeper'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'hearts', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'hearts', gameTypeStr: type,
      players: playerData
    });
  }

  htPassCards(socket, cardIndices) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'htPass', payload: { socketId: socket.id, cardIndices } });
  }

  htPlayCard(socket, cardIndex) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'htPlay', payload: { socketId: socket.id, cardIndex } });
  }

  htResign(socket) { this.resign(socket); }

  /* ========== SPADES ========== */
  joinSpQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.spQueue = this.spQueue.filter(s => s.id !== socket.id);
    this.spQueue.push(socket);
    socket.emit('queue:joined', { game: 'spades' });
    this._matchSp();
    this._setQueueTimer(socket, () => this.playSpBot(socket));
  }

  _matchSp() {
    while (this.spQueue.length >= 4) {
      const players = [];
      for (let i = 0; i < 4; i++) {
        const p = this.spQueue.shift();
        this._clearQueueTimer(p);
        players.push(p);
      }
      this._startSpGame(players, 'casual');
    }
  }

  playSpBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.spQueue = this.spQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startSpGame([socket], 'bot');
  }

  _startSpGame(sockets, type) {
    const gameId = 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    while (playerData.length < 4) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + playerData.length;
      const botNames = ['SpadeMaster','TrumpBot','BidKing','SpadeAce','TrickBot','NilHunter'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'spades', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'spades', gameTypeStr: type,
      players: playerData
    });
  }

  spPlaceBid(socket, bid) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'spBid', payload: { socketId: socket.id, bid } });
  }

  spPlayCard(socket, cardIndex) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'spPlay', payload: { socketId: socket.id, cardIndex } });
  }

  spResign(socket) { this.resign(socket); }

  /* ========== POKER ========== */
  joinPkQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.pkQueue = this.pkQueue.filter(s => s.id !== socket.id);
    this.pkQueue.push(socket);
    socket.emit('queue:joined', { game: 'poker' });
    this._matchPk();
    this._setQueueTimer(socket, () => this.playPkBot(socket));
  }

  _matchPk() {
    while (this.pkQueue.length >= 2) {
      const p1 = this.pkQueue.shift();
      const p2 = this.pkQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startPkGame([p1, p2], 'casual');
    }
  }

  playPkBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.pkQueue = this.pkQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startPkGame([socket], 'bot');
  }

  _startPkGame(sockets, type) {
    const gameId = 'pk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    if (playerData.length < 2) {
      const humanRating = playerData[0].rating;
      const botRating = humanRating + (Math.random() - 0.5) * 200;
      const botId = 'bot_pk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const botNames = ['PokerFace','BluffBot','AllInAce','RiverRat','ChipStack','FoldMaster'];
      const botName = 'Bot ' + botNames[Math.floor(Math.random() * botNames.length)];
      this.userStore.ensureBotUser(botName, botRating);
      playerData.push({
        id: botId,
        username: botName,
        rating: botRating,
        isBot: true,
        botRating,
        botName,
        cosmetics: {}
      });
    }
    const gd = { gameId, matchCode, type, gameType: 'poker', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'poker', gameTypeStr: type,
      players: playerData
    });
  }

  pkFold(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'pkFold', payload: { socketId: socket.id } });
  }

  pkCheck(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'pkCheck', payload: { socketId: socket.id } });
  }

  pkCall(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'pkCall', payload: { socketId: socket.id } });
  }

  pkRaise(socket, amount) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'pkRaise', payload: { socketId: socket.id, amount } });
  }

  pkAllIn(socket) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'pkAllIn', payload: { socketId: socket.id } });
  }

  pkResign(socket) { this.resign(socket); }

  /* ========== HIGHER OR LOWER ========== */
  joinHlQueue(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.hlQueue = this.hlQueue.filter(s => s.id !== socket.id);
    this.hlQueue.push(socket);
    socket.emit('queue:joined', { game: 'higherlower' });
    this._matchHl();
    this._setQueueTimer(socket, () => this.playHlBot(socket));
  }

  _matchHl() {
    while (this.hlQueue.length >= 2) {
      const p1 = this.hlQueue.shift();
      const p2 = this.hlQueue.shift();
      this._clearQueueTimer(p1);
      this._clearQueueTimer(p2);
      this._startHlGame([p1, p2], 'casual');
    }
  }

  playHlBot(socket) {
    if (this.playerToGame.has(socket.id)) return;
    this.hlQueue = this.hlQueue.filter(s => s.id !== socket.id);
    this._clearQueueTimer(socket);
    this._startHlGame([socket], 'bot');
  }

  _startHlGame(sockets, type) {
    const gameId = 'hl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const matchCode = this._genCode();
    const playerData = sockets.map((s) => ({
      id: s.id,
      username: s.username || s.guestName || 'Guest',
      rating: this.userStore.getUser(s.username)?.rating || 1200,
      isBot: false,
      cosmetics: this._getCosmetics(s.username)
    }));
    // Higher or Lower can start with just 1 player — no bot needed for solo
    const gd = { gameId, matchCode, type, gameType: 'higherlower', players: playerData };
    this.games.set(gameId, gd);
    this.matchCodes.set(matchCode, gameId);
    for (const p of playerData) {
      if (!p.isBot) this.playerToGame.set(p.id, gameId);
      this.usernameToGame.set(p.username, gameId);
    }
    for (const p of playerData) {
      if (!p.isBot) {
        const s = this._getSocket(p.id);
        if (s) s.join(gameId);
      }
    }
    this._spawnWorker(gameId, {
      gameId, matchCode, gameType: 'higherlower', gameTypeStr: type,
      players: playerData
    });
  }

  hlGuess(socket, choice) {
    const gid = this.playerToGame.get(socket.id);
    if (!gid) return;
    const worker = this.workers.get(gid);
    if (worker) worker.postMessage({ type: 'hlGuess', payload: { socketId: socket.id, choice } });
  }

  hlResign(socket) { this.resign(socket); }

  /* ---------- Stats ---------- */

  getOnlineCount() {
    return this.io.engine?.clientsCount || 0;
  }

  getQueueCounts() {
    return {
      casual: this.casualQueue.length,
      ranked: this.rankedQueue.length,
      trouble: this.troubleQueue.length,
      scrabble: this.scrabbleQueue.length,
      cah: this.cahQueue.length,
      c4: this.c4Queue.length,
      battleship: this.battleshipQueue.length,
      mancala: this.mancalaQueue.length,
      war: this.warQueue.length,
      crazy8: this.c8Queue.length,
      gofish: this.gfQueue.length,
      blackjack: this.bjQueue.length,
      ginrummy: this.grQueue.length,
      hearts: this.htQueue.length,
      spades: this.spQueue.length,
      poker: this.pkQueue.length,
      higherlower: this.hlQueue.length,
    };
  }

  getActiveGameCount() {
    return this.games.size;
  }

  /* ========== PERSISTENCE: Save / Restore ========== */

  async saveActiveGames() {
    const snapshots = [];
    const promises = [];

    if (!this._serializeCallbacks) this._serializeCallbacks = new Map();

    for (const [gid, worker] of this.workers) {
      const gd = this.games.get(gid);
      if (!gd) continue;

      promises.push(new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this._serializeCallbacks.delete(gid);
          resolve(null);
        }, 3000);

        this._serializeCallbacks.set(gid, (snapshot) => {
          clearTimeout(timeout);
          snapshot.matchmakerData = {
            id: gd.id || gid,
            matchCode: gd.matchCode,
            gameType: gd.gameType,
            type: gd.type,
            players: gd.players,
            startedAt: gd.startedAt
          };
          snapshots.push(snapshot);
          resolve(snapshot);
        });

        worker.postMessage({ type: 'serialize' });
      }));
    }

    await Promise.all(promises);
    return snapshots;
  }

  restoreGames(snapshots) {
    for (const snapshot of snapshots) {
      const md = snapshot.matchmakerData;
      if (!md) continue;

      // Skip games that were already over
      if (snapshot.gameState && snapshot.gameState.gameOver) continue;

      // Rebuild Matchmaker-level maps
      const gameData = {
        id: md.id,
        matchCode: md.matchCode,
        gameType: md.gameType,
        type: md.type,
        players: md.players,
        startedAt: md.startedAt
      };
      this.games.set(md.id, gameData);
      if (md.matchCode) this.matchCodes.set(md.matchCode, md.id);

      // Map usernames to games (but NOT socket IDs — those are stale)
      for (const p of md.players) {
        if (p.username) this.usernameToGame.set(p.username, md.id);
      }

      // Mark all human players as paused/disconnected
      const pause = {
        pausedAt: Date.now(),
        timers: new Map(),
        disconnectedPlayers: new Set()
      };
      for (const p of md.players) {
        if (!p.isBot) {
          pause.disconnectedPlayers.add(p.username);
          // Extended timeout for server restart (4 min instead of 2)
          const timerId = setTimeout(
            () => this._onReconnectTimeout(md.id, p.username),
            RECONNECT_TIMEOUT_MS * 2
          );
          pause.timers.set(p.username, timerId);
        }
      }
      this.pausedGames.set(md.id, pause);

      // Spawn worker from saved state
      const initPayload = {
        gameId: snapshot.gameId,
        matchCode: snapshot.matchCode,
        gameType: snapshot.gameType,
        gameTypeStr: snapshot.gameTypeStr,
        players: snapshot.players,
        gameState: snapshot.gameState,
        chatLog: snapshot.chatLog,
        gameConfig: snapshot.gameConfig || {}
      };
      if (snapshot.gameType === 'scrabble') {
        initPayload.gameConfig.dictionaryPath = this.scrabbleDictionaryPath;
      }

      this._spawnWorkerFromState(md.id, initPayload);
    }

    if (snapshots.length > 0) {
      console.log(`Restored ${this.games.size} active game(s)`);
    }
  }

  _spawnWorkerFromState(gameId, initPayload) {
    const worker = new Worker(WORKER_SCRIPT);
    this.workers.set(gameId, worker);

    worker.on('message', (msg) => this._handleWorkerMessage(gameId, msg));
    worker.on('error', (err) => {
      console.error(`Worker error for game ${gameId}:`, err.message, err.stack);
      this._handleWorkerCrash(gameId);
    });
    worker.on('exit', (code) => {
      this.workers.delete(gameId);
      if (code !== 0 && this.games.has(gameId)) {
        console.error(`Worker exited with code ${code} for game ${gameId}`);
        this._handleWorkerCrash(gameId);
      }
    });

    worker.postMessage({ type: 'initFromState', payload: initPayload });
  }
}

module.exports = Matchmaker;
