'use strict';

const CardDeck = require('./CardDeck');

class BlackjackGame {
  /**
   * @param {number} playerCount - Number of players (1-6), dealer is implicit
   * @param {number} deckCount - Number of standard 52-card decks in the shoe (default 6)
   */
  constructor(playerCount, deckCount = 6) {
    if (playerCount < 1 || playerCount > 6) {
      throw new Error('Player count must be between 1 and 6');
    }

    this.playerCount = playerCount;
    this.deckCount = deckCount;
    this.deck = new CardDeck(deckCount);

    // Player hands: each entry tracks cards, bet, status, and doubledDown flag
    this.hands = [];
    for (let i = 0; i < playerCount; i++) {
      this.hands.push({
        cards: [],
        bet: 0,
        status: 'playing',
        doubledDown: false
      });
    }

    // Dealer hand
    this.dealerHand = { cards: [], hidden: true };

    // Game state
    this.currentPlayer = 0;
    this.phase = 'betting'; // 'betting' | 'playing' | 'dealer' | 'payout' | 'over'
    this.chips = Array(playerCount).fill(1000);
    this.minBet = 10;
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      playerCount: this.playerCount,
      hands: this.hands.map(h => ({
        cards: h.cards.map(c => ({ ...c })),
        bet: h.bet,
        status: h.status,
        doubledDown: h.doubledDown
      })),
      dealerHand: {
        cards: this.dealerHand.cards.map(c => ({ ...c })),
        hidden: this.dealerHand.hidden
      },
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      chips: [...this.chips],
      minBet: this.minBet
    };
  }

  /**
   * Return state visible to a specific player.
   * Dealer's second card is hidden during the playing phase.
   */
  getStateForPlayer(idx) {
    const dealerCards = this.dealerHand.cards.map(c => ({ ...c }));
    let visibleDealerCards;
    if (this.dealerHand.hidden && dealerCards.length >= 2) {
      // Show first card, hide the rest
      visibleDealerCards = [dealerCards[0], ...dealerCards.slice(1).map(() => null)];
    } else {
      visibleDealerCards = dealerCards;
    }

    return {
      playerCount: this.playerCount,
      hands: this.hands.map(h => ({
        cards: h.cards.map(c => ({ ...c })),
        bet: h.bet,
        status: h.status,
        doubledDown: h.doubledDown
      })),
      dealerHand: {
        cards: visibleDealerCards,
        hidden: this.dealerHand.hidden
      },
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      chips: [...this.chips],
      myIndex: idx,
      minBet: this.minBet
    };
  }

  /**
   * Place a bet for a player. When all players have bet, deal cards automatically.
   * @returns {{ valid: boolean, error?: string, phase?: string }}
   */
  placeBet(playerIdx, amount) {
    if (this.phase !== 'betting') {
      return { valid: false, error: 'Not in betting phase' };
    }
    if (playerIdx < 0 || playerIdx >= this.playerCount) {
      return { valid: false, error: 'Invalid player index' };
    }
    if (amount < this.minBet) {
      return { valid: false, error: `Minimum bet is ${this.minBet}` };
    }
    if (amount > this.chips[playerIdx]) {
      return { valid: false, error: 'Not enough chips' };
    }
    if (this.hands[playerIdx].bet > 0) {
      return { valid: false, error: 'Bet already placed' };
    }

    this.hands[playerIdx].bet = amount;
    this.chips[playerIdx] -= amount;

    // Check if all players have placed bets
    const allBet = this.hands.every(h => h.bet > 0);
    if (allBet) {
      this._deal();
    }

    return { valid: true, phase: this.phase };
  }

  /**
   * Deal another card to the current player.
   * @returns {{ valid: boolean, error?: string, card?: object, handValue?: number, bust?: boolean, twentyOne?: boolean }}
   */
  hit(playerIdx) {
    if (this.phase !== 'playing') {
      return { valid: false, error: 'Not in playing phase' };
    }
    if (playerIdx !== this.currentPlayer) {
      return { valid: false, error: 'Not your turn' };
    }
    if (this.hands[playerIdx].status !== 'playing') {
      return { valid: false, error: 'Hand is not in playing state' };
    }

    const card = this.deck.drawOne();
    if (!card) {
      return { valid: false, error: 'No cards remaining' };
    }

    this.hands[playerIdx].cards.push(card);
    const hv = this._handValue(this.hands[playerIdx].cards);

    let bust = false;
    let twentyOne = false;

    if (hv.value > 21) {
      bust = true;
      this.hands[playerIdx].status = 'bust';
      this._advancePlayer();
    } else if (hv.value === 21) {
      twentyOne = true;
      this.hands[playerIdx].status = 'stand';
      this._advancePlayer();
    }

    return { valid: true, card: { ...card }, handValue: hv.value, bust, twentyOne };
  }

  /**
   * Current player stands. Move to next player or dealer play.
   * @returns {{ valid: boolean, error?: string }}
   */
  stand(playerIdx) {
    if (this.phase !== 'playing') {
      return { valid: false, error: 'Not in playing phase' };
    }
    if (playerIdx !== this.currentPlayer) {
      return { valid: false, error: 'Not your turn' };
    }
    if (this.hands[playerIdx].status !== 'playing') {
      return { valid: false, error: 'Hand is not in playing state' };
    }

    this.hands[playerIdx].status = 'stand';
    this._advancePlayer();

    return { valid: true };
  }

  /**
   * Double down: double the bet, receive exactly 1 card, then auto-stand.
   * Only allowed on first 2 cards.
   * @returns {{ valid: boolean, error?: string, card?: object, handValue?: number, bust?: boolean }}
   */
  doubleDown(playerIdx) {
    if (this.phase !== 'playing') {
      return { valid: false, error: 'Not in playing phase' };
    }
    if (playerIdx !== this.currentPlayer) {
      return { valid: false, error: 'Not your turn' };
    }
    if (this.hands[playerIdx].status !== 'playing') {
      return { valid: false, error: 'Hand is not in playing state' };
    }
    if (this.hands[playerIdx].cards.length !== 2) {
      return { valid: false, error: 'Can only double down on first two cards' };
    }
    if (this.hands[playerIdx].bet > this.chips[playerIdx]) {
      return { valid: false, error: 'Not enough chips to double down' };
    }

    // Double the bet
    const additionalBet = this.hands[playerIdx].bet;
    this.chips[playerIdx] -= additionalBet;
    this.hands[playerIdx].bet += additionalBet;
    this.hands[playerIdx].doubledDown = true;

    // Deal exactly 1 card
    const card = this.deck.drawOne();
    this.hands[playerIdx].cards.push(card);
    const hv = this._handValue(this.hands[playerIdx].cards);

    let bust = false;
    if (hv.value > 21) {
      bust = true;
      this.hands[playerIdx].status = 'bust';
    } else {
      this.hands[playerIdx].status = 'stand';
    }

    this._advancePlayer();

    return { valid: true, card: { ...card }, handValue: hv.value, bust };
  }

  /**
   * Check if the game is over and return results.
   * @returns {{ over: boolean, results?: Array<{playerIdx: number, status: string, chipChange: number}> }}
   */
  checkGameOver() {
    if (this.phase !== 'over') {
      return { over: false };
    }

    const results = this.hands.map((h, i) => ({
      playerIdx: i,
      status: h.status,
      chipChange: h._chipChange || 0
    }));

    return { over: true, results };
  }

  /* ---------- Serialization ---------- */

  serialize() {
    return {
      playerCount: this.playerCount,
      deckCount: this.deckCount,
      deck: this.deck.serialize(),
      hands: this.hands.map(h => ({
        cards: h.cards.map(c => CardDeck.encode(c)),
        bet: h.bet,
        status: h.status,
        doubledDown: h.doubledDown,
        _chipChange: h._chipChange || 0
      })),
      dealerHand: {
        cards: this.dealerHand.cards.map(c => CardDeck.encode(c)),
        hidden: this.dealerHand.hidden
      },
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      chips: [...this.chips],
      minBet: this.minBet
    };
  }

  static deserialize(data) {
    const g = new BlackjackGame(data.playerCount, data.deckCount);
    g.deck = CardDeck.deserialize(data.deck);
    g.hands = data.hands.map(h => ({
      cards: h.cards.map(n => CardDeck.decode(n)),
      bet: h.bet,
      status: h.status,
      doubledDown: h.doubledDown,
      _chipChange: h._chipChange || 0
    }));
    g.dealerHand = {
      cards: data.dealerHand.cards.map(n => CardDeck.decode(n)),
      hidden: data.dealerHand.hidden
    };
    g.currentPlayer = data.currentPlayer;
    g.phase = data.phase;
    g.chips = [...data.chips];
    g.minBet = data.minBet;
    return g;
  }

  /* ---------- Static Helpers ---------- */

  /**
   * Get the blackjack value of a single card.
   * 2-10 = face value, J/Q/K = 10, A = 11
   */
  static cardValue(card) {
    if (card.rank >= 11 && card.rank <= 13) return 10; // J, Q, K
    if (card.rank === 14) return 11; // Ace
    return card.rank; // 2-10
  }

  /* ---------- Internal Helpers ---------- */

  /**
   * Deal initial cards after all bets are placed.
   * 2 cards to each player, 2 to dealer. Check for naturals.
   */
  _deal() {
    // Deal 2 cards to each player
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < this.playerCount; i++) {
        this.hands[i].cards.push(this.deck.drawOne());
      }
      this.dealerHand.cards.push(this.deck.drawOne());
    }

    // Check for naturals (blackjack)
    for (let i = 0; i < this.playerCount; i++) {
      const hv = this._handValue(this.hands[i].cards);
      if (hv.value === 21) {
        this.hands[i].status = 'blackjack';
      }
    }

    // Check dealer natural
    const dealerValue = this._handValue(this.dealerHand.cards);
    if (dealerValue.value === 21) {
      // Dealer has blackjack - go straight to payout
      this.dealerHand.hidden = false;
      this.phase = 'payout';
      this._payout();
      return;
    }

    // Find first player who can still play
    this.currentPlayer = 0;
    this._skipNonPlayingPlayers();

    if (this.phase !== 'dealer' && this.phase !== 'payout' && this.phase !== 'over') {
      this.phase = 'playing';
    }
  }

  /**
   * Advance to the next player who can still act, or trigger dealer play.
   */
  _advancePlayer() {
    this.currentPlayer++;
    this._skipNonPlayingPlayers();
  }

  /**
   * Skip players who are not in 'playing' status.
   * If all players are done, trigger dealer play.
   */
  _skipNonPlayingPlayers() {
    while (this.currentPlayer < this.playerCount &&
           this.hands[this.currentPlayer].status !== 'playing') {
      this.currentPlayer++;
    }

    if (this.currentPlayer >= this.playerCount) {
      // All players done, check if any non-bust players remain
      const anyStanding = this.hands.some(h =>
        h.status === 'stand' || h.status === 'blackjack'
      );

      if (anyStanding) {
        this.phase = 'dealer';
        this._dealerPlay();
      } else {
        // All players busted
        this.phase = 'payout';
        this._payout();
      }
    }
  }

  /**
   * Dealer plays: reveal hidden card, hit on 16 or less, stand on 17+.
   */
  _dealerPlay() {
    this.dealerHand.hidden = false;

    let dv = this._handValue(this.dealerHand.cards);
    while (dv.value < 17) {
      const card = this.deck.drawOne();
      if (!card) break;
      this.dealerHand.cards.push(card);
      dv = this._handValue(this.dealerHand.cards);
    }

    this.phase = 'payout';
    this._payout();
  }

  /**
   * Calculate hand value. Aces count as 11 unless that would bust,
   * in which case they count as 1.
   * @returns {{ value: number, soft: boolean }}
   */
  _handValue(cards) {
    let value = 0;
    let aces = 0;

    for (const card of cards) {
      const cv = BlackjackGame.cardValue(card);
      value += cv;
      if (card.rank === 14) aces++;
    }

    // Reduce aces from 11 to 1 as needed
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    // A hand is "soft" if it contains an ace counted as 11
    return { value, soft: aces > 0 };
  }

  /**
   * Compare each player's hand against the dealer and update chips.
   * Blackjack pays 3:2. Win pays 1:1. Push returns bet.
   */
  _payout() {
    const dealerValue = this._handValue(this.dealerHand.cards).value;
    const dealerBust = dealerValue > 21;
    const dealerBlackjack = this.dealerHand.cards.length === 2 && dealerValue === 21;

    for (let i = 0; i < this.playerCount; i++) {
      const hand = this.hands[i];
      const playerValue = this._handValue(hand.cards).value;
      let chipChange = 0;

      if (hand.status === 'bust') {
        // Player busted - already lost bet
        hand.status = 'lost';
        chipChange = -hand.bet;
      } else if (hand.status === 'blackjack') {
        if (dealerBlackjack) {
          // Both have blackjack - push
          hand.status = 'push';
          this.chips[i] += hand.bet; // Return bet
          chipChange = 0;
        } else {
          // Player blackjack - pays 3:2
          hand.status = 'won';
          const winnings = Math.floor(hand.bet * 2.5); // bet + 1.5x bet
          this.chips[i] += winnings;
          chipChange = winnings - hand.bet; // net gain = 1.5x bet
        }
      } else if (dealerBust) {
        // Dealer busted, player wins
        hand.status = 'won';
        this.chips[i] += hand.bet * 2; // bet + 1:1
        chipChange = hand.bet;
      } else if (playerValue > dealerValue) {
        hand.status = 'won';
        this.chips[i] += hand.bet * 2;
        chipChange = hand.bet;
      } else if (playerValue === dealerValue) {
        hand.status = 'push';
        this.chips[i] += hand.bet; // Return bet
        chipChange = 0;
      } else {
        hand.status = 'lost';
        chipChange = -hand.bet;
      }

      hand._chipChange = chipChange;
    }

    this.phase = 'over';
  }
}

module.exports = BlackjackGame;
