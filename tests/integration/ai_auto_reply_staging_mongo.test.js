'use strict';

/**
 * Staging / Real MongoDB E2E Integration Test for DewSkill AI Auto-Reply:
 * - Boots a real Express HTTP + Socket.IO server against an isolated `_test` database
 * - Tests HTTP RBAC, scheduling, human reply cancellation, concurrent execution CAS + unique index,
 *   and real watcher/process restart recovery over Socket.IO.
 *
 * Requires NODE_ENV=test and TEST_DATABASE_URI pointing to a `_test` database.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const TEST_DB = String(process.env.TEST_DATABASE_URI || '').trim();
const hasTestDb = /^test_|_test$/i.test(
  (() => {
    try {
      return decodeURIComponent(new URL(TEST_DB).pathname.replace(/^\/+|\/+$/g, ''));
    } catch {
      return '';
    }
  })(),
);

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

const { assertTestDatabaseEnvironment } = require('../setup/testDatabaseGuard');
const Student = require('../../models/Student');
const Teacher = require('../../models/Teacher');
const Message = require('../../models/Message');
const SystemSettings = require('../../models/SystemSettings');
const ConversationAiAutoReply = require('../../models/ConversationAiAutoReply');
const AiAutoReplyTask = require('../../models/AiAutoReplyTask');
const messageRoutes = require('../../routes/messageRoutes');
const aiAutoReplyService = require('../../services/aiAutoReplyService');

function signToken(user) {
  return jwt.sign({
    id: user.id,
    role: user.role,
    adminRole: user.adminRole || null,
    name: user.name,
    branchCode: user.branchCode || 'CN1',
    tokenVersion: 0,
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function reqJson(baseUrl, path, { method = 'GET', token = '', body = null } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

test('Staging MongoDB E2E: AI Auto-Reply concurrency, human cancel, RBAC & restart recovery', { skip: !hasTestDb }, async (t) => {
  assertTestDatabaseEnvironment(process.env);
  await mongoose.connect(TEST_DB);

  let server = null;
  let io = null;
  let teacherSock = null;
  let studentSock = null;

  t.after(async () => {
    aiAutoReplyService.stopAiAutoReplyWatcher();
    aiAutoReplyService._resetTestHooks();
    try { teacherSock?.disconnect(); } catch { /* ignore */ }
    try { studentSock?.disconnect(); } catch { /* ignore */ }
    try { io?.close(); } catch { /* ignore */ }
    try { server?.closeAllConnections?.(); } catch { /* ignore */ }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      await Promise.all([
        Student.deleteMany({}),
        Teacher.deleteMany({}),
        Message.deleteMany({}),
        SystemSettings.deleteMany({}),
        ConversationAiAutoReply.deleteMany({}),
        AiAutoReplyTask.deleteMany({}),
      ]);
    } catch { /* ignore */ }
    await mongoose.connection.close();
  });

  await Promise.all([
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    Message.deleteMany({}),
    SystemSettings.deleteMany({}),
    ConversationAiAutoReply.deleteMany({}),
    AiAutoReplyTask.deleteMany({}),
  ]);
  await Message.syncIndexes();
  await AiAutoReplyTask.syncIndexes();
  await ConversationAiAutoReply.syncIndexes();

  const teacher = await Teacher.create({
    name: 'Cô Lan Staging',
    phone: '0901112233',
    password: 'StagingPass123!',
    role: 'teacher',
    status: 'active',
    branchCode: 'CN1',
  });
  const student = await Student.create({
    name: 'Học Viên Staging',
    phone: '0904445566',
    zalo: '0904445566',
    password: 'StagingPass123!',
    course: 'Excel 365',
    price: 2500000,
    role: 'student',
    status: 'active',
    branchCode: 'CN1',
    enrollments: [{
      courseName: 'Excel 365',
      teacherId: teacher._id,
      teacherName: teacher.name,
      price: 2500000,
      status: 'active',
    }],
  });

  const teacherToken = signToken({ id: String(teacher._id), role: 'teacher', name: teacher.name, branchCode: 'CN1' });
  const studentToken = signToken({ id: String(student._id), role: 'student', name: student.name, branchCode: 'CN1' });
  const adminToken = signToken({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', name: 'Admin Root' });
  const convId = [`student_${student._id}`, `teacher_${teacher._id}`].sort().join('__');

  const app = express();
  app.use(express.json());
  server = http.createServer(app);
  io = new Server(server, { cors: { origin: '*' } });
  io.use((socket, next) => {
    try {
      const tok = socket.handshake?.auth?.token;
      socket.user = jwt.verify(tok, process.env.JWT_SECRET);
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const uid = String(socket.user?.id || '');
    if (uid) socket.join(uid);
    if (socket.user?.role === 'admin') socket.join('ALL_ADMIN');
  });
  app.set('io', io);
  app.notifyUser = (role, userId, eventName, data) => {
    const target = String(userId);
    if (target === 'admin') io.to('admin').to('ALL_ADMIN').emit(eventName, data);
    else io.to(target).emit(eventName, data);
    return true;
  };
  app.use('/api/messages', messageRoutes);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/messages`;

  const connectClient = (token) => new Promise((resolve, reject) => {
    const client = ioClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'] });
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });

  teacherSock = await connectClient(teacherToken);
  studentSock = await connectClient(studentToken);
  const teacherEvents = [];
  const studentEvents = [];
  teacherSock.on('message:receive', (d) => teacherEvents.push({ ev: 'message:receive', d }));
  teacherSock.on('ai-auto-reply:status', (d) => teacherEvents.push({ ev: 'ai-auto-reply:status', d }));
  studentSock.on('message:receive', (d) => studentEvents.push({ ev: 'message:receive', d }));
  studentSock.on('ai-auto-reply:status', (d) => studentEvents.push({ ev: 'ai-auto-reply:status', d }));

  aiAutoReplyService._setTestHooks({
    delayScaleMs: 1,
    generateReply: async ({ question }) => ({
      needsHuman: false,
      content: `DewSkill AI Staging phản hồi cho: ${question}`,
      knowledgeReferences: [{ docId: 'rag-1', docTitle: 'Tài liệu Excel', location: 'Mục 1', score: 8.2 }],
      model: 'gemini-3.5-flash-lite',
    }),
  });

  // 1. Student blocked 403 from config & global
  const forbiddenStu = await reqJson(baseUrl, `/ai-auto-reply/${encodeURIComponent(convId)}`, {
    method: 'PUT',
    token: studentToken,
    body: { enabled: true, delayMinutes: 5 },
  });
  assert.equal(forbiddenStu.status, 403);

  // 2. Teacher enables AI Auto-Reply (delayMinutes = 1 -> 1ms in test scale)
  const cfgRes = await reqJson(baseUrl, `/ai-auto-reply/${encodeURIComponent(convId)}`, {
    method: 'PUT',
    token: teacherToken,
    body: { enabled: true, delayMinutes: 1 },
  });
  assert.equal(cfgRes.status, 200);
  assert.equal(cfgRes.json.data.enabled, true);

  // 3. Student sends message -> pending task created in MongoDB; simulate concurrent double execution
  const sendStu = await reqJson(baseUrl, '', {
    method: 'POST',
    token: studentToken,
    body: { receiverId: String(teacher._id), receiverRole: 'teacher', content: 'Hàm INDEX MATCH dùng như thế nào ạ?' },
  });
  assert.equal(sendStu.status, 201);
  await new Promise((r) => setTimeout(r, 40));

  const tasks = await AiAutoReplyTask.find({ conversationId: convId, status: 'pending' }).lean();
  assert.equal(tasks.length, 1);

  const [c1, c2] = await Promise.all([
    aiAutoReplyService.executeAutoReplyTask(String(tasks[0]._id), { io, notifyUser: app.notifyUser }),
    aiAutoReplyService.executeAutoReplyTask(String(tasks[0]._id), { io, notifyUser: app.notifyUser }),
  ]);
  assert.equal([c1.ok, c2.ok].filter(Boolean).length, 1);
  await new Promise((r) => setTimeout(r, 120));

  const aiDbMsgs = await Message.find({ conversationId: convId, senderType: 'ai' }).lean();
  assert.equal(aiDbMsgs.length, 1);
  assert.equal(aiDbMsgs[0].senderName, 'DewSkill AI');
  assert.ok(teacherEvents.some((e) => e.ev === 'message:receive' && e.d.senderType === 'ai'));
  assert.ok(studentEvents.some((e) => e.ev === 'message:receive' && e.d.senderType === 'ai'));
  assert.equal(studentEvents.some((e) => e.ev === 'ai-auto-reply:status'), false);

  // 4. Restart recovery test: create overdue pending task, simulate watcher restart, verify execution
  aiAutoReplyService._setTestHooks({ delayScaleMs: 60_000 });
  const sendStu2 = await reqJson(baseUrl, '', {
    method: 'POST',
    token: studentToken,
    body: { receiverId: String(teacher._id), receiverRole: 'teacher', content: 'Em hỏi thêm về PivotTable sau restart' },
  });
  assert.equal(sendStu2.status, 201);
  await AiAutoReplyTask.updateMany({ status: 'pending' }, { $set: { dueAt: new Date(Date.now() - 2000) } });

  aiAutoReplyService.stopAiAutoReplyWatcher();
  const recovery = await aiAutoReplyService.recoverPendingAutoReplyTasks({ io, notifyUser: app.notifyUser, requeueFuture: false });
  assert.equal(recovery.executedCount, 1);
  assert.equal(await Message.countDocuments({ conversationId: convId, senderType: 'ai' }), 2);

  // 5. Admin updates maxConsecutiveReplies; human cancel test: student sends message with long wait, teacher replies manually -> cancelled
  const globalCfgRes = await reqJson(baseUrl, '/ai-auto-reply/global', {
    method: 'PUT',
    token: adminToken,
    body: { enabled: true, maxConsecutiveReplies: 5 },
  });
  assert.equal(globalCfgRes.status, 200);

  await reqJson(baseUrl, `/ai-auto-reply/${encodeURIComponent(convId)}`, {
    method: 'PUT',
    token: teacherToken,
    body: { enabled: true, delayMinutes: 15 },
  });
  const sendStu3 = await reqJson(baseUrl, '', {
    method: 'POST',
    token: studentToken,
    body: { receiverId: String(teacher._id), receiverRole: 'teacher', content: 'Cô ơi xem giúp em công thức SUMIF ạ' },
  });
  assert.equal(sendStu3.status, 201);
  assert.equal(await AiAutoReplyTask.countDocuments({ conversationId: convId, status: 'pending' }), 1);

  const teacherReply = await reqJson(baseUrl, '', {
    method: 'POST',
    token: teacherToken,
    body: { receiverId: String(student._id), receiverRole: 'student', content: 'Cô hướng dẫn ngay đây nhé!' },
  });
  assert.equal(teacherReply.status, 201);
  assert.equal(await AiAutoReplyTask.countDocuments({ conversationId: convId, status: 'pending' }), 0);

  // 6. Admin history & instant global kill-switch check
  const sendStu4 = await reqJson(baseUrl, '', {
    method: 'POST',
    token: studentToken,
    body: { receiverId: String(teacher._id), receiverRole: 'teacher', content: 'Em hỏi thêm hàm COUNTIFS ạ' },
  });
  assert.equal(sendStu4.status, 201);
  assert.equal(await AiAutoReplyTask.countDocuments({ conversationId: convId, status: 'pending' }), 1);

  const killRes = await reqJson(baseUrl, '/ai-auto-reply/global', {
    method: 'PUT',
    token: adminToken,
    body: { enabled: false },
  });
  assert.equal(killRes.status, 200);
  assert.equal(killRes.json.data.cancelledPendingCount, 1);
  assert.equal(await AiAutoReplyTask.countDocuments({ conversationId: convId, status: 'pending' }), 0);

  const teacherLockedRes = await reqJson(baseUrl, `/ai-auto-reply/${encodeURIComponent(convId)}`, {
    method: 'PUT',
    token: teacherToken,
    body: { enabled: true, delayMinutes: 5 },
  });
  assert.equal(teacherLockedRes.status, 403);

  const hist = await reqJson(baseUrl, '/ai-auto-reply/history', { token: adminToken });
  assert.equal(hist.status, 200);
  assert.ok((hist.json.data?.items || []).length >= 4);
});
