const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generateTestToken, API_BASE_URL } = require('./config');

const idsPath = path.join(__dirname, 'test_account_ids.json');
const hasIds = fs.existsSync(idsPath);
const ids = hasIds ? require('./test_account_ids.json') : null;

let csrf = '';
let cookie = '';
let ready = false;
let skipReason = '';

async function ensureCsrf() {
  if (csrf) return;
  const r = await fetch(`${API_BASE_URL}/api/auth/csrf-token`, { credentials: 'include' });
  const setCookie = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  const j = await r.json();
  csrf = j.csrfToken || '';
}

async function api(pathSuffix, { method = 'GET', token, body } = {}) {
  if (method !== 'GET' && method !== 'HEAD') await ensureCsrf();
  const res = await fetch(`${API_BASE_URL}/api/messages${pathSuffix}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

before(async () => {
  if (!hasIds) {
    skipReason = 'missing tests/test_account_ids.json';
    return;
  }
  try {
    const r = await fetch(`${API_BASE_URL}/healthz`);
    if (!r.ok) {
      skipReason = 'API healthz not ok';
      return;
    }
    await ensureCsrf();
    ready = true;
  } catch {
    skipReason = 'API not running';
  }
});

test('A->B message not readable by C', async (t) => {
  if (!ready) {
    t.skip(skipReason || 'not ready');
    return;
  }

  const studentA = ids.students[0]._id;
  const staffB = ids.admins[2]._id;
  const staffC = ids.admins[3]._id;

  const tokA = generateTestToken({ id: studentA, role: 'student', name: 'HV-A' });
  const tokB = generateTestToken({ id: staffB, role: 'staff', adminRole: 'STAFF', name: 'Staff-B' });
  const tokC = generateTestToken({ id: staffC, role: 'staff', adminRole: 'STAFF', name: 'Staff-C' });

  const send = await api('/', {
    method: 'POST',
    token: tokA,
    body: {
      receiverId: staffB,
      receiverName: 'Staff-B',
      receiverRole: 'admin',
      content: `iso-${Date.now()}`,
    },
  });
  assert.equal(send.status, 201);
  assert.ok(send.json?.data?._id);
  const msg = send.json.data;

  const getB = await api(`/${encodeURIComponent(msg.conversationId)}`, { token: tokB });
  assert.equal(getB.status, 200);
  assert.ok(Array.isArray(getB.json?.data));
  assert.ok(getB.json.data.some((m) => String(m._id) === String(msg._id)));

  const getC = await api(`/${encodeURIComponent(msg.conversationId)}`, { token: tokC });
  assert.equal(getC.status, 403);
});

test('Only SUPER_ADMIN can access admin mailbox conversation', async (t) => {
  if (!ready) {
    t.skip(skipReason || 'not ready');
    return;
  }

  const studentA = ids.students[1]._id;
  const tokA = generateTestToken({ id: studentA, role: 'student', name: 'HV-A2' });
  const tokStaff = generateTestToken({ id: ids.admins[0]._id, role: 'staff', adminRole: 'STAFF', name: 'Staff-X' });
  const tokSuper = generateTestToken({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', name: 'Super' });

  const send = await api('/', {
    method: 'POST',
    token: tokA,
    body: {
      receiverId: 'admin',
      receiverName: 'Phòng Tuyển Sinh',
      receiverRole: 'admin',
      content: `mail-${Date.now()}`,
    },
  });
  assert.equal(send.status, 201);
  const convId = send.json.data.conversationId;
  assert.ok(String(convId).includes('admin_'));

  const getStaff = await api(`/${encodeURIComponent(convId)}`, { token: tokStaff });
  assert.equal(getStaff.status, 403);

  const getSuper = await api(`/${encodeURIComponent(convId)}`, { token: tokSuper });
  assert.equal(getSuper.status, 200);
});
