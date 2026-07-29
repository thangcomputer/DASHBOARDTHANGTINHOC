/**
 * Critical: exam unlock must not 500 on pending_payment enrollments
 * Usage: node scripts/_qa_critical_exam_unlock.cjs
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
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 20000,
      },
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
  const Notification = require('../models/Notification');
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

  const phone = `0967${String(Date.now()).slice(-7)}`;
  const create = await mut('POST', '/api/students', {
    name: `QA EXAM ${phone.slice(-6)}`,
    phone,
    zalo: phone,
    course: 'Excel MOS',
    price: 1500000,
    totalSessions: 12,
    password: 'Test@123456',
  });
  const sid = create.json?.data?._id;
  record('EXAM-SETUP', 'Create student for unlock', create.status === 201 && !!sid, `status=${create.status} id=${sid}`);

  // Force legacy-like enrollment mix: one pending_payment + one active
  const student = await Student.findById(sid);
  student.studentExamUnlocked = false;
  student.examApproved = false;
  student.enrollments = [
    {
      courseName: 'Excel MOS',
      price: 1500000,
      paid: true,
      totalSessions: 12,
      remainingSessions: 12,
      completedSessions: 0,
      status: 'active',
      isPrimary: true,
      examUnlocked: false,
      learningAccess: true,
    },
    {
      courseName: 'PowerPoint MOS',
      price: 1500000,
      paid: false,
      totalSessions: 12,
      remainingSessions: 12,
      completedSessions: 0,
      status: 'pending_payment',
      isPrimary: false,
      examUnlocked: false,
      learningAccess: false,
    },
  ];
  await student.save({ validateBeforeSave: true });

  const unlock = await mut('PUT', `/api/students/${sid}/unlock-exam`, {});
  const after = await Student.findById(sid).lean();
  const allUnlocked = (after?.enrollments || []).every((e) => e.examUnlocked === true);
  record(
    'EXAM-01',
    'Unlock with pending_payment enrollment → 200',
    unlock.status === 200 && after?.studentExamUnlocked === true && after?.examApproved === true && allUnlocked,
    `status=${unlock.status} unlocked=${after?.studentExamUnlocked} approved=${after?.examApproved} allEnr=${allUnlocked} msg=${unlock.json?.message || ''}`,
  );

  const notif = await Notification.findOne({
    type: 'EXAM',
    receivers: String(sid),
    title: /Phòng thi đã mở/i,
  }).sort({ createdAt: -1 }).lean();
  record('EXAM-02', 'Notification EXAM created', !!notif, `notif=${notif?._id || 'none'}`);

  // Per-enrollment unlock after lock
  const lock = await mut('PUT', `/api/students/${sid}/lock-exam`, { reason: 'QA reset' });
  record('EXAM-03', 'Lock exam', lock.status === 200, `status=${lock.status}`);

  const enrId = String((await Student.findById(sid).lean()).enrollments[0]._id);
  const unlockOne = await mut('PUT', `/api/students/${sid}/unlock-exam`, { enrollmentId: enrId });
  const afterOne = await Student.findById(sid).lean();
  const primary = afterOne.enrollments.find((e) => String(e._id) === enrId);
  const secondary = afterOne.enrollments.find((e) => String(e._id) !== enrId);
  record(
    'EXAM-04',
    'Unlock single enrollmentId',
    unlockOne.status === 200 && primary?.examUnlocked === true && secondary?.examUnlocked === false && afterOne.studentExamUnlocked === true,
    `status=${unlockOne.status} primary=${primary?.examUnlocked} secondary=${secondary?.examUnlocked} root=${afterOne.studentExamUnlocked}`,
  );

  const audit = await AuditLog.findOne({ action: 'exam.unlock', studentId: sid }).sort({ createdAt: -1 }).lean();
  record('EXAM-05', 'Audit exam.unlock', !!audit, `action=${audit?.action || 'none'}`);

  // No password leak
  const hasPwd = unlock.json?.data?.password != null;
  record('EXAM-06', 'Response không trả password', !hasPwd, `hasPwd=${hasPwd}`);

  await mut('DELETE', `/api/students/${sid}`);
  await mongoose.disconnect();

  const fail = out.filter((x) => x.result === 'FAIL').length;
  console.log(`\n=== Exam unlock critical: PASS ${out.length - fail} FAIL ${fail} ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
