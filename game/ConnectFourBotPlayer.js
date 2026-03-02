'use strict';

const ConnectFourGame = require('./ConnectFourGame');

const BOT_NAMES = [
  'DropMaster', 'FourSight', 'GridBot', 'ConnectAI',
  'ColumnKing', 'DiscDrop', 'StackBot', 'FourWin'
];

class ConnectFourBotPlayer {
  /**
   * @param {object} matchmaker - Matchmaker instance (used to call c4MakeMove)
   * @param {number} botRating - Rating to calibrate bot difficulty
   * @param {string} [name] - Optional display name override
   */
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || 'Bot ' + BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._timer = null;
    this._paused = false;

    // Skill: 0=random, 1=heuristic, 2=minimax
    this.skill = botRating >= 1600 ? 2 : (botRating >= 1200 ? 1 : 0);

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

  /* ====== Event handling (called via mock socket.emit) ====== */

  _onEvent(event, data) {
    if (this.destroyed || this._paused) return;

    if (event === 'c4:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.currentTurn === this.playerIndex) this._scheduleMove();
    } else if (event === 'c4:update') {
      if (data.currentTurn === this.playerIndex) this._scheduleMove();
    } else if (event === 'c4:over') {
      this.destroy();
    }
  }

  /* ====== Move scheduling ====== */

  _thinkMs() {
    return 600 + Math.random() * 1000;
  }

  _scheduleMove() {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executeTurn();
    }, this._thinkMs());
  }

  _executeTurn() {
    if (this.destroyed) return;
    const gd = this.matchmaker.games.get(this.gameId);
    if (!gd) return;

    const game = gd.c4Game;
    if (!game) return;
    if (game.gameOver) return;

    // Determine which player constant corresponds to our playerIndex
    // playerIndex 0 = PLAYER1 (1), playerIndex 1 = PLAYER2 (2)
    const ourPlayer = this.playerIndex === 0 ? ConnectFourGame.PLAYER1 : ConnectFourGame.PLAYER2;
    if (game.currentTurn !== ourPlayer) return;

    let col;
    switch (this.skill) {
      case 0:  col = this._pickRandom(game); break;
      case 1:  col = this._pickHeuristic(game); break;
      case 2:  col = this._pickMinimax(game, 5); break;
      default: col = this._pickRandom(game); break;
    }

    if (col !== null && col !== undefined) {
      this.matchmaker.c4MakeMove(this.socket, col);
    }
  }

  /* ====== Skill 0: Random valid column ====== */

  _pickRandom(game) {
    const moves = game.getValidMoves();
    if (!moves.length) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /* ====== Skill 1: Heuristic (block wins, take wins, prefer center) ====== */

  _pickHeuristic(game) {
    const moves = game.getValidMoves();
    if (!moves.length) return null;

    const ourPlayer = this.playerIndex === 0 ? ConnectFourGame.PLAYER1 : ConnectFourGame.PLAYER2;
    const oppPlayer = ourPlayer === ConnectFourGame.PLAYER1 ? ConnectFourGame.PLAYER2 : ConnectFourGame.PLAYER1;

    // 1. Check if we can win immediately
    for (const col of moves) {
      const clone = this._cloneGame(game);
      clone.currentTurn = ourPlayer;
      const result = clone.makeMove(col);
      if (result.valid && result.gameOver.over && result.gameOver.winner === ourPlayer) {
        return col;
      }
    }

    // 2. Block opponent's winning move
    for (const col of moves) {
      const clone = this._cloneGame(game);
      clone.currentTurn = oppPlayer;
      const result = clone.makeMove(col);
      if (result.valid && result.gameOver.over && result.gameOver.winner === oppPlayer) {
        return col;
      }
    }

    // 3. Avoid moves that give opponent a win on the next turn
    const safeMoves = [];
    for (const col of moves) {
      const clone = this._cloneGame(game);
      clone.currentTurn = ourPlayer;
      clone.makeMove(col);
      let givesWin = false;
      const oppMoves = clone.getValidMoves();
      for (const oc of oppMoves) {
        const clone2 = this._cloneGame(clone);
        const result2 = clone2.makeMove(oc);
        if (result2.valid && result2.gameOver.over && result2.gameOver.winner === oppPlayer) {
          givesWin = true;
          break;
        }
      }
      if (!givesWin) safeMoves.push(col);
    }

    const candidates = safeMoves.length > 0 ? safeMoves : moves;

    // 4. Score remaining candidates by threats and center preference
    let bestCol = candidates[0];
    let bestScore = -Infinity;

    for (const col of candidates) {
      let score = 0;

      // Center preference: columns closer to center are better
      score += (3 - Math.abs(col - 3)) * 2;

      // Count how many threats this move creates (2-in-a-row, 3-in-a-row with open ends)
      const clone = this._cloneGame(game);
      clone.currentTurn = ourPlayer;
      clone.makeMove(col);
      score += this._countThreats(clone, ourPlayer) * 1.5;
      score -= this._countThreats(clone, oppPlayer) * 1.0;

      // Small random noise to break ties
      score += Math.random() * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    return bestCol;
  }

  /**
   * Count the number of "threat" lines for a player:
   * lines of 3 with an open cell that would complete 4-in-a-row.
   */
  _countThreats(game, player) {
    let threats = 0;
    const directions = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 }
    ];

    for (let r = 0; r < ConnectFourGame.ROWS; r++) {
      for (let c = 0; c < ConnectFourGame.COLS; c++) {
        for (const { dr, dc } of directions) {
          let count = 0;
          let empty = 0;
          for (let i = 0; i < 4; i++) {
            const nr = r + i * dr;
            const nc = c + i * dc;
            if (nr < 0 || nr >= ConnectFourGame.ROWS || nc < 0 || nc >= ConnectFourGame.COLS) {
              count = -1; break;
            }
            if (game.board[nr][nc] === player) count++;
            else if (game.board[nr][nc] === ConnectFourGame.EMPTY) empty++;
            else { count = -1; break; }
          }
          if (count === 3 && empty === 1) threats++;
        }
      }
    }

    return threats;
  }

  /* ====== Skill 2: Minimax with alpha-beta pruning ====== */

  _pickMinimax(game, depth) {
    const moves = game.getValidMoves();
    if (!moves.length) return null;

    const ourPlayer = this.playerIndex === 0 ? ConnectFourGame.PLAYER1 : ConnectFourGame.PLAYER2;

    // Order moves: center columns first for better pruning
    const ordered = moves.slice().sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));

    let bestCol = ordered[0];
    let bestScore = -Infinity;

    for (const col of ordered) {
      const clone = this._cloneGame(game);
      clone.makeMove(col);
      const score = this._minimax(clone, depth - 1, -Infinity, Infinity, false, ourPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    return bestCol;
  }

  _minimax(game, depth, alpha, beta, maximizing, botPlayer) {
    const over = game.checkGameOver();
    if (over.over) {
      if (over.winner === botPlayer) return 100000 + depth;
      if (over.winner === null) return 0; // Draw
      return -100000 - depth;
    }
    if (depth <= 0) return this._evaluate(game, botPlayer);

    const moves = game.getValidMoves();
    // Order moves: center first
    const ordered = moves.slice().sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));

    if (maximizing) {
      let val = -Infinity;
      for (const col of ordered) {
        const clone = this._cloneGame(game);
        clone.makeMove(col);
        val = Math.max(val, this._minimax(clone, depth - 1, alpha, beta, false, botPlayer));
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return val;
    } else {
      let val = Infinity;
      for (const col of ordered) {
        const clone = this._cloneGame(game);
        clone.makeMove(col);
        val = Math.min(val, this._minimax(clone, depth - 1, alpha, beta, true, botPlayer));
        beta = Math.min(beta, val);
        if (beta <= alpha) break;
      }
      return val;
    }
  }

  /* ====== Board evaluation (positive = good for botPlayer) ====== */

  _evaluate(game, botPlayer) {
    const oppPlayer = botPlayer === ConnectFourGame.PLAYER1 ? ConnectFourGame.PLAYER2 : ConnectFourGame.PLAYER1;
    let score = 0;

    // Center column control
    const centerCol = 3;
    for (let r = 0; r < ConnectFourGame.ROWS; r++) {
      if (game.board[r][centerCol] === botPlayer) score += 3;
      else if (game.board[r][centerCol] === oppPlayer) score -= 3;
    }

    // Evaluate all windows of 4
    const directions = [
      { dr: 0, dc: 1 },  // horizontal
      { dr: 1, dc: 0 },  // vertical
      { dr: 1, dc: 1 },  // diagonal down-right
      { dr: 1, dc: -1 }  // diagonal down-left
    ];

    for (let r = 0; r < ConnectFourGame.ROWS; r++) {
      for (let c = 0; c < ConnectFourGame.COLS; c++) {
        for (const { dr, dc } of directions) {
          // Check if the window fits on the board
          const endR = r + 3 * dr;
          const endC = c + 3 * dc;
          if (endR < 0 || endR >= ConnectFourGame.ROWS || endC < 0 || endC >= ConnectFourGame.COLS) continue;

          let botCount = 0;
          let oppCount = 0;
          let emptyCount = 0;
          for (let i = 0; i < 4; i++) {
            const cell = game.board[r + i * dr][c + i * dc];
            if (cell === botPlayer) botCount++;
            else if (cell === oppPlayer) oppCount++;
            else emptyCount++;
          }

          // Score the window
          if (botCount === 4) score += 10000;
          else if (botCount === 3 && emptyCount === 1) score += 50;
          else if (botCount === 2 && emptyCount === 2) score += 5;

          if (oppCount === 4) score -= 10000;
          else if (oppCount === 3 && emptyCount === 1) score -= 80; // weight blocking higher
          else if (oppCount === 2 && emptyCount === 2) score -= 5;
        }
      }
    }

    return score;
  }

  /* ====== Utilities ====== */

  _cloneGame(game) {
    const c = new ConnectFourGame();
    c.board = game.board.map(r => [...r]);
    c.currentTurn = game.currentTurn;
    c.gameOver = game.gameOver;
    c.winner = game.winner;
    c.winLine = game.winLine ? game.winLine.map(cell => ({ ...cell })) : null;
    return c;
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = ConnectFourBotPlayer;
