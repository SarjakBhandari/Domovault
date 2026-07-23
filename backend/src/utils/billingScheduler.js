'use strict';
// Billing scheduler: on the 1st of each month, generate billing cycles for
// every active lease that does not yet have a cycle for that month.
//
// Uses a daily interval rather than an in-process cron library so there
// is no extra dependency. The unique index on (leaseId, dueDate) in
// BillingCycle makes every call idempotent: calling twice for the same
// lease + month is a safe no-op.

const Lease = require('../models/Lease');
const { generateBillingCycleForLease } = require('../controllers/billing.controller');

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

async function runMonthlyBillingGeneration() {
  const now = new Date();
  if (now.getDate() !== 1) return; // only act on the 1st of the month

  const leases = await Lease.find({ status: 'active' }).lean();
  let generated = 0;

  for (const lease of leases) {
    try {
      await generateBillingCycleForLease(lease);
      generated++;
    } catch (err) {
      // Log but continue so one bad lease doesn't block others.
      console.error(`[billing-scheduler] failed for lease ${lease._id}:`, err.message);
    }
  }

  if (generated > 0) {
    console.log(`[billing-scheduler] generated ${generated} billing cycle(s) on ${now.toISOString().slice(0, 10)}`);
  }
}

function startBillingScheduler() {
  if (process.env.NODE_ENV === 'test') return;

  // Run once at startup in case the server was down on the 1st.
  runMonthlyBillingGeneration().catch((err) =>
    console.error('[billing-scheduler] startup run failed:', err.message)
  );

  setInterval(() => {
    runMonthlyBillingGeneration().catch((err) =>
      console.error('[billing-scheduler] interval run failed:', err.message)
    );
  }, CHECK_INTERVAL_MS);
}

module.exports = { startBillingScheduler };
