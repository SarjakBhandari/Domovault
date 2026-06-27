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

// Shared by both the password-check failure path and the MFA-code failure
// path - a wrong TOTP/backup code counts against the same threshold as a
// wrong password, since both are guesses against the same account.
async function recordFailedAttempt(User, userId) {
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { failedLoginAttempts: 1 } },
    { new: true }
  );

  if (updated.failedLoginAttempts >= FAILED_ATTEMPT_THRESHOLD) {
    const cooldownMs = cooldownMsForLevel(updated.lockLevel);
    await User.updateOne(
      { _id: userId },
      {
        $set: { lockUntil: new Date(Date.now() + cooldownMs), failedLoginAttempts: 0 },
        $inc: { lockLevel: 1 },
      }
    );
  }
}

module.exports = { FAILED_ATTEMPT_THRESHOLD, cooldownMsForLevel, recordFailedAttempt };
