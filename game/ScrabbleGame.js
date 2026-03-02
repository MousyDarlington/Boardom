'use strict';

/**
 * ScrabbleGame — Pure state machine for Scrabble board game.
 *
 * Board: 15x15 grid with premium squares (TW, DW, TL, DL).
 * 100 tiles in bag (standard English distribution + 2 blanks).
 * 2-8 players, 7-tile racks.
 * Dictionary injected via constructor for word validation.
 */

const BOARD_SIZE = 15;
const RACK_SIZE = 7;
const CENTER = 7;

// Premium square positions as "row,col" strings
const TRIPLE_WORD = new Set([
  '0,0','0,7','0,14','7,0','7,14','14,0','14,7','14,14'
]);
const DOUBLE_WORD = new Set([
  '1,1','1,13','2,2','2,12','3,3','3,11','4,4','4,10',
  '10,4','10,10','11,3','11,11','12,2','12,12','13,1','13,13',
  '7,7'
]);
const TRIPLE_LETTER = new Set([
  '1,5','1,9','5,1','5,5','5,9','5,13',
  '9,1','9,5','9,9','9,13','13,5','13,9'
]);
const DOUBLE_LETTER = new Set([
  '0,3','0,11','2,6','2,8','3,0','3,7','3,14',
  '6,2','6,6','6,8','6,12','7,3','7,11',
  '8,2','8,6','8,8','8,12','11,0','11,7','11,14',
  '12,6','12,8','14,3','14,11'
]);

// Tile distribution: [letter, value, count]
const TILE_DISTRIBUTION = [
  ['A',1,9],['B',3,2],['C',3,2],['D',2,4],['E',1,12],
  ['F',4,2],['G',2,3],['H',4,2],['I',1,9],['J',8,1],
  ['K',5,1],['L',1,4],['M',3,2],['N',1,6],['O',1,8],
  ['P',3,2],['Q',10,1],['R',1,6],['S',1,4],['T',1,6],
  ['U',1,4],['V',4,2],['W',4,2],['X',8,1],['Y',4,2],
  ['Z',10,1],['_',0,2]
];

const LETTER_VALUES = {};
TILE_DISTRIBUTION.forEach(([l, v]) => { LETTER_VALUES[l] = v; });

class ScrabbleGame {
  constructor(playerCount, dictionary) {
    this.playerCount = Math.max(2, Math.min(8, playerCount || 2));
    this.dictionary = dictionary; // Set of valid uppercase words
    this.currentTurn = 0;
    this.phase = 'place';
    this.gameOver = false;
    this.winner = null;
    this.firstMove = true;

    // Board: 15x15, null or {letter, value, playedBy, isBlank}
    this.board = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(null)
    );

    // Tile bag
    this.bag = [];
    for (const [letter, value, count] of TILE_DISTRIBUTION) {
      for (let i = 0; i < count; i++) {
        this.bag.push({ letter, value });
      }
    }
    this._shuffleBag();

    // Racks
    this.racks = [];
    for (let p = 0; p < this.playerCount; p++) {
      this.racks.push([]);
      this._drawTiles(p, RACK_SIZE);
    }

    // Scores
    this.scores = new Array(this.playerCount).fill(0);
    this.consecutivePasses = 0;
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      playerCount: this.playerCount,
      currentTurn: this.currentTurn,
      board: this.board.map(r => r.map(c => c ? { ...c } : null)),
      scores: [...this.scores],
      bagCount: this.bag.length,
      phase: this.phase,
      gameOver: this.gameOver,
      winner: this.winner,
      firstMove: this.firstMove,
      consecutivePasses: this.consecutivePasses
    };
  }

  getStateForPlayer(playerIndex) {
    const state = this.getState();
    state.rack = this.racks[playerIndex]
      ? this.racks[playerIndex].map(t => ({ ...t }))
      : [];
    return state;
  }

  serialize() {
    return {
      playerCount: this.playerCount,
      currentTurn: this.currentTurn,
      phase: this.phase,
      gameOver: this.gameOver,
      winner: this.winner,
      firstMove: this.firstMove,
      consecutivePasses: this.consecutivePasses,
      board: this.board.map(row => row.map(cell => cell ? { ...cell } : null)),
      bag: this.bag.map(t => ({ ...t })),
      racks: this.racks.map(rack => rack.map(t => ({ ...t }))),
      scores: [...this.scores]
    };
  }

  static deserialize(data, dictionary) {
    const g = new ScrabbleGame(data.playerCount, dictionary);
    g.currentTurn = data.currentTurn;
    g.phase = data.phase;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.firstMove = data.firstMove;
    g.consecutivePasses = data.consecutivePasses;
    g.board = data.board;
    g.bag = data.bag;
    g.racks = data.racks;
    g.scores = data.scores;
    return g;
  }

  /**
   * Place tiles and submit the word.
   * @param {number} playerIndex
   * @param {Array<{row,col,letter,isBlank,blankLetter}>} placements
   */
  placeTiles(playerIndex, placements) {
    if (this.gameOver) return { valid: false, error: 'Game is over' };
    if (playerIndex !== this.currentTurn) return { valid: false, error: 'Not your turn' };
    if (!placements || placements.length === 0) return { valid: false, error: 'No tiles placed' };

    // Validate positions are on empty squares and in bounds
    for (const p of placements) {
      if (p.row < 0 || p.row >= BOARD_SIZE || p.col < 0 || p.col >= BOARD_SIZE)
        return { valid: false, error: 'Out of bounds' };
      if (this.board[p.row][p.col] !== null)
        return { valid: false, error: `Square ${p.row},${p.col} is occupied` };
    }

    // Check for duplicate positions
    const posSet = new Set(placements.map(p => `${p.row},${p.col}`));
    if (posSet.size !== placements.length)
      return { valid: false, error: 'Duplicate positions' };

    // Validate tiles come from rack
    const rackCopy = this.racks[playerIndex].map(t => ({ ...t }));
    for (const p of placements) {
      const tileChar = p.isBlank ? '_' : p.letter;
      const idx = rackCopy.findIndex(t => t.letter === tileChar);
      if (idx === -1) return { valid: false, error: `Tile ${tileChar} not in rack` };
      rackCopy.splice(idx, 1);
    }

    // All tiles must be in same row or same column
    const rows = [...new Set(placements.map(p => p.row))];
    const cols = [...new Set(placements.map(p => p.col))];
    if (rows.length > 1 && cols.length > 1)
      return { valid: false, error: 'Tiles must be in a single row or column' };

    const isHorizontal = rows.length === 1;

    // Validate continuity (no gaps unless filled by existing tiles)
    if (!this._validateContinuity(placements, isHorizontal))
      return { valid: false, error: 'Tiles must form a continuous line' };

    // First move must cover center and be at least 2 letters
    if (this.firstMove) {
      const coversCenter = placements.some(p => p.row === CENTER && p.col === CENTER);
      if (!coversCenter) return { valid: false, error: 'First word must cover center square' };
      if (placements.length < 2)
        return { valid: false, error: 'First word must be at least 2 letters' };
    } else {
      if (!this._connectsToExisting(placements))
        return { valid: false, error: 'Must connect to existing tiles' };
    }

    // Temporarily place tiles to find words
    const tempBoard = this.board.map(r => r.map(c => c ? { ...c } : null));
    for (const p of placements) {
      const displayLetter = p.isBlank ? (p.blankLetter || 'A') : p.letter;
      const value = p.isBlank ? 0 : LETTER_VALUES[p.letter];
      tempBoard[p.row][p.col] = {
        letter: displayLetter,
        value: value,
        playedBy: playerIndex,
        isBlank: !!p.isBlank,
        justPlaced: true
      };
    }

    // Find all words formed
    const words = this._findAllWords(tempBoard, placements, isHorizontal);
    if (words.length === 0)
      return { valid: false, error: 'No valid word formed' };

    // Validate against dictionary
    for (const w of words) {
      if (!this.dictionary.has(w.word.toUpperCase()))
        return { valid: false, error: `"${w.word}" is not a valid word` };
    }

    // Score each word
    let totalScore = 0;
    const scoredWords = [];
    for (const w of words) {
      const wordScore = this._scoreWord(w.tiles);
      totalScore += wordScore;
      scoredWords.push({ word: w.word, score: wordScore });
    }

    // Bingo bonus
    if (placements.length === RACK_SIZE) totalScore += 50;

    // Apply to real board
    for (const p of placements) {
      const displayLetter = p.isBlank ? (p.blankLetter || 'A') : p.letter;
      const value = p.isBlank ? 0 : LETTER_VALUES[p.letter];
      this.board[p.row][p.col] = {
        letter: displayLetter,
        value: value,
        playedBy: playerIndex,
        isBlank: !!p.isBlank
      };
    }

    // Remove tiles from rack
    for (const p of placements) {
      const tileChar = p.isBlank ? '_' : p.letter;
      const idx = this.racks[playerIndex].findIndex(t => t.letter === tileChar);
      if (idx !== -1) this.racks[playerIndex].splice(idx, 1);
    }

    // Draw new tiles
    this._drawTiles(playerIndex, RACK_SIZE - this.racks[playerIndex].length);

    // Update score
    this.scores[playerIndex] += totalScore;
    this.consecutivePasses = 0;
    this.firstMove = false;

    // Check game end
    const ended = this._checkGameEnd(playerIndex);
    if (!ended) this._nextTurn();

    return {
      valid: true,
      player: playerIndex,
      placements,
      words: scoredWords,
      totalScore,
      newRack: this.racks[playerIndex].map(t => ({ ...t })),
      scores: [...this.scores],
      board: this.board.map(r => r.map(c => c ? { ...c } : null)),
      bagCount: this.bag.length,
      gameOver: this.gameOver ? { over: true, winner: this.winner } : { over: false },
      currentTurn: this.currentTurn
    };
  }

  exchangeTiles(playerIndex, tileIndices) {
    if (this.gameOver) return { valid: false, error: 'Game is over' };
    if (playerIndex !== this.currentTurn) return { valid: false, error: 'Not your turn' };
    if (this.bag.length < 7) return { valid: false, error: 'Not enough tiles in bag to exchange' };
    if (!tileIndices || tileIndices.length === 0) return { valid: false, error: 'No tiles selected' };

    // Remove selected tiles, put back in bag
    const removed = [];
    const sortedIndices = [...tileIndices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      if (idx < 0 || idx >= this.racks[playerIndex].length)
        return { valid: false, error: 'Invalid tile index' };
      removed.push(this.racks[playerIndex].splice(idx, 1)[0]);
    }

    // Draw new tiles first
    this._drawTiles(playerIndex, removed.length);

    // Put removed back and shuffle
    for (const tile of removed) this.bag.push(tile);
    this._shuffleBag();

    this.consecutivePasses = 0;
    this._nextTurn();

    return {
      valid: true,
      player: playerIndex,
      action: 'exchange',
      tilesExchanged: removed.length,
      newRack: this.racks[playerIndex].map(t => ({ ...t })),
      bagCount: this.bag.length,
      currentTurn: this.currentTurn,
      scores: [...this.scores],
      board: this.board.map(r => r.map(c => c ? { ...c } : null)),
      gameOver: { over: false }
    };
  }

  passTurn(playerIndex) {
    if (this.gameOver) return { valid: false, error: 'Game is over' };
    if (playerIndex !== this.currentTurn) return { valid: false, error: 'Not your turn' };

    this.consecutivePasses++;

    if (this.consecutivePasses >= this.playerCount * 2) {
      this._endGame();
      return {
        valid: true,
        player: playerIndex,
        action: 'pass',
        gameOver: { over: true, winner: this.winner },
        scores: [...this.scores],
        board: this.board.map(r => r.map(c => c ? { ...c } : null)),
        bagCount: this.bag.length,
        currentTurn: this.currentTurn
      };
    }

    this._nextTurn();
    return {
      valid: true,
      player: playerIndex,
      action: 'pass',
      currentTurn: this.currentTurn,
      consecutivePasses: this.consecutivePasses,
      scores: [...this.scores],
      board: this.board.map(r => r.map(c => c ? { ...c } : null)),
      bagCount: this.bag.length,
      gameOver: { over: false }
    };
  }

  /* ---------- Internal helpers ---------- */

  _shuffleBag() {
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  _drawTiles(playerIndex, count) {
    const draw = Math.min(count, this.bag.length);
    for (let i = 0; i < draw; i++) {
      this.racks[playerIndex].push(this.bag.pop());
    }
  }

  _nextTurn() {
    this.currentTurn = (this.currentTurn + 1) % this.playerCount;
  }

  _validateContinuity(placements, isHorizontal) {
    if (placements.length <= 1) return true;

    const sorted = [...placements].sort((a, b) =>
      isHorizontal ? a.col - b.col : a.row - b.row
    );

    const fixedAxis = isHorizontal ? sorted[0].row : sorted[0].col;
    const start = isHorizontal ? sorted[0].col : sorted[0].row;
    const end = isHorizontal ? sorted[sorted.length - 1].col : sorted[sorted.length - 1].row;

    const placedSet = new Set(placements.map(p => `${p.row},${p.col}`));
    for (let i = start; i <= end; i++) {
      const r = isHorizontal ? fixedAxis : i;
      const c = isHorizontal ? i : fixedAxis;
      if (!placedSet.has(`${r},${c}`) && this.board[r][c] === null) {
        return false;
      }
    }
    return true;
  }

  _connectsToExisting(placements) {
    for (const p of placements) {
      const neighbors = [
        [p.row - 1, p.col], [p.row + 1, p.col],
        [p.row, p.col - 1], [p.row, p.col + 1]
      ];
      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (this.board[nr][nc] !== null) return true;
        }
      }
    }
    return false;
  }

  _findAllWords(tempBoard, placements, isHorizontal) {
    const words = [];

    // Main word along primary axis
    const mainWord = this._getWordAt(
      tempBoard, placements[0].row, placements[0].col, isHorizontal
    );
    if (mainWord && mainWord.word.length >= 2) words.push(mainWord);

    // Cross words perpendicular to primary axis
    for (const p of placements) {
      const crossWord = this._getWordAt(tempBoard, p.row, p.col, !isHorizontal);
      if (crossWord && crossWord.word.length >= 2) words.push(crossWord);
    }

    return words;
  }

  _getWordAt(tempBoard, row, col, horizontal) {
    let r = row, c = col;

    // Find start of word
    if (horizontal) {
      while (c > 0 && tempBoard[r][c - 1] !== null) c--;
    } else {
      while (r > 0 && tempBoard[r - 1][c] !== null) r--;
    }

    // Collect word
    const tiles = [];
    let word = '';
    let cr = r, cc = c;
    while (cr < BOARD_SIZE && cc < BOARD_SIZE && tempBoard[cr][cc] !== null) {
      const tile = tempBoard[cr][cc];
      word += tile.letter;
      tiles.push({ row: cr, col: cc, letter: tile.letter, value: tile.value, justPlaced: !!tile.justPlaced });
      if (horizontal) cc++;
      else cr++;
    }

    return word.length >= 2 ? { word, tiles } : null;
  }

  _scoreWord(tiles) {
    let wordScore = 0;
    let wordMultiplier = 1;

    for (const t of tiles) {
      let letterScore = t.value;
      const key = `${t.row},${t.col}`;

      if (t.justPlaced) {
        if (TRIPLE_LETTER.has(key)) letterScore *= 3;
        else if (DOUBLE_LETTER.has(key)) letterScore *= 2;
        if (TRIPLE_WORD.has(key)) wordMultiplier *= 3;
        else if (DOUBLE_WORD.has(key)) wordMultiplier *= 2;
      }
      wordScore += letterScore;
    }

    return wordScore * wordMultiplier;
  }

  _checkGameEnd(lastPlayer) {
    if (this.racks[lastPlayer].length === 0 && this.bag.length === 0) {
      this._endGame(lastPlayer);
      return true;
    }
    return false;
  }

  _endGame(finisher) {
    this.gameOver = true;

    if (finisher !== undefined) {
      let bonus = 0;
      for (let p = 0; p < this.playerCount; p++) {
        if (p === finisher) continue;
        let penalty = 0;
        for (const tile of this.racks[p]) penalty += tile.value;
        this.scores[p] -= penalty;
        bonus += penalty;
      }
      this.scores[finisher] += bonus;
    } else {
      for (let p = 0; p < this.playerCount; p++) {
        let penalty = 0;
        for (const tile of this.racks[p]) penalty += tile.value;
        this.scores[p] -= penalty;
      }
    }

    // Determine winner
    let maxScore = -Infinity;
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
ScrabbleGame.BOARD_SIZE = BOARD_SIZE;
ScrabbleGame.RACK_SIZE = RACK_SIZE;
ScrabbleGame.CENTER = CENTER;
ScrabbleGame.TILE_DISTRIBUTION = TILE_DISTRIBUTION;
ScrabbleGame.LETTER_VALUES = LETTER_VALUES;
ScrabbleGame.TRIPLE_WORD = TRIPLE_WORD;
ScrabbleGame.DOUBLE_WORD = DOUBLE_WORD;
ScrabbleGame.TRIPLE_LETTER = TRIPLE_LETTER;
ScrabbleGame.DOUBLE_LETTER = DOUBLE_LETTER;

module.exports = ScrabbleGame;
