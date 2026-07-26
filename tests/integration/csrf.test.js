const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const { csrfProtection, issueCsrfToken, COOKIE_NAME } = require('../../middleware/csrf');

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.get('/api/auth/csrf-token', (req, res) => {
    const token = issueCsrfToken(res);
    res.json({ success: true, csrfToken: token });
  });
  app.use('/api', csrfProtection);
  app.post('/api/echo', (req, res) => res.json({ ok: true }));
  app.post('/api/webhooks/x', (req, res) => res.json({ ok: true, skipped: true }));
  return app;
}

async function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function request(server, { method, path, headers, body }) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers: headers || {} },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = {};
          try { json = JSON.parse(data || '{}'); } catch { /* ignore */ }
          resolve({ status: res.statusCode, body: json, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('CSRF: POST without token → 403 CSRF_INVALID', async () => {
  const server = await listen(makeApp());
  try {
    const r = await request(server, { method: 'POST', path: '/api/echo' });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'CSRF_INVALID');
  } finally {
    server.close();
  }
});

test('CSRF: POST with matching cookie + header → 200', async () => {
  const server = await listen(makeApp());
  try {
    const tokenRes = await request(server, { method: 'GET', path: '/api/auth/csrf-token' });
    assert.equal(tokenRes.status, 200);
    const token = tokenRes.body.csrfToken;
    assert.ok(token);
    const setCookie = tokenRes.headers['set-cookie'] || [];
    const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
    assert.ok(cookieHeader.includes(COOKIE_NAME));

    const r = await request(server, {
      method: 'POST',
      path: '/api/echo',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        'X-CSRF-Token': token,
      },
      body: '{}',
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  } finally {
    server.close();
  }
});

test('CSRF: webhooks prefix is skipped', async () => {
  const server = await listen(makeApp());
  try {
    const r = await request(server, { method: 'POST', path: '/api/webhooks/x' });
    assert.equal(r.status, 200);
    assert.equal(r.body.skipped, true);
  } finally {
    server.close();
  }
});
