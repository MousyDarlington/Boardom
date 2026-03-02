const http = require('http');
const { io } = require('socket.io-client');

// Step 1: Register or login
const postData = JSON.stringify({ username: 'testbot1', password: 'testpass123' });

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 80, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
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

async function main() {
  let result = await httpPost('/api/signup', postData);
  console.log('Signup:', result.statusCode, result.body.substring(0, 150));

  if (result.statusCode !== 200) {
    result = await httpPost('/api/login', postData);
    console.log('Login:', result.statusCode, result.body.substring(0, 150));
  }

  if (result.statusCode !== 200) {
    console.log('FAILED to authenticate');
    process.exit(1);
  }

  console.log('Cookies:', result.cookieHeader);

  const socket = io('http://localhost:80', {
    autoConnect: false,
    extraHeaders: { Cookie: result.cookieHeader }
  });

  socket.on('connect', () => {
    console.log('Connected, id:', socket.id);
    console.log('Emitting c4:bot...');
    socket.emit('c4:bot');
  });

  socket.on('auth:required', () => {
    console.log('ERROR: auth:required - not authenticated!');
    socket.disconnect();
    process.exit(1);
  });

  socket.on('c4:start', (data) => {
    console.log('SUCCESS: c4:start received!');
    console.log('Player index:', data.playerIndex);
    console.log('Players:', JSON.stringify(data.players));
    console.log('Board exists:', !!data.board);
    console.log('Current turn:', data.currentTurn);
    socket.emit('c4:resign');
    setTimeout(() => { socket.disconnect(); process.exit(0); }, 500);
  });

  socket.onAny((event, ...args) => {
    if (event === 'c4:start') return; // handled above
    console.log('EVENT:', event, JSON.stringify(args).substring(0, 200));
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

  socket.connect();

  setTimeout(() => {
    console.log('TIMEOUT: No c4:start received after 10s');
    socket.disconnect();
    process.exit(1);
  }, 10000);
}

main().catch(err => { console.error(err); process.exit(1); });
