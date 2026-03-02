'use strict';

const GRID_SIZE = 10;
const SHIPS = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 }
];

const EMPTY = 0;
const SHIP = 1;
const HIT = 2;
const MISS = 3;

class BattleshipGame {
  constructor() {
    this.phase = 'placing'; // 'placing' | 'playing' | 'over'
    this.currentTurn = 0;   // which player shoots next
    this.winner = null;

    // Per player: grid (own ship layout), ships array, shots grid (what they've fired at opponent), ready flag
    this.players = [
      { grid: this._emptyGrid(), ships: [], shots: this._emptyGrid(), ready: false },
      { grid: this._emptyGrid(), ships: [], shots: this._emptyGrid(), ready: false }
    ];
  }

  _emptyGrid() {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(EMPTY));
  }

  /**
   * Place a ship for a player.
   * @param {number} playerIdx - 0 or 1
   * @param {string} shipName - one of the SHIPS names
   * @param {number} row - starting row (0-indexed)
   * @param {number} col - starting col (0-indexed)
   * @param {boolean} horizontal - true = extends right, false = extends down
   * @returns {{ valid: boolean, error?: string }}
   */
  placeShip(playerIdx, shipName, row, col, horizontal) {
    if (this.phase !== 'placing') {
      return { valid: false, error: 'Game is not in placing phase' };
    }
    if (playerIdx < 0 || playerIdx > 1) {
      return { valid: false, error: 'Invalid player index' };
    }
    if (this.players[playerIdx].ready) {
      return { valid: false, error: 'Player has already locked in ships' };
    }

    const shipDef = SHIPS.find(s => s.name === shipName);
    if (!shipDef) {
      return { valid: false, error: `Unknown ship: ${shipName}` };
    }

    // Check if this ship type is already placed
    const player = this.players[playerIdx];
    if (player.ships.some(s => s.name === shipName)) {
      return { valid: false, error: `${shipName} already placed` };
    }

    // Build cell list
    const cells = [];
    for (let i = 0; i < shipDef.size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;

      // Bounds check
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) {
        return { valid: false, error: 'Ship extends out of bounds' };
      }

      // Overlap check
      if (player.grid[r][c] !== EMPTY) {
        return { valid: false, error: 'Ship overlaps with another ship' };
      }

      cells.push({ row: r, col: c });
    }

    // Place the ship
    const shipData = {
      name: shipDef.name,
      size: shipDef.size,
      cells,
      hits: 0,
      sunk: false
    };

    player.ships.push(shipData);
    for (const cell of cells) {
      player.grid[cell.row][cell.col] = SHIP;
    }

    return { valid: true };
  }

  /**
   * Remove a previously placed ship (before locking in).
   * @param {number} playerIdx
   * @param {string} shipName
   * @returns {{ valid: boolean, error?: string }}
   */
  removeShip(playerIdx, shipName) {
    if (this.phase !== 'placing') {
      return { valid: false, error: 'Game is not in placing phase' };
    }
    const player = this.players[playerIdx];
    if (player.ready) {
      return { valid: false, error: 'Player has already locked in ships' };
    }

    const shipIdx = player.ships.findIndex(s => s.name === shipName);
    if (shipIdx === -1) {
      return { valid: false, error: `${shipName} is not placed` };
    }

    const ship = player.ships[shipIdx];
    for (const cell of ship.cells) {
      player.grid[cell.row][cell.col] = EMPTY;
    }
    player.ships.splice(shipIdx, 1);

    return { valid: true };
  }

  /**
   * Auto-place all ships randomly for a player. Removes any existing placements first.
   * @param {number} playerIdx
   * @returns {{ valid: boolean, error?: string }}
   */
  autoPlace(playerIdx) {
    if (this.phase !== 'placing') {
      return { valid: false, error: 'Game is not in placing phase' };
    }
    if (playerIdx < 0 || playerIdx > 1) {
      return { valid: false, error: 'Invalid player index' };
    }
    const player = this.players[playerIdx];
    if (player.ready) {
      return { valid: false, error: 'Player has already locked in ships' };
    }

    // Clear existing placements
    player.ships = [];
    player.grid = this._emptyGrid();

    // Place each ship with random retries
    for (const shipDef of SHIPS) {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 200;

      while (!placed && attempts < maxAttempts) {
        attempts++;
        const horizontal = Math.random() < 0.5;
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);

        const result = this.placeShip(playerIdx, shipDef.name, row, col, horizontal);
        if (result.valid) {
          placed = true;
        }
      }

      if (!placed) {
        // Should never happen with a 10x10 grid and 5 ships, but clear and retry all
        player.ships = [];
        player.grid = this._emptyGrid();
        return this.autoPlace(playerIdx);
      }
    }

    return { valid: true };
  }

  /**
   * Mark a player as ready (all 5 ships must be placed).
   * If both players are ready, transition to 'playing' phase.
   * @param {number} playerIdx
   * @returns {{ valid: boolean, error?: string, bothReady: boolean }}
   */
  setReady(playerIdx) {
    if (this.phase !== 'placing') {
      return { valid: false, error: 'Game is not in placing phase', bothReady: false };
    }
    if (playerIdx < 0 || playerIdx > 1) {
      return { valid: false, error: 'Invalid player index', bothReady: false };
    }

    const player = this.players[playerIdx];
    if (player.ships.length !== SHIPS.length) {
      return { valid: false, error: `Must place all ${SHIPS.length} ships before readying up`, bothReady: false };
    }

    player.ready = true;

    const bothReady = this.players[0].ready && this.players[1].ready;
    if (bothReady) {
      this.phase = 'playing';
      this.currentTurn = 0; // Player 0 goes first
    }

    return { valid: true, bothReady };
  }

  /**
   * Fire a shot at the opponent's grid.
   * @param {number} playerIdx - the player firing (0 or 1)
   * @param {number} row
   * @param {number} col
   * @returns {{ valid: boolean, error?: string, row?: number, col?: number, hit?: boolean, sunk?: boolean, shipName?: string, gameOver?: object }}
   */
  fireShot(playerIdx, row, col) {
    if (this.phase !== 'playing') {
      return { valid: false, error: 'Game is not in playing phase' };
    }
    if (playerIdx !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      return { valid: false, error: 'Coordinates out of bounds' };
    }

    const shooter = this.players[playerIdx];
    const opponentIdx = playerIdx === 0 ? 1 : 0;
    const opponent = this.players[opponentIdx];

    // Check if already shot here
    if (shooter.shots[row][col] !== EMPTY) {
      return { valid: false, error: 'Already fired at this cell' };
    }

    // Determine hit or miss
    const isHit = opponent.grid[row][col] === SHIP;
    let sunk = false;
    let sunkShipName = null;

    if (isHit) {
      shooter.shots[row][col] = HIT;
      opponent.grid[row][col] = HIT;

      // Find which ship was hit and update its hit count
      for (const ship of opponent.ships) {
        if (ship.sunk) continue;
        const hitCell = ship.cells.find(c => c.row === row && c.col === col);
        if (hitCell) {
          ship.hits++;
          if (ship.hits >= ship.size) {
            ship.sunk = true;
            sunk = true;
            sunkShipName = ship.name;
          }
          break;
        }
      }
    } else {
      shooter.shots[row][col] = MISS;
      opponent.grid[row][col] = MISS; // Mark miss on opponent grid too (for consistency)
      // Actually, we should only mark miss on shots grid since opponent grid cell was EMPTY
      // Revert: opponent grid stays as-is for empty cells; only shots grid tracks misses
      opponent.grid[row][col] = EMPTY; // keep opponent grid clean (only SHIP and HIT on it)
    }

    // Check game over
    const gameOver = this.checkGameOver();

    if (!gameOver.over) {
      // Switch turns
      this.currentTurn = opponentIdx;
    }

    return {
      valid: true,
      row,
      col,
      hit: isHit,
      sunk,
      shipName: sunkShipName,
      gameOver
    };
  }

  /**
   * Check if the game is over (all ships of one player sunk).
   * @returns {{ over: boolean, winner?: number, reason?: string }}
   */
  checkGameOver() {
    for (let p = 0; p < 2; p++) {
      const allSunk = this.players[p].ships.length > 0 &&
        this.players[p].ships.every(s => s.sunk);
      if (allSunk) {
        const winner = p === 0 ? 1 : 0;
        this.phase = 'over';
        this.winner = winner;
        return { over: true, winner, reason: 'All ships sunk' };
      }
    }
    return { over: false };
  }

  /**
   * Get the game state visible to a specific player.
   * Hides the opponent's ship positions (only shows hits/misses on opponent grid).
   * @param {number} playerIdx
   * @returns {object}
   */
  getStateForPlayer(playerIdx) {
    const opponentIdx = playerIdx === 0 ? 1 : 0;
    const me = this.players[playerIdx];
    const opponent = this.players[opponentIdx];

    // Build opponent grid view: only show HIT and MISS, not SHIP positions
    const opponentGridView = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(EMPTY));
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const shotVal = me.shots[r][c];
        if (shotVal === HIT || shotVal === MISS) {
          opponentGridView[r][c] = shotVal;
        }
      }
    }

    // Own grid: show ships, hits, and misses
    const myGridView = me.grid.map(row => [...row]);

    // Ship status for both players
    const myShips = me.ships.map(s => ({
      name: s.name,
      size: s.size,
      hits: s.hits,
      sunk: s.sunk,
      cells: s.cells.map(c => ({ ...c }))
    }));

    const opponentShips = opponent.ships.map(s => ({
      name: s.name,
      size: s.size,
      hits: s.hits,
      sunk: s.sunk
      // Do NOT include cells -- that would reveal positions
    }));

    return {
      phase: this.phase,
      currentTurn: this.currentTurn,
      winner: this.winner,
      myGrid: myGridView,
      opponentGrid: opponentGridView,
      myShips,
      opponentShips,
      myReady: me.ready,
      opponentReady: opponent.ready
    };
  }

  /**
   * Get full game state (for server / spectator use).
   * @returns {object}
   */
  getState() {
    return {
      phase: this.phase,
      currentTurn: this.currentTurn,
      winner: this.winner,
      players: this.players.map(p => ({
        grid: p.grid.map(row => [...row]),
        ships: p.ships.map(s => ({
          name: s.name,
          size: s.size,
          cells: s.cells.map(c => ({ ...c })),
          hits: s.hits,
          sunk: s.sunk
        })),
        shots: p.shots.map(row => [...row]),
        ready: p.ready
      }))
    };
  }
}

// Static constants
BattleshipGame.GRID_SIZE = GRID_SIZE;
BattleshipGame.SHIPS = SHIPS;
BattleshipGame.EMPTY = EMPTY;
BattleshipGame.SHIP = SHIP;
BattleshipGame.HIT = HIT;
BattleshipGame.MISS = MISS;

module.exports = BattleshipGame;
