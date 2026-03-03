'use strict';

const CardDeck = require('./CardDeck');

class CrazyEightsGame {
  /**
   * @param {number} playerCount - Number of players (2-6)
   */
  constructor(playerCount) {
    if (playerCount < 2 || playerCount > 6) {
      throw new Error('Crazy Eights requires 2-6 players');
    }

    this.playerCount = playerCount;
    const deck = new CardDeck();
    deck.shuffle();

    // Deal cards: 7 for 2 players, 5 for 3+ players
    const cardsPerPlayer = playerCount <= 2 ? 7 : 5;
    this.hands = [];
    for (let p = 0; p < playerCount; p++) {
      this.hands.push(deck.draw(cardsPerPlayer));
    }

    // Remaining cards become draw pile
    this.drawPile = deck.cards.slice(); // copy remaining cards

    // Flip top card to start discard pile
    // If it's an 8, put it back and reshuffle until we get a non-8
    let startCard = this.drawPile.pop();
    while (startCard.rank === 8) {
      this.drawPile.unshift(startCard);
      CardDeck.shuffleArray(this.drawPile);
      startCard = this.drawPile.pop();
    }
    this.discardPile = [startCard];

    this.currentTurn = 0;
    this.chosenSuit = null;   // Set when an 8 is played
    this.gameOver = false;
    this.winner = null;
    this.direction = 1;       // 1 = clockwise, -1 = counter-clockwise
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      playerCount: this.playerCount,
      handCounts: this.hands.map(h => h.length),
      discardTop: this.discardPile.length > 0
        ? { ...this.discardPile[this.discardPile.length - 1] }
        : null,
      drawPileCount: this.drawPile.length,
      currentTurn: this.currentTurn,
      chosenSuit: this.chosenSuit,
      gameOver: this.gameOver,
      winner: this.winner,
      direction: this.direction
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
      discardTop: this.discardPile.length > 0
        ? { ...this.discardPile[this.discardPile.length - 1] }
        : null,
      drawPileCount: this.drawPile.length,
      currentTurn: this.currentTurn,
      chosenSuit: this.chosenSuit,
      gameOver: this.gameOver,
      winner: this.winner,
      direction: this.direction,
      playableCards: this.getPlayableCards(idx)
    };
  }

  /**
   * Play a card from the player's hand.
   * @param {number} playerIdx - The player index
   * @param {number} cardIndex - Index of the card in the player's hand
   * @param {number|null} chosenSuit - Required when playing an 8 (0-3), ignored otherwise
   * @returns {{ valid, error, card, gameOver, nextTurn }}
   */
  playCard(playerIdx, cardIndex, chosenSuit) {
    if (this.gameOver) {
      return { valid: false, error: 'Game is already over' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (cardIndex < 0 || cardIndex >= this.hands[playerIdx].length) {
      return { valid: false, error: 'Invalid card index' };
    }

    const card = this.hands[playerIdx][cardIndex];

    // Validate the card can be played
    if (!this._isPlayable(card)) {
      return { valid: false, error: 'Card cannot be played on the current discard' };
    }

    // If playing an 8, chosenSuit is required
    if (card.rank === 8) {
      if (chosenSuit === null || chosenSuit === undefined || chosenSuit < 0 || chosenSuit > 3) {
        return { valid: false, error: 'Must choose a suit (0-3) when playing an 8' };
      }
      this.chosenSuit = chosenSuit;
    } else {
      this.chosenSuit = null;
    }

    // Remove card from hand and add to discard pile
    this.hands[playerIdx].splice(cardIndex, 1);
    this.discardPile.push(card);

    // Check for game over
    const gameOverResult = this.checkGameOver();
    if (gameOverResult.over) {
      this.gameOver = true;
      this.winner = gameOverResult.winner;
      return {
        valid: true,
        error: null,
        card: { ...card },
        gameOver: gameOverResult,
        nextTurn: null
      };
    }

    // Advance turn
    this._advanceTurn();

    return {
      valid: true,
      error: null,
      card: { ...card },
      gameOver: { over: false },
      nextTurn: this.currentTurn
    };
  }

  /**
   * Draw a card from the draw pile.
   * If the draw pile is empty, shuffle the discard pile (except top) back in.
   * After drawing, if the drawn card is playable, player can play it next;
   * otherwise turn passes to the next player.
   *
   * @param {number} playerIdx
   * @returns {{ valid, error, card, drawPileCount, turnPassed }}
   */
  drawCard(playerIdx) {
    if (this.gameOver) {
      return { valid: false, error: 'Game is already over' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }

    // If draw pile is empty, recycle discard pile
    if (this.drawPile.length === 0) {
      this._recycleDiscard();
    }

    // If still empty after recycling, pass turn
    if (this.drawPile.length === 0) {
      this._advanceTurn();
      return {
        valid: true,
        error: null,
        card: null,
        drawPileCount: 0,
        turnPassed: true
      };
    }

    const card = this.drawPile.pop();
    this.hands[playerIdx].push(card);

    // If drawn card is playable, player keeps their turn to optionally play it.
    // Otherwise, turn passes.
    const isPlayable = this._isPlayable(card);
    if (!isPlayable) {
      this._advanceTurn();
    }

    return {
      valid: true,
      error: null,
      card: { ...card },
      drawPileCount: this.drawPile.length,
      turnPassed: !isPlayable
    };
  }

  /**
   * Get indices of cards in the player's hand that can legally be played.
   * @param {number} playerIdx
   * @returns {number[]}
   */
  getPlayableCards(playerIdx) {
    if (this.gameOver) return [];
    const indices = [];
    for (let i = 0; i < this.hands[playerIdx].length; i++) {
      if (this._isPlayable(this.hands[playerIdx][i])) {
        indices.push(i);
      }
    }
    return indices;
  }

  /**
   * Check if the game is over.
   * @returns {{ over, winner }}
   */
  checkGameOver() {
    for (let p = 0; p < this.playerCount; p++) {
      if (this.hands[p].length === 0) {
        return { over: true, winner: p };
      }
    }
    return { over: false, winner: null };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      playerCount: this.playerCount,
      hands: this.hands.map(h => h.map(c => CardDeck.encode(c))),
      drawPile: this.drawPile.map(c => CardDeck.encode(c)),
      discardPile: this.discardPile.map(c => CardDeck.encode(c)),
      currentTurn: this.currentTurn,
      chosenSuit: this.chosenSuit,
      gameOver: this.gameOver,
      winner: this.winner,
      direction: this.direction
    };
  }

  static deserialize(data) {
    // Create a shell instance and override state
    const g = Object.create(CrazyEightsGame.prototype);
    g.playerCount = data.playerCount;
    g.hands = data.hands.map(h => h.map(n => CardDeck.decode(n)));
    g.drawPile = (data.drawPile || []).map(n => CardDeck.decode(n));
    g.discardPile = (data.discardPile || []).map(n => CardDeck.decode(n));
    g.currentTurn = data.currentTurn;
    g.chosenSuit = data.chosenSuit;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.direction = data.direction;
    return g;
  }

  /* ---------- Internal helpers ---------- */

  /**
   * Check if a card can be played on the current discard pile.
   * A card is playable if:
   *   - Its rank is 8 (wild)
   *   - Its suit matches the discard top suit (or chosenSuit if an 8 was last played)
   *   - Its rank matches the discard top rank
   */
  _isPlayable(card) {
    // 8s are always playable
    if (card.rank === 8) return true;

    const top = this.discardPile[this.discardPile.length - 1];
    if (!top) return true; // No discard top = anything playable

    // If an 8 was played, must match the chosen suit
    if (this.chosenSuit !== null) {
      return card.suit === this.chosenSuit;
    }

    // Match suit or rank
    return card.suit === top.suit || card.rank === top.rank;
  }

  /**
   * Advance currentTurn to the next player in the current direction.
   */
  _advanceTurn() {
    this.currentTurn = ((this.currentTurn + this.direction) % this.playerCount + this.playerCount) % this.playerCount;
  }

  /**
   * Shuffle the discard pile (except the top card) back into the draw pile.
   */
  _recycleDiscard() {
    if (this.discardPile.length <= 1) return;

    const top = this.discardPile.pop();
    this.drawPile = this.discardPile.slice();
    this.discardPile = [top];
    CardDeck.shuffleArray(this.drawPile);
  }
}

module.exports = CrazyEightsGame;
