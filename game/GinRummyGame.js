'use strict';

const CardDeck = require('./CardDeck');

class GinRummyGame {
  constructor() {
    this.playerCount = 2;
    this.deck = new CardDeck(1);

    // Player hands (10 cards each)
    this.hands = [[], []];

    // Piles
    this.drawPile = [];
    this.discardPile = [];

    // Game state
    this.currentTurn = 0;
    this.phase = 'draw'; // 'draw' | 'discard' | 'knock' | 'layoff' | 'scoring' | 'over'
    this.scores = [0, 0];
    this.targetScore = 100;
    this.knocker = null;
    this.deadwood = [null, null];
    this.melds = [null, null];

    // Layoff state
    this._layoffCards = [];
    this._opponentMelds = null;

    this._dealInitial();
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      hands: this.hands.map(h => h.map(c => ({ ...c }))),
      drawPileCount: this.drawPile.length,
      discardPile: this.discardPile.map(c => ({ ...c })),
      discardTop: this.discardPile.length > 0
        ? { ...this.discardPile[this.discardPile.length - 1] }
        : null,
      currentTurn: this.currentTurn,
      phase: this.phase,
      scores: [...this.scores],
      targetScore: this.targetScore,
      knocker: this.knocker,
      deadwood: this.deadwood.map(d => d !== null ? d : null),
      melds: this.melds.map(m => m ? m.map(meld => meld.map(c => ({ ...c }))) : null)
    };
  }

  /**
   * Return state visible to a specific player.
   * Player can see own hand, opponent hand count, top of discard, draw pile count.
   */
  getStateForPlayer(idx) {
    const opponentIdx = 1 - idx;
    return {
      myHand: this.hands[idx].map(c => ({ ...c })),
      opponentCardCount: this.hands[opponentIdx].length,
      discardTop: this.discardPile.length > 0
        ? { ...this.discardPile[this.discardPile.length - 1] }
        : null,
      drawPileCount: this.drawPile.length,
      currentTurn: this.currentTurn,
      phase: this.phase,
      scores: [...this.scores],
      targetScore: this.targetScore,
      knocker: this.knocker,
      deadwood: this.deadwood.map(d => d !== null ? d : null),
      melds: this.melds.map(m => m ? m.map(meld => meld.map(c => ({ ...c }))) : null),
      myIndex: idx
    };
  }

  /**
   * Draw from the draw pile.
   * @returns {{ valid: boolean, error?: string, card?: object }}
   */
  drawFromPile(playerIdx) {
    if (this.phase !== 'draw') {
      return { valid: false, error: 'Not in draw phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (this.drawPile.length === 0) {
      return { valid: false, error: 'Draw pile is empty' };
    }

    const card = this.drawPile.pop();
    this.hands[playerIdx].push(card);
    this.phase = 'discard';

    // Check if draw pile is depleted to 2 cards (game is a draw)
    if (this.drawPile.length <= 2) {
      this._endRoundDraw();
      return { valid: true, card: { ...card } };
    }

    return { valid: true, card: { ...card } };
  }

  /**
   * Draw from the top of the discard pile.
   * @returns {{ valid: boolean, error?: string, card?: object }}
   */
  drawFromDiscard(playerIdx) {
    if (this.phase !== 'draw') {
      return { valid: false, error: 'Not in draw phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (this.discardPile.length === 0) {
      return { valid: false, error: 'Discard pile is empty' };
    }

    const card = this.discardPile.pop();
    this.hands[playerIdx].push(card);
    this.phase = 'discard';

    return { valid: true, card: { ...card } };
  }

  /**
   * Discard a card from hand. Moves turn to next player.
   * @param {number} playerIdx
   * @param {number} cardIndex - Index of card in hand to discard
   * @returns {{ valid: boolean, error?: string }}
   */
  discard(playerIdx, cardIndex) {
    if (this.phase !== 'discard') {
      return { valid: false, error: 'Not in discard phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (cardIndex < 0 || cardIndex >= this.hands[playerIdx].length) {
      return { valid: false, error: 'Invalid card index' };
    }

    const card = this.hands[playerIdx].splice(cardIndex, 1)[0];
    this.discardPile.push(card);

    // Advance turn
    this.currentTurn = 1 - this.currentTurn;
    this.phase = 'draw';

    return { valid: true };
  }

  /**
   * Knock: discard a card and declare knock.
   * Deadwood must be <= 10 points.
   * @param {number} playerIdx
   * @param {number} cardIndex - Index of card to discard
   * @returns {{ valid: boolean, error?: string, melds?: Array, deadwood?: Array, deadwoodValue?: number }}
   */
  knock(playerIdx, cardIndex) {
    if (this.phase !== 'discard') {
      return { valid: false, error: 'Not in discard phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (cardIndex < 0 || cardIndex >= this.hands[playerIdx].length) {
      return { valid: false, error: 'Invalid card index' };
    }

    // Temporarily remove the card to check deadwood
    const tempHand = [...this.hands[playerIdx]];
    tempHand.splice(cardIndex, 1);
    const result = this._findBestMelds(tempHand);

    if (result.deadwoodValue > 10) {
      return { valid: false, error: 'Deadwood must be 10 or less to knock' };
    }

    // Actually discard and set up knock
    const card = this.hands[playerIdx].splice(cardIndex, 1)[0];
    this.discardPile.push(card);

    this.knocker = playerIdx;
    this.melds[playerIdx] = result.melds;
    this.deadwood[playerIdx] = result.deadwoodValue;

    // Find opponent melds (including layoffs against knocker's melds)
    const opponentIdx = 1 - playerIdx;
    const oppResult = this._findBestMelds(this.hands[opponentIdx]);
    this.melds[opponentIdx] = oppResult.melds;
    this.deadwood[opponentIdx] = oppResult.deadwoodValue;

    // Allow opponent to lay off cards against knocker's melds (if not gin)
    if (result.deadwoodValue === 0) {
      // Gin - no layoff allowed
      this.phase = 'scoring';
      this._scoreRound();
    } else {
      // Check if opponent can lay off any deadwood cards
      const canLayOff = this._findLayoffs(oppResult.deadwood, result.melds);
      if (canLayOff.length > 0) {
        // Auto-apply layoffs for simplicity
        this._applyLayoffs(opponentIdx, canLayOff, result.melds);
      }
      this.phase = 'scoring';
      this._scoreRound();
    }

    return {
      valid: true,
      melds: result.melds.map(m => m.map(c => ({ ...c }))),
      deadwood: result.deadwood.map(c => ({ ...c })),
      deadwoodValue: result.deadwoodValue
    };
  }

  /**
   * Gin: special knock with 0 deadwood. Bonus 25 points.
   * @param {number} playerIdx
   * @param {number} cardIndex
   * @returns {{ valid: boolean, error?: string, melds?: Array, deadwood?: Array }}
   */
  gin(playerIdx, cardIndex) {
    if (this.phase !== 'discard') {
      return { valid: false, error: 'Not in discard phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (cardIndex < 0 || cardIndex >= this.hands[playerIdx].length) {
      return { valid: false, error: 'Invalid card index' };
    }

    // Check for gin (0 deadwood after discarding)
    const tempHand = [...this.hands[playerIdx]];
    tempHand.splice(cardIndex, 1);
    const result = this._findBestMelds(tempHand);

    if (result.deadwoodValue !== 0) {
      return { valid: false, error: 'Must have 0 deadwood for gin' };
    }

    // This is gin - call knock which handles gin automatically
    return this.knock(playerIdx, cardIndex);
  }

  /**
   * Check if the overall game is over (someone reached target score).
   * @returns {{ over: boolean, winner?: number, scores?: number[] }}
   */
  checkGameOver() {
    if (this.phase !== 'over') {
      // Check if someone reached target score
      for (let i = 0; i < 2; i++) {
        if (this.scores[i] >= this.targetScore) {
          return { over: true, winner: i, scores: [...this.scores] };
        }
      }
      return { over: false };
    }
    // Determine winner by score
    const winner = this.scores[0] >= this.scores[1] ? 0 : 1;
    return { over: true, winner, scores: [...this.scores] };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      hands: this.hands.map(h => h.map(c => CardDeck.encode(c))),
      drawPile: this.drawPile.map(c => CardDeck.encode(c)),
      discardPile: this.discardPile.map(c => CardDeck.encode(c)),
      currentTurn: this.currentTurn,
      phase: this.phase,
      scores: [...this.scores],
      targetScore: this.targetScore,
      knocker: this.knocker,
      deadwood: [...this.deadwood],
      melds: this.melds.map(m =>
        m ? m.map(meld => meld.map(c => CardDeck.encode(c))) : null
      ),
      deck: this.deck.serialize()
    };
  }

  static deserialize(data) {
    const g = new GinRummyGame();
    // Override the dealt state
    g.hands = data.hands.map(h => h.map(n => CardDeck.decode(n)));
    g.drawPile = data.drawPile.map(n => CardDeck.decode(n));
    g.discardPile = data.discardPile.map(n => CardDeck.decode(n));
    g.currentTurn = data.currentTurn;
    g.phase = data.phase;
    g.scores = [...data.scores];
    g.targetScore = data.targetScore;
    g.knocker = data.knocker;
    g.deadwood = [...data.deadwood];
    g.melds = data.melds.map(m =>
      m ? m.map(meld => meld.map(n => CardDeck.decode(n))) : null
    );
    if (data.deck) {
      g.deck = CardDeck.deserialize(data.deck);
    }
    return g;
  }

  /* ---------- Internal Helpers ---------- */

  /**
   * Deal 10 cards to each player and place one face-up on discard pile.
   */
  _dealInitial() {
    // Draw pile = the deck's cards
    this.drawPile = this.deck.cards.splice(0);

    // Deal 10 cards to each player
    for (let round = 0; round < 10; round++) {
      for (let p = 0; p < 2; p++) {
        this.hands[p].push(this.drawPile.pop());
      }
    }

    // Place one card face-up on discard pile
    this.discardPile.push(this.drawPile.pop());

    // Sort hands for convenience
    this.hands[0] = CardDeck.sortHand(this.hands[0]);
    this.hands[1] = CardDeck.sortHand(this.hands[1]);
  }

  /**
   * Card point value: A=1, 2-10=face value, J/Q/K=10
   */
  _cardPoints(card) {
    if (card.rank === 14) return 1; // Ace
    if (card.rank >= 11) return 10; // J, Q, K
    return card.rank; // 2-10
  }

  /**
   * Find the best arrangement of melds that minimizes deadwood.
   * Melds are sets (3-4 same rank) or runs (3+ consecutive same suit).
   * @param {Array} hand - Array of cards
   * @returns {{ melds: Array<Array>, deadwood: Array, deadwoodValue: number }}
   */
  _findBestMelds(hand) {
    const allMelds = this._findAllPossibleMelds(hand);

    if (allMelds.length === 0) {
      const dwValue = hand.reduce((sum, c) => sum + this._cardPoints(c), 0);
      return { melds: [], deadwood: [...hand], deadwoodValue: dwValue };
    }

    // Try all combinations of non-overlapping melds to minimize deadwood
    let bestResult = {
      melds: [],
      deadwood: [...hand],
      deadwoodValue: hand.reduce((sum, c) => sum + this._cardPoints(c), 0)
    };

    const tryMelds = (meldIdx, usedCards, currentMelds) => {
      // Calculate deadwood for current arrangement
      const remaining = hand.filter((c, i) => !usedCards.has(i));
      const dwValue = remaining.reduce((sum, c) => sum + this._cardPoints(c), 0);

      if (dwValue < bestResult.deadwoodValue) {
        bestResult = {
          melds: currentMelds.map(m => [...m]),
          deadwood: [...remaining],
          deadwoodValue: dwValue
        };
      }

      if (dwValue === 0) return; // Can't do better than gin

      for (let i = meldIdx; i < allMelds.length; i++) {
        const meld = allMelds[i];
        // Find indices of meld cards in hand
        const meldIndices = this._findMeldIndices(hand, meld, usedCards);
        if (!meldIndices) continue; // Overlap with used cards

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

  /**
   * Find indices of meld cards in hand that haven't been used yet.
   */
  _findMeldIndices(hand, meld, usedCards) {
    const indices = [];
    const tempUsed = new Set(usedCards);

    for (const meldCard of meld) {
      let found = false;
      for (let i = 0; i < hand.length; i++) {
        if (!tempUsed.has(i) && CardDeck.equals(hand[i], meldCard)) {
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

  /**
   * Find all possible melds (sets and runs) in a hand.
   */
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
        // Add all 3-card combinations
        if (cards.length === 3) {
          melds.push([...cards]);
        } else {
          // 4 cards: add the set of 4, and all 3-card subsets
          melds.push([...cards]);
          for (let skip = 0; skip < cards.length; skip++) {
            const subset = cards.filter((_, i) => i !== skip);
            melds.push(subset);
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

      // Find all possible runs
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
   * Find deadwood cards that can be laid off against knocker's melds.
   */
  _findLayoffs(deadwoodCards, knockerMelds) {
    const layoffs = [];

    for (const card of deadwoodCards) {
      for (let meldIdx = 0; meldIdx < knockerMelds.length; meldIdx++) {
        const meld = knockerMelds[meldIdx];
        if (this._canLayOff(card, meld)) {
          layoffs.push({ card, meldIdx });
          break; // Only lay off to one meld
        }
      }
    }

    return layoffs;
  }

  /**
   * Check if a card can be added to an existing meld.
   */
  _canLayOff(card, meld) {
    if (meld.length === 0) return false;

    // Check if it's a set (all same rank)
    const isSet = meld.every(c => c.rank === meld[0].rank);
    if (isSet) {
      return card.rank === meld[0].rank && meld.length < 4;
    }

    // It's a run (consecutive same suit)
    if (card.suit !== meld[0].suit) return false;
    const sorted = [...meld].sort((a, b) => a.rank - b.rank);
    const minRank = sorted[0].rank;
    const maxRank = sorted[sorted.length - 1].rank;
    return card.rank === minRank - 1 || card.rank === maxRank + 1;
  }

  /**
   * Apply layoffs: reduce opponent's deadwood.
   */
  _applyLayoffs(opponentIdx, layoffs, knockerMelds) {
    let dwReduction = 0;
    for (const { card } of layoffs) {
      dwReduction += this._cardPoints(card);
    }
    if (this.deadwood[opponentIdx] !== null) {
      this.deadwood[opponentIdx] = Math.max(0, this.deadwood[opponentIdx] - dwReduction);
    }
  }

  /**
   * Score the round after knock/gin.
   * Knocker's deadwood vs opponent's deadwood.
   * Undercut: if opponent has less or equal deadwood, opponent gets 25 bonus.
   * Gin: knocker gets 25 bonus.
   */
  _scoreRound() {
    const knockerIdx = this.knocker;
    const opponentIdx = 1 - knockerIdx;

    const knockerDW = this.deadwood[knockerIdx];
    const opponentDW = this.deadwood[opponentIdx];

    if (knockerDW === 0) {
      // Gin: knocker gets opponent's deadwood + 25 bonus
      const points = opponentDW + 25;
      this.scores[knockerIdx] += points;
    } else if (opponentDW <= knockerDW) {
      // Undercut: opponent gets the difference + 25 bonus
      const points = (knockerDW - opponentDW) + 25;
      this.scores[opponentIdx] += points;
    } else {
      // Normal knock: knocker gets the difference
      const points = opponentDW - knockerDW;
      this.scores[knockerIdx] += points;
    }

    // Check if someone won the overall game
    const gameResult = this.checkGameOver();
    if (gameResult.over) {
      this.phase = 'over';
    } else {
      this.phase = 'over'; // Round is over; a new round should be started externally
    }
  }

  /**
   * End round as a draw (draw pile depleted).
   */
  _endRoundDraw() {
    // No score changes
    this.phase = 'over';
  }

  /**
   * Start a new round: reshuffle, redeal, reset round state.
   */
  startNewRound() {
    this.deck = new CardDeck(1);
    this.hands = [[], []];
    this.drawPile = [];
    this.discardPile = [];
    this.knocker = null;
    this.deadwood = [null, null];
    this.melds = [null, null];
    this._layoffCards = [];
    this._opponentMelds = null;

    // Alternate who goes first
    this.currentTurn = 1 - this.currentTurn;
    this.phase = 'draw';

    this._dealInitial();
  }
}

module.exports = GinRummyGame;
