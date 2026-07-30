/**
 * Mô phỏng super admin / staff / teacher / student nhắn tin chéo.
 * Kiểm tra: gửi được, không trùng, không lọt sang người khác (socket + API).
 */
const path = require('path');
const axios = require('axios');
const { io } = require(path.join(__dirname, '../client/node_modules/socket.io-client'));
const { getMessagingRole } = require('../utils/messagingRoles');

const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000';

const ACCOUNTS = {
  admin:   { identifier: process.env.ADMIN_IDENTIFIER || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123', roleHint: 'admin' },
  staff:   { identifier: process.env.STAFF_IDENTIFIER || '0920000010', password: process.env.STAFF_PASSWORD || 'Test@123', roleHint: 'admin' },
  teacher: { identifier: process.env.TEACHER_IDENTIFIER || '0910000010', password: process.env.TEACHER_PASSWORD || 'Test@123', roleHint: 'teacher' },
  student: { identifier: process.env.STUDENT_IDENTIFIER || '0900000010', password: process.env.STUDENT_PASSWORD || 'Test@123', roleHint: 'student' },
};

const ROLE_LABEL = { admin: 'Super Admin', staff: 'Staff CN', teacher: 'Giảng viên', student: 'Học viên' };

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function makeConvId(r1, id1, r2, id2) {
  return [`${r1}_${id1}`, `${r2}_${id2}`].sort().join('__');
}

async function login(key) {
  const { identifier, password, roleHint } = ACCOUNTS[key];
  const res = await axios.post(`${API_ORIGIN}/api/auth/login`, { identifier, password, role: roleHint });
  if (!res.data?.success) throw new Error(`Login ${key} failed: ${res.data?.message}`);
  const w = res.data.data || {};
  const d = w.user ? { ...w.user, ...w } : w;
  const u = {
    key,
    id: String(d.id || d._id),
    role: d.role,
    adminRole: d.adminRole,
    name: d.name || key,
    accessToken: w.accessToken || d.accessToken,
    messagingRole: getMessagingRole({ id: d.id || d._id, role: d.role, adminRole: d.adminRole }),
  };
  u.socketKey = `${u.messagingRole}_${u.id}`;
  return u;
}

function apiFor(user) {
  return axios.create({
    baseURL: `${API_ORIGIN}/api`,
    headers: { Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/json' },
    timeout: 20_000,
  });
}

async function getContacts(user) {
  const res = await apiFor(user).get('/messages/contacts');
  return res.data?.success ? res.data.data : [];
}

async function sendMsg(sender, receiver, content) {
  const res = await apiFor(sender).post('/messages', {
    receiverId: receiver.id,
    receiverName: receiver.name,
    receiverRole: receiver.messagingRole,
    content,
    isGroup: false,
    messageType: 'text',
  });
  if (!res.data?.success) throw new Error(res.data?.message || 'send failed');
  return res.data.data;
}

function connectSocket(user) {
  return new Promise((resolve, reject) => {
    const socket = io(API_ORIGIN, { auth: { token: user.accessToken }, transports: ['websocket'], reconnection: false });
    const timer = setTimeout(() => { socket.close(); reject(new Error(`socket timeout ${user.key}`)); }, 12_000);
    socket.on('connect', () => socket.emit('register', {}));
    socket.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
    socket.on('users:online', (list) => {
      if (list.some((u) => String(u.userId) === user.id && String(u.role) === user.messagingRole)) {
        clearTimeout(timer);
        resolve(socket);
      }
    });
  });
}

function waitEvent(socket, event, pred, ms = 8_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { socket.off(event, h); reject(new Error(`timeout ${event}`)); }, ms);
    function h(p) {
      if (!pred || pred(p)) { clearTimeout(t); socket.off(event, h); resolve(p); }
    }
    socket.on(event, h);
  });
}

async function testPair(sender, receiver, others, sockets, results) {
  const label = `${ROLE_LABEL[sender.key]} → ${ROLE_LABEL[receiver.key]}`;
  const content = `[roleplay:${sender.key}->${receiver.key}] ${Date.now()}`;
  const convId = makeConvId(sender.messagingRole, sender.id, receiver.messagingRole, receiver.id);

  const recvPromise = waitEvent(sockets[receiver.key], 'message:receive', (p) => p.content === content);
  const leakPromises = others.map((k) =>
    waitEvent(sockets[k], 'message:receive', (p) => p.content === content, 2_000)
      .then(() => { throw new Error(`LEAK to ${k}`); })
      .catch((e) => { if (String(e.message).startsWith('LEAK')) throw e; })
  );

  let sent;
  try {
    sent = await sendMsg(sender, receiver, content);
    const payload = await recvPromise;
    await Promise.all(leakPromises);

    const dup = await apiFor(receiver).get(`/messages/${encodeURIComponent(convId)}`);
    const msgs = dup.data?.data || [];
    const sameContent = msgs.filter((m) => m.content === content);

    const ok = String(sent.conversationId) === convId
      && String(payload.receiverId) === String(receiver.id)
      && sameContent.length === 1;

    results.push({
      label,
      status: ok ? 'OK' : 'FAIL',
      convId,
      dupCount: sameContent.length,
      note: ok ? 'Gửi được, 1 tin, không lọt' : `conv mismatch hoặc trùng x${sameContent.length}`,
    });
  } catch (e) {
    results.push({ label, status: 'FAIL', convId, note: e.message || String(e) });
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  MÔ PHỎNG NHẮN TIN: Super Admin / Staff / GV / HV');
  console.log('═══════════════════════════════════════════════════\n');

  const users = {};
  for (const k of ['admin', 'staff', 'teacher', 'student']) {
    users[k] = await login(k);
    console.log(`✓ Đăng nhập ${ROLE_LABEL[k]}: ${users[k].name} (${users[k].socketKey})`);
  }

  const sockets = {};
  for (const k of Object.keys(users)) {
    sockets[k] = await connectSocket(users[k]);
  }
  console.log('\n✓ Cả 4 vai đã online (socket)\n');
  await sleep(400);

  // Ma trận đầy đủ 4 vai nhắn chéo (mô phỏng thực tế)
  const allKeys = ['admin', 'staff', 'teacher', 'student'];
  const explicitPairs = [];
  for (const fromKey of allKeys) {
    for (const toKey of allKeys) {
      if (fromKey === toKey) continue;
      explicitPairs.push({ from: users[fromKey], to: users[toKey] });
    }
  }

  // Thêm cặp từ danh bạ contacts (RBAC UI)
  const contactPairs = [];
  for (const fromKey of allKeys) {
    const contacts = await getContacts(users[fromKey]);
    for (const c of contacts) {
      const receiver = Object.values(users).find((u) => u.id === String(c.id));
      if (!receiver || receiver.key === fromKey) continue;
      contactPairs.push({ from: users[fromKey], to: receiver });
    }
  }

  const seen = new Set();
  const uniquePairs = [...explicitPairs, ...contactPairs].filter((p) => {
    const id = `${p.from.key}->${p.to.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`Sẽ test ${uniquePairs.length} cặp nhắn tin (12 chiều + contacts):\n`);

  const results = [];
  for (const { from, to } of uniquePairs) {
    const others = Object.keys(users).filter((k) => k !== from.key && k !== to.key);
    await testPair(from, to, others, sockets, results);
  }

  // Bảng kết quả
  console.log('\n┌─────────────────────────────────────┬────────┬──────────────────────────────────┐');
  console.log('│ Cặp nhắn tin                        │ Kết quả│ Ghi chú                          │');
  console.log('├─────────────────────────────────────┼────────┼──────────────────────────────────┤');
  for (const r of results) {
    const l = r.label.padEnd(35).slice(0, 35);
    const s = r.status.padEnd(6);
    const n = (r.note || '').padEnd(32).slice(0, 32);
    console.log(`│ ${l} │ ${s} │ ${n} │`);
  }
  console.log('└─────────────────────────────────────┴────────┴──────────────────────────────────┘');

  const failed = results.filter((r) => r.status !== 'OK');
  const duped = results.filter((r) => r.dupCount > 1);

  for (const s of Object.values(sockets)) s.close();

  console.log(`\nTổng: ${results.length} cặp | OK: ${results.length - failed.length} | Lỗi: ${failed.length}`);
  if (duped.length) console.log(`⚠ Trùng tin: ${duped.length} cặp`);
  if (failed.length) {
    console.log('\n❌ ROLEPLAY FAILED');
    process.exit(1);
  }
  console.log('\n✅ ROLEPLAY PASSED — không trùng, không lọt, gửi/nhận OK');
}

run().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
