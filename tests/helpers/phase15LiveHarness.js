'use strict';

const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const {
  assertTestDatabaseEnvironment,
  assertTestDatabaseResetAllowed,
} = require('../setup/testDatabaseGuard');

const ROOT = path.resolve(__dirname, '..', '..');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

class Phase15LiveHarness {
  constructor() {
    this.child = null;
    this.port = null;
    this.baseUrl = null;
    this.cookie = '';
    this.csrfToken = '';
  }

  async resetAndSeed(seed) {
    const target = assertTestDatabaseResetAllowed(process.env);
    await mongoose.connect(target.uri);
    try {
      await mongoose.connection.dropDatabase();
      if (seed) await seed();
    } finally {
      await mongoose.disconnect();
    }
  }

  async start() {
    assertTestDatabaseEnvironment(process.env);
    this.port = await reservePort();
    this.baseUrl = `http://127.0.0.1:${this.port}`;
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(this.port),
      CLIENT_URL: this.baseUrl,
      JWT_SECRET: process.env.JWT_SECRET || 'phase15-live-jwt-secret-only',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'phase15-live-refresh-secret-only',
      MASTER_ADMIN_PHONE: process.env.MASTER_ADMIN_PHONE || '0900000001',
      MASTER_ADMIN_PASSWORD: process.env.MASTER_ADMIN_PASSWORD || 'phase15-master-password',
      BACKUP_SCHEDULE: '0',
      RUN_OUTBOX_WORKER: '0',
      ENABLE_REDIS: 'false',
      RATE_LIMIT_LOGIN_MAX: '100',
      RATE_LIMIT_SENSITIVE_MAX: '100',
    };
    this.child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    this.child.once('exit', (code) => {
      if (code && this.child) this.child.exitCodeObserved = code;
    });

    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (this.child.exitCodeObserved != null) {
        throw new Error(`Isolated API exited during startup (${this.child.exitCodeObserved})`);
      }
      try {
        const response = await fetch(`${this.baseUrl}/api/auth/csrf-token`);
        if (response.ok) {
          const payload = await response.json();
          this.csrfToken = payload.csrfToken;
          this.cookie = String(response.headers.get('set-cookie') || '').split(';')[0];
          return;
        }
      } catch {
        // Server is not listening yet.
      }
      await delay(250);
    }
    await this.stop();
    throw new Error('Isolated API did not become ready');
  }

  async refreshCsrf() {
    const response = await fetch(`${this.baseUrl}/api/auth/csrf-token`);
    const payload = await response.json();
    this.csrfToken = payload.csrfToken;
    this.cookie = String(response.headers.get('set-cookie') || '').split(';')[0];
    return payload;
  }

  async request(method, route, { body, token, csrf = true } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      headers.Cookie = this.cookie;
      headers['X-CSRF-Token'] = this.csrfToken;
    }
    const response = await fetch(`${this.baseUrl}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const text = await response.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    return { response, json };
  }

  async captcha() {
    const { response, json } = await this.request('GET', '/api/auth/captcha', { csrf: false });
    if (!response.ok || !json.cid || !json.answer) throw new Error('Cannot obtain test CAPTCHA');
    return { captchaId: json.cid, captchaAnswer: json.answer };
  }

  async stop() {
    const child = this.child;
    this.child = null;
    if (child && child.exitCode == null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        delay(3000),
      ]);
    }
    if (process.env.ALLOW_TEST_DB_RESET) {
      const target = assertTestDatabaseResetAllowed(process.env);
      await mongoose.connect(target.uri);
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  }
}

module.exports = { Phase15LiveHarness };
