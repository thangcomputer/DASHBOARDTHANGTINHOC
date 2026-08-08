'use strict';

const crypto = require('crypto');
const OutboxEvent = require('./OutboxEvent');
const { eventBus } = require('../events/EventBus');
const logger = require('../../config/logger');
const { shouldRunOutboxWorker } = require('./config');

const DEFAULT_POLL_MS = 5000;
const DEFAULT_LEASE_MS = 60_000;

class OutboxWorker {
  constructor(pollInterval = DEFAULT_POLL_MS) {
    this.pollInterval = Number(process.env.OUTBOX_POLL_MS) || pollInterval;
    this.leaseMs = Number(process.env.OUTBOX_LEASE_MS) || DEFAULT_LEASE_MS;
    this.timer = null;
    this.isRunning = false;
    this.workerId = crypto.randomUUID();
    this._tickBusy = false;
  }

  start() {
    if (!shouldRunOutboxWorker()) {
      logger.info({ flag: process.env.RUN_OUTBOX_WORKER }, '[OutboxWorker] skipped');
      return;
    }
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.processOutbox(), this.pollInterval);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    logger.info(
      { workerId: this.workerId, pollMs: this.pollInterval, leaseMs: this.leaseMs },
      '[OutboxWorker] started'
    );
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info({ workerId: this.workerId }, '[OutboxWorker] stopped');
  }

  async claimNext() {
    const leaseExpiredBefore = new Date(Date.now() - this.leaseMs);
    return OutboxEvent.findOneAndUpdate(
      {
        $or: [
          { status: 'PENDING' },
          { status: 'PROCESSING', processingAt: { $lt: leaseExpiredBefore } },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          processingAt: new Date(),
          workerId: this.workerId,
        },
      },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    );
  }

  async processOutbox() {
    if (this._tickBusy) return;
    this._tickBusy = true;
    try {
      while (this.isRunning || process.env.OUTBOX_FORCE_DRAIN === '1') {
        const record = await this.claimNext();
        if (!record) break;

        try {
          await eventBus.publish({
            eventName: record.eventType,
            eventType: record.eventType,
            aggregateId: record.aggregateId,
            payload: record.payload,
            tenantId: record.tenantId,
            branchId: record.branchId,
            actorId: record.actorId,
          });
          record.status = 'PROCESSED';
          record.processedAt = new Date();
          await record.save();
        } catch (err) {
          logger.error({ err: err.message, id: record._id }, '[OutboxWorker] handler failed');
          record.retryCount = (record.retryCount || 0) + 1;
          record.lastError = err.message;
          if (record.retryCount >= 3) {
            record.status = 'FAILED';
          } else {
            record.status = 'PENDING';
            record.processingAt = undefined;
            record.workerId = undefined;
          }
          await record.save();
        }

        if (!this.isRunning && process.env.OUTBOX_FORCE_DRAIN !== '1') break;
      }
    } catch (err) {
      logger.error({ err: err.message }, '[OutboxWorker] poll error');
    } finally {
      this._tickBusy = false;
    }
  }
}

const worker = new OutboxWorker();
module.exports = worker;
module.exports.OutboxWorker = OutboxWorker;
module.exports.shouldRunOutboxWorker = shouldRunOutboxWorker;
