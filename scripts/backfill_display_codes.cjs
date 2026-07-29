#!/usr/bin/env node
/**
 * Backfill displayCode / enrollmentCode (Phase 1, ADR 0002).
 * Idempotent. Mặc định DRY-RUN — chỉ ghi khi --apply.
 *
 * Usage:
 *   node scripts/backfill_display_codes.cjs
 *   node scripts/backfill_display_codes.cjs --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Branch = require('../models/Branch');
const {
  allocateStudentDisplayCode,
  allocateTeacherDisplayCode,
  buildEnrollmentCode,
  ensureCounterAtLeast,
  parseDisplayCode,
  ROLE_PREFIX,
} = require('../services/displayCodeService');

const APPLY = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Thiếu MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN (thêm --apply để ghi)');

  const branches = await Branch.find({}).lean();
  const branchById = new Map(branches.map((b) => [String(b._id), b]));

  let studentsUpdated = 0;
  let enrollmentsUpdated = 0;
  let teachersUpdated = 0;

  const students = await Student.find({}).select('displayCode studentCode branchId branchCode enrollments course');
  for (const s of students) {
    const branch = s.branchId ? branchById.get(String(s.branchId)) : null;
    let displayCode = (s.displayCode || '').trim().toUpperCase();
    let dirty = false;

    if (!displayCode && s.studentCode) {
      const parsed = parseDisplayCode(s.studentCode);
      if (parsed) {
        displayCode = String(s.studentCode).trim().toUpperCase();
        if (branch) await ensureCounterAtLeast(ROLE_PREFIX.student, branch, parsed.seq);
      }
    }

    if (!displayCode && branch) {
      if (APPLY) {
        displayCode = await allocateStudentDisplayCode(branch);
      } else {
        displayCode = `(would-allocate-HV-*-${branch.code})`;
      }
      dirty = true;
    }

    if (displayCode && displayCode !== (s.displayCode || '').trim().toUpperCase() && !displayCode.startsWith('(would')) {
      s.displayCode = displayCode;
      if (!s.studentCode) s.studentCode = displayCode;
      dirty = true;
    }

    if (Array.isArray(s.enrollments)) {
      for (const en of s.enrollments) {
        if (en.enrollmentCode) continue;
        const base = (s.displayCode || displayCode || '').trim();
        if (!base || base.startsWith('(would')) continue;
        const code = buildEnrollmentCode(base, en.courseName || s.course || 'COURSE');
        if (APPLY) {
          en.enrollmentCode = code;
        }
        enrollmentsUpdated += 1;
        dirty = true;
      }
    }

    if (dirty && APPLY && !String(displayCode).startsWith('(would')) {
      await s.save();
      studentsUpdated += 1;
    } else if (dirty) {
      studentsUpdated += 1;
    }
  }

  const teachers = await Teacher.find({}).select('displayCode branchId branchCode role adminRole');
  for (const t of teachers) {
    if ((t.displayCode || '').trim()) continue;
    const branch = t.branchId ? branchById.get(String(t.branchId)) : null;
    if (!branch) continue;
    if (APPLY) {
      t.displayCode = await allocateTeacherDisplayCode(t, branch);
      await t.save();
    }
    teachersUpdated += 1;
  }

  console.log(JSON.stringify({
    studentsTouched: studentsUpdated,
    enrollmentCodesTouched: enrollmentsUpdated,
    teachersTouched: teachersUpdated,
    applied: APPLY,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
