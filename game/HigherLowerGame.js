'use strict';

const CardDeck = require('./CardDeck');

/**
 * HigherLowerGame -- Higher or Lower card game.
 *
 * A card is revealed and the player guesses whether the next card will be
 * higher or lower. Single player or multiplayer (turn-based).
 *
 * Card: { suit: 0-3, rank: 2-14 }
 * Comparison is by rank only. Equal counts as correct.
 */

class HigherLowerGame {
  constructor(playerCount = 1) {
    this.playerCount = playerCount;
    this.deck = new CardDeck();
    this.deck.shuffle();
    this.currentCard = this.deck.drawOne();
    this.scores = Array(playerCount).fill(0);
    this.streak = Array(playerCount).fill(0);
    this.bestStreak = Array(playerCount).fill(0);
    this.currentTurn = 0;
    this.phase = 'guessing'; // 'guessing' | 'reveal' | 'over'
    this.lastGuess = null;
    this.lastResult = null;
    this.revealedCard = null;
    this.gameOver = false;
    this.winner = null;
    this.roundNumber = 0;
    this.maxRounds = 20; // per player
    this.cardsPlayed = [];
    this._roundsPerPlayer = Array(playerCount).fill(0);
    this._eliminated = Array(playerCount).fill(false);

    if (this.currentCard) {
      this.cardsPlayed.push({ ...this.currentCard });
    }
  }

  /* ---------- Public API ---------- */

  /**
   * Player makes a guess: 'higher' or 'lower'.
   * Draw the next card, compare with the current card.
   *
   * @param {number} playerIdx - Index of the guessing player
   * @param {string} choice - 'higher' or 'lower'
   * @returns {{ valid: boolean, error?: string, currentCard?: object, revealedCard?: object,
   *             correct?: boolean, score?: number, streak?: number, gameOver?: boolean }}
   */
  guess(playerIdx, choice) {
    if (this.phase === 'over' || this.gameOver) {
      return { valid: false, error: 'Game is over' };
    }
    if (this.phase !== 'guessing') {
      return { valid: false, error: 'Not in guessing phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (choice !== 'higher' && choice !== 'lower') {
      return { valid: false, error: 'Choice must be "higher" or "lower"' };
    }
    if (this._eliminated[playerIdx]) {
      return { valid: false, error: 'Player is eliminated' };
    }

    // Draw the next card
    const nextCard = this.deck.drawOne();
    if (!nextCard) {
      // Deck exhausted -- end the game
      this._endGame();
      return {
        valid: true,
        currentCard: this.currentCard ? { ...this.currentCard } : null,
        revealedCard: null,
        correct: false,
        score: this.scores[playerIdx],
        streak: this.streak[playerIdx],
        gameOver: true
      };
    }

    // Compare ranks
    const currentRank = this.currentCard.rank;
    const nextRank = nextCard.rank;

    let correct = false;
    if (nextRank === currentRank) {
      // Equal counts as correct
      correct = true;
    } else if (choice === 'higher' && nextRank > currentRank) {
      correct = true;
    } else if (choice === 'lower' && nextRank < currentRank) {
      correct = true;
    }

    // Update state
    this.lastGuess = choice;
    this.revealedCard = { ...nextCard };
    this.lastResult = correct;
    this.cardsPlayed.push({ ...nextCard });

    if (correct) {
      this.scores[playerIdx]++;
      this.streak[playerIdx]++;
      if (this.streak[playerIdx] > this.bestStreak[playerIdx]) {
        this.bestStreak[playerIdx] = this.streak[playerIdx];
      }
    } else {
      this.streak[playerIdx] = 0;

      // Competitive mode (multiplayer): player is eliminated on wrong guess
      if (this.playerCount > 1) {
        this._eliminated[playerIdx] = true;
      }
    }

    // The revealed card becomes the new current card
    const previousCard = { ...this.currentCard };
    this.currentCard = { ...nextCard };

    // Count the round for this player
    this._roundsPerPlayer[playerIdx]++;
    this.roundNumber++;

    // Advance turn
    this._advanceTurn();

    // Check game over
    const isOver = this._checkGameOverInternal();

    return {
      valid: true,
      currentCard: previousCard,
      revealedCard: { ...nextCard },
      correct,
      score: this.scores[playerIdx],
      streak: this.streak[playerIdx],
      gameOver: isOver
    };
  }

  /**
   * Get the full game state (no hidden information in this game).
   */
  getState() {
    return {
      currentCard: this.currentCard ? { ...this.currentCard } : null,
      scores: [...this.scores],
      streak: [...this.streak],
      bestStreak: [...this.bestStreak],
      currentTurn: this.currentTurn,
      phase: this.phase,
      gameOver: this.gameOver,
      winner: this.winner,
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds,
      playerCount: this.playerCount,
      deckRemaining: this.deck.remaining,
      lastGuess: this.lastGuess,
      lastResult: this.lastResult,
      revealedCard: this.revealedCard ? { ...this.revealedCard } : null,
      eliminated: [...this._eliminated],
      roundsPerPlayer: [...this._roundsPerPlayer],
      cardsPlayed: this.cardsPlayed.map(c => ({ ...c }))
    };
  }

  /**
   * Get state for a specific player. Same as getState since there is
   * no hidden information in Higher or Lower.
   */
  getStateForPlayer(idx) {
    const state = this.getState();
    state.myIndex = idx;
    return state;
  }

  /**
   * Check if the game is over.
   * Over when: deck runs out, maxRounds per player reached, or
   * all but one player eliminated (multiplayer).
   *
   * @returns {{ over: boolean, winner?: number, scores?: number[] }}
   */
  checkGameOver() {
    if (this.gameOver) {
      return { over: true, winner: this.winner, scores: [...this.scores] };
    }

    const isOver = this._checkGameOverInternal();
    if (isOver) {
      return { over: true, winner: this.winner, scores: [...this.scores] };
    }

    return { over: false };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      playerCount: this.playerCount,
      deck: this.deck.serialize(),
      currentCard: this.currentCard ? CardDeck.encode(this.currentCard) : null,
      scores: [...this.scores],
      streak: [...this.streak],
      bestStreak: [...this.bestStreak],
      currentTurn: this.currentTurn,
      phase: this.phase,
      lastGuess: this.lastGuess,
      lastResult: this.lastResult,
      revealedCard: this.revealedCard ? CardDeck.encode(this.revealedCard) : null,
      gameOver: this.gameOver,
      winner: this.winner,
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds,
      cardsPlayed: this.cardsPlayed.map(c => CardDeck.encode(c)),
      roundsPerPlayer: [...this._roundsPerPlayer],
      eliminated: [...this._eliminated]
    };
  }

  static deserialize(data) {
    const g = new HigherLowerGame(data.playerCount);

    // Override the constructor state
    g.deck = CardDeck.deserialize(data.deck);
    g.currentCard = data.currentCard !== null ? CardDeck.decode(data.currentCard) : null;
    g.scores = [...data.scores];
    g.streak = [...data.streak];
    g.bestStreak = [...data.bestStreak];
    g.currentTurn = data.currentTurn;
    g.phase = data.phase;
    g.lastGuess = data.lastGuess;
    g.lastResult = data.lastResult;
    g.revealedCard = data.revealedCard !== null ? CardDeck.decode(data.revealedCard) : null;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.roundNumber = data.roundNumber;
    g.maxRounds = data.maxRounds;
    g.cardsPlayed = (data.cardsPlayed || []).map(n => CardDeck.decode(n));
    g._roundsPerPlayer = [...(data.roundsPerPlayer || Array(data.playerCount).fill(0))];
    g._eliminated = [...(data.eliminated || Array(data.playerCount).fill(false))];

    return g;
  }

  /* ---------- Internal Helpers ---------- */

  /**
   * Advance the turn to the next non-eliminated player.
   */
  _advanceTurn() {
    if (this.playerCount === 1) {
      // Single player: always player 0
      return;
    }

    // Move to next player, skipping eliminated ones
    let attempts = 0;
    let next = (this.currentTurn + 1) % this.playerCount;
    while (attempts < this.playerCount) {
      if (!this._eliminated[next]) {
        this.currentTurn = next;
        return;
      }
      next = (next + 1) % this.playerCount;
      attempts++;
    }

    // Everyone eliminated (shouldn't happen since game ends first)
    this.currentTurn = -1;
  }

  /**
   * Internal game-over check. Returns true if the game ended.
   */
  _checkGameOverInternal() {
    if (this.gameOver) return true;

    // Deck exhausted
    if (this.deck.remaining === 0) {
      this._endGame();
      return true;
    }

    // Single player: maxRounds reached
    if (this.playerCount === 1) {
      if (this._roundsPerPlayer[0] >= this.maxRounds) {
        this._endGame();
        return true;
      }
      return false;
    }

    // Multiplayer: check if all but one eliminated
    const alive = [];
    for (let i = 0; i < this.playerCount; i++) {
      if (!this._eliminated[i]) alive.push(i);
    }

    if (alive.length <= 1) {
      this.winner = alive.length === 1 ? alive[0] : null;
      this.gameOver = true;
      this.phase = 'over';
      return true;
    }

    // Multiplayer: check if all alive players have reached maxRounds
    let allDone = true;
    for (const idx of alive) {
      if (this._roundsPerPlayer[idx] < this.maxRounds) {
        allDone = false;
        break;
      }
    }

    if (allDone) {
      this._endGame();
      return true;
    }

    return false;
  }

  /**
   * Determine the winner and set game-over state.
   */
  _endGame() {
    this.gameOver = true;
    this.phase = 'over';

    // Winner is the player with the highest score
    let bestScore = -1;
    let bestPlayer = null;

    for (let i = 0; i < this.playerCount; i++) {
      if (this.scores[i] > bestScore) {
        bestScore = this.scores[i];
        bestPlayer = i;
      }
    }

    this.winner = bestPlayer;
  }
}

module.exports = HigherLowerGame;
