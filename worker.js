/**
 * BullMQ worker process (tach khoi API).
 * Usage: RUN_QUEUE_WORKERS=1 node worker.js
 */
process.env.RUN_QUEUE_WORKERS = process.env.RUN_QUEUE_WORKERS || '1';
process.env.QUEUE_PRODUCER_ONLY = '0';

require('dotenv').config();
require('./config/validateEnv')();

const connectDB = require('./config/db');
const logger = require('./config/logger');
const { initJobQueue, closeJobQueue } = require('./services/queue/jobQueue');

async function main() {
  await connectDB();
  await initJobQueue({ workers: true });
  logger.info('Queue worker process ready');

  const shutdown = async (sig) => {
    logger.info({ sig }, 'Worker shutting down');
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
