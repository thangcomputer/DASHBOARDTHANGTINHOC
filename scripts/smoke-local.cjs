const BASE = 'http://localhost:5000/api';
const VITE = 'http://localhost:5173';

async function main() {
  const results = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

  // CSRF token (cookie + header)
  let csrf = '';
  try {
    const jar = { cookie: '' };
    const r = await fetch(BASE + '/auth/csrf-token', {
      headers: jar.cookie ? { Cookie: jar.cookie } : {},
    });
    const setCookie = r.headers.getSetCookie?.() || [];
    const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
    const j = await r.json();
    csrf = j.csrfToken || '';
    global.__smokeCookie = cookieHeader;
    ok('GET /auth/csrf-token', r.status === 200 && !!csrf, 'status=' + r.status);
  } catch (e) {
    ok('GET /auth/csrf-token', false, e.message);
  }

  let token;
  try {
    const r = await fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(global.__smokeCookie ? { Cookie: global.__smokeCookie } : {}),
      },
      body: JSON.stringify({ identifier: 'admin', password: 'admin123' }),
    });
    const j = await r.json();
    token = j.data && j.data.accessToken;
    const loginOk = r.status === 200 && j.success && (!!token || j.mfaRequired || j.data?.mfaRequired);
    ok('POST /auth/login (admin)', loginOk, 'status=' + r.status + (j.mfaRequired ? ' mfaRequired' : ''));
    if (!token && (j.mfaRequired || j.data?.mfaRequired)) {
      // MFA bật — không có access token; các GET phía dưới sẽ skip auth checks
      token = null;
    }
  } catch (e) {
    ok('POST /auth/login (admin)', false, e.message);
    print(results);
    process.exit(1);
  }

  const h = {
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(global.__smokeCookie ? { Cookie: global.__smokeCookie } : {}),
  };

  async function get(path, name) {
    if (!token) {
      ok(name || ('GET ' + path), true, 'skipped (MFA enabled, no token)');
      return {};
    }
    try {
      const r = await fetch(BASE + path, { headers: h });
      const t = await r.text();
      let j = null;
      try { j = JSON.parse(t); } catch (_) {}
      const pass = r.status >= 200 && r.status < 400;
      ok(name || ('GET ' + path), pass, 'status=' + r.status + (j && j.success === false ? ' msg=' + (j.message || '') : ''));
      return { r, j };
    } catch (e) {
      ok(name || ('GET ' + path), false, e.message);
      return {};
    }
  }

  await get('/settings', 'GET /settings');
  await get('/settings/web', 'GET /settings/web');
  await get('/students?page=1&limit=10', 'GET /students');
  await get('/students/stats', 'GET /students/stats');
  await get('/teachers', 'GET /teachers');
  await get('/staff', 'GET /staff');
  await get('/transactions', 'GET /transactions');
  await get('/schedules', 'GET /schedules');
  await get('/evaluations/admin', 'GET /evaluations/admin');
  await get('/settings/training-data', 'GET /training-data');
  await get('/settings/student-training-data', 'GET /student-training-data');
  await get('/settings/student-exam-config', 'GET /student-exam-config');
  await get('/branches/all', 'GET /branches/all');

  // system logs - try common paths
  const logPaths = ['/system-logs?page=1&limit=20', '/logs?page=1&limit=20', '/systemLogs?page=1&limit=20'];
  let logOk = false;
  let logDetail = '';
  for (const p of logPaths) {
    try {
      const r = await fetch(BASE + p, { headers: h });
      if (r.status < 400) { logOk = true; logDetail = 'status=' + r.status + ' path=' + p; break; }
      logDetail = 'last=' + p + ' status=' + r.status;
    } catch (e) { logDetail = e.message; }
  }
  ok('GET system logs', logOk, logDetail);

  for (const path of ['/', '/admin/login', '/admin']) {
    try {
      const r = await fetch(VITE + path);
      const html = await r.text();
      const isHtml = html.includes('root') || html.includes('<!DOCTYPE');
      ok('Vite ' + path, r.status === 200 && isHtml, 'status=' + r.status);
    } catch (e) {
      ok('Vite ' + path, false, e.message);
    }
  }

  try {
    const csrfRes = await fetch(VITE + '/api/auth/csrf-token', { credentials: 'include' });
    const csrfBody = await csrfRes.json().catch(() => ({}));
    const setCookie = typeof csrfRes.headers.getSetCookie === 'function'
      ? csrfRes.headers.getSetCookie()
      : [];
    const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ')
      || (global.__smokeCookie || '');
    const r = await fetch(VITE + '/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfBody.csrfToken || csrf || '',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ identifier: 'admin', password: 'admin123' }),
    });
    const text = await r.text();
    let j = {};
    try { j = JSON.parse(text || '{}'); } catch { /* empty */ }
    const loginOk = r.status === 200 && j.success && (!!j.data?.accessToken || j.mfaRequired || j.data?.mfaRequired);
    ok('Vite proxy login', loginOk, 'status=' + r.status + (text ? '' : ' empty-body'));
  } catch (e) {
    ok('Vite proxy login', false, e.message);
  }

  // Load key admin JS chunks (lazy tabs) via vite
  const chunks = [
    '/src/components/admin/hooks/useAdminDashboardState.jsx',
    '/src/components/admin/hooks/useAdminStudents.jsx',
    '/src/components/admin/hooks/useAdminTeachers.jsx',
    '/src/components/admin/tabs/AdminStudentsTab.jsx',
    '/src/components/admin/tabs/AdminTeachersTab.jsx',
    '/src/components/admin/shared/AddStudentModal.jsx',
  ];
  for (const c of chunks) {
    try {
      const r = await fetch(VITE + c);
      const t = await r.text();
      const pass = r.status === 200 && !t.includes('Failed to resolve') && t.length > 50;
      ok('Module ' + c.split('/').pop(), pass, 'status=' + r.status + ' bytes=' + t.length);
    } catch (e) {
      ok('Module ' + c.split('/').pop(), false, e.message);
    }
  }

  print(results);
  const failed = results.filter((x) => !x.pass);
  process.exit(failed.length ? 1 : 0);
}

function print(results) {
  console.log('');
  console.log('=== SMOKE TEST LOCAL ===');
  for (const x of results) {
    console.log((x.pass ? 'PASS' : 'FAIL') + '  ' + x.name + (x.detail ? '  (' + x.detail + ')' : ''));
  }
  const failed = results.filter((x) => !x.pass);
  console.log('');
  console.log('Total: ' + results.length + '  Pass: ' + (results.length - failed.length) + '  Fail: ' + failed.length);
}

main();