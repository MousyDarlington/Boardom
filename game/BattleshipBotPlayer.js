'use strict';

const BattleshipGame = require('./BattleshipGame');

const BOT_NAMES = ['Admiral', 'Captain', 'Commander', 'Ensign', 'Navigator', 'Helmsman', 'Sonar', 'Torpedo'];

class BattleshipBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `Bot ${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._timer = null;
    this._paused = false;

    // Skill: 0 = random shooting, 1 = hunt/target strategy
    this.skill = botRating >= 1200 ? 1 : 0;

    // Hunt/target AI state
    this._huntTargets = [];    // stack of cells to try next after a hit: [{row, col}]
    this._shotsFired = new Set(); // "row,col" strings for quick lookup
    this._lastHitDirection = null; // { dr, dc } when we get two hits in a line
    this._firstHit = null;    // { row, col } of the first hit in current hunt sequence

    // Mock socket (same pattern as TroubleBotPlayer)
    const self = this;
    this.socket = {
      id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      username: this.username,
      join() {},
      leave() {},
      emit(event, data) { self._onEvent(event, data); },
      on() {}
    };
    this.id = this.socket.id;
  }

  _onEvent(event, data) {
    if (this.destroyed || this._paused) return;

    if (event === 'bs:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;

      // Auto-place ships and mark ready
      this.matchmaker.bsAutoPlace(this.socket);
      this.matchmaker.bsSetReady(this.socket);

      // If it's our turn and game is in playing phase, start shooting
      if (data.phase === 'playing' && data.currentTurn === this.playerIndex) {
        this._scheduleShot();
      }
    } else if (event === 'bs:update') {
      // A shot was fired (could be ours or opponent's)
      if (data.shooter === this.playerIndex && data.hit !== undefined) {
        // Our shot result -- update hunt/target state
        this._processShotResult(data);
      }
      if (data.currentTurn === this.playerIndex && data.phase === 'playing') {
        this._scheduleShot();
      }
    } else if (event === 'bs:placed' || event === 'bs:ready') {
      // Ship placement / ready confirmation
      if (data.phase === 'playing' && data.currentTurn === this.playerIndex) {
        this._scheduleShot();
      }
    } else if (event === 'bs:over') {
      this.destroy();
    }
  }

  /**
   * Process the result of one of our shots for hunt/target AI.
   */
  _processShotResult(data) {
    if (this.skill < 1) return;

    const { row, col, hit, sunk } = data;

    if (hit) {
      if (sunk) {
        // Ship sunk -- clear hunt targets related to this sunk ship.
        // The simplest safe approach: clear all hunt targets and reset direction,
        // since the sunk ship might have been the one we were tracking.
        this._huntTargets = [];
        this._lastHitDirection = null;
        this._firstHit = null;
      } else {
        // Hit but not sunk -- add adjacent targets
        this._addHuntTargets(row, col);
      }
    }
    // Miss: do nothing special (already-tried cell is in _shotsFired)
  }

  /**
   * After a hit, add the 4 adjacent cells to the hunt target stack.
   * If we already have a first hit recorded, try to determine direction
   * and prioritize cells along that line.
   */
  _addHuntTargets(row, col) {
    const adjacents = [
      { row: row - 1, col: col },  // up
      { row: row + 1, col: col },  // down
      { row: row, col: col - 1 },  // left
      { row: row, col: col + 1 }   // right
    ];

    if (this._firstHit) {
      // We have a previous hit -- determine direction
      const dr = row - this._firstHit.row;
      const dc = col - this._firstHit.col;

      if (dr !== 0 && dc === 0) {
        // Vertical alignment -- prioritize continuing in that direction
        this._lastHitDirection = { dr: dr > 0 ? 1 : -1, dc: 0 };
        // Clear old adjacents and add only the two cells along this line
        this._huntTargets = this._huntTargets.filter(t =>
          t.col === col && t.col === this._firstHit.col
        );
        // Add the next cell in the direction we're going
        const nextForward = { row: row + this._lastHitDirection.dr, col: col };
        const nextBackward = { row: this._firstHit.row - this._lastHitDirection.dr, col: col };
        if (this._isValidTarget(nextForward.row, nextForward.col)) {
          this._huntTargets.push(nextForward);
        }
        if (this._isValidTarget(nextBackward.row, nextBackward.col)) {
          this._huntTargets.push(nextBackward);
        }
      } else if (dc !== 0 && dr === 0) {
        // Horizontal alignment
        this._lastHitDirection = { dr: 0, dc: dc > 0 ? 1 : -1 };
        this._huntTargets = this._huntTargets.filter(t =>
          t.row === row && t.row === this._firstHit.row
        );
        const nextForward = { row: row, col: col + this._lastHitDirection.dc };
        const nextBackward = { row: row, col: this._firstHit.col - this._lastHitDirection.dc };
        if (this._isValidTarget(nextForward.row, nextForward.col)) {
          this._huntTargets.push(nextForward);
        }
        if (this._isValidTarget(nextBackward.row, nextBackward.col)) {
          this._huntTargets.push(nextBackward);
        }
      } else {
        // Diagonal or same cell (shouldn't happen) -- just add all adjacents
        for (const adj of adjacents) {
          if (this._isValidTarget(adj.row, adj.col)) {
            this._huntTargets.push(adj);
          }
        }
      }
    } else {
      // First hit in a new hunt sequence
      this._firstHit = { row, col };
      for (const adj of adjacents) {
        if (this._isValidTarget(adj.row, adj.col)) {
          this._huntTargets.push(adj);
        }
      }
    }
  }

  /**
   * Check if a cell is a valid target (in bounds and not already shot).
   */
  _isValidTarget(row, col) {
    if (row < 0 || row >= BattleshipGame.GRID_SIZE || col < 0 || col >= BattleshipGame.GRID_SIZE) {
      return false;
    }
    return !this._shotsFired.has(`${row},${col}`);
  }

  /**
   * Think time in milliseconds (simulates "thinking").
   */
  _thinkMs() {
    return 600 + Math.random() * 1000;
  }

  /**
   * Schedule a shot after a brief think delay.
   */
  _scheduleShot() {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);

    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;

      const target = this._pickTarget();
      if (target) {
        this._shotsFired.add(`${target.row},${target.col}`);
        this.matchmaker.bsFireShot(this.socket, target.row, target.col);
      }
    }, this._thinkMs());
  }

  /**
   * Pick the next target cell.
   * Skill 0: purely random.
   * Skill 1: hunt/target -- use target stack if available, else random.
   */
  _pickTarget() {
    if (this.skill >= 1 && this._huntTargets.length > 0) {
      // Try targets from the stack (most recent first)
      while (this._huntTargets.length > 0) {
        const target = this._huntTargets.pop();
        if (this._isValidTarget(target.row, target.col)) {
          return target;
        }
      }
    }

    // Random shot -- use checkerboard pattern for efficiency (skill 1)
    return this._pickRandom();
  }

  /**
   * Pick a random unfired cell.
   * For skill >= 1, prefer checkerboard pattern (parity targeting) since the
   * smallest ship is size 2, every ship must occupy at least one cell where
   * (row + col) is even.
   */
  _pickRandom() {
    const candidates = [];
    const gridSize = BattleshipGame.GRID_SIZE;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (this._shotsFired.has(`${r},${c}`)) continue;
        if (this.skill >= 1) {
          // Checkerboard: only target cells where (r+c) % 2 === 0
          if ((r + c) % 2 === 0) {
            candidates.push({ row: r, col: c });
          }
        } else {
          candidates.push({ row: r, col: c });
        }
      }
    }

    // If checkerboard cells are exhausted, fall back to any remaining cell
    if (candidates.length === 0 && this.skill >= 1) {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (!this._shotsFired.has(`${r},${c}`)) {
            candidates.push({ row: r, col: c });
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = BattleshipBotPlayer;
