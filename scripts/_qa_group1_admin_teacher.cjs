/**
 * QA Group 1 — Admin ↔ Teacher (API E2E against local)
 * Usage: node scripts/_qa_group1_admin_teacher.cjs
 * Does not print secrets. Creates a throwaway teacher and cleans up when possible.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const results = [];

function record(tc) {
  results.push(tc);
  const icon = tc.result === 'PASS' ? 'PASS' : tc.result === 'FAIL' ? 'FAIL' : tc.result;
  console.log(`[${icon}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
}

function req(method, path, { token, body, cookie, csrfToken } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 15000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 200) }; }
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      },
    );
    r.on('error', (err) => resolve({ status: 0, json: { message: err.message }, error: err }));
    r.on('timeout', () => {
      r.destroy();
      resolve({ status: 0, json: { message: 'timeout' } });
    });
    if (data) r.write(data);
    r.end();
  });
}

async function csrf() {
  const res = await req('GET', '/api/auth/csrf-token');
  const token = res.json?.csrfToken || res.json?.data?.csrfToken;
  const setCookie = res.headers['set-cookie'] || [];
  return { token, cookie: setCookie.map((c) => c.split(';')[0]).join('; ') };
}

function mintAdminToken() {
  return jwt.sign(
    {
      id: 'admin',
      role: 'admin',
      name: 'Super Admin',
      adminRole: 'SUPER_ADMIN',
      permissions: [],
      aud: 'internal',
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' },
  );
}

async function main() {
  console.log(`\n=== QA GROUP 1 Admin↔Teacher @ ${BASE} ===\n`);

  // Health
  try {
    const h = await req('GET', '/healthz');
    record({
      id: 'G1-00',
      name: 'API healthz',
      roleAct: 'system',
      roleRecv: '-',
      expected: '200 healthy',
      actual: `status=${h.status} ok=${h.json?.ok}`,
      result: h.status === 200 && h.json?.ok ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'GET /healthz',
    });
    if (h.status !== 200) process.exit(1);
  } catch (e) {
    record({ id: 'G1-00', name: 'API healthz', result: 'FAIL', severity: 'Critical', actual: e.message });
    process.exit(1);
  }

  const { token: csrfToken, cookie } = await csrf();
  if (!csrfToken) {
    record({ id: 'G1-00b', name: 'CSRF token', result: 'FAIL', severity: 'Critical', actual: 'missing csrf' });
    process.exit(1);
  }

  const mut = (method, path, opts = {}) => req(method, path, { ...opts, cookie, csrfToken });

  const adminToken = mintAdminToken();
  const phone = `09${String(Date.now()).slice(-8)}`;
  const password = 'QaTest@12345';
  const name = `QA GV ${phone.slice(-4)}`;
  let teacherId = null;
  let teacherAccess = null;

  // --- Create teacher ---
  let createWelcome = { queued: false, notified: false };
  {
    const res = await mut('POST', '/api/teachers', {
      token: adminToken,
      body: {
        name,
        phone,
        password,
        specialty: 'Word',
        status: 'inactive',
        email: `qa.${phone}@example.invalid`,
      },
    });
    teacherId = res.json?.data?._id || res.json?.data?.id;
    createWelcome = {
      queued: !!res.json?.data?.welcomeQueued,
      notified: !!res.json?.data?.welcomeNotified,
    };
    record({
      id: 'G1-01',
      name: 'Admin tạo giảng viên',
      roleAct: 'admin',
      roleRecv: 'teacher',
      expected: '201 + teacher id, không trả password',
      actual: `status=${res.status} id=${teacherId || '-'} hasPwd=${res.json?.data?.password != null} msg=${res.json?.message || ''}`,
      result: res.status === 201 && teacherId && res.json?.data?.password == null ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'POST /api/teachers',
      db: 'teachers',
      fix: res.status !== 201 ? (res.json?.message || JSON.stringify(res.json).slice(0, 120)) : '',
    });
    if (!teacherId) {
      printSummary();
      process.exit(1);
    }
  }

  // --- Email / notification on create ---
  record({
    id: 'G1-02',
    name: 'Gửi email khi tạo GV',
    roleAct: 'admin',
    roleRecv: 'teacher',
    expected: 'Enqueue welcome (email/Zalo) khi có email/phone',
    actual: `welcomeQueued=${createWelcome.queued}`,
    result: createWelcome.queued ? 'PASS' : 'FAIL',
    severity: 'High',
    api: 'POST /api/teachers',
    file: 'services/accountWelcome.js + queue welcome',
    fix: createWelcome.queued ? '' : 'enqueueWelcome sau Teacher.create',
  });
  record({
    id: 'G1-03',
    name: 'Thông báo in-app khi tạo GV',
    roleAct: 'admin',
    roleRecv: 'teacher',
    expected: 'Teacher nhận notification tài khoản mới',
    actual: `welcomeNotified=${createWelcome.notified}`,
    result: createWelcome.notified ? 'PASS' : 'FAIL',
    severity: 'Medium',
    api: 'POST /api/teachers',
    file: 'services/accountWelcome.js',
    fix: createWelcome.notified ? '' : 'NotificationService.send tới teacherId',
  });

  // --- Login while inactive ---
  {
    const res = await mut('POST', '/api/auth/login/public', {
      body: { identifier: phone, password, role: 'teacher', force: true },
    });
    record({
      id: 'G1-04',
      name: 'GV đăng nhập khi status=inactive',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '403 isBan / chưa cấp quyền (đúng thiết kế mặc định inactive)',
      actual: `status=${res.status} msg=${res.json?.message || ''}`,
      result: res.status === 403 ? 'PASS' : 'FAIL',
      severity: 'High',
      api: 'POST /api/auth/login/public',
      note: 'Default create status=inactive — Admin phải kích hoạt trước',
    });
  }

  // --- Activate teacher ---
  {
    const res = await mut('PUT', `/api/teachers/${teacherId}`, {
      token: adminToken,
      body: { status: 'active' },
    });
    record({
      id: 'G1-05',
      name: 'Admin kích hoạt GV (status=active)',
      roleAct: 'admin',
      roleRecv: 'teacher',
      expected: '200 + status active',
      actual: `status=${res.status} teacherStatus=${res.json?.data?.status}`,
      result: res.status === 200 && String(res.json?.data?.status).toLowerCase() === 'active' ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: `PUT /api/teachers/${teacherId}`,
    });
  }

  // --- Login after activate ---
  {
    const res = await mut('POST', '/api/auth/login/public', {
      body: { identifier: phone, password, role: 'teacher', force: true },
    });
    teacherAccess = res.json?.data?.accessToken;
    teacherRefresh = res.json?.data?.refreshToken;
    record({
      id: 'G1-06',
      name: 'GV đăng nhập sau khi active',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '200 + accessToken + role teacher',
      actual: `status=${res.status} role=${res.json?.data?.user?.role} token=${teacherAccess ? 'yes' : 'no'}`,
      result: res.status === 200 && teacherAccess && res.json?.data?.user?.role === 'teacher' ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'POST /api/auth/login/public',
    });
    if (!teacherAccess) {
      printSummary();
      process.exit(1);
    }
  }

  // --- Permissions / menu-ish endpoints ---
  {
    const me = await req('GET', `/api/teachers/${teacherId}`, { token: teacherAccess });
    record({
      id: 'G1-07',
      name: 'GV xem profile / dashboard data của mình',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '200 profile đúng id',
      actual: `status=${me.status} id=${me.json?.data?._id}`,
      result: me.status === 200 && String(me.json?.data?._id) === String(teacherId) ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: `GET /api/teachers/:id`,
    });
  }
  {
    const list = await req('GET', '/api/teachers', { token: teacherAccess });
    record({
      id: 'G1-08',
      name: 'GV không được list toàn bộ giảng viên',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '403',
      actual: `status=${list.status}`,
      result: list.status === 403 ? 'PASS' : 'FAIL',
      severity: 'High',
      api: 'GET /api/teachers',
    });
  }
  {
    const students = await req('GET', '/api/students?limit=10', { token: teacherAccess });
    record({
      id: 'G1-09',
      name: 'GV xem học viên (API list có auth)',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '200 (có thể rỗng nếu chưa phân công)',
      actual: `status=${students.status} count=${students.json?.count ?? students.json?.data?.length ?? '-'}`,
      result: students.status === 200 ? 'PASS' : 'FAIL',
      severity: 'High',
      api: 'GET /api/students',
    });
  }
  {
    const schedules = await req('GET', '/api/schedules?limit=20', { token: teacherAccess });
    const scoped = Array.isArray(schedules.json?.data)
      && schedules.json.data.every((s) => String(s.teacherId?._id || s.teacherId) === String(teacherId) || schedules.json.data.length === 0);
    record({
      id: 'G1-10',
      name: 'GV xem lịch — chỉ lịch của mình (IDOR fix)',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '200 + mọi item teacherId = self',
      actual: `status=${schedules.status} n=${schedules.json?.data?.length ?? 0} scoped=${scoped}`,
      result: schedules.status === 200 && scoped ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'GET /api/schedules',
    });
  }
  {
    const finance = await req('GET', '/api/transactions', { token: teacherAccess });
    record({
      id: 'G1-11',
      name: 'GV không dump được toàn bộ transactions',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '403 (isAdmin gate)',
      actual: `status=${finance.status}`,
      result: finance.status === 403 ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'GET /api/transactions',
    });
  }
  {
    const analytics = await req('GET', '/api/analytics/revenue?period=1m', { token: teacherAccess });
    record({
      id: 'G1-12',
      name: 'GV không xem analytics doanh thu',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '403 (không crash server)',
      actual: `status=${analytics.status} msg=${analytics.json?.message || ''}`,
      result: analytics.status === 403 ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'GET /api/analytics/revenue',
      fix: analytics.status === 0 ? 'Server ECONNRESET — kiểm tra unhandled error analyticsRoutes' : '',
    });
    // ensure server still alive
    const h2 = await req('GET', '/healthz');
    if (h2.status !== 200) {
      record({
        id: 'G1-12b',
        name: 'Server còn sống sau analytics call',
        result: 'FAIL',
        severity: 'Critical',
        actual: `health=${h2.status}`,
        fix: 'Restart local server rồi chạy lại QA',
      });
      printSummary();
      process.exit(1);
    }
  }

  // --- Self edit allowed / forbidden fields ---
  {
    const ok = await mut('PUT', `/api/teachers/${teacherId}`, {
      token: teacherAccess,
      body: { bio: 'QA bio updated', zalo: phone },
    });
    record({
      id: 'G1-13',
      name: 'GV tự sửa bio/zalo',
      roleAct: 'teacher',
      roleRecv: 'admin',
      expected: '200 bio cập nhật',
      actual: `status=${ok.status} bio=${ok.json?.data?.bio}`,
      result: ok.status === 200 && ok.json?.data?.bio === 'QA bio updated' ? 'PASS' : 'FAIL',
      severity: 'High',
      api: `PUT /api/teachers/:id`,
    });
  }
  {
    const bad = await mut('PUT', `/api/teachers/${teacherId}`, {
      token: teacherAccess,
      body: { testScore: 100, status: 'active', testStatus: 'passed' },
    });
    const still = await req('GET', `/api/teachers/${teacherId}`, { token: adminToken });
    const scoreNotSet = still.json?.data?.testScore !== 100 && still.json?.data?.testStatus !== 'passed';
    record({
      id: 'G1-14',
      name: 'GV không tự ghi điểm thi / privilege escalate',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: 'Không lưu testScore/testStatus từ self-edit',
      actual: `put=${bad.status} score=${still.json?.data?.testScore} testStatus=${still.json?.data?.testStatus}`,
      result: scoreNotSet ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: `PUT /api/teachers/:id`,
    });
  }

  // --- Admin sees teacher change ---
  {
    const adminView = await req('GET', `/api/teachers/${teacherId}`, { token: adminToken });
    record({
      id: 'G1-15',
      name: 'Admin thấy thay đổi bio của GV',
      roleAct: 'admin',
      roleRecv: '-',
      expected: 'bio = QA bio updated',
      actual: `bio=${adminView.json?.data?.bio}`,
      result: adminView.json?.data?.bio === 'QA bio updated' ? 'PASS' : 'FAIL',
      severity: 'High',
      api: `GET /api/teachers/:id`,
    });
  }

  // --- Admin edit specialty → teacher sees ---
  {
    await mut('PUT', `/api/teachers/${teacherId}`, {
      token: adminToken,
      body: { specialty: 'Excel QA', address: 'QA Address 1' },
    });
    const teacherView = await req('GET', `/api/teachers/${teacherId}`, { token: teacherAccess });
    record({
      id: 'G1-16',
      name: 'Admin sửa → GV đọc lại thấy cập nhật (API sync)',
      roleAct: 'admin',
      roleRecv: 'teacher',
      expected: 'specialty/address mới trên GET của GV',
      actual: `specialty=${teacherView.json?.data?.specialty} address=${teacherView.json?.data?.address}`,
      result:
        teacherView.json?.data?.specialty === 'Excel QA'
        && teacherView.json?.data?.address === 'QA Address 1'
          ? 'PASS'
          : 'FAIL',
      severity: 'High',
      api: 'PUT+GET /api/teachers/:id',
      note: 'Realtime socket data:refresh không verify trong script này (cần client)',
    });
  }

  // --- Training / LMS read for teacher ---
  {
    const training = await req('GET', '/api/settings/training-data', { token: teacherAccess });
    // endpoint may differ — try common paths
    const alt = training.status === 404
      ? await req('GET', '/api/settings', { token: teacherAccess })
      : training;
    record({
      id: 'G1-17',
      name: 'GV truy cập dữ liệu đào tạo/settings',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '200 hoặc 403 có kiểm soát (không 500)',
      actual: `status=${alt.status}`,
      result: alt.status !== 500 ? 'PASS' : 'FAIL',
      severity: 'Medium',
      api: 'GET /api/settings*',
    });
  }

  // --- Create schedule without assigned student should fail ---
  {
    // pick any student id as admin
    const studs = await req('GET', '/api/students?limit=1', { token: adminToken });
    const sid = studs.json?.data?.[0]?._id || studs.json?.data?.[0]?.id;
    if (!sid) {
      record({
        id: 'G1-18',
        name: 'GV tạo lịch cho HV không được gán',
        roleAct: 'teacher',
        roleRecv: 'student',
        expected: '403',
        actual: 'SKIP — không có học viên trong DB local để test',
        result: 'SKIP',
        severity: 'High',
        api: 'POST /api/schedules',
      });
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString();
      const res = await mut('POST', '/api/schedules', {
        token: teacherAccess,
        body: {
          teacherId: '000000000000000000000099', // try spoof — server should force self
          studentId: sid,
          date: dateStr,
          startTime: '09:00',
          course: 'Word',
        },
      });
      record({
        id: 'G1-18',
        name: 'GV tạo lịch — không spoof teacherId khác + chỉ HV được gán',
        roleAct: 'teacher',
        roleRecv: 'student',
        expected: '403 nếu HV chưa gán; nếu gán thì 201 với teacherId=self',
        actual: `status=${res.status} msg=${res.json?.message || ''} tid=${res.json?.data?.teacherId}`,
        result:
          res.status === 403
          || (res.status === 201 && String(res.json?.data?.teacherId?._id || res.json?.data?.teacherId) === String(teacherId))
            ? 'PASS'
            : 'FAIL',
        severity: 'Critical',
        api: 'POST /api/schedules',
      });
    }
  }

  // --- Lock / suspend teacher ---
  {
    const lock = await mut('PUT', `/api/teachers/${teacherId}`, {
      token: adminToken,
      body: { status: 'suspended' },
    });
    record({
      id: 'G1-19',
      name: 'Admin khóa GV (suspended)',
      roleAct: 'admin',
      roleRecv: 'teacher',
      expected: '200 status suspended',
      actual: `status=${lock.status} t=${lock.json?.data?.status}`,
      result: lock.status === 200 && String(lock.json?.data?.status).toLowerCase() === 'suspended' ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: `PUT /api/teachers/:id`,
    });
  }

  // Old token still works? (session invalidation gap)
  {
    const withOld = await req('GET', `/api/teachers/${teacherId}`, { token: teacherAccess });
    record({
      id: 'G1-20',
      name: 'Sau khi khóa — JWT cũ còn gọi API được không',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '401/403 (nên revoke / check status trên mọi request)',
      actual: `status=${withOld.status}`,
      result: withOld.status === 401 || withOld.status === 403 ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'GET /api/teachers/:id với token cũ',
      file: 'middleware/auth.js + teacherRoutes',
      fix: 'authMiddleware hoặc route GET: nếu teacher.status suspended/inactive → 403; tăng tokenVersion khi khóa',
    });
  }

  // Login after suspend
  {
    const res = await mut('POST', '/api/auth/login/public', {
      body: { identifier: phone, password, role: 'teacher', force: true },
    });
    record({
      id: 'G1-21',
      name: 'GV đăng nhập lại sau suspended',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '403',
      actual: `status=${res.status} msg=${res.json?.message || ''}`,
      result: res.status === 403 ? 'PASS' : 'FAIL',
      severity: 'Critical',
      api: 'POST /api/auth/login/public',
    });
  }

  // Direct URL / privileged APIs with old token after lock
  {
    const tx = await req('GET', '/api/transactions', { token: teacherAccess });
    const st = await mut('POST', '/api/students', {
      token: teacherAccess,
      body: { name: 'HACK', phone: `088${Date.now().toString().slice(-7)}` },
    });
    record({
      id: 'G1-22',
      name: 'Token cũ không leo quyền admin sau khi khóa',
      roleAct: 'teacher',
      roleRecv: '-',
      expected: '401/403 trên transactions + create student',
      actual: `tx=${tx.status} createStudent=${st.status}`,
      result:
        [401, 403].includes(tx.status) && [401, 403].includes(st.status)
          ? 'PASS'
          : 'FAIL',
      severity: 'Critical',
      api: 'GET /transactions, POST /students',
    });
  }

  // Cleanup: delete teacher if admin can
  {
    const del = await mut('DELETE', `/api/teachers/${teacherId}`, { token: adminToken });
    record({
      id: 'G1-23',
      name: 'Cleanup xóa GV QA',
      roleAct: 'admin',
      roleRecv: '-',
      expected: '200 hoặc 204',
      actual: `status=${del.status} msg=${del.json?.message || ''}`,
      result: del.status < 400 ? 'PASS' : 'FAIL',
      severity: 'Low',
      api: `DELETE /api/teachers/:id`,
    });
  }

  // Features not in product API for this group
  record({
    id: 'G1-24',
    name: 'Upload tài liệu / tạo bài kiểm tra / điểm danh (API smoke)',
    roleAct: 'teacher',
    roleRecv: 'student',
    expected: 'Có endpoint tương ứng trong phạm vi product',
    actual: 'SKIP trong vòng này — cần HV+enrollment+UI; sẽ test sâu ở Nhóm 3/5 sau khi G1 đóng Critical',
    result: 'SKIP',
    severity: 'Medium',
  });

  printSummary();
}

function printSummary() {
  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const skip = results.filter((r) => r.result === 'SKIP').length;
  const critFails = results.filter((r) => r.result === 'FAIL' && r.severity === 'Critical');
  console.log('\n=== SUMMARY GROUP 1 ===');
  console.log(`PASS=${pass} FAIL=${fail} SKIP=${skip} TOTAL=${results.length}`);
  console.log(`Completion (excl SKIP)=${((pass / Math.max(1, pass + fail)) * 100).toFixed(1)}%`);
  if (critFails.length) {
    console.log('\nCRITICAL FAILURES — stop before Group 2:');
    critFails.forEach((f) => {
      console.log(`- ${f.id} ${f.name}`);
      console.log(`  actual: ${f.actual}`);
      if (f.fix) console.log(`  fix: ${f.fix}`);
      if (f.file) console.log(`  file: ${f.file}`);
    });
  }
  // machine readable
  const fs = require('fs');
  const out = 'docs/QA_GROUP1_ADMIN_TEACHER.json';
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
  console.log(`\nWrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
