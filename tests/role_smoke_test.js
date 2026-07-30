const fs = require('fs');
const path = require('path');
const { BASE_URL, API_BASE_URL, generateTestToken } = require('./config');
const idsPath = path.join(__dirname, 'test_account_ids.json');
if (!fs.existsSync(idsPath)) {
  console.error('Missing tests/test_account_ids.json. Run tests/seed_test_accounts.js first.');
  process.exit(1);
}
const ids = require('./test_account_ids.json');

const studentId = ids.students[0]._id;
const teacherId = ids.teachers[0]._id;
const staffId = ids.admins[0]._id;

const studentToken = generateTestToken({ id: studentId, role: 'student', name: 'STUDENT TEST' });
const teacherToken = generateTestToken({ id: teacherId, role: 'teacher', name: 'TEACHER TEST' });
const staffToken = generateTestToken({ id: staffId, role: 'admin', adminRole: 'STAFF', name: 'STAFF TEST', permissions: ['manage_students', 'manage_schedule', 'manage_finance'] });
const superToken = generateTestToken({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', name: 'SUPER ADMIN' }, 'internal');

const headers = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

let csrf = '';
let cookie = '';
async function ensureCsrf() {
  if (csrf) return;
  const res = await fetch(`${API_BASE_URL}/api/auth/csrf-token`, { credentials: 'include' });
  const setCookie = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.raw ? res.headers.raw()['set-cookie'] : []);
  cookie = Array.isArray(setCookie)
    ? setCookie.map((c) => c.split(';')[0]).join('; ')
    : String(setCookie || '');
  const json = await res.json();
  csrf = json.csrfToken || '';
}

async function api(path, token, method = 'GET', bodyData = null) {
  if (method !== 'GET' && method !== 'HEAD') {
    await ensureCsrf();
  }
  const opts = {
    method,
    headers: {
      ...headers(token),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  };
  if (bodyData != null) {
    opts.body = JSON.stringify(bodyData);
  }
  const res = await fetch(`${API_BASE_URL}${path}`, opts);
  const body = await res.text();
  let json;
  try { json = body ? JSON.parse(body) : null; } catch (err) { json = body; }
  return { status: res.status, body: json };
}

async function run() {
  console.log('API_BASE_URL=', API_BASE_URL);
  const checks = [
    { name: 'student can fetch own student profile', path: `/api/students/${studentId}`, token: studentToken, expected: 200 },
    { name: 'student can fetch own message contacts', path: '/api/messages/contacts', token: studentToken, expected: 200 },
    { name: 'teacher can fetch own teacher profile', path: `/api/teachers/${teacherId}`, token: teacherToken, expected: 200 },
    { name: 'teacher can fetch own student list', path: '/api/students', token: teacherToken, expected: 200 },
    { name: 'teacher can fetch own message contacts', path: '/api/messages/contacts', token: teacherToken, expected: 200 },
    { name: 'teacher can sync own messages', path: `/api/messages/sync/${teacherId}`, token: teacherToken, expected: 200 },
    { name: 'teacher can fetch own finance data', path: `/api/teachers/${teacherId}/finance`, token: teacherToken, expected: 200 },
    { name: 'admin can broadcast notification to teachers and students', path: '/api/notifications', method: 'POST', token: superToken, body: { title: 'TEST Thông báo', content: 'Kiểm tra chức năng notification', type: 'COURSE', receivers: ['ALL_TEACHER', 'ALL_STUDENT'] }, expected: 201 },
    { name: 'teacher can fetch notifications', path: '/api/notifications', token: teacherToken, expected: 200 },
    { name: 'teacher can fetch unread notification count', path: '/api/notifications/count', token: teacherToken, expected: 200 },
    { name: 'student can sync own messages', path: `/api/messages/sync/${studentId}`, token: studentToken, expected: 200 },
    { name: 'student can fetch own full detail', path: `/api/students/${studentId}/full-detail`, token: studentToken, expected: 200 },
    { name: 'student can fetch notifications', path: '/api/notifications', token: studentToken, expected: 200 },
    { name: 'student can fetch unread notification count', path: '/api/notifications/count', token: studentToken, expected: 200 },
    { name: 'staff can list staff accounts', path: '/api/staff', token: staffToken, expected: 200 },
    { name: 'staff can fetch message contacts', path: '/api/messages/contacts', token: staffToken, expected: 200 },
    { name: 'student cannot fetch staff list', path: '/api/staff', token: studentToken, expected: 403 },
    { name: 'teacher cannot fetch staff list', path: '/api/staff', token: teacherToken, expected: 403 },
    { name: 'super admin can fetch staff list', path: '/api/staff', token: superToken, expected: 200 },
  ];

  let failed = 0;
  for (const check of checks) {
    try {
      const res = await api(check.path, check.token, check.method || 'GET', check.body || null);
      const ok = res.status === check.expected;
      console.log(`${ok ? '✅' : '❌'} ${check.name}: ${res.status}${ok ? '' : ` (expected ${check.expected})`} ${typeof res.body === 'object' ? JSON.stringify(res.body).slice(0, 200) : res.body}`);
      if (!ok) failed += 1;
    } catch (err) {
      console.error(`❌ ${check.name}: error ${err.message}`);
      failed += 1;
    }
  }

  if (failed) {
    console.error(`\n${failed} smoke test(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll smoke tests passed.');
}

run().catch((err) => {
  console.error('Unexpected failure:', err);
  process.exit(1);
});
