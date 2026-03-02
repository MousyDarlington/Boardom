'use strict';

const EMPTY = 0;
const RED = 1;
const BLACK = 2;
const RED_KING = 3;
const BLACK_KING = 4;

class CheckersGame {
  constructor() {
    this.board = [];
    this.currentTurn = RED;
    this.jumpingPiece = null;
    this.moveHistory = [];
    this.redCount = 12;
    this.blackCount = 12;
    this._init();
  }

  _init() {
    this.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) {
          if (r < 3) this.board[r][c] = RED;
          else if (r > 4) this.board[r][c] = BLACK;
        }
      }
    }
  }

  static isRed(p) { return p === RED || p === RED_KING; }
  static isBlack(p) { return p === BLACK || p === BLACK_KING; }
  static isKing(p) { return p === RED_KING || p === BLACK_KING; }

  static belongsTo(piece, player) {
    if (player === RED) return piece === RED || piece === RED_KING;
    if (player === BLACK) return piece === BLACK || piece === BLACK_KING;
    return false;
  }

  static isOpponent(piece, player) {
    if (player === RED) return piece === BLACK || piece === BLACK_KING;
    if (player === BLACK) return piece === RED || piece === RED_KING;
    return false;
  }

  static moveDirs(piece) {
    switch (piece) {
      case RED: return [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
      case BLACK: return [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }];
      case RED_KING:
      case BLACK_KING:
        return [
          { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
          { dr: -1, dc: -1 }, { dr: -1, dc: 1 }
        ];
      default: return [];
    }
  }

  _inBounds(r, c) {
    return r >= 0 && r <= 7 && c >= 0 && c <= 7;
  }

  /* ---- Jump / simple move detection ---- */

  _getJumps(r, c) {
    const piece = this.board[r][c];
    const player = CheckersGame.belongsTo(piece, RED) ? RED : BLACK;
    const dirs = CheckersGame.moveDirs(piece);
    const jumps = [];
    for (const { dr, dc } of dirs) {
      const mr = r + dr, mc = c + dc;
      const er = r + 2 * dr, ec = c + 2 * dc;
      if (this._inBounds(er, ec)
        && CheckersGame.isOpponent(this.board[mr][mc], player)
        && this.board[er][ec] === EMPTY) {
        jumps.push({ toRow: er, toCol: ec, capRow: mr, capCol: mc });
      }
    }
    return jumps;
  }

  _getSimpleMoves(r, c) {
    const piece = this.board[r][c];
    const dirs = CheckersGame.moveDirs(piece);
    const moves = [];
    for (const { dr, dc } of dirs) {
      const nr = r + dr, nc = c + dc;
      if (this._inBounds(nr, nc) && this.board[nr][nc] === EMPTY) {
        moves.push({ toRow: nr, toCol: nc });
      }
    }
    return moves;
  }

  _playerHasJumps(player) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (CheckersGame.belongsTo(this.board[r][c], player)
          && this._getJumps(r, c).length > 0)
          return true;
    return false;
  }

  /* ---- Public API ---- */

  getValidMoves(r, c) {
    const piece = this.board[r][c];
    if (piece === EMPTY) return [];
    const player = CheckersGame.belongsTo(piece, RED) ? RED : BLACK;
    if (player !== this.currentTurn) return [];

    // Multi-jump: only the jumping piece may move
    if (this.jumpingPiece) {
      if (this.jumpingPiece.row !== r || this.jumpingPiece.col !== c) return [];
      return this._getJumps(r, c).map(j => ({ row: j.toRow, col: j.toCol, isJump: true }));
    }

    // Mandatory capture
    if (this._playerHasJumps(player)) {
      const jumps = this._getJumps(r, c);
      return jumps.map(j => ({ row: j.toRow, col: j.toCol, isJump: true }));
    }

    return this._getSimpleMoves(r, c).map(m => ({ row: m.toRow, col: m.toCol, isJump: false }));
  }

  getAllMovablePieces() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.getValidMoves(r, c).length > 0) {
          pieces.push({ row: r, col: c });
        }
      }
    }
    return pieces;
  }

  makeMove(fr, fc, tr, tc) {
    const valid = this.getValidMoves(fr, fc);
    const move = valid.find(m => m.row === tr && m.col === tc);
    if (!move) return { valid: false };

    const piece = this.board[fr][fc];
    const player = CheckersGame.belongsTo(piece, RED) ? RED : BLACK;

    // Move piece
    this.board[tr][tc] = piece;
    this.board[fr][fc] = EMPTY;

    // Capture
    let captured = null;
    if (move.isJump) {
      const cr = (fr + tr) / 2, cc = (fc + tc) / 2;
      captured = { row: cr, col: cc, piece: this.board[cr][cc] };
      this.board[cr][cc] = EMPTY;
      if (CheckersGame.isRed(captured.piece)) this.redCount--;
      else this.blackCount--;
    }

    // Promotion
    let promoted = false;
    if (player === RED && tr === 7 && !CheckersGame.isKing(piece)) {
      this.board[tr][tc] = RED_KING;
      promoted = true;
    } else if (player === BLACK && tr === 0 && !CheckersGame.isKing(piece)) {
      this.board[tr][tc] = BLACK_KING;
      promoted = true;
    }

    // Multi-jump check (promotion ends the turn in American checkers)
    let continuedJump = false;
    if (move.isJump && !promoted) {
      const moreJumps = this._getJumps(tr, tc);
      if (moreJumps.length > 0) {
        this.jumpingPiece = { row: tr, col: tc };
        continuedJump = true;
      }
    }

    if (!continuedJump) {
      this.jumpingPiece = null;
      this.currentTurn = this.currentTurn === RED ? BLACK : RED;
    }

    const record = {
      from: { row: fr, col: fc },
      to: { row: tr, col: tc },
      captured,
      promoted,
      continuedJump
    };
    this.moveHistory.push(record);

    return {
      valid: true,
      ...record,
      board: this.board.map(row => [...row]),
      currentTurn: this.currentTurn,
      jumpingPiece: this.jumpingPiece ? { ...this.jumpingPiece } : null,
      gameOver: this.checkGameOver(),
      redCount: this.redCount,
      blackCount: this.blackCount
    };
  }

  checkGameOver() {
    if (this.redCount === 0) return { over: true, winner: BLACK, reason: 'All pieces captured' };
    if (this.blackCount === 0) return { over: true, winner: RED, reason: 'All pieces captured' };

    // Check if current player has any moves
    let hasMoves = false;
    outer:
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (CheckersGame.belongsTo(this.board[r][c], this.currentTurn)) {
          if (this.getValidMoves(r, c).length > 0) { hasMoves = true; break outer; }
        }
      }
    }
    if (!hasMoves) {
      return { over: true, winner: this.currentTurn === RED ? BLACK : RED, reason: 'No valid moves' };
    }
    return { over: false };
  }

  getState() {
    return {
      board: this.board.map(row => [...row]),
      currentTurn: this.currentTurn,
      jumpingPiece: this.jumpingPiece ? { ...this.jumpingPiece } : null,
      redCount: this.redCount,
      blackCount: this.blackCount
    };
  }

  serialize() {
    return {
      board: this.board.map(row => [...row]),
      currentTurn: this.currentTurn,
      jumpingPiece: this.jumpingPiece ? { ...this.jumpingPiece } : null,
      moveHistory: [...this.moveHistory],
      redCount: this.redCount,
      blackCount: this.blackCount
    };
  }

  static deserialize(data) {
    const g = new CheckersGame();
    g.board = data.board;
    g.currentTurn = data.currentTurn;
    g.jumpingPiece = data.jumpingPiece;
    g.moveHistory = data.moveHistory || [];
    g.redCount = data.redCount;
    g.blackCount = data.blackCount;
    return g;
  }
}

// Export constants alongside the class
CheckersGame.EMPTY = EMPTY;
CheckersGame.RED = RED;
CheckersGame.BLACK = BLACK;
CheckersGame.RED_KING = RED_KING;
CheckersGame.BLACK_KING = BLACK_KING;

module.exports = CheckersGame;
