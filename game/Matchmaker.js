'use strict';

const CheckersGame = require('./CheckersGame');
const TroubleGame = require('./TroubleGame');
const { calculateNewRatings } = require('./EloRating');
const BotPlayer = require('./BotPlayer');
const TroubleBotPlayer = require('./TroubleBotPlayer');
const ScrabbleGame = require('./ScrabbleGame');
const ScrabbleBotPlayer = require('./ScrabbleBotPlayer');

const QUEUE_TIMEOUT_MS = 90 * 1000;   // 90 seconds before bot match
const BOT_MATCH_DELAY_MS = 1500;      // brief UI notice before game starts

class Matchmaker {
  constructor(io, userStore) {
    this.io = io;
    this.userStore = userStore;       // { getUser, updateUser, ensureBotUser }
    this.casualQueue = [];            // socket refs
    this.rankedQueue = [];            // socket refs
    this.lobbies = new Map();         // code -> { host, guest, hostUsername }
    this.games = new Map();           // gameId -> GameData
    this.playerToGame = new Map();    // socketId -> gameId
    this.queueTimers = new Map();     // socketId -> timeoutId
    this.bots = new Map();            // gameId -> BotPlayer
    this.troubleQueue = [];           // socket refs for Trouble
    this.troubleBots = new Map();     // gameId -> TroubleBotPlayer[]
    this.scrabbleQueue = [];          // socket refs for Scrabble
    this.scrabbleBots = new Map();    // gameId -> ScrabbleBotPlayer[]
    this.scrabbleDictionary = null;   // Set of valid words
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
    do { code = this._genCode(); } while (this.lobbies.has(code));
    return code;
  }

  _removeFromQueues(socket) {
    this.casualQueue = this.casualQueue.filter(s => s.id !== socket.id);
    this.rankedQueue = this.rankedQueue.filter(s => s.id !== socket.id);
    this.scrabbleQueue = this.scrabbleQueue.filter(s => s.id !== socket.id);
    this._cancelQueueTimer(socket.id);
  }

  /* ---------- Queue‐timeout → bot matching ---------- */

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
    // Verify the player is still queued
    const inQueue = this.casualQueue.some(s => s.id === socket.id)
                 || this.rankedQueue.some(s => s.id === socket.id);
    if (!inQueue) return;

    this._removeFromQueues(socket);
    socket.emit('queue:update', { type, status: 'bot_matching' });

    // Brief delay so the client can show "Matching with AI…"
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

    const bot = new BotPlayer(this, botRating, botName);

    // Ensure the bot has a user record so ELO math works
    this.userStore.ensureBotUser(bot.username, botRating);

    this._startGame(socket, bot.socket, type);

    const gameId = this.playerToGame.get(socket.id);
    if (gameId) this.bots.set(gameId, bot);
  }

  /** Instant bot match from the lobby menu (casual, no queue). */
  playBot(socket) {
    this._removeFromQueues(socket);
    this._matchWithBot(socket, 'casual', 'Botty McBotFace');
  }

  /* ---------- Casual queue ---------- */

  joinCasual(socket) {
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
    this._removeFromQueues(socket);
    this.rankedQueue.push(socket);
    socket.emit('queue:update', { type: 'ranked', position: this.rankedQueue.length });
    if (!this._tryMatchRanked()) {
      this._startQueueTimer(socket, 'ranked');
    }
  }

  _tryMatchRanked() {
    if (this.rankedQueue.length < 2) return false;

    // Sort by rating and pair closest
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
    // Remove any existing lobby by this host
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

  leaveQueue(socket) {
    this._removeFromQueues(socket);
    socket.emit('queue:left');
  }

  /* ---------- Game lifecycle ---------- */

  _startGame(sock1, sock2, type) {
    const game = new CheckersGame();
    const flip = Math.random() < 0.5;
    const red = flip ? sock1 : sock2;
    const black = flip ? sock2 : sock1;

    const gameId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const gameData = {
      id: gameId,
      game,
      type,
      red,
      black,
      redUsername: red.username || 'Guest',
      blackUsername: black.username || 'Guest',
      startedAt: Date.now(),
      chatLog: []
    };

    this.games.set(gameId, gameData);
    this.playerToGame.set(red.id, gameId);
    this.playerToGame.set(black.id, gameId);
    red.join(gameId);
    black.join(gameId);

    const state = game.getState();
    const redUser = this.userStore.getUser(gameData.redUsername);
    const blackUser = this.userStore.getUser(gameData.blackUsername);

    const cosmeticsOf = (u) => ({
      board: u?.equippedBoard || 'default',
      pieces: u?.equippedPieces || 'default',
      badge: u?.equippedBadge || null
    });

    red.emit('game:start', {
      gameId,
      color: CheckersGame.RED,
      ...state,
      opponent: { username: gameData.blackUsername, rating: blackUser?.rating || 1200 },
      me: { username: gameData.redUsername, rating: redUser?.rating || 1200 },
      type,
      cosmetics: { me: cosmeticsOf(redUser), opponent: cosmeticsOf(blackUser) }
    });
    black.emit('game:start', {
      gameId,
      color: CheckersGame.BLACK,
      ...state,
      opponent: { username: gameData.redUsername, rating: redUser?.rating || 1200 },
      me: { username: gameData.blackUsername, rating: blackUser?.rating || 1200 },
      type,
      cosmetics: { me: cosmeticsOf(blackUser), opponent: cosmeticsOf(redUser) }
    });
  }

  getGameForSocket(socketId) {
    const gid = this.playerToGame.get(socketId);
    return gid ? this.games.get(gid) : null;
  }

  getPlayerColor(gd, socketId) {
    if (gd.red.id === socketId) return CheckersGame.RED;
    if (gd.black.id === socketId) return CheckersGame.BLACK;
    return 0;
  }

  _endGame(gameId, winner, reason) {
    const gd = this.games.get(gameId);
    if (!gd) return;

    let ratingChange = null;
    if (gd.type === 'ranked' && winner) {
      const winnerUsername = winner === CheckersGame.RED ? gd.redUsername : gd.blackUsername;
      const loserUsername = winner === CheckersGame.RED ? gd.blackUsername : gd.redUsername;
      const winnerUser = this.userStore.getUser(winnerUsername);
      const loserUser = this.userStore.getUser(loserUsername);
      if (winnerUser && loserUser) {
        const result = calculateNewRatings(
          winnerUser.rating, loserUser.rating,
          winnerUser.wins + winnerUser.losses,
          loserUser.wins + loserUser.losses
        );
        this.userStore.updateUser(winnerUsername, {
          rating: result.winnerNew,
          wins: winnerUser.wins + 1
        });
        this.userStore.updateUser(loserUsername, {
          rating: result.loserNew,
          losses: loserUser.losses + 1
        });
        ratingChange = {
          [winnerUsername]: result.winnerDelta,
          [loserUsername]: result.loserDelta
        };
      }
    } else if (gd.type === 'casual' && winner) {
      const winnerUsername = winner === CheckersGame.RED ? gd.redUsername : gd.blackUsername;
      const loserUsername = winner === CheckersGame.RED ? gd.blackUsername : gd.redUsername;
      const wu = this.userStore.getUser(winnerUsername);
      const lu = this.userStore.getUser(loserUsername);
      if (wu) this.userStore.updateUser(winnerUsername, { wins: wu.wins + 1 });
      if (lu) this.userStore.updateUser(loserUsername, { losses: lu.losses + 1 });
    }

    // Award coins (skip bots)
    let coinRewards = {};
    if (winner) {
      const wName = winner === CheckersGame.RED ? gd.redUsername : gd.blackUsername;
      const lName = winner === CheckersGame.RED ? gd.blackUsername : gd.redUsername;
      const wUser = this.userStore.getUser(wName);
      const lUser = this.userStore.getUser(lName);
      if (wUser && !wUser.isBot) {
        this.userStore.updateUser(wName, { coins: (wUser.coins || 0) + 10 });
        coinRewards[wName] = 10;
      }
      if (lUser && !lUser.isBot) {
        this.userStore.updateUser(lName, { coins: (lUser.coins || 0) + 3 });
        coinRewards[lName] = 3;
      }
    }

    // Decrement trial counters for both players
    this._decrementTrials(gd.redUsername);
    this._decrementTrials(gd.blackUsername);

    // Notify both players directly (works with bot mock sockets)
    const overData = { winner, reason, ratingChange, coinRewards };
    gd.red.emit('game:over', overData);
    gd.black.emit('game:over', overData);

    // Clean up bot if present
    const bot = this.bots.get(gameId);
    if (bot) { bot.destroy(); this.bots.delete(gameId); }

    // Clean up game
    gd.red.leave(gameId);
    gd.black.leave(gameId);
    this.playerToGame.delete(gd.red.id);
    this.playerToGame.delete(gd.black.id);
    this.games.delete(gameId);
  }

  /* ---------- Trial management ---------- */

  _decrementTrials(username) {
    const user = this.userStore.getUser(username);
    if (!user || user.isBot || !user.trials) return;
    let changed = false;
    // Decrement each active trial (skip token keys starting with _)
    for (const key of Object.keys(user.trials)) {
      if (key.startsWith('_')) continue;
      if (user.trials[key] > 0) {
        user.trials[key]--;
        changed = true;
        if (user.trials[key] <= 0) {
          delete user.trials[key];
          // Unequip if this trial skin was active
          if (user.equippedBoard === key) user.equippedBoard = 'default';
          if (user.equippedPieces === key) user.equippedPieces = 'default';
        }
      }
    }
    if (changed) this.userStore.updateUser(username, { trials: user.trials });
  }

  /* ---------- In-game actions ---------- */

  selectPiece(socket, row, col) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd) return;
    const color = this.getPlayerColor(gd, socket.id);
    if (color !== gd.game.currentTurn) return socket.emit('game:error', { message: 'Not your turn' });

    const piece = gd.game.board[row]?.[col];
    if (piece == null || !CheckersGame.belongsTo(piece, color)) {
      return socket.emit('game:validMoves', { row, col, moves: [] });
    }
    const moves = gd.game.getValidMoves(row, col);
    socket.emit('game:validMoves', { row, col, moves });
  }

  makeMove(socket, fr, fc, tr, tc) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd) return;
    const color = this.getPlayerColor(gd, socket.id);
    if (color !== gd.game.currentTurn) return socket.emit('game:error', { message: 'Not your turn' });

    const result = gd.game.makeMove(fr, fc, tr, tc);
    if (!result.valid) return socket.emit('game:error', { message: 'Invalid move' });

    const updateData = {
      from: result.from,
      to: result.to,
      captured: result.captured,
      promoted: result.promoted,
      board: result.board,
      currentTurn: result.currentTurn,
      jumpingPiece: result.jumpingPiece,
      continuedJump: result.continuedJump,
      redCount: result.redCount,
      blackCount: result.blackCount
    };
    // Direct emit to both players (works with bot mock sockets)
    gd.red.emit('game:update', updateData);
    gd.black.emit('game:update', updateData);

    if (result.gameOver.over) {
      this._endGame(gd.id, result.gameOver.winner, result.gameOver.reason);
    }
  }

  resign(socket) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd) return;
    const color = this.getPlayerColor(gd, socket.id);
    const winner = color === CheckersGame.RED ? CheckersGame.BLACK : CheckersGame.RED;
    this._endGame(gd.id, winner, 'Opponent resigned');
  }

  /* ---------- Chat ---------- */

  gameChat(socket, message) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd) return;
    const msg = {
      username: socket.username || 'Guest',
      text: String(message).slice(0, 200),
      time: Date.now()
    };
    gd.chatLog.push(msg);
    gd.red.emit('chat:game', msg);
    gd.black.emit('chat:game', msg);
  }

  /* ---------- Disconnect ---------- */

  handleDisconnect(socket) {
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);

    // Clean up lobbies
    for (const [code, lobby] of this.lobbies) {
      if (lobby.host.id === socket.id) {
        this.lobbies.delete(code);
        break;
      }
    }

    // Handle active game (Checkers, Trouble, or Scrabble)
    const gd = this.getGameForSocket(socket.id);
    if (gd) {
      if (gd.scrabbleGame) {
        this._scrabblePlayerDisconnect(gd, socket);
      } else if (gd.troubleGame) {
        this._troublePlayerDisconnect(gd, socket);
      } else {
        const color = this.getPlayerColor(gd, socket.id);
        const winner = color === CheckersGame.RED ? CheckersGame.BLACK : CheckersGame.RED;
        this._endGame(gd.id, winner, 'Opponent disconnected');
      }
    }
  }

  /* ========== TROUBLE GAME ========== */

  joinTroubleQueue(socket) {
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this.troubleQueue.push(socket);
    socket.emit('queue:update', { type: 'trouble', position: this.troubleQueue.length });

    if (this.troubleQueue.length >= 4) {
      // Full game — start immediately
      const players = this.troubleQueue.splice(0, 4);
      this._startTroubleGame(players, 'casual');
    } else if (this.troubleQueue.length >= 2) {
      // Start timer — wait for more players or fill with bots
      this._startTroubleQueueTimer();
    }
  }

  _startTroubleQueueTimer() {
    // If already have a timer going, skip
    if (this._troubleQueueTimer) return;
    this._troubleQueueTimer = setTimeout(() => {
      this._troubleQueueTimer = null;
      if (this.troubleQueue.length >= 2) {
        const players = this.troubleQueue.splice(0, Math.min(4, this.troubleQueue.length));
        this._startTroubleGame(players, 'casual');
      }
    }, 15000); // 15 seconds to gather players, then fill with bots
  }

  playTroubleBot(socket) {
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this._startTroubleGame([socket], 'casual');
  }

  _startTroubleGame(humanSockets, type) {
    const playerCount = 4; // Always 4 players, fill with bots
    const gameId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const game = new TroubleGame(playerCount);

    // Fill empty slots with bots
    const allSockets = [...humanSockets];
    const botInstances = [];
    while (allSockets.length < playerCount) {
      const botRating = 1200 + Math.floor((Math.random() - 0.5) * 300);
      const bot = new TroubleBotPlayer(this, botRating);
      this.userStore.ensureBotUser(bot.username, botRating);
      botInstances.push(bot);
      allSockets.push(bot.socket);
    }

    const players = allSockets.map(s => ({
      socket: s,
      username: s.username || 'Guest'
    }));

    const gameData = {
      id: gameId,
      troubleGame: game,
      type,
      players,
      startedAt: Date.now(),
      chatLog: []
    };

    this.games.set(gameId, gameData);
    if (botInstances.length > 0) this.troubleBots.set(gameId, botInstances);

    for (let i = 0; i < players.length; i++) {
      const s = players[i].socket;
      this.playerToGame.set(s.id, gameId);
      s.join(gameId);
    }

    // Gather cosmetics
    const cosmeticsArr = players.map(p => {
      const u = this.userStore.getUser(p.username);
      return {
        board: u?.equippedBoard || 'default',
        pieces: u?.equippedPieces || 'default',
        badge: u?.equippedBadge || null
      };
    });

    const state = game.getState();

    for (let i = 0; i < players.length; i++) {
      players[i].socket.emit('trouble:start', {
        gameId,
        playerIndex: i,
        playerCount,
        players: players.map((p, idx) => ({
          username: p.username,
          rating: this.userStore.getUser(p.username)?.rating || 1200
        })),
        type,
        cosmetics: cosmeticsArr,
        ...state
      });
    }
  }

  troubleRollDice(socket) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.troubleGame) return;

    const playerIdx = gd.players.findIndex(p => p.socket.id === socket.id);
    if (playerIdx !== gd.troubleGame.currentTurn) return;

    const result = gd.troubleGame.rollDice();
    if (!result.valid) return;

    // Broadcast to all players
    for (const p of gd.players) {
      p.socket.emit('trouble:rollResult', {
        player: playerIdx,
        diceResult: result.diceResult,
        validMoves: result.validMoves,
        skipped: result.skipped,
        currentTurn: gd.troubleGame.currentTurn,
        phase: gd.troubleGame.phase
      });
    }
  }

  troubleMakeMove(socket, tokenIdx) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.troubleGame) return;

    const playerIdx = gd.players.findIndex(p => p.socket.id === socket.id);
    if (playerIdx !== gd.troubleGame.currentTurn) return;

    const result = gd.troubleGame.makeMove(tokenIdx);
    if (!result.valid) return;

    // Broadcast update to all players
    for (const p of gd.players) {
      p.socket.emit('trouble:update', {
        player: result.player,
        tokenIdx: result.tokenIdx,
        fromPos: result.fromPos,
        toPos: result.toPos,
        captured: result.captured,
        finishedToken: result.finishedToken,
        extraTurn: result.extraTurn,
        tokens: result.state.tokens,
        finished: result.state.finished,
        currentTurn: result.state.currentTurn,
        phase: result.state.phase
      });
    }

    if (result.gameOver.over) {
      this._endTroubleGame(gd.id, result.gameOver.winner);
    }
  }

  troubleResign(socket) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.troubleGame) return;
    // Just treat as disconnect — removes player
    this._troublePlayerDisconnect(gd, socket);
  }

  _troublePlayerDisconnect(gd, socket) {
    // In trouble, disconnecting just ends the game (simpler than reassigning)
    // Find a winner: the player with the most finished tokens, or first non-disconnected
    const playerIdx = gd.players.findIndex(p => p.socket.id === socket.id);
    let bestPlayer = 0;
    let bestFinished = -1;
    for (let i = 0; i < gd.players.length; i++) {
      if (i === playerIdx) continue;
      if (gd.troubleGame.finished[i] > bestFinished) {
        bestFinished = gd.troubleGame.finished[i];
        bestPlayer = i;
      }
    }
    this._endTroubleGame(gd.id, bestPlayer);
  }

  _endTroubleGame(gameId, winnerIdx) {
    const gd = this.games.get(gameId);
    if (!gd || !gd.troubleGame) return;

    // Award coins: winner 15, others 3 (skip bots)
    const coinRewards = {};
    for (let i = 0; i < gd.players.length; i++) {
      const username = gd.players[i].username;
      const user = this.userStore.getUser(username);
      if (!user || user.isBot) continue;
      const reward = i === winnerIdx ? 15 : 3;
      this.userStore.updateUser(username, { coins: (user.coins || 0) + reward });
      coinRewards[username] = reward;
    }

    // Decrement trials for human players
    for (const p of gd.players) {
      this._decrementTrials(p.username);
    }

    const overData = {
      winner: winnerIdx,
      winnerUsername: gd.players[winnerIdx]?.username,
      coinRewards
    };

    for (const p of gd.players) {
      p.socket.emit('trouble:over', overData);
    }

    // Clean up bots
    const bots = this.troubleBots.get(gameId);
    if (bots) {
      bots.forEach(b => b.destroy());
      this.troubleBots.delete(gameId);
    }

    // Clean up game
    for (const p of gd.players) {
      p.socket.leave(gameId);
      this.playerToGame.delete(p.socket.id);
    }
    this.games.delete(gameId);
  }

  troubleGameChat(socket, message) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.troubleGame) return;
    const msg = {
      username: socket.username || 'Guest',
      text: String(message).slice(0, 200),
      time: Date.now()
    };
    gd.chatLog.push(msg);
    for (const p of gd.players) {
      p.socket.emit('chat:game', msg);
    }
  }

  /* ========== SCRABBLE GAME ========== */

  setScrabbleDictionary(dict) {
    this.scrabbleDictionary = dict;
  }

  joinScrabbleQueue(socket) {
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
    this._removeFromQueues(socket);
    this.troubleQueue = this.troubleQueue.filter(s => s.id !== socket.id);
    this._startScrabbleGame([socket], 'casual');
  }

  _startScrabbleGame(humanSockets, type) {
    const playerCount = Math.max(2, humanSockets.length);
    const gameId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const game = new ScrabbleGame(playerCount, this.scrabbleDictionary);

    const allSockets = [...humanSockets];
    const botInstances = [];
    while (allSockets.length < playerCount) {
      const botRating = 1200 + Math.floor((Math.random() - 0.5) * 300);
      const bot = new ScrabbleBotPlayer(this, botRating);
      bot.dictionary = this.scrabbleDictionary;
      this.userStore.ensureBotUser(bot.username, botRating);
      botInstances.push(bot);
      allSockets.push(bot.socket);
    }

    // For bot games (single human), add a bot opponent
    if (allSockets.length < 2) {
      const botRating = 1200 + Math.floor((Math.random() - 0.5) * 300);
      const bot = new ScrabbleBotPlayer(this, botRating);
      bot.dictionary = this.scrabbleDictionary;
      this.userStore.ensureBotUser(bot.username, botRating);
      botInstances.push(bot);
      allSockets.push(bot.socket);
      game.playerCount = 2;
      game.scores = [0, 0];
      game.racks.push([]);
      game._drawTiles(1, ScrabbleGame.RACK_SIZE);
    }

    const players = allSockets.map(s => ({
      socket: s,
      username: s.username || 'Guest'
    }));

    const gameData = {
      id: gameId,
      scrabbleGame: game,
      type,
      players,
      startedAt: Date.now(),
      chatLog: []
    };

    this.games.set(gameId, gameData);
    if (botInstances.length > 0) this.scrabbleBots.set(gameId, botInstances);

    for (let i = 0; i < players.length; i++) {
      const s = players[i].socket;
      this.playerToGame.set(s.id, gameId);
      s.join(gameId);
    }

    const cosmeticsArr = players.map(p => {
      const u = this.userStore.getUser(p.username);
      return {
        board: u?.equippedBoard || 'default',
        pieces: u?.equippedPieces || 'default',
        badge: u?.equippedBadge || null
      };
    });

    for (let i = 0; i < players.length; i++) {
      const state = game.getStateForPlayer(i);
      players[i].socket.emit('scrabble:start', {
        gameId,
        playerIndex: i,
        playerCount: game.playerCount,
        players: players.map(p => ({
          username: p.username,
          rating: this.userStore.getUser(p.username)?.rating || 1200
        })),
        type,
        cosmetics: cosmeticsArr,
        ...state
      });
    }
  }

  scrabblePlaceTiles(socket, placements) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.scrabbleGame) return;
    const playerIdx = gd.players.findIndex(p => p.socket.id === socket.id);
    if (playerIdx !== gd.scrabbleGame.currentTurn) return;

    const result = gd.scrabbleGame.placeTiles(playerIdx, placements);
    if (!result.valid) {
      return socket.emit('scrabble:error', { message: result.error });
    }

    for (let i = 0; i < gd.players.length; i++) {
      const updateData = {
        player: result.player,
        action: 'place',
        placements: result.placements,
        words: result.words,
        totalScore: result.totalScore,
        scores: result.scores,
        board: result.board,
        bagCount: result.bagCount,
        currentTurn: result.currentTurn,
        firstMove: gd.scrabbleGame.firstMove
      };
      if (i === result.player) {
        updateData.newRack = result.newRack;
      } else if (i === result.currentTurn) {
        updateData.newRack = gd.scrabbleGame.racks[i]?.map(t => ({ ...t }));
      }
      gd.players[i].socket.emit('scrabble:update', updateData);
    }

    if (result.gameOver.over) {
      this._endScrabbleGame(gd.id, result.gameOver.winner);
    }
  }

  scrabbleExchangeTiles(socket, tileIndices) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.scrabbleGame) return;
    const playerIdx = gd.players.findIndex(p => p.socket.id === socket.id);
    if (playerIdx !== gd.scrabbleGame.currentTurn) return;

    const result = gd.scrabbleGame.exchangeTiles(playerIdx, tileIndices);
    if (!result.valid) {
      return socket.emit('scrabble:error', { message: result.error });
    }

    for (let i = 0; i < gd.players.length; i++) {
      const updateData = {
        player: result.player,
        action: 'exchange',
        tilesExchanged: result.tilesExchanged,
        bagCount: result.bagCount,
        currentTurn: result.currentTurn,
        scores: result.scores,
        board: result.board,
        firstMove: gd.scrabbleGame.firstMove
      };
      if (i === result.player) {
        updateData.newRack = result.newRack;
      } else if (i === result.currentTurn) {
        updateData.newRack = gd.scrabbleGame.racks[i]?.map(t => ({ ...t }));
      }
      gd.players[i].socket.emit('scrabble:update', updateData);
    }
  }

  scrabblePass(socket) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.scrabbleGame) return;
    const playerIdx = gd.players.findIndex(p => p.socket.id === socket.id);
    if (playerIdx !== gd.scrabbleGame.currentTurn) return;

    const result = gd.scrabbleGame.passTurn(playerIdx);
    if (!result.valid) return;

    for (let i = 0; i < gd.players.length; i++) {
      const updateData = {
        player: result.player,
        action: 'pass',
        currentTurn: result.currentTurn,
        consecutivePasses: result.consecutivePasses,
        scores: result.scores,
        board: result.board,
        bagCount: result.bagCount,
        firstMove: gd.scrabbleGame.firstMove
      };
      if (i === result.currentTurn) {
        updateData.newRack = gd.scrabbleGame.racks[i]?.map(t => ({ ...t }));
      }
      gd.players[i].socket.emit('scrabble:update', updateData);
    }

    if (result.gameOver.over) {
      this._endScrabbleGame(gd.id, result.gameOver.winner);
    }
  }

  scrabbleResign(socket) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.scrabbleGame) return;
    this._scrabblePlayerDisconnect(gd, socket);
  }

  _scrabblePlayerDisconnect(gd, socket) {
    const playerIdx = gd.players.findIndex(p => p.socket.id === socket.id);
    let bestPlayer = 0, bestScore = -Infinity;
    for (let i = 0; i < gd.players.length; i++) {
      if (i === playerIdx) continue;
      if (gd.scrabbleGame.scores[i] > bestScore) {
        bestScore = gd.scrabbleGame.scores[i];
        bestPlayer = i;
      }
    }
    this._endScrabbleGame(gd.id, bestPlayer);
  }

  _endScrabbleGame(gameId, winnerIdx) {
    const gd = this.games.get(gameId);
    if (!gd || !gd.scrabbleGame) return;

    const coinRewards = {};
    for (let i = 0; i < gd.players.length; i++) {
      const username = gd.players[i].username;
      const user = this.userStore.getUser(username);
      if (!user || user.isBot) continue;
      const reward = i === winnerIdx ? 20 : 5;
      this.userStore.updateUser(username, { coins: (user.coins || 0) + reward });
      coinRewards[username] = reward;
    }

    for (const p of gd.players) {
      this._decrementTrials(p.username);
    }

    const overData = {
      winner: winnerIdx,
      winnerUsername: gd.players[winnerIdx]?.username,
      scores: [...gd.scrabbleGame.scores],
      coinRewards
    };

    for (const p of gd.players) {
      p.socket.emit('scrabble:over', overData);
    }

    const bots = this.scrabbleBots.get(gameId);
    if (bots) {
      bots.forEach(b => b.destroy());
      this.scrabbleBots.delete(gameId);
    }

    for (const p of gd.players) {
      p.socket.leave(gameId);
      this.playerToGame.delete(p.socket.id);
    }
    this.games.delete(gameId);
  }

  scrabbleGameChat(socket, message) {
    const gd = this.getGameForSocket(socket.id);
    if (!gd || !gd.scrabbleGame) return;
    const msg = {
      username: socket.username || 'Guest',
      text: String(message).slice(0, 200),
      time: Date.now()
    };
    gd.chatLog.push(msg);
    for (const p of gd.players) {
      p.socket.emit('chat:game', msg);
    }
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
