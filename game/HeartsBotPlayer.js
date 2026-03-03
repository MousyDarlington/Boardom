'use strict';

const CLUBS = 0;
const DIAMONDS = 1;
const HEARTS = 2;
const SPADES = 3;

const BOT_NAMES = [
  'HeartBreaker', 'MoonShooter', 'QueenDodger', 'LowRunner',
  'VoidMaster', 'CardSage', 'TrickDuck', 'SuitShifter',
  'HeartHunter', 'PointDodger', 'ClubStarter', 'SpadeQueen'
];

class HeartsBotPlayer {
  /**
   * @param {object} matchmaker - Matchmaker instance
   * @param {number} botRating - Rating to calibrate bot difficulty
   * @param {string} [name] - Optional display name override
   */
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `ht_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._paused = false;
    this._timer = null;

    // State tracked from events
    this._hand = [];
    this._scores = [0, 0, 0, 0];
    this._roundScores = [0, 0, 0, 0];
    this._currentTrick = [];
    this._heartsBroken = false;
    this._phase = 'passing';
    this._currentTurn = -1;
    this._passDirection = 0;
    this._firstTrick = true;
    this._trickNumber = 0;
    this._hasPassed = false;

    // Mock socket following CAHBotPlayer pattern
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

  /* ====== Event handling ====== */

  _onEvent(event, data) {
    if (this.destroyed || this._paused) return;

    if (event === 'ht:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      this._updateState(data);
      if (data.phase === 'passing' && !data.hasPassed) {
        this._schedulePass();
      } else if (data.phase === 'playing' && data.currentTurn === this.playerIndex) {
        this._schedulePlay();
      }
    } else if (event === 'ht:update') {
      this._updateState(data);
      if (data.phase === 'passing' && !this._hasPassed) {
        this._schedulePass();
      } else if (data.phase === 'playing' && data.currentTurn === this.playerIndex) {
        this._schedulePlay();
      }
    } else if (event === 'ht:over') {
      this.destroy();
    }
  }

  _updateState(data) {
    if (data.hand) this._hand = data.hand;
    if (data.scores) this._scores = data.scores;
    if (data.roundScores) this._roundScores = data.roundScores;
    if (data.currentTrick) this._currentTrick = data.currentTrick;
    if (data.heartsBroken !== undefined) this._heartsBroken = data.heartsBroken;
    if (data.phase) this._phase = data.phase;
    if (data.currentTurn !== undefined) this._currentTurn = data.currentTurn;
    if (data.passDirection !== undefined) this._passDirection = data.passDirection;
    if (data.firstTrick !== undefined) this._firstTrick = data.firstTrick;
    if (data.trickNumber !== undefined) this._trickNumber = data.trickNumber;
    if (data.hasPassed !== undefined) this._hasPassed = data.hasPassed;
  }

  /* ====== Timing ====== */

  _thinkMs() {
    return 1500 + Math.random() * 1500; // 1500-3000ms
  }

  _schedulePass() {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executePass();
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

  /* ====== Passing Logic ====== */

  _executePass() {
    if (this.destroyed) return;
    const hand = this._hand;
    if (!hand || hand.length === 0) return;

    const indices = this._choosePassCards();
    if (indices.length === 3) {
      this.matchmaker.heartsPassCards(this.socket, indices);
      this._hasPassed = true;
    }
  }

  _choosePassCards() {
    const hand = this._hand;
    if (!hand || hand.length < 3) return [];

    // Score each card by how much we want to get rid of it (higher = pass it away)
    const scored = hand.map((card, idx) => {
      let passScore = 0;

      // Queen of Spades: very dangerous, always pass if possible
      if (card.suit === SPADES && card.rank === 12) {
        passScore = 200;
      }
      // Ace and King of Spades: dangerous because they can catch QoS
      else if (card.suit === SPADES && card.rank === 14) {
        passScore = 150;
      }
      else if (card.suit === SPADES && card.rank === 13) {
        passScore = 140;
      }
      // High hearts: each is worth a point and high ones are hard to avoid taking
      else if (card.suit === HEARTS) {
        passScore = 50 + card.rank * 3;
      }
      // High cards in other suits: dangerous if we get void
      else {
        passScore = card.rank * 2;
      }

      // Prefer passing from suits where we have few cards (create voids)
      const suitCount = hand.filter(c => c.suit === card.suit).length;
      if (suitCount <= 2) {
        // Short suit: passing these cards creates a void, which is good
        passScore += 30;
      }

      return { idx, passScore };
    });

    // Sort descending by passScore and take top 3
    scored.sort((a, b) => b.passScore - a.passScore);
    const indices = scored.slice(0, 3).map(s => s.idx);

    return indices;
  }

  /* ====== Playing Logic ====== */

  _executePlay() {
    if (this.destroyed) return;
    const cardIndex = this._chooseCard();
    if (cardIndex >= 0) {
      this.matchmaker.heartsPlayCard(this.socket, cardIndex);
    }
  }

  _chooseCard() {
    const hand = this._hand;
    if (!hand || hand.length === 0) return -1;

    const validIndices = this._getValidCardIndices();
    if (validIndices.length === 0) return -1;
    if (validIndices.length === 1) return validIndices[0];

    if (this._currentTrick.length === 0) {
      return this._chooseLead(validIndices);
    } else {
      return this._chooseFollow(validIndices);
    }
  }

  _getValidCardIndices() {
    const hand = this._hand;
    const indices = [];

    if (this._currentTrick.length === 0) {
      // Leading

      // First trick, must lead 2 of clubs
      if (this._firstTrick && this._trickNumber === 1) {
        for (let i = 0; i < hand.length; i++) {
          if (hand[i].suit === CLUBS && hand[i].rank === 2) {
            return [i];
          }
        }
      }

      // Can't lead hearts unless broken or only hearts
      const hasNonHeart = hand.some(c => c.suit !== HEARTS);
      for (let i = 0; i < hand.length; i++) {
        if (hand[i].suit === HEARTS && !this._heartsBroken && hasNonHeart) continue;
        indices.push(i);
      }
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
        // Void in lead suit: can play anything
        // But first trick restriction: no hearts or QoS unless that's all we have
        if (this._firstTrick) {
          const nonPenalty = [];
          for (let i = 0; i < hand.length; i++) {
            if (hand[i].suit !== HEARTS && !(hand[i].suit === SPADES && hand[i].rank === 12)) {
              nonPenalty.push(i);
            }
          }
          if (nonPenalty.length > 0) {
            return nonPenalty;
          }
        }
        for (let i = 0; i < hand.length; i++) indices.push(i);
      }
    }

    return indices;
  }

  _chooseLead(validIndices) {
    const hand = this._hand;

    // Strategy: lead with lowest non-heart card to avoid taking points
    let bestIdx = -1;
    let bestScore = Infinity;

    for (const idx of validIndices) {
      const c = hand[idx];
      let score;

      if (c.suit === HEARTS) {
        // Hearts are undesirable to lead (unless forced)
        // Lead lowest heart if we must
        score = 100 + c.rank;
      } else if (c.suit === SPADES) {
        // Be careful with spades - low spades are okay, but high ones attract QoS
        if (c.rank >= 12) {
          score = 80 + c.rank; // Dangerous high spades
        } else {
          score = 30 + c.rank;
        }
      } else {
        // Clubs and diamonds: prefer leading low cards
        score = c.rank;
      }

      // Small random noise for variety
      score += Math.random() * 3;

      if (score < bestScore) {
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

    // Determine the current winning card (highest of lead suit)
    let winningRank = -1;
    for (const t of trick) {
      if (t.card.suit === leadSuit && t.card.rank > winningRank) {
        winningRank = t.card.rank;
      }
    }

    // Check if this trick has points in it
    let trickPoints = 0;
    for (const t of trick) {
      if (t.card.suit === HEARTS) trickPoints += 1;
      if (t.card.suit === SPADES && t.card.rank === 12) trickPoints += 13;
    }

    // Are we following suit?
    const followingSuit = hand[validIndices[0]].suit === leadSuit;

    if (followingSuit) {
      const cardsInSuit = validIndices
        .map(i => ({ idx: i, card: hand[i] }))
        .sort((a, b) => a.card.rank - b.card.rank); // ascending by rank

      // If trick has lots of points or QoS danger, try to play under
      // If we are last to play (trick has 3 cards) and trick has no points, we can safely win
      const isLast = trick.length === 3;

      if (isLast && trickPoints === 0) {
        // Safe to win - no points in this trick. Play highest card below winner, or if we must win, play lowest winner
        const below = cardsInSuit.filter(c => c.card.rank < winningRank);
        if (below.length > 0) {
          return below[below.length - 1].idx; // highest card that doesn't win
        }
        return cardsInSuit[0].idx; // play lowest
      }

      // Otherwise try to play under the winning card
      const below = cardsInSuit.filter(c => c.card.rank < winningRank);
      if (below.length > 0) {
        // Play highest card below winner (save low cards for later)
        return below[below.length - 1].idx;
      }

      // All our cards win the trick - play lowest to minimize damage
      return cardsInSuit[0].idx;
    }

    // Not following suit: this is our chance to dump penalty cards!
    // Priority: dump QoS > dump high hearts > dump high cards from any suit

    // Check for Queen of Spades
    for (const idx of validIndices) {
      if (hand[idx].suit === SPADES && hand[idx].rank === 12) {
        return idx; // Dump the Queen of Spades immediately
      }
    }

    // Dump highest hearts
    const heartCards = validIndices
      .filter(i => hand[i].suit === HEARTS)
      .map(i => ({ idx: i, card: hand[i] }))
      .sort((a, b) => b.card.rank - a.card.rank); // descending

    if (heartCards.length > 0) {
      return heartCards[0].idx; // Dump highest heart
    }

    // Dump highest card from any suit (Ace/King of spades are dangerous)
    const highSpades = validIndices
      .filter(i => hand[i].suit === SPADES && hand[i].rank >= 13)
      .map(i => ({ idx: i, card: hand[i] }))
      .sort((a, b) => b.card.rank - a.card.rank);

    if (highSpades.length > 0) {
      return highSpades[0].idx; // Dump A or K of spades
    }

    // Dump highest card from any suit
    const allCards = validIndices
      .map(i => ({ idx: i, card: hand[i] }))
      .sort((a, b) => b.card.rank - a.card.rank); // descending

    return allCards[0].idx;
  }

  /* ====== Cleanup ====== */

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = HeartsBotPlayer;
