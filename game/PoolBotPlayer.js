'use strict';

const BOT_NAMES = [
  'CueMaster', 'ShotBot', 'RackAttack', 'PoolShark',
  'BankShot', 'SideSpinner', 'PocketPro', 'ChalkBot'
];

// Ball type helpers (duplicated from PoolGame to avoid circular dep)
function ballType(id) {
  if (id === 0) return 'cue';
  if (id >= 1 && id <= 7) return 'solid';
  if (id === 8) return 'eight';
  return 'stripe';
}

class PoolBotPlayer {
  constructor(matchmaker, botRating, name) {
    this.matchmaker = matchmaker;
    this.rating = botRating || 1200;
    this.username = name || 'Bot ' + BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    this.gameId = null;
    this.playerIndex = -1;
    this.destroyed = false;
    this._timer = null;
    this._paused = false;

    // Skill: 0=sloppy, 1=decent
    this.skill = botRating >= 1400 ? 1 : 0;

    const self = this;
    this.socket = {
      id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      username: this.username,
      join() {},
      leave() {},
      emit(event, data) { self._onEvent(event, data); },
      on() {}
    };
    this.id = this.socket.id;
  }

  _onEvent(event, data) {
    if (this.destroyed || this._paused) return;

    if (event === 'pool:start') {
      this.gameId = data.gameId;
      this.playerIndex = data.playerIndex;
      this._lastState = data;
      if (data.currentTurn === this.playerIndex) this._scheduleMove();
    } else if (event === 'pool:update') {
      this._lastState = { ...this._lastState, ...data };
      if (data.currentTurn === this.playerIndex && !data.gameOver) this._scheduleMove();
    } else if (event === 'pool:over') {
      this.destroy();
    }
  }

  _thinkMs() {
    return 800 + Math.random() * 1200;
  }

  _scheduleMove() {
    if (this.destroyed || this._paused) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (this.destroyed || this._paused) return;
      this._executeTurn();
    }, this._thinkMs());
  }

  _executeTurn() {
    if (this.destroyed) return;
    const state = this._lastState;
    if (!state || state.gameOver) return;
    if (state.currentTurn !== this.playerIndex) return;

    // Ball-in-hand: place cue ball
    if (state.ballInHand) {
      const pos = this._pickCuePlacement(state);
      this.matchmaker.poolPlaceCue(this.socket, pos.x, pos.y);
      // Schedule shoot after placement
      this._timer = setTimeout(() => {
        if (this.destroyed || this._paused) return;
        this._executeShot();
      }, this._thinkMs());
      return;
    }

    this._executeShot();
  }

  _executeShot() {
    if (this.destroyed) return;
    const state = this._lastState;
    if (!state || state.gameOver || state.ballInHand) return;

    const shot = this._pickShot(state);
    if (shot) {
      this.matchmaker.poolShoot(this.socket, shot.angle, shot.power);
    }
  }

  _pickCuePlacement(state) {
    const balls = state.balls || [];
    // Place cue ball at 1/4 table, slightly randomized, avoiding other balls
    const tableW = state.tableW || 800;
    const tableH = state.tableH || 400;
    const ballR = state.ballR || 10;

    for (let attempts = 0; attempts < 50; attempts++) {
      const x = tableW * 0.15 + Math.random() * tableW * 0.2;
      const y = ballR + Math.random() * (tableH - ballR * 2);
      let overlap = false;
      for (const b of balls) {
        if (b.id === 0 || b.pocketed) continue;
        const dx = x - b.x, dy = y - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < ballR * 2.5) { overlap = true; break; }
      }
      if (!overlap) return { x, y };
    }
    return { x: tableW * 0.25, y: tableH / 2 };
  }

  _pickShot(state) {
    const balls = state.balls || [];
    const cue = balls.find(b => b.id === 0 && !b.pocketed);
    if (!cue) return null;

    const myGroup = state.playerGroups ? state.playerGroups[this.playerIndex] : null;
    const tableW = state.tableW || 800;
    const tableH = state.tableH || 400;
    const pockets = state.pockets || [
      { x: 0, y: 0 }, { x: tableW / 2, y: 0 }, { x: tableW, y: 0 },
      { x: 0, y: tableH }, { x: tableW / 2, y: tableH }, { x: tableW, y: tableH }
    ];

    // Find target balls
    let targets = balls.filter(b => !b.pocketed && b.id !== 0 && b.id !== 8);
    if (myGroup) {
      const groupTargets = targets.filter(b => ballType(b.id) === myGroup);
      if (groupTargets.length > 0) {
        targets = groupTargets;
      } else {
        // All own balls pocketed, target 8-ball
        const eight = balls.find(b => b.id === 8 && !b.pocketed);
        if (eight) targets = [eight];
      }
    }

    if (targets.length === 0) {
      // Just shoot in a random direction
      return { angle: Math.random() * Math.PI * 2, power: 8 + Math.random() * 6 };
    }

    // Score each target+pocket combination
    let bestShot = null;
    let bestScore = -Infinity;

    for (const target of targets) {
      for (const pocket of pockets) {
        // Angle from target to pocket
        const tpAngle = Math.atan2(pocket.y - target.y, pocket.x - target.x);
        // Position cue ball should aim at: opposite side of target from pocket
        const aimX = target.x - Math.cos(tpAngle) * 20;
        const aimY = target.y - Math.sin(tpAngle) * 20;

        // Angle from cue to aim point
        const shotAngle = Math.atan2(aimY - cue.y, aimX - cue.x);

        // Distance from cue to target
        const dist = Math.sqrt((target.x - cue.x) ** 2 + (target.y - cue.y) ** 2);

        // Check if path is roughly clear (no balls in the way)
        let blocked = false;
        for (const b of balls) {
          if (b.pocketed || b.id === 0 || b.id === target.id) continue;
          // Point-line distance from b to line cue->target
          const lx = target.x - cue.x, ly = target.y - cue.y;
          const len = Math.sqrt(lx * lx + ly * ly);
          if (len < 1) continue;
          const t = Math.max(0, Math.min(1, ((b.x - cue.x) * lx + (b.y - cue.y) * ly) / (len * len)));
          const px = cue.x + t * lx, py = cue.y + t * ly;
          const d = Math.sqrt((b.x - px) ** 2 + (b.y - py) ** 2);
          if (d < 22) { blocked = true; break; }
        }

        // Score: prefer close targets, clear paths, good pocket angles
        let score = 100 - dist * 0.1;
        if (blocked) score -= 50;
        // Prefer targets closer to pockets
        const tpDist = Math.sqrt((pocket.x - target.x) ** 2 + (pocket.y - target.y) ** 2);
        score -= tpDist * 0.05;

        if (score > bestScore) {
          bestScore = score;
          const power = Math.min(18, Math.max(5, dist * 0.04 + 6));
          bestShot = { angle: shotAngle, power };
        }
      }
    }

    if (!bestShot) {
      return { angle: Math.random() * Math.PI * 2, power: 10 };
    }

    // Add noise based on skill
    const noise = this.skill === 0 ? (Math.random() - 0.5) * 0.25 : (Math.random() - 0.5) * 0.08;
    bestShot.angle += noise;
    bestShot.power += (Math.random() - 0.5) * 3;
    bestShot.power = Math.max(3, Math.min(18, bestShot.power));

    return bestShot;
  }

  destroy() {
    this.destroyed = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = PoolBotPlayer;
