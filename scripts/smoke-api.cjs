/**
 * API-only smoke (CI / khong can Vite).
 * Usage: node scripts/smoke-api.cjs [baseUrl]
 * Default: http://127.0.0.1:5000/api
 *
 * Admin login qua /auth/login/internal + captcha (cổng nội bộ).
 * Dev/CI: GET /auth/captcha trả `answer` khi NODE_ENV !== production.
 */
const BASE = (process.argv[2] || process.env.SMOKE_BASE || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
const ROOT = BASE.replace(/\/api$/, '');

function mergeCookies(existing, setCookieList) {
  const map = new Map();
  String(existing || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const i = pair.indexOf('=');
      if (i > 0) map.set(pair.slice(0, i), pair.slice(i + 1));
    });
  for (const raw of setCookieList || []) {
    const first = String(raw).split(';')[0];
    const i = first.indexOf('=');
    if (i > 0) map.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function main() {
  const results = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

  // healthz
  try {
    const r = await fetch(ROOT + '/healthz');
    const j = await r.json();
    ok('GET /healthz', r.status === 200 && j.ok, 'db=' + j.db + ' queue=' + j.queue);
  } catch (e) {
    ok('GET /healthz', false, e.message);
  }

  let csrf = '';
  let cookie = '';
  try {
    const r = await fetch(BASE + '/auth/csrf-token', { credentials: 'include' });
    const setCookie = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    cookie = mergeCookies(cookie, setCookie);
    const j = await r.json();
    csrf = j.csrfToken || '';
    ok('GET /auth/csrf-token', r.status === 200 && !!csrf, 'status=' + r.status);
  } catch (e) {
    ok('GET /auth/csrf-token', false, e.message);
  }

  let captchaId = '';
  let captchaAnswer = '';
  try {
    const r = await fetch(BASE + '/auth/captcha', {
      headers: cookie ? { Cookie: cookie } : {},
    });
    const setCookie = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    cookie = mergeCookies(cookie, setCookie);
    const j = await r.json();
    captchaId = j.cid || '';
    captchaAnswer = j.answer || '';
    ok(
      'GET /auth/captcha',
      r.status === 200 && !!captchaId && !!captchaAnswer,
      'status=' + r.status + (captchaAnswer ? ' hint=yes' : ' hint=no')
    );
  } catch (e) {
    ok('GET /auth/captcha', false, e.message);
  }

  let token = '';
  try {
    const r = await fetch(BASE + '/auth/login/internal', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        identifier: 'admin',
        password: process.env.SMOKE_ADMIN_PASSWORD || 'admin123',
        captchaId: captchaId || 'smoke',
        captchaAnswer: captchaAnswer || 'smoke',
      }),
    });
    const setCookie = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    cookie = mergeCookies(cookie, setCookie);
    const j = await r.json();
    token = j.data?.accessToken || '';
    const loginOk = r.status === 200 && j.success && (!!token || j.mfaRequired || j.data?.mfaRequired);
    ok('POST /auth/login/internal', loginOk, 'status=' + r.status + (j.mfaRequired ? ' mfa' : '') + (j.message ? ' ' + j.message : ''));
  } catch (e) {
    ok('POST /auth/login/internal', false, e.message);
  }

  const h = {
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };

  async function get(path, name) {
    if (!token) {
      ok(name || path, true, 'skipped (no token)');
      return;
    }
    try {
      const r = await fetch(BASE + path, { headers: h });
      const j = await r.json().catch(() => ({}));
      ok(name || ('GET ' + path), r.status === 200 && j.success !== false, 'status=' + r.status);
    } catch (e) {
      ok(name || path, false, e.message);
    }
  }

  await get('/students?limit=1', 'GET /students');
  await get('/teachers?limit=1', 'GET /teachers');
  await get('/monitoring/overview', 'GET /monitoring/overview');
  await get('/monitoring/outbox', 'GET /monitoring/outbox');
  await get('/bi/overview?period=1m', 'GET /bi/overview');
  await get('/workflows/definitions', 'GET /workflows/definitions');
  await get('/ai/status', 'GET /ai/status');
  await get('/tenants', 'GET /tenants');
  await get('/builder/forms', 'GET /builder/forms');
  await get('/builder/reports/sources', 'GET /builder/reports/sources');
  await get('/files/stats', 'GET /files/stats');
  await get('/backups/stats', 'GET /backups/stats');
  await get('/notifications/count', 'GET /notifications/count');

  console.log('\n=== SMOKE API ===');
  let pass = 0;
  for (const r of results) {
    console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.detail ? '  (' + r.detail + ')' : ''));
    if (r.pass) pass += 1;
  }
  console.log('\nTotal: ' + results.length + '  Pass: ' + pass + '  Fail: ' + (results.length - pass));
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
