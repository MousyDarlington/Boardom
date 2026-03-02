'use strict';

/**
 * MancalaGame -- Pure state machine for Mancala (Kalah variant).
 *
 * Board layout:
 *   14 positions total.
 *   Indices 0-5:  Player 0's pits (left to right from P0's perspective)
 *   Index 6:      Player 0's store (mancala)
 *   Indices 7-12: Player 1's pits (left to right from P1's perspective)
 *   Index 13:     Player 1's store (mancala)
 *
 * Sowing is counter-clockwise: 0->1->2->3->4->5->6->7->8->9->10->11->12->13->0->...
 * Each player skips the opponent's store when sowing.
 *
 * Opposite pit mapping (for captures):
 *   Pit 0 <-> Pit 12
 *   Pit 1 <-> Pit 11
 *   Pit 2 <-> Pit 10
 *   Pit 3 <-> Pit 9
 *   Pit 4 <-> Pit 8
 *   Pit 5 <-> Pit 7
 */

const PITS_PER_SIDE = 6;
const STORE_P0 = 6;
const STORE_P1 = 13;
const INITIAL_STONES = 4;
const TOTAL_PITS = 14;

// Opposite pit: pit i <-> pit (12 - i) for pits 0-5 and 7-12
const OPPOSITE = [];
for (let i = 0; i < PITS_PER_SIDE; i++) {
  OPPOSITE[i] = 12 - i;
  OPPOSITE[12 - i] = i;
}

class MancalaGame {
  constructor() {
    // 14 positions: pits[0-5]=P0 pits, pits[6]=P0 store, pits[7-12]=P1 pits, pits[13]=P1 store
    this.pits = new Array(TOTAL_PITS).fill(INITIAL_STONES);
    this.pits[STORE_P0] = 0;
    this.pits[STORE_P1] = 0;
    this.currentTurn = 0; // 0 or 1
    this.gameOver = false;
    this.winner = null; // 0, 1, or 'draw'
    this.moveHistory = [];
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      pits: [...this.pits],
      currentTurn: this.currentTurn,
      gameOver: this.gameOver,
      winner: this.winner,
      scores: this._getScores(),
      moveHistory: this.moveHistory.map(m => ({ ...m }))
    };
  }

  serialize() {
    return {
      pits: [...this.pits],
      currentTurn: this.currentTurn,
      gameOver: this.gameOver,
      winner: this.winner,
      moveHistory: [...this.moveHistory]
    };
  }

  static deserialize(data) {
    const g = new MancalaGame();
    g.pits = data.pits;
    g.currentTurn = data.currentTurn;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.moveHistory = data.moveHistory || [];
    return g;
  }

  /**
   * Returns array of valid pit indices for the current player.
   * Player 0 can choose from pits 0-5 (those with stones > 0).
   * Player 1 can choose from pits 7-12 (those with stones > 0).
   */
  getValidMoves() {
    if (this.gameOver) return [];

    const start = this.currentTurn === 0 ? 0 : 7;
    const end = start + PITS_PER_SIDE;
    const moves = [];

    for (let i = start; i < end; i++) {
      if (this.pits[i] > 0) {
        moves.push(i);
      }
    }

    return moves;
  }

  /**
   * Make a move by picking a pit index.
   * Player 0 picks from 0-5, Player 1 picks from 7-12.
   *
   * Returns an object describing the result:
   * {
   *   valid: boolean,
   *   pitIdx: number,          -- the pit that was picked
   *   stoneCount: number,      -- how many stones were sown
   *   endIdx: number,          -- where the last stone landed
   *   extraTurn: boolean,      -- whether the current player gets another turn
   *   captured: number,        -- number of stones captured (0 if none)
   *   capturedFrom: number,    -- opponent pit index captured from (-1 if none)
   *   scores: [number, number],
   *   gameOver: { over: boolean, winner: number|string|null, reason: string|null }
   * }
   */
  makeMove(pitIdx) {
    if (this.gameOver) {
      return { valid: false, reason: 'Game is already over.' };
    }

    const player = this.currentTurn;

    // Validate the pit belongs to the current player
    const playerStart = player === 0 ? 0 : 7;
    const playerEnd = playerStart + PITS_PER_SIDE;
    if (pitIdx < playerStart || pitIdx >= playerEnd) {
      return { valid: false, reason: 'Not your pit.' };
    }

    // Validate the pit has stones
    if (this.pits[pitIdx] === 0) {
      return { valid: false, reason: 'Pit is empty.' };
    }

    const opponentStore = player === 0 ? STORE_P1 : STORE_P0;
    const ownStore = player === 0 ? STORE_P0 : STORE_P1;

    // Pick up all stones from the chosen pit
    let stones = this.pits[pitIdx];
    const stoneCount = stones;
    this.pits[pitIdx] = 0;

    // Sow stones counter-clockwise, skipping opponent's store
    let idx = pitIdx;
    while (stones > 0) {
      idx = (idx + 1) % TOTAL_PITS;
      // Skip opponent's store
      if (idx === opponentStore) continue;
      this.pits[idx]++;
      stones--;
    }

    const endIdx = idx;
    let extraTurn = false;
    let captured = 0;
    let capturedFrom = -1;

    // Check extra turn: last stone landed in own store
    if (endIdx === ownStore) {
      extraTurn = true;
    }

    // Check capture: last stone landed in an empty pit on the current player's side
    // (the pit was empty before we placed this stone, so it now has exactly 1 stone)
    if (!extraTurn && this.pits[endIdx] === 1) {
      const isOwnSide = (player === 0 && endIdx >= 0 && endIdx < PITS_PER_SIDE) ||
                         (player === 1 && endIdx >= 7 && endIdx < 13);
      if (isOwnSide) {
        const oppositePit = OPPOSITE[endIdx];
        if (oppositePit !== undefined && this.pits[oppositePit] > 0) {
          // Capture: move the stone in endIdx AND all stones in the opposite pit to own store
          captured = this.pits[oppositePit] + 1; // opposite stones + the landing stone
          capturedFrom = oppositePit;
          this.pits[ownStore] += captured;
          this.pits[endIdx] = 0;
          this.pits[oppositePit] = 0;
        }
      }
    }

    // Record the move
    this.moveHistory.push({
      player,
      pitIdx,
      stoneCount,
      endIdx,
      extraTurn,
      captured,
      capturedFrom
    });

    // Check if the game is over
    const gameOverResult = this._checkGameOver();

    // Advance turn (unless extra turn or game over)
    if (!extraTurn && !gameOverResult.over) {
      this.currentTurn = 1 - this.currentTurn;
    }

    return {
      valid: true,
      pitIdx,
      stoneCount,
      endIdx,
      extraTurn,
      captured,
      capturedFrom,
      scores: this._getScores(),
      gameOver: gameOverResult,
      state: this.getState()
    };
  }

  /**
   * Check if the game is over (one side has all pits empty).
   * If so, sweep remaining stones to the appropriate store and determine the winner.
   */
  _checkGameOver() {
    const p0Empty = this._sideEmpty(0);
    const p1Empty = this._sideEmpty(1);

    if (!p0Empty && !p1Empty) {
      return { over: false, winner: null, reason: null };
    }

    // Sweep remaining stones to the owner's store
    for (let i = 0; i < PITS_PER_SIDE; i++) {
      this.pits[STORE_P0] += this.pits[i];
      this.pits[i] = 0;
    }
    for (let i = 7; i < 7 + PITS_PER_SIDE; i++) {
      this.pits[STORE_P1] += this.pits[i];
      this.pits[i] = 0;
    }

    this.gameOver = true;

    const scores = this._getScores();
    let reason;
    if (p0Empty) {
      reason = 'Player 0 side empty';
    } else {
      reason = 'Player 1 side empty';
    }

    if (scores[0] > scores[1]) {
      this.winner = 0;
    } else if (scores[1] > scores[0]) {
      this.winner = 1;
    } else {
      this.winner = 'draw';
    }

    return { over: true, winner: this.winner, reason, scores };
  }

  /**
   * Check if all pits on the given player's side are empty.
   */
  _sideEmpty(player) {
    const start = player === 0 ? 0 : 7;
    for (let i = start; i < start + PITS_PER_SIDE; i++) {
      if (this.pits[i] > 0) return false;
    }
    return true;
  }

  _getScores() {
    return [this.pits[STORE_P0], this.pits[STORE_P1]];
  }
}

// Static constants
MancalaGame.PITS_PER_SIDE = PITS_PER_SIDE;
MancalaGame.STORE_P0 = STORE_P0;
MancalaGame.STORE_P1 = STORE_P1;
MancalaGame.INITIAL_STONES = INITIAL_STONES;
MancalaGame.TOTAL_PITS = TOTAL_PITS;
MancalaGame.OPPOSITE = OPPOSITE;

module.exports = MancalaGame;
