'use strict';

/**
 * Phase 10 messaging load harness — isolated DB, real server.js, real socket.io-client.
 * Does NOT change MessagingPolicy / pairing / schemas.
 */
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ROOT = path.join(__dirname, '../../..');
require('dotenv').config({ path: path.join(ROOT, '.env') });
const { io } = require(path.join(ROOT, 'node_modules/socket.io-client'));
const { toPhase10Uri } = require('./isolateDbUri');
const { summarize, classifyTier } = require('./stats');

const Branch = require('../../../models/Branch');
const Teacher = require('../../../models/Teacher');
const Student = require('../../../models/Student');
const Message = require('../../../models/Message');

const PREFIX = 'P10LOAD';
const PORT = Number(process.env.PHASE10_PORT || 5020);
const DB_NAME = process.env.PHASE10_DB_NAME || 'dashboardthangtinhoc_p10load';

const ROLE_MIX = {
  student: 0.7,
  teacher: 0.1,
  staff: 0.1,
  support: 0.08,
  admin: 0.02,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function phase10MongoUri() {
  return toPhase10Uri(process.env.MONGODB_URI, DB_NAME);
}

async function connectHarnessDb() {
  const uri = phase10MongoUri();
  if (mongoose.connection.readyState === 1) {
    if (mongoose.connection.name !== DB_NAME) {
      await mongoose.disconnect();
    } else {
      return uri;
    }
  }
  await mongoose.connect(uri);
  return uri;
}

async function resetDatabase() {
  await connectHarnessDb();
  await mongoose.connection.dropDatabase();
}

function roleCounts(total) {
  const counts = {
    student: Math.round(total * ROLE_MIX.student),
    teacher: Math.round(total * ROLE_MIX.teacher),
    staff: Math.round(total * ROLE_MIX.staff),
    support: Math.round(total * ROLE_MIX.support),
    admin: Math.round(total * ROLE_MIX.admin),
  };
  if (total >= 20) {
    counts.support = Math.max(4, counts.support); // ≥1 per branch ideally
    counts.staff = Math.max(4, counts.staff);
    counts.teacher = Math.max(4, counts.teacher);
    counts.admin = Math.max(1, counts.admin);
  }
  let sum = counts.teacher + counts.staff + counts.support + counts.admin;
  counts.student = Math.max(0, total - sum);
  sum = counts.student + counts.teacher + counts.staff + counts.support + counts.admin;
  if (sum !== total) counts.student += total - sum;
  return counts;
}

async function seedDataset(totalUsers) {
  await connectHarnessDb();
  await resetDatabase();
  const password = await bcrypt.hash('P10Load@123', 6);
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();

  const branches = {
    A1: await Branch.create({ name: `${PREFIX} A1`, code: 'P10A1', isActive: true, tenantId: tenantA }),
    A2: await Branch.create({ name: `${PREFIX} A2`, code: 'P10A2', isActive: true, tenantId: tenantA }),
    B1: await Branch.create({ name: `${PREFIX} B1`, code: 'P10B1', isActive: true, tenantId: tenantB }),
    B2: await Branch.create({ name: `${PREFIX} B2`, code: 'P10B2', isActive: true, tenantId: tenantB }),
  };
  const branchList = [branches.A1, branches.A2, branches.B1, branches.B2];

  const counts = roleCounts(totalUsers);
  const actors = [];
  let seq = 0;

  function nextPhone(kind) {
    seq += 1;
    // 10-digit local phones unique within P10 DB
    return `09${String(kind).padStart(1, '0')}${String(seq).padStart(7, '0')}`.slice(0, 10);
  }

  function mapActor(doc, role, adminRole, tenantId, branch) {
    return {
      id: String(doc._id),
      role,
      adminRole: adminRole || null,
      name: doc.name,
      branchId: branch ? String(branch._id) : null,
      branchCode: branch?.code || '',
      tenantId: String(tenantId),
      messagingRole: adminRole === 'STAFF' || adminRole === 'SUPPORT' ? 'staff' : role === 'admin' ? 'admin' : role,
      productRole: adminRole || (role === 'student' ? 'STUDENT' : role === 'teacher' ? 'TEACHER' : 'ADMIN'),
    };
  }

  // Teachers first (students need teacherId)
  const teacherActors = [];
  for (let i = 0; i < counts.teacher; i += 1) {
    const branch = branchList[i % branchList.length];
    const tenantId = branch.tenantId;
    const doc = {
      name: `${PREFIX} Teacher ${i}`,
      phone: nextPhone(1),
      password,
      role: 'teacher',
      status: 'Active',
      branchId: branch._id,
      branchCode: branch.code,
      tokenVersion: 0,
      assignedStudents: [],
    };
    teacherActors.push({ doc, branch, tenantId });
  }
  const teacherDocs = await Teacher.insertMany(teacherActors.map((t) => t.doc), { ordered: true });
  teacherDocs.forEach((doc, i) => {
    actors.push(mapActor(doc, 'teacher', null, teacherActors[i].tenantId, teacherActors[i].branch));
  });

  // Staff / Support / Admin
  const staffish = [];
  for (let i = 0; i < counts.staff; i += 1) {
    const branch = branchList[i % branchList.length];
    staffish.push({
      doc: {
        name: `${PREFIX} Staff ${i}`,
        phone: nextPhone(2),
        password,
        role: 'admin',
        adminRole: 'STAFF',
        status: 'Active',
        branchId: branch._id,
        branchCode: branch.code,
        permissions: ['manage_messages'],
        tokenVersion: 0,
      },
      role: 'admin',
      adminRole: 'STAFF',
      branch,
      tenantId: branch.tenantId,
    });
  }
  for (let i = 0; i < counts.support; i += 1) {
    const branch = branchList[i % branchList.length];
    staffish.push({
      doc: {
        name: `${PREFIX} Support ${i}`,
        phone: nextPhone(3),
        password,
        role: 'admin',
        adminRole: 'SUPPORT',
        status: 'Active',
        branchId: branch._id,
        branchCode: branch.code,
        permissions: ['manage_messages'],
        tokenVersion: 0,
      },
      role: 'admin',
      adminRole: 'SUPPORT',
      branch,
      tenantId: branch.tenantId,
    });
  }
  for (let i = 0; i < counts.admin; i += 1) {
    const branch = branchList[i % branchList.length];
    staffish.push({
      doc: {
        name: `${PREFIX} HighAdmin ${i}`,
        phone: nextPhone(4),
        password,
        role: 'admin',
        adminRole: 'HIGH_ADMIN',
        status: 'Active',
        branchId: branch._id,
        branchCode: branch.code,
        permissions: ['manage_messages', 'manage_users'],
        tokenVersion: 0,
      },
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      branch,
      tenantId: branch.tenantId,
    });
  }
  if (staffish.length) {
    const inserted = await Teacher.insertMany(staffish.map((s) => s.doc), { ordered: true });
    inserted.forEach((doc, i) => {
      actors.push(mapActor(doc, staffish[i].role, staffish[i].adminRole, staffish[i].tenantId, staffish[i].branch));
    });
  }

  // Students
  const studentDocs = [];
  for (let i = 0; i < counts.student; i += 1) {
    const branch = branchList[i % branchList.length];
    const teacher = teacherDocs[i % Math.max(1, teacherDocs.length)];
    const phone = nextPhone(5);
    studentDocs.push({
      name: `${PREFIX} Student ${i}`,
      phone,
      zalo: phone,
      password,
      role: 'student',
      status: 'active',
      branchId: branch._id,
      branchCode: branch.code,
      teacherId: teacher?._id,
      teacherName: teacher?.name || 'P10 Teacher',
      enrollments: teacher
        ? [{ teacherId: teacher._id, courseName: 'P10 Course' }]
        : [],
      course: 'P10 Course',
      paid: true,
      price: 1000000,
      totalSessions: 12,
      remainingSessions: 12,
      tokenVersion: 0,
      __branch: branch,
      __tenantId: branch.tenantId,
    });
  }
  const studentPayload = studentDocs.map(({ __branch, __tenantId, ...rest }) => rest);
  const students = await Student.insertMany(studentPayload, { ordered: true });
  students.forEach((doc, i) => {
    actors.push(mapActor(doc, 'student', null, studentDocs[i].__tenantId, studentDocs[i].__branch));
  });

  // Link teachers ↔ students lightly
  if (teacherDocs.length && students.length) {
    for (let i = 0; i < teacherDocs.length; i += 1) {
      const assigned = students.filter((_, si) => si % teacherDocs.length === i).slice(0, 20).map((s) => s._id);
      await Teacher.updateOne({ _id: teacherDocs[i]._id }, { $set: { assignedStudents: assigned } });
    }
  }

  return {
    actors,
    counts,
    tenants: { A: String(tenantA), B: String(tenantB) },
    branches: {
      A1: String(branches.A1._id),
      A2: String(branches.A2._id),
      B1: String(branches.B1._id),
      B2: String(branches.B2._id),
    },
    totalUsers: actors.length,
  };
}

function mintToken(actor) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  return jwt.sign(
    {
      id: actor.id,
      role: actor.role,
      adminRole: actor.adminRole,
      name: actor.name,
      branchId: actor.branchId,
      branchCode: actor.branchCode,
      permissions: actor.adminRole ? ['manage_messages', 'manage_users'] : [],
      tokenVersion: 0,
      aud: 'public',
    },
    secret,
    { expiresIn: '4h' },
  );
}

function httpJson(method, origin, urlPath, { token, body, headers = {}, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, origin);
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
            : {}),
        },
        timeout: 120000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(raw.toString('utf8') || 'null');
          } catch {
            json = null;
          }
          const setCookie = res.headers['set-cookie'] || [];
          resolve({ status: res.statusCode, json, bytes: raw.length, setCookie });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('http timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function fetchCsrf(origin) {
  const r = await httpJson('GET', origin, '/api/auth/csrf-token');
  const token = r.json?.csrfToken;
  let cookie = '';
  for (const c of r.setCookie || []) {
    const m = String(c).match(/^csrf_token=([^;]+)/);
    if (m) cookie = `csrf_token=${m[1]}`;
  }
  if (!cookie && token) cookie = `csrf_token=${token}`;
  return { token, cookie };
}

async function waitHealth(port, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpJson('GET', `http://127.0.0.1:${port}`, '/healthz');
      if (r.status === 200 && r.json?.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  return false;
}

async function fetchStats(port) {
  try {
    const r = await httpJson('GET', `http://127.0.0.1:${port}`, '/__phase10/stats');
    if (r.status === 200) return r.json;
  } catch {
    /* ignore */
  }
  return null;
}

function startServer(port, mongoUri) {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      MONGODB_URI: mongoUri,
      PHASE10_LOADTEST: '1',
      NODE_ENV: process.env.NODE_ENV || 'development',
      // Keep load test single-node memory adapter explicit
      REDIS_URL: process.env.PHASE10_USE_REDIS === '1' ? process.env.REDIS_URL : '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (d) => {
    const s = String(d);
    logs.push(s);
    if (process.env.PHASE10_VERBOSE === '1') process.stdout.write(s);
  });
  child.stderr.on('data', (d) => {
    const s = String(d);
    logs.push(s);
    if (process.env.PHASE10_VERBOSE === '1') process.stderr.write(s);
  });
  child.__logs = logs;
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  await sleep(800);
  try {
    if (!child.killed) child.kill('SIGKILL');
  } catch {
    /* ignore */
  }
}

function connectClient(actor, origin, { timeoutMs = 45000 } = {}) {
  const token = mintToken(actor);
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const socket = io(origin, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 30000,
      forceNew: true,
    });
    let settled = false;
    const finish = (ok, err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
      if (ok) {
        socket.__connMs = Date.now() - t0;
        resolve(socket);
      } else {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        reject(err || new Error(`connect timeout ${actor.name}`));
      }
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    let fallbackTimer = null;

    socket.__actor = actor;
    socket.__inbox = [];
    socket.__connMs = null;
    socket.__received = [];

    socket.on('message:receive', (p) => {
      socket.__inbox.push({ event: 'message:receive', at: Date.now(), payload: p });
      socket.__received.push(p);
    });

    socket.on('connect_error', (err) => finish(false, err));

    socket.on('connect', () => {
      socket.emit('register', {});
      // Presence broadcast can lag under load — accept connected+registered after grace.
      fallbackTimer = setTimeout(() => {
        if (socket.connected) finish(true);
      }, 4000);
    });

    socket.on('users:online', (list) => {
      const found = (list || []).some(
        (u) => String(u.userId) === actor.id && String(u.role) === actor.messagingRole,
      );
      if (found) finish(true);
    });
  });
}

async function connectMany(actors, origin, { concurrency = 20 } = {}) {
  const sockets = [];
  const failures = [];
  const connMs = [];
  let i = 0;
  async function worker() {
    while (i < actors.length) {
      const idx = i;
      i += 1;
      const actor = actors[idx];
      try {
        const s = await connectClient(actor, origin);
        sockets[idx] = s;
        connMs.push(s.__connMs);
      } catch (err) {
        failures.push({ actor: actor.name, error: String(err.message || err) });
        sockets[idx] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, actors.length) }, () => worker()));
  return {
    sockets: sockets.filter(Boolean),
    failures,
    connection: summarize(connMs),
    connected: sockets.filter(Boolean).length,
    attempted: actors.length,
  };
}

function pickDmPairs(actors, socketsById) {
  const students = actors.filter((a) => a.role === 'student');
  const supports = actors.filter((a) => a.adminRole === 'SUPPORT');
  const pairs = [];
  for (const student of students) {
    const support = supports.find(
      (s) => s.tenantId === student.tenantId && socketsById.has(s.id) && socketsById.has(student.id),
    );
    if (support) pairs.push({ sender: student, receiver: support });
  }
  return pairs;
}

async function runPrivateDmLoad({
  pairs,
  socketsById,
  ratePerSec,
  durationSec,
  marker,
}) {
  const sendLat = [];
  const deliveryLat = [];
  let sendOk = 0;
  let sendFail = 0;
  let deliveryOk = 0;
  let deliveryFail = 0;
  let wrongRecipient = 0;
  let crossTenant = 0;
  let persistedOk = 0;
  let duplicatePersist = 0;

  const intervalMs = Math.max(50, Math.floor(1000 / Math.max(1, ratePerSec)));
  const endAt = Date.now() + durationSec * 1000;
  let seq = 0;
  let pairIdx = 0;

  while (Date.now() < endAt) {
    const pair = pairs[pairIdx % pairs.length];
    pairIdx += 1;
    seq += 1;
    const content = `${marker}|${seq}|${pair.sender.id}->${pair.receiver.id}|${Date.now()}`;
    const senderSocket = socketsById.get(pair.sender.id);
    const receiverSocket = socketsById.get(pair.receiver.id);
    if (!senderSocket || !receiverSocket) {
      sendFail += 1;
      await sleep(intervalMs);
      continue;
    }

    const tSend = Date.now();
    try {
      const sent = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('message:sent timeout')), 12000);
        function onSent(msg) {
          if (msg && String(msg.content) === content) {
            clearTimeout(timer);
            senderSocket.off('message:sent', onSent);
            resolve(msg);
          }
        }
        senderSocket.on('message:sent', onSent);
        senderSocket.emit('message:send', {
          receiverId: pair.receiver.id,
          receiverName: pair.receiver.name,
          receiverRole: pair.receiver.messagingRole,
          content,
          messageType: 'text',
          isGroup: false,
        });
      });
      sendLat.push(Date.now() - tSend);
      sendOk += 1;

      // wait for receive
      try {
        await new Promise((resolve, reject) => {
          const existing = (receiverSocket.__inbox || []).find(
            (e) => e.event === 'message:receive' && e.payload?.content === content,
          );
          if (existing) {
            deliveryLat.push(existing.at - tSend);
            return resolve(existing.payload);
          }
          const timer = setTimeout(() => reject(new Error('delivery timeout')), 8000);
          function onMsg(payload) {
            if (payload?.content === content) {
              clearTimeout(timer);
              receiverSocket.off('message:receive', onMsg);
              deliveryLat.push(Date.now() - tSend);
              resolve(payload);
            }
          }
          receiverSocket.on('message:receive', onMsg);
        });
        deliveryOk += 1;
      } catch {
        deliveryFail += 1;
      }

      // Isolation sample (~every message, but only scan a capped witness set)
      const witnesses = [];
      for (const [uid, sock] of socketsById.entries()) {
        if (uid === pair.receiver.id || uid === pair.sender.id) continue;
        witnesses.push(sock);
        if (witnesses.length >= 40) break;
      }
      for (const sock of witnesses) {
        const leak = (sock.__inbox || []).some(
          (e) => e.event === 'message:receive' && e.payload?.content === content,
        );
        if (leak) {
          wrongRecipient += 1;
          const actor = sock.__actor;
          if (actor && actor.tenantId !== pair.sender.tenantId) crossTenant += 1;
        }
      }

      if (seq % 10 === 0) {
        const afterCount = await Message.countDocuments({ content });
        if (afterCount >= 1) persistedOk += 1;
        if (afterCount > 1) duplicatePersist += afterCount - 1;
      } else if (sent?._id) {
        persistedOk += 1;
      }
      void sent;
    } catch {
      sendFail += 1;
    }

    await sleep(intervalMs);
  }

  return {
    sendOk,
    sendFail,
    deliveryOk,
    deliveryFail,
    wrongRecipient,
    crossTenant,
    persistedOk,
    duplicatePersist,
    sendLatency: summarize(sendLat),
    deliveryLatency: summarize(deliveryLat),
    messagesAttempted: sendOk + sendFail,
  };
}

async function sampleProcess(pid) {
  // Windows-friendly via wmic/powershell is heavy; prefer /__phase10/stats
  return { pid };
}

module.exports = {
  PREFIX,
  PORT,
  DB_NAME,
  ROLE_MIX,
  sleep,
  phase10MongoUri,
  connectHarnessDb,
  resetDatabase,
  seedDataset,
  mintToken,
  httpJson,
  fetchCsrf,
  waitHealth,
  fetchStats,
  startServer,
  stopServer,
  connectClient,
  connectMany,
  pickDmPairs,
  runPrivateDmLoad,
  summarize,
  classifyTier,
  sampleProcess,
  Message,
  mongoose,
};