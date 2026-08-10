'use strict';

const mongoose = require('mongoose');

/**
 * Run work inside a Mongo multi-doc transaction with transient retry.
 * Requires replica set (or Atlas mongodb+srv).
 */
async function withTransaction(workFn, opts = {}) {
  const maxAttempts = Math.max(1, Number(opts.retries || process.env.TX_RETRY_ATTEMPTS || 3));
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } catch (e) {
      lastErr = e;
      const transient =
        e?.errorLabelSet?.has?.('TransientTransactionError')
        || e?.codeName === 'LockTimeout'
        || e?.codeName === 'WriteConflict'
        || e?.code === 24
        || e?.code === 112;
      if (!transient || attempt === maxAttempts) throw e;
      await new Promise((r) => setTimeout(r, 80 * attempt));
    } finally {
      session.endSession();
    }
  }
  throw lastErr;
}

module.exports = { withTransaction };
