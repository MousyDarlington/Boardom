'use strict';

const CardDeck = require('./CardDeck');

class PokerGame {
  /**
   * @param {number} playerCount - Number of players (2-8)
   * @param {number} startingChips - Starting chip count per player
   * @param {number} smallBlind - Small blind amount
   * @param {number} bigBlind - Big blind amount
   */
  constructor(playerCount = 2, startingChips = 1000, smallBlind = 10, bigBlind = 20) {
    if (playerCount < 2 || playerCount > 8) {
      throw new Error('Player count must be 2-8');
    }

    this.playerCount = playerCount;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;

    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      this.players.push({
        chips: startingChips,
        cards: [],
        bet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        active: true       // Still in the tournament (has chips or is all-in)
      });
    }

    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.deck = new CardDeck(1);
    this.dealerIdx = 0;
    this.currentTurn = -1;
    this.phase = 'waiting';   // 'waiting'|'preflop'|'flop'|'turn'|'river'|'showdown'|'over'
    this.currentBet = 0;
    this.minRaise = bigBlind;
    this.roundNumber = 0;
    this.lastRaiser = -1;
    this.actionsThisRound = 0;
    this.winner = null;
    this.lastHandResult = null;
  }

  /* ---------- Public State API ---------- */

  getState() {
    return {
      playerCount: this.playerCount,
      players: this.players.map(p => ({
        chips: p.chips,
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        active: p.active,
        cardCount: p.cards.length
      })),
      communityCards: this.communityCards.map(c => ({ ...c })),
      pot: this.pot,
      sidePots: this.sidePots.map(sp => ({
        amount: sp.amount,
        eligible: [...sp.eligible]
      })),
      dealerIdx: this.dealerIdx,
      currentTurn: this.currentTurn,
      phase: this.phase,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      roundNumber: this.roundNumber,
      winner: this.winner,
      lastHandResult: this.lastHandResult
    };
  }

  getStateForPlayer(idx) {
    const state = this.getState();

    // Show own hole cards
    state.hand = this.players[idx].cards.map(c => ({ ...c }));

    // During showdown, show all active players' cards
    if (this.phase === 'showdown') {
      state.allHands = this.players.map(p => {
        if (!p.folded && p.cards.length > 0) {
          return p.cards.map(c => ({ ...c }));
        }
        return null;
      });
    }

    return state;
  }

  /* ---------- Hand Lifecycle ---------- */

  startHand() {
    if (this.phase === 'over') {
      return { valid: false, error: 'Game is over' };
    }

    // Count active players (those with chips)
    const activePlayers = this.players.filter(p => p.active && p.chips > 0).length;
    if (activePlayers < 2) {
      return { valid: false, error: 'Not enough active players' };
    }

    this.roundNumber++;
    this.lastHandResult = null;

    // Reset player state for new hand
    for (const p of this.players) {
      p.cards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = !p.active || p.chips <= 0;
      p.allIn = false;
    }

    // Reset table state
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.lastRaiser = -1;
    this.actionsThisRound = 0;

    // Shuffle and deal
    this.deck.reset();

    // Deal 2 cards to each active player
    for (let i = 0; i < this.playerCount; i++) {
      const p = this.players[i];
      if (!p.folded) {
        p.cards = this.deck.draw(2);
      }
    }

    // Post blinds
    const sbIdx = this._nextActivePlayer(this.dealerIdx);
    const bbIdx = this._nextActivePlayer(sbIdx);

    this._postBlind(sbIdx, this.smallBlind);
    this._postBlind(bbIdx, this.bigBlind);

    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;

    // UTG (under the gun) = left of big blind
    this.currentTurn = this._nextActivePlayer(bbIdx);
    this.lastRaiser = bbIdx; // BB is the initial "raiser" for action tracking
    this.actionsThisRound = 0;
    this.phase = 'preflop';

    // Edge case: if only 2 active non-folded non-all-in players and both are all-in from blinds
    if (this._allBettingComplete()) {
      this._advancePhase();
    }

    return { valid: true };
  }

  _postBlind(playerIdx, amount) {
    const p = this.players[playerIdx];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet = actual;
    p.totalBet = actual;
    this.pot += actual;
    if (p.chips === 0) {
      p.allIn = true;
    }
  }

  /* ---------- Player Actions ---------- */

  fold(playerIdx) {
    const err = this._validateAction(playerIdx);
    if (err) return { valid: false, error: err };

    this.players[playerIdx].folded = true;
    this.actionsThisRound++;

    // Check if only one player remains
    const remaining = this._nonFoldedPlayers();
    if (remaining.length === 1) {
      const winnerIdx = remaining[0];
      this._awardEntirePot(winnerIdx);
      this.lastHandResult = {
        winner: winnerIdx,
        reason: 'All others folded',
        amount: this.pot
      };
      this.phase = 'showdown'; // Brief showdown state before next hand
      const gameResult = this.checkGameOver();
      return {
        valid: true,
        handOver: true,
        winner: winnerIdx,
        gameOver: gameResult.over
      };
    }

    this._advanceTurn();
    return { valid: true, handOver: false };
  }

  check(playerIdx) {
    const err = this._validateAction(playerIdx);
    if (err) return { valid: false, error: err };

    const p = this.players[playerIdx];
    if (p.bet < this.currentBet) {
      return { valid: false, error: 'Cannot check, there is a bet to you' };
    }

    this.actionsThisRound++;
    this._advanceTurn();
    return { valid: true };
  }

  call(playerIdx) {
    const err = this._validateAction(playerIdx);
    if (err) return { valid: false, error: err };

    const p = this.players[playerIdx];
    const toCall = this.currentBet - p.bet;

    if (toCall <= 0) {
      return { valid: false, error: 'Nothing to call, use check instead' };
    }

    const actual = Math.min(toCall, p.chips);
    p.chips -= actual;
    p.bet += actual;
    p.totalBet += actual;
    this.pot += actual;

    if (p.chips === 0) {
      p.allIn = true;
    }

    this.actionsThisRound++;
    this._advanceTurn();
    return { valid: true, amount: actual };
  }

  raise(playerIdx, amount) {
    const err = this._validateAction(playerIdx);
    if (err) return { valid: false, error: err };

    const p = this.players[playerIdx];

    // 'amount' is the total new bet level (not the raise increment)
    if (amount < this.currentBet + this.minRaise) {
      // Exception: if raising all-in for less
      if (amount !== p.bet + p.chips) {
        return {
          valid: false,
          error: `Raise must be at least ${this.currentBet + this.minRaise}`
        };
      }
    }

    const toAdd = amount - p.bet;
    if (toAdd <= 0) {
      return { valid: false, error: 'Raise amount must be higher than current bet' };
    }
    if (toAdd > p.chips) {
      return { valid: false, error: 'Not enough chips, use allIn instead' };
    }

    const raiseIncrement = amount - this.currentBet;
    if (raiseIncrement > 0 && raiseIncrement >= this.minRaise) {
      this.minRaise = raiseIncrement;
    }

    p.chips -= toAdd;
    p.bet = amount;
    p.totalBet += toAdd;
    this.pot += toAdd;
    this.currentBet = amount;
    this.lastRaiser = playerIdx;

    if (p.chips === 0) {
      p.allIn = true;
    }

    this.actionsThisRound++;
    this._advanceTurn();
    return { valid: true, newBet: this.currentBet };
  }

  allIn(playerIdx) {
    const err = this._validateAction(playerIdx);
    if (err) return { valid: false, error: err };

    const p = this.players[playerIdx];
    if (p.chips <= 0) {
      return { valid: false, error: 'No chips to go all-in with' };
    }

    const amount = p.chips;
    const newBetLevel = p.bet + amount;

    // If this raises the bet, update currentBet
    if (newBetLevel > this.currentBet) {
      const raiseIncrement = newBetLevel - this.currentBet;
      if (raiseIncrement >= this.minRaise) {
        this.minRaise = raiseIncrement;
      }
      this.currentBet = newBetLevel;
      this.lastRaiser = playerIdx;
    }

    p.chips = 0;
    p.bet = newBetLevel;
    p.totalBet += amount;
    this.pot += amount;
    p.allIn = true;

    this.actionsThisRound++;
    this._advanceTurn();
    return { valid: true, amount };
  }

  /* ---------- Action Validation ---------- */

  _validateAction(playerIdx) {
    if (this.phase === 'waiting' || this.phase === 'showdown' || this.phase === 'over') {
      return 'No active betting round';
    }
    if (playerIdx !== this.currentTurn) {
      return 'Not your turn';
    }
    const p = this.players[playerIdx];
    if (p.folded) return 'You have folded';
    if (p.allIn) return 'You are all-in';
    if (!p.active) return 'You are not active';
    return null;
  }

  /* ---------- Turn Advancement ---------- */

  _advanceTurn() {
    // Check if betting round is complete
    if (this._allBettingComplete()) {
      this._advancePhase();
      return;
    }

    // Move to next player who can act
    let next = this._nextActivePlayer(this.currentTurn);

    // Safety: avoid infinite loop
    let attempts = 0;
    while (attempts < this.playerCount) {
      const p = this.players[next];
      if (!p.folded && !p.allIn && p.active) {
        this.currentTurn = next;
        return;
      }
      next = this._nextActivePlayer(next);
      attempts++;
    }

    // No one can act, advance phase
    this._advancePhase();
  }

  _allBettingComplete() {
    // Betting is complete when all non-folded, non-all-in players have acted
    // and all bets are equal to the current bet
    const canAct = this.getActivePlayers();

    if (canAct.length === 0) return true;
    if (canAct.length === 1) {
      // Only one player can act, and they match the bet (or it's their first action)
      const p = this.players[canAct[0]];
      if (p.bet >= this.currentBet) return true;
      // If they haven't matched, they still need to act
      if (this.actionsThisRound > 0) return true;
    }

    // All active players must have had a chance to act after the last raise
    // and all bets must be equal
    for (const idx of canAct) {
      const p = this.players[idx];
      if (p.bet < this.currentBet) return false;
    }

    // Everyone has matched the bet; check if everyone has had a chance to act
    // In preflop, big blind gets option to raise even if no one raised
    if (this.actionsThisRound < canAct.length) return false;

    return true;
  }

  /* ---------- Phase Advancement ---------- */

  _advancePhase() {
    // Calculate side pots before advancing
    this._calculateSidePots();

    // Reset bets for new betting round
    for (const p of this.players) {
      p.bet = 0;
    }
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.actionsThisRound = 0;
    this.lastRaiser = -1;

    // Check if only one non-folded player
    const nonFolded = this._nonFoldedPlayers();
    if (nonFolded.length === 1) {
      this._awardEntirePot(nonFolded[0]);
      this.lastHandResult = {
        winner: nonFolded[0],
        reason: 'All others folded',
        amount: this.pot
      };
      this.phase = 'showdown';
      return;
    }

    // Check if all remaining players are all-in (or only 1 can act)
    const canAct = this.getActivePlayers();
    const needMoreCards = canAct.length <= 1;

    switch (this.phase) {
      case 'preflop':
        this.phase = 'flop';
        this.deck.drawOne(); // Burn
        this.communityCards.push(...this.deck.draw(3));
        break;
      case 'flop':
        this.phase = 'turn';
        this.deck.drawOne(); // Burn
        this.communityCards.push(this.deck.drawOne());
        break;
      case 'turn':
        this.phase = 'river';
        this.deck.drawOne(); // Burn
        this.communityCards.push(this.deck.drawOne());
        break;
      case 'river':
        this.phase = 'showdown';
        this._evaluateShowdown();
        return;
      default:
        return;
    }

    if (needMoreCards) {
      // Run out remaining community cards automatically
      this._runOutBoard();
      return;
    }

    // Set turn to first active player after dealer
    this.currentTurn = this._nextActivePlayer(this.dealerIdx);

    // Skip players who are folded or all-in
    let attempts = 0;
    while (attempts < this.playerCount) {
      const p = this.players[this.currentTurn];
      if (!p.folded && !p.allIn && p.active) break;
      this.currentTurn = this._nextActivePlayer(this.currentTurn);
      attempts++;
    }
  }

  /**
   * When all remaining players are all-in, deal out the remaining
   * community cards and go straight to showdown.
   */
  _runOutBoard() {
    while (this.communityCards.length < 5) {
      this.deck.drawOne(); // Burn
      if (this.communityCards.length < 3) {
        // Should not happen after flop, but just in case
        this.communityCards.push(...this.deck.draw(3 - this.communityCards.length));
      } else {
        this.communityCards.push(this.deck.drawOne());
      }
    }
    this.phase = 'showdown';
    this._evaluateShowdown();
  }

  /* ---------- Showdown / Evaluation ---------- */

  _evaluateShowdown() {
    const nonFolded = this._nonFoldedPlayers();

    if (nonFolded.length === 1) {
      this._awardEntirePot(nonFolded[0]);
      this.lastHandResult = {
        winner: nonFolded[0],
        reason: 'All others folded',
        amount: this.pot
      };
      return;
    }

    // Evaluate each player's hand
    const evaluations = [];
    for (const idx of nonFolded) {
      const allCards = [...this.players[idx].cards, ...this.communityCards];
      const result = CardDeck.evaluatePokerHand(allCards);
      evaluations.push({ playerIdx: idx, result });
    }

    // Sort by hand strength (descending)
    evaluations.sort((a, b) => CardDeck.comparePokerHands(b.result, a.result));

    // Award pots
    this._awardPots(evaluations);

    this.lastHandResult = {
      evaluations: evaluations.map(e => ({
        playerIdx: e.playerIdx,
        handName: e.result.name,
        handRank: e.result.rank
      })),
      winner: evaluations[0].playerIdx,
      reason: evaluations[0].result.name
    };
  }

  /* ---------- Side Pot Calculation ---------- */

  _calculateSidePots() {
    // Collect all bets from non-folded players who have bet something
    const bettors = [];
    for (let i = 0; i < this.playerCount; i++) {
      if (this.players[i].totalBet > 0) {
        bettors.push({ idx: i, bet: this.players[i].totalBet, folded: this.players[i].folded });
      }
    }

    if (bettors.length === 0) return;

    // Check if any player is all-in for less than others
    const allInAmounts = bettors
      .filter(b => this.players[b.idx].allIn)
      .map(b => b.bet);

    if (allInAmounts.length === 0) {
      // No side pots needed, everything is in main pot
      this.sidePots = [{
        amount: this.pot,
        eligible: bettors.filter(b => !b.folded).map(b => b.idx)
      }];
      return;
    }

    // Build side pots from lowest all-in amount upward
    const uniqueAmounts = [...new Set(bettors.map(b => b.bet))].sort((a, b) => a - b);
    const pots = [];
    let prevLevel = 0;

    for (const level of uniqueAmounts) {
      if (level <= prevLevel) continue;

      const increment = level - prevLevel;
      let potAmount = 0;
      const eligible = [];

      for (const b of bettors) {
        if (b.bet > prevLevel) {
          const contribution = Math.min(b.bet - prevLevel, increment);
          potAmount += contribution;
          if (!b.folded) {
            eligible.push(b.idx);
          }
        }
      }

      if (potAmount > 0 && eligible.length > 0) {
        pots.push({ amount: potAmount, eligible });
      }

      prevLevel = level;
    }

    if (pots.length > 0) {
      this.sidePots = pots;
    }
  }

  /* ---------- Pot Distribution ---------- */

  _awardPots(evaluations) {
    if (this.sidePots.length === 0) {
      // Simple case: award entire pot to best hand
      if (evaluations.length > 0) {
        this.players[evaluations[0].playerIdx].chips += this.pot;
      }
      return;
    }

    for (const pot of this.sidePots) {
      // Find the best hand among eligible players
      let bestEval = null;
      let winners = [];

      for (const e of evaluations) {
        if (!pot.eligible.includes(e.playerIdx)) continue;
        if (!bestEval) {
          bestEval = e;
          winners = [e.playerIdx];
        } else {
          const cmp = CardDeck.comparePokerHands(e.result, bestEval.result);
          if (cmp > 0) {
            bestEval = e;
            winners = [e.playerIdx];
          } else if (cmp === 0) {
            winners.push(e.playerIdx);
          }
        }
      }

      // Split pot among winners
      if (winners.length > 0) {
        const share = Math.floor(pot.amount / winners.length);
        const remainder = pot.amount - share * winners.length;
        for (let i = 0; i < winners.length; i++) {
          this.players[winners[i]].chips += share + (i === 0 ? remainder : 0);
        }
      }
    }

    this.pot = 0;
  }

  _awardEntirePot(winnerIdx) {
    this.players[winnerIdx].chips += this.pot;
    this.pot = 0;
    this.sidePots = [];
  }

  /* ---------- Next Hand ---------- */

  _nextHand() {
    // Mark players with 0 chips as inactive
    for (const p of this.players) {
      if (p.chips <= 0) {
        p.active = false;
      }
    }

    const gameResult = this.checkGameOver();
    if (gameResult.over) {
      this.phase = 'over';
      this.winner = gameResult.winner;
      return;
    }

    // Rotate dealer to next active player
    this.dealerIdx = this._nextActivePlayerForDealer(this.dealerIdx);
    this.phase = 'waiting';
  }

  /* ---------- Game Over ---------- */

  checkGameOver() {
    const playersWithChips = [];
    for (let i = 0; i < this.playerCount; i++) {
      if (this.players[i].active && this.players[i].chips > 0) {
        playersWithChips.push(i);
      }
    }

    if (playersWithChips.length <= 1) {
      return {
        over: true,
        winner: playersWithChips.length === 1 ? playersWithChips[0] : null
      };
    }

    return { over: false, winner: null };
  }

  /* ---------- Query Helpers ---------- */

  getActivePlayers() {
    // Players who can still act (not folded, not all-in, have chips)
    const active = [];
    for (let i = 0; i < this.playerCount; i++) {
      const p = this.players[i];
      if (!p.folded && !p.allIn && p.active && p.chips > 0) {
        active.push(i);
      }
    }
    return active;
  }

  _nonFoldedPlayers() {
    const result = [];
    for (let i = 0; i < this.playerCount; i++) {
      if (!this.players[i].folded) {
        result.push(i);
      }
    }
    return result;
  }

  _nextActivePlayer(fromIdx) {
    let idx = (fromIdx + 1) % this.playerCount;
    let attempts = 0;
    while (attempts < this.playerCount) {
      const p = this.players[idx];
      if (!p.folded && p.active) return idx;
      idx = (idx + 1) % this.playerCount;
      attempts++;
    }
    return fromIdx; // Fallback (shouldn't happen)
  }

  _nextActivePlayerForDealer(fromIdx) {
    let idx = (fromIdx + 1) % this.playerCount;
    let attempts = 0;
    while (attempts < this.playerCount) {
      if (this.players[idx].active && this.players[idx].chips > 0) return idx;
      idx = (idx + 1) % this.playerCount;
      attempts++;
    }
    return fromIdx;
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      playerCount: this.playerCount,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      players: this.players.map(p => ({
        chips: p.chips,
        cards: p.cards.map(c => CardDeck.encode(c)),
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        active: p.active
      })),
      communityCards: this.communityCards.map(c => CardDeck.encode(c)),
      pot: this.pot,
      sidePots: this.sidePots.map(sp => ({
        amount: sp.amount,
        eligible: [...sp.eligible]
      })),
      deck: this.deck.serialize(),
      dealerIdx: this.dealerIdx,
      currentTurn: this.currentTurn,
      phase: this.phase,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      roundNumber: this.roundNumber,
      lastRaiser: this.lastRaiser,
      actionsThisRound: this.actionsThisRound,
      winner: this.winner,
      lastHandResult: this.lastHandResult
    };
  }

  static deserialize(data) {
    const g = new PokerGame(data.playerCount, 0, data.smallBlind, data.bigBlind);

    g.players = data.players.map(p => ({
      chips: p.chips,
      cards: p.cards.map(n => CardDeck.decode(n)),
      bet: p.bet,
      totalBet: p.totalBet,
      folded: p.folded,
      allIn: p.allIn,
      active: p.active
    }));

    g.communityCards = data.communityCards.map(n => CardDeck.decode(n));
    g.pot = data.pot;
    g.sidePots = data.sidePots.map(sp => ({
      amount: sp.amount,
      eligible: [...sp.eligible]
    }));
    g.deck = CardDeck.deserialize(data.deck);
    g.dealerIdx = data.dealerIdx;
    g.currentTurn = data.currentTurn;
    g.phase = data.phase;
    g.currentBet = data.currentBet;
    g.minRaise = data.minRaise;
    g.roundNumber = data.roundNumber;
    g.lastRaiser = data.lastRaiser;
    g.actionsThisRound = data.actionsThisRound;
    g.winner = data.winner;
    g.lastHandResult = data.lastHandResult;

    return g;
  }
}

module.exports = PokerGame;
