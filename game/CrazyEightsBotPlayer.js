'use strict';

class CrazyEightsBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `c8_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._paused = false;
    this._timer = null;
    this._hand = [];

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

    if (event === 'c8:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.hand) this._hand = data.hand;
      if (data.currentTurn === this.playerIndex) {
        this._scheduleTurn(data);
      }
    } else if (event === 'c8:update') {
      if (data.hand) this._hand = data.hand;
      if (data.currentTurn === this.playerIndex && !data.gameOver) {
        this._scheduleTurn(data);
      }
    } else if (event === 'c8:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 1000 + Math.random() * 1500;
  }

  _scheduleTurn(data) {
    if (this.destroyed || this._paused || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executeTurn(data);
    }, this._thinkMs());
  }

  _executeTurn(data) {
    if (this.destroyed) return;

    const playable = data.playableCards || [];

    if (playable.length > 0) {
      // Strategy: prefer non-8s over 8s (save 8s for when stuck)
      const nonEights = playable.filter(i => this._hand[i] && this._hand[i].rank !== 8);
      const eights = playable.filter(i => this._hand[i] && this._hand[i].rank === 8);

      let cardIndex;
      if (nonEights.length > 0) {
        // Pick a random non-8 playable card
        cardIndex = nonEights[Math.floor(Math.random() * nonEights.length)];
      } else {
        // Must play an 8
        cardIndex = eights[Math.floor(Math.random() * eights.length)];
      }

      // If playing an 8, choose the suit we have the most of
      let chosenSuit = null;
      if (this._hand[cardIndex] && this._hand[cardIndex].rank === 8) {
        chosenSuit = this._pickBestSuit();
      }

      this.matchmaker.c8PlayCard(this.socket, cardIndex, chosenSuit);
    } else {
      // No playable cards — draw
      this.matchmaker.c8DrawCard(this.socket);
    }
  }

  /**
   * Choose the suit the bot has the most cards of in hand.
   * @returns {number} suit (0-3)
   */
  _pickBestSuit() {
    const suitCounts = [0, 0, 0, 0];
    for (const card of this._hand) {
      if (card && card.rank !== 8) {
        suitCounts[card.suit]++;
      }
    }

    let bestSuit = 0;
    let bestCount = -1;
    for (let s = 0; s < 4; s++) {
      if (suitCounts[s] > bestCount) {
        bestCount = suitCounts[s];
        bestSuit = s;
      }
    }
    return bestSuit;
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = CrazyEightsBotPlayer;
