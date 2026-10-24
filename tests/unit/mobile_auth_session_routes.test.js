const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16
  ? process.env.JWT_SECRET
  : 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length >= 16
  ? process.env.JWT_REFRESH_SECRET
  : 'b'.repeat(40);

const authRoutes = require('../../routes/authRoutes');
const { authMiddleware } = require('../../middleware/auth');

async function startServer() {
  const app = express();
  app.use(express.json());
  app.get('/protected', authMiddleware, (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function post(server, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login/mobile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('mobile login endpoint is disabled by default', async () => {
  const original = process.env.MOBILE_MULTI_SESSION_AUTH;
  delete process.env.MOBILE_MULTI_SESSION_AUTH;
  const server = await startServer();
  try {
    const result = await post(server, {});
    assert.equal(result.status, 404);
    assert.equal(result.body.code, 'MOBILE_SESSION_AUTH_DISABLED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (original === undefined) delete process.env.MOBILE_MULTI_SESSION_AUTH;
    else process.env.MOBILE_MULTI_SESSION_AUTH = original;
  }
});

test('mobile login rejects admin and staff before account lookup', async () => {
  const original = process.env.MOBILE_MULTI_SESSION_AUTH;
  process.env.MOBILE_MULTI_SESSION_AUTH = 'true';
  const server = await startServer();
  try {
    for (const role of ['admin', 'staff']) {
      const result = await post(server, { role, platform: 'android', phone: '0900000000', password: 'x' });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, 'MOBILE_ROLE_NOT_ALLOWED');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (original === undefined) delete process.env.MOBILE_MULTI_SESSION_AUTH;
    else process.env.MOBILE_MULTI_SESSION_AUTH = original;
  }
});

test('session token is rejected when the feature flag is OFF', async () => {
  const original = process.env.MOBILE_MULTI_SESSION_AUTH;
  delete process.env.MOBILE_MULTI_SESSION_AUTH;
  const server = await startServer();
  try {
    const token = jwt.sign({
      id: '507f1f77bcf86cd799439011',
      role: 'student',
      aud: 'mobile',
      sid: 'session-id',
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.code, 'MOBILE_SESSION_AUTH_DISABLED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (original === undefined) delete process.env.MOBILE_MULTI_SESSION_AUTH;
    else process.env.MOBILE_MULTI_SESSION_AUTH = original;
  }
});
