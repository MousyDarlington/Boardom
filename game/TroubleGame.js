'use strict';

/**
 * TroubleGame — Pure state machine for Trouble (Frustration) board game.
 *
 * Board layout:
 *   28-space main track (positions 0-27), clockwise square loop.
 *   4 players, each with 4 tokens.
 *   Token positions: -1 = home, 0-27 = on track, 100-103 = finish lane slots.
 *   Entry points: Player 0→pos 0, Player 1→pos 7, Player 2→pos 14, Player 3→pos 21.
 *   Finish lane: entered just before your own entry point after a full lap.
 */

const TRACK_SIZE = 28;
const TOKENS_PER_PLAYER = 4;
const HOME = -1;
const FINISH_BASE = 100; // finish lane positions: 100, 101, 102, 103
const FINISH_SLOTS = 4;

const ENTRY_POINTS = [0, 7, 14, 21]; // where each player enters the track

class TroubleGame {
  constructor(playerCount) {
    this.playerCount = Math.max(2, Math.min(4, playerCount || 4));
    this.currentTurn = 0;
    this.diceResult = null;
    this.phase = 'roll'; // 'roll' or 'move'
    this.gameOver = false;
    this.winner = null;
    this.placements = []; // ordered list of player indices as they finish all 4 tokens

    // tokens[player][tokenIdx] = position
    this.tokens = [];
    for (let p = 0; p < this.playerCount; p++) {
      this.tokens.push([HOME, HOME, HOME, HOME]);
    }

    // Count of tokens that reached final finish for each player
    this.finished = new Array(this.playerCount).fill(0);
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      playerCount: this.playerCount,
      currentTurn: this.currentTurn,
      tokens: this.tokens.map(t => [...t]),
      finished: [...this.finished],
      diceResult: this.diceResult,
      phase: this.phase,
      gameOver: this.gameOver,
      winner: this.winner,
      placements: [...this.placements]
    };
  }

  serialize() {
    return {
      playerCount: this.playerCount,
      currentTurn: this.currentTurn,
      diceResult: this.diceResult,
      phase: this.phase,
      gameOver: this.gameOver,
      winner: this.winner,
      placements: [...this.placements],
      tokens: this.tokens.map(t => [...t]),
      finished: [...this.finished]
    };
  }

  static deserialize(data) {
    const g = new TroubleGame(data.playerCount);
    g.currentTurn = data.currentTurn;
    g.diceResult = data.diceResult;
    g.phase = data.phase;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.placements = data.placements || [];
    g.tokens = data.tokens;
    g.finished = data.finished;
    return g;
  }

  rollDice() {
    if (this.phase !== 'roll' || this.gameOver) return { valid: false };

    this.diceResult = Math.floor(Math.random() * 6) + 1;
    const validMoves = this.getValidMoves();

    if (validMoves.length === 0) {
      // No valid moves — pass turn
      const extraTurn = false;
      this._nextTurn();
      return {
        valid: true,
        diceResult: this.diceResult,
        validMoves: [],
        skipped: true,
        currentTurn: this.currentTurn,
        phase: this.phase
      };
    }

    this.phase = 'move';
    return {
      valid: true,
      diceResult: this.diceResult,
      validMoves,
      skipped: false,
      currentTurn: this.currentTurn,
      phase: this.phase
    };
  }

  getValidMoves() {
    if (this.diceResult == null || this.gameOver) return [];

    const player = this.currentTurn;
    const moves = [];

    for (let ti = 0; ti < TOKENS_PER_PLAYER; ti++) {
      const pos = this.tokens[player][ti];

      if (pos === HOME) {
        // Can only leave home on a 6
        if (this.diceResult === 6) {
          const entry = ENTRY_POINTS[player];
          // Check entry isn't blocked by own token
          if (!this._ownTokenAt(player, entry)) {
            moves.push({ tokenIdx: ti, destType: 'enter' });
          }
        }
      } else if (pos >= FINISH_BASE) {
        // In finish lane — advance within finish
        const finishSlot = pos - FINISH_BASE;
        const newSlot = finishSlot + this.diceResult;
        if (newSlot < FINISH_SLOTS) {
          const newPos = FINISH_BASE + newSlot;
          if (!this._ownTokenAtFinish(player, newPos)) {
            moves.push({ tokenIdx: ti, destType: 'finish_advance' });
          }
        } else if (newSlot === FINISH_SLOTS) {
          // Exact landing on final slot = finished!
          moves.push({ tokenIdx: ti, destType: 'finish_complete' });
        }
        // Overshoot: can't move
      } else {
        // On main track — move forward
        const dest = this._calcDestination(player, pos, this.diceResult);
        if (dest !== null) {
          if (dest.type === 'track') {
            if (!this._ownTokenAt(player, dest.pos)) {
              moves.push({ tokenIdx: ti, destType: 'track', destPos: dest.pos });
            }
          } else if (dest.type === 'finish') {
            if (!this._ownTokenAtFinish(player, dest.pos)) {
              moves.push({ tokenIdx: ti, destType: dest.pos === FINISH_BASE + FINISH_SLOTS ? 'finish_complete' : 'finish_enter' });
            }
          }
        }
      }
    }

    return moves;
  }

  makeMove(tokenIdx) {
    if (this.phase !== 'move' || this.gameOver) return { valid: false };
    if (tokenIdx < 0 || tokenIdx >= TOKENS_PER_PLAYER) return { valid: false };

    const player = this.currentTurn;
    const pos = this.tokens[player][tokenIdx];
    const validMoves = this.getValidMoves();
    const move = validMoves.find(m => m.tokenIdx === tokenIdx);
    if (!move) return { valid: false };

    let fromPos = pos;
    let toPos;
    let captured = null;
    let finishedToken = false;

    if (move.destType === 'enter') {
      // Move from home to entry point
      toPos = ENTRY_POINTS[player];
      this.tokens[player][tokenIdx] = toPos;
      captured = this._checkCapture(player, toPos);
    } else if (move.destType === 'track') {
      toPos = move.destPos;
      this.tokens[player][tokenIdx] = toPos;
      captured = this._checkCapture(player, toPos);
    } else if (move.destType === 'finish_enter') {
      const dest = this._calcDestination(player, pos, this.diceResult);
      toPos = dest.pos;
      this.tokens[player][tokenIdx] = toPos;
    } else if (move.destType === 'finish_advance') {
      const finishSlot = pos - FINISH_BASE;
      toPos = FINISH_BASE + finishSlot + this.diceResult;
      this.tokens[player][tokenIdx] = toPos;
    } else if (move.destType === 'finish_complete') {
      toPos = FINISH_BASE + FINISH_SLOTS; // sentinel for "completed"
      this.tokens[player][tokenIdx] = toPos;
      this.finished[player]++;
      finishedToken = true;
    }

    // Check if this player just completed all tokens
    let placed = false;
    const allDone = this.finished[player] >= TOKENS_PER_PLAYER;
    if (allDone && !this.placements.includes(player)) {
      this.placements.push(player);
      placed = true;
      if (!this.winner) this.winner = player; // first to finish = winner
    }

    // Game over when only 1 player hasn't finished (they get last place)
    const unfinishedCount = this.playerCount - this.placements.length;
    if (unfinishedCount <= 1) {
      // Add the remaining player as last place
      for (let p = 0; p < this.playerCount; p++) {
        if (!this.placements.includes(p)) {
          this.placements.push(p);
          break;
        }
      }
      this.gameOver = true;
    }

    // Determine extra turn (rolled 6 and player still has tokens to play)
    const extraTurn = this.diceResult === 6 && !allDone && !this.gameOver;

    // Advance turn
    this.diceResult = null;
    this.phase = 'roll';
    if (!extraTurn && !this.gameOver) {
      this._nextTurn();
    }

    return {
      valid: true,
      player,
      tokenIdx,
      fromPos,
      toPos,
      captured,
      finishedToken,
      extraTurn,
      placed, // true if this player just earned a placement
      placement: placed ? this.placements.length : null, // 1st, 2nd, 3rd...
      gameOver: this.gameOver ? { over: true, winner: this.winner, placements: [...this.placements] } : { over: false },
      state: this.getState()
    };
  }

  /* ---------- Internal helpers ---------- */

  _nextTurn() {
    let next = (this.currentTurn + 1) % this.playerCount;
    // Skip eliminated players (all tokens can't be eliminated in Trouble, but in case)
    let safety = 0;
    while (safety < this.playerCount) {
      if (this.finished[next] < TOKENS_PER_PLAYER) break;
      next = (next + 1) % this.playerCount;
      safety++;
    }
    this.currentTurn = next;
    this.phase = 'roll';
    this.diceResult = null;
  }

  /**
   * Calculate where a token on the main track lands after moving `steps` spaces.
   * Returns { type: 'track'|'finish', pos } or null if overshoot.
   */
  _calcDestination(player, currentTrackPos, steps) {
    const entry = ENTRY_POINTS[player];
    // The finish entry point is one position before the player's entry (after full lap)
    const finishEntry = (entry + TRACK_SIZE - 1) % TRACK_SIZE;

    // Count steps, checking if we pass the finish entry
    let pos = currentTrackPos;
    for (let s = 0; s < steps; s++) {
      if (pos === finishEntry) {
        // Enter finish lane — remaining steps go into finish
        const remaining = steps - s - 1;
        if (remaining < FINISH_SLOTS) {
          return { type: 'finish', pos: FINISH_BASE + remaining };
        } else if (remaining === FINISH_SLOTS) {
          return { type: 'finish', pos: FINISH_BASE + FINISH_SLOTS }; // complete
        }
        return null; // overshoot
      }
      pos = (pos + 1) % TRACK_SIZE;
    }
    return { type: 'track', pos };
  }

  /** Check if any of player's own tokens are at this track position */
  _ownTokenAt(player, trackPos) {
    return this.tokens[player].some(p => p === trackPos);
  }

  /** Check if any of player's own tokens are at this finish position */
  _ownTokenAtFinish(player, finishPos) {
    return this.tokens[player].some(p => p === finishPos);
  }

  /** If an opponent token is at this track position, send it home. Returns capture info or null. */
  _checkCapture(movingPlayer, trackPos) {
    for (let p = 0; p < this.playerCount; p++) {
      if (p === movingPlayer) continue;
      for (let ti = 0; ti < TOKENS_PER_PLAYER; ti++) {
        if (this.tokens[p][ti] === trackPos) {
          this.tokens[p][ti] = HOME;
          return { player: p, tokenIdx: ti };
        }
      }
    }
    return null;
  }
}

// Static constants
TroubleGame.TRACK_SIZE = TRACK_SIZE;
TroubleGame.TOKENS_PER_PLAYER = TOKENS_PER_PLAYER;
TroubleGame.HOME = HOME;
TroubleGame.FINISH_BASE = FINISH_BASE;
TroubleGame.FINISH_SLOTS = FINISH_SLOTS;
TroubleGame.ENTRY_POINTS = ENTRY_POINTS;
TroubleGame.PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'];

module.exports = TroubleGame;
