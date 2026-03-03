'use strict';

const SpadesGame = require('./SpadesGame');
const CardDeck = require('./CardDeck');

const SPADES = 3;
const HEARTS = 2;
const DIAMONDS = 1;
const CLUBS = 0;

const BOT_NAMES = [
  'AceOfSpades', 'TrumpMaster', 'BidWizard', 'SpadeKing',
  'TrickTaker', 'VoidRunner', 'NilHunter', 'SuitSage',
  'SpadeShark', 'BagDodger', 'SetBlocker', 'BookKeeper'
];

class SpadesBotPlayer {
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
    this._paused = false;
    this._timer = null;

    // State tracked from events
    this._hand = [];
    this._bids = [null, null, null, null];
    this._tricksTaken = [0, 0, 0, 0];
    this._currentTrick = [];
    this._spadesBroken = false;
    this._phase = 'bidding';
    this._teamScores = [0, 0];

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

  /* ====== Event handling ====== */

  _onEvent(event, data) {
    if (this.destroyed || this._paused) return;

    if (event === 'sp:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      this._updateState(data);
      if (data.phase === 'bidding' && data.currentTurn === this.playerIndex) {
        this._scheduleBid();
      }
    } else if (event === 'sp:update') {
      this._updateState(data);
      if (data.currentTurn === this.playerIndex) {
        if (data.phase === 'bidding') {
          this._scheduleBid();
        } else if (data.phase === 'playing') {
          this._schedulePlay();
        }
      }
    } else if (event === 'sp:over') {
      this.destroy();
    }
  }

  _updateState(data) {
    if (data.hand) this._hand = data.hand;
    if (data.bids) this._bids = data.bids;
    if (data.tricksTaken) this._tricksTaken = data.tricksTaken;
    if (data.currentTrick) this._currentTrick = data.currentTrick;
    if (data.spadesBroken !== undefined) this._spadesBroken = data.spadesBroken;
    if (data.phase) this._phase = data.phase;
    if (data.teamScores) this._teamScores = data.teamScores;
  }

  /* ====== Timing ====== */

  _thinkMs() {
    return 1500 + Math.random() * 1500; // 1500-3000ms
  }

  _scheduleBid() {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executeBid();
    }, this._thinkMs());
  }

  _schedulePlay() {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executePlay();
    }, this._thinkMs());
  }

  /* ====== Bidding Logic ====== */

  _executeBid() {
    if (this.destroyed) return;
    const bid = this._calculateBid();
    this.matchmaker.spadesBid(this.socket, bid);
  }

  _calculateBid() {
    const hand = this._hand;
    if (!hand || hand.length === 0) return 1;

    let trickEstimate = 0;

    // Count spades
    const spades = hand.filter(c => c.suit === SPADES);
    const nonSpades = hand.filter(c => c.suit !== SPADES);

    // High spades are near-guaranteed tricks
    for (const c of spades) {
      if (c.rank === 14) trickEstimate += 1.0;       // Ace of spades
      else if (c.rank === 13) trickEstimate += 0.9;   // King of spades
      else if (c.rank === 12) trickEstimate += 0.7;   // Queen of spades
      else if (c.rank >= 10) trickEstimate += 0.3;     // 10, Jack
      else trickEstimate += 0.1;                       // Low spades
    }

    // Count aces and kings in other suits
    const suitGroups = {};
    for (const c of nonSpades) {
      if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
      suitGroups[c.suit].push(c);
    }

    for (const suit in suitGroups) {
      const cards = suitGroups[suit].sort((a, b) => b.rank - a.rank);
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].rank === 14) trickEstimate += 0.8;        // Off-suit Ace
        else if (cards[i].rank === 13 && cards.length >= 2) trickEstimate += 0.5; // King with protection
        else if (cards[i].rank === 13) trickEstimate += 0.2;   // Bare King
      }
    }

    // Void suits can be trumped
    const suitsHeld = new Set(hand.map(c => c.suit));
    for (let s = 0; s < 4; s++) {
      if (s !== SPADES && !suitsHeld.has(s) && spades.length > 0) {
        trickEstimate += 0.5; // Void suit + spades = ruffing opportunity
      }
    }

    // Bid conservatively (round down, minus 1, but at least 1)
    let bid = Math.max(1, Math.floor(trickEstimate) - 1);

    // Clamp to 1-13
    bid = Math.max(1, Math.min(13, bid));

    return bid;
  }

  /* ====== Playing Logic ====== */

  _executePlay() {
    if (this.destroyed) return;
    const cardIndex = this._chooseCard();
    if (cardIndex >= 0) {
      this.matchmaker.spadesPlayCard(this.socket, cardIndex);
    }
  }

  _chooseCard() {
    const hand = this._hand;
    if (!hand || hand.length === 0) return -1;

    // Build list of valid card indices
    const validIndices = this._getValidCardIndices();
    if (validIndices.length === 0) return -1;
    if (validIndices.length === 1) return validIndices[0];

    if (this._currentTrick.length === 0) {
      // We are leading
      return this._chooseLead(validIndices);
    } else {
      // We are following
      return this._chooseFollow(validIndices);
    }
  }

  _getValidCardIndices() {
    const hand = this._hand;
    const indices = [];

    if (this._currentTrick.length === 0) {
      // Leading: can play anything, but spades only if broken or all spades
      const hasNonSpade = hand.some(c => c.suit !== SPADES);
      for (let i = 0; i < hand.length; i++) {
        if (hand[i].suit === SPADES && !this._spadesBroken && hasNonSpade) continue;
        indices.push(i);
      }
      // If no valid cards (shouldn't happen), allow all
      if (indices.length === 0) {
        for (let i = 0; i < hand.length; i++) indices.push(i);
      }
    } else {
      // Following: must follow suit if possible
      const leadSuit = this._currentTrick[0].card.suit;
      const hasLeadSuit = hand.some(c => c.suit === leadSuit);

      if (hasLeadSuit) {
        for (let i = 0; i < hand.length; i++) {
          if (hand[i].suit === leadSuit) indices.push(i);
        }
      } else {
        // Can play anything
        for (let i = 0; i < hand.length; i++) indices.push(i);
      }
    }

    return indices;
  }

  _chooseLead(validIndices) {
    const hand = this._hand;

    // Strategy: lead with winners first, avoid breaking spades early

    // Try to lead with high off-suit cards (Aces, Kings)
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const idx of validIndices) {
      const c = hand[idx];
      let score = 0;

      if (c.suit !== SPADES) {
        // Prefer high off-suit cards
        if (c.rank === 14) score = 100; // Ace is likely a winner
        else if (c.rank === 13) score = 80;
        else score = c.rank; // Lower cards to start establishing tricks
      } else {
        // Spades: lead high spades if we have them (to pull trump)
        if (c.rank === 14) score = 90;
        else if (c.rank === 13) score = 70;
        else score = c.rank - 20; // Prefer not to lead low spades
      }

      // Small random noise
      score += Math.random() * 5;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    return bestIdx >= 0 ? bestIdx : validIndices[0];
  }

  _chooseFollow(validIndices) {
    const hand = this._hand;
    const trick = this._currentTrick;
    const leadSuit = trick[0].card.suit;

    // Determine the current winning card in the trick
    let currentWinner = trick[0].card;
    for (let i = 1; i < trick.length; i++) {
      const c = trick[i].card;
      if (c.suit === SPADES && currentWinner.suit !== SPADES) {
        currentWinner = c;
      } else if (c.suit === SPADES && currentWinner.suit === SPADES && c.rank > currentWinner.rank) {
        currentWinner = c;
      } else if (c.suit === leadSuit && currentWinner.suit === leadSuit && c.rank > currentWinner.rank) {
        currentWinner = c;
      }
    }

    // Check if partner is currently winning
    const partnerIdx = (this.playerIndex + 2) % 4;
    let partnerWinning = false;
    if (trick.length >= 2) {
      // Find who played the current winning card
      let winnerPlayer = trick[0].playerIdx;
      let winCard = trick[0].card;
      for (let i = 1; i < trick.length; i++) {
        const c = trick[i].card;
        if (c.suit === SPADES && winCard.suit !== SPADES) {
          winCard = c;
          winnerPlayer = trick[i].playerIdx;
        } else if (c.suit === SPADES && winCard.suit === SPADES && c.rank > winCard.rank) {
          winCard = c;
          winnerPlayer = trick[i].playerIdx;
        } else if (c.suit === leadSuit && winCard.suit === leadSuit && c.rank > winCard.rank) {
          winCard = c;
          winnerPlayer = trick[i].playerIdx;
        }
      }
      partnerWinning = (winnerPlayer === partnerIdx);
    }

    // Can we follow suit?
    const followingSuit = hand[validIndices[0]].suit === leadSuit;

    if (followingSuit) {
      // Following suit: try to win if we can, otherwise play low
      const cardsInSuit = validIndices.map(i => ({ idx: i, card: hand[i] }));
      cardsInSuit.sort((a, b) => a.card.rank - b.card.rank); // ascending

      // Can we beat the current winner?
      const canWin = cardsInSuit.some(c =>
        currentWinner.suit !== SPADES && c.card.rank > currentWinner.rank
      );

      if (partnerWinning) {
        // Partner is winning, play lowest card in suit
        return cardsInSuit[0].idx;
      }

      if (canWin && currentWinner.suit !== SPADES) {
        // Play the lowest card that still wins
        for (const c of cardsInSuit) {
          if (c.card.rank > currentWinner.rank) return c.idx;
        }
      }

      // Can't win or don't need to, play lowest
      return cardsInSuit[0].idx;
    }

    // Not following suit: consider trumping
    const spadeCards = validIndices
      .filter(i => hand[i].suit === SPADES)
      .map(i => ({ idx: i, card: hand[i] }))
      .sort((a, b) => a.card.rank - b.card.rank); // ascending

    const nonSpadeCards = validIndices
      .filter(i => hand[i].suit !== SPADES)
      .map(i => ({ idx: i, card: hand[i] }))
      .sort((a, b) => a.card.rank - b.card.rank); // ascending

    if (partnerWinning) {
      // Partner is winning, dump lowest off-suit card
      if (nonSpadeCards.length > 0) return nonSpadeCards[0].idx;
      // Only have spades, play lowest
      return spadeCards[0].idx;
    }

    // Try to trump with lowest spade that wins
    if (spadeCards.length > 0) {
      if (currentWinner.suit === SPADES) {
        // Need a higher spade
        for (const c of spadeCards) {
          if (c.card.rank > currentWinner.rank) return c.idx;
        }
        // Can't over-trump, dump lowest off-suit
        if (nonSpadeCards.length > 0) return nonSpadeCards[0].idx;
        return spadeCards[0].idx;
      }
      // Trump with lowest spade
      return spadeCards[0].idx;
    }

    // No spades, play lowest card
    if (nonSpadeCards.length > 0) return nonSpadeCards[0].idx;
    return validIndices[0];
  }

  /* ====== Cleanup ====== */

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = SpadesBotPlayer;
