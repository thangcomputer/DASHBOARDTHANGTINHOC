'use strict';

const OutboxEvent = require('./OutboxEvent');
const { eventBus } = require('../cqrs');
const crypto = require('crypto');

const DEFAULT_POLL_MS = 5000;
const DEFAULT_LEASE_MS = 60_000;

/**
 * RUN_OUTBOX_WORKER:
 * - unset / "1" / "true" → start (default, single-instance API)
 * - "0" / "false" → do not start (multi-API: run on one dedicated worker only)
 */
function shouldRunOutboxWorker() {
  const v = String(process.env.RUN_OUTBOX_WORKER ?? '1').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

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
      console.log(`[OutboxWorker] Skipped (RUN_OUTBOX_WORKER=${process.env.RUN_OUTBOX_WORKER})`);
      return;
    }
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.processOutbox(), this.pollInterval);
    // Avoid keeping the process alive solely for the interval in tests
    if (typeof this.timer.unref === 'function') this.timer.unref();
    console.log(
      `[OutboxWorker ${this.workerId}] Started polling every ${this.pollInterval}ms (lease ${this.leaseMs}ms)`
    );
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log(`[OutboxWorker ${this.workerId}] Stopped`);
  }

  /**
   * Atomically claim one PENDING event, or reclaim a stuck PROCESSING lease.
   */
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
      while (this.isRunning) {
        const record = await this.claimNext();
        if (!record) break;

        try {
          const domainEvent = {
            eventName: record.eventType,
            aggregateId: record.aggregateId,
            payload: record.payload,
            tenantId: record.tenantId,
            branchId: record.branchId,
            actorId: record.actorId,
          };

          await eventBus.publish(domainEvent);

          record.status = 'PROCESSED';
          record.processedAt = new Date();
          await record.save();
        } catch (err) {
          console.error(`[OutboxWorker ${this.workerId}] Failed to process event ${record._id}:`, err);
          record.retryCount = (record.retryCount || 0) + 1;
          record.lastError = err.message;
          if (record.retryCount >= 3) {
            record.status = 'FAILED';
          } else {
            // Release lease so another tick / worker can retry
            record.status = 'PENDING';
            record.processingAt = undefined;
            record.workerId = undefined;
          }
          await record.save();
        }
      }
    } catch (err) {
      console.error(`[OutboxWorker ${this.workerId}] Polling error:`, err);
    } finally {
      this._tickBusy = false;
    }
  }
}

const worker = new OutboxWorker();
module.exports = worker;
module.exports.OutboxWorker = OutboxWorker;
module.exports.shouldRunOutboxWorker = shouldRunOutboxWorker;
