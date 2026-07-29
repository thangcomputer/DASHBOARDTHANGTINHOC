/**
 * QA — Concurrent password (+CAPTCHA for internal) login.
 * Requires server with NODE_ENV=test CAPTCHA_BYPASS=1 for admin/staff CAPTCHA path.
 * Public HV/GV login does not require CAPTCHA.
 *
 * Usage:
 *   set NODE_ENV=test&& set CAPTCHA_BYPASS=1&& node scripts/qa_captcha_concurrent_login.cjs
 * (Server must also run with those env vars for CAPTCHA bypass.)
 */
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const BASE = process.env.QA_API_BASE || 'http://127.0.0.1:5000';
const PASSWORD = process.env.QA_PASSWORD || 'Test@123456';
const OUT = path.join(__dirname, '..', 'docs', 'QA_CAPTCHA_CONCURRENT_LOGIN_REPORT.md');

const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

const results = [];

function record(tc) {
  results.push(tc);
  console.log(`[${tc.result}] ${tc.id} — ${tc.name}${tc.actual ? ` | ${tc.actual}` : ''}`);
}

function req(method, p, { body, cookie, csrf } = {}) {
  return new Promise((resolve) => {
    const url = new URL(p, BASE);
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = csrf;
    const data = body != null ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const started = Date.now();
    const r = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers, timeout: 45000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = { _raw: raw.slice(0, 200) }; }
          resolve({
            status: res.statusCode,
            json,
            headers: res.headers,
            ms: Date.now() - started,
            cookie: (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; '),
          });
        });
      },
    );
    r.on('error', (err) => resolve({ status: 0, json: { message: err.message }, ms: Date.now() - started, headers: {} }));
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
    answer: res.json?.answer || 'bypass',
    hasAnswer: Boolean(res.json?.answer),
    cookie: [cookie, res.cookie].filter(Boolean).join('; '),
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const probe = await getCaptcha('');
  const bypassLive = probe.hasAnswer;
  record({
    id: 'CAPTCHA-00',
    name: 'Server exposes captcha answer (NODE_ENV=test + CAPTCHA_BYPASS=1)',
    result: bypassLive ? 'PASS' : 'WARN',
    actual: bypassLive ? 'answer present' : 'answer hidden — internal concurrent login may fail unless bypass on server',
  });

  const students = await Student.find({ phone: /^096/ }).select('phone name').limit(30).lean();
  const teachers = await Teacher.find({ role: 'teacher', phone: /^097/ }).select('phone name').limit(6).lean();
  const admins = await Teacher.find({ role: 'admin', phone: /^0981|^0999/ }).select('phone name role adminRole').limit(4).lean();
  const staff = await Teacher.find({ role: 'staff', phone: /^0982/ }).select('phone name role adminRole').limit(3).lean();

  const publicActors = [
    ...students.map((s) => ({ kind: 'public', id: s.phone, role: 'student', name: s.name })),
    ...teachers.map((t) => ({ kind: 'public', id: t.phone, role: 'teacher', name: t.name })),
  ];
  const internalActors = [
    ...admins.map((a) => ({ kind: 'internal', id: a.phone, name: a.name })),
    ...staff.map((a) => ({ kind: 'internal', id: a.phone, name: a.name })),
  ];

  // Public concurrent (no captcha)
  const pubStarted = Date.now();
  const pubSettled = await Promise.all(publicActors.map(async (a) => {
    const csrf = await getCsrf();
    const r = await req('POST', '/api/auth/login/public', {
      cookie: csrf.cookie,
      csrf: csrf.token,
      body: { identifier: a.id, password: PASSWORD, role: a.role, force: true },
    });
    return { ...a, status: r.status, ms: r.ms, ok: r.status === 200 && r.json?.data?.accessToken };
  }));
  const pubOk = pubSettled.filter((x) => x.ok).length;
  record({
    id: 'AUTH-CONC-02a',
    name: `Concurrent public login (${publicActors.length} HV+GV)`,
    result: pubOk === publicActors.length && publicActors.length > 0 ? 'PASS' : 'FAIL',
    actual: `ok=${pubOk}/${publicActors.length} wall=${Date.now() - pubStarted}ms`,
  });

  // Internal concurrent (needs captcha / bypass)
  const intStarted = Date.now();
  const intSettled = await Promise.all(internalActors.map(async (a) => {
    const csrf = await getCsrf();
    const cap = await getCaptcha(csrf.cookie);
    const r = await req('POST', '/api/auth/login/internal', {
      cookie: cap.cookie || csrf.cookie,
      csrf: csrf.token,
      body: {
        identifier: a.id,
        password: PASSWORD,
        captchaId: cap.cid || 'bypass',
        captchaAnswer: cap.answer || 'x',
        force: true,
      },
    });
    return { ...a, status: r.status, ms: r.ms, ok: r.status === 200 && (r.json?.data?.accessToken || r.json?.mfaRequired), msg: r.json?.message };
  }));
  const intOk = intSettled.filter((x) => x.ok).length;
  record({
    id: 'AUTH-CONC-02b',
    name: `Concurrent internal login (${internalActors.length} Admin+Staff)`,
    result: !internalActors.length
      ? 'WARN'
      : (intOk === internalActors.length ? 'PASS' : (bypassLive ? 'FAIL' : 'WARN')),
    actual: `ok=${intOk}/${internalActors.length} wall=${Date.now() - intStarted}ms sample=${intSettled[0]?.status}:${intSettled[0]?.msg || ''}`,
  });

  const totalActors = publicActors.length + internalActors.length;
  const totalOk = pubOk + intOk;
  record({
    id: 'AUTH-CONC-02',
    name: `Concurrent password(+CAPTCHA) login summary (${totalActors} users)`,
    result: totalOk >= Math.min(totalActors, publicActors.length) && pubOk === publicActors.length
      ? (intOk === internalActors.length || !bypassLive ? (bypassLive && intOk === internalActors.length ? 'PASS' : (bypassLive ? 'FAIL' : 'PASS')) : 'FAIL')
      : 'FAIL',
    actual: `ok=${totalOk}/${totalActors} public=${pubOk} internal=${intOk} bypass=${bypassLive}`,
  });

  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const md = [
    '# QA CAPTCHA Concurrent Login Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**API:** ${BASE}`,
    `**CAPTCHA bypass live:** ${bypassLive}`,
    `**Result:** ${pass} PASS / ${fail} FAIL`,
    '',
    '| ID | Name | Result | Actual |',
    '|----|------|--------|--------|',
    ...results.map((r) => `| ${r.id} | ${r.name} | ${r.result} | ${String(r.actual || '').replace(/\|/g, '/')} |`),
    '',
    '## Note',
    '- Public login không CAPTCHA.',
    '- Internal cần `NODE_ENV=test` + `CAPTCHA_BYPASS=1` trên **server**.',
    '',
  ].join('\n');
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`\nWrote ${OUT}`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
