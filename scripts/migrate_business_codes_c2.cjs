/**
 * Phase C2 — Idempotent business-code backfill.
 *
 * Default: DRY-RUN (no writes).
 * Writes require: --execute AND PRODUCTION_MIGRATION_CONFIRMED=YES
 *   OR --execute --allow-non-prod (local/dev only)
 *
 * Never changes _id, enrollments, invoices, ledger, payroll, messages.
 * Never creates unique indexes.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const {
  ensureCounterAtLeast,
  isCanonical,
  parseCanonicalSeq,
  formatCode,
} = require('../services/businessCodeService');

function argsHas(flag) {
  return process.argv.includes(flag);
}

function sanitizeUri(uri) {
  try {
    const u = new URL(uri.replace(/^mongodb\+srv/, 'https').replace(/^mongodb/, 'http'));
    return { host: u.host, db: (u.pathname || '').replace(/^\//, '').split('?')[0] };
  } catch {
    return { host: 'UNPARSEABLE', db: null };
  }
}

function uniqLegacy(list, current) {
  const out = [];
  const seen = new Set();
  const cur = String(current || '').trim().toLowerCase();
  for (const raw of list || []) {
    const t = String(raw || '').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (k === cur) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

(async () => {
  const execute = argsHas('--execute');
  const allowNonProd = argsHas('--allow-non-prod');
  const prodConfirmed = String(process.env.PRODUCTION_MIGRATION_CONFIRMED || '').toUpperCase() === 'YES';
  const uri = process.env.MONGODB_URI;
  const meta = sanitizeUri(uri);
  const nodeEnv = process.env.NODE_ENV || '';

  const report = {
    phase: 'C2',
    mode: execute ? 'EXECUTE' : 'DRY_RUN',
    auditedAt: new Date().toISOString(),
    environment: { nodeEnv, connection: meta, prodConfirmed, allowNonProd },
    before: {},
    after: {},
    changed: [],
    skipped: [],
    failed: [],
    duplicates: [],
    blockers: [],
  };

  const looksLocal =
    /127\.0\.0\.1|localhost/i.test(meta.host || '') || nodeEnv === 'development';

  if (execute) {
    if (prodConfirmed) {
      // allowed
    } else if (allowNonProd && looksLocal) {
      report.environment.note = 'Local/dev write allowed via --allow-non-prod';
    } else {
      report.blockers.push(
        'EXECUTE blocked: set PRODUCTION_MIGRATION_CONFIRMED=YES for prod, or use --allow-non-prod on local only',
      );
      console.log(JSON.stringify(report, null, 2));
      process.exit(2);
    }
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const students = db.collection('students');
  const teachers = db.collection('teachers');
  const employees = db.collection('employees');
  const courses = db.collection('courses');

  // Duplicate precheck (case-insensitive)
  const studentDup = await students
    .aggregate([
      { $match: { studentCode: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: { $toLower: '$studentCode' }, n: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  if (studentDup.length) {
    report.duplicates = studentDup;
    report.blockers.push('Duplicate studentCode detected — STOP');
    console.log(JSON.stringify(report, null, 2));
    await mongoose.disconnect();
    process.exit(3);
  }

  const studentDocs = await students.find({}).sort({ _id: 1 }).toArray();
  const teacherDocs = await teachers.find({}).sort({ _id: 1 }).toArray();
  const employeeDocs = await employees.find({}).sort({ _id: 1 }).toArray();
  const courseDocs = await courses.find({}).sort({ _id: 1 }).toArray();

  report.before = {
    students: studentDocs.length,
    teachers: teacherDocs.length,
    employees: employeeDocs.length,
    courses: courseDocs.length,
  };

  let seqS = 0;
  let seqT = 0;
  let seqE = 0;
  let seqC = 0;

  const studentOps = [];
  // Collision-safe: preserve existing canonical codes; assign next free HV###### to others.
  {
    const used = new Set(
      studentDocs
        .map((s) => String(s.studentCode || '').trim().toUpperCase())
        .filter((c) => isCanonical('student', c)),
    );
    let next = 1;
    const takeNext = () => {
      while (used.has(formatCode('student', next).toUpperCase())) next += 1;
      const code = formatCode('student', next);
      used.add(code.toUpperCase());
      next += 1;
      return code;
    };
    let maxSeq = 0;
    for (const s of studentDocs) {
      const old = s.studentCode == null ? '' : String(s.studentCode).trim();
      if (isCanonical('student', old)) {
        maxSeq = Math.max(maxSeq, parseCanonicalSeq('student', old) || 0);
        report.skipped.push({ entity: 'student', id: String(s._id), reason: 'already_canonical', code: old });
        continue;
      }
      const neu = takeNext();
      maxSeq = Math.max(maxSeq, parseCanonicalSeq('student', neu) || 0);
      studentOps.push({
        id: s._id,
        oldCode: old || null,
        newCode: neu,
        legacy: uniqLegacy([...(s.legacyStudentCodes || []), old], neu),
      });
    }
    seqS = maxSeq;
  }

  const teacherOps = [];
  {
    const usedT = new Set(
      teacherDocs
        .map((t) => String(t.teacherCode || '').trim().toUpperCase())
        .filter((c) => isCanonical('teacher', c)),
    );
    let n = 1;
    const take = () => {
      while (usedT.has(formatCode('teacher', n).toUpperCase())) n += 1;
      const code = formatCode('teacher', n);
      usedT.add(code.toUpperCase());
      n += 1;
      return code;
    };
    let max = 0;
    for (const t of teacherDocs) {
      const old = t.teacherCode == null ? '' : String(t.teacherCode).trim();
      if (isCanonical('teacher', old)) {
        max = Math.max(max, parseCanonicalSeq('teacher', old) || 0);
        report.skipped.push({ entity: 'teacher', id: String(t._id), reason: 'already_canonical', code: old });
        continue;
      }
      const neu = take();
      max = Math.max(max, parseCanonicalSeq('teacher', neu) || 0);
      teacherOps.push({ id: t._id, oldCode: old || null, newCode: neu });
    }
    seqT = max;
  }

  const employeeOps = [];
  {
    const usedE = new Set(
      employeeDocs
        .map((e) => String(e.employeeCode || '').trim().toUpperCase())
        .filter((c) => isCanonical('employee', c)),
    );
    let n = 1;
    const take = () => {
      while (usedE.has(formatCode('employee', n).toUpperCase())) n += 1;
      const code = formatCode('employee', n);
      usedE.add(code.toUpperCase());
      n += 1;
      return code;
    };
    let max = 0;
    for (const e of employeeDocs) {
      const old = e.employeeCode == null ? '' : String(e.employeeCode).trim();
      if (isCanonical('employee', old)) {
        max = Math.max(max, parseCanonicalSeq('employee', old) || 0);
        report.skipped.push({ entity: 'employee', id: String(e._id), reason: 'already_canonical', code: old });
        continue;
      }
      const neu = take();
      max = Math.max(max, parseCanonicalSeq('employee', neu) || 0);
      employeeOps.push({ id: e._id, oldCode: old || null, newCode: neu });
    }
    seqE = max;
  }

  const courseOps = [];
  {
    const usedC = new Set(
      courseDocs
        .map((c) => String(c.courseCode || '').trim().toUpperCase())
        .filter((c) => isCanonical('course', c)),
    );
    let n = 1;
    const take = () => {
      while (usedC.has(formatCode('course', n).toUpperCase())) n += 1;
      const code = formatCode('course', n);
      usedC.add(code.toUpperCase());
      n += 1;
      return code;
    };
    let max = 0;
    for (const c of courseDocs) {
      const old = c.courseCode == null ? '' : String(c.courseCode).trim();
      if (isCanonical('course', old)) {
        max = Math.max(max, parseCanonicalSeq('course', old) || 0);
        report.skipped.push({
          entity: 'course',
          id: String(c._id),
          reason: 'already_canonical',
          code: old,
          slug: c.slug,
        });
        continue;
      }
      const neu = take();
      max = Math.max(max, parseCanonicalSeq('course', neu) || 0);
      courseOps.push({
        id: c._id,
        oldCode: old || null,
        newCode: neu,
        slug: c.slug,
        note: 'slug unchanged',
      });
    }
    seqC = max;
  }

  report.preview = {
    students: studentOps,
    teachers: teacherOps,
    employees: employeeOps,
    courses: courseOps,
    proposedCounterSeeds: { student: seqS, teacher: seqT, employee: seqE, course: seqC },
  };

  if (!execute) {
    report.after = { note: 'DRY_RUN — no writes' };
    console.log(JSON.stringify(report, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  }

  // EXECUTE writes — per-document, resumable
  for (const op of studentOps) {
    try {
      await students.updateOne(
        { _id: op.id },
        {
          $set: {
            studentCode: op.newCode,
            legacyStudentCodes: op.legacy,
          },
        },
      );
      report.changed.push({ entity: 'student', ...op, id: String(op.id) });
    } catch (e) {
      report.failed.push({ entity: 'student', id: String(op.id), error: e.message });
    }
  }
  for (const op of teacherOps) {
    try {
      await teachers.updateOne({ _id: op.id }, { $set: { teacherCode: op.newCode } });
      report.changed.push({ entity: 'teacher', id: String(op.id), newCode: op.newCode });
    } catch (e) {
      report.failed.push({ entity: 'teacher', id: String(op.id), error: e.message });
    }
  }
  for (const op of employeeOps) {
    try {
      await employees.updateOne({ _id: op.id }, { $set: { employeeCode: op.newCode } });
      report.changed.push({ entity: 'employee', id: String(op.id), newCode: op.newCode });
    } catch (e) {
      report.failed.push({ entity: 'employee', id: String(op.id), error: e.message });
    }
  }
  for (const op of courseOps) {
    try {
      await courses.updateOne({ _id: op.id }, { $set: { courseCode: op.newCode } });
      report.changed.push({
        entity: 'course',
        id: String(op.id),
        newCode: op.newCode,
        slug: op.slug,
      });
    } catch (e) {
      report.failed.push({ entity: 'course', id: String(op.id), error: e.message });
    }
  }

  await ensureCounterAtLeast('student', seqS);
  await ensureCounterAtLeast('teacher', seqT);
  await ensureCounterAtLeast('employee', seqE);
  await ensureCounterAtLeast('course', seqC);

  report.after = {
    changedCount: report.changed.length,
    failedCount: report.failed.length,
    countersSeeded: { student: seqS, teacher: seqT, employee: seqE, course: seqC },
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(report.failed.length ? 4 : 0);
})().catch(async (e) => {
  console.error('C2_MIGRATION_FAIL', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
