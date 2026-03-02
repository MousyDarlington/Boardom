'use strict';

/**
 * CAHGame — Pure state machine for Cards Against Humanity.
 *
 * 3-8 players, 10-card hands, rotating Card Czar.
 * Phases: reading → submitting → revealing → judging → roundEnd → gameOver
 * Supports PG-13 and Adult card packs, configurable round count.
 */

const { pg13, adult } = require('./CAHCards');

const HAND_SIZE = 10;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const DEFAULT_MAX_ROUNDS = 10;

class CAHGame {
  constructor(playerCount, packType = 'pg13', maxRounds = DEFAULT_MAX_ROUNDS) {
    this.playerCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, playerCount || MIN_PLAYERS));
    this.packType = packType === 'adult' ? 'adult' : 'pg13';
    this.maxRounds = Math.max(3, Math.min(25, maxRounds || DEFAULT_MAX_ROUNDS));

    this.round = 0;
    this.currentCzar = 0;
    this.phase = 'waiting'; // waiting, reading, submitting, revealing, judging, roundEnd, gameOver
    this.gameOver = false;
    this.winner = null;

    // Scores
    this.scores = new Array(this.playerCount).fill(0);

    // Track eliminated/disconnected players
    this.activePlayers = new Array(this.playerCount).fill(true);

    // Decks
    const pack = this.packType === 'adult' ? adult : pg13;
    this.blackDeck = pack.black.map(c => ({ ...c }));
    this.whiteDeck = pack.white.map(c => c);
    this._shuffle(this.blackDeck);
    this._shuffle(this.whiteDeck);

    // Discard piles for recycling
    this.blackDiscard = [];
    this.whiteDiscard = [];

    // Current black card
    this.currentBlack = null;

    // Hands: array of arrays of white card strings
    this.hands = [];
    for (let p = 0; p < this.playerCount; p++) {
      this.hands.push([]);
      this._drawWhite(p, HAND_SIZE);
    }

    // Submissions: Map of playerIndex → { cards: string[], orderIndex: number }
    this.submissions = new Map();

    // Shuffled submissions for anonymous reveal (set during revealing phase)
    this.shuffledSubmissions = [];

    // Mapping from shuffled index back to player index (for picking winner)
    this._shuffleMap = [];
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      playerCount: this.playerCount,
      packType: this.packType,
      maxRounds: this.maxRounds,
      round: this.round,
      currentCzar: this.currentCzar,
      phase: this.phase,
      currentBlack: this.currentBlack ? { ...this.currentBlack } : null,
      scores: [...this.scores],
      gameOver: this.gameOver,
      winner: this.winner,
      activePlayers: [...this.activePlayers],
      submittedPlayers: this._getSubmittedPlayers(),
      shuffledSubmissions: this.shuffledSubmissions.map(s => ({ cards: [...s.cards] })),
      whiteRemaining: this.whiteDeck.length,
      blackRemaining: this.blackDeck.length
    };
  }

  getStateForPlayer(playerIndex) {
    const state = this.getState();
    state.hand = this.hands[playerIndex]
      ? [...this.hands[playerIndex]]
      : [];
    state.playerIndex = playerIndex;
    state.isCzar = playerIndex === this.currentCzar;
    state.hasSubmitted = this.submissions.has(playerIndex);
    return state;
  }

  serialize() {
    return {
      playerCount: this.playerCount,
      packType: this.packType,
      maxRounds: this.maxRounds,
      round: this.round,
      currentCzar: this.currentCzar,
      phase: this.phase,
      gameOver: this.gameOver,
      winner: this.winner,
      scores: [...this.scores],
      activePlayers: [...this.activePlayers],
      blackDeck: this.blackDeck.map(c => ({ ...c })),
      whiteDeck: [...this.whiteDeck],
      blackDiscard: this.blackDiscard.map(c => ({ ...c })),
      whiteDiscard: [...this.whiteDiscard],
      currentBlack: this.currentBlack ? { ...this.currentBlack } : null,
      hands: this.hands.map(h => [...h]),
      submissions: [...this.submissions.entries()],
      shuffledSubmissions: this.shuffledSubmissions.map(s => ({ cards: [...s.cards] })),
      _shuffleMap: [...this._shuffleMap]
    };
  }

  static deserialize(data) {
    const g = new CAHGame(data.playerCount, data.packType, data.maxRounds);
    g.round = data.round;
    g.currentCzar = data.currentCzar;
    g.phase = data.phase;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.scores = data.scores;
    g.activePlayers = data.activePlayers;
    g.blackDeck = data.blackDeck;
    g.whiteDeck = data.whiteDeck;
    g.blackDiscard = data.blackDiscard;
    g.whiteDiscard = data.whiteDiscard;
    g.currentBlack = data.currentBlack;
    g.hands = data.hands;
    g.submissions = new Map(data.submissions);
    g.shuffledSubmissions = data.shuffledSubmissions;
    g._shuffleMap = data._shuffleMap;
    return g;
  }

  /**
   * Start a new round. Draws a black card, sets phase to submitting.
   */
  startRound() {
    if (this.gameOver) return { valid: false, error: 'Game is over' };

    this.round++;
    this.submissions.clear();
    this.shuffledSubmissions = [];
    this._shuffleMap = [];

    // Draw black card (recycle if needed)
    if (this.blackDeck.length === 0) {
      this.blackDeck = this.blackDiscard.splice(0);
      this._shuffle(this.blackDeck);
    }
    this.currentBlack = this.blackDeck.pop();

    this.phase = 'submitting';

    return {
      valid: true,
      round: this.round,
      currentBlack: { ...this.currentBlack },
      currentCzar: this.currentCzar,
      phase: this.phase
    };
  }

  /**
   * Player submits white card(s) from their hand.
   * @param {number} playerIndex
   * @param {number[]} cardIndices - indices into the player's hand
   */
  submitCards(playerIndex, cardIndices) {
    if (this.gameOver) return { valid: false, error: 'Game is over' };
    if (this.phase !== 'submitting') return { valid: false, error: 'Not in submitting phase' };
    if (playerIndex === this.currentCzar) return { valid: false, error: 'Card Czar cannot submit' };
    if (!this.activePlayers[playerIndex]) return { valid: false, error: 'Player is not active' };
    if (this.submissions.has(playerIndex)) return { valid: false, error: 'Already submitted' };

    const pickCount = this.currentBlack ? this.currentBlack.pick : 1;
    if (!cardIndices || cardIndices.length !== pickCount) {
      return { valid: false, error: `Must submit exactly ${pickCount} card(s)` };
    }

    // Validate indices
    const hand = this.hands[playerIndex];
    for (const idx of cardIndices) {
      if (idx < 0 || idx >= hand.length) {
        return { valid: false, error: 'Invalid card index' };
      }
    }

    // Check for duplicate indices
    if (new Set(cardIndices).size !== cardIndices.length) {
      return { valid: false, error: 'Duplicate card indices' };
    }

    // Extract cards (remove from hand in reverse order to preserve indices)
    const cards = cardIndices.map(i => hand[i]);
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      const removed = hand.splice(idx, 1)[0];
      this.whiteDiscard.push(removed);
    }

    // Draw replacements
    this._drawWhite(playerIndex, pickCount);

    this.submissions.set(playerIndex, { cards });

    // Check if all active non-czar players have submitted
    const allSubmitted = this._allSubmitted();

    return {
      valid: true,
      player: playerIndex,
      allSubmitted,
      submittedPlayers: this._getSubmittedPlayers(),
      hand: [...this.hands[playerIndex]]
    };
  }

  /**
   * Reveal all submissions anonymously. Called when all players submitted or timer expires.
   */
  revealSubmissions() {
    if (this.phase !== 'submitting') return { valid: false, error: 'Not in submitting phase' };

    // Auto-submit random cards for players who haven't submitted
    for (let p = 0; p < this.playerCount; p++) {
      if (p === this.currentCzar) continue;
      if (!this.activePlayers[p]) continue;
      if (!this.submissions.has(p)) {
        this._autoSubmit(p);
      }
    }

    // Shuffle submissions anonymously
    const entries = [...this.submissions.entries()];
    this._shuffle(entries);

    this.shuffledSubmissions = entries.map(([, sub]) => ({ cards: [...sub.cards] }));
    this._shuffleMap = entries.map(([playerIdx]) => playerIdx);

    this.phase = 'revealing';

    return {
      valid: true,
      phase: this.phase,
      shuffledSubmissions: this.shuffledSubmissions.map(s => ({ cards: [...s.cards] }))
    };
  }

  /**
   * Czar picks the winning submission.
   * @param {number} czarIndex - must be the current czar
   * @param {number} submissionIdx - index into shuffledSubmissions
   */
  pickWinner(czarIndex, submissionIdx) {
    if (this.gameOver) return { valid: false, error: 'Game is over' };
    if (this.phase !== 'revealing' && this.phase !== 'judging') {
      return { valid: false, error: 'Not in judging phase' };
    }
    if (czarIndex !== this.currentCzar) return { valid: false, error: 'Only the Card Czar can pick' };
    if (submissionIdx < 0 || submissionIdx >= this.shuffledSubmissions.length) {
      return { valid: false, error: 'Invalid submission index' };
    }

    const winnerPlayerIndex = this._shuffleMap[submissionIdx];
    this.scores[winnerPlayerIndex]++;

    const winningCards = [...this.shuffledSubmissions[submissionIdx].cards];

    // Move to roundEnd
    this.phase = 'roundEnd';

    // Discard black card
    if (this.currentBlack) {
      this.blackDiscard.push(this.currentBlack);
    }

    // Check game end
    const ended = this._checkGameEnd();

    // Advance czar for next round
    if (!ended) {
      this._nextCzar();
    }

    return {
      valid: true,
      winnerIndex: winnerPlayerIndex,
      winningCards,
      submissionIdx,
      blackCard: this.currentBlack ? { ...this.currentBlack } : null,
      scores: [...this.scores],
      round: this.round,
      gameOver: this.gameOver ? { over: true, winner: this.winner } : { over: false },
      nextCzar: this.currentCzar,
      phase: this.phase
    };
  }

  /**
   * Remove a player from the game (disconnect/resign).
   */
  removePlayer(playerIndex) {
    if (playerIndex < 0 || playerIndex >= this.playerCount) return { valid: false, error: 'Invalid player' };
    if (!this.activePlayers[playerIndex]) return { valid: false, error: 'Player already removed' };

    this.activePlayers[playerIndex] = false;

    // Return cards to discard
    while (this.hands[playerIndex].length > 0) {
      this.whiteDiscard.push(this.hands[playerIndex].pop());
    }

    // Count remaining active players
    const activeCount = this.activePlayers.filter(a => a).length;
    if (activeCount < MIN_PLAYERS) {
      this._endGame();
      return { valid: true, gameOver: { over: true, winner: this.winner }, activeCount };
    }

    // If the czar left mid-round, advance czar and restart round
    let czarChanged = false;
    if (playerIndex === this.currentCzar) {
      this._nextCzar();
      czarChanged = true;
    }

    // If we're in submitting phase and this player hadn't submitted, check completion
    if (this.phase === 'submitting') {
      this.submissions.delete(playerIndex);
    }

    return {
      valid: true,
      playerIndex,
      activeCount,
      czarChanged,
      currentCzar: this.currentCzar,
      gameOver: { over: false }
    };
  }

  /* ---------- Internal helpers ---------- */

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  _drawWhite(playerIndex, count) {
    for (let i = 0; i < count; i++) {
      if (this.whiteDeck.length === 0) {
        // Recycle discard
        this.whiteDeck = this.whiteDiscard.splice(0);
        this._shuffle(this.whiteDeck);
        if (this.whiteDeck.length === 0) break; // truly exhausted
      }
      this.hands[playerIndex].push(this.whiteDeck.pop());
    }
  }

  _autoSubmit(playerIndex) {
    const pickCount = this.currentBlack ? this.currentBlack.pick : 1;
    const hand = this.hands[playerIndex];
    const indices = [];
    const available = hand.length;
    const toPick = Math.min(pickCount, available);

    // Pick random indices
    const used = new Set();
    for (let i = 0; i < toPick; i++) {
      let idx;
      do { idx = Math.floor(Math.random() * available); } while (used.has(idx));
      used.add(idx);
      indices.push(idx);
    }

    if (indices.length > 0) {
      const cards = indices.map(i => hand[i]);
      const sorted = [...indices].sort((a, b) => b - a);
      for (const idx of sorted) {
        this.whiteDiscard.push(hand.splice(idx, 1)[0]);
      }
      this._drawWhite(playerIndex, toPick);
      this.submissions.set(playerIndex, { cards });
    }
  }

  _nextCzar() {
    let next = (this.currentCzar + 1) % this.playerCount;
    let attempts = 0;
    while (!this.activePlayers[next] && attempts < this.playerCount) {
      next = (next + 1) % this.playerCount;
      attempts++;
    }
    this.currentCzar = next;
  }

  _allSubmitted() {
    for (let p = 0; p < this.playerCount; p++) {
      if (p === this.currentCzar) continue;
      if (!this.activePlayers[p]) continue;
      if (!this.submissions.has(p)) return false;
    }
    return true;
  }

  _getSubmittedPlayers() {
    const submitted = [];
    for (let p = 0; p < this.playerCount; p++) {
      if (this.submissions.has(p)) submitted.push(p);
    }
    return submitted;
  }

  _checkGameEnd() {
    if (this.round >= this.maxRounds) {
      this._endGame();
      return true;
    }
    return false;
  }

  _endGame() {
    this.gameOver = true;
    this.phase = 'gameOver';

    // Winner = highest score
    let maxScore = -1;
    this.winner = 0;
    for (let p = 0; p < this.playerCount; p++) {
      if (this.scores[p] > maxScore) {
        maxScore = this.scores[p];
        this.winner = p;
      }
    }
  }
}

// Static constants
CAHGame.HAND_SIZE = HAND_SIZE;
CAHGame.MIN_PLAYERS = MIN_PLAYERS;
CAHGame.MAX_PLAYERS = MAX_PLAYERS;
CAHGame.DEFAULT_MAX_ROUNDS = DEFAULT_MAX_ROUNDS;

module.exports = CAHGame;
