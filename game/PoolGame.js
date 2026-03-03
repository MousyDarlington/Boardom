'use strict';

/* ================================================
   CONSTANTS
   ================================================ */
const TABLE_W = 800;
const TABLE_H = 400;
const BALL_R = 10;
const POCKET_R = 18;
const FRICTION = 0.985;
const STOP_SPEED = 0.1;
const DT = 1 / 120;
const MAX_STEPS = 10000;
const MAX_POWER = 20;
const POWER_SCALE = 40; // Multiply power to get meaningful velocity on 800px table

// 6 pocket positions (relative to table origin 0,0)
const POCKETS = [
  { x: 0, y: 0 },                          // top-left
  { x: TABLE_W / 2, y: 0 },                // top-center
  { x: TABLE_W, y: 0 },                    // top-right
  { x: 0, y: TABLE_H },                    // bottom-left
  { x: TABLE_W / 2, y: TABLE_H },          // bottom-center
  { x: TABLE_W, y: TABLE_H }               // bottom-right
];

// Ball type helpers
function ballType(id) {
  if (id === 0) return 'cue';
  if (id >= 1 && id <= 7) return 'solid';
  if (id === 8) return 'eight';
  return 'stripe';
}

/* ================================================
   POOL GAME CLASS
   ================================================ */
class PoolGame {
  constructor() {
    this.balls = [];
    this.currentTurn = 0;
    this.playerGroups = [null, null]; // 'solid' | 'stripe'
    this.phase = 'playing'; // 'playing' | 'over'
    this.ballInHand = true; // true at start for break shot
    this.gameOver = false;
    this.winner = null;
    this.foulReason = null;
    this.lastPocketed = [];
    this.turnMessage = '';

    this._initBalls();
  }

  /* ---------- Ball Setup ---------- */

  _initBalls() {
    // Cue ball at 1/4 of table
    this.balls.push({ id: 0, x: TABLE_W * 0.25, y: TABLE_H / 2, vx: 0, vy: 0, pocketed: false });

    // Rack balls in triangle at 3/4 of table
    // Standard 8-ball rack: 8 in center, mix solids/stripes
    const cx = TABLE_W * 0.72;
    const cy = TABLE_H / 2;
    const spacing = BALL_R * 2.05; // slight gap

    // Build triangle positions: 5 rows
    const positions = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        const x = cx + row * spacing * Math.cos(Math.PI / 6);
        const y = cy + (col - row / 2) * spacing;
        positions.push({ x, y });
      }
    }

    // Assign ball IDs to positions
    // Position 0 = apex (row 0), positions 1-2 = row 1, positions 3-5 = row 2, etc.
    // 8-ball must be at position 4 (center of row 2)
    // Mix solids and stripes in the rest
    const solids = [1, 2, 3, 4, 5, 6, 7];
    const stripes = [9, 10, 11, 12, 13, 14, 15];

    // Shuffle both groups
    this._shuffle(solids);
    this._shuffle(stripes);

    // Build assignment: position 4 = 8-ball
    // Bottom corners (positions 10 and 14) should be one solid and one stripe
    const assignment = new Array(15).fill(0);
    assignment[4] = 8;

    // Place one solid and one stripe at bottom corners
    assignment[10] = solids.pop();
    assignment[14] = stripes.pop();

    // Fill remaining positions alternating
    const remaining = [...solids, ...stripes];
    this._shuffle(remaining);

    let ri = 0;
    for (let i = 0; i < 15; i++) {
      if (assignment[i] === 0) {
        assignment[i] = remaining[ri++];
      }
    }

    for (let i = 0; i < 15; i++) {
      this.balls.push({
        id: assignment[i],
        x: positions[i].x,
        y: positions[i].y,
        vx: 0, vy: 0,
        pocketed: false
      });
    }
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /* ---------- Public API ---------- */

  getState() {
    return {
      balls: this.balls.map(b => ({ ...b })),
      currentTurn: this.currentTurn,
      playerGroups: [...this.playerGroups],
      phase: this.phase,
      ballInHand: this.ballInHand,
      gameOver: this.gameOver,
      winner: this.winner,
      foulReason: this.foulReason,
      lastPocketed: [...this.lastPocketed],
      turnMessage: this.turnMessage,
      tableW: TABLE_W,
      tableH: TABLE_H,
      ballR: BALL_R,
      pocketR: POCKET_R,
      pockets: POCKETS.map(p => ({ ...p }))
    };
  }

  getStateForPlayer(idx) {
    return { ...this.getState(), myIndex: idx };
  }

  serialize() {
    return {
      balls: this.balls.map(b => ({ ...b })),
      currentTurn: this.currentTurn,
      playerGroups: [...this.playerGroups],
      phase: this.phase,
      ballInHand: this.ballInHand,
      gameOver: this.gameOver,
      winner: this.winner,
      foulReason: this.foulReason,
      lastPocketed: [...this.lastPocketed],
      turnMessage: this.turnMessage
    };
  }

  static deserialize(data) {
    const g = new PoolGame();
    g.balls = data.balls.map(b => ({ ...b }));
    g.currentTurn = data.currentTurn;
    g.playerGroups = [...data.playerGroups];
    g.phase = data.phase;
    g.ballInHand = data.ballInHand;
    g.gameOver = data.gameOver;
    g.winner = data.winner;
    g.foulReason = data.foulReason;
    g.lastPocketed = [...(data.lastPocketed || [])];
    g.turnMessage = data.turnMessage || '';
    return g;
  }

  /**
   * Place the cue ball (ball-in-hand).
   */
  placeCueBall(playerIdx, x, y) {
    if (this.gameOver) return { valid: false, error: 'Game is over' };
    if (playerIdx !== this.currentTurn) return { valid: false, error: 'Not your turn' };
    if (!this.ballInHand) return { valid: false, error: 'Not in ball-in-hand mode' };

    // Must be within table bounds
    if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) {
      return { valid: false, error: 'Out of bounds' };
    }

    // Must not overlap another ball
    for (const b of this.balls) {
      if (b.id === 0 || b.pocketed) continue;
      const dx = x - b.x, dy = y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < BALL_R * 2.2) {
        return { valid: false, error: 'Overlaps another ball' };
      }
    }

    const cue = this.balls.find(b => b.id === 0);
    cue.x = x;
    cue.y = y;
    cue.pocketed = false;
    this.ballInHand = false;
    this.foulReason = null;

    return { valid: true, balls: this.balls.map(b => ({ ...b })), ballInHand: false, phase: this.phase, currentTurn: this.currentTurn };
  }

  /**
   * Execute a shot.
   */
  shoot(playerIdx, angle, power) {
    if (this.gameOver) return { valid: false, error: 'Game is over' };
    if (playerIdx !== this.currentTurn) return { valid: false, error: 'Not your turn' };
    if (this.ballInHand) return { valid: false, error: 'Must place cue ball first' };
    if (power <= 0 || power > MAX_POWER) return { valid: false, error: 'Invalid power' };

    const cue = this.balls.find(b => b.id === 0);
    cue.vx = Math.cos(angle) * power * POWER_SCALE;
    cue.vy = Math.sin(angle) * power * POWER_SCALE;

    // Run simulation
    const simResult = this._simulate();

    // Evaluate the result
    this._evaluateShot(simResult);

    return {
      valid: true,
      balls: this.balls.map(b => ({ ...b })),
      pocketed: simResult.pocketed.map(id => id),
      foul: !!this.foulReason,
      foulReason: this.foulReason,
      turnMessage: this.turnMessage,
      currentTurn: this.currentTurn,
      playerGroups: [...this.playerGroups],
      phase: this.phase,
      ballInHand: this.ballInHand,
      gameOver: this.gameOver,
      winner: this.winner,
      shotAngle: angle,
      shotPower: power
    };
  }

  /* ---------- Physics Simulation ---------- */

  _simulate() {
    const pocketed = [];
    let firstHitId = null;
    let hitAnyBall = false;

    for (let step = 0; step < MAX_STEPS; step++) {
      let allStopped = true;

      // Move balls
      for (const b of this.balls) {
        if (b.pocketed) continue;
        if (Math.abs(b.vx) > STOP_SPEED || Math.abs(b.vy) > STOP_SPEED) {
          allStopped = false;
          b.x += b.vx * DT;
          b.y += b.vy * DT;
        }
      }

      if (allStopped && step > 0) break;

      // Ball-ball collisions
      const active = this.balls.filter(b => !b.pocketed);
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const b1 = active[i], b2 = active[j];
          const dx = b2.x - b1.x, dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < BALL_R * 2 && dist > 0) {
            // Track first hit by cue ball
            if (!hitAnyBall && (b1.id === 0 || b2.id === 0)) {
              firstHitId = b1.id === 0 ? b2.id : b1.id;
              hitAnyBall = true;
            }

            // Separate
            const overlap = BALL_R * 2 - dist;
            const nx = dx / dist, ny = dy / dist;
            b1.x -= nx * overlap / 2;
            b1.y -= ny * overlap / 2;
            b2.x += nx * overlap / 2;
            b2.y += ny * overlap / 2;

            // Elastic collision (equal mass)
            const dvx = b1.vx - b2.vx, dvy = b1.vy - b2.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              b1.vx -= dot * nx;
              b1.vy -= dot * ny;
              b2.vx += dot * nx;
              b2.vy += dot * ny;
            }
          }
        }
      }

      // Wall collisions
      for (const b of this.balls) {
        if (b.pocketed) continue;

        // Skip wall collision near pockets
        const nearPocket = POCKETS.some(p => {
          const dx = b.x - p.x, dy = b.y - p.y;
          return Math.sqrt(dx * dx + dy * dy) < POCKET_R * 1.5;
        });

        if (!nearPocket) {
          if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.8; }
          if (b.x > TABLE_W - BALL_R) { b.x = TABLE_W - BALL_R; b.vx = -Math.abs(b.vx) * 0.8; }
          if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * 0.8; }
          if (b.y > TABLE_H - BALL_R) { b.y = TABLE_H - BALL_R; b.vy = -Math.abs(b.vy) * 0.8; }
        }
      }

      // Pocket detection
      for (const b of this.balls) {
        if (b.pocketed) continue;
        for (const p of POCKETS) {
          const dx = b.x - p.x, dy = b.y - p.y;
          if (Math.sqrt(dx * dx + dy * dy) < POCKET_R) {
            b.pocketed = true;
            b.vx = 0;
            b.vy = 0;
            pocketed.push(b.id);
            break;
          }
        }
      }

      // Apply friction
      for (const b of this.balls) {
        if (b.pocketed) continue;
        b.vx *= FRICTION;
        b.vy *= FRICTION;
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (speed < STOP_SPEED) {
          b.vx = 0;
          b.vy = 0;
        }
      }
    }

    // Ensure all balls stopped
    for (const b of this.balls) {
      b.vx = 0;
      b.vy = 0;
    }

    return { pocketed, firstHitId, hitAnyBall };
  }

  /* ---------- Shot Evaluation ---------- */

  _evaluateShot(simResult) {
    const { pocketed, firstHitId, hitAnyBall } = simResult;
    this.lastPocketed = pocketed;
    this.foulReason = null;
    this.turnMessage = '';

    const cuePocketed = pocketed.includes(0);
    const eightPocketed = pocketed.includes(8);
    const opponent = 1 - this.currentTurn;
    const myGroup = this.playerGroups[this.currentTurn];
    const oppGroup = this.playerGroups[opponent];

    // --- Check 8-ball pocketed ---
    if (eightPocketed) {
      // Did the player clear their group first?
      if (myGroup) {
        const myBallsLeft = this.balls.filter(b =>
          !b.pocketed && b.id !== 0 && b.id !== 8 && ballType(b.id) === myGroup
        );
        if (myBallsLeft.length === 0 && !cuePocketed) {
          // Legal 8-ball pocket = WIN
          this.gameOver = true;
          this.phase = 'over';
          this.winner = this.currentTurn;
          this.turnMessage = 'Player ' + (this.currentTurn + 1) + ' wins!';
          return;
        }
      }
      // Illegal 8-ball pocket = LOSS
      this.gameOver = true;
      this.phase = 'over';
      this.winner = opponent;
      this.turnMessage = 'Player ' + (this.currentTurn + 1) + ' pocketed the 8-ball illegally!';
      return;
    }

    // --- Foul detection ---
    if (cuePocketed) {
      this.foulReason = 'Scratch! Cue ball pocketed.';
    } else if (!hitAnyBall) {
      this.foulReason = 'Foul! Cue ball did not hit any ball.';
    } else if (myGroup && firstHitId !== null) {
      const firstHitType = ballType(firstHitId);
      if (firstHitType !== myGroup && firstHitType !== 'eight') {
        // Check if only 8-ball remains in own group
        const myBallsLeft = this.balls.filter(b =>
          !b.pocketed && b.id !== 0 && b.id !== 8 && ballType(b.id) === myGroup
        );
        if (myBallsLeft.length > 0) {
          this.foulReason = 'Foul! Must hit your own group first.';
        }
      }
    }

    // --- Assign groups on first legal pocket ---
    if (!this.playerGroups[0] && !this.foulReason) {
      const pocketedSolids = pocketed.filter(id => ballType(id) === 'solid');
      const pocketedStripes = pocketed.filter(id => ballType(id) === 'stripe');
      if (pocketedSolids.length > 0 && pocketedStripes.length === 0) {
        this.playerGroups[this.currentTurn] = 'solid';
        this.playerGroups[opponent] = 'stripe';
        this.turnMessage = 'Player ' + (this.currentTurn + 1) + ' is Solids!';
      } else if (pocketedStripes.length > 0 && pocketedSolids.length === 0) {
        this.playerGroups[this.currentTurn] = 'stripe';
        this.playerGroups[opponent] = 'solid';
        this.turnMessage = 'Player ' + (this.currentTurn + 1) + ' is Stripes!';
      }
    }

    // --- Handle foul ---
    if (this.foulReason) {
      this.turnMessage = this.foulReason;
      // Restore cue ball if scratched
      if (cuePocketed) {
        const cue = this.balls.find(b => b.id === 0);
        cue.pocketed = false;
        cue.x = TABLE_W * 0.25;
        cue.y = TABLE_H / 2;
      }
      this.currentTurn = opponent;
      this.ballInHand = true;
      return;
    }

    // --- Determine turn ---
    // Keep turn if legally pocketed own ball
    const updatedGroup = this.playerGroups[this.currentTurn];
    if (updatedGroup) {
      const legalPockets = pocketed.filter(id => ballType(id) === updatedGroup);
      if (legalPockets.length > 0) {
        // Keep shooting
        this.turnMessage = this.turnMessage || 'Nice shot!';
        return;
      }
    } else {
      // No group assigned yet but pocketed something
      if (pocketed.length > 0) {
        this.turnMessage = this.turnMessage || 'Nice shot!';
        return;
      }
    }

    // Switch turns
    this.currentTurn = opponent;
    this.turnMessage = this.turnMessage || '';
  }
}

module.exports = PoolGame;
