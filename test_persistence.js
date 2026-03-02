const http = require('http');
const { io } = require('socket.io-client');

function httpPost(path, data, cookie) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (cookie) headers['Cookie'] = cookie;
    const options = { hostname: 'localhost', port: 80, path, method: 'POST', headers };
    const req = http.request(options, (res) => {
      let body = '';
      const cookies = res.headers['set-cookie'] || [];
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body, cookieHeader }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(path, cookie) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    const options = { hostname: 'localhost', port: 80, path, method: 'GET', headers };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function authenticate(username) {
  const postData = JSON.stringify({ username, password: 'testpass123' });
  let result = await httpPost('/api/signup', postData);
  if (result.statusCode !== 200) {
    result = await httpPost('/api/login', postData);
  }
  if (result.statusCode !== 200) throw new Error('Auth failed for ' + username);
  return result.cookieHeader;
}

function connectSocket(cookieHeader) {
  return new Promise((resolve, reject) => {
    const socket = io('http://localhost:80', {
      autoConnect: false,
      extraHeaders: { Cookie: cookieHeader }
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    socket.connect();
    setTimeout(() => reject(new Error('connect timeout')), 5000);
  });
}

function waitForEvent(socket, event, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

async function main() {
  const step = (msg) => console.log(`\n=== ${msg} ===`);

  // --- Step 1: Authenticate and start a C4 bot game ---
  step('Step 1: Login and start C4 bot game');
  const cookie = await authenticate('persist_test_user');
  console.log('  Authenticated, cookie:', cookie.substring(0, 40) + '...');

  const socket1 = await connectSocket(cookie);
  console.log('  Connected socket:', socket1.id);

  // Start C4 bot game
  const startPromise = waitForEvent(socket1, 'c4:start');
  socket1.emit('c4:bot');
  const startData = await startPromise;
  console.log('  C4 game started! Player index:', startData.playerIndex);
  console.log('  Match code:', startData.matchCode);
  console.log('  Board exists:', !!startData.board);
  console.log('  Current turn:', startData.currentTurn);

  // Make a move (drop in column 3)
  const updatePromise = waitForEvent(socket1, 'c4:update');
  socket1.emit('c4:move', { col: 3 });
  const updateData = await updatePromise;
  console.log('  Made a move in column 3, board updated');

  // Disconnect
  socket1.disconnect();
  console.log('  Socket disconnected');
  await new Promise(r => setTimeout(r, 1000));

  // --- Step 2: Test session persistence ---
  step('Step 2: Verify session survives (use same cookie)');
  const profileResult = await httpGet('/api/profile', cookie);
  console.log('  Profile check:', profileResult.statusCode === 200 ? 'OK' : 'FAIL');

  // --- Step 3: Kill server (SIGINT) ---
  step('Step 3: Kill server with SIGINT');
  process.kill(process.ppid, 0); // just check it's alive

  // Send SIGINT to node process (the server)
  const { execSync } = require('child_process');
  try {
    // Find and kill the server process
    execSync('taskkill //F //IM node.exe 2>nul', { stdio: 'pipe' });
  } catch (e) { /* ignore */ }
  console.log('  Server killed');
  await new Promise(r => setTimeout(r, 2000));

  // --- Step 4: Check that games.json was saved ---
  step('Step 4: Check saved game data');
  const fs = require('fs');
  const path = require('path');
  const gamesFile = path.join(__dirname, 'data', 'games.json');
  if (fs.existsSync(gamesFile)) {
    const savedGames = JSON.parse(fs.readFileSync(gamesFile, 'utf-8'));
    console.log('  games.json exists with', savedGames.length, 'game(s)');
    if (savedGames.length > 0) {
      const g = savedGames[0];
      console.log('  Game type:', g.gameType);
      console.log('  Has game state:', !!g.gameState);
      console.log('  Has matchmaker data:', !!g.matchmakerData);
      console.log('  Players:', g.matchmakerData?.players?.length);
    }
  } else {
    console.log('  ERROR: games.json NOT found!');
  }

  // --- Step 5: Check session file exists ---
  step('Step 5: Check session files');
  const sessionsDir = path.join(__dirname, 'data', 'sessions');
  if (fs.existsSync(sessionsDir)) {
    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    console.log('  Session files:', sessionFiles.length);
  } else {
    console.log('  ERROR: sessions directory NOT found!');
  }

  console.log('\n=== Test complete ===');
  process.exit(0);
}

main().catch(err => { console.error('TEST ERROR:', err); process.exit(1); });
