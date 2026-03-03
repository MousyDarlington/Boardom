'use strict';

const CardDeck = require('./CardDeck');

/**
 * PokerBotPlayer -- Bot for Texas Hold'em Poker.
 *
 * Strategy:
 *   Pre-flop:
 *     - Premium hands (AA, KK, QQ, AKs) => raise 3x big blind
 *     - Medium hands (JJ-88, AQ, AJ, KQ) => call
 *     - Weak hands => fold (or call if cheap)
 *
 *   Post-flop:
 *     - Strong hand (two pair+) => bet/raise 50-75% pot
 *     - Moderate (pair) => check/call
 *     - Weak => check/fold
 *     - Bluff ~15% of the time
 */

class PokerBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `pk_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._paused = false;
    this._timer = null;
    this._hand = [];
    this._communityCards = [];
    this._bigBlind = 20;

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

    if (event === 'pk:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.hand) this._hand = data.hand;
      if (data.bigBlind) this._bigBlind = data.bigBlind;
      if (data.communityCards) this._communityCards = data.communityCards;
      if (data.currentTurn === this.playerIndex) {
        this._scheduleTurn(data);
      }
    } else if (event === 'pk:update') {
      if (data.hand) this._hand = data.hand;
      if (data.communityCards) this._communityCards = data.communityCards;
      if (data.bigBlind) this._bigBlind = data.bigBlind;
      if (data.currentTurn === this.playerIndex && !data.gameOver) {
        this._scheduleTurn(data);
      }
    } else if (event === 'pk:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 2000 + Math.random() * 2000; // 2000-4000ms
  }

  /* ---------- Turn Scheduling ---------- */

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

    const phase = data.phase;
    const communityCards = data.communityCards || this._communityCards || [];
    const pot = data.pot || 0;
    const currentBet = data.currentBet || 0;
    const myBet = this._getMyBet(data);
    const toCall = currentBet - myBet;
    const myChips = this._getMyChips(data);

    if (phase === 'preflop') {
      this._playPreflop(data, toCall, myChips, pot);
    } else {
      this._playPostflop(data, communityCards, toCall, myChips, pot, currentBet);
    }
  }

  /* ---------- Pre-flop Strategy ---------- */

  _playPreflop(data, toCall, myChips, pot) {
    if (this._hand.length < 2) {
      // No cards yet, check or fold
      if (toCall <= 0) {
        this.matchmaker.pkCheck(this.socket);
      } else {
        this.matchmaker.pkFold(this.socket);
      }
      return;
    }

    const strength = this._evaluateHoleCards(this._hand[0], this._hand[1]);

    if (strength === 'premium') {
      // Raise 3x big blind
      const raiseAmount = (data.currentBet || 0) + this._bigBlind * 3;
      if (raiseAmount <= myChips + (data.currentBet || 0)) {
        this.matchmaker.pkRaise(this.socket, raiseAmount);
      } else {
        this.matchmaker.pkAllIn(this.socket);
      }
    } else if (strength === 'medium') {
      // Call
      if (toCall <= 0) {
        this.matchmaker.pkCheck(this.socket);
      } else if (toCall <= myChips) {
        this.matchmaker.pkCall(this.socket);
      } else {
        // Facing a bet larger than chips: all-in or fold
        if (myChips > this._bigBlind * 5) {
          this.matchmaker.pkAllIn(this.socket);
        } else {
          this.matchmaker.pkFold(this.socket);
        }
      }
    } else {
      // Weak hand
      if (toCall <= 0) {
        // Free to check
        this.matchmaker.pkCheck(this.socket);
      } else if (toCall <= this._bigBlind && myChips > toCall) {
        // Cheap to call (just the blind)
        this.matchmaker.pkCall(this.socket);
      } else {
        this.matchmaker.pkFold(this.socket);
      }
    }
  }

  /**
   * Evaluate hole card strength.
   * @returns {'premium'|'medium'|'weak'}
   */
  _evaluateHoleCards(card1, card2) {
    const r1 = card1.rank;
    const r2 = card2.rank;
    const suited = card1.suit === card2.suit;
    const high = Math.max(r1, r2);
    const low = Math.min(r1, r2);

    // Premium: AA, KK, QQ, AKs
    if (r1 === r2 && r1 >= 12) return 'premium'; // QQ, KK, AA
    if (high === 14 && low === 13 && suited) return 'premium'; // AKs

    // Medium: JJ-88, AQ, AJ, KQ (suited or not), AK offsuit
    if (r1 === r2 && r1 >= 8) return 'medium'; // 88-JJ (QQ+ already caught above)
    if (high === 14 && low === 13) return 'medium'; // AK offsuit
    if (high === 14 && low === 12) return 'medium'; // AQ
    if (high === 14 && low === 11) return 'medium'; // AJ
    if (high === 13 && low === 12) return 'medium'; // KQ

    return 'weak';
  }

  /* ---------- Post-flop Strategy ---------- */

  _playPostflop(data, communityCards, toCall, myChips, pot, currentBet) {
    const handStrength = this._evaluateHandStrength(communityCards);
    const isBluffing = Math.random() < 0.15;

    if (handStrength === 'strong' || (isBluffing && handStrength === 'weak')) {
      // Bet/raise 50-75% of pot
      const betFraction = 0.50 + Math.random() * 0.25;
      const betAmount = Math.max(
        (currentBet || 0) + this._bigBlind,
        Math.floor(pot * betFraction) + (currentBet || 0)
      );

      if (toCall <= 0) {
        // No bet facing us; we raise
        if (betAmount <= myChips) {
          this.matchmaker.pkRaise(this.socket, betAmount);
        } else if (myChips > 0) {
          this.matchmaker.pkAllIn(this.socket);
        } else {
          this.matchmaker.pkCheck(this.socket);
        }
      } else {
        // Facing a bet; re-raise
        const raiseAmount = currentBet + Math.floor(pot * betFraction);
        if (raiseAmount <= myChips + (currentBet || 0)) {
          this.matchmaker.pkRaise(this.socket, raiseAmount);
        } else if (myChips > 0) {
          this.matchmaker.pkAllIn(this.socket);
        } else {
          this.matchmaker.pkCall(this.socket);
        }
      }
    } else if (handStrength === 'moderate') {
      // Check/call
      if (toCall <= 0) {
        this.matchmaker.pkCheck(this.socket);
      } else if (toCall <= myChips && toCall <= pot * 0.5) {
        this.matchmaker.pkCall(this.socket);
      } else if (toCall <= myChips && toCall <= pot) {
        // Moderate with a larger bet: call sometimes, fold sometimes
        if (Math.random() < 0.5) {
          this.matchmaker.pkCall(this.socket);
        } else {
          this.matchmaker.pkFold(this.socket);
        }
      } else {
        this.matchmaker.pkFold(this.socket);
      }
    } else {
      // Weak hand: check/fold
      if (toCall <= 0) {
        this.matchmaker.pkCheck(this.socket);
      } else {
        this.matchmaker.pkFold(this.socket);
      }
    }
  }

  /**
   * Evaluate current hand + community cards.
   * @returns {'strong'|'moderate'|'weak'}
   */
  _evaluateHandStrength(communityCards) {
    if (!this._hand || this._hand.length < 2 || !communityCards || communityCards.length === 0) {
      return 'weak';
    }

    const allCards = [...this._hand, ...communityCards];

    // Need at least 5 cards for a proper evaluation
    if (allCards.length < 5) {
      // With < 5 cards, do a rough pair check
      return this._roughStrength(allCards);
    }

    const result = CardDeck.evaluatePokerHand(allCards);
    if (!result) return 'weak';

    // Strong: two pair or better (rank >= 2)
    if (result.rank >= 2) return 'strong';

    // Moderate: one pair (rank 1)
    if (result.rank === 1) return 'moderate';

    // Weak: high card
    return 'weak';
  }

  /**
   * Rough strength check when fewer than 5 total cards are available.
   */
  _roughStrength(cards) {
    const ranks = cards.map(c => c.rank);
    const rankCounts = {};
    for (const r of ranks) {
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    }

    const counts = Object.values(rankCounts);
    const maxCount = Math.max(...counts);

    if (maxCount >= 3) return 'strong';
    if (maxCount === 2) {
      // Check if we have two separate pairs
      const pairs = counts.filter(c => c >= 2).length;
      if (pairs >= 2) return 'strong';
      return 'moderate';
    }

    return 'weak';
  }

  /* ---------- Helpers ---------- */

  _getMyBet(data) {
    if (data.players && data.players[this.playerIndex]) {
      return data.players[this.playerIndex].bet || 0;
    }
    return 0;
  }

  _getMyChips(data) {
    if (data.players && data.players[this.playerIndex]) {
      return data.players[this.playerIndex].chips || 0;
    }
    return 0;
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = PokerBotPlayer;
