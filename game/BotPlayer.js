'use strict';

const CheckersGame = require('./CheckersGame');

const BOT_NAMES = [
  'AlphaCheck', 'DeepBoard', 'CheckerMind', 'KingForge',
  'BoardSage', 'JumpMaster', 'DiagBot', 'CrownSeeker',
  'PawnStorm', 'SquareLogic', 'IronKing', 'SwiftLeap'
];

class BotPlayer {
  /**
   * @param {object} matchmaker - Matchmaker instance (used to call makeMove)
   * @param {number} targetRating - Rating to calibrate bot difficulty
   * @param {string} [name] - Optional display name override
   */
  constructor(matchmaker, targetRating, name) {
    this.matchmaker = matchmaker;
    this.targetRating = targetRating;
    this.color = 0;
    this.gameId = null;
    this.active = true;
    this.moveTimer = null;

    // Identity
    const idx = Math.floor(Math.random() * BOT_NAMES.length);
    this.username = name || ('Bot ' + BOT_NAMES[idx]);
    this.id = 'bot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    // Skill tier: 0=random, 1=greedy, 2=eval, 3=minimax-3, 4=minimax-5
    this.skill = this._skillFromRating(targetRating);

    // Mock socket that the Matchmaker treats like a real player
    this.socket = this._buildSocket();
  }

  _buildSocket() {
    const self = this;
    return {
      id: self.id,
      username: self.username,
      join() {},
      leave() {},
      emit(event, data) { self._onEvent(event, data); },
      on() {}
    };
  }

  _skillFromRating(r) {
    if (r < 1000) return 0;
    if (r < 1300) return 1;
    if (r < 1600) return 2;
    if (r < 1900) return 3;
    return 4;
  }

  /* ====== Event handling (called via mock socket.emit) ====== */

  _onEvent(event, data) {
    if (!this.active || this._paused) return;
    switch (event) {
      case 'game:start':
        this.color = data.color;
        this.gameId = data.gameId;
        if (data.currentTurn === this.color) this._scheduleMove();
        break;
      case 'game:update':
        if (data.currentTurn === this.color) this._scheduleMove();
        break;
      case 'game:over':
        this.destroy();
        break;
    }
  }

  /* ====== Move scheduling ====== */

  _thinkMs() {
    // Stronger bots deliberate longer, weaker ones play fast
    const base = 600 + this.skill * 350;
    return base + Math.random() * 900;
  }

  _scheduleMove() {
    if (this.moveTimer) clearTimeout(this.moveTimer);
    this.moveTimer = setTimeout(() => this._executeTurn(), this._thinkMs());
  }

  _executeTurn() {
    if (!this.active) return;
    const gd = this.matchmaker.games.get(this.gameId);
    if (!gd) return;
    if (gd.game.currentTurn !== this.color) return;

    const move = this._chooseMove(gd.game);
    if (move) {
      this.matchmaker.makeMove(this.socket, move.fr, move.fc, move.tr, move.tc);
    }
  }

  destroy() {
    this.active = false;
    if (this.moveTimer) { clearTimeout(this.moveTimer); this.moveTimer = null; }
  }

  /* ====== Move selection by skill tier ====== */

  _chooseMove(game) {
    switch (this.skill) {
      case 0:  return this._pickRandom(game);
      case 1:  return this._pickGreedy(game);
      case 2:  return this._pickEvaluated(game);
      case 3:  return this._pickMinimax(game, 3);
      default: return this._pickMinimax(game, 5);
    }
  }

  /* --- Tier 0: pure random --- */
  _pickRandom(game) {
    const pieces = game.getAllMovablePieces();
    if (!pieces.length) return null;
    const p = pieces[Math.floor(Math.random() * pieces.length)];
    const moves = game.getValidMoves(p.row, p.col);
    if (!moves.length) return null;
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { fr: p.row, fc: p.col, tr: m.row, tc: m.col };
  }

  /* --- Tier 1: greedy (captures > kings > center) with noise --- */
  _pickGreedy(game) {
    const all = this._allMoves(game);
    if (!all.length) return null;
    let best = null, bestS = -Infinity;
    for (const { fr, fc, tr, tc, isJump } of all) {
      let s = 0;
      if (isJump) s += 10;
      // King promotion
      if (this.color === CheckersGame.RED && tr === 7) s += 8;
      if (this.color === CheckersGame.BLACK && tr === 0) s += 8;
      // Center preference
      s += (3.5 - Math.abs(tc - 3.5)) * 0.5;
      // Advance
      s += (this.color === CheckersGame.RED ? tr : 7 - tr) * 0.3;
      // Noise
      s += Math.random() * 4;
      if (s > bestS) { bestS = s; best = { fr, fc, tr, tc }; }
    }
    return best;
  }

  /* --- Tier 2: 1-ply evaluation --- */
  _pickEvaluated(game) {
    const all = this._allMoves(game);
    if (!all.length) return null;
    let best = null, bestS = -Infinity;
    for (const mv of all) {
      const clone = this._cloneGame(game);
      clone.makeMove(mv.fr, mv.fc, mv.tr, mv.tc);
      const s = this._evaluate(clone) + Math.random() * 0.5;
      if (s > bestS) { bestS = s; best = mv; }
    }
    return best;
  }

  /* --- Tier 3-4: minimax with alpha-beta --- */
  _pickMinimax(game, depth) {
    const all = this._allMoves(game);
    if (!all.length) return null;
    let best = null, bestS = -Infinity;
    for (const mv of all) {
      const clone = this._cloneGame(game);
      clone.makeMove(mv.fr, mv.fc, mv.tr, mv.tc);
      const isMax = clone.currentTurn === this.color; // continued jump = still maximizing
      const s = this._minimax(clone, depth - 1, -Infinity, Infinity, isMax);
      if (s > bestS) { bestS = s; best = mv; }
    }
    return best;
  }

  _minimax(game, depth, alpha, beta, maximizing) {
    const over = game.checkGameOver();
    if (over.over) return over.winner === this.color ? 1000 + depth : -1000 - depth;
    if (depth <= 0) return this._evaluate(game);

    const moves = this._allMoves(game);

    if (maximizing) {
      let val = -Infinity;
      for (const mv of moves) {
        const clone = this._cloneGame(game);
        clone.makeMove(mv.fr, mv.fc, mv.tr, mv.tc);
        const nextMax = clone.currentTurn === this.color;
        val = Math.max(val, this._minimax(clone, depth - 1, alpha, beta, nextMax));
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return val;
    } else {
      let val = Infinity;
      for (const mv of moves) {
        const clone = this._cloneGame(game);
        clone.makeMove(mv.fr, mv.fc, mv.tr, mv.tc);
        const nextMax = clone.currentTurn === this.color;
        val = Math.min(val, this._minimax(clone, depth - 1, alpha, beta, nextMax));
        beta = Math.min(beta, val);
        if (beta <= alpha) break;
      }
      return val;
    }
  }

  /* ====== Board evaluation (positive = good for bot) ====== */

  _evaluate(game) {
    let score = 0;
    const me = this.color;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = game.board[r][c];
        if (p === 0) continue;
        const mine = CheckersGame.belongsTo(p, me);
        const sign = mine ? 1 : -1;
        const king = CheckersGame.isKing(p);

        // Material (king worth 1.7x)
        score += sign * (king ? 1.7 : 1.0);

        // Center control
        score += sign * (3.5 - Math.abs(c - 3.5)) * 0.05;

        // Advancement (non-kings)
        if (!king) {
          const adv = mine
            ? (me === CheckersGame.RED ? r : 7 - r)
            : (me === CheckersGame.RED ? 7 - r : r);
          score += sign * adv * 0.04;
        }

        // Back-row defence bonus
        if (mine) {
          if ((me === CheckersGame.RED && r === 0) || (me === CheckersGame.BLACK && r === 7))
            score += 0.1;
        }
      }
    }
    return score;
  }

  /* ====== Utilities ====== */

  _allMoves(game) {
    const out = [];
    const pieces = game.getAllMovablePieces();
    for (const p of pieces) {
      for (const m of game.getValidMoves(p.row, p.col)) {
        out.push({ fr: p.row, fc: p.col, tr: m.row, tc: m.col, isJump: m.isJump });
      }
    }
    return out;
  }

  _cloneGame(game) {
    const c = new CheckersGame();
    c.board = game.board.map(r => [...r]);
    c.currentTurn = game.currentTurn;
    c.jumpingPiece = game.jumpingPiece ? { ...game.jumpingPiece } : null;
    c.redCount = game.redCount;
    c.blackCount = game.blackCount;
    return c;
  }
}

module.exports = BotPlayer;
