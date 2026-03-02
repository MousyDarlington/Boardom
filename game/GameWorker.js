'use strict';

const { parentPort } = require('worker_threads');
const CheckersGame = require('./CheckersGame');
const TroubleGame = require('./TroubleGame');
const ScrabbleGame = require('./ScrabbleGame');
const BotPlayer = require('./BotPlayer');
const TroubleBotPlayer = require('./TroubleBotPlayer');
const ScrabbleBotPlayer = require('./ScrabbleBotPlayer');
const fs = require('fs');

/* ================================================
   WORKER STATE
   ================================================ */
let game = null;           // CheckersGame | TroubleGame | ScrabbleGame
let gameType = null;       // 'checkers' | 'trouble' | 'scrabble'
let gameId = null;
let matchCode = null;
let gameTypeStr = null;    // 'casual' | 'ranked' | 'private'
let players = [];          // [{ id, username, isBot, playerIndex, color?, ... }]
let bots = [];             // BotPlayer[] | TroubleBotPlayer[] | ScrabbleBotPlayer[]
let chatLog = [];
let dictionary = null;     // Set, for Scrabble only
let disconnectedPlayers = new Set();

const socketToIndex = new Map(); // socketId → playerIndex

/* ================================================
   MESSAGE ROUTER
   ================================================ */
parentPort.on('message', (msg) => {
  try {
    switch (msg.type) {
      case 'init':              handleInit(msg.payload); break;
      case 'selectPiece':       handleSelectPiece(msg.payload); break;
      case 'makeMove':          handleMakeMove(msg.payload); break;
      case 'troubleRoll':       handleTroubleRoll(msg.payload); break;
      case 'troubleMove':       handleTroubleMove(msg.payload); break;
      case 'scrabblePlace':     handleScrabblePlace(msg.payload); break;
      case 'scrabbleExchange':  handleScrabbleExchange(msg.payload); break;
      case 'scrabblePass':      handleScrabblePass(msg.payload); break;
      case 'resign':            handleResign(msg.payload); break;
      case 'chat':              handleChat(msg.payload); break;
      case 'playerDisconnect':  handlePlayerDisconnect(msg.payload); break;
      case 'playerRejoined':    handlePlayerRejoined(msg.payload); break;
      case 'replaceWithBot':    handleReplaceWithBot(msg.payload); break;
      case 'destroy':           handleDestroy(); break;
    }
  } catch (err) {
    console.error(`[GameWorker ${gameId}] Error handling ${msg.type}:`, err);
  }
});

/* ================================================
   HELPERS
   ================================================ */
function postEmit(socketId, event, data) {
  parentPort.postMessage({ type: 'emit', payload: { targets: [{ socketId, event, data }] } });
}

function broadcastToPlayers(event, data) {
  const humanTargets = [];
  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit(event, data);
    } else {
      humanTargets.push({ socketId: p.id, event, data });
    }
  }
  if (humanTargets.length > 0) {
    parentPort.postMessage({ type: 'emit', payload: { targets: humanTargets } });
  }
}

function broadcastPerPlayer(eventFn) {
  // eventFn(playerIndex) returns { event, data } or null
  const humanTargets = [];
  for (let i = 0; i < players.length; i++) {
    const result = eventFn(i);
    if (!result) continue;
    if (players[i].isBot) {
      const bot = bots.find(b => b.socket.id === players[i].id);
      if (bot) bot.socket.emit(result.event, result.data);
    } else {
      humanTargets.push({ socketId: players[i].id, event: result.event, data: result.data });
    }
  }
  if (humanTargets.length > 0) {
    parentPort.postMessage({ type: 'emit', payload: { targets: humanTargets } });
  }
}

/* ================================================
   LOCAL ADAPTER — lets bots call matchmaker-like methods
   ================================================ */
function buildLocalAdapter() {
  return {
    games: new Map([[gameId, {
      get game() { return game; },
      get troubleGame() { return game; },
      get scrabbleGame() { return game; },
    }]]),
    makeMove(socket, fr, fc, tr, tc) {
      handleMakeMove({ socketId: socket.id, fromRow: fr, fromCol: fc, toRow: tr, toCol: tc });
    },
    troubleRollDice(socket) {
      handleTroubleRoll({ socketId: socket.id });
    },
    troubleMakeMove(socket, tokenIdx) {
      handleTroubleMove({ socketId: socket.id, tokenIdx });
    },
    scrabblePlaceTiles(socket, placements) {
      handleScrabblePlace({ socketId: socket.id, placements });
    },
    scrabbleExchangeTiles(socket, tileIndices) {
      handleScrabbleExchange({ socketId: socket.id, tileIndices });
    },
    scrabblePass(socket) {
      handleScrabblePass({ socketId: socket.id });
    }
  };
}

/* ================================================
   INIT
   ================================================ */
function handleInit(payload) {
  gameId = payload.gameId;
  matchCode = payload.matchCode;
  gameType = payload.gameType;
  gameTypeStr = payload.gameTypeStr;

  players = payload.players.map((p, idx) => ({ ...p, playerIndex: idx }));
  for (const p of players) {
    socketToIndex.set(p.id, p.playerIndex);
  }

  // Create game instance
  switch (gameType) {
    case 'checkers':
      game = new CheckersGame();
      break;
    case 'trouble':
      game = new TroubleGame(players.length);
      break;
    case 'scrabble': {
      const dictPath = payload.gameConfig.dictionaryPath;
      const words = fs.readFileSync(dictPath, 'utf-8').split(/\r?\n/).filter(w => w.length > 0);
      dictionary = new Set(words.map(w => w.toUpperCase()));
      game = new ScrabbleGame(players.length, dictionary);
      break;
    }
  }

  // Create bots
  const adapter = buildLocalAdapter();
  for (const p of players) {
    if (!p.isBot) continue;
    let bot;
    switch (gameType) {
      case 'checkers':
        bot = new BotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        break;
      case 'trouble':
        bot = new TroubleBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        // Override the auto-generated socket id/username with what main thread assigned
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'scrabble':
        bot = new ScrabbleBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.dictionary = dictionary;
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
    }
    bots.push(bot);
  }

  // Send start data
  sendStartData(payload);
}

function sendStartData(payload) {
  const playerStartData = [];

  if (gameType === 'checkers') {
    const state = game.getState();
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const color = p.color;
      const opponentIdx = i === 0 ? 1 : 0;
      const opponent = players[opponentIdx];

      const startPayload = {
        gameId, matchCode,
        color,
        ...state,
        opponent: { username: opponent.username, rating: opponent.rating || 1200 },
        me: { username: p.username, rating: p.rating || 1200 },
        type: gameTypeStr,
        cosmetics: { me: p.cosmetics, opponent: opponent.cosmetics }
      };

      if (p.isBot) {
        // Trigger bot directly
        const bot = bots.find(b => b.socket.id === p.id);
        if (bot) bot.socket.emit('game:start', startPayload);
      } else {
        playerStartData.push({ socketId: p.id, event: 'game:start', data: startPayload });
      }
    }
  } else if (gameType === 'trouble') {
    const state = game.getState();
    const cosmeticsArr = players.map(p => p.cosmetics);
    const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));

    for (let i = 0; i < players.length; i++) {
      const startPayload = {
        gameId, matchCode,
        playerIndex: i,
        playerCount: players.length,
        players: playersInfo,
        type: gameTypeStr,
        cosmetics: cosmeticsArr,
        ...state
      };

      if (players[i].isBot) {
        const bot = bots.find(b => b.socket.id === players[i].id);
        if (bot) bot.socket.emit('trouble:start', startPayload);
      } else {
        playerStartData.push({ socketId: players[i].id, event: 'trouble:start', data: startPayload });
      }
    }
  } else if (gameType === 'scrabble') {
    const cosmeticsArr = players.map(p => p.cosmetics);
    const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));

    for (let i = 0; i < players.length; i++) {
      const state = game.getStateForPlayer(i);
      const startPayload = {
        gameId, matchCode,
        playerIndex: i,
        playerCount: game.playerCount,
        players: playersInfo,
        type: gameTypeStr,
        cosmetics: cosmeticsArr,
        ...state
      };

      if (players[i].isBot) {
        const bot = bots.find(b => b.socket.id === players[i].id);
        if (bot) bot.socket.emit('scrabble:start', startPayload);
      } else {
        playerStartData.push({ socketId: players[i].id, event: 'scrabble:start', data: startPayload });
      }
    }
  }

  parentPort.postMessage({ type: 'started', payload: { gameId, playerStartData } });
}

/* ================================================
   CHECKERS ACTIONS
   ================================================ */
function handleSelectPiece({ socketId, row, col }) {
  if (gameType !== 'checkers') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const color = players[idx].color;
  if (color !== game.currentTurn) {
    postEmit(socketId, 'game:error', { message: 'Not your turn' });
    return;
  }

  const piece = game.board[row]?.[col];
  if (piece == null || !CheckersGame.belongsTo(piece, color)) {
    postEmit(socketId, 'game:validMoves', { row, col, moves: [] });
    return;
  }
  const moves = game.getValidMoves(row, col);
  postEmit(socketId, 'game:validMoves', { row, col, moves });
}

function handleMakeMove({ socketId, fromRow, fromCol, toRow, toCol }) {
  if (gameType !== 'checkers') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const color = players[idx].color;
  if (color !== game.currentTurn) {
    postEmit(socketId, 'game:error', { message: 'Not your turn' });
    return;
  }

  const result = game.makeMove(fromRow, fromCol, toRow, toCol);
  if (!result.valid) {
    postEmit(socketId, 'game:error', { message: 'Invalid move' });
    return;
  }

  const updateData = {
    from: result.from, to: result.to,
    captured: result.captured, promoted: result.promoted,
    board: result.board, currentTurn: result.currentTurn,
    jumpingPiece: result.jumpingPiece, continuedJump: result.continuedJump,
    redCount: result.redCount, blackCount: result.blackCount
  };

  broadcastToPlayers('game:update', updateData);

  if (result.gameOver.over) {
    postCheckersGameOver(result.gameOver.winner, result.gameOver.reason);
  }
}

function postCheckersGameOver(winner, reason) {
  const overData = { winner, reason };
  // Build per-player targets (bots get it directly, humans via main)
  const humanTargets = [];
  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit('game:over', overData);
    } else {
      humanTargets.push({ socketId: p.id, event: 'game:over', data: overData });
    }
  }

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType: 'checkers',
      winner, reason,
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   TROUBLE ACTIONS
   ================================================ */
function handleTroubleRoll({ socketId }) {
  if (gameType !== 'trouble') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  if (idx !== game.currentTurn) return;

  const result = game.rollDice();
  if (!result.valid) return;

  const rollData = {
    player: idx,
    diceResult: result.diceResult,
    validMoves: result.validMoves,
    skipped: result.skipped,
    currentTurn: game.currentTurn,
    phase: game.phase
  };

  broadcastToPlayers('trouble:rollResult', rollData);
  ensureTroubleBotTurn();
}

function handleTroubleMove({ socketId, tokenIdx }) {
  if (gameType !== 'trouble') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  if (idx !== game.currentTurn) return;

  const result = game.makeMove(tokenIdx);
  if (!result.valid) return;

  const updateData = {
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
    phase: result.state.phase,
    placements: result.state.placements
  };

  broadcastToPlayers('trouble:update', updateData);

  if (result.placed) {
    broadcastToPlayers('trouble:placed', {
      playerIdx: result.player,
      placement: result.placement,
      username: players[result.player]?.username
    });
  }

  if (result.gameOver.over) {
    postTroubleGameOver(result.gameOver.placements);
  } else {
    ensureTroubleBotTurn();
  }
}

function ensureTroubleBotTurn() {
  if (!game || game.gameOver) return;
  const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
  if (!currentBot || currentBot.destroyed || currentBot._paused) return;
  if (currentBot._timer) return; // already scheduled

  if (game.phase === 'roll') {
    currentBot._scheduleRoll();
  } else if (game.phase === 'move') {
    const validMoves = game.getValidMoves();
    if (validMoves.length > 0) {
      currentBot._scheduleMove(validMoves);
    }
  }
}

function postTroubleGameOver(placements) {
  const overData = {
    winner: placements[0],
    winnerUsername: players[placements[0]]?.username,
    placements,
    placementNames: placements.map(idx => players[idx]?.username || 'Unknown')
  };

  // Notify bots directly
  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit('trouble:over', overData);
    }
  }

  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: 'trouble:over', data: overData }));

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType: 'trouble',
      placements,
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   SCRABBLE ACTIONS
   ================================================ */
function handleScrabblePlace({ socketId, placements }) {
  if (gameType !== 'scrabble') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  if (idx !== game.currentTurn) {
    postEmit(socketId, 'scrabble:error', { message: 'Not your turn' });
    return;
  }

  const result = game.placeTiles(idx, placements);
  if (!result.valid) {
    postEmit(socketId, 'scrabble:error', { message: result.error });
    return;
  }

  broadcastScrabbleUpdate(result, 'place');

  if (result.gameOver.over) {
    postScrabbleGameOver(result.gameOver.winner);
  }
}

function handleScrabbleExchange({ socketId, tileIndices }) {
  if (gameType !== 'scrabble') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  if (idx !== game.currentTurn) return;

  const result = game.exchangeTiles(idx, tileIndices);
  if (!result.valid) {
    postEmit(socketId, 'scrabble:error', { message: result.error });
    return;
  }

  broadcastScrabbleUpdate(result, 'exchange');
}

function handleScrabblePass({ socketId }) {
  if (gameType !== 'scrabble') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  if (idx !== game.currentTurn) return;

  const result = game.passTurn(idx);
  if (!result.valid) return;

  broadcastScrabbleUpdate(result, 'pass');

  if (result.gameOver.over) {
    postScrabbleGameOver(result.gameOver.winner);
  }
}

function broadcastScrabbleUpdate(result, action) {
  broadcastPerPlayer((i) => {
    const updateData = {
      player: result.player,
      action,
      scores: result.scores,
      board: result.board,
      bagCount: result.bagCount,
      currentTurn: result.currentTurn,
      firstMove: game.firstMove
    };

    if (action === 'place') {
      updateData.placements = result.placements;
      updateData.words = result.words;
      updateData.totalScore = result.totalScore;
    }
    if (action === 'exchange') {
      updateData.tilesExchanged = result.tilesExchanged;
    }
    if (action === 'pass') {
      updateData.consecutivePasses = result.consecutivePasses;
    }

    // Send new rack to the player who acted, and to the next-turn player
    if (i === result.player) {
      updateData.newRack = result.newRack;
    } else if (i === result.currentTurn) {
      updateData.newRack = game.racks[i]?.map(t => ({ ...t }));
    }

    return { event: 'scrabble:update', data: updateData };
  });
}

function postScrabbleGameOver(winnerIdx) {
  const overData = {
    winner: winnerIdx,
    winnerUsername: players[winnerIdx]?.username,
    scores: [...game.scores]
  };

  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit('scrabble:over', overData);
    }
  }

  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: 'scrabble:over', data: overData }));

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType: 'scrabble',
      winnerIdx,
      scores: [...game.scores],
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   RESIGN
   ================================================ */
function handleResign({ socketId }) {
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;

  if (gameType === 'checkers') {
    const color = players[idx].color;
    const winner = color === CheckersGame.RED ? CheckersGame.BLACK : CheckersGame.RED;
    postCheckersGameOver(winner, 'Opponent resigned');
  } else if (gameType === 'trouble') {
    // Trouble resign → replaced with bot (handled by main thread sending replaceWithBot)
    // But if the main thread sent resign directly, end the game
    postTroubleResign(idx);
  } else if (gameType === 'scrabble') {
    // Find best other player
    let bestPlayer = 0, bestScore = -Infinity;
    for (let i = 0; i < players.length; i++) {
      if (i === idx) continue;
      if (game.scores[i] > bestScore) { bestScore = game.scores[i]; bestPlayer = i; }
    }
    postScrabbleGameOver(bestPlayer);
  }
}

function postTroubleResign(playerIdx) {
  const existing = game.placements ? [...game.placements] : [];
  const remaining = [];
  for (let i = 0; i < players.length; i++) {
    if (!existing.includes(i)) remaining.push(i);
  }
  remaining.sort((a, b) => {
    if (a === playerIdx) return 1;
    if (b === playerIdx) return -1;
    return game.finished[b] - game.finished[a];
  });
  postTroubleGameOver([...existing, ...remaining]);
}

/* ================================================
   REPLACE PLAYER WITH BOT (Trouble resign mid-game)
   ================================================ */
function handleReplaceWithBot({ playerIndex, botRating, botName, botSocketId }) {
  if (gameType !== 'trouble') return;

  const adapter = buildLocalAdapter();
  const bot = new TroubleBotPlayer(adapter, botRating || 1200, botName);
  bot.gameId = gameId;
  bot.playerIndex = playerIndex;
  bot.socket.id = botSocketId;
  bot.socket.username = botName;
  bot.username = botName;
  bot.id = botSocketId;

  bots.push(bot);

  // Update local player entry
  const oldId = players[playerIndex].id;
  socketToIndex.delete(oldId);
  players[playerIndex] = {
    ...players[playerIndex],
    id: botSocketId,
    username: botName,
    isBot: true
  };
  socketToIndex.set(botSocketId, playerIndex);

  // Notify human players
  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: 'trouble:playerReplaced', data: { playerIdx: playerIndex, newUsername: botName } }));
  if (humanTargets.length > 0) {
    parentPort.postMessage({ type: 'emit', payload: { targets: humanTargets } });
  }

  // If it's the replaced player's turn, start the bot
  if (game.currentTurn === playerIndex && !game.gameOver) {
    ensureTroubleBotTurn();
  }
}

/* ================================================
   CHAT
   ================================================ */
function handleChat({ socketId, username, text }) {
  const msg = {
    username: username || 'Guest',
    text: String(text).slice(0, 200),
    time: Date.now()
  };
  chatLog.push(msg);

  const humanTargets = players.filter(p => !p.isBot).map(p => p.id);
  parentPort.postMessage({ type: 'chatBroadcast', payload: { targets: humanTargets, msg } });
}

/* ================================================
   DISCONNECT / REJOIN
   ================================================ */
function handlePlayerDisconnect({ socketId, username }) {
  disconnectedPlayers.add(username);
  // Pause all bots
  for (const bot of bots) {
    bot._paused = true;
    if (bot.moveTimer) { clearTimeout(bot.moveTimer); bot.moveTimer = null; }
    if (bot._timer) { clearTimeout(bot._timer); bot._timer = null; }
  }
}

function handlePlayerRejoined({ oldSocketId, username, newSocketId }) {
  disconnectedPlayers.delete(username);

  // Update socketId mapping
  const playerIdx = players.findIndex(p => p.username === username);
  if (playerIdx !== -1) {
    socketToIndex.delete(players[playerIdx].id);
    players[playerIdx].id = newSocketId;
    socketToIndex.set(newSocketId, playerIdx);
  }

  // Resume bots if all players back
  if (disconnectedPlayers.size === 0) {
    for (const bot of bots) {
      bot._paused = false;
    }
    // Restart bot turns
    if (gameType === 'trouble') ensureTroubleBotTurn();
    if (gameType === 'checkers') {
      const currentBot = bots.find(b => b.color === game.currentTurn);
      if (currentBot && !currentBot.destroyed) currentBot._scheduleMove();
    }
    if (gameType === 'scrabble') {
      const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
      if (currentBot && !currentBot.destroyed) currentBot._scheduleTurn();
    }
  }

  // Send rejoin state
  sendRejoinState(newSocketId, playerIdx);
}

function sendRejoinState(socketId, playerIdx) {
  const cosmeticsArr = players.map(p => p.cosmetics);
  const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));

  if (gameType === 'checkers') {
    const state = game.getState();
    const color = players[playerIdx].color;
    const opponentIdx = playerIdx === 0 ? 1 : 0;
    const opponent = players[opponentIdx];

    parentPort.postMessage({
      type: 'rejoinState',
      payload: {
        socketId,
        event: 'game:rejoined',
        data: {
          gameId, matchCode,
          color,
          ...state,
          opponent: { username: opponent.username, rating: opponent.rating || 1200 },
          me: { username: players[playerIdx].username, rating: players[playerIdx].rating || 1200 },
          type: gameTypeStr,
          cosmetics: { me: players[playerIdx].cosmetics, opponent: opponent.cosmetics },
          chatLog
        }
      }
    });
  } else if (gameType === 'trouble') {
    const state = game.getState();
    let validMoves = [];
    if (state.currentTurn === playerIdx && state.phase === 'move') {
      validMoves = game.getValidMoves();
    }

    parentPort.postMessage({
      type: 'rejoinState',
      payload: {
        socketId,
        event: 'trouble:rejoined',
        data: {
          gameId, matchCode,
          playerIndex: playerIdx,
          playerCount: players.length,
          players: playersInfo,
          type: gameTypeStr,
          cosmetics: cosmeticsArr,
          chatLog,
          validMoves,
          ...state
        }
      }
    });
  } else if (gameType === 'scrabble') {
    const state = game.getStateForPlayer(playerIdx);

    parentPort.postMessage({
      type: 'rejoinState',
      payload: {
        socketId,
        event: 'scrabble:rejoined',
        data: {
          gameId, matchCode,
          playerIndex: playerIdx,
          playerCount: game.playerCount,
          players: playersInfo,
          type: gameTypeStr,
          cosmetics: cosmeticsArr,
          chatLog,
          ...state
        }
      }
    });
  }
}

/* ================================================
   DESTROY
   ================================================ */
function handleDestroy() {
  for (const bot of bots) bot.destroy();
  bots = [];
  game = null;
  process.exit(0);
}
