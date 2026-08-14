/**
 * Phase 5 — Canonical recipient resolution + private DM isolation.
 * Authority: MESSAGING_BUSINESS_DECISIONS + MATRIX.
 * Live Socket.IO server not required — uses model stubs + mock notifyUser/io
 * matching server.js private delivery semantics.
 */
'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');
const Message = require('../../models/Message');
const ConversationVisibility = require('../../models/ConversationVisibility');
const Branch = require('../../models/Branch');
const {
  PRODUCT_ROLES,
  resolveCanonicalRecipient,
  canSendMessage,
  canDiscoverContacts,
  canSendStructurally,
  canViewConversation,
  POLICY_CODES,
  normalizeIdentity,
} = require('../../services/messagingPolicy');
const { buildCanonicalConversationId } = require('../../services/messagingPairing');
const { buildConversationId } = require('../../utils/chatConversationId');
const { getMessagingRole } = require('../../utils/messagingRoles');

const ROOT = path.join(__dirname, '../..');

const IDS = {
  studentA: 'a11111111111111111111111',
  studentB: 'a22222222222222222222222',
  teacherA: 'b11111111111111111111111',
  staffA: 'c11111111111111111111111',
  supportA: 'd11111111111111111111111',
  supportB: 'd22222222222222222222222',
  highA: 'e11111111111111111111111',
  superA: 'f11111111111111111111111',
  missing: 'ffffffffffffffffffffffff',
};

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TENANT_A = '607f1f77bcf86cd7994390aa';

const DOCS = {
  [IDS.studentA]: {
    kind: 'student',
    doc: {
      _id: IDS.studentA,
      name: 'Student A',
      role: 'student',
      branchId: BRANCH_A,
      branchCode: 'A',
      tenantId: TENANT_A,
      teacherId: IDS.teacherA,
      enrollments: [{ teacherId: IDS.teacherA }],
    },
  },
  [IDS.studentB]: {
    kind: 'student',
    doc: {
      _id: IDS.studentB,
      name: 'Student B',
      role: 'student',
      branchId: BRANCH_B,
      branchCode: 'B',
      tenantId: TENANT_A,
      teacherId: IDS.teacherA,
    },
  },
  [IDS.teacherA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.teacherA,
      name: 'Teacher A',
      role: 'teacher',
      branchId: BRANCH_A,
      branchCode: 'A',
      tenantId: TENANT_A,
      status: 'Active',
    },
  },
  [IDS.staffA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.staffA,
      name: 'Staff A',
      role: 'admin',
      adminRole: 'STAFF',
      branchId: BRANCH_A,
      branchCode: 'A',
      tenantId: TENANT_A,
      status: 'Active',
    },
  },
  [IDS.supportA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.supportA,
      name: 'Support A',
      role: 'admin',
      adminRole: 'SUPPORT',
      branchId: BRANCH_A,
      branchCode: 'A',
      tenantId: TENANT_A,
      status: 'Active',
    },
  },
  [IDS.supportB]: {
    kind: 'teacher',
    doc: {
      _id: IDS.supportB,
      name: 'Support B',
      role: 'admin',
      adminRole: 'SUPPORT',
      branchId: BRANCH_B,
      branchCode: 'B',
      tenantId: TENANT_A,
      status: 'Active',
    },
  },
  [IDS.highA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.highA,
      name: 'High A',
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      tenantId: TENANT_A,
      status: 'Active',
    },
  },
  [IDS.superA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.superA,
      name: 'Super A',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      tenantId: TENANT_A,
      status: 'Active',
    },
  },
};

function leanChain(doc) {
  return {
    select() {
      return this;
    },
    lean: async () => (doc ? { ...doc } : null),
  };
}

const origTeacherFindById = Teacher.findById;
const origStudentFindById = Student.findById;
const origTeacherFind = Teacher.find;
const origStudentFind = Student.find;
const origBranchFindById = Branch.findById;
const origMessageCreate = Message.create;
const origVisibility = ConversationVisibility.findOneAndUpdate;

function installModelStubs() {
  Teacher.findById = (id) => {
    const hit = DOCS[String(id)];
    if (hit?.kind === 'teacher') return leanChain(hit.doc);
    return leanChain(null);
  };
  Student.findById = (id) => {
    const hit = DOCS[String(id)];
    if (hit?.kind === 'student') return leanChain(hit.doc);
    return leanChain(null);
  };
  Teacher.find = (query = {}) => {
    const ids = (query._id && query._id.$in) ? query._id.$in.map(String) : [];
    const rows = ids
      .map((id) => DOCS[id])
      .filter((h) => h?.kind === 'teacher')
      .map((h) => ({ ...h.doc }));
    return {
      select() { return this; },
      lean: async () => rows,
    };
  };
  Student.find = (query = {}) => {
    const ids = (query._id && query._id.$in) ? query._id.$in.map(String) : [];
    const rows = ids
      .map((id) => DOCS[id])
      .filter((h) => h?.kind === 'student')
      .map((h) => ({ ...h.doc }));
    return {
      select() { return this; },
      lean: async () => rows,
    };
  };
  Branch.findById = () => leanChain(null);
}

function restoreModelStubs() {
  Teacher.findById = origTeacherFindById;
  Student.findById = origStudentFindById;
  Teacher.find = origTeacherFind;
  Student.find = origStudentFind;
  Branch.findById = origBranchFindById;
}

/**
 * Mirrors server.js app.notifyUser private-DM semantics for isolation proofs.
 * NEVER fans out to ALL_STAFF / ALL_SUPPORT for non-admin mailbox.
 */
function createNotifyHarness() {
  const emits = [];
  const onlineUsers = new Map();
  const io = {
    to(room) {
      const rooms = [String(room)];
      const api = {
        to(next) {
          rooms.push(String(next));
          return api;
        },
        emit(event, data) {
          emits.push({ rooms: [...rooms], event, data });
        },
      };
      return api;
    },
  };

  function notifyUser(role, userId, eventName, data) {
    const strUserId = String(userId);
    if (strUserId === 'admin') {
      io.to('admin').to('ALL_ADMIN').emit(eventName, data);
      return true;
    }
    const tryRoles = new Set([role, getMessagingRole({ id: strUserId, role })]);
    if (role === 'admin' || role === 'staff' || role === 'support') {
      tryRoles.add('admin');
      tryRoles.add('staff');
    }
    for (const r of tryRoles) {
      if (!r) continue;
      const user = onlineUsers.get(`${r}_${strUserId}`);
      if (user?.socketId) {
        io.to(user.socketId).emit(eventName, data);
        return true;
      }
    }
    io.to(strUserId).emit(eventName, data);
    return true;
  }

  return { io, emits, onlineUsers, notifyUser };
}

function actorFromDoc(id) {
  const hit = DOCS[id];
  assert.ok(hit, `missing fixture ${id}`);
  const d = hit.doc;
  return {
    id: String(d._id),
    role: d.role,
    adminRole: d.adminRole,
    name: d.name,
    branchId: d.branchId,
    branchCode: d.branchCode,
    tenantId: d.tenantId,
  };
}

describe('Phase 5 recipient resolution + DM isolation', { concurrency: false }, () => {
  before(() => installModelStubs());
  after(() => restoreModelStubs());

  it('canonical resolveCanonicalRecipient is exported from MessagingPolicy', () => {
    const policy = fs.readFileSync(path.join(ROOT, 'services/messagingPolicy.js'), 'utf8');
    assert.ok(policy.includes('async function resolveCanonicalRecipient'));
    assert.ok(policy.includes('resolveCanonicalPeer'));
    const chat = fs.readFileSync(path.join(ROOT, 'services/chatAccessService.js'), 'utf8');
    assert.ok(chat.includes('resolveCanonicalRecipient'));
  });

  it('SUPPORT: productRole SUPPORT + transportRole staff (not STAFF)', async () => {
    const r = await resolveCanonicalRecipient(IDS.supportA, { roleHint: 'teacher' });
    assert.equal(r.ok, true);
    assert.equal(r.recipient.productRole, PRODUCT_ROLES.SUPPORT);
    assert.equal(r.recipient.transportRole, 'staff');
    assert.equal(r.recipient.adminRole, 'SUPPORT');
    assert.notEqual(r.recipient.productRole, PRODUCT_ROLES.STAFF);
  });

  it('STAFF: productRole STAFF + transportRole staff', async () => {
    const r = await resolveCanonicalRecipient(IDS.staffA);
    assert.equal(r.ok, true);
    assert.equal(r.recipient.productRole, PRODUCT_ROLES.STAFF);
    assert.equal(r.recipient.transportRole, 'staff');
  });

  it('wrong client receiverRole does not override SUPPORT identity', async () => {
    const r = await resolveCanonicalRecipient(IDS.supportA, { roleHint: 'teacher' });
    assert.equal(r.ok, true);
    assert.equal(r.recipient.productRole, PRODUCT_ROLES.SUPPORT);
    assert.equal(r.recipient.transportRole, 'staff');

    const r2 = await resolveCanonicalRecipient(IDS.supportA, { roleHint: 'student' });
    assert.equal(r2.ok, true);
    assert.equal(r2.recipient.productRole, PRODUCT_ROLES.SUPPORT);
  });

  it('unknown recipient → MESSAGING_RECIPIENT_NOT_FOUND', async () => {
    const r = await resolveCanonicalRecipient(IDS.missing);
    assert.equal(r.ok, false);
    assert.equal(r.code, POLICY_CODES.RECIPIENT_NOT_FOUND);

    const send = await canSendMessage(actorFromDoc(IDS.studentA), IDS.missing, 'staff');
    assert.equal(send.allowed, false);
    assert.equal(send.code, POLICY_CODES.RECIPIENT_NOT_FOUND);
  });

  it('self-messaging student → student denied by matrix', async () => {
    const structural = canSendStructurally(actorFromDoc(IDS.studentA), actorFromDoc(IDS.studentA));
    assert.equal(structural.allowed, false);
    const send = await canSendMessage(actorFromDoc(IDS.studentA), IDS.studentA, 'student');
    assert.equal(send.allowed, false);
  });

  it('matrix structural send + discover dual-layer', async () => {
    assert.equal(canSendStructurally(actorFromDoc(IDS.studentA), actorFromDoc(IDS.supportA)).allowed, true);
    assert.equal(canDiscoverContacts(actorFromDoc(IDS.studentA), actorFromDoc(IDS.supportA)).allowed, true);
    assert.equal(canSendStructurally(actorFromDoc(IDS.studentA), actorFromDoc(IDS.staffA)).allowed, true);
    assert.equal(canDiscoverContacts(actorFromDoc(IDS.studentA), actorFromDoc(IDS.staffA), { sameBranch: true }).allowed, true);
    assert.equal(canSendStructurally(actorFromDoc(IDS.studentA), actorFromDoc(IDS.teacherA)).allowed, true);
    assert.equal(canDiscoverContacts(actorFromDoc(IDS.studentA), actorFromDoc(IDS.highA)).allowed, false);
    assert.equal(canSendStructurally(actorFromDoc(IDS.studentA), actorFromDoc(IDS.highA)).allowed, false);
    assert.equal(canDiscoverContacts(actorFromDoc(IDS.studentA), actorFromDoc(IDS.superA)).allowed, false);
    assert.equal(canSendStructurally(actorFromDoc(IDS.studentA), actorFromDoc(IDS.superA)).allowed, true);
    assert.equal(canSendStructurally(actorFromDoc(IDS.teacherA), actorFromDoc(IDS.supportA)).allowed, true);
    assert.equal(canSendStructurally(actorFromDoc(IDS.staffA), actorFromDoc(IDS.supportA)).allowed, true);
    assert.equal(canSendStructurally(actorFromDoc(IDS.supportA), actorFromDoc(IDS.staffA)).allowed, true);
    assert.equal(canSendStructurally(actorFromDoc(IDS.supportA), actorFromDoc(IDS.studentA)).allowed, true);
    assert.equal(canSendStructurally(actorFromDoc(IDS.supportA), actorFromDoc(IDS.supportB)).allowed, true);
  });

  it('branch: student A → staff B denied by pairing scope', async () => {
    const send = await canSendMessage(actorFromDoc(IDS.studentA), IDS.staffA, 'staff');
    // same branch A — allow
    assert.equal(send.allowed, true);

    // Place staff on branch B temporarily via fixture mutation
    const staffDoc = DOCS[IDS.staffA].doc;
    const prev = { branchId: staffDoc.branchId, branchCode: staffDoc.branchCode };
    staffDoc.branchId = BRANCH_B;
    staffDoc.branchCode = 'B';
    try {
      const cross = await canSendMessage(actorFromDoc(IDS.studentA), IDS.staffA, 'staff');
      assert.equal(cross.allowed, false);
      assert.equal(cross.code, POLICY_CODES.BRANCH_DENIED);
    } finally {
      staffDoc.branchId = prev.branchId;
      staffDoc.branchCode = prev.branchCode;
    }
  });

  it('branch: student A → support B still allowed (global SUPPORT freeze)', async () => {
    const send = await canSendMessage(actorFromDoc(IDS.studentA), IDS.supportB, 'staff');
    assert.equal(send.allowed, true);
    assert.equal(send.recipient.productRole, PRODUCT_ROLES.SUPPORT);
  });

  it('conversation IDs Support A vs Support B are distinct', () => {
    const student = actorFromDoc(IDS.studentA);
    const idA = buildCanonicalConversationId(student, 'staff', IDS.supportA);
    const idB = buildCanonicalConversationId(student, 'staff', IDS.supportB);
    assert.notEqual(idA, idB);
    assert.ok(idA.includes(`staff_${IDS.supportA}`));
    assert.ok(idB.includes(`staff_${IDS.supportB}`));
    assert.equal(canViewConversation(actorFromDoc(IDS.supportA), idA).allowed, true);
    assert.equal(canViewConversation(actorFromDoc(IDS.supportB), idA).allowed, false);
    assert.equal(canViewConversation(actorFromDoc(IDS.staffA), idA).allowed, false);
  });

  it('REST path sendCanonicalMessage delivers exact Support A only', async () => {
    const { sendCanonicalMessage } = require('../../services/directMessageService');
    const created = [];
    Message.create = async (doc) => {
      const row = {
        ...doc,
        _id: `msg_${created.length + 1}`,
        createdAt: new Date(),
        toObject() { return { ...this }; },
      };
      created.push(row);
      return row;
    };
    ConversationVisibility.findOneAndUpdate = async () => ({});

    const harness = createNotifyHarness();
    // Simulate connected sockets for Support A/B and Staff A
    harness.onlineUsers.set(`staff_${IDS.supportA}`, { socketId: 'sock_supportA' });
    harness.onlineUsers.set(`staff_${IDS.supportB}`, { socketId: 'sock_supportB' });
    harness.onlineUsers.set(`staff_${IDS.staffA}`, { socketId: 'sock_staffA' });

    try {
      const result = await sendCanonicalMessage({
        sender: actorFromDoc(IDS.studentA),
        receiverId: IDS.supportA,
        receiverRole: 'teacher', // malicious/wrong hint
        content: 'hello support A',
        notifyUser: harness.notifyUser,
        io: harness.io,
      });
      assert.equal(result.ok, true);
      assert.equal(result.clientMessage.receiverId, IDS.supportA);
      assert.equal(result.clientMessage.receiverRole, 'staff');
      assert.ok(result.conversationId.includes(`staff_${IDS.supportA}`));

      const receiveEvents = harness.emits.filter((e) => e.event === 'message:receive');
      assert.ok(receiveEvents.length >= 1);
      // Exact socket or user room — never ALL_STAFF / ALL_SUPPORT
      for (const e of receiveEvents) {
        assert.equal(e.rooms.includes('ALL_STAFF'), false);
        assert.equal(e.rooms.includes('ALL_SUPPORT'), false);
        const targetsSupportA = e.rooms.includes('sock_supportA') || e.rooms.includes(IDS.supportA);
        assert.equal(targetsSupportA, true);
        assert.equal(e.rooms.includes('sock_supportB'), false);
        assert.equal(e.rooms.includes('sock_staffA'), false);
        assert.equal(e.rooms.includes(IDS.supportB), false);
        assert.equal(e.rooms.includes(IDS.staffA), false);
      }
    } finally {
      Message.create = origMessageCreate;
      ConversationVisibility.findOneAndUpdate = origVisibility;
    }
  });

  it('Staff vs Support transport collision: wrong peer does not receive', async () => {
    const { sendCanonicalMessage } = require('../../services/directMessageService');
    Message.create = async (doc) => ({
      ...doc,
      _id: 'msg_collision',
      createdAt: new Date(),
      toObject() { return { ...this }; },
    });
    ConversationVisibility.findOneAndUpdate = async () => ({});
    const harness = createNotifyHarness();
    harness.onlineUsers.set(`staff_${IDS.supportA}`, { socketId: 'sock_supportA' });
    harness.onlineUsers.set(`staff_${IDS.staffA}`, { socketId: 'sock_staffA' });

    try {
      const toSupport = await sendCanonicalMessage({
        sender: actorFromDoc(IDS.studentA),
        receiverId: IDS.supportA,
        receiverRole: 'staff',
        content: 'to support',
        notifyUser: harness.notifyUser,
        io: harness.io,
      });
      assert.equal(toSupport.ok, true);
      let receives = harness.emits.filter((e) => e.event === 'message:receive');
      assert.ok(receives.every((e) => e.rooms.includes('sock_supportA') || e.rooms.includes(IDS.supportA)));
      assert.ok(receives.every((e) => !e.rooms.includes('sock_staffA')));

      harness.emits.length = 0;
      const toStaff = await sendCanonicalMessage({
        sender: actorFromDoc(IDS.studentA),
        receiverId: IDS.staffA,
        receiverRole: 'staff',
        content: 'to staff',
        notifyUser: harness.notifyUser,
        io: harness.io,
      });
      assert.equal(toStaff.ok, true);
      receives = harness.emits.filter((e) => e.event === 'message:receive');
      assert.ok(receives.every((e) => e.rooms.includes('sock_staffA') || e.rooms.includes(IDS.staffA)));
      assert.ok(receives.every((e) => !e.rooms.includes('sock_supportA')));
    } finally {
      Message.create = origMessageCreate;
      ConversationVisibility.findOneAndUpdate = origVisibility;
    }
  });

  it('Support A vs Support B independent conversations + delivery', async () => {
    const { sendCanonicalMessage } = require('../../services/directMessageService');
    const msgs = [];
    Message.create = async (doc) => {
      const row = {
        ...doc,
        _id: `msg_${msgs.length}`,
        createdAt: new Date(),
        toObject() { return { ...this }; },
      };
      msgs.push(row);
      return row;
    };
    ConversationVisibility.findOneAndUpdate = async () => ({});
    const harness = createNotifyHarness();
    harness.onlineUsers.set(`staff_${IDS.supportA}`, { socketId: 'sock_supportA' });
    harness.onlineUsers.set(`staff_${IDS.supportB}`, { socketId: 'sock_supportB' });

    try {
      const a = await sendCanonicalMessage({
        sender: actorFromDoc(IDS.studentA),
        receiverId: IDS.supportA,
        receiverRole: 'staff',
        content: 'A',
        notifyUser: harness.notifyUser,
        io: harness.io,
      });
      const b = await sendCanonicalMessage({
        sender: actorFromDoc(IDS.studentA),
        receiverId: IDS.supportB,
        receiverRole: 'staff',
        content: 'B',
        notifyUser: harness.notifyUser,
        io: harness.io,
      });
      assert.notEqual(a.conversationId, b.conversationId);
      const receives = harness.emits.filter((e) => e.event === 'message:receive');
      assert.equal(receives.length, 2);
      assert.ok(receives[0].rooms.includes('sock_supportA') || receives[0].rooms.includes(IDS.supportA));
      assert.ok(receives[1].rooms.includes('sock_supportB') || receives[1].rooms.includes(IDS.supportB));
      assert.equal(receives[0].rooms.includes('sock_supportB'), false);
      assert.equal(receives[1].rooms.includes('sock_supportA'), false);
    } finally {
      Message.create = origMessageCreate;
      ConversationVisibility.findOneAndUpdate = origVisibility;
    }
  });

  it('server.js notifyUser never private-fans ALL_STAFF/ALL_SUPPORT; socket+REST use sendCanonicalMessage', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const idx = src.indexOf('app.notifyUser =');
    const chunk = src.slice(idx, idx + 900);
    assert.equal(chunk.includes("io.to('ALL_STAFF').emit"), false);
    assert.equal(chunk.includes("io.to('ALL_SUPPORT').emit"), false);
    assert.ok(chunk.includes('io.to(strUserId)'));
    assert.ok(src.includes('sendCanonicalMessage'));
    const routes = fs.readFileSync(path.join(ROOT, 'routes/messageRoutes.js'), 'utf8');
    assert.ok(routes.includes('sendCanonicalMessage'));
  });

  it('inactive recipient: current pairing does not deny on status (ALLOW — documented)', async () => {
    const support = DOCS[IDS.supportA].doc;
    const prev = support.status;
    support.status = 'inactive';
    try {
      const r = await resolveCanonicalRecipient(IDS.supportA);
      assert.equal(r.ok, true);
      assert.equal(r.recipient.status, 'inactive');
      const send = await canSendMessage(actorFromDoc(IDS.studentA), IDS.supportA, 'staff');
      assert.equal(send.allowed, true); // current behavior — not invented deny
    } finally {
      support.status = prev;
    }
  });

  it('tenantId resolved; cross-tenant denied by Phase 5.1 policy', async () => {
    const support = DOCS[IDS.supportA].doc;
    assert.equal((await resolveCanonicalRecipient(IDS.supportA)).recipient.tenantId, TENANT_A);

    const prev = support.tenantId;
    support.tenantId = '607f1f77bcf86cd7994390bb';
    try {
      const cross = await canSendMessage(actorFromDoc(IDS.studentA), IDS.supportA, 'staff');
      assert.equal(cross.allowed, false);
      assert.equal(cross.code, 'MESSAGING_TENANT_MISMATCH');
    } finally {
      support.tenantId = prev;
    }
  });

  it('legacy admin_admin preserved', () => {
    const mailbox = buildConversationId('admin', 'admin', 'student', IDS.studentA);
    assert.ok(mailbox.includes('admin_admin'));
  });
});
