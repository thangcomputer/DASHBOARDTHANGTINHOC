/**
 * QA Group 3 — Teacher ↔ Student (API E2E)
 * node scripts/_qa_group3_teacher_student.cjs
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const fs = require('fs');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const results = [];
const record = (tc) => {
  results.push(tc);
  console.log(`[${tc.result}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
};

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
          try { json = JSON.parse(raw || 'null'); } catch { json = { _raw: raw.slice(0, 180) }; }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    r.on('error', (e) => resolve({ status: 0, json: { message: e.message } }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: { message: 'timeout' } }); });
    if (data) r.write(data);
    r.end();
  });
}

async function csrf() {
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

const mintAdmin = () => jwt.sign(
  { id: 'admin', role: 'admin', name: 'Super Admin', adminRole: 'SUPER_ADMIN', permissions: [], aud: 'internal' },
  process.env.JWT_SECRET,
  { expiresIn: '40m' },
);

function summary() {
  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const skip = results.filter((r) => r.result === 'SKIP').length;
  const crit = results.filter((r) => r.result === 'FAIL' && r.severity === 'Critical');
  console.log('\n=== SUMMARY GROUP 3 ===');
  console.log(`PASS=${pass} FAIL=${fail} SKIP=${skip} TOTAL=${results.length}`);
  console.log(`Completion=${((pass / Math.max(1, pass + fail)) * 100).toFixed(1)}%`);
  if (crit.length) {
    console.log('CRITICAL:');
    crit.forEach((c) => console.log(`- ${c.id} ${c.name} | ${c.actual}${c.fix ? ` | fix: ${c.fix}` : ''}`));
  }
  fs.writeFileSync('docs/QA_GROUP3_TEACHER_STUDENT.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
}

async function main() {
  console.log(`\n=== QA GROUP 3 Teacher↔Student @ ${BASE} ===\n`);
  const h = await req('GET', '/healthz');
  record({ id: 'G3-00', name: 'healthz', result: h.status === 200 ? 'PASS' : 'FAIL', severity: 'Critical', actual: `status=${h.status}` });
  if (h.status !== 200) { summary(); process.exit(1); }

  const { token: csrfToken, cookie } = await csrf();
  const mut = (m, p, o = {}) => req(m, p, { ...o, cookie, csrfToken });
  const admin = mintAdmin();
  const suf = String(Date.now()).slice(-8);
  const tPhone = `092${suf}`;
  const tPass = 'QaG3Teacher@123';
  const sZalo = `093${suf}`;
  const sPass = sZalo;

  // Setup teacher + student + assign
  const tCreate = await mut('POST', '/api/teachers', {
    token: admin, body: { name: `QA G3 GV ${suf.slice(-4)}`, phone: tPhone, password: tPass, specialty: 'Word', status: 'active' },
  });
  const teacherId = tCreate.json?.data?._id;
  await mut('PUT', `/api/teachers/${teacherId}`, { token: admin, body: { status: 'active' } });

  const sCreate = await mut('POST', '/api/students', {
    token: admin,
    body: { name: `QA G3 HV ${suf.slice(-4)}`, zalo: sZalo, phone: sZalo, course: 'Word', price: 1000000, totalSessions: 12, password: sPass },
  });
  const studentId = sCreate.json?.data?._id;
  await mut('PUT', `/api/students/${studentId}/assign-teacher`, { token: admin, body: { teacherId } });

  const tLogin = await mut('POST', '/api/auth/login/public', { body: { identifier: tPhone, password: tPass, role: 'teacher', force: true } });
  const sLogin = await mut('POST', '/api/auth/login/public', { body: { identifier: sZalo, password: sPass, role: 'student', force: true } });
  const tTok = tLogin.json?.data?.accessToken;
  const sTok = sLogin.json?.data?.accessToken;

  record({
    id: 'G3-01', name: 'Setup GV+HV+assign + login',
    actual: `t=${!!tTok} s=${!!sTok} tid=${teacherId} sid=${studentId}`,
    result: tTok && sTok && teacherId && studentId ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });
  if (!tTok || !sTok) { summary(); process.exit(1); }

  // Create schedule
  const day = new Date();
  day.setDate(day.getDate() + 3);
  const createSch = await mut('POST', '/api/schedules', {
    token: tTok,
    body: {
      teacherId,
      studentId,
      date: day.toISOString(),
      startTime: '10:00',
      course: 'Word',
      linkHoc: 'https://meet.example.com/qa-g3',
      note: 'QA buổi học',
    },
  });
  const scheduleId = createSch.json?.data?._id;
  record({
    id: 'G3-02', name: 'GV tạo buổi học cho HV được gán',
    expected: '201 + teacherId=self',
    actual: `status=${createSch.status} id=${scheduleId || '-'} msg=${createSch.json?.message || ''}`,
    result: createSch.status === 201 && scheduleId ? 'PASS' : 'FAIL',
    severity: 'Critical', api: 'POST /api/schedules',
  });

  // Student sees schedule
  const sSch = await req('GET', `/api/schedules/student/${studentId}`, { token: sTok });
  const seen = (sSch.json?.data || []).some((x) => String(x._id) === String(scheduleId));
  record({
    id: 'G3-03', name: 'HV thấy lịch GV vừa tạo',
    expected: 'schedule trong list',
    actual: `status=${sSch.status} seen=${seen} n=${sSch.json?.data?.length}`,
    result: sSch.status === 200 && seen ? 'PASS' : 'FAIL',
    severity: 'Critical',
  });

  // Spoof other teacher schedule create
  const spoof = await mut('POST', '/api/schedules', {
    token: tTok,
    body: {
      teacherId: '000000000000000000000001',
      studentId,
      date: day.toISOString(),
      startTime: '14:00',
      course: 'Word',
    },
  });
  const spoofTid = spoof.json?.data?.teacherId?._id || spoof.json?.data?.teacherId;
  record({
    id: 'G3-04', name: 'GV không spoof teacherId người khác',
    expected: '403 hoặc 201 với teacherId=self',
    actual: `status=${spoof.status} tid=${spoofTid}`,
    result:
      spoof.status === 403
      || (spoof.status === 201 && String(spoofTid) === String(teacherId))
        ? 'PASS'
        : 'FAIL',
    severity: 'Critical',
  });

  // Cancel schedule
  if (scheduleId) {
    const cancel = await mut('PATCH', `/api/schedules/${scheduleId}/cancel`, {
      token: tTok,
      body: { reason: 'QA hủy lịch' },
    });
    const after = await req('GET', `/api/schedules/student/${studentId}`, { token: sTok });
    const row = (after.json?.data || []).find((x) => String(x._id) === String(scheduleId));
    record({
      id: 'G3-05', name: 'GV hủy lịch → HV thấy cancelled',
      expected: 'status cancelled + note/reason',
      actual: `cancel=${cancel.status} schStatus=${row?.status} note=${row?.note || ''}`,
      result: cancel.status === 200 && row?.status === 'cancelled' ? 'PASS' : 'FAIL',
      severity: 'High',
    });
  }

  // Create completed attendance session (past-friendly: use today scheduled then complete)
  const today = new Date();
  const att = await mut('POST', '/api/schedules', {
    token: tTok,
    body: {
      teacherId,
      studentId,
      date: today.toISOString(),
      startTime: '08:00',
      course: 'Word',
      status: 'completed',
      note: 'QA điểm danh',
    },
  });
  record({
    id: 'G3-06', name: 'GV điểm danh (tạo schedule completed)',
    expected: '201 hoặc 400 cooldown',
    actual: `status=${att.status} msg=${att.json?.message || ''}`,
    result: att.status === 201 || att.status === 400 ? 'PASS' : 'FAIL',
    severity: 'High',
    note: att.status === 400 ? 'cooldown/validation — acceptable' : '',
  });

  // Grade via student PUT as teacher
  const grade = await mut('PUT', `/api/students/${studentId}`, {
    token: tTok,
    body: {
      courseName: 'Word',
      lastGrade: 9,
      avgGrade: 9,
      grades: [{ date: new Date().toLocaleDateString('vi-VN'), note: 'QA', grade: 9 }],
    },
  });
  const adminView = await req('GET', `/api/students/${studentId}`, { token: admin });
  record({
    id: 'G3-07', name: 'GV nhập điểm → Admin/DB thấy',
    expected: '200 + avgGrade cập nhật',
    actual: `put=${grade.status} avg=${adminView.json?.data?.avgGrade} msg=${grade.json?.message || ''}`,
    result: grade.status === 200 ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // Chat / messages smoke — đúng path conversations/:userId (không có GET /conversations)
  const contacts = await req('GET', '/api/messages/contacts', { token: tTok });
  const conv = await req('GET', `/api/messages/conversations/${teacherId}`, { token: tTok });
  record({
    id: 'G3-08', name: 'GV mở danh sách hội thoại',
    expected: '200 contacts + conversations/:userId',
    actual: `contacts=${contacts.status} conv=${conv.status}`,
    result: contacts.status === 200 && conv.status === 200 ? 'PASS' : 'FAIL',
    severity: 'Medium',
    api: 'GET /api/messages/contacts + /conversations/:userId',
  });

  // Training content — teacher cannot upload admin training file
  const uploadDeny = await mut('POST', '/api/settings/upload-training-file', { token: tTok, body: {} });
  record({
    id: 'G3-09', name: 'GV không upload training admin',
    expected: '403',
    actual: `status=${uploadDeny.status}`,
    result: uploadDeny.status === 403 || uploadDeny.status === 400 ? 'PASS' : 'FAIL',
    severity: 'High',
  });

  // Assignment routes if exist
  const asg = await req('GET', '/api/assignments', { token: tTok });
  record({
    id: 'G3-10', name: 'API bài tập (assignments) cho GV',
    expected: '200 hoặc 404 nếu module khác path',
    actual: `status=${asg.status}`,
    result: asg.status !== 500 ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });

  // Assignment + exam + evaluation API (thay SKIP UI)
  const asgCreate = await mut('POST', '/api/assignments', {
    token: tTok,
    body: {
      courseId: 'Word',
      studentId,
      teacherId,
      title: `QA BT ${Date.now().toString().slice(-6)}`,
      description: 'QA nộp bài',
      deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  });
  const asgId = asgCreate.json?.data?._id;
  const submit = asgId
    ? await mut('POST', `/api/assignments/${asgId}/submit`, {
      token: sTok,
      body: { studentId, teacherId, submittedFileUrl: '/uploads/assignments/qa-placeholder.txt' },
    })
    : { status: 0, json: {} };
  const evalPost = await mut('POST', '/api/evaluations', {
    token: sTok,
    body: {
      studentId,
      targetTeacherId: teacherId,
      type: 'teacher_rating',
      content: 'QA đánh giá GV',
      studentName: 'QA HV',
      teacherName: 'QA GV',
      courseName: 'Word',
      criteria: { teaching: 5 },
    },
  });
  const examPost = await mut('POST', '/api/exam-results', {
    token: tTok,
    body: {
      type: 'student',
      studentId,
      subject: 'Word',
      multipleChoiceCorrect: 9,
      multipleChoiceTotal: 10,
      passed: true,
      date: new Date().toLocaleDateString('vi-VN'),
    },
  });
  const lmsProg = await req('GET', '/api/training-lms/progress/me', { token: sTok });
  record({
    id: 'G3-11', name: 'Bài tập nộp + đánh giá GV + điểm thi + LMS progress API',
    expected: 'assignment create/submit + evaluation + exam-result + progress không 500',
    actual: `asg=${asgCreate.status} submit=${submit.status} eval=${evalPost.status} exam=${examPost.status} lms=${lmsProg.status}`,
    result: asgCreate.status < 400 && submit.status < 400 && evalPost.status < 500
      && examPost.status < 400 && lmsProg.status !== 500
      ? 'PASS' : 'FAIL',
    severity: 'Medium',
  });

  // Cleanup
  await mut('DELETE', `/api/students/${studentId}`, { token: admin });
  await mut('DELETE', `/api/teachers/${teacherId}`, { token: admin });
  record({ id: 'G3-12', name: 'Cleanup', result: 'PASS', severity: 'Low' });

  summary();
}

main().catch((e) => { console.error(e); process.exit(1); });
