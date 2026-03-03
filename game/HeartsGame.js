'use strict';

const CardDeck = require('./CardDeck');

// Suits
const CLUBS = 0;
const DIAMONDS = 1;
const HEARTS = 2;
const SPADES = 3;

// Pass directions per round (0-indexed round number mod 4)
const PASS_LEFT = 0;
const PASS_RIGHT = 1;
const PASS_ACROSS = 2;
const PASS_NONE = 3;

const PASS_DIRECTION_NAMES = ['left', 'right', 'across', 'none'];

class HeartsGame {
  constructor() {
    this.hands = [[], [], [], []];        // 4 players, 13 cards each
    this.scores = [0, 0, 0, 0];          // cumulative scores across rounds
    this.roundScores = [0, 0, 0, 0];     // points taken this round
    this.tricksTaken = [0, 0, 0, 0];     // tricks won this round
    this.currentTrick = [];               // [{playerIdx, card}, ...]
    this.currentTurn = -1;
    this.dealer = 0;
    this.phase = 'passing';               // 'passing'|'playing'|'scoring'|'over'
    this.heartsBroken = false;
    this.leadPlayer = -1;
    this.trickNumber = 0;
    this.roundNumber = 0;
    this.targetScore = 100;               // game ends when someone reaches this
    this.winner = null;                   // playerIdx of winner (lowest score) when over

    // Passing state
    this.passDirection = PASS_LEFT;       // which direction to pass this round
    this.passedCards = [null, null, null, null]; // cards each player selected to pass
    this.passComplete = [false, false, false, false];
    this.receivedCards = [null, null, null, null]; // cards received after pass resolves

    // Track cards taken by each player this round (for shoot-the-moon detection)
    this.cardsTaken = [[], [], [], []];

    // First trick flag
    this.firstTrick = true;

    // Last completed trick for display purposes
    this.lastTrick = null;

    this._deal();
    this._initRound();
  }

  /* ---------- Deal ---------- */

  _deal() {
    const deck = new CardDeck(1);
    for (let i = 0; i < 4; i++) {
      this.hands[i] = deck.draw(13);
    }
    for (let i = 0; i < 4; i++) {
      this.hands[i] = CardDeck.sortHand(this.hands[i], true);
    }
  }

  _initRound() {
    this.passDirection = this.roundNumber % 4;
    this.passedCards = [null, null, null, null];
    this.passComplete = [false, false, false, false];
    this.receivedCards = [null, null, null, null];
    this.roundScores = [0, 0, 0, 0];
    this.tricksTaken = [0, 0, 0, 0];
    this.currentTrick = [];
    this.heartsBroken = false;
    this.leadPlayer = -1;
    this.trickNumber = 0;
    this.firstTrick = true;
    this.lastTrick = null;
    this.cardsTaken = [[], [], [], []];

    if (this.passDirection === PASS_NONE) {
      // No passing this round, go straight to playing
      this.phase = 'playing';
      this._findTwoOfClubsLead();
    } else {
      this.phase = 'passing';
    }
  }

  _findTwoOfClubsLead() {
    for (let p = 0; p < 4; p++) {
      for (let c = 0; c < this.hands[p].length; c++) {
        if (this.hands[p][c].suit === CLUBS && this.hands[p][c].rank === 2) {
          this.currentTurn = p;
          this.leadPlayer = p;
          this.trickNumber = 1;
          return;
        }
      }
    }
    // Fallback (should not happen with standard deck)
    this.currentTurn = (this.dealer + 1) % 4;
    this.leadPlayer = this.currentTurn;
    this.trickNumber = 1;
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      scores: [...this.scores],
      roundScores: [...this.roundScores],
      tricksTaken: [...this.tricksTaken],
      currentTrick: this.currentTrick.map(t => ({ playerIdx: t.playerIdx, card: { ...t.card } })),
      currentTurn: this.currentTurn,
      dealer: this.dealer,
      phase: this.phase,
      heartsBroken: this.heartsBroken,
      leadPlayer: this.leadPlayer,
      trickNumber: this.trickNumber,
      roundNumber: this.roundNumber,
      targetScore: this.targetScore,
      winner: this.winner,
      handSizes: this.hands.map(h => h.length),
      passDirection: this.passDirection,
      passDirectionName: PASS_DIRECTION_NAMES[this.passDirection],
      passComplete: [...this.passComplete],
      firstTrick: this.firstTrick,
      lastTrick: this.lastTrick ? this.lastTrick.map(t => ({ playerIdx: t.playerIdx, card: { ...t.card } })) : null
    };
  }

  getStateForPlayer(idx) {
    const state = this.getState();
    state.hand = this.hands[idx].map(c => ({ ...c }));

    // During passing, include what cards were passed (if already selected)
    if (this.phase === 'passing') {
      state.hasPassed = this.passComplete[idx];
    }

    // Include received cards info after pass resolution
    if (this.receivedCards[idx]) {
      state.receivedCards = this.receivedCards[idx].map(c => ({ ...c }));
    }

    return state;
  }

  /* ---------- Passing ---------- */

  passCards(playerIdx, cardIndices) {
    if (this.phase !== 'passing') {
      return { valid: false, error: 'Not in passing phase' };
    }
    if (this.passDirection === PASS_NONE) {
      return { valid: false, error: 'No passing this round' };
    }
    if (playerIdx < 0 || playerIdx > 3) {
      return { valid: false, error: 'Invalid player index' };
    }
    if (this.passComplete[playerIdx]) {
      return { valid: false, error: 'Already passed cards' };
    }
    if (!Array.isArray(cardIndices) || cardIndices.length !== 3) {
      return { valid: false, error: 'Must pass exactly 3 cards' };
    }

    // Validate indices
    const hand = this.hands[playerIdx];
    const uniqueIndices = new Set(cardIndices);
    if (uniqueIndices.size !== 3) {
      return { valid: false, error: 'Card indices must be unique' };
    }
    for (const idx of cardIndices) {
      if (typeof idx !== 'number' || idx < 0 || idx >= hand.length || !Number.isInteger(idx)) {
        return { valid: false, error: 'Invalid card index: ' + idx };
      }
    }

    // Store the selected cards (sorted descending so removal doesn't shift indices)
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);
    const selectedCards = sortedIndices.map(i => hand[i]);
    this.passedCards[playerIdx] = selectedCards;
    this.passComplete[playerIdx] = true;

    // Remove cards from hand
    for (const idx of sortedIndices) {
      hand.splice(idx, 1);
    }

    // Check if all players have passed
    const allPassed = this.passComplete.every(p => p);
    if (allPassed) {
      this._resolvePass();
    }

    return { valid: true, allPassed };
  }

  _resolvePass() {
    // Distribute passed cards according to direction
    for (let p = 0; p < 4; p++) {
      let target;
      if (this.passDirection === PASS_LEFT) {
        target = (p + 1) % 4;
      } else if (this.passDirection === PASS_RIGHT) {
        target = (p + 3) % 4;
      } else if (this.passDirection === PASS_ACROSS) {
        target = (p + 2) % 4;
      } else {
        continue; // PASS_NONE, should not reach here
      }

      this.receivedCards[target] = this.passedCards[p];
      this.hands[target].push(...this.passedCards[p]);
    }

    // Re-sort hands
    for (let i = 0; i < 4; i++) {
      this.hands[i] = CardDeck.sortHand(this.hands[i], true);
    }

    // Transition to playing
    this.phase = 'playing';
    this._findTwoOfClubsLead();
  }

  /* ---------- Playing ---------- */

  playCard(playerIdx, cardIndex) {
    if (this.phase !== 'playing') {
      return { valid: false, error: 'Not in playing phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (cardIndex < 0 || cardIndex >= this.hands[playerIdx].length) {
      return { valid: false, error: 'Invalid card index' };
    }

    const hand = this.hands[playerIdx];
    const card = hand[cardIndex];

    // Validate the play
    const validationError = this._validatePlay(playerIdx, card);
    if (validationError) {
      return { valid: false, error: validationError };
    }

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Add to current trick
    this.currentTrick.push({ playerIdx, card });

    // Track if hearts are broken
    if (card.suit === HEARTS && !this.heartsBroken) {
      this.heartsBroken = true;
    }

    // Check if trick is complete (4 cards played)
    let trickComplete = false;
    let trickWinner = -1;
    let roundOver = false;
    let gameOver = false;

    if (this.currentTrick.length === 4) {
      trickComplete = true;
      trickWinner = this._determineTrickWinner(this.currentTrick);
      this.tricksTaken[trickWinner]++;

      // Collect point cards taken in this trick
      const pointCards = this.currentTrick.filter(t =>
        t.card.suit === HEARTS || (t.card.suit === SPADES && t.card.rank === 12)
      );
      for (const pc of this.currentTrick) {
        this.cardsTaken[trickWinner].push({ ...pc.card });
      }

      // Calculate points in this trick
      let trickPoints = 0;
      for (const t of this.currentTrick) {
        if (t.card.suit === HEARTS) trickPoints += 1;
        if (t.card.suit === SPADES && t.card.rank === 12) trickPoints += 13;
      }
      this.roundScores[trickWinner] += trickPoints;

      // Save last trick for display
      this.lastTrick = this.currentTrick.map(t => ({ playerIdx: t.playerIdx, card: { ...t.card } }));

      this.firstTrick = false;

      // Check if round is over (13 tricks played)
      if (this.trickNumber >= 13) {
        roundOver = true;
        this._scoreRound();

        const result = this.checkGameOver();
        if (result.over) {
          gameOver = true;
          this.phase = 'over';
          this.winner = result.winner;
        } else {
          // Start new round
          this._startNewRound();
        }
      } else {
        // Next trick
        this.trickNumber++;
        this.currentTrick = [];
        this.currentTurn = trickWinner;
        this.leadPlayer = trickWinner;
      }
    } else {
      // Next player's turn
      this.currentTurn = (this.currentTurn + 1) % 4;
    }

    return {
      valid: true,
      card: { ...card },
      trickComplete,
      trickWinner,
      roundOver,
      gameOver
    };
  }

  /* ---------- Validation ---------- */

  _validatePlay(playerIdx, card) {
    const hand = this.hands[playerIdx];
    // Include the card being played in the hand for checking purposes
    // (it hasn't been removed yet at this point)

    if (this.currentTrick.length === 0) {
      // Leading the trick

      // First trick must be led with 2 of clubs
      if (this.firstTrick && this.trickNumber === 1) {
        if (card.suit !== CLUBS || card.rank !== 2) {
          // Only enforce if the player actually has the 2 of clubs
          const has2C = hand.some(c => c.suit === CLUBS && c.rank === 2);
          if (has2C) {
            return 'Must lead with the 2 of clubs on the first trick';
          }
        }
      }

      // Can't lead hearts until hearts are broken (unless only hearts in hand)
      if (card.suit === HEARTS && !this.heartsBroken) {
        const hasNonHeart = hand.some(c => c.suit !== HEARTS);
        if (hasNonHeart) {
          return 'Cannot lead hearts until hearts are broken';
        }
      }

      return null;
    }

    // Following: must follow suit if possible
    const leadSuit = this.currentTrick[0].card.suit;
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);

    if (hasLeadSuit && card.suit !== leadSuit) {
      return 'Must follow the lead suit';
    }

    // First trick restriction: can't play hearts or Q of spades
    if (this.firstTrick) {
      if (card.suit === HEARTS || (card.suit === SPADES && card.rank === 12)) {
        // Only disallow if player has other cards to play
        // If following suit, the suit check already passed
        if (!hasLeadSuit) {
          // Player is void in lead suit - check if they have non-penalty cards
          const hasNonPenalty = hand.some(c =>
            c.suit !== HEARTS && !(c.suit === SPADES && c.rank === 12)
          );
          if (hasNonPenalty) {
            return 'Cannot play hearts or Queen of Spades on the first trick';
          }
        }
      }
    }

    return null; // Valid play
  }

  /* ---------- Trick Winner ---------- */

  _determineTrickWinner(trick) {
    // In Hearts there is no trump suit. Highest card of the lead suit wins.
    const leadSuit = trick[0].card.suit;
    let winnerIdx = 0;
    let winningRank = trick[0].card.rank;

    for (let i = 1; i < trick.length; i++) {
      const c = trick[i].card;
      // Only cards matching the lead suit can win
      if (c.suit === leadSuit && c.rank > winningRank) {
        winnerIdx = i;
        winningRank = c.rank;
      }
    }

    return trick[winnerIdx].playerIdx;
  }

  /* ---------- Round Scoring ---------- */

  _scoreRound() {
    this.phase = 'scoring';

    // Check for shoot the moon: one player took all 26 points
    let moonShooter = -1;
    for (let p = 0; p < 4; p++) {
      if (this.roundScores[p] === 26) {
        moonShooter = p;
        break;
      }
    }

    if (moonShooter >= 0) {
      // Shoot the moon: shooter gets 0, everyone else gets 26
      for (let p = 0; p < 4; p++) {
        if (p === moonShooter) {
          this.roundScores[p] = 0;
        } else {
          this.roundScores[p] = 26;
        }
      }
    }

    // Add round scores to cumulative scores
    for (let p = 0; p < 4; p++) {
      this.scores[p] += this.roundScores[p];
    }
  }

  /* ---------- New Round ---------- */

  _startNewRound() {
    this.roundNumber++;
    this.dealer = (this.dealer + 1) % 4;
    this.hands = [[], [], [], []];
    this._deal();
    this._initRound();
  }

  /* ---------- Game Over ---------- */

  checkGameOver() {
    // Game ends when any player reaches targetScore
    let anyReached = false;
    for (let p = 0; p < 4; p++) {
      if (this.scores[p] >= this.targetScore) {
        anyReached = true;
        break;
      }
    }

    if (!anyReached) {
      return { over: false, winner: null, scores: [...this.scores] };
    }

    // Winner is the player with the lowest score
    let lowestScore = Infinity;
    let winner = 0;
    for (let p = 0; p < 4; p++) {
      if (this.scores[p] < lowestScore) {
        lowestScore = this.scores[p];
        winner = p;
      }
    }

    return { over: true, winner, scores: [...this.scores] };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      hands: this.hands.map(h => h.map(c => CardDeck.encode(c))),
      scores: [...this.scores],
      roundScores: [...this.roundScores],
      tricksTaken: [...this.tricksTaken],
      currentTrick: this.currentTrick.map(t => ({
        playerIdx: t.playerIdx,
        card: CardDeck.encode(t.card)
      })),
      currentTurn: this.currentTurn,
      dealer: this.dealer,
      phase: this.phase,
      heartsBroken: this.heartsBroken,
      leadPlayer: this.leadPlayer,
      trickNumber: this.trickNumber,
      roundNumber: this.roundNumber,
      targetScore: this.targetScore,
      winner: this.winner,
      passDirection: this.passDirection,
      passedCards: this.passedCards.map(p =>
        p ? p.map(c => CardDeck.encode(c)) : null
      ),
      passComplete: [...this.passComplete],
      receivedCards: this.receivedCards.map(r =>
        r ? r.map(c => CardDeck.encode(c)) : null
      ),
      cardsTaken: this.cardsTaken.map(ct => ct.map(c => CardDeck.encode(c))),
      firstTrick: this.firstTrick,
      lastTrick: this.lastTrick ? this.lastTrick.map(t => ({
        playerIdx: t.playerIdx,
        card: CardDeck.encode(t.card)
      })) : null
    };
  }

  static deserialize(data) {
    const g = new HeartsGame();

    g.hands = data.hands.map(h => h.map(n => CardDeck.decode(n)));
    g.scores = data.scores;
    g.roundScores = data.roundScores;
    g.tricksTaken = data.tricksTaken;
    g.currentTrick = data.currentTrick.map(t => ({
      playerIdx: t.playerIdx,
      card: CardDeck.decode(t.card)
    }));
    g.currentTurn = data.currentTurn;
    g.dealer = data.dealer;
    g.phase = data.phase;
    g.heartsBroken = data.heartsBroken;
    g.leadPlayer = data.leadPlayer;
    g.trickNumber = data.trickNumber;
    g.roundNumber = data.roundNumber;
    g.targetScore = data.targetScore;
    g.winner = data.winner;
    g.passDirection = data.passDirection;
    g.passedCards = data.passedCards.map(p =>
      p ? p.map(n => CardDeck.decode(n)) : null
    );
    g.passComplete = data.passComplete;
    g.receivedCards = data.receivedCards.map(r =>
      r ? r.map(n => CardDeck.decode(n)) : null
    );
    g.cardsTaken = data.cardsTaken.map(ct => ct.map(n => CardDeck.decode(n)));
    g.firstTrick = data.firstTrick;
    g.lastTrick = data.lastTrick ? data.lastTrick.map(t => ({
      playerIdx: t.playerIdx,
      card: CardDeck.decode(t.card)
    })) : null;

    return g;
  }
}

// Export constants alongside the class
HeartsGame.CLUBS = CLUBS;
HeartsGame.DIAMONDS = DIAMONDS;
HeartsGame.HEARTS = HEARTS;
HeartsGame.SPADES = SPADES;
HeartsGame.PASS_LEFT = PASS_LEFT;
HeartsGame.PASS_RIGHT = PASS_RIGHT;
HeartsGame.PASS_ACROSS = PASS_ACROSS;
HeartsGame.PASS_NONE = PASS_NONE;
HeartsGame.PASS_DIRECTION_NAMES = PASS_DIRECTION_NAMES;

module.exports = HeartsGame;
