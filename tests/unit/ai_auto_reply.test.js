'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const Message = require('../../models/Message');
const Student = require('../../models/Student');
const AuditLog = require('../../models/AuditLog');
const SystemSettings = require('../../models/SystemSettings');
const ConversationAiAutoReply = require('../../models/ConversationAiAutoReply');
const AiAutoReplyTask = require('../../models/AiAutoReplyTask');
const knowledgeSearchService = require('../../services/ai/knowledgeSearchService');
const directMessageService = require('../../services/directMessageService');
const aiAutoReplyService = require('../../services/aiAutoReplyService');

const oid = (hexChar) => String(hexChar).repeat(24);
const STUDENT_ID = oid('1');
const STUDENT_2_ID = oid('2');
const TEACHER_ID = oid('a');
const OTHER_TEACHER_ID = oid('b');
const CONV_ID = `student_${STUDENT_ID}__teacher_${TEACHER_ID}`;
const CONV_ADMIN_ID = `admin_admin__student_${STUDENT_ID}`;

/**
 * In-memory deterministic Mongoose store for all 15 unit/contract scenarios.
 */
function installInMemoryStore() {
  const settingsDocs = [{
    _key: 'main',
    aiAutoReplyGlobal: {
      enabled: true,
      defaultDelayMinutes: 5,
      allowTeacherToggle: true,
      maxConsecutiveReplies: 2,
      maxDailyRepliesPerConversation: 10,
      updatedBy: 'admin',
      updatedByName: 'Admin',
      updatedAt: new Date(),
    },
  }];
  const convDocs = [];
  const taskDocs = [];
  const messageDocs = [];
  const idempotencyKeys = new Set();

  const matchesSimpleFilter = (doc, filter = {}) => {
    for (const [k, cond] of Object.entries(filter || {})) {
      if (k === '$or') {
        if (!Array.isArray(cond) || !cond.some((sub) => matchesSimpleFilter(doc, sub))) return false;
        continue;
      }
      if (k === '$and') {
        if (!Array.isArray(cond) || !cond.every((sub) => matchesSimpleFilter(doc, sub))) return false;
        continue;
      }
      const val = k.includes('.')
        ? k.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), doc)
        : doc[k];
      if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond) && !(cond instanceof mongoose.Types.ObjectId)) {
        if ('$in' in cond && !cond.$in.map(String).includes(String(val))) return false;
        if ('$nin' in cond && cond.$nin.map(String).includes(String(val))) return false;
        if ('$ne' in cond && String(val) === String(cond.$ne)) return false;
        if ('$gt' in cond && !(new Date(val).getTime() > new Date(cond.$gt).getTime())) return false;
        if ('$lte' in cond && !(new Date(val).getTime() <= new Date(cond.$lte).getTime())) return false;
        if ('$lt' in cond && !(new Date(val).getTime() < new Date(cond.$lt).getTime())) return false;
      } else if (String(val) !== String(cond)) {
        return false;
      }
    }
    return true;
  };

  const wrapQuery = (rows) => {
    let sortSpec = null;
    let limitNum = null;
    const exec = async () => {
      let out = [...rows];
      if (sortSpec) {
        out.sort((a, b) => {
          for (const [field, dir] of Object.entries(sortSpec)) {
            const av = a[field] instanceof Date ? a[field].getTime() : String(a[field] || '');
            const bv = b[field] instanceof Date ? b[field].getTime() : String(b[field] || '');
            if (av !== bv) return dir < 0 ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
          }
          return 0;
        });
      }
      if (limitNum != null) out = out.slice(0, limitNum);
      return out.map((r) => ({ ...r }));
    };
    return {
      select() { return this; },
      sort(s) { sortSpec = s; return this; },
      limit(n) { limitNum = n; return this; },
      skip() { return this; },
      lean() { return exec(); },
      then(resolve, reject) { return exec().then(resolve, reject); },
    };
  };

  const wrapSingleQuery = (row) => {
    const exec = async () => (row ? { ...row } : null);
    return {
      select() { return this; },
      sort() { return this; },
      lean() { return exec(); },
      then(resolve, reject) { return exec().then(resolve, reject); },
    };
  };

  const applyUpdate = (target, update = {}) => {
    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        target[k] = v;
      }
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        target[k] = (Number(target[k]) || 0) + Number(v);
      }
    }
    if (update.$addToSet) {
      for (const [k, v] of Object.entries(update.$addToSet)) {
        if (!Array.isArray(target[k])) target[k] = [];
        if (!target[k].includes(v)) target[k].push(v);
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(target[k])) target[k] = [];
        const items = Array.isArray(v?.$each) ? v.$each : [v];
        target[k].push(...items);
        if (typeof v?.$slice === 'number' && v.$slice < 0) {
          target[k] = target[k].slice(v.$slice);
        }
      }
    }
  };

  const originals = {
    settingsFindOne: SystemSettings.findOne,
    settingsFindOneAndUpdate: SystemSettings.findOneAndUpdate,
    convFindOne: ConversationAiAutoReply.findOne,
    convFindOneAndUpdate: ConversationAiAutoReply.findOneAndUpdate,
    convUpdateOne: ConversationAiAutoReply.updateOne,
    convFind: ConversationAiAutoReply.find,
    taskFind: AiAutoReplyTask.find,
    taskFindOne: AiAutoReplyTask.findOne,
    taskCreate: AiAutoReplyTask.create,
    taskFindOneAndUpdate: AiAutoReplyTask.findOneAndUpdate,
    taskUpdateOne: AiAutoReplyTask.updateOne,
    taskUpdateMany: AiAutoReplyTask.updateMany,
    taskCount: AiAutoReplyTask.countDocuments,
    taskAggregate: AiAutoReplyTask.aggregate,
    msgFind: Message.find,
    msgFindOne: Message.findOne,
    msgExists: Message.exists,
    msgCreate: Message.create,
    studentFind: Student.find,
    studentFindById: Student.findById,
    teacherFind: require('../../models/Teacher').find,
    teacherFindById: require('../../models/Teacher').findById,
    auditCreate: AuditLog.create,
  };

  AuditLog.create = async () => ({ _id: new mongoose.Types.ObjectId() });

  SystemSettings.findOne = (q = {}) => wrapSingleQuery(settingsDocs.find((d) => matchesSimpleFilter(d, q)) || null);
  SystemSettings.findOneAndUpdate = async (q = {}, update = {}, opts = {}) => {
    let doc = settingsDocs.find((d) => matchesSimpleFilter(d, q));
    if (!doc && opts.upsert) {
      doc = { _key: q._key || 'main' };
      settingsDocs.push(doc);
    }
    if (!doc) return null;
    applyUpdate(doc, update);
    return { ...doc };
  };

  ConversationAiAutoReply.findOne = (q = {}) => wrapSingleQuery(convDocs.find((d) => matchesSimpleFilter(d, q)) || null);
  ConversationAiAutoReply.find = (q = {}) => wrapQuery(convDocs.filter((d) => matchesSimpleFilter(d, q)));
  ConversationAiAutoReply.findOneAndUpdate = async (q = {}, update = {}, opts = {}) => {
    let doc = convDocs.find((d) => matchesSimpleFilter(d, q));
    if (!doc && opts.upsert) {
      doc = { conversationId: q.conversationId, enabled: false, delayMinutes: 5, consecutiveAiReplies: 0, dailyAiReplyCount: 0, auditLogs: [] };
      convDocs.push(doc);
    }
    if (!doc) return null;
    applyUpdate(doc, update);
    return { ...doc };
  };
  ConversationAiAutoReply.updateOne = async (q = {}, update = {}) => {
    const doc = convDocs.find((d) => matchesSimpleFilter(d, q));
    if (!doc) return { modifiedCount: 0 };
    applyUpdate(doc, update);
    return { modifiedCount: 1 };
  };

  AiAutoReplyTask.find = (q = {}) => wrapQuery(taskDocs.filter((d) => matchesSimpleFilter(d, q)));
  AiAutoReplyTask.findOne = (q = {}) => wrapSingleQuery(taskDocs.find((d) => matchesSimpleFilter(d, q)) || null);
  AiAutoReplyTask.create = async (payload) => {
    if (taskDocs.some((t) => t.idempotencyKey === payload.idempotencyKey)) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    const row = {
      _id: new mongoose.Types.ObjectId(),
      attempts: 0,
      createdAt: new Date(),
      ...payload,
    };
    taskDocs.push(row);
    return { ...row, toObject: () => ({ ...row }) };
  };
  AiAutoReplyTask.findOneAndUpdate = async (q = {}, update = {}) => {
    const doc = taskDocs.find((d) => matchesSimpleFilter(d, q));
    if (!doc) return null;
    applyUpdate(doc, update);
    return { ...doc };
  };
  AiAutoReplyTask.updateOne = async (q = {}, update = {}) => {
    const doc = taskDocs.find((d) => matchesSimpleFilter(d, q));
    if (!doc) return { modifiedCount: 0 };
    applyUpdate(doc, update);
    return { modifiedCount: 1 };
  };
  AiAutoReplyTask.updateMany = async (q = {}, update = {}) => {
    let n = 0;
    for (const d of taskDocs) {
      if (matchesSimpleFilter(d, q)) {
        applyUpdate(d, update);
        n += 1;
      }
    }
    return { modifiedCount: n };
  };
  AiAutoReplyTask.countDocuments = async (q = {}) => taskDocs.filter((d) => matchesSimpleFilter(d, q)).length;
  AiAutoReplyTask.aggregate = async () => [];

  Message.find = (q = {}) => wrapQuery(messageDocs.filter((d) => matchesSimpleFilter(d, q)));
  Message.findOne = (q = {}) => wrapSingleQuery(messageDocs.find((d) => matchesSimpleFilter(d, q)) || null);
  Message.exists = async (q = {}) => {
    const hit = messageDocs.find((d) => matchesSimpleFilter(d, q));
    return hit ? { _id: hit._id } : null;
  };
  Message.create = async (payload) => {
    const idem = payload?.aiMetadata?.idempotencyKey;
    if (idem && idempotencyKeys.has(idem)) {
      const err = new Error('E11000 duplicate key aiMetadata.idempotencyKey');
      err.code = 11000;
      throw err;
    }
    if (idem) idempotencyKeys.add(idem);
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: payload.createdAt || new Date(),
      senderType: payload.senderType || 'human',
      aiMetadata: payload.aiMetadata || null,
      ...payload,
    };
    doc.toObject = () => ({ ...doc });
    messageDocs.push(doc);
    return doc;
  };

  const students = [
    { _id: new mongoose.Types.ObjectId(STUDENT_ID), name: 'Nguyễn Văn A', role: 'student', branchCode: 'CN1', enrollments: [{ teacherId: TEACHER_ID, status: 'active' }] },
    { _id: new mongoose.Types.ObjectId(STUDENT_2_ID), name: 'Trần Thị B', role: 'student', branchCode: 'CN1', enrollments: [{ teacherId: OTHER_TEACHER_ID, status: 'active' }] },
  ];
  const teachers = [
    { _id: new mongoose.Types.ObjectId(TEACHER_ID), name: 'Cô Lan', role: 'teacher', branchCode: 'CN1' },
    { _id: new mongoose.Types.ObjectId(OTHER_TEACHER_ID), name: 'Thầy Hùng', role: 'teacher', branchCode: 'CN1' },
  ];
  Student.find = (q = {}) => wrapQuery(students.filter((s) => matchesSimpleFilter({ _id: String(s._id) }, { ...(q._id ? { _id: q._id } : {}) })));
  Student.findById = (id) => wrapSingleQuery(students.find((s) => String(s._id) === String(id)) || null);
  const Teacher = require('../../models/Teacher');
  Teacher.find = (q = {}) => wrapQuery(teachers.filter((t) => matchesSimpleFilter({ _id: String(t._id) }, { ...(q._id ? { _id: q._id } : {}) })));
  Teacher.findById = (id) => wrapSingleQuery(teachers.find((t) => String(t._id) === String(id)) || null);

  return {
    settingsDocs,
    convDocs,
    taskDocs,
    messageDocs,
    cleanup() {
      SystemSettings.findOne = originals.settingsFindOne;
      SystemSettings.findOneAndUpdate = originals.settingsFindOneAndUpdate;
      ConversationAiAutoReply.findOne = originals.convFindOne;
      ConversationAiAutoReply.findOneAndUpdate = originals.convFindOneAndUpdate;
      ConversationAiAutoReply.updateOne = originals.convUpdateOne;
      ConversationAiAutoReply.find = originals.convFind;
      AiAutoReplyTask.find = originals.taskFind;
      AiAutoReplyTask.findOne = originals.taskFindOne;
      AiAutoReplyTask.create = originals.taskCreate;
      AiAutoReplyTask.findOneAndUpdate = originals.taskFindOneAndUpdate;
      AiAutoReplyTask.updateOne = originals.taskUpdateOne;
      AiAutoReplyTask.updateMany = originals.taskUpdateMany;
      AiAutoReplyTask.countDocuments = originals.taskCount;
      AiAutoReplyTask.aggregate = originals.taskAggregate;
      Message.find = originals.msgFind;
      Message.findOne = originals.msgFindOne;
      Message.exists = originals.msgExists;
      Message.create = originals.msgCreate;
      Student.find = originals.studentFind;
      Student.findById = originals.studentFindById;
      Teacher.find = originals.teacherFind;
      Teacher.findById = originals.teacherFindById;
      AuditLog.create = originals.auditCreate;
      aiAutoReplyService.invalidateGlobalCache();
      aiAutoReplyService._resetTestHooks();
    },
  };
}

function makeFakeEmitter() {
  const emitted = [];
  const notifyUser = (role, userId, eventName, data) => {
    emitted.push({ role, userId: String(userId), eventName, data });
    return true;
  };
  const io = {
    to(room) {
      return {
        to(room2) {
          return {
            emit(eventName, data) {
              emitted.push({ room: `${room}+${room2}`, eventName, data });
            },
          };
        },
        emit(eventName, data) {
          emitted.push({ room, eventName, data });
        },
      };
    },
  };
  return { emitted, io, notifyUser };
}

test('DewSkill AI Auto-Reply — full 15 mandatory scenarios', async (t) => {
  const store = installInMemoryStore();
  t.after(() => store.cleanup());

  const teacherUser = { id: TEACHER_ID, name: 'Cô Lan', role: 'teacher', branchCode: 'CN1' };
  const otherTeacher = { id: OTHER_TEACHER_ID, name: 'Thầy Hùng', role: 'teacher', branchCode: 'CN1' };
  const adminUser = { id: 'admin', name: 'Super Admin', role: 'admin', adminRole: 'SUPER_ADMIN' };
  const studentUser = { id: STUDENT_ID, name: 'Nguyễn Văn A', role: 'student', branchCode: 'CN1' };

  await t.test('1. AI OFF: student messages -> no task created, no AI reply', async () => {
    store.convDocs.length = 0;
    store.taskDocs.length = 0;
    store.messageDocs.length = 0;
    const { io, notifyUser } = makeFakeEmitter();
    const stuMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Hàm SUMIFS khác gì SUMIF vậy cô?',
    });
    const hookRes = await aiAutoReplyService.handlePostMessageAutoReply({
      message: stuMsg,
      sender: studentUser,
      conversationId: CONV_ID,
      io,
      notifyUser,
    });
    assert.equal(hookRes.skipped, 'conv_disabled');
    assert.equal(store.taskDocs.length, 0);
  });

  await t.test('2. AI ON: wait expires -> DewSkill AI replies with required identity & metadata', async () => {
    store.convDocs.length = 0;
    store.taskDocs.length = 0;
    store.messageDocs.length = 0;
    aiAutoReplyService.invalidateGlobalCache();
    aiAutoReplyService._setTestHooks({
      delayScaleMs: 1,
      generateReply: async ({ question }) => ({
        needsHuman: false,
        content: `Chào bạn, hàm SUMIFS dùng nhiều điều kiện hơn SUMIF nhé (${question.slice(0, 30)}).`,
        knowledgeReferences: [{ docId: 'excel-1', docTitle: 'Giáo trình Excel 365', location: 'Hàm điều kiện', score: 9.5 }],
        model: 'gemini-3.5-flash-lite',
      }),
    });

    const { emitted, io, notifyUser } = makeFakeEmitter();
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, {
      enabled: true,
      delayMinutes: 1,
    }, { io, notifyUser });

    const stuMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Cho em hỏi hàm SUMIFS trong Excel ạ',
      createdAt: new Date(Date.now() - 5000),
    });

    const sched = await aiAutoReplyService.handlePostMessageAutoReply({
      message: stuMsg,
      sender: studentUser,
      conversationId: CONV_ID,
      io,
      notifyUser,
    });
    assert.equal(sched.action, 'scheduled');
    assert.equal(store.taskDocs.length, 1);

    const execRes = await aiAutoReplyService.executeAutoReplyTask(sched.taskId, { io, notifyUser });
    assert.equal(execRes.ok, true);
    assert.equal(execRes.status, 'sent');

    const aiMsgs = store.messageDocs.filter((m) => m.senderType === 'ai');
    assert.equal(aiMsgs.length, 1);
    assert.equal(aiMsgs[0].senderId, 'ai_support');
    assert.equal(aiMsgs[0].senderName, 'DewSkill AI');
    assert.equal(aiMsgs[0].aiMetadata.source, 'ai_auto_reply');
    assert.equal(aiMsgs[0].aiMetadata.trigger, 'timeout');
    assert.equal(aiMsgs[0].aiMetadata.triggeringMessageId, String(stuMsg._id));
    assert.equal(aiMsgs[0].aiMetadata.knowledgeReferences.length, 1);

    // Confirm realtime delivery + status ONLY to teacher (never student)
    assert.ok(emitted.some((e) => e.userId === STUDENT_ID && e.eventName === 'message:receive'));
    assert.ok(emitted.some((e) => e.userId === TEACHER_ID && e.eventName === 'message:receive'));
    assert.ok(emitted.some((e) => e.userId === TEACHER_ID && e.eventName === 'ai-auto-reply:status'));
    assert.equal(emitted.some((e) => e.userId === STUDENT_ID && e.eventName === 'ai-auto-reply:status'), false);
  });

  await t.test('3. Teacher replies before due time -> pending task cancelled immediately', async () => {
    store.taskDocs.length = 0;
    const { emitted, io, notifyUser } = makeFakeEmitter();
    aiAutoReplyService._setTestHooks({ delayScaleMs: 60_000 });
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, {
      enabled: true,
      delayMinutes: 5,
    }, { io, notifyUser });

    const stuMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Cô ơi giúp em VLOOKUP ạ',
    });
    const sched = await aiAutoReplyService.handlePostMessageAutoReply({
      message: stuMsg,
      sender: studentUser,
      conversationId: CONV_ID,
      io,
      notifyUser,
    });
    assert.equal(sched.action, 'scheduled');

    const teacherMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: TEACHER_ID,
      senderName: teacherUser.name,
      senderRole: 'teacher',
      receiverId: STUDENT_ID,
      receiverName: studentUser.name,
      receiverRole: 'student',
      content: 'Cô đây, em xem cú pháp =VLOOKUP(lookup_value, table_array, col_index_num, 0) nhé.',
      createdAt: new Date(Date.now() + 200),
    });
    const cancelRes = await aiAutoReplyService.handlePostMessageAutoReply({
      message: teacherMsg,
      sender: teacherUser,
      conversationId: CONV_ID,
      io,
      notifyUser,
    });
    assert.equal(cancelRes.action, 'cancelled_human');
    assert.equal(cancelRes.cancelledCount, 1);
    assert.equal(store.taskDocs[0].status, 'cancelled');
    assert.equal(store.taskDocs[0].cancelReason, 'human_replied');
    assert.ok(emitted.some((e) => e.userId === TEACHER_ID && e.eventName === 'ai-auto-reply:status' && e.data.status === 'cancelled_human'));
  });

  await t.test('4. Admin replies before due time -> pending task cancelled immediately', async () => {
    store.taskDocs.length = 0;
    const { io, notifyUser } = makeFakeEmitter();
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(adminUser, CONV_ADMIN_ID, {
      enabled: true,
      delayMinutes: 5,
    }, { io, notifyUser });

    const stuMsg = await Message.create({
      conversationId: CONV_ADMIN_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: 'admin',
      receiverName: 'Admin',
      receiverRole: 'admin',
      content: 'Admin ơi cho em hỏi cách thi thử MOS trên hệ thống',
    });
    await aiAutoReplyService.handlePostMessageAutoReply({
      message: stuMsg,
      sender: studentUser,
      conversationId: CONV_ADMIN_ID,
      io,
      notifyUser,
    });

    const adminMsg = await Message.create({
      conversationId: CONV_ADMIN_ID,
      senderId: 'admin',
      senderName: 'Admin',
      senderRole: 'admin',
      receiverId: STUDENT_ID,
      receiverName: studentUser.name,
      receiverRole: 'student',
      content: 'Admin đã tiếp nhận và hướng dẫn bạn nhé!',
      createdAt: new Date(Date.now() + 200),
    });
    const cancelRes = await aiAutoReplyService.handlePostMessageAutoReply({
      message: adminMsg,
      sender: adminUser,
      conversationId: CONV_ADMIN_ID,
      io,
      notifyUser,
    });
    assert.equal(cancelRes.action, 'cancelled_human');
    assert.equal(cancelRes.cancelledCount, 1);
    assert.equal(store.taskDocs[0].status, 'cancelled');
  });

  await t.test('5. Student sends consecutive burst messages -> coalesced into 1 task and 1 reply', async () => {
    store.taskDocs.length = 0;
    store.messageDocs.length = 0;
    let capturedCombinedQuestion = '';
    aiAutoReplyService._setTestHooks({
      delayScaleMs: 1,
      generateReply: async ({ question }) => {
        capturedCombinedQuestion = question;
        return { needsHuman: false, content: 'Mình đã tổng hợp cả 3 ý Excel của bạn nhé.', knowledgeReferences: [], model: 'gemini-3.5-flash-lite' };
      },
    });
    const { io, notifyUser } = makeFakeEmitter();
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: true, delayMinutes: 1 }, { io, notifyUser });

    const t0 = Date.now() - 5000;
    for (const [idx, text] of ['Chào cô ạ', 'Em làm Excel bị lỗi #N/A', 'Ở hàm VLOOKUP ạ'].entries()) {
      const msg = await Message.create({
        conversationId: CONV_ID,
        senderId: STUDENT_ID,
        senderName: studentUser.name,
        senderRole: 'student',
        receiverId: TEACHER_ID,
        receiverName: teacherUser.name,
        receiverRole: 'teacher',
        content: text,
        createdAt: new Date(t0 + idx * 100),
      });
      await aiAutoReplyService.handlePostMessageAutoReply({ message: msg, sender: studentUser, conversationId: CONV_ID, io, notifyUser });
    }

    assert.equal(store.taskDocs.length, 1);
    assert.equal(store.taskDocs[0].burstMessageIds.length, 3);

    await aiAutoReplyService.executeAutoReplyTask(String(store.taskDocs[0]._id), { io, notifyUser });
    assert.match(capturedCombinedQuestion, /Chào cô ạ/);
    assert.match(capturedCombinedQuestion, /#N\/A/);
    assert.match(capturedCombinedQuestion, /VLOOKUP/);
    assert.equal(store.messageDocs.filter((m) => m.senderType === 'ai').length, 1);
  });

  await t.test('6. Toggle OFF while pending -> task cancelled', async () => {
    store.taskDocs.length = 0;
    aiAutoReplyService._setTestHooks({ delayScaleMs: 60_000 });
    const { io, notifyUser } = makeFakeEmitter();
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: true, delayMinutes: 5 }, { io, notifyUser });
    const msg = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Hàm IF lồng nhau viết sao ạ?',
    });
    await aiAutoReplyService.handlePostMessageAutoReply({ message: msg, sender: studentUser, conversationId: CONV_ID, io, notifyUser });
    assert.equal(store.taskDocs[0].status, 'pending');

    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: false }, { io, notifyUser });
    assert.equal(store.taskDocs[0].status, 'cancelled');
    assert.equal(store.taskDocs[0].cancelReason, 'disabled_conversation');
  });

  await t.test('7. API restart with pending task -> recovered from MongoDB and executed', async () => {
    store.taskDocs.length = 0;
    store.messageDocs.length = 0;
    aiAutoReplyService._setTestHooks({
      delayScaleMs: 1,
      generateReply: async () => ({ needsHuman: false, content: 'Phục hồi sau restart thành công!', knowledgeReferences: [], model: 'gemini-3.5-flash-lite' }),
    });
    const { io, notifyUser } = makeFakeEmitter();
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: true, delayMinutes: 1 }, { io, notifyUser });

    const pastMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Cho em hỏi PivotTable ạ',
      createdAt: new Date(Date.now() - 10_000),
    });

    await AiAutoReplyTask.create({
      conversationId: CONV_ID,
      aliasConversationIds: [CONV_ID],
      studentId: STUDENT_ID,
      studentName: studentUser.name,
      recipientId: TEACHER_ID,
      recipientRole: 'teacher',
      recipientName: teacherUser.name,
      triggeringMessageId: String(pastMsg._id),
      triggeringMessageAt: pastMsg.createdAt,
      burstMessageIds: [String(pastMsg._id)],
      delayMinutes: 1,
      scheduledAt: pastMsg.createdAt,
      dueAt: new Date(Date.now() - 2000),
      status: 'pending',
      idempotencyKey: `autoreply:${CONV_ID}:${pastMsg._id}`,
    });

    const rec = await aiAutoReplyService.recoverPendingAutoReplyTasks({ io, notifyUser, requeueFuture: false });
    assert.equal(rec.executedCount, 1);
    assert.equal(store.taskDocs[0].status, 'sent');
    assert.equal(store.messageDocs.filter((m) => m.senderType === 'ai').length, 1);
  });

  await t.test('8. AI reply never re-triggers Auto-Reply', async () => {
    const beforeTasks = store.taskDocs.length;
    const { io, notifyUser } = makeFakeEmitter();
    const aiMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: 'ai_support',
      senderName: 'DewSkill AI',
      senderRole: 'system',
      senderType: 'ai',
      receiverId: STUDENT_ID,
      receiverName: studentUser.name,
      receiverRole: 'student',
      content: 'Phản hồi từ AI',
    });
    const res = await aiAutoReplyService.handlePostMessageAutoReply({
      message: aiMsg,
      sender: { id: 'ai_support', role: 'system' },
      conversationId: CONV_ID,
      io,
      notifyUser,
    });
    assert.equal(res.skipped, 'ai_self_message');
    assert.equal(store.taskDocs.length, beforeTasks);
  });

  await t.test('9. Concurrent double execution + race with human reply never sends duplicates', async () => {
    store.convDocs.length = 0;
    store.taskDocs.length = 0;
    store.messageDocs.length = 0;
    aiAutoReplyService._setTestHooks({
      delayScaleMs: 1,
      generateReply: async () => ({ needsHuman: false, content: 'Single reply only', knowledgeReferences: [], model: 'gemini-3.5-flash-lite' }),
    });
    const { io, notifyUser } = makeFakeEmitter();
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: true, delayMinutes: 1 }, { io, notifyUser });

    const stuMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Cách dùng Ctrl+Shift+L trong Excel?',
      createdAt: new Date(Date.now() - 5000),
    });
    const sched = await aiAutoReplyService.handlePostMessageAutoReply({ message: stuMsg, sender: studentUser, conversationId: CONV_ID, io, notifyUser });

    const [r1, r2] = await Promise.all([
      aiAutoReplyService.executeAutoReplyTask(sched.taskId, { io, notifyUser }),
      aiAutoReplyService.executeAutoReplyTask(sched.taskId, { io, notifyUser }),
    ]);
    assert.equal([r1.ok, r2.ok].filter(Boolean).length, 1);
    assert.equal(store.messageDocs.filter((m) => m.senderType === 'ai').length, 1);

    // Mid-generation human reply race -> aborted with zero AI message sent
    store.taskDocs.length = 0;
    store.messageDocs.length = 0;
    const stuMsg2 = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Thêm câu hỏi Mail Merge ạ',
      createdAt: new Date(Date.now() - 4000),
    });
    const sched2 = await aiAutoReplyService.handlePostMessageAutoReply({ message: stuMsg2, sender: studentUser, conversationId: CONV_ID, io, notifyUser });
    aiAutoReplyService._setTestHooks({
      delayScaleMs: 1,
      generateReply: async () => {
        await Message.create({
          conversationId: CONV_ID,
          senderId: TEACHER_ID,
          senderName: teacherUser.name,
          senderRole: 'teacher',
          receiverId: STUDENT_ID,
          receiverName: studentUser.name,
          receiverRole: 'student',
          content: 'Cô trả lời đúng lúc này nhé!',
          createdAt: new Date(Date.now() + 100),
        });
        return { needsHuman: false, content: 'Should never be sent', knowledgeReferences: [], model: 'gemini-3.5-flash-lite' };
      },
    });
    const raceRes = await aiAutoReplyService.executeAutoReplyTask(sched2.taskId, { io, notifyUser });
    assert.equal(raceRes.ok, false);
    assert.equal(raceRes.cancelled, 'human_replied_race');
    assert.equal(store.messageDocs.filter((m) => m.senderType === 'ai').length, 0);
  });

  await t.test('10. RBAC rejects student, unassigned teacher, locked global toggle, and spoofed AI payloads', async () => {
    await assert.rejects(
      () => aiAutoReplyService.updateConversationAiAutoReplyConfig(studentUser, CONV_ID, { enabled: true }),
      (err) => err.status === 403,
    );
    await assert.rejects(
      () => aiAutoReplyService.getConversationAiAutoReplyState(otherTeacher, CONV_ID),
      (err) => err.status === 403,
    );
    await assert.rejects(
      () => aiAutoReplyService.updateGlobalAiAutoReplySettings(teacherUser, { enabled: false }),
      (err) => err.status === 403,
    );
    await aiAutoReplyService.updateGlobalAiAutoReplySettings(adminUser, { enabled: false });
    await assert.rejects(
      () => aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: true }),
      (err) => err.status === 403,
    );
    await aiAutoReplyService.updateGlobalAiAutoReplySettings(adminUser, { enabled: true, allowTeacherToggle: false });
    await assert.rejects(
      () => aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: true }),
      (err) => err.status === 403,
    );
    await aiAutoReplyService.updateGlobalAiAutoReplySettings(adminUser, { enabled: true, allowTeacherToggle: true });

    // Anti-spoofing check in directMessageService source
    const dmSrc = read('services/directMessageService.js');
    assert.match(dmSrc, /senderType:\s*'human'/);
    assert.match(dmSrc, /delete safePayload\.aiAutoReply/);
    void directMessageService;
  });

  await t.test('11. AI strictly isolated from other students conversations and admin/teacher RAG docs', async () => {
    store.convDocs.length = 0;
    store.taskDocs.length = 0;
    store.messageDocs.length = 0;
    // Seed secret message in Student 2's thread
    await Message.create({
      conversationId: `student_${STUDENT_2_ID}__teacher_${OTHER_TEACHER_ID}`,
      senderId: STUDENT_2_ID,
      senderName: 'Trần Thị B',
      senderRole: 'student',
      receiverId: OTHER_TEACHER_ID,
      receiverName: otherTeacher.name,
      receiverRole: 'teacher',
      content: 'SECRET_STUDENT_2_PRIVATE_MESSAGE',
    });

    let seenHistoryText = '';
    aiAutoReplyService._setTestHooks({
      delayScaleMs: 1,
      generateReply: async ({ recentConversationMessages }) => {
        seenHistoryText = recentConversationMessages.map((m) => m.content).join('\n');
        return { needsHuman: false, content: 'OK', knowledgeReferences: [], model: 'gemini-3.5-flash-lite' };
      },
    });
    const { io, notifyUser } = makeFakeEmitter();
    await aiAutoReplyService.updateConversationAiAutoReplyConfig(teacherUser, CONV_ID, { enabled: true, delayMinutes: 1 }, { io, notifyUser });
    const stuMsg = await Message.create({
      conversationId: CONV_ID,
      senderId: STUDENT_ID,
      senderName: studentUser.name,
      senderRole: 'student',
      receiverId: TEACHER_ID,
      receiverName: teacherUser.name,
      receiverRole: 'teacher',
      content: 'Cách đánh số trang từ trang 3 trong Word?',
      createdAt: new Date(Date.now() - 3000),
    });
    const sched = await aiAutoReplyService.handlePostMessageAutoReply({ message: stuMsg, sender: studentUser, conversationId: CONV_ID, io, notifyUser });
    await aiAutoReplyService.executeAutoReplyTask(sched.taskId, { io, notifyUser });
    assert.equal(seenHistoryText.includes('SECRET_STUDENT_2_PRIVATE_MESSAGE'), false);

    // Student RAG tier excludes admin/teacher/staff
    assert.deepEqual([...knowledgeSearchService.getAllowedAccessLevels({ id: STUDENT_ID, role: 'student' })], ['public', 'student']);
  });

  await t.test('12. Anti-fabrication: personal schedules, grades, and tuition trigger safe needs_human handoff', async () => {
    aiAutoReplyService._resetTestHooks();
    aiAutoReplyService._setTestHooks({ delayScaleMs: 1 });
    for (const q of [
      'Lịch học tối nay của em mấy giờ và link Meet ở đâu ạ?',
      'Em đã chuyển khoản học phí rồi, admin kiểm tra còn nợ bao nhiêu ạ?',
      'Điểm thi MOS của em hôm qua được mấy điểm ạ?',
    ]) {
      const res = await aiAutoReplyService.generateAutoReplyContent({
        combinedStudentText: q,
        studentId: STUDENT_ID,
        studentName: studentUser.name,
      });
      assert.equal(res.needsHuman, true, `Expected needsHuman=true for: ${q}`);
      assert.match(res.content, /DewSkill AI đã ghi nhận/);
    }
    // Software how-to mentioning Excel + điểm is NOT falsely blocked
    assert.equal(
      aiAutoReplyService.isSensitivePersonalOrAcademicInquiry('Cách dùng hàm AVERAGE tính điểm trung bình trong Excel?'),
      false,
    );
  });

  await t.test('13. Gemini timeout / error gracefully marks needs_human with safe fallback notice', async () => {
    aiAutoReplyService._resetTestHooks();
    const modelRouter = require('../../services/ai/modelRouter');
    const origChat = modelRouter.chatWithProfile;
    modelRouter.chatWithProfile = async () => {
      throw new Error('Gemini timeout after 15000ms');
    };
    try {
      const res = await aiAutoReplyService.generateAutoReplyContent({
        combinedStudentText: 'Hướng dẫn tạo mục lục tự động trong Word 365',
        studentId: STUDENT_ID,
        studentName: studentUser.name,
      });
      assert.equal(res.needsHuman, true);
      assert.match(res.content, /DewSkill AI đã ghi nhận/);
      assert.match(res.errorMessage, /timeout/i);
    } finally {
      modelRouter.chatWithProfile = origChat;
    }
  });

  await t.test('14 & 15. Realtime Web + Mobile parity, responsive composer UI, and student chrome isolation', async () => {
    const inboxSrc = read('client/src/components/Inbox.jsx');
    const fmSrc = read('client/src/components/FloatingMessenger.jsx');
    const autoCtrlSrc = read('client/src/components/AiAutoReplyComposerControl.jsx');
    const dataMsgSrc = read('client/src/context/useDataMessaging.js');
    const mobMsgSrc = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
    const mobApiSrc = read('thang-tin-hoc-mobile/src/services/messageApi.ts');
    const mobSocketSrc = read('thang-tin-hoc-mobile/src/services/socketService.ts');
    const sysSettingsSrc = read('client/src/components/SystemSettingsTab.jsx');

    // Web integration & metadata preservation
    assert.ok(dataMsgSrc.includes('aiMetadata: n.aiMetadata'));
    assert.ok(inboxSrc.includes('AiAutoReplyComposerControl'));
    assert.ok(inboxSrc.includes('AiAutoReplyStatusBanner'));
    assert.ok(inboxSrc.includes("currentUserRole !== 'student'"));
    assert.ok(fmSrc.includes('AiAutoReplyComposerControl'));
    assert.ok(fmSrc.includes("meRole !== 'student'"));
    assert.ok(autoCtrlSrc.includes('Tự động trả lời khi chưa có phản hồi'));
    assert.ok(autoCtrlSrc.includes('1, 3, 5, 10, 15, 30'));
    assert.ok(sysSettingsSrc.includes('AiAutoReplyAdminPanel'));

    // Mobile integration, keyboard dismiss & narrow-screen flex safety
    assert.ok(mobSocketSrc.includes('AI_AUTO_REPLY_STATUS'));
    assert.ok(mobApiSrc.includes('getConversationAiAutoReplyState'));
    assert.ok(mobMsgSrc.includes("user.role !== 'student'"));
    assert.ok(mobMsgSrc.includes('Keyboard.dismiss()'));
    assert.ok(mobMsgSrc.includes('windowWidth < 360'));
    assert.ok(mobMsgSrc.includes('DewSkill AI'));
    assert.ok(mobMsgSrc.includes('Trợ lý AI'));
  });
});

void crypto;
