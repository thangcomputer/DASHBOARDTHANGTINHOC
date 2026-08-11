/**
 * Business code generator — atomic Mongo counters.
 * Prefixes: student→HV, teacher→GV, employee→NV, course→KH
 * Format: PREFIX + 6 zero-padded digits. Fail-closed above 999999.
 */
const mongoose = require('mongoose');
const logger = require('../config/logger');

const PREFIX = Object.freeze({
  student: 'HV',
  teacher: 'GV',
  employee: 'NV',
  course: 'KH',
});

const CANONICAL_RE = Object.freeze({
  student: /^HV\d{6}$/,
  teacher: /^GV\d{6}$/,
  employee: /^NV\d{6}$/,
  course: /^KH\d{6}$/,
});

const MAX_SEQ = 999999;

const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false },
);

const Counter =
  mongoose.models.Counter || mongoose.model('Counter', CounterSchema, 'counters');

function assertNamespace(ns) {
  if (!PREFIX[ns]) {
    const err = new Error(`Unknown business code namespace: ${ns}`);
    err.status = 500;
    err.code = 'BUSINESS_CODE_BAD_NAMESPACE';
    throw err;
  }
}

function formatCode(ns, seq) {
  if (!Number.isInteger(seq) || seq < 1) {
    const err = new Error(`Invalid sequence for ${ns}: ${seq}`);
    err.status = 500;
    err.code = 'BUSINESS_CODE_BAD_SEQ';
    throw err;
  }
  if (seq > MAX_SEQ) {
    const err = new Error(
      `Business code sequence exhausted for ${ns} (max ${MAX_SEQ}). Refusing to mint.`,
    );
    err.status = 503;
    err.code = 'BUSINESS_CODE_EXHAUSTED';
    logger.error('[BUSINESS_CODE] %s', err.message);
    throw err;
  }
  return `${PREFIX[ns]}${String(seq).padStart(6, '0')}`;
}

/**
 * Atomically increment counter and return next canonical code.
 * @param {'student'|'teacher'|'employee'|'course'} namespace
 * @returns {Promise<string>}
 */
async function generateBusinessCode(namespace) {
  assertNamespace(namespace);
  const doc = await Counter.findOneAndUpdate(
    { _id: namespace },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const seq = Number(doc?.seq);
  return formatCode(namespace, seq);
}

async function generateStudentCode() {
  return generateBusinessCode('student');
}
async function generateTeacherCode() {
  return generateBusinessCode('teacher');
}
async function generateEmployeeCode() {
  return generateBusinessCode('employee');
}
async function generateCourseCode() {
  return generateBusinessCode('course');
}

/**
 * Seed counter to at least `minSeq` without decreasing (idempotent).
 * Used after backfill so next generate continues past migrated max.
 */
async function ensureCounterAtLeast(namespace, minSeq) {
  assertNamespace(namespace);
  const n = Math.max(0, Number(minSeq) || 0);
  const existing = await Counter.findById(namespace).lean();
  if (!existing) {
    try {
      await Counter.create({ _id: namespace, seq: n });
    } catch (e) {
      if (e?.code !== 11000) throw e;
      const again = await Counter.findById(namespace).lean();
      if (again && again.seq < n) {
        await Counter.updateOne({ _id: namespace, seq: { $lt: n } }, { $set: { seq: n } });
      }
    }
    return;
  }
  if (existing.seq < n) {
    await Counter.updateOne({ _id: namespace, seq: { $lt: n } }, { $set: { seq: n } });
  }
}

function isCanonical(namespace, code) {
  assertNamespace(namespace);
  return CANONICAL_RE[namespace].test(String(code || ''));
}

function parseCanonicalSeq(namespace, code) {
  if (!isCanonical(namespace, code)) return null;
  return Number(String(code).slice(2));
}

module.exports = {
  PREFIX,
  CANONICAL_RE,
  MAX_SEQ,
  Counter,
  generateBusinessCode,
  generateStudentCode,
  generateTeacherCode,
  generateEmployeeCode,
  generateCourseCode,
  ensureCounterAtLeast,
  isCanonical,
  parseCanonicalSeq,
  formatCode,
};
