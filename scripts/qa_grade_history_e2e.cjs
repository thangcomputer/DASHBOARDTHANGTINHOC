/**
 * QA — Grade history E2E (80 → 90 → 95, old/new/user/time).
 * Usage: node scripts/qa_grade_history_e2e.cjs
 */
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const OUT = path.join(__dirname, '..', 'docs', 'QA_GRADE_HISTORY_REPORT.md');
const { PERMISSIONS } = require('../constants/permissions');

const Teacher = require('../models/Teacher');
const ExamResult = require('../models/ExamResult');
const AuditLog = require('../models/AuditLog');
const Student = require('../models/Student');

const results = [];
let csrf = { token: '', cookie: '' };

function record(tc) {
  results.push(tc);
  console.log(`[${tc.result}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
}

function req(method, p, { token, body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(p, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (csrf.cookie) headers.Cookie = csrf.cookie;
    if (csrf.token && !['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = csrf.token;
    const data = body != null ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers, timeout: 30000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 300) }; }
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      },
    );
    r.on('error', (err) => resolve({ status: 0, json: { message: err.message }, headers: {} }));
    if (data) r.write(data);
    r.end();
  });
}

async function refreshCsrf() {
  const res = await req('GET', '/api/auth/csrf-token');
  csrf.token = res.json?.csrfToken || res.json?.data?.csrfToken || '';
  csrf.cookie = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
}

function mint(user) {
  return jwt.sign(
    {
      id: String(user._id || user.id || 'admin'),
      role: user.role || 'admin',
      adminRole: user.adminRole || 'SUPER_ADMIN',
      permissions: user.permissions || [PERMISSIONS.VIEW_TEACHERS, PERMISSIONS.MANAGE_STUDENTS],
      branchId: user.branchId ? String(user.branchId) : undefined,
      aud: 'internal',
      name: user.name || 'QA Admin',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function assertChain(history, scores) {
  if (!Array.isArray(history) || history.length < scores.length) return false;
  const slice = history.slice(-scores.length);
  for (let i = 0; i < scores.length; i += 1) {
    if (Number(slice[i].newScore) !== scores[i]) return false;
    if (i > 0 && Number(slice[i].oldScore) !== scores[i - 1]) return false;
    if (!slice[i].at || !slice[i].actorUserId) return false;
  }
  return true;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  await refreshCsrf();

  const admin = await Teacher.findOne({ role: 'admin', phone: '0999000001' }).lean()
    || await Teacher.findOne({ role: 'admin' }).lean();
  if (!admin) throw new Error('No admin for QA');
  const token = mint(admin);

  // --- Teacher onboarding score 80→90→95 ---
  let teacher = await Teacher.findOne({ role: 'teacher', phone: /097/ }).lean()
    || await Teacher.findOne({ role: 'teacher' }).lean();
  if (!teacher) throw new Error('No teacher for QA');

  for (const score of [80, 90, 95]) {
    await refreshCsrf();
    const r = await req('PUT', `/api/teachers/${teacher._id}/score`, {
      token,
      body: { testScore: score, testNotes: `QA grade hist ${score}` },
    });
    record({
      id: `GRADE-T-${score}`,
      name: `Teacher score → ${score}`,
      result: r.status === 200 ? 'PASS' : 'FAIL',
      actual: `status=${r.status} msg=${r.json?.message || ''}`,
    });
  }

  teacher = await Teacher.findById(teacher._id).lean();
  const tOk = assertChain(teacher?.scoreHistory || [], [80, 90, 95]);
  record({
    id: 'GRADE-HIST-01',
    name: 'Teacher scoreHistory 80→90→95 old/new/user/time',
    result: tOk ? 'PASS' : 'FAIL',
    actual: `len=${(teacher?.scoreHistory || []).length} testScore=${teacher?.testScore}`,
  });

  // --- ExamResult essayScore chain ---
  const student = await Student.findOne({ phone: /096/ }).lean() || await Student.findOne().lean();
  let exam = await ExamResult.create({
    type: 'student',
    studentId: String(student._id),
    studentName: student.name || 'QA HV',
    subject: 'QA Grade Hist',
    essayScore: null,
    passed: false,
    date: new Date().toISOString().slice(0, 10),
  });

  for (const score of [80, 90, 95]) {
    await refreshCsrf();
    const r = await req('PUT', `/api/exam-results/${exam._id}`, {
      token,
      body: { essayScore: score, essayNote: `QA ${score}`, passed: score >= 80 },
    });
    record({
      id: `GRADE-E-${score}`,
      name: `Exam essayScore → ${score}`,
      result: r.status === 200 ? 'PASS' : 'FAIL',
      actual: `status=${r.status}`,
    });
  }

  exam = await ExamResult.findById(exam._id).lean();
  const eOk = assertChain(exam?.scoreHistory || [], [80, 90, 95]);
  record({
    id: 'GRADE-HIST-02',
    name: 'ExamResult scoreHistory 80→90→95 old/new/user/time',
    result: eOk ? 'PASS' : 'FAIL',
    actual: `len=${(exam?.scoreHistory || []).length} essayScore=${exam?.essayScore}`,
  });

  const audits = await AuditLog.find({
    action: { $in: ['teacher.score_change', 'exam.score_change'] },
    entityId: { $in: [String(teacher._id), String(exam._id)] },
  }).sort({ at: -1 }).limit(20).lean();
  record({
    id: 'GRADE-HIST-03',
    name: 'AuditLog score_change entries exist',
    result: audits.length >= 3 ? 'PASS' : 'FAIL',
    actual: `count=${audits.length}`,
  });

  // cleanup disposable exam
  await ExamResult.deleteOne({ _id: exam._id });

  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# QA Grade History Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**API:** ${BASE}`,
    `**Result:** ${pass} PASS / ${fail} FAIL`,
    '',
    '| ID | Name | Result | Actual |',
    '|----|------|--------|--------|',
    ...results.map((r) => `| ${r.id} | ${r.name} | ${r.result} | ${String(r.actual || '').replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`\nWrote ${OUT} (${pass}/${pass + fail})`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
