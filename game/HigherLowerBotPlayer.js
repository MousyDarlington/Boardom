'use strict';

/**
 * HigherLowerBotPlayer -- Bot for Higher or Lower.
 *
 * Strategy:
 *   - If current card rank <= 8, guess 'higher'.
 *   - If current card rank >= 9, guess 'lower'.
 *   - ~10% chance to make the opposite guess (randomness).
 */

class HigherLowerBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `hl_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._paused = false;
    this._timer = null;
    this._currentCard = null;

    // Mock socket (same pattern as CAHBotPlayer)
    const self = this;
    this.socket = {
      id: `bot_${this.username}`,
      username: this.username,
      join() {},
      leave() {},
      emit(event, data) { self._onEvent(event, data); },
      on() {}
    };
  }

  _onEvent(event, data) {
    if (this.destroyed || this._paused) return;

    if (event === 'hl:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.currentCard) this._currentCard = data.currentCard;
      if (data.currentTurn === this.playerIndex && data.phase === 'guessing') {
        this._scheduleGuess(data);
      }
    } else if (event === 'hl:update') {
      if (data.currentCard) this._currentCard = data.currentCard;
      if (data.currentTurn === this.playerIndex && !data.gameOver && data.phase === 'guessing') {
        this._scheduleGuess(data);
      }
    } else if (event === 'hl:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 800 + Math.random() * 700; // 800-1500ms
  }

  _scheduleGuess(data) {
    if (this.destroyed || this._paused || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executeGuess(data);
    }, this._thinkMs());
  }

  _executeGuess(data) {
    if (this.destroyed) return;

    const card = data.currentCard || this._currentCard;
    if (!card) {
      // Fallback: random guess
      const choice = Math.random() < 0.5 ? 'higher' : 'lower';
      this.matchmaker.hlGuess(this.socket, choice);
      return;
    }

    const rank = card.rank; // 2-14

    // Midpoint of the deck rank range (2-14) is 8
    // Ranks 2-8: more likely to be higher; Ranks 9-14: more likely to be lower
    let choice;
    if (rank <= 8) {
      choice = 'higher';
    } else {
      choice = 'lower';
    }

    // Add randomness: ~10% chance to flip the decision
    if (Math.random() < 0.10) {
      choice = choice === 'higher' ? 'lower' : 'higher';
    }

    // Edge cases: rank 2 can only go higher or equal; rank 14 can only go lower or equal
    if (rank === 2) {
      choice = 'higher';
    } else if (rank === 14) {
      choice = 'lower';
    }

    this.matchmaker.hlGuess(this.socket, choice);
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = HigherLowerBotPlayer;
