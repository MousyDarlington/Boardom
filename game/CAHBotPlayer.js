'use strict';

/**
 * CAHBotPlayer — Simple bot for Cards Against Humanity.
 *
 * Picks random white cards when submitting.
 * Picks random winner when acting as Card Czar.
 */

class CAHBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `cah_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._paused = false;
    this._timer = null;

    // Mock socket
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

    if (event === 'cah:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      this._hand = data.hand || [];
      // If submitting phase and not czar, schedule submit
      if (data.phase === 'submitting' && !data.isCzar) {
        this._scheduleSubmit(data.currentBlack);
      }
    } else if (event === 'cah:update') {
      if (data.hand) this._hand = data.hand;
      if (data.phase === 'submitting' && !data.isCzar && !data.hasSubmitted) {
        this._scheduleSubmit(data.currentBlack);
      } else if ((data.phase === 'revealing' || data.phase === 'judging') && data.isCzar) {
        this._schedulePick(data.shuffledSubmissions);
      }
    } else if (event === 'cah:submissions') {
      // Czar receives submissions to judge
      if (data.isCzar || this._isCzar) {
        this._schedulePick(data.shuffledSubmissions);
      }
    } else if (event === 'cah:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 2000 + Math.random() * 2000; // 2-4 seconds
  }

  _scheduleSubmit(currentBlack) {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;

      const pickCount = currentBlack ? currentBlack.pick : 1;
      const handSize = this._hand ? this._hand.length : 0;
      const toPick = Math.min(pickCount, handSize);
      if (toPick === 0) return;

      // Pick random indices from hand
      const indices = [];
      const used = new Set();
      for (let i = 0; i < toPick; i++) {
        let idx;
        do { idx = Math.floor(Math.random() * handSize); } while (used.has(idx));
        used.add(idx);
        indices.push(idx);
      }

      this.matchmaker.cahSubmitCards(this.socket, indices);
    }, this._thinkMs());
  }

  _schedulePick(submissions) {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    if (!submissions || submissions.length === 0) return;

    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;

      const idx = Math.floor(Math.random() * submissions.length);
      this.matchmaker.cahPickWinner(this.socket, idx);
    }, this._thinkMs() * 1.5);
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = CAHBotPlayer;
