/**
 * Live deep QA — concurrent logins + role API flows + assignment/chat.
 * Usage: node scripts/_qa_live_deep.cjs
 * Env: QA_API_BASE (default http://127.0.0.1:5000), QA_FE_BASE optional
 * Staff/internal login needs server CAPTCHA_BYPASS=1 + NODE_ENV=test for full pass.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { getMessagingRole } = require('../utils/messagingRoles');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const OUT = path.join(__dirname, '..', 'docs', 'QA_LIVE_DEEP_RESULT.json');
const PASSWORD = 'Test@123';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'admin123';

const accountsPath = path.join(__dirname, '..', 'tests', 'test_account_ids.json');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function req(method, p, { body, token, cookie, csrf, timeout = 25000 } = {}) {
  return new Promise((resolve) => {
    const url = new URL(p, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (csrf && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = csrf;
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
        timeout,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 300) }; }
          resolve({
            status: res.statusCode,
            json,
            ms: Date.now() - started,
            cookie: (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; '),
          });
        });
      },
    );
    r.on('error', (err) => resolve({ status: 0, json: { message: err.message }, ms: Date.now() - started }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: { message: 'timeout' }, ms: Date.now() - started }); });
    if (data) r.write(data);
    r.end();
  });
}

async function getCsrf() {
  const res = await req('GET', '/api/auth/csrf-token');
  return {
    token: res.json?.csrfToken || res.json?.data?.csrfToken || '',
    cookie: res.cookie || '',
  };
}

async function getCaptcha(cookie) {
  const res = await req('GET', '/api/auth/captcha', { cookie });
  return {
    cid: res.json?.cid,
    answer: res.json?.answer || null,
    cookie: [cookie, res.cookie].filter(Boolean).join('; '),
  };
}

async function loginPublic(identifier, role, force = true) {
  const csrf = await getCsrf();
  const r = await req('POST', '/api/auth/login/public', {
    cookie: csrf.cookie,
    csrf: csrf.token,
    body: { identifier, password: PASSWORD, role, force, deviceFingerprint: `qa-${role}-${identifier}` },
  });
  const w = r.json?.data || {};
  const u = w.user ? { ...w.user, ...w } : w;
  const accessToken = w.accessToken || u.accessToken;
  const id = String(u.id || u._id || '');
  return {
    ok: r.status === 200 && r.json?.success && !!accessToken,
    status: r.status,
    ms: r.ms,
    accessToken,
    id,
    role: u.role || role,
    adminRole: u.adminRole,
    name: u.name,
    messagingRole: getMessagingRole({ id, role: u.role || role, adminRole: u.adminRole }),
    msg: r.json?.message,
  };
}

async function loginInternal(identifier, password = PASSWORD) {
  const csrf = await getCsrf();
  const cap = await getCaptcha(csrf.cookie);
  const r = await req('POST', '/api/auth/login/internal', {
    cookie: cap.cookie || csrf.cookie,
    csrf: csrf.token,
    body: {
      identifier,
      password,
      captchaId: cap.cid || 'qa',
      captchaAnswer: cap.answer || 'qa',
      force: true,
      deviceFingerprint: `qa-staff-${identifier}`,
    },
  });
  const w = r.json?.data || {};
  const u = w.user ? { ...w.user, ...w } : w;
  const accessToken = w.accessToken || u.accessToken;
  const id = identifier === 'admin' ? 'admin' : String(u.id || u._id || '');
  const adminRole = identifier === 'admin' ? 'SUPER_ADMIN' : u.adminRole;
  return {
    ok: r.status === 200 && r.json?.success && !!accessToken,
    status: r.status,
    ms: r.ms,
    accessToken,
    id,
    role: u.role || 'admin',
    adminRole,
    name: u.name || (identifier === 'admin' ? 'Super Admin' : u.name),
    messagingRole: getMessagingRole({ id, role: u.role, adminRole }),
    msg: r.json?.message,
    captchaBypass: !!cap.answer,
    mfaRequired: !!(r.json?.mfaRequired || w.mfaRequired),
  };
}

async function loginSuperAdmin() {
  const r = await loginInternal('admin', ADMIN_PASSWORD);
  return { ...r, kind: 'super_admin', ok: r.ok && !r.mfaRequired };
}

function check(name, pass, detail = {}) {
  return { name, pass, ...detail };
}

async function hitApis(session, checks) {
  const h = { token: session.accessToken };
  const role = session.role;
  const adminRole = session.adminRole;

  if (session.id === 'admin' || adminRole === 'SUPER_ADMIN') {
    const stats = await req('GET', '/api/students/stats', h);
    checks.push(check('admin GET /students/stats', stats.status === 200 && stats.json?.success !== false, { status: stats.status, ms: stats.ms }));
    const feed = await req('GET', '/api/feed?page=1&limit=5', h);
    checks.push(check('admin GET /feed', feed.status === 200, { status: feed.status, ms: feed.ms }));
    const inbox = await req('GET', '/api/messages/contacts', h);
    checks.push(check('admin GET /messages/contacts', inbox.status === 200, { status: inbox.status, ms: inbox.ms }));
  } else if (adminRole === 'STAFF' || role === 'admin') {
    const students = await req('GET', '/api/students?limit=5', h);
    checks.push(check('staff GET /students', students.status === 200, { status: students.status, ms: students.ms }));
    const feed = await req('GET', '/api/feed?page=1&limit=5', h);
    checks.push(check('staff GET /feed', feed.status === 200, { status: feed.status, ms: feed.ms }));
    const inbox = await req('GET', '/api/messages/contacts', h);
    checks.push(check('staff GET /messages/contacts', inbox.status === 200, { status: inbox.status, ms: inbox.ms }));
  } else if (role === 'teacher') {
    const students = await req('GET', '/api/students?limit=5', h);
    checks.push(check('teacher GET /students', students.status === 200, { status: students.status, ms: students.ms }));
    const feed = await req('GET', '/api/feed?page=1&limit=5', h);
    checks.push(check('teacher GET /feed', feed.status === 200, { status: feed.status, ms: feed.ms }));
    const inbox = await req('GET', '/api/messages/contacts', h);
    checks.push(check('teacher GET /messages/contacts', inbox.status === 200, { status: inbox.status, ms: inbox.ms }));
    const asg = await req('GET', '/api/assignments/course/Word', h);
    checks.push(check('teacher GET /assignments/course/Word', asg.status !== 500, { status: asg.status, ms: asg.ms }));
  } else if (role === 'student') {
    const feed = await req('GET', '/api/feed?page=1&limit=5', h);
    checks.push(check('student GET /feed', feed.status === 200, { status: feed.status, ms: feed.ms }));
    const inbox = await req('GET', '/api/messages/contacts', h);
    checks.push(check('student GET /messages/contacts', inbox.status === 200, { status: inbox.status, ms: inbox.ms }));
    const prog = await req('GET', '/api/training-lms/progress/me', h);
    checks.push(check('student GET /training-lms/progress/me', prog.status !== 500, { status: prog.status, ms: prog.ms }));
    const me = await req('GET', `/api/students/${session.id}`, h);
    const hasExam = Array.isArray(me.json?.data?.examProgress);
    checks.push(check('student GET /students/:id (examProgress)', me.status === 200 && hasExam, { status: me.status, ms: me.ms }));
    const asg = await req('GET', `/api/assignments/student/${session.id}/course/Word`, h);
    checks.push(check('student GET assignments by course', asg.status !== 500, { status: asg.status, ms: asg.ms }));
  }
}

async function sendMessage(sender, receiver, content) {
  const csrf = await getCsrf();
  const r = await req('POST', '/api/messages', {
    token: sender.accessToken,
    cookie: csrf.cookie,
    csrf: csrf.token,
    body: {
      receiverId: receiver.id,
      receiverName: receiver.name || receiver.id,
      receiverRole: receiver.messagingRole,
      content,
      isGroup: false,
      messageType: 'text',
    },
  });
  return { ok: r.status >= 200 && r.status < 300 && r.json?.success !== false, status: r.status, msg: r.json?.message };
}

async function assignmentFlow(teacher, student, flowChecks) {
  const csrf = await getCsrf();
  const mut = (method, p, body) => req(method, p, {
    token: teacher.accessToken,
    cookie: csrf.cookie,
    csrf: csrf.token,
    body,
  });

  const create = await mut('POST', '/api/assignments', {
    courseId: 'Word',
    studentId: student.id,
    teacherId: teacher.id,
    title: `QA LIVE ${Date.now().toString().slice(-6)}`,
    description: 'QA live deep',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  flowChecks.push(check('assignment create', create.status === 201 || create.status === 200, { status: create.status, msg: create.json?.message }));

  const asgId = create.json?.data?._id;
  if (!asgId) return;

  const submit = await req('POST', `/api/assignments/${asgId}/submit`, {
    token: student.accessToken,
    cookie: csrf.cookie,
    csrf: csrf.token,
    body: {
      studentId: student.id,
      teacherId: teacher.id,
      submittedFileUrl: '/uploads/assignments/qa-placeholder.txt',
    },
  });
  flowChecks.push(check('assignment submit', submit.status < 400, { status: submit.status, msg: submit.json?.message }));

  const submissionId = submit.json?.data?._id || submit.json?.data?.submission?._id;
  if (submissionId) {
    const grade = await req('PUT', `/api/assignments/submissions/${submissionId}/grade`, {
      token: teacher.accessToken,
      cookie: csrf.cookie,
      csrf: csrf.token,
      body: { grade: 8, teacherFeedback: 'QA live grade' },
    });
    flowChecks.push(check('assignment grade', grade.status === 200, { status: grade.status, msg: grade.json?.message }));
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`\n=== QA LIVE DEEP (API) @ ${BASE} ===\n`);

  const health = await req('GET', '/healthz');
  if (health.status !== 200 || !health.json?.ok) {
    console.error('API not healthy', health);
    process.exit(1);
  }

  let accountMap;
  try {
    accountMap = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
  } catch {
    console.error('Missing tests/test_account_ids.json — run: node tests/seed_test_accounts.js');
    process.exit(1);
  }

  const staffPhones = (accountMap.admins || []).slice(0, 3).map((a) => a.phone);
  const teacherPhones = (accountMap.teachers || []).slice(0, 5).map((t) => t.phone);
  const studentPhones = (accountMap.students || []).slice(0, 20).map((s) => s.phone);

  const loginJobs = [
    { kind: 'super_admin', fn: () => loginSuperAdmin() },
    ...staffPhones.map((phone) => ({ kind: 'staff', phone, fn: () => loginInternal(phone) })),
    ...teacherPhones.map((phone) => ({ kind: 'teacher', phone, fn: () => loginPublic(phone, 'teacher') })),
    ...studentPhones.map((phone) => ({ kind: 'student', phone, fn: () => loginPublic(phone, 'student') })),
  ];

  const capProbe = await getCaptcha('');
  const captchaBypassLive = !!capProbe.answer;

  const loginResults = await Promise.all(loginJobs.map(async (job) => {
    const r = await job.fn();
    return { ...job, ...r };
  }));

  const latencies = loginResults.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  const loginMetrics = {
    total: loginResults.length,
    ok: loginResults.filter((r) => r.ok).length,
    failed: loginResults.filter((r) => !r.ok).length,
    failureRate: loginResults.length ? loginResults.filter((r) => !r.ok).length / loginResults.length : 0,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    captchaBypassLive,
  };

  console.log(`Logins: ${loginMetrics.ok}/${loginMetrics.total} | p50=${loginMetrics.p50Ms}ms p95=${loginMetrics.p95Ms}ms | fail=${(loginMetrics.failureRate * 100).toFixed(1)}%`);

  const sessions = loginResults.filter((r) => r.ok && r.accessToken && !r.mfaRequired);
  const apiChecks = [];
  for (const s of sessions) {
    await hitApis(s, apiChecks);
  }

  const superAdmin = sessions.find((s) => s.id === 'admin') || sessions.find((s) => s.messagingRole === 'admin');
  const teacher = sessions.find((s) => s.kind === 'teacher');
  const student = sessions.find((s) => s.kind === 'student');
  const flowChecks = [];
  if (teacher && student) {
    await assignmentFlow(teacher, student, flowChecks);
  }

  const chatChecks = [];
  if (superAdmin) {
    const studentSender = sessions.find((s) => s.kind === 'student');
    const teacherSender = sessions.find((s) => s.kind === 'teacher');
    if (studentSender) {
      const m = await sendMessage(studentSender, superAdmin, `[qa-live student→admin] ${Date.now()}`);
      chatChecks.push(check('chat student→admin', m.ok, { status: m.status, msg: m.msg }));
    }
    if (teacherSender) {
      const m = await sendMessage(teacherSender, superAdmin, `[qa-live teacher→admin] ${Date.now()}`);
      chatChecks.push(check('chat teacher→admin', m.ok, { status: m.status, msg: m.msg }));
    }
  }

  const failedLogins = loginResults.filter((r) => !r.ok).map((r) => ({
    kind: r.kind,
    phone: r.phone,
    status: r.status,
    msg: r.msg,
  }));

  const allChecks = [...apiChecks, ...flowChecks, ...chatChecks];
  const pass = allChecks.filter((c) => c.pass).length;
  const fail = allChecks.filter((c) => !c.pass).length;

  const payload = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE,
    loginMetrics,
    failedLogins,
    apiChecks,
    flowChecks,
    chatChecks,
    summary: {
      loginOk: loginMetrics.ok,
      loginTotal: loginMetrics.total,
      checksPass: pass,
      checksFail: fail,
    },
  };

  let existing = {};
  try {
    if (fs.existsSync(OUT)) existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch { /* */ }
  fs.writeFileSync(OUT, JSON.stringify({ ...existing, ...payload, api: payload }, null, 2), 'utf8');
  console.log(`\nWrote ${OUT}`);
  console.log(`API checks: PASS=${pass} FAIL=${fail}`);
  if (failedLogins.length) {
    console.log('Failed logins sample:', failedLogins.slice(0, 5));
  }
  process.exit(fail > 0 || loginMetrics.failed > Math.max(3, loginMetrics.total * 0.15) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
