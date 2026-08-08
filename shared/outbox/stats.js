'use strict';

const mongoose = require('mongoose');
const OutboxEvent = require('./OutboxEvent');
const { shouldRunOutboxWorker } = require('./config');

/**
 * Aggregate Outbox backlog for ops / monitoring.
 * Safe when Mongo is down (returns unavailable).
 */
async function getOutboxStats() {
  const workerEnabled = shouldRunOutboxWorker();
  if (mongoose.connection.readyState !== 1) {
    return {
      available: false,
      workerEnabled,
      pending: null,
      processing: null,
      failed: null,
      processedRecent: null,
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pending, processing, failed, processedRecent] = await Promise.all([
    OutboxEvent.countDocuments({ status: 'PENDING' }),
    OutboxEvent.countDocuments({ status: 'PROCESSING' }),
    OutboxEvent.countDocuments({ status: 'FAILED' }),
    OutboxEvent.countDocuments({ status: 'PROCESSED', processedAt: { $gte: since } }),
  ]);

  return {
    available: true,
    workerEnabled,
    pending,
    processing,
    failed,
    processedRecent,
  };
}

module.exports = { getOutboxStats };
