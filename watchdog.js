#!/usr/bin/env node
'use strict';

/**
 * Watchdog — polls the GitHub remote for new commits.
 * When a change is detected, pulls the latest code and restarts the server.
 *
 * Usage:  node watchdog.js
 *
 * Environment variables (optional):
 *   POLL_INTERVAL  — seconds between checks (default: 60)
 *   BRANCH         — branch to track (default: main)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL, 10) || 60) * 1000;
const BRANCH = process.env.BRANCH || 'main';
const SERVER_SCRIPT = path.join(__dirname, 'server.js');

let serverProc = null;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[watchdog ${ts}] ${msg}`);
}

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: __dirname, encoding: 'utf8' }).trim();
}

function startServer() {
  if (serverProc) {
    log('Stopping current server (PID ' + serverProc.pid + ')...');
    serverProc.kill('SIGTERM');
    serverProc = null;
  }

  log('Starting server...');
  serverProc = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env }
  });

  serverProc.on('exit', (code, signal) => {
    log(`Server exited (code=${code}, signal=${signal})`);
    serverProc = null;
  });
}

function checkForUpdates() {
  try {
    // Fetch latest from remote
    git('fetch origin ' + BRANCH);

    const localHash = git('rev-parse HEAD');
    const remoteHash = git('rev-parse origin/' + BRANCH);

    if (localHash === remoteHash) {
      return false;
    }

    log(`Update detected: ${localHash.slice(0, 8)} -> ${remoteHash.slice(0, 8)}`);

    // Pull changes
    const pullOutput = git('pull origin ' + BRANCH);
    log('Pull complete: ' + pullOutput);

    // Check if dependencies changed
    const diffFiles = git('diff --name-only ' + localHash + ' ' + remoteHash);
    if (diffFiles.includes('package.json') || diffFiles.includes('package-lock.json')) {
      log('Dependencies changed — running npm install...');
      execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
    }

    return true;
  } catch (err) {
    log('Error checking for updates: ' + err.message);
    return false;
  }
}

function poll() {
  const updated = checkForUpdates();
  if (updated) {
    startServer();
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  if (serverProc) serverProc.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down...');
  if (serverProc) serverProc.kill('SIGTERM');
  process.exit(0);
});

// Initial launch
log(`Watchdog started — polling every ${POLL_INTERVAL / 1000}s on branch "${BRANCH}"`);
startServer();

// Start polling loop
setInterval(poll, POLL_INTERVAL);
