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

  const candidates = await Student.find({
    name: /^QA HV CN1/,
    'enrollments.completedSessions': { $gte: 8 },
    'enrollments.courseName': /Excel/i,
  }).limit(12).lean();
  if (!candidates?.length) {
    console.error('Missing seed students');
    process.exit(1);
  }

  let student = null;
  let enr = null;
  let gvA = null;
  let gvB = null;

  for (const s of candidates) {
    const e = (s.enrollments || []).find((x) => /Excel/i.test(x.courseName || '')) || (s.enrollments || [])[0];
    if (!e?.teacherId) continue;

    // endpoint requires teacherB.status === 'active' (approved to teach)
    const teacherB = await Teacher.findOne({
      role: 'teacher',
      branchCode: 'CN1',
      status: 'active',
      _id: { $ne: e.teacherId },
      specialty: /excel/i,
    }).select('_id name specialty status').lean();

    if (teacherB?._id) {
      student = s;
      enr = e;
      gvA = String(e.teacherId);
      gvB = teacherB;
      break;
    }
  }

  if (!student || !gvB) {
    // If seed data doesn't allow selecting (teacherA != the only active Excel teacher),
    // build a small scenario on-the-fly so the test stays deterministic.
    const teacherBActive = await Teacher.findOne({
      role: 'teacher',
      branchCode: 'CN1',
      status: 'active',
      specialty: /excel/i,
    }).lean();
    const teacherANonActive = await Teacher.findOne({
      role: 'teacher',
      branchCode: 'CN1',
      status: { $ne: 'active' },
      specialty: /excel/i,
      ...(teacherBActive?._id ? { _id: { $ne: teacherBActive._id } } : {}),
    }).lean();

    if (!teacherBActive || !teacherANonActive) {
      console.error('No suitable student+GV B found and cannot build scenario (need Excel active + non-active teachers)');
      process.exit(1);
    }

    const phone = `096${String(Date.now()).slice(-7)}`;
    const sCreate = await mut('POST', '/api/students', {
      name: `QA HV CN1 REA-${Date.now().toString().slice(-6)}`,
      phone,
      zalo: phone,
      course: 'Excel MOS',
      price: 2500000,
      totalSessions: 20,
      password: 'Test@123456',
      // Provide enrollment upfront so the test can seed teacherId=non-active teacherA
      // without calling assign-teacher (which blocks non-active teachers).
      enrollments: [
        {
          courseName: 'Excel MOS',
          teacherId: String(teacherANonActive._id),
          teacherName: String(teacherANonActive.name || ''),
          price: 2500000,
          totalSessions: 20,
          remainingSessions: 12,
          completedSessions: 8,
          isPrimary: true,
          linkHoc: '',
          status: 'active',
        },
      ],
    });
    const sid = sCreate.json?.data?._id || sCreate.json?._id;
    if (!sid) {
      console.error('Scenario: failed to create student', `status=${sCreate.status}`, `resp=${JSON.stringify(sCreate.json || {}, null, 2).slice(0, 600)}`);
      process.exit(1);
    }

    // 2) Create schedules: first create as "scheduled" then mark to "completed"
    //    (so we avoid the 12h cooldown which applies only when creating with status=completed)
    const completedScheduleIds = [];
    const stDoc2 = await Student.findById(sid).lean();
    const eExcel = (stDoc2?.enrollments || []).find((x) => /Excel/i.test(x.courseName || x.course || '')) || stDoc2?.enrollments?.[0];
    if (!eExcel?._id) {
      console.error('Scenario: missing Excel enrollment after student create');
      process.exit(1);
    }
    const courseName = String(eExcel.courseName || eExcel.course || 'Excel MOS');

    for (let i = 0; i < 8; i++) {
      const d = new Date(Date.now() - (20 + i) * 86400000);
      const created = await mut('POST', '/api/schedules', {
        teacherId: String(teacherANonActive._id),
        studentId: String(sid),
        date: d.toISOString(),
        startTime: '09:00',
        course: courseName,
        note: `QA seed completed-${i}`,
        status: 'scheduled',
      });
      const schId = created.json?.data?._id || created.json?._id;
      if (schId) completedScheduleIds.push(schId);
    }

    for (const schId of completedScheduleIds) {
      await mut('PUT', `/api/schedules/${schId}`, {
        status: 'completed',
        note: 'QA seed attendance (mark completed)',
      });
    }

    // Future scheduled
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.now() + (i + 1) * 86400000);
      await mut('POST', '/api/schedules', {
        teacherId: String(teacherANonActive._id),
        studentId: String(sid),
        date: d.toISOString(),
        startTime: '10:00',
        course: courseName,
        linkHoc: 'https://meet.example.com/qa-reassign',
        note: `QA seed future-${i}`,
        status: 'scheduled',
      });
    }

    student = await Student.findById(sid).lean();
    enr = (student?.enrollments || []).find((x) => /Excel/i.test(x.courseName || x.course || '')) || student?.enrollments?.[0];
    gvA = String(teacherANonActive._id);
    gvB = teacherBActive;
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

  // Grade history chain: ensure we have a submission, then regrade 3 times
  let sub = await Submission.findOne({ studentId: student._id }).sort({ updatedAt: -1 });
  if (!sub) {
    const courseId = String(enr.courseName || enr.course || 'Excel MOS');
    const asgCreate = await mut('POST', '/api/assignments', {
      courseId,
      studentId: String(student._id),
      teacherId: gvB?._id ? String(gvB._id) : undefined,
      title: `QA BT reassign-${Date.now().toString().slice(-6)}`,
      description: 'QA reassign grade history chain',
      deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

    const createdAsgId = asgCreate.json?.data?._id || asgCreate.json?._id;
    if (createdAsgId) {
      const submitRes = await mut('POST', `/api/assignments/${createdAsgId}/submit`, {
        studentId: String(student._id),
        teacherId: gvB?._id ? String(gvB._id) : undefined,
        submittedFileUrl: '/uploads/assignments/qa-placeholder.txt',
      });

      const subId = submitRes.json?.data?._id || submitRes.json?._id;
      if (subId) sub = await Submission.findById(subId).lean();
    }
  }

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
    record('GRADE-HIST', 'Grade chain 8→9→10 + audit', false, 'cannot create submission for grade history');
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
