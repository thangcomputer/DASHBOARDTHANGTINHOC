/**
 * Backup service — export MongoDB collections as gzip JSON (khong can mongodump).
 * Chi Super Admin. Phase 9: create / list / download / delete / retention.
 * Restore co chu y ghi de DB — khong nam trong module nay.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const mongoose = require('mongoose');
const BackupJob = require('../models/BackupJob');
const logger = require('../config/logger');

const gzip = promisify(zlib.gzip);

const BACKUPS_ROOT = path.join(__dirname, '..', 'backups');
const BACKUP_VERSION = 1;

const SKIP_COLLECTIONS = new Set([
  'system.indexes',
  'system.profile',
  'system.users',
  'system.version',
]);

function ensureBackupDir() {
  if (!fs.existsSync(BACKUPS_ROOT)) fs.mkdirSync(BACKUPS_ROOT, { recursive: true });
  return BACKUPS_ROOT;
}

function keepCount() {
  return Math.max(1, Math.min(30, Number(process.env.BACKUP_KEEP) || 7));
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  if (v < 1024 * 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' MB';
  return (v / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

async function listCollectionNames() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB chua ket noi');
  const cols = await db.listCollections().toArray();
  return cols
    .map((c) => c.name)
    .filter((name) => name && !name.startsWith('system.') && !SKIP_COLLECTIONS.has(name))
    .sort();
}

function stampFilename() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    'backup-' +
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    '-' +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds()) +
    '.json.gz'
  );
}

async function runBackupJob(jobId) {
  const job = await BackupJob.findById(jobId);
  if (!job) throw new Error('Backup job not found');

  job.status = 'running';
  job.startedAt = new Date();
  job.error = '';
  await job.save();

  try {
    ensureBackupDir();
    const names = await listCollectionNames();
    const db = mongoose.connection.db;
    const collections = {};
    let docCount = 0;

    for (const name of names) {
      const docs = await db.collection(name).find({}).toArray();
      collections[name] = docs;
      docCount += docs.length;
    }

    const payload = {
      version: BACKUP_VERSION,
      app: 'quanlycms',
      createdAt: new Date().toISOString(),
      jobId: String(job._id),
      type: job.type,
      collections,
    };

    const filename = stampFilename();
    const diskPath = path.join(BACKUPS_ROOT, filename);
    const compressed = await gzip(Buffer.from(JSON.stringify(payload), 'utf8'));
    fs.writeFileSync(diskPath, compressed);

    job.status = 'completed';
    job.filename = filename;
    job.diskPath = path.join('backups', filename).replace(/\\/g, '/');
    job.sizeBytes = compressed.length;
    job.collections = names;
    job.docCount = docCount;
    job.finishedAt = new Date();
    await job.save();

    await enforceRetention();
    logger.info({ jobId: String(job._id), filename, docCount, size: job.sizeBytes }, '[Backup] completed');
    return job.toObject();
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Backup failed';
    job.finishedAt = new Date();
    await job.save();
    logger.error({ err: err.message, jobId: String(job._id) }, '[Backup] failed');
    throw err;
  }
}

async function createBackupJob({ type = 'manual', createdBy = '' } = {}) {
  return BackupJob.create({
    status: 'pending',
    type,
    createdBy: String(createdBy || ''),
  });
}

async function listBackups({ page = 1, limit = 20 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;
  const [rows, total] = await Promise.all([
    BackupJob.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    BackupJob.countDocuments(),
  ]);
  return {
    data: rows.map((r) => ({
      ...r,
      sizeLabel: formatBytes(r.sizeBytes),
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
}

function resolveDiskPath(job) {
  if (!job?.filename) return null;
  return path.join(BACKUPS_ROOT, job.filename);
}

async function getBackupFile(jobId) {
  const job = await BackupJob.findById(jobId).lean();
  if (!job || job.status !== 'completed') {
    const err = new Error('Backup khong ton tai hoac chua hoan tat');
    err.status = 404;
    throw err;
  }
  const full = resolveDiskPath(job);
  if (!full || !fs.existsSync(full)) {
    const err = new Error('File backup khong con tren disk');
    err.status = 404;
    throw err;
  }
  return { job, fullPath: full };
}

async function deleteBackup(jobId) {
  const job = await BackupJob.findById(jobId);
  if (!job) {
    const err = new Error('Khong tim thay backup');
    err.status = 404;
    throw err;
  }
  const full = resolveDiskPath(job);
  if (full && fs.existsSync(full)) {
    try { fs.unlinkSync(full); } catch (e) {
      logger.warn({ err: e.message }, '[Backup] unlink failed');
    }
  }
  await BackupJob.deleteOne({ _id: job._id });
  return { id: String(jobId) };
}

async function enforceRetention() {
  const keep = keepCount();
  const completed = await BackupJob.find({ status: 'completed' }).sort({ createdAt: -1 }).lean();
  if (completed.length <= keep) return { removed: 0 };
  const toRemove = completed.slice(keep);
  let removed = 0;
  for (const row of toRemove) {
    try {
      await deleteBackup(row._id);
      removed += 1;
    } catch (e) {
      logger.warn({ err: e.message, id: row._id }, '[Backup] retention delete failed');
    }
  }
  return { removed };
}

async function getStats() {
  const [total, completed, failed, last] = await Promise.all([
    BackupJob.countDocuments(),
    BackupJob.countDocuments({ status: 'completed' }),
    BackupJob.countDocuments({ status: 'failed' }),
    BackupJob.findOne({ status: 'completed' }).sort({ createdAt: -1 }).lean(),
  ]);
  let diskBytes = 0;
  ensureBackupDir();
  for (const f of fs.readdirSync(BACKUPS_ROOT)) {
    if (!f.endsWith('.json.gz')) continue;
    try {
      diskBytes += fs.statSync(path.join(BACKUPS_ROOT, f)).size;
    } catch { /* ignore */ }
  }
  return {
    total,
    completed,
    failed,
    keep: keepCount(),
    diskBytes,
    diskLabel: formatBytes(diskBytes),
    lastBackupAt: last?.finishedAt || last?.createdAt || null,
  };
}

module.exports = {
  BACKUPS_ROOT,
  BACKUP_VERSION,
  formatBytes,
  createBackupJob,
  runBackupJob,
  listBackups,
  getBackupFile,
  deleteBackup,
  enforceRetention,
  getStats,
  listCollectionNames,
  keepCount,
};