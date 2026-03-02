(function () {
  'use strict';

  /* ================================================
     CONSTANTS
     ================================================ */
  const EMPTY = 0, RED = 1, BLACK = 2, RED_KING = 3, BLACK_KING = 4;
  const BOARD = 8;
  const CANVAS_PX = 640;
  const TILE = CANVAS_PX / BOARD;

  /* ---- Cosmetic theme maps ---- */
  const BOARD_THEMES = {
    default:        { dark: '#5a3d1e', dark2: '#6d4c2a', light: '#f0d6b4' },
    board_ocean:    { dark: '#1a5276', dark2: '#1f6390', light: '#aed6f1' },
    board_forest:   { dark: '#1e4d2b', dark2: '#266b39', light: '#a9d18e' },
    board_midnight: { dark: '#2d1b69', dark2: '#3a2480', light: '#c8b8e8' },
    board_neon:     { dark: '#0d0d0d', dark2: '#151520', light: '#1a1a2e' },
    board_marble:   { dark: '#8b8b8b', dark2: '#9a9a9a', light: '#f5f5f5' },
    // Animated
    board_lava:     { dark: '#1a0800', dark2: '#2a1000', light: '#2a1a10', anim: 'lava',   glow: '#ff4500', glow2: '#ff8c00' },
    board_aurora:   { dark: '#0a1628', dark2: '#0e1e38', light: '#101830', anim: 'aurora',  glow: '#00ff88', glow2: '#0088ff' },
    board_matrix:   { dark: '#000800', dark2: '#001000', light: '#001200', anim: 'matrix',  glow: '#00ff41' },
    board_pulse:    { dark: '#0a0a18', dark2: '#0e0e22', light: '#12122a', anim: 'pulse',   glow: '#6644ff', glow2: '#ff44aa' },
  };

  const PIECE_THEMES = {
    default: {
      red:   { highlight: '#ff6b6b', mid: '#d32f2f', dark: '#8b1a1a', outer: '#7a1018', stroke: '#5a0a0a' },
      black: { highlight: '#777',    mid: '#3a3a3a', dark: '#111',    outer: '#0a0a0a', stroke: '#000' }
    },
    piece_gold: {
      red:   { highlight: '#ffd700', mid: '#b8860b', dark: '#8b6914', outer: '#6b4e0a', stroke: '#4a3508' },
      black: { highlight: '#c0c0c0', mid: '#808080', dark: '#404040', outer: '#303030', stroke: '#202020' }
    },
    piece_neon: {
      red:   { highlight: '#ff00ff', mid: '#cc00cc', dark: '#990099', outer: '#660066', stroke: '#330033' },
      black: { highlight: '#00ffff', mid: '#00cccc', dark: '#009999', outer: '#006666', stroke: '#003333' }
    },
    piece_ember: {
      red:   { highlight: '#ff4500', mid: '#cc3700', dark: '#992900', outer: '#661b00', stroke: '#330e00' },
      black: { highlight: '#00bfff', mid: '#0099cc', dark: '#007399', outer: '#004d66', stroke: '#002633' }
    },
    // Animated
    piece_flame: {
      red:   { highlight: '#ff4500', mid: '#cc3700', dark: '#8b1a00', outer: '#661000', stroke: '#440800' },
      black: { highlight: '#4400ff', mid: '#3300cc', dark: '#220099', outer: '#180066', stroke: '#100044' },
      anim: 'flame'
    },
    piece_plasma: {
      red:   { highlight: '#ff00ff', mid: '#ff44aa', dark: '#cc0088', outer: '#990066', stroke: '#660044' },
      black: { highlight: '#00ffcc', mid: '#44ffdd', dark: '#00cc99', outer: '#009966', stroke: '#006644' },
      anim: 'plasma'
    },
    piece_shadow: {
      red:   { highlight: '#ff2d55', mid: '#cc1144', dark: '#880030', outer: '#660020', stroke: '#440015' },
      black: { highlight: '#aaaacc', mid: '#7777aa', dark: '#444466', outer: '#333355', stroke: '#222244' },
      anim: 'shadow'
    },
  };

  const SITE_THEMES = {
    default:      { bg: '#0a0a14', bg2: '#12121f', red: '#ff2d55', gold: '#ffd700', text: '#e8e8f0', textMuted: '#777790', green: '#34c759', blue: '#0a84ff' },
    site_crimson: { bg: '#140a0a', bg2: '#1f1212', red: '#ff2d55', gold: '#ff6b6b', text: '#f0e0e0', textMuted: '#907070', green: '#ff6b6b', blue: '#ff4060' },
    site_ocean:   { bg: '#060d14', bg2: '#0c1a28', red: '#0a84ff', gold: '#00d4ff', text: '#d8e8f8', textMuted: '#607890', green: '#00d4ff', blue: '#0a84ff' },
    site_emerald: { bg: '#060f0a', bg2: '#0c1f14', red: '#34c759', gold: '#7aff9e', text: '#d8f0e0', textMuted: '#608070', green: '#34c759', blue: '#2aad4a' },
    site_royal:   { bg: '#0e0a14', bg2: '#1a1228', red: '#bf5af2', gold: '#e0a0ff', text: '#e8e0f8', textMuted: '#807090', green: '#bf5af2', blue: '#9040d0' },
    site_sunset:  { bg: '#140d06', bg2: '#1f1a0f', red: '#ff9500', gold: '#ffd700', text: '#f0e8d8', textMuted: '#908060', green: '#ffb340', blue: '#ff6b00' },
    site_arctic:  { bg: '#0a1014', bg2: '#121e28', red: '#5ac8fa', gold: '#b0e0ff', text: '#e0f0ff', textMuted: '#6888a0', green: '#5ac8fa', blue: '#34aadc' },
  };

  /* ---- Game catalog (Netflix selector) ---- */
  const GAME_CATALOG = {
    checkers: {
      title: 'Checkers',
      icon: '\u265F',
      desc: 'Classic strategy board game \u2014 jump and king your way to victory.',
      modes: [
        { id: 'ranked',  icon: '\u265B',          name: 'Ranked',   desc: 'Competitive ELO' },
        { id: 'casual',  icon: '\u265F',          name: 'Casual',   desc: 'Just for fun' },
        { id: 'private', icon: '\uD83D\uDD12',    name: 'Private',  desc: 'Create or join lobby' },
        { id: 'playBot', icon: '\uD83E\uDD16',    name: 'Play Bot', desc: 'Challenge the AI' },
        { id: 'local',   icon: '\uD83C\uDFAE',    name: 'Local 2P', desc: 'Same screen hotseat' }
      ]
    },
    trouble: {
      title: 'Trouble',
      icon: '\uD83C\uDFB2',
      desc: '2-4 players \u2014 Roll the dice and race your pieces home!',
      modes: [
        { id: 'troubleOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'troubleBots',   icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'Instant AI opponents' },
        { id: 'troubleLocal',  icon: '\uD83C\uDFAE', name: 'Local (2-4P)', desc: 'Pass and play' }
      ]
    },
    scrabble: {
      title: 'Scrabble',
      icon: '\uD83D\uDD21',
      desc: '2-8 players \u2014 Build words and score big!',
      modes: [
        { id: 'scrabbleOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'scrabbleBots',   icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'AI opponents' },
        { id: 'scrabbleLocal',  icon: '\uD83C\uDFAE', name: 'Local (2-8P)', desc: 'Pass and play' }
      ]
    }
  };

  /* ================================================
     APPLICATION STATE
     ================================================ */
  let socket = null;
  let currentScreen = 'title';
  let user = null; // { username, rating, wins, losses }
  let selectedGame = null; // 'checkers' | 'trouble' | null

  // Game state
  let gameMode = null;   // 'casual','ranked','private','local'
  let myColor = 0;
  let board = [];
  let currentTurn = RED;
  let selectedPiece = null;
  let validMoves = [];
  let jumpingPiece = null;
  let lastMove = null;
  let localGame = null;  // CheckersGame instance for local mode
  let opponentInfo = { username: 'Opponent', rating: 1200 };
  let gameType = null;
  let currentMatchCode = null;
  let isPaused = false;
  let pauseOverlayInterval = null;

  // Animation state
  let animations = [];
  let particles = [];
  let animatingPiece = null; // { piece, fromR, fromC, toR, toC, t, duration }
  let hiddenSquare = null;   // square to hide piece from during animation

  // Confetti
  let confetti = [];
  let confettiActive = false;

  // Cosmetics & Shop
  let activeCosmetics = { board: 'default', pieces: 'default', badge: null, site: 'default' };
  let shopData = null;
  let activeShopTab = 'boards';
  let gamesPlayedThisSession = 0;
  let adFreeUser = false;

  /* ================================================
     DOM REFS
     ================================================ */
  const $ = (id) => document.getElementById(id);
  let $canvas, ctx;

  /* ================================================
     AUDIO ENGINE (Web Audio API)
     ================================================ */
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', vol = 0.12) {
    try {
      const ac = getAudioCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch (e) { /* audio blocked */ }
  }

  function sfxMove() { playTone(600, 0.08, 'sine', 0.1); }
  function sfxCapture() { playTone(200, 0.2, 'square', 0.12); playTone(150, 0.3, 'sawtooth', 0.06); }
  function sfxKing() {
    playTone(523, 0.15, 'sine', 0.1);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 100);
    setTimeout(() => playTone(784, 0.25, 'sine', 0.12), 200);
  }
  function sfxWin() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.1), i * 120));
  }
  function sfxLose() {
    [400, 350, 300, 250].forEach((f, i) => setTimeout(() => playTone(f, 0.35, 'sawtooth', 0.06), i * 150));
  }
  function sfxChat() { playTone(880, 0.06, 'sine', 0.06); }

  /* ================================================
     PARTICLE SYSTEM
     ================================================ */
  function emitParticles(x, y, count, colors, speed = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        decay: 0.01 + Math.random() * 0.02,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ================================================
     CONFETTI
     ================================================ */
  function startConfetti() {
    confettiActive = true;
    confetti = [];
    const cCanvas = $('confettiCanvas');
    cCanvas.width = window.innerWidth;
    cCanvas.height = window.innerHeight;
    const colors = ['#ff2d55', '#ffd700', '#34c759', '#0a84ff', '#ff9500', '#bf5af2'];
    for (let i = 0; i < 150; i++) {
      confetti.push({
        x: Math.random() * cCanvas.width,
        y: Math.random() * -cCanvas.height,
        w: 4 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    requestAnimationFrame(drawConfetti);
  }

  function drawConfetti() {
    if (!confettiActive) return;
    const cCanvas = $('confettiCanvas');
    const cCtx = cCanvas.getContext('2d');
    cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
    let alive = false;
    for (const c of confetti) {
      c.x += c.vx;
      c.y += c.vy;
      c.rot += c.rotSpeed;
      if (c.y < cCanvas.height + 20) alive = true;
      cCtx.save();
      cCtx.translate(c.x, c.y);
      cCtx.rotate(c.rot);
      cCtx.fillStyle = c.color;
      cCtx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      cCtx.restore();
    }
    if (alive) requestAnimationFrame(drawConfetti);
    else confettiActive = false;
  }

  /* ================================================
     LOCAL CHECKERS GAME ENGINE (for offline/local)
     ================================================ */
  class LocalCheckersGame {
    constructor() {
      this.board = [];
      this.currentTurn = RED;
      this.jumpingPiece = null;
      this.redCount = 12;
      this.blackCount = 12;
      this._init();
    }

    _init() {
      this.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if ((r + c) % 2 === 1) {
            if (r < 3) this.board[r][c] = RED;
            else if (r > 4) this.board[r][c] = BLACK;
          }
    }

    static belongsTo(p, player) {
      return player === RED ? (p === RED || p === RED_KING) : (p === BLACK || p === BLACK_KING);
    }
    static isOpponent(p, player) {
      return player === RED ? (p === BLACK || p === BLACK_KING) : (p === RED || p === RED_KING);
    }
    static isKing(p) { return p === RED_KING || p === BLACK_KING; }
    static moveDirs(p) {
      if (p === RED) return [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
      if (p === BLACK) return [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }];
      return [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }, { dr: -1, dc: -1 }, { dr: -1, dc: 1 }];
    }

    _inB(r, c) { return r >= 0 && r <= 7 && c >= 0 && c <= 7; }

    _getJumps(r, c) {
      const p = this.board[r][c];
      const pl = LocalCheckersGame.belongsTo(p, RED) ? RED : BLACK;
      const jumps = [];
      for (const { dr, dc } of LocalCheckersGame.moveDirs(p)) {
        const mr = r + dr, mc = c + dc, er = r + 2 * dr, ec = c + 2 * dc;
        if (this._inB(er, ec) && LocalCheckersGame.isOpponent(this.board[mr][mc], pl) && this.board[er][ec] === EMPTY)
          jumps.push({ toRow: er, toCol: ec, capRow: mr, capCol: mc });
      }
      return jumps;
    }

    _getSimple(r, c) {
      const p = this.board[r][c];
      const moves = [];
      for (const { dr, dc } of LocalCheckersGame.moveDirs(p)) {
        const nr = r + dr, nc = c + dc;
        if (this._inB(nr, nc) && this.board[nr][nc] === EMPTY)
          moves.push({ toRow: nr, toCol: nc });
      }
      return moves;
    }

    _playerHasJumps(player) {
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (LocalCheckersGame.belongsTo(this.board[r][c], player) && this._getJumps(r, c).length > 0)
            return true;
      return false;
    }

    getValidMoves(r, c) {
      const p = this.board[r][c];
      if (p === EMPTY) return [];
      const pl = LocalCheckersGame.belongsTo(p, RED) ? RED : BLACK;
      if (pl !== this.currentTurn) return [];
      if (this.jumpingPiece && (this.jumpingPiece.row !== r || this.jumpingPiece.col !== c)) return [];
      if (this.jumpingPiece) return this._getJumps(r, c).map(j => ({ row: j.toRow, col: j.toCol, isJump: true }));
      if (this._playerHasJumps(pl))
        return this._getJumps(r, c).map(j => ({ row: j.toRow, col: j.toCol, isJump: true }));
      return this._getSimple(r, c).map(m => ({ row: m.toRow, col: m.toCol, isJump: false }));
    }

    makeMove(fr, fc, tr, tc) {
      const v = this.getValidMoves(fr, fc);
      const mv = v.find(m => m.row === tr && m.col === tc);
      if (!mv) return { valid: false };

      const piece = this.board[fr][fc];
      const player = LocalCheckersGame.belongsTo(piece, RED) ? RED : BLACK;
      this.board[tr][tc] = piece;
      this.board[fr][fc] = EMPTY;

      let captured = null;
      if (mv.isJump) {
        const cr = (fr + tr) / 2, cc = (fc + tc) / 2;
        captured = { row: cr, col: cc, piece: this.board[cr][cc] };
        this.board[cr][cc] = EMPTY;
        if (captured.piece === RED || captured.piece === RED_KING) this.redCount--;
        else this.blackCount--;
      }

      let promoted = false;
      if (player === RED && tr === 7 && !LocalCheckersGame.isKing(piece)) { this.board[tr][tc] = RED_KING; promoted = true; }
      else if (player === BLACK && tr === 0 && !LocalCheckersGame.isKing(piece)) { this.board[tr][tc] = BLACK_KING; promoted = true; }

      let continuedJump = false;
      if (mv.isJump && !promoted && this._getJumps(tr, tc).length > 0) {
        this.jumpingPiece = { row: tr, col: tc };
        continuedJump = true;
      }
      if (!continuedJump) {
        this.jumpingPiece = null;
        this.currentTurn = this.currentTurn === RED ? BLACK : RED;
      }

      return {
        valid: true, from: { row: fr, col: fc }, to: { row: tr, col: tc },
        captured, promoted, continuedJump,
        board: this.board.map(r => [...r]),
        currentTurn: this.currentTurn,
        jumpingPiece: this.jumpingPiece ? { ...this.jumpingPiece } : null,
        gameOver: this.checkGameOver(),
        redCount: this.redCount, blackCount: this.blackCount
      };
    }

    checkGameOver() {
      if (this.redCount === 0) return { over: true, winner: BLACK, reason: 'All pieces captured' };
      if (this.blackCount === 0) return { over: true, winner: RED, reason: 'All pieces captured' };
      let has = false;
      for (let r = 0; r < 8 && !has; r++)
        for (let c = 0; c < 8 && !has; c++)
          if (LocalCheckersGame.belongsTo(this.board[r][c], this.currentTurn) && this.getValidMoves(r, c).length > 0)
            has = true;
      if (!has) return { over: true, winner: this.currentTurn === RED ? BLACK : RED, reason: 'No valid moves' };
      return { over: false };
    }
  }

  /* ================================================
     COORDINATE TRANSFORMS
     ================================================ */
  function boardToScreen(r, c) {
    if (gameMode !== 'local' && myColor === BLACK) return { row: 7 - r, col: 7 - c };
    return { row: r, col: c };
  }

  function screenToBoard(sr, sc) {
    if (gameMode !== 'local' && myColor === BLACK) return { row: 7 - sr, col: 7 - sc };
    return { row: sr, col: sc };
  }

  /* ================================================
     CANVAS RENDERING
     ================================================ */
  function setupCanvas() {
    $canvas = $('gameCanvas');
    ctx = $canvas.getContext('2d');
    $canvas.width = CANVAS_PX;
    $canvas.height = CANVAS_PX;
  }

  // ---------- Main render loop ----------
  let lastFrameTime = 0;

  function gameLoop(ts) {
    const dt = ts - lastFrameTime;
    lastFrameTime = ts;

    updateAnimations(dt);
    updateParticles();
    render();

    if (currentScreen === 'game') requestAnimationFrame(gameLoop);
  }

  function startGameLoop() {
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  }

  // ---------- Animation system ----------
  function updateAnimations(dt) {
    if (!animatingPiece) return;
    animatingPiece.t += dt;
    if (animatingPiece.t >= animatingPiece.duration) {
      animatingPiece = null;
      hiddenSquare = null;
      // Process queued post-animation actions
      if (animations.length > 0) {
        const next = animations.shift();
        next();
      }
    }
  }

  function animateMove(fromR, fromC, toR, toC, piece, duration = 250) {
    return new Promise(resolve => {
      const fs = boardToScreen(fromR, fromC);
      const ts = boardToScreen(toR, toC);
      animatingPiece = {
        piece,
        fromSR: fs.row, fromSC: fs.col,
        toSR: ts.row, toSC: ts.col,
        t: 0,
        duration
      };
      hiddenSquare = { row: toR, col: toC };
      animations.push(resolve);
    });
  }

  // ---------- Drawing ----------
  function render() {
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    drawBoard();
    drawLastMove();
    drawMovablePieces();
    drawSelectedAndMoves();
    drawJumpingHighlight();
    drawPieces();
    drawAnimatingPiece();
    drawParticles();
  }

  function drawBoard() {
    const theme = BOARD_THEMES[activeCosmetics.board] || BOARD_THEMES['default'];
    const t = performance.now();
    for (let r = 0; r < BOARD; r++) {
      for (let c = 0; c < BOARD; c++) {
        const isDark = (r + c) % 2 === 1;
        if (isDark) {
          const g = ctx.createLinearGradient(c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE);
          g.addColorStop(0, theme.dark2 || theme.dark);
          g.addColorStop(1, theme.dark);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = theme.light;
        }
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }

    // Animated board overlays
    if (theme.anim) drawBoardAnim(theme, t);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < BOARD; i++) {
      ctx.beginPath(); ctx.moveTo(i * TILE, 0); ctx.lineTo(i * TILE, CANVAS_PX); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * TILE); ctx.lineTo(CANVAS_PX, i * TILE); ctx.stroke();
    }
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CANVAS_PX, CANVAS_PX);
  }

  function drawBoardAnim(theme, t) {
    if (theme.anim === 'lava') {
      // Glowing veins on dark squares that shift over time
      for (let r = 0; r < BOARD; r++) {
        for (let c = 0; c < BOARD; c++) {
          if ((r + c) % 2 !== 1) continue;
          const phase = Math.sin(t / 800 + r * 0.7 + c * 1.1);
          const alpha = 0.08 + phase * 0.06;
          const cx = c * TILE + TILE / 2;
          const cy = r * TILE + TILE / 2;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TILE * 0.6);
          grad.addColorStop(0, `rgba(255,69,0,${alpha + 0.04})`);
          grad.addColorStop(0.6, `rgba(255,140,0,${alpha})`);
          grad.addColorStop(1, 'rgba(255,69,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
      // Flowing lava line across the board
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = theme.glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < CANVAS_PX; x += 4) {
        const y = CANVAS_PX / 2 + Math.sin(x / 60 + t / 600) * 40 + Math.sin(x / 30 + t / 400) * 20;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    else if (theme.anim === 'aurora') {
      // Sweeping color bands across the board
      ctx.save();
      for (let band = 0; band < 3; band++) {
        const yOff = CANVAS_PX * (0.2 + band * 0.3) + Math.sin(t / 1200 + band * 2) * 50;
        const grad = ctx.createLinearGradient(0, yOff - 60, 0, yOff + 60);
        const hue1 = (t / 20 + band * 60) % 360;
        const hue2 = (hue1 + 40) % 360;
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, `hsla(${hue1},80%,50%,0.06)`);
        grad.addColorStop(0.5, `hsla(${hue2},80%,60%,0.10)`);
        grad.addColorStop(0.7, `hsla(${hue1},80%,50%,0.06)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
      }
      ctx.restore();
    }

    else if (theme.anim === 'matrix') {
      // Digital rain columns
      ctx.save();
      ctx.font = '10px monospace';
      const cols = 16;
      for (let i = 0; i < cols; i++) {
        const x = (i / cols) * CANVAS_PX + 10;
        const speed = 40 + (i * 7) % 30;
        const yBase = ((t / speed) + i * 47) % (CANVAS_PX + 200) - 100;
        for (let j = 0; j < 8; j++) {
          const y = yBase + j * 14;
          if (y < 0 || y > CANVAS_PX) continue;
          const alpha = Math.max(0, 0.25 - j * 0.03);
          ctx.fillStyle = `rgba(0,255,65,${alpha})`;
          const ch = String.fromCharCode(0x30A0 + Math.floor(((t / 200 + i + j * 3) % 96)));
          ctx.fillText(ch, x, y);
        }
      }
      ctx.restore();
    }

    else if (theme.anim === 'pulse') {
      // Pulsing glow on dark squares that ripple outward from center
      const cx = CANVAS_PX / 2;
      const cy = CANVAS_PX / 2;
      for (let r = 0; r < BOARD; r++) {
        for (let c = 0; c < BOARD; c++) {
          if ((r + c) % 2 !== 1) continue;
          const sqCx = c * TILE + TILE / 2;
          const sqCy = r * TILE + TILE / 2;
          const dist = Math.sqrt((sqCx - cx) ** 2 + (sqCy - cy) ** 2);
          const wave = Math.sin(t / 500 - dist / 60);
          const alpha = 0.04 + wave * 0.06;
          if (alpha <= 0) continue;
          const hue = ((t / 15) + dist) % 360;
          ctx.fillStyle = `hsla(${hue},70%,55%,${alpha})`;
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
    }
  }

  function drawLastMove() {
    if (!lastMove) return;
    const f = boardToScreen(lastMove.from.row, lastMove.from.col);
    const t = boardToScreen(lastMove.to.row, lastMove.to.col);
    ctx.fillStyle = 'rgba(255,215,0,0.12)';
    ctx.fillRect(f.col * TILE, f.row * TILE, TILE, TILE);
    ctx.fillRect(t.col * TILE, t.row * TILE, TILE, TILE);
  }

  function drawMovablePieces() {
    if (selectedPiece || animatingPiece) return;
    // Subtle highlight on pieces that can move (only on current player's turn)
    const turn = gameMode === 'local' ? currentTurn : myColor;
    if (currentTurn !== turn) return;

    const game = gameMode === 'local' ? localGame : null;
    if (gameMode === 'local' && game) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (game.getValidMoves(r, c).length > 0) {
            const s = boardToScreen(r, c);
            ctx.fillStyle = 'rgba(255,215,0,0.08)';
            ctx.fillRect(s.col * TILE, s.row * TILE, TILE, TILE);
          }
        }
      }
    }
  }

  function drawSelectedAndMoves() {
    if (!selectedPiece) return;
    const sp = boardToScreen(selectedPiece.row, selectedPiece.col);

    // Glow on selected square
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(sp.col * TILE + 3, sp.row * TILE + 3, TILE - 6, TILE - 6);
    ctx.shadowBlur = 0;

    // Valid move indicators
    const t = performance.now();
    const pulseScale = 1 + Math.sin(t / 300) * 0.15;
    for (const mv of validMoves) {
      const sm = boardToScreen(mv.row, mv.col);
      const cx = sm.col * TILE + TILE / 2;
      const cy = sm.row * TILE + TILE / 2;
      const baseR = mv.isJump ? TILE * 0.2 : TILE * 0.13;
      const r = baseR * pulseScale;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = mv.isJump ? 'rgba(255,45,85,0.55)' : 'rgba(255,215,0,0.45)';
      ctx.fill();
      if (mv.isJump) {
        ctx.strokeStyle = 'rgba(255,45,85,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawJumpingHighlight() {
    if (!jumpingPiece) return;
    const turn = gameMode === 'local' ? currentTurn : myColor;
    if (currentTurn !== turn) return;
    const sp = boardToScreen(jumpingPiece.row, jumpingPiece.col);
    const t = performance.now();
    ctx.strokeStyle = `rgba(255,45,85,${0.5 + Math.sin(t / 200) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(sp.col * TILE + 2, sp.row * TILE + 2, TILE - 4, TILE - 4);
    ctx.setLineDash([]);
  }

  function drawPieces() {
    for (let r = 0; r < BOARD; r++) {
      for (let c = 0; c < BOARD; c++) {
        const piece = board[r]?.[c];
        if (piece > 0) {
          // Skip piece at hidden square (being animated to)
          if (hiddenSquare && hiddenSquare.row === r && hiddenSquare.col === c) continue;
          const sp = boardToScreen(r, c);
          drawPiece(sp.row, sp.col, piece, 1, 1);
        }
      }
    }
  }

  function drawPiece(sr, sc, piece, alpha, scale) {
    const cx = sc * TILE + TILE / 2;
    const cy = sr * TILE + TILE / 2;
    const radius = TILE * 0.38 * scale;
    const isRed = piece === RED || piece === RED_KING;

    const pTheme = PIECE_THEMES[activeCosmetics.pieces] || PIECE_THEMES['default'];
    const colors = isRed ? pTheme.red : pTheme.black;

    ctx.globalAlpha = alpha;

    // Shadow
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 4, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Outer ring (3D effect)
    ctx.beginPath();
    ctx.arc(cx, cy + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = colors.outer;
    ctx.fill();

    // Main body
    const g = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.05, cx, cy, radius);
    g.addColorStop(0, colors.highlight);
    g.addColorStop(0.6, colors.mid);
    g.addColorStop(1, colors.dark);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = isRed ? 'rgba(255,180,180,0.25)' : 'rgba(180,180,180,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Highlight
    ctx.beginPath();
    ctx.arc(cx - radius * 0.2, cy - radius * 0.25, radius * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();

    // Animated piece effects (drawn before crown so crown stays on top)
    if (pTheme.anim) drawPieceAnim(pTheme.anim, cx, cy, radius, colors, isRed);

    // King crown
    if (piece === RED_KING || piece === BLACK_KING) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.font = `bold ${radius * 1.1}px serif`;
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u265B', cx, cy + 1);
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
  }

  function drawPieceAnim(anim, cx, cy, radius, colors, isRed) {
    const t = performance.now();

    if (anim === 'flame') {
      // Flickering fire aura around the piece
      const flicker = Math.sin(t / 80) * 0.3 + Math.sin(t / 130) * 0.2;
      const outerR = radius * (1.25 + flicker * 0.15);
      const grad = ctx.createRadialGradient(cx, cy - radius * 0.2, radius * 0.5, cx, cy, outerR);
      const baseColor = isRed ? '255,69,0' : '68,0,255';
      grad.addColorStop(0, `rgba(${baseColor},0)`);
      grad.addColorStop(0.6, `rgba(${baseColor},${0.08 + flicker * 0.04})`);
      grad.addColorStop(0.85, `rgba(${baseColor},${0.15 + flicker * 0.06})`);
      grad.addColorStop(1, `rgba(${baseColor},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fill();

      // Rising flame wisps
      for (let i = 0; i < 3; i++) {
        const angle = (t / 300 + i * 2.1) % (Math.PI * 2);
        const wispR = radius * 0.9;
        const wx = cx + Math.cos(angle) * wispR * 0.5;
        const wy = cy - radius * 0.6 - Math.abs(Math.sin(t / 200 + i)) * radius * 0.4;
        const wSize = 2 + Math.sin(t / 150 + i) * 1;
        ctx.globalAlpha = 0.3 + Math.sin(t / 100 + i * 1.5) * 0.15;
        ctx.fillStyle = isRed ? '#ff8c00' : '#8844ff';
        ctx.beginPath();
        ctx.arc(wx, wy, wSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    else if (anim === 'plasma') {
      // Spinning energy ring
      const ringR = radius * 1.1;
      const segments = 12;
      ctx.lineWidth = 2;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2 + t / 400;
        const nextAngle = ((i + 1) / segments) * Math.PI * 2 + t / 400;
        const pulse = Math.sin(t / 200 + i * 0.8);
        const alpha = 0.15 + pulse * 0.12;
        ctx.strokeStyle = isRed
          ? `rgba(255,0,255,${alpha})`
          : `rgba(0,255,204,${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, angle, nextAngle);
        ctx.stroke();
      }

      // Orbiting energy dots
      for (let i = 0; i < 4; i++) {
        const angle = t / 500 + (i / 4) * Math.PI * 2;
        const dotR = radius * 1.15;
        const dx = cx + Math.cos(angle) * dotR;
        const dy = cy + Math.sin(angle) * dotR;
        const dotAlpha = 0.4 + Math.sin(t / 150 + i) * 0.2;
        ctx.globalAlpha = dotAlpha;
        ctx.fillStyle = isRed ? '#ff88ff' : '#88ffee';
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    else if (anim === 'shadow') {
      // Pulsing dark aura that expands and contracts
      const pulse = Math.sin(t / 600);
      const auraR = radius * (1.3 + pulse * 0.15);
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, auraR);
      const col = isRed ? '255,45,85' : '170,170,204';
      grad.addColorStop(0, `rgba(${col},0)`);
      grad.addColorStop(0.5, `rgba(${col},${0.06 + pulse * 0.03})`);
      grad.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
      ctx.fill();

      // Shadow afterimages
      for (let i = 1; i <= 2; i++) {
        const offAngle = t / 800 + i * Math.PI;
        const offDist = 3 + Math.sin(t / 300 + i) * 2;
        const ox = cx + Math.cos(offAngle) * offDist;
        const oy = cy + Math.sin(offAngle) * offDist;
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = colors.mid;
        ctx.beginPath();
        ctx.arc(ox, oy, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawAnimatingPiece() {
    if (!animatingPiece) return;
    const a = animatingPiece;
    const progress = easeOutCubic(Math.min(a.t / a.duration, 1));
    const sr = a.fromSR + (a.toSR - a.fromSR) * progress;
    const sc = a.fromSC + (a.toSC - a.fromSC) * progress;
    drawPiece(sr, sc, a.piece, 1, 1);
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* ================================================
     TITLE SCREEN BACKGROUND
     ================================================ */
  function initTitleBackground() {
    const tc = $('titleCanvas');
    if (!tc) return;
    tc.width = window.innerWidth;
    tc.height = window.innerHeight;
    const tctx = tc.getContext('2d');
    const dots = [];
    for (let i = 0; i < 60; i++) {
      dots.push({
        x: Math.random() * tc.width,
        y: Math.random() * tc.height,
        r: 1 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        color: Math.random() < 0.5 ? 'rgba(255,45,85,0.3)' : 'rgba(255,215,0,0.2)'
      });
    }

    function animTitle() {
      if (currentScreen !== 'title') return;
      tctx.clearRect(0, 0, tc.width, tc.height);

      // Draw subtle board pattern
      const bSize = Math.min(tc.width, tc.height) * 0.6;
      const ox = (tc.width - bSize) / 2;
      const oy = (tc.height - bSize) / 2;
      const ts = bSize / 8;
      tctx.globalAlpha = 0.04;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if ((r + c) % 2 === 1) {
            tctx.fillStyle = '#fff';
            tctx.fillRect(ox + c * ts, oy + r * ts, ts, ts);
          }
        }
      }
      tctx.globalAlpha = 1;

      // Floating particles
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > tc.width) d.vx *= -1;
        if (d.y < 0 || d.y > tc.height) d.vy *= -1;
        tctx.beginPath();
        tctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        tctx.fillStyle = d.color;
        tctx.fill();
      }

      // Lines between close particles
      tctx.strokeStyle = 'rgba(255,45,85,0.06)';
      tctx.lineWidth = 0.5;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          if (dx * dx + dy * dy < 15000) {
            tctx.beginPath();
            tctx.moveTo(dots[i].x, dots[i].y);
            tctx.lineTo(dots[j].x, dots[j].y);
            tctx.stroke();
          }
        }
      }
      requestAnimationFrame(animTitle);
    }
    animTitle();
  }

  /* ================================================
     SCREEN MANAGEMENT
     ================================================ */
  const screenIds = ['titleScreen', 'authScreen', 'lobbyScreen', 'queueScreen',
    'lobbyHostScreen', 'lobbyJoinScreen', 'shopScreen', 'gameScreen', 'troubleGameScreen', 'scrabbleGameScreen'];

  function showScreen(name) {
    currentScreen = name;
    const map = {
      title: 'titleScreen', auth: 'authScreen', lobby: 'lobbyScreen',
      queue: 'queueScreen', host: 'lobbyHostScreen', join: 'lobbyJoinScreen',
      shop: 'shopScreen', game: 'gameScreen', trouble: 'troubleGameScreen',
      scrabble: 'scrabbleGameScreen'
    };
    for (const id of screenIds) {
      const el = $(id);
      if (el) el.classList.remove('active');
    }
    const target = $(map[name]);
    if (target) target.classList.add('active');

    // Hide game over overlay when switching screens
    if (name !== 'game' && name !== 'trouble' && name !== 'scrabble') {
      $('gameOverOverlay').classList.add('hidden');
      confettiActive = false;
    }

    // Stop game loops when leaving their screens
    if (name !== 'trouble') troubleGameLoopActive = false;
    if (name !== 'scrabble') scrabbleGameLoopActive = false;

    if (name === 'game') {
      setupCanvas();
      startGameLoop();
    }

    if (name === 'trouble') {
      setupTroubleCanvas();
      startTroubleGameLoop();
    }

    if (name === 'scrabble') {
      setupScrabbleCanvas();
      startScrabbleGameLoop();
    }

    // Hide overlays when leaving lobby
    if (name !== 'lobby') {
      $('troubleLocalOverlay')?.classList.add('hidden');
      $('scrabbleLocalOverlay')?.classList.add('hidden');
    }

    // Reset game selector when returning to lobby
    if (name === 'lobby') {
      deselectGame();
    }

    if (name === 'lobby' && user) {
      $('lobbyCoins').textContent = user.coins || 0;
      $('lobbyGems').textContent = user.gems || 0;
    }

    // Refresh ads on screen transitions
    if (name === 'lobby' || name === 'queue') refreshAds();
  }

  /* ================================================
     AUTH & PROFILE
     ================================================ */
  async function doLogin(username, password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      user = data.user;
      onLoggedIn();
    } catch (e) {
      $('loginError').textContent = e.message;
    }
  }

  async function doSignup(username, password) {
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      user = data.user;
      onLoggedIn();
    } catch (e) {
      $('signupError').textContent = e.message;
    }
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        user = data.user;
        onLoggedIn();
        return true;
      }
    } catch (e) { /* not logged in */ }
    return false;
  }

  function onLoggedIn() {
    updateProfileCard();
    connectSocket();
    showScreen('lobby');
  }

  function updateProfileCard() {
    if (!user) return;
    $('profileName').textContent = user.username;
    $('profileRating').textContent = user.rating;
    $('profileWins').textContent = user.wins;
    $('profileLosses').textContent = user.losses;
    // Show badge emoji or first letter as avatar
    const badgeId = user.equippedBadge;
    const badgeEmoji = badgeId ? getBadgeEmoji(badgeId) : null;
    $('profileAvatar').textContent = badgeEmoji || user.username.charAt(0).toUpperCase();
    // Update lobby currency
    if ($('lobbyCoins')) $('lobbyCoins').textContent = user.coins || 0;
    if ($('lobbyGems')) $('lobbyGems').textContent = user.gems || 0;
    // Store cosmetics locally
    activeCosmetics.board = user.equippedBoard || 'default';
    activeCosmetics.pieces = user.equippedPieces || 'default';
    activeCosmetics.badge = user.equippedBadge || null;
    activeCosmetics.site = user.equippedSiteTheme || 'default';
    // Apply site theme
    applySiteTheme(activeCosmetics.site);
    // Handle ad-free (permanent or timed)
    adFreeUser = user.adFree || (user.adFreeUntil && user.adFreeUntil > Date.now());
    if (adFreeUser) hideAllAds();
  }

  function getBadgeEmoji(badgeId) {
    const map = { badge_crown: '\u{1F451}', badge_fire: '\u{1F525}', badge_diamond: '\u{1F48E}', badge_star: '\u2B50' };
    return map[badgeId] || null;
  }

  /* ================================================
     SOCKET CONNECTION
     ================================================ */
  function connectSocket() {
    if (socket) {
      // Force reconnect so server picks up the current session
      if (socket.connected) socket.disconnect();
      socket.connect();
      return;
    }
    socket = io();

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('auth:required', () => {
      showScreen('auth');
    });

    // Stats
    socket.on('server:stats', (data) => {
      $('statOnline').textContent = data.online;
      $('statGames').textContent = data.games;
    });

    // Queue
    socket.on('queue:update', (data) => {
      if (data.status === 'bot_matching') {
        $('queueTitle').textContent = 'Opponent Found';
        $('queueText').textContent = 'No players available \u2014 matching with AI...';
      } else {
        $('queueTitle').textContent = data.type === 'ranked' ? 'Ranked Match' : 'Casual Match';
        $('queueText').textContent = `Searching for a ${data.type} match...`;
      }
    });

    socket.on('queue:left', () => {
      showScreen('lobby');
    });

    // Lobby
    socket.on('lobby:created', (data) => {
      $('inviteCode').textContent = data.code;
      $('copyHint').textContent = 'Click to copy';
      $('copyHint').classList.remove('copied');
      showScreen('host');
    });

    socket.on('lobby:error', (data) => {
      if (currentScreen === 'join') {
        $('joinError').textContent = data.message;
      } else {
        alert(data.message);
      }
    });

    // Game start
    socket.on('game:start', (data) => {
      onGameStart(data);
    });

    // Valid moves response
    socket.on('game:validMoves', (data) => {
      if (data.moves.length === 0) {
        selectedPiece = null;
        validMoves = [];
      } else {
        selectedPiece = { row: data.row, col: data.col };
        validMoves = data.moves;
      }
    });

    // Game update
    socket.on('game:update', (data) => {
      onGameUpdate(data);
    });

    // Game over
    socket.on('game:over', (data) => {
      onGameOver(data);
    });

    socket.on('game:error', (data) => {
      console.warn('Game error:', data.message);
    });

    // Chat
    socket.on('chat:lobbyHistory', (messages) => {
      const el = $('lobbyChatMessages');
      el.innerHTML = '';
      messages.forEach(m => appendChatMsg(el, m));
      el.scrollTop = el.scrollHeight;
    });

    socket.on('chat:lobby', (msg) => {
      const el = $('lobbyChatMessages');
      appendChatMsg(el, msg);
      el.scrollTop = el.scrollHeight;
      if (currentScreen !== 'lobby') sfxChat();
    });

    socket.on('chat:game', (msg) => {
      // Route to the correct chat panel based on active screen
      const el = currentScreen === 'scrabble' ? $('scrabbleChatMessages')
               : currentScreen === 'trouble' ? $('troubleChatMessages')
               : $('gameChatMessages');
      if (el) {
        appendChatMsg(el, msg);
        el.scrollTop = el.scrollHeight;
      }
      sfxChat();
    });

    // Trouble events
    socket.on('trouble:start', onTroubleStart);
    socket.on('trouble:rollResult', onTroubleRollResult);
    socket.on('trouble:update', onTroubleUpdate);
    socket.on('trouble:over', onTroubleOver);
    socket.on('trouble:playerReplaced', (data) => {
      if (troubleState && troubleState.players) {
        troubleState.players[data.playerIdx] = { username: data.newUsername };
        updateTroubleHUD();
      }
    });

    // Scrabble events
    socket.on('scrabble:start', onScrabbleStart);
    socket.on('scrabble:update', onScrabbleUpdate);
    socket.on('scrabble:over', onScrabbleOver);
    socket.on('scrabble:error', (data) => {
      showScrabbleError(data.message);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      // Show reconnecting overlay if in a game
      if (currentScreen === 'game' || currentScreen === 'trouble' || currentScreen === 'scrabble') {
        $('reconnectingOverlay')?.classList.remove('hidden');
      }
    });

    // Pause/resume/rejoin events
    socket.on('game:paused', onGamePaused);
    socket.on('game:resumed', onGameResumed);
    socket.on('game:rejoined', onGameRejoined);
    socket.on('trouble:paused', onGamePaused);
    socket.on('trouble:resumed', onGameResumed);
    socket.on('trouble:rejoined', onTroubleRejoined);
    socket.on('scrabble:paused', onGamePaused);
    socket.on('scrabble:resumed', onGameResumed);
    socket.on('scrabble:rejoined', onScrabbleRejoined);

    socket.on('game:activeGameExists', (data) => {
      // Player has a paused game — auto-rejoin it
      if (data.paused) {
        socket.emit('game:rejoin', data.matchCode);
      }
    });

    socket.on('game:rejoinError', (data) => {
      const el = $('rejoinError');
      if (el) el.textContent = data.message;
    });
  }

  function appendChatMsg(container, msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-user">${escapeHtml(msg.username)}</span><span class="chat-text">${escapeHtml(msg.text)}</span>`;
    container.appendChild(div);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---- Pause / Resume / Rejoin handlers ---- */

  function onGamePaused(data) {
    isPaused = true;
    const overlay = $('gamePausedOverlay');
    if (!overlay) return;
    $('pauseReason').textContent = `${data.disconnectedPlayer} disconnected`;
    $('pauseMatchCode').textContent = data.matchCode || currentMatchCode || '------';
    overlay.classList.remove('hidden');

    let timeLeft = data.timeRemaining || 120;
    $('countdownNumber').textContent = timeLeft;
    if (pauseOverlayInterval) clearInterval(pauseOverlayInterval);
    pauseOverlayInterval = setInterval(() => {
      timeLeft--;
      $('countdownNumber').textContent = Math.max(0, timeLeft);
      if (timeLeft <= 0) { clearInterval(pauseOverlayInterval); pauseOverlayInterval = null; }
    }, 1000);
  }

  function onGameResumed(data) {
    isPaused = false;
    $('gamePausedOverlay')?.classList.add('hidden');
    if (pauseOverlayInterval) { clearInterval(pauseOverlayInterval); pauseOverlayInterval = null; }
  }

  function onGameRejoined(data) {
    $('reconnectingOverlay')?.classList.add('hidden');
    onGameStart(data);
    // Restore chat log
    const chatEl = $('gameChatMessages');
    if (chatEl && data.chatLog) {
      chatEl.innerHTML = '';
      data.chatLog.forEach(m => appendChatMsg(chatEl, m));
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }

  function onTroubleRejoined(data) {
    $('reconnectingOverlay')?.classList.add('hidden');
    onTroubleStart(data);
    const chatEl = $('troubleChatMessages');
    if (chatEl && data.chatLog) {
      chatEl.innerHTML = '';
      data.chatLog.forEach(m => appendChatMsg(chatEl, m));
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }

  function onScrabbleRejoined(data) {
    $('reconnectingOverlay')?.classList.add('hidden');
    onScrabbleStart(data);
    const chatEl = $('scrabbleChatMessages');
    if (chatEl && data.chatLog) {
      chatEl.innerHTML = '';
      data.chatLog.forEach(m => appendChatMsg(chatEl, m));
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }

  /* ================================================
     GAME START / UPDATE / OVER
     ================================================ */
  function onGameStart(data) {
    myColor = data.color;
    board = data.board;
    currentTurn = data.currentTurn;
    selectedPiece = null;
    validMoves = [];
    jumpingPiece = data.jumpingPiece;
    lastMove = null;
    animatingPiece = null;
    hiddenSquare = null;
    particles = [];
    animations = [];
    opponentInfo = data.opponent || { username: 'Opponent', rating: 1200 };
    gameType = data.type;
    gameMode = data.type; // 'casual', 'ranked', 'private'
    currentMatchCode = data.matchCode || null;
    isPaused = false;

    // Apply cosmetics from server
    if (data.cosmetics?.me) {
      activeCosmetics = { ...activeCosmetics, ...data.cosmetics.me };
    }

    // Update HUD
    const isRed = myColor === RED;
    $('myPiece').className = 'hud-piece ' + (isRed ? 'red' : 'black');
    $('oppPiece').className = 'hud-piece ' + (isRed ? 'black' : 'red');
    $('myName').textContent = user?.username || 'You';
    $('oppName').textContent = opponentInfo.username;
    $('myRating').textContent = data.me?.rating ? `(${data.me.rating})` : '';
    $('oppRating').textContent = opponentInfo.rating ? `(${opponentInfo.rating})` : '';
    updateGameHUD();

    // Clear game chat
    $('gameChatMessages').innerHTML = '';
    // Show chat panel for online modes
    $('gameChatPanel').classList.remove('hidden');

    // Match code display
    const codeEl = $('matchCodeValue');
    if (codeEl) codeEl.textContent = currentMatchCode || '------';

    showScreen('game');
    // Hide overlays in case of rejoin
    $('gamePausedOverlay')?.classList.add('hidden');
    $('reconnectingOverlay')?.classList.add('hidden');
  }

  async function onGameUpdate(data) {
    const prevBoard = board.map(r => [...r]);

    // Animate the move
    const fromPiece = prevBoard[data.from.row]?.[data.from.col];
    if (fromPiece) {
      board = prevBoard; // Keep old board during animation
      await animateMove(data.from.row, data.from.col, data.to.row, data.to.col, fromPiece, 220);
    }

    // Now apply the new state
    board = data.board;
    currentTurn = data.currentTurn;
    jumpingPiece = data.jumpingPiece;
    lastMove = { from: data.from, to: data.to };

    // Sound and particles
    if (data.captured) {
      sfxCapture();
      const cap = boardToScreen(data.captured.row, data.captured.col);
      const capColors = (data.captured.piece === RED || data.captured.piece === RED_KING)
        ? ['#ff2d55', '#ff6b6b', '#ff9500'] : ['#555', '#888', '#333'];
      emitParticles(cap.col * TILE + TILE / 2, cap.row * TILE + TILE / 2, 20, capColors, 4);
    } else {
      sfxMove();
    }

    if (data.promoted) {
      sfxKing();
      const promo = boardToScreen(data.to.row, data.to.col);
      emitParticles(promo.col * TILE + TILE / 2, promo.row * TILE + TILE / 2, 25, ['#ffd700', '#ffaa00', '#fff'], 3);
    }

    // Clear selection
    if (!data.continuedJump || currentTurn !== myColor) {
      selectedPiece = null;
      validMoves = [];
    } else if (data.continuedJump && currentTurn === myColor && gameMode !== 'local') {
      // Auto-select jumping piece for multi-jump
      socket.emit('game:selectPiece', jumpingPiece);
    }

    updateGameHUD();
  }

  function onGameOver(data) {
    const isWin = data.winner === myColor;
    const title = $('gameOverTitle');
    if (gameMode === 'local') {
      title.textContent = data.winner === RED ? 'Red Wins!' : 'Black Wins!';
      title.className = '';
    } else {
      title.textContent = isWin ? 'Victory!' : 'Defeat';
      title.className = isWin ? 'win' : 'lose';
    }
    $('gameOverReason').textContent = data.reason;

    // Rating change
    const rc = $('gameOverRating');
    rc.innerHTML = '';
    if (data.ratingChange && user) {
      const delta = data.ratingChange[user.username];
      if (delta != null) {
        const cls = delta >= 0 ? 'positive' : 'negative';
        const sign = delta >= 0 ? '+' : '';
        rc.innerHTML = `Rating: <span class="${cls}">${sign}${delta}</span>`;
        // Update local user
        user.rating = (user.rating || 1200) + delta;
        if (data.winner === myColor) user.wins = (user.wins || 0) + 1;
        else user.losses = (user.losses || 0) + 1;
        updateProfileCard();
      }
    }

    // Show coin reward
    const coinEl = $('gameOverCoins');
    if (coinEl && data.coinRewards && user) {
      const coins = data.coinRewards[user.username];
      if (coins) {
        coinEl.textContent = `+${coins} coins`;
        user.coins = (user.coins || 0) + coins;
      } else {
        coinEl.textContent = '';
      }
    } else if (coinEl) {
      coinEl.textContent = '';
    }

    // Ad frequency: show game-over ad every 2nd game (unless ad-free)
    gamesPlayedThisSession++;
    const adEl = $('adGameOver');
    if (adEl) {
      const showAd = !adFreeUser && gamesPlayedThisSession % 2 === 0;
      adEl.classList.toggle('hidden', !showAd);
      if (showAd) refreshAds();
    }

    $('gameOverOverlay').classList.remove('hidden');

    if ((gameMode === 'local' || isWin) && gameMode !== 'local') {
      sfxWin();
      startConfetti();
    } else if (isWin && gameMode === 'local') {
      sfxWin();
      startConfetti();
    } else {
      sfxLose();
    }
  }

  function updateGameHUD() {
    const myCount = myColor === RED ? countPieces(RED) : countPieces(BLACK);
    const oppCount = myColor === RED ? countPieces(BLACK) : countPieces(RED);

    if (gameMode === 'local') {
      $('myCount').textContent = countPieces(RED);
      $('oppCount').textContent = countPieces(BLACK);
      const isRedTurn = currentTurn === RED;
      $('turnBadge').textContent = isRedTurn ? "RED'S TURN" : "BLACK'S TURN";
      $('turnBadge').className = 'turn-badge my-turn';
    } else {
      $('myCount').textContent = myCount;
      $('oppCount').textContent = oppCount;
      const isMyTurn = currentTurn === myColor;
      $('turnBadge').textContent = isMyTurn ? 'YOUR TURN' : 'OPPONENT';
      $('turnBadge').className = 'turn-badge ' + (isMyTurn ? 'my-turn' : 'opp-turn');
    }
  }

  function countPieces(color) {
    let count = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r]?.[c];
        if (color === RED && (p === RED || p === RED_KING)) count++;
        if (color === BLACK && (p === BLACK || p === BLACK_KING)) count++;
      }
    return count;
  }

  /* ================================================
     INPUT HANDLING
     ================================================ */
  function handleCanvasClick(e) {
    if (animatingPiece || isPaused) return; // Don't allow clicks during animation or pause

    const rect = $canvas.getBoundingClientRect();
    const scaleX = $canvas.width / rect.width;
    const scaleY = $canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const sc = Math.floor(x / TILE);
    const sr = Math.floor(y / TILE);
    if (sr < 0 || sr > 7 || sc < 0 || sc > 7) return;

    const { row, col } = screenToBoard(sr, sc);

    if (gameMode === 'local') {
      handleLocalClick(row, col);
    } else {
      handleOnlineClick(row, col);
    }
  }

  function handleOnlineClick(row, col) {
    if (currentTurn !== myColor) return;

    // If clicking a valid move destination
    if (selectedPiece && validMoves.find(m => m.row === row && m.col === col)) {
      socket.emit('game:makeMove', {
        fromRow: selectedPiece.row,
        fromCol: selectedPiece.col,
        toRow: row,
        toCol: col
      });
      selectedPiece = null;
      validMoves = [];
      return;
    }

    // Select a piece
    socket.emit('game:selectPiece', { row, col });
  }

  function handleLocalClick(row, col) {
    if (!localGame) return;

    // If clicking a valid move destination
    if (selectedPiece && validMoves.find(m => m.row === row && m.col === col)) {
      const result = localGame.makeMove(selectedPiece.row, selectedPiece.col, row, col);
      if (result.valid) {
        selectedPiece = null;
        validMoves = [];
        // Apply update through the same handler
        onGameUpdate(result);
        if (result.gameOver.over) {
          onGameOver({ winner: result.gameOver.winner, reason: result.gameOver.reason });
        } else if (result.continuedJump) {
          // Auto-select for multi-jump
          selectedPiece = { row: row, col: col };
          validMoves = localGame.getValidMoves(row, col);
        }
      }
      return;
    }

    // Select a piece
    const moves = localGame.getValidMoves(row, col);
    if (moves.length > 0) {
      selectedPiece = { row, col };
      validMoves = moves;
    } else {
      selectedPiece = null;
      validMoves = [];
    }
  }

  /* ================================================
     START LOCAL GAME
     ================================================ */
  function startLocalGame() {
    localGame = new LocalCheckersGame();
    gameMode = 'local';
    myColor = RED; // Doesn't flip board in local
    board = localGame.board.map(r => [...r]);
    currentTurn = RED;
    selectedPiece = null;
    validMoves = [];
    jumpingPiece = null;
    lastMove = null;
    animatingPiece = null;
    hiddenSquare = null;
    particles = [];
    animations = [];

    // HUD setup for local
    $('myPiece').className = 'hud-piece red';
    $('oppPiece').className = 'hud-piece black';
    $('myName').textContent = 'Red';
    $('oppName').textContent = 'Black';
    $('myRating').textContent = '';
    $('oppRating').textContent = '';

    // Hide game chat in local mode
    $('gameChatPanel').classList.add('hidden');

    updateGameHUD();
    showScreen('game');
  }

  /* ================================================
     AD MANAGEMENT
     ================================================ */
  function refreshAds() {
    if (adFreeUser) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) { /* adblock or not loaded */ }
  }

  function hideAllAds() {
    document.querySelectorAll('.ad-container').forEach(el => el.style.display = 'none');
  }

  /* ================================================
     SITE THEME
     ================================================ */
  function applySiteTheme(themeId) {
    const theme = SITE_THEMES[themeId] || SITE_THEMES['default'];
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--bg2', theme.bg2);
    root.style.setProperty('--red', theme.red);
    root.style.setProperty('--red-glow', theme.red.replace(')', ',0.4)').replace('rgb', 'rgba').replace('#', ''));
    root.style.setProperty('--gold', theme.gold);
    root.style.setProperty('--gold-glow', theme.gold.replace(')', ',0.35)').replace('rgb', 'rgba').replace('#', ''));
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--green', theme.green);
    root.style.setProperty('--blue', theme.blue);
    // Derive glow values from hex colors
    const redRgb = hexToRgb(theme.red);
    const goldRgb = hexToRgb(theme.gold);
    if (redRgb) root.style.setProperty('--red-glow', `rgba(${redRgb.r},${redRgb.g},${redRgb.b},0.4)`);
    if (goldRgb) root.style.setProperty('--gold-glow', `rgba(${goldRgb.r},${goldRgb.g},${goldRgb.b},0.35)`);
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }

  /* ================================================
     SHOP SYSTEM
     ================================================ */
  async function loadShop() {
    try {
      const res = await fetch('/api/shop');
      if (!res.ok) return;
      shopData = await res.json();
      renderShopItems();
      $('shopCoins').textContent = shopData.coins;
      $('shopGems').textContent = shopData.gems;
    } catch (e) { console.error('Shop load failed:', e); }
  }

  function renderShopItems() {
    const grid = $('shopItemsGrid');
    if (!grid || !shopData) return;
    grid.innerHTML = '';
    const typeMap = { boards: 'board', pieces: 'pieces', badges: 'badge', themes: 'site', premium: 'premium' };
    const type = typeMap[activeShopTab];
    const premiumTypes = ['adfree', 'adfree_timed', 'trial'];
    const items = type === 'premium'
      ? shopData.items.filter(i => premiumTypes.includes(i.type))
      : shopData.items.filter(i => i.type === type);

    const trials = shopData.trials || {};
    const isAdFree = shopData.adFree || (shopData.adFreeUntil && shopData.adFreeUntil > Date.now());

    for (const item of items) {
      const owned = shopData.owned.includes(item.id);
      const onTrial = trials[item.id] && trials[item.id] > 0;
      const equipped = (item.type === 'board' && shopData.equipped.board === item.id)
                    || (item.type === 'pieces' && shopData.equipped.pieces === item.id)
                    || (item.type === 'badge' && shopData.equipped.badge === item.id)
                    || (item.type === 'site' && shopData.equipped.site === item.id);
      const canAfford = item.currency === 'coins'
        ? shopData.coins >= item.price
        : shopData.gems >= item.price;

      const card = document.createElement('div');
      card.className = 'shop-item' + (equipped ? ' equipped' : '');

      // Preview content
      let preview = '';
      const animBadge = item.anim ? '<span class="anim-badge">ANIMATED</span>' : '';
      if (item.type === 'board' && item.colors) {
        preview = `<div style="width:48px;height:48px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;border-radius:4px;overflow:hidden;position:relative">
          <div style="background:${item.colors.light}"></div><div style="background:${item.colors.dark}"></div>
          <div style="background:${item.colors.dark}"></div><div style="background:${item.colors.light}"></div>
        </div>${animBadge}`;
      } else if (item.type === 'badge' && item.emoji) {
        preview = `<span style="font-size:2rem">${item.emoji}</span>`;
      } else if (item.type === 'pieces' && item.colors) {
        preview = `<div style="display:flex;gap:4px;align-items:center">
          <div style="width:20px;height:20px;border-radius:50%;background:${item.colors.red[1]}${item.anim ? ';box-shadow:0 0 8px ' + item.colors.red[0] : ''}"></div>
          <div style="width:20px;height:20px;border-radius:50%;background:${item.colors.black[1]}${item.anim ? ';box-shadow:0 0 8px ' + item.colors.black[0] : ''}"></div>
        </div>${animBadge}`;
      } else if (item.type === 'site' && item.vars) {
        preview = `<div style="width:48px;height:48px;border-radius:6px;background:${item.vars.bg};border:2px solid ${item.vars.red};display:flex;align-items:center;justify-content:center">
          <div style="width:16px;height:16px;border-radius:50%;background:${item.vars.red};box-shadow:0 0 8px ${item.vars.gold}"></div>
        </div>`;
      } else if (item.type === 'adfree' || item.type === 'adfree_timed') {
        preview = '<span style="font-size:2rem">&#128683;</span>';
      } else if (item.type === 'trial') {
        preview = '<span style="font-size:2rem">&#128302;</span>';
      }

      // Build action button and status text
      let actionBtn = '';
      let statusText = '';

      if (item.type === 'adfree') {
        if (isAdFree || owned) {
          statusText = 'ACTIVE';
        } else {
          statusText = `${item.price} ${item.currency}`;
          actionBtn = `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-ghost'} shop-buy-btn" data-buy="${item.id}" ${canAfford ? '' : 'disabled'}>Buy</button>`;
        }
      } else if (item.type === 'adfree_timed') {
        if (shopData.adFreeUntil && shopData.adFreeUntil > Date.now()) {
          const remaining = shopData.adFreeUntil - Date.now();
          const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
          statusText = `${days}d remaining`;
        } else {
          statusText = `${item.price} ${item.currency}`;
        }
        // Always allow buying (extends time)
        actionBtn = `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-ghost'} shop-buy-btn" data-buy="${item.id}" ${canAfford ? '' : 'disabled'}>${shopData.adFreeUntil > Date.now() ? 'Extend' : 'Buy'}</button>`;
      } else if (item.type === 'trial') {
        const tokenKey = item.trialType === 'board' ? '_boardTokens' : '_piecesTokens';
        const tokens = trials[tokenKey] || 0;
        statusText = tokens > 0 ? `${tokens} matches left` : `${item.price} ${item.currency}`;
        if (tokens > 0) {
          actionBtn = `<button class="btn btn-small btn-primary shop-trial-btn" data-trial-type="${item.trialType}">Use</button>`;
        } else {
          actionBtn = `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-ghost'} shop-buy-btn" data-buy="${item.id}" ${canAfford ? '' : 'disabled'}>Buy</button>`;
        }
      } else if (onTrial) {
        statusText = `TRIAL (${trials[item.id]} left)`;
        if (!equipped) actionBtn = `<button class="btn btn-small btn-primary shop-equip-btn" data-equip="${item.id}">Equip</button>`;
      } else if (owned && !equipped) {
        statusText = 'OWNED';
        actionBtn = `<button class="btn btn-small btn-primary shop-equip-btn" data-equip="${item.id}">Equip</button>`;
      } else if (owned && equipped) {
        statusText = 'EQUIPPED';
      } else {
        statusText = `${item.price} ${item.currency}`;
        actionBtn = `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-ghost'} shop-buy-btn" data-buy="${item.id}" ${canAfford ? '' : 'disabled'}>Buy</button>`;
      }

      card.innerHTML = `
        <div class="shop-item-preview">${preview}</div>
        <div class="shop-item-name">${escapeHtml(item.name)}</div>
        <div class="shop-item-price ${item.currency}">${statusText}</div>
        ${item.description ? `<div class="shop-item-desc">${escapeHtml(item.description)}</div>` : ''}
        ${actionBtn}
      `;
      grid.appendChild(card);
    }

    // Bind buy/equip/trial buttons
    grid.querySelectorAll('.shop-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => buyItem(btn.dataset.buy));
    });
    grid.querySelectorAll('.shop-equip-btn').forEach(btn => {
      btn.addEventListener('click', () => equipItem(btn.dataset.equip));
    });
    grid.querySelectorAll('.shop-trial-btn').forEach(btn => {
      btn.addEventListener('click', () => showTrialPicker(btn.dataset.trialType));
    });
  }

  async function buyItem(itemId) {
    try {
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      shopData.coins = data.coins;
      shopData.gems = data.gems;
      shopData.owned = data.owned;
      if (data.adFreeUntil !== undefined) shopData.adFreeUntil = data.adFreeUntil;
      if (data.trials !== undefined) shopData.trials = data.trials;
      if (user) { user.coins = data.coins; user.gems = data.gems; user.ownedItems = data.owned; }
      // Check if ad-free was purchased (permanent or timed)
      const boughtItem = shopData.items.find(i => i.id === itemId);
      if (boughtItem?.type === 'adfree') {
        shopData.adFree = true;
        adFreeUser = true;
        if (user) user.adFree = true;
        hideAllAds();
      } else if (boughtItem?.type === 'adfree_timed') {
        adFreeUser = true;
        if (user) user.adFreeUntil = data.adFreeUntil;
        hideAllAds();
      }
      renderShopItems();
      $('shopCoins').textContent = data.coins;
      $('shopGems').textContent = data.gems;
      sfxKing(); // celebratory sound
    } catch (e) { alert('Purchase failed'); }
  }

  async function equipItem(itemId) {
    try {
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      if (res.ok) {
        const item = shopData.items.find(i => i.id === itemId);
        if (item) {
          if (item.type === 'board') { shopData.equipped.board = itemId; activeCosmetics.board = itemId; if (user) user.equippedBoard = itemId; }
          else if (item.type === 'pieces') { shopData.equipped.pieces = itemId; activeCosmetics.pieces = itemId; if (user) user.equippedPieces = itemId; }
          else if (item.type === 'badge') { shopData.equipped.badge = itemId; activeCosmetics.badge = itemId; if (user) user.equippedBadge = itemId; }
          else if (item.type === 'site') { shopData.equipped.site = itemId; activeCosmetics.site = itemId; if (user) user.equippedSiteTheme = itemId; applySiteTheme(itemId); }
          renderShopItems();
          updateProfileCard();
        }
      }
    } catch (e) { alert('Equip failed'); }
  }

  function showTrialPicker(trialType) {
    if (!shopData) return;
    // Get all unowned items of this type
    const items = shopData.items.filter(i =>
      i.type === trialType && !shopData.owned.includes(i.id) && !(shopData.trials || {})[i.id]
    );
    if (items.length === 0) { alert('No items available to trial!'); return; }

    // Build a simple picker overlay
    const overlay = document.createElement('div');
    overlay.className = 'overlay trial-picker-overlay';
    overlay.innerHTML = `
      <div class="card glass center-card">
        <h2>Pick a ${trialType === 'board' ? 'Board' : 'Piece Skin'} to Try</h2>
        <p class="muted">5 matches trial</p>
        <div class="trial-picker-grid"></div>
        <button class="btn btn-ghost trial-picker-cancel">Cancel</button>
      </div>
    `;
    const grid = overlay.querySelector('.trial-picker-grid');
    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-small btn-primary trial-pick-btn';
      btn.textContent = item.name;
      btn.addEventListener('click', async () => {
        await activateTrial(item.id, trialType);
        overlay.remove();
      });
      grid.appendChild(btn);
    }
    overlay.querySelector('.trial-picker-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('app').appendChild(overlay);
  }

  async function activateTrial(targetId, trialType) {
    try {
      const res = await fetch('/api/shop/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, trialType })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      shopData.trials = data.trials;
      if (user) user.trials = data.trials;
      // Update equipped state
      if (trialType === 'board') {
        shopData.equipped.board = targetId;
        activeCosmetics.board = targetId;
        if (user) user.equippedBoard = targetId;
      } else if (trialType === 'pieces') {
        shopData.equipped.pieces = targetId;
        activeCosmetics.pieces = targetId;
        if (user) user.equippedPieces = targetId;
      }
      renderShopItems();
      sfxKing();
    } catch (e) { alert('Trial activation failed'); }
  }

  function bindShopEvents() {
    // Shop button in lobby
    $('btnShop').addEventListener('click', () => {
      loadShop();
      showScreen('shop');
    });

    // Shop back button
    $('btnShopBack').addEventListener('click', () => {
      showScreen('lobby');
    });

    // Shop tabs
    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeShopTab = tab.dataset.shopTab;
        renderShopItems();
      });
    });
  }

  /* ================================================
     NETFLIX GAME SELECTOR
     ================================================ */
  function selectGame(gameId) {
    selectedGame = gameId;
    const game = GAME_CATALOG[gameId];
    if (!game) return;

    // Collapse the game card row
    const cardRow = $('gameCardRow');
    cardRow.classList.add('collapsed');

    // Mark the selected card
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.game-card[data-game="${gameId}"]`);
    if (card) card.classList.add('selected');

    // Populate the hero
    $('gameDetailIcon').textContent = game.icon;
    $('gameDetailTitle').textContent = game.title;
    $('gameDetailDesc').textContent = game.desc;

    // Populate mode cards
    const modeRow = $('modeCardRow');
    modeRow.innerHTML = '';
    game.modes.forEach(mode => {
      const btn = document.createElement('button');
      btn.className = 'mode-card glass';
      btn.dataset.mode = mode.id;
      btn.dataset.game = gameId;
      btn.innerHTML = `
        <span class="mode-card-icon">${mode.icon}</span>
        <span class="mode-card-name">${mode.name}</span>
        <span class="mode-card-desc">${mode.desc}</span>
      `;
      btn.addEventListener('click', () => handleModeClick(gameId, mode.id));
      modeRow.appendChild(btn);
    });

    // Show the detail panel
    $('gameDetail').classList.add('active');
  }

  function deselectGame() {
    selectedGame = null;
    $('gameDetail').classList.remove('active');
    const cardRow = $('gameCardRow');
    if (cardRow) cardRow.classList.remove('collapsed');
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
    // Remove any lingering private picker
    const picker = document.querySelector('.private-picker');
    if (picker) picker.remove();
  }

  function handleModeClick(gameId, modeId) {
    if (gameId === 'checkers') {
      switch (modeId) {
        case 'ranked':
          socket.emit('queue:join', 'ranked');
          showScreen('queue');
          break;
        case 'casual':
          socket.emit('queue:join', 'casual');
          showScreen('queue');
          break;
        case 'private':
          showPrivateChoice();
          break;
        case 'playBot':
          socket.emit('play:bot');
          $('queueTitle').textContent = 'Botty McBotFace';
          $('queueText').textContent = 'Summoning the AI...';
          showScreen('queue');
          break;
        case 'local':
          startLocalGame();
          break;
      }
    } else if (gameId === 'trouble') {
      switch (modeId) {
        case 'troubleOnline':
          socket.emit('trouble:join');
          $('queueTitle').textContent = 'Trouble';
          $('queueText').textContent = 'Finding Trouble players...';
          showScreen('queue');
          break;
        case 'troubleBots':
          socket.emit('trouble:bot');
          $('queueTitle').textContent = 'Trouble';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'troubleLocal':
          showTroubleLocalPicker();
          break;
      }
    } else if (gameId === 'scrabble') {
      switch (modeId) {
        case 'scrabbleOnline':
          socket.emit('scrabble:join');
          $('queueTitle').textContent = 'Scrabble';
          $('queueText').textContent = 'Finding Scrabble players...';
          showScreen('queue');
          break;
        case 'scrabbleBots':
          socket.emit('scrabble:bot');
          $('queueTitle').textContent = 'Scrabble';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'scrabbleLocal':
          showScrabbleLocalPicker();
          break;
      }
    }
  }

  function showPrivateChoice() {
    const existing = document.querySelector('.private-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.className = 'private-picker glass';
    picker.innerHTML = `
      <button class="btn btn-primary btn-small" id="btnPrivateCreateNew">Create Lobby</button>
      <button class="btn btn-primary btn-small" id="btnPrivateJoinNew">Join with Code</button>
      <button class="btn btn-ghost btn-small" id="btnPrivatePickerBack">Cancel</button>
    `;
    $('gameDetail').appendChild(picker);

    document.getElementById('btnPrivateCreateNew').addEventListener('click', () => {
      picker.remove();
      socket.emit('lobby:create');
    });
    document.getElementById('btnPrivateJoinNew').addEventListener('click', () => {
      picker.remove();
      $('joinCodeInput').value = '';
      $('joinError').textContent = '';
      showScreen('join');
    });
    document.getElementById('btnPrivatePickerBack').addEventListener('click', () => {
      picker.remove();
    });
  }

  /* ================================================
     TROUBLE — CONSTANTS & LAYOUT
     ================================================ */
  const TROUBLE_CANVAS_PX = 640;
  const TROUBLE_TRACK_SIZE = 28;
  const TROUBLE_HOME = -1;
  const TROUBLE_FINISH_BASE = 100;
  const TROUBLE_FINISH_SLOTS = 4;
  const TROUBLE_ENTRY = [0, 7, 14, 21];
  const CENTER = TROUBLE_CANVAS_PX / 2;

  // 28 track positions on a circular path — no corner overlap
  const TRACK_RADIUS = 215;
  const TROUBLE_TRACK = (() => {
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 - Math.PI / 2; // top = 0, clockwise
      pts.push({
        x: CENTER + Math.cos(angle) * TRACK_RADIUS,
        y: CENTER + Math.sin(angle) * TRACK_RADIUS
      });
    }
    return pts;
  })();

  // Home positions — 4 clusters outside the track circle, in diagonal quadrants
  const HOME_DIST = 275; // distance from center for home clusters
  const TROUBLE_HOMES = (() => {
    const homes = [];
    const diags = [
      { dx:  1, dy: -1 }, // P0 Red: upper-right
      { dx:  1, dy:  1 }, // P1 Blue: lower-right
      { dx: -1, dy:  1 }, // P2 Green: lower-left
      { dx: -1, dy: -1 }  // P3 Yellow: upper-left
    ];
    const sp = 15; // half-spacing between tokens in a 2x2 grid
    for (const d of diags) {
      const cx = CENTER + d.dx * HOME_DIST * 0.707;
      const cy = CENTER + d.dy * HOME_DIST * 0.707;
      homes.push([
        { x: cx - sp, y: cy - sp },
        { x: cx + sp, y: cy - sp },
        { x: cx - sp, y: cy + sp },
        { x: cx + sp, y: cy + sp }
      ]);
    }
    return homes;
  })();

  // Finish lanes — 4 slots per player, going from just inside entry toward center
  const TROUBLE_FINISH = (() => {
    const lanes = [];
    // Direction from entry point toward center
    const dirs = [
      { dx: 0, dy: 1 },   // P0: top entry, lane goes down
      { dx: -1, dy: 0 },  // P1: right entry, lane goes left
      { dx: 0, dy: -1 },  // P2: bottom entry, lane goes up
      { dx: 1, dy: 0 }    // P3: left entry, lane goes right
    ];
    for (let p = 0; p < 4; p++) {
      const entry = TROUBLE_TRACK[TROUBLE_ENTRY[p]];
      const d = dirs[p];
      const lane = [];
      for (let s = 0; s < 4; s++) {
        lane.push({
          x: entry.x + d.dx * (35 + s * 35),
          y: entry.y + d.dy * (35 + s * 35)
        });
      }
      lanes.push(lane);
    }
    return lanes;
  })();

  // Player colors for Trouble (fixed per seat, piece theme used for animation effects)
  const TROUBLE_PLAYER_COLORS = [
    { highlight: '#ff6b6b', mid: '#d32f2f', dark: '#8b1a1a', outer: '#7a1018', stroke: '#5a0a0a' }, // Red
    { highlight: '#6ba3ff', mid: '#2f6fd3', dark: '#1a3d8b', outer: '#10307a', stroke: '#0a205a' }, // Blue
    { highlight: '#6bff6b', mid: '#2fd32f', dark: '#1a8b1a', outer: '#107a10', stroke: '#0a5a0a' }, // Green
    { highlight: '#ffff6b', mid: '#d3d32f', dark: '#8b8b1a', outer: '#7a7a10', stroke: '#5a5a0a' }  // Yellow
  ];
  const TROUBLE_COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow'];

  /* ================================================
     TROUBLE — STATE
     ================================================ */
  let troubleCanvas = null, troubleCtx = null;
  let troubleState = null;       // { tokens, currentTurn, diceResult, phase, playerCount, finished, players, gameId }
  let troublePlayerIndex = -1;   // my seat index
  let troubleIsLocal = false;
  let troubleLocalGame = null;   // LocalTroubleGame for hotseat
  let troubleValidMoves = [];    // valid moves after a roll
  let troubleDiceAnim = null;    // { startTime, duration, finalValue }
  let troubleParticles = [];
  let troubleSelectedToken = -1; // token index being hovered/selected
  let troubleGameLoopActive = false;
  let troubleLastFrame = 0;

  /* ================================================
     TROUBLE — CANVAS SETUP & GAME LOOP
     ================================================ */
  function setupTroubleCanvas() {
    troubleCanvas = $('troubleCanvas');
    troubleCtx = troubleCanvas.getContext('2d');
    troubleCanvas.width = TROUBLE_CANVAS_PX;
    troubleCanvas.height = TROUBLE_CANVAS_PX;
    troubleCanvas.addEventListener('click', handleTroubleClick);
  }

  function startTroubleGameLoop() {
    if (troubleGameLoopActive) return;
    troubleGameLoopActive = true;
    troubleLastFrame = performance.now();
    requestAnimationFrame(troubleGameLoop);
  }

  function troubleGameLoop(ts) {
    if (!troubleGameLoopActive || currentScreen !== 'trouble') {
      troubleGameLoopActive = false;
      return;
    }
    troubleLastFrame = ts;
    renderTrouble();
    updateTroubleParticles();
    requestAnimationFrame(troubleGameLoop);
  }

  /* ================================================
     TROUBLE — PARTICLE SYSTEM
     ================================================ */
  function emitTroubleParticles(x, y, count, colors, speed) {
    speed = speed || 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      troubleParticles.push({
        x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: 1, decay: 0.01 + Math.random() * 0.02,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function updateTroubleParticles() {
    for (let i = troubleParticles.length - 1; i >= 0; i--) {
      const p = troubleParticles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= p.decay;
      if (p.life <= 0) troubleParticles.splice(i, 1);
    }
  }

  function drawTroubleParticles() {
    for (const p of troubleParticles) {
      troubleCtx.globalAlpha = p.life;
      troubleCtx.fillStyle = p.color;
      troubleCtx.beginPath();
      troubleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      troubleCtx.fill();
    }
    troubleCtx.globalAlpha = 1;
  }

  /* ================================================
     TROUBLE — RENDERING
     ================================================ */
  function renderTrouble() {
    if (!troubleCtx || !troubleState) return;
    const c = troubleCtx;
    c.clearRect(0, 0, TROUBLE_CANVAS_PX, TROUBLE_CANVAS_PX);

    drawTroubleBoard();
    drawTroubleTrack();
    drawTroubleHomes();
    drawTroubleFinishLanes();
    drawTroubleTokens();
    drawTroubleDice();
    drawTroubleParticles();
  }

  function drawTroubleBoard() {
    const c = troubleCtx;
    const theme = BOARD_THEMES[activeCosmetics.board] || BOARD_THEMES['default'];
    const t = performance.now();

    // Background fill
    c.fillStyle = theme.light;
    c.fillRect(0, 0, TROUBLE_CANVAS_PX, TROUBLE_CANVAS_PX);

    // Circular board area
    c.save();
    c.beginPath();
    c.arc(CENTER, CENTER, TRACK_RADIUS + 50, 0, Math.PI * 2);
    c.fillStyle = theme.dark;
    c.fill();
    c.restore();

    // Animated board overlays
    if (theme.anim) {
      c.save();
      c.beginPath();
      c.arc(CENTER, CENTER, TRACK_RADIUS + 50, 0, Math.PI * 2);
      c.clip();
      if (theme.anim === 'lava') {
        c.globalAlpha = 0.15;
        c.strokeStyle = theme.glow; c.lineWidth = 2;
        c.beginPath();
        for (let x = 60; x < TROUBLE_CANVAS_PX - 60; x += 4) {
          const y = CENTER + Math.sin(x / 60 + t / 600) * 80 + Math.sin(x / 30 + t / 400) * 30;
          x === 60 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
      } else if (theme.anim === 'aurora') {
        for (let band = 0; band < 3; band++) {
          const yOff = TROUBLE_CANVAS_PX * (0.2 + band * 0.3) + Math.sin(t / 1200 + band * 2) * 50;
          const grad = c.createLinearGradient(0, yOff - 60, 0, yOff + 60);
          const hue1 = (t / 20 + band * 60) % 360;
          const hue2 = (hue1 + 40) % 360;
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.3, `hsla(${hue1},80%,50%,0.08)`);
          grad.addColorStop(0.5, `hsla(${hue2},80%,60%,0.12)`);
          grad.addColorStop(0.7, `hsla(${hue1},80%,50%,0.08)`);
          grad.addColorStop(1, 'transparent');
          c.fillStyle = grad;
          c.fillRect(0, 0, TROUBLE_CANVAS_PX, TROUBLE_CANVAS_PX);
        }
      } else if (theme.anim === 'matrix') {
        c.font = '10px monospace';
        for (let i = 0; i < 12; i++) {
          const x = 80 + (i / 12) * (TROUBLE_CANVAS_PX - 160);
          const speed = 40 + (i * 7) % 30;
          const yBase = ((t / speed) + i * 47) % (TROUBLE_CANVAS_PX + 200) - 100;
          for (let j = 0; j < 6; j++) {
            const y = yBase + j * 14;
            c.fillStyle = `rgba(0,255,65,${Math.max(0, 0.25 - j * 0.04)})`;
            c.fillText(String.fromCharCode(0x30A0 + Math.floor(((t / 200 + i + j * 3) % 96))), x, y);
          }
        }
      } else if (theme.anim === 'pulse') {
        for (let i = 0; i < 3; i++) {
          const dist = (t / 500 + i * 2) % 5 * 80;
          const alpha = Math.max(0, 0.08 - dist * 0.0003);
          const hue = ((t / 15) + dist) % 360;
          c.strokeStyle = `hsla(${hue},70%,55%,${alpha})`;
          c.lineWidth = 2;
          c.beginPath(); c.arc(CENTER, CENTER, dist, 0, Math.PI * 2); c.stroke();
        }
      }
      c.restore();
    }

    // Circular border
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(CENTER, CENTER, TRACK_RADIUS + 50, 0, Math.PI * 2);
    c.stroke();
  }

  function drawTroubleTrack() {
    const c = troubleCtx;
    const theme = BOARD_THEMES[activeCosmetics.board] || BOARD_THEMES['default'];

    // Draw circular path ring connecting all positions
    c.beginPath();
    c.arc(CENTER, CENTER, TRACK_RADIUS, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.lineWidth = 36;
    c.stroke();

    // Draw position circles
    for (let i = 0; i < TROUBLE_TRACK.length; i++) {
      const pt = TROUBLE_TRACK[i];
      const isEntry = TROUBLE_ENTRY.includes(i);
      const entryPlayer = isEntry ? TROUBLE_ENTRY.indexOf(i) : -1;

      c.beginPath();
      c.arc(pt.x, pt.y, isEntry ? 20 : 16, 0, Math.PI * 2);
      if (isEntry && entryPlayer < troubleState.playerCount) {
        const pc = TROUBLE_PLAYER_COLORS[entryPlayer];
        c.fillStyle = pc.dark;
        c.fill();
        c.strokeStyle = pc.mid;
        c.lineWidth = 2.5;
        c.stroke();
      } else {
        const grad = c.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 16);
        grad.addColorStop(0, theme.dark2 || theme.dark);
        grad.addColorStop(1, theme.dark);
        c.fillStyle = grad;
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.12)';
        c.lineWidth = 1;
        c.stroke();
      }
    }
  }

  function drawTroubleHomes() {
    const c = troubleCtx;
    for (let p = 0; p < troubleState.playerCount; p++) {
      const pc = TROUBLE_PLAYER_COLORS[p];
      const homes = TROUBLE_HOMES[p];
      // Draw home zone background
      const cx = (homes[0].x + homes[3].x) / 2;
      const cy = (homes[0].y + homes[3].y) / 2;
      c.beginPath();
      c.arc(cx, cy, 40, 0, Math.PI * 2);
      c.fillStyle = pc.dark + '33';
      c.fill();
      c.strokeStyle = pc.stroke;
      c.lineWidth = 1;
      c.stroke();

      // Draw home circles
      for (let ti = 0; ti < 4; ti++) {
        c.beginPath();
        c.arc(homes[ti].x, homes[ti].y, 12, 0, Math.PI * 2);
        c.fillStyle = pc.dark + '55';
        c.fill();
        c.strokeStyle = pc.stroke;
        c.lineWidth = 1;
        c.stroke();
      }
    }
  }

  function drawTroubleFinishLanes() {
    const c = troubleCtx;
    for (let p = 0; p < troubleState.playerCount; p++) {
      const pc = TROUBLE_PLAYER_COLORS[p];
      const lane = TROUBLE_FINISH[p];
      for (let s = 0; s < TROUBLE_FINISH_SLOTS; s++) {
        c.beginPath();
        c.arc(lane[s].x, lane[s].y, 14, 0, Math.PI * 2);
        const grad = c.createRadialGradient(lane[s].x, lane[s].y, 0, lane[s].x, lane[s].y, 14);
        grad.addColorStop(0, pc.dark + '88');
        grad.addColorStop(1, pc.dark + '33');
        c.fillStyle = grad;
        c.fill();
        c.strokeStyle = pc.mid + '66';
        c.lineWidth = 1;
        c.stroke();
      }
    }
  }

  function getTroubleTokenPixel(player, pos) {
    if (pos === TROUBLE_HOME) return null; // handled separately
    if (pos >= TROUBLE_FINISH_BASE + TROUBLE_FINISH_SLOTS) return null; // completed
    if (pos >= TROUBLE_FINISH_BASE) {
      const slot = pos - TROUBLE_FINISH_BASE;
      return TROUBLE_FINISH[player][slot];
    }
    return TROUBLE_TRACK[pos];
  }

  function drawTroubleTokens() {
    const c = troubleCtx;
    const pTheme = PIECE_THEMES[activeCosmetics.pieces] || PIECE_THEMES['default'];
    const t = performance.now();

    // Build occupancy map for track positions to offset overlapping tokens
    const trackOccupants = new Map(); // pos -> [{player, tokenIdx}]
    for (let p = 0; p < troubleState.playerCount; p++) {
      for (let ti = 0; ti < 4; ti++) {
        const pos = troubleState.tokens[p][ti];
        if (pos === TROUBLE_HOME || pos >= TROUBLE_FINISH_BASE) continue;
        if (!trackOccupants.has(pos)) trackOccupants.set(pos, []);
        trackOccupants.get(pos).push({ player: p, tokenIdx: ti });
      }
    }

    for (let p = 0; p < troubleState.playerCount; p++) {
      const pc = TROUBLE_PLAYER_COLORS[p];
      for (let ti = 0; ti < 4; ti++) {
        const pos = troubleState.tokens[p][ti];
        if (pos >= TROUBLE_FINISH_BASE + TROUBLE_FINISH_SLOTS) continue; // completed token

        let pt;
        if (pos === TROUBLE_HOME) {
          pt = TROUBLE_HOMES[p][ti];
        } else {
          pt = getTroubleTokenPixel(p, pos);
          if (!pt) continue;
        }

        // Offset tokens sharing the same track position
        let ox = 0, oy = 0;
        if (pos !== TROUBLE_HOME && pos < TROUBLE_FINISH_BASE) {
          const occ = trackOccupants.get(pos);
          if (occ && occ.length > 1) {
            const idx = occ.findIndex(o => o.player === p && o.tokenIdx === ti);
            const offsets = [[-8, -8], [8, -8], [-8, 8], [8, 8]];
            if (idx >= 0 && idx < offsets.length) {
              ox = offsets[idx][0];
              oy = offsets[idx][1];
            }
          }
        }
        const px = pt.x + ox;
        const py = pt.y + oy;

        const radius = pos === TROUBLE_HOME ? 10 : 14;
        const isMyToken = troubleIsLocal ? (p === troubleState.currentTurn) : (p === troublePlayerIndex);
        const isMovable = isMyToken && troubleState.phase === 'move' &&
          troubleValidMoves.some(m => m.tokenIdx === ti);

        // Movable highlight
        if (isMovable) {
          const pulse = 1 + Math.sin(t / 300) * 0.15;
          c.beginPath();
          c.arc(px, py, (radius + 6) * pulse, 0, Math.PI * 2);
          c.fillStyle = 'rgba(255,215,0,0.25)';
          c.fill();
          c.strokeStyle = 'rgba(255,215,0,0.6)';
          c.lineWidth = 2;
          c.stroke();
        }

        // Shadow
        c.beginPath();
        c.arc(px + 1, py + 2, radius, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.fill();

        // Outer ring
        c.beginPath();
        c.arc(px, py + 1, radius, 0, Math.PI * 2);
        c.fillStyle = pc.outer;
        c.fill();

        // Main body gradient
        const g = c.createRadialGradient(px - radius * 0.3, py - radius * 0.3, radius * 0.05, px, py, radius);
        g.addColorStop(0, pc.highlight);
        g.addColorStop(0.6, pc.mid);
        g.addColorStop(1, pc.dark);
        c.beginPath();
        c.arc(px, py, radius, 0, Math.PI * 2);
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = pc.stroke;
        c.lineWidth = 1.5;
        c.stroke();

        // Inner ring
        c.beginPath();
        c.arc(px, py, radius * 0.6, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(255,255,255,0.15)';
        c.lineWidth = 1;
        c.stroke();

        // Piece theme animation effects
        if (pTheme.anim) {
          drawTroubleTokenAnim(pTheme.anim, px, py, radius, pc, p);
        }
      }
    }
  }

  function drawTroubleTokenAnim(anim, cx, cy, radius, colors, playerIdx) {
    const c = troubleCtx;
    const t = performance.now();

    if (anim === 'flame') {
      const flicker = Math.sin(t / 80) * 0.3 + Math.sin(t / 130) * 0.2;
      const outerR = radius * (1.2 + flicker * 0.12);
      const grad = c.createRadialGradient(cx, cy - radius * 0.2, radius * 0.4, cx, cy, outerR);
      const baseCol = playerIdx < 2 ? '255,69,0' : '0,180,80';
      grad.addColorStop(0, `rgba(${baseCol},0)`);
      grad.addColorStop(0.7, `rgba(${baseCol},${0.1 + flicker * 0.05})`);
      grad.addColorStop(1, `rgba(${baseCol},0)`);
      c.fillStyle = grad;
      c.beginPath(); c.arc(cx, cy, outerR, 0, Math.PI * 2); c.fill();
    } else if (anim === 'plasma') {
      const ringR = radius * 1.1;
      c.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t / 400;
        const nextAngle = ((i + 1) / 8) * Math.PI * 2 + t / 400;
        const alpha = 0.15 + Math.sin(t / 200 + i * 0.8) * 0.1;
        c.strokeStyle = `rgba(${colors.highlight.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(',')},${alpha})`;
        c.beginPath(); c.arc(cx, cy, ringR, angle, nextAngle); c.stroke();
      }
    } else if (anim === 'shadow') {
      const pulse = Math.sin(t / 600);
      const auraR = radius * (1.25 + pulse * 0.12);
      const grad = c.createRadialGradient(cx, cy, radius * 0.6, cx, cy, auraR);
      grad.addColorStop(0, `rgba(${colors.highlight.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(',')},0)`);
      grad.addColorStop(0.5, `rgba(${colors.highlight.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(',')},${0.06 + pulse * 0.03})`);
      grad.addColorStop(1, `rgba(${colors.highlight.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(',')},0)`);
      c.fillStyle = grad;
      c.beginPath(); c.arc(cx, cy, auraR, 0, Math.PI * 2); c.fill();
    }
  }

  function drawTroubleDice() {
    const c = troubleCtx;
    const t = performance.now();

    // Center dice bubble
    c.beginPath();
    c.arc(CENTER, CENTER, 36, 0, Math.PI * 2);
    c.fillStyle = 'rgba(20,20,40,0.85)';
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 2;
    c.stroke();

    // Dice rolling animation
    if (troubleDiceAnim) {
      const elapsed = t - troubleDiceAnim.startTime;
      if (elapsed < troubleDiceAnim.duration) {
        // Show random numbers quickly
        const val = Math.floor(Math.random() * 6) + 1;
        drawDiceFace(CENTER, CENTER, val, 0.7);
        return;
      } else {
        // Animation ended — show final value
        drawDiceFace(CENTER, CENTER, troubleDiceAnim.finalValue, 1);
        troubleDiceAnim = null;
        return;
      }
    }

    // Static dice display
    if (troubleState.diceResult) {
      drawDiceFace(CENTER, CENTER, troubleState.diceResult, 1);
    } else {
      // Show "?" or "Roll" indicator
      c.font = 'bold 20px sans-serif';
      c.fillStyle = '#aaa';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', CENTER, CENTER);
    }
  }

  function drawDiceFace(cx, cy, val, alpha) {
    const c = troubleCtx;
    c.save();
    c.globalAlpha = alpha;
    c.font = 'bold 32px sans-serif';
    c.fillStyle = '#ffd700';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(val, cx, cy);
    c.restore();
  }

  /* ================================================
     TROUBLE — HUD UPDATE
     ================================================ */
  function updateTroubleHUD() {
    if (!troubleState) return;
    const hudEl = $('troubleHud');
    if (!hudEl) return;

    let html = '';
    for (let p = 0; p < troubleState.playerCount; p++) {
      const pc = TROUBLE_PLAYER_COLORS[p];
      const rawName = troubleState.players?.[p]?.username || TROUBLE_COLOR_NAMES[p];
      const isBot = rawName.startsWith('trouble_bot_');
      const displayName = isBot ? `Bot ${TROUBLE_COLOR_NAMES[p]}` : rawName;
      const isActive = troubleState.currentTurn === p;
      const isMe = !troubleIsLocal && p === troublePlayerIndex;

      // Build token pips: home=dim, on-board=colored, finished=gold
      let pips = '';
      for (let ti = 0; ti < 4; ti++) {
        const tpos = troubleState.tokens[p][ti];
        let pipClass = 'pip-home';
        if (tpos >= TROUBLE_FINISH_BASE + TROUBLE_FINISH_SLOTS) {
          pipClass = 'pip-done';
        } else if (tpos !== TROUBLE_HOME) {
          pipClass = 'pip-active';
        }
        pips += `<span class="trouble-pip ${pipClass}" style="--pip-color:${pc.mid}"></span>`;
      }

      // Phase label for active player
      let phaseLabel = '';
      if (isActive && !troubleState.gameOver) {
        phaseLabel = troubleState.phase === 'roll' ? 'Rolling...' : 'Moving...';
      }

      html += `<div class="trouble-player-card${isActive ? ' active' : ''}${isMe ? ' is-you' : ''}" style="--pc:${pc.mid}">
        <div class="trouble-card-top">
          <div class="trouble-card-dot" style="background:${pc.mid}"></div>
          <span class="trouble-card-name">${escapeHtml(displayName)}${isMe ? ' <span class="trouble-you-tag">(You)</span>' : ''}${isBot ? ' <span class="trouble-bot-tag">BOT</span>' : ''}</span>
        </div>
        <div class="trouble-token-pips">${pips}</div>
        ${phaseLabel ? `<div class="trouble-phase-label">${phaseLabel}</div>` : ''}
      </div>`;
    }
    hudEl.innerHTML = html;

    // Update turn banner
    const bannerEl = $('troubleTurnBanner');
    if (bannerEl && !troubleState.gameOver) {
      const cp = troubleState.currentTurn;
      const cpc = TROUBLE_PLAYER_COLORS[cp];
      const myTurn = !troubleIsLocal && cp === troublePlayerIndex;
      const turnName = myTurn ? 'Your' : (troubleState.players?.[cp]?.username || TROUBLE_COLOR_NAMES[cp]);
      const turnDisplayName = (turnName.startsWith('trouble_bot_') ? `Bot ${TROUBLE_COLOR_NAMES[cp]}` : turnName);
      const phaseText = troubleState.phase === 'roll' ? 'Roll!' : 'Pick a token!';
      bannerEl.textContent = myTurn ? `Your Turn \u2014 ${phaseText}` : `${turnDisplayName} is ${troubleState.phase === 'roll' ? 'rolling' : 'moving'}...`;
      bannerEl.style.color = cpc.highlight;
      bannerEl.classList.toggle('your-turn', myTurn);
    } else if (bannerEl) {
      bannerEl.textContent = '';
    }
  }

  /* ================================================
     TROUBLE — CLICK HANDLING
     ================================================ */
  function handleTroubleClick(e) {
    if (!troubleState || isPaused) return;

    const rect = troubleCanvas.getBoundingClientRect();
    const scaleX = troubleCanvas.width / rect.width;
    const scaleY = troubleCanvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const myTurn = troubleIsLocal ? true : (troubleState.currentTurn === troublePlayerIndex);
    if (!myTurn) return;

    // Check dice click (center area)
    if (troubleState.phase === 'roll') {
      const dist = Math.sqrt((mx - CENTER) ** 2 + (my - CENTER) ** 2);
      if (dist < 50) {
        troubleDoRoll();
        return;
      }
    }

    // Check token clicks (for move selection)
    if (troubleState.phase === 'move' && troubleValidMoves.length > 0) {
      const currentPlayer = troubleState.currentTurn;
      for (const move of troubleValidMoves) {
        const ti = move.tokenIdx;
        const pos = troubleState.tokens[currentPlayer][ti];
        let pt;
        if (pos === TROUBLE_HOME) {
          pt = TROUBLE_HOMES[currentPlayer][ti];
        } else {
          pt = getTroubleTokenPixel(currentPlayer, pos);
        }
        if (!pt) continue;
        const dist = Math.sqrt((mx - pt.x) ** 2 + (my - pt.y) ** 2);
        if (dist < 22) {
          troubleDoMove(ti);
          return;
        }
      }
    }
  }

  function troubleDoRoll() {
    if (troubleIsLocal) {
      if (!troubleLocalGame) return;
      const result = troubleLocalGame.rollDice();
      if (!result.valid) return;
      troubleDiceAnim = { startTime: performance.now(), duration: 500, finalValue: result.diceResult };
      setTimeout(() => {
        troubleState.diceResult = result.diceResult;
        troubleValidMoves = result.validMoves;
        troubleState.phase = result.phase;
        troubleState.currentTurn = result.currentTurn;
        if (result.skipped) {
          updateTroubleHUD();
        }
      }, 520);
    } else {
      socket.emit('trouble:roll');
    }
  }

  function troubleDoMove(tokenIdx) {
    if (troubleIsLocal) {
      if (!troubleLocalGame) return;
      const result = troubleLocalGame.makeMove(tokenIdx);
      if (!result.valid) return;
      onTroubleUpdate({
        player: result.player,
        tokenIdx: result.tokenIdx,
        fromPos: result.fromPos,
        toPos: result.toPos,
        captured: result.captured,
        finishedToken: result.finishedToken,
        extraTurn: result.extraTurn,
        tokens: result.state.tokens,
        finished: result.state.finished,
        currentTurn: result.state.currentTurn,
        phase: result.state.phase
      });
      if (result.gameOver.over) {
        onTroubleOver({ winner: result.gameOver.winner, winnerUsername: TROUBLE_COLOR_NAMES[result.gameOver.winner], coinRewards: {} });
      }
    } else {
      socket.emit('trouble:move', { tokenIdx });
    }
  }

  /* ================================================
     TROUBLE — SOCKET EVENT HANDLERS
     ================================================ */
  function onTroubleStart(data) {
    troublePlayerIndex = data.playerIndex;
    troubleIsLocal = false;
    troubleLocalGame = null;
    troubleValidMoves = [];
    troubleParticles = [];
    troubleDiceAnim = null;
    troubleSelectedToken = -1;

    troubleState = {
      gameId: data.gameId,
      playerCount: data.playerCount,
      currentTurn: data.currentTurn,
      tokens: data.tokens,
      finished: data.finished,
      diceResult: data.diceResult,
      phase: data.phase,
      players: data.players
    };
    currentMatchCode = data.matchCode || null;
    isPaused = false;

    // Apply cosmetics
    if (data.cosmetics?.[troublePlayerIndex]) {
      activeCosmetics = { ...activeCosmetics, ...data.cosmetics[troublePlayerIndex] };
    }

    // Clear game chat
    const chatEl = $('troubleChatMessages');
    if (chatEl) chatEl.innerHTML = '';
    const chatPanel = $('troubleChatPanel');
    if (chatPanel) chatPanel.classList.remove('hidden');

    // Match code display
    const tCodeEl = $('troubleMatchCodeValue');
    if (tCodeEl) tCodeEl.textContent = currentMatchCode || '------';

    updateTroubleHUD();
    $('btnTroubleRoll').disabled = (data.currentTurn !== troublePlayerIndex);
    showScreen('trouble');
    $('gamePausedOverlay')?.classList.add('hidden');
    $('reconnectingOverlay')?.classList.add('hidden');
    playTone(523, 0.15, 'sine', 0.08);
  }

  function onTroubleRollResult(data) {
    troubleDiceAnim = { startTime: performance.now(), duration: 500, finalValue: data.diceResult };

    setTimeout(() => {
      troubleState.diceResult = data.diceResult;
      troubleState.phase = data.phase;
      troubleState.currentTurn = data.currentTurn;

      const isMyTurn = troubleIsLocal ? true : (data.player === troublePlayerIndex);
      if (isMyTurn && !data.skipped) {
        troubleValidMoves = data.validMoves;
      } else {
        troubleValidMoves = [];
      }
      if (data.skipped) {
        // Turn was skipped
        updateTroubleHUD();
        $('btnTroubleRoll').disabled = troubleIsLocal ? false : (data.currentTurn !== troublePlayerIndex);
      }
      updateTroubleHUD();
      $('btnTroubleRoll').disabled = troubleIsLocal ? false : (data.currentTurn !== troublePlayerIndex);
      playTone(440, 0.06, 'sine', 0.08);
    }, 520);
  }

  function onTroubleUpdate(data) {
    // Get pixel pos for particles
    const fromPt = data.fromPos === TROUBLE_HOME
      ? TROUBLE_HOMES[data.player]?.[data.tokenIdx]
      : getTroubleTokenPixel(data.player, data.fromPos);
    const toPt = getTroubleTokenPixel(data.player, data.toPos);

    // Apply state
    troubleState.tokens = data.tokens;
    troubleState.finished = data.finished;
    troubleState.currentTurn = data.currentTurn;
    troubleState.phase = data.phase;
    troubleState.diceResult = null;
    troubleValidMoves = [];

    // Sound and particles
    if (data.captured) {
      sfxCapture();
      const capPt = TROUBLE_TRACK[data.captured.player !== undefined ? 0 : 0]; // approximate
      if (toPt) emitTroubleParticles(toPt.x, toPt.y, 15, ['#ff2d55', '#ff6b6b', '#fff'], 3);
    } else if (data.finishedToken) {
      sfxKing();
      emitTroubleParticles(CENTER, CENTER, 20, ['#ffd700', '#ffaa00', '#fff'], 4);
    } else {
      sfxMove();
    }

    if (data.extraTurn && toPt) {
      emitTroubleParticles(toPt.x, toPt.y, 8, ['#ffd700', '#ffcc00'], 2);
    }

    updateTroubleHUD();
    $('btnTroubleRoll').disabled = troubleIsLocal ? false : (data.currentTurn !== troublePlayerIndex);
  }

  function onTroubleOver(data) {
    const isWin = troubleIsLocal
      ? true
      : (data.winner === troublePlayerIndex);
    const title = $('gameOverTitle');
    if (troubleIsLocal) {
      title.textContent = `${TROUBLE_COLOR_NAMES[data.winner]} Wins!`;
      title.className = '';
    } else {
      title.textContent = isWin ? 'Victory!' : 'Defeat';
      title.className = isWin ? 'win' : 'lose';
    }
    $('gameOverReason').textContent = 'All tokens home!';

    // Rating change (Trouble is unranked for now)
    $('gameOverRating').innerHTML = '';

    // Coins
    const coinEl = $('gameOverCoins');
    if (coinEl && data.coinRewards && user) {
      const coins = data.coinRewards[user.username];
      if (coins) {
        coinEl.textContent = `+${coins} coins`;
        user.coins = (user.coins || 0) + coins;
      } else {
        coinEl.textContent = '';
      }
    } else if (coinEl) {
      coinEl.textContent = '';
    }

    gamesPlayedThisSession++;
    const adEl = $('adGameOver');
    if (adEl) {
      const showAd = !adFreeUser && gamesPlayedThisSession % 2 === 0;
      adEl.classList.toggle('hidden', !showAd);
      if (showAd) refreshAds();
    }

    $('gameOverOverlay').classList.remove('hidden');

    if (isWin || troubleIsLocal) {
      sfxWin();
      startConfetti();
    } else {
      sfxLose();
    }

    // Clean up
    troubleGameLoopActive = false;
    troubleState = null;
    troubleLocalGame = null;
  }

  /* ================================================
     TROUBLE — LOCAL GAME ENGINE (client-side)
     ================================================ */
  class LocalTroubleGame {
    constructor(playerCount) {
      this.playerCount = Math.max(2, Math.min(4, playerCount));
      this.currentTurn = 0;
      this.diceResult = null;
      this.phase = 'roll';
      this.gameOver = false;
      this.winner = null;
      this.tokens = [];
      for (let p = 0; p < this.playerCount; p++) {
        this.tokens.push([-1, -1, -1, -1]);
      }
      this.finished = new Array(this.playerCount).fill(0);
    }

    getState() {
      return {
        playerCount: this.playerCount,
        currentTurn: this.currentTurn,
        tokens: this.tokens.map(t => [...t]),
        finished: [...this.finished],
        diceResult: this.diceResult,
        phase: this.phase,
        gameOver: this.gameOver,
        winner: this.winner
      };
    }

    rollDice() {
      if (this.phase !== 'roll' || this.gameOver) return { valid: false };
      this.diceResult = Math.floor(Math.random() * 6) + 1;
      const validMoves = this.getValidMoves();
      if (validMoves.length === 0) {
        this._nextTurn();
        return { valid: true, diceResult: this.diceResult, validMoves: [], skipped: true, currentTurn: this.currentTurn, phase: this.phase };
      }
      this.phase = 'move';
      return { valid: true, diceResult: this.diceResult, validMoves, skipped: false, currentTurn: this.currentTurn, phase: this.phase };
    }

    getValidMoves() {
      if (this.diceResult == null || this.gameOver) return [];
      const player = this.currentTurn;
      const moves = [];
      for (let ti = 0; ti < 4; ti++) {
        const pos = this.tokens[player][ti];
        if (pos === -1) {
          if (this.diceResult === 6) {
            const entry = TROUBLE_ENTRY[player];
            if (!this.tokens[player].some(p => p === entry)) {
              moves.push({ tokenIdx: ti, destType: 'enter' });
            }
          }
        } else if (pos >= 100) {
          const slot = pos - 100;
          const newSlot = slot + this.diceResult;
          if (newSlot < 4) {
            if (!this.tokens[player].some(p => p === 100 + newSlot)) {
              moves.push({ tokenIdx: ti, destType: 'finish_advance' });
            }
          } else if (newSlot === 4) {
            moves.push({ tokenIdx: ti, destType: 'finish_complete' });
          }
        } else {
          const dest = this._calcDest(player, pos, this.diceResult);
          if (dest) {
            if (dest.type === 'track') {
              if (!this.tokens[player].some(p => p === dest.pos)) {
                moves.push({ tokenIdx: ti, destType: 'track', destPos: dest.pos });
              }
            } else if (dest.type === 'finish') {
              if (!this.tokens[player].some(p => p === dest.pos)) {
                moves.push({ tokenIdx: ti, destType: dest.pos === 104 ? 'finish_complete' : 'finish_enter' });
              }
            }
          }
        }
      }
      return moves;
    }

    makeMove(tokenIdx) {
      if (this.phase !== 'move' || this.gameOver) return { valid: false };
      const player = this.currentTurn;
      const pos = this.tokens[player][tokenIdx];
      const validMoves = this.getValidMoves();
      const move = validMoves.find(m => m.tokenIdx === tokenIdx);
      if (!move) return { valid: false };

      let fromPos = pos, toPos, captured = null, finishedToken = false;

      if (move.destType === 'enter') {
        toPos = TROUBLE_ENTRY[player];
        this.tokens[player][tokenIdx] = toPos;
        captured = this._checkCapture(player, toPos);
      } else if (move.destType === 'track') {
        toPos = move.destPos;
        this.tokens[player][tokenIdx] = toPos;
        captured = this._checkCapture(player, toPos);
      } else if (move.destType === 'finish_enter') {
        const dest = this._calcDest(player, pos, this.diceResult);
        toPos = dest.pos;
        this.tokens[player][tokenIdx] = toPos;
      } else if (move.destType === 'finish_advance') {
        toPos = 100 + (pos - 100) + this.diceResult;
        this.tokens[player][tokenIdx] = toPos;
      } else if (move.destType === 'finish_complete') {
        toPos = 104;
        this.tokens[player][tokenIdx] = toPos;
        this.finished[player]++;
        finishedToken = true;
      }

      const won = this.finished[player] >= 4;
      if (won) { this.gameOver = true; this.winner = player; }
      const extraTurn = this.diceResult === 6 && !won;
      this.diceResult = null;
      this.phase = 'roll';
      if (!extraTurn && !won) this._nextTurn();

      return {
        valid: true, player, tokenIdx, fromPos, toPos, captured, finishedToken, extraTurn,
        gameOver: this.gameOver ? { over: true, winner: this.winner } : { over: false },
        state: this.getState()
      };
    }

    _nextTurn() {
      let next = (this.currentTurn + 1) % this.playerCount;
      let safety = 0;
      while (safety < this.playerCount) {
        if (this.finished[next] < 4) break;
        next = (next + 1) % this.playerCount;
        safety++;
      }
      this.currentTurn = next;
      this.phase = 'roll';
      this.diceResult = null;
    }

    _calcDest(player, trackPos, steps) {
      const entry = TROUBLE_ENTRY[player];
      const finishEntry = (entry + 28 - 1) % 28;
      let pos = trackPos;
      for (let s = 0; s < steps; s++) {
        if (pos === finishEntry) {
          const remaining = steps - s - 1;
          if (remaining < 4) return { type: 'finish', pos: 100 + remaining };
          if (remaining === 4) return { type: 'finish', pos: 104 };
          return null;
        }
        pos = (pos + 1) % 28;
      }
      return { type: 'track', pos };
    }

    _checkCapture(movingPlayer, trackPos) {
      for (let p = 0; p < this.playerCount; p++) {
        if (p === movingPlayer) continue;
        for (let ti = 0; ti < 4; ti++) {
          if (this.tokens[p][ti] === trackPos) {
            this.tokens[p][ti] = -1;
            return { player: p, tokenIdx: ti };
          }
        }
      }
      return null;
    }
  }

  /* ================================================
     TROUBLE — START FUNCTIONS
     ================================================ */
  function startLocalTrouble(playerCount) {
    troubleLocalGame = new LocalTroubleGame(playerCount);
    troubleIsLocal = true;
    troublePlayerIndex = -1;
    troubleValidMoves = [];
    troubleParticles = [];
    troubleDiceAnim = null;
    troubleSelectedToken = -1;

    const state = troubleLocalGame.getState();
    troubleState = {
      ...state,
      players: Array.from({ length: playerCount }, (_, i) => ({ username: TROUBLE_COLOR_NAMES[i] }))
    };

    // Hide chat in local mode
    const chatPanel = $('troubleChatPanel');
    if (chatPanel) chatPanel.classList.add('hidden');

    $('btnTroubleRoll').disabled = false;
    updateTroubleHUD();
    showScreen('trouble');
  }

  function showTroubleLocalPicker() {
    $('troubleLocalOverlay').classList.remove('hidden');
  }

  function hideTroubleLocalPicker() {
    $('troubleLocalOverlay').classList.add('hidden');
  }

  function bindTroubleEvents() {
    // Local player count picker
    document.querySelectorAll('.trouble-local-count').forEach(btn => {
      btn.addEventListener('click', () => {
        hideTroubleLocalPicker();
        startLocalTrouble(parseInt(btn.dataset.count, 10));
      });
    });

    $('btnTroubleLocalBack').addEventListener('click', hideTroubleLocalPicker);

    // In-game controls
    $('btnTroubleRoll').addEventListener('click', () => {
      if (!troubleState || troubleState.phase !== 'roll' || isPaused) return;
      const myTurn = troubleIsLocal ? true : (troubleState.currentTurn === troublePlayerIndex);
      if (!myTurn) return;
      troubleDoRoll();
    });

    $('btnTroubleResign').addEventListener('click', () => {
      if (troubleIsLocal) {
        troubleGameLoopActive = false;
        troubleState = null;
        troubleLocalGame = null;
        showScreen('lobby');
        return;
      }
      if (confirm('Resign and let a bot take over?')) {
        socket.emit('trouble:resign');
        // Stay on the screen — a bot will replace us, game continues
      }
    });

    // Trouble chat
    $('troubleChatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('troubleChatInput');
      const text = input.value.trim();
      if (text && socket) {
        socket.emit('chat:game', text);
        input.value = '';
      }
    });
  }

  /* ================================================
     SCRABBLE -- CONSTANTS & LAYOUT
     ================================================ */
  const SCRABBLE_CANVAS_PX = 640;
  const SCRABBLE_BOARD_SIZE = 15;
  const SCRABBLE_CELL = Math.floor(SCRABBLE_CANVAS_PX / SCRABBLE_BOARD_SIZE);

  const SCRABBLE_LETTER_VALUES = {
    A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,
    N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,'_':0
  };

  const SCRABBLE_TW = new Set([
    '0,0','0,7','0,14','7,0','7,14','14,0','14,7','14,14'
  ]);
  const SCRABBLE_DW = new Set([
    '1,1','1,13','2,2','2,12','3,3','3,11','4,4','4,10',
    '10,4','10,10','11,3','11,11','12,2','12,12','13,1','13,13','7,7'
  ]);
  const SCRABBLE_TL = new Set([
    '1,5','1,9','5,1','5,5','5,9','5,13',
    '9,1','9,5','9,9','9,13','13,5','13,9'
  ]);
  const SCRABBLE_DL = new Set([
    '0,3','0,11','2,6','2,8','3,0','3,7','3,14',
    '6,2','6,6','6,8','6,12','7,3','7,11',
    '8,2','8,6','8,8','8,12','11,0','11,7','11,14',
    '12,6','12,8','14,3','14,11'
  ]);

  const SCRABBLE_SQUARE_COLORS = {
    TW: '#c0392b', DW: '#e8a0b0', TL: '#2980b9', DL: '#85c1e9',
    CENTER: '#e8a0b0', NORMAL: '#1a6b3c'
  };

  const SCRABBLE_SQUARE_LABELS = {
    TW: 'TW', DW: 'DW', TL: 'TL', DL: 'DL'
  };

  const SCRABBLE_PLAYER_COLORS = [
    '#e74c3c','#3498db','#2ecc71','#f39c12',
    '#9b59b6','#1abc9c','#e67e22','#95a5a6'
  ];

  /* ================================================
     SCRABBLE -- STATE
     ================================================ */
  let scrabbleCanvas = null, scrabbleCtx = null;
  let scrabbleState = null;
  let scrabblePlayerIndex = -1;
  let scrabbleIsLocal = false;
  let scrabbleLocalGame = null;
  let scrabbleParticles = [];
  let scrabbleGameLoopActive = false;
  let scrabbleLastFrame = 0;

  let scrabbleSelectedRackTile = -1;
  let scrabblePlacedTiles = [];
  let scrabbleExchangeMode = false;
  let scrabbleExchangeSelection = [];
  let scrabbleDictionary = null;

  /* ================================================
     SCRABBLE -- CANVAS SETUP & GAME LOOP
     ================================================ */
  function setupScrabbleCanvas() {
    scrabbleCanvas = $('scrabbleCanvas');
    if (!scrabbleCanvas) return;
    scrabbleCtx = scrabbleCanvas.getContext('2d');
    scrabbleCanvas.width = SCRABBLE_CANVAS_PX;
    scrabbleCanvas.height = SCRABBLE_CANVAS_PX;
    scrabbleCanvas.addEventListener('click', handleScrabbleClick);
  }

  function startScrabbleGameLoop() {
    scrabbleGameLoopActive = true;
    scrabbleLastFrame = performance.now();
    requestAnimationFrame(scrabbleGameLoop);
  }

  function scrabbleGameLoop(ts) {
    if (!scrabbleGameLoopActive) return;
    const dt = (ts - scrabbleLastFrame) / 1000;
    scrabbleLastFrame = ts;
    renderScrabble(dt);
    requestAnimationFrame(scrabbleGameLoop);
  }

  /* ================================================
     SCRABBLE -- PARTICLE SYSTEM
     ================================================ */
  function emitScrabbleParticles(x, y, count, colors, life) {
    for (let i = 0; i < count; i++) {
      scrabbleParticles.push({
        x, y,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120 - 40,
        life: life || 1.5,
        maxLife: life || 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 4
      });
    }
  }

  function updateScrabbleParticles(dt) {
    for (let i = scrabbleParticles.length - 1; i >= 0; i--) {
      const p = scrabbleParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
      if (p.life <= 0) scrabbleParticles.splice(i, 1);
    }
  }

  function drawScrabbleParticles() {
    const c = scrabbleCtx;
    for (const p of scrabbleParticles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      c.globalAlpha = alpha;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ================================================
     SCRABBLE -- RENDERING
     ================================================ */
  function renderScrabble(dt) {
    if (!scrabbleCtx || !scrabbleState) return;
    const c = scrabbleCtx;
    c.clearRect(0, 0, SCRABBLE_CANVAS_PX, SCRABBLE_CANVAS_PX);
    drawScrabbleBoard(c);
    drawScrabbleBoardTiles(c);
    drawScrabblePlacedTiles(c);
    updateScrabbleParticles(dt);
    drawScrabbleParticles();
  }

  function drawScrabbleBoard(c) {
    const cell = SCRABBLE_CELL;
    for (let r = 0; r < SCRABBLE_BOARD_SIZE; r++) {
      for (let col = 0; col < SCRABBLE_BOARD_SIZE; col++) {
        const x = col * cell;
        const y = r * cell;
        const key = `${r},${col}`;

        let color = SCRABBLE_SQUARE_COLORS.NORMAL;
        let label = '';

        if (r === 7 && col === 7) {
          color = SCRABBLE_SQUARE_COLORS.CENTER;
          label = '\u2605';
        } else if (SCRABBLE_TW.has(key)) {
          color = SCRABBLE_SQUARE_COLORS.TW;
          label = 'TW';
        } else if (SCRABBLE_DW.has(key)) {
          color = SCRABBLE_SQUARE_COLORS.DW;
          label = 'DW';
        } else if (SCRABBLE_TL.has(key)) {
          color = SCRABBLE_SQUARE_COLORS.TL;
          label = 'TL';
        } else if (SCRABBLE_DL.has(key)) {
          color = SCRABBLE_SQUARE_COLORS.DL;
          label = 'DL';
        }

        c.fillStyle = color;
        c.fillRect(x, y, cell, cell);

        // Grid lines
        c.strokeStyle = '#0d3d1f';
        c.lineWidth = 1;
        c.strokeRect(x, y, cell, cell);

        // Label
        if (label && !scrabbleState.board[r][col]) {
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.font = label === '\u2605' ? 'bold 18px sans-serif' : 'bold 9px sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(label, x + cell / 2, y + cell / 2);
        }
      }
    }
  }

  function drawScrabbleBoardTiles(c) {
    const cell = SCRABBLE_CELL;
    const board = scrabbleState.board;
    for (let r = 0; r < SCRABBLE_BOARD_SIZE; r++) {
      for (let col = 0; col < SCRABBLE_BOARD_SIZE; col++) {
        const tile = board[r][col];
        if (!tile) continue;
        const x = col * cell + 2;
        const y = r * cell + 2;
        const w = cell - 4;
        const h = cell - 4;
        drawScrabbleTile(c, x, y, w, h, tile.letter, tile.value, false, tile.playedBy);
      }
    }
  }

  function drawScrabblePlacedTiles(c) {
    const cell = SCRABBLE_CELL;
    for (const p of scrabblePlacedTiles) {
      const x = p.col * cell + 2;
      const y = p.row * cell + 2;
      const w = cell - 4;
      const h = cell - 4;
      const letter = p.isBlank ? p.blankLetter : p.letter;
      const value = p.isBlank ? 0 : (SCRABBLE_LETTER_VALUES[p.letter] || 0);
      drawScrabbleTile(c, x, y, w, h, letter, value, true, scrabblePlayerIndex);
    }
  }

  function drawScrabbleTile(c, x, y, w, h, letter, value, highlight, playerIdx) {
    // Tile background
    c.fillStyle = highlight ? '#d4a843' : '#c8a96e';
    c.beginPath();
    const r = 4;
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.fill();

    // Border
    c.strokeStyle = highlight ? '#ffd700' : '#a0833f';
    c.lineWidth = highlight ? 2 : 1;
    c.stroke();

    // Letter
    c.fillStyle = '#2a1a00';
    c.font = 'bold 20px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(letter || '?', x + w / 2, y + h / 2);

    // Value subscript
    if (value > 0) {
      c.font = '9px sans-serif';
      c.textAlign = 'right';
      c.textBaseline = 'bottom';
      c.fillText(String(value), x + w - 2, y + h - 1);
    }
  }

  /* ================================================
     SCRABBLE -- HUD & RACK
     ================================================ */
  function updateScrabbleHUD() {
    if (!scrabbleState) return;
    const hud = $('scrabbleHud');
    if (!hud) return;
    const players = scrabbleState.players || [];
    let html = '';
    for (let i = 0; i < players.length; i++) {
      const isActive = i === scrabbleState.currentTurn;
      const isMe = i === scrabblePlayerIndex;
      const cls = `scrabble-hud-player${isActive ? ' active' : ''}${isMe ? ' me' : ''}`;
      const color = SCRABBLE_PLAYER_COLORS[i] || '#ccc';
      html += `<div class="${cls}" style="border-left: 3px solid ${color}">
        <span class="scrabble-hud-name">${escapeHtml(players[i].username || 'P' + (i + 1))}</span>
        <span class="scrabble-hud-score">${scrabbleState.scores[i] || 0}</span>
      </div>`;
    }
    html += `<div class="scrabble-hud-player"><span class="scrabble-hud-name">Bag</span><span class="scrabble-hud-score">${scrabbleState.bagCount}</span></div>`;
    hud.innerHTML = html;
  }

  function updateScrabbleRack() {
    if (!scrabbleState) return;
    const rackEl = $('scrabbleRack');
    if (!rackEl) return;
    rackEl.innerHTML = '';
    const rack = scrabbleState.rack || [];
    rack.forEach((tile, i) => {
      // Skip tiles that have been placed on the board this turn
      if (scrabblePlacedTiles.some(p => p.rackIndex === i)) return;
      const el = document.createElement('div');
      el.className = 'scrabble-rack-tile';
      if (scrabbleSelectedRackTile === i) el.classList.add('selected');
      if (scrabbleExchangeMode && scrabbleExchangeSelection.includes(i)) el.classList.add('selected');
      const displayLetter = tile.letter === '_' ? '?' : tile.letter;
      el.innerHTML = `${displayLetter}<span class="tile-value">${tile.value}</span>`;
      el.dataset.index = i;
      el.addEventListener('click', () => onRackTileClick(i));
      rackEl.appendChild(el);
    });

    // Update submit button state
    $('btnScrabbleSubmit').disabled = scrabblePlacedTiles.length === 0;

    // Update exchange button text
    if (scrabbleExchangeMode) {
      $('btnScrabbleExchange').textContent = scrabbleExchangeSelection.length > 0
        ? `Exchange (${scrabbleExchangeSelection.length})`
        : 'Cancel';
    } else {
      $('btnScrabbleExchange').textContent = 'Exchange';
    }
  }

  /* ================================================
     SCRABBLE -- INTERACTION
     ================================================ */
  function handleScrabbleClick(e) {
    if (!scrabbleState || isPaused) return;
    const isMyTurn = scrabbleIsLocal || scrabbleState.currentTurn === scrabblePlayerIndex;
    if (!isMyTurn) return;

    const rect = scrabbleCanvas.getBoundingClientRect();
    const scaleX = SCRABBLE_CANVAS_PX / rect.width;
    const scaleY = SCRABBLE_CANVAS_PX / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(mx / SCRABBLE_CELL);
    const row = Math.floor(my / SCRABBLE_CELL);
    if (row < 0 || row >= SCRABBLE_BOARD_SIZE || col < 0 || col >= SCRABBLE_BOARD_SIZE) return;

    // Check if clicking on a placed-this-turn tile to recall it
    const placedIdx = scrabblePlacedTiles.findIndex(p => p.row === row && p.col === col);
    if (placedIdx !== -1) {
      scrabblePlacedTiles.splice(placedIdx, 1);
      scrabbleSelectedRackTile = -1;
      updateScrabbleRack();
      return;
    }

    // If a rack tile is selected, place it on the board
    if (scrabbleSelectedRackTile >= 0) {
      // Can't place on occupied square
      if (scrabbleState.board[row][col] !== null) return;
      // Can't place on square already used this turn
      if (scrabblePlacedTiles.some(p => p.row === row && p.col === col)) return;

      const tile = scrabbleState.rack[scrabbleSelectedRackTile];
      if (tile.letter === '_') {
        showScrabbleBlankPicker(scrabbleSelectedRackTile, row, col);
      } else {
        scrabblePlacedTiles.push({
          row, col, letter: tile.letter,
          rackIndex: scrabbleSelectedRackTile, isBlank: false
        });
        scrabbleSelectedRackTile = -1;
        updateScrabbleRack();
      }
    }
  }

  function onRackTileClick(index) {
    if (scrabbleExchangeMode) {
      const idx = scrabbleExchangeSelection.indexOf(index);
      if (idx !== -1) scrabbleExchangeSelection.splice(idx, 1);
      else scrabbleExchangeSelection.push(index);
      updateScrabbleRack();
      return;
    }

    scrabbleSelectedRackTile = scrabbleSelectedRackTile === index ? -1 : index;
    updateScrabbleRack();
  }

  function showScrabbleBlankPicker(rackIndex, row, col) {
    const grid = $('scrabbleLetterGrid');
    if (!grid) return;
    grid.innerHTML = '';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'scrabble-letter-btn';
      btn.textContent = letter;
      btn.addEventListener('click', () => {
        scrabblePlacedTiles.push({
          row, col, letter: '_', rackIndex,
          isBlank: true, blankLetter: letter
        });
        $('scrabbleBlankOverlay').classList.add('hidden');
        scrabbleSelectedRackTile = -1;
        updateScrabbleRack();
      });
      grid.appendChild(btn);
    });
    $('scrabbleBlankOverlay').classList.remove('hidden');
  }

  function showScrabbleError(msg) {
    const el = $('scrabbleError');
    if (el) {
      el.textContent = msg;
      setTimeout(() => { el.textContent = ''; }, 3000);
    }
  }

  function showScrabbleLocalPicker() {
    $('scrabbleLocalOverlay').classList.remove('hidden');
  }

  /* ================================================
     SCRABBLE -- SOCKET EVENT HANDLERS
     ================================================ */
  function onScrabbleStart(data) {
    scrabblePlayerIndex = data.playerIndex;
    scrabbleIsLocal = false;
    scrabbleLocalGame = null;
    scrabblePlacedTiles = [];
    scrabbleSelectedRackTile = -1;
    scrabbleParticles = [];
    scrabbleExchangeMode = false;
    scrabbleExchangeSelection = [];

    scrabbleState = {
      gameId: data.gameId,
      playerCount: data.playerCount,
      currentTurn: data.currentTurn,
      board: data.board,
      scores: data.scores,
      rack: data.rack,
      bagCount: data.bagCount,
      phase: data.phase,
      players: data.players,
      firstMove: data.firstMove
    };
    currentMatchCode = data.matchCode || null;
    isPaused = false;

    const chatEl = $('scrabbleChatMessages');
    if (chatEl) chatEl.innerHTML = '';

    // Match code display
    const sCodeEl = $('scrabbleMatchCodeValue');
    if (sCodeEl) sCodeEl.textContent = currentMatchCode || '------';

    updateScrabbleHUD();
    updateScrabbleRack();
    showScreen('scrabble');
    $('gamePausedOverlay')?.classList.add('hidden');
    $('reconnectingOverlay')?.classList.add('hidden');
    playTone(523, 0.15, 'sine', 0.08);
  }

  function onScrabbleUpdate(data) {
    if (!scrabbleState) return;
    scrabbleState.board = data.board;
    scrabbleState.scores = data.scores;
    scrabbleState.currentTurn = data.currentTurn;
    scrabbleState.bagCount = data.bagCount;
    if (data.firstMove !== undefined) scrabbleState.firstMove = data.firstMove;
    if (data.newRack) scrabbleState.rack = data.newRack;

    // Clear placed tiles
    scrabblePlacedTiles = [];
    scrabbleSelectedRackTile = -1;
    scrabbleExchangeMode = false;
    scrabbleExchangeSelection = [];

    // Sound and particles
    if (data.action === 'place' && data.words) {
      sfxMove();
      if (data.totalScore >= 30) {
        for (const p of data.placements) {
          const x = p.col * SCRABBLE_CELL + SCRABBLE_CELL / 2;
          const y = p.row * SCRABBLE_CELL + SCRABBLE_CELL / 2;
          emitScrabbleParticles(x, y, 8, ['#ffd700', '#ffaa00', '#fff'], 2);
        }
      }
      if (data.totalScore >= 50) sfxKing();
    } else if (data.action === 'exchange') {
      playTone(300, 0.1, 'sine', 0.08);
    }

    updateScrabbleHUD();
    updateScrabbleRack();
  }

  function onScrabbleOver(data) {
    const isWin = scrabbleIsLocal ? true : (data.winner === scrabblePlayerIndex);
    const title = $('gameOverTitle');
    const reason = $('gameOverReason');
    const ratingDiv = $('gameOverRating');
    const coinDiv = $('gameOverCoins');

    if (scrabbleIsLocal) {
      const winnerName = scrabbleState?.players?.[data.winner]?.username || 'Player ' + (data.winner + 1);
      title.textContent = `${winnerName} Wins!`;
    } else {
      title.textContent = isWin ? 'You Win!' : 'Game Over';
    }

    const scores = data.scores || [];
    reason.textContent = 'Final scores: ' + scores.map((s, i) =>
      `${scrabbleState?.players?.[i]?.username || 'P' + (i + 1)}: ${s}`
    ).join(', ');

    ratingDiv.innerHTML = '';
    if (data.coinRewards) {
      const myReward = data.coinRewards[user?.username];
      coinDiv.textContent = myReward ? `+${myReward} coins` : '';
    } else {
      coinDiv.textContent = '';
    }

    $('gameOverOverlay').classList.remove('hidden');
    if (isWin && !scrabbleIsLocal) {
      sfxKing();
      startConfetti();
    } else {
      playTone(200, 0.3, 'sawtooth', 0.1);
    }

    scrabbleGameLoopActive = false;
  }

  /* ================================================
     SCRABBLE -- ACTION DISPATCH
     ================================================ */
  function scrabbleDoSubmit() {
    if (scrabblePlacedTiles.length === 0) return;

    const placements = scrabblePlacedTiles.map(p => ({
      row: p.row, col: p.col,
      letter: p.isBlank ? '_' : p.letter,
      isBlank: p.isBlank,
      blankLetter: p.blankLetter
    }));

    if (scrabbleIsLocal && scrabbleLocalGame) {
      const result = scrabbleLocalGame.placeTiles(scrabbleState.currentTurn, placements);
      if (!result.valid) {
        showScrabbleError(result.error);
        return;
      }
      const nextPlayer = result.currentTurn;
      scrabbleState.board = result.board;
      scrabbleState.scores = result.scores;
      scrabbleState.currentTurn = nextPlayer;
      scrabbleState.bagCount = result.bagCount;
      scrabbleState.firstMove = false;
      scrabbleState.rack = scrabbleLocalGame.racks[nextPlayer]?.map(t => ({ ...t })) || [];
      scrabblePlayerIndex = nextPlayer;
      scrabblePlacedTiles = [];
      scrabbleSelectedRackTile = -1;
      scrabbleExchangeMode = false;
      scrabbleExchangeSelection = [];

      if (result.totalScore >= 30) {
        for (const p of result.placements) {
          const x = p.col * SCRABBLE_CELL + SCRABBLE_CELL / 2;
          const y = p.row * SCRABBLE_CELL + SCRABBLE_CELL / 2;
          emitScrabbleParticles(x, y, 8, ['#ffd700', '#ffaa00', '#fff'], 2);
        }
      }
      sfxMove();

      updateScrabbleHUD();
      updateScrabbleRack();

      if (result.gameOver.over) {
        onScrabbleOver({ winner: result.gameOver.winner, scores: result.scores, coinRewards: {} });
      }
    } else {
      socket.emit('scrabble:place', { placements });
    }
  }

  function scrabbleDoExchange() {
    if (scrabbleExchangeSelection.length === 0) return;

    if (scrabbleIsLocal && scrabbleLocalGame) {
      const result = scrabbleLocalGame.exchangeTiles(scrabbleState.currentTurn, scrabbleExchangeSelection);
      if (!result.valid) {
        showScrabbleError(result.error);
        return;
      }
      const nextPlayer = result.currentTurn;
      scrabbleState.scores = result.scores;
      scrabbleState.board = result.board;
      scrabbleState.currentTurn = nextPlayer;
      scrabbleState.bagCount = result.bagCount;
      scrabbleState.rack = scrabbleLocalGame.racks[nextPlayer]?.map(t => ({ ...t })) || [];
      scrabblePlayerIndex = nextPlayer;
      scrabblePlacedTiles = [];
      scrabbleSelectedRackTile = -1;
      scrabbleExchangeMode = false;
      scrabbleExchangeSelection = [];
      playTone(300, 0.1, 'sine', 0.08);
      updateScrabbleHUD();
      updateScrabbleRack();
    } else {
      socket.emit('scrabble:exchange', { tileIndices: scrabbleExchangeSelection });
      scrabbleExchangeMode = false;
      scrabbleExchangeSelection = [];
      updateScrabbleRack();
    }
  }

  function scrabbleDoPass() {
    if (scrabbleIsLocal && scrabbleLocalGame) {
      const result = scrabbleLocalGame.passTurn(scrabbleState.currentTurn);
      if (!result.valid) return;
      const nextPlayer = result.currentTurn;
      scrabbleState.scores = result.scores;
      scrabbleState.board = result.board;
      scrabbleState.currentTurn = nextPlayer;
      scrabbleState.bagCount = result.bagCount;
      scrabbleState.rack = scrabbleLocalGame.racks[nextPlayer]?.map(t => ({ ...t })) || [];
      scrabblePlayerIndex = nextPlayer;
      scrabblePlacedTiles = [];
      scrabbleSelectedRackTile = -1;
      scrabbleExchangeMode = false;
      scrabbleExchangeSelection = [];
      updateScrabbleHUD();
      updateScrabbleRack();
      if (result.gameOver.over) {
        onScrabbleOver({ winner: result.gameOver.winner, scores: result.scores, coinRewards: {} });
      }
    } else {
      socket.emit('scrabble:pass');
    }
  }

  /* ================================================
     SCRABBLE -- LOCAL GAME ENGINE
     ================================================ */
  class LocalScrabbleGame {
    constructor(playerCount, dictionary) {
      this.playerCount = Math.max(2, Math.min(8, playerCount || 2));
      this.dictionary = dictionary;
      this.currentTurn = 0;
      this.gameOver = false;
      this.winner = null;
      this.firstMove = true;
      this.board = Array.from({ length: SCRABBLE_BOARD_SIZE }, () => Array(SCRABBLE_BOARD_SIZE).fill(null));

      const TILE_DIST = [
        ['A',1,9],['B',3,2],['C',3,2],['D',2,4],['E',1,12],
        ['F',4,2],['G',2,3],['H',4,2],['I',1,9],['J',8,1],
        ['K',5,1],['L',1,4],['M',3,2],['N',1,6],['O',1,8],
        ['P',3,2],['Q',10,1],['R',1,6],['S',1,4],['T',1,6],
        ['U',1,4],['V',4,2],['W',4,2],['X',8,1],['Y',4,2],
        ['Z',10,1],['_',0,2]
      ];

      this.bag = [];
      for (const [letter, value, count] of TILE_DIST) {
        for (let i = 0; i < count; i++) this.bag.push({ letter, value });
      }
      this._shuffleBag();

      this.racks = [];
      for (let p = 0; p < this.playerCount; p++) {
        this.racks.push([]);
        this._drawTiles(p, 7);
      }

      this.scores = new Array(this.playerCount).fill(0);
      this.consecutivePasses = 0;
    }

    _shuffleBag() {
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }

    _drawTiles(pi, count) {
      const draw = Math.min(count, this.bag.length);
      for (let i = 0; i < draw; i++) this.racks[pi].push(this.bag.pop());
    }

    _nextTurn() { this.currentTurn = (this.currentTurn + 1) % this.playerCount; }

    placeTiles(playerIndex, placements) {
      if (this.gameOver) return { valid: false, error: 'Game is over' };
      if (playerIndex !== this.currentTurn) return { valid: false, error: 'Not your turn' };
      if (!placements || placements.length === 0) return { valid: false, error: 'No tiles placed' };

      for (const p of placements) {
        if (p.row < 0 || p.row >= SCRABBLE_BOARD_SIZE || p.col < 0 || p.col >= SCRABBLE_BOARD_SIZE)
          return { valid: false, error: 'Out of bounds' };
        if (this.board[p.row][p.col] !== null)
          return { valid: false, error: 'Square occupied' };
      }

      const posSet = new Set(placements.map(p => `${p.row},${p.col}`));
      if (posSet.size !== placements.length) return { valid: false, error: 'Duplicate positions' };

      const rackCopy = this.racks[playerIndex].map(t => ({ ...t }));
      for (const p of placements) {
        const tc = p.isBlank ? '_' : p.letter;
        const idx = rackCopy.findIndex(t => t.letter === tc);
        if (idx === -1) return { valid: false, error: `Tile ${tc} not in rack` };
        rackCopy.splice(idx, 1);
      }

      const rows = [...new Set(placements.map(p => p.row))];
      const cols = [...new Set(placements.map(p => p.col))];
      if (rows.length > 1 && cols.length > 1) return { valid: false, error: 'Tiles must be in a single row or column' };
      const isH = rows.length === 1;

      if (placements.length > 1) {
        const sorted = [...placements].sort((a, b) => isH ? a.col - b.col : a.row - b.row);
        const fixed = isH ? sorted[0].row : sorted[0].col;
        const start = isH ? sorted[0].col : sorted[0].row;
        const end = isH ? sorted[sorted.length - 1].col : sorted[sorted.length - 1].row;
        for (let i = start; i <= end; i++) {
          const r = isH ? fixed : i;
          const c = isH ? i : fixed;
          if (!posSet.has(`${r},${c}`) && this.board[r][c] === null) return { valid: false, error: 'Tiles must form a continuous line' };
        }
      }

      if (this.firstMove) {
        if (!placements.some(p => p.row === 7 && p.col === 7)) return { valid: false, error: 'First word must cover center' };
        if (placements.length < 2) return { valid: false, error: 'First word must be at least 2 letters' };
      } else {
        let connects = false;
        for (const p of placements) {
          const nb = [[p.row-1,p.col],[p.row+1,p.col],[p.row,p.col-1],[p.row,p.col+1]];
          for (const [nr, nc] of nb) {
            if (nr >= 0 && nr < SCRABBLE_BOARD_SIZE && nc >= 0 && nc < SCRABBLE_BOARD_SIZE && this.board[nr][nc] !== null) {
              connects = true; break;
            }
          }
          if (connects) break;
        }
        if (!connects) return { valid: false, error: 'Must connect to existing tiles' };
      }

      const tb = this.board.map(r => r.map(c => c ? { ...c } : null));
      for (const p of placements) {
        const dl = p.isBlank ? (p.blankLetter || 'A') : p.letter;
        const v = p.isBlank ? 0 : (SCRABBLE_LETTER_VALUES[p.letter] || 0);
        tb[p.row][p.col] = { letter: dl, value: v, playedBy: playerIndex, isBlank: !!p.isBlank, justPlaced: true };
      }

      const getWord = (board, row, col, horiz) => {
        let r = row, c = col;
        if (horiz) { while (c > 0 && board[r][c-1]) c--; }
        else { while (r > 0 && board[r-1][c]) r--; }
        const tiles = []; let w = '';
        let cr = r, cc = c;
        while (cr < SCRABBLE_BOARD_SIZE && cc < SCRABBLE_BOARD_SIZE && board[cr][cc]) {
          const t = board[cr][cc];
          w += t.letter;
          tiles.push({ row: cr, col: cc, letter: t.letter, value: t.value, justPlaced: !!t.justPlaced });
          if (horiz) cc++; else cr++;
        }
        return w.length >= 2 ? { word: w, tiles } : null;
      };

      const words = [];
      const mw = getWord(tb, placements[0].row, placements[0].col, isH);
      if (mw) words.push(mw);
      for (const p of placements) {
        const cw = getWord(tb, p.row, p.col, !isH);
        if (cw) words.push(cw);
      }
      if (words.length === 0) return { valid: false, error: 'No valid word formed' };

      for (const w of words) {
        if (!this.dictionary.has(w.word.toUpperCase())) return { valid: false, error: `"${w.word}" is not a valid word` };
      }

      const scoreWord = (tiles) => {
        let ws = 0, wm = 1;
        for (const t of tiles) {
          let ls = t.value;
          const k = `${t.row},${t.col}`;
          if (t.justPlaced) {
            if (SCRABBLE_TL.has(k)) ls *= 3;
            else if (SCRABBLE_DL.has(k)) ls *= 2;
            if (SCRABBLE_TW.has(k)) wm *= 3;
            else if (SCRABBLE_DW.has(k)) wm *= 2;
          }
          ws += ls;
        }
        return ws * wm;
      };

      let totalScore = 0;
      const scoredWords = [];
      for (const w of words) {
        const s = scoreWord(w.tiles);
        totalScore += s;
        scoredWords.push({ word: w.word, score: s });
      }
      if (placements.length === 7) totalScore += 50;

      for (const p of placements) {
        const dl = p.isBlank ? (p.blankLetter || 'A') : p.letter;
        const v = p.isBlank ? 0 : (SCRABBLE_LETTER_VALUES[p.letter] || 0);
        this.board[p.row][p.col] = { letter: dl, value: v, playedBy: playerIndex, isBlank: !!p.isBlank };
      }

      for (const p of placements) {
        const tc = p.isBlank ? '_' : p.letter;
        const idx = this.racks[playerIndex].findIndex(t => t.letter === tc);
        if (idx !== -1) this.racks[playerIndex].splice(idx, 1);
      }
      this._drawTiles(playerIndex, 7 - this.racks[playerIndex].length);
      this.scores[playerIndex] += totalScore;
      this.consecutivePasses = 0;
      this.firstMove = false;

      let ended = false;
      if (this.racks[playerIndex].length === 0 && this.bag.length === 0) {
        this.gameOver = true;
        let bonus = 0;
        for (let p = 0; p < this.playerCount; p++) {
          if (p === playerIndex) continue;
          let pen = 0;
          for (const t of this.racks[p]) pen += t.value;
          this.scores[p] -= pen;
          bonus += pen;
        }
        this.scores[playerIndex] += bonus;
        let maxS = -Infinity; this.winner = 0;
        for (let p = 0; p < this.playerCount; p++) {
          if (this.scores[p] > maxS) { maxS = this.scores[p]; this.winner = p; }
        }
        ended = true;
      }
      if (!ended) this._nextTurn();

      return {
        valid: true, player: playerIndex, placements, words: scoredWords, totalScore,
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
      if (this.bag.length < 7) return { valid: false, error: 'Not enough tiles in bag' };
      if (!tileIndices || tileIndices.length === 0) return { valid: false, error: 'No tiles selected' };

      const removed = [];
      const sorted = [...tileIndices].sort((a, b) => b - a);
      for (const idx of sorted) {
        if (idx < 0 || idx >= this.racks[playerIndex].length) return { valid: false, error: 'Invalid index' };
        removed.push(this.racks[playerIndex].splice(idx, 1)[0]);
      }
      this._drawTiles(playerIndex, removed.length);
      for (const t of removed) this.bag.push(t);
      this._shuffleBag();
      this.consecutivePasses = 0;
      this._nextTurn();

      return {
        valid: true, player: playerIndex, action: 'exchange',
        tilesExchanged: removed.length,
        newRack: this.racks[playerIndex].map(t => ({ ...t })),
        bagCount: this.bag.length, currentTurn: this.currentTurn,
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
        this.gameOver = true;
        for (let p = 0; p < this.playerCount; p++) {
          let pen = 0;
          for (const t of this.racks[p]) pen += t.value;
          this.scores[p] -= pen;
        }
        let maxS = -Infinity; this.winner = 0;
        for (let p = 0; p < this.playerCount; p++) {
          if (this.scores[p] > maxS) { maxS = this.scores[p]; this.winner = p; }
        }
        return {
          valid: true, player: playerIndex, action: 'pass',
          gameOver: { over: true, winner: this.winner },
          scores: [...this.scores],
          board: this.board.map(r => r.map(c => c ? { ...c } : null)),
          bagCount: this.bag.length, currentTurn: this.currentTurn
        };
      }
      this._nextTurn();
      return {
        valid: true, player: playerIndex, action: 'pass',
        currentTurn: this.currentTurn, consecutivePasses: this.consecutivePasses,
        scores: [...this.scores],
        board: this.board.map(r => r.map(c => c ? { ...c } : null)),
        bagCount: this.bag.length, gameOver: { over: false }
      };
    }
  }

  /* ================================================
     SCRABBLE -- START & EVENTS
     ================================================ */
  function startLocalScrabble(playerCount) {
    if (!scrabbleDictionary) {
      fetch('/api/scrabble-dictionary')
        .then(r => r.json())
        .then(data => {
          scrabbleDictionary = new Set(data.words);
          _initLocalScrabble(playerCount);
        })
        .catch(() => { showScrabbleError('Failed to load dictionary'); });
      return;
    }
    _initLocalScrabble(playerCount);
  }

  function _initLocalScrabble(playerCount) {
    scrabbleLocalGame = new LocalScrabbleGame(playerCount, scrabbleDictionary);
    scrabbleIsLocal = true;
    scrabblePlayerIndex = 0;
    scrabblePlacedTiles = [];
    scrabbleSelectedRackTile = -1;
    scrabbleExchangeMode = false;
    scrabbleExchangeSelection = [];
    scrabbleParticles = [];

    const players = [];
    for (let i = 0; i < playerCount; i++) {
      players.push({ username: 'Player ' + (i + 1), rating: 1200 });
    }

    scrabbleState = {
      gameId: 'local',
      playerCount: playerCount,
      currentTurn: 0,
      board: scrabbleLocalGame.board.map(r => r.map(c => c ? { ...c } : null)),
      scores: [...scrabbleLocalGame.scores],
      rack: scrabbleLocalGame.racks[0].map(t => ({ ...t })),
      bagCount: scrabbleLocalGame.bag.length,
      phase: 'place',
      players: players,
      firstMove: true
    };

    updateScrabbleHUD();
    updateScrabbleRack();
    showScreen('scrabble');
    playTone(523, 0.15, 'sine', 0.08);
  }

  function bindScrabbleEvents() {
    // Local player count picker
    document.querySelectorAll('.scrabble-local-count').forEach(btn => {
      btn.addEventListener('click', () => {
        $('scrabbleLocalOverlay').classList.add('hidden');
        startLocalScrabble(parseInt(btn.dataset.count, 10));
      });
    });
    $('btnScrabbleLocalBack').addEventListener('click', () => {
      $('scrabbleLocalOverlay').classList.add('hidden');
    });

    // Submit word
    $('btnScrabbleSubmit').addEventListener('click', scrabbleDoSubmit);

    // Recall all tiles
    $('btnScrabbleRecall').addEventListener('click', () => {
      scrabblePlacedTiles = [];
      scrabbleSelectedRackTile = -1;
      updateScrabbleRack();
    });

    // Exchange toggle
    $('btnScrabbleExchange').addEventListener('click', () => {
      if (scrabbleExchangeMode && scrabbleExchangeSelection.length > 0) {
        scrabbleDoExchange();
        return;
      }
      scrabbleExchangeMode = !scrabbleExchangeMode;
      scrabbleExchangeSelection = [];
      scrabblePlacedTiles = [];
      scrabbleSelectedRackTile = -1;
      updateScrabbleRack();
    });

    // Pass
    $('btnScrabblePass').addEventListener('click', () => {
      if (confirm('Pass your turn?')) scrabbleDoPass();
    });

    // Resign
    $('btnScrabbleResign').addEventListener('click', () => {
      if (scrabbleIsLocal) {
        scrabbleGameLoopActive = false;
        scrabbleState = null;
        scrabbleLocalGame = null;
        showScreen('lobby');
        return;
      }
      if (confirm('Leave this Scrabble game?')) {
        socket.emit('scrabble:resign');
        showScreen('lobby');
      }
    });

    // Blank cancel
    $('btnScrabbleBlankCancel').addEventListener('click', () => {
      $('scrabbleBlankOverlay').classList.add('hidden');
    });

    // Chat
    $('scrabbleChatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('scrabbleChatInput');
      const text = input.value.trim();
      if (text && socket) { socket.emit('chat:game', text); input.value = ''; }
    });

    // Match code copy buttons
    const copyHandler = (btnId) => {
      const btn = $(btnId);
      if (btn) btn.addEventListener('click', () => {
        if (currentMatchCode) navigator.clipboard?.writeText(currentMatchCode);
      });
    };
    copyHandler('btnCopyMatchCode');
    copyHandler('btnCopyTroubleCode');
    copyHandler('btnCopyScrabbleCode');

    // Manual rejoin from lobby
    $('btnRejoinCode')?.addEventListener('click', () => {
      const code = $('rejoinCodeInput')?.value?.trim();
      if (code && socket) {
        $('rejoinError').textContent = '';
        socket.emit('game:rejoin', code);
      }
    });
  }

  /* ================================================
     EVENT BINDING
     ================================================ */
  function bindEvents() {
    // Title
    $('btnStart').addEventListener('click', async () => {
      // Try session first
      const hasSession = await checkSession();
      if (!hasSession) showScreen('auth');
    });

    // Auth tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        $('loginForm').classList.toggle('hidden', tab !== 'login');
        $('signupForm').classList.toggle('hidden', tab !== 'signup');
        $('loginError').textContent = '';
        $('signupError').textContent = '';
      });
    });

    // Login form
    $('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      doLogin($('loginUser').value.trim(), $('loginPass').value);
    });

    // Signup form
    $('signupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      doSignup($('signupUser').value.trim(), $('signupPass').value);
    });

    // Logout
    $('btnLogout').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      user = null;
      if (socket) socket.disconnect();
      socket = null;
      showScreen('title');
    });

    // Game card selection (Netflix-style)
    $('cardCheckers').addEventListener('click', () => selectGame('checkers'));
    $('cardTrouble').addEventListener('click', () => selectGame('trouble'));
    $('cardScrabble').addEventListener('click', () => selectGame('scrabble'));
    $('btnGameDetailBack').addEventListener('click', deselectGame);

    // Queue cancel
    $('btnCancelQueue').addEventListener('click', () => {
      socket.emit('queue:leave');
      showScreen('lobby');
    });

    // Lobby host cancel
    $('btnCancelLobby').addEventListener('click', () => {
      socket.emit('lobby:leave');
      showScreen('lobby');
    });

    // Copy invite code
    $('inviteCode').addEventListener('click', () => {
      const code = $('inviteCode').textContent;
      navigator.clipboard?.writeText(code);
      $('copyHint').textContent = 'Copied!';
      $('copyHint').classList.add('copied');
    });

    // Join lobby
    $('btnJoinCode').addEventListener('click', () => {
      const code = $('joinCodeInput').value.trim();
      if (code) {
        $('joinError').textContent = '';
        socket.emit('lobby:join', code);
      }
    });

    $('joinCodeInput').addEventListener('input', () => {
      $('joinCodeInput').value = $('joinCodeInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    $('joinCodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btnJoinCode').click();
    });

    $('btnJoinBack').addEventListener('click', () => {
      showScreen('lobby');
    });

    // Resign
    $('btnResign').addEventListener('click', () => {
      if (gameMode === 'local') {
        // In local mode, resign means go back
        showScreen('lobby');
        return;
      }
      if (confirm('Are you sure you want to resign?')) {
        socket.emit('game:resign');
      }
    });

    // Game over buttons
    $('btnPlayAgain').addEventListener('click', () => {
      $('gameOverOverlay').classList.add('hidden');
      confettiActive = false;
      showScreen('lobby');
    });

    $('btnBackToLobby').addEventListener('click', () => {
      $('gameOverOverlay').classList.add('hidden');
      confettiActive = false;
      showScreen('lobby');
    });

    // Lobby chat
    $('lobbyChatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('lobbyChatInput');
      const text = input.value.trim();
      if (text && socket) {
        socket.emit('chat:lobby', text);
        input.value = '';
      }
    });

    // Game chat
    $('gameChatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('gameChatInput');
      const text = input.value.trim();
      if (text && socket) {
        socket.emit('chat:game', text);
        input.value = '';
      }
    });

    // Canvas click
    document.addEventListener('DOMContentLoaded', () => {
      // Defer canvas event binding until game screen is active
    });

    // Shop
    bindShopEvents();

    // Trouble
    bindTroubleEvents();

    // Scrabble
    bindScrabbleEvents();
  }

  /* ================================================
     INITIALIZATION
     ================================================ */
  function init() {
    bindEvents();
    initTitleBackground();
    showScreen('title');

    // Bind canvas click (use event delegation on #gameCanvas)
    // Need to re-bind after canvas is set up
    const canvasEl = $('gameCanvas');
    if (canvasEl) canvasEl.addEventListener('click', handleCanvasClick);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
