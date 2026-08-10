/**
 * Phase 8 — Live messaging runtime helpers.
 * Seeds Mongo fixtures + boots real server.js + socket.io-client clients.
 * Does NOT mock notifyUser / sendCanonicalMessage / Socket rooms.
 */
'use strict';

const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ROOT = path.join(__dirname, '../..');
const { io } = require(path.join(ROOT, 'node_modules/socket.io-client'));

const Branch = require('../../models/Branch');
const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');
const Message = require('../../models/Message');

const PREFIX = 'P8LIVE';
const PHONES = {
  studentA: '0988110001',
  studentB: '0988110002',
  teacherA: '0988110011',
  staffA: '0988110021',
  staffB: '0988110022',
  supportA: '0988110031',
  supportB: '0988110032',
};

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHealth(port, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/healthz', timeout: 2000 }, (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      if (ok) return true;
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  return false;
}

async function cleanupFixtures() {
  await Student.deleteMany({ phone: { $in: [...Object.values(PHONES), '0988110099'] } });
  await Teacher.deleteMany({ phone: { $in: [...Object.values(PHONES), '0988110099'] } });
  await Branch.deleteMany({ code: { $in: ['P8A', 'P8B', 'P8X'] } });
}

async function seedFixtures() {
  await cleanupFixtures();
  const password = await bcrypt.hash('P8Live@123', 8);

  const branchA = await Branch.create({
    name: `${PREFIX} Branch A`,
    code: 'P8A',
    isActive: true,
    tenantId: TENANT_A,
  });
  const branchB = await Branch.create({
    name: `${PREFIX} Branch B`,
    code: 'P8B',
    isActive: true,
    tenantId: TENANT_A,
  });
  const branchX = await Branch.create({
    name: `${PREFIX} Branch X TenantB`,
    code: 'P8X',
    isActive: true,
    tenantId: TENANT_B,
  });

  const teacherA = await Teacher.create({
    name: `${PREFIX} Teacher A`,
    phone: PHONES.teacherA,
    password,
    role: 'teacher',
    status: 'Active',
    branchId: branchA._id,
    branchCode: 'P8A',
    tokenVersion: 0,
  });

  const staffA = await Teacher.create({
    name: `${PREFIX} Staff A`,
    phone: PHONES.staffA,
    password,
    role: 'admin',
    adminRole: 'STAFF',
    status: 'Active',
    branchId: branchA._id,
    branchCode: 'P8A',
    permissions: ['manage_messages'],
    tokenVersion: 0,
  });

  const staffB = await Teacher.create({
    name: `${PREFIX} Staff B`,
    phone: PHONES.staffB,
    password,
    role: 'admin',
    adminRole: 'STAFF',
    status: 'Active',
    branchId: branchB._id,
    branchCode: 'P8B',
    permissions: ['manage_messages'],
    tokenVersion: 0,
  });

  const supportA = await Teacher.create({
    name: `${PREFIX} Support A`,
    phone: PHONES.supportA,
    password,
    role: 'admin',
    adminRole: 'SUPPORT',
    status: 'Active',
    branchId: branchA._id,
    branchCode: 'P8A',
    permissions: ['manage_messages'],
    tokenVersion: 0,
  });

  const supportB = await Teacher.create({
    name: `${PREFIX} Support B`,
    phone: PHONES.supportB,
    password,
    role: 'admin',
    adminRole: 'SUPPORT',
    status: 'Active',
    branchId: branchB._id,
    branchCode: 'P8B',
    permissions: ['manage_messages'],
    tokenVersion: 0,
  });

  const studentA = await Student.create({
    name: `${PREFIX} Student A`,
    phone: PHONES.studentA,
    zalo: PHONES.studentA,
    password,
    role: 'student',
    status: 'active',
    branchId: branchA._id,
    branchCode: 'P8A',
    teacherId: teacherA._id,
    teacherName: teacherA.name,
    enrollments: [{ teacherId: teacherA._id, courseName: 'P8 Course' }],
    course: 'P8 Course',
    paid: true,
    price: 1000000,
    totalSessions: 12,
    remainingSessions: 12,
    tokenVersion: 0,
  });

  const studentB = await Student.create({
    name: `${PREFIX} Student B`,
    phone: PHONES.studentB,
    zalo: PHONES.studentB,
    password,
    role: 'student',
    status: 'active',
    branchId: branchB._id,
    branchCode: 'P8B',
    teacherId: teacherA._id,
    teacherName: teacherA.name,
    enrollments: [{ teacherId: teacherA._id, courseName: 'P8 Course' }],
    course: 'P8 Course',
    paid: true,
    price: 1000000,
    totalSessions: 12,
    remainingSessions: 12,
    tokenVersion: 0,
  });

  // Cross-tenant support (tenant B) — for DENY tests; reuse support phone pattern via new doc
  const supportTenantB = await Teacher.create({
    name: `${PREFIX} Support TenantB`,
    phone: '0988110099',
    password,
    role: 'admin',
    adminRole: 'SUPPORT',
    status: 'Active',
    branchId: branchX._id,
    branchCode: 'P8X',
    permissions: ['manage_messages'],
    tokenVersion: 0,
  });

  teacherA.assignedStudents = [studentA._id];
  await teacherA.save();

  const actors = {
    studentA: mapActor(studentA, 'student', null, TENANT_A),
    studentB: mapActor(studentB, 'student', null, TENANT_A),
    teacherA: mapActor(teacherA, 'teacher', null, TENANT_A),
    staffA: mapActor(staffA, 'admin', 'STAFF', TENANT_A),
    staffB: mapActor(staffB, 'admin', 'STAFF', TENANT_A),
    supportA: mapActor(supportA, 'admin', 'SUPPORT', TENANT_A),
    supportB: mapActor(supportB, 'admin', 'SUPPORT', TENANT_A),
    supportTenantB: mapActor(supportTenantB, 'admin', 'SUPPORT', TENANT_B),
  };

  return {
    actors,
    branches: { branchA, branchB, branchX },
    tenants: { TENANT_A: String(TENANT_A), TENANT_B: String(TENANT_B) },
  };
}

function mapActor(doc, role, adminRole, tenantId) {
  return {
    id: String(doc._id),
    role,
    adminRole: adminRole || null,
    name: doc.name,
    branchId: doc.branchId ? String(doc.branchId) : null,
    branchCode: doc.branchCode || '',
    tenantId: tenantId ? String(tenantId) : null,
    messagingRole: adminRole === 'STAFF' || adminRole === 'SUPPORT' ? 'staff' : role,
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
      permissions: actor.adminRole ? ['manage_messages'] : [],
      tokenVersion: 0,
      aud: actor.role === 'student' ? 'public' : 'public',
    },
    secret,
    { expiresIn: '2h' },
  );
}

function connectClient(actor, origin) {
  const token = mintToken(actor);
  return new Promise((resolve, reject) => {
    const socket = io(origin, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 15000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`socket timeout ${actor.name}`));
    }, 20000);

    const inbox = [];
    socket.__inbox = inbox;
    socket.__actor = actor;
    socket.on('message:receive', (p) => inbox.push({ event: 'message:receive', at: Date.now(), payload: p }));
    socket.on('typing:start', (p) => inbox.push({ event: 'typing:start', at: Date.now(), payload: p }));
    socket.on('typing:stop', (p) => inbox.push({ event: 'typing:stop', at: Date.now(), payload: p }));
    socket.on('message:read', (p) => inbox.push({ event: 'message:read', at: Date.now(), payload: p }));

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on('connect', () => {
      socket.emit('register', {});
    });

    socket.on('users:online', (list) => {
      const found = (list || []).some(
        (u) => String(u.userId) === actor.id && String(u.role) === actor.messagingRole,
      );
      if (found) {
        clearTimeout(timer);
        resolve(socket);
      }
    });
  });
}

function waitReceive(socket, predicate, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const existing = (socket.__inbox || []).find(
      (e) => e.event === 'message:receive' && predicate(e.payload),
    );
    if (existing) return resolve(existing.payload);

    const timer = setTimeout(() => {
      socket.off('message:receive', onMsg);
      reject(new Error(`timeout message:receive for ${socket.__actor?.name}`));
    }, timeoutMs);

    function onMsg(payload) {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off('message:receive', onMsg);
        resolve(payload);
      }
    }
    socket.on('message:receive', onMsg);
  });
}

function assertNoReceive(socket, predicate, waitMs = 1500) {
  return new Promise((resolve, reject) => {
    const hit = (socket.__inbox || []).find(
      (e) => e.event === 'message:receive' && predicate(e.payload),
    );
    if (hit) {
      reject(new Error(`LEAK: ${socket.__actor?.name} already has message`));
      return;
    }
    const timer = setTimeout(() => {
      socket.off('message:receive', onMsg);
      resolve();
    }, waitMs);
    function onMsg(payload) {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off('message:receive', onMsg);
        reject(new Error(`LEAK: ${socket.__actor?.name} received private DM`));
      }
    }
    socket.on('message:receive', onMsg);
  });
}

function sendViaSocket(senderSocket, receiver, content, extra = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      senderSocket.off('message:sent', onSent);
      reject(new Error(`timeout message:sent from ${senderSocket.__actor?.name}`));
    }, 10000);

    function onSent(msg) {
      if (msg && String(msg.content) === String(content)) {
        clearTimeout(timer);
        senderSocket.off('message:sent', onSent);
        resolve(msg);
      }
    }
    senderSocket.on('message:sent', onSent);
    senderSocket.emit('message:send', {
      receiverId: receiver.id,
      receiverName: receiver.name,
      receiverRole: extra.receiverRole || receiver.messagingRole || receiver.role,
      content,
      messageType: 'text',
      isGroup: false,
    });
  });
}

async function countMessagesByContent(content) {
  return Message.countDocuments({ content });
}

function startServer(port) {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
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
  await sleep(500);
  try {
    if (!child.killed) child.kill('SIGKILL');
  } catch {
    /* ignore */
  }
}

module.exports = {
  PREFIX,
  PHONES,
  TENANT_A,
  TENANT_B,
  sleep,
  waitHealth,
  cleanupFixtures,
  seedFixtures,
  mintToken,
  connectClient,
  waitReceive,
  assertNoReceive,
  sendViaSocket,
  countMessagesByContent,
  startServer,
  stopServer,
  Message,
  mongoose,
};
