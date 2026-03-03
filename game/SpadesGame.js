'use strict';

const CardDeck = require('./CardDeck');

// Suits
const CLUBS = 0;
const DIAMONDS = 1;
const HEARTS = 2;
const SPADES = 3;

class SpadesGame {
  constructor() {
    this.hands = [[], [], [], []];        // 4 players, 13 cards each
    this.bids = [null, null, null, null];
    this.tricksTaken = [0, 0, 0, 0];
    this.teamScores = [0, 0];             // team A = [0,2], team B = [1,3]
    this.teamBags = [0, 0];
    this.currentTrick = [];                // [{playerIdx, card}, ...]
    this.currentTurn = 1;                  // left of dealer starts
    this.dealer = 0;
    this.phase = 'bidding';                // 'bidding'|'playing'|'scoring'|'over'
    this.spadesBroken = false;
    this.leadPlayer = -1;
    this.trickNumber = 0;
    this.roundNumber = 0;
    this.targetScore = 500;
    this.winner = null;                    // 0 or 1 (team index) when game is over

    this._deal();
  }

  /* ---------- Deal ---------- */

  _deal() {
    const deck = new CardDeck(1);
    // deck is already shuffled in constructor
    for (let i = 0; i < 4; i++) {
      this.hands[i] = deck.draw(13);
    }
    // Sort each hand for nicer display
    for (let i = 0; i < 4; i++) {
      this.hands[i] = CardDeck.sortHand(this.hands[i], true);
    }
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      bids: [...this.bids],
      tricksTaken: [...this.tricksTaken],
      teamScores: [...this.teamScores],
      teamBags: [...this.teamBags],
      currentTrick: this.currentTrick.map(t => ({ playerIdx: t.playerIdx, card: { ...t.card } })),
      currentTurn: this.currentTurn,
      dealer: this.dealer,
      phase: this.phase,
      spadesBroken: this.spadesBroken,
      leadPlayer: this.leadPlayer,
      trickNumber: this.trickNumber,
      roundNumber: this.roundNumber,
      targetScore: this.targetScore,
      winner: this.winner,
      handSizes: this.hands.map(h => h.length)
    };
  }

  getStateForPlayer(idx) {
    const state = this.getState();
    state.hand = this.hands[idx].map(c => ({ ...c }));
    // During showdown/scoring, all hands could be visible, but normally just own
    return state;
  }

  /* ---------- Bidding ---------- */

  placeBid(playerIdx, bid) {
    if (this.phase !== 'bidding') {
      return { valid: false, error: 'Not in bidding phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn to bid' };
    }
    if (typeof bid !== 'number' || bid < 0 || bid > 13 || !Number.isInteger(bid)) {
      return { valid: false, error: 'Bid must be an integer 0-13' };
    }
    if (this.bids[playerIdx] !== null) {
      return { valid: false, error: 'Already placed a bid' };
    }

    this.bids[playerIdx] = bid;

    // Advance to next bidder
    const allBid = this.bids.every(b => b !== null);

    if (!allBid) {
      this.currentTurn = (this.currentTurn + 1) % 4;
    } else {
      // All bids placed, start playing
      this.phase = 'playing';
      this.trickNumber = 1;
      // Player left of dealer leads first trick
      this.currentTurn = (this.dealer + 1) % 4;
      this.leadPlayer = this.currentTurn;
    }

    return { valid: true, allBid };
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

    // Track if spades are broken
    if (card.suit === SPADES && !this.spadesBroken) {
      this.spadesBroken = true;
    }

    // Check if trick is complete (4 cards played)
    let trickComplete = false;
    let trickWinner = -1;
    let roundOver = false;
    let gameOver = false;

    if (this.currentTrick.length === 4) {
      trickComplete = true;
      trickWinner = this._scoreTrick(this.currentTrick);
      this.tricksTaken[trickWinner]++;

      // Prepare for next trick or end of round
      if (this.trickNumber >= 13) {
        // Round is over, score it
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

      if (trickComplete && !roundOver) {
        // Trick done but round continues - trick already cleared above
      }

      if (roundOver && !gameOver) {
        // Round done, new round started in _startNewRound
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

    if (this.currentTrick.length === 0) {
      // Leading the trick
      if (card.suit === SPADES && !this.spadesBroken) {
        // Can't lead spades unless broken or only spades in hand
        const hasNonSpade = hand.some(c => c.suit !== SPADES);
        if (hasNonSpade) {
          return 'Cannot lead spades until spades are broken';
        }
      }
      return null; // Any non-spade lead (or all-spades hand) is valid
    }

    // Following: must follow suit if possible
    const leadSuit = this.currentTrick[0].card.suit;
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);

    if (hasLeadSuit && card.suit !== leadSuit) {
      return 'Must follow the lead suit';
    }

    return null; // Valid play
  }

  /* ---------- Trick Scoring ---------- */

  _scoreTrick(trick) {
    const leadSuit = trick[0].card.suit;
    let winnerIdx = 0;
    let winningCard = trick[0].card;

    for (let i = 1; i < trick.length; i++) {
      const c = trick[i].card;

      if (c.suit === SPADES && winningCard.suit !== SPADES) {
        // Spade trumps non-spade
        winnerIdx = i;
        winningCard = c;
      } else if (c.suit === SPADES && winningCard.suit === SPADES) {
        // Higher spade wins
        if (c.rank > winningCard.rank) {
          winnerIdx = i;
          winningCard = c;
        }
      } else if (c.suit === leadSuit && winningCard.suit === leadSuit) {
        // Both follow lead suit, higher wins
        if (c.rank > winningCard.rank) {
          winnerIdx = i;
          winningCard = c;
        }
      }
      // If c is off-suit and not spade, it can't win
    }

    return trick[winnerIdx].playerIdx;
  }

  /* ---------- Round Scoring ---------- */

  _scoreRound() {
    this.phase = 'scoring';

    for (let team = 0; team < 2; team++) {
      const p1 = team === 0 ? 0 : 1;
      const p2 = team === 0 ? 2 : 3;

      const bid1 = this.bids[p1];
      const bid2 = this.bids[p2];
      const tricks1 = this.tricksTaken[p1];
      const tricks2 = this.tricksTaken[p2];

      let teamScore = 0;

      // Handle nil bids individually
      const nilPlayers = [];
      const nonNilBid = [];
      const nonNilTricks = [];

      if (bid1 === 0) {
        nilPlayers.push(p1);
        if (tricks1 === 0) {
          teamScore += 100;   // Made nil
        } else {
          teamScore -= 100;   // Failed nil
        }
      } else {
        nonNilBid.push(bid1);
        nonNilTricks.push(tricks1);
      }

      if (bid2 === 0) {
        nilPlayers.push(p2);
        if (tricks2 === 0) {
          teamScore += 100;   // Made nil
        } else {
          teamScore -= 100;   // Failed nil
        }
      } else {
        nonNilBid.push(bid2);
        nonNilTricks.push(tricks2);
      }

      // Score non-nil bids as a team
      if (nonNilBid.length > 0) {
        const totalBid = nonNilBid.reduce((a, b) => a + b, 0);
        const totalTricks = nonNilTricks.reduce((a, b) => a + b, 0);

        if (totalTricks >= totalBid) {
          const overtricks = totalTricks - totalBid;
          teamScore += totalBid * 10 + overtricks;
          this.teamBags[team] += overtricks;

          // Bag penalty: every 10 bags costs -100
          while (this.teamBags[team] >= 10) {
            this.teamBags[team] -= 10;
            teamScore -= 100;
          }
        } else {
          // Set: didn't make the bid
          teamScore -= totalBid * 10;
        }
      }

      this.teamScores[team] += teamScore;
    }
  }

  /* ---------- Team Helpers ---------- */

  _getTeam(playerIdx) {
    // team A = [0, 2], team B = [1, 3]
    return playerIdx % 2;
  }

  /* ---------- New Round ---------- */

  _startNewRound() {
    this.roundNumber++;
    this.dealer = (this.dealer + 1) % 4;
    this.currentTurn = (this.dealer + 1) % 4;
    this.bids = [null, null, null, null];
    this.tricksTaken = [0, 0, 0, 0];
    this.currentTrick = [];
    this.spadesBroken = false;
    this.leadPlayer = -1;
    this.trickNumber = 0;
    this.phase = 'bidding';

    // Reshuffle and redeal
    this.hands = [[], [], [], []];
    this._deal();
  }

  /* ---------- Game Over ---------- */

  checkGameOver() {
    // Check elimination: score <= -200
    for (let team = 0; team < 2; team++) {
      if (this.teamScores[team] <= -200) {
        const winnerTeam = team === 0 ? 1 : 0;
        return { over: true, winner: winnerTeam, teamScores: [...this.teamScores] };
      }
    }

    // Check if any team reached target score
    const team0Reached = this.teamScores[0] >= this.targetScore;
    const team1Reached = this.teamScores[1] >= this.targetScore;

    if (team0Reached && team1Reached) {
      // Both reached: highest score wins
      const winnerTeam = this.teamScores[0] >= this.teamScores[1] ? 0 : 1;
      return { over: true, winner: winnerTeam, teamScores: [...this.teamScores] };
    }

    if (team0Reached) {
      return { over: true, winner: 0, teamScores: [...this.teamScores] };
    }

    if (team1Reached) {
      return { over: true, winner: 1, teamScores: [...this.teamScores] };
    }

    return { over: false, winner: null, teamScores: [...this.teamScores] };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      hands: this.hands.map(h => h.map(c => CardDeck.encode(c))),
      bids: [...this.bids],
      tricksTaken: [...this.tricksTaken],
      teamScores: [...this.teamScores],
      teamBags: [...this.teamBags],
      currentTrick: this.currentTrick.map(t => ({
        playerIdx: t.playerIdx,
        card: CardDeck.encode(t.card)
      })),
      currentTurn: this.currentTurn,
      dealer: this.dealer,
      phase: this.phase,
      spadesBroken: this.spadesBroken,
      leadPlayer: this.leadPlayer,
      trickNumber: this.trickNumber,
      roundNumber: this.roundNumber,
      targetScore: this.targetScore,
      winner: this.winner
    };
  }

  static deserialize(data) {
    const g = new SpadesGame();

    g.hands = data.hands.map(h => h.map(n => CardDeck.decode(n)));
    g.bids = data.bids;
    g.tricksTaken = data.tricksTaken;
    g.teamScores = data.teamScores;
    g.teamBags = data.teamBags;
    g.currentTrick = data.currentTrick.map(t => ({
      playerIdx: t.playerIdx,
      card: CardDeck.decode(t.card)
    }));
    g.currentTurn = data.currentTurn;
    g.dealer = data.dealer;
    g.phase = data.phase;
    g.spadesBroken = data.spadesBroken;
    g.leadPlayer = data.leadPlayer;
    g.trickNumber = data.trickNumber;
    g.roundNumber = data.roundNumber;
    g.targetScore = data.targetScore;
    g.winner = data.winner;

    return g;
  }
}

// Export constants alongside the class
SpadesGame.CLUBS = CLUBS;
SpadesGame.DIAMONDS = DIAMONDS;
SpadesGame.HEARTS = HEARTS;
SpadesGame.SPADES = SPADES;

module.exports = SpadesGame;
