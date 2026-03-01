'use strict';

const DEFAULT_RATING = 1200;

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function kFactor(gamesPlayed) {
  return gamesPlayed < 30 ? 32 : 16;
}

/**
 * Calculate new ratings after a game.
 * @param {number} winnerRating
 * @param {number} loserRating
 * @param {number} winnerGames  total games played by winner
 * @param {number} loserGames   total games played by loser
 * @returns {{ winnerNew: number, loserNew: number, winnerDelta: number, loserDelta: number }}
 */
function calculateNewRatings(winnerRating, loserRating, winnerGames, loserGames) {
  const eW = expectedScore(winnerRating, loserRating);
  const eL = expectedScore(loserRating, winnerRating);
  const kW = kFactor(winnerGames);
  const kL = kFactor(loserGames);

  const winnerDelta = Math.round(kW * (1 - eW));
  const loserDelta = Math.round(kL * (0 - eL));

  return {
    winnerNew: winnerRating + winnerDelta,
    loserNew: Math.max(100, loserRating + loserDelta),
    winnerDelta,
    loserDelta
  };
}

module.exports = { DEFAULT_RATING, calculateNewRatings };
