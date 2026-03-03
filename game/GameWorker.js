'use strict';

const { parentPort } = require('worker_threads');
const CheckersGame = require('./CheckersGame');
const TroubleGame = require('./TroubleGame');
const ScrabbleGame = require('./ScrabbleGame');
const CAHGame = require('./CAHGame');
const BotPlayer = require('./BotPlayer');
const TroubleBotPlayer = require('./TroubleBotPlayer');
const ScrabbleBotPlayer = require('./ScrabbleBotPlayer');
const CAHBotPlayer = require('./CAHBotPlayer');
const ConnectFourGame = require('./ConnectFourGame');
const BattleshipGame = require('./BattleshipGame');
const MancalaGame = require('./MancalaGame');
const ConnectFourBotPlayer = require('./ConnectFourBotPlayer');
const BattleshipBotPlayer = require('./BattleshipBotPlayer');
const MancalaBotPlayer = require('./MancalaBotPlayer');
const WarGame = require('./WarGame');
const CrazyEightsGame = require('./CrazyEightsGame');
const GoFishGame = require('./GoFishGame');
const BlackjackGame = require('./BlackjackGame');
const GinRummyGame = require('./GinRummyGame');
const HeartsGame = require('./HeartsGame');
const SpadesGame = require('./SpadesGame');
const PokerGame = require('./PokerGame');
const HigherLowerGame = require('./HigherLowerGame');
const WarBotPlayer = require('./WarBotPlayer');
const CrazyEightsBotPlayer = require('./CrazyEightsBotPlayer');
const GoFishBotPlayer = require('./GoFishBotPlayer');
const BlackjackBotPlayer = require('./BlackjackBotPlayer');
const GinRummyBotPlayer = require('./GinRummyBotPlayer');
const HeartsBotPlayer = require('./HeartsBotPlayer');
const SpadesBotPlayer = require('./SpadesBotPlayer');
const PokerBotPlayer = require('./PokerBotPlayer');
const HigherLowerBotPlayer = require('./HigherLowerBotPlayer');
const fs = require('fs');

/* ================================================
   WORKER STATE
   ================================================ */
let game = null;           // CheckersGame | TroubleGame | ScrabbleGame | CAHGame | ConnectFourGame | BattleshipGame | MancalaGame
let gameType = null;       // 'checkers' | 'trouble' | 'scrabble' | 'cah' | 'c4' | 'battleship' | 'mancala'
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
      case 'cahSubmit':         handleCAHSubmit(msg.payload); break;
      case 'cahPick':           handleCAHPick(msg.payload); break;
      case 'c4Move':           handleC4Move(msg.payload); break;
      case 'bsPlaceShip':      handleBSPlaceShip(msg.payload); break;
      case 'bsAutoPlace':      handleBSAutoPlace(msg.payload); break;
      case 'bsSetReady':       handleBSSetReady(msg.payload); break;
      case 'bsFireShot':       handleBSFireShot(msg.payload); break;
      case 'mancalaMove':      handleMancalaMove(msg.payload); break;
      case 'warPlay':         handleWarPlay(msg.payload); break;
      case 'c8Play':          handleC8Play(msg.payload); break;
      case 'c8Draw':          handleC8Draw(msg.payload); break;
      case 'gfAsk':           handleGfAsk(msg.payload); break;
      case 'bjBet':           handleBjBet(msg.payload); break;
      case 'bjHit':           handleBjHit(msg.payload); break;
      case 'bjStand':         handleBjStand(msg.payload); break;
      case 'bjDouble':        handleBjDouble(msg.payload); break;
      case 'grDrawPile':      handleGrDrawPile(msg.payload); break;
      case 'grDrawDiscard':   handleGrDrawDiscard(msg.payload); break;
      case 'grDiscard':       handleGrDiscard(msg.payload); break;
      case 'grKnock':         handleGrKnock(msg.payload); break;
      case 'htPass':          handleHtPass(msg.payload); break;
      case 'htPlay':          handleHtPlay(msg.payload); break;
      case 'spBid':           handleSpBid(msg.payload); break;
      case 'spPlay':          handleSpPlay(msg.payload); break;
      case 'pkAction':        handlePkAction(msg.payload); break;
      case 'hlGuess':         handleHlGuess(msg.payload); break;
      case 'resign':            handleResign(msg.payload); break;
      case 'chat':              handleChat(msg.payload); break;
      case 'playerDisconnect':  handlePlayerDisconnect(msg.payload); break;
      case 'playerRejoined':    handlePlayerRejoined(msg.payload); break;
      case 'replaceWithBot':    handleReplaceWithBot(msg.payload); break;
      case 'serialize':          handleSerialize(); break;
      case 'initFromState':      handleInitFromState(msg.payload); break;
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
      get c4Game() { return game; },
      get bsGame() { return game; },
      get mancalaGame() { return game; },
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
    },
    cahSubmitCards(socket, cardIndices) {
      handleCAHSubmit({ socketId: socket.id, cardIndices });
    },
    cahPickWinner(socket, submissionIdx) {
      handleCAHPick({ socketId: socket.id, submissionIdx });
    },
    c4MakeMove(socket, col) {
      handleC4Move({ socketId: socket.id, col });
    },
    bsAutoPlace(socket) {
      handleBSAutoPlace({ socketId: socket.id });
    },
    bsSetReady(socket) {
      handleBSSetReady({ socketId: socket.id });
    },
    bsFireShot(socket, row, col) {
      handleBSFireShot({ socketId: socket.id, row, col });
    },
    mancalaMakeMove(socket, pitIdx) {
      handleMancalaMove({ socketId: socket.id, pitIdx });
    },
    get warGame() { return game; },
    get c8Game() { return game; },
    get gfGame() { return game; },
    get bjGame() { return game; },
    get grGame() { return game; },
    get htGame() { return game; },
    get spGame() { return game; },
    get pkGame() { return game; },
    get hlGame() { return game; },
    warPlayRound(socket) { handleWarPlay({ socketId: socket.id }); },
    c8PlayCard(socket, cardIndex, chosenSuit) { handleC8Play({ socketId: socket.id, cardIndex, chosenSuit }); },
    c8DrawCard(socket) { handleC8Draw({ socketId: socket.id }); },
    gfAskForCard(socket, targetIdx, rank) { handleGfAsk({ socketId: socket.id, targetIdx, rank }); },
    bjPlaceBet(socket, amount) { handleBjBet({ socketId: socket.id, amount }); },
    bjHit(socket) { handleBjHit({ socketId: socket.id }); },
    bjStand(socket) { handleBjStand({ socketId: socket.id }); },
    bjDouble(socket) { handleBjDouble({ socketId: socket.id }); },
    grDrawFromPile(socket) { handleGrDrawPile({ socketId: socket.id }); },
    grDrawFromDiscard(socket) { handleGrDrawDiscard({ socketId: socket.id }); },
    grDiscard(socket, cardIndex) { handleGrDiscard({ socketId: socket.id, cardIndex }); },
    grKnock(socket, cardIndex) { handleGrKnock({ socketId: socket.id, cardIndex }); },
    htPassCards(socket, cardIndices) { handleHtPass({ socketId: socket.id, cardIndices }); },
    htPlayCard(socket, cardIndex) { handleHtPlay({ socketId: socket.id, cardIndex }); },
    spPlaceBid(socket, bid) { handleSpBid({ socketId: socket.id, bid }); },
    spPlayCard(socket, cardIndex) { handleSpPlay({ socketId: socket.id, cardIndex }); },
    pkFold(socket) { handlePkAction({ socketId: socket.id, action: 'fold' }); },
    pkCheck(socket) { handlePkAction({ socketId: socket.id, action: 'check' }); },
    pkCall(socket) { handlePkAction({ socketId: socket.id, action: 'call' }); },
    pkRaise(socket, amount) { handlePkAction({ socketId: socket.id, action: 'raise', amount }); },
    pkAllIn(socket) { handlePkAction({ socketId: socket.id, action: 'allIn' }); },
    hlGuess(socket, choice) { handleHlGuess({ socketId: socket.id, choice }); }
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
    case 'cah': {
      const cfg = payload.gameConfig || {};
      game = new CAHGame(players.length, cfg.packType || 'pg13', cfg.maxRounds || 10);
      break;
    }
    case 'c4':
      game = new ConnectFourGame();
      break;
    case 'battleship':
      game = new BattleshipGame();
      break;
    case 'mancala':
      game = new MancalaGame();
      break;
    case 'war':
      game = new WarGame();
      break;
    case 'crazy8':
      game = new CrazyEightsGame(players.length);
      break;
    case 'gofish':
      game = new GoFishGame(players.length);
      break;
    case 'blackjack':
      game = new BlackjackGame(players.length);
      break;
    case 'ginrummy':
      game = new GinRummyGame();
      break;
    case 'hearts':
      game = new HeartsGame();
      break;
    case 'spades':
      game = new SpadesGame();
      break;
    case 'poker':
      game = new PokerGame(players.length);
      break;
    case 'higherlower':
      game = new HigherLowerGame(players.length);
      break;
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
        // Override auto-generated id to match what main thread registered
        bot.id = p.id;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
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
      case 'cah':
        bot = new CAHBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'c4':
        bot = new ConnectFourBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'battleship':
        bot = new BattleshipBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'mancala':
        bot = new MancalaBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'war':
        bot = new WarBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'crazy8':
        bot = new CrazyEightsBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'gofish':
        bot = new GoFishBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'blackjack':
        bot = new BlackjackBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'ginrummy':
        bot = new GinRummyBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'hearts':
        bot = new HeartsBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'spades':
        bot = new SpadesBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'poker':
        bot = new PokerBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'higherlower':
        bot = new HigherLowerBotPlayer(adapter, p.botRating || 1200, p.botName);
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

  // Watchdog: periodically ensure bots aren't stuck (safety net)
  if (bots.length > 0) {
    setInterval(() => {
      if (!game) return;
      if (gameType === 'trouble') {
        ensureTroubleBotTurn();
      } else if (gameType === 'checkers') {
        const go = game.checkGameOver();
        if (go && go.over) return;
        const currentBot = bots.find(b => b.color === game.currentTurn);
        if (currentBot && currentBot.active && !currentBot._paused && !currentBot.moveTimer) {
          currentBot._scheduleMove();
        }
      } else if (gameType === 'scrabble') {
        if (game.gameOver) return;
        const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          currentBot._scheduleTurn();
        }
      } else if (gameType === 'cah') {
        ensureCAHBotAction();
      } else if (gameType === 'c4') {
        if (game.gameOver) return;
        const playerConst = game.currentTurn; // 1 or 2
        const botIdx = playerConst - 1; // PLAYER1=1 -> idx 0, PLAYER2=2 -> idx 1
        const currentBot = bots.find(b => b.playerIndex === botIdx);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          currentBot._scheduleMove();
        }
      } else if (gameType === 'battleship') {
        if (game.phase === 'over') return;
        for (const bot of bots) {
          if (bot.destroyed || bot._paused) continue;
          if (game.phase === 'playing' && game.currentTurn === bot.playerIndex && !bot._timer) {
            bot._scheduleShot();
          }
        }
      } else if (gameType === 'mancala') {
        if (game.gameOver) return;
        const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          currentBot._scheduleMove();
        }
      } else if (['war', 'crazy8', 'gofish', 'blackjack', 'ginrummy', 'hearts', 'spades', 'poker', 'higherlower'].includes(gameType)) {
        if (game.gameOver || game.phase === 'over') return;
        const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          if (currentBot._schedulePlay) currentBot._schedulePlay();
          else if (currentBot._scheduleMove) currentBot._scheduleMove();
          else if (currentBot._scheduleTurn) currentBot._scheduleTurn();
        }
      }
    }, 3000);
  }
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
  } else if (gameType === 'cah') {
    // Start the first round
    game.startRound();

    const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));

    for (let i = 0; i < players.length; i++) {
      const state = game.getStateForPlayer(i);
      const startPayload = {
        gameId, matchCode,
        playerIndex: i,
        playerCount: game.playerCount,
        players: playersInfo,
        type: gameTypeStr,
        ...state
      };

      if (players[i].isBot) {
        const bot = bots.find(b => b.socket.id === players[i].id);
        if (bot) bot.socket.emit('cah:start', startPayload);
      } else {
        playerStartData.push({ socketId: players[i].id, event: 'cah:start', data: startPayload });
      }
    }

    // Start submission timer
    cahStartSubmitTimer();
  } else if (gameType === 'c4') {
    const state = game.getState();
    const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));
    for (let i = 0; i < players.length; i++) {
      const startPayload = {
        gameId, matchCode,
        playerIndex: i,
        playerCount: 2,
        players: playersInfo,
        type: gameTypeStr,
        ...state
      };
      if (players[i].isBot) {
        const bot = bots.find(b => b.socket.id === players[i].id);
        if (bot) bot.socket.emit('c4:start', startPayload);
      } else {
        playerStartData.push({ socketId: players[i].id, event: 'c4:start', data: startPayload });
      }
    }
  } else if (gameType === 'battleship') {
    const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));
    for (let i = 0; i < players.length; i++) {
      const state = game.getStateForPlayer(i);
      const startPayload = {
        gameId, matchCode,
        playerIndex: i,
        playerCount: 2,
        players: playersInfo,
        type: gameTypeStr,
        ...state
      };
      if (players[i].isBot) {
        const bot = bots.find(b => b.socket.id === players[i].id);
        if (bot) bot.socket.emit('bs:start', startPayload);
      } else {
        playerStartData.push({ socketId: players[i].id, event: 'bs:start', data: startPayload });
      }
    }
  } else if (gameType === 'mancala') {
    const state = game.getState();
    const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));
    for (let i = 0; i < players.length; i++) {
      const startPayload = {
        gameId, matchCode,
        playerIndex: i,
        playerCount: 2,
        players: playersInfo,
        type: gameTypeStr,
        ...state
      };
      if (players[i].isBot) {
        const bot = bots.find(b => b.socket.id === players[i].id);
        if (bot) bot.socket.emit('mancala:start', startPayload);
      } else {
        playerStartData.push({ socketId: players[i].id, event: 'mancala:start', data: startPayload });
      }
    }
  } else if (['war', 'crazy8', 'gofish', 'blackjack', 'ginrummy', 'hearts', 'spades', 'poker', 'higherlower'].includes(gameType)) {
    const playersInfo = players.map(p => ({ username: p.username, rating: p.rating || 1200 }));
    const eventPrefix = gameType === 'crazy8' ? 'c8' : gameType === 'gofish' ? 'gf' : gameType === 'blackjack' ? 'bj' : gameType === 'ginrummy' ? 'gr' : gameType === 'hearts' ? 'ht' : gameType === 'spades' ? 'sp' : gameType === 'poker' ? 'pk' : gameType === 'higherlower' ? 'hl' : gameType;
    const startEvent = eventPrefix + ':start';

    // For poker, start the first hand
    if (gameType === 'poker' && game.startHand) game.startHand();

    for (let i = 0; i < players.length; i++) {
      const state = game.getStateForPlayer ? game.getStateForPlayer(i) : game.getState();
      const startPayload = {
        gameId, matchCode,
        playerIndex: i,
        playerCount: players.length,
        players: playersInfo,
        type: gameTypeStr,
        ...state
      };
      if (players[i].isBot) {
        const bot = bots.find(b => b.socket.id === players[i].id);
        if (bot) bot.socket.emit(startEvent, startPayload);
      } else {
        playerStartData.push({ socketId: players[i].id, event: startEvent, data: startPayload });
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
  if (!result.valid) {
    // Safety net: re-check if a bot should act (timer was consumed)
    ensureTroubleBotTurn();
    return;
  }

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
  if (!result.valid) {
    // Safety net: re-check if a bot should act (timer was consumed)
    ensureTroubleBotTurn();
    return;
  }

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
   CARDS AGAINST HUMANITY ACTIONS
   ================================================ */
let cahSubmitTimer = null;
let cahJudgeTimer = null;
const CAH_SUBMIT_TIMEOUT = 60000;   // 60 seconds to submit
const CAH_JUDGE_TIMEOUT = 45000;    // 45 seconds for czar to pick
const CAH_ROUND_DELAY = 4000;       // 4 seconds between rounds

function handleCAHSubmit({ socketId, cardIndices }) {
  if (gameType !== 'cah') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;

  const result = game.submitCards(idx, cardIndices);
  if (!result.valid) {
    postEmit(socketId, 'cah:error', { message: result.error });
    return;
  }

  // Broadcast update to all players (per-player for private hands)
  broadcastCAHUpdate();

  // If all submitted, auto-reveal
  if (result.allSubmitted) {
    cahRevealSubmissions();
  }
}

function handleCAHPick({ socketId, submissionIdx }) {
  if (gameType !== 'cah') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;

  const result = game.pickWinner(idx, submissionIdx);
  if (!result.valid) {
    postEmit(socketId, 'cah:error', { message: result.error });
    return;
  }

  // Clear judge timer
  if (cahJudgeTimer) { clearTimeout(cahJudgeTimer); cahJudgeTimer = null; }

  // Broadcast round result
  broadcastToPlayers('cah:roundResult', {
    winnerIndex: result.winnerIndex,
    winnerName: players[result.winnerIndex]?.username || 'Unknown',
    winningCards: result.winningCards,
    blackCard: result.blackCard,
    submissionIdx: result.submissionIdx,
    scores: result.scores,
    round: result.round
  });

  if (result.gameOver.over) {
    postCAHGameOver(result.gameOver.winner);
  } else {
    // Start next round after delay
    setTimeout(() => {
      if (!game || game.gameOver) return;
      const roundResult = game.startRound();
      if (roundResult.valid) {
        broadcastCAHUpdate();
        cahStartSubmitTimer();
      }
    }, CAH_ROUND_DELAY);
  }
}

function cahRevealSubmissions() {
  if (!game || game.phase !== 'submitting') return;

  // Clear submit timer
  if (cahSubmitTimer) { clearTimeout(cahSubmitTimer); cahSubmitTimer = null; }

  const result = game.revealSubmissions();
  if (!result.valid) return;

  // Broadcast submissions to all (including czar indicator for bots)
  broadcastPerPlayer((i) => {
    const state = game.getStateForPlayer(i);
    return {
      event: 'cah:update',
      data: {
        ...state,
        shuffledSubmissions: result.shuffledSubmissions
      }
    };
  });

  // Start judge timer
  cahStartJudgeTimer();
}

function cahStartSubmitTimer() {
  if (cahSubmitTimer) clearTimeout(cahSubmitTimer);
  cahSubmitTimer = setTimeout(() => {
    cahSubmitTimer = null;
    if (!game || game.gameOver || game.phase !== 'submitting') return;
    // Auto-reveal (which auto-submits for stragglers)
    cahRevealSubmissions();
  }, CAH_SUBMIT_TIMEOUT);
}

function cahStartJudgeTimer() {
  if (cahJudgeTimer) clearTimeout(cahJudgeTimer);
  cahJudgeTimer = setTimeout(() => {
    cahJudgeTimer = null;
    if (!game || game.gameOver) return;
    if (game.phase !== 'revealing' && game.phase !== 'judging') return;
    // Auto-pick random winner
    const count = game.shuffledSubmissions.length;
    if (count > 0) {
      const randomIdx = Math.floor(Math.random() * count);
      handleCAHPick({ socketId: players[game.currentCzar]?.id, submissionIdx: randomIdx });
    }
  }, CAH_JUDGE_TIMEOUT);
}

function broadcastCAHUpdate() {
  broadcastPerPlayer((i) => {
    const state = game.getStateForPlayer(i);
    return { event: 'cah:update', data: state };
  });
}

function ensureCAHBotAction() {
  if (!game || game.gameOver) return;

  if (game.phase === 'submitting') {
    // Check if any bot hasn't submitted
    for (const bot of bots) {
      if (bot.destroyed || bot._paused) continue;
      if (bot.playerIndex === game.currentCzar) continue;
      if (game.submissions.has(bot.playerIndex)) continue;
      if (!bot._timer) {
        const state = game.getStateForPlayer(bot.playerIndex);
        bot._hand = state.hand;
        bot._scheduleSubmit(game.currentBlack);
      }
    }
  } else if (game.phase === 'revealing') {
    // Check if czar bot should pick
    const czarBot = bots.find(b => b.playerIndex === game.currentCzar);
    if (czarBot && !czarBot.destroyed && !czarBot._paused && !czarBot._timer) {
      czarBot._isCzar = true;
      czarBot._schedulePick(game.shuffledSubmissions);
    }
  }
}

function postCAHGameOver(winnerIdx) {
  const overData = {
    winner: winnerIdx,
    winnerUsername: players[winnerIdx]?.username,
    scores: [...game.scores],
    round: game.round,
    maxRounds: game.maxRounds
  };

  // Clear timers
  if (cahSubmitTimer) { clearTimeout(cahSubmitTimer); cahSubmitTimer = null; }
  if (cahJudgeTimer) { clearTimeout(cahJudgeTimer); cahJudgeTimer = null; }

  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit('cah:over', overData);
    }
  }

  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: 'cah:over', data: overData }));

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType: 'cah',
      winnerIdx,
      scores: [...game.scores],
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   CONNECT FOUR ACTIONS
   ================================================ */
function handleC4Move({ socketId, col }) {
  if (gameType !== 'c4') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const playerConst = idx === 0 ? ConnectFourGame.PLAYER1 : ConnectFourGame.PLAYER2;
  if (playerConst !== game.currentTurn) {
    postEmit(socketId, 'c4:error', { message: 'Not your turn' });
    return;
  }

  const result = game.makeMove(col);
  if (!result.valid) {
    postEmit(socketId, 'c4:error', { message: 'Invalid move' });
    return;
  }

  const updateData = {
    player: idx,
    row: result.row,
    col: result.col,
    board: result.board,
    currentTurn: result.currentTurn === ConnectFourGame.PLAYER1 ? 0 : 1,
    gameOver: result.gameOver
  };

  broadcastToPlayers('c4:update', updateData);

  if (result.gameOver.over) {
    postC4GameOver(result.gameOver);
  }
}

function postC4GameOver(goResult) {
  let winnerIdx = null;
  if (goResult.winner === ConnectFourGame.PLAYER1) winnerIdx = 0;
  else if (goResult.winner === ConnectFourGame.PLAYER2) winnerIdx = 1;

  const overData = {
    winner: winnerIdx,
    winnerUsername: winnerIdx !== null ? players[winnerIdx]?.username : null,
    reason: goResult.reason,
    winLine: goResult.winLine
  };

  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit('c4:over', overData);
    }
  }

  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: 'c4:over', data: overData }));

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType: 'c4',
      winnerIdx,
      reason: goResult.reason,
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   BATTLESHIP ACTIONS
   ================================================ */
function handleBSPlaceShip({ socketId, shipName, row, col, horizontal }) {
  if (gameType !== 'battleship') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;

  const result = game.placeShip(idx, shipName, row, col, horizontal);
  if (!result.valid) {
    postEmit(socketId, 'bs:error', { message: result.error });
    return;
  }

  const state = game.getStateForPlayer(idx);
  postEmit(socketId, 'bs:placed', state);
}

function handleBSAutoPlace({ socketId }) {
  if (gameType !== 'battleship') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;

  const result = game.autoPlace(idx);
  if (!result.valid) {
    postEmit(socketId, 'bs:error', { message: result.error });
    return;
  }

  const state = game.getStateForPlayer(idx);
  postEmit(socketId, 'bs:placed', state);
}

function handleBSSetReady({ socketId }) {
  if (gameType !== 'battleship') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;

  const result = game.setReady(idx);
  if (!result.valid) {
    postEmit(socketId, 'bs:error', { message: result.error });
    return;
  }

  if (result.bothReady) {
    // Game is now in playing phase, send updated state to both
    broadcastPerPlayer((i) => {
      const state = game.getStateForPlayer(i);
      return { event: 'bs:ready', data: { ...state, bothReady: true } };
    });
  } else {
    postEmit(socketId, 'bs:ready', { ...game.getStateForPlayer(idx), bothReady: false });
  }
}

function handleBSFireShot({ socketId, row, col }) {
  if (gameType !== 'battleship') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;

  const result = game.fireShot(idx, row, col);
  if (!result.valid) {
    postEmit(socketId, 'bs:error', { message: result.error });
    return;
  }

  // Send update to both players with their own perspective
  broadcastPerPlayer((i) => {
    const state = game.getStateForPlayer(i);
    return {
      event: 'bs:update',
      data: {
        ...state,
        shooter: idx,
        row: result.row,
        col: result.col,
        hit: result.hit,
        sunk: result.sunk,
        shipName: result.shipName
      }
    };
  });

  if (result.gameOver.over) {
    postBSGameOver(result.gameOver);
  }
}

function postBSGameOver(goResult) {
  const overData = {
    winner: goResult.winner,
    winnerUsername: players[goResult.winner]?.username,
    reason: goResult.reason
  };

  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit('bs:over', overData);
    }
  }

  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: 'bs:over', data: overData }));

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType: 'battleship',
      winner: goResult.winner,
      reason: goResult.reason,
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   MANCALA ACTIONS
   ================================================ */
function handleMancalaMove({ socketId, pitIdx }) {
  if (gameType !== 'mancala') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  if (idx !== game.currentTurn) {
    postEmit(socketId, 'mancala:error', { message: 'Not your turn' });
    return;
  }

  const result = game.makeMove(pitIdx);
  if (!result.valid) {
    postEmit(socketId, 'mancala:error', { message: result.reason });
    return;
  }

  const updateData = {
    player: idx,
    pitIdx: result.pitIdx,
    stoneCount: result.stoneCount,
    endIdx: result.endIdx,
    extraTurn: result.extraTurn,
    captured: result.captured,
    capturedFrom: result.capturedFrom,
    pits: result.state.pits,
    currentTurn: result.state.currentTurn,
    scores: result.scores,
    gameOver: result.gameOver
  };

  broadcastToPlayers('mancala:update', updateData);

  if (result.gameOver.over) {
    postMancalaGameOver(result.gameOver);
  }
}

function postMancalaGameOver(goResult) {
  const overData = {
    winner: goResult.winner,
    winnerUsername: typeof goResult.winner === 'number' ? players[goResult.winner]?.username : null,
    reason: goResult.reason,
    scores: goResult.scores
  };

  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit('mancala:over', overData);
    }
  }

  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: 'mancala:over', data: overData }));

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType: 'mancala',
      winner: goResult.winner,
      scores: goResult.scores,
      reason: goResult.reason,
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   CARD GAME HELPERS
   ================================================ */
function getCardEventPrefix() {
  const map = { war: 'war', crazy8: 'c8', gofish: 'gf', blackjack: 'bj', ginrummy: 'gr', hearts: 'ht', spades: 'sp', poker: 'pk', higherlower: 'hl' };
  return map[gameType] || gameType;
}

function broadcastCardUpdate(extra) {
  const prefix = getCardEventPrefix();
  broadcastPerPlayer((i) => {
    const state = game.getStateForPlayer ? game.getStateForPlayer(i) : game.getState();
    return { event: prefix + ':update', data: { ...state, ...extra, playerIndex: i } };
  });
}

function postCardGameOver(prefix, goResult) {
  const overData = {
    winner: goResult.winner,
    winnerUsername: typeof goResult.winner === 'number' ? players[goResult.winner]?.username : null,
    reason: goResult.reason || 'Game over',
    scores: goResult.scores || null
  };

  for (const p of players) {
    if (p.isBot) {
      const bot = bots.find(b => b.socket.id === p.id);
      if (bot) bot.socket.emit(prefix + ':over', overData);
    }
  }

  const humanTargets = players.filter(p => !p.isBot)
    .map(p => ({ socketId: p.id, event: prefix + ':over', data: overData }));

  parentPort.postMessage({
    type: 'gameOver',
    payload: {
      gameId, gameType,
      winner: goResult.winner,
      scores: goResult.scores,
      reason: goResult.reason,
      playerUsernames: players.map(p => p.username),
      overTargets: humanTargets
    }
  });
}

/* ================================================
   WAR ACTIONS
   ================================================ */
function handleWarPlay({ socketId }) {
  if (gameType !== 'war') return;
  const result = game.playRound();
  if (!result.valid) return;
  broadcastCardUpdate({ battleCards: result.battleCards, warCards: result.warCards, roundWinner: result.roundWinner });
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('war', go);
}

/* ================================================
   CRAZY EIGHTS ACTIONS
   ================================================ */
function handleC8Play({ socketId, cardIndex, chosenSuit }) {
  if (gameType !== 'crazy8') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.playCard(idx, cardIndex, chosenSuit);
  if (!result.valid) {
    postEmit(socketId, 'c8:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('c8', go);
}

function handleC8Draw({ socketId }) {
  if (gameType !== 'crazy8') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.drawCard(idx);
  if (!result.valid) {
    postEmit(socketId, 'c8:error', { message: result.error || 'Cannot draw' });
    return;
  }
  broadcastCardUpdate();
}

/* ================================================
   GO FISH ACTIONS
   ================================================ */
function handleGfAsk({ socketId, targetIdx, rank }) {
  if (gameType !== 'gofish') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.askForCard(idx, targetIdx, rank);
  if (!result.valid) {
    postEmit(socketId, 'gf:error', { message: result.error });
    return;
  }
  broadcastCardUpdate({ lastAction: result });
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('gf', go);
}

/* ================================================
   BLACKJACK ACTIONS
   ================================================ */
function handleBjBet({ socketId, amount }) {
  if (gameType !== 'blackjack') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.placeBet(idx, amount);
  if (!result.valid) {
    postEmit(socketId, 'bj:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  // If all bets placed and we moved to dealing, auto-deal
  if (game.phase === 'dealing' || game.phase === 'playing') {
    if (game.deal) game.deal();
    broadcastCardUpdate();
  }
}

function handleBjHit({ socketId }) {
  if (gameType !== 'blackjack') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.hit(idx);
  if (!result.valid) {
    postEmit(socketId, 'bj:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  if (game.phase === 'dealer') {
    if (game._dealerPlay) game._dealerPlay();
    if (game._payout) game._payout();
    broadcastCardUpdate();
  }
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('bj', go);
}

function handleBjStand({ socketId }) {
  if (gameType !== 'blackjack') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.stand(idx);
  if (!result.valid) return;
  broadcastCardUpdate();
  if (game.phase === 'dealer') {
    if (game._dealerPlay) game._dealerPlay();
    if (game._payout) game._payout();
    broadcastCardUpdate();
  }
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('bj', go);
}

function handleBjDouble({ socketId }) {
  if (gameType !== 'blackjack') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.doubleDown(idx);
  if (!result.valid) {
    postEmit(socketId, 'bj:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  if (game.phase === 'dealer') {
    if (game._dealerPlay) game._dealerPlay();
    if (game._payout) game._payout();
    broadcastCardUpdate();
  }
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('bj', go);
}

/* ================================================
   GIN RUMMY ACTIONS
   ================================================ */
function handleGrDrawPile({ socketId }) {
  if (gameType !== 'ginrummy') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.drawFromPile(idx);
  if (!result.valid) {
    postEmit(socketId, 'gr:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
}

function handleGrDrawDiscard({ socketId }) {
  if (gameType !== 'ginrummy') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.drawFromDiscard(idx);
  if (!result.valid) {
    postEmit(socketId, 'gr:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
}

function handleGrDiscard({ socketId, cardIndex }) {
  if (gameType !== 'ginrummy') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.discard(idx, cardIndex);
  if (!result.valid) {
    postEmit(socketId, 'gr:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('gr', go);
}

function handleGrKnock({ socketId, cardIndex }) {
  if (gameType !== 'ginrummy') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.knock(idx, cardIndex);
  if (!result.valid) {
    postEmit(socketId, 'gr:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('gr', go);
}

/* ================================================
   HEARTS ACTIONS
   ================================================ */
function handleHtPass({ socketId, cardIndices }) {
  if (gameType !== 'hearts') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.passCards(idx, cardIndices);
  if (!result.valid) {
    postEmit(socketId, 'ht:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
}

function handleHtPlay({ socketId, cardIndex }) {
  if (gameType !== 'hearts') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.playCard(idx, cardIndex);
  if (!result.valid) {
    postEmit(socketId, 'ht:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('ht', go);
}

/* ================================================
   SPADES ACTIONS
   ================================================ */
function handleSpBid({ socketId, bid }) {
  if (gameType !== 'spades') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.placeBid(idx, bid);
  if (!result.valid) {
    postEmit(socketId, 'sp:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
}

function handleSpPlay({ socketId, cardIndex }) {
  if (gameType !== 'spades') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.playCard(idx, cardIndex);
  if (!result.valid) {
    postEmit(socketId, 'sp:error', { message: result.error });
    return;
  }
  broadcastCardUpdate();
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('sp', go);
}

/* ================================================
   POKER ACTIONS
   ================================================ */
function handlePkAction({ socketId, action, amount }) {
  if (gameType !== 'poker') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  let result;
  switch (action) {
    case 'fold': result = game.fold(idx); break;
    case 'check': result = game.check(idx); break;
    case 'call': result = game.call(idx); break;
    case 'raise': result = game.raise(idx, amount); break;
    case 'allIn': result = game.allIn(idx); break;
    default: return;
  }
  if (!result || !result.valid) {
    postEmit(socketId, 'pk:error', { message: (result && result.error) || 'Invalid action' });
    return;
  }
  broadcastCardUpdate();
  if (result.handOver || (game.phase === 'showdown')) {
    // Start next hand after a delay if game not over
    const go = game.checkGameOver();
    if (go.over) {
      postCardGameOver('pk', go);
    } else if (game.startHand) {
      setTimeout(() => {
        if (game && !game.gameOver) {
          game.startHand();
          broadcastCardUpdate();
        }
      }, 3000);
    }
  }
}

/* ================================================
   HIGHER OR LOWER ACTIONS
   ================================================ */
function handleHlGuess({ socketId, choice }) {
  if (gameType !== 'higherlower') return;
  const idx = socketToIndex.get(socketId);
  if (idx === undefined) return;
  const result = game.guess(idx, choice);
  if (!result.valid) {
    postEmit(socketId, 'hl:error', { message: result.error });
    return;
  }
  broadcastCardUpdate({ lastResult: result });
  const go = game.checkGameOver();
  if (go.over) postCardGameOver('hl', go);
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
  } else if (gameType === 'cah') {
    const result = game.removePlayer(idx);
    if (result.gameOver && result.gameOver.over) {
      postCAHGameOver(result.gameOver.winner || game.winner);
    } else {
      broadcastCAHUpdate();
    }
  } else if (gameType === 'c4') {
    const winnerIdx = 1 - idx;
    postC4GameOver({ over: true, winner: winnerIdx === 0 ? ConnectFourGame.PLAYER1 : ConnectFourGame.PLAYER2, reason: 'Opponent resigned', winLine: null });
  } else if (gameType === 'battleship') {
    const winnerIdx = 1 - idx;
    postBSGameOver({ over: true, winner: winnerIdx, reason: 'Opponent resigned' });
  } else if (gameType === 'mancala') {
    const winnerIdx = 1 - idx;
    postMancalaGameOver({ over: true, winner: winnerIdx, reason: 'Opponent resigned', scores: game._getScores() });
  } else if (['war', 'crazy8', 'gofish', 'blackjack', 'ginrummy', 'hearts', 'spades', 'poker', 'higherlower'].includes(gameType)) {
    const eventPrefix = gameType === 'crazy8' ? 'c8' : gameType === 'gofish' ? 'gf' : gameType === 'blackjack' ? 'bj' : gameType === 'ginrummy' ? 'gr' : gameType === 'hearts' ? 'ht' : gameType === 'spades' ? 'sp' : gameType === 'poker' ? 'pk' : gameType === 'higherlower' ? 'hl' : gameType;
    // Simple resign: other player(s) win
    let winnerIdx = 0;
    if (players.length === 2) {
      winnerIdx = 1 - idx;
    } else {
      for (let i = 0; i < players.length; i++) {
        if (i !== idx) { winnerIdx = i; break; }
      }
    }
    postCardGameOver(eventPrefix, { over: true, winner: winnerIdx, reason: 'Opponent resigned' });
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
    if (gameType === 'cah') ensureCAHBotAction();
    if (gameType === 'c4') {
      const playerConst = game.currentTurn;
      const botIdx = playerConst - 1;
      const currentBot = bots.find(b => b.playerIndex === botIdx);
      if (currentBot && !currentBot.destroyed) currentBot._scheduleMove();
    }
    if (gameType === 'battleship') {
      const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
      if (currentBot && !currentBot.destroyed && game.phase === 'playing') currentBot._scheduleShot();
    }
    if (gameType === 'mancala') {
      const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
      if (currentBot && !currentBot.destroyed) currentBot._scheduleMove();
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
  } else if (gameType === 'cah') {
    const state = game.getStateForPlayer(playerIdx);

    parentPort.postMessage({
      type: 'rejoinState',
      payload: {
        socketId,
        event: 'cah:rejoined',
        data: {
          gameId, matchCode,
          playerIndex: playerIdx,
          playerCount: game.playerCount,
          players: playersInfo,
          type: gameTypeStr,
          chatLog,
          ...state
        }
      }
    });
  } else if (gameType === 'c4') {
    const state = game.getState();
    parentPort.postMessage({
      type: 'rejoinState',
      payload: {
        socketId,
        event: 'c4:rejoined',
        data: {
          gameId, matchCode,
          playerIndex: playerIdx,
          playerCount: 2,
          players: playersInfo,
          type: gameTypeStr,
          chatLog,
          currentTurn: state.currentTurn === ConnectFourGame.PLAYER1 ? 0 : 1,
          ...state
        }
      }
    });
  } else if (gameType === 'battleship') {
    const state = game.getStateForPlayer(playerIdx);
    parentPort.postMessage({
      type: 'rejoinState',
      payload: {
        socketId,
        event: 'bs:rejoined',
        data: {
          gameId, matchCode,
          playerIndex: playerIdx,
          playerCount: 2,
          players: playersInfo,
          type: gameTypeStr,
          chatLog,
          ...state
        }
      }
    });
  } else if (gameType === 'mancala') {
    const state = game.getState();
    parentPort.postMessage({
      type: 'rejoinState',
      payload: {
        socketId,
        event: 'mancala:rejoined',
        data: {
          gameId, matchCode,
          playerIndex: playerIdx,
          playerCount: 2,
          players: playersInfo,
          type: gameTypeStr,
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
/* ================================================
   SERIALIZE — snapshot full worker state for persistence
   ================================================ */
function handleSerialize() {
  const snapshot = {
    gameId,
    matchCode,
    gameType,
    gameTypeStr,
    players: players.map(p => ({
      id: p.id,
      username: p.username,
      isBot: p.isBot,
      playerIndex: p.playerIndex,
      color: p.color,
      rating: p.rating,
      cosmetics: p.cosmetics,
      botRating: p.botRating,
      botName: p.botName
    })),
    gameState: game ? game.serialize() : null,
    chatLog: [...chatLog],
    disconnectedPlayers: [...disconnectedPlayers],
    gameConfig: {}
  };

  if (gameType === 'cah' && game) {
    snapshot.gameConfig.packType = game.packType;
    snapshot.gameConfig.maxRounds = game.maxRounds;
  }

  parentPort.postMessage({ type: 'serialized', payload: snapshot });
}

/* ================================================
   INIT FROM STATE — restore worker from saved snapshot
   ================================================ */
function handleInitFromState(payload) {
  gameId = payload.gameId;
  matchCode = payload.matchCode;
  gameType = payload.gameType;
  gameTypeStr = payload.gameTypeStr;
  chatLog = payload.chatLog || [];

  players = payload.players.map((p, idx) => ({ ...p, playerIndex: idx }));
  for (const p of players) {
    socketToIndex.set(p.id, p.playerIndex);
  }

  // Restore game from serialized state
  const state = payload.gameState;
  switch (gameType) {
    case 'checkers':
      game = CheckersGame.deserialize(state);
      break;
    case 'trouble':
      game = TroubleGame.deserialize(state);
      break;
    case 'scrabble': {
      const dictPath = payload.gameConfig.dictionaryPath;
      const words = fs.readFileSync(dictPath, 'utf-8').split(/\r?\n/).filter(w => w.length > 0);
      dictionary = new Set(words.map(w => w.toUpperCase()));
      game = ScrabbleGame.deserialize(state, dictionary);
      break;
    }
    case 'cah':
      game = CAHGame.deserialize(state);
      break;
    case 'c4':
      game = ConnectFourGame.deserialize(state);
      break;
    case 'battleship':
      game = BattleshipGame.deserialize(state);
      break;
    case 'mancala':
      game = MancalaGame.deserialize(state);
      break;
    case 'war':
      game = WarGame.deserialize(state);
      break;
    case 'crazy8':
      game = CrazyEightsGame.deserialize(state);
      break;
    case 'gofish':
      game = GoFishGame.deserialize(state);
      break;
    case 'blackjack':
      game = BlackjackGame.deserialize(state);
      break;
    case 'ginrummy':
      game = GinRummyGame.deserialize(state);
      break;
    case 'hearts':
      game = HeartsGame.deserialize(state);
      break;
    case 'spades':
      game = SpadesGame.deserialize(state);
      break;
    case 'poker':
      game = PokerGame.deserialize(state);
      break;
    case 'higherlower':
      game = HigherLowerGame.deserialize(state);
      break;
  }

  // Mark all human players as disconnected (they'll rejoin via attemptRejoin)
  for (const p of players) {
    if (!p.isBot) {
      disconnectedPlayers.add(p.username);
    }
  }

  // Recreate bots (paused — they'll resume when humans rejoin)
  const adapter = buildLocalAdapter();
  for (const p of players) {
    if (!p.isBot) continue;
    let bot;
    switch (gameType) {
      case 'checkers':
        bot = new BotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.id = p.id;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        break;
      case 'trouble':
        bot = new TroubleBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
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
      case 'cah':
        bot = new CAHBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'c4':
        bot = new ConnectFourBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'battleship':
        bot = new BattleshipBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'mancala':
        bot = new MancalaBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'war':
        bot = new WarBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'crazy8':
        bot = new CrazyEightsBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'gofish':
        bot = new GoFishBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'blackjack':
        bot = new BlackjackBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'ginrummy':
        bot = new GinRummyBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'hearts':
        bot = new HeartsBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'spades':
        bot = new SpadesBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'poker':
        bot = new PokerBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
      case 'higherlower':
        bot = new HigherLowerBotPlayer(adapter, p.botRating || 1200, p.botName);
        bot.gameId = gameId;
        bot.playerIndex = p.playerIndex;
        bot.socket.id = p.id;
        bot.socket.username = p.username;
        bot.username = p.username;
        bot.id = p.id;
        break;
    }
    if (bot) {
      bot._paused = true;
      bots.push(bot);
    }
  }

  // Set up bot watchdog (same as handleInit)
  if (bots.length > 0) {
    setInterval(() => {
      if (!game) return;
      if (gameType === 'trouble') {
        ensureTroubleBotTurn();
      } else if (gameType === 'checkers') {
        const go = game.checkGameOver();
        if (go && go.over) return;
        const currentBot = bots.find(b => b.color === game.currentTurn);
        if (currentBot && currentBot.active && !currentBot._paused && !currentBot.moveTimer) {
          currentBot._scheduleMove();
        }
      } else if (gameType === 'scrabble') {
        if (game.gameOver) return;
        const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          currentBot._scheduleTurn();
        }
      } else if (gameType === 'cah') {
        ensureCAHBotAction();
      } else if (gameType === 'c4') {
        if (game.gameOver) return;
        const playerConst = game.currentTurn;
        const botIdx = playerConst - 1;
        const currentBot = bots.find(b => b.playerIndex === botIdx);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          currentBot._scheduleMove();
        }
      } else if (gameType === 'battleship') {
        if (game.phase === 'over') return;
        for (const bot of bots) {
          if (bot.destroyed || bot._paused) continue;
          if (game.phase === 'playing' && game.currentTurn === bot.playerIndex && !bot._timer) {
            bot._scheduleShot();
          }
        }
      } else if (gameType === 'mancala') {
        if (game.gameOver) return;
        const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          currentBot._scheduleMove();
        }
      } else if (['war', 'crazy8', 'gofish', 'blackjack', 'ginrummy', 'hearts', 'spades', 'poker', 'higherlower'].includes(gameType)) {
        if (game.gameOver || game.phase === 'over') return;
        const currentBot = bots.find(b => b.playerIndex === game.currentTurn);
        if (currentBot && !currentBot.destroyed && !currentBot._paused && !currentBot._timer) {
          if (currentBot._schedulePlay) currentBot._schedulePlay();
          else if (currentBot._scheduleMove) currentBot._scheduleMove();
          else if (currentBot._scheduleTurn) currentBot._scheduleTurn();
        }
      }
    }, 3000);
  }

  parentPort.postMessage({ type: 'restored', payload: { gameId } });
}

function handleDestroy() {
  for (const bot of bots) bot.destroy();
  bots = [];
  game = null;
  process.exit(0);
}
