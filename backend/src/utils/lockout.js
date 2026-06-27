// Exactly 15 failed attempts locks the account. Each time the threshold is
// hit again after a previous lock, the cooldown escalates along this table
// instead of repeating the same short delay - that's what makes an offline
// brute-force loop against one account increasingly expensive.
const FAILED_ATTEMPT_THRESHOLD = 15;
const COOLDOWN_MINUTES_BY_LEVEL = [1, 5, 30, 120, 720, 1440];

function cooldownMsForLevel(lockLevel) {
  const index = Math.min(lockLevel, COOLDOWN_MINUTES_BY_LEVEL.length - 1);
  return COOLDOWN_MINUTES_BY_LEVEL[index] * 60 * 1000;
}

module.exports = { FAILED_ATTEMPT_THRESHOLD, cooldownMsForLevel };
