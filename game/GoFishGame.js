'use strict';

const CardDeck = require('./CardDeck');

class GoFishGame {
  /**
   * @param {number} playerCount - Number of players (2-4)
   */
  constructor(playerCount) {
    if (playerCount < 2 || playerCount > 4) {
      throw new Error('Go Fish requires 2-4 players');
    }

    this.playerCount = playerCount;
    const deck = new CardDeck();
    deck.shuffle();

    // Deal cards: 7 for 2-3 players, 5 for 4 players
    const cardsPerPlayer = playerCount <= 3 ? 7 : 5;
    this.hands = [];
    for (let p = 0; p < playerCount; p++) {
      this.hands.push(deck.draw(cardsPerPlayer));
    }

    // Remaining cards become the ocean (draw pile)
    this.ocean = deck.cards.slice();

    // Book tracking
    this.books = new Array(playerCount).fill(0);         // Count per player
    this.bookDetails = Array.from({ length: playerCount }, () => []); // Ranks collected

    this.currentTurn = 0;
    this.lastAction = null;  // Description of the last action taken
    this.gameOver = false;
    this.winner = null;

    // Check for any initial books from the deal
    for (let p = 0; p < playerCount; p++) {
      this._checkBooks(p);
    }
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      playerCount: this.playerCount,
      handCounts: this.hands.map(h => h.length),
      books: [...this.books],
      bookDetails: this.bookDetails.map(bd => [...bd]),
      oceanSize: this.ocean.length,
      currentTurn: this.currentTurn,
      lastAction: this.lastAction,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }

  getStateForPlayer(idx) {
    const opponentHandSizes = [];
    for (let p = 0; p < this.playerCount; p++) {
      if (p !== idx) {
        opponentHandSizes.push({ player: p, count: this.hands[p].length });
      }
    }

    return {
      hand: this.hands[idx].map(c => ({ ...c })),
      opponentHandSizes,
      books: [...this.books],
      bookDetails: this.bookDetails.map(bd => [...bd]),
      oceanSize: this.ocean.length,
      currentTurn: this.currentTurn,
      lastAction: this.lastAction,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }

  /**
   * Ask another player for cards of a specific rank.
   *
   * @param {number} playerIdx - The asking player's index
   * @param {number} targetIdx - The target player's index
   * @param {number} rank - The rank being asked for (2-14)
   * @returns {{ valid, error, gotCards, cardsReceived, goFish, drawnCardMatchesRank, newBooks, gameOver }}
   */
  askForCard(playerIdx, targetIdx, rank) {
    if (this.gameOver) {
      return { valid: false, error: 'Game is already over' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (targetIdx === playerIdx) {
      return { valid: false, error: 'Cannot ask yourself' };
    }
    if (targetIdx < 0 || targetIdx >= this.playerCount) {
      return { valid: false, error: 'Invalid target player' };
    }
    if (rank < 2 || rank > 14) {
      return { valid: false, error: 'Invalid rank' };
    }

    // Player must have at least one card of the requested rank
    const hasRank = this.hands[playerIdx].some(c => c.rank === rank);
    if (!hasRank) {
      return { valid: false, error: 'You must have at least one card of the requested rank' };
    }

    const rankName = CardDeck.RANK_NAMES[rank - 2];

    // Check if target has cards of that rank
    const matchingCards = [];
    const remainingCards = [];
    for (const card of this.hands[targetIdx]) {
      if (card.rank === rank) {
        matchingCards.push(card);
      } else {
        remainingCards.push(card);
      }
    }

    let gotCards = false;
    let cardsReceived = 0;
    let goFish = false;
    let drawnCardMatchesRank = false;
    let newBooks = [];

    if (matchingCards.length > 0) {
      // Target has cards of that rank — transfer all of them
      gotCards = true;
      cardsReceived = matchingCards.length;
      this.hands[targetIdx] = remainingCards;
      this.hands[playerIdx].push(...matchingCards);

      this.lastAction = `Player ${playerIdx} took ${cardsReceived} ${rankName}(s) from Player ${targetIdx}`;

      // Check for new books
      newBooks = this._checkBooks(playerIdx);

      // Same player goes again (turn does not change)
      // But first check if player's hand is empty and needs to draw
      this._refillEmptyHand(playerIdx);

      // Check for game over
      const gameOverResult = this.checkGameOver();
      if (gameOverResult.over) {
        this.gameOver = true;
        this.winner = gameOverResult.winner;
      }

      return {
        valid: true,
        error: null,
        gotCards,
        cardsReceived,
        goFish,
        drawnCardMatchesRank,
        newBooks,
        gameOver: { over: this.gameOver, winner: this.winner }
      };
    } else {
      // Target does not have the rank — "Go Fish"
      goFish = true;
      this.lastAction = `Player ${playerIdx} asked Player ${targetIdx} for ${rankName}s — Go Fish!`;

      // Draw from ocean
      if (this.ocean.length > 0) {
        const drawnCard = this.ocean.pop();
        this.hands[playerIdx].push(drawnCard);

        if (drawnCard.rank === rank) {
          drawnCardMatchesRank = true;
          this.lastAction += ` Drew the card they asked for!`;
          // Player goes again
        } else {
          // Turn passes to next player
          this._advanceTurn();
        }

        // Check for new books
        newBooks = this._checkBooks(playerIdx);
      } else {
        // No cards in ocean, turn passes
        this._advanceTurn();
      }

      // If current player's hand is empty, try to refill
      this._refillEmptyHand(this.currentTurn);

      // Check for game over
      const gameOverResult = this.checkGameOver();
      if (gameOverResult.over) {
        this.gameOver = true;
        this.winner = gameOverResult.winner;
      }

      return {
        valid: true,
        error: null,
        gotCards,
        cardsReceived,
        goFish,
        drawnCardMatchesRank,
        newBooks,
        gameOver: { over: this.gameOver, winner: this.winner }
      };
    }
  }

  /**
   * Check if the game is over.
   * Game ends when all 13 books have been collected, or when all hands are empty
   * and the ocean is empty.
   *
   * @returns {{ over, winner }}
   */
  checkGameOver() {
    const totalBooks = this.books.reduce((sum, b) => sum + b, 0);

    // All 13 books collected
    if (totalBooks >= 13) {
      return { over: true, winner: this._findWinner() };
    }

    // Check if all hands are empty and ocean is empty
    const allHandsEmpty = this.hands.every(h => h.length === 0);
    if (allHandsEmpty && this.ocean.length === 0) {
      return { over: true, winner: this._findWinner() };
    }

    // Check if only the current player has cards and ocean is empty
    // and no other player can be asked (all others have 0 cards)
    // In this case the game should continue until that player has only books left
    // Actually, if a player can't ask anyone (no valid targets), game ends
    if (this.ocean.length === 0) {
      const activePlayers = this.hands.filter(h => h.length > 0).length;
      if (activePlayers <= 1) {
        // Only one or no players have cards, and ocean is empty
        // Check remaining books from that player's hand, then end
        return { over: true, winner: this._findWinner() };
      }
    }

    return { over: false, winner: null };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      playerCount: this.playerCount,
      hands: this.hands.map(h => h.map(c => CardDeck.encode(c))),
      ocean: this.ocean.map(c => CardDeck.encode(c)),
      books: [...this.books],
      bookDetails: this.bookDetails.map(bd => [...bd]),
      currentTurn: this.currentTurn,
      lastAction: this.lastAction,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }

  static deserialize(data) {
    const g = Object.create(GoFishGame.prototype);
    g.playerCount = data.playerCount;
    g.hands = data.hands.map(h => h.map(n => CardDeck.decode(n)));
    g.ocean = (data.ocean || []).map(n => CardDeck.decode(n));
    g.books = data.books || new Array(data.playerCount).fill(0);
    g.bookDetails = data.bookDetails || Array.from({ length: data.playerCount }, () => []);
    g.currentTurn = data.currentTurn;
    g.lastAction = data.lastAction;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    return g;
  }

  /* ---------- Internal helpers ---------- */

  /**
   * Check if the player has 4 of any rank (a "book").
   * If so, remove them from the hand and record the book.
   * @param {number} playerIdx
   * @returns {number[]} Array of ranks that formed new books
   */
  _checkBooks(playerIdx) {
    const newBooks = [];
    const rankCounts = {};

    for (const card of this.hands[playerIdx]) {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }

    for (const [rankStr, count] of Object.entries(rankCounts)) {
      if (count >= 4) {
        const rank = parseInt(rankStr);
        // Remove all 4 cards of this rank
        this.hands[playerIdx] = this.hands[playerIdx].filter(c => c.rank !== rank);
        this.books[playerIdx]++;
        this.bookDetails[playerIdx].push(rank);
        newBooks.push(rank);
      }
    }

    return newBooks;
  }

  /**
   * If a player's hand is empty and there are cards in the ocean, draw one.
   * @param {number} playerIdx
   */
  _refillEmptyHand(playerIdx) {
    if (this.hands[playerIdx].length === 0 && this.ocean.length > 0) {
      const card = this.ocean.pop();
      this.hands[playerIdx].push(card);
    }
  }

  /**
   * Advance the turn to the next player who has cards (or can draw).
   */
  _advanceTurn() {
    const startTurn = this.currentTurn;
    for (let i = 1; i <= this.playerCount; i++) {
      const next = (startTurn + i) % this.playerCount;
      // Player can take a turn if they have cards, or if they can draw from ocean
      if (this.hands[next].length > 0 || this.ocean.length > 0) {
        this.currentTurn = next;
        // If this player has no cards but ocean has cards, draw one
        this._refillEmptyHand(next);
        return;
      }
    }
    // No valid next player — game should end
    this.currentTurn = startTurn;
  }

  /**
   * Find the winner: player with the most books.
   * @returns {number|null}
   */
  _findWinner() {
    let maxBooks = -1;
    let winner = null;
    let tied = false;

    for (let p = 0; p < this.playerCount; p++) {
      if (this.books[p] > maxBooks) {
        maxBooks = this.books[p];
        winner = p;
        tied = false;
      } else if (this.books[p] === maxBooks) {
        tied = true;
      }
    }

    // In case of a tie, return the first player with max books (or null for true tie)
    return tied ? null : winner;
  }
}

module.exports = GoFishGame;
