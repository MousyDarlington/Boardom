'use strict';

class GoFishBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `gf_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.playerCount = 2;
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

    if (event === 'gf:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      this.playerCount = data.playerCount || 2;
      if (data.hand) this._hand = data.hand;
      if (data.currentTurn === this.playerIndex) {
        this._scheduleTurn(data);
      }
    } else if (event === 'gf:update') {
      if (data.hand) this._hand = data.hand;
      if (data.playerCount) this.playerCount = data.playerCount;
      if (data.currentTurn === this.playerIndex && !data.gameOver) {
        this._scheduleTurn(data);
      }
    } else if (event === 'gf:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 1500 + Math.random() * 1500;
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
    if (!this._hand || this._hand.length === 0) return;

    // Count how many of each rank we have
    const rankCounts = {};
    for (const card of this._hand) {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }

    // Prefer ranks where we have 2-3 cards (closer to completing a book)
    const ranks = Object.entries(rankCounts)
      .map(([rank, count]) => ({ rank: parseInt(rank), count }))
      .sort((a, b) => {
        // Prefer higher counts (closer to book), then higher rank
        if (b.count !== a.count) return b.count - a.count;
        return b.rank - a.rank;
      });

    if (ranks.length === 0) return;

    // Pick the best rank to ask for
    const chosenRank = ranks[0].rank;

    // Pick a random other player to ask
    const opponents = [];
    for (let p = 0; p < this.playerCount; p++) {
      if (p !== this.playerIndex) {
        // Prefer opponents who have cards (check hand sizes if available)
        const oppInfo = data.opponentHandSizes
          ? data.opponentHandSizes.find(o => o.player === p)
          : null;
        if (!oppInfo || oppInfo.count > 0) {
          opponents.push(p);
        }
      }
    }

    if (opponents.length === 0) {
      // Fallback: ask any other player
      for (let p = 0; p < this.playerCount; p++) {
        if (p !== this.playerIndex) opponents.push(p);
      }
    }

    if (opponents.length === 0) return;

    const targetIdx = opponents[Math.floor(Math.random() * opponents.length)];

    this.matchmaker.gfAskForCard(this.socket, targetIdx, chosenRank);
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = GoFishBotPlayer;
