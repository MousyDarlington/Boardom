'use strict';

const fs = require('fs');
const path = require('path');

const GAMES_FILE = path.join(__dirname, '..', 'data', 'games.json');

function saveGames(snapshots) {
  try {
    fs.writeFileSync(GAMES_FILE, JSON.stringify(snapshots, null, 2));
    console.log(`Saved ${snapshots.length} active game(s)`);
  } catch (e) {
    console.error('Failed to save games:', e.message);
  }
}

function loadGames() {
  try {
    if (fs.existsSync(GAMES_FILE)) {
      const data = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf-8'));
      // Delete after loading to prevent stale re-reads on crash
      fs.unlinkSync(GAMES_FILE);
      console.log(`Loaded ${data.length} saved game(s)`);
      return data;
    }
  } catch (e) {
    console.error('Failed to load saved games:', e.message);
  }
  return [];
}

module.exports = { saveGames, loadGames };
