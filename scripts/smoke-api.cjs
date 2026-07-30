/**
 * API-only smoke (CI / khong can Vite).
 * Usage: node scripts/smoke-api.cjs [baseUrl]
 * Default: http://127.0.0.1:5000/api
 *
 * Admin/Staff phải đăng nhập cổng nội bộ (CAPTCHA). Smoke mint JWT internal
 * sau khi xác thực mật khẩu Super Admin (cùng claim với login/internal).
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE = (process.argv[2] || process.env.SMOKE_BASE || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
const ROOT = BASE.replace(/\/api$/, '');
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASSWORD || process.env.MASTER_ADMIN_PASSWORD || 'admin123';

async function mintSuperInternalToken() {
  const SystemSettings = require('../models/SystemSettings');
  const { verifyAdminPassword } = require('../utils/adminPassword');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const sys = await SystemSettings.findOne({ _key: 'main' }).select('+adminPasswordHash');
    const ok = await verifyAdminPassword(ADMIN_PASS, sys);
    if (!ok) throw new Error('admin password mismatch');
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
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
  const results = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

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
    cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    const j = await r.json();
    csrf = j.csrfToken || '';
    ok('GET /auth/csrf-token', r.status === 200 && !!csrf, 'status=' + r.status);
  } catch (e) {
    ok('GET /auth/csrf-token', false, e.message);
  }

  // Public login với admin phải bị chặn (đúng RBAC cổng)
  try {
    const r = await fetch(BASE + '/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ identifier: 'admin', password: ADMIN_PASS }),
    });
    const j = await r.json().catch(() => ({}));
    ok(
      'POST /auth/login (admin public blocked)',
      r.status === 403 || j.redirect === '/admin/login',
      'status=' + r.status,
    );
  } catch (e) {
    ok('POST /auth/login (admin public blocked)', false, e.message);
  }

  let token = '';
  try {
    token = await mintSuperInternalToken();
    ok('AUTH mint internal Super Admin', !!token, 'jwt');
  } catch (e) {
    ok('AUTH mint internal Super Admin', false, e.message);
  }

  const h = {
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };

  async function get(path, name) {
    if (!token) {
      ok(name || path, false, 'no token');
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
