'use strict';

const ScrabbleGame = require('./ScrabbleGame');

class ScrabbleBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || `scrabble_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._timer = null;

    this.skill = botRating >= 1300 ? 1 : 0;

    // Bot state
    this.rack = [];
    this.boardState = null;
    this.dictionary = null; // Set, injected by Matchmaker

    const self = this;
    this.socket = {
      id: `bot_${this.username}`,
      username: this.username,
      join() {},
      leave() {},
      emit(event, data) { self._onEvent(event, data); },
      on() {}
    };
  }

  _onEvent(event, data) {
    if (this.destroyed) return;

    if (event === 'scrabble:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      this.rack = data.rack || [];
      this.boardState = data.board;
      this.firstMove = data.firstMove;
      if (data.currentTurn === this.playerIndex) {
        this._scheduleTurn();
      }
    } else if (event === 'scrabble:update') {
      this.boardState = data.board;
      if (data.newRack) this.rack = data.newRack;
      this.firstMove = false;
      if (data.currentTurn === this.playerIndex) {
        this._scheduleTurn();
      }
    } else if (event === 'scrabble:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 1500 + Math.random() * 2000;
  }

  _scheduleTurn() {
    if (this.destroyed) return;
    this._timer = setTimeout(() => {
      if (this.destroyed) return;
      this._executeTurn();
    }, this._thinkMs());
  }

  _executeTurn() {
    if (!this.boardState || !this.dictionary) {
      this.matchmaker.scrabblePass(this.socket);
      return;
    }

    const moves = this._findAllValidMoves();

    if (moves.length > 0) {
      const move = this.skill === 1
        ? moves.reduce((best, m) => m.score > best.score ? m : best, moves[0])
        : moves[Math.floor(Math.random() * moves.length)];
      this.matchmaker.scrabblePlaceTiles(this.socket, move.placements);
    } else if (this.rack.length > 0 && this._getBagCount() >= 7) {
      // Exchange up to 3 tiles
      const count = Math.min(3, this.rack.length);
      const indices = [];
      for (let i = 0; i < count; i++) indices.push(i);
      this.matchmaker.scrabbleExchangeTiles(this.socket, indices);
    } else {
      this.matchmaker.scrabblePass(this.socket);
    }
  }

  _getBagCount() {
    const gd = this.matchmaker.games.get(this.gameId);
    if (!gd || !gd.scrabbleGame) return 0;
    return gd.scrabbleGame.bag.length;
  }

  _findAllValidMoves() {
    const board = this.boardState;
    const SIZE = ScrabbleGame.BOARD_SIZE;
    const moves = [];

    // Find anchors: empty squares adjacent to filled squares, or center if board is empty
    const anchors = [];
    let boardEmpty = true;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== null) {
          boardEmpty = false;
          continue;
        }
        const adj = [
          [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
        ];
        for (const [ar, ac] of adj) {
          if (ar >= 0 && ar < SIZE && ac >= 0 && ac < SIZE && board[ar][ac] !== null) {
            anchors.push({ row: r, col: c });
            break;
          }
        }
      }
    }

    if (boardEmpty) {
      anchors.push({ row: ScrabbleGame.CENTER, col: ScrabbleGame.CENTER });
    }

    // For each anchor, try placing words horizontally and vertically
    const rackLetters = this.rack.map(t => t.letter);

    for (const anchor of anchors) {
      this._tryPlaceAt(board, anchor, true, rackLetters, moves, boardEmpty);
      this._tryPlaceAt(board, anchor, false, rackLetters, moves, boardEmpty);
    }

    return moves;
  }

  _tryPlaceAt(board, anchor, horizontal, rackLetters, moves, boardEmpty) {
    const SIZE = ScrabbleGame.BOARD_SIZE;

    // Find how far left/up we can extend from anchor
    let startR = anchor.row, startC = anchor.col;
    if (horizontal) {
      while (startC > 0 && board[startR][startC - 1] === null) {
        startC--;
        if (startC <= anchor.col - rackLetters.length) break;
      }
    } else {
      while (startR > 0 && board[startR - 1][startC] === null) {
        startR--;
        if (startR <= anchor.row - rackLetters.length) break;
      }
    }

    // Try words starting from various positions
    const maxLen = Math.min(rackLetters.length, 7);

    for (let len = 2; len <= maxLen; len++) {
      // Try each starting offset
      const endR = horizontal ? anchor.row : anchor.row;
      const endC = horizontal ? anchor.col : anchor.col;

      for (let offset = 0; offset < len; offset++) {
        const sr = horizontal ? anchor.row : anchor.row - offset;
        const sc = horizontal ? anchor.col - offset : anchor.col;
        if (sr < 0 || sc < 0) continue;
        const er = horizontal ? sr : sr + len - 1;
        const ec = horizontal ? sc + len - 1 : sc;
        if (er >= SIZE || ec >= SIZE) continue;

        // Collect needed letters for this position
        const needed = [];
        const existing = [];
        let valid = true;

        for (let i = 0; i < len; i++) {
          const r = horizontal ? sr : sr + i;
          const c = horizontal ? sc + i : sc;
          if (board[r][c] !== null) {
            existing.push({ pos: i, letter: board[r][c].letter });
          } else {
            needed.push(i);
          }
        }

        if (needed.length === 0) continue; // all occupied
        if (needed.length > rackLetters.length) continue;

        // First move must cover center
        if (boardEmpty) {
          let coversCenter = false;
          for (let i = 0; i < len; i++) {
            const r = horizontal ? sr : sr + i;
            const c = horizontal ? sc + i : sc;
            if (r === ScrabbleGame.CENTER && c === ScrabbleGame.CENTER) {
              coversCenter = true;
              break;
            }
          }
          if (!coversCenter) continue;
        }

        // Try permutations of rack letters to fill needed positions
        this._tryPermutations(rackLetters, needed, existing, len, sr, sc, horizontal, board, moves);
      }
    }
  }

  _tryPermutations(rackLetters, needed, existing, wordLen, startR, startC, horizontal, board, moves) {
    const SIZE = ScrabbleGame.BOARD_SIZE;
    const usedIndices = new Set();

    const tryFill = (neededIdx, chosen) => {
      if (moves.length > 200) return; // limit search

      if (neededIdx === needed.length) {
        // Build the word
        const wordArr = new Array(wordLen);
        for (const ex of existing) wordArr[ex.pos] = ex.letter;
        for (let i = 0; i < needed.length; i++) wordArr[needed[i]] = chosen[i].letter;

        const word = wordArr.join('');
        if (!this.dictionary.has(word.toUpperCase())) return;

        // Build placements
        const placements = [];
        for (let i = 0; i < needed.length; i++) {
          const pos = needed[i];
          const r = horizontal ? startR : startR + pos;
          const c = horizontal ? startC + pos : startC;
          const tile = chosen[i];
          if (tile.rackLetter === '_') {
            placements.push({ row: r, col: c, letter: '_', isBlank: true, blankLetter: tile.letter });
          } else {
            placements.push({ row: r, col: c, letter: tile.letter, isBlank: false });
          }
        }

        // Quick cross-word check
        if (!this._crossWordsValid(board, placements, horizontal)) return;

        // Estimate score
        const score = this._estimateScore(board, placements, wordLen, startR, startC, horizontal, existing);

        moves.push({ placements, word, score });
        return;
      }

      // Try each unused rack letter
      const tried = new Set();
      for (let ri = 0; ri < rackLetters.length; ri++) {
        if (usedIndices.has(ri)) continue;
        const rl = rackLetters[ri];
        if (tried.has(rl)) continue;
        tried.add(rl);

        usedIndices.add(ri);
        if (rl === '_') {
          // Blank: try common letters
          for (const bl of 'ETAOINSHRDL') {
            chosen.push({ letter: bl, rackLetter: '_' });
            tryFill(neededIdx + 1, chosen);
            chosen.pop();
          }
        } else {
          chosen.push({ letter: rl, rackLetter: rl });
          tryFill(neededIdx + 1, chosen);
          chosen.pop();
        }
        usedIndices.delete(ri);
      }
    };

    tryFill(0, []);
  }

  _crossWordsValid(board, placements, mainHorizontal) {
    const SIZE = ScrabbleGame.BOARD_SIZE;
    for (const p of placements) {
      // Check perpendicular direction
      let r = p.row, c = p.col;
      if (mainHorizontal) {
        // Check vertical cross
        let top = r, bot = r;
        while (top > 0 && board[top - 1][c] !== null) top--;
        while (bot < SIZE - 1 && board[bot + 1][c] !== null) bot++;
        if (top === bot) continue; // no cross word
        let word = '';
        for (let rr = top; rr <= bot; rr++) {
          if (rr === r) word += (p.isBlank ? p.blankLetter : p.letter);
          else if (board[rr][c]) word += board[rr][c].letter;
          else return false; // gap
        }
        if (word.length >= 2 && !this.dictionary.has(word.toUpperCase())) return false;
      } else {
        let left = c, right = c;
        while (left > 0 && board[r][left - 1] !== null) left--;
        while (right < SIZE - 1 && board[r][right + 1] !== null) right++;
        if (left === right) continue;
        let word = '';
        for (let cc = left; cc <= right; cc++) {
          if (cc === c) word += (p.isBlank ? p.blankLetter : p.letter);
          else if (board[r][cc]) word += board[r][cc].letter;
          else return false;
        }
        if (word.length >= 2 && !this.dictionary.has(word.toUpperCase())) return false;
      }
    }
    return true;
  }

  _estimateScore(board, placements, wordLen, startR, startC, horizontal, existing) {
    let score = 0;
    let wordMult = 1;
    const VALUES = ScrabbleGame.LETTER_VALUES;
    const TW = ScrabbleGame.TRIPLE_WORD;
    const DW = ScrabbleGame.DOUBLE_WORD;
    const TL = ScrabbleGame.TRIPLE_LETTER;
    const DL = ScrabbleGame.DOUBLE_LETTER;

    for (let i = 0; i < wordLen; i++) {
      const r = horizontal ? startR : startR + i;
      const c = horizontal ? startC + i : startC;
      const key = `${r},${c}`;

      const placed = placements.find(p => p.row === r && p.col === c);
      if (placed) {
        let lv = placed.isBlank ? 0 : (VALUES[placed.letter] || 0);
        if (TL.has(key)) lv *= 3;
        else if (DL.has(key)) lv *= 2;
        if (TW.has(key)) wordMult *= 3;
        else if (DW.has(key)) wordMult *= 2;
        score += lv;
      } else {
        const ex = existing.find(e => e.pos === i);
        if (ex) {
          score += VALUES[ex.letter] || 0;
        } else if (board[r][c]) {
          score += board[r][c].value || 0;
        }
      }
    }

    score *= wordMult;
    if (placements.length === 7) score += 50;
    return score;
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = ScrabbleBotPlayer;
