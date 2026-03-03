'use strict';

const BOT_NAMES = [
  'AceBot', 'CardShark', 'DealerBane', 'BlackjackAI',
  'HitMaster', 'StandKing', 'ChipStack', 'TwentyOne'
];

class BlackjackBotPlayer {
  /**
   * @param {object} matchmaker - Matchmaker instance
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

    // Mock socket
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

    if (event === 'bj:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      this._handleState(data);
    } else if (event === 'bj:update') {
      this._handleState(data);
    } else if (event === 'bj:over') {
      this.destroy();
    }
  }

  _handleState(data) {
    if (data.phase === 'betting') {
      this._scheduleBet(data);
    } else if (data.phase === 'playing' && data.currentPlayer === this.playerIndex) {
      this._schedulePlay(data);
    }
  }

  /* ---------- Think time ---------- */

  _thinkMs() {
    return 1000 + Math.random() * 1000;
  }

  /* ---------- Betting ---------- */

  _scheduleBet(data) {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;

      const chips = data.chips[this.playerIndex];
      // Bet between 10 and 50, scaled by chip count
      const maxBet = Math.min(50, chips);
      const bet = Math.max(10, Math.min(maxBet, Math.floor(chips * 0.05)));
      this.matchmaker.bjPlaceBet(this.socket, bet);
    }, this._thinkMs());
  }

  /* ---------- Play decisions (basic strategy) ---------- */

  _schedulePlay(data) {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;

      const hand = data.hands[this.playerIndex];
      if (!hand || hand.status !== 'playing') return;

      const handValue = this._calcHandValue(hand.cards);

      // Dealer upcard (first visible card)
      const dealerUpcard = data.dealerHand.cards[0];
      const dealerUp = dealerUpcard ? this._bjCardValue(dealerUpcard) : 10;

      // Double down on 10 or 11 with 2 cards if dealer shows weak card (2-6)
      if (hand.cards.length === 2 && !hand.doubledDown) {
        if ((handValue === 10 || handValue === 11) && dealerUp >= 2 && dealerUp <= 6) {
          this.matchmaker.bjDoubleDown(this.socket);
          return;
        }
      }

      // Basic strategy: hit below 17, stand on 17+
      if (handValue < 17) {
        this.matchmaker.bjHit(this.socket);
      } else {
        this.matchmaker.bjStand(this.socket);
      }
    }, this._thinkMs());
  }

  _bjCardValue(card) {
    if (!card) return 0;
    if (card.rank >= 11 && card.rank <= 13) return 10;
    if (card.rank === 14) return 11;
    return card.rank;
  }

  _calcHandValue(cards) {
    let value = 0;
    let aces = 0;
    for (const card of cards) {
      if (!card) continue;
      value += this._bjCardValue(card);
      if (card.rank === 14) aces++;
    }
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    return value;
  }

  /* ---------- Cleanup ---------- */

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = BlackjackBotPlayer;
