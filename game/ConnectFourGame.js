'use strict';

const EMPTY = 0;
const PLAYER1 = 1; // Red
const PLAYER2 = 2; // Yellow
const ROWS = 6;
const COLS = 7;

class ConnectFourGame {
  constructor() {
    // 6 rows x 7 cols grid, 0=empty, 1=player1 (red), 2=player2 (yellow)
    // board[0] is the top row, board[5] is the bottom row
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    this.currentTurn = PLAYER1; // player 1 starts
    this.gameOver = false;
    this.winner = null;
    this.winLine = null; // [{row,col},...] for the 4 connected cells
    this.moveHistory = [];
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      board: this.board.map(row => [...row]),
      currentTurn: this.currentTurn,
      gameOver: this.gameOver,
      winner: this.winner,
      winLine: this.winLine ? this.winLine.map(c => ({ ...c })) : null,
      moveHistory: this.moveHistory.map(m => ({ ...m }))
    };
  }

  serialize() {
    return {
      board: this.board.map(row => [...row]),
      currentTurn: this.currentTurn,
      gameOver: this.gameOver,
      winner: this.winner,
      winLine: this.winLine,
      moveHistory: [...this.moveHistory]
    };
  }

  static deserialize(data) {
    const g = new ConnectFourGame();
    g.board = data.board;
    g.currentTurn = data.currentTurn;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.winLine = data.winLine;
    g.moveHistory = data.moveHistory || [];
    return g;
  }

  /**
   * Returns an array of valid column indices (columns that are not full).
   */
  getValidMoves() {
    if (this.gameOver) return [];
    const moves = [];
    for (let c = 0; c < COLS; c++) {
      // A column is playable if the top row cell is empty
      if (this.board[0][c] === EMPTY) {
        moves.push(c);
      }
    }
    return moves;
  }

  /**
   * Drop a disc into the given column.
   * Returns { valid, row, col, board, currentTurn, gameOver: { over, winner, reason, winLine } }
   */
  makeMove(col) {
    if (this.gameOver) return { valid: false };
    if (col < 0 || col >= COLS) return { valid: false };

    // Find the lowest available row in this column
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r][col] === EMPTY) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) return { valid: false }; // Column is full

    // Place the disc
    this.board[targetRow][col] = this.currentTurn;

    // Record the move
    this.moveHistory.push({ player: this.currentTurn, row: targetRow, col });

    // Check for game over
    const gameOverResult = this.checkGameOver();

    if (gameOverResult.over) {
      this.gameOver = true;
      this.winner = gameOverResult.winner;
      this.winLine = gameOverResult.winLine || null;
    }

    const result = {
      valid: true,
      row: targetRow,
      col,
      board: this.board.map(row => [...row]),
      currentTurn: this.currentTurn,
      gameOver: gameOverResult
    };

    // Switch turns (only if game is not over)
    if (!gameOverResult.over) {
      this.currentTurn = this.currentTurn === PLAYER1 ? PLAYER2 : PLAYER1;
    }

    // Update the currentTurn in the result to reflect the next player
    result.currentTurn = this.currentTurn;

    return result;
  }

  /**
   * Check the board for a win or draw.
   * Returns { over, winner, reason, winLine } or { over: false }
   */
  checkGameOver() {
    // Check all four directions for a 4-in-a-row
    const directions = [
      { dr: 0, dc: 1 },  // horizontal
      { dr: 1, dc: 0 },  // vertical
      { dr: 1, dc: 1 },  // diagonal down-right
      { dr: 1, dc: -1 }  // diagonal down-left
    ];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[r][c];
        if (cell === EMPTY) continue;

        for (const { dr, dc } of directions) {
          const line = this._checkLine(r, c, dr, dc, cell);
          if (line) {
            return {
              over: true,
              winner: cell,
              reason: 'Four in a row',
              winLine: line
            };
          }
        }
      }
    }

    // Check for draw (board full)
    let full = true;
    for (let c = 0; c < COLS; c++) {
      if (this.board[0][c] === EMPTY) {
        full = false;
        break;
      }
    }

    if (full) {
      return { over: true, winner: null, reason: 'Draw' };
    }

    return { over: false };
  }

  /* ---------- Internal helpers ---------- */

  /**
   * Check if there are 4 consecutive cells of the given player starting from
   * (row, col) in the direction (dr, dc).
   * Returns array of 4 {row, col} objects if found, null otherwise.
   */
  _checkLine(row, col, dr, dc, player) {
    const line = [];
    for (let i = 0; i < 4; i++) {
      const r = row + i * dr;
      const c = col + i * dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      if (this.board[r][c] !== player) return null;
      line.push({ row: r, col: c });
    }
    return line;
  }
}

// Export constants alongside the class
ConnectFourGame.EMPTY = EMPTY;
ConnectFourGame.PLAYER1 = PLAYER1;
ConnectFourGame.PLAYER2 = PLAYER2;
ConnectFourGame.ROWS = ROWS;
ConnectFourGame.COLS = COLS;

module.exports = ConnectFourGame;
