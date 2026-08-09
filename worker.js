/**
 * BullMQ + (optional) Outbox worker process — tach khoi API.
 * Usage:
 *   RUN_QUEUE_WORKERS=1 node worker.js
 * Multi-instance API: set RUN_OUTBOX_WORKER=0 on API, RUN_OUTBOX_WORKER=1 here.
 */
process.env.RUN_QUEUE_WORKERS = process.env.RUN_QUEUE_WORKERS || '1';
process.env.QUEUE_PRODUCER_ONLY = '0';

require('dotenv').config();
require('./config/validateEnv')();

const connectDB = require('./config/db');
const logger = require('./config/logger');
const { initJobQueue, closeJobQueue } = require('./services/queue/jobQueue');
const outboxWorker = require('./shared/outbox/OutboxWorker');

async function main() {
  await connectDB();
  await initJobQueue({ workers: true });
  // When API sets RUN_OUTBOX_WORKER=0, enable outbox on this process (default 1 if unset)
  if (process.env.RUN_OUTBOX_WORKER === undefined) {
    process.env.RUN_OUTBOX_WORKER = '1';
  }
  outboxWorker.start();
  logger.info('Queue worker process ready');

  const shutdown = async (sig) => {
    logger.info({ sig }, 'Worker shutting down');
    try { outboxWorker.stop(); } catch (_) { /* ignore */ }
    await closeJobQueue();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
