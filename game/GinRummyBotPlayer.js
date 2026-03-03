'use strict';

/**
 * GinRummyBotPlayer -- Bot for Gin Rummy.
 *
 * Strategy:
 *   - Draw: take from discard if it completes or extends a meld, otherwise draw from pile.
 *   - Discard: discard the card with the highest deadwood contribution
 *     that is not part of any meld or partial meld.
 *   - Knock when deadwood <= 10, gin immediately when deadwood = 0.
 */

class GinRummyBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `gr_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

    if (event === 'gr:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      if (data.myHand) this._hand = data.myHand;
      else if (data.hand) this._hand = data.hand;
      if (data.currentTurn === this.playerIndex && data.phase === 'draw') {
        this._scheduleDraw(data);
      }
    } else if (event === 'gr:update') {
      if (data.myHand) this._hand = data.myHand;
      else if (data.hand) this._hand = data.hand;
      if (data.currentTurn === this.playerIndex && !data.gameOver) {
        if (data.phase === 'draw') {
          this._scheduleDraw(data);
        } else if (data.phase === 'discard') {
          this._scheduleDiscard(data);
        }
      }
    } else if (event === 'gr:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 1500 + Math.random() * 1500; // 1500-3000ms
  }

  /* ---------- Draw Phase ---------- */

  _scheduleDraw(data) {
    if (this.destroyed || this._paused || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executeDraw(data);
    }, this._thinkMs());
  }

  _executeDraw(data) {
    if (this.destroyed) return;

    const discardTop = data.discardTop || null;

    // Check if the discard top card completes or extends a meld
    if (discardTop && this._wouldImproveHand(discardTop)) {
      this.matchmaker.grDrawFromDiscard(this.socket);
    } else {
      this.matchmaker.grDrawFromPile(this.socket);
    }
  }

  /**
   * Check if adding a card to the hand would complete or extend a meld.
   * Returns true if the card fits into a set or run with existing hand cards.
   */
  _wouldImproveHand(card) {
    // Check for set potential: how many cards of the same rank do we have?
    let sameRank = 0;
    for (const c of this._hand) {
      if (c.rank === card.rank) sameRank++;
    }
    // Completes a set of 3 or extends to 4
    if (sameRank >= 2) return true;

    // Check for run potential: consecutive same-suit cards
    const sameSuitCards = this._hand
      .filter(c => c.suit === card.suit)
      .map(c => c.rank)
      .sort((a, b) => a - b);

    // Count how many neighbors the card has in the run
    let neighbors = 0;
    for (const r of sameSuitCards) {
      if (Math.abs(r - card.rank) === 1) neighbors++;
    }
    // Card connects two existing cards or extends an existing run
    if (neighbors >= 2) return true;

    // Check if this card plus one neighbor plus one more form a run of 3
    if (neighbors >= 1) {
      // Check if there's a pair of consecutive cards around this card
      for (let i = 0; i < sameSuitCards.length - 1; i++) {
        if (sameSuitCards[i + 1] - sameSuitCards[i] === 1) {
          // We have a consecutive pair; does our card extend it?
          if (card.rank === sameSuitCards[i] - 1 || card.rank === sameSuitCards[i + 1] + 1) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /* ---------- Discard Phase ---------- */

  _scheduleDiscard(data) {
    if (this.destroyed || this._paused || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executeDiscard();
    }, this._thinkMs());
  }

  _executeDiscard() {
    if (this.destroyed || this._hand.length === 0) return;

    // Find the best arrangement of melds to identify deadwood
    const meldResult = this._findBestMelds(this._hand);
    const deadwoodValue = meldResult.deadwoodValue;

    // If gin (0 deadwood), declare gin with any card from deadwood (shouldn't happen, but handle)
    // After discarding we need 10 cards forming melds for gin
    // Actually: we have 11 cards after drawing. We discard 1 to get back to 10.
    // Find the card whose removal minimizes deadwood.
    let bestDiscardIdx = -1;
    let bestDeadwood = Infinity;

    for (let i = 0; i < this._hand.length; i++) {
      const tempHand = [...this._hand];
      tempHand.splice(i, 1);
      const result = this._findBestMelds(tempHand);
      if (result.deadwoodValue < bestDeadwood) {
        bestDeadwood = result.deadwoodValue;
        bestDiscardIdx = i;
      }
    }

    if (bestDiscardIdx === -1) {
      bestDiscardIdx = this._hand.length - 1;
    }

    // Gin: deadwood = 0 after discard
    if (bestDeadwood === 0) {
      this.matchmaker.grKnock(this.socket, bestDiscardIdx);
      return;
    }

    // Knock: deadwood <= 10 after discard
    if (bestDeadwood <= 10) {
      this.matchmaker.grKnock(this.socket, bestDiscardIdx);
      return;
    }

    // Normal discard
    this.matchmaker.grDiscard(this.socket, bestDiscardIdx);
  }

  /* ---------- Meld Finding (simplified) ---------- */

  /**
   * Find the best arrangement of melds that minimizes deadwood.
   * Simplified version for bot decision making.
   */
  _findBestMelds(hand) {
    const allMelds = this._findAllPossibleMelds(hand);

    if (allMelds.length === 0) {
      const dwValue = hand.reduce((sum, c) => sum + this._cardPoints(c), 0);
      return { melds: [], deadwood: [...hand], deadwoodValue: dwValue };
    }

    let bestResult = {
      melds: [],
      deadwood: [...hand],
      deadwoodValue: hand.reduce((sum, c) => sum + this._cardPoints(c), 0)
    };

    const tryMelds = (meldIdx, usedCards, currentMelds) => {
      const remaining = hand.filter((_, i) => !usedCards.has(i));
      const dwValue = remaining.reduce((sum, c) => sum + this._cardPoints(c), 0);

      if (dwValue < bestResult.deadwoodValue) {
        bestResult = {
          melds: currentMelds.map(m => [...m]),
          deadwood: [...remaining],
          deadwoodValue: dwValue
        };
      }

      if (dwValue === 0) return;

      for (let i = meldIdx; i < allMelds.length; i++) {
        const meld = allMelds[i];
        const meldIndices = this._findMeldIndices(hand, meld, usedCards);
        if (!meldIndices) continue;

        const newUsed = new Set(usedCards);
        for (const idx of meldIndices) newUsed.add(idx);

        currentMelds.push(meld);
        tryMelds(i + 1, newUsed, currentMelds);
        currentMelds.pop();
      }
    };

    tryMelds(0, new Set(), []);
    return bestResult;
  }

  _findMeldIndices(hand, meld, usedCards) {
    const indices = [];
    const tempUsed = new Set(usedCards);

    for (const meldCard of meld) {
      let found = false;
      for (let i = 0; i < hand.length; i++) {
        if (!tempUsed.has(i) && hand[i].suit === meldCard.suit && hand[i].rank === meldCard.rank) {
          indices.push(i);
          tempUsed.add(i);
          found = true;
          break;
        }
      }
      if (!found) return null;
    }

    return indices;
  }

  _findAllPossibleMelds(hand) {
    const melds = [];

    // Find sets (3-4 cards of the same rank)
    const byRank = {};
    for (const card of hand) {
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    for (const rank in byRank) {
      const cards = byRank[rank];
      if (cards.length >= 3) {
        if (cards.length === 3) {
          melds.push([...cards]);
        } else {
          melds.push([...cards]);
          for (let skip = 0; skip < cards.length; skip++) {
            melds.push(cards.filter((_, i) => i !== skip));
          }
        }
      }
    }

    // Find runs (3+ consecutive same suit)
    const bySuit = [[], [], [], []];
    for (const card of hand) {
      bySuit[card.suit].push(card);
    }

    for (let suit = 0; suit < 4; suit++) {
      const suitCards = bySuit[suit].sort((a, b) => a.rank - b.rank);
      if (suitCards.length < 3) continue;

      for (let start = 0; start < suitCards.length; start++) {
        const run = [suitCards[start]];
        for (let next = start + 1; next < suitCards.length; next++) {
          if (suitCards[next].rank === run[run.length - 1].rank + 1) {
            run.push(suitCards[next]);
            if (run.length >= 3) {
              melds.push([...run]);
            }
          } else {
            break;
          }
        }
      }
    }

    return melds;
  }

  /**
   * Card point value for Gin Rummy: A=1, 2-10=face, J/Q/K=10
   */
  _cardPoints(card) {
    if (card.rank === 14) return 1; // Ace
    if (card.rank >= 11) return 10; // J, Q, K
    return card.rank; // 2-10
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = GinRummyBotPlayer;
