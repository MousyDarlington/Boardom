'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Matchmaker = require('./game/Matchmaker');
const { DEFAULT_RATING } = require('./game/EloRating');
const { SHOP_ITEMS } = require('./game/ShopCatalog');

/* ========== User Store (JSON file persistence) ========== */

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const users = new Map();

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      for (const u of data) users.set(u.username, u);
      console.log(`Loaded ${users.size} users`);
    }
  } catch (e) {
    console.error('Failed to load users:', e.message);
  }
}

function saveUsers() {
  try {
    const real = [...users.values()].filter(u => !u.isBot);
    fs.writeFileSync(USERS_FILE, JSON.stringify(real, null, 2));
  } catch (e) {
    console.error('Failed to save users:', e.message);
  }
}

// Debounced save
let saveTimer = null;
function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveUsers, 2000);
}

loadUsers();

// Load Scrabble dictionary
const DICT_FILE = path.join(__dirname, 'game', 'scrabble-words.txt');
let scrabbleDictionary = new Set();
try {
  const words = fs.readFileSync(DICT_FILE, 'utf-8').split(/\r?\n/).filter(w => w.length > 0);
  scrabbleDictionary = new Set(words.map(w => w.toUpperCase()));
  console.log(`Loaded ${scrabbleDictionary.size} Scrabble words`);
} catch (e) {
  console.error('Failed to load Scrabble dictionary:', e.message);
}

const userStore = {
  getUser(username) { return users.get(username) || null; },
  updateUser(username, updates) {
    const user = users.get(username);
    if (user) {
      Object.assign(user, updates);
      if (!user.isBot) debouncedSave(); // don't persist bot stat changes
    }
  },
  /** Create or update a transient bot user (never persisted to disk). */
  ensureBotUser(username, rating) {
    users.set(username, {
      username,
      passwordHash: '',
      rating,
      wins: 0,
      losses: 0,
      created: Date.now(),
      isBot: true
    });
  }
};

/* ========== Express + Session ========== */

const app = express();
const server = http.createServer(app);

const sessionMiddleware = session({
  secret: 'checkers-game-secret-' + (process.env.SESSION_SECRET || 'dev-key-change-me'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
});

app.use(sessionMiddleware);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---- Auth API ---- */

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const name = username.trim();
  if (name.length < 2 || name.length > 20) return res.status(400).json({ error: 'Username must be 2-20 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(name)) return res.status(400).json({ error: 'Username: letters, numbers, underscores only' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  if (users.has(name)) return res.status(409).json({ error: 'Username taken' });

  const hash = await bcrypt.hash(password, 10);
  const user = {
    username: name,
    passwordHash: hash,
    rating: DEFAULT_RATING,
    wins: 0,
    losses: 0,
    created: Date.now(),
    coins: 0,
    gems: 0,
    ownedItems: [],
    equippedBoard: 'default',
    equippedPieces: 'default',
    equippedBadge: null,
    equippedSiteTheme: 'default',
    adFree: false,
    adFreeUntil: 0,
    trials: {}
  };
  users.set(name, user);
  debouncedSave();

  req.session.username = name;
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = users.get(username.trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.username = user.username;
  res.json({ ok: true, user: publicUser(user) });
});

app.get('/api/profile', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
  const user = users.get(req.session.username);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/leaderboard', (_req, res) => {
  const top = [...users.values()]
    .filter(u => !u.isBot)
    .map(publicUser)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 20);
  res.json({ leaderboard: top });
});

/* ---- Shop API ---- */

app.get('/api/shop', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
  const user = users.get(req.session.username);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({
    items: SHOP_ITEMS,
    owned: user.ownedItems || [],
    coins: user.coins || 0,
    gems: user.gems || 0,
    equipped: {
      board: user.equippedBoard || 'default',
      pieces: user.equippedPieces || 'default',
      badge: user.equippedBadge || null,
      site: user.equippedSiteTheme || 'default'
    },
    adFree: user.adFree || false,
    adFreeUntil: user.adFreeUntil || 0,
    trials: user.trials || {}
  });
});

app.post('/api/shop/buy', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
  const user = users.get(req.session.username);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const { itemId } = req.body;
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const owned = user.ownedItems || [];

  // Timed ad-free and trials are repeatable — don't check ownership
  if (item.type !== 'adfree_timed' && item.type !== 'trial') {
    if (owned.includes(itemId)) return res.status(400).json({ error: 'Already owned' });
  }

  const balanceKey = item.currency === 'gems' ? 'gems' : 'coins';
  const balance = user[balanceKey] || 0;
  if (balance < item.price) return res.status(400).json({ error: `Not enough ${item.currency}` });

  user[balanceKey] = balance - item.price;

  if (item.type === 'adfree_timed') {
    // Extend from now or from existing expiry (whichever is later)
    const base = Math.max(user.adFreeUntil || 0, Date.now());
    user.adFreeUntil = base + item.days * 24 * 60 * 60 * 1000;
  } else if (item.type === 'trial') {
    // Trial tokens are stored; user picks the skin via /api/shop/trial
    if (!user.trials) user.trials = {};
    const key = item.trialType === 'board' ? '_boardTokens' : '_piecesTokens';
    user.trials[key] = (user.trials[key] || 0) + item.trialMatches;
  } else {
    if (!user.ownedItems) user.ownedItems = [];
    user.ownedItems.push(itemId);
    if (item.type === 'adfree') user.adFree = true;
  }
  debouncedSave();

  res.json({
    ok: true, coins: user.coins || 0, gems: user.gems || 0,
    owned: user.ownedItems || [],
    adFreeUntil: user.adFreeUntil || 0,
    trials: user.trials || {}
  });
});

app.post('/api/shop/equip', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
  const user = users.get(req.session.username);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const { itemId, type } = req.body;

  if (itemId === 'default') {
    if (type === 'board') user.equippedBoard = 'default';
    else if (type === 'pieces') user.equippedPieces = 'default';
    else if (type === 'badge') user.equippedBadge = null;
    else if (type === 'site') user.equippedSiteTheme = 'default';
    debouncedSave();
    return res.json({ ok: true });
  }

  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  // Allow equipping if owned OR if on active trial
  const isOwned = (user.ownedItems || []).includes(itemId);
  const trials = user.trials || {};
  const onTrial = trials[itemId] && trials[itemId] > 0;
  if (!isOwned && !onTrial) return res.status(400).json({ error: 'Not owned' });

  if (item.type === 'board') user.equippedBoard = itemId;
  else if (item.type === 'pieces') user.equippedPieces = itemId;
  else if (item.type === 'badge') user.equippedBadge = itemId;
  else if (item.type === 'site') user.equippedSiteTheme = itemId;
  else if (item.type === 'adfree') user.adFree = true;
  debouncedSave();

  res.json({ ok: true });
});

// Activate a trial: spend trial tokens to try a specific skin
app.post('/api/shop/trial', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
  const user = users.get(req.session.username);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const { targetId, trialType } = req.body;
  const item = SHOP_ITEMS.find(i => i.id === targetId && i.type === trialType);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if ((user.ownedItems || []).includes(targetId)) return res.status(400).json({ error: 'Already owned' });

  if (!user.trials) user.trials = {};
  const tokenKey = trialType === 'board' ? '_boardTokens' : '_piecesTokens';
  const tokens = user.trials[tokenKey] || 0;
  if (tokens <= 0) return res.status(400).json({ error: 'No trial tokens' });

  // Spend tokens and activate trial for 5 matches on this specific item
  user.trials[tokenKey] = tokens - 5;
  if (user.trials[tokenKey] <= 0) delete user.trials[tokenKey];
  user.trials[targetId] = 5;

  // Auto-equip the trial item
  if (trialType === 'board') user.equippedBoard = targetId;
  else if (trialType === 'pieces') user.equippedPieces = targetId;
  debouncedSave();

  res.json({ ok: true, trials: user.trials });
});

// Scrabble dictionary API for local/offline games
app.get('/api/scrabble-dictionary', (_req, res) => {
  res.json({ words: [...scrabbleDictionary] });
});

function publicUser(u) {
  return {
    username: u.username,
    rating: u.rating,
    wins: u.wins,
    losses: u.losses,
    created: u.created,
    coins: u.coins || 0,
    gems: u.gems || 0,
    ownedItems: u.ownedItems || [],
    equippedBoard: u.equippedBoard || 'default',
    equippedPieces: u.equippedPieces || 'default',
    equippedBadge: u.equippedBadge || null,
    equippedSiteTheme: u.equippedSiteTheme || 'default',
    adFree: u.adFree || false,
    adFreeUntil: u.adFreeUntil || 0,
    trials: u.trials || {}
  };
}

/* ========== Socket.IO ========== */

const io = new Server(server, {
  connectionStateRecovery: {},
  maxHttpBufferSize: 1e5 // 100KB limit for safety
});

// Share session with Socket.IO
io.engine.use(sessionMiddleware);

const matchmaker = new Matchmaker(io, userStore);
matchmaker.setScrabbleDictionaryPath(DICT_FILE);

// Lobby chat (last 50 messages kept in memory)
const lobbyChatHistory = [];
const MAX_LOBBY_CHAT = 50;

io.on('connection', (socket) => {
  const sess = socket.request.session;
  socket.username = sess?.username || null;

  console.log(`Connected: ${socket.id} (${socket.username || 'anonymous'})`);

  // Attempt auto-rejoin if user has an active game
  if (socket.username) {
    const rejoined = matchmaker.attemptRejoin(socket);
    if (rejoined) console.log(`Auto-rejoined: ${socket.username}`);
  }

  // Send lobby chat history on connect
  socket.emit('chat:lobbyHistory', lobbyChatHistory);

  // Send server stats
  const emitStats = () => {
    socket.emit('server:stats', {
      online: matchmaker.getOnlineCount(),
      queues: matchmaker.getQueueCounts(),
      games: matchmaker.getActiveGameCount()
    });
  };
  emitStats();

  /* ---- Queue ---- */
  socket.on('queue:join', (type) => {
    if (!socket.username) return socket.emit('auth:required');
    if (type === 'ranked') matchmaker.joinRanked(socket);
    else matchmaker.joinCasual(socket);
  });

  socket.on('play:bot', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.playBot(socket);
  });

  socket.on('queue:leave', () => {
    matchmaker.leaveQueue(socket);
  });

  /* ---- Lobby ---- */
  socket.on('lobby:create', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.createLobby(socket);
  });

  socket.on('lobby:join', (code) => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.joinLobby(socket, code);
  });

  socket.on('lobby:leave', () => {
    matchmaker.leaveLobby(socket);
  });

  socket.on('lobby:resolve', (code) => {
    const result = matchmaker.resolveCodeType(code);
    if (!result) return socket.emit('lobby:resolveResult', { found: false, code });
    socket.emit('lobby:resolveResult', { found: true, ...result });
  });

  /* ---- Guest joining ---- */
  socket.on('guest:setName', (name) => {
    const clean = String(name || '').trim().replace(/[<>"'&]/g, '').slice(0, 20);
    if (clean.length < 1) return socket.emit('guest:error', { message: 'Name required' });
    socket.guestName = clean;
    socket.emit('guest:ready', { guestName: clean });
  });

  /* ---- Trouble Lobby ---- */
  socket.on('troubleLobby:create', () => {
    if (!socket.username && !socket.guestName) return socket.emit('auth:required');
    matchmaker.createTroubleLobby(socket);
  });

  socket.on('troubleLobby:join', (code) => {
    if (!socket.username && !socket.guestName) return socket.emit('auth:required');
    matchmaker.joinTroubleLobby(socket, code);
  });

  socket.on('troubleLobby:start', (code) => {
    if (!socket.username && !socket.guestName) return socket.emit('auth:required');
    matchmaker.startTroubleLobby(socket, code);
  });

  socket.on('troubleLobby:leave', () => {
    matchmaker.leaveTroubleLobby(socket);
  });

  /* ---- Rejoin ---- */
  socket.on('game:rejoin', (matchCode) => {
    if (!socket.username) return socket.emit('auth:required');
    const success = matchmaker.attemptRejoin(socket, matchCode);
    if (!success) socket.emit('game:rejoinError', { message: 'Game not found or you are not a participant' });
  });

  /* ---- Game actions ---- */
  socket.on('game:selectPiece', ({ row, col }) => {
    matchmaker.selectPiece(socket, row, col);
  });

  socket.on('game:makeMove', ({ fromRow, fromCol, toRow, toCol }) => {
    matchmaker.makeMove(socket, fromRow, fromCol, toRow, toCol);
  });

  socket.on('game:resign', () => {
    matchmaker.resign(socket);
  });

  /* ---- Trouble ---- */
  socket.on('trouble:join', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.joinTroubleQueue(socket);
  });

  socket.on('trouble:bot', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.playTroubleBot(socket);
  });

  socket.on('trouble:roll', () => {
    matchmaker.troubleRollDice(socket);
  });

  socket.on('trouble:move', ({ tokenIdx }) => {
    matchmaker.troubleMakeMove(socket, tokenIdx);
  });

  socket.on('trouble:resign', () => {
    matchmaker.troubleResign(socket);
  });

  /* ---- Scrabble ---- */
  socket.on('scrabble:join', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.joinScrabbleQueue(socket);
  });

  socket.on('scrabble:bot', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.playScrabbleBot(socket);
  });

  socket.on('scrabble:place', (data) => {
    matchmaker.scrabblePlaceTiles(socket, data.placements);
  });

  socket.on('scrabble:exchange', (data) => {
    matchmaker.scrabbleExchangeTiles(socket, data.tileIndices);
  });

  socket.on('scrabble:pass', () => {
    matchmaker.scrabblePass(socket);
  });

  socket.on('scrabble:resign', () => {
    matchmaker.scrabbleResign(socket);
  });

  /* ---- Cards Against Humanity ---- */
  socket.on('cah:join', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.joinCAHQueue(socket);
  });

  socket.on('cah:bot', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.playCAHBot(socket);
  });

  socket.on('cahLobby:create', (opts) => {
    if (!socket.username && !socket.guestName) return socket.emit('auth:required');
    matchmaker.createCAHLobby(socket, opts);
  });

  socket.on('cahLobby:join', (code) => {
    if (!socket.username && !socket.guestName) return socket.emit('auth:required');
    matchmaker.joinCAHLobby(socket, code);
  });

  socket.on('cahLobby:start', (code) => {
    if (!socket.username && !socket.guestName) return socket.emit('auth:required');
    matchmaker.startCAHLobby(socket, code);
  });

  socket.on('cahLobby:leave', () => {
    matchmaker.leaveCAHLobby(socket);
  });

  socket.on('cah:submit', (data) => {
    matchmaker.cahSubmitCards(socket, data.cardIndices);
  });

  socket.on('cah:pick', (data) => {
    matchmaker.cahPickWinner(socket, data.submissionIdx);
  });

  socket.on('cah:resign', () => {
    matchmaker.cahResign(socket);
  });

  /* ---- Connect Four ---- */
  socket.on('c4:join', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.joinC4Queue(socket);
  });

  socket.on('c4:bot', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.playC4Bot(socket);
  });

  socket.on('c4:move', (data) => {
    matchmaker.c4MakeMove(socket, data.col);
  });

  socket.on('c4:resign', () => {
    matchmaker.c4Resign(socket);
  });

  /* ---- Battleship ---- */
  socket.on('bs:join', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.joinBattleshipQueue(socket);
  });

  socket.on('bs:bot', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.playBattleshipBot(socket);
  });

  socket.on('bs:placeShip', (data) => {
    matchmaker.bsPlaceShip(socket, data.shipName, data.row, data.col, data.horizontal);
  });

  socket.on('bs:autoPlace', () => {
    matchmaker.bsAutoPlace(socket);
  });

  socket.on('bs:ready', () => {
    matchmaker.bsSetReady(socket);
  });

  socket.on('bs:fire', (data) => {
    matchmaker.bsFireShot(socket, data.row, data.col);
  });

  socket.on('bs:resign', () => {
    matchmaker.battleshipResign(socket);
  });

  /* ---- Mancala ---- */
  socket.on('mancala:join', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.joinMancalaQueue(socket);
  });

  socket.on('mancala:bot', () => {
    if (!socket.username) return socket.emit('auth:required');
    matchmaker.playMancalaBot(socket);
  });

  socket.on('mancala:move', (data) => {
    matchmaker.mancalaMakeMove(socket, data.pitIdx);
  });

  socket.on('mancala:resign', () => {
    matchmaker.mancalaResign(socket);
  });

  /* ---- Chat ---- */
  socket.on('chat:lobby', (text) => {
    if (!socket.username) return;
    const msg = {
      username: socket.username,
      text: String(text).slice(0, 200),
      time: Date.now()
    };
    lobbyChatHistory.push(msg);
    if (lobbyChatHistory.length > MAX_LOBBY_CHAT) lobbyChatHistory.shift();
    io.emit('chat:lobby', msg);
  });

  socket.on('chat:game', (text) => {
    matchmaker.gameChat(socket, text);
  });

  /* ---- Disconnect ---- */
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id} (${socket.username || 'anonymous'})`);
    matchmaker.handleDisconnect(socket);
  });
});

// Periodic stats broadcast
setInterval(() => {
  io.emit('server:stats', {
    online: matchmaker.getOnlineCount(),
    queues: matchmaker.getQueueCounts(),
    games: matchmaker.getActiveGameCount()
  });
}, 10000);

/* ========== Start ========== */

const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`\n  Checkers server running on http://localhost:${PORT}\n`);
});

// Save users on shutdown
process.on('SIGINT', () => { saveUsers(); process.exit(); });
process.on('SIGTERM', () => { saveUsers(); process.exit(); });
