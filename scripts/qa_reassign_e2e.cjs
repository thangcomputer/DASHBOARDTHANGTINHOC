/**
 * QA — Reassign Teacher E2E (8 completed A / 12 future → B).
 * Usage: node scripts/qa_reassign_e2e.cjs
 * Does NOT modify product code.
 */
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const PASSWORD = 'Test@123456';
const NOTE = 'QA_REASSIGN_E2E';
const OUT = path.join(__dirname, '..', 'docs', 'QA_REASSIGN_E2E_REPORT.md');

const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Branch = require('../models/Branch');
const Schedule = require('../models/Schedule');
const Assignment = require('../models/Assignment');
const { PERMISSIONS } = require('../constants/permissions');
const { computeCompletedSplitByTeacher } = require('../services/teacherReassignmentService');

const results = [];
let csrf = { token: '', cookie: '' };

function record(tc) {
  results.push(tc);
  console.log(`[${tc.result}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
}

function httpReq(method, p, { token, body } = {}) {
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
  const res = await httpReq('GET', '/api/auth/csrf-token');
  csrf.token = res.json?.csrfToken || res.json?.data?.csrfToken || '';
  csrf.cookie = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
}

function mint(user) {
  return jwt.sign(
    {
      id: String(user._id),
      role: user.role || 'admin',
      adminRole: user.adminRole || 'STAFF',
      permissions: user.permissions || [PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.MANAGE_SCHEDULE],
      branchId: user.branchId ? String(user.branchId) : undefined,
      aud: 'internal',
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function main() {
  console.log(`\n=== QA REASSIGN E2E @ ${BASE} ===\n`);
  await mongoose.connect(process.env.MONGODB_URI);

  let branch = await Branch.findOne({ code: 'CN1' });
  if (!branch) {
    branch = await Branch.create({ name: 'Chi nhánh QA CN1', code: 'CN1', isActive: true });
  }

  let admin = await Teacher.findOne({ phone: '0981100001' });
  if (!admin) {
    admin = await Teacher.create({
      name: 'QA Admin CN1',
      phone: '0981100001',
      zalo: '0981100001',
      password: PASSWORD,
      role: 'admin',
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.MANAGE_SCHEDULE, PERMISSIONS.MANAGE_FINANCE],
      branchId: branch._id,
      branchCode: 'CN1',
      status: 'active',
    });
  }

  // GV A / GV B — reuse QA seed or create
  let gvA = await Teacher.findOne({ phone: '097100001', role: 'teacher' });
  let gvB = await Teacher.findOne({ phone: '097100002', role: 'teacher' });
  if (!gvA) {
    gvA = await Teacher.create({
      name: 'QA GV Reassign A', phone: '097100001', zalo: '097100001', password: PASSWORD,
      role: 'teacher', branchId: branch._id, branchCode: 'CN1', status: 'active', specialty: 'Excel MOS',
    });
  }
  if (!gvB) {
    gvB = await Teacher.create({
      name: 'QA GV Reassign B', phone: '097100002', zalo: '097100002', password: PASSWORD,
      role: 'teacher', branchId: branch._id, branchCode: 'CN1', status: 'active', specialty: 'Excel MOS',
    });
  }
  // Ensure specialty allows assign
  await Teacher.updateMany(
    { _id: { $in: [gvA._id, gvB._id] } },
    { $set: { specialty: 'Excel MOS, Tin học', status: 'active' } },
  );
  gvA = await Teacher.findById(gvA._id);
  gvB = await Teacher.findById(gvB._id);

  const phone = `0961777${String(Date.now()).slice(-4)}`;
  const student = await Student.create({
    name: 'QA REASSIGN HV',
    phone,
    zalo: phone,
    email: `qa.reassign.${Date.now()}@test.local`,
    password: PASSWORD,
    course: 'Excel MOS',
    price: 2500000,
    paid: true,
    paidAmount: 2500000,
    paidAt: new Date(),
    teacherId: gvA._id,
    branchId: branch._id,
    branchCode: 'CN1',
    status: 'Đang học',
    totalSessions: 20,
    completedSessions: 8,
    remainingSessions: 12,
    grades: [{ date: new Date().toISOString().slice(0, 10), note: 'QA grade keep', grade: 8 }],
    enrollments: [{
      courseName: 'Excel MOS',
      teacherId: gvA._id,
      teacherName: gvA.name,
      price: 2500000,
      paid: true,
      status: 'active',
      learningAccess: true,
      isPrimary: true,
      totalSessions: 20,
      completedSessions: 8,
      remainingSessions: 12,
      grades: [{ date: new Date().toISOString().slice(0, 10), note: 'QA enr grade', grade: 8 }],
    }],
  });
  const enrId = student.enrollments[0]._id;

  // 8 completed under A
  for (let i = 0; i < 8; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - (30 - i));
    await Schedule.create({
      studentId: student._id,
      teacherId: gvA._id,
      studentName: student.name,
      teacherName: gvA.name,
      course: 'Excel MOS',
      date: d,
      startTime: '08:00',
      endTime: '09:30',
      status: 'completed',
      attendanceStatus: 'present',
      branchId: branch._id,
      branchCode: 'CN1',
      note: NOTE,
    });
  }
  // 12 scheduled future under A
  for (let i = 0; i < 12; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + 1 + i);
    await Schedule.create({
      studentId: student._id,
      teacherId: gvA._id,
      studentName: student.name,
      teacherName: gvA.name,
      course: 'Excel MOS',
      date: d,
      startTime: '08:00',
      endTime: '09:30',
      status: 'scheduled',
      branchId: branch._id,
      branchCode: 'CN1',
      note: NOTE,
    });
  }

  const asg = await Assignment.create({
    courseId: 'Excel MOS',
    studentId: student._id,
    teacherId: gvA._id,
    title: `QA Reassign BT ${Date.now()}`,
    description: 'must keep after reassign',
    deadline: new Date(Date.now() + 7 * 86400000),
    assignedById: String(gvA._id),
    assignedByRole: 'teacher',
    assignedByName: gvA.name,
  });

  const progressBefore = {
    completed: student.enrollments[0].completedSessions,
    remaining: student.enrollments[0].remainingSessions,
    grades: (student.enrollments[0].grades || []).length,
  };

  await refreshCsrf();
  const tok = mint(admin);
  const re = await httpReq('PUT', `/api/students/${student._id}/assign-teacher`, {
    token: tok,
    body: {
      teacherId: String(gvB._id),
      enrollmentId: String(enrId),
      reassignFutureSchedules: true,
      reason: 'QA reassign E2E A→B',
    },
  });

  const after = await Student.findById(student._id).lean();
  const sessions = await Schedule.find({ studentId: student._id, course: 'Excel MOS', note: NOTE }).select('teacherId status').lean();
  const split = computeCompletedSplitByTeacher(sessions);
  const aId = String(gvA._id);
  const bId = String(gvB._id);
  const completedStillA = sessions.filter((s) => s.status === 'completed' && String(s.teacherId) === aId).length;
  const futureB = sessions.filter((s) => s.status === 'scheduled' && String(s.teacherId) === bId).length;
  const futureStillA = sessions.filter((s) => s.status === 'scheduled' && String(s.teacherId) === aId).length;
  const asgAfter = await Assignment.findById(asg._id).lean();
  const enr = (after?.enrollments || []).find((e) => String(e._id) === String(enrId)) || after?.enrollments?.[0];

  record({
    id: 'REA-01',
    name: 'Assign-teacher API success',
    expected: '200',
    actual: `status=${re.status} msg=${re.json?.message || ''} meta=${JSON.stringify(re.json?.meta || {})}`,
    result: re.status === 200 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REA-02',
    name: 'Completed stay with GV A (=8)',
    expected: '8',
    actual: `completedA=${completedStillA} split=${JSON.stringify(split)}`,
    result: completedStillA === 8 && (split[aId] || 0) === 8 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REA-03',
    name: 'Future schedules moved to GV B (=12)',
    expected: '12 scheduled on B, 0 on A',
    actual: `futureB=${futureB} futureA=${futureStillA}`,
    result: futureB === 12 && futureStillA === 0 ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REA-04',
    name: 'Enrollment teacherId = GV B',
    expected: String(gvB._id),
    actual: `teacherId=${enr?.teacherId} top=${after?.teacherId}`,
    result: String(enr?.teacherId) === bId ? 'PASS' : 'FAIL',
    severity: 'High',
  });
  record({
    id: 'REA-05',
    name: 'Progress preserved (completed/remaining)',
    expected: `completed=${progressBefore.completed} remaining=${progressBefore.remaining}`,
    actual: `completed=${enr?.completedSessions} remaining=${enr?.remainingSessions}`,
    result: Number(enr?.completedSessions) === progressBefore.completed
      && Number(enr?.remainingSessions) === progressBefore.remaining ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  record({
    id: 'REA-06',
    name: 'Grades preserved',
    expected: `grades>=${progressBefore.grades}`,
    actual: `grades=${(enr?.grades || after?.grades || []).length}`,
    result: (enr?.grades || after?.grades || []).length >= progressBefore.grades ? 'PASS' : 'FAIL',
    severity: 'High',
  });
  record({
    id: 'REA-07',
    name: 'Assignment still exists',
    expected: 'assignment document kept',
    actual: asgAfter ? `id=${asgAfter._id} title=${asgAfter.title}` : 'missing',
    result: Boolean(asgAfter) ? 'PASS' : 'FAIL',
    severity: 'High',
  });
  record({
    id: 'REA-08',
    name: 'API meta.progressPreserved',
    expected: 'true',
    actual: String(re.json?.meta?.progressPreserved),
    result: re.json?.meta?.progressPreserved === true ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });

  // Cleanup
  await Schedule.deleteMany({ note: NOTE, studentId: student._id });
  await Assignment.deleteOne({ _id: asg._id });
  await Student.deleteOne({ _id: student._id });

  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# QA Reassign Teacher E2E Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**API:** ${BASE}`,
    `**Scenario:** 8 completed (GV A) + 12 scheduled → reassign GV B`,
    `**Result:** PASS ${pass} · FAIL ${fail}`,
    '',
    ...results.map((r) => `- **[${r.result}]** \`${r.id}\` — ${r.name} — \`${r.actual}\``),
    '',
  ].join('\n');
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`\nReport: ${OUT}`);
  console.log(`PASS ${pass} FAIL ${fail}`);

  await mongoose.disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
