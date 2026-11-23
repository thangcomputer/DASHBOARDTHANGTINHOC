/**
 * Job queue: BullMQ khi co REDIS_URL, khong thi chay inline (setImmediate).
 * Queues: notify (OTP/email/Zalo), pdf (hoa don).
 */
const logger = require('../../config/logger');
const { resolveRedisUrl, resolveBullMqPrefix, ensureRedisReady, inspectRedisServerInfo } = require('../../config/redis');
const { processNotifyJob, processPdfJob, processAiAutoReplyJob } = require('./processors');

const QUEUE_NOTIFY = 'cms-notify';
const QUEUE_PDF = 'cms-pdf';
const QUEUE_AI_AUTOREPLY = 'cms-ai-autoreply';

let mode = 'inline'; // 'bullmq' | 'inline'
let notifyQueue = null;
let pdfQueue = null;
let aiAutoReplyQueue = null;
const workers = [];
const connections = [];
/** Simple in-memory DLQ snapshot (last N failed jobs) for monitoring */
const failedJobLog = [];
const FAILED_JOB_LOG_MAX = 100;

function recordFailedJob(job, err) {
  failedJobLog.unshift({
    at: new Date().toISOString(),
    id: job?.id,
    name: job?.name,
    queue: job?.queueName,
    attemptsMade: job?.attemptsMade,
    err: err?.message || String(err),
  });
  if (failedJobLog.length > FAILED_JOB_LOG_MAX) failedJobLog.length = FAILED_JOB_LOG_MAX;
}

function parseRedisUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || '127.0.0.1',
      port: Number(u.port || 6379),
      password: u.password ? decodeURIComponent(u.password) : undefined,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null, enableReadyCheck: false };
  }
}

function defaultJobOpts(extra = {}) {
  return {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
    ...extra,
  };
}

async function runInline(kind, name, data) {
  if (kind === 'notify') return processNotifyJob(name, data);
  if (kind === 'pdf') return processPdfJob(name, data);
  throw new Error(`Unknown queue kind: ${kind}`);
}

/**
 * Khoi dong queue + workers. Goi 1 lan sau khi server boot.
 * opts.workers === false → chi producer (API). Worker process goi opts.workers === true.
 */
async function initJobQueue(opts = {}) {
  const wantWorkers =
    opts.workers === true ||
    (opts.workers !== false && process.env.QUEUE_PRODUCER_ONLY !== '1' && process.env.RUN_QUEUE_WORKERS !== '0');

  const redisUrl = resolveRedisUrl();
  if (!redisUrl) {
    mode = 'inline';
    logger.info('Job queue: inline mode (Redis disabled or no REDIS_URL)');
    return { mode };
  }

  // BullMQ yêu cầu Redis >= 5.0.0; kiểm tra phiên bản trước khi khởi tạo để tránh lặp lỗi khi dev dùng Redis Windows 3.0.x
  const readyState = await ensureRedisReady(1500);
  if (readyState.ready) {
    const serverInfo = await inspectRedisServerInfo();
    if (serverInfo.available && !serverInfo.bullMqCompatible) {
      mode = 'inline';
      logger.warn(
        { redisVersion: serverInfo.version, required: '>=5.0.0', recommended: '7.x' },
        'Job queue: Redis version < 5.0.0 — BullMQ disabled cleanly (inline mode); upgrade to Redis 7.x for BullMQ',
      );
      return { mode, reason: 'redis_version_below_5', redisVersion: serverInfo.version };
    }
  }

  try {
    const { Queue, Worker } = require('bullmq');
    const base = parseRedisUrl(redisUrl);
    const bullPrefix = resolveBullMqPrefix();

    const qConn = { ...base };
    connections.push(qConn);

    notifyQueue = new Queue(QUEUE_NOTIFY, { connection: qConn, prefix: bullPrefix });
    pdfQueue = new Queue(QUEUE_PDF, { connection: { ...base }, prefix: bullPrefix });
    aiAutoReplyQueue = new Queue(QUEUE_AI_AUTOREPLY, { connection: { ...base }, prefix: bullPrefix });

    if (wantWorkers) {
      const wNotifyConn = { ...base };
      const wPdfConn = { ...base };
      const wAiAutoReplyConn = { ...base };
      connections.push(wNotifyConn, wPdfConn, wAiAutoReplyConn);

      const notifyWorker = new Worker(
        QUEUE_NOTIFY,
        async (job) => processNotifyJob(job.name, job.data),
        { connection: wNotifyConn, prefix: bullPrefix, concurrency: 3 },
      );
      const pdfWorker = new Worker(
        QUEUE_PDF,
        async (job) => processPdfJob(job.name, job.data),
        { connection: wPdfConn, prefix: bullPrefix, concurrency: 2 },
      );
      const aiAutoReplyWorker = new Worker(
        QUEUE_AI_AUTOREPLY,
        async (job) => processAiAutoReplyJob(job.data),
        { connection: wAiAutoReplyConn, prefix: bullPrefix, concurrency: 3 },
      );

      for (const w of [notifyWorker, pdfWorker, aiAutoReplyWorker]) {
        w.on('failed', (job, err) => {
          recordFailedJob(job, err);
          logger.warn({ job: job?.name, id: job?.id, err: err.message }, '[Queue] job failed (DLQ log)');
        });
        workers.push(w);
      }
      logger.info('Job queue: BullMQ mode (with workers)');
    } else {
      logger.info('Job queue: BullMQ producer-only (no workers in this process)');
    }

    mode = 'bullmq';
    return { mode, workers: wantWorkers };
  } catch (err) {
    mode = 'inline';
    notifyQueue = null;
    pdfQueue = null;
    aiAutoReplyQueue = null;
    logger.warn({ err: err.message }, 'Job queue: BullMQ init failed, fallback inline');
    return { mode, error: err.message };
  }
}

async function enqueue(kind, name, data, opts = {}) {
  const queue = kind === 'notify' ? notifyQueue : kind === 'pdf' ? pdfQueue : null;
  const jobId = opts.jobId || data?.idempotencyKey || data?.jobId || null;
  const jobOpts = { ...opts };
  if (jobId) jobOpts.jobId = String(jobId);

  if (mode === 'bullmq' && queue) {
    try {
      const job = await Promise.race([
        queue.add(name, data, defaultJobOpts(jobOpts)),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('bullmq add timeout')), 1500);
        }),
      ]);
      return { id: String(job.id), mode: 'bullmq', queue: kind, name };
    } catch (err) {
      logger.warn({ err: err.message, name, kind }, '[Queue] bullmq add failed, fallback inline');
    }
  }

  // Inline: khong block request - chay o tick tiep theo
  const inlineId = jobId ? String(jobId) : `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setImmediate(() => {
    runInline(kind, name, data).catch((err) => {
      recordFailedJob({ id: inlineId, name, queueName: kind }, err);
      logger.warn({ err: err.message, name, kind }, '[Queue] inline job failed');
    });
  });
  return { id: inlineId, mode: 'inline', queue: kind, name };
}

function enqueueOtp(data, opts = {}) {
  const jobId = opts.jobId || (data?.phone ? `otp:${data.phone}:${data?.purpose || 'default'}` : undefined);
  return enqueue('notify', 'otp', data, { ...opts, ...(jobId ? { jobId } : {}) });
}

function enqueuePassword(data, opts = {}) {
  const jobId = opts.jobId || (data?.userId ? `password:${data.userId}:${Date.now()}` : undefined);
  return enqueue('notify', 'password', data, { ...opts, ...(jobId ? { jobId } : {}) });
}

function enqueueWelcome(data, opts = {}) {
  const jobId = opts.jobId || (data?.userId ? `welcome:${data.userId}` : undefined);
  return enqueue('notify', 'welcome', data, { ...opts, ...(jobId ? { jobId } : {}) });
}

function enqueueInvoicePdf(data, opts = {}) {
  const jobId = opts.jobId || (data?.invoiceId ? `pdf:invoice:${data.invoiceId}` : undefined);
  return enqueue('pdf', 'invoice', data, { ...opts, ...(jobId ? { jobId } : {}) });
}

function enqueueInvoiceEmail(data, opts = {}) {
  const jobId = opts.jobId || (data?.invoiceId ? `email:invoice:${data.invoiceId}` : undefined);
  return enqueue('notify', 'invoice-email', data, { ...opts, ...(jobId ? { jobId } : {}) });
}

function enqueueBackup(data, opts = {}) {
  return enqueue('notify', 'backup', data, { attempts: 1, ...opts });
}

async function enqueueAiAutoReply(data, opts = {}) {
  const jobId = String(opts.jobId || `autoreply:${data?.taskId || Date.now()}`);
  const delay = Math.max(0, Number(opts.delayMs) || 0);
  if (mode === 'bullmq' && aiAutoReplyQueue) {
    try {
      const existing = await aiAutoReplyQueue.getJob(jobId).catch(() => null);
      if (existing) {
        await existing.remove().catch(() => {});
      }
      const job = await Promise.race([
        aiAutoReplyQueue.add('ai-autoreply', data, {
          delay,
          jobId,
          attempts: 1,
          removeOnComplete: 200,
          removeOnFail: 200,
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('bullmq add timeout')), 1500);
        }),
      ]);
      return { id: String(job.id), mode: 'bullmq', queue: QUEUE_AI_AUTOREPLY };
    } catch (err) {
      logger.warn({ err: err.message, jobId }, '[Queue] ai-autoreply bullmq add failed, DB recovery poller will handle');
    }
  }
  // Do NOT fall back to volatile setTimeout: MongoDB AiAutoReplyTask + recovery poller drives delayed execution safely.
  return { id: jobId, mode: 'db_poll', queue: QUEUE_AI_AUTOREPLY };
}

async function cancelAiAutoReplyJob(jobId) {
  if (mode !== 'bullmq' || !aiAutoReplyQueue || !jobId) return false;
  try {
    const job = await aiAutoReplyQueue.getJob(String(jobId));
    if (!job) return false;
    await job.remove();
    return true;
  } catch {
    return false;
  }
}

function getQueueMode() {
  return mode;
}

function getFailedJobLog() {
  return failedJobLog.slice();
}

async function closeJobQueue() {
  for (const w of workers) {
    try { await w.close(); } catch { /* ignore */ }
  }
  workers.length = 0;
  if (notifyQueue) {
    try { await notifyQueue.close(); } catch { /* ignore */ }
    notifyQueue = null;
  }
  if (pdfQueue) {
    try { await pdfQueue.close(); } catch { /* ignore */ }
    pdfQueue = null;
  }
  if (aiAutoReplyQueue) {
    try { await aiAutoReplyQueue.close(); } catch { /* ignore */ }
    aiAutoReplyQueue = null;
  }
  mode = 'inline';
}

module.exports = {
  QUEUE_AI_AUTOREPLY,
  initJobQueue,
  closeJobQueue,
  getQueueMode,
  enqueue,
  enqueueOtp,
  enqueuePassword,
  enqueueWelcome,
  enqueueInvoicePdf,
  enqueueInvoiceEmail,
  enqueueBackup,
  enqueueAiAutoReply,
  cancelAiAutoReplyJob,
  getFailedJobLog,
};