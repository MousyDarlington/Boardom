'use strict';

/**
 * CardDeck — Shared card system for all card games.
 *
 * Card representation:
 *   { suit: 0-3, rank: 2-14 }
 *   Suits: 0=clubs, 1=diamonds, 2=hearts, 3=spades
 *   Ranks: 2-10, 11=Jack, 12=Queen, 13=King, 14=Ace
 *
 * Compact integer encoding: suit * 13 + (rank - 2)  →  0..51
 */

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_SYMBOLS = ['\u2663', '\u2666', '\u2665', '\u2660']; // ♣ ♦ ♥ ♠
const RANK_NAMES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

class CardDeck {
  /**
   * @param {number} deckCount - Number of standard 52-card decks to combine (default 1)
   */
  constructor(deckCount = 1) {
    this.deckCount = deckCount;
    this.cards = [];
    this.discardPile = [];
    this.reset();
  }

  /* ---------- Instance Methods ---------- */

  /** Rebuild the deck with deckCount * 52 cards and shuffle */
  reset() {
    this.cards = [];
    this.discardPile = [];
    for (let d = 0; d < this.deckCount; d++) {
      for (let suit = 0; suit < 4; suit++) {
        for (let rank = 2; rank <= 14; rank++) {
          this.cards.push({ suit, rank });
        }
      }
    }
    this.shuffle();
  }

  /** Fisher-Yates shuffle in-place */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /** Draw count cards from top of deck. Returns array of cards. */
  draw(count = 1) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.cards.length === 0) break;
      drawn.push(this.cards.pop());
    }
    return drawn;
  }

  /** Draw a single card from top. Returns card or null. */
  drawOne() {
    return this.cards.length > 0 ? this.cards.pop() : null;
  }

  /** Look at top card(s) without removing. */
  peek(count = 1) {
    const result = [];
    const start = Math.max(0, this.cards.length - count);
    for (let i = this.cards.length - 1; i >= start; i--) {
      result.push({ ...this.cards[i] });
    }
    return result;
  }

  /** Add cards to bottom of deck */
  addToBottom(cards) {
    this.cards.unshift(...cards);
  }

  /** Add cards to top of deck */
  addToTop(cards) {
    this.cards.push(...cards);
  }

  /** Add cards to discard pile */
  discard(cards) {
    this.discardPile.push(...cards);
  }

  /** Shuffle discard pile back into deck */
  recycleDiscard() {
    this.cards.unshift(...this.discardPile);
    this.discardPile = [];
    this.shuffle();
  }

  get remaining() {
    return this.cards.length;
  }

  /* ---------- Static Card Utilities ---------- */

  /** Create a fresh ordered 52-card array */
  static createStandard52() {
    const cards = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) {
        cards.push({ suit, rank });
      }
    }
    return cards;
  }

  /** Shuffle an array of cards in-place (Fisher-Yates) */
  static shuffleArray(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  /** Sort hand by suit then rank (or by rank then suit) */
  static sortHand(cards, bySuit = true) {
    return [...cards].sort((a, b) => {
      if (bySuit) {
        if (a.suit !== b.suit) return a.suit - b.suit;
        return a.rank - b.rank;
      }
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.suit - b.suit;
    });
  }

  /** Card to human-readable string, e.g. "A♠" */
  static cardToString(card) {
    return RANK_NAMES[card.rank - 2] + SUIT_SYMBOLS[card.suit];
  }

  /** Compare two cards. Returns negative if a < b, 0 if equal, positive if a > b. */
  static compareCards(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.suit - b.suit;
  }

  /** Encode card as integer 0..51 */
  static encode(card) {
    return card.suit * 13 + (card.rank - 2);
  }

  /** Decode integer 0..51 to card */
  static decode(n) {
    return { suit: Math.floor(n / 13), rank: (n % 13) + 2 };
  }

  /** Check if card is red (diamonds or hearts) */
  static isRed(card) {
    return card.suit === 1 || card.suit === 2;
  }

  /** Check if two cards are equal */
  static equals(a, b) {
    return a.suit === b.suit && a.rank === b.rank;
  }

  /* ---------- Poker Hand Evaluation ---------- */

  /**
   * Evaluate the best 5-card poker hand from an array of 5-7 cards.
   * Returns { rank: 0-9, name: string, hand: [...5 cards], kickers: [...] }
   *
   * Ranks:
   *   0 = High Card
   *   1 = One Pair
   *   2 = Two Pair
   *   3 = Three of a Kind
   *   4 = Straight
   *   5 = Flush
   *   6 = Full House
   *   7 = Four of a Kind
   *   8 = Straight Flush
   *   9 = Royal Flush
   */
  static evaluatePokerHand(cards) {
    if (cards.length < 5) return null;

    // If more than 5 cards, find the best 5-card combination
    if (cards.length > 5) {
      let best = null;
      const combos = CardDeck._combinations(cards, 5);
      for (const combo of combos) {
        const result = CardDeck._evaluate5(combo);
        if (!best || CardDeck._compareHandRanks(result, best) > 0) {
          best = result;
        }
      }
      return best;
    }

    return CardDeck._evaluate5(cards);
  }

  /** Evaluate exactly 5 cards */
  static _evaluate5(cards) {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank); // descending
    const ranks = sorted.map(c => c.rank);
    const suits = sorted.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);

    // Check straight (including wheel: A-2-3-4-5)
    let isStraight = false;
    let straightHigh = 0;
    if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
      isStraight = true;
      straightHigh = ranks[0];
    }
    // Wheel: A-5-4-3-2
    if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
      isStraight = true;
      straightHigh = 5; // 5-high straight
    }

    // Count ranks
    const counts = {};
    for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
    const countValues = Object.values(counts).sort((a, b) => b - a);
    const countEntries = Object.entries(counts)
      .map(([r, c]) => ({ rank: parseInt(r), count: c }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank);

    if (isFlush && isStraight) {
      if (straightHigh === 14) {
        return { rank: 9, name: 'Royal Flush', hand: sorted, kickers: [] };
      }
      return { rank: 8, name: 'Straight Flush', hand: sorted, kickers: [straightHigh] };
    }

    if (countValues[0] === 4) {
      const quadRank = countEntries[0].rank;
      const kicker = countEntries[1].rank;
      return { rank: 7, name: 'Four of a Kind', hand: sorted, kickers: [quadRank, kicker] };
    }

    if (countValues[0] === 3 && countValues[1] === 2) {
      return { rank: 6, name: 'Full House', hand: sorted, kickers: [countEntries[0].rank, countEntries[1].rank] };
    }

    if (isFlush) {
      return { rank: 5, name: 'Flush', hand: sorted, kickers: ranks };
    }

    if (isStraight) {
      return { rank: 4, name: 'Straight', hand: sorted, kickers: [straightHigh] };
    }

    if (countValues[0] === 3) {
      const tripRank = countEntries[0].rank;
      const kickers = countEntries.filter(e => e.count === 1).map(e => e.rank);
      return { rank: 3, name: 'Three of a Kind', hand: sorted, kickers: [tripRank, ...kickers] };
    }

    if (countValues[0] === 2 && countValues[1] === 2) {
      const pair1 = countEntries[0].rank;
      const pair2 = countEntries[1].rank;
      const kicker = countEntries[2].rank;
      return { rank: 2, name: 'Two Pair', hand: sorted, kickers: [Math.max(pair1, pair2), Math.min(pair1, pair2), kicker] };
    }

    if (countValues[0] === 2) {
      const pairRank = countEntries[0].rank;
      const kickers = countEntries.filter(e => e.count === 1).map(e => e.rank);
      return { rank: 1, name: 'One Pair', hand: sorted, kickers: [pairRank, ...kickers] };
    }

    return { rank: 0, name: 'High Card', hand: sorted, kickers: ranks };
  }

  /**
   * Compare two evaluated poker hands.
   * Returns positive if hand1 wins, negative if hand2 wins, 0 for tie.
   */
  static comparePokerHands(hand1, hand2) {
    return CardDeck._compareHandRanks(hand1, hand2);
  }

  static _compareHandRanks(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    // Compare kickers in order
    for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
      if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
    }
    return 0;
  }

  /** Generate all C(n,k) combinations of an array */
  static _combinations(arr, k) {
    const results = [];
    const combo = [];
    function recurse(start) {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        recurse(i + 1);
        combo.pop();
      }
    }
    recurse(0);
    return results;
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      deckCount: this.deckCount,
      cards: this.cards.map(c => CardDeck.encode(c)),
      discardPile: this.discardPile.map(c => CardDeck.encode(c))
    };
  }

  static deserialize(data) {
    const deck = new CardDeck(data.deckCount || 1);
    deck.cards = (data.cards || []).map(n => CardDeck.decode(n));
    deck.discardPile = (data.discardPile || []).map(n => CardDeck.decode(n));
    return deck;
  }
}

// Export constants alongside the class
CardDeck.SUITS = SUITS;
CardDeck.SUIT_SYMBOLS = SUIT_SYMBOLS;
CardDeck.RANK_NAMES = RANK_NAMES;

module.exports = CardDeck;
