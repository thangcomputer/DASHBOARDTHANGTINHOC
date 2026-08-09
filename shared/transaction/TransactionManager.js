'use strict';
class TransactionManager {
  constructor(factory) { this.factory = factory; }

  async execute(workFn) {
    const TransactionContext = require('./TransactionContext');
    const existingTx = TransactionContext.current();

    // If a transaction is already active in this async context, reuse it.
    if (existingTx) {
      return await workFn(existingTx);
    }

    const maxAttempts = Math.max(1, Number(process.env.TX_RETRY_ATTEMPTS) || 3);
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const tx = await this.factory.begin();
      try {
        const result = await TransactionContext.run(tx, async () => workFn(tx));
        await tx.commit();
        return result;
      } catch (e) {
        console.error('Transaction failed, original error:', e);
        try {
          await tx.rollback();
        } catch (rollbackErr) {
          console.error('Rollback failed:', rollbackErr.message);
        }
        lastErr = e;
        const transient =
          e?.errorLabelSet?.has?.('TransientTransactionError') ||
          e?.codeName === 'LockTimeout' ||
          e?.codeName === 'WriteConflict' ||
          e?.code === 24 ||
          e?.code === 112;
        if (!transient || attempt === maxAttempts) throw e;
        await new Promise((r) => setTimeout(r, 80 * attempt));
      }
    }
    throw lastErr;
  }
}
module.exports = TransactionManager;
