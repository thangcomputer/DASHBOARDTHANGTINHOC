/**
 * Job queue: BullMQ khi co REDIS_URL, khong thi chay inline (setImmediate).
 * Queues: notify (OTP/email/Zalo), pdf (hoa don).
 */
const logger = require('../../config/logger');
const { processNotifyJob, processPdfJob } = require('./processors');

const QUEUE_NOTIFY = 'cms-notify';
const QUEUE_PDF = 'cms-pdf';

let mode = 'inline'; // 'bullmq' | 'inline'
let notifyQueue = null;
let pdfQueue = null;
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

  if (!process.env.REDIS_URL) {
    mode = 'inline';
    logger.info('Job queue: inline mode (no REDIS_URL)');
    return { mode };
  }

  try {
    const { Queue, Worker } = require('bullmq');
    const base = parseRedisUrl(process.env.REDIS_URL);

    const qConn = { ...base };
    connections.push(qConn);

    notifyQueue = new Queue(QUEUE_NOTIFY, { connection: qConn });
    pdfQueue = new Queue(QUEUE_PDF, { connection: { ...base } });

    if (wantWorkers) {
      const wNotifyConn = { ...base };
      const wPdfConn = { ...base };
      connections.push(wNotifyConn, wPdfConn);

      const notifyWorker = new Worker(
        QUEUE_NOTIFY,
        async (job) => processNotifyJob(job.name, job.data),
        { connection: wNotifyConn, concurrency: 3 },
      );
      const pdfWorker = new Worker(
        QUEUE_PDF,
        async (job) => processPdfJob(job.name, job.data),
        { connection: wPdfConn, concurrency: 2 },
      );

      for (const w of [notifyWorker, pdfWorker]) {
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

  // Inline: khong block request — chay o tick tiep theo
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
  mode = 'inline';
}

module.exports = {
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
  getFailedJobLog,
};