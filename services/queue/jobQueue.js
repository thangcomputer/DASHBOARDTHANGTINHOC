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
 */
async function initJobQueue() {
  if (!process.env.REDIS_URL) {
    mode = 'inline';
    logger.info('Job queue: inline mode (no REDIS_URL)');
    return { mode };
  }

  try {
    const { Queue, Worker } = require('bullmq');
    const base = parseRedisUrl(process.env.REDIS_URL);

    const qConn = { ...base };
    const wNotifyConn = { ...base };
    const wPdfConn = { ...base };
    connections.push(qConn, wNotifyConn, wPdfConn);

    notifyQueue = new Queue(QUEUE_NOTIFY, { connection: qConn });
    pdfQueue = new Queue(QUEUE_PDF, { connection: { ...base } });

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
        logger.warn({ job: job?.name, id: job?.id, err: err.message }, '[Queue] job failed');
      });
      workers.push(w);
    }

    mode = 'bullmq';
    logger.info('Job queue: BullMQ mode');
    return { mode };
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

  if (mode === 'bullmq' && queue) {
    const job = await queue.add(name, data, defaultJobOpts(opts));
    return { id: String(job.id), mode: 'bullmq', queue: kind, name };
  }

  // Inline: khong block request — chay o tick tiep theo
  const inlineId = `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setImmediate(() => {
    runInline(kind, name, data).catch((err) => {
      logger.warn({ err: err.message, name, kind }, '[Queue] inline job failed');
    });
  });
  return { id: inlineId, mode: 'inline', queue: kind, name };
}

function enqueueOtp(data, opts) {
  return enqueue('notify', 'otp', data, opts);
}

function enqueuePassword(data, opts) {
  return enqueue('notify', 'password', data, opts);
}

function enqueueInvoicePdf(data, opts) {
  return enqueue('pdf', 'invoice', data, opts);
}

function enqueueInvoiceEmail(data, opts) {
  return enqueue('notify', 'invoice-email', data, opts);
}

function enqueueBackup(data, opts) {
  return enqueue('notify', 'backup', data, { attempts: 1, ...opts });
}

function getQueueMode() {
  return mode;
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
  enqueueInvoicePdf,
  enqueueInvoiceEmail,
  enqueueBackup,
};