'use strict';

const http = require('http');
const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const GAMES_FILE = path.join(__dirname, 'data', 'games.json');
const SESSIONS_DIR = path.join(__dirname, 'data', 'sessions');

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

function httpRequest(method, urlPath, data, cookie) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({ hostname: 'localhost', port: 80, path: urlPath, method, headers }, (res) => {
      let body = '';
      const cookies = res.headers['set-cookie'] || [];
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body, cookieHeader }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function authenticate(username) {
  const postData = JSON.stringify({ username, password: 'testpass123' });
  let result = await httpRequest('POST', '/api/signup', postData);
  if (result.statusCode !== 200) result = await httpRequest('POST', '/api/login', postData);
  if (result.statusCode !== 200) throw new Error(`Auth failed: ${result.statusCode} ${result.body}`);
  return result.cookieHeader;
}

function connectSocket(cookieHeader) {
  return new Promise((resolve, reject) => {
    const socket = io('http://localhost:80', { autoConnect: false, extraHeaders: { Cookie: cookieHeader } });
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
    socket.on('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
    socket.connect();
  });
}

function waitForEvent(socket, event, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for: ${event}`)), timeout);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server.js'], { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });
    const timer = setTimeout(() => {
      if (output.includes('running on')) resolve(child);
      else reject(new Error('Server start timeout: ' + output));
    }, 5000);
    child.on('error', reject);
  });
}

function killServer(proc) {
  try { proc.kill('SIGKILL'); } catch(e) {}
  return new Promise(r => setTimeout(r, 1500));
}

async function main() {
  const step = (msg) => console.log(`\n=== ${msg} ===`);

  // Clean up leftover state
  if (fs.existsSync(GAMES_FILE)) fs.unlinkSync(GAMES_FILE);

  // --- Part A: Session Persistence ---
  step('Part A: Session Persistence');

  console.log('  Starting server...');
  let server1 = await startServer();

  // Create a user and get session cookie
  const cookie = await authenticate('persist_test_user');
  console.log('  Authenticated as persist_test_user');

  // Verify profile works with this cookie
  const profile1 = await httpRequest('GET', '/api/profile', null, cookie);
  assert('Profile accessible before restart', profile1.statusCode === 200);
  if (profile1.statusCode === 200) {
    const p = JSON.parse(profile1.body);
    assert('Correct username in profile', p.user?.username === 'persist_test_user');
  }

  // Check session file was written
  let sessionFiles = [];
  if (fs.existsSync(SESSIONS_DIR)) {
    sessionFiles = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  }
  assert('Session file(s) written to disk', sessionFiles.length > 0);
  console.log(`  Session files on disk: ${sessionFiles.length}`);

  // Kill and restart
  await killServer(server1);
  console.log('  Server killed, restarting...');

  let server2 = await startServer();
  console.log('  Server restarted');

  // Check if session survives restart using the SAME cookie
  const profile2 = await httpRequest('GET', '/api/profile', null, cookie);
  assert('Session persisted through restart (profile accessible)', profile2.statusCode === 200);
  if (profile2.statusCode === 200) {
    const p = JSON.parse(profile2.body);
    assert('Same username after restart', p.user?.username === 'persist_test_user');
  }

  await killServer(server2);

  // --- Part B: Game State Persistence ---
  step('Part B: Game State Persistence');

  console.log('  Starting server...');
  let server3 = await startServer();

  // Re-authenticate (same cookie should work from session-file-store)
  const cookie2 = await authenticate('persist_test_user');

  // Connect socket and start a C4 bot game
  const socket1 = await connectSocket(cookie2);
  console.log('  Connected socket:', socket1.id);

  const startPromise = waitForEvent(socket1, 'c4:start');
  socket1.emit('c4:bot');
  const startData = await startPromise;
  console.log('  C4 bot game started, matchCode:', startData.matchCode);
  assert('Game started successfully', !!startData.matchCode);

  // Make a move (col 3)
  const updatePromise = waitForEvent(socket1, 'c4:update');
  socket1.emit('c4:move', { col: 3 });
  await updatePromise;
  console.log('  Made move in column 3');

  // Disconnect socket
  socket1.disconnect();
  await new Promise(r => setTimeout(r, 500));

  // Directly use GamePersistence + Matchmaker to trigger a save
  // Since we can't send SIGTERM on Windows, we'll use an HTTP-based approach:
  // Simply call the autosave endpoint by waiting, or manually save via module import.
  // But since the server is a child process, we can't call its methods directly.
  // Instead, we'll use the module directly to verify the save/load mechanism works,
  // AND we'll verify that the autosave interval creates the file within 60s.

  // Approach: Wait up to 65 seconds for the autosave to trigger
  console.log('  Waiting for periodic autosave (up to 65s)...');
  let autosaveWorked = false;
  for (let i = 0; i < 13; i++) {
    await new Promise(r => setTimeout(r, 5000));
    if (fs.existsSync(GAMES_FILE)) {
      autosaveWorked = true;
      break;
    }
    process.stdout.write(`  ${(i + 1) * 5}s... `);
  }
  console.log('');
  assert('Autosave created games.json', autosaveWorked);

  if (autosaveWorked) {
    const savedData = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf-8'));
    assert('At least 1 game saved', savedData.length >= 1);
    if (savedData.length > 0) {
      const g = savedData[0];
      assert('Game type is c4', g.gameType === 'c4');
      assert('Game state serialized', !!g.gameState);
      assert('Board has move in col 3', g.gameState?.board?.[5]?.[3] !== 0);
      assert('Matchmaker metadata present', !!g.matchmakerData);
      assert('Match code preserved', !!g.matchmakerData?.matchCode);
      console.log('  Saved game details:', JSON.stringify({
        gameType: g.gameType,
        matchCode: g.matchCode,
        boardCol3: g.gameState?.board?.[5]?.[3],
        players: g.players?.length
      }));
    }
  }

  // Kill the server
  await killServer(server3);

  // If autosave didn't work (shouldn't happen, but fallback), manually create a snapshot
  if (!autosaveWorked) {
    console.log('  Autosave did not trigger; using direct module test...');
    const { saveGames } = require('./game/GamePersistence');
    saveGames([{
      gameId: 'test_123', matchCode: 'ABCD12', gameType: 'c4', gameTypeStr: 'bot',
      players: [
        { id: 'sock1', username: 'persist_test_user', isBot: false, playerIndex: 0 },
        { id: 'bot1', username: 'Bot Easy', isBot: true, playerIndex: 1, botRating: 1200, botName: 'Bot Easy' }
      ],
      gameState: {
        board: (() => { const b = Array.from({length:6}, () => Array(7).fill(0)); b[5][3] = 1; return b; })(),
        currentTurn: 1, gameOver: false, winner: null, winLine: null, moveHistory: [3]
      },
      chatLog: [], disconnectedPlayers: [], gameConfig: {},
      matchmakerData: {
        id: 'test_123', matchCode: 'ABCD12', gameType: 'c4', type: 'bot',
        players: [
          { id: 'sock1', username: 'persist_test_user', isBot: false, playerIndex: 0 },
          { id: 'bot1', username: 'Bot Easy', isBot: true, playerIndex: 1, botRating: 1200, botName: 'Bot Easy' }
        ]
      }
    }]);
    console.log('  Manually saved mock game snapshot');
  }

  // --- Part C: Game Restore After Restart ---
  step('Part C: Game Restore After Restart');

  console.log('  Starting server (should restore saved game)...');
  let server4 = await startServer();
  // Capture server output for restoration logs
  let serverOutput = '';
  server4.stdout.on('data', (d) => { serverOutput += d.toString(); });
  server4.stderr.on('data', (d) => { serverOutput += d.toString(); });
  await new Promise(r => setTimeout(r, 2000));

  // Re-authenticate and reconnect
  const cookie3 = await authenticate('persist_test_user');
  const socket2 = await connectSocket(cookie3);
  console.log('  Reconnected socket:', socket2.id);

  // Wait for rejoin event
  const rejoinData = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    socket2.on('c4:rejoined', (data) => { clearTimeout(timer); resolve(data); });
    socket2.on('c4:start', (data) => { clearTimeout(timer); resolve(data); });
  });

  assert('Received rejoin/start event', !!rejoinData);
  if (rejoinData) {
    assert('Board data present in rejoin', !!rejoinData.board);
    if (rejoinData.board) {
      assert('Move preserved (col 3)', rejoinData.board[5]?.[3] !== 0);
    }
  }

  // Cleanup
  socket2.disconnect();
  await killServer(server4);

  // --- Summary ---
  step('Summary');
  console.log(`  Passed: ${passed}, Failed: ${failed}`);
  console.log(`  Result: ${failed === 0 ? 'ALL TESTS PASSED' : `${failed} TEST(S) FAILED`}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('TEST ERROR:', err.message); process.exit(1); });
