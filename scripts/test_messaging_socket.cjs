/**
 * Socket.io realtime messaging smoke test.
 *
 * Requires: backend running, MongoDB, seeded test accounts (tests/seed_test_accounts.js)
 *
 * Env:
 *   API_ORIGIN=http://localhost:5000
 *   ADMIN_IDENTIFIER=admin  ADMIN_PASSWORD=admin123
 *   STAFF_IDENTIFIER=0920000010  STAFF_PASSWORD=Test@123
 *   TEACHER_IDENTIFIER=0910000010 TEACHER_PASSWORD=Test@123
 *   STUDENT_IDENTIFIER=0900000010 STUDENT_PASSWORD=Test@123
 */
const path = require('path');
const axios = require('axios');
const { io } = require(path.join(__dirname, '../client/node_modules/socket.io-client'));
const { getMessagingRole } = require('../utils/messagingRoles');

const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000';
const SOCKET_ORIGIN = API_ORIGIN;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(identifier, password, roleHint) {
  const res = await axios.post(`${API_ORIGIN}/api/auth/login`, {
    identifier, password, role: roleHint,
  }, { timeout: 15_000 });
  if (!res.data?.success) throw new Error(res.data?.message || 'login failed');
  const wrapper = res.data.data || {};
  const data = wrapper.user ? { ...wrapper.user, ...wrapper } : wrapper;
  const accessToken = wrapper.accessToken || data.accessToken;
  return {
    id: String(data.id || data._id),
    role: data.role,
    adminRole: data.adminRole,
    name: data.name,
    accessToken,
    messagingRole: getMessagingRole({
      id: data.id || data._id,
      role: data.role,
      adminRole: data.adminRole,
    }),
  };
}

function connectSocket(user) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_ORIGIN, {
      auth: { token: user.accessToken },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000,
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`socket connect timeout: ${user.messagingRole}_${user.id}`));
    }, 12_000);

    socket.on('connect', () => {
      socket.emit('register', {});
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Wait until we appear in users:online with correct messaging role
    socket.on('users:online', (list) => {
      const found = list.some(
        (u) => String(u.userId) === String(user.id) && String(u.role) === String(user.messagingRole)
      );
      if (found) {
        clearTimeout(timer);
        resolve(socket);
      }
    });
  });
}

function waitForEvent(socket, event, predicate, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting ${event}`));
    }, timeoutMs);

    function handler(payload) {
      if (!predicate || predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    }

    socket.on(event, handler);
  });
}

async function sendMessage(sender, receiver, content) {
  const res = await axios.post(`${API_ORIGIN}/api/messages`, {
    receiverId: receiver.id,
    receiverName: receiver.name || receiver.id,
    receiverRole: receiver.messagingRole || receiver.role,
    content,
    isGroup: false,
    messageType: 'text',
  }, {
    headers: { Authorization: `Bearer ${sender.accessToken}` },
    timeout: 15_000,
  });
  if (!res.data?.success) throw new Error(res.data?.message || 'send failed');
  return res.data.data;
}

async function runCase(label, { sender, receiver, sockets, leakSockets }) {
  console.log(`\n→ ${label}`);
  const content = `[socket:${label}] ${Date.now()}`;

  const receivePromise = waitForEvent(
    sockets[receiver.key],
    'message:receive',
    (p) => p.content === content,
    10_000
  );

  const leakChecks = leakSockets
    .filter((k) => k !== receiver.key)
    .map((key) => waitForEvent(
      sockets[key],
      'message:receive',
      (p) => p.content === content,
      2_000
    ).then(() => { throw new Error(`LEAK: ${key} received message meant for ${receiver.key}`); })
      .catch((e) => {
        if (String(e.message || '').startsWith('LEAK:')) throw e;
      }));

  const sent = await sendMessage(sender, receiver, content);
  const payload = await receivePromise;
  await Promise.all(leakChecks);

  if (String(payload.senderId) !== String(sender.id)) {
    throw new Error(`wrong senderId on receive: ${payload.senderId}`);
  }
  if (String(payload.receiverId) !== String(receiver.id)) {
    throw new Error(`wrong receiverId on receive: ${payload.receiverId}`);
  }

  console.log(`✅ ok (${receiver.key} received, no leak)`);
}

async function run() {
  const admin = await login(
    process.env.ADMIN_IDENTIFIER || 'admin',
    process.env.ADMIN_PASSWORD || 'admin123',
    'admin'
  );
  const staff = await login(
    process.env.STAFF_IDENTIFIER || '0920000010',
    process.env.STAFF_PASSWORD || 'Test@123',
    'admin'
  );
  const teacher = await login(
    process.env.TEACHER_IDENTIFIER || '0910000010',
    process.env.TEACHER_PASSWORD || 'Test@123',
    'teacher'
  );
  const student = await login(
    process.env.STUDENT_IDENTIFIER || '0900000010',
    process.env.STUDENT_PASSWORD || 'Test@123',
    'student'
  );

  for (const u of [admin, staff, teacher, student]) {
    u.key = `${u.messagingRole}_${u.id}`;
    console.log(`login ${u.key} (jwt role=${u.role})`);
  }

  const sockets = {};
  for (const u of [admin, staff, teacher, student]) {
    sockets[u.key] = await connectSocket(u);
    console.log(`socket connected ${u.key}`);
  }

  await sleep(500);

  const allKeys = Object.keys(sockets);

  await runCase('admin->teacher', {
    sender: admin,
    receiver: teacher,
    sockets,
    leakSockets: allKeys,
  });

  await runCase('admin->staff', {
    sender: admin,
    receiver: staff,
    sockets,
    leakSockets: allKeys,
  });

  await runCase('staff->teacher', {
    sender: staff,
    receiver: teacher,
    sockets,
    leakSockets: allKeys,
  });

  await runCase('teacher->student', {
    sender: teacher,
    receiver: student,
    sockets,
    leakSockets: allKeys,
  });

  await runCase('student->teacher', {
    sender: student,
    receiver: teacher,
    sockets,
    leakSockets: allKeys,
  });

  await runCase('staff->admin', {
    sender: staff,
    receiver: admin,
    sockets,
    leakSockets: allKeys,
  });

  // Privacy: HV nhắn staff — super admin không được nhận realtime
  console.log('\n→ privacy: student->staff (super admin must NOT receive)');
  const privacyContent = `[socket:privacy-student-staff] ${Date.now()}`;
  const privacyReceive = waitForEvent(
    sockets[staff.key],
    'message:receive',
    (p) => p.content === privacyContent,
    10_000
  );
  const privacyLeak = waitForEvent(
    sockets[admin.key],
    'message:receive',
    (p) => p.content === privacyContent,
    2_500
  ).then(() => { throw new Error('LEAK: super admin received student-staff message'); })
    .catch((e) => {
      if (String(e.message || '').startsWith('LEAK:')) throw e;
    });
  await sendMessage(student, staff, privacyContent);
  await privacyReceive;
  await privacyLeak;
  console.log('✅ privacy ok (only staff received)');

  for (const s of Object.values(sockets)) s.close();

  console.log('\n✅ Socket messaging matrix PASSED');
}

run().catch((e) => {
  console.error('\n❌ Socket messaging matrix FAILED');
  console.error(e?.message || e);
  process.exit(1);
});
