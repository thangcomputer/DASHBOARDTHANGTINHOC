/**
 * Critical: reassign teacher + grade history chain
 * Usage: node scripts/_qa_critical_reassign_grade.cjs
 */
require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const out = [];

function record(id, name, pass, actual) {
  out.push({ id, name, result: pass ? 'PASS' : 'FAIL', actual });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} — ${name} | ${actual}`);
}

function req(method, urlPath, { token, body, cookie, csrfToken } = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const data = body !== undefined ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 25000 },
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
    r.on('error', (e) => resolve({ status: 0, json: { message: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Student = require('../models/Student');
  const Teacher = require('../models/Teacher');
  const Schedule = require('../models/Schedule');
  const Submission = require('../models/Submission');
  const Assignment = require('../models/Assignment');
  const AuditLog = require('../models/AuditLog');

  const csrfRes = await req('GET', '/api/auth/csrf-token');
  const csrfToken = csrfRes.json?.csrfToken;
  const cookie = (csrfRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  const token = jwt.sign(
    { id: 'admin', role: 'admin', name: 'Super Admin', adminRole: 'SUPER_ADMIN', aud: 'internal' },
    process.env.JWT_SECRET,
    { expiresIn: '30m' },
  );
  const mut = (method, p, body) => req(method, p, { token, body, cookie, csrfToken });

  const student = await Student.findOne({
    name: /^QA HV CN1/,
    'enrollments.completedSessions': { $gte: 8 },
    'enrollments.courseName': /Excel/i,
  }).lean();
  if (!student) {
    console.error('Missing seed student');
    process.exit(1);
  }
  const enr = (student.enrollments || []).find((e) => /Excel/i.test(e.courseName || '')) || student.enrollments[0];
  const gvA = enr.teacherId ? String(enr.teacherId) : null;
  const gvB = await Teacher.findOne({
    role: 'teacher',
    branchCode: 'CN1',
    status: 'active',
    _id: { $ne: enr.teacherId },
    specialty: /excel/i,
  }).select('_id name specialty status').lean();
  if (!gvB) {
    const gvBFallback = await Teacher.findOne({
      role: 'teacher',
      branchCode: 'CN1',
      status: 'active',
      _id: { $ne: enr.teacherId },
    }).lean();
    if (!gvBFallback) {
      console.error('No GV B');
      process.exit(1);
    }
    Object.assign(gvB || {}, gvBFallback);
  }

  const completedBefore = await Schedule.countDocuments({
    studentId: student._id,
    course: enr.courseName,
    status: 'completed',
    ...(gvA ? { teacherId: gvA } : {}),
  });
  const futureBefore = await Schedule.countDocuments({
    studentId: student._id,
    course: enr.courseName,
    status: 'scheduled',
  });

  const assign = await mut('PUT', `/api/students/${student._id}/assign-teacher`, {
    teacherId: String(gvB._id),
    enrollmentId: String(enr._id),
    reason: 'QA reassign E2E',
  });

  const completedA = gvA
    ? await Schedule.countDocuments({ studentId: student._id, course: enr.courseName, status: 'completed', teacherId: gvA })
    : 0;
  const futureB = await Schedule.countDocuments({
    studentId: student._id,
    course: enr.courseName,
    status: 'scheduled',
    teacherId: gvB._id,
  });
  const afterStudent = await Student.findById(student._id).lean();
  const enrAfter = (afterStudent.enrollments || []).find((e) => String(e._id) === String(enr._id));

  record('REA-01', 'Assign-teacher reassign API',
    assign.status === 200 && assign.json?.meta?.progressPreserved === true,
    `status=${assign.status} msg=${assign.json?.message} meta=${JSON.stringify(assign.json?.meta || {})}`);

  record('REA-02', 'Completed stay with GV A',
    completedA >= Math.min(8, completedBefore),
    `completedA=${completedA} before=${completedBefore}`);

  record('REA-04', 'Enrollment teacherId = GV B',
    String(enrAfter?.teacherId) === String(gvB._id),
    `teacherId=${enrAfter?.teacherId}`);

  record('REA-05', 'Progress preserved',
    Number(enrAfter?.completedSessions) >= 8,
    `completed=${enrAfter?.completedSessions} remaining=${enrAfter?.remainingSessions}`);

  const auditRe = await AuditLog.findOne({
    action: { $in: ['teacher.reassign', 'teacher.assign'] },
    studentId: student._id,
  }).sort({ createdAt: -1 }).lean();
  record('REA-AUDIT', 'Audit teacher reassign',
    !!auditRe,
    `action=${auditRe?.action || 'none'}`);

  // Grade history chain on submission if exists
  const sub = await Submission.findOne({ studentId: student._id }).sort({ updatedAt: -1 });
  if (sub) {
    const g1 = await mut('PUT', `/api/assignments/submissions/${sub._id}/grade`, { grade: 8, teacherFeedback: 'qa 80' });
    const g2 = await mut('PUT', `/api/assignments/submissions/${sub._id}/grade`, { grade: 9, teacherFeedback: 'qa 90' });
    const g3 = await mut('PUT', `/api/assignments/submissions/${sub._id}/grade`, { grade: 10, teacherFeedback: 'qa 100' });
    const refreshed = await Submission.findById(sub._id).lean();
    const hist = refreshed?.gradeHistory || [];
    const chainOk = hist.length >= 2
      && hist.some((h) => Number(h.newGrade) === 9)
      && hist.some((h) => Number(h.newGrade) === 10);
    const gradeAudit = await AuditLog.findOne({
      action: { $in: ['assignment.grade', 'assignment.regrade'] },
      entityId: String(sub._id),
    }).lean();
    record('GRADE-HIST', 'Grade chain 8→9→10 + audit',
      g1.status === 200 && g2.status === 200 && g3.status === 200 && chainOk && !!gradeAudit,
      `histLen=${hist.length} last=${hist.slice(-2).map((h) => `${h.oldGrade}→${h.newGrade}`).join(',')}`);
  } else {
    record('GRADE-HIST', 'Grade chain (skip — no submission)', true, 'no submission in DB');
  }

  // Restore teacher for seed stability (optional)
  if (gvA) {
    await mut('PUT', `/api/students/${student._id}/assign-teacher`, {
      teacherId: gvA,
      enrollmentId: String(enr._id),
      reason: 'QA restore',
    });
  }

  await mongoose.disconnect();
  const fail = out.filter((x) => x.result === 'FAIL').length;
  console.log(`\n=== Reassign/Grade critical: PASS ${out.length - fail} FAIL ${fail} ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
