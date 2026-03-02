'use strict';

const MancalaGame = require('./MancalaGame');

const BOT_NAMES = [
  'SeedSower', 'StoneKing', 'PitMaster', 'MancalaMind',
  'SowBot', 'HarvestAI', 'KalahBot', 'CaptureKing'
];

class MancalaBotPlayer {
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

  /* ---------- Event handling ---------- */

  _onEvent(event, data) {
    if (this.destroyed || this._paused) return;

    if (event === 'mancala:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.currentTurn === this.playerIndex) {
        this._scheduleMove();
      }
    } else if (event === 'mancala:update') {
      if (data.currentTurn === this.playerIndex) {
        this._scheduleMove();
      }
    } else if (event === 'mancala:over') {
      this.destroy();
    }
  }

  /* ---------- Move scheduling ---------- */

  _thinkMs() {
    return 800 + Math.random() * 1200;
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
    if (this.destroyed || this._paused) return;

    // Reconstruct game state from the matchmaker
    const gd = this.matchmaker.games.get(this.gameId);
    if (!gd || !gd.mancalaGame) return;

    const game = gd.mancalaGame;
    const validMoves = game.getValidMoves();
    if (validMoves.length === 0) return;

    let pitIdx;
    if (this.skill === 0) {
      pitIdx = this._pickRandom(game);
    } else if (this.skill === 1) {
      pitIdx = this._pickHeuristic(game);
    } else {
      pitIdx = this._pickMinimax(game, 6);
    }

    if (pitIdx == null) {
      // Fallback to random
      pitIdx = validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    this.matchmaker.mancalaMakeMove(this.socket, pitIdx);
  }

  /* ---------- Skill 0: Random ---------- */

  _pickRandom(game) {
    const moves = game.getValidMoves();
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /* ---------- Skill 1: Heuristic ---------- */

  _pickHeuristic(game) {
    const moves = game.getValidMoves();
    if (moves.length === 0) return null;

    const player = game.currentTurn;
    const ownStore = player === 0 ? MancalaGame.STORE_P0 : MancalaGame.STORE_P1;

    // Score each move
    const scored = moves.map(pitIdx => {
      const clone = this._cloneGame(game);
      const stones = clone.pits[pitIdx];

      // Simulate the sow to find where the last stone lands
      const opponentStore = player === 0 ? MancalaGame.STORE_P1 : MancalaGame.STORE_P0;
      let idx = pitIdx;
      let remaining = stones;
      while (remaining > 0) {
        idx = (idx + 1) % MancalaGame.TOTAL_PITS;
        if (idx === opponentStore) continue;
        remaining--;
      }
      const endIdx = idx;

      let score = 0;

      // Priority 1: Extra turn (last stone in own store) -- high value
      if (endIdx === ownStore) {
        score += 100;
      }

      // Priority 2: Capture
      const playerStart = player === 0 ? 0 : 7;
      const playerEnd = playerStart + MancalaGame.PITS_PER_SIDE;
      if (endIdx !== ownStore) {
        // Check if the landing pit will be empty (currently has 0 stones, since we pick up from pitIdx)
        // After sowing, the landing pit will have 1 stone if it was empty before
        // (unless it's the same pit we started from and we looped around, but we handle the general case)
        const landingWillBeEmpty = (clone.pits[endIdx] === 0) || (endIdx === pitIdx && stones > 13);
        // More precise: if endIdx !== pitIdx, the current count at endIdx is what matters
        // If endIdx === pitIdx, after picking up stones, it has 0 stones, then we sow back to it
        const currentCount = endIdx === pitIdx ? 0 : clone.pits[endIdx];
        // After sowing, the count at endIdx will be currentCount + 1
        // A capture happens if currentCount + 1 === 1, i.e., currentCount === 0
        if (currentCount === 0 && endIdx >= playerStart && endIdx < playerEnd) {
          const oppositePit = MancalaGame.OPPOSITE[endIdx];
          if (oppositePit !== undefined && clone.pits[oppositePit] > 0) {
            score += 50 + clone.pits[oppositePit]; // more valuable to capture more stones
          }
        }
      }

      // Priority 3: Prefer moves that move more stones (more aggressive)
      score += stones * 0.5;

      // Priority 4: Prefer moves that don't leave stones near opponent
      // Penalize pits close to opponent's side slightly
      const distToStore = (ownStore - pitIdx + MancalaGame.TOTAL_PITS) % MancalaGame.TOTAL_PITS;
      score += distToStore * 0.1;

      // Add small random noise for variety
      score += Math.random() * 5;

      return { pitIdx, score };
    });

    // Sort by score descending and pick the best
    scored.sort((a, b) => b.score - a.score);
    return scored[0].pitIdx;
  }

  /* ---------- Skill 2: Minimax with alpha-beta pruning ---------- */

  _pickMinimax(game, depth) {
    const moves = game.getValidMoves();
    if (moves.length === 0) return null;

    const maximizingPlayer = game.currentTurn;
    let bestScore = -Infinity;
    let bestMove = moves[0];

    for (const pitIdx of moves) {
      const clone = this._cloneGame(game);
      clone.makeMove(pitIdx);

      const score = this._minimax(clone, depth - 1, -Infinity, Infinity, maximizingPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestMove = pitIdx;
      }
    }

    return bestMove;
  }

  /**
   * Minimax with alpha-beta pruning.
   * Evaluates from the perspective of `maximizingPlayer`.
   */
  _minimax(game, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0 || game.gameOver) {
      return this._evaluate(game, maximizingPlayer);
    }

    const moves = game.getValidMoves();
    if (moves.length === 0) {
      return this._evaluate(game, maximizingPlayer);
    }

    const isMaximizing = game.currentTurn === maximizingPlayer;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const pitIdx of moves) {
        const clone = this._cloneGame(game);
        clone.makeMove(pitIdx);
        const evalScore = this._minimax(clone, depth - 1, alpha, beta, maximizingPlayer);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break; // Beta cutoff
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const pitIdx of moves) {
        const clone = this._cloneGame(game);
        clone.makeMove(pitIdx);
        const evalScore = this._minimax(clone, depth - 1, alpha, beta, maximizingPlayer);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break; // Alpha cutoff
      }
      return minEval;
    }
  }

  /**
   * Evaluate the board from the perspective of `player`.
   * Higher scores are better for `player`.
   */
  _evaluate(game, player) {
    const opponent = 1 - player;
    const playerStore = player === 0 ? MancalaGame.STORE_P0 : MancalaGame.STORE_P1;
    const opponentStore = opponent === 0 ? MancalaGame.STORE_P0 : MancalaGame.STORE_P1;

    // Store difference (most important)
    const storeDiff = game.pits[playerStore] - game.pits[opponentStore];

    // If game is over, heavy weight on final result
    if (game.gameOver) {
      if (game.winner === player) return 1000 + storeDiff;
      if (game.winner === opponent) return -1000 + storeDiff;
      return 0; // draw
    }

    // Count stones on each side (potential future points)
    const playerStart = player === 0 ? 0 : 7;
    const opponentStart = opponent === 0 ? 0 : 7;
    let playerSideStones = 0;
    let opponentSideStones = 0;
    let playerEmptyPits = 0;
    let opponentEmptyPits = 0;

    for (let i = playerStart; i < playerStart + MancalaGame.PITS_PER_SIDE; i++) {
      playerSideStones += game.pits[i];
      if (game.pits[i] === 0) playerEmptyPits++;
    }
    for (let i = opponentStart; i < opponentStart + MancalaGame.PITS_PER_SIDE; i++) {
      opponentSideStones += game.pits[i];
      if (game.pits[i] === 0) opponentEmptyPits++;
    }

    // Evaluation: store diff is primary, side stones give potential,
    // empty pits on player's side indicate capture potential
    return (storeDiff * 10) +
           (playerSideStones - opponentSideStones) * 2 +
           (playerEmptyPits * 1.5) -
           (opponentEmptyPits * 1.5);
  }

  /* ---------- Utility ---------- */

  _cloneGame(game) {
    const c = new MancalaGame();
    c.pits = [...game.pits];
    c.currentTurn = game.currentTurn;
    c.gameOver = game.gameOver;
    c.winner = game.winner;
    return c;
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = MancalaBotPlayer;
