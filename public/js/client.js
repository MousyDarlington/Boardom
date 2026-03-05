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
        { id: 'troublePrivate', icon: '\uD83D\uDD12', name: 'Private', desc: 'Create or join lobby' },
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
    },
    cah: {
      title: 'Cards Against Humanity',
      icon: '\uD83C\uDCCF',
      desc: '3-8 players \u2014 The party game for horrible people!',
      modes: [
        { id: 'cahOnline',  icon: '\uD83C\uDF10', name: 'Play Online',  desc: 'Match with players' },
        { id: 'cahBots',    icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'Instant bot game' },
        { id: 'cahPrivate', icon: '\uD83D\uDD12', name: 'Private',      desc: 'Create or join lobby' }
      ]
    },
    c4: {
      title: 'Connect Four',
      icon: '\uD83D\uDD34',
      desc: '2 players \u2014 Drop discs and connect 4 in a row!',
      modes: [
        { id: 'c4Online', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'c4Bots',   icon: '\uD83E\uDD16', name: 'Play vs Bot', desc: 'Challenge the AI' },
        { id: 'c4Local',  icon: '\uD83C\uDFAE', name: 'Local 2P', desc: 'Same screen hotseat' }
      ]
    },
    battleship: {
      title: 'Battleship',
      icon: '\u2693',
      desc: '2 players \u2014 Sink the enemy fleet!',
      modes: [
        { id: 'bsOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'bsBots',   icon: '\uD83E\uDD16', name: 'Play vs Bot', desc: 'Challenge the AI' },
        { id: 'bsLocal',  icon: '\uD83C\uDFAE', name: 'Local 2P', desc: 'Same screen hotseat' }
      ]
    },
    mancala: {
      title: 'Mancala',
      icon: '\uD83C\uDF31',
      desc: '2 players \u2014 Ancient stone strategy game!',
      modes: [
        { id: 'mancalaOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'mancalaBots',   icon: '\uD83E\uDD16', name: 'Play vs Bot', desc: 'Challenge the AI' },
        { id: 'mancalaLocal',  icon: '\uD83C\uDFAE', name: 'Local 2P', desc: 'Same screen hotseat' }
      ]
    },
    mahjong: {
      title: 'Mahjong',
      icon: '\uD83C\uDC04',
      desc: 'Single player \u2014 Match pairs of free tiles to clear the board!',
      modes: [
        { id: 'mahjongPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    solitaire: {
      title: 'Solitaire',
      icon: '\uD83C\uDCCF',
      desc: 'Single player \u2014 Classic Klondike card game!',
      modes: [
        { id: 'solitairePlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    pinball: {
      title: 'Pinball',
      icon: '\uD83C\uDFB3',
      desc: 'Single player \u2014 Classic arcade pinball!',
      modes: [
        { id: 'pinballPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    jezzball: {
      title: 'JezzBall',
      icon: '\uD83C\uDFC6',
      desc: 'Single player \u2014 Trap the bouncing balls!',
      modes: [
        { id: 'jezzballPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    minesweeper: {
      title: 'Minesweeper',
      icon: '\uD83D\uDCA3',
      desc: 'Single player \u2014 Find all the mines!',
      modes: [
        { id: 'msEasy', icon: '\uD83D\uDE0A', name: 'Easy', desc: '9\u00d79, 10 mines' },
        { id: 'msMedium', icon: '\uD83D\uDE10', name: 'Medium', desc: '16\u00d716, 40 mines' },
        { id: 'msHard', icon: '\uD83D\uDE08', name: 'Hard', desc: '30\u00d716, 99 mines' }
      ]
    },
    spaceinvaders: {
      title: 'Space Invaders',
      icon: '\uD83D\uDC7E',
      desc: 'Single player \u2014 Defend Earth from aliens!',
      modes: [
        { id: 'siPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    tetris: {
      title: 'Tetris',
      icon: '\uD83E\uDDF1',
      desc: 'Single player \u2014 Stack and clear lines!',
      modes: [
        { id: 'tetrisPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    columns: {
      title: 'Columns',
      icon: '\uD83D\uDC8E',
      desc: 'Single player \u2014 Match 3 gems in a row!',
      modes: [
        { id: 'columnsPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    lightsout: {
      title: 'Lights Out',
      icon: '\uD83D\uDCA1',
      desc: 'Single player \u2014 Turn all the lights off!',
      modes: [
        { id: 'loEasy', icon: '\uD83D\uDE0A', name: 'Easy', desc: '5\u00d75 grid' },
        { id: 'loMedium', icon: '\uD83D\uDE10', name: 'Medium', desc: '7\u00d77 grid' },
        { id: 'loHard', icon: '\uD83D\uDE08', name: 'Hard', desc: '9\u00d79 grid' }
      ]
    },
    helicopter: {
      title: 'Helicopter',
      icon: '\uD83D\uDE81',
      desc: 'Single player \u2014 Fly through the cave!',
      modes: [
        { id: 'hcPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    dopewars: {
      title: 'Dope Wars',
      icon: '\uD83D\uDCB0',
      desc: 'Single player \u2014 Buy low, sell high!',
      modes: [
        { id: 'dwPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    missilecommand: {
      title: 'Missile Command',
      icon: '\uD83D\uDE80',
      desc: 'Single player \u2014 Defend your cities!',
      modes: [
        { id: 'mcPlay', icon: '\uD83C\uDFAE', name: 'Play', desc: 'Start a new game' }
      ]
    },
    blackjack: {
      title: 'Blackjack',
      icon: '\uD83C\uDCCF',
      desc: '1-6 players \u2014 Beat the dealer to 21!',
      modes: [
        { id: 'bjOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'bjBots', icon: '\uD83E\uDD16', name: 'Play vs Bot', desc: 'Challenge the AI dealer' },
        { id: 'bjLocal', icon: '\uD83C\uDFAE', name: 'Local', desc: 'Same screen hotseat' }
      ]
    },
    poker: {
      title: 'Poker',
      icon: '\uD83C\uDCCF',
      desc: '2-8 players \u2014 Texas Hold\'em!',
      modes: [
        { id: 'pkOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'pkBots', icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'AI opponents' },
        { id: 'pkLocal', icon: '\uD83C\uDFAE', name: 'Local', desc: 'Same screen hotseat' }
      ]
    },
    hearts: {
      title: 'Hearts',
      icon: '\u2665',
      desc: '4 players \u2014 Avoid the Queen of Spades!',
      modes: [
        { id: 'htOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'htBots', icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'AI opponents' },
        { id: 'htLocal', icon: '\uD83C\uDFAE', name: 'Local (4P)', desc: 'Pass and play' }
      ]
    },
    spades: {
      title: 'Spades',
      icon: '\u2660',
      desc: '4 players \u2014 Bid and trick-take with partners!',
      modes: [
        { id: 'spOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'spBots', icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'AI opponents' },
        { id: 'spLocal', icon: '\uD83C\uDFAE', name: 'Local (4P)', desc: 'Pass and play' }
      ]
    },
    ginrummy: {
      title: 'Gin Rummy',
      icon: '\uD83C\uDCCF',
      desc: '2 players \u2014 Meld cards and knock!',
      modes: [
        { id: 'grOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'grBots', icon: '\uD83E\uDD16', name: 'Play vs Bot', desc: 'Challenge the AI' },
        { id: 'grLocal', icon: '\uD83C\uDFAE', name: 'Local 2P', desc: 'Same screen hotseat' }
      ]
    },
    war: {
      title: 'War',
      icon: '\u2694',
      desc: '2 players \u2014 Flip and fight for all 52 cards!',
      modes: [
        { id: 'warOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'warBots', icon: '\uD83E\uDD16', name: 'Play vs Bot', desc: 'Challenge the AI' },
        { id: 'warLocal', icon: '\uD83C\uDFAE', name: 'Local 2P', desc: 'Same screen hotseat' }
      ]
    },
    crazy8: {
      title: 'Crazy Eights',
      icon: '8\u2660',
      desc: '2-6 players \u2014 Match suit or rank, eights are wild!',
      modes: [
        { id: 'c8Online', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'c8Bots', icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'AI opponents' },
        { id: 'c8Local', icon: '\uD83C\uDFAE', name: 'Local', desc: 'Same screen hotseat' }
      ]
    },
    gofish: {
      title: 'Go Fish',
      icon: '\uD83D\uDC1F',
      desc: '2-4 players \u2014 Collect sets of four!',
      modes: [
        { id: 'gfOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'gfBots', icon: '\uD83E\uDD16', name: 'Play vs Bots', desc: 'AI opponents' },
        { id: 'gfLocal', icon: '\uD83C\uDFAE', name: 'Local', desc: 'Same screen hotseat' }
      ]
    },
    higherlower: {
      title: 'Higher or Lower',
      icon: '\u2195',
      desc: '1-4 players \u2014 Guess if the next card is higher or lower!',
      modes: [
        { id: 'hlPlay', icon: '\uD83C\uDFAE', name: 'Solo', desc: 'Single player challenge' },
        { id: 'hlBots', icon: '\uD83E\uDD16', name: 'vs Bot', desc: 'Compete against AI' }
      ]
    },
    pool: {
      title: '8-Ball Pool',
      icon: '\uD83C\uDFB1',
      desc: '2 players \u2014 Pocket all your balls and sink the 8!',
      modes: [
        { id: 'poolOnline', icon: '\uD83C\uDF10', name: 'Play Online', desc: 'Match with players' },
        { id: 'poolBots', icon: '\uD83E\uDD16', name: 'Play vs Bot', desc: 'Challenge the AI' },
        { id: 'poolLocal', icon: '\uD83C\uDFAE', name: 'Local 2P', desc: 'Same screen hotseat' }
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

  // Trouble private lobby
  let troubleLobbyCode = null;
  let troubleLobbyPlayers = [];
  let isTroubleLobbyHost = false;
  let pendingJoinCode = null; // from ?join=CODE

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
    'lobbyHostScreen', 'lobbyJoinScreen', 'troubleHostScreen', 'guestJoinScreen',
    'shopScreen', 'gameScreen', 'troubleGameScreen', 'scrabbleGameScreen',
    'cahHostScreen', 'cahGameScreen', 'c4GameScreen', 'bsGameScreen', 'mancalaGameScreen',
    'mahjongGameScreen', 'solitaireGameScreen', 'pinballGameScreen', 'jezzballGameScreen',
    'minesweeperGameScreen', 'spaceinvadersGameScreen', 'tetrisGameScreen', 'columnsGameScreen',
    'lightsoutGameScreen', 'helicopterGameScreen', 'dopewarsGameScreen', 'missilecommandGameScreen',
    'cardGameScreen', 'poolGameScreen'];

  function showScreen(name) {
    currentScreen = name;
    const map = {
      title: 'titleScreen', auth: 'authScreen', lobby: 'lobbyScreen',
      queue: 'queueScreen', host: 'lobbyHostScreen', join: 'lobbyJoinScreen',
      troubleHost: 'troubleHostScreen', guestJoin: 'guestJoinScreen',
      shop: 'shopScreen', game: 'gameScreen', trouble: 'troubleGameScreen',
      scrabble: 'scrabbleGameScreen', cahHost: 'cahHostScreen', cah: 'cahGameScreen',
      c4: 'c4GameScreen', battleship: 'bsGameScreen', mancala: 'mancalaGameScreen',
      mahjong: 'mahjongGameScreen', solitaire: 'solitaireGameScreen',
      pinball: 'pinballGameScreen', jezzball: 'jezzballGameScreen',
      minesweeper: 'minesweeperGameScreen', spaceinvaders: 'spaceinvadersGameScreen',
      tetris: 'tetrisGameScreen', columns: 'columnsGameScreen',
      lightsout: 'lightsoutGameScreen', helicopter: 'helicopterGameScreen',
      dopewars: 'dopewarsGameScreen', missilecommand: 'missilecommandGameScreen',
      cardgame: 'cardGameScreen', pool: 'poolGameScreen'
    };
    for (const id of screenIds) {
      const el = $(id);
      if (el) el.classList.remove('active');
    }
    const target = $(map[name]);
    if (target) target.classList.add('active');

    // Hide game over overlay when switching screens
    if (name !== 'game' && name !== 'trouble' && name !== 'scrabble' && name !== 'cah' && name !== 'c4' && name !== 'battleship' && name !== 'mancala' && name !== 'mahjong' && name !== 'solitaire' && name !== 'pinball' && name !== 'jezzball' && name !== 'minesweeper' && name !== 'spaceinvaders' && name !== 'tetris' && name !== 'columns' && name !== 'lightsout' && name !== 'helicopter' && name !== 'dopewars' && name !== 'missilecommand' && name !== 'cardgame' && name !== 'pool') {
      $('gameOverOverlay').classList.add('hidden');
      confettiActive = false;
    }

    // Stop game loops when leaving their screens
    if (name !== 'trouble') troubleGameLoopActive = false;
    if (name !== 'scrabble') scrabbleGameLoopActive = false;
    if (name !== 'c4') c4GameLoopActive = false;
    if (name !== 'battleship') bsGameLoopActive = false;
    if (name !== 'mancala') mnGameLoopActive = false;
    if (name !== 'mahjong') mjGameLoopActive = false;
    if (name !== 'pinball') { pbGameLoopActive = false; document.removeEventListener('keydown', pbKeyDown); document.removeEventListener('keyup', pbKeyUp); }
    if (name !== 'jezzball') jbGameLoopActive = false;
    if (name !== 'minesweeper') { msGameLoopActive = false; if (typeof msTimer !== 'undefined' && msTimer) { clearInterval(msTimer); msTimer = null; } }
    if (name !== 'spaceinvaders') { siGameLoopActive = false; document.removeEventListener('keydown', siKeyDown); document.removeEventListener('keyup', siKeyUp); }
    if (name !== 'tetris') { tetGameLoopActive = false; document.removeEventListener('keydown', tetKeyDown); }
    if (name !== 'columns') { colGameLoopActive = false; document.removeEventListener('keydown', colKeyDown); }
    if (name !== 'lightsout') loGameLoopActive = false;
    if (name !== 'helicopter') { hcGameLoopActive = false; document.removeEventListener('keydown', hcKeyDown); document.removeEventListener('keyup', hcKeyUp); }
    if (name !== 'dopewars') dwGameLoopActive = false;
    if (name !== 'missilecommand') mcGameLoopActive = false;
    if (name !== 'pool') poolGameLoopActive = false;

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

    if (name === 'c4') {
      setupC4Canvas();
      startC4GameLoop();
    }
    if (name === 'battleship') {
      setupBSCanvases();
      startBSGameLoop();
    }
    if (name === 'mancala') {
      setupMancalaCanvas();
      startMancalaGameLoop();
    }
    if (name === 'mahjong') {
      setupMahjongCanvas();
      startMahjongGameLoop();
    }
    if (name === 'pinball') {
      setupPinballCanvas();
      startPinballGameLoop();
    }
    if (name === 'jezzball') {
      setupJezzballCanvas();
      startJezzballGameLoop();
    }
    if (name === 'minesweeper') {
      setupMinesweeperCanvas();
      startMinesweeperGameLoop();
    }
    if (name === 'spaceinvaders') {
      setupSICanvas();
      startSIGameLoop();
    }
    if (name === 'tetris') {
      setupTetrisCanvas();
      startTetrisGameLoop();
    }
    if (name === 'columns') {
      setupColumnsCanvas();
      startColumnsGameLoop();
    }
    if (name === 'lightsout') {
      setupLightsOutCanvas();
      startLightsOutGameLoop();
    }
    if (name === 'helicopter') {
      setupHelicopterCanvas();
      startHelicopterGameLoop();
    }
    if (name === 'dopewars') {
      setupDopeWarsCanvas();
      startDopeWarsGameLoop();
    }
    if (name === 'missilecommand') {
      setupMissileCommandCanvas();
      startMissileCommandGameLoop();
    }
    if (name === 'pool') {
      setupPoolCanvas();
      startPoolGameLoop();
    }

    // Hide overlays when leaving lobby
    if (name !== 'lobby') {
      $('troubleLocalOverlay')?.classList.add('hidden');
      $('scrabbleLocalOverlay')?.classList.add('hidden');
    }

    // Reset game selector when returning to lobby
    if (name === 'lobby') {
      deselectGame();
      switchChatChannel('lobby');
    }

    if (name === 'lobby' && user) {
      $('lobbyCoins').textContent = user.coins || 0;
      $('lobbyGems').textContent = user.gems || 0;
    }

    // Chat FAB visibility — show on game/lobby screens, hide elsewhere
    if (!CHAT_SCREENS.has(name)) {
      hideChatFab();
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
    if (pendingJoinCode) {
      const code = pendingJoinCode;
      pendingJoinCode = null;
      showScreen('lobby');
      // Wait for socket connect, then resolve the code
      const tryJoin = () => {
        if (socket && socket.connected) {
          processUrlJoin(code);
        } else if (socket) {
          socket.once('connect', () => processUrlJoin(code));
        }
      };
      tryJoin();
    } else {
      showScreen('lobby');
    }
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
  function bindSocketEvents(s) {
    s.on('connect', () => {
      console.log('Socket connected');
    });

    s.on('auth:required', () => {
      // Guests don't need auth — only redirect if not a guest
      if (!s.guestMode) showScreen('auth');
    });

    // Stats
    s.on('server:stats', (data) => {
      $('statOnline').textContent = data.online;
      $('statGames').textContent = data.games;
    });

    // Queue
    s.on('queue:update', (data) => {
      if (data.status === 'bot_matching') {
        $('queueTitle').textContent = 'Opponent Found';
        $('queueText').textContent = 'No players available \u2014 matching with AI...';
      } else {
        $('queueTitle').textContent = data.type === 'ranked' ? 'Ranked Match' : 'Casual Match';
        $('queueText').textContent = `Searching for a ${data.type} match...`;
      }
    });

    s.on('queue:left', () => {
      showScreen('lobby');
    });

    // Lobby
    s.on('lobby:created', (data) => {
      $('inviteCode').textContent = data.code;
      $('copyHint').textContent = 'Click to copy';
      $('copyHint').classList.remove('copied');
      showScreen('host');
    });

    s.on('lobby:error', (data) => {
      if (currentScreen === 'join') {
        $('joinError').textContent = data.message;
      } else {
        alert(data.message);
      }
    });

    // Game start
    s.on('game:start', (data) => {
      onGameStart(data);
    });

    // Valid moves response
    s.on('game:validMoves', (data) => {
      if (data.moves.length === 0) {
        selectedPiece = null;
        validMoves = [];
      } else {
        selectedPiece = { row: data.row, col: data.col };
        validMoves = data.moves;
      }
    });

    // Game update
    s.on('game:update', (data) => {
      onGameUpdate(data);
    });

    // Game over
    s.on('game:over', (data) => {
      onGameOver(data);
    });

    s.on('game:error', (data) => {
      console.warn('Game error:', data.message);
    });

    // Chat — all routed to global popout modal
    s.on('chat:lobbyHistory', (messages) => {
      // Store for when user opens lobby chat
      const el = $('chatModalMessages');
      if (el && chatChannel === 'lobby') {
        el.innerHTML = '';
        messages.forEach(m => appendChatMsg(el, m));
        el.scrollTop = el.scrollHeight;
      }
    });

    s.on('chat:lobby', (msg) => {
      if (chatChannel === 'lobby') {
        appendToChat(msg);
      } else {
        incrementChatBadge();
      }
    });

    s.on('chat:game', (msg) => {
      if (chatChannel === 'game') {
        appendToChat(msg);
      } else {
        incrementChatBadge();
      }
    });

    // Trouble events
    s.on('trouble:start', onTroubleStart);
    s.on('trouble:rollResult', onTroubleRollResult);
    s.on('trouble:update', onTroubleUpdate);
    s.on('trouble:over', onTroubleOver);
    s.on('trouble:playerReplaced', (data) => {
      if (troubleState && troubleState.players) {
        troubleState.players[data.playerIdx] = { username: data.newUsername };
        updateTroubleHUD();
      }
    });
    s.on('trouble:placed', (data) => {
      if (troubleState) {
        if (!troubleState.placements) troubleState.placements = [];
        if (!troubleState.placements.includes(data.playerIdx)) {
          troubleState.placements.push(data.playerIdx);
        }
        updateTroubleHUD();
      }
    });

    // Trouble lobby events
    s.on('troubleLobby:created', (data) => {
      troubleLobbyCode = data.code;
      troubleLobbyPlayers = data.players;
      isTroubleLobbyHost = true;
      showTroubleHostScreen();
    });

    s.on('troubleLobby:updated', (data) => {
      troubleLobbyPlayers = data.players;
      troubleLobbyCode = data.code || troubleLobbyCode;
      if (currentScreen !== 'troubleHost') {
        // Non-host joining — show the lobby screen
        isTroubleLobbyHost = false;
        showTroubleHostScreen();
      } else {
        updateTroubleHostScreen();
      }
    });

    s.on('troubleLobby:error', (data) => {
      if (currentScreen === 'troubleHost') {
        $('troubleHostError').textContent = data.message;
      } else if (currentScreen === 'guestJoin') {
        $('guestError').textContent = data.message;
      } else if (currentScreen === 'join') {
        $('joinError').textContent = data.message;
      } else {
        alert(data.message);
      }
    });

    s.on('troubleLobby:disbanded', () => {
      troubleLobbyCode = null;
      troubleLobbyPlayers = [];
      isTroubleLobbyHost = false;
      if (currentScreen === 'troubleHost') {
        showScreen('lobby');
      }
    });

    s.on('lobby:resolveResult', (data) => {
      if (!data.found) {
        if (currentScreen === 'join') {
          $('joinError').textContent = 'Invalid code';
        } else if (currentScreen === 'guestJoin') {
          $('guestError').textContent = 'Invalid code';
        }
        return;
      }
      if (data.type === 'checkers') {
        socket.emit('lobby:join', data.code);
      } else if (data.type === 'trouble') {
        socket.emit('troubleLobby:join', data.code);
      } else if (data.type === 'cah') {
        socket.emit('cahLobby:join', data.code);
      }
    });

    s.on('guest:ready', (data) => {
      if (pendingJoinCode) {
        processUrlJoin(pendingJoinCode);
        pendingJoinCode = null;
      }
    });

    // Scrabble events
    s.on('scrabble:start', onScrabbleStart);
    s.on('scrabble:update', onScrabbleUpdate);
    s.on('scrabble:over', onScrabbleOver);
    s.on('scrabble:error', (data) => {
      showScrabbleError(data.message);
    });

    // CAH events
    s.on('cah:start', onCAHStart);
    s.on('cah:update', onCAHUpdate);
    s.on('cah:submissions', onCAHUpdate);
    s.on('cah:roundResult', onCAHRoundResult);
    s.on('cah:over', onCAHOver);
    s.on('cah:error', (data) => {
      const el = $('cahHostError');
      if (el) el.textContent = data.message;
    });
    s.on('cahLobby:created', onCAHLobbyCreated);
    s.on('cahLobby:updated', onCAHLobbyUpdated);
    s.on('cahLobby:disbanded', () => { showScreen('lobby'); });
    s.on('cahLobby:error', (data) => {
      const el = $('cahHostError');
      if (el) el.textContent = data.message;
    });
    s.on('cah:paused', onGamePaused);
    s.on('cah:resumed', onGameResumed);
    s.on('cah:rejoined', onCAHRejoined);

    s.on('disconnect', () => {
      console.log('Socket disconnected');
      if (currentScreen === 'game' || currentScreen === 'trouble' || currentScreen === 'scrabble' || currentScreen === 'cah') {
        $('reconnectingOverlay')?.classList.remove('hidden');
      }
    });

    // Pause/resume/rejoin events
    s.on('game:paused', onGamePaused);
    s.on('game:resumed', onGameResumed);
    s.on('game:rejoined', onGameRejoined);
    s.on('trouble:paused', onGamePaused);
    s.on('trouble:resumed', onGameResumed);
    s.on('trouble:rejoined', onTroubleRejoined);
    s.on('scrabble:paused', onGamePaused);
    s.on('scrabble:resumed', onGameResumed);
    s.on('scrabble:rejoined', onScrabbleRejoined);

    s.on('game:activeGameExists', (data) => {
      if (data.paused) {
        socket.emit('game:rejoin', data.matchCode);
      }
    });

    s.on('game:rejoinError', (data) => {
      const el = $('rejoinError');
      if (el) el.textContent = data.message;
    });
  }

  function connectSocket() {
    if (socket) {
      if (socket.connected) socket.disconnect();
      socket.connect();
      return;
    }
    socket = io();
    bindSocketEvents(socket);
    bindNewGameEvents();
  }

  function connectSocketAsGuest() {
    if (socket) {
      if (socket.connected) socket.disconnect();
      socket.connect();
      return;
    }
    socket = io();
    socket.guestMode = true;
    bindSocketEvents(socket);
    bindNewGameEvents();
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

  /* ---- Global Chat Popout Modal ---- */
  let chatChannel = null;  // 'lobby' | 'game' | null
  let chatOpen = false;
  let chatUnread = 0;

  // Screens that should show the chat FAB
  const CHAT_SCREENS = new Set(['lobby', 'game', 'trouble', 'scrabble', 'cah', 'c4', 'battleship', 'mancala']);

  function bindChatModal() {
    $('chatFab').addEventListener('click', toggleChat);
    $('btnChatClose').addEventListener('click', () => setChatOpen(false));
    $('chatModalForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('chatModalInput');
      const text = input.value.trim();
      if (text && socket) {
        const event = chatChannel === 'lobby' ? 'chat:lobby' : 'chat:game';
        socket.emit(event, text);
        input.value = '';
      }
    });
  }

  function toggleChat() {
    setChatOpen(!chatOpen);
  }

  function setChatOpen(open) {
    chatOpen = open;
    $('chatModal').classList.toggle('hidden', !open);
    if (open) {
      chatUnread = 0;
      updateChatBadge();
      const msgs = $('chatModalMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
      $('chatModalInput')?.focus();
    }
  }

  function switchChatChannel(channel) {
    chatChannel = channel;
    chatUnread = 0;
    updateChatBadge();
    const el = $('chatModalMessages');
    if (el) el.innerHTML = '';
    const title = $('chatModalTitle');
    if (title) title.textContent = channel === 'lobby' ? 'Global Chat' : 'Game Chat';
    showChatFab();
  }

  function showChatFab() {
    $('chatFab')?.classList.remove('hidden');
  }

  function hideChatFab() {
    $('chatFab')?.classList.add('hidden');
    setChatOpen(false);
    chatChannel = null;
  }

  function appendToChat(msg) {
    const el = $('chatModalMessages');
    if (el) {
      appendChatMsg(el, msg);
      el.scrollTop = el.scrollHeight;
    }
    if (!chatOpen) {
      incrementChatBadge();
    }
    sfxChat();
  }

  function incrementChatBadge() {
    chatUnread++;
    updateChatBadge();
  }

  function updateChatBadge() {
    const badge = $('chatFabBadge');
    if (!badge) return;
    if (chatUnread > 0) {
      badge.textContent = chatUnread > 99 ? '99+' : chatUnread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function restoreChatLog(chatLog) {
    if (!chatLog) return;
    const el = $('chatModalMessages');
    if (el) {
      el.innerHTML = '';
      chatLog.forEach(m => appendChatMsg(el, m));
      el.scrollTop = el.scrollHeight;
    }
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
    restoreChatLog(data.chatLog);
  }

  function onTroubleRejoined(data) {
    $('reconnectingOverlay')?.classList.add('hidden');
    onTroubleStart(data);
    restoreChatLog(data.chatLog);
  }

  function onScrabbleRejoined(data) {
    $('reconnectingOverlay')?.classList.add('hidden');
    onScrabbleStart(data);
    restoreChatLog(data.chatLog);
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

    // Switch to game chat channel
    switchChatChannel('game');

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

    // No chat in local mode — hide FAB
    hideChatFab();

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

    // Collapse all game categories
    const categories = $('gameCategories');
    if (categories) categories.classList.add('collapsed');

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
    const categories = $('gameCategories');
    if (categories) categories.classList.remove('collapsed');
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
        case 'troublePrivate':
          showTroublePrivateChoice();
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
    } else if (gameId === 'cah') {
      switch (modeId) {
        case 'cahOnline':
          socket.emit('cah:join');
          $('queueTitle').textContent = 'Cards Against Humanity';
          $('queueText').textContent = 'Finding players...';
          showScreen('queue');
          break;
        case 'cahBots':
          socket.emit('cah:bot');
          $('queueTitle').textContent = 'Cards Against Humanity';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'cahPrivate':
          showCAHPrivateChoice();
          break;
      }
    } else if (gameId === 'c4') {
      switch (modeId) {
        case 'c4Online':
          socket.emit('c4:join');
          $('queueTitle').textContent = 'Connect Four';
          $('queueText').textContent = 'Finding an opponent...';
          showScreen('queue');
          break;
        case 'c4Bots':
          socket.emit('c4:bot');
          $('queueTitle').textContent = 'Connect Four';
          $('queueText').textContent = 'Starting game vs bot...';
          showScreen('queue');
          break;
        case 'c4Local':
          startLocalC4Game();
          break;
      }
    } else if (gameId === 'battleship') {
      switch (modeId) {
        case 'bsOnline':
          socket.emit('bs:join');
          $('queueTitle').textContent = 'Battleship';
          $('queueText').textContent = 'Finding an opponent...';
          showScreen('queue');
          break;
        case 'bsBots':
          socket.emit('bs:bot');
          $('queueTitle').textContent = 'Battleship';
          $('queueText').textContent = 'Starting game vs bot...';
          showScreen('queue');
          break;
        case 'bsLocal':
          startLocalBSGame();
          break;
      }
    } else if (gameId === 'mancala') {
      switch (modeId) {
        case 'mancalaOnline':
          socket.emit('mancala:join');
          $('queueTitle').textContent = 'Mancala';
          $('queueText').textContent = 'Finding an opponent...';
          showScreen('queue');
          break;
        case 'mancalaBots':
          socket.emit('mancala:bot');
          $('queueTitle').textContent = 'Mancala';
          $('queueText').textContent = 'Starting game vs bot...';
          showScreen('queue');
          break;
        case 'mancalaLocal':
          startLocalMancalaGame();
          break;
      }
    } else if (gameId === 'mahjong') {
      switch (modeId) {
        case 'mahjongPlay':
          startMahjongGame();
          break;
      }
    } else if (gameId === 'solitaire') {
      switch (modeId) {
        case 'solitairePlay':
          startSolitaireGame();
          break;
      }
    } else if (gameId === 'pinball') {
      switch (modeId) {
        case 'pinballPlay':
          startPinballGame();
          break;
      }
    } else if (gameId === 'jezzball') {
      switch (modeId) {
        case 'jezzballPlay': startJezzballGame(); break;
      }
    } else if (gameId === 'minesweeper') {
      switch (modeId) {
        case 'msEasy': startMinesweeperGame(9, 9, 10, 'Easy'); break;
        case 'msMedium': startMinesweeperGame(16, 16, 40, 'Medium'); break;
        case 'msHard': startMinesweeperGame(30, 16, 99, 'Hard'); break;
      }
    } else if (gameId === 'spaceinvaders') {
      switch (modeId) {
        case 'siPlay': startSIGame(); break;
      }
    } else if (gameId === 'tetris') {
      switch (modeId) {
        case 'tetrisPlay': startTetrisGame(); break;
      }
    } else if (gameId === 'columns') {
      switch (modeId) {
        case 'columnsPlay': startColumnsGame(); break;
      }
    } else if (gameId === 'lightsout') {
      switch (modeId) {
        case 'loEasy': startLightsOutGame(5); break;
        case 'loMedium': startLightsOutGame(7); break;
        case 'loHard': startLightsOutGame(9); break;
      }
    } else if (gameId === 'helicopter') {
      switch (modeId) {
        case 'hcPlay': startHelicopterGame(); break;
      }
    } else if (gameId === 'dopewars') {
      switch (modeId) {
        case 'dwPlay': startDopeWarsGame(); break;
      }
    } else if (gameId === 'missilecommand') {
      switch (modeId) {
        case 'mcPlay': startMissileCommandGame(); break;
      }
    } else if (gameId === 'blackjack') {
      switch (modeId) {
        case 'bjOnline':
          socket.emit('bj:join');
          $('queueTitle').textContent = 'Blackjack';
          $('queueText').textContent = 'Finding players...';
          showScreen('queue');
          break;
        case 'bjBots':
          socket.emit('bj:bot');
          $('queueTitle').textContent = 'Blackjack';
          $('queueText').textContent = 'Starting game vs bot...';
          showScreen('queue');
          break;
        case 'bjLocal':
          startLocalCardGame('blackjack');
          break;
      }
    } else if (gameId === 'poker') {
      switch (modeId) {
        case 'pkOnline':
          socket.emit('pk:join');
          $('queueTitle').textContent = 'Poker';
          $('queueText').textContent = 'Finding players...';
          showScreen('queue');
          break;
        case 'pkBots':
          socket.emit('pk:bot');
          $('queueTitle').textContent = 'Poker';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'pkLocal':
          startLocalCardGame('poker');
          break;
      }
    } else if (gameId === 'hearts') {
      switch (modeId) {
        case 'htOnline':
          socket.emit('ht:join');
          $('queueTitle').textContent = 'Hearts';
          $('queueText').textContent = 'Finding players...';
          showScreen('queue');
          break;
        case 'htBots':
          socket.emit('ht:bot');
          $('queueTitle').textContent = 'Hearts';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'htLocal':
          startLocalCardGame('hearts');
          break;
      }
    } else if (gameId === 'spades') {
      switch (modeId) {
        case 'spOnline':
          socket.emit('sp:join');
          $('queueTitle').textContent = 'Spades';
          $('queueText').textContent = 'Finding players...';
          showScreen('queue');
          break;
        case 'spBots':
          socket.emit('sp:bot');
          $('queueTitle').textContent = 'Spades';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'spLocal':
          startLocalCardGame('spades');
          break;
      }
    } else if (gameId === 'ginrummy') {
      switch (modeId) {
        case 'grOnline':
          socket.emit('gr:join');
          $('queueTitle').textContent = 'Gin Rummy';
          $('queueText').textContent = 'Finding an opponent...';
          showScreen('queue');
          break;
        case 'grBots':
          socket.emit('gr:bot');
          $('queueTitle').textContent = 'Gin Rummy';
          $('queueText').textContent = 'Starting game vs bot...';
          showScreen('queue');
          break;
        case 'grLocal':
          startLocalCardGame('ginrummy');
          break;
      }
    } else if (gameId === 'war') {
      switch (modeId) {
        case 'warOnline':
          socket.emit('war:join');
          $('queueTitle').textContent = 'War';
          $('queueText').textContent = 'Finding an opponent...';
          showScreen('queue');
          break;
        case 'warBots':
          socket.emit('war:bot');
          $('queueTitle').textContent = 'War';
          $('queueText').textContent = 'Starting game vs bot...';
          showScreen('queue');
          break;
        case 'warLocal':
          startLocalCardGame('war');
          break;
      }
    } else if (gameId === 'crazy8') {
      switch (modeId) {
        case 'c8Online':
          socket.emit('c8:join');
          $('queueTitle').textContent = 'Crazy Eights';
          $('queueText').textContent = 'Finding players...';
          showScreen('queue');
          break;
        case 'c8Bots':
          socket.emit('c8:bot');
          $('queueTitle').textContent = 'Crazy Eights';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'c8Local':
          startLocalCardGame('crazy8');
          break;
      }
    } else if (gameId === 'gofish') {
      switch (modeId) {
        case 'gfOnline':
          socket.emit('gf:join');
          $('queueTitle').textContent = 'Go Fish';
          $('queueText').textContent = 'Finding players...';
          showScreen('queue');
          break;
        case 'gfBots':
          socket.emit('gf:bot');
          $('queueTitle').textContent = 'Go Fish';
          $('queueText').textContent = 'Starting game vs bots...';
          showScreen('queue');
          break;
        case 'gfLocal':
          startLocalCardGame('gofish');
          break;
      }
    } else if (gameId === 'higherlower') {
      switch (modeId) {
        case 'hlPlay':
          startLocalCardGame('higherlower');
          break;
        case 'hlBots':
          socket.emit('hl:bot');
          $('queueTitle').textContent = 'Higher or Lower';
          $('queueText').textContent = 'Starting game...';
          showScreen('queue');
          break;
      }
    } else if (gameId === 'pool') {
      switch (modeId) {
        case 'poolOnline':
          socket.emit('pool:join');
          $('queueTitle').textContent = '8-Ball Pool';
          $('queueText').textContent = 'Finding an opponent...';
          showScreen('queue');
          break;
        case 'poolBots':
          socket.emit('pool:bot');
          $('queueTitle').textContent = '8-Ball Pool';
          $('queueText').textContent = 'Starting game vs bot...';
          showScreen('queue');
          break;
        case 'poolLocal':
          startLocalPoolGame();
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
  let troubleStateVersion = 0;   // guards delayed rollResult callbacks from overwriting newer state

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
    drawTroubleTurnIndicator();
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

  function drawTroubleTurnIndicator() {
    if (!troubleState || troubleState.gameOver) return;
    const c = troubleCtx;
    const t = performance.now();
    const cp = troubleState.currentTurn;
    const pc = TROUBLE_PLAYER_COLORS[cp];
    const entryPt = TROUBLE_TRACK[TROUBLE_ENTRY[cp]];
    const pulse = 0.4 + Math.sin(t / 400) * 0.3;

    // Pulsing glow ring around current player's entry point
    c.save();
    c.beginPath();
    c.arc(entryPt.x, entryPt.y, 28 + Math.sin(t / 300) * 3, 0, Math.PI * 2);
    c.strokeStyle = pc.highlight;
    c.lineWidth = 3;
    c.globalAlpha = pulse;
    c.stroke();
    c.restore();

    // Arrow/text near center showing whose turn
    const isMyTurn = !troubleIsLocal && cp === troublePlayerIndex;
    const label = isMyTurn ? 'YOUR TURN' : `${TROUBLE_COLOR_NAMES[cp].toUpperCase()}'S TURN`;
    c.save();
    c.font = 'bold 11px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = pc.highlight;
    c.globalAlpha = 0.7 + Math.sin(t / 500) * 0.2;
    c.fillText(label, CENTER, CENTER + 52);
    c.restore();
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

      // Placement badge if player has finished
      const placementIdx = (troubleState.placements || []).indexOf(p);
      const ordinals = ['1st', '2nd', '3rd', '4th'];
      let placeBadge = '';
      if (placementIdx >= 0) {
        placeBadge = `<span class="trouble-place-badge trouble-place-${placementIdx + 1}">${ordinals[placementIdx]}</span>`;
      }

      // Phase label for active player
      let phaseLabel = '';
      if (isActive && !troubleState.gameOver && placementIdx < 0) {
        phaseLabel = troubleState.phase === 'roll' ? 'Rolling...' : 'Moving...';
      }

      const isFinished = placementIdx >= 0;
      html += `<div class="trouble-player-card${isActive && !isFinished ? ' active' : ''}${isMe ? ' is-you' : ''}${isFinished ? ' finished' : ''}" style="--pc:${pc.mid}">
        <div class="trouble-card-top">
          <div class="trouble-card-dot" style="background:${pc.mid}"></div>
          <span class="trouble-card-name">${escapeHtml(displayName)}${isMe ? ' <span class="trouble-you-tag">(You)</span>' : ''}${isBot ? ' <span class="trouble-bot-tag">BOT</span>' : ''}</span>
          ${placeBadge}
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
        phase: result.state.phase,
        placements: result.state.placements
      });
      if (result.gameOver.over) {
        onTroubleOver({
          winner: result.gameOver.winner,
          placements: result.gameOver.placements,
          placementNames: result.gameOver.placements.map(i => TROUBLE_COLOR_NAMES[i]),
          coinRewards: {}
        });
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
    troubleParticles = [];
    troubleDiceAnim = null;
    troubleSelectedToken = -1;

    // Restore valid moves if rejoining mid-move phase, otherwise reset
    if (data.validMoves && data.validMoves.length > 0 && data.phase === 'move'
        && data.currentTurn === data.playerIndex) {
      troubleValidMoves = data.validMoves;
    } else {
      troubleValidMoves = [];
    }

    troubleState = {
      gameId: data.gameId,
      playerCount: data.playerCount,
      currentTurn: data.currentTurn,
      tokens: data.tokens,
      finished: data.finished,
      diceResult: data.diceResult,
      phase: data.phase,
      players: data.players,
      placements: data.placements || [],
      gameOver: false
    };
    currentMatchCode = data.matchCode || null;
    isPaused = false;

    // Apply cosmetics
    if (data.cosmetics?.[troublePlayerIndex]) {
      activeCosmetics = { ...activeCosmetics, ...data.cosmetics[troublePlayerIndex] };
    }

    // Switch to game chat channel
    switchChatChannel('game');

    // Match code display
    const tCodeEl = $('troubleMatchCodeValue');
    if (tCodeEl) tCodeEl.textContent = currentMatchCode || '------';

    updateTroubleHUD();
    // Disable roll button if not our turn OR if we're in move phase (already rolled)
    $('btnTroubleRoll').disabled = (data.currentTurn !== data.playerIndex) || data.phase === 'move';
    showScreen('trouble');
    $('gamePausedOverlay')?.classList.add('hidden');
    $('reconnectingOverlay')?.classList.add('hidden');
    playTone(523, 0.15, 'sine', 0.08);
  }

  function onTroubleRollResult(data) {
    troubleDiceAnim = { startTime: performance.now(), duration: 500, finalValue: data.diceResult };

    const versionAtSchedule = ++troubleStateVersion;
    setTimeout(() => {
      // If a trouble:update arrived while we waited, don't overwrite newer state
      if (troubleStateVersion !== versionAtSchedule) return;
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
    ++troubleStateVersion; // invalidate any pending delayed rollResult callbacks
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
    troubleState.placements = data.placements || troubleState.placements || [];
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
    const placements = data.placements || [data.winner];
    const placementNames = data.placementNames || placements.map(i => TROUBLE_COLOR_NAMES[i]);
    const myPlace = placements.indexOf(troublePlayerIndex);
    const isWin = troubleIsLocal ? true : (myPlace === 0);

    const title = $('gameOverTitle');
    if (troubleIsLocal) {
      title.textContent = `${TROUBLE_COLOR_NAMES[data.winner]} Wins!`;
      title.className = '';
    } else if (isWin) {
      title.textContent = 'Victory!';
      title.className = 'win';
    } else {
      const ordinals = ['1st', '2nd', '3rd', '4th'];
      title.textContent = myPlace >= 0 ? `${ordinals[myPlace]} Place` : 'Game Over';
      title.className = myPlace <= 1 ? 'win' : 'lose';
    }

    // Build standings text
    const ordinals = ['1st', '2nd', '3rd', '4th'];
    let standingsHtml = '';
    for (let r = 0; r < placements.length; r++) {
      const pIdx = placements[r];
      const pc = TROUBLE_PLAYER_COLORS[pIdx];
      const name = placementNames[r] || TROUBLE_COLOR_NAMES[pIdx];
      const displayName = name.startsWith('trouble_bot_') ? `Bot ${TROUBLE_COLOR_NAMES[pIdx]}` : name;
      const isMe = !troubleIsLocal && pIdx === troublePlayerIndex;
      standingsHtml += `<span style="color:${pc.highlight}">${ordinals[r]}</span> ${escapeHtml(displayName)}${isMe ? ' (You)' : ''}`;
      if (r < placements.length - 1) standingsHtml += '  ·  ';
    }
    $('gameOverReason').innerHTML = standingsHtml;

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
    } else if (myPlace <= 1) {
      sfxWin(); // 2nd place also gets a win sound
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
      this.placements = [];
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
        winner: this.winner,
        placements: [...this.placements]
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

      let placed = false;
      const allDone = this.finished[player] >= 4;
      if (allDone && !this.placements.includes(player)) {
        this.placements.push(player);
        placed = true;
        if (!this.winner) this.winner = player;
      }

      const unfinishedCount = this.playerCount - this.placements.length;
      if (unfinishedCount <= 1) {
        for (let p = 0; p < this.playerCount; p++) {
          if (!this.placements.includes(p)) { this.placements.push(p); break; }
        }
        this.gameOver = true;
      }

      const extraTurn = this.diceResult === 6 && !allDone && !this.gameOver;
      this.diceResult = null;
      this.phase = 'roll';
      if (!extraTurn && !this.gameOver) this._nextTurn();

      return {
        valid: true, player, tokenIdx, fromPos, toPos, captured, finishedToken, extraTurn, placed,
        placement: placed ? this.placements.length : null,
        gameOver: this.gameOver ? { over: true, winner: this.winner, placements: [...this.placements] } : { over: false },
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

    // No chat in local mode — hide FAB
    hideChatFab();

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

  /* ================================================
     TROUBLE — PRIVATE LOBBY UI
     ================================================ */
  const TROUBLE_DOT_COLORS = ['#d32f2f', '#2f6fd3', '#2fd32f', '#d3d32f'];

  function showTroublePrivateChoice() {
    const existing = document.querySelector('.private-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.className = 'private-picker glass';
    picker.innerHTML = `
      <button class="btn btn-primary btn-small" id="btnTroublePrivateCreate">Create Lobby</button>
      <button class="btn btn-primary btn-small" id="btnTroublePrivateJoin">Join with Code</button>
      <button class="btn btn-ghost btn-small" id="btnTroublePrivateBack">Cancel</button>
    `;
    $('gameDetail').appendChild(picker);

    document.getElementById('btnTroublePrivateCreate').addEventListener('click', () => {
      picker.remove();
      socket.emit('troubleLobby:create');
    });
    document.getElementById('btnTroublePrivateJoin').addEventListener('click', () => {
      picker.remove();
      $('joinCodeInput').value = '';
      $('joinError').textContent = '';
      showScreen('join');
    });
    document.getElementById('btnTroublePrivateBack').addEventListener('click', () => {
      picker.remove();
    });
  }

  function showTroubleHostScreen() {
    $('troubleInviteCode').textContent = troubleLobbyCode || '------';
    $('troubleHostError').textContent = '';
    updateTroubleHostScreen();
    showScreen('troubleHost');
  }

  function updateTroubleHostScreen() {
    const list = $('troubleLobbyPlayerList');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const p = troubleLobbyPlayers[i];
      const div = document.createElement('div');
      if (p) {
        div.className = 'trouble-lobby-player';
        div.innerHTML = `<span class="trouble-lobby-dot" style="background:${TROUBLE_DOT_COLORS[i]}"></span>`
          + `<span>${escapeHtml(p.username)}</span>`
          + `<span style="color:${TROUBLE_DOT_COLORS[i]};font-size:0.75rem;margin-left:auto">${TROUBLE_COLOR_NAMES[i]}</span>`;
      } else {
        div.className = 'trouble-lobby-player empty';
        div.innerHTML = `<span class="trouble-lobby-dot" style="background:${TROUBLE_DOT_COLORS[i]};opacity:0.3"></span>`
          + `<span>Waiting... (bot will fill)</span>`;
      }
      list.appendChild(div);
    }
    const btn = $('btnTroubleStartLobby');
    if (btn) btn.disabled = !isTroubleLobbyHost || troubleLobbyPlayers.length < 2;
  }

  function processUrlJoin(code) {
    if (!socket || !socket.connected) return;
    socket.emit('lobby:resolve', code);
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
      if (confirm('Resign and leave the game?')) {
        socket.emit('trouble:resign');
        troubleGameLoopActive = false;
        troubleState = null;
        troubleValidMoves = [];
        showScreen('lobby');
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

    // Switch to game chat channel
    switchChatChannel('game');

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

    hideChatFab();
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
    copyHandler('btnCopyCahCode');

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

    // Game card selection (event delegation on categories container)
    $('gameCategories').addEventListener('click', (e) => {
      const card = e.target.closest('.game-card');
      if (card && card.dataset.game) selectGame(card.dataset.game);
    });
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

    // Join lobby (universal — resolves code to checkers or trouble)
    $('btnJoinCode').addEventListener('click', () => {
      const code = $('joinCodeInput').value.trim();
      if (code) {
        $('joinError').textContent = '';
        socket.emit('lobby:resolve', code);
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
      if (currentScreen === 'mahjong') {
        startMahjongGame();
      } else {
        showScreen('lobby');
      }
    });

    $('btnBackToLobby').addEventListener('click', () => {
      $('gameOverOverlay').classList.add('hidden');
      confettiActive = false;
      showScreen('lobby');
    });

    // Global chat modal
    bindChatModal();

    // Canvas click
    document.addEventListener('DOMContentLoaded', () => {
      // Defer canvas event binding until game screen is active
    });

    // Trouble host screen
    $('troubleInviteCode').addEventListener('click', () => {
      const code = $('troubleInviteCode').textContent;
      navigator.clipboard?.writeText(code);
      $('troubleCopyHint').textContent = 'Copied!';
      setTimeout(() => { $('troubleCopyHint').textContent = 'Click to copy'; }, 1500);
    });

    $('btnCopyTroubleLink').addEventListener('click', () => {
      const code = $('troubleInviteCode').textContent;
      const link = `${window.location.origin}?join=${code}`;
      navigator.clipboard?.writeText(link);
      $('btnCopyTroubleLink').textContent = 'Copied!';
      setTimeout(() => { $('btnCopyTroubleLink').textContent = 'Copy Invite Link'; }, 1500);
    });

    $('btnTroubleStartLobby').addEventListener('click', () => {
      if (socket && troubleLobbyCode) {
        socket.emit('troubleLobby:start', troubleLobbyCode);
      }
    });

    $('btnTroubleCancelLobby').addEventListener('click', () => {
      if (socket) socket.emit('troubleLobby:leave');
      troubleLobbyCode = null;
      troubleLobbyPlayers = [];
      isTroubleLobbyHost = false;
      showScreen('lobby');
    });

    // Guest join screen
    $('btnGuestJoin').addEventListener('click', () => {
      const name = $('guestNameInput').value.trim();
      if (!name || name.length < 1) {
        $('guestError').textContent = 'Please enter a display name';
        return;
      }
      $('guestError').textContent = '';
      connectSocketAsGuest();
      socket.on('connect', function onGuestConnect() {
        socket.off('connect', onGuestConnect);
        socket.emit('guest:setName', name);
      });
      // If already connected, emit immediately
      if (socket.connected) {
        socket.emit('guest:setName', name);
      }
    });

    $('btnGuestSignup').addEventListener('click', () => {
      // Store pending code so we can join after login
      // pendingJoinCode is already set from URL parsing
      showScreen('auth');
    });

    $('guestNameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btnGuestJoin').click();
    });

    // CAH resign
    $('btnCAHResign').addEventListener('click', () => {
      if (confirm('Leave this Cards Against Humanity game?')) {
        socket.emit('cah:resign');
        showScreen('lobby');
      }
    });

    // Shop
    bindShopEvents();

    // Trouble
    bindTroubleEvents();

    // Scrabble
    bindScrabbleEvents();
  }

  /* ================================================
     CARDS AGAINST HUMANITY
     ================================================ */

  // CAH state
  let cahState = null;
  let cahHand = [];
  let cahSelectedCards = [];
  let cahPhase = null;
  let cahIsCzar = false;
  let cahPlayerIndex = -1;
  let cahPlayers = [];
  let cahMatchCode = null;
  let cahTimerInterval = null;
  let cahLobbyCode = null;
  let isCAHLobbyHost = false;
  let cahLobbyPackType = 'pg13';
  let cahLobbyMaxRounds = 10;
  let cahRoundResultTimeout = null;

  function showCAHPrivateChoice() {
    const existing = document.querySelector('.private-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.className = 'private-picker glass';
    picker.innerHTML = `
      <button class="btn btn-primary btn-small" id="btnCAHPrivateCreate">Create Lobby</button>
      <button class="btn btn-primary btn-small" id="btnCAHPrivateJoin">Join with Code</button>
      <button class="btn btn-ghost btn-small" id="btnCAHPrivateBack">Cancel</button>
    `;
    $('gameDetail').appendChild(picker);

    document.getElementById('btnCAHPrivateCreate').addEventListener('click', () => {
      picker.remove();
      socket.emit('cahLobby:create', { packType: 'pg13', maxRounds: 10 });
    });
    document.getElementById('btnCAHPrivateJoin').addEventListener('click', () => {
      picker.remove();
      showScreen('join');
    });
    document.getElementById('btnCAHPrivateBack').addEventListener('click', () => {
      picker.remove();
    });
  }

  function onCAHLobbyCreated(data) {
    cahLobbyCode = data.code;
    isCAHLobbyHost = true;
    cahLobbyPackType = data.packType || 'pg13';
    cahLobbyMaxRounds = data.maxRounds || 10;
    $('cahInviteCode').textContent = data.code;
    $('cahRoundsLabel').textContent = cahLobbyMaxRounds;
    $('cahRoundsSlider').value = cahLobbyMaxRounds;
    updateCAHLobbyPlayerList(data.players || []);
    showScreen('cahHost');
    setupCAHLobbyControls();
  }

  function onCAHLobbyUpdated(data) {
    if (data.packType) cahLobbyPackType = data.packType;
    if (data.maxRounds) cahLobbyMaxRounds = data.maxRounds;
    updateCAHLobbyPlayerList(data.players || []);
    if (currentScreen !== 'cahHost') {
      cahLobbyCode = data.code;
      isCAHLobbyHost = false;
      $('cahInviteCode').textContent = data.code;
      $('cahRoundsLabel').textContent = cahLobbyMaxRounds;
      showScreen('cahHost');
      setupCAHLobbyControls();
    }
  }

  function updateCAHLobbyPlayerList(players) {
    const el = $('cahLobbyPlayerList');
    if (!el) return;
    el.innerHTML = players.map((p, i) => `
      <div class="trouble-lobby-player">${i === 0 ? '\uD83D\uDC51 ' : ''}${p.username}</div>
    `).join('');
    const btn = $('btnCAHStartLobby');
    if (btn) btn.disabled = !isCAHLobbyHost || players.length < 3;
  }

  function setupCAHLobbyControls() {
    // Pack toggle
    document.querySelectorAll('.cah-pack-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pack === cahLobbyPackType);
      btn.onclick = () => {
        cahLobbyPackType = btn.dataset.pack;
        document.querySelectorAll('.cah-pack-btn').forEach(b => b.classList.toggle('active', b.dataset.pack === cahLobbyPackType));
      };
    });

    // Rounds slider
    const slider = $('cahRoundsSlider');
    if (slider) {
      slider.value = cahLobbyMaxRounds;
      slider.oninput = () => {
        cahLobbyMaxRounds = parseInt(slider.value);
        $('cahRoundsLabel').textContent = cahLobbyMaxRounds;
      };
    }

    // Copy invite code
    $('cahInviteCode').onclick = () => {
      navigator.clipboard?.writeText($('cahInviteCode').textContent);
      $('cahCopyHint').textContent = 'Copied!';
    };

    // Copy link
    $('btnCopyCahLink').onclick = () => {
      const link = `${window.location.origin}?join=${cahLobbyCode}`;
      navigator.clipboard?.writeText(link);
    };

    // Start game
    $('btnCAHStartLobby').onclick = () => {
      socket.emit('cahLobby:start', cahLobbyCode);
    };

    // Cancel
    $('btnCAHCancelLobby').onclick = () => {
      socket.emit('cahLobby:leave');
      showScreen('lobby');
    };
  }

  function onCAHStart(data) {
    cahState = data;
    cahHand = data.hand || [];
    cahSelectedCards = [];
    cahPhase = data.phase;
    cahIsCzar = data.isCzar;
    cahPlayerIndex = data.playerIndex;
    cahPlayers = data.players || [];
    cahMatchCode = data.matchCode;
    gameType = 'cah';
    currentMatchCode = data.matchCode;
    $('cahMatchCodeValue').textContent = data.matchCode || '------';
    switchChatChannel('game');
    showScreen('cah');
    renderCAHGame();
  }

  function onCAHUpdate(data) {
    cahState = { ...cahState, ...data };
    if (data.hand) cahHand = data.hand;
    cahPhase = data.phase;
    cahIsCzar = data.isCzar;
    if (data.shuffledSubmissions) {
      cahState.shuffledSubmissions = data.shuffledSubmissions;
    }
    renderCAHGame();
  }

  function onCAHRoundResult(data) {
    // Show round result toast
    const toast = document.createElement('div');
    toast.className = 'cah-round-result';
    const cardsHtml = (data.winningCards || []).map(c => `<div class="cah-white-card mini">${c}</div>`).join('');
    toast.innerHTML = `
      <h3>\uD83C\uDFC6 ${data.winnerName} wins this round!</h3>
      <div class="cah-result-cards">${cardsHtml}</div>
      <p class="muted">Round ${data.round} | Scores updating...</p>
    `;
    document.body.appendChild(toast);

    // Update scores
    if (data.scores) {
      cahState.scores = data.scores;
      renderCAHScoreboard();
    }

    // Remove toast after delay
    if (cahRoundResultTimeout) clearTimeout(cahRoundResultTimeout);
    cahRoundResultTimeout = setTimeout(() => {
      toast.remove();
      cahRoundResultTimeout = null;
    }, 3500);
  }

  function onCAHOver(data) {
    // Clear timers
    if (cahTimerInterval) { clearInterval(cahTimerInterval); cahTimerInterval = null; }
    if (cahRoundResultTimeout) { clearTimeout(cahRoundResultTimeout); cahRoundResultTimeout = null; }
    document.querySelectorAll('.cah-round-result').forEach(el => el.remove());

    const isWinner = data.winner === cahPlayerIndex;
    $('gameOverTitle').textContent = isWinner ? 'You Won!' : 'Game Over';
    const winnerName = cahPlayers[data.winner]?.username || 'Unknown';
    $('gameOverReason').textContent = `${winnerName} wins with ${data.scores[data.winner]} point(s)!`;

    // Show all scores
    const ratingEl = $('gameOverRating');
    if (ratingEl) {
      ratingEl.innerHTML = (data.scores || []).map((score, i) => {
        const name = cahPlayers[i]?.username || `Player ${i + 1}`;
        const highlight = i === data.winner ? ' style="color:var(--gold);font-weight:bold"' : '';
        return `<div${highlight}>${name}: ${score} pts</div>`;
      }).join('');
    }

    const coinEl = $('gameOverCoins');
    if (coinEl) coinEl.textContent = isWinner ? '+15 coins' : '+5 coins';

    $('gameOverOverlay').classList.remove('hidden');
    if (isWinner) {
      confettiActive = true;
      spawnConfetti();
    }
  }

  function onCAHRejoined(data) {
    $('reconnectingOverlay')?.classList.add('hidden');
    $('gamePausedOverlay')?.classList.add('hidden');
    onCAHStart(data);
  }

  function renderCAHGame() {
    renderCAHScoreboard();
    renderCAHPhaseBanner();
    renderCAHBlackCard();
    renderCAHSubmissions();
    renderCAHHand();
    renderCAHTimer();
  }

  function renderCAHScoreboard() {
    const el = $('cahScoreboard');
    if (!el) return;
    const scores = cahState?.scores || [];
    const czar = cahState?.currentCzar;
    el.innerHTML = cahPlayers.map((p, i) => {
      const classes = ['cah-player-chip'];
      if (i === czar) classes.push('czar');
      if (i === cahPlayerIndex) classes.push('me');
      const crown = i === czar ? '<span class="cah-czar-crown">\uD83D\uDC51</span>' : '';
      return `<div class="${classes.join(' ')}">${crown}<span>${p.username}</span><span class="cah-player-score">${scores[i] || 0}</span></div>`;
    }).join('');
  }

  function renderCAHPhaseBanner() {
    const el = $('cahPhaseBanner');
    if (!el) return;
    const czarName = cahPlayers[cahState?.currentCzar]?.username || 'Card Czar';
    const round = cahState?.round || 0;
    const maxRounds = cahState?.maxRounds || 10;
    switch (cahPhase) {
      case 'submitting':
        el.textContent = cahIsCzar ? `You are the Card Czar \u2014 Wait for submissions (Round ${round}/${maxRounds})` : `Pick your card(s) and submit! (Round ${round}/${maxRounds})`;
        break;
      case 'revealing':
        el.textContent = cahIsCzar ? `Pick the funniest answer! (Round ${round}/${maxRounds})` : `${czarName} is judging... (Round ${round}/${maxRounds})`;
        break;
      case 'roundEnd':
        el.textContent = `Round ${round} complete!`;
        break;
      default:
        el.textContent = `Round ${round}/${maxRounds}`;
    }
  }

  function renderCAHBlackCard() {
    const card = $('cahBlackCard');
    if (!card || !cahState?.currentBlack) return;
    const text = cahState.currentBlack.text.replace(/_/g, '<span class="cah-blank">&nbsp;&nbsp;&nbsp;&nbsp;</span>');
    card.querySelector('.cah-black-text').innerHTML = text;
    const badge = $('cahPickBadge');
    if (badge) {
      const pick = cahState.currentBlack.pick || 1;
      badge.textContent = pick > 1 ? `PICK ${pick}` : '';
      badge.style.display = pick > 1 ? '' : 'none';
    }
  }

  function renderCAHSubmissions() {
    const area = $('cahSubmissionsArea');
    if (!area) return;

    if (cahPhase === 'submitting') {
      // Show submission status
      const submitted = cahState?.submittedPlayers || [];
      const total = (cahPlayers?.length || 0) - 1; // minus czar
      area.innerHTML = `<div class="muted" style="text-align:center;width:100%;padding:2rem;">${submitted.length}/${total} players have submitted</div>`;
      return;
    }

    if ((cahPhase === 'revealing' || cahPhase === 'judging') && cahState?.shuffledSubmissions) {
      area.innerHTML = cahState.shuffledSubmissions.map((sub, idx) => {
        const cardsHtml = sub.cards.map(c => `<div class="cah-white-card mini" style="animation:cardFlip 0.4s ease ${idx * 0.1}s both">${c}</div>`).join('');
        const selectable = cahIsCzar ? 'selectable' : '';
        return `<div class="cah-submission-group ${selectable}" data-sub-idx="${idx}">${cardsHtml}</div>`;
      }).join('');

      // If czar, add click handlers
      if (cahIsCzar) {
        area.querySelectorAll('.cah-submission-group').forEach(group => {
          group.addEventListener('click', () => {
            const idx = parseInt(group.dataset.subIdx);
            if (confirm('Pick this answer as the winner?')) {
              socket.emit('cah:pick', { submissionIdx: idx });
            }
          });
        });
      }
      return;
    }

    area.innerHTML = '';
  }

  function renderCAHHand() {
    const section = $('cahHandSection');
    const handEl = $('cahHand');
    const submitBtn = $('btnCAHSubmit');
    if (!section || !handEl) return;

    if (cahIsCzar) {
      section.classList.add('czar-view');
      handEl.innerHTML = cahHand.map(c => `<div class="cah-white-card">${c}</div>`).join('');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    section.classList.remove('czar-view');
    const hasSubmitted = cahState?.hasSubmitted;
    const pickCount = cahState?.currentBlack?.pick || 1;

    if (cahPhase !== 'submitting' || hasSubmitted) {
      handEl.innerHTML = cahHand.map(c => `<div class="cah-white-card">${c}</div>`).join('');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    handEl.innerHTML = cahHand.map((c, i) => {
      const isSelected = cahSelectedCards.includes(i);
      const order = isSelected ? cahSelectedCards.indexOf(i) + 1 : '';
      return `<div class="cah-white-card${isSelected ? ' selected' : ''}" data-card-idx="${i}" data-order="${order}">${c}</div>`;
    }).join('');

    // Card click handlers
    handEl.querySelectorAll('.cah-white-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.cardIdx);
        const pos = cahSelectedCards.indexOf(idx);
        if (pos !== -1) {
          cahSelectedCards.splice(pos, 1);
        } else if (cahSelectedCards.length < pickCount) {
          cahSelectedCards.push(idx);
        }
        renderCAHHand();
      });
    });

    if (submitBtn) {
      submitBtn.disabled = cahSelectedCards.length !== pickCount;
      submitBtn.onclick = () => {
        if (cahSelectedCards.length === pickCount) {
          socket.emit('cah:submit', { cardIndices: cahSelectedCards });
          cahSelectedCards = [];
          if (submitBtn) submitBtn.disabled = true;
        }
      };
    }
  }

  function renderCAHTimer() {
    const bar = $('cahTimerBar');
    if (!bar) return;

    if (cahTimerInterval) { clearInterval(cahTimerInterval); cahTimerInterval = null; }

    if (cahPhase === 'submitting') {
      let remaining = 60;
      bar.style.width = '100%';
      cahTimerInterval = setInterval(() => {
        remaining--;
        bar.style.width = Math.max(0, (remaining / 60) * 100) + '%';
        if (remaining <= 0) {
          clearInterval(cahTimerInterval);
          cahTimerInterval = null;
        }
      }, 1000);
    } else if (cahPhase === 'revealing') {
      let remaining = 45;
      bar.style.width = '100%';
      cahTimerInterval = setInterval(() => {
        remaining--;
        bar.style.width = Math.max(0, (remaining / 45) * 100) + '%';
        if (remaining <= 0) {
          clearInterval(cahTimerInterval);
          cahTimerInterval = null;
        }
      }, 1000);
    } else {
      bar.style.width = '0%';
    }
  }

  /* ================================================
     INITIALIZATION
     ================================================ */
  async function init() {
    bindEvents();
    initTitleBackground();

    // Check for ?join=CODE in URL
    const params = new URLSearchParams(window.location.search);
    const urlJoinCode = params.get('join');
    if (urlJoinCode) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Try session first
    const hasSession = await checkSession();

    if (urlJoinCode) {
      if (hasSession) {
        // Already logged in — connect socket and join
        pendingJoinCode = urlJoinCode;
        // Socket connects in onLoggedIn → connectSocket, pending code handled there
      } else {
        // Not logged in — show guest join screen
        pendingJoinCode = urlJoinCode;
        showScreen('guestJoin');
        return;
      }
    } else if (!hasSession) {
      showScreen('title');
    }

    // Bind canvas click (use event delegation on #gameCanvas)
    const canvasEl = $('gameCanvas');
    if (canvasEl) canvasEl.addEventListener('click', handleCanvasClick);
  }

  /* ================================================
     CONNECT FOUR — CLIENT
     ================================================ */
  const C4_ROWS = 6, C4_COLS = 7;
  const C4_CANVAS_PX = 560;
  const C4_CELL = C4_CANVAS_PX / C4_COLS;
  const C4_CANVAS_H = C4_CELL * (C4_ROWS + 1); // extra row for drop preview
  let c4Canvas, c4Ctx;
  let c4Board = [];
  let c4CurrentTurn = 0;
  let c4MyIndex = -1;
  let c4GameLoopActive = false;
  let c4HoverCol = -1;
  let c4GameOver = false;
  let c4WinLine = null;
  let c4MatchCode = null;
  let c4Local = null; // for local mode
  let c4OpponentInfo = { username: 'Opponent' };

  function setupC4Canvas() {
    c4Canvas = $('c4Canvas');
    if (!c4Canvas) return;
    c4Canvas.width = C4_CANVAS_PX;
    c4Canvas.height = C4_CANVAS_H;
    c4Ctx = c4Canvas.getContext('2d');
    c4Canvas.addEventListener('mousemove', c4HandleMouseMove);
    c4Canvas.addEventListener('click', c4HandleClick);
  }

  function startC4GameLoop() {
    c4GameLoopActive = true;
    function loop() {
      if (!c4GameLoopActive) return;
      renderC4();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function renderC4() {
    if (!c4Ctx) return;
    const ctx = c4Ctx;
    ctx.clearRect(0, 0, C4_CANVAS_PX, C4_CANVAS_H);

    // Background
    ctx.fillStyle = '#1a3a7a';
    ctx.beginPath();
    ctx.roundRect(0, C4_CELL, C4_CANVAS_PX, C4_ROWS * C4_CELL, 12);
    ctx.fill();

    // Drop preview
    if (c4HoverCol >= 0 && !c4GameOver) {
      const isMyTurn = c4Local ? true : (c4CurrentTurn === c4MyIndex);
      if (isMyTurn) {
        const color = c4Local ? (c4Local.currentTurn === 1 ? '#ff2d55' : '#ffd700') :
                     (c4MyIndex === 0 ? '#ff2d55' : '#ffd700');
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(c4HoverCol * C4_CELL + C4_CELL / 2, C4_CELL / 2, C4_CELL * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Grid cells
    for (let r = 0; r < C4_ROWS; r++) {
      for (let c = 0; c < C4_COLS; c++) {
        const x = c * C4_CELL + C4_CELL / 2;
        const y = (r + 1) * C4_CELL + C4_CELL / 2;
        const val = c4Board[r]?.[c] || 0;

        // Hole
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.arc(x, y, C4_CELL * 0.42, 0, Math.PI * 2);
        ctx.fill();

        if (val === 1) {
          ctx.fillStyle = '#ff2d55';
          ctx.beginPath();
          ctx.arc(x, y, C4_CELL * 0.38, 0, Math.PI * 2);
          ctx.fill();
        } else if (val === 2) {
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(x, y, C4_CELL * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }

        // Highlight win line
        if (c4WinLine) {
          const inWin = c4WinLine.some(w => w.row === r && w.col === c);
          if (inWin) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, C4_CELL * 0.42, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    // Turn indicator
    if (!c4GameOver) {
      const isMyTurn = c4Local ? true : (c4CurrentTurn === c4MyIndex);
      const badge = $('c4TurnBadge');
      if (badge) {
        if (c4Local) {
          badge.textContent = c4Local.currentTurn === 1 ? 'RED\'S TURN' : 'YELLOW\'S TURN';
          badge.style.color = c4Local.currentTurn === 1 ? '#ff2d55' : '#ffd700';
        } else {
          badge.textContent = isMyTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN';
          badge.style.color = isMyTurn ? '#34c759' : '#ff2d55';
        }
      }
    }
  }

  function c4HandleMouseMove(e) {
    const rect = c4Canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (C4_CANVAS_PX / rect.width);
    c4HoverCol = Math.floor(x / C4_CELL);
    if (c4HoverCol < 0 || c4HoverCol >= C4_COLS) c4HoverCol = -1;
  }

  function c4HandleClick(e) {
    if (c4GameOver) return;
    const rect = c4Canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (C4_CANVAS_PX / rect.width);
    const col = Math.floor(x / C4_CELL);
    if (col < 0 || col >= C4_COLS) return;

    if (c4Local) {
      const result = c4Local.makeMove(col);
      if (result.valid) {
        c4Board = result.board;
        sfxMove();
        if (result.gameOver.over) {
          c4GameOver = true;
          c4WinLine = result.gameOver.winLine;
          const badge = $('c4TurnBadge');
          if (result.gameOver.winner === 1) badge.textContent = 'RED WINS!';
          else if (result.gameOver.winner === 2) badge.textContent = 'YELLOW WINS!';
          else badge.textContent = 'DRAW!';
          setTimeout(() => showGameOverOverlay({
            winner: result.gameOver.winner ? (result.gameOver.winner === 1 ? 0 : 1) : null,
            winnerUsername: result.gameOver.winner === 1 ? 'Red' : result.gameOver.winner === 2 ? 'Yellow' : null,
            reason: result.gameOver.reason
          }), 1500);
        }
      }
    } else {
      if (c4CurrentTurn !== c4MyIndex) return;
      socket.emit('c4:move', { col });
    }
  }

  function startLocalC4Game() {
    c4Board = Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0));
    c4GameOver = false;
    c4WinLine = null;
    c4Local = { currentTurn: 1, makeMove: localC4MakeMove };
    c4MyIndex = 0;
    $('c4MyName').textContent = 'Red';
    $('c4OppName').textContent = 'Yellow';
    $('c4MatchCodeValue').textContent = 'LOCAL';
    showScreen('c4');
  }

  function localC4MakeMove(col) {
    if (col < 0 || col >= C4_COLS) return { valid: false };
    let targetRow = -1;
    for (let r = C4_ROWS - 1; r >= 0; r--) {
      if (c4Board[r][col] === 0) { targetRow = r; break; }
    }
    if (targetRow === -1) return { valid: false };
    c4Board[targetRow][col] = c4Local.currentTurn;
    const go = c4CheckWin();
    if (!go.over) c4Local.currentTurn = c4Local.currentTurn === 1 ? 2 : 1;
    return { valid: true, board: c4Board.map(r => [...r]), gameOver: go };
  }

  function c4CheckWin() {
    const dirs = [{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1},{dr:1,dc:-1}];
    for (let r = 0; r < C4_ROWS; r++) {
      for (let c = 0; c < C4_COLS; c++) {
        const v = c4Board[r][c];
        if (!v) continue;
        for (const {dr,dc} of dirs) {
          const line = [];
          let ok = true;
          for (let i = 0; i < 4; i++) {
            const nr = r + i*dr, nc = c + i*dc;
            if (nr<0||nr>=C4_ROWS||nc<0||nc>=C4_COLS||c4Board[nr][nc]!==v) { ok=false; break; }
            line.push({row:nr,col:nc});
          }
          if (ok) return { over:true, winner:v, reason:'Four in a row', winLine:line };
        }
      }
    }
    let full = true;
    for (let c = 0; c < C4_COLS; c++) if (c4Board[0][c]===0) { full=false; break; }
    if (full) return { over:true, winner:null, reason:'Draw' };
    return { over:false };
  }

  // Shared game-over overlay for C4, Battleship, Mancala (and local modes)
  function showGameOverOverlay(data) {
    const title = $('gameOverTitle');
    const reason = $('gameOverReason');
    const ratingDiv = $('gameOverRating');
    const coinDiv = $('gameOverCoins');

    // Determine if current player won
    let isWin = false;
    let isLocal = false;
    if (data.winnerUsername) {
      // Local game — show winner name
      isLocal = true;
      title.textContent = data.winnerUsername + ' Wins!';
      title.className = '';
    } else if (data.winner === null || data.winner === undefined) {
      title.textContent = 'Draw!';
      title.className = '';
    } else {
      // Determine which game to check player index
      const myIdx = currentScreen === 'c4' ? c4MyIndex
                  : currentScreen === 'battleship' ? bsMyIndex
                  : currentScreen === 'mancala' ? mnMyIndex
                  : currentScreen === 'pool' ? poolMyIndex
                  : -1;
      isWin = data.winner === myIdx;
      title.textContent = isWin ? 'Victory!' : 'Defeat';
      title.className = isWin ? 'win' : 'lose';
    }

    if (reason) reason.textContent = data.reason || '';

    // Rating change
    if (ratingDiv) {
      ratingDiv.innerHTML = '';
      if (data.ratingChange && user) {
        const delta = data.ratingChange[user.username];
        if (delta != null) {
          const cls = delta >= 0 ? 'positive' : 'negative';
          const sign = delta >= 0 ? '+' : '';
          ratingDiv.innerHTML = `Rating: <span class="${cls}">${sign}${delta}</span>`;
          user.rating = (user.rating || 1200) + delta;
          if (isWin) user.wins = (user.wins || 0) + 1;
          else if (!isLocal && data.winner !== null) user.losses = (user.losses || 0) + 1;
          updateProfileCard();
        }
      }
    }

    // Show coin reward
    if (coinDiv) {
      coinDiv.textContent = '';
      if (data.coinRewards && user) {
        const coins = data.coinRewards[user.username];
        if (coins) {
          coinDiv.textContent = `+${coins} coins`;
          user.coins = (user.coins || 0) + coins;
        }
      }
    }

    gamesPlayedThisSession++;
    const adEl = $('adGameOver');
    if (adEl) {
      const showAd = !adFreeUser && gamesPlayedThisSession % 2 === 0;
      adEl.classList.toggle('hidden', !showAd);
      if (showAd && typeof refreshAds === 'function') refreshAds();
    }

    $('gameOverOverlay').classList.remove('hidden');
    if (isWin || isLocal) { sfxWin(); startConfetti(); } else { sfxLose(); }
  }

  // Socket events for Connect Four
  function bindC4SocketEvents() {
    if (!socket) return;

    socket.on('c4:start', (data) => {
      c4MyIndex = data.playerIndex;
      c4Board = data.board;
      c4CurrentTurn = data.currentTurn === 1 ? 0 : 1;
      c4GameOver = false;
      c4WinLine = null;
      c4MatchCode = data.matchCode;
      c4Local = null;
      c4OpponentInfo = data.players[1 - c4MyIndex] || { username: 'Opponent' };
      $('c4MyName').textContent = data.players[c4MyIndex]?.username || 'You';
      $('c4OppName').textContent = c4OpponentInfo.username;
      $('c4MatchCodeValue').textContent = data.matchCode || '------';
      showScreen('c4');
    });

    socket.on('c4:update', (data) => {
      c4Board = data.board;
      c4CurrentTurn = data.currentTurn;
      c4GameOver = data.gameOver?.over || false;
      c4WinLine = data.gameOver?.winLine || null;
      sfxMove();
      if (c4GameOver) {
        const badge = $('c4TurnBadge');
        if (data.gameOver.winner === null) badge.textContent = 'DRAW!';
        else badge.textContent = (data.gameOver.winner === c4MyIndex ? 'YOU WIN!' : 'YOU LOSE!');
      }
    });

    socket.on('c4:over', (data) => {
      c4GameOver = true;
      c4WinLine = data.winLine;
      setTimeout(() => showGameOverOverlay(data), 1500);
    });

    socket.on('c4:rejoined', (data) => {
      c4MyIndex = data.playerIndex;
      c4Board = data.board;
      c4CurrentTurn = typeof data.currentTurn === 'number' && data.currentTurn <= 1 ? data.currentTurn : (data.currentTurn === 1 ? 0 : 1);
      c4GameOver = data.gameOver || false;
      c4WinLine = data.winLine || null;
      c4MatchCode = data.matchCode;
      c4Local = null;
      $('c4MatchCodeValue').textContent = data.matchCode || '------';
      showScreen('c4');
    });
  }

  /* ================================================
     BATTLESHIP — CLIENT
     ================================================ */
  const BS_GRID = 10;
  const BS_CELL = 32;
  const BS_CANVAS_PX = BS_GRID * BS_CELL;
  let bsMyCanvas, bsMyCtx, bsOppCanvas, bsOppCtx;
  let bsMyIndex = -1;
  let bsPhase = 'placing';
  let bsCurrentTurn = 0;
  let bsMyGrid = [];
  let bsOppGrid = [];
  let bsMyShips = [];
  let bsOppShips = [];
  let bsGameLoopActive = false;
  let bsGameOver = false;
  let bsMatchCode = null;
  let bsLocal = null;
  let bsPlacingShip = null;
  let bsPlaceHorizontal = true;
  let bsHoverCell = null;
  let bsMessage = '';
  const BS_SHIPS = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 }
  ];
  let bsPlacedShips = new Set();

  function setupBSCanvases() {
    bsMyCanvas = $('bsMyCanvas');
    bsOppCanvas = $('bsOppCanvas');
    if (!bsMyCanvas || !bsOppCanvas) return;
    bsMyCanvas.width = BS_CANVAS_PX;
    bsMyCanvas.height = BS_CANVAS_PX;
    bsOppCanvas.width = BS_CANVAS_PX;
    bsOppCanvas.height = BS_CANVAS_PX;
    bsMyCtx = bsMyCanvas.getContext('2d');
    bsOppCtx = bsOppCanvas.getContext('2d');
    bsMyCanvas.addEventListener('click', bsMyGridClick);
    bsOppCanvas.addEventListener('click', bsOppGridClick);
    bsOppCanvas.addEventListener('mousemove', bsOppMouseMove);
  }

  function startBSGameLoop() {
    bsGameLoopActive = true;
    function loop() {
      if (!bsGameLoopActive) return;
      renderBSGrids();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function renderBSGrid(ctx, grid, showShips, hoverR, hoverC) {
    for (let r = 0; r < BS_GRID; r++) {
      for (let c = 0; c < BS_GRID; c++) {
        const x = c * BS_CELL, y = r * BS_CELL;
        const val = grid[r]?.[c] || 0;
        ctx.fillStyle = '#0c1a2e';
        ctx.fillRect(x, y, BS_CELL, BS_CELL);
        ctx.strokeStyle = '#1a3050';
        ctx.strokeRect(x, y, BS_CELL, BS_CELL);
        if (showShips && val === 1) { ctx.fillStyle = '#4a6a8a'; ctx.fillRect(x+1, y+1, BS_CELL-2, BS_CELL-2); }
        if (val === 2) { ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(x+BS_CELL/2, y+BS_CELL/2, BS_CELL*0.35, 0, Math.PI*2); ctx.fill(); }
        if (val === 3) { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x+BS_CELL/2, y+BS_CELL/2, BS_CELL*0.15, 0, Math.PI*2); ctx.fill(); }
      }
    }
    if (hoverR >= 0 && hoverC >= 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(hoverC * BS_CELL, hoverR * BS_CELL, BS_CELL, BS_CELL);
    }
  }

  function renderBSGrids() {
    if (!bsMyCtx || !bsOppCtx) return;
    bsMyCtx.clearRect(0, 0, BS_CANVAS_PX, BS_CANVAS_PX);
    bsOppCtx.clearRect(0, 0, BS_CANVAS_PX, BS_CANVAS_PX);
    renderBSGrid(bsMyCtx, bsMyGrid, true, -1, -1);
    const hr = bsHoverCell ? bsHoverCell.row : -1;
    const hc = bsHoverCell ? bsHoverCell.col : -1;
    renderBSGrid(bsOppCtx, bsOppGrid, false, hr, hc);

    // Update HUD
    const badge = $('bsTurnBadge');
    if (badge) {
      if (bsPhase === 'placing') badge.textContent = 'PLACE YOUR SHIPS';
      else if (bsGameOver) badge.textContent = 'GAME OVER';
      else badge.textContent = bsCurrentTurn === bsMyIndex ? 'YOUR TURN - FIRE!' : 'OPPONENT\'S TURN';
    }
    const msgEl = $('bsMessage');
    if (msgEl) msgEl.textContent = bsMessage;

    // Show/hide placement panel
    const panel = $('bsShipPanel');
    if (panel) panel.style.display = bsPhase === 'placing' ? 'block' : 'none';
  }

  function bsOppMouseMove(e) {
    if (bsPhase !== 'playing' || bsCurrentTurn !== bsMyIndex) { bsHoverCell = null; return; }
    const rect = bsOppCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (BS_CANVAS_PX / rect.width);
    const y = (e.clientY - rect.top) * (BS_CANVAS_PX / rect.height);
    bsHoverCell = { row: Math.floor(y / BS_CELL), col: Math.floor(x / BS_CELL) };
  }

  function bsOppGridClick(e) {
    if (bsPhase !== 'playing' || bsGameOver) return;
    if (!bsLocal && bsCurrentTurn !== bsMyIndex) return;
    const rect = bsOppCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (BS_CANVAS_PX / rect.width);
    const y = (e.clientY - rect.top) * (BS_CANVAS_PX / rect.height);
    const row = Math.floor(y / BS_CELL);
    const col = Math.floor(x / BS_CELL);
    if (row < 0 || row >= BS_GRID || col < 0 || col >= BS_GRID) return;

    if (bsLocal) {
      // Local mode not fully implemented - just show message
      bsMessage = 'Local Battleship: Take turns firing!';
    } else {
      socket.emit('bs:fire', { row, col });
    }
  }

  function bsMyGridClick(e) {
    if (bsPhase !== 'placing') return;
    // For placing ships in local/online mode
  }

  function startLocalBSGame() {
    bsMessage = 'Battleship local mode - play online for full experience!';
    bsPhase = 'placing';
    bsMyGrid = Array.from({length:BS_GRID}, () => Array(BS_GRID).fill(0));
    bsOppGrid = Array.from({length:BS_GRID}, () => Array(BS_GRID).fill(0));
    bsGameOver = false;
    bsLocal = true;
    bsMyIndex = 0;
    $('bsMyName').textContent = 'Player 1';
    $('bsOppName').textContent = 'Player 2';
    $('bsMatchCodeValue').textContent = 'LOCAL';
    showScreen('battleship');
  }

  function bindBSSocketEvents() {
    if (!socket) return;

    socket.on('bs:start', (data) => {
      bsMyIndex = data.playerIndex;
      bsPhase = data.phase;
      bsCurrentTurn = data.currentTurn;
      bsMyGrid = data.myGrid || Array.from({length:BS_GRID}, () => Array(BS_GRID).fill(0));
      bsOppGrid = data.opponentGrid || Array.from({length:BS_GRID}, () => Array(BS_GRID).fill(0));
      bsMyShips = data.myShips || [];
      bsOppShips = data.opponentShips || [];
      bsGameOver = false;
      bsMatchCode = data.matchCode;
      bsLocal = null;
      bsPlacedShips = new Set(bsMyShips.map(s => s.name));
      bsMessage = bsPhase === 'placing' ? 'Place your ships! Click Auto-Place or Ready.' : '';
      $('bsMyName').textContent = data.players[bsMyIndex]?.username || 'You';
      $('bsOppName').textContent = data.players[1-bsMyIndex]?.username || 'Opponent';
      $('bsMatchCodeValue').textContent = data.matchCode || '------';
      showScreen('battleship');
      bsSetupShipPanel();
    });

    socket.on('bs:placed', (data) => {
      bsMyGrid = data.myGrid || bsMyGrid;
      bsMyShips = data.myShips || bsMyShips;
      bsPlacedShips = new Set(bsMyShips.map(s => s.name));
      bsSetupShipPanel();
    });

    socket.on('bs:ready', (data) => {
      bsPhase = data.phase;
      bsCurrentTurn = data.currentTurn;
      if (data.bothReady) {
        bsMessage = 'Battle begins!';
        bsMyGrid = data.myGrid || bsMyGrid;
        bsOppGrid = data.opponentGrid || bsOppGrid;
      } else {
        bsMessage = 'Waiting for opponent to ready up...';
      }
    });

    socket.on('bs:update', (data) => {
      bsPhase = data.phase;
      bsCurrentTurn = data.currentTurn;
      bsMyGrid = data.myGrid || bsMyGrid;
      bsOppGrid = data.opponentGrid || bsOppGrid;
      bsMyShips = data.myShips || bsMyShips;
      bsOppShips = data.opponentShips || bsOppShips;
      if (data.hit !== undefined) {
        if (data.shooter === bsMyIndex) {
          bsMessage = data.hit ? (data.sunk ? 'HIT & SUNK ' + (data.shipName || '') + '!' : 'HIT!') : 'Miss...';
          if (data.hit) sfxCapture(); else sfxMove();
        } else {
          bsMessage = data.hit ? 'Your ship was hit!' : 'Enemy missed!';
          if (data.hit) sfxCapture();
        }
      }
    });

    socket.on('bs:over', (data) => {
      bsGameOver = true;
      bsPhase = 'over';
      const badge = $('bsTurnBadge');
      if (badge) badge.textContent = data.winner === bsMyIndex ? 'VICTORY!' : 'DEFEAT!';
      bsMessage = data.reason || 'Game over';
      setTimeout(() => showGameOverOverlay(data), 1500);
    });

    socket.on('bs:rejoined', (data) => {
      bsMyIndex = data.playerIndex;
      bsPhase = data.phase;
      bsCurrentTurn = data.currentTurn;
      bsMyGrid = data.myGrid || bsMyGrid;
      bsOppGrid = data.opponentGrid || bsOppGrid;
      bsMatchCode = data.matchCode;
      bsLocal = null;
      $('bsMatchCodeValue').textContent = data.matchCode || '------';
      showScreen('battleship');
    });
  }

  function bsSetupShipPanel() {
    const list = $('bsShipList');
    if (!list) return;
    list.innerHTML = '';
    for (const ship of BS_SHIPS) {
      const el = document.createElement('div');
      el.className = 'bs-ship-item' + (bsPlacedShips.has(ship.name) ? ' placed' : '');
      el.textContent = ship.name + ' (' + ship.size + ')';
      list.appendChild(el);
    }
  }

  // BS button bindings
  function bindBSButtons() {
    const autoBtn = $('btnBsAutoPlace');
    if (autoBtn) autoBtn.addEventListener('click', () => {
      if (socket && bsPhase === 'placing') socket.emit('bs:autoPlace');
    });
    const readyBtn = $('btnBsReady');
    if (readyBtn) readyBtn.addEventListener('click', () => {
      if (socket && bsPhase === 'placing') socket.emit('bs:ready');
    });
    const resignBtn = $('btnBsResign');
    if (resignBtn) resignBtn.addEventListener('click', () => {
      if (socket) socket.emit('bs:resign');
    });
  }

  /* ================================================
     MANCALA — CLIENT
     ================================================ */
  const MN_CANVAS_W = 700;
  const MN_CANVAS_H = 240;
  const MN_PIT_R = 30;
  const MN_STORE_W = 60;
  const MN_STORE_H = 160;
  let mancalaCanvas, mancalaCtx;
  let mnPits = new Array(14).fill(4);
  let mnCurrentTurn = 0;
  let mnMyIndex = -1;
  let mnGameLoopActive = false;
  let mnGameOver = false;
  let mnMatchCode = null;
  let mnLocal = null;
  let mnScores = [0, 0];
  let mnHoverPit = -1;

  function setupMancalaCanvas() {
    mancalaCanvas = $('mancalaCanvas');
    if (!mancalaCanvas) return;
    mancalaCanvas.width = MN_CANVAS_W;
    mancalaCanvas.height = MN_CANVAS_H;
    mancalaCtx = mancalaCanvas.getContext('2d');
    mancalaCanvas.addEventListener('mousemove', mnHandleMouseMove);
    mancalaCanvas.addEventListener('click', mnHandleClick);
  }

  function startMancalaGameLoop() {
    mnGameLoopActive = true;
    function loop() {
      if (!mnGameLoopActive) return;
      renderMancala();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function mnGetPitPos(idx) {
    // Store P1 (index 13) = left side, Store P0 (index 6) = right side
    // P0 pits (0-5) = bottom row left-to-right
    // P1 pits (7-12) = top row right-to-left
    const storeW = MN_STORE_W;
    const pitAreaW = MN_CANVAS_W - 2 * storeW;
    const pitSpacing = pitAreaW / 6;
    const cy1 = MN_CANVAS_H * 0.7; // bottom row (P0)
    const cy0 = MN_CANVAS_H * 0.3; // top row (P1)

    if (idx === 6) return { x: MN_CANVAS_W - storeW/2, y: MN_CANVAS_H/2, isStore: true }; // P0 store (right)
    if (idx === 13) return { x: storeW/2, y: MN_CANVAS_H/2, isStore: true }; // P1 store (left)
    if (idx >= 0 && idx <= 5) return { x: storeW + pitSpacing * idx + pitSpacing/2, y: cy1, isStore: false }; // P0 pits
    if (idx >= 7 && idx <= 12) return { x: storeW + pitSpacing * (12 - idx) + pitSpacing/2, y: cy0, isStore: false }; // P1 pits
    return null;
  }

  function renderMancala() {
    if (!mancalaCtx) return;
    const ctx = mancalaCtx;
    ctx.clearRect(0, 0, MN_CANVAS_W, MN_CANVAS_H);

    // Board background
    ctx.fillStyle = '#3d2b1f';
    ctx.beginPath();
    ctx.roundRect(0, 0, MN_CANVAS_W, MN_CANVAS_H, 20);
    ctx.fill();

    // Draw all pits and stores
    for (let i = 0; i < 14; i++) {
      const pos = mnGetPitPos(i);
      if (!pos) continue;
      const stones = mnPits[i] || 0;

      if (pos.isStore) {
        // Store (tall oval)
        ctx.fillStyle = '#2a1a0e';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, MN_STORE_W*0.4, MN_STORE_H*0.45, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#5a4030';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Pit (circle)
        const isMyPit = (mnLocal) ? true :
          (mnMyIndex === 0 && i >= 0 && i <= 5) || (mnMyIndex === 1 && i >= 7 && i <= 12);
        const isHover = mnHoverPit === i;
        const isActive = !mnGameOver && stones > 0 && isMyPit &&
          (mnLocal ? (mnLocal.currentTurn === 0 ? i <= 5 : i >= 7) : mnCurrentTurn === mnMyIndex);

        ctx.fillStyle = isHover && isActive ? '#4a3520' : '#2a1a0e';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, MN_PIT_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isActive ? '#8a7060' : '#5a4030';
        ctx.lineWidth = isActive ? 2.5 : 1.5;
        ctx.stroke();
      }

      // Draw stone count
      ctx.fillStyle = stones > 0 ? '#ffd700' : '#5a4030';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stones.toString(), pos.x, pos.y);
    }

    // Labels
    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const isFlipped = mnMyIndex === 1;
    ctx.fillText(isFlipped ? 'Your Pits' : 'Opponent\'s Pits', MN_CANVAS_W/2, 12);
    ctx.fillText(isFlipped ? 'Opponent\'s Pits' : 'Your Pits', MN_CANVAS_W/2, MN_CANVAS_H - 6);

    // Score display
    $('mancalaMyScore').textContent = mnScores[mnMyIndex] || 0;
    $('mancalaOppScore').textContent = mnScores[1 - mnMyIndex] || 0;

    // Turn badge
    const badge = $('mancalaTurnBadge');
    if (badge) {
      if (mnGameOver) badge.textContent = 'GAME OVER';
      else if (mnLocal) badge.textContent = mnLocal.currentTurn === 0 ? 'PLAYER 1\'S TURN' : 'PLAYER 2\'S TURN';
      else badge.textContent = mnCurrentTurn === mnMyIndex ? 'YOUR TURN' : 'OPPONENT\'S TURN';
    }
  }

  function mnHandleMouseMove(e) {
    const rect = mancalaCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MN_CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (MN_CANVAS_H / rect.height);
    mnHoverPit = -1;
    for (let i = 0; i < 14; i++) {
      if (i === 6 || i === 13) continue; // skip stores
      const pos = mnGetPitPos(i);
      if (!pos) continue;
      const dx = mx - pos.x, dy = my - pos.y;
      if (dx*dx + dy*dy < MN_PIT_R * MN_PIT_R) { mnHoverPit = i; break; }
    }
  }

  function mnHandleClick(e) {
    if (mnGameOver || mnHoverPit < 0) return;
    const pit = mnHoverPit;

    if (mnLocal) {
      const player = mnLocal.currentTurn;
      const start = player === 0 ? 0 : 7;
      const end = start + 6;
      if (pit < start || pit >= end || mnPits[pit] === 0) return;
      const result = mnLocalMakeMove(pit);
      if (result.valid) {
        mnPits = result.pits;
        mnScores = result.scores;
        sfxMove();
        if (result.extraTurn) {
          const info = $('mancalaInfo');
          if (info) info.textContent = 'Extra turn!';
        } else {
          const info = $('mancalaInfo');
          if (info) info.textContent = result.captured > 0 ? 'Captured ' + result.captured + ' stones!' : '';
        }
        if (result.gameOver.over) {
          mnGameOver = true;
          setTimeout(() => showGameOverOverlay({
            winner: result.gameOver.winner === 'draw' ? null : result.gameOver.winner,
            winnerUsername: result.gameOver.winner === 0 ? 'Player 1' : result.gameOver.winner === 1 ? 'Player 2' : null,
            reason: result.gameOver.reason
          }), 1500);
        }
      }
    } else {
      if (mnCurrentTurn !== mnMyIndex) return;
      const start = mnMyIndex === 0 ? 0 : 7;
      const end = start + 6;
      if (pit < start || pit >= end || mnPits[pit] === 0) return;
      socket.emit('mancala:move', { pitIdx: pit });
    }
  }

  function startLocalMancalaGame() {
    mnPits = new Array(14).fill(4);
    mnPits[6] = 0; mnPits[13] = 0;
    mnScores = [0, 0];
    mnGameOver = false;
    mnMyIndex = 0;
    mnLocal = { currentTurn: 0 };
    $('mancalaMyName').textContent = 'Player 1';
    $('mancalaOppName').textContent = 'Player 2';
    $('mancalaMatchCodeValue').textContent = 'LOCAL';
    const info = $('mancalaInfo');
    if (info) info.textContent = '';
    showScreen('mancala');
  }

  function mnLocalMakeMove(pitIdx) {
    const player = mnLocal.currentTurn;
    const oppStore = player === 0 ? 13 : 6;
    const ownStore = player === 0 ? 6 : 13;
    let stones = mnPits[pitIdx];
    if (stones === 0) return { valid: false };
    mnPits[pitIdx] = 0;
    let idx = pitIdx;
    while (stones > 0) {
      idx = (idx + 1) % 14;
      if (idx === oppStore) continue;
      mnPits[idx]++;
      stones--;
    }
    let extraTurn = idx === ownStore;
    let captured = 0;
    const OPPOSITE = [12,-1,-1,-1,-1,-1,-1,5,4,3,2,1,0];
    // Recalc opposite properly
    const OPP_MAP = {0:12,1:11,2:10,3:9,4:8,5:7,7:5,8:4,9:3,10:2,11:1,12:0};
    if (!extraTurn && mnPits[idx] === 1) {
      const isOwnSide = (player === 0 && idx >= 0 && idx <= 5) || (player === 1 && idx >= 7 && idx <= 12);
      if (isOwnSide && OPP_MAP[idx] !== undefined && mnPits[OPP_MAP[idx]] > 0) {
        captured = mnPits[OPP_MAP[idx]] + 1;
        mnPits[ownStore] += captured;
        mnPits[idx] = 0;
        mnPits[OPP_MAP[idx]] = 0;
      }
    }
    // Check game over
    let p0empty = true, p1empty = true;
    for (let i = 0; i < 6; i++) if (mnPits[i] > 0) p0empty = false;
    for (let i = 7; i < 13; i++) if (mnPits[i] > 0) p1empty = false;
    let go = { over: false };
    if (p0empty || p1empty) {
      for (let i = 0; i < 6; i++) { mnPits[6] += mnPits[i]; mnPits[i] = 0; }
      for (let i = 7; i < 13; i++) { mnPits[13] += mnPits[i]; mnPits[i] = 0; }
      const s0 = mnPits[6], s1 = mnPits[13];
      go = { over: true, winner: s0 > s1 ? 0 : s1 > s0 ? 1 : 'draw', reason: 'Game ended' };
    }
    if (!extraTurn && !go.over) mnLocal.currentTurn = 1 - mnLocal.currentTurn;
    return { valid: true, pits: [...mnPits], scores: [mnPits[6], mnPits[13]], extraTurn, captured, gameOver: go };
  }

  function bindMancalaSocketEvents() {
    if (!socket) return;

    socket.on('mancala:start', (data) => {
      mnMyIndex = data.playerIndex;
      mnPits = data.pits;
      mnCurrentTurn = data.currentTurn;
      mnScores = data.scores || [0, 0];
      mnGameOver = false;
      mnMatchCode = data.matchCode;
      mnLocal = null;
      $('mancalaMyName').textContent = data.players[mnMyIndex]?.username || 'You';
      $('mancalaOppName').textContent = data.players[1-mnMyIndex]?.username || 'Opponent';
      $('mancalaMatchCodeValue').textContent = data.matchCode || '------';
      const info = $('mancalaInfo');
      if (info) info.textContent = '';
      showScreen('mancala');
    });

    socket.on('mancala:update', (data) => {
      mnPits = data.pits;
      mnCurrentTurn = data.currentTurn;
      mnScores = data.scores;
      sfxMove();
      const info = $('mancalaInfo');
      if (info) {
        if (data.extraTurn) info.textContent = 'Extra turn!';
        else if (data.captured > 0) info.textContent = 'Captured ' + data.captured + ' stones!';
        else info.textContent = '';
      }
      if (data.gameOver && data.gameOver.over) {
        mnGameOver = true;
      }
    });

    socket.on('mancala:over', (data) => {
      mnGameOver = true;
      setTimeout(() => showGameOverOverlay(data), 1500);
    });

    socket.on('mancala:rejoined', (data) => {
      mnMyIndex = data.playerIndex;
      mnPits = data.pits;
      mnCurrentTurn = data.currentTurn;
      mnScores = data.scores || [mnPits[6], mnPits[13]];
      mnGameOver = data.gameOver || false;
      mnMatchCode = data.matchCode;
      mnLocal = null;
      $('mancalaMatchCodeValue').textContent = data.matchCode || '------';
      showScreen('mancala');
    });
  }

  /* ================================================
     8-BALL POOL -- CLIENT
     ================================================ */
  const POOL_W = 900, POOL_H = 520;
  const PT_X = 50, PT_Y = 60;
  const PT_W = 800, PT_H = 400;
  const POOL_R = 10;
  const POOL_POCKET_R = 18;
  const POOL_FRICTION = 0.993;
  const POOL_STOP = 0.3;
  const POOL_DT = 1 / 120;
  const POOL_MAX_POWER = 20;
  const POOL_POWER_SCALE = 60;
  const MAX_STEPS_LOCAL = 15000;
  const POOL_POCKETS = [
    { x: 0, y: 0 }, { x: PT_W / 2, y: 0 }, { x: PT_W, y: 0 },
    { x: 0, y: PT_H }, { x: PT_W / 2, y: PT_H }, { x: PT_W, y: PT_H }
  ];

  // Standard pool ball colors
  const POOL_COLORS = [
    '#ffffff', // 0 = cue (white)
    '#fdd835', // 1 yellow
    '#1565c0', // 2 blue
    '#c62828', // 3 red
    '#6a1b9a', // 4 purple
    '#ef6c00', // 5 orange
    '#2e7d32', // 6 green
    '#6d4c41', // 7 maroon
    '#212121', // 8 black
    '#fdd835', // 9 yellow stripe
    '#1565c0', // 10 blue stripe
    '#c62828', // 11 red stripe
    '#6a1b9a', // 12 purple stripe
    '#ef6c00', // 13 orange stripe
    '#2e7d32', // 14 green stripe
    '#6d4c41'  // 15 maroon stripe
  ];

  let poolCanvas, poolCtx;
  let poolGameLoopActive = false;
  let poolMyIndex = -1;
  let poolState = null;
  let poolLocal = null;
  let poolAiming = false;
  let poolAimStart = null;
  let poolAimCurrent = null;
  let poolAnimating = false;
  let poolAnimBalls = null;
  let poolMatchCode = null;
  let poolOpponentInfo = null;
  let poolAnimStepsLeft = 0;
  // Cue stroke animation state
  let poolCueStroke = null;       // { angle, power, startTime, duration, cx, cy }
  let poolPendingUpdate = null;   // server response buffered until stroke finishes
  let poolUpdateQueue = [];       // queued updates that arrived during animation

  function setupPoolCanvas() {
    poolCanvas = $('poolCanvas');
    if (!poolCanvas) return;
    poolCanvas.width = POOL_W;
    poolCanvas.height = POOL_H;
    poolCtx = poolCanvas.getContext('2d');
    poolCanvas.addEventListener('mousedown', poolHandleMouseDown);
    poolCanvas.addEventListener('mousemove', poolHandleMouseMove);
    poolCanvas.addEventListener('mouseup', poolHandleMouseUp);
    poolCanvas.addEventListener('mouseleave', poolHandleMouseUp);
    poolCanvas.addEventListener('touchstart', poolHandleTouchStart, { passive: false });
    poolCanvas.addEventListener('touchmove', poolHandleTouchMove, { passive: false });
    poolCanvas.addEventListener('touchend', poolHandleTouchEnd, { passive: false });
    poolCanvas.addEventListener('touchcancel', poolHandleTouchEnd, { passive: false });
  }

  function poolHandleTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    poolHandleMouseDown({ clientX: t.clientX, clientY: t.clientY });
  }
  function poolHandleTouchMove(e) {
    e.preventDefault();
    const t = e.touches[0];
    poolHandleMouseMove({ clientX: t.clientX, clientY: t.clientY });
  }
  function poolHandleTouchEnd(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    poolHandleMouseUp({ clientX: t.clientX, clientY: t.clientY });
  }

  function startPoolGameLoop() {
    poolGameLoopActive = true;
    function loop() {
      if (!poolGameLoopActive) return;
      // Cue stroke phase: check if stroke finished
      if (poolCueStroke) {
        const elapsed = performance.now() - poolCueStroke.startTime;
        if (elapsed >= poolCueStroke.duration) {
          poolCueStroke = null;
          // Stroke done — start ball simulation if server result arrived
          if (poolPendingUpdate) {
            poolStartAnimation(poolPendingUpdate);
            poolPendingUpdate = null;
          }
        }
      }
      // Ball physics phase
      if (poolAnimating && poolAnimBalls) poolStepAnimation();
      renderPool();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ---- Pool rendering ---- */

  function poolBallType(id) {
    if (id === 0) return 'cue';
    if (id >= 1 && id <= 7) return 'solid';
    if (id === 8) return 'eight';
    return 'stripe';
  }

  function drawPoolBall(ctx, x, y, ball) {
    const r = POOL_R;
    const color = POOL_COLORS[ball.id] || '#888';
    const isStripe = ball.id >= 9 && ball.id <= 15;

    // Ball shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 1.5, r, 0, Math.PI * 2);
    ctx.fill();

    if (isStripe) {
      // White base
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // Colored stripe band (middle section)
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(x - r, y - r * 0.5, r * 2, r);
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Number circle (except cue ball)
    if (ball.id !== 0) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `bold ${Math.floor(r * 0.8)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('' + ball.id, x, y + 0.5);
    }

    // Outline
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function renderPool() {
    if (!poolCtx) return;
    const ctx = poolCtx;
    const state = poolAnimating && poolAnimBalls ? { balls: poolAnimBalls } : (poolState || {});
    const balls = state.balls || [];

    ctx.clearRect(0, 0, POOL_W, POOL_H);

    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, POOL_W, POOL_H);

    // Table rail border (brown wood)
    ctx.fillStyle = '#5d3a1a';
    ctx.beginPath();
    ctx.roundRect(PT_X - 14, PT_Y - 14, PT_W + 28, PT_H + 28, 10);
    ctx.fill();

    // Felt surface (green)
    ctx.fillStyle = '#1b6b3a';
    ctx.fillRect(PT_X, PT_Y, PT_W, PT_H);

    // Rail edge highlights
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(PT_X - 14, PT_Y - 14, PT_W + 28, PT_H + 28, 10);
    ctx.stroke();

    // Draw pockets
    for (const p of POOL_POCKETS) {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(PT_X + p.x, PT_Y + p.y, POOL_POCKET_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.arc(PT_X + p.x, PT_Y + p.y, POOL_POCKET_R - 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head string line (1/4 mark)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PT_X + PT_W * 0.25, PT_Y);
    ctx.lineTo(PT_X + PT_W * 0.25, PT_Y + PT_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw balls
    for (const b of balls) {
      if (b.pocketed) continue;
      drawPoolBall(ctx, PT_X + b.x, PT_Y + b.y, b);
    }

    // Ball-in-hand indicator
    const ps = poolLocal ? poolLocal.state : poolState;
    if (ps && ps.ballInHand && !poolAnimating) {
      const isMyTurn = poolLocal ? true : (ps.currentTurn === poolMyIndex);
      if (isMyTurn) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        const cue = balls.find(b => b.id === 0);
        if (cue) {
          ctx.beginPath();
          ctx.arc(PT_X + cue.x, PT_Y + cue.y, POOL_R + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // Info text
        ctx.fillStyle = '#ffd700';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click on the table to place the cue ball', POOL_W / 2, PT_Y + PT_H + 30);
      }
    }

    // Aiming visuals
    if (poolAiming && poolAimStart && poolAimCurrent && !poolAnimating) {
      const cue = balls.find(b => b.id === 0);
      if (cue) {
        const cx = PT_X + cue.x, cy = PT_Y + cue.y;
        // Direction: from drag point back through cue ball (opposite of pull)
        const dx = poolAimStart.x - poolAimCurrent.x;
        const dy = poolAimStart.y - poolAimCurrent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
          const angle = Math.atan2(dy, dx);
          const power = Math.min(dist / 5, POOL_MAX_POWER);
          const powerFrac = power / POOL_MAX_POWER;

          // Aim line (dotted)
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * 200, cy + Math.sin(angle) * 200);
          ctx.stroke();
          ctx.setLineDash([]);

          // Cue stick (behind cue ball)
          const stickLen = 180;
          const pullBack = 10 + powerFrac * 60;
          const sx = cx - Math.cos(angle) * pullBack;
          const sy = cy - Math.sin(angle) * pullBack;
          const ex = sx - Math.cos(angle) * stickLen;
          const ey = sy - Math.sin(angle) * stickLen;

          ctx.strokeStyle = '#d4a55a';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // Cue tip
          ctx.strokeStyle = '#eee';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - Math.cos(angle) * 6, sy - Math.sin(angle) * 6);
          ctx.stroke();

          // Power bar
          const barX = POOL_W - 40, barY = PT_Y + 20, barH = PT_H - 40;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(barX, barY, 16, barH);
          const green = [0x34, 0xc7, 0x59];
          const red = [0xff, 0x2d, 0x55];
          const r = Math.round(green[0] + (red[0] - green[0]) * powerFrac);
          const g = Math.round(green[1] + (red[1] - green[1]) * powerFrac);
          const bl = Math.round(green[2] + (red[2] - green[2]) * powerFrac);
          ctx.fillStyle = `rgb(${r},${g},${bl})`;
          const fillH = barH * powerFrac;
          ctx.fillRect(barX, barY + barH - fillH, 16, fillH);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, barY, 16, barH);
        }
      }
    }

    // Cue stroke animation
    if (poolCueStroke && !poolAnimating) {
      const s = poolCueStroke;
      const elapsed = performance.now() - s.startTime;
      const t = Math.min(1, elapsed / s.duration);
      // Ease-in curve for acceleration feel
      const ease = t * t;
      const cx = PT_X + s.cx, cy = PT_Y + s.cy;
      const stickLen = 180;
      const powerFrac = s.power / POOL_MAX_POWER;
      const pullBack = 10 + powerFrac * 60;
      // Interpolate from pulled-back to contact (offset 0)
      const offset = pullBack * (1 - ease);
      const sx = cx - Math.cos(s.angle) * offset;
      const sy = cy - Math.sin(s.angle) * offset;
      const ex = sx - Math.cos(s.angle) * stickLen;
      const ey = sy - Math.sin(s.angle) * stickLen;

      // Cue stick body
      ctx.strokeStyle = '#d4a55a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Cue tip
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - Math.cos(s.angle) * 6, sy - Math.sin(s.angle) * 6);
      ctx.stroke();
    }

    // Pocketed ball tally on sides
    if (ps && ps.playerGroups) {
      const allBalls = ps.balls || balls;
      const pocketed0 = allBalls.filter(b => b.pocketed && b.id !== 0 && b.id !== 8 &&
        ((ps.playerGroups[0] === 'solid' && b.id >= 1 && b.id <= 7) ||
         (ps.playerGroups[0] === 'stripe' && b.id >= 9 && b.id <= 15)));
      const pocketed1 = allBalls.filter(b => b.pocketed && b.id !== 0 && b.id !== 8 &&
        ((ps.playerGroups[1] === 'solid' && b.id >= 1 && b.id <= 7) ||
         (ps.playerGroups[1] === 'stripe' && b.id >= 9 && b.id <= 15)));

      const p0Balls = poolMyIndex === 0 ? pocketed0 : pocketed1;
      const p1Balls = poolMyIndex === 0 ? pocketed1 : pocketed0;

      // My pocketed balls (bottom)
      p0Balls.forEach((b, i) => {
        drawPoolBall(ctx, PT_X + 30 + i * 22, PT_Y + PT_H + 38, b);
      });
      // Opponent pocketed balls (top)
      p1Balls.forEach((b, i) => {
        drawPoolBall(ctx, PT_X + 30 + i * 22, PT_Y - 28, b);
      });
    }

    // Turn badge
    if (ps && !ps.gameOver && !poolAnimating) {
      const badge = $('poolTurnBadge');
      if (badge) {
        if (poolLocal) {
          badge.textContent = 'Player ' + (ps.currentTurn + 1) + "'s Turn";
          badge.style.color = ps.currentTurn === 0 ? '#ff2d55' : '#34c759';
        } else {
          const myTurn = ps.currentTurn === poolMyIndex;
          badge.textContent = myTurn ? 'YOUR TURN' : "OPPONENT'S TURN";
          badge.style.color = myTurn ? '#34c759' : '#ff2d55';
        }
      }
    }

    // Info text
    if (ps && ps.turnMessage && !poolAnimating && !poolCueStroke) {
      const info = $('poolInfo');
      if (info) info.textContent = ps.turnMessage;
    }
  }

  /* ---- Pool aiming & input ---- */

  function poolMousePos(e) {
    const rect = poolCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (POOL_W / rect.width),
      y: (e.clientY - rect.top) * (POOL_H / rect.height)
    };
  }

  function poolHandleMouseDown(e) {
    if (poolAnimating || poolCueStroke) return;
    const ps = poolLocal ? poolLocal.state : poolState;
    if (!ps || ps.gameOver) return;
    const isMyTurn = poolLocal ? true : (ps.currentTurn === poolMyIndex);
    if (!isMyTurn) return;

    const pos = poolMousePos(e);
    const balls = ps.balls || [];

    // Ball-in-hand: place cue ball
    if (ps.ballInHand) {
      const tx = pos.x - PT_X, ty = pos.y - PT_Y;
      if (tx >= POOL_R && tx <= PT_W - POOL_R && ty >= POOL_R && ty <= PT_H - POOL_R) {
        if (poolLocal) {
          const result = poolLocalPlaceCue(tx, ty);
          if (result && result.valid) {
            poolLocal.state = { ...poolLocal.state, ...result };
          }
        } else {
          socket.emit('pool:placeCue', { x: tx, y: ty });
        }
      }
      return;
    }

    // Check if clicking near cue ball to aim
    const cue = balls.find(b => b.id === 0 && !b.pocketed);
    if (!cue) return;
    const cx = PT_X + cue.x, cy = PT_Y + cue.y;
    const dx = pos.x - cx, dy = pos.y - cy;
    // Allow aiming from anywhere on the table (not just near cue ball)
    if (pos.x >= PT_X && pos.x <= PT_X + PT_W && pos.y >= PT_Y && pos.y <= PT_Y + PT_H) {
      poolAiming = true;
      poolAimStart = pos;
      poolAimCurrent = pos;
    }
  }

  function poolHandleMouseMove(e) {
    if (!poolAiming) return;
    poolAimCurrent = poolMousePos(e);
  }

  function poolHandleMouseUp(e) {
    if (!poolAiming) return;
    poolAiming = false;

    const ps = poolLocal ? poolLocal.state : poolState;
    if (!ps || ps.ballInHand || ps.gameOver) { poolAimStart = null; poolAimCurrent = null; return; }

    const pos = poolMousePos(e);
    const dx = poolAimStart.x - pos.x;
    const dy = poolAimStart.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    poolAimStart = null;
    poolAimCurrent = null;

    if (dist < 5) return; // too short, ignore

    const angle = Math.atan2(dy, dx);
    const power = Math.min(dist / 5, POOL_MAX_POWER);

    if (poolLocal) {
      // Capture cue position before simulation mutates it
      const cuePre = poolLocal.state.balls.find(b => b.id === 0 && !b.pocketed);
      const cueCx = cuePre ? cuePre.x : 0, cueCy = cuePre ? cuePre.y : 0;
      const result = poolLocalShoot(angle, power);
      if (result && result.valid) {
        poolCueStroke = {
          angle, power, startTime: performance.now(),
          duration: 250 + (1 - power / POOL_MAX_POWER) * 150,
          cx: cueCx, cy: cueCy
        };
        poolPendingUpdate = result;
      }
    } else {
      // Online: send shot, play cue stroke while waiting for server
      const ps = poolState;
      const cue = ps && ps.balls ? ps.balls.find(b => b.id === 0 && !b.pocketed) : null;
      if (cue) {
        poolCueStroke = {
          angle, power, startTime: performance.now(),
          duration: 250 + (1 - power / POOL_MAX_POWER) * 150,
          cx: cue.x, cy: cue.y
        };
      }
      socket.emit('pool:shoot', { angle, power });
    }
  }

  /* ---- Pool animation ---- */

  // Start a shot update: cue stroke → ball simulation
  function poolPlayShotUpdate(data) {
    const balls = poolState ? poolState.balls : null;
    const cue = balls ? balls.find(b => b.id === 0 && !b.pocketed) : null;
    if (cue) {
      poolCueStroke = {
        angle: data.shotAngle, power: data.shotPower,
        startTime: performance.now(),
        duration: 250 + (1 - data.shotPower / POOL_MAX_POWER) * 150,
        cx: cue.x, cy: cue.y
      };
      poolPendingUpdate = data;
    } else {
      poolStartAnimation(data);
    }
  }

  // Process queued updates one at a time after current animation finishes
  function poolDrainQueue() {
    while (poolUpdateQueue.length > 0) {
      const item = poolUpdateQueue.shift();
      if (item.type === 'state') {
        // Non-shot update: apply immediately
        poolState = { ...poolState, ...item.data };
        if (item.data.turnMessage) {
          const info = $('poolInfo');
          if (info) info.textContent = item.data.turnMessage;
        }
        poolUpdateGroupLabels(poolState);
      } else if (item.type === 'shot') {
        // Shot update: start cue stroke + simulation, then stop draining
        poolPlayShotUpdate(item.data);
        poolUpdateGroupLabels(poolState);
        return; // will drain more when this animation finishes
      } else if (item.type === 'over') {
        if (poolState) poolState.gameOver = true;
        setTimeout(() => showGameOverOverlay(item.data), 1500);
        return;
      }
    }
  }

  function poolStartAnimation(data) {
    if (!data || data.shotAngle === undefined) {
      // Non-shot update (e.g., placeCue) — just apply state
      if (!poolLocal) {
        poolState = { ...poolState, ...data };
      }
      return;
    }

    // For local mode, data.balls = pre-shot snapshot (poolLocalShoot saves it).
    // For online mode, data.balls = server final positions; poolState.balls is still
    // pre-shot (we buffered during cue stroke, never applied to poolState yet).
    let preBalls;
    if (poolLocal) {
      // data.balls is the pre-shot snapshot from poolLocalShoot
      preBalls = data.balls.map(b => ({ ...b }));
    } else {
      // poolState still has pre-shot positions (update was buffered)
      preBalls = (poolState && poolState.balls) ? poolState.balls.map(b => ({ ...b })) : [];
    }

    // Apply shot velocity to cue ball for animation
    const cue = preBalls.find(b => b.id === 0 && !b.pocketed);
    if (cue) {
      cue.vx = Math.cos(data.shotAngle) * data.shotPower * POOL_POWER_SCALE;
      cue.vy = Math.sin(data.shotAngle) * data.shotPower * POOL_POWER_SCALE;
      poolAnimBalls = preBalls;
      poolAnimating = true;
      poolAnimStepsLeft = 4000;

      // Save authoritative end state (snapped to when animation finishes)
      if (!poolLocal) {
        poolState = { ...poolState, ...data };
      }
      // For local mode, poolLocal.state is already post-simulation
    } else {
      if (!poolLocal) poolState = { ...poolState, ...data };
    }
  }

  function poolStepAnimation() {
    if (!poolAnimBalls) { poolAnimating = false; return; }

    // Adaptive substeps: measure max ball speed, run more substeps when fast,
    // fewer when slow so deceleration is visible and natural.
    let maxSpd = 0;
    for (const b of poolAnimBalls) {
      if (b.pocketed) continue;
      const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (spd > maxSpd) maxSpd = spd;
    }
    // Gentle curve: fast (1200) → 4, medium (200) → 3, slow → 2 (near real-time)
    const subsPerFrame = Math.max(2, Math.min(4, Math.round(2 + Math.sqrt(maxSpd) * 0.05)));

    for (let sub = 0; sub < subsPerFrame; sub++) {
      let allStopped = true;

      // Move balls
      for (const b of poolAnimBalls) {
        if (b.pocketed) continue;
        if (Math.abs(b.vx) > POOL_STOP || Math.abs(b.vy) > POOL_STOP) {
          allStopped = false;
          b.x += b.vx * POOL_DT;
          b.y += b.vy * POOL_DT;
        }
      }

      // Ball-ball collisions
      for (let i = 0; i < poolAnimBalls.length; i++) {
        const b1 = poolAnimBalls[i];
        if (b1.pocketed) continue;
        for (let j = i + 1; j < poolAnimBalls.length; j++) {
          const b2 = poolAnimBalls[j];
          if (b2.pocketed) continue;
          const dx = b2.x - b1.x, dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < POOL_R * 2 && dist > 0) {
            const overlap = POOL_R * 2 - dist;
            const nx = dx / dist, ny = dy / dist;
            b1.x -= nx * overlap / 2;
            b1.y -= ny * overlap / 2;
            b2.x += nx * overlap / 2;
            b2.y += ny * overlap / 2;
            const dvx = b1.vx - b2.vx, dvy = b1.vy - b2.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              b1.vx -= dot * nx; b1.vy -= dot * ny;
              b2.vx += dot * nx; b2.vy += dot * ny;
            }
          }
        }
      }

      // Wall collisions
      for (const b of poolAnimBalls) {
        if (b.pocketed) continue;
        const nearPocket = POOL_POCKETS.some(p => {
          const ddx = b.x - p.x, ddy = b.y - p.y;
          return Math.sqrt(ddx * ddx + ddy * ddy) < POOL_POCKET_R * 1.5;
        });
        if (!nearPocket) {
          if (b.x < POOL_R) { b.x = POOL_R; b.vx = Math.abs(b.vx) * 0.8; }
          if (b.x > PT_W - POOL_R) { b.x = PT_W - POOL_R; b.vx = -Math.abs(b.vx) * 0.8; }
          if (b.y < POOL_R) { b.y = POOL_R; b.vy = Math.abs(b.vy) * 0.8; }
          if (b.y > PT_H - POOL_R) { b.y = PT_H - POOL_R; b.vy = -Math.abs(b.vy) * 0.8; }
        }
      }

      // Pocket detection
      for (const b of poolAnimBalls) {
        if (b.pocketed) continue;
        for (const p of POOL_POCKETS) {
          const ddx = b.x - p.x, ddy = b.y - p.y;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < POOL_POCKET_R) {
            b.pocketed = true;
            b.vx = 0; b.vy = 0;
            break;
          }
        }
      }

      // Friction
      for (const b of poolAnimBalls) {
        if (b.pocketed) continue;
        b.vx *= POOL_FRICTION;
        b.vy *= POOL_FRICTION;
        if (Math.sqrt(b.vx * b.vx + b.vy * b.vy) < POOL_STOP) {
          b.vx = 0; b.vy = 0;
        }
      }

      if (allStopped) {
        poolAnimFinished();
        return;
      }
    }

    poolAnimStepsLeft -= subsPerFrame;
    if (poolAnimStepsLeft <= 0) {
      poolAnimFinished();
    }
  }

  function poolAnimFinished() {
    poolAnimating = false;
    poolAnimBalls = null;
    // Update info text from authoritative state
    const ps = poolLocal ? poolLocal.state : poolState;
    if (ps && ps.turnMessage) {
      const info = $('poolInfo');
      if (info) info.textContent = ps.turnMessage;
    }
    poolUpdateGroupLabels(ps);
    // Process any queued updates (opponent shots, game over, etc.)
    if (poolUpdateQueue.length > 0) {
      poolDrainQueue();
    }
  }

  /* ---- Pool local mode ---- */

  function startLocalPoolGame() {
    // Initialize a local pool game state
    const balls = [];
    balls.push({ id: 0, x: PT_W * 0.25, y: PT_H / 2, vx: 0, vy: 0, pocketed: false });

    // Rack balls
    const cx = PT_W * 0.72, cy = PT_H / 2;
    const spacing = POOL_R * 2.05;
    const positions = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        positions.push({
          x: cx + row * spacing * Math.cos(Math.PI / 6),
          y: cy + (col - row / 2) * spacing
        });
      }
    }

    const solids = [1, 2, 3, 4, 5, 6, 7];
    const stripes = [9, 10, 11, 12, 13, 14, 15];
    for (let i = solids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [solids[i], solids[j]] = [solids[j], solids[i]];
    }
    for (let i = stripes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stripes[i], stripes[j]] = [stripes[j], stripes[i]];
    }

    const assignment = new Array(15).fill(0);
    assignment[4] = 8;
    assignment[10] = solids.pop();
    assignment[14] = stripes.pop();
    const remaining = [...solids, ...stripes];
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    let ri = 0;
    for (let i = 0; i < 15; i++) {
      if (assignment[i] === 0) assignment[i] = remaining[ri++];
    }
    for (let i = 0; i < 15; i++) {
      balls.push({ id: assignment[i], x: positions[i].x, y: positions[i].y, vx: 0, vy: 0, pocketed: false });
    }

    poolLocal = {
      state: {
        balls,
        currentTurn: 0,
        playerGroups: [null, null],
        phase: 'playing',
        ballInHand: true,
        gameOver: false,
        winner: null,
        foulReason: null,
        lastPocketed: [],
        turnMessage: 'Player 1: Place the cue ball to break!'
      }
    };
    poolMyIndex = 0;
    poolAnimating = false;
    poolAnimBalls = null;
    poolAiming = false;

    $('poolMyName').textContent = 'Player 1';
    $('poolOppName').textContent = 'Player 2';
    $('poolMyGroup').textContent = '';
    $('poolOppGroup').textContent = '';
    $('poolMatchCodeValue').textContent = 'LOCAL';
    $('poolInfo').textContent = 'Player 1: Place the cue ball to break!';
    showScreen('pool');
  }

  function poolLocalPlaceCue(x, y) {
    const st = poolLocal.state;
    if (!st.ballInHand) return { valid: false };
    if (x < POOL_R || x > PT_W - POOL_R || y < POOL_R || y > PT_H - POOL_R) return { valid: false };
    for (const b of st.balls) {
      if (b.id === 0 || b.pocketed) continue;
      const dx = x - b.x, dy = y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < POOL_R * 2.2) return { valid: false };
    }
    const cue = st.balls.find(b => b.id === 0);
    cue.x = x; cue.y = y; cue.pocketed = false;
    st.ballInHand = false;
    st.foulReason = null;
    st.turnMessage = '';
    return { valid: true, balls: st.balls.map(b => ({ ...b })), ballInHand: false };
  }

  function poolLocalShoot(angle, power) {
    const st = poolLocal.state;
    if (st.ballInHand || st.gameOver) return { valid: false };
    if (power <= 0 || power > POOL_MAX_POWER) return { valid: false };

    // Snapshot pre-shot for animation
    const preBalls = st.balls.map(b => ({ ...b }));

    const cue = st.balls.find(b => b.id === 0);
    cue.vx = Math.cos(angle) * power * POOL_POWER_SCALE;
    cue.vy = Math.sin(angle) * power * POOL_POWER_SCALE;

    // Simulate
    const simResult = poolLocalSimulate(st.balls);

    // Evaluate
    poolLocalEvaluate(st, simResult);

    return {
      valid: true,
      ...st,
      shotAngle: angle,
      shotPower: power,
      balls: preBalls // animation starts from pre-shot positions
    };
  }

  function poolLocalSimulate(balls) {
    const pocketed = [];
    let firstHitId = null, hitAnyBall = false;

    for (let step = 0; step < MAX_STEPS_LOCAL; step++) {
      let allStopped = true;
      for (const b of balls) {
        if (b.pocketed) continue;
        if (Math.abs(b.vx) > POOL_STOP || Math.abs(b.vy) > POOL_STOP) {
          allStopped = false;
          b.x += b.vx * POOL_DT;
          b.y += b.vy * POOL_DT;
        }
      }
      if (allStopped && step > 0) break;

      const active = balls.filter(b => !b.pocketed);
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const b1 = active[i], b2 = active[j];
          const dx = b2.x - b1.x, dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < POOL_R * 2 && dist > 0) {
            if (!hitAnyBall && (b1.id === 0 || b2.id === 0)) {
              firstHitId = b1.id === 0 ? b2.id : b1.id;
              hitAnyBall = true;
            }
            const overlap = POOL_R * 2 - dist;
            const nx = dx / dist, ny = dy / dist;
            b1.x -= nx * overlap / 2; b1.y -= ny * overlap / 2;
            b2.x += nx * overlap / 2; b2.y += ny * overlap / 2;
            const dvx = b1.vx - b2.vx, dvy = b1.vy - b2.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              b1.vx -= dot * nx; b1.vy -= dot * ny;
              b2.vx += dot * nx; b2.vy += dot * ny;
            }
          }
        }
      }

      for (const b of balls) {
        if (b.pocketed) continue;
        const nearPocket = POOL_POCKETS.some(p => {
          const ddx = b.x - p.x, ddy = b.y - p.y;
          return Math.sqrt(ddx * ddx + ddy * ddy) < POOL_POCKET_R * 1.5;
        });
        if (!nearPocket) {
          if (b.x < POOL_R) { b.x = POOL_R; b.vx = Math.abs(b.vx) * 0.8; }
          if (b.x > PT_W - POOL_R) { b.x = PT_W - POOL_R; b.vx = -Math.abs(b.vx) * 0.8; }
          if (b.y < POOL_R) { b.y = POOL_R; b.vy = Math.abs(b.vy) * 0.8; }
          if (b.y > PT_H - POOL_R) { b.y = PT_H - POOL_R; b.vy = -Math.abs(b.vy) * 0.8; }
        }
      }

      for (const b of balls) {
        if (b.pocketed) continue;
        for (const p of POOL_POCKETS) {
          const ddx = b.x - p.x, ddy = b.y - p.y;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < POOL_POCKET_R) {
            b.pocketed = true;
            b.vx = 0; b.vy = 0;
            pocketed.push(b.id);
            break;
          }
        }
      }

      for (const b of balls) {
        if (b.pocketed) continue;
        b.vx *= POOL_FRICTION; b.vy *= POOL_FRICTION;
        if (Math.sqrt(b.vx * b.vx + b.vy * b.vy) < POOL_STOP) { b.vx = 0; b.vy = 0; }
      }
    }

    for (const b of balls) { b.vx = 0; b.vy = 0; }
    return { pocketed, firstHitId, hitAnyBall };
  }

  function poolLocalEvaluate(st, simResult) {
    const { pocketed, firstHitId, hitAnyBall } = simResult;
    st.lastPocketed = pocketed;
    st.foulReason = null;
    st.turnMessage = '';

    const cuePocketed = pocketed.includes(0);
    const eightPocketed = pocketed.includes(8);
    const opponent = 1 - st.currentTurn;
    const myGroup = st.playerGroups[st.currentTurn];

    if (eightPocketed) {
      if (myGroup) {
        const myBallsLeft = st.balls.filter(b => !b.pocketed && b.id !== 0 && b.id !== 8 && poolBallType(b.id) === myGroup);
        if (myBallsLeft.length === 0 && !cuePocketed) {
          st.gameOver = true; st.phase = 'over'; st.winner = st.currentTurn;
          st.turnMessage = 'Player ' + (st.currentTurn + 1) + ' wins!';
          setTimeout(() => showGameOverOverlay({ winner: st.currentTurn, winnerUsername: 'Player ' + (st.currentTurn + 1), reason: st.turnMessage }), 1500);
          return;
        }
      }
      st.gameOver = true; st.phase = 'over'; st.winner = opponent;
      st.turnMessage = 'Player ' + (st.currentTurn + 1) + ' pocketed the 8-ball illegally!';
      setTimeout(() => showGameOverOverlay({ winner: opponent, winnerUsername: 'Player ' + (opponent + 1), reason: st.turnMessage }), 1500);
      return;
    }

    if (cuePocketed) {
      st.foulReason = 'Scratch! Cue ball pocketed.';
    } else if (!hitAnyBall) {
      st.foulReason = 'Foul! Cue ball did not hit any ball.';
    } else if (myGroup && firstHitId !== null) {
      const firstHitType = poolBallType(firstHitId);
      if (firstHitType !== myGroup && firstHitType !== 'eight') {
        const myBallsLeft = st.balls.filter(b => !b.pocketed && b.id !== 0 && b.id !== 8 && poolBallType(b.id) === myGroup);
        if (myBallsLeft.length > 0) st.foulReason = 'Foul! Must hit your own group first.';
      }
    }

    if (!st.playerGroups[0] && !st.foulReason) {
      const pocketedSolids = pocketed.filter(id => poolBallType(id) === 'solid');
      const pocketedStripes = pocketed.filter(id => poolBallType(id) === 'stripe');
      if (pocketedSolids.length > 0 && pocketedStripes.length === 0) {
        st.playerGroups[st.currentTurn] = 'solid';
        st.playerGroups[opponent] = 'stripe';
        st.turnMessage = 'Player ' + (st.currentTurn + 1) + ' is Solids!';
        poolUpdateGroupLabels(st);
      } else if (pocketedStripes.length > 0 && pocketedSolids.length === 0) {
        st.playerGroups[st.currentTurn] = 'stripe';
        st.playerGroups[opponent] = 'solid';
        st.turnMessage = 'Player ' + (st.currentTurn + 1) + ' is Stripes!';
        poolUpdateGroupLabels(st);
      }
    }

    if (st.foulReason) {
      st.turnMessage = st.foulReason;
      if (cuePocketed) {
        const cue = st.balls.find(b => b.id === 0);
        cue.pocketed = false;
        cue.x = PT_W * 0.25; cue.y = PT_H / 2;
      }
      st.currentTurn = opponent;
      st.ballInHand = true;
      return;
    }

    const updatedGroup = st.playerGroups[st.currentTurn];
    if (updatedGroup) {
      const legalPockets = pocketed.filter(id => poolBallType(id) === updatedGroup);
      if (legalPockets.length > 0) {
        st.turnMessage = st.turnMessage || 'Nice shot!';
        return;
      }
    } else if (pocketed.length > 0) {
      st.turnMessage = st.turnMessage || 'Nice shot!';
      return;
    }

    st.currentTurn = opponent;
    st.turnMessage = st.turnMessage || '';
  }

  function poolUpdateGroupLabels(st) {
    if (!st || !st.playerGroups) return;
    const myG = poolLocal ? st.playerGroups[0] : st.playerGroups[poolMyIndex];
    const oppG = poolLocal ? st.playerGroups[1] : st.playerGroups[1 - poolMyIndex];
    const myLabel = $('poolMyGroup');
    const oppLabel = $('poolOppGroup');
    if (myLabel) myLabel.textContent = myG ? ('(' + myG.charAt(0).toUpperCase() + myG.slice(1) + 's)') : '';
    if (oppLabel) oppLabel.textContent = oppG ? ('(' + oppG.charAt(0).toUpperCase() + oppG.slice(1) + 's)') : '';
  }

  /* ---- Pool socket events ---- */

  function bindPoolEvents(s) {
    s.on('pool:start', (data) => {
      poolMyIndex = data.playerIndex;
      poolState = data;
      poolMatchCode = data.matchCode;
      poolLocal = null;
      poolAnimating = false;
      poolAnimBalls = null;
      poolAiming = false;
      poolCueStroke = null;
      poolPendingUpdate = null;
      poolUpdateQueue = [];
      poolOpponentInfo = data.players[1 - poolMyIndex] || { username: 'Opponent' };

      $('poolMyName').textContent = data.players[poolMyIndex]?.username || 'You';
      $('poolOppName').textContent = poolOpponentInfo.username;
      $('poolMyGroup').textContent = '';
      $('poolOppGroup').textContent = '';
      $('poolMatchCodeValue').textContent = data.matchCode || '------';
      $('poolInfo').textContent = data.ballInHand ? 'Place the cue ball to break!' : '';
      showScreen('pool');
    });

    s.on('pool:update', (data) => {
      const busy = poolCueStroke || poolAnimating;

      if (data.shotAngle !== undefined && data.shotPower !== undefined) {
        if (poolCueStroke && !poolPendingUpdate) {
          // Our own shot: stroke still playing, this is the server result for it
          poolPendingUpdate = data;
        } else if (busy) {
          // Another shot arrived while busy — queue it
          poolUpdateQueue.push({ type: 'shot', data });
        } else {
          // Idle — play opponent's cue stroke then simulation
          poolPlayShotUpdate(data);
        }
      } else {
        if (busy) {
          // Non-shot update (placement, etc.) arrived while busy — queue it
          poolUpdateQueue.push({ type: 'state', data });
        } else {
          poolState = { ...poolState, ...data };
          if (data.turnMessage) {
            const info = $('poolInfo');
            if (info) info.textContent = data.turnMessage;
          }
          poolUpdateGroupLabels(poolState);
        }
      }
    });

    s.on('pool:over', (data) => {
      if (poolCueStroke || poolAnimating) {
        poolUpdateQueue.push({ type: 'over', data });
      } else {
        if (poolState) poolState.gameOver = true;
        setTimeout(() => showGameOverOverlay(data), 1500);
      }
    });

    s.on('pool:error', (data) => {
      const info = $('poolInfo');
      if (info) info.textContent = data.message || 'Error';
    });

    s.on('pool:rejoined', (data) => {
      poolMyIndex = data.playerIndex;
      poolState = data;
      poolMatchCode = data.matchCode;
      poolLocal = null;
      poolAnimating = false;
      $('poolMatchCodeValue').textContent = data.matchCode || '------';
      poolUpdateGroupLabels(poolState);
      showScreen('pool');
    });
  }

  /* ---- Pool resign ---- */
  function setupPoolResign() {
    const btn = $('btnPoolResign');
    if (btn) btn.addEventListener('click', () => {
      if (poolLocal) {
        showScreen('lobby');
        poolLocal = null;
      } else if (socket) {
        socket.emit('pool:resign');
        showScreen('lobby');
      }
    });
  }

  /* ================================================
     MAHJONG SOLITAIRE -- CLIENT
     ================================================ */
  const MJ_CANVAS_W = 760;
  const MJ_CANVAS_H = 480;
  const MJ_TILE_W = 38;
  const MJ_TILE_H = 50;
  const MJ_DEPTH = 5; // 3D layer offset pixels

  let mahjongCanvas, mahjongCtx;
  let mjGameLoopActive = false;
  let mjTiles = [];
  let mjSelected = null;
  let mjHoverTile = -1;
  let mjMoves = 0;
  let mjPairsLeft = 72;
  let mjHintsLeft = 3;
  let mjGameOver = false;
  let mjHintPair = null;

  // --- Turtle layout: 144 [layer, row, col] positions ---
  // Coordinates use half-tile grid; a tile at (r,c) occupies [r, r+1) x [c, c+1)
  const MJ_LAYOUT = (function() {
    const pos = [];
    // Layer 0 (base): 12 wide x 8 tall cross shape = 87 tiles
    // Main rectangle rows 1-6, cols 1-10 (6 rows x 10 cols = 60)
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 10; c++) pos.push([0, r, c]);
    // Top extensions: row 0, cols 3-8 (6 tiles)
    for (let c = 3; c <= 8; c++) pos.push([0, 0, c]);
    // Bottom extensions: row 7, cols 3-8 (6 tiles)
    for (let c = 3; c <= 8; c++) pos.push([0, 7, c]);
    // Left wing: rows 3-4, col 0 (2 tiles)
    pos.push([0, 3, 0]); pos.push([0, 4, 0]);
    // Right wing: rows 3-4, col 11 (2 tiles)
    pos.push([0, 3, 11]); pos.push([0, 4, 11]);
    // Far right single: row 3.5, col 12 (1 tile)
    pos.push([0, 3.5, 12]);
    // That's 60 + 6 + 6 + 2 + 2 + 1 = 77

    // Layer 1: rows 1.5-5.5 (5 rows), cols 2.5-8.5 (7 cols) = 35 but we need a rectangle
    // 4 rows x 8 cols = 32
    for (let r = 2; r <= 5; r++) for (let c = 2; c <= 9; c++) pos.push([1, r - 0.5, c - 0.5]);
    // That's 4*8 = 32, total so far = 109

    // Layer 2: 3 rows x 6 cols = 18
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) pos.push([2, 2 + r, 3 + c]);
    // Total = 127

    // Layer 3: 2 rows x 4 cols = 8
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) pos.push([3, 2.5 + r, 3.5 + c]);
    // Total = 135

    // Layer 4: 1 row x 2 cols = 2
    pos.push([4, 3, 4]); pos.push([4, 3, 5]);
    // Total = 137

    // Need 7 more to reach 144. Add side extensions to layer 0:
    // Extra left column: rows 2,5 col 0
    pos.push([0, 2, 0]); pos.push([0, 5, 0]);
    // Extra right column: rows 2,5 col 11
    pos.push([0, 2, 11]); pos.push([0, 5, 11]);
    // Bottom row extensions: row 7, cols 2 and 9
    pos.push([0, 7, 2]); pos.push([0, 7, 9]);
    // Top extension: row 0, col 2
    pos.push([0, 0, 2]);
    // Total = 144

    return pos;
  })();

  // --- Tile set generation ---
  function mjGenerateTileSet() {
    const tiles = [];
    let id = 0;
    const suits = ['bamboo', 'circle', 'character'];
    for (const suit of suits) {
      for (let rank = 1; rank <= 9; rank++) {
        for (let copy = 0; copy < 4; copy++) {
          tiles.push({ id: id++, suit, rank, type: 'suit' });
        }
      }
    }
    const winds = ['north', 'south', 'east', 'west'];
    for (const w of winds) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ id: id++, suit: 'wind', rank: w, type: 'honor' });
      }
    }
    const dragons = ['red', 'green', 'white'];
    for (const d of dragons) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ id: id++, suit: 'dragon', rank: d, type: 'honor' });
      }
    }
    for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit: 'season', rank: i, type: 'bonus' });
    for (let i = 0; i < 4; i++) tiles.push({ id: id++, suit: 'flower', rank: i, type: 'bonus' });
    return tiles;
  }

  // --- Shuffle and deal ---
  function mjDealTiles() {
    const tileSet = mjGenerateTileSet();
    for (let i = tileSet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tileSet[i], tileSet[j]] = [tileSet[j], tileSet[i]];
    }
    mjTiles = MJ_LAYOUT.map((pos, idx) => ({
      ...tileSet[idx],
      layer: pos[0], row: pos[1], col: pos[2],
      matched: false
    }));
    mjSelected = null;
    mjHoverTile = -1;
    mjMoves = 0;
    mjPairsLeft = 72;
    mjHintsLeft = 3;
    mjGameOver = false;
    mjHintPair = null;
  }

  // --- Free tile detection ---
  function mjIsFree(idx) {
    const tile = mjTiles[idx];
    if (tile.matched) return false;
    // Check covered by higher layer
    for (let i = 0; i < mjTiles.length; i++) {
      if (i === idx || mjTiles[i].matched) continue;
      const o = mjTiles[i];
      if (o.layer <= tile.layer) continue;
      if (Math.abs(o.row - tile.row) < 1 && Math.abs(o.col - tile.col) < 1) return false;
    }
    // Check side exposure: need at least one side (left or right) clear
    let blockedLeft = false, blockedRight = false;
    for (let i = 0; i < mjTiles.length; i++) {
      if (i === idx || mjTiles[i].matched) continue;
      const o = mjTiles[i];
      if (o.layer !== tile.layer) continue;
      if (Math.abs(o.row - tile.row) >= 1) continue;
      const dc = o.col - tile.col;
      if (dc > 0.5 && dc < 1.5) blockedRight = true;
      if (dc < -0.5 && dc > -1.5) blockedLeft = true;
    }
    return !blockedLeft || !blockedRight;
  }

  // --- Matching rules ---
  function mjTilesMatch(a, b) {
    if (a.type === 'bonus' && b.type === 'bonus') return a.suit === b.suit;
    return a.suit === b.suit && a.rank === b.rank;
  }

  // --- Check if any valid moves exist ---
  function mjHasValidMoves() {
    const free = [];
    for (let i = 0; i < mjTiles.length; i++) {
      if (!mjTiles[i].matched && mjIsFree(i)) free.push(i);
    }
    for (let a = 0; a < free.length; a++) {
      for (let b = a + 1; b < free.length; b++) {
        if (mjTilesMatch(mjTiles[free[a]], mjTiles[free[b]])) return true;
      }
    }
    return false;
  }

  // --- Screen position helpers ---
  function mjTileX(tile) {
    return 20 + tile.col * (MJ_TILE_W + 1) - tile.layer * MJ_DEPTH;
  }
  function mjTileY(tile) {
    return 30 + tile.row * (MJ_TILE_H + 1) - tile.layer * MJ_DEPTH;
  }

  // --- Tile symbol rendering ---
  function mjTileLabel(tile) {
    if (tile.suit === 'bamboo') return tile.rank + 'B';
    if (tile.suit === 'circle') return tile.rank + 'C';
    if (tile.suit === 'character') return tile.rank + 'W';
    if (tile.suit === 'wind') return ({ north: 'N', south: 'S', east: 'E', west: 'W' })[tile.rank];
    if (tile.suit === 'dragon') return ({ red: 'Dr', green: 'Dg', white: 'Dw' })[tile.rank];
    if (tile.suit === 'season') return 'S' + (tile.rank + 1);
    if (tile.suit === 'flower') return 'F' + (tile.rank + 1);
    return '?';
  }
  function mjTileColor(tile) {
    if (tile.suit === 'bamboo') return '#2e8b57';
    if (tile.suit === 'circle') return '#1e90ff';
    if (tile.suit === 'character') return '#dc143c';
    if (tile.suit === 'wind') return '#4a4a4a';
    if (tile.suit === 'dragon') {
      return ({ red: '#ff2d55', green: '#34c759', white: '#8e8e93' })[tile.rank];
    }
    if (tile.suit === 'season') return '#ff9500';
    if (tile.suit === 'flower') return '#af52de';
    return '#333';
  }

  // --- Canvas setup and game loop ---
  function setupMahjongCanvas() {
    mahjongCanvas = $('mahjongCanvas');
    if (!mahjongCanvas) return;
    mahjongCanvas.width = MJ_CANVAS_W;
    mahjongCanvas.height = MJ_CANVAS_H;
    mahjongCtx = mahjongCanvas.getContext('2d');
    mahjongCanvas.addEventListener('click', mjHandleClick);
    mahjongCanvas.addEventListener('mousemove', mjHandleMouseMove);
  }

  function startMahjongGameLoop() {
    mjGameLoopActive = true;
    function loop() {
      if (!mjGameLoopActive) return;
      renderMahjong();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // --- Rendering ---
  function renderMahjong() {
    if (!mahjongCtx) return;
    const ctx = mahjongCtx;
    ctx.clearRect(0, 0, MJ_CANVAS_W, MJ_CANVAS_H);

    // Background
    ctx.fillStyle = '#1a3a2a';
    ctx.fillRect(0, 0, MJ_CANVAS_W, MJ_CANVAS_H);

    // Sort: lower layer first, then top-to-bottom, left-to-right
    const sorted = mjTiles
      .map((t, i) => ({ ...t, idx: i }))
      .filter(t => !t.matched)
      .sort((a, b) => a.layer - b.layer || a.row - b.row || a.col - b.col);

    for (const tile of sorted) {
      const x = mjTileX(tile);
      const y = mjTileY(tile);
      const free = mjIsFree(tile.idx);
      const selected = mjSelected === tile.idx;
      const hinted = mjHintPair && mjHintPair.includes(tile.idx);
      const hover = mjHoverTile === tile.idx && free;

      // 3D edge (shadow)
      ctx.fillStyle = '#555544';
      ctx.fillRect(x + MJ_DEPTH, y + MJ_DEPTH, MJ_TILE_W, MJ_TILE_H);

      // Tile face
      ctx.fillStyle = selected ? '#ffffcc' : hinted ? '#ccffcc' : hover ? '#f8f8f0' : (free ? '#f5f0e0' : '#c8c3b5');
      ctx.fillRect(x, y, MJ_TILE_W, MJ_TILE_H);

      // Border
      ctx.strokeStyle = selected ? '#ff2d55' : '#8b7355';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x, y, MJ_TILE_W, MJ_TILE_H);

      // Label
      ctx.fillStyle = mjTileColor(tile);
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mjTileLabel(tile), x + MJ_TILE_W / 2, y + MJ_TILE_H / 2);
    }
  }

  // --- Hit testing: find tile at screen coords (top layer first) ---
  function mjHitTest(mx, my) {
    const sorted = mjTiles
      .map((t, i) => ({ ...t, idx: i }))
      .filter(t => !t.matched)
      .sort((a, b) => b.layer - a.layer || b.row - a.row);
    for (const tile of sorted) {
      const x = mjTileX(tile);
      const y = mjTileY(tile);
      if (mx >= x && mx <= x + MJ_TILE_W && my >= y && my <= y + MJ_TILE_H) {
        return tile.idx;
      }
    }
    return -1;
  }

  // --- Mouse handlers ---
  function mjHandleMouseMove(e) {
    if (!mahjongCanvas) return;
    const rect = mahjongCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MJ_CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (MJ_CANVAS_H / rect.height);
    mjHoverTile = mjHitTest(mx, my);
  }

  function mjHandleClick(e) {
    if (mjGameOver || !mahjongCanvas) return;
    const rect = mahjongCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MJ_CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (MJ_CANVAS_H / rect.height);

    const clickedIdx = mjHitTest(mx, my);
    if (clickedIdx === -1) { mjSelected = null; return; }
    if (!mjIsFree(clickedIdx)) return;

    if (mjSelected === null) {
      mjSelected = clickedIdx;
    } else if (mjSelected === clickedIdx) {
      mjSelected = null;
    } else {
      // Attempt match
      if (mjTilesMatch(mjTiles[mjSelected], mjTiles[clickedIdx])) {
        mjTiles[mjSelected].matched = true;
        mjTiles[clickedIdx].matched = true;
        mjMoves++;
        mjPairsLeft--;
        mjSelected = null;
        mjHintPair = null;
        $('mahjongMoves').textContent = mjMoves;
        $('mahjongPairsLeft').textContent = mjPairsLeft;

        if (mjPairsLeft === 0) {
          mjGameOver = true;
          mjShowGameOver(true);
        } else if (!mjHasValidMoves()) {
          mjGameOver = true;
          mjShowGameOver(false);
        }
      } else {
        mjSelected = clickedIdx;
      }
    }
  }

  // --- Hint ---
  function mjShowHint() {
    if (mjHintsLeft <= 0 || mjGameOver) return;
    const free = [];
    for (let i = 0; i < mjTiles.length; i++) {
      if (!mjTiles[i].matched && mjIsFree(i)) free.push(i);
    }
    for (let a = 0; a < free.length; a++) {
      for (let b = a + 1; b < free.length; b++) {
        if (mjTilesMatch(mjTiles[free[a]], mjTiles[free[b]])) {
          mjHintsLeft--;
          $('mahjongHints').textContent = mjHintsLeft;
          mjHintPair = [free[a], free[b]];
          setTimeout(() => { mjHintPair = null; }, 2000);
          return;
        }
      }
    }
    const info = $('mahjongInfo');
    if (info) info.textContent = 'No valid pairs found!';
  }

  // --- Shuffle remaining tiles ---
  function mjShuffle() {
    if (mjGameOver) return;
    const remaining = mjTiles.filter(t => !t.matched);
    const data = remaining.map(t => ({ suit: t.suit, rank: t.rank, type: t.type, id: t.id }));
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }
    let idx = 0;
    for (const tile of mjTiles) {
      if (!tile.matched) {
        tile.suit = data[idx].suit;
        tile.rank = data[idx].rank;
        tile.type = data[idx].type;
        tile.id = data[idx].id;
        idx++;
      }
    }
    mjSelected = null;
    mjHintPair = null;
    const info = $('mahjongInfo');
    if (info) info.textContent = '';
  }

  // --- Game over ---
  function mjShowGameOver(isWin) {
    const title = $('gameOverTitle');
    if (title) {
      title.textContent = isWin ? 'You Win!' : 'No Moves Left';
      title.className = isWin ? 'win' : 'lose';
    }
    const reason = $('gameOverReason');
    if (reason) reason.textContent = isWin
      ? 'Cleared all tiles in ' + mjMoves + ' moves!'
      : 'No matching pairs remain. Try again!';
    const rc = $('gameOverRating');
    if (rc) rc.innerHTML = '';
    const coinEl = $('gameOverCoins');
    if (coinEl) coinEl.textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (isWin) {
      if (typeof sfxWin === 'function') sfxWin();
      if (typeof startConfetti === 'function') startConfetti();
    } else {
      if (typeof sfxLose === 'function') sfxLose();
    }
  }

  // --- Start a new Mahjong game ---
  function startMahjongGame() {
    mjDealTiles();
    $('mahjongPairsLeft').textContent = mjPairsLeft;
    $('mahjongMoves').textContent = mjMoves;
    $('mahjongHints').textContent = mjHintsLeft;
    const info = $('mahjongInfo');
    if (info) info.textContent = '';
    $('gameOverOverlay').classList.add('hidden');
    showScreen('mahjong');
  }

  /* ================================================
     BIND NEW GAME EVENTS & BUTTONS
     ================================================ */
  function bindNewGameEvents() {
    bindC4SocketEvents();
    bindBSSocketEvents();
    bindMancalaSocketEvents();
    bindPoolEvents(socket);
    bindCardGameEvents(socket);
    bindBSButtons();
    setupPoolResign();

    // C4 resign
    const c4Resign = $('btnC4Resign');
    if (c4Resign) c4Resign.addEventListener('click', () => { if (socket) socket.emit('c4:resign'); });

    // Mancala resign
    const mnResign = $('btnMancalaResign');
    if (mnResign) mnResign.addEventListener('click', () => { if (socket) socket.emit('mancala:resign'); });

    // Copy code buttons
    const c4Copy = $('btnCopyC4Code');
    if (c4Copy) c4Copy.addEventListener('click', () => { navigator.clipboard?.writeText($('c4MatchCodeValue')?.textContent || ''); });
    const bsCopy = $('btnCopyBsCode');
    if (bsCopy) bsCopy.addEventListener('click', () => { navigator.clipboard?.writeText($('bsMatchCodeValue')?.textContent || ''); });
    const mnCopy = $('btnCopyMancalaCode');
    if (mnCopy) mnCopy.addEventListener('click', () => { navigator.clipboard?.writeText($('mancalaMatchCodeValue')?.textContent || ''); });
    const poolCopy = $('btnCopyPoolCode');
    if (poolCopy) poolCopy.addEventListener('click', () => { navigator.clipboard?.writeText($('poolMatchCodeValue')?.textContent || ''); });

    // Mahjong buttons
    const mjHint = $('btnMahjongHint');
    if (mjHint) mjHint.addEventListener('click', mjShowHint);
    const mjShuf = $('btnMahjongShuffle');
    if (mjShuf) mjShuf.addEventListener('click', mjShuffle);
    const mjNew = $('btnMahjongNewGame');
    if (mjNew) mjNew.addEventListener('click', startMahjongGame);
    const mjQuit = $('btnMahjongQuit');
    if (mjQuit) mjQuit.addEventListener('click', () => showScreen('lobby'));

    bindTouchControls();
  }

  /* ---------- Touch Controls ---------- */
  let msFlagMode = false;
  let msLongPressTimer = null;

  function touchHoldBtn(id, onDown, onUp) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); el.classList.add('active'); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); el.classList.remove('active'); }, { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); onUp(); el.classList.remove('active'); }, { passive: false });
  }

  function touchTapBtn(id, action) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, { passive: false });
  }

  function touchRepeatBtn(id, action, interval) {
    const el = $(id);
    if (!el) return;
    let timer = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } el.classList.remove('active'); };
    el.addEventListener('touchstart', (e) => { e.preventDefault(); action(); el.classList.add('active'); timer = setInterval(action, interval || 100); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); stop(); }, { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); stop(); }, { passive: false });
  }

  function bindTouchControls() {
    // --- Pinball ---
    touchHoldBtn('tchPbLeft',
      () => { pbKeysDown['ArrowLeft'] = true; },
      () => { pbKeysDown['ArrowLeft'] = false; }
    );
    touchHoldBtn('tchPbRight',
      () => { pbKeysDown['ArrowRight'] = true; },
      () => { pbKeysDown['ArrowRight'] = false; }
    );
    touchHoldBtn('tchPbPlunger',
      () => { pbKeysDown[' '] = true; if (pbBallInPlunger && !pbPlungerCharging) { pbPlungerCharging = true; pbPlungerCharge = 0; } },
      () => { pbKeysDown[' '] = false; if (pbPlungerCharging) { pbPlungerCharging = false; if (pbBallInPlunger) { pbBall.vy = -pbPlungerCharge; pbBall.vx = -1 + Math.random() * 2; pbBallInPlunger = false; } pbPlungerCharge = 0; } }
    );

    // --- JezzBall ---
    const jbToggle = $('tchJbToggle');
    if (jbToggle) {
      jbToggle.addEventListener('click', () => {
        jbHorizontal = !jbHorizontal;
        jbToggle.textContent = jbHorizontal ? '\u2194 Horizontal' : '\u2195 Vertical';
        jbUpdateHud();
      });
    }

    // --- Minesweeper ---
    const msFlag = $('tchMsFlag');
    if (msFlag) {
      msFlag.addEventListener('click', () => {
        msFlagMode = !msFlagMode;
        msFlag.textContent = msFlagMode ? '\uD83D\uDEA9 Flag Mode: ON' : '\uD83D\uDEA9 Flag Mode: OFF';
        msFlag.style.background = msFlagMode ? 'rgba(255,50,50,0.3)' : '';
      });
    }
    // Override minesweeper canvas touch to support flag mode
    const msCvs = $('minesweeperCanvas');
    if (msCvs) {
      msCvs.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (msGameOver) return;
        const t = e.touches[0];
        const rect = msCvs.getBoundingClientRect();
        const c = Math.floor((t.clientX - rect.left) * (msCvs.width / rect.width) / MS_CELL);
        const r = Math.floor((t.clientY - rect.top) * (msCvs.height / rect.height) / MS_CELL);
        if (r < 0 || r >= msRows || c < 0 || c >= msCols) return;
        if (msFlagMode) {
          // Flag mode tap = toggle flag
          if (!msGrid[r][c].revealed) {
            msGrid[r][c].flagged = !msGrid[r][c].flagged;
            msFlagged += msGrid[r][c].flagged ? 1 : -1;
            $('msRemaining').textContent = msMines - msFlagged;
          }
        } else {
          // Normal tap = reveal (same as click)
          if (msGrid[r][c].flagged) return;
          if (msGrid[r][c].revealed) { msChord(r, c); return; }
          if (msFirstClick) { msPlaceMines(r, c); msFirstClick = false; msTimer = setInterval(() => { msTime++; $('msTime').textContent = Math.floor(msTime/60) + ':' + String(msTime%60).padStart(2,'0'); }, 1000); }
          msRevealCell(r, c);
        }
      }, { passive: false });
    }

    // --- Space Invaders ---
    touchHoldBtn('tchSiLeft',
      () => { siKeysDown['ArrowLeft'] = true; },
      () => { siKeysDown['ArrowLeft'] = false; }
    );
    touchHoldBtn('tchSiRight',
      () => { siKeysDown['ArrowRight'] = true; },
      () => { siKeysDown['ArrowRight'] = false; }
    );
    touchHoldBtn('tchSiShoot',
      () => { siKeysDown[' '] = true; },
      () => { siKeysDown[' '] = false; }
    );

    // --- Tetris ---
    touchRepeatBtn('tchTetLeft', () => { tetMovePiece(-1, 0); }, 120);
    touchRepeatBtn('tchTetRight', () => { tetMovePiece(1, 0); }, 120);
    touchTapBtn('tchTetRotate', () => { tetRotate(); });
    touchRepeatBtn('tchTetDown', () => { if (tetMovePiece(0, 1)) tetScore++; }, 80);
    touchTapBtn('tchTetDrop', () => { tetHardDrop(); });

    // --- Columns ---
    touchRepeatBtn('tchColLeft', () => {
      if (colPiece && colPiece.x > 0 && !colBoard[colPiece.y][colPiece.x - 1] && !colBoard[colPiece.y + 1][colPiece.x - 1] && !colBoard[colPiece.y + 2][colPiece.x - 1]) colPiece.x--;
    }, 120);
    touchRepeatBtn('tchColRight', () => {
      if (colPiece && colPiece.x < COL_COLS - 1 && !colBoard[colPiece.y][colPiece.x + 1] && !colBoard[colPiece.y + 1][colPiece.x + 1] && !colBoard[colPiece.y + 2][colPiece.x + 1]) colPiece.x++;
    }, 120);
    touchTapBtn('tchColCycle', () => { if (colPiece) colPiece.gems.unshift(colPiece.gems.pop()); });
    touchRepeatBtn('tchColDown', () => { if (colPiece) colDropTimer = colDropInterval; }, 80);

    // --- Helicopter ---
    touchHoldBtn('tchHcFly',
      () => { if (!hcDead) hcFlying = true; },
      () => { hcFlying = false; }
    );
  }

  /* ================================================
     SHARED CARD RENDERING
     ================================================ */
  const CARD_SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
  const CARD_SUIT_SYMBOLS = ['\u2663', '\u2666', '\u2665', '\u2660'];
  const CARD_RANK_NAMES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

  function drawPlayingCard(ctx, x, y, w, h, card, faceUp, selected) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fillStyle = faceUp ? '#fff' : '#1a3a7a';
    ctx.fill();
    ctx.strokeStyle = selected ? '#ff2d55' : '#555';
    ctx.lineWidth = selected ? 3 : 1;
    ctx.stroke();

    if (!faceUp || !card) {
      ctx.fillStyle = '#2255aa';
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 4);
      ctx.fill();
      ctx.strokeStyle = '#4477cc';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }

    const isRed = card.suit === 1 || card.suit === 2;
    ctx.fillStyle = isRed ? '#cc0000' : '#111';
    const rankStr = CARD_RANK_NAMES[card.rank - 2];
    const suitStr = CARD_SUIT_SYMBOLS[card.suit];

    // Top-left rank and suit
    ctx.font = `bold ${Math.floor(h * 0.16)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(rankStr, x + 5, y + h * 0.18);
    ctx.font = `${Math.floor(h * 0.14)}px sans-serif`;
    ctx.fillText(suitStr, x + 5, y + h * 0.32);

    // Center suit symbol
    ctx.font = `${Math.floor(h * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(suitStr, x + w / 2, y + h * 0.62);

    // Bottom-right rank (rotated)
    ctx.save();
    ctx.translate(x + w - 5, y + h - 5);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'left';
    ctx.font = `bold ${Math.floor(h * 0.16)}px sans-serif`;
    ctx.fillText(rankStr, 0, h * 0.13);
    ctx.font = `${Math.floor(h * 0.14)}px sans-serif`;
    ctx.fillText(suitStr, 0, h * 0.27);
    ctx.restore();

    ctx.restore();
  }

  function drawCardBack(ctx, x, y, w, h) {
    drawPlayingCard(ctx, x, y, w, h, null, false, false);
  }

  function drawFannedHand(ctx, cards, cx, cy, maxWidth, cardW, cardH, faceUp, selectedIdx) {
    if (!cards || cards.length === 0) return;
    const overlap = Math.min(cardW * 0.4, maxWidth / (cards.length + 0.6));
    const totalW = overlap * (cards.length - 1) + cardW;
    let startX = cx - totalW / 2;
    for (let i = 0; i < cards.length; i++) {
      const sel = (selectedIdx !== undefined && selectedIdx === i);
      const yOff = sel ? -10 : 0;
      drawPlayingCard(ctx, startX + i * overlap, cy + yOff, cardW, cardH, cards[i], faceUp, sel);
    }
  }

  function drawCardPile(ctx, x, y, w, h, count) {
    const layers = Math.min(count, 4);
    for (let i = 0; i < layers; i++) {
      drawCardBack(ctx, x - i * 2, y - i * 2, w, h);
    }
    if (count > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(count.toString(), x + w / 2, y + h + 16);
    }
  }

  /* ================================================
     SOLITAIRE (KLONDIKE) — Client-only
     ================================================ */
  let solState = null;
  let solCanvas = null;
  let solCtx = null;
  let solSelected = null;    // { source, col, cardIdx }
  let solDragging = null;     // { cards, x, y, sourceCol, sourceIdx }
  let solTimer = null;
  let solStartTime = 0;
  let solMoves = 0;
  let solScore = 0;
  let solGameLoopActive = false;
  let solUndoStack = [];

  const SOL_W = 900, SOL_H = 620;
  const SOL_CW = 80, SOL_CH = 112;
  const SOL_GAP = 24, SOL_FD_GAP = 6;
  const SOL_MARGIN = 20;

  function solCreateDeck() {
    const cards = [];
    for (let s = 0; s < 4; s++) {
      for (let r = 2; r <= 14; r++) {
        cards.push({ suit: s, rank: r });
      }
    }
    // Fisher-Yates
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  function startSolitaireGame() {
    const deck = solCreateDeck();
    const tableau = [];
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      const stack = [];
      for (let row = 0; row <= col; row++) {
        stack.push({ ...deck[idx++], faceUp: row === col });
      }
      tableau.push(stack);
    }
    const stock = deck.slice(idx);
    solState = {
      tableau,
      foundations: [[], [], [], []], // one per suit
      stock,
      waste: []
    };
    solSelected = null;
    solDragging = null;
    solMoves = 0;
    solScore = 0;
    solUndoStack = [];
    solStartTime = Date.now();

    if (solTimer) clearInterval(solTimer);
    solTimer = setInterval(() => {
      if (!solState) return;
      const elapsed = Math.floor((Date.now() - solStartTime) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      const el = $('solTime');
      if (el) el.textContent = min + ':' + (sec < 10 ? '0' : '') + sec;
    }, 1000);

    showScreen('solitaire');
    solCanvas = $('solitaireCanvas');
    if (solCanvas) {
      solCanvas.width = SOL_W;
      solCanvas.height = SOL_H;
      solCtx = solCanvas.getContext('2d');
      solCanvas.onclick = solHandleClick;
    }
    solGameLoopActive = true;
    solRender();

    // Bind buttons
    const undoBtn = $('btnSolUndo');
    if (undoBtn) undoBtn.onclick = solUndo;
    const newBtn = $('btnSolNewGame');
    if (newBtn) newBtn.onclick = startSolitaireGame;
    const quitBtn = $('btnSolQuit');
    if (quitBtn) quitBtn.onclick = () => { solGameLoopActive = false; if (solTimer) clearInterval(solTimer); showScreen('lobby'); };
  }

  function solCardIsRed(card) { return card.suit === 1 || card.suit === 2; }

  function solCanPlaceOnTableau(card, targetCol) {
    const stack = solState.tableau[targetCol];
    if (stack.length === 0) return card.rank === 13; // only Kings on empty
    const top = stack[stack.length - 1];
    // Ace (rank 14) is treated as 1 for tableau ordering (lowest card, goes on a 2)
    const tabVal = (r) => r === 14 ? 1 : r;
    return top.faceUp && solCardIsRed(card) !== solCardIsRed(top) && tabVal(card.rank) === tabVal(top.rank) - 1;
  }

  function solCanPlaceOnFoundation(card, fIdx) {
    const pile = solState.foundations[fIdx];
    if (pile.length === 0) return card.rank === 14; // Aces first (rank 14 = Ace)
    // Foundation builds A(1), 2, 3, ..., K(13). Remap Ace from 14 to 1.
    const fVal = (r) => r === 14 ? 1 : r;
    const top = pile[pile.length - 1];
    return card.suit === top.suit && fVal(card.rank) === fVal(top.rank) + 1;
  }

  function solDrawFromStock() {
    if (solState.stock.length === 0) {
      // Recycle waste
      if (solState.waste.length === 0) return;
      solState.stock = solState.waste.reverse();
      solState.waste = [];
    } else {
      const card = solState.stock.pop();
      card.faceUp = true;
      solState.waste.push(card);
      solMoves++;
    }
    $('solMoves').textContent = solMoves;
  }

  function solHandleClick(e) {
    if (!solState || !solCanvas) return;
    const rect = solCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (SOL_W / rect.width);
    const my = (e.clientY - rect.top) * (SOL_H / rect.height);

    // Stock area
    const stockX = SOL_MARGIN, stockY = SOL_MARGIN;
    if (mx >= stockX && mx <= stockX + SOL_CW && my >= stockY && my <= stockY + SOL_CH) {
      solDrawFromStock();
      solRender();
      return;
    }

    // Waste area
    const wasteX = SOL_MARGIN + SOL_CW + 15;
    if (mx >= wasteX && mx <= wasteX + SOL_CW && my >= stockY && my <= stockY + SOL_CH && solState.waste.length > 0) {
      if (solSelected && solSelected.source === 'waste') {
        // Try to place on foundations
        const card = solState.waste[solState.waste.length - 1];
        for (let f = 0; f < 4; f++) {
          if (solCanPlaceOnFoundation(card, f)) {
            solState.foundations[f].push(solState.waste.pop());
            solMoves++; solScore += 10;
            $('solMoves').textContent = solMoves;
            $('solScore').textContent = solScore;
            solSelected = null;
            solRender();
            solCheckWin();
            return;
          }
        }
        solSelected = null;
      } else {
        solSelected = { source: 'waste' };
      }
      solRender();
      return;
    }

    // Foundation areas
    for (let f = 0; f < 4; f++) {
      const fx = SOL_MARGIN + (3 + f) * (SOL_CW + 12);
      const fy = SOL_MARGIN;
      if (mx >= fx && mx <= fx + SOL_CW && my >= fy && my <= fy + SOL_CH) {
        if (solSelected) {
          // Try place selected card on this foundation
          let card, fromSource;
          if (solSelected.source === 'waste') {
            card = solState.waste[solState.waste.length - 1];
            fromSource = 'waste';
          } else if (solSelected.source === 'tableau') {
            const stack = solState.tableau[solSelected.col];
            card = stack[solSelected.cardIdx];
            if (solSelected.cardIdx !== stack.length - 1) { solSelected = null; solRender(); return; }
            fromSource = 'tableau';
          }
          if (card && solCanPlaceOnFoundation(card, f)) {
            if (fromSource === 'waste') solState.waste.pop();
            else solState.tableau[solSelected.col].pop();
            solState.foundations[f].push(card);
            solMoves++; solScore += 10;
            // Flip new top card
            if (fromSource === 'tableau') {
              const s = solState.tableau[solSelected.col];
              if (s.length > 0 && !s[s.length - 1].faceUp) { s[s.length - 1].faceUp = true; solScore += 5; }
            }
            $('solMoves').textContent = solMoves;
            $('solScore').textContent = solScore;
            solSelected = null;
            solRender();
            solCheckWin();
            return;
          }
        }
        solSelected = null;
        solRender();
        return;
      }
    }

    // Tableau columns
    for (let col = 0; col < 7; col++) {
      const tx = SOL_MARGIN + col * (SOL_CW + 12);
      const ty = SOL_MARGIN + SOL_CH + 30;
      const stack = solState.tableau[col];

      // Pre-calculate cumulative Y offsets (must match rendering)
      const cardYPositions = [];
      let cumY = 0;
      for (let i = 0; i < stack.length; i++) {
        cardYPositions.push(ty + cumY);
        cumY += stack[i].faceUp ? SOL_GAP : SOL_FD_GAP;
      }

      // Calculate hit area for each card (iterate top-to-bottom for correct overlap)
      for (let i = stack.length - 1; i >= 0; i--) {
        const cardY = cardYPositions[i];
        const cardH = (i === stack.length - 1) ? SOL_CH : (stack[i].faceUp ? SOL_GAP : SOL_FD_GAP);
        if (mx >= tx && mx <= tx + SOL_CW && my >= cardY && my <= cardY + cardH) {
          if (!stack[i].faceUp) break;

          if (solSelected) {
            // Try to place selected card(s) on this column
            if (solSelected.source === 'waste') {
              const card = solState.waste[solState.waste.length - 1];
              if (solCanPlaceOnTableau(card, col)) {
                solState.tableau[col].push(solState.waste.pop());
                solMoves++;
                $('solMoves').textContent = solMoves;
                solSelected = null;
                solRender();
                return;
              }
            } else if (solSelected.source === 'tableau' && solSelected.col !== col) {
              const srcStack = solState.tableau[solSelected.col];
              const moveCards = srcStack.slice(solSelected.cardIdx);
              if (solCanPlaceOnTableau(moveCards[0], col)) {
                solState.tableau[solSelected.col] = srcStack.slice(0, solSelected.cardIdx);
                solState.tableau[col].push(...moveCards);
                solMoves++;
                // Flip top card of source column
                const s = solState.tableau[solSelected.col];
                if (s.length > 0 && !s[s.length - 1].faceUp) { s[s.length - 1].faceUp = true; solScore += 5; }
                $('solMoves').textContent = solMoves;
                $('solScore').textContent = solScore;
                solSelected = null;
                solRender();
                return;
              }
            }
            solSelected = null;
          } else {
            solSelected = { source: 'tableau', col, cardIdx: i };
          }
          solRender();
          return;
        }
      }

      // Empty column click
      if (stack.length === 0 && mx >= tx && mx <= tx + SOL_CW && my >= ty && my <= ty + SOL_CH) {
        if (solSelected) {
          if (solSelected.source === 'waste') {
            const card = solState.waste[solState.waste.length - 1];
            if (card.rank === 13) { // King on empty
              solState.tableau[col].push(solState.waste.pop());
              solMoves++;
              $('solMoves').textContent = solMoves;
              solSelected = null;
              solRender();
              return;
            }
          } else if (solSelected.source === 'tableau') {
            const srcStack = solState.tableau[solSelected.col];
            const moveCards = srcStack.slice(solSelected.cardIdx);
            if (moveCards[0].rank === 13) {
              solState.tableau[solSelected.col] = srcStack.slice(0, solSelected.cardIdx);
              solState.tableau[col].push(...moveCards);
              solMoves++;
              const s = solState.tableau[solSelected.col];
              if (s.length > 0 && !s[s.length - 1].faceUp) { s[s.length - 1].faceUp = true; solScore += 5; }
              $('solMoves').textContent = solMoves;
              $('solScore').textContent = solScore;
              solSelected = null;
              solRender();
              return;
            }
          }
        }
        solSelected = null;
        solRender();
        return;
      }
    }

    solSelected = null;
    solRender();
  }

  function solCheckWin() {
    const total = solState.foundations.reduce((sum, f) => sum + f.length, 0);
    if (total === 52) {
      solGameLoopActive = false;
      if (solTimer) clearInterval(solTimer);
      // Show game over
      $('gameOverTitle').textContent = 'You Win!';
      $('gameOverReason').textContent = `Score: ${solScore} | Moves: ${solMoves}`;
      $('gameOverRating').textContent = '';
      $('gameOverCoins').textContent = '';
      $('gameOverOverlay').classList.remove('hidden');
      const btn = $('btnBackToLobby');
      if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); showScreen('lobby'); };
      const pa = $('btnPlayAgain');
      if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startSolitaireGame(); };
    }
  }

  function solUndo() {
    // Simple: just restart for now
    // Full undo would require state snapshots
  }

  function solRender() {
    if (!solCtx || !solState) return;
    const ctx = solCtx;
    ctx.clearRect(0, 0, SOL_W, SOL_H);

    // Green felt background
    ctx.fillStyle = '#1a6b3c';
    ctx.fillRect(0, 0, SOL_W, SOL_H);

    // Stock
    const stockX = SOL_MARGIN, stockY = SOL_MARGIN;
    if (solState.stock.length > 0) {
      drawCardPile(ctx, stockX, stockY, SOL_CW, SOL_CH, solState.stock.length);
    } else {
      ctx.strokeStyle = '#2a8b4c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(stockX, stockY, SOL_CW, SOL_CH, 6);
      ctx.stroke();
      ctx.fillStyle = '#2a8b4c';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u21BB', stockX + SOL_CW / 2, stockY + SOL_CH / 2 + 8);
    }

    // Waste
    const wasteX = SOL_MARGIN + SOL_CW + 15;
    if (solState.waste.length > 0) {
      const top = solState.waste[solState.waste.length - 1];
      const isSel = solSelected && solSelected.source === 'waste';
      drawPlayingCard(ctx, wasteX, stockY, SOL_CW, SOL_CH, top, true, isSel);
    }

    // Foundations
    for (let f = 0; f < 4; f++) {
      const fx = SOL_MARGIN + (3 + f) * (SOL_CW + 12);
      const fy = SOL_MARGIN;
      if (solState.foundations[f].length > 0) {
        const top = solState.foundations[f][solState.foundations[f].length - 1];
        drawPlayingCard(ctx, fx, fy, SOL_CW, SOL_CH, top, true, false);
      } else {
        ctx.strokeStyle = '#2a8b4c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(fx, fy, SOL_CW, SOL_CH, 6);
        ctx.stroke();
        ctx.fillStyle = '#3a9b5c';
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(CARD_SUIT_SYMBOLS[f], fx + SOL_CW / 2, fy + SOL_CH / 2 + 10);
      }
    }

    // Tableau
    for (let col = 0; col < 7; col++) {
      const tx = SOL_MARGIN + col * (SOL_CW + 12);
      const ty = SOL_MARGIN + SOL_CH + 30;
      const stack = solState.tableau[col];

      if (stack.length === 0) {
        ctx.strokeStyle = '#2a8b4c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, SOL_CW, SOL_CH, 6);
        ctx.stroke();
        continue;
      }

      let yOff = 0;
      for (let i = 0; i < stack.length; i++) {
        const card = stack[i];
        const isSel = solSelected && solSelected.source === 'tableau' && solSelected.col === col && i >= solSelected.cardIdx;
        drawPlayingCard(ctx, tx, ty + yOff, SOL_CW, SOL_CH, card, card.faceUp, isSel);
        yOff += card.faceUp ? SOL_GAP : SOL_FD_GAP;
      }
    }
  }

  /* ================================================
     PINBALL — Single Player Arcade
     ================================================ */
  const PB_W = 500, PB_H = 800;
  const PB_BALL_R = 8;
  const PB_GRAVITY = 0.15;
  const PB_FRICTION = 0.999;
  const PB_WALL_REST = 0.65;
  const PB_BUMPER_REST = 1.2;
  const PB_FLIPPER_LEN = 60;
  const PB_FLIPPER_HW = 10;
  const PB_FLIPPER_REST = 0.45;
  const PB_FLIPPER_ACTIVE = -0.45;
  const PB_FLIPPER_SPEED = 0.25;
  const PB_PLUNGER_MAX = 25;
  const PB_PLUNGER_RATE = 0.4;
  const PB_MAX_BALLS = 3;

  let pbCanvas = null, pbCtx = null;
  let pbGameLoopActive = false, pbLastTime = 0;
  let pbKeysDown = {};
  let pbBall = { x: 440, y: 700, vx: 0, vy: 0 };
  let pbScore = 0, pbBallNum = 1, pbMultiplier = 1, pbConsecutiveHits = 0;
  let pbPlungerCharge = 0, pbPlungerCharging = false, pbBallInPlunger = true;
  let pbLeftFlipperAngle = PB_FLIPPER_REST;
  let pbRightFlipperAngle = PB_FLIPPER_REST;
  let pbBumperFlash = [0, 0, 0];
  let pbTargetCooldown = [0, 0, 0, 0];
  let pbGameOver = false;

  const pbLeftFlipperPivot = { x: 170, y: 720 };
  const pbRightFlipperPivot = { x: 330, y: 720 };

  const pbBumpers = [
    { x: 170, y: 220, r: 25 },
    { x: 330, y: 180, r: 25 },
    { x: 250, y: 300, r: 25 }
  ];

  const pbWalls = [
    // Left wall
    { x1: 40, y1: 60, x2: 40, y2: 700 },
    { x1: 40, y1: 700, x2: 120, y2: 740 },
    // Right wall (above plunger lane)
    { x1: 420, y1: 60, x2: 420, y2: 700 },
    { x1: 420, y1: 700, x2: 380, y2: 740 },
    // Plunger lane walls
    { x1: 460, y1: 60, x2: 460, y2: 760 },
    { x1: 420, y1: 60, x2: 460, y2: 60 },
    // Top arc segments
    { x1: 40, y1: 60, x2: 100, y2: 25 },
    { x1: 100, y1: 25, x2: 200, y2: 10 },
    { x1: 200, y1: 10, x2: 300, y2: 10 },
    { x1: 300, y1: 10, x2: 400, y2: 25 },
    { x1: 400, y1: 25, x2: 460, y2: 60 },
    // Slingshots near flippers
    { x1: 80, y1: 620, x2: 120, y2: 700 },
    { x1: 420, y1: 620, x2: 380, y2: 700 },
    // Inner guide walls
    { x1: 80, y1: 550, x2: 80, y2: 620 },
    { x1: 420, y1: 550, x2: 420, y2: 620 }
  ];

  const pbTargets = [
    { x1: 60, y1: 150, x2: 60, y2: 220 },
    { x1: 60, y1: 350, x2: 60, y2: 420 },
    { x1: 440, y1: 120, x2: 440, y2: 190 },
    { x1: 440, y1: 320, x2: 440, y2: 390 }
  ];

  function pbKeyDown(e) {
    pbKeysDown[e.key] = true;
    if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
    }
    if ((e.key === ' ' || e.key === 'ArrowDown') && pbBallInPlunger && !pbPlungerCharging) {
      pbPlungerCharging = true;
      pbPlungerCharge = 0;
    }
  }

  function pbKeyUp(e) {
    pbKeysDown[e.key] = false;
    if ((e.key === ' ' || e.key === 'ArrowDown') && pbPlungerCharging) {
      pbPlungerCharging = false;
      if (pbBallInPlunger) {
        pbBall.vy = -pbPlungerCharge;
        pbBall.vx = -1 + Math.random() * 2;
        pbBallInPlunger = false;
      }
      pbPlungerCharge = 0;
    }
  }

  function setupPinballCanvas() {
    pbCanvas = $('pinballCanvas');
    if (pbCanvas) {
      pbCanvas.width = PB_W;
      pbCanvas.height = PB_H;
      pbCtx = pbCanvas.getContext('2d');
    }
  }

  function startPinballGameLoop() {
    pbGameLoopActive = true;
    pbLastTime = performance.now();
    function loop(now) {
      if (!pbGameLoopActive) return;
      const dt = Math.min((now - pbLastTime) / 16.667, 3);
      pbLastTime = now;
      if (!pbGameOver) pbUpdate(dt);
      pbRender();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function startPinballGame() {
    pbScore = 0;
    pbBallNum = 1;
    pbMultiplier = 1;
    pbConsecutiveHits = 0;
    pbGameOver = false;
    pbBallInPlunger = true;
    pbPlungerCharge = 0;
    pbPlungerCharging = false;
    pbBall = { x: 440, y: 700, vx: 0, vy: 0 };
    pbLeftFlipperAngle = PB_FLIPPER_REST;
    pbRightFlipperAngle = PB_FLIPPER_REST;
    pbBumperFlash = [0, 0, 0];
    pbTargetCooldown = [0, 0, 0, 0];
    pbKeysDown = {};
    $('pbScore').textContent = '0';
    $('pbBallNum').textContent = '1 / 3';
    $('pbMultiplier').textContent = '1x';
    $('gameOverOverlay').classList.add('hidden');
    const info = $('pinballInfo');
    if (info) info.textContent = 'Hold SPACE to charge, release to launch!';
    document.removeEventListener('keydown', pbKeyDown);
    document.removeEventListener('keyup', pbKeyUp);
    document.addEventListener('keydown', pbKeyDown);
    document.addEventListener('keyup', pbKeyUp);
    showScreen('pinball');

    // Bind buttons
    const newBtn = $('btnPbNewGame');
    if (newBtn) newBtn.onclick = startPinballGame;
    const quitBtn = $('btnPbQuit');
    if (quitBtn) quitBtn.onclick = () => { pbGameLoopActive = false; document.removeEventListener('keydown', pbKeyDown); document.removeEventListener('keyup', pbKeyUp); showScreen('lobby'); };
  }

  function pbUpdate(dt) {
    if (!dt || dt <= 0) dt = 1;
    // Update flippers
    const leftActive = pbKeysDown['ArrowLeft'] || pbKeysDown['a'] || pbKeysDown['A'] || pbKeysDown['z'] || pbKeysDown['Z'];
    const rightActive = pbKeysDown['ArrowRight'] || pbKeysDown['d'] || pbKeysDown['D'] || pbKeysDown['/'];
    const leftTarget = leftActive ? PB_FLIPPER_ACTIVE : PB_FLIPPER_REST;
    const rightTarget = rightActive ? PB_FLIPPER_ACTIVE : PB_FLIPPER_REST;
    if (pbLeftFlipperAngle < leftTarget) pbLeftFlipperAngle = Math.min(pbLeftFlipperAngle + PB_FLIPPER_SPEED * dt, leftTarget);
    else if (pbLeftFlipperAngle > leftTarget) pbLeftFlipperAngle = Math.max(pbLeftFlipperAngle - PB_FLIPPER_SPEED * dt, leftTarget);
    if (pbRightFlipperAngle < rightTarget) pbRightFlipperAngle = Math.min(pbRightFlipperAngle + PB_FLIPPER_SPEED * dt, rightTarget);
    else if (pbRightFlipperAngle > rightTarget) pbRightFlipperAngle = Math.max(pbRightFlipperAngle - PB_FLIPPER_SPEED * dt, rightTarget);

    // Plunger charge
    if (pbPlungerCharging) {
      pbPlungerCharge = Math.min(pbPlungerCharge + PB_PLUNGER_RATE * dt, PB_PLUNGER_MAX);
    }

    if (pbBallInPlunger) {
      pbBall.x = 440;
      pbBall.y = 700 + (pbPlungerCharging ? pbPlungerCharge * 1.5 : 0);
      return;
    }

    // Physics
    pbBall.vy += PB_GRAVITY * dt;
    const frictionDt = Math.pow(PB_FRICTION, dt);
    pbBall.vx *= frictionDt;
    pbBall.vy *= frictionDt;
    pbBall.x += pbBall.vx * dt;
    pbBall.y += pbBall.vy * dt;

    // Wall collisions
    for (const w of pbWalls) {
      pbCollideLineSegment(w);
    }

    // Bumper collisions
    for (let i = 0; i < pbBumpers.length; i++) {
      const b = pbBumpers[i];
      const dx = pbBall.x - b.x;
      const dy = pbBall.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = PB_BALL_R + b.r;
      if (dist < minDist && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        pbBall.x = b.x + nx * minDist;
        pbBall.y = b.y + ny * minDist;
        const dot = pbBall.vx * nx + pbBall.vy * ny;
        pbBall.vx = (pbBall.vx - 2 * dot * nx) * PB_BUMPER_REST;
        pbBall.vy = (pbBall.vy - 2 * dot * ny) * PB_BUMPER_REST;
        pbBumperFlash[i] = 15;
        pbAddScore(100);
      }
    }

    // Target collisions
    for (let i = 0; i < pbTargets.length; i++) {
      if (pbTargetCooldown[i] > 0) { pbTargetCooldown[i] -= dt; continue; }
      const t = pbTargets[i];
      const d = pbPointToSegmentDist(pbBall.x, pbBall.y, t.x1, t.y1, t.x2, t.y2);
      if (d < PB_BALL_R + 5) {
        pbTargetCooldown[i] = 120;
        pbAddScore(50);
      }
    }

    // Flipper collisions
    pbCollideWithFlipper(pbLeftFlipperPivot, pbLeftFlipperAngle, 1, leftActive);
    pbCollideWithFlipper(pbRightFlipperPivot, pbRightFlipperAngle, -1, rightActive);

    // Decrement bumper flash timers
    for (let i = 0; i < pbBumperFlash.length; i++) {
      if (pbBumperFlash[i] > 0) pbBumperFlash[i] -= dt;
    }

    // Drain detection
    if (pbBall.y > PB_H + 20) {
      pbBallDrained();
    }
  }

  function pbCollideLineSegment(w) {
    const ex = w.x2 - w.x1, ey = w.y2 - w.y1;
    const len = Math.sqrt(ex * ex + ey * ey);
    if (len === 0) return;
    const nx = -ey / len, ny = ex / len;
    const dx = pbBall.x - w.x1, dy = pbBall.y - w.y1;
    const dist = dx * nx + dy * ny;
    if (Math.abs(dist) > PB_BALL_R) return;
    const t = (dx * ex + dy * ey) / (len * len);
    if (t < 0 || t > 1) return;
    const dot = pbBall.vx * nx + pbBall.vy * ny;
    if (dot > 0) return;
    pbBall.vx -= 2 * dot * nx * PB_WALL_REST;
    pbBall.vy -= 2 * dot * ny * PB_WALL_REST;
    pbBall.x += nx * (PB_BALL_R - dist);
    pbBall.y += ny * (PB_BALL_R - dist);
  }

  function pbCollideWithFlipper(pivot, angle, dir, isActive) {
    const tipX = pivot.x + Math.cos(angle * dir) * PB_FLIPPER_LEN * dir;
    const tipY = pivot.y + Math.sin(angle * dir) * PB_FLIPPER_LEN;
    const d = pbPointToSegmentDist(pbBall.x, pbBall.y, pivot.x, pivot.y, tipX, tipY);
    if (d < PB_BALL_R + PB_FLIPPER_HW) {
      // Push ball away from flipper
      const mx = (pivot.x + tipX) / 2, my = (pivot.y + tipY) / 2;
      const awayX = pbBall.x - mx, awayY = pbBall.y - my;
      const awayLen = Math.sqrt(awayX * awayX + awayY * awayY) || 1;
      pbBall.x += (awayX / awayLen) * 3;
      pbBall.y += (awayY / awayLen) * 3;
      if (isActive) {
        // Calculate distance from pivot (0-1)
        const fx = pbBall.x - pivot.x, fy = pbBall.y - pivot.y;
        const fDist = Math.sqrt(fx * fx + fy * fy) / PB_FLIPPER_LEN;
        const kickStrength = 8 + fDist * 10;
        pbBall.vy = -kickStrength;
        pbBall.vx += dir * fDist * 5;
      } else {
        const dot = pbBall.vx * (awayX / awayLen) + pbBall.vy * (awayY / awayLen);
        if (dot < 0) {
          pbBall.vx -= 2 * dot * (awayX / awayLen) * 0.5;
          pbBall.vy -= 2 * dot * (awayY / awayLen) * 0.5;
        }
      }
    }
  }

  function pbPointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  }

  function pbAddScore(base) {
    pbScore += base * pbMultiplier;
    pbConsecutiveHits++;
    if (pbConsecutiveHits % 5 === 0 && pbMultiplier < 10) {
      pbMultiplier++;
      $('pbMultiplier').textContent = pbMultiplier + 'x';
    }
    $('pbScore').textContent = pbScore;
  }

  function pbBallDrained() {
    pbBallNum++;
    if (pbBallNum > PB_MAX_BALLS) {
      pbGameOver = true;
      pbShowGameOver();
      return;
    }
    pbMultiplier = 1;
    pbConsecutiveHits = 0;
    pbBallInPlunger = true;
    pbPlungerCharge = 0;
    pbPlungerCharging = false;
    pbBall = { x: 440, y: 700, vx: 0, vy: 0 };
    $('pbBallNum').textContent = pbBallNum + ' / 3';
    $('pbMultiplier').textContent = '1x';
    const info = $('pinballInfo');
    if (info) info.textContent = 'Ball ' + pbBallNum + ' — Hold SPACE to launch!';
  }

  function pbShowGameOver() {
    $('gameOverTitle').textContent = 'Game Over';
    $('gameOverReason').textContent = 'Final Score: ' + pbScore;
    const rc = $('gameOverRating');
    if (rc) rc.innerHTML = '';
    const coinEl = $('gameOverCoins');
    if (coinEl) coinEl.textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (pbScore >= 5000) {
      if (typeof startConfetti === 'function') startConfetti();
    }
    const btn = $('btnBackToLobby');
    if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); pbGameLoopActive = false; document.removeEventListener('keydown', pbKeyDown); document.removeEventListener('keyup', pbKeyUp); showScreen('lobby'); };
    const pa = $('btnPlayAgain');
    if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startPinballGame(); };
  }

  function pbRender() {
    if (!pbCtx) return;
    const ctx = pbCtx;

    // Dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, PB_W, PB_H);

    // Table surface
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.moveTo(40, 60);
    ctx.lineTo(40, 700);
    ctx.lineTo(120, 740);
    ctx.lineTo(380, 740);
    ctx.lineTo(420, 700);
    ctx.lineTo(420, 60);
    ctx.lineTo(460, 60);
    ctx.lineTo(460, 10);
    ctx.lineTo(40, 10);
    ctx.closePath();
    ctx.fill();

    // Walls — neon blue with glow
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 10;
    for (const w of pbWalls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Drain area
    ctx.fillStyle = 'rgba(200, 0, 0, 0.15)';
    ctx.fillRect(120, 740, 260, 20);

    // Bumpers
    for (let i = 0; i < pbBumpers.length; i++) {
      const b = pbBumpers[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      if (pbBumperFlash[i] > 0) {
        ctx.fillStyle = '#ff44aa';
        ctx.shadowColor = '#ff44aa';
        ctx.shadowBlur = 20;
      } else {
        ctx.fillStyle = '#6633aa';
        ctx.shadowColor = '#6633aa';
        ctx.shadowBlur = 8;
      }
      ctx.fill();
      ctx.strokeStyle = '#cc88ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Targets
    for (let i = 0; i < pbTargets.length; i++) {
      const t = pbTargets[i];
      ctx.strokeStyle = pbTargetCooldown[i] > 0 ? '#332200' : '#ff8800';
      ctx.lineWidth = 4;
      if (pbTargetCooldown[i] === 0) {
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Flippers
    pbDrawFlipper(ctx, pbLeftFlipperPivot, pbLeftFlipperAngle, 1);
    pbDrawFlipper(ctx, pbRightFlipperPivot, pbRightFlipperAngle, -1);

    // Plunger
    const plungerX = 440;
    const plungerBaseY = 760;
    const plungerHeadY = 700 + (pbPlungerCharging ? pbPlungerCharge * 1.5 : 0);
    // Spring coils
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    const springSegs = 8;
    const springH = plungerBaseY - plungerHeadY - 10;
    for (let i = 0; i < springSegs; i++) {
      const sy = plungerHeadY + 10 + (springH / springSegs) * i;
      const sy2 = plungerHeadY + 10 + (springH / springSegs) * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(plungerX - 8, sy);
      ctx.lineTo(plungerX + 8, sy2);
      ctx.stroke();
    }
    // Plunger head
    ctx.fillStyle = '#cc2222';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 6;
    ctx.fillRect(plungerX - 10, plungerHeadY - 5, 20, 10);
    ctx.shadowBlur = 0;
    // Power bar
    if (pbPlungerCharging) {
      const pct = pbPlungerCharge / PB_PLUNGER_MAX;
      ctx.fillStyle = '#333';
      ctx.fillRect(470, 600, 15, 150);
      ctx.fillStyle = pct > 0.7 ? '#ff2222' : pct > 0.4 ? '#ffaa00' : '#00cc44';
      ctx.fillRect(470, 600 + 150 * (1 - pct), 15, 150 * pct);
    }

    // Ball
    if (!pbGameOver) {
      const grad = ctx.createRadialGradient(pbBall.x - 2, pbBall.y - 2, 1, pbBall.x, pbBall.y, PB_BALL_R);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#cccccc');
      grad.addColorStop(1, '#888888');
      ctx.fillStyle = grad;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pbBall.x, pbBall.y, PB_BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function pbDrawFlipper(ctx, pivot, angle, dir) {
    const tipX = pivot.x + Math.cos(angle * dir) * PB_FLIPPER_LEN * dir;
    const tipY = pivot.y + Math.sin(angle * dir) * PB_FLIPPER_LEN;
    const perpX = -Math.sin(angle * dir) * dir;
    const perpY = Math.cos(angle * dir);

    ctx.fillStyle = '#cc3333';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(pivot.x + perpX * PB_FLIPPER_HW, pivot.y + perpY * PB_FLIPPER_HW);
    ctx.lineTo(pivot.x - perpX * PB_FLIPPER_HW, pivot.y - perpY * PB_FLIPPER_HW);
    ctx.lineTo(tipX - perpX * 4, tipY - perpY * 4);
    ctx.lineTo(tipX + perpX * 4, tipY + perpY * 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Pivot dot
    ctx.fillStyle = '#ff6666';
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ================================================
     JEZZBALL — Single Player
     ================================================ */
  const JB_W = 600, JB_H = 500, JB_CELL = 10;
  const JB_COLS = JB_W / JB_CELL, JB_ROWS = JB_H / JB_CELL;

  let jbCanvas = null, jbCtx = null, jbGameLoopActive = false, jbLastTime = 0;
  let jbGrid = [], jbBalls = [], jbWalls = [];
  let jbLevel = 1, jbLives = 3, jbScore = 0, jbGameOver = false;
  let jbHorizontal = true;

  function setupJezzballCanvas() {
    jbCanvas = $('jezzballCanvas');
    if (jbCanvas) { jbCanvas.width = JB_W; jbCanvas.height = JB_H; jbCtx = jbCanvas.getContext('2d'); }
  }

  function startJezzballGameLoop() {
    jbGameLoopActive = true;
    jbLastTime = performance.now();
    function loop(now) {
      if (!jbGameLoopActive) return;
      const dt = Math.min((now - jbLastTime) / 16.667, 3);
      jbLastTime = now;
      if (!jbGameOver) jbUpdate(dt);
      jbRender();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function startJezzballGame() {
    jbLevel = 1; jbLives = 3; jbScore = 0; jbGameOver = false; jbHorizontal = true;
    $('gameOverOverlay').classList.add('hidden');
    jbInitLevel();
    showScreen('jezzball');
    if (jbCanvas) {
      jbCanvas.onclick = jbHandleClick;
      jbCanvas.oncontextmenu = (e) => { e.preventDefault(); jbHorizontal = !jbHorizontal; };
    }
    document.addEventListener('keydown', jbKeyHandler);
    const newBtn = $('btnJbNewGame'); if (newBtn) newBtn.onclick = startJezzballGame;
    const quitBtn = $('btnJbQuit'); if (quitBtn) quitBtn.onclick = () => { jbGameLoopActive = false; document.removeEventListener('keydown', jbKeyHandler); showScreen('lobby'); };
  }

  function jbKeyHandler(e) { if (e.key === 'v' || e.key === 'V') jbHorizontal = !jbHorizontal; }

  function jbInitLevel() {
    jbGrid = [];
    for (let r = 0; r < JB_ROWS; r++) {
      jbGrid[r] = [];
      for (let c = 0; c < JB_COLS; c++) jbGrid[r][c] = (r === 0 || r === JB_ROWS - 1 || c === 0 || c === JB_COLS - 1) ? 1 : 0;
    }
    jbBalls = [];
    const numBalls = jbLevel + 1;
    for (let i = 0; i < numBalls; i++) {
      jbBalls.push({
        x: 100 + Math.random() * (JB_W - 200), y: 100 + Math.random() * (JB_H - 200),
        vx: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random()), vy: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random()),
        r: 6
      });
    }
    jbWalls = [];
    jbUpdateHud();
  }

  function jbUpdateHud() {
    $('jbLevel').textContent = jbLevel;
    $('jbLives').textContent = jbLives;
    $('jbFilled').textContent = jbCalcFilled() + '%';
    $('jbScore').textContent = jbScore;
    const info = $('jezzballInfo');
    if (info) info.textContent = (jbHorizontal ? 'Horizontal' : 'Vertical') + ' mode — Click to place wall. V or right-click to toggle.';
  }

  function jbCalcFilled() {
    let filled = 0, total = 0;
    for (let r = 1; r < JB_ROWS - 1; r++) for (let c = 1; c < JB_COLS - 1; c++) { total++; if (jbGrid[r][c]) filled++; }
    return Math.round(filled / total * 100);
  }

  function jbHandleClick(e) {
    if (jbGameOver) return;
    const rect = jbCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (JB_W / rect.width);
    const my = (e.clientY - rect.top) * (JB_H / rect.height);
    const gc = Math.floor(mx / JB_CELL), gr = Math.floor(my / JB_CELL);
    if (gr <= 0 || gr >= JB_ROWS - 1 || gc <= 0 || gc >= JB_COLS - 1) return;
    if (jbGrid[gr][gc]) return;
    jbWalls.push({ r: gr, c: gc, horizontal: jbHorizontal, segments: [{ r: gr, c: gc }], growing: true, speed: 0.5, progress: 0 });
  }

  function jbUpdate(dt) {
    if (!dt || dt <= 0) dt = 1;
    // Move balls
    for (const b of jbBalls) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      const gc = Math.floor(b.x / JB_CELL), gr = Math.floor(b.y / JB_CELL);
      const gcx = Math.floor((b.x + (b.vx > 0 ? b.r : -b.r)) / JB_CELL);
      const gry = Math.floor((b.y + (b.vy > 0 ? b.r : -b.r)) / JB_CELL);
      if (gcx >= 0 && gcx < JB_COLS && gr >= 0 && gr < JB_ROWS && jbGrid[gr][gcx]) b.vx = -b.vx;
      if (gc >= 0 && gc < JB_COLS && gry >= 0 && gry < JB_ROWS && jbGrid[gry][gc]) b.vy = -b.vy;
      b.x = Math.max(JB_CELL + b.r, Math.min(JB_W - JB_CELL - b.r, b.x));
      b.y = Math.max(JB_CELL + b.r, Math.min(JB_H - JB_CELL - b.r, b.y));
    }

    // Grow walls
    for (let wi = jbWalls.length - 1; wi >= 0; wi--) {
      const w = jbWalls[wi];
      if (!w.growing) continue;
      w.progress += w.speed * dt;
      while (w.progress >= 1) {
        w.progress -= 1;
        let expanded = false;
        const segs = w.segments;
        const first = segs[0], last = segs[segs.length - 1];
        if (w.horizontal) {
          if (first.c > 0 && !jbGrid[first.r][first.c - 1]) { segs.unshift({ r: first.r, c: first.c - 1 }); expanded = true; }
          if (last.c < JB_COLS - 1 && !jbGrid[last.r][last.c + 1]) { segs.push({ r: last.r, c: last.c + 1 }); expanded = true; }
        } else {
          if (first.r > 0 && !jbGrid[first.r - 1][first.c]) { segs.unshift({ r: first.r - 1, c: first.c }); expanded = true; }
          if (last.r < JB_ROWS - 1 && !jbGrid[last.r + 1][last.c]) { segs.push({ r: last.r + 1, c: last.c }); expanded = true; }
        }
        if (!expanded) {
          for (const s of segs) jbGrid[s.r][s.c] = 1;
          w.growing = false;
          jbFillEnclosed();
          jbUpdateHud();
          if (jbCalcFilled() >= 75) { jbLevel++; jbScore += 1000; jbInitLevel(); return; }
          break;
        }
      }

      // Check ball collision with growing wall
      if (w.growing) {
        let hit = false;
        for (const b of jbBalls) {
          for (const s of w.segments) {
            const sx = s.c * JB_CELL, sy = s.r * JB_CELL;
            if (b.x + b.r > sx && b.x - b.r < sx + JB_CELL && b.y + b.r > sy && b.y - b.r < sy + JB_CELL) {
              hit = true; break;
            }
          }
          if (hit) break;
        }
        if (hit) {
          jbWalls.splice(wi, 1);
          jbLives--;
          $('jbLives').textContent = jbLives;
          if (jbLives <= 0) { jbGameOver = true; jbShowGameOver(); }
        }
      }
    }
  }

  function jbFillEnclosed() {
    // Find all connected empty regions, fill ones without balls
    const visited = [];
    for (let r = 0; r < JB_ROWS; r++) { visited[r] = []; for (let c = 0; c < JB_COLS; c++) visited[r][c] = false; }
    const regions = [];
    for (let r = 1; r < JB_ROWS - 1; r++) {
      for (let c = 1; c < JB_COLS - 1; c++) {
        if (jbGrid[r][c] || visited[r][c]) continue;
        const region = [];
        const stack = [{ r, c }];
        visited[r][c] = true;
        while (stack.length) {
          const p = stack.pop();
          region.push(p);
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr = p.r + dr, nc = p.c + dc;
            if (nr >= 0 && nr < JB_ROWS && nc >= 0 && nc < JB_COLS && !jbGrid[nr][nc] && !visited[nr][nc]) {
              visited[nr][nc] = true; stack.push({ r: nr, c: nc });
            }
          }
        }
        regions.push(region);
      }
    }
    for (const region of regions) {
      let hasBall = false;
      for (const b of jbBalls) {
        const bc = Math.floor(b.x / JB_CELL), br = Math.floor(b.y / JB_CELL);
        if (region.some(p => p.r === br && p.c === bc)) { hasBall = true; break; }
      }
      if (!hasBall) {
        for (const p of region) jbGrid[p.r][p.c] = 1;
        jbScore += region.length;
      }
    }
  }

  function jbShowGameOver() {
    $('gameOverTitle').textContent = 'Game Over';
    $('gameOverReason').textContent = 'Level: ' + jbLevel + ' | Score: ' + jbScore;
    $('gameOverRating').innerHTML = '';
    $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); jbGameLoopActive = false; document.removeEventListener('keydown', jbKeyHandler); showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startJezzballGame(); };
  }

  function jbRender() {
    if (!jbCtx) return;
    const ctx = jbCtx;
    ctx.fillStyle = '#0a0a2a'; ctx.fillRect(0, 0, JB_W, JB_H);

    // Draw filled cells
    for (let r = 0; r < JB_ROWS; r++) {
      for (let c = 0; c < JB_COLS; c++) {
        if (jbGrid[r][c]) {
          ctx.fillStyle = '#1a3a1a';
          ctx.fillRect(c * JB_CELL, r * JB_CELL, JB_CELL, JB_CELL);
        }
      }
    }

    // Grid border
    ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, JB_W, JB_H);

    // Growing walls
    for (const w of jbWalls) {
      if (!w.growing) continue;
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 8;
      for (const s of w.segments) ctx.fillRect(s.c * JB_CELL, s.r * JB_CELL, JB_CELL, JB_CELL);
      ctx.shadowBlur = 0;
    }

    // Balls
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 10;
    for (const b of jbBalls) {
      ctx.fillStyle = '#00ffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Direction indicator
    ctx.fillStyle = '#ffffff'; ctx.font = '12px monospace';
    ctx.fillText(jbHorizontal ? '— Horizontal' : '| Vertical', 10, JB_H - 10);
  }

  /* ================================================
     MINESWEEPER — Single Player
     ================================================ */
  const MS_CELL = 30;
  let msCanvas = null, msCtx = null, msGameLoopActive = false;
  let msGrid = [], msCols = 9, msRows = 9, msMines = 10, msDiff = 'Easy';
  let msRevealed = 0, msFlagged = 0, msGameOver = false, msWon = false, msFirstClick = true;
  let msTimer = null, msTime = 0;

  const MS_NUM_COLORS = ['', '#3333ff', '#008800', '#ff0000', '#000088', '#884400', '#00aaaa', '#000000', '#888888'];

  function setupMinesweeperCanvas() {
    msCanvas = $('minesweeperCanvas');
    if (msCanvas) { msCtx = msCanvas.getContext('2d'); }
  }

  function startMinesweeperGameLoop() {
    msGameLoopActive = true;
    function loop() { if (!msGameLoopActive) return; msRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function startMinesweeperGame(cols, rows, mines, diff) {
    msCols = cols; msRows = rows; msMines = mines; msDiff = diff;
    msGameOver = false; msWon = false; msFirstClick = true;
    msRevealed = 0; msFlagged = 0; msTime = 0;
    if (msTimer) clearInterval(msTimer);
    msTimer = null;
    msGrid = [];
    for (let r = 0; r < msRows; r++) {
      msGrid[r] = [];
      for (let c = 0; c < msCols; c++) msGrid[r][c] = { mine: false, revealed: false, flagged: false, adj: 0 };
    }
    if (msCanvas) {
      msCanvas.width = msCols * MS_CELL; msCanvas.height = msRows * MS_CELL;
      msCanvas.onclick = msHandleClick;
      msCanvas.oncontextmenu = msHandleRightClick;
      msCanvas.onauxclick = msHandleMiddleClick;
    }
    $('msRemaining').textContent = msMines;
    $('msTime').textContent = '0:00';
    $('msDifficulty').textContent = msDiff;
    $('gameOverOverlay').classList.add('hidden');
    showScreen('minesweeper');
    const newBtn = $('btnMsNewGame'); if (newBtn) newBtn.onclick = () => startMinesweeperGame(msCols, msRows, msMines, msDiff);
    const quitBtn = $('btnMsQuit'); if (quitBtn) quitBtn.onclick = () => { msGameLoopActive = false; if (msTimer) clearInterval(msTimer); showScreen('lobby'); };
  }

  function msPlaceMines(exR, exC) {
    let placed = 0;
    while (placed < msMines) {
      const r = Math.floor(Math.random() * msRows), c = Math.floor(Math.random() * msCols);
      if (msGrid[r][c].mine || (Math.abs(r - exR) <= 1 && Math.abs(c - exC) <= 1)) continue;
      msGrid[r][c].mine = true; placed++;
    }
    for (let r = 0; r < msRows; r++) for (let c = 0; c < msCols; c++) {
      if (msGrid[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < msRows && nc >= 0 && nc < msCols && msGrid[nr][nc].mine) count++;
      }
      msGrid[r][c].adj = count;
    }
  }

  function msHandleClick(e) {
    if (msGameOver) return;
    const rect = msCanvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) * (msCanvas.width / rect.width) / MS_CELL);
    const r = Math.floor((e.clientY - rect.top) * (msCanvas.height / rect.height) / MS_CELL);
    if (r < 0 || r >= msRows || c < 0 || c >= msCols) return;
    if (msGrid[r][c].flagged) return;
    if (msGrid[r][c].revealed) { msChord(r, c); return; }
    if (msFirstClick) { msPlaceMines(r, c); msFirstClick = false; msTimer = setInterval(() => { msTime++; $('msTime').textContent = Math.floor(msTime/60) + ':' + String(msTime%60).padStart(2,'0'); }, 1000); }
    msRevealCell(r, c);
  }

  function msHandleRightClick(e) {
    e.preventDefault();
    if (msGameOver) return;
    const rect = msCanvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) * (msCanvas.width / rect.width) / MS_CELL);
    const r = Math.floor((e.clientY - rect.top) * (msCanvas.height / rect.height) / MS_CELL);
    if (r < 0 || r >= msRows || c < 0 || c >= msCols) return;
    if (msGrid[r][c].revealed) return;
    msGrid[r][c].flagged = !msGrid[r][c].flagged;
    msFlagged += msGrid[r][c].flagged ? 1 : -1;
    $('msRemaining').textContent = msMines - msFlagged;
  }

  function msHandleMiddleClick(e) {
    if (e.button !== 1) return;
    if (msGameOver) return;
    const rect = msCanvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) * (msCanvas.width / rect.width) / MS_CELL);
    const r = Math.floor((e.clientY - rect.top) * (msCanvas.height / rect.height) / MS_CELL);
    if (r < 0 || r >= msRows || c < 0 || c >= msCols) return;
    if (msGrid[r][c].revealed) msChord(r, c);
  }

  function msRevealCell(r, c) {
    if (r < 0 || r >= msRows || c < 0 || c >= msCols) return;
    const cell = msGrid[r][c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true; msRevealed++;
    if (cell.mine) { msGameLost(); return; }
    if (cell.adj === 0) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        msRevealCell(r + dr, c + dc);
      }
    }
    if (msRevealed === msCols * msRows - msMines) { msWon = true; msGameOver = true; if (msTimer) clearInterval(msTimer); msShowGameOver(true); }
  }

  function msChord(r, c) {
    const cell = msGrid[r][c];
    if (!cell.revealed || cell.adj === 0) return;
    let flags = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < msRows && nc >= 0 && nc < msCols && msGrid[nr][nc].flagged) flags++;
    }
    if (flags === cell.adj) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < msRows && nc >= 0 && nc < msCols && !msGrid[nr][nc].flagged) msRevealCell(nr, nc);
      }
    }
  }

  function msGameLost() {
    msGameOver = true; if (msTimer) clearInterval(msTimer);
    for (let r = 0; r < msRows; r++) for (let c = 0; c < msCols; c++) {
      if (msGrid[r][c].mine) msGrid[r][c].revealed = true;
    }
    msShowGameOver(false);
  }

  function msShowGameOver(won) {
    $('gameOverTitle').textContent = won ? 'You Win!' : 'Game Over';
    $('gameOverReason').textContent = won ? 'Cleared in ' + msTime + 's!' : 'You hit a mine!';
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (won && typeof startConfetti === 'function') startConfetti();
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); msGameLoopActive = false; if (msTimer) clearInterval(msTimer); showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startMinesweeperGame(msCols, msRows, msMines, msDiff); };
  }

  function msRender() {
    if (!msCtx) return;
    const ctx = msCtx;
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, msCanvas.width, msCanvas.height);
    for (let r = 0; r < msRows; r++) {
      for (let c = 0; c < msCols; c++) {
        const x = c * MS_CELL, y = r * MS_CELL, cell = msGrid[r][c];
        if (cell.revealed) {
          ctx.fillStyle = '#222233'; ctx.fillRect(x + 1, y + 1, MS_CELL - 2, MS_CELL - 2);
          if (cell.mine) {
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(x + MS_CELL/2, y + MS_CELL/2, 8, 0, Math.PI * 2); ctx.fill();
          } else if (cell.adj > 0) {
            ctx.fillStyle = MS_NUM_COLORS[cell.adj]; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(cell.adj, x + MS_CELL/2, y + MS_CELL/2);
          }
        } else {
          ctx.fillStyle = '#444466'; ctx.fillRect(x + 1, y + 1, MS_CELL - 2, MS_CELL - 2);
          ctx.fillStyle = '#555577'; ctx.fillRect(x + 1, y + 1, MS_CELL - 3, 2); ctx.fillRect(x + 1, y + 1, 2, MS_CELL - 3);
          ctx.fillStyle = '#333355'; ctx.fillRect(x + MS_CELL - 3, y + 1, 2, MS_CELL - 2); ctx.fillRect(x + 1, y + MS_CELL - 3, MS_CELL - 2, 2);
          if (cell.flagged) {
            ctx.fillStyle = '#ff3333'; ctx.beginPath();
            ctx.moveTo(x + MS_CELL/2 - 2, y + 6); ctx.lineTo(x + MS_CELL/2 + 8, y + 12); ctx.lineTo(x + MS_CELL/2 - 2, y + 18); ctx.fill();
            ctx.fillRect(x + MS_CELL/2 - 3, y + 6, 2, 18);
          }
          if (msGameOver && cell.flagged && !cell.mine) {
            ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + MS_CELL - 4, y + MS_CELL - 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + MS_CELL - 4, y + 4); ctx.lineTo(x + 4, y + MS_CELL - 4); ctx.stroke();
          }
        }
      }
    }
  }

  /* ================================================
     SPACE INVADERS — Single Player
     ================================================ */
  const SI_W = 600, SI_H = 500;
  let siCanvas = null, siCtx = null, siGameLoopActive = false, siLastTime = 0;
  let siPlayer = {}, siBullets = [], siAliens = [], siAlienBullets = [];
  let siScore = 0, siWave = 1, siLives = 3, siGameOver = false;
  let siAlienDir = 1, siAlienTimer = 0, siAlienSpeed = 30, siShootCooldown = 0;
  let siKeysDown = {};

  function siKeyDown(e) { siKeysDown[e.key] = true; if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault(); }
  function siKeyUp(e) { siKeysDown[e.key] = false; }

  function setupSICanvas() {
    siCanvas = $('spaceinvadersCanvas');
    if (siCanvas) { siCanvas.width = SI_W; siCanvas.height = SI_H; siCtx = siCanvas.getContext('2d'); }
  }

  function startSIGameLoop() {
    siGameLoopActive = true;
    siLastTime = performance.now();
    function loop(now) { if (!siGameLoopActive) return; const dt = Math.min((now - siLastTime) / 16.667, 3); siLastTime = now; if (!siGameOver) siUpdate(dt); siRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function startSIGame() {
    siScore = 0; siWave = 1; siLives = 3; siGameOver = false;
    siPlayer = { x: SI_W / 2, y: SI_H - 30, w: 40, h: 15 };
    siBullets = []; siAlienBullets = []; siKeysDown = {};
    $('gameOverOverlay').classList.add('hidden');
    siSpawnWave();
    siUpdateHud();
    document.removeEventListener('keydown', siKeyDown); document.removeEventListener('keyup', siKeyUp);
    document.addEventListener('keydown', siKeyDown); document.addEventListener('keyup', siKeyUp);
    showScreen('spaceinvaders');
    const newBtn = $('btnSiNewGame'); if (newBtn) newBtn.onclick = startSIGame;
    const quitBtn = $('btnSiQuit'); if (quitBtn) quitBtn.onclick = () => { siGameLoopActive = false; document.removeEventListener('keydown', siKeyDown); document.removeEventListener('keyup', siKeyUp); showScreen('lobby'); };
  }

  function siSpawnWave() {
    siAliens = []; siAlienDir = 1; siAlienSpeed = Math.max(10, 30 - siWave * 3); siAlienTimer = 0;
    const rows = Math.min(5, 3 + Math.floor(siWave / 2));
    const cols = Math.min(11, 8 + Math.floor(siWave / 3));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      siAliens.push({ x: 60 + c * 45, y: 40 + r * 35, w: 30, h: 20, type: r, alive: true });
    }
  }

  function siUpdateHud() {
    $('siScore').textContent = siScore; $('siWave').textContent = siWave; $('siLives').textContent = siLives;
  }

  function siUpdate(dt) {
    if (!dt || dt <= 0) dt = 1;
    // Player movement
    if (siKeysDown['ArrowLeft'] || siKeysDown['a'] || siKeysDown['A']) siPlayer.x = Math.max(siPlayer.w/2, siPlayer.x - 4 * dt);
    if (siKeysDown['ArrowRight'] || siKeysDown['d'] || siKeysDown['D']) siPlayer.x = Math.min(SI_W - siPlayer.w/2, siPlayer.x + 4 * dt);

    // Shooting
    if (siShootCooldown > 0) siShootCooldown -= dt;
    if ((siKeysDown[' '] || siKeysDown['ArrowUp']) && siShootCooldown <= 0) {
      siBullets.push({ x: siPlayer.x, y: siPlayer.y - 10, vy: -7 }); siShootCooldown = 15;
    }

    // Move bullets
    for (let i = siBullets.length - 1; i >= 0; i--) {
      siBullets[i].y += siBullets[i].vy * dt;
      if (siBullets[i].y < 0) { siBullets.splice(i, 1); continue; }
      // Check alien hits
      for (const a of siAliens) {
        if (!a.alive) continue;
        if (siBullets[i] && Math.abs(siBullets[i].x - a.x - a.w/2) < a.w/2 && Math.abs(siBullets[i].y - a.y - a.h/2) < a.h/2) {
          a.alive = false; siBullets.splice(i, 1); siScore += (5 - a.type) * 10; siUpdateHud(); break;
        }
      }
    }

    // Alien movement
    siAlienTimer += dt;
    if (siAlienTimer >= siAlienSpeed) {
      siAlienTimer = 0;
      let hitEdge = false;
      for (const a of siAliens) { if (!a.alive) continue; if ((a.x + a.w + 10 * siAlienDir > SI_W) || (a.x + 10 * siAlienDir < 0)) { hitEdge = true; break; } }
      if (hitEdge) {
        siAlienDir = -siAlienDir;
        for (const a of siAliens) { if (a.alive) a.y += 15; }
      } else {
        for (const a of siAliens) { if (a.alive) a.x += 10 * siAlienDir; }
      }
    }

    // Alien shooting
    const alive = siAliens.filter(a => a.alive);
    if (alive.length > 0 && Math.random() < (0.02 + siWave * 0.005) * dt) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      siAlienBullets.push({ x: shooter.x + shooter.w/2, y: shooter.y + shooter.h, vy: 3 + siWave * 0.3 });
    }

    // Move alien bullets
    for (let i = siAlienBullets.length - 1; i >= 0; i--) {
      siAlienBullets[i].y += siAlienBullets[i].vy * dt;
      if (siAlienBullets[i].y > SI_H) { siAlienBullets.splice(i, 1); continue; }
      if (Math.abs(siAlienBullets[i].x - siPlayer.x) < siPlayer.w/2 && Math.abs(siAlienBullets[i].y - siPlayer.y) < siPlayer.h) {
        siAlienBullets.splice(i, 1); siLives--; siUpdateHud();
        if (siLives <= 0) { siGameOver = true; siShowGameOver(); return; }
      }
    }

    // Check aliens reaching bottom
    for (const a of alive) { if (a.y + a.h >= siPlayer.y - 10) { siGameOver = true; siShowGameOver(); return; } }

    // Check wave clear
    if (alive.length === 0) { siWave++; siSpawnWave(); siUpdateHud(); }
  }

  function siShowGameOver() {
    $('gameOverTitle').textContent = 'Game Over';
    $('gameOverReason').textContent = 'Score: ' + siScore + ' | Wave: ' + siWave;
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (siScore >= 3000 && typeof startConfetti === 'function') startConfetti();
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); siGameLoopActive = false; document.removeEventListener('keydown', siKeyDown); document.removeEventListener('keyup', siKeyUp); showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startSIGame(); };
  }

  function siRender() {
    if (!siCtx) return;
    const ctx = siCtx;
    ctx.fillStyle = '#000011'; ctx.fillRect(0, 0, SI_W, SI_H);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
      const sx = (i * 127 + 53) % SI_W, sy = (i * 89 + 31) % SI_H;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Player ship
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(siPlayer.x, siPlayer.y - siPlayer.h);
    ctx.lineTo(siPlayer.x - siPlayer.w/2, siPlayer.y + 5);
    ctx.lineTo(siPlayer.x + siPlayer.w/2, siPlayer.y + 5);
    ctx.closePath(); ctx.fill();

    // Aliens
    const alienColors = ['#ff4444', '#ff8844', '#ffcc44', '#44ff44', '#4488ff'];
    for (const a of siAliens) {
      if (!a.alive) continue;
      ctx.fillStyle = alienColors[a.type % alienColors.length];
      ctx.fillRect(a.x + 2, a.y + 2, a.w - 4, a.h - 4);
      // Eyes
      ctx.fillStyle = '#000'; ctx.fillRect(a.x + 7, a.y + 6, 4, 4); ctx.fillRect(a.x + a.w - 11, a.y + 6, 4, 4);
      // Legs
      ctx.fillStyle = alienColors[a.type % alienColors.length];
      ctx.fillRect(a.x + 3, a.y + a.h - 2, 4, 4); ctx.fillRect(a.x + a.w - 7, a.y + a.h - 2, 4, 4);
    }

    // Player bullets
    ctx.fillStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 6;
    for (const b of siBullets) ctx.fillRect(b.x - 1, b.y, 3, 8);
    ctx.shadowBlur = 0;

    // Alien bullets
    ctx.fillStyle = '#ff4444'; ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 4;
    for (const b of siAlienBullets) ctx.fillRect(b.x - 1, b.y, 3, 8);
    ctx.shadowBlur = 0;
  }

  /* ================================================
     TETRIS — Single Player
     ================================================ */
  const TET_COLS = 10, TET_ROWS = 20, TET_CELL = 30;
  const TET_W = TET_COLS * TET_CELL + 150, TET_H = TET_ROWS * TET_CELL;
  const TET_SHAPES = [
    [[1,1,1,1]],
    [[1,1],[1,1]],
    [[0,1,0],[1,1,1]],
    [[1,0,0],[1,1,1]],
    [[0,0,1],[1,1,1]],
    [[1,1,0],[0,1,1]],
    [[0,1,1],[1,1,0]]
  ];
  const TET_COLORS = ['#00ffff','#ffff00','#aa00ff','#0000ff','#ff8800','#00ff00','#ff0000'];

  let tetCanvas = null, tetCtx = null, tetGameLoopActive = false, tetLastTime = 0;
  let tetBoard = [], tetPiece = null, tetNext = null;
  let tetScore = 0, tetLevel = 1, tetLines = 0, tetGameOver = false;
  let tetDropTimer = 0, tetDropInterval = 45, tetLockDelay = 0;
  let tetFrameCount = 0;

  function setupTetrisCanvas() {
    tetCanvas = $('tetrisCanvas');
    if (tetCanvas) { tetCanvas.width = TET_W; tetCanvas.height = TET_H; tetCtx = tetCanvas.getContext('2d'); }
  }

  function startTetrisGameLoop() {
    tetGameLoopActive = true;
    tetLastTime = performance.now();
    function loop(now) { if (!tetGameLoopActive) return; const dt = Math.min((now - tetLastTime) / 16.667, 3); tetLastTime = now; if (!tetGameOver) tetUpdate(dt); tetRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function tetKeyDown(e) {
    if (tetGameOver) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { tetMovePiece(-1, 0); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { tetMovePiece(1, 0); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 's') { tetMovePiece(0, 1); tetScore++; e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'w') { tetRotate(); e.preventDefault(); }
    else if (e.key === ' ') { tetHardDrop(); e.preventDefault(); }
  }

  function startTetrisGame() {
    tetBoard = [];
    for (let r = 0; r < TET_ROWS; r++) { tetBoard[r] = []; for (let c = 0; c < TET_COLS; c++) tetBoard[r][c] = 0; }
    tetScore = 0; tetLevel = 1; tetLines = 0; tetGameOver = false;
    tetDropTimer = 0; tetDropInterval = 45; tetFrameCount = 0;
    tetNext = tetRandomPiece();
    tetSpawnPiece();
    $('gameOverOverlay').classList.add('hidden');
    document.removeEventListener('keydown', tetKeyDown);
    document.addEventListener('keydown', tetKeyDown);
    showScreen('tetris');
    tetUpdateHud();
    const newBtn = $('btnTetNewGame'); if (newBtn) newBtn.onclick = startTetrisGame;
    const quitBtn = $('btnTetQuit'); if (quitBtn) quitBtn.onclick = () => { tetGameLoopActive = false; document.removeEventListener('keydown', tetKeyDown); showScreen('lobby'); };
  }

  function tetUpdateHud() { $('tetScore').textContent = tetScore; $('tetLevel').textContent = tetLevel; $('tetLines').textContent = tetLines; }

  function tetRandomPiece() {
    const i = Math.floor(Math.random() * TET_SHAPES.length);
    return { shape: TET_SHAPES[i].map(r => [...r]), color: i, x: Math.floor(TET_COLS / 2) - 1, y: 0 };
  }

  function tetSpawnPiece() {
    tetPiece = tetNext; tetNext = tetRandomPiece();
    tetPiece.x = Math.floor(TET_COLS / 2) - Math.floor(tetPiece.shape[0].length / 2); tetPiece.y = 0;
    if (tetCollides(tetPiece.shape, tetPiece.x, tetPiece.y)) { tetGameOver = true; tetShowGameOver(); }
  }

  function tetCollides(shape, px, py) {
    for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nr = py + r, nc = px + c;
      if (nc < 0 || nc >= TET_COLS || nr >= TET_ROWS) return true;
      if (nr >= 0 && tetBoard[nr][nc]) return true;
    }
    return false;
  }

  function tetMovePiece(dx, dy) {
    if (!tetPiece) return false;
    if (!tetCollides(tetPiece.shape, tetPiece.x + dx, tetPiece.y + dy)) {
      tetPiece.x += dx; tetPiece.y += dy; return true;
    }
    return false;
  }

  function tetRotate() {
    if (!tetPiece) return;
    const s = tetPiece.shape;
    const newShape = [];
    for (let c = 0; c < s[0].length; c++) { newShape[c] = []; for (let r = s.length - 1; r >= 0; r--) newShape[c].push(s[r][c]); }
    if (!tetCollides(newShape, tetPiece.x, tetPiece.y)) tetPiece.shape = newShape;
    else if (!tetCollides(newShape, tetPiece.x - 1, tetPiece.y)) { tetPiece.shape = newShape; tetPiece.x--; }
    else if (!tetCollides(newShape, tetPiece.x + 1, tetPiece.y)) { tetPiece.shape = newShape; tetPiece.x++; }
  }

  function tetHardDrop() {
    if (!tetPiece) return;
    let dropped = 0;
    while (!tetCollides(tetPiece.shape, tetPiece.x, tetPiece.y + 1)) { tetPiece.y++; dropped++; }
    tetScore += dropped * 2;
    tetLockPiece();
  }

  function tetLockPiece() {
    const s = tetPiece.shape;
    for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) {
      if (s[r][c] && tetPiece.y + r >= 0) tetBoard[tetPiece.y + r][tetPiece.x + c] = tetPiece.color + 1;
    }
    // Clear lines
    let cleared = 0;
    for (let r = TET_ROWS - 1; r >= 0; r--) {
      if (tetBoard[r].every(c => c !== 0)) {
        tetBoard.splice(r, 1);
        tetBoard.unshift(new Array(TET_COLS).fill(0));
        cleared++; r++;
      }
    }
    if (cleared > 0) {
      const pts = [0, 100, 300, 500, 800];
      tetScore += (pts[cleared] || 800) * tetLevel;
      tetLines += cleared;
      tetLevel = Math.floor(tetLines / 10) + 1;
      tetDropInterval = Math.max(5, 45 - (tetLevel - 1) * 4);
    }
    tetUpdateHud();
    tetSpawnPiece();
  }

  function tetUpdate(dt) {
    if (!dt || dt <= 0) dt = 1;
    tetFrameCount += dt;
    tetDropTimer += dt;
    if (tetDropTimer >= tetDropInterval) {
      tetDropTimer = 0;
      if (!tetMovePiece(0, 1)) tetLockPiece();
    }
  }

  function tetShowGameOver() {
    $('gameOverTitle').textContent = 'Game Over';
    $('gameOverReason').textContent = 'Score: ' + tetScore + ' | Lines: ' + tetLines;
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (tetLines >= 20 && typeof startConfetti === 'function') startConfetti();
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); tetGameLoopActive = false; document.removeEventListener('keydown', tetKeyDown); showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startTetrisGame(); };
  }

  function tetRender() {
    if (!tetCtx) return;
    const ctx = tetCtx;
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, TET_W, TET_H);

    // Board
    for (let r = 0; r < TET_ROWS; r++) for (let c = 0; c < TET_COLS; c++) {
      const x = c * TET_CELL, y = r * TET_CELL;
      if (tetBoard[r][c]) {
        ctx.fillStyle = TET_COLORS[tetBoard[r][c] - 1]; ctx.fillRect(x + 1, y + 1, TET_CELL - 2, TET_CELL - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 1, y + 1, TET_CELL - 2, 3);
      } else {
        ctx.strokeStyle = '#1a1a2e'; ctx.strokeRect(x, y, TET_CELL, TET_CELL);
      }
    }

    // Ghost piece
    if (tetPiece) {
      let ghostY = tetPiece.y;
      while (!tetCollides(tetPiece.shape, tetPiece.x, ghostY + 1)) ghostY++;
      ctx.globalAlpha = 0.2;
      for (let r = 0; r < tetPiece.shape.length; r++) for (let c = 0; c < tetPiece.shape[r].length; c++) {
        if (tetPiece.shape[r][c]) {
          ctx.fillStyle = TET_COLORS[tetPiece.color];
          ctx.fillRect((tetPiece.x + c) * TET_CELL + 1, (ghostY + r) * TET_CELL + 1, TET_CELL - 2, TET_CELL - 2);
        }
      }
      ctx.globalAlpha = 1;

      // Current piece
      for (let r = 0; r < tetPiece.shape.length; r++) for (let c = 0; c < tetPiece.shape[r].length; c++) {
        if (tetPiece.shape[r][c]) {
          const px = (tetPiece.x + c) * TET_CELL, py = (tetPiece.y + r) * TET_CELL;
          ctx.fillStyle = TET_COLORS[tetPiece.color]; ctx.fillRect(px + 1, py + 1, TET_CELL - 2, TET_CELL - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px + 1, py + 1, TET_CELL - 2, 3);
        }
      }
    }

    // Next piece panel
    const panelX = TET_COLS * TET_CELL + 10;
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(panelX, 0, 140, 120);
    ctx.fillStyle = '#ffffff'; ctx.font = '14px monospace'; ctx.textAlign = 'left';
    ctx.fillText('NEXT', panelX + 10, 20);
    if (tetNext) {
      for (let r = 0; r < tetNext.shape.length; r++) for (let c = 0; c < tetNext.shape[r].length; c++) {
        if (tetNext.shape[r][c]) {
          ctx.fillStyle = TET_COLORS[tetNext.color];
          ctx.fillRect(panelX + 20 + c * 25, 35 + r * 25, 23, 23);
        }
      }
    }
    ctx.fillStyle = '#ffffff'; ctx.font = '12px monospace';
    ctx.fillText('Score: ' + tetScore, panelX + 10, 150);
    ctx.fillText('Level: ' + tetLevel, panelX + 10, 170);
    ctx.fillText('Lines: ' + tetLines, panelX + 10, 190);
  }

  /* ================================================
     COLUMNS — Single Player (Sega-style gem matching)
     ================================================ */
  const COL_COLS = 6, COL_ROWS = 13, COL_CELL = 35;
  const COL_W = COL_COLS * COL_CELL + 140, COL_H = COL_ROWS * COL_CELL;
  const COL_GEMS = ['#ff0044', '#00cc44', '#3344ff', '#ffcc00', '#ff44ff', '#00cccc'];

  let colCanvas = null, colCtx = null, colGameLoopActive = false, colLastTime = 0;
  let colBoard = [], colPiece = null, colNext = null;
  let colScore = 0, colLevel = 1, colJewels = 0, colGameOver = false;
  let colDropTimer = 0, colDropInterval = 40, colFrameCount = 0;
  let colClearing = false, colClearTimer = 0;

  function setupColumnsCanvas() {
    colCanvas = $('columnsCanvas');
    if (colCanvas) { colCanvas.width = COL_W; colCanvas.height = COL_H; colCtx = colCanvas.getContext('2d'); }
  }

  function startColumnsGameLoop() {
    colGameLoopActive = true;
    colLastTime = performance.now();
    function loop(now) { if (!colGameLoopActive) return; const dt = Math.min((now - colLastTime) / 16.667, 3); colLastTime = now; if (!colGameOver) colUpdate(dt); colRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function colKeyDown(e) {
    if (colGameOver || !colPiece) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { if (colPiece.x > 0 && !colBoard[colPiece.y][colPiece.x - 1] && !colBoard[colPiece.y + 1][colPiece.x - 1] && !colBoard[colPiece.y + 2][colPiece.x - 1]) colPiece.x--; e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { if (colPiece.x < COL_COLS - 1 && !colBoard[colPiece.y][colPiece.x + 1] && !colBoard[colPiece.y + 1][colPiece.x + 1] && !colBoard[colPiece.y + 2][colPiece.x + 1]) colPiece.x++; e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 's') { colDropTimer = colDropInterval; e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { colPiece.gems.unshift(colPiece.gems.pop()); e.preventDefault(); }
  }

  function startColumnsGame() {
    colBoard = [];
    for (let r = 0; r < COL_ROWS; r++) { colBoard[r] = []; for (let c = 0; c < COL_COLS; c++) colBoard[r][c] = 0; }
    colScore = 0; colLevel = 1; colJewels = 0; colGameOver = false;
    colDropTimer = 0; colDropInterval = 40; colFrameCount = 0;
    colClearing = false; colClearTimer = 0;
    colNext = colRandomPiece();
    colSpawnPiece();
    $('gameOverOverlay').classList.add('hidden');
    document.removeEventListener('keydown', colKeyDown);
    document.addEventListener('keydown', colKeyDown);
    showScreen('columns');
    colUpdateHud();
    const newBtn = $('btnColNewGame'); if (newBtn) newBtn.onclick = startColumnsGame;
    const quitBtn = $('btnColQuit'); if (quitBtn) quitBtn.onclick = () => { colGameLoopActive = false; document.removeEventListener('keydown', colKeyDown); showScreen('lobby'); };
  }

  function colUpdateHud() { $('colScore').textContent = colScore; $('colLevel').textContent = colLevel; $('colJewels').textContent = colJewels; }

  function colRandomPiece() {
    return { x: Math.floor(COL_COLS / 2), y: 0, gems: [
      Math.floor(Math.random() * COL_GEMS.length) + 1,
      Math.floor(Math.random() * COL_GEMS.length) + 1,
      Math.floor(Math.random() * COL_GEMS.length) + 1
    ]};
  }

  function colSpawnPiece() {
    colPiece = colNext; colNext = colRandomPiece();
    colPiece.x = Math.floor(COL_COLS / 2); colPiece.y = 0;
    if (colBoard[0][colPiece.x] || colBoard[1][colPiece.x] || colBoard[2][colPiece.x]) {
      colGameOver = true; colShowGameOver();
    }
  }

  function colUpdate(dt) {
    if (!dt || dt <= 0) dt = 1;
    colFrameCount += dt;

    if (colClearing) {
      colClearTimer -= dt;
      if (colClearTimer <= 0) {
        // Remove marked cells
        for (let r = 0; r < COL_ROWS; r++) for (let c = 0; c < COL_COLS; c++) {
          if (colBoard[r][c] < 0) colBoard[r][c] = 0;
        }
        // Apply gravity
        for (let c = 0; c < COL_COLS; c++) {
          let writeR = COL_ROWS - 1;
          for (let r = COL_ROWS - 1; r >= 0; r--) {
            if (colBoard[r][c]) { colBoard[writeR][c] = colBoard[r][c]; if (writeR !== r) colBoard[r][c] = 0; writeR--; }
          }
          for (let r = writeR; r >= 0; r--) colBoard[r][c] = 0;
        }
        colClearing = false;
        if (colCheckMatches()) { colClearing = true; colClearTimer = 20; }
        else colSpawnPiece();
      }
      return;
    }

    if (!colPiece) return;
    colDropTimer += dt;
    if (colDropTimer >= colDropInterval) {
      colDropTimer = 0;
      if (colPiece.y + 3 < COL_ROWS && !colBoard[colPiece.y + 3][colPiece.x]) {
        colPiece.y++;
      } else {
        // Lock piece
        for (let i = 0; i < 3; i++) {
          if (colPiece.y + i >= 0 && colPiece.y + i < COL_ROWS) colBoard[colPiece.y + i][colPiece.x] = colPiece.gems[i];
        }
        colPiece = null;
        if (colCheckMatches()) { colClearing = true; colClearTimer = 20; }
        else colSpawnPiece();
      }
    }
  }

  function colCheckMatches() {
    let found = false;
    const toRemove = [];
    // Check all directions: horizontal, vertical, diagonal
    for (let r = 0; r < COL_ROWS; r++) for (let c = 0; c < COL_COLS; c++) {
      if (!colBoard[r][c] || colBoard[r][c] < 0) continue;
      const v = Math.abs(colBoard[r][c]);
      for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
        let count = 1;
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < COL_ROWS && nc >= 0 && nc < COL_COLS && Math.abs(colBoard[nr][nc]) === v) { count++; nr += dr; nc += dc; }
        if (count >= 3) {
          for (let i = 0; i < count; i++) toRemove.push({ r: r + dr * i, c: c + dc * i });
          found = true;
        }
      }
    }
    for (const p of toRemove) {
      if (colBoard[p.r][p.c] > 0) { colBoard[p.r][p.c] = -colBoard[p.r][p.c]; colJewels++; colScore += 10 * colLevel; }
    }
    if (found) {
      colLevel = Math.floor(colJewels / 30) + 1;
      colDropInterval = Math.max(8, 40 - (colLevel - 1) * 4);
      colUpdateHud();
    }
    return found;
  }

  function colShowGameOver() {
    $('gameOverTitle').textContent = 'Game Over';
    $('gameOverReason').textContent = 'Score: ' + colScore + ' | Jewels: ' + colJewels;
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (colJewels >= 50 && typeof startConfetti === 'function') startConfetti();
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); colGameLoopActive = false; document.removeEventListener('keydown', colKeyDown); showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startColumnsGame(); };
  }

  function colRender() {
    if (!colCtx) return;
    const ctx = colCtx;
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, COL_W, COL_H);

    // Board
    for (let r = 0; r < COL_ROWS; r++) for (let c = 0; c < COL_COLS; c++) {
      const x = c * COL_CELL, y = r * COL_CELL;
      ctx.strokeStyle = '#1a1a2e'; ctx.strokeRect(x, y, COL_CELL, COL_CELL);
      if (colBoard[r][c]) {
        const gi = Math.abs(colBoard[r][c]) - 1;
        const flashing = colBoard[r][c] < 0 && colFrameCount % 6 < 3;
        ctx.fillStyle = flashing ? '#ffffff' : COL_GEMS[gi];
        ctx.shadowColor = COL_GEMS[gi]; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x + COL_CELL/2, y + COL_CELL/2, COL_CELL/2 - 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Gem highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(x + COL_CELL/2 - 4, y + COL_CELL/2 - 4, 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Current piece
    if (colPiece && !colClearing) {
      for (let i = 0; i < 3; i++) {
        const gi = colPiece.gems[i] - 1;
        const px = colPiece.x * COL_CELL, py = (colPiece.y + i) * COL_CELL;
        ctx.fillStyle = COL_GEMS[gi]; ctx.shadowColor = COL_GEMS[gi]; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(px + COL_CELL/2, py + COL_CELL/2, COL_CELL/2 - 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(px + COL_CELL/2 - 4, py + COL_CELL/2 - 4, 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Next piece panel
    const panelX = COL_COLS * COL_CELL + 10;
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(panelX, 0, 130, 140);
    ctx.fillStyle = '#ffffff'; ctx.font = '14px monospace'; ctx.textAlign = 'left';
    ctx.fillText('NEXT', panelX + 10, 20);
    if (colNext) {
      for (let i = 0; i < 3; i++) {
        const gi = colNext.gems[i] - 1;
        ctx.fillStyle = COL_GEMS[gi];
        ctx.beginPath(); ctx.arc(panelX + 40, 45 + i * 32, 12, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#ffffff'; ctx.font = '12px monospace';
    ctx.fillText('Score: ' + colScore, panelX + 10, 170);
    ctx.fillText('Level: ' + colLevel, panelX + 10, 190);
  }

  /* ================================================
     LIGHTS OUT
     ================================================ */
  let loCanvas, loCtx, loGameLoopActive = false;
  let loGrid, loSize, loMoves, loStartTime, loWon;
  const LO_CELL = 50, LO_PAD = 2;

  function setupLightsOutCanvas() {
    loCanvas = $('lightsoutCanvas');
    if (!loCanvas) return;
    loCtx = loCanvas.getContext('2d');
  }

  function startLightsOutGameLoop() {
    loGameLoopActive = true;
    function loop() { if (!loGameLoopActive) return; loRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function startLightsOutGame(size) {
    loSize = size || 5;
    const dim = loSize * LO_CELL + (loSize + 1) * LO_PAD;
    if (loCanvas) { loCanvas.width = dim; loCanvas.height = dim; }
    loMoves = 0; loStartTime = Date.now(); loWon = false;
    // Generate solvable puzzle: start all off, do random toggles
    loGrid = [];
    for (let r = 0; r < loSize; r++) { loGrid[r] = []; for (let c = 0; c < loSize; c++) loGrid[r][c] = false; }
    const toggleCount = Math.floor(loSize * loSize * 0.4) + Math.floor(Math.random() * loSize);
    for (let i = 0; i < toggleCount; i++) {
      loToggle(Math.floor(Math.random() * loSize), Math.floor(Math.random() * loSize), true);
    }
    // Ensure at least some lights are on
    let anyOn = loGrid.some(row => row.some(v => v));
    if (!anyOn) { loToggle(Math.floor(loSize/2), Math.floor(loSize/2), true); }
    loMoves = 0;
    showScreen('lightsout');
    $('loMoves').textContent = '0'; $('loTime').textContent = '0:00'; $('loSize').textContent = loSize + 'x' + loSize;
    // Bind click
    if (loCanvas) {
      loCanvas.onclick = function(e) { if (loWon) return; loHandleClick(e); };
      loCanvas.ontouchstart = function(e) { e.preventDefault(); if (loWon) return; const t = e.touches[0]; const rect = loCanvas.getBoundingClientRect(); loHandleClickAt(t.clientX - rect.left, t.clientY - rect.top); };
    }
    const newBtn = $('btnLoNewGame'); if (newBtn) newBtn.onclick = () => startLightsOutGame(loSize);
    const quitBtn = $('btnLoQuit'); if (quitBtn) quitBtn.onclick = () => { loGameLoopActive = false; showScreen('lobby'); };
  }

  function loToggle(r, c, setup) {
    const dirs = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < loSize && nc >= 0 && nc < loSize) loGrid[nr][nc] = !loGrid[nr][nc];
    }
    if (!setup) {
      loMoves++;
      $('loMoves').textContent = loMoves;
      // Check win
      if (loGrid.every(row => row.every(v => !v))) {
        loWon = true;
        loShowGameOver();
      }
    }
  }

  function loHandleClick(e) {
    const rect = loCanvas.getBoundingClientRect();
    loHandleClickAt(e.clientX - rect.left, e.clientY - rect.top);
  }

  function loHandleClickAt(mx, my) {
    const c = Math.floor(mx / (LO_CELL + LO_PAD));
    const r = Math.floor(my / (LO_CELL + LO_PAD));
    if (r >= 0 && r < loSize && c >= 0 && c < loSize) loToggle(r, c, false);
  }

  function loShowGameOver() {
    const elapsed = Math.floor((Date.now() - loStartTime) / 1000);
    $('gameOverTitle').textContent = 'You Win!';
    $('gameOverReason').textContent = 'Moves: ' + loMoves + ' | Time: ' + Math.floor(elapsed/60) + ':' + String(elapsed%60).padStart(2,'0');
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (typeof startConfetti === 'function') startConfetti();
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); loGameLoopActive = false; showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startLightsOutGame(loSize); };
  }

  function loRender() {
    if (!loCtx) return;
    const ctx = loCtx;
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, loCanvas.width, loCanvas.height);
    for (let r = 0; r < loSize; r++) {
      for (let c = 0; c < loSize; c++) {
        const x = c * (LO_CELL + LO_PAD) + LO_PAD;
        const y = r * (LO_CELL + LO_PAD) + LO_PAD;
        if (loGrid && loGrid[r][c]) {
          ctx.fillStyle = '#ffdd44'; ctx.shadowColor = '#ffdd44'; ctx.shadowBlur = 12;
          ctx.fillRect(x, y, LO_CELL, LO_CELL);
          ctx.shadowBlur = 0;
          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + 4, y + 4, LO_CELL - 8, 8);
        } else {
          ctx.fillStyle = '#1a1a2e'; ctx.fillRect(x, y, LO_CELL, LO_CELL);
          ctx.strokeStyle = '#2a2a4e'; ctx.strokeRect(x, y, LO_CELL, LO_CELL);
        }
      }
    }
    // Update timer
    if (!loWon && loStartTime) {
      const elapsed = Math.floor((Date.now() - loStartTime) / 1000);
      $('loTime').textContent = Math.floor(elapsed/60) + ':' + String(elapsed%60).padStart(2,'0');
    }
  }

  /* ================================================
     HELICOPTER
     ================================================ */
  let hcCanvas, hcCtx, hcGameLoopActive = false, hcLastTime = 0;
  const HC_W = 600, HC_H = 400;
  let hcFlying, hcX, hcY, hcVy, hcScore, hcBest = 0, hcSpeed, hcDead;
  let hcTopTerrain, hcBottomTerrain, hcPillars, hcParticles;
  let hcGapSize, hcPillarTimer;
  const HC_GRAVITY = 0.35, HC_LIFT = -0.55, HC_HELI_W = 30, HC_HELI_H = 14;

  function setupHelicopterCanvas() {
    hcCanvas = $('helicopterCanvas');
    if (hcCanvas) { hcCanvas.width = HC_W; hcCanvas.height = HC_H; hcCtx = hcCanvas.getContext('2d'); }
  }

  function startHelicopterGameLoop() {
    hcGameLoopActive = true;
    hcLastTime = performance.now();
    function loop(now) { if (!hcGameLoopActive) return; const dt = Math.min((now - hcLastTime) / 16.667, 3); hcLastTime = now; hcUpdate(dt); hcRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function startHelicopterGame() {
    hcX = 80; hcY = HC_H / 2; hcVy = 0; hcScore = 0; hcSpeed = 2; hcDead = false; hcFlying = false;
    hcGapSize = 160; hcPillarTimer = 0;
    // Init terrain
    hcTopTerrain = []; hcBottomTerrain = [];
    let top = 40, bot = HC_H - 40;
    for (let i = 0; i <= HC_W + 10; i += 5) {
      top += (Math.random() - 0.5) * 4; top = Math.max(10, Math.min(HC_H / 2 - 50, top));
      bot += (Math.random() - 0.5) * 4; bot = Math.max(HC_H / 2 + 50, Math.min(HC_H - 10, bot));
      hcTopTerrain.push(top); hcBottomTerrain.push(bot);
    }
    hcPillars = []; hcParticles = [];
    showScreen('helicopter');
    $('hcScore').textContent = '0'; $('hcBest').textContent = hcBest; $('hcSpeed').textContent = '1x';
    // Input (remove first to avoid duplicates on restart)
    document.removeEventListener('keydown', hcKeyDown);
    document.removeEventListener('keyup', hcKeyUp);
    document.addEventListener('keydown', hcKeyDown);
    document.addEventListener('keyup', hcKeyUp);
    if (hcCanvas) {
      hcCanvas.onmousedown = () => { if (!hcDead) hcFlying = true; };
      hcCanvas.onmouseup = () => { hcFlying = false; };
      hcCanvas.ontouchstart = (e) => { e.preventDefault(); if (!hcDead) hcFlying = true; };
      hcCanvas.ontouchend = (e) => { e.preventDefault(); hcFlying = false; };
    }
    const newBtn = $('btnHcNewGame'); if (newBtn) newBtn.onclick = startHelicopterGame;
    const quitBtn = $('btnHcQuit'); if (quitBtn) quitBtn.onclick = () => { hcGameLoopActive = false; document.removeEventListener('keydown', hcKeyDown); document.removeEventListener('keyup', hcKeyUp); showScreen('lobby'); };
  }

  function hcKeyDown(e) { if (e.code === 'Space') { e.preventDefault(); if (!hcDead) hcFlying = true; } }
  function hcKeyUp(e) { if (e.code === 'Space') { hcFlying = false; } }

  function hcUpdate(dt) {
    if (!dt || dt <= 0) dt = 1;
    if (hcDead) return;
    // Physics
    if (hcFlying) hcVy += HC_LIFT * dt; else hcVy += HC_GRAVITY * dt;
    hcVy = Math.max(-6, Math.min(6, hcVy));
    hcY += hcVy * dt;
    hcScore += Math.ceil(hcSpeed * dt);
    hcSpeed += 0.001 * dt;
    $('hcScore').textContent = hcScore;
    $('hcSpeed').textContent = hcSpeed.toFixed(1) + 'x';

    // Scroll terrain
    const scrollAmt = Math.max(1, Math.ceil(hcSpeed * dt));
    // Shift terrain left
    for (let i = 0; i < scrollAmt; i++) {
      hcTopTerrain.shift();
      hcBottomTerrain.shift();
      const lastTop = hcTopTerrain[hcTopTerrain.length - 1] || 40;
      const lastBot = hcBottomTerrain[hcBottomTerrain.length - 1] || HC_H - 40;
      let newTop = lastTop + (Math.random() - 0.5) * 6;
      let newBot = lastBot + (Math.random() - 0.5) * 6;
      const minGap = hcGapSize;
      newTop = Math.max(10, Math.min(HC_H / 2 - 30, newTop));
      newBot = Math.max(HC_H / 2 + 30, Math.min(HC_H - 10, newBot));
      if (newBot - newTop < minGap) { newTop = (newBot + newTop) / 2 - minGap / 2; newBot = newTop + minGap; }
      hcTopTerrain.push(newTop);
      hcBottomTerrain.push(newBot);
    }
    // Gradually shrink gap
    if (hcGapSize > 80) hcGapSize -= 0.005 * dt;

    // Pillars
    hcPillarTimer += scrollAmt;
    if (hcPillarTimer > 200) {
      hcPillarTimer = 0;
      const terrIdx = Math.min(hcTopTerrain.length - 1, Math.floor(HC_W / 5));
      const tTop = hcTopTerrain[terrIdx] || 50;
      const tBot = hcBottomTerrain[terrIdx] || HC_H - 50;
      const fromTop = Math.random() > 0.5;
      const pH = 30 + Math.random() * 60;
      hcPillars.push({ x: HC_W + 10, fromTop, h: pH, top: tTop, bot: tBot });
    }
    for (let i = hcPillars.length - 1; i >= 0; i--) {
      hcPillars[i].x -= scrollAmt;
      if (hcPillars[i].x < -30) hcPillars.splice(i, 1);
    }

    // Particles
    hcParticles.push({ x: hcX - HC_HELI_W/2, y: hcY + Math.random() * 6 - 3, life: 15, vx: -2, vy: Math.random() * 2 - 1 });
    for (let i = hcParticles.length - 1; i >= 0; i--) {
      hcParticles[i].x += hcParticles[i].vx * dt;
      hcParticles[i].y += hcParticles[i].vy * dt;
      hcParticles[i].life -= dt;
      if (hcParticles[i].life <= 0) hcParticles.splice(i, 1);
    }

    // Collision with terrain
    const tIdx = Math.floor(hcX / 5);
    if (tIdx >= 0 && tIdx < hcTopTerrain.length) {
      if (hcY - HC_HELI_H/2 < hcTopTerrain[tIdx] || hcY + HC_HELI_H/2 > hcBottomTerrain[tIdx]) {
        hcDie();
        return;
      }
    }
    // Collision with pillars
    for (const p of hcPillars) {
      if (hcX + HC_HELI_W/2 > p.x && hcX - HC_HELI_W/2 < p.x + 20) {
        if (p.fromTop) {
          if (hcY - HC_HELI_H/2 < p.top + p.h) { hcDie(); return; }
        } else {
          if (hcY + HC_HELI_H/2 > p.bot - p.h) { hcDie(); return; }
        }
      }
    }
    // Off screen
    if (hcY < 0 || hcY > HC_H) { hcDie(); return; }
  }

  function hcDie() {
    hcDead = true;
    if (hcScore > hcBest) hcBest = hcScore;
    $('hcBest').textContent = hcBest;
    hcShowGameOver();
  }

  function hcShowGameOver() {
    $('gameOverTitle').textContent = 'Crash!';
    $('gameOverReason').textContent = 'Score: ' + hcScore + ' | Best: ' + hcBest;
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); hcGameLoopActive = false; document.removeEventListener('keydown', hcKeyDown); document.removeEventListener('keyup', hcKeyUp); showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startHelicopterGame(); };
  }

  function hcRender() {
    if (!hcCtx) return;
    const ctx = hcCtx;
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, HC_H);
    grad.addColorStop(0, '#0a0a2e'); grad.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, HC_W, HC_H);

    // Top terrain
    ctx.fillStyle = '#228833';
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let i = 0; i < hcTopTerrain.length && i * 5 <= HC_W; i++) ctx.lineTo(i * 5, hcTopTerrain[i]);
    ctx.lineTo(HC_W, 0); ctx.closePath(); ctx.fill();

    // Bottom terrain
    ctx.beginPath(); ctx.moveTo(0, HC_H);
    for (let i = 0; i < hcBottomTerrain.length && i * 5 <= HC_W; i++) ctx.lineTo(i * 5, hcBottomTerrain[i]);
    ctx.lineTo(HC_W, HC_H); ctx.closePath(); ctx.fill();

    // Pillars
    ctx.fillStyle = '#664422';
    for (const p of hcPillars) {
      if (p.fromTop) ctx.fillRect(p.x, p.top, 20, p.h);
      else ctx.fillRect(p.x, p.bot - p.h, 20, p.h);
    }

    // Particles
    for (const pt of hcParticles) {
      const a = pt.life / 15;
      ctx.fillStyle = 'rgba(255,' + Math.floor(150 * a) + ',0,' + a.toFixed(2) + ')';
      ctx.fillRect(pt.x, pt.y, 3, 3);
    }

    // Helicopter
    if (!hcDead) {
      ctx.fillStyle = '#33cc33';
      ctx.fillRect(hcX - HC_HELI_W/2, hcY - HC_HELI_H/2, HC_HELI_W, HC_HELI_H);
      // Rotor
      ctx.strokeStyle = '#aaffaa'; ctx.lineWidth = 2;
      const rotorW = 24 + Math.sin(Date.now() * 0.05) * 10;
      ctx.beginPath(); ctx.moveTo(hcX - rotorW/2, hcY - HC_HELI_H/2 - 3);
      ctx.lineTo(hcX + rotorW/2, hcY - HC_HELI_H/2 - 3); ctx.stroke();
      // Tail
      ctx.fillStyle = '#228822';
      ctx.fillRect(hcX - HC_HELI_W/2 - 10, hcY - 3, 12, 6);
    }
  }

  /* ================================================
     DOPE WARS
     ================================================ */
  let dwCanvas, dwCtx, dwGameLoopActive = false;
  const DW_W = 500, DW_H = 600;
  let dwCash, dwDay, dwMaxDays, dwInventory, dwMaxSlots, dwPrices;
  let dwLocation, dwScreen, dwSelectedGood, dwQuantity, dwEventText;
  let dwDebt, dwBank;
  const DW_LOCATIONS = ['Bronx', 'Ghetto', 'Central Park', 'Manhattan', 'Brooklyn', 'Queens'];
  const DW_GOODS = [
    { name: 'Lemonade', min: 15, max: 80 },
    { name: 'Brownies', min: 40, max: 200 },
    { name: 'Comics', min: 100, max: 600 },
    { name: 'Vinyl', min: 300, max: 1200 },
    { name: 'Sneakers', min: 600, max: 3000 },
    { name: 'Gadgets', min: 1500, max: 8000 }
  ];
  let dwHolding; // { [goodIndex]: count }
  let dwButtons; // clickable regions on canvas

  function setupDopeWarsCanvas() {
    dwCanvas = $('dopewarsCanvas');
    if (dwCanvas) { dwCanvas.width = DW_W; dwCanvas.height = DW_H; dwCtx = dwCanvas.getContext('2d'); }
  }

  function startDopeWarsGameLoop() {
    dwGameLoopActive = true;
    function loop() { if (!dwGameLoopActive) return; dwRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function startDopeWarsGame() {
    dwCash = 2000; dwDay = 1; dwMaxDays = 30; dwMaxSlots = 100;
    dwLocation = 0; dwScreen = 'main'; dwSelectedGood = -1; dwQuantity = 0;
    dwEventText = null; dwDebt = 5000; dwBank = 0;
    dwHolding = {};
    dwButtons = [];
    dwGeneratePrices();
    showScreen('dopewars');
    $('dwCash').textContent = '$' + dwCash; $('dwDay').textContent = dwDay + '/' + dwMaxDays; $('dwSpace').textContent = dwUsedSlots() + '/' + dwMaxSlots;
    if (dwCanvas) {
      dwCanvas.onclick = dwHandleClick;
      dwCanvas.ontouchstart = function(e) { e.preventDefault(); const t = e.touches[0]; const rect = dwCanvas.getBoundingClientRect(); dwHandleClickAt(t.clientX - rect.left, t.clientY - rect.top); };
    }
    const newBtn = $('btnDwNewGame'); if (newBtn) newBtn.onclick = startDopeWarsGame;
    const quitBtn = $('btnDwQuit'); if (quitBtn) quitBtn.onclick = () => { dwGameLoopActive = false; showScreen('lobby'); };
  }

  function dwUsedSlots() {
    let total = 0; for (const k in dwHolding) total += dwHolding[k]; return total;
  }

  function dwGeneratePrices() {
    dwPrices = DW_GOODS.map(g => g.min + Math.floor(Math.random() * (g.max - g.min)));
  }

  function dwHandleClick(e) {
    const rect = dwCanvas.getBoundingClientRect();
    dwHandleClickAt(e.clientX - rect.left, e.clientY - rect.top);
  }

  function dwHandleClickAt(mx, my) {
    for (const b of dwButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        b.action();
        return;
      }
    }
  }

  function dwTravel(locIdx) {
    dwLocation = locIdx; dwDay++;
    dwGeneratePrices();
    // Random event
    const ev = Math.random();
    if (ev < 0.08) {
      const gi = Math.floor(Math.random() * DW_GOODS.length);
      dwPrices[gi] = Math.floor(dwPrices[gi] * 0.2);
      dwEventText = DW_GOODS[gi].name + ' prices crashed!';
      dwScreen = 'event';
    } else if (ev < 0.16) {
      const gi = Math.floor(Math.random() * DW_GOODS.length);
      dwPrices[gi] = Math.floor(dwPrices[gi] * 4);
      dwEventText = DW_GOODS[gi].name + ' prices skyrocketed!';
      dwScreen = 'event';
    } else if (ev < 0.22) {
      const lost = Math.floor(dwCash * 0.15);
      dwCash = Math.max(0, dwCash - lost);
      dwEventText = 'You got mugged! Lost $' + lost;
      dwScreen = 'event';
    } else if (ev < 0.28) {
      const found = 200 + Math.floor(Math.random() * 800);
      dwCash += found;
      dwEventText = 'You found $' + found + ' on the ground!';
      dwScreen = 'event';
    } else {
      dwScreen = 'main';
    }
    // Daily interest on debt
    if (dwDebt > 0) dwDebt = Math.floor(dwDebt * 1.05);
    if (dwDay > dwMaxDays) { dwEndGame(); return; }
    dwUpdateHUD();
  }

  function dwUpdateHUD() {
    $('dwCash').textContent = '$' + dwCash;
    $('dwDay').textContent = dwDay + '/' + dwMaxDays;
    $('dwSpace').textContent = dwUsedSlots() + '/' + dwMaxSlots;
  }

  function dwEndGame() {
    // Sell all remaining at current prices
    let sellValue = 0;
    for (const k in dwHolding) sellValue += (dwHolding[k] || 0) * dwPrices[k];
    const finalCash = dwCash + sellValue + dwBank - dwDebt;
    $('gameOverTitle').textContent = 'Game Over';
    $('gameOverReason').textContent = 'Final Worth: $' + finalCash;
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (finalCash > 20000 && typeof startConfetti === 'function') startConfetti();
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); dwGameLoopActive = false; showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startDopeWarsGame(); };
  }

  function dwDrawButton(ctx, x, y, w, h, text, color) {
    ctx.fillStyle = color || '#2a2a4e';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#5a5a8e'; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ffffff'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
    ctx.fillText(text, x + w/2, y + h/2 + 5);
    dwButtons.push({ x, y, w, h, action: null });
    return dwButtons[dwButtons.length - 1];
  }

  function dwRender() {
    if (!dwCtx) return;
    const ctx = dwCtx;
    dwButtons = [];
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, DW_W, DW_H);

    ctx.textAlign = 'left'; ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 18px monospace';
    ctx.fillText('Day ' + dwDay + '/' + dwMaxDays + '  |  ' + DW_LOCATIONS[dwLocation], 15, 30);
    ctx.fillStyle = '#aaaaaa'; ctx.font = '14px monospace';
    ctx.fillText('Cash: $' + dwCash + '  Debt: $' + dwDebt + '  Bank: $' + dwBank, 15, 52);
    ctx.fillText('Inventory: ' + dwUsedSlots() + '/' + dwMaxSlots, 15, 70);

    if (dwScreen === 'event') {
      ctx.fillStyle = '#ff6644'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
      ctx.fillText('EVENT!', DW_W/2, 150);
      ctx.fillStyle = '#ffffff'; ctx.font = '16px monospace';
      const lines = dwEventText.length > 40 ? [dwEventText.substring(0, 40), dwEventText.substring(40)] : [dwEventText];
      lines.forEach((line, i) => ctx.fillText(line, DW_W/2, 190 + i * 24));
      const b = dwDrawButton(ctx, DW_W/2 - 60, 260, 120, 36, 'Continue');
      b.action = () => { dwScreen = 'main'; };
      return;
    }

    if (dwScreen === 'buy' || dwScreen === 'sell') {
      const gi = dwSelectedGood;
      const good = DW_GOODS[gi];
      const price = dwPrices[gi];
      const held = dwHolding[gi] || 0;
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
      ctx.fillText((dwScreen === 'buy' ? 'Buy ' : 'Sell ') + good.name, DW_W/2, 120);
      ctx.fillText('Price: $' + price + '  |  Holding: ' + held, DW_W/2, 150);
      const maxBuy = Math.min(Math.floor(dwCash / price), dwMaxSlots - dwUsedSlots());
      const maxSell = held;
      const maxQty = dwScreen === 'buy' ? maxBuy : maxSell;
      ctx.fillText('Quantity: ' + dwQuantity + '  (max ' + maxQty + ')', DW_W/2, 190);
      // +1, +10, +Max, -1, -10
      const bw = 60, bh = 32, bsy = 210;
      const b1 = dwDrawButton(ctx, 40, bsy, bw, bh, '+1'); b1.action = () => { dwQuantity = Math.min(dwQuantity + 1, maxQty); };
      const b2 = dwDrawButton(ctx, 110, bsy, bw, bh, '+10'); b2.action = () => { dwQuantity = Math.min(dwQuantity + 10, maxQty); };
      const b3 = dwDrawButton(ctx, 180, bsy, bw, bh, 'Max'); b3.action = () => { dwQuantity = maxQty; };
      const b4 = dwDrawButton(ctx, 260, bsy, bw, bh, '-1'); b4.action = () => { dwQuantity = Math.max(0, dwQuantity - 1); };
      const b5 = dwDrawButton(ctx, 340, bsy, bw, bh, '-10'); b5.action = () => { dwQuantity = Math.max(0, dwQuantity - 10); };
      // Confirm / Cancel
      const bc = dwDrawButton(ctx, 100, 270, 120, 36, 'Confirm', '#336633');
      bc.action = () => {
        if (dwQuantity <= 0) return;
        if (dwScreen === 'buy') {
          const cost = dwQuantity * price;
          if (cost > dwCash || dwUsedSlots() + dwQuantity > dwMaxSlots) return;
          dwCash -= cost; dwHolding[gi] = (dwHolding[gi] || 0) + dwQuantity;
        } else {
          if (dwQuantity > held) return;
          dwCash += dwQuantity * price; dwHolding[gi] -= dwQuantity;
          if (dwHolding[gi] <= 0) delete dwHolding[gi];
        }
        dwUpdateHUD(); dwScreen = 'main'; dwQuantity = 0;
      };
      const bx = dwDrawButton(ctx, 260, 270, 120, 36, 'Cancel', '#663333');
      bx.action = () => { dwScreen = 'main'; dwQuantity = 0; };
      return;
    }

    // Main screen - goods list
    ctx.fillStyle = '#cccccc'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
    ctx.fillText('GOOD', 20, 100); ctx.fillText('PRICE', 150, 100); ctx.fillText('HELD', 250, 100);
    for (let i = 0; i < DW_GOODS.length; i++) {
      const y = 120 + i * 40;
      ctx.fillStyle = '#ffffff'; ctx.font = '14px monospace'; ctx.textAlign = 'left';
      ctx.fillText(DW_GOODS[i].name, 20, y + 14);
      ctx.fillText('$' + dwPrices[i], 150, y + 14);
      ctx.fillText('' + (dwHolding[i] || 0), 250, y + 14);
      const bb = dwDrawButton(ctx, 310, y - 2, 55, 26, 'Buy');
      bb.action = ((idx) => () => { dwSelectedGood = idx; dwQuantity = 0; dwScreen = 'buy'; })(i);
      const bs = dwDrawButton(ctx, 375, y - 2, 55, 26, 'Sell');
      bs.action = ((idx) => () => { dwSelectedGood = idx; dwQuantity = 0; dwScreen = 'sell'; })(i);
    }

    // Bank & Debt
    const bankY = 370;
    ctx.fillStyle = '#aaaaaa'; ctx.font = '13px monospace'; ctx.textAlign = 'left';
    ctx.fillText('Bank: $' + dwBank + '  |  Debt: $' + dwDebt, 20, bankY);
    const bDep = dwDrawButton(ctx, 20, bankY + 10, 80, 28, 'Deposit');
    bDep.action = () => { const amt = Math.min(dwCash, 1000); if (amt > 0) { dwCash -= amt; dwBank += amt; dwUpdateHUD(); } };
    const bWith = dwDrawButton(ctx, 110, bankY + 10, 80, 28, 'Withdraw');
    bWith.action = () => { const amt = Math.min(dwBank, 1000); if (amt > 0) { dwBank -= amt; dwCash += amt; dwUpdateHUD(); } };
    const bPay = dwDrawButton(ctx, 200, bankY + 10, 100, 28, 'Pay Debt');
    bPay.action = () => { const amt = Math.min(dwCash, dwDebt); if (amt > 0) { dwCash -= amt; dwDebt -= amt; dwUpdateHUD(); } };

    // Travel buttons
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
    ctx.fillText('TRAVEL TO:', 20, 440);
    for (let i = 0; i < DW_LOCATIONS.length; i++) {
      if (i === dwLocation) continue;
      const col = Math.floor(i > dwLocation ? i - 1 : i) % 3;
      const row = Math.floor((i > dwLocation ? i - 1 : i) / 3);
      const bx = 20 + col * 155, by = 460 + row * 40;
      const bt = dwDrawButton(ctx, bx, by, 145, 32, DW_LOCATIONS[i], '#1a3a5e');
      bt.action = ((idx) => () => dwTravel(idx))(i);
    }
  }

  /* ================================================
     MISSILE COMMAND
     ================================================ */
  let mcCanvas, mcCtx, mcGameLoopActive = false, mcLastTime = 0;
  const MC_W = 600, MC_H = 500;
  let mcScore, mcWave, mcCities, mcBatteries, mcMissiles, mcCounters, mcExplosions;
  let mcGameOver, mcWaveActive, mcWaveTimer, mcMissilesLeft, mcStars;

  function setupMissileCommandCanvas() {
    mcCanvas = $('missilecommandCanvas');
    if (mcCanvas) { mcCanvas.width = MC_W; mcCanvas.height = MC_H; mcCtx = mcCanvas.getContext('2d'); }
  }

  function startMissileCommandGameLoop() {
    mcGameLoopActive = true;
    mcLastTime = performance.now();
    function loop(now) { if (!mcGameLoopActive) return; const dt = Math.min((now - mcLastTime) / 16.667, 3); mcLastTime = now; mcUpdate(dt); mcRender(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }

  function startMissileCommandGame() {
    mcScore = 0; mcWave = 1; mcGameOver = false; mcWaveActive = true; mcWaveTimer = 0;
    mcMissiles = []; mcCounters = []; mcExplosions = [];
    // 6 cities
    mcCities = [];
    const cityPositions = [60, 130, 200, 380, 450, 520];
    for (const x of cityPositions) mcCities.push({ x, alive: true });
    // 3 batteries
    mcBatteries = [
      { x: 30, ammo: 10 },
      { x: MC_W / 2, ammo: 10 },
      { x: MC_W - 30, ammo: 10 }
    ];
    // Stars
    mcStars = [];
    for (let i = 0; i < 60; i++) mcStars.push({ x: Math.random() * MC_W, y: Math.random() * (MC_H - 80), bright: Math.random() });
    mcMissilesLeft = 5 + mcWave * 2;
    showScreen('missilecommand');
    $('mcScore').textContent = '0'; $('mcWave').textContent = '1'; $('mcCities').textContent = '6';
    if (mcCanvas) {
      mcCanvas.onclick = mcHandleClick;
      mcCanvas.ontouchstart = function(e) { e.preventDefault(); const t = e.touches[0]; const rect = mcCanvas.getBoundingClientRect(); mcFireAt(t.clientX - rect.left, t.clientY - rect.top); };
    }
    const newBtn = $('btnMcNewGame'); if (newBtn) newBtn.onclick = startMissileCommandGame;
    const quitBtn = $('btnMcQuit'); if (quitBtn) quitBtn.onclick = () => { mcGameLoopActive = false; showScreen('lobby'); };
  }

  function mcHandleClick(e) {
    if (mcGameOver) return;
    const rect = mcCanvas.getBoundingClientRect();
    mcFireAt(e.clientX - rect.left, e.clientY - rect.top);
  }

  function mcFireAt(tx, ty) {
    if (mcGameOver || ty > MC_H - 60) return;
    // Find nearest battery with ammo
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < mcBatteries.length; i++) {
      if (mcBatteries[i].ammo <= 0) continue;
      const d = Math.abs(mcBatteries[i].x - tx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (best < 0) return;
    mcBatteries[best].ammo--;
    const bx = mcBatteries[best].x, by = MC_H - 50;
    const dx = tx - bx, dy = ty - by;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const speed = 5;
    mcCounters.push({
      x: bx, y: by, tx, ty,
      vx: (dx / dist) * speed, vy: (dy / dist) * speed,
      trail: []
    });
  }

  function mcUpdate(dt) {
    if (!dt || dt <= 0) dt = 1;
    if (mcGameOver) return;
    // Spawn incoming missiles
    mcWaveTimer += dt;
    const spawnInterval = Math.max(20, 80 - mcWave * 5);
    if (mcWaveActive && mcMissilesLeft > 0 && mcWaveTimer >= spawnInterval) {
      mcWaveTimer -= spawnInterval;
      mcMissilesLeft--;
      const tx = mcCities.filter(c => c.alive);
      if (tx.length === 0) { mcEndGame(); return; }
      const target = tx[Math.floor(Math.random() * tx.length)];
      const sx = Math.random() * MC_W;
      const speed = 0.5 + mcWave * 0.15;
      const dx = target.x - sx, dy = (MC_H - 30) - 0;
      const dist = Math.sqrt(dx*dx + dy*dy);
      mcMissiles.push({ x: sx, y: 0, vx: (dx/dist)*speed, vy: (dy/dist)*speed, trail: [] });
    }

    // Update incoming missiles
    for (let i = mcMissiles.length - 1; i >= 0; i--) {
      const m = mcMissiles[i];
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 30) m.trail.shift();
      m.x += m.vx * dt; m.y += m.vy * dt;
      // Hit ground
      if (m.y >= MC_H - 30) {
        // Check city damage
        for (const c of mcCities) {
          if (c.alive && Math.abs(c.x - m.x) < 25) c.alive = false;
        }
        mcExplosions.push({ x: m.x, y: m.y, r: 0, maxR: 25, growing: true });
        mcMissiles.splice(i, 1);
        $('mcCities').textContent = mcCities.filter(c => c.alive).length;
        continue;
      }
      // Check if hit by explosion
      let destroyed = false;
      for (const ex of mcExplosions) {
        const dx = m.x - ex.x, dy = m.y - ex.y;
        if (Math.sqrt(dx*dx + dy*dy) < ex.r) {
          mcScore += 25;
          mcExplosions.push({ x: m.x, y: m.y, r: 0, maxR: 20, growing: true });
          mcMissiles.splice(i, 1);
          destroyed = true;
          break;
        }
      }
      if (destroyed) continue;
    }

    // Update counter-missiles
    for (let i = mcCounters.length - 1; i >= 0; i--) {
      const c = mcCounters[i];
      c.trail.push({ x: c.x, y: c.y });
      if (c.trail.length > 15) c.trail.shift();
      c.x += c.vx * dt; c.y += c.vy * dt;
      const dx = c.x - c.tx, dy = c.y - c.ty;
      if (Math.sqrt(dx*dx + dy*dy) < 8) {
        mcExplosions.push({ x: c.tx, y: c.ty, r: 0, maxR: 35, growing: true });
        mcCounters.splice(i, 1);
      }
    }

    // Update explosions
    for (let i = mcExplosions.length - 1; i >= 0; i--) {
      const ex = mcExplosions[i];
      if (ex.growing) {
        ex.r += 1.2 * dt;
        if (ex.r >= ex.maxR) ex.growing = false;
      } else {
        ex.r -= 0.8 * dt;
        if (ex.r <= 0) { mcExplosions.splice(i, 1); }
      }
    }

    // Check wave complete
    if (mcMissilesLeft <= 0 && mcMissiles.length === 0 && mcExplosions.length === 0) {
      // Wave bonus
      const alive = mcCities.filter(c => c.alive).length;
      if (alive === 0) { mcEndGame(); return; }
      mcScore += alive * 100;
      mcWave++;
      $('mcScore').textContent = mcScore; $('mcWave').textContent = mcWave;
      mcMissilesLeft = 5 + mcWave * 2;
      // Refill ammo
      for (const b of mcBatteries) b.ammo = 10;
      mcWaveTimer = 0;
    }

    // Check all cities dead
    if (!mcCities.some(c => c.alive)) mcEndGame();
    $('mcScore').textContent = mcScore;
  }

  function mcEndGame() {
    mcGameOver = true;
    $('gameOverTitle').textContent = 'Game Over';
    $('gameOverReason').textContent = 'Score: ' + mcScore + ' | Waves: ' + mcWave;
    $('gameOverRating').innerHTML = ''; $('gameOverCoins').textContent = '';
    $('gameOverOverlay').classList.remove('hidden');
    if (mcScore > 2000 && typeof startConfetti === 'function') startConfetti();
    const btn = $('btnBackToLobby'); if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); mcGameLoopActive = false; showScreen('lobby'); };
    const pa = $('btnPlayAgain'); if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); startMissileCommandGame(); };
  }

  function mcRender() {
    if (!mcCtx) return;
    const ctx = mcCtx;
    // Night sky
    ctx.fillStyle = '#050520'; ctx.fillRect(0, 0, MC_W, MC_H);
    // Stars
    if (mcStars) for (const s of mcStars) {
      const b = 0.3 + s.bright * 0.7;
      ctx.fillStyle = 'rgba(255,255,255,' + b.toFixed(2) + ')';
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    // Ground
    ctx.fillStyle = '#1a3300'; ctx.fillRect(0, MC_H - 30, MC_W, 30);

    // Cities
    if (mcCities) for (const c of mcCities) {
      if (c.alive) {
        ctx.fillStyle = '#3366ff';
        // Simple building silhouettes
        ctx.fillRect(c.x - 12, MC_H - 50, 8, 20);
        ctx.fillRect(c.x - 2, MC_H - 55, 10, 25);
        ctx.fillRect(c.x + 10, MC_H - 45, 7, 15);
      } else {
        ctx.fillStyle = '#333333';
        ctx.fillRect(c.x - 8, MC_H - 35, 16, 5);
      }
    }

    // Batteries
    if (mcBatteries) for (const b of mcBatteries) {
      ctx.fillStyle = '#33cc33';
      ctx.beginPath(); ctx.moveTo(b.x - 12, MC_H - 30); ctx.lineTo(b.x, MC_H - 50); ctx.lineTo(b.x + 12, MC_H - 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#aaffaa'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(b.ammo, b.x, MC_H - 18);
    }

    // Incoming missile trails
    for (const m of mcMissiles) {
      ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (m.trail.length > 0) {
        ctx.moveTo(m.trail[0].x, m.trail[0].y);
        for (const p of m.trail) ctx.lineTo(p.x, p.y);
        ctx.lineTo(m.x, m.y);
      }
      ctx.stroke();
      ctx.fillStyle = '#ff6666'; ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Counter-missile trails
    for (const c of mcCounters) {
      ctx.strokeStyle = '#33aaff'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (c.trail.length > 0) {
        ctx.moveTo(c.trail[0].x, c.trail[0].y);
        for (const p of c.trail) ctx.lineTo(p.x, p.y);
        ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
      ctx.fillStyle = '#66ccff'; ctx.beginPath(); ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Explosions
    for (const ex of mcExplosions) {
      const a = ex.r / ex.maxR;
      ctx.fillStyle = 'rgba(255,' + Math.floor(150 * a) + ',0,' + (0.8 * a).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,50,' + (0.5 * a).toFixed(2) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r * 1.1, 0, Math.PI * 2); ctx.stroke();
    }

    // Crosshair cursor indicator
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  }

  /* ================================================
     ONLINE CARD GAMES — Shared handler
     ================================================ */
  let cgState = null;
  let cgGameType = null;
  let cgPlayerIndex = -1;
  let cgCanvas = null;
  let cgCtx = null;
  let cgSelectedCard = -1;
  let cgPlayers = [];

  const CG_W = 900, CG_H = 620;
  const CG_CW = 70, CG_CH = 98;

  const CARD_GAME_PREFIXES = {
    war: 'war', crazy8: 'c8', gofish: 'gf', blackjack: 'bj',
    ginrummy: 'gr', hearts: 'ht', spades: 'sp', poker: 'pk', higherlower: 'hl'
  };

  function startCardGame(data, gameType) {
    cgState = data;
    cgGameType = gameType;
    cgPlayerIndex = data.playerIndex || 0;
    cgPlayers = data.players || [];
    cgSelectedCard = -1;

    showScreen('cardgame');
    cgCanvas = $('cardGameCanvas');
    if (cgCanvas) {
      cgCanvas.width = CG_W;
      cgCanvas.height = CG_H;
      cgCtx = cgCanvas.getContext('2d');
      cgCanvas.onclick = cgHandleClick;
    }

    // Update HUD
    const title = GAME_CATALOG[gameType] ? GAME_CATALOG[gameType].title : gameType;
    const hudLeft = $('cgHudLeft');
    if (hudLeft) hudLeft.textContent = title;
    updateCardGameHud();
    renderCardGame();

    // Action buttons
    updateCardGameActions();

    // Resign button
    const resignBtn = $('btnCardGameResign');
    if (resignBtn) {
      resignBtn.onclick = () => {
        const prefix = CARD_GAME_PREFIXES[cgGameType];
        if (prefix && socket) socket.emit(prefix + ':resign');
        showScreen('lobby');
      };
    }
  }

  function updateCardGameHud() {
    const center = $('cgHudCenter');
    const right = $('cgHudRight');
    if (!cgState) return;

    if (cgGameType === 'blackjack') {
      if (center) center.textContent = 'Phase: ' + (cgState.phase || '');
      if (right) right.textContent = 'Chips: ' + (cgState.chips ? cgState.chips[cgPlayerIndex] : '');
    } else if (cgGameType === 'poker') {
      if (center) center.textContent = 'Pot: ' + (cgState.pot || 0);
      if (right) right.textContent = 'Chips: ' + (cgState.players ? cgState.players[cgPlayerIndex]?.chips : '');
    } else if (cgGameType === 'hearts' || cgGameType === 'spades') {
      if (center) center.textContent = 'Trick ' + ((cgState.trickNumber || 0) + 1);
      if (right) right.textContent = 'Scores: ' + (cgState.scores || []).join(' / ');
    } else if (cgGameType === 'ginrummy') {
      if (center) center.textContent = 'Phase: ' + (cgState.phase || '');
      if (right) right.textContent = 'Scores: ' + (cgState.scores || []).join(' / ');
    } else if (cgGameType === 'war') {
      if (center) center.textContent = 'Round ' + (cgState.roundNumber || 0);
      if (right) right.textContent = 'Cards: ' + ((cgState.piles || cgState.pileCounts || [0, 0]).join(' vs '));
    } else if (cgGameType === 'crazy8') {
      if (center) center.textContent = 'Turn: Player ' + ((cgState.currentTurn || 0) + 1);
      if (right) right.textContent = cgState.chosenSuit != null ? 'Suit: ' + CARD_SUIT_SYMBOLS[cgState.chosenSuit] : '';
    } else if (cgGameType === 'gofish') {
      if (center) center.textContent = 'Turn: Player ' + ((cgState.currentTurn || 0) + 1);
      if (right) right.textContent = 'Books: ' + (cgState.books || []).join(' / ');
    } else if (cgGameType === 'higherlower') {
      if (center) center.textContent = 'Streak: ' + (cgState.streak ? cgState.streak[cgPlayerIndex] : 0);
      if (right) right.textContent = 'Score: ' + (cgState.scores ? cgState.scores[cgPlayerIndex] : 0);
    }
  }

  function updateCardGameActions() {
    const container = $('cardGameActions');
    if (!container) return;
    container.innerHTML = '';

    const isMyTurn = cgState && cgState.currentTurn === cgPlayerIndex;
    const prefix = CARD_GAME_PREFIXES[cgGameType];

    if (cgGameType === 'war') {
      if (cgState.phase !== 'over') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-small';
        btn.textContent = 'Flip!';
        btn.onclick = () => socket.emit('war:play');
        container.appendChild(btn);
      }
    } else if (cgGameType === 'blackjack') {
      if (cgState.phase === 'betting') {
        [10, 25, 50, 100].forEach(amt => {
          const btn = document.createElement('button');
          btn.className = 'btn btn-primary btn-small';
          btn.textContent = 'Bet ' + amt;
          btn.onclick = () => socket.emit('bj:bet', { amount: amt });
          container.appendChild(btn);
        });
      } else if (cgState.phase === 'playing' && isMyTurn) {
        ['Hit', 'Stand', 'Double'].forEach(action => {
          const btn = document.createElement('button');
          btn.className = 'btn btn-primary btn-small';
          btn.textContent = action;
          btn.onclick = () => socket.emit('bj:' + action.toLowerCase());
          container.appendChild(btn);
        });
      }
    } else if (cgGameType === 'crazy8' && isMyTurn) {
      const drawBtn = document.createElement('button');
      drawBtn.className = 'btn btn-ghost btn-small';
      drawBtn.textContent = 'Draw Card';
      drawBtn.onclick = () => socket.emit('c8:draw');
      container.appendChild(drawBtn);
    } else if (cgGameType === 'hearts' && cgState.phase === 'passing') {
      const passBtn = document.createElement('button');
      passBtn.className = 'btn btn-primary btn-small';
      passBtn.textContent = 'Pass Cards';
      passBtn.onclick = () => {
        // Would need multi-select - for now pass first 3
        if (cgState.hand && cgState.hand.length >= 3) {
          socket.emit('ht:pass', { cardIndices: [0, 1, 2] });
        }
      };
      container.appendChild(passBtn);
    } else if (cgGameType === 'spades' && cgState.phase === 'bidding') {
      for (let b = 0; b <= 5; b++) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-small ' + (b === 0 ? 'btn-ghost' : 'btn-primary');
        btn.textContent = b === 0 ? 'Nil' : 'Bid ' + b;
        btn.onclick = () => socket.emit('sp:bid', { bid: b });
        container.appendChild(btn);
      }
    } else if (cgGameType === 'poker' && isMyTurn) {
      ['Fold', 'Check', 'Call'].forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-small ' + (action === 'Fold' ? 'btn-ghost' : 'btn-primary');
        btn.textContent = action;
        btn.onclick = () => socket.emit('pk:' + action.toLowerCase());
        container.appendChild(btn);
      });
      const raiseBtn = document.createElement('button');
      raiseBtn.className = 'btn btn-primary btn-small';
      raiseBtn.textContent = 'Raise';
      raiseBtn.onclick = () => socket.emit('pk:raise', { amount: (cgState.currentBet || 20) * 2 });
      container.appendChild(raiseBtn);
      const allInBtn = document.createElement('button');
      allInBtn.className = 'btn btn-primary btn-small';
      allInBtn.textContent = 'All In';
      allInBtn.onclick = () => socket.emit('pk:allIn');
      container.appendChild(allInBtn);
    } else if (cgGameType === 'ginrummy' && isMyTurn) {
      if (cgState.phase === 'draw') {
        const pile = document.createElement('button');
        pile.className = 'btn btn-primary btn-small';
        pile.textContent = 'Draw from Pile';
        pile.onclick = () => socket.emit('gr:drawPile');
        container.appendChild(pile);
        const disc = document.createElement('button');
        disc.className = 'btn btn-primary btn-small';
        disc.textContent = 'Take Discard';
        disc.onclick = () => socket.emit('gr:drawDiscard');
        container.appendChild(disc);
      } else if (cgState.phase === 'discard') {
        const info = document.createElement('span');
        info.textContent = 'Click a card to discard';
        info.style.color = '#aaa';
        container.appendChild(info);
        const knockBtn = document.createElement('button');
        knockBtn.className = 'btn btn-primary btn-small';
        knockBtn.textContent = 'Knock';
        knockBtn.onclick = () => {
          if (cgSelectedCard >= 0) socket.emit('gr:knock', { cardIndex: cgSelectedCard });
        };
        container.appendChild(knockBtn);
      }
    } else if (cgGameType === 'higherlower') {
      if (cgState.phase !== 'over' && isMyTurn) {
        const higher = document.createElement('button');
        higher.className = 'btn btn-primary btn-small';
        higher.textContent = '\u2191 Higher';
        higher.onclick = () => socket.emit('hl:guess', { choice: 'higher' });
        container.appendChild(higher);
        const lower = document.createElement('button');
        lower.className = 'btn btn-primary btn-small';
        lower.textContent = '\u2193 Lower';
        lower.onclick = () => socket.emit('hl:guess', { choice: 'lower' });
        container.appendChild(lower);
      }
    } else if (cgGameType === 'gofish' && isMyTurn) {
      const info = document.createElement('span');
      info.textContent = 'Select a card rank to ask for';
      info.style.color = '#aaa';
      container.appendChild(info);
    }
  }

  function cgHandleClick(e) {
    if (!cgState || !cgCanvas) return;
    const rect = cgCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CG_W / rect.width);
    const my = (e.clientY - rect.top) * (CG_H / rect.height);

    // Check if clicking on own hand cards
    const hand = cgState.hand || cgState.hands?.[cgPlayerIndex] || [];
    if (hand.length > 0) {
      const handY = CG_H - CG_CH - 20;
      const overlap = Math.min(CG_CW * 0.4, (CG_W - 80) / (hand.length + 0.6));
      const totalW = overlap * (hand.length - 1) + CG_CW;
      const startX = CG_W / 2 - totalW / 2;

      for (let i = hand.length - 1; i >= 0; i--) {
        const cx = startX + i * overlap;
        if (mx >= cx && mx <= cx + CG_CW && my >= handY && my <= handY + CG_CH) {
          if (cgSelectedCard === i) {
            // Double-click = play card
            const prefix = CARD_GAME_PREFIXES[cgGameType];
            if (cgGameType === 'crazy8') {
              let chosenSuit = null;
              if (hand[i].rank === 8) {
                chosenSuit = hand[i].suit; // Default to same suit
              }
              socket.emit('c8:play', { cardIndex: i, chosenSuit });
            } else if (cgGameType === 'hearts') {
              socket.emit('ht:play', { cardIndex: i });
            } else if (cgGameType === 'spades') {
              socket.emit('sp:play', { cardIndex: i });
            } else if (cgGameType === 'ginrummy' && cgState.phase === 'discard') {
              socket.emit('gr:discard', { cardIndex: i });
            } else if (cgGameType === 'gofish') {
              // Ask for this rank from first other player
              const target = cgPlayerIndex === 0 ? 1 : 0;
              socket.emit('gf:ask', { targetIdx: target, rank: hand[i].rank });
            }
            cgSelectedCard = -1;
          } else {
            cgSelectedCard = i;
          }
          renderCardGame();
          return;
        }
      }
    }

    cgSelectedCard = -1;
    renderCardGame();
  }

  function renderCardGame() {
    if (!cgCtx || !cgState) return;
    const ctx = cgCtx;
    ctx.clearRect(0, 0, CG_W, CG_H);

    // Dark green table
    ctx.fillStyle = '#1a4a2e';
    ctx.fillRect(0, 0, CG_W, CG_H);

    // Game title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const title = GAME_CATALOG[cgGameType] ? GAME_CATALOG[cgGameType].title : cgGameType;
    ctx.fillText(title, CG_W / 2, 22);

    // Draw own hand at bottom
    const hand = cgState.hand || cgState.hands?.[cgPlayerIndex] || [];
    if (hand.length > 0) {
      drawFannedHand(ctx, hand, CG_W / 2, CG_H - CG_CH - 20, CG_W - 80, CG_CW, CG_CH, true, cgSelectedCard);
    }

    // Draw game-specific center content
    if (cgGameType === 'war') {
      renderWarCenter(ctx);
    } else if (cgGameType === 'blackjack') {
      renderBlackjackCenter(ctx);
    } else if (cgGameType === 'poker') {
      renderPokerCenter(ctx);
    } else if (cgGameType === 'hearts' || cgGameType === 'spades') {
      renderTrickCenter(ctx);
    } else if (cgGameType === 'crazy8') {
      renderCrazy8Center(ctx);
    } else if (cgGameType === 'gofish') {
      renderGoFishCenter(ctx);
    } else if (cgGameType === 'ginrummy') {
      renderGinRummyCenter(ctx);
    } else if (cgGameType === 'higherlower') {
      renderHigherLowerCenter(ctx);
    }

    // Draw opponent info
    renderOpponents(ctx);
  }

  function renderOpponents(ctx) {
    if (!cgPlayers) return;
    const opponents = cgPlayers.filter((_, i) => i !== cgPlayerIndex);
    const spacing = CG_W / (opponents.length + 1);
    opponents.forEach((p, i) => {
      const x = spacing * (i + 1);
      ctx.fillStyle = '#ccc';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.username || 'Player', x, 50);
      // Draw face-down cards for opponent
      const count = cgState.handCounts ? cgState.handCounts[cgPlayers.indexOf(p)] : 0;
      if (count > 0) {
        drawCardPile(ctx, x - CG_CW / 2, 55, CG_CW * 0.7, CG_CH * 0.7, count);
      }
    });
  }

  function renderWarCenter(ctx) {
    const battleCards = cgState.battleCards || [];
    if (battleCards.length >= 2) {
      drawPlayingCard(ctx, CG_W / 2 - CG_CW - 20, CG_H / 2 - CG_CH / 2, CG_CW, CG_CH, battleCards[0], true, false);
      drawPlayingCard(ctx, CG_W / 2 + 20, CG_H / 2 - CG_CH / 2, CG_CW, CG_CH, battleCards[1], true, false);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('vs', CG_W / 2, CG_H / 2 + 5);
  }

  function bjHandValue(cards) {
    let value = 0, aces = 0;
    for (const c of cards) {
      if (!c) continue;
      if (c.rank >= 11 && c.rank <= 13) value += 10;
      else if (c.rank === 14) { value += 11; aces++; }
      else value += c.rank;
    }
    while (value > 21 && aces > 0) { value -= 10; aces--; }
    return value;
  }

  function renderBlackjackCenter(ctx) {
    // Dealer hand at top
    const dealer = cgState.dealerHand || cgState.dealer;
    if (dealer && dealer.cards) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DEALER', CG_W / 2, 50);
      const dc = dealer.cards;
      const startX = CG_W / 2 - (dc.length * (CG_CW * 0.5)) / 2;
      dc.forEach((card, i) => {
        const faceUp = i === 0 || !dealer.hidden;
        drawPlayingCard(ctx, startX + i * (CG_CW + 8), 60, CG_CW, CG_CH, card, faceUp, false);
      });
      // Dealer value (only show visible cards' value)
      const visibleCards = dc.filter(c => c !== null);
      if (visibleCards.length > 0) {
        const dv = bjHandValue(visibleCards);
        ctx.fillStyle = '#ffd700';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dealer.hidden ? dv + ' + ?' : '' + dv, CG_W / 2, 60 + CG_CH + 18);
      }
    }
    // Player hand value
    if (cgState.hands && cgState.hands[cgPlayerIndex]) {
      const h = cgState.hands[cgPlayerIndex];
      const val = h.cards && h.cards.length > 0 ? bjHandValue(h.cards) : '';
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hand: ' + val, CG_W / 2, CG_H - CG_CH - 50);
    }
  }

  function renderPokerCenter(ctx) {
    // Community cards
    const community = cgState.communityCards || [];
    const startX = CG_W / 2 - (community.length * (CG_CW + 6)) / 2;
    community.forEach((card, i) => {
      drawPlayingCard(ctx, startX + i * (CG_CW + 6), CG_H / 2 - CG_CH / 2 - 20, CG_CW, CG_CH, card, true, false);
    });
    // Pot
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pot: ' + (cgState.pot || 0), CG_W / 2, CG_H / 2 + CG_CH / 2 + 10);
  }

  function renderTrickCenter(ctx) {
    // Current trick in center
    const trick = cgState.currentTrick || [];
    const positions = [
      { x: CG_W / 2, y: CG_H / 2 + 30 },  // bottom (player)
      { x: CG_W / 2 - 100, y: CG_H / 2 - 20 },  // left
      { x: CG_W / 2, y: CG_H / 2 - 70 },  // top
      { x: CG_W / 2 + 100, y: CG_H / 2 - 20 }   // right
    ];
    trick.forEach((t, i) => {
      const card = t.card || t;
      const pos = positions[i % 4];
      drawPlayingCard(ctx, pos.x - CG_CW / 2, pos.y - CG_CH / 2, CG_CW, CG_CH, card, true, false);
    });
  }

  function renderCrazy8Center(ctx) {
    // Discard pile
    const top = cgState.discardTop || cgState.topCard;
    if (top) {
      drawPlayingCard(ctx, CG_W / 2 - CG_CW / 2, CG_H / 2 - CG_CH / 2, CG_CW, CG_CH, top, true, false);
    }
    // Draw pile
    drawCardPile(ctx, CG_W / 2 - CG_CW - 50, CG_H / 2 - CG_CH / 2, CG_CW, CG_CH, cgState.drawPileCount || 0);
    // Chosen suit indicator
    if (cgState.chosenSuit != null) {
      ctx.fillStyle = (cgState.chosenSuit === 1 || cgState.chosenSuit === 2) ? '#cc0000' : '#111';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(CARD_SUIT_SYMBOLS[cgState.chosenSuit], CG_W / 2 + CG_CW + 30, CG_H / 2 + 10);
    }
  }

  function renderGoFishCenter(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ocean: ' + (cgState.oceanCount || cgState.ocean?.length || 0) + ' cards', CG_W / 2, CG_H / 2 - 30);
    // Last action
    if (cgState.lastAction) {
      ctx.fillStyle = '#ffd700';
      ctx.font = '14px sans-serif';
      ctx.fillText(cgState.lastActionText || '', CG_W / 2, CG_H / 2);
    }
    // Books
    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Your Books: ' + (cgState.books ? cgState.books[cgPlayerIndex] : 0), CG_W / 2, CG_H / 2 + 25);
  }

  function renderGinRummyCenter(ctx) {
    // Discard pile top
    const top = cgState.discardTop;
    if (top) {
      drawPlayingCard(ctx, CG_W / 2 + 10, CG_H / 2 - CG_CH / 2, CG_CW, CG_CH, top, true, false);
    }
    // Draw pile
    drawCardPile(ctx, CG_W / 2 - CG_CW - 10, CG_H / 2 - CG_CH / 2, CG_CW, CG_CH, cgState.drawPileCount || 0);
    // Phase indicator
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cgState.phase === 'draw' ? 'Draw a card' : 'Discard a card', CG_W / 2, CG_H / 2 + CG_CH / 2 + 25);
  }

  function renderHigherLowerCenter(ctx) {
    // Current card in center
    const card = cgState.currentCard;
    if (card) {
      drawPlayingCard(ctx, CG_W / 2 - CG_CW / 2, CG_H / 2 - CG_CH / 2, CG_CW, CG_CH, card, true, false);
    }
    // Last result
    if (cgState.lastResult) {
      const r = cgState.lastResult;
      ctx.fillStyle = r.correct ? '#34c759' : '#ff3b30';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.correct ? 'Correct!' : 'Wrong!', CG_W / 2, CG_H / 2 - CG_CH / 2 - 15);
    }
    // Streak
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Streak: ' + (cgState.streak ? cgState.streak[cgPlayerIndex] : 0), CG_W / 2, CG_H / 2 + CG_CH / 2 + 30);
  }

  /* ================================================
     LOCAL CARD GAME (placeholder)
     ================================================ */
  function startLocalCardGame(gameType) {
    // For now, redirect to bot mode for most games
    const prefix = CARD_GAME_PREFIXES[gameType];
    if (prefix && socket) {
      socket.emit(prefix + ':bot');
      const title = GAME_CATALOG[gameType] ? GAME_CATALOG[gameType].title : gameType;
      $('queueTitle').textContent = title;
      $('queueText').textContent = 'Starting game vs bot...';
      showScreen('queue');
    }
  }

  /* ================================================
     CARD GAME SOCKET BINDINGS
     ================================================ */
  function bindCardGameEvents(s) {
    // All card game types share the same handler pattern
    const gameTypes = [
      { type: 'war', prefix: 'war' },
      { type: 'crazy8', prefix: 'c8' },
      { type: 'gofish', prefix: 'gf' },
      { type: 'blackjack', prefix: 'bj' },
      { type: 'ginrummy', prefix: 'gr' },
      { type: 'hearts', prefix: 'ht' },
      { type: 'spades', prefix: 'sp' },
      { type: 'poker', prefix: 'pk' },
      { type: 'higherlower', prefix: 'hl' }
    ];

    gameTypes.forEach(({ type, prefix }) => {
      s.on(prefix + ':start', (data) => {
        startCardGame(data, type);
      });

      s.on(prefix + ':update', (data) => {
        if (cgGameType === type) {
          cgState = { ...cgState, ...data };
          updateCardGameHud();
          updateCardGameActions();
          renderCardGame();
        }
      });

      s.on(prefix + ':over', (data) => {
        if (cgGameType === type) {
          const title = data.winnerUsername ? data.winnerUsername + ' wins!' : (data.reason || 'Game Over');
          $('gameOverTitle').textContent = title;
          $('gameOverReason').textContent = data.reason || '';
          $('gameOverRating').textContent = '';
          $('gameOverCoins').textContent = data.coins ? '+' + data.coins + ' coins' : '';
          $('gameOverOverlay').classList.remove('hidden');
          const btn = $('btnBackToLobby');
          if (btn) btn.onclick = () => { $('gameOverOverlay').classList.add('hidden'); showScreen('lobby'); };
          const pa = $('btnPlayAgain');
          if (pa) pa.onclick = () => { $('gameOverOverlay').classList.add('hidden'); showScreen('lobby'); };
        }
      });

      s.on(prefix + ':error', (data) => {
        const info = $('cardGameInfo');
        if (info) {
          info.textContent = data.message || 'Error';
          setTimeout(() => { info.textContent = ''; }, 3000);
        }
      });

      s.on(prefix + ':paused', (data) => {
        $('pauseReason').textContent = (data.disconnectedPlayer || 'Opponent') + ' disconnected';
        $('gamePausedOverlay').classList.remove('hidden');
      });

      s.on(prefix + ':resumed', () => {
        $('gamePausedOverlay').classList.add('hidden');
      });
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
