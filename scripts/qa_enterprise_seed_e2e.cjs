/**
 * QA Enterprise — Seed + E2E API (Mongo + Express runtime).
 * KHÔNG sửa product code. Chỉ seed + kiểm thử + báo cáo.
 *
 * Usage: node scripts/qa_enterprise_seed_e2e.cjs
 * Env: QA_API_BASE, MONGODB_URI, JWT_SECRET
 *
 * Marker: phone prefix QA enterprise + displayCode / name "QA *"
 */
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const PASSWORD = 'Test@123456';
const NOTE = 'QA_ENTERPRISE_2026';
const OUT_DIR = path.join(__dirname, '..', 'docs');
const REPORT_JSON = path.join(OUT_DIR, 'QA_ENTERPRISE_REPORT.json');
const REPORT_MD = path.join(OUT_DIR, 'QA_ENTERPRISE_E2E_REPORT.md');

const Branch = require('../models/Branch');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Schedule = require('../models/Schedule');
const { PERMISSIONS } = require('../constants/permissions');

const results = [];
const bugs = [];
const ctx = { branches: {}, admins: {}, staff: {}, teachers: {}, students: {}, courses: {} };
let csrfState = { token: '', cookie: '' };

function record(tc) {
  results.push(tc);
  const icon = tc.result === 'PASS' ? 'PASS' : tc.result === 'FAIL' ? 'FAIL' : tc.result;
  console.log(`[${icon}] ${tc.module || '-'} | ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
  if (tc.result === 'FAIL') {
    bugs.push({
      id: tc.id,
      module: tc.module,
      title: tc.name,
      severity: tc.severity || 'High',
      priority: tc.severity === 'Critical' ? 'P0' : tc.severity === 'High' ? 'P1' : tc.severity === 'Medium' ? 'P2' : 'P3',
      expected: tc.expected,
      actual: tc.actual,
      reproduce: tc.reproduce || tc.api || '',
      fixHint: tc.fixHint || '',
      api: tc.api || '',
      ui: tc.ui || 'Chưa kiểm UI (API-only)',
      database: tc.database || '',
      impact: tc.impact || '',
      rootCause: tc.rootCause || '',
    });
  }
}

function req(method, p, { token, body, headers: extra = {} } = {}) {
  return new Promise((resolve) => {
    const url = new URL(p, BASE);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...extra,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (csrfState.cookie) headers.Cookie = csrfState.cookie;
    if (csrfState.token && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers['X-CSRF-Token'] = csrfState.token;
    }
    const data = body != null ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const started = Date.now();
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 45000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 400) }; }
          resolve({ status: res.statusCode, json, ms: Date.now() - started, headers: res.headers });
        });
      },
    );
    r.on('error', (err) => resolve({ status: 0, json: { message: err.message }, ms: Date.now() - started }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: { message: 'timeout' }, ms: Date.now() - started }); });
    if (data) r.write(data);
    r.end();
  });
}

async function refreshCsrf() {
  const res = await req('GET', '/api/auth/csrf-token');
  const token = res.json?.csrfToken || res.json?.data?.csrfToken || '';
  const setCookie = res.headers['set-cookie'] || [];
  csrfState = {
    token,
    cookie: setCookie.map((c) => c.split(';')[0]).join('; '),
  };
  return csrfState;
}

function mint({ id, role, name, adminRole, permissions, branchId, aud = 'internal' }) {
  return jwt.sign(
    {
      id: String(id),
      role,
      name: name || 'QA',
      adminRole: adminRole || undefined,
      permissions: permissions || [],
      branchId: branchId ? String(branchId) : undefined,
      aud,
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' },
  );
}

const ALL_PERMS = Object.values(PERMISSIONS);
const COURSE_NAMES = [
  'Tin học văn phòng',
  'Excel MOS',
  'Word MOS',
  'PowerPoint MOS',
  'Canva',
  'IC3',
];

const PHONE_PREFIXES = {
  super: '0999000001',
  admin: (bi) => `0981${bi}00001`,
  staff: (bi) => `0982${bi}00001`,
  teacher: (bi, t) => `097${bi}0000${t}`,
  student: (bi, i) => `096${bi}${String(10000 + i).slice(1)}`,
};

async function cleanupQa() {
  const phones = [PHONE_PREFIXES.super];
  for (const code of ['CN1', 'CN2', 'CN3']) {
    const bi = code.slice(2);
    phones.push(PHONE_PREFIXES.admin(bi), PHONE_PREFIXES.staff(bi));
    for (let t = 1; t <= 2; t += 1) phones.push(PHONE_PREFIXES.teacher(bi, t));
    for (let i = 1; i <= 10; i += 1) phones.push(PHONE_PREFIXES.student(bi, i));
  }

  await Student.deleteMany({
    $or: [
      { phone: { $in: phones } },
      { zalo: { $in: phones } },
      { email: { $regex: /^qa\.hv\./i } },
      { displayCode: { $regex: /^HV\d+-CN/i } },
      { name: { $regex: /^QA HV /i } },
    ],
  });
  await Teacher.deleteMany({
    $or: [
      { phone: { $in: phones } },
      { name: { $regex: /^QA (Super Admin|Admin |Staff |GV )/ } },
    ],
  });
  await Schedule.deleteMany({ note: NOTE });
  await Course.deleteMany({ name: { $regex: /^QA SoftDelete Temp/ } });
  // Không xóa Course nghiệp vụ (Excel MOS...) — reuse
}

async function seed() {
  for (const code of ['CN1', 'CN2', 'CN3']) {
    let b = await Branch.findOne({ code });
    if (!b) {
      b = await Branch.create({
        name: `Chi nhánh QA ${code}`,
        code,
        address: `Địa chỉ ${code}`,
        phone: `02800000${code.slice(2)}`,
        isActive: true,
      });
    }
    ctx.branches[code] = b;
  }

  let superAdmin = await Teacher.findOne({ phone: PHONE_PREFIXES.super });
  if (!superAdmin) {
    superAdmin = await Teacher.create({
      name: 'QA Super Admin',
      phone: PHONE_PREFIXES.super,
      zalo: PHONE_PREFIXES.super,
      password: PASSWORD,
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      permissions: ALL_PERMS,
      status: 'active',
      specialty: 'QA',
    });
  }
  ctx.superAdmin = superAdmin;

  for (const name of COURSE_NAMES) {
    let c = await Course.findOne({ name, deletedAt: null });
    if (!c) {
      c = await Course.create({
        name,
        price: 2500000,
        totalSessions: 20,
        status: 'published',
        category: name === 'Canva' ? 'do-hoa' : name === 'IC3' ? 'chung-chi' : 'van-phong',
      });
    }
    ctx.courses[name] = c;
  }

  for (const code of ['CN1', 'CN2', 'CN3']) {
    const branch = ctx.branches[code];
    const bi = code.slice(2);

    const admin = await Teacher.create({
      name: `QA Admin ${code}`,
      phone: PHONE_PREFIXES.admin(bi),
      zalo: PHONE_PREFIXES.admin(bi),
      password: PASSWORD,
      role: 'admin',
      adminRole: 'STAFF',
      permissions: [
        PERMISSIONS.MANAGE_STUDENTS,
        PERMISSIONS.MANAGE_SCHEDULE,
        PERMISSIONS.MANAGE_FINANCE,
        PERMISSIONS.VIEW_TEACHERS,
        PERMISSIONS.VIEW_EVALUATIONS,
        PERMISSIONS.VIEW_BRANCH_REVENUE,
      ],
      branchId: branch._id,
      branchCode: code,
      status: 'active',
      displayCode: `AD001-${code}`,
    });
    ctx.admins[code] = admin;

    const staff = await Teacher.create({
      name: `QA Staff ${code}`,
      phone: PHONE_PREFIXES.staff(bi),
      zalo: PHONE_PREFIXES.staff(bi),
      password: PASSWORD,
      role: 'staff',
      adminRole: 'STAFF',
      permissions: [
        PERMISSIONS.MANAGE_STUDENTS,
        PERMISSIONS.MANAGE_SCHEDULE,
        PERMISSIONS.VIEW_TEACHERS,
      ],
      branchId: branch._id,
      branchCode: code,
      status: 'active',
      displayCode: `ST001-${code}`,
    });
    ctx.staff[code] = staff;

    ctx.teachers[code] = [];
    for (let t = 1; t <= 2; t += 1) {
      const teacher = await Teacher.create({
        name: `QA GV ${code}-${t}`,
        phone: PHONE_PREFIXES.teacher(bi, t),
        zalo: PHONE_PREFIXES.teacher(bi, t),
        password: PASSWORD,
        role: 'teacher',
        branchId: branch._id,
        branchCode: code,
        status: 'active',
        specialty: 'Tin học',
        baseSalaryPerSession: 100000,
        displayCode: `GV00${t}-${code}`,
      });
      ctx.teachers[code].push(teacher);
    }

    ctx.students[code] = [];
    for (let i = 1; i <= 10; i += 1) {
      const pad = String(i).padStart(2, '0');
      const teacher = ctx.teachers[code][(i - 1) % 2];
      const c1 = ctx.courses['Excel MOS'];
      const c2 = ctx.courses['PowerPoint MOS'];
      const phone = PHONE_PREFIXES.student(bi, i);
      const student = await Student.create({
        name: `QA HV ${code}-${pad}`,
        phone,
        zalo: phone,
        email: `qa.hv.${code.toLowerCase()}.${pad}@test.local`,
        password: PASSWORD,
        studentCode: `HV${pad}-${code}-EXCELMOS`,
        displayCode: `HV${pad}-${code}`,
        course: 'Excel MOS',
        price: 2500000,
        paid: i <= 5,
        paidAmount: i <= 5 ? 2500000 : 0,
        paidAt: i <= 5 ? new Date() : null,
        teacherId: teacher._id,
        branchId: branch._id,
        branchCode: code,
        status: 'Đang học',
        totalSessions: 20,
        completedSessions: i <= 3 ? 8 : 0,
        remainingSessions: i <= 3 ? 12 : 20,
        enrollments: [
          {
            courseId: c1._id,
            courseName: 'Excel MOS',
            teacherId: teacher._id,
            teacherName: teacher.name,
            price: 2500000,
            totalSessions: 20,
            completedSessions: i <= 3 ? 8 : 0,
            remainingSessions: i <= 3 ? 12 : 20,
            paid: i <= 5,
            paidAt: i <= 5 ? new Date() : undefined,
            status: i <= 5 ? 'active' : 'pending_payment',
            learningAccess: i <= 5,
            isPrimary: true,
            examUnlocked: false,
            enrollmentCode: `HV${pad}-${code}-EXCELMOS`,
          },
          {
            courseId: c2._id,
            courseName: 'PowerPoint MOS',
            teacherId: ctx.teachers[code][1]._id,
            teacherName: ctx.teachers[code][1].name,
            price: 2500000,
            totalSessions: 20,
            completedSessions: 0,
            remainingSessions: 20,
            paid: false,
            status: 'pending_payment',
            learningAccess: false,
            isPrimary: false,
            examUnlocked: false,
            enrollmentCode: `HV${pad}-${code}-POWERPOINTMOS`,
          },
        ],
      });
      ctx.students[code].push(student);

      if (i <= 3) {
        for (let s = 0; s < 8; s += 1) {
          const d = new Date();
          d.setDate(d.getDate() - (20 - s));
          await Schedule.create({
            studentId: student._id,
            teacherId: teacher._id,
            studentName: student.name,
            teacherName: teacher.name,
            course: 'Excel MOS',
            date: d,
            startTime: '08:00',
            endTime: '09:30',
            status: 'completed',
            attendanceStatus: 'present',
            branchId: branch._id,
            branchCode: code,
            note: NOTE,
            is_paid_to_teacher: false,
          });
        }
      }
    }
  }

  return {
    branches: 3,
    superAdmin: 1,
    admins: 3,
    staff: 3,
    teachers: 6,
    students: 30,
    courses: COURSE_NAMES.length,
    password: PASSWORD,
    note: NOTE,
  };
}

async function runApiSuite() {
  await refreshCsrf();
  const hardcoded = mint({ id: 'admin', role: 'admin', name: 'Super Admin', adminRole: 'SUPER_ADMIN' });

  {
    const h = await req('GET', '/healthz');
    record({
      id: 'SYS-01', module: 'System', name: 'Healthz',
      expected: '200 healthy', actual: `${h.status} redis=${h.json?.redis} queue=${h.json?.queue}`,
      result: h.status === 200 && h.json?.ok ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'GET /healthz',
      impact: 'Môi trường test không chạy', rootCause: h.status !== 200 ? 'Server down / Mongo' : '',
    });
    record({
      id: 'SYS-02', module: 'System', name: 'Redis for multi-instance',
      expected: 'redis up', actual: String(h.json?.redis),
      result: h.json?.redis && h.json.redis !== 'disabled' ? 'PASS' : 'FAIL',
      severity: 'High', api: 'GET /healthz',
      impact: 'Cache/session/socket scale hạn chế khi multi-instance',
      rootCause: 'REDIS_URL chưa cấu hình trên môi trường local',
      fixHint: 'Bật Redis trên staging/prod trước go-live',
    });
  }

  // Concurrent JWT session probe (42 actors)
  {
    const actors = [];
    for (const code of ['CN1', 'CN2', 'CN3']) {
      actors.push({
        tok: mint({
          id: ctx.admins[code]._id, role: 'admin', adminRole: 'STAFF',
          permissions: ctx.admins[code].permissions, branchId: ctx.branches[code]._id,
        }),
      });
      actors.push({
        tok: mint({
          id: ctx.staff[code]._id, role: 'staff', adminRole: 'STAFF',
          permissions: ctx.staff[code].permissions, branchId: ctx.branches[code]._id,
        }),
      });
      for (const t of ctx.teachers[code]) {
        actors.push({ tok: mint({ id: t._id, role: 'teacher', aud: 'public', branchId: t.branchId }) });
      }
      for (const s of ctx.students[code]) {
        actors.push({ tok: mint({ id: s._id, role: 'student', aud: 'public' }) });
      }
    }
    const started = Date.now();
    const settled = await Promise.all(actors.map(async (a) => {
      const r = await req('GET', '/api/auth/me', { token: a.tok });
      return { status: r.status, ms: r.ms };
    }));
    const ok = settled.filter((x) => x.status === 200).length;
    const fail = settled.length - ok;
    const avg = Math.round(settled.reduce((s, x) => s + x.ms, 0) / Math.max(1, settled.length));
    record({
      id: 'AUTH-CONC-01', module: 'Authentication',
      name: `Concurrent JWT /auth/me (${actors.length} actors)`,
      expected: 'all 200', actual: `ok=${ok} fail=${fail} avgMs=${avg} wall=${Date.now() - started}ms`,
      result: fail === 0 ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'GET /api/auth/me',
      reproduce: 'Mint 42 JWT → Promise.all /auth/me',
      impact: 'JWT/session không chịu tải đồng thời',
      database: 'Teacher/Student by JWT id',
    });
    record({
      id: 'AUTH-CONC-02', module: 'Authentication',
      name: 'Concurrent password+CAPTCHA login (42 users)',
      expected: 'Automate được login thật 30HV+6GV+3Admin+3Staff',
      actual: 'CAPTCHA SVG one-shot — suite không đọc được đáp án → chưa chạy password login đồng thời',
      result: 'FAIL',
      severity: 'Medium',
      api: 'POST /api/auth/login/public|internal',
      rootCause: 'CAPTCHA không có bypass test hook',
      reproduce: 'Cần 42 captcha answers song song',
      impact: 'Chưa verify race device-lock / refresh token trên login thật',
      fixHint: 'CAPTCHA_BYPASS chỉ khi NODE_ENV=test',
      ui: 'Login form',
    });
  }

  // Multi-branch
  {
    const staffTok = mint({
      id: ctx.staff.CN1._id, role: 'staff', adminRole: 'STAFF',
      permissions: ctx.staff.CN1.permissions, branchId: ctx.branches.CN1._id,
    });
    const list = await req('GET', '/api/students?limit=500', { token: staffTok });
    const rows = list.json?.data || list.json?.students || [];
    const leaked = rows.filter((s) => String(s.branchCode || '') === 'CN2'
      || String(s.branchId) === String(ctx.branches.CN2._id));
    record({
      id: 'BRANCH-01', module: 'Multi Branch',
      name: 'Staff CN1 không thấy HV CN2',
      expected: '0 HV CN2', actual: `status=${list.status} total=${rows.length} leaked=${leaked.length}`,
      result: list.status === 200 && leaked.length === 0 ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'GET /api/students',
      reproduce: 'Staff CN1 list students',
      impact: 'Lộ PII chi nhánh khác',
      database: 'Student.branchId',
      fixHint: 'branchFilter + assertStudentBranchAccess',
      ui: 'Admin/Staff students table',
    });
  }

  // RBAC cross-branch pay — dùng Admin CN1 (có MANAGE_FINANCE trên DB)
  // để tránh Pass giả do thiếu permission thay vì branch isolation.
  {
    await refreshCsrf();
    const adminTok = mint({
      id: ctx.admins.CN1._id,
      role: 'admin',
      adminRole: 'STAFF',
      permissions: ctx.admins.CN1.permissions,
      branchId: ctx.branches.CN1._id,
    });
    const victim = ctx.students.CN2[0];
    const pay = await req('PUT', `/api/students/${victim._id}/pay`, {
      token: adminTok,
      body: { paymentMethod: 'cash', note: 'QA cross-branch' },
    });
    const msg = String(pay.json?.message || '');
    const blocked = [403, 404].includes(pay.status);
    const permissionDenied = /không có quyền|permission/i.test(msg) && !/chi nhánh|branch|không thuộc/i.test(msg);
    record({
      id: 'RBAC-01', module: 'RBAC',
      name: 'Admin CN1 (có finance) bị chặn pay HV CN2 theo branch',
      expected: '403/404 do branch scope (không phải thiếu permission)',
      actual: `status=${pay.status} msg=${msg}`,
      result: blocked && !permissionDenied ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'PUT /api/students/:id/pay',
      reproduce: 'Admin CN1 (DB có manage_finance) PUT pay student CN2',
      impact: 'Leo thang tài chính cross-branch / IDOR',
      rootCause: pay.status === 200
        ? 'Thiếu assertStudentBranchAccess'
        : (permissionDenied ? '403 do permission — JWT/DB lệch hoặc test actor sai; chưa chứng minh branch isolation' : ''),
      database: 'Student.paid / LedgerEntry',
      fixHint: 'assertStudentBranchAccess trên mọi mutation finance',
    });
  }

  // Course soft-delete
  {
    await refreshCsrf();
    const c = await Course.create({
      name: `QA SoftDelete Temp ${Date.now()}`,
      price: 1000,
      totalSessions: 5,
      status: 'published',
    });
    const del = await req('DELETE', `/api/courses/${c._id}`, {
      token: hardcoded,
      body: { reason: 'QA soft delete' },
    });
    const again = await Course.findById(c._id).lean();
    record({
      id: 'COURSE-01', module: 'Course',
      name: 'DELETE course = soft-delete',
      expected: 'API ok + deletedAt set', actual: `api=${del.status} deletedAt=${again?.deletedAt || null}`,
      result: del.status === 200 && again?.deletedAt ? 'PASS' : 'FAIL',
      severity: 'High', api: 'DELETE /api/courses/:id',
      database: 'Course.deletedAt',
      fixHint: 'softDeleteCourse service',
      impact: 'Hard delete mất lịch sử/revenue',
      rootCause: del.status !== 200 ? (del.json?.message || 'API reject') : (!again?.deletedAt ? 'deletedAt not set' : ''),
    });
  }

  // Payment
  {
    await refreshCsrf();
    const unpaid = ctx.students.CN1[9];
    await Student.findByIdAndUpdate(unpaid._id, { paid: false, paidAmount: 0, paidAt: null });
    const adminTok = mint({
      id: ctx.admins.CN1._id, role: 'admin', adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.MANAGE_STUDENTS],
      branchId: ctx.branches.CN1._id,
    });
    const pay = await req('PUT', `/api/students/${unpaid._id}/pay`, {
      token: adminTok,
      body: { paymentMethod: 'transfer', note: 'QA pay' },
    });
    const after = await Student.findById(unpaid._id).lean();
    record({
      id: 'PAY-01', module: 'Payment',
      name: 'Admin xác nhận thanh toán',
      expected: '200 + paid=true', actual: `status=${pay.status} paid=${after?.paid} msg=${pay.json?.message || ''}`,
      result: pay.status === 200 && after?.paid === true ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'PUT /api/students/:id/pay',
      database: 'Student.paid, Invoice, LedgerEntry',
      ui: 'Admin mark paid',
      impact: 'Không cấp quyền học / lệch doanh thu',
      rootCause: pay.status !== 200 ? (pay.json?.message || '') : '',
    });
  }

  // Attendance
  {
    await refreshCsrf();
    const gv = ctx.teachers.CN1[0];
    const stu = ctx.students.CN1[0];
    const tok = mint({ id: gv._id, role: 'teacher', aud: 'public' });
    const news = await Schedule.create({
      studentId: stu._id,
      teacherId: gv._id,
      studentName: stu.name,
      teacherName: gv.name,
      course: 'Excel MOS',
      date: new Date(),
      startTime: '14:00',
      endTime: '15:30',
      status: 'scheduled',
      branchId: ctx.branches.CN1._id,
      branchCode: 'CN1',
      note: NOTE,
    });
    const att = await req('POST', `/api/schedules/${news._id}/attendance`, {
      token: tok,
      body: { attendanceStatus: 'present', note: 'QA' },
    });
    const updated = await Schedule.findById(news._id).lean();
    record({
      id: 'ATT-01', module: 'Attendance',
      name: 'GV điểm danh present',
      expected: '200 + completed/present', actual: `api=${att.status} status=${updated?.status} att=${updated?.attendanceStatus}`,
      result: att.status === 200 && updated?.status === 'completed' && updated?.attendanceStatus === 'present' ? 'PASS' : 'FAIL',
      severity: 'High', api: 'POST /api/schedules/:id/attendance',
      database: 'Schedule + AuditLog',
      ui: 'Teacher calendar',
      rootCause: att.status !== 200 ? (att.json?.message || '') : '',
    });
  }

  // Reassign ownership 8 sessions
  {
    const { computeCompletedSplitByTeacher } = require('../services/teacherReassignmentService');
    const stu = ctx.students.CN1[0];
    const sessions = await Schedule.find({ studentId: stu._id, course: 'Excel MOS' }).select('teacherId status').lean();
    const split = computeCompletedSplitByTeacher(sessions);
    const aId = String(ctx.teachers.CN1[0]._id);
    record({
      id: 'REASSIGN-01', module: 'Schedule',
      name: 'Ownership completed GV A ≥ 8',
      expected: `split[${aId}]>=8`, actual: JSON.stringify(split),
      result: (split[aId] || 0) >= 8 ? 'PASS' : 'FAIL',
      severity: 'High',
      api: 'teacherReassignmentService.computeCompletedSplitByTeacher',
      database: 'Schedule.teacherId/status',
      impact: 'Sai lương khi đổi GV',
    });
  }

  // Exam unlock
  {
    await refreshCsrf();
    const adminTok = mint({
      id: ctx.admins.CN1._id, role: 'admin', adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_STUDENTS],
      branchId: ctx.branches.CN1._id,
    });
    const stu = ctx.students.CN1[0];
    const unlock = await req('PUT', `/api/students/${stu._id}/unlock-exam`, { token: adminTok, body: {} });
    const after = await Student.findById(stu._id).lean();
    record({
      id: 'EXAM-01', module: 'Exam',
      name: 'Unlock exam',
      expected: '200 + studentExamUnlocked', actual: `status=${unlock.status} unlocked=${after?.studentExamUnlocked}`,
      result: unlock.status === 200 && after?.studentExamUnlocked ? 'PASS' : 'FAIL',
      severity: 'High', api: 'PUT /api/students/:id/unlock-exam',
      database: 'Student.studentExamUnlocked',
      rootCause: unlock.status !== 200 ? (unlock.json?.message || '') : '',
    });
  }

  // Rating rule
  {
    const { isPublicRating } = require('../services/ratingLifecycleService');
    const ok = isPublicRating({ type: 'teacher_rating', status: 'pending' }) === false;
    record({
      id: 'RATING-01', module: 'Rating',
      name: 'pending rating không public',
      expected: 'false', actual: String(!ok ? 'true(BUG)' : 'false'),
      result: ok ? 'PASS' : 'FAIL',
      severity: 'High', api: 'ratingLifecycleService.isPublicRating',
    });
  }

  // Dashboard KPI
  {
    const kpi = await req('GET', '/api/analytics/kpi', { token: hardcoded });
    const sep = kpi.json?.data?.meta?.kpisSeparated;
    record({
      id: 'DASH-01', module: 'Dashboard',
      name: 'KPI operational ≠ financial',
      expected: 'meta.kpisSeparated true', actual: `status=${kpi.status} separated=${sep}`,
      result: kpi.status === 200 && sep === true ? 'PASS' : 'FAIL',
      severity: 'High', api: 'GET /api/analytics/kpi',
    });
  }

  // Notifications
  {
    const n = await req('GET', '/api/notifications', {
      token: mint({ id: ctx.students.CN1[0]._id, role: 'student', aud: 'public' }),
    });
    record({
      id: 'NOTIF-01', module: 'Notification',
      name: 'HV list notifications',
      expected: '200', actual: `status=${n.status}`,
      result: n.status === 200 ? 'PASS' : 'FAIL',
      severity: 'Medium', api: 'GET /api/notifications',
    });
    const zalo = Boolean(process.env.ZALO_OA_ACCESS_TOKEN || process.env.ZALO_ACCESS_TOKEN);
    const smtp = Boolean(process.env.SMTP_HOST);
    record({
      id: 'NOTIF-02', module: 'Notification', name: 'Zalo OA env',
      expected: 'token present', actual: zalo ? 'configured' : 'missing',
      result: zalo ? 'PASS' : 'FAIL', severity: 'Medium',
      impact: 'Không gửi Zalo ngoài in-app', fixHint: 'Cấu hình ZALO_OA_ACCESS_TOKEN',
      rootCause: 'Env missing trên local',
    });
    record({
      id: 'NOTIF-03', module: 'Notification', name: 'SMTP env',
      expected: 'SMTP_HOST', actual: smtp ? 'configured' : 'missing',
      result: smtp ? 'PASS' : 'FAIL', severity: 'Medium',
      fixHint: 'Cấu hình SMTP_*', rootCause: 'Env missing trên local',
    });
  }

  // Assignment
  {
    await refreshCsrf();
    const gv = ctx.teachers.CN1[0];
    const stu = ctx.students.CN1[0];
    const tok = mint({ id: gv._id, role: 'teacher', aud: 'public' });
    const created = await req('POST', '/api/assignments', {
      token: tok,
      body: {
        title: `QA BT ${Date.now()}`,
        description: 'QA enterprise',
        studentId: String(stu._id),
        courseId: 'Excel MOS',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    record({
      id: 'ASG-01', module: 'Assignment',
      name: 'GV tạo bài tập',
      expected: '200/201', actual: `status=${created.status} msg=${created.json?.message || ''}`,
      result: created.status >= 200 && created.status < 300 ? 'PASS' : 'FAIL',
      severity: 'High', api: 'POST /api/assignments',
      ui: 'Teacher assignments',
      rootCause: created.status >= 300 ? (created.json?.message || '') : '',
    });
  }

  // Audit
  {
    const AuditLog = require('../models/AuditLog');
    const n = await AuditLog.countDocuments({
      $or: [
        { action: { $regex: /payment|attendance|exam|course/i } },
        { type: { $regex: /payment|attendance|exam|course/i } },
      ],
    });
    record({
      id: 'AUDIT-01', module: 'Audit Log',
      name: 'Có audit critical actions',
      expected: 'count>0', actual: `count=${n}`,
      result: n > 0 ? 'PASS' : 'FAIL',
      severity: 'High', database: 'AuditLog',
    });
  }

  // Gaps marked NOT-RUN as FAIL (incomplete coverage for go-live gate)
  const gaps = [
    { id: 'UI-01', module: 'UI E2E', name: 'Playwright toàn bộ màn Admin/Staff/GV/HV', severity: 'High' },
    { id: 'SOCK-01', module: 'Socket', name: 'Realtime reconnect/offline/duplicate event', severity: 'High' },
    { id: 'PAY-REF-01', module: 'Payment', name: 'Refund partial + full + revenue/invoice', severity: 'Critical' },
    { id: 'GRADE-HIST-01', module: 'Assignment', name: 'Grade history 80→90→95 old/new/user/time', severity: 'High' },
    { id: 'REASSIGN-E2E-01', module: 'Schedule', name: 'Đổi GV A→B full E2E (8/12 + HV giữ lịch/điểm/BT)', severity: 'Critical' },
    { id: 'FIREBASE-01', module: 'Notification', name: 'Firebase push device thật', severity: 'Medium' },
    { id: 'PERF-01', module: 'Performance', name: 'Đo CPU/RAM/DB query dưới 42 user concurrent write', severity: 'Medium' },
  ];
  for (const g of gaps) {
    record({
      id: g.id, module: g.module, name: g.name,
      expected: 'Đã kiểm tra E2E đầy đủ', actual: 'NOT RUN trong suite lần này',
      result: 'FAIL', severity: g.severity,
      rootCause: 'Phạm vi API/seed chưa cover luồng này',
      impact: 'Không đủ bằng chứng Pass cho go-live',
      fixHint: 'Bổ sung automation + chạy lại regression',
    });
  }
}

function buildReport(seedSummary) {
  const byModule = {};
  for (const r of results) {
    const m = r.module || 'Other';
    if (!byModule[m]) byModule[m] = { pass: 0, fail: 0, warn: 0, cases: [] };
    if (r.result === 'PASS') byModule[m].pass += 1;
    else if (r.result === 'WARN') byModule[m].warn += 1;
    else byModule[m].fail += 1;
    byModule[m].cases.push(r);
  }

  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const warn = results.filter((r) => r.result === 'WARN').length;
  const critical = bugs.filter((b) => b.severity === 'Critical').length;
  const high = bugs.filter((b) => b.severity === 'High').length;
  const medium = bugs.filter((b) => b.severity === 'Medium').length;
  const low = bugs.filter((b) => b.severity === 'Low').length;

  // Conservative readiness: incomplete coverage + fails
  let readiness = 85;
  readiness -= critical * 8;
  readiness -= high * 3;
  readiness -= medium * 1;
  readiness = Math.max(15, Math.min(85, readiness));

  const missing = [
    'UI E2E Playwright đầy đủ mọi role/màn',
    'Concurrent password+CAPTCHA login 42 users',
    'Firebase Push thật',
    'Zalo/Email send end-to-end (nếu env thiếu)',
    'Socket reconnect/offline/duplicate matrix',
    'Refund partial/full chứng từ đầy đủ',
    'Grade edit history collection/UI',
    'Đổi GV A→B full business E2E (giữ lịch/điểm/BT + payroll 8/12)',
    'PostgreSQL/Prisma — brief lệch; runtime hiện tại MongoDB+Mongoose',
    'Perf profiling CPU/RAM/query plan dưới tải write',
  ];

  const risks = [
    'Redis disabled → rủi ro multi-instance / cache inconsistency',
    'CAPTCHA + device lock chưa load-test bằng automation',
    'Coverage API-only → bug UI/UX và Socket có thể lọt',
    'Refund/grade-history/reassign E2E chưa chạy → rủi ro tài chính & lương GV',
    'Cross-branch IDOR phụ thuộc middleware nhất quán trên mọi route',
    'Phase 8–15 soft-delete/ledger mới — cần verify trên staging gần prod',
  ];

  const fixOrder = [
    ...bugs.filter((b) => b.severity === 'Critical'),
    ...bugs.filter((b) => b.severity === 'High'),
    ...bugs.filter((b) => b.severity === 'Medium'),
    ...bugs.filter((b) => b.severity === 'Low'),
  ];

  const md = [];
  md.push('# QA Enterprise E2E Report — QUANLYCMS');
  md.push('');
  md.push(`**Ngày:** ${new Date().toISOString()}`);
  md.push(`**Môi trường:** Local API \`${BASE}\``);
  md.push('**Stack thực tế:** MongoDB + Mongoose + Express + React/Vite (+ Redis optional, Socket.IO).');
  md.push('**Lưu ý brief:** PostgreSQL/Prisma/Firebase trong yêu cầu là hướng đích / kênh — **không** phải runtime đã kiểm tra đầy đủ.');
  md.push('**Phạm vi:** Seed 3CN + roles + 30HV (≥2 khóa) + API smoke + concurrent JWT. **Không Pass toàn hệ thống** khi còn NOT RUN.');
  md.push('**Quy tắc:** Không sửa product code trong vòng QA này.');
  md.push('');
  md.push('## Seed summary');
  md.push('```json');
  md.push(JSON.stringify(seedSummary, null, 2));
  md.push('```');
  md.push('');
  md.push(`## Kết quả case: PASS ${pass} · FAIL ${fail} · WARN ${warn}`);
  md.push(`**Production readiness (ước lượng, conservative): ${readiness}%**`);
  md.push('');
  md.push('> Module chỉ được gắn **PASS** khi mọi case của module Pass **và** không còn gap nghiệp vụ bắt buộc. Các module còn FAIL/NOT RUN → **FAIL / PARTIAL**.');
  md.push('');
  md.push('## Theo module');
  // Module-level Pass chỉ khi không FAIL và đã có ≥3 case (tránh Pass giả từ 1 smoke).
  for (const [mod, data] of Object.entries(byModule)) {
    const full = data.fail === 0 && data.cases.length >= 3;
    const verdict = data.fail > 0 ? 'FAIL / PARTIAL' : (full ? 'PASS' : 'PARTIAL (smoke only)');
    md.push('');
    md.push(`# ${mod}`);
    md.push('');
    md.push(`**Verdict: ${verdict === 'PASS' ? '✅ Pass' : verdict.startsWith('PARTIAL') ? '⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)' : '❌ Fail / Partial'}**`);
    md.push(`- Pass: ${data.pass} · Fail: ${data.fail} · Warn: ${data.warn}`);
    for (const c of data.cases) {
      md.push(`- **[${c.result}]** \`${c.id}\` — ${c.name}${c.actual ? ` — \`${c.actual}\`` : ''}`);
      if (c.result === 'FAIL') {
        md.push(`  - Severity: ${c.severity || 'High'}`);
        md.push(`  - API: ${c.api || '-'}`);
        md.push(`  - Root cause: ${c.rootCause || '(xem bug list)'}`);
        md.push(`  - Fix: ${c.fixHint || '-'}`);
      }
    }
    md.push('');
    md.push('------------------------------------------------');
  }

  md.push('');
  md.push('## 1. Danh sách toàn bộ Bug');
  if (!bugs.length) md.push('_Không có FAIL._');
  for (const b of bugs) {
    md.push('');
    md.push(`### ${b.id} — ${b.title}`);
    md.push(`- **Severity:** ${b.severity} · **Priority:** ${b.priority}`);
    md.push(`- **Module:** ${b.module}`);
    md.push(`- **Expected / Actual:** ${b.expected} / ${b.actual}`);
    md.push(`- **Root cause:** ${b.rootCause || 'Chưa xác định sâu (cần debug khi vào fix)'}`);
    md.push(`- **Reproduce:** ${b.reproduce}`);
    md.push(`- **API / UI / DB:** ${b.api} / ${b.ui} / ${b.database}`);
    md.push(`- **Impact:** ${b.impact}`);
    md.push(`- **Cách sửa:** ${b.fixHint}`);
  }

  md.push('');
  md.push('## 2. Phân loại severity');
  md.push(`- Critical: ${critical}`);
  md.push(`- High: ${high}`);
  md.push(`- Medium: ${medium}`);
  md.push(`- Low: ${low}`);

  md.push('');
  md.push(`## 3. Production readiness: **${readiness}%**`);
  md.push('Không khuyến nghị Production cho đến khi Critical/High nghiệp vụ (refund, reassign E2E, Redis, UI/Socket) được đóng.');

  md.push('');
  md.push('## 4. Chức năng còn thiếu / chưa cover');
  missing.forEach((x) => md.push(`- ${x}`));

  md.push('');
  md.push('## 5. Rủi ro nếu Production ngay');
  risks.forEach((x) => md.push(`- ${x}`));

  md.push('');
  md.push('## 6. Thứ tự sửa ưu tiên');
  fixOrder.forEach((b, i) => md.push(`${i + 1}. [${b.severity}] ${b.id} — ${b.title}`));

  md.push('');
  md.push('## 7. Regression rule');
  md.push('Sau mỗi bugfix: chạy lại module liên quan + `node --test tests/integration/*Phase*.test.js` + `node scripts/qa_enterprise_seed_e2e.cjs`.');

  md.push('');
  md.push('## Credentials test (local only — đổi ngay nếu lộ)');
  md.push(`- Password chung: \`${PASSWORD}\``);
  md.push('- Super Admin phone: `0999000001`');
  md.push('- Admin CN1: `0981100001` · Staff CN1: `0982100001` · GV CN1-1: `097100001`');
  md.push('- HV CN1-01: `096110001` · email `qa.hv.cn1.01@test.local`');

  return {
    summary: { pass, fail, warn, readiness, critical, high, medium, low, seedSummary },
    byModule,
    bugs,
    missing,
    risks,
    fixOrder,
    md: md.join('\n'),
  };
}

async function main() {
  console.log(`\n=== QA ENTERPRISE SEED + E2E @ ${BASE} ===\n`);
  if (!process.env.JWT_SECRET) {
    console.error('Missing JWT_SECRET');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Mongo connected');
  await cleanupQa();
  console.log('Cleaned previous QA rows');
  const seedSummary = await seed();
  console.log('Seeded', seedSummary);

  await runApiSuite();

  const phaseGlob = path.join(__dirname, '..', 'tests', 'integration');
  const files = fs.readdirSync(phaseGlob).filter((f) => /Phase\d+\.test\.js$/.test(f));
  const ut = spawnSync(process.execPath, ['--test', ...files.map((f) => path.join(phaseGlob, f))], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 180000,
  });
  const out = `${ut.stdout || ''}\n${ut.stderr || ''}`;
  const utPass = out.match(/# pass (\d+)/)?.[1] || out.match(/ℹ pass (\d+)/)?.[1];
  const utFail = out.match(/# fail (\d+)/)?.[1] || out.match(/ℹ fail (\d+)/)?.[1];
  record({
    id: 'UNIT-01', module: 'Regression',
    name: 'Phase integration gates',
    expected: 'fail=0',
    actual: `pass=${utPass || '?'} fail=${utFail || '?'} exit=${ut.status}`,
    result: String(utFail || '1') === '0' && ut.status === 0 ? 'PASS' : 'FAIL',
    severity: 'High',
    api: 'node --test *Phase*.test.js',
    fixHint: 'Xem fail trong tests/integration',
    rootCause: String(utFail || '0') !== '0' ? 'Phase gate regression' : '',
  });

  const report = buildReport(seedSummary);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ ...report, results, generatedAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(REPORT_MD, report.md, 'utf8');
  console.log(`\nReport:\n- ${REPORT_MD}\n- ${REPORT_JSON}`);
  console.log(`Readiness: ${report.summary.readiness}% | PASS ${report.summary.pass} FAIL ${report.summary.fail}`);

  await mongoose.disconnect();
  process.exit(0); // luôn exit 0 để báo cáo được đọc; readiness trong file
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
