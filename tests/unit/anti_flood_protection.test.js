'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const authRateLimit = require('../../middleware/authRateLimit');
const apiRateLimit = require('../../middleware/apiRateLimit');
const {
  socketAuthMiddleware,
  resetSocketGuards,
} = require('../../middleware/socketAuth');
const blacklist = require('../../middleware/tokenBlacklist');
const Student = require('../../models/Student');

function startTestApp(middlewares, handler) {
  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers['x-test-ip']) {
      Object.defineProperty(req, 'ip', { value: req.headers['x-test-ip'], configurable: true });
    }
    next();
  });
  app.all('/test', ...(Array.isArray(middlewares) ? middlewares : [middlewares]), handler);
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({ srv, url: `http://127.0.0.1:${port}/test` });
    });
  });
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

test('authRateLimit loginLimiter blocks multi-account burst from 1 network IP', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevBurst = process.env.RATE_LIMIT_LOGIN_BURST_MAX;
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_LOGIN_BURST_MAX = '3';

  assert.ok(Array.isArray(authRateLimit.loginLimiter));
  assert.equal(authRateLimit.loginLimiter.length, 3);

  const { srv, url } = await startTestApp(authRateLimit.loginLimiter, (_req, res) => {
    res.status(401).json({ success: false });
  });

  try {
    const testIp = '198.51.100.10';
    for (let i = 1; i <= 3; i += 1) {
      const r = await postJson(url, { identifier: `091100000${i}`, password: 'x' }, { 'x-test-ip': testIp });
      assert.equal(r.status, 401);
    }
    // 4th attempt within 10s with a DIFFERENT phone from same IP -> 429 burst limit
    const blocked = await postJson(url, { identifier: '0911000009', password: 'x' }, { 'x-test-ip': testIp });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
  } finally {
    srv.close();
    process.env.NODE_ENV = prevNodeEnv;
    if (prevBurst === undefined) delete process.env.RATE_LIMIT_LOGIN_BURST_MAX;
    else process.env.RATE_LIMIT_LOGIN_BURST_MAX = prevBurst;
  }
});

test('apiRateLimit blocks network-wide flood across multiple accounts on 1 IP', async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevJwt = process.env.JWT_SECRET;
  const prevIpBurst = process.env.RATE_LIMIT_API_IP_BURST_MAX;
  const prevUserBurst = process.env.RATE_LIMIT_API_BURST_MAX;

  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'test_secret_at_least_32_characters_long_12345';
  process.env.RATE_LIMIT_API_IP_BURST_MAX = '4';
  process.env.RATE_LIMIT_API_BURST_MAX = '50';

  const { srv, url } = await startTestApp(apiRateLimit.apiRateLimitUnlessAuth, (_req, res) => {
    res.json({ success: true });
  });

  try {
    const netIp = '198.51.100.22';
    for (let i = 1; i <= 4; i += 1) {
      const tok = jwt.sign({ id: `user_${i}`, role: 'student' }, process.env.JWT_SECRET);
      const r = await postJson(url, {}, { 'x-test-ip': netIp, authorization: `Bearer ${tok}` });
      assert.equal(r.status, 200);
    }
    // 5th request from another account on the same network IP -> 429 network burst limit
    const tok5 = jwt.sign({ id: 'user_5', role: 'student' }, process.env.JWT_SECRET);
    const blocked = await postJson(url, {}, { 'x-test-ip': netIp, authorization: `Bearer ${tok5}` });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'RATE_LIMITED');
  } finally {
    srv.close();
    process.env.NODE_ENV = prevEnv;
    process.env.JWT_SECRET = prevJwt;
    if (prevIpBurst === undefined) delete process.env.RATE_LIMIT_API_IP_BURST_MAX;
    else process.env.RATE_LIMIT_API_IP_BURST_MAX = prevIpBurst;
    if (prevUserBurst === undefined) delete process.env.RATE_LIMIT_API_BURST_MAX;
    else process.env.RATE_LIMIT_API_BURST_MAX = prevUserBurst;
  }
});

test('socketAuthMiddleware enforces per-user, per-IP, and handshake burst caps and releases on disconnect', async () => {
  const prevForce = process.env.SOCKET_RATE_LIMIT_FORCE;
  const prevJwt = process.env.JWT_SECRET;
  const prevPerUser = process.env.SOCKET_MAX_CONNS_PER_USER;
  const prevPerIp = process.env.SOCKET_MAX_CONNS_PER_IP;
  const prevHandshake = process.env.SOCKET_HANDSHAKE_MAX_PER_10S;

  process.env.SOCKET_RATE_LIMIT_FORCE = '1';
  process.env.JWT_SECRET = 'test_secret_at_least_32_characters_long_12345';
  process.env.SOCKET_MAX_CONNS_PER_USER = '2';
  process.env.SOCKET_MAX_CONNS_PER_IP = '3';
  process.env.SOCKET_HANDSHAKE_MAX_PER_10S = '5';

  const origIsBlacklisted = blacklist.isBlacklisted;
  const origFindById = Student.findById;
  blacklist.isBlacklisted = async () => false;
  Student.findById = () => ({
    select() { return this; },
    lean() { return Promise.resolve({ tokenVersion: 1 }); },
  });

  resetSocketGuards();

  function makeSocket(ip, token) {
    const listeners = {};
    return {
      id: Math.random().toString(36).slice(2),
      handshake: { address: ip, headers: {}, auth: { token } },
      once(ev, fn) { listeners[ev] = fn; },
      emitDisconnect() { if (listeners.disconnect) listeners.disconnect(); },
    };
  }

  function runAuth(sock) {
    return new Promise((resolve) => {
      socketAuthMiddleware(sock, (err) => resolve(err || null));
    });
  }

  try {
    const tokU1 = jwt.sign({ id: 'u1', role: 'student', tokenVersion: 1 }, process.env.JWT_SECRET);
    const tokU2 = jwt.sign({ id: 'u2', role: 'student', tokenVersion: 1 }, process.env.JWT_SECRET);
    const tokU3 = jwt.sign({ id: 'u3', role: 'student', tokenVersion: 1 }, process.env.JWT_SECRET);

    const s1 = makeSocket('203.0.113.5', tokU1);
    const s2 = makeSocket('203.0.113.5', tokU1);
    const s3 = makeSocket('203.0.113.5', tokU1);

    assert.equal(await runAuth(s1), null);
    assert.equal(await runAuth(s2), null);
    const errUserCap = await runAuth(s3);
    assert.match(errUserCap.message, /Connection limit exceeded for account/);

    // Disconnect s1 frees a slot
    s1.emitDisconnect();
    const s3Retry = makeSocket('203.0.113.5', tokU1);
    assert.equal(await runAuth(s3Retry), null);

    // Total active on 203.0.113.5: 2 (u1) + 1 (u2) = 3 (max per IP)
    const sU2 = makeSocket('203.0.113.5', tokU2);
    assert.equal(await runAuth(sU2), null);

    // Per-IP concurrent cap (3 distinct accounts on same network IP 203.0.113.99)
    const tokU4 = jwt.sign({ id: 'u4', role: 'student', tokenVersion: 1 }, process.env.JWT_SECRET);
    const tokU5 = jwt.sign({ id: 'u5', role: 'student', tokenVersion: 1 }, process.env.JWT_SECRET);
    const tokU6 = jwt.sign({ id: 'u6', role: 'student', tokenVersion: 1 }, process.env.JWT_SECRET);
    process.env.SOCKET_MAX_CONNS_PER_IP = '2';
    const uA = makeSocket('203.0.113.99', tokU4);
    const uB = makeSocket('203.0.113.99', tokU5);
    const uC = makeSocket('203.0.113.99', tokU6);
    assert.equal(await runAuth(uA), null);
    assert.equal(await runAuth(uB), null);
    const errIpCap = await runAuth(uC);
    assert.match(errIpCap.message, /Connection limit exceeded for network/);

    // Total handshakes so far on 203.0.113.5: s1, s2, s3, s3Retry, sU2 = 5; 6th attempt hits handshake rate limit
    const sU3 = makeSocket('203.0.113.5', tokU3);
    const errHandshake = await runAuth(sU3);
    assert.match(errHandshake.message, /Rate limit exceeded/);
  } finally {
    resetSocketGuards();
    blacklist.isBlacklisted = origIsBlacklisted;
    Student.findById = origFindById;
    if (prevForce === undefined) delete process.env.SOCKET_RATE_LIMIT_FORCE;
    else process.env.SOCKET_RATE_LIMIT_FORCE = prevForce;
    process.env.JWT_SECRET = prevJwt;
    if (prevPerUser === undefined) delete process.env.SOCKET_MAX_CONNS_PER_USER;
    else process.env.SOCKET_MAX_CONNS_PER_USER = prevPerUser;
    if (prevPerIp === undefined) delete process.env.SOCKET_MAX_CONNS_PER_IP;
    else process.env.SOCKET_MAX_CONNS_PER_IP = prevPerIp;
    if (prevHandshake === undefined) delete process.env.SOCKET_HANDSHAKE_MAX_PER_10S;
    else process.env.SOCKET_HANDSHAKE_MAX_PER_10S = prevHandshake;
  }
});
