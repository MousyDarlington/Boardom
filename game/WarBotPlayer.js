'use strict';

class WarBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `war_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._paused = false;
    this._timer = null;

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

    if (event === 'war:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.phase === 'ready') this._schedulePlay();
    } else if (event === 'war:update') {
      if (data.phase !== 'over' && !data.gameOver) this._schedulePlay();
    } else if (event === 'war:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 800 + Math.random() * 1200;
  }

  _schedulePlay() {
    if (this.destroyed || this._paused || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this.matchmaker.warPlayRound(this.socket);
    }, this._thinkMs());
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = WarBotPlayer;
