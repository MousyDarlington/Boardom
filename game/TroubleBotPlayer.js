'use strict';

const TroubleGame = require('./TroubleGame');

class TroubleBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `trouble_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._timer = null;

    // Skill: 0 = random, 1 = heuristic
    this.skill = botRating >= 1300 ? 1 : 0;

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
    if (this.destroyed) return;

    if (event === 'trouble:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.currentTurn === this.playerIndex) {
        this._scheduleRoll();
      }
    } else if (event === 'trouble:rollResult') {
      if (data.currentTurn === this.playerIndex && data.validMoves && data.validMoves.length > 0) {
        this._scheduleMove(data.validMoves);
      }
      // If skipped (no valid moves), next turn event will come via trouble:update or next rollResult
    } else if (event === 'trouble:update') {
      if (data.currentTurn === this.playerIndex && data.phase === 'roll') {
        this._scheduleRoll();
      }
    } else if (event === 'trouble:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 800 + Math.random() * 1200;
  }

  _scheduleRoll() {
    if (this.destroyed) return;
    this._timer = setTimeout(() => {
      if (this.destroyed) return;
      this.matchmaker.troubleRollDice(this.socket);
    }, this._thinkMs());
  }

  _scheduleMove(validMoves) {
    if (this.destroyed) return;
    this._timer = setTimeout(() => {
      if (this.destroyed) return;
      const move = this.skill === 1 ? this._pickBestMove(validMoves) : this._pickRandom(validMoves);
      this.matchmaker.troubleMakeMove(this.socket, move.tokenIdx);
    }, this._thinkMs() * 0.6);
  }

  _pickRandom(moves) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  _pickBestMove(moves) {
    // Priority: capture > finish_complete > finish_enter/advance > enter > track (furthest ahead)
    const capture = moves.find(m => m.destType === 'track' && this._wouldCapture(m));
    if (capture) return capture;

    const complete = moves.find(m => m.destType === 'finish_complete');
    if (complete) return complete;

    const finishAdv = moves.find(m => m.destType === 'finish_advance' || m.destType === 'finish_enter');
    if (finishAdv) return finishAdv;

    const enter = moves.find(m => m.destType === 'enter');
    if (enter) return enter;

    return this._pickRandom(moves);
  }

  _wouldCapture(move) {
    // Check if any opponent has a token at destPos
    const gd = this.matchmaker.games.get(this.gameId);
    if (!gd || !gd.troubleGame) return false;
    const tokens = gd.troubleGame.tokens;
    for (let p = 0; p < tokens.length; p++) {
      if (p === this.playerIndex) continue;
      if (tokens[p].some(t => t === move.destPos)) return true;
    }
    return false;
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = TroubleBotPlayer;
