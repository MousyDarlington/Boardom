'use strict';

const SHOP_ITEMS = [
  // Board themes
  { id: 'board_ocean',    type: 'board',  name: 'Ocean Depths',     price: 150, currency: 'coins',
    colors: { dark: '#1a5276', light: '#aed6f1' } },
  { id: 'board_forest',   type: 'board',  name: 'Forest Floor',     price: 150, currency: 'coins',
    colors: { dark: '#1e4d2b', light: '#a9d18e' } },
  { id: 'board_midnight', type: 'board',  name: 'Midnight Purple',  price: 200, currency: 'coins',
    colors: { dark: '#2d1b69', light: '#c8b8e8' } },
  { id: 'board_neon',     type: 'board',  name: 'Neon Grid',        price: 80,  currency: 'gems',
    colors: { dark: '#0d0d0d', light: '#1a1a2e' } },
  { id: 'board_marble',   type: 'board',  name: 'White Marble',     price: 100, currency: 'gems',
    colors: { dark: '#8b8b8b', light: '#f5f5f5' } },

  // Animated board themes
  { id: 'board_lava',    type: 'board',  name: 'Lava Flow',       price: 400, currency: 'coins',
    colors: { dark: '#1a0800', light: '#2a1a10' }, anim: 'lava' },
  { id: 'board_aurora',  type: 'board',  name: 'Aurora Borealis', price: 150, currency: 'gems',
    colors: { dark: '#0a1628', light: '#101830' }, anim: 'aurora' },
  { id: 'board_matrix',  type: 'board',  name: 'Digital Rain',   price: 500, currency: 'coins',
    colors: { dark: '#000800', light: '#001200' }, anim: 'matrix' },
  { id: 'board_pulse',   type: 'board',  name: 'Pulse Grid',     price: 180, currency: 'gems',
    colors: { dark: '#0a0a18', light: '#12122a' }, anim: 'pulse' },

  // Piece skins
  { id: 'piece_gold',  type: 'pieces', name: 'Gold & Silver', price: 200, currency: 'coins',
    colors: { red: ['#ffd700','#b8860b','#8b6914'], black: ['#c0c0c0','#808080','#404040'] } },
  { id: 'piece_neon',  type: 'pieces', name: 'Neon Glow',     price: 300, currency: 'coins',
    colors: { red: ['#ff00ff','#cc00cc','#990099'], black: ['#00ffff','#00cccc','#009999'] } },
  { id: 'piece_ember', type: 'pieces', name: 'Ember & Ice',   price: 80,  currency: 'gems',
    colors: { red: ['#ff4500','#cc3700','#992900'], black: ['#00bfff','#0099cc','#007399'] } },

  // Animated piece skins
  { id: 'piece_flame',   type: 'pieces', name: 'Inferno',       price: 500, currency: 'coins',
    colors: { red: ['#ff4500','#cc3700','#8b1a00'], black: ['#4400ff','#3300cc','#220099'] }, anim: 'flame' },
  { id: 'piece_plasma',  type: 'pieces', name: 'Plasma Core',   price: 200, currency: 'gems',
    colors: { red: ['#ff00ff','#ff44aa','#cc0088'], black: ['#00ffcc','#44ffdd','#00cc99'] }, anim: 'plasma' },
  { id: 'piece_shadow',  type: 'pieces', name: 'Shadow Pulse',  price: 600, currency: 'coins',
    colors: { red: ['#ff2d55','#cc1144','#880030'], black: ['#aaaacc','#7777aa','#444466'] }, anim: 'shadow' },

  // Profile badges
  { id: 'badge_crown',   type: 'badge', name: 'Golden Crown', price: 100, currency: 'coins', emoji: '\u{1F451}' },
  { id: 'badge_fire',    type: 'badge', name: 'On Fire',      price: 100, currency: 'coins', emoji: '\u{1F525}' },
  { id: 'badge_diamond', type: 'badge', name: 'Diamond',      price: 50,  currency: 'gems',  emoji: '\u{1F48E}' },
  { id: 'badge_star',    type: 'badge', name: 'Star Player',  price: 50,  currency: 'gems',  emoji: '\u2B50' },

  // Site themes (change entire UI color scheme)
  { id: 'site_crimson', type: 'site', name: 'Crimson Night',  price: 250, currency: 'coins',
    vars: { bg: '#140a0a', bg2: '#1f1212', red: '#ff2d55', gold: '#ff6b6b', accent: '#ff2d55' } },
  { id: 'site_ocean',   type: 'site', name: 'Deep Ocean',     price: 250, currency: 'coins',
    vars: { bg: '#060d14', bg2: '#0c1a28', red: '#0a84ff', gold: '#00d4ff', accent: '#0a84ff' } },
  { id: 'site_emerald', type: 'site', name: 'Emerald Grove',  price: 250, currency: 'coins',
    vars: { bg: '#060f0a', bg2: '#0c1f14', red: '#34c759', gold: '#7aff9e', accent: '#34c759' } },
  { id: 'site_royal',   type: 'site', name: 'Royal Purple',   price: 300, currency: 'coins',
    vars: { bg: '#0e0a14', bg2: '#1a1228', red: '#bf5af2', gold: '#e0a0ff', accent: '#bf5af2' } },
  { id: 'site_sunset',  type: 'site', name: 'Sunset Blaze',   price: 100, currency: 'gems',
    vars: { bg: '#140d06', bg2: '#1f1a0f', red: '#ff9500', gold: '#ffd700', accent: '#ff6b00' } },
  { id: 'site_arctic',  type: 'site', name: 'Arctic Frost',   price: 120, currency: 'gems',
    vars: { bg: '#0a1014', bg2: '#121e28', red: '#5ac8fa', gold: '#b0e0ff', accent: '#34aadc' } },

  // Premium upgrades
  { id: 'adfree', type: 'adfree', name: 'Ad-Free Forever', price: 200, currency: 'gems',
    description: 'Remove all ads permanently' },
  { id: 'adfree_3d', type: 'adfree_timed', name: 'Ad-Free 3 Days', price: 600, currency: 'coins',
    description: 'No ads for 3 days', days: 3 },
  { id: 'adfree_7d', type: 'adfree_timed', name: 'Ad-Free 7 Days', price: 1000, currency: 'coins',
    description: 'No ads for 7 days', days: 7 },
  { id: 'adfree_30d', type: 'adfree_timed', name: 'Ad-Free 30 Days', price: 3000, currency: 'coins',
    description: 'No ads for 30 days', days: 30 },

  // Trials (try any board or piece skin for 5 matches)
  { id: 'trial_board', type: 'trial', name: 'Board Trial', price: 50, currency: 'coins',
    description: 'Try any board skin for 5 matches', trialType: 'board', trialMatches: 5 },
  { id: 'trial_pieces', type: 'trial', name: 'Piece Trial', price: 50, currency: 'coins',
    description: 'Try any piece skin for 5 matches', trialType: 'pieces', trialMatches: 5 },
];

module.exports = { SHOP_ITEMS };
