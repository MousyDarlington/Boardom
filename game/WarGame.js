'use strict';

const CardDeck = require('./CardDeck');

class WarGame {
  constructor() {
    const deck = new CardDeck();
    deck.shuffle();

    // Deal 26 cards to each of 2 players
    this.piles = [[], []];
    for (let i = 0; i < 26; i++) {
      this.piles[0].push(deck.drawOne());
      this.piles[1].push(deck.drawOne());
    }

    this.battleCards = [];   // Cards revealed in current battle [{player, card}, ...]
    this.warPile = [];       // Accumulated cards during war sequences
    this.phase = 'ready';    // 'ready' | 'battle' | 'war' | 'over'
    this.currentTurn = 0;    // Not really used for decisions, but kept for pattern consistency
    this.winner = null;
    this.roundNumber = 0;
    this.maxRounds = 1000;
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      pileCounts: [this.piles[0].length, this.piles[1].length],
      battleCards: this.battleCards.map(bc => ({ player: bc.player, card: { ...bc.card } })),
      warPile: this.warPile.map(c => ({ ...c })),
      phase: this.phase,
      currentTurn: this.currentTurn,
      winner: this.winner,
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds
    };
  }

  getStateForPlayer(idx) {
    return {
      ownPileCount: this.piles[idx].length,
      opponentPileCount: this.piles[1 - idx].length,
      battleCards: this.battleCards.map(bc => ({ player: bc.player, card: { ...bc.card } })),
      phase: this.phase,
      winner: this.winner,
      roundNumber: this.roundNumber
    };
  }

  /**
   * Play a round of War.
   * Both players flip their top card. Higher rank wins both cards.
   * On tie, enter war: each player places 3 face-down + 1 face-up, compare face-up.
   * If a player runs out during war, they lose.
   *
   * Returns { valid, battleCards, warCards, roundWinner, gameOver }
   */
  playRound() {
    if (this.phase === 'over') {
      return { valid: false };
    }

    this.roundNumber++;
    this.battleCards = [];
    this.warPile = [];
    this.phase = 'battle';

    // Check if either player is already out of cards
    if (this.piles[0].length === 0 || this.piles[1].length === 0) {
      return this._resolveGameOver();
    }

    // Both players flip top card
    const card0 = this.piles[0].shift();
    const card1 = this.piles[1].shift();
    this.battleCards = [
      { player: 0, card: card0 },
      { player: 1, card: card1 }
    ];

    // Compare ranks
    if (card0.rank > card1.rank) {
      return this._winRound(0, [card0, card1]);
    } else if (card1.rank > card0.rank) {
      return this._winRound(1, [card0, card1]);
    } else {
      // Tie — enter war
      return this._resolveWar([card0, card1]);
    }
  }

  /**
   * Check if the game is over.
   * Returns { over, winner, reason }
   */
  checkGameOver() {
    if (this.piles[0].length === 0 && this.piles[1].length === 0) {
      return { over: true, winner: null, reason: 'Both players ran out of cards' };
    }
    if (this.piles[0].length === 0) {
      return { over: true, winner: 1, reason: 'Player 0 ran out of cards' };
    }
    if (this.piles[1].length === 0) {
      return { over: true, winner: 0, reason: 'Player 1 ran out of cards' };
    }
    if (this.roundNumber >= this.maxRounds) {
      // Player with more cards wins
      if (this.piles[0].length > this.piles[1].length) {
        return { over: true, winner: 0, reason: 'Max rounds reached — player 0 has more cards' };
      } else if (this.piles[1].length > this.piles[0].length) {
        return { over: true, winner: 1, reason: 'Max rounds reached — player 1 has more cards' };
      } else {
        return { over: true, winner: null, reason: 'Max rounds reached — tie' };
      }
    }
    return { over: false, winner: null, reason: null };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      piles: [
        this.piles[0].map(c => CardDeck.encode(c)),
        this.piles[1].map(c => CardDeck.encode(c))
      ],
      battleCards: this.battleCards.map(bc => ({
        player: bc.player,
        card: CardDeck.encode(bc.card)
      })),
      warPile: this.warPile.map(c => CardDeck.encode(c)),
      phase: this.phase,
      currentTurn: this.currentTurn,
      winner: this.winner,
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds
    };
  }

  static deserialize(data) {
    const g = new WarGame();
    g.piles = [
      (data.piles[0] || []).map(n => CardDeck.decode(n)),
      (data.piles[1] || []).map(n => CardDeck.decode(n))
    ];
    g.battleCards = (data.battleCards || []).map(bc => ({
      player: bc.player,
      card: CardDeck.decode(bc.card)
    }));
    g.warPile = (data.warPile || []).map(n => CardDeck.decode(n));
    g.phase = data.phase;
    g.currentTurn = data.currentTurn;
    g.winner = data.winner;
    g.roundNumber = data.roundNumber;
    g.maxRounds = data.maxRounds;
    return g;
  }

  /* ---------- Internal helpers ---------- */

  /**
   * Resolve a war sequence. May recurse if the war itself ties.
   * @param {Array} pot - Cards accumulated so far in this battle
   */
  _resolveWar(pot) {
    this.phase = 'war';
    const warCards = [];

    for (let p = 0; p < 2; p++) {
      // Each player puts up to 3 face-down cards
      const faceDownCount = Math.min(3, this.piles[p].length);
      if (faceDownCount === 0) {
        // Player has no cards left for war — they lose
        // Put pot cards in opponent's pile first
        const opponent = 1 - p;
        this.piles[opponent].push(...pot);
        return this._resolveGameOver();
      }

      for (let i = 0; i < faceDownCount; i++) {
        const card = this.piles[p].shift();
        pot.push(card);
        warCards.push({ player: p, card, faceDown: true });
      }

      // Then 1 face-up card
      if (this.piles[p].length === 0) {
        // Player ran out during war — they lose
        const opponent = 1 - p;
        this.piles[opponent].push(...pot);
        return this._resolveGameOver();
      }

      const faceUp = this.piles[p].shift();
      pot.push(faceUp);
      warCards.push({ player: p, card: faceUp, faceDown: false });
    }

    this.warPile = warCards.map(wc => ({ ...wc.card }));

    // Compare the face-up cards (last card each player placed)
    const faceUp0 = warCards.filter(wc => wc.player === 0 && !wc.faceDown).pop();
    const faceUp1 = warCards.filter(wc => wc.player === 1 && !wc.faceDown).pop();

    if (faceUp0.card.rank > faceUp1.card.rank) {
      return this._winRound(0, pot, warCards);
    } else if (faceUp1.card.rank > faceUp0.card.rank) {
      return this._winRound(1, pot, warCards);
    } else {
      // Another tie — recurse deeper into war
      return this._resolveWar(pot);
    }
  }

  /**
   * Award won cards to the round winner and check for game over.
   */
  _winRound(playerIdx, wonCards, warCards) {
    // Shuffle won cards before adding to bottom (to avoid infinite loops)
    CardDeck.shuffleArray(wonCards);
    this.piles[playerIdx].push(...wonCards);

    this.phase = 'ready';

    const gameOverResult = this.checkGameOver();
    if (gameOverResult.over) {
      this.phase = 'over';
      this.winner = gameOverResult.winner;
    }

    return {
      valid: true,
      battleCards: this.battleCards.map(bc => ({ player: bc.player, card: { ...bc.card } })),
      warCards: warCards ? warCards.map(wc => ({
        player: wc.player,
        card: { ...wc.card },
        faceDown: wc.faceDown
      })) : null,
      roundWinner: playerIdx,
      gameOver: gameOverResult
    };
  }

  /**
   * Finalize game over state and return result.
   */
  _resolveGameOver() {
    const gameOverResult = this.checkGameOver();
    this.phase = 'over';
    this.winner = gameOverResult.winner;
    return {
      valid: true,
      battleCards: this.battleCards.map(bc => ({ player: bc.player, card: { ...bc.card } })),
      warCards: null,
      roundWinner: gameOverResult.winner,
      gameOver: gameOverResult
    };
  }
}

module.exports = WarGame;
