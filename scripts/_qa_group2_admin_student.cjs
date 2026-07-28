/**
 * QA Group 2 — Admin ↔ Student (API E2E local)
 * node scripts/_qa_group2_admin_student.cjs
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const fs = require('fs');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const results = [];

function record(tc) {
  results.push(tc);
  console.log(`[${tc.result}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
}

function req(method, path, { token, body, cookie, csrfToken } = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 20000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 200) }; }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    r.on('error', (err) => resolve({ status: 0, json: { message: err.message } }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: { message: 'timeout' } }); });
    if (data) r.write(data);
    r.end();
  });
}

async function csrf() {
  const res = await req('GET', '/api/auth/csrf-token');
  const token = res.json?.csrfToken || res.json?.data?.csrfToken;
  const setCookie = res.headers?.['set-cookie'] || [];
  // http module doesn't expose set-cookie easily on resolve — re-fetch via raw
  return new Promise((resolve) => {
    const url = new URL('/api/auth/csrf-token', BASE);
    http.get({ hostname: url.hostname, port: url.port, path: url.pathname }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(raw); } catch { /* */ }
        const cookies = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
        resolve({ token: json.csrfToken || json.data?.csrfToken, cookie: cookies });
      });
    }).on('error', () => resolve({ token: null, cookie: '' }));
  });
}

function mintAdmin() {
  return jwt.sign(
    { id: 'admin', role: 'admin', name: 'Super Admin', adminRole: 'SUPER_ADMIN', permissions: [], aud: 'internal' },
    process.env.JWT_SECRET,
    { expiresIn: '40m' },
  );
}

function printSummary() {
  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const skip = results.filter((r) => r.result === 'SKIP').length;
  const crit = results.filter((r) => r.result === 'FAIL' && r.severity === 'Critical');
  console.log('\n=== SUMMARY GROUP 2 ===');
  console.log(`PASS=${pass} FAIL=${fail} SKIP=${skip} TOTAL=${results.length}`);
  console.log(`Completion (excl SKIP)=${((pass / Math.max(1, pass + fail)) * 100).toFixed(1)}%`);
  if (crit.length) {
    console.log('\nCRITICAL FAILURES:');
    crit.forEach((f) => {
      console.log(`- ${f.id} ${f.name} | ${f.actual}`);
      if (f.fix) console.log(`  fix: ${f.fix}`);
    });
  }
  fs.writeFileSync('docs/QA_GROUP2_ADMIN_STUDENT.json', JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
  console.log('Wrote docs/QA_GROUP2_ADMIN_STUDENT.json');
}

async function main() {
  console.log(`\n=== QA GROUP 2 Admin↔Student @ ${BASE} ===\n`);

  const h = await req('GET', '/healthz');
  record({
    id: 'G2-00', name: 'API healthz', expected: '200', actual: `status=${h.status}`,
    result: h.status === 200 && h.json?.ok ? 'PASS' : 'FAIL', severity: 'Critical', api: 'GET /healthz',
  });
  if (h.status !== 200) { printSummary(); process.exit(1); }

  const { token: csrfToken, cookie } = await csrf();
  const mut = (method, path, opts = {}) => req(method, path, { ...opts, cookie, csrfToken });
  const adminToken = mintAdmin();

  const suffix = String(Date.now()).slice(-8);
  const zalo = `090${suffix}`;
  const phone = zalo;
  const password = zalo; // product default = zalo
  const name = `QA HV ${suffix.slice(-4)}`;
  let studentId = null;
  let studentAccess = null;
  let teacherId = null;
  let teacherPhone = null;
  let teacherPass = 'QaTeacher@12345';

  // Ensure an active teacher for assign tests
  {
    teacherPhone = `091${suffix}`;
    const t = await mut('POST', '/api/teachers', {
      token: adminToken,
      body: { name: `QA GV HV ${suffix.slice(-4)}`, phone: teacherPhone, password: teacherPass, specialty: 'Word', status: 'active' },
    });
    teacherId = t.json?.data?._id;
    if (t.status === 201 && teacherId) {
      await mut('PUT', `/api/teachers/${teacherId}`, { token: adminToken, body: { status: 'active' } });
    }
    record({
      id: 'G2-00b', name: 'Setup GV active để phân công',
      actual: `status=${t.status} tid=${teacherId || '-'}`,
      result: teacherId ? 'PASS' : 'FAIL', severity: 'High', api: 'POST /api/teachers',
    });
  }

  // Create student
  {
    const res = await mut('POST', '/api/students', {
      token: adminToken,
      body: {
        name,
        zalo,
        phone,
        course: 'Word',
        price: 1500000,
        totalSessions: 12,
        learningMode: 'OFFLINE',
        password,
        email: `qa.hv.${suffix}@example.invalid`,
      },
    });
    studentId = res.json?.data?._id || res.json?.data?.id;
    const code = res.json?.data?.studentCode;
    record({
      id: 'G2-01', name: 'Admin tạo học viên + tài khoản',
      roleAct: 'admin', roleRecv: 'student',
      expected: '201 + id + có password hashed (không trả plain)',
      actual: `status=${res.status} id=${studentId || '-'} pwdReturned=${res.json?.data?.password != null} msg=${res.json?.message || ''}`,
      result: res.status === 201 && studentId && res.json?.data?.password == null ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'POST /api/students', db: 'students',
    });
    record({
      id: 'G2-02', name: 'Sinh mã học viên (studentCode)',
      expected: 'studentCode không rỗng sau create',
      actual: `studentCode="${code || ''}"`,
      result: code && String(code).trim() ? 'PASS' : 'FAIL',
      severity: 'High', api: 'POST /api/students', file: 'models/Student.js + studentRoutes',
      fix: 'Auto-generate studentCode unique khi tạo HV (VD HV + yyMMdd + seq)',
    });
    if (!studentId) { printSummary(); process.exit(1); }
  }

  record({
    id: 'G2-03', name: 'Gửi Email khi tạo HV',
    expected: 'Enqueue email credential',
    actual: 'POST /students chỉ notifyAdmins + socket student:new — không email HV',
    result: 'FAIL', severity: 'High', file: 'routes/studentRoutes.js ~394-405',
    fix: 'Enqueue welcome email nếu có email',
  });
  record({
    id: 'G2-04', name: 'Gửi SMS khi tạo HV',
    expected: 'SMS nếu product hỗ trợ',
    actual: 'Không có SMS provider / enqueue SMS trong create student',
    result: 'FAIL', severity: 'Medium',
    fix: 'Bỏ qua nếu product không cam kết SMS; hoặc tích hợp Zalo OA template',
  });
  record({
    id: 'G2-05', name: 'Thông báo cho HV khi tạo tài khoản',
    expected: 'Notification tới HV',
    actual: 'Chỉ notifyAdmins — HV không nhận notification chào mừng',
    result: 'FAIL', severity: 'Medium', file: 'routes/studentRoutes.js',
  });

  // Login student
  {
    const res = await mut('POST', '/api/auth/login/public', {
      body: { identifier: zalo, password, role: 'student', force: true },
    });
    studentAccess = res.json?.data?.accessToken;
    record({
      id: 'G2-06', name: 'HV đăng nhập',
      expected: '200 + role student',
      actual: `status=${res.status} role=${res.json?.data?.user?.role} token=${studentAccess ? 'yes' : 'no'} msg=${res.json?.message || ''}`,
      result: res.status === 200 && studentAccess && res.json?.data?.user?.role === 'student' ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'POST /api/auth/login/public',
    });
    if (!studentAccess) { printSummary(); process.exit(1); }
  }

  // Course / fee / debt
  {
    const me = await req('GET', `/api/students/${studentId}`, { token: studentAccess });
    // may be forbidden for self via this route — try admin view + student view
    const adminView = await req('GET', `/api/students/${studentId}`, { token: adminToken });
    const d = adminView.json?.data || me.json?.data || {};
    record({
      id: 'G2-07', name: 'Đúng khóa học / học phí / công nợ ban đầu',
      expected: 'course=Word, price=1500000, paid=false',
      actual: `course=${d.course} price=${d.price} paid=${d.paid} status=${d.status}`,
      result: d.course === 'Word' && Number(d.price) === 1500000 && d.paid === false ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'GET /api/students/:id',
    });
    record({
      id: 'G2-08', name: 'HV GET profile của mình',
      expected: '200 (self) hoặc cơ chế /me',
      actual: `studentTokenStatus=${me.status} msg=${me.json?.message || ''}`,
      result: me.status === 200 || me.status === 403 ? (me.status === 200 ? 'PASS' : 'FAIL') : 'FAIL',
      severity: 'High', api: 'GET /api/students/:id',
      fix: me.status === 403 ? 'Cho phép student self-read hoặc thêm GET /api/students/me' : '',
      note: me.status === 403 ? 'Có thể IDOR-protect quá chặt với self' : '',
    });
  }

  // Schedules empty
  {
    const sch = await req('GET', `/api/schedules/student/${studentId}`, { token: studentAccess });
    record({
      id: 'G2-09', name: 'HV xem lịch (ban đầu rỗng)',
      expected: '200 array',
      actual: `status=${sch.status} n=${sch.json?.data?.length ?? '-'}`,
      result: sch.status === 200 ? 'PASS' : 'FAIL',
      severity: 'High', api: 'GET /api/schedules/student/:id',
    });
  }

  // LMS / training data
  {
    const tr = await req('GET', '/api/settings/student-training-data', { token: studentAccess });
    record({
      id: 'G2-10', name: 'HV đọc student training / LMS data',
      expected: '200',
      actual: `status=${tr.status}`,
      result: tr.status === 200 ? 'PASS' : 'FAIL',
      severity: 'High', api: 'GET /api/settings/student-training-data',
    });
  }

  // Assign teacher
  {
    if (!teacherId) {
      record({ id: 'G2-11', name: 'Admin gán GV', result: 'SKIP', actual: 'no teacher', severity: 'High' });
    } else {
      const res = await mut('PUT', `/api/students/${studentId}/assign-teacher`, {
        token: adminToken,
        body: { teacherId },
      });
      const view = await req('GET', `/api/students/${studentId}`, { token: adminToken });
      const d = view.json?.data || {};
      record({
        id: 'G2-11', name: 'Admin gán giảng viên',
        expected: '200 + teacherId khớp',
        actual: `status=${res.status} teacherId=${d.teacherId} msg=${res.json?.message || ''}`,
        result: res.status === 200 && String(d.teacherId) === String(teacherId) ? 'PASS' : 'FAIL',
        severity: 'Critical', api: 'PUT /api/students/:id/assign-teacher',
      });

      // Teacher sees student
      const tLogin = await mut('POST', '/api/auth/login/public', {
        body: { identifier: teacherPhone, password: teacherPass, role: 'teacher', force: true },
      });
      const tTok = tLogin.json?.data?.accessToken;
      const tStudents = tTok ? await req('GET', '/api/students?limit=50', { token: tTok }) : { status: 0, json: {} };
      const list = tStudents.json?.data || [];
      const found = list.some((s) => String(s._id || s.id) === String(studentId));
      record({
        id: 'G2-12', name: 'GV thấy HV sau phân công',
        expected: 'HV có trong list GV',
        actual: `tLogin=${tLogin.status} listStatus=${tStudents.status} found=${found} n=${list.length}`,
        result: tTok && tStudents.status === 200 && found ? 'PASS' : 'FAIL',
        severity: 'Critical', api: 'GET /api/students (teacher)',
      });
    }
  }

  // Admin update course/price → student sees
  {
    const upd = await mut('PUT', `/api/students/${studentId}`, {
      token: adminToken,
      body: { course: 'Excel', price: 1800000, address: 'QA Address HV' },
    });
    const view = await req('GET', `/api/students/${studentId}`, { token: adminToken });
    const d = view.json?.data || {};
    record({
      id: 'G2-13', name: 'Admin sửa khóa/học phí → DB cập nhật',
      expected: 'course=Excel price=1800000',
      actual: `put=${upd.status} course=${d.course} price=${d.price}`,
      result: upd.status === 200 && d.course === 'Excel' && Number(d.price) === 1800000 ? 'PASS' : 'FAIL',
      severity: 'High', api: 'PUT /api/students/:id',
    });
  }

  // Mark paid
  {
    const pay = await mut('PUT', `/api/students/${studentId}/pay`, {
      token: adminToken,
      body: { amount: 1800000, note: 'QA pay' },
    });
    const view = await req('GET', `/api/students/${studentId}`, { token: adminToken });
    const d = view.json?.data || {};
    record({
      id: 'G2-14', name: 'Admin đánh dấu đã thanh toán',
      expected: 'paid=true',
      actual: `status=${pay.status} paid=${d.paid} paidAmount=${d.paidAmount} msg=${pay.json?.message || ''}`,
      result: pay.status === 200 && d.paid === true ? 'PASS' : 'FAIL',
      severity: 'Critical', api: 'PUT /api/students/:id/pay',
    });
  }

  // Add enrollment second course
  {
    const enr = await mut('POST', `/api/students/${studentId}/enrollments`, {
      token: adminToken,
      body: { courseName: 'PowerPoint', teacherId, price: 500000, totalSessions: 8, paid: false },
    });
    record({
      id: 'G2-15', name: 'Admin thêm enrollment khóa 2',
      expected: '200/201',
      actual: `status=${enr.status} msg=${enr.json?.message || ''}`,
      result: enr.status === 200 || enr.status === 201 ? 'PASS' : 'FAIL',
      severity: 'High', api: 'POST /api/students/:id/enrollments',
    });
  }

  // Student cannot access admin finance
  {
    const tx = await req('GET', '/api/transactions', { token: studentAccess });
    const an = await req('GET', '/api/analytics/revenue?period=1m', { token: studentAccess });
    record({
      id: 'G2-16', name: 'HV không xem finance/analytics admin',
      expected: '403',
      actual: `tx=${tx.status} analytics=${an.status}`,
      result: tx.status === 403 && an.status === 403 ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  }

  // Student cannot create students
  {
    const st = await mut('POST', '/api/students', {
      token: studentAccess,
      body: { name: 'HACK', zalo: `088${suffix}`, course: 'Word', price: 1 },
    });
    record({
      id: 'G2-17', name: 'HV không tạo HV khác',
      expected: '403',
      actual: `status=${st.status}`,
      result: st.status === 403 || st.status === 401 ? 'PASS' : 'FAIL',
      severity: 'Critical',
    });
  }

  // "Lock" student — try suspended / Ngừng học
  {
    const lock1 = await mut('PUT', `/api/students/${studentId}`, {
      token: adminToken,
      body: { status: 'suspended' },
    });
    const withOld = await req('GET', `/api/students/${studentId}`, { token: studentAccess });
    // also try login
    const loginAfter = await mut('POST', '/api/auth/login/public', {
      body: { identifier: zalo, password, role: 'student', force: true },
    });
    record({
      id: 'G2-18', name: 'Admin khóa HV (status=suspended)',
      expected: 'PUT ok + JWT cũ bị chặn + login bị chặn',
      actual: `put=${lock1.status} oldToken=${withOld.status} login=${loginAfter.status} msg=${loginAfter.json?.message || ''}`,
      result:
        lock1.status === 200
        && (withOld.status === 401 || withOld.status === 403)
        && loginAfter.status === 403
          ? 'PASS'
          : 'FAIL',
      severity: 'Critical',
      api: 'PUT /api/students/:id + auth',
      file: 'middleware/auth.js + authRoutes login/public',
      fix: !((withOld.status === 401 || withOld.status === 403) && loginAfter.status === 403)
        ? 'Chuẩn hóa status khóa HV (suspended) trên login/public + authMiddleware; $inc tokenVersion khi khóa'
        : '',
    });
  }

  // Cleanup
  {
    const del = await mut('DELETE', `/api/students/${studentId}`, { token: adminToken });
    record({
      id: 'G2-19', name: 'Cleanup xóa HV QA',
      actual: `status=${del.status}`,
      result: del.status < 400 ? 'PASS' : 'FAIL',
      severity: 'Low',
    });
    if (teacherId) {
      await mut('DELETE', `/api/teachers/${teacherId}`, { token: adminToken });
    }
  }

  record({
    id: 'G2-20', name: 'Chứng chỉ / đổi lớp lịch / video UI',
    expected: 'Covered deeper in G3–G5',
    actual: 'SKIP — cần LMS content + schedule fixtures',
    result: 'SKIP', severity: 'Medium',
  });

  printSummary();
}

main().catch((e) => { console.error(e); process.exit(1); });
