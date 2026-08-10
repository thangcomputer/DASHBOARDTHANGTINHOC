/**
 * Phase 5.1 — Fail-closed tenant isolation for private DM.
 * Enforced in MessagingPolicy.canSendMessage (REST + Socket share sendCanonicalMessage).
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');
const Message = require('../../models/Message');
const ConversationVisibility = require('../../models/ConversationVisibility');
const Branch = require('../../models/Branch');
const {
  POLICY_CODES,
  canSendMessage,
  canDiscoverContacts,
  resolveCanonicalRecipient,
} = require('../../services/messagingPolicy');

const ROOT = path.join(__dirname, '../..');

const TENANT_A = '607f1f77bcf86cd7994390aa';
const TENANT_B = '607f1f77bcf86cd7994390bb';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';

const IDS = {
  studentA1: 'aa1111111111111111111111',
  supportA1: 'aa2222222222222222222222',
  staffA1: 'aa3333333333333333333333',
  teacherA1: 'aa4444444444444444444444',
  studentB1: 'bb1111111111111111111111',
  supportB1: 'bb2222222222222222222222',
  staffB1: 'bb3333333333333333333333',
  teacherB1: 'bb4444444444444444444444',
};

const DOCS = {
  [IDS.studentA1]: {
    kind: 'student',
    doc: {
      _id: IDS.studentA1, name: 'Student A1', role: 'student',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A,
      teacherId: IDS.teacherA1, enrollments: [{ teacherId: IDS.teacherA1 }],
    },
  },
  [IDS.supportA1]: {
    kind: 'teacher',
    doc: {
      _id: IDS.supportA1, name: 'Support A1', role: 'admin', adminRole: 'SUPPORT',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.staffA1]: {
    kind: 'teacher',
    doc: {
      _id: IDS.staffA1, name: 'Staff A1', role: 'admin', adminRole: 'STAFF',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.teacherA1]: {
    kind: 'teacher',
    doc: {
      _id: IDS.teacherA1, name: 'Teacher A1', role: 'teacher',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.studentB1]: {
    kind: 'student',
    doc: {
      _id: IDS.studentB1, name: 'Student B1', role: 'student',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B,
      teacherId: IDS.teacherB1, enrollments: [{ teacherId: IDS.teacherB1 }],
    },
  },
  [IDS.supportB1]: {
    kind: 'teacher',
    doc: {
      _id: IDS.supportB1, name: 'Support B1', role: 'admin', adminRole: 'SUPPORT',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B, status: 'Active',
    },
  },
  [IDS.staffB1]: {
    kind: 'teacher',
    doc: {
      _id: IDS.staffB1, name: 'Staff B1', role: 'admin', adminRole: 'STAFF',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B, status: 'Active',
    },
  },
  [IDS.teacherB1]: {
    kind: 'teacher',
    doc: {
      _id: IDS.teacherB1, name: 'Teacher B1', role: 'teacher',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B, status: 'Active',
    },
  },
};

function leanChain(doc) {
  return {
    select() { return this; },
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

function installStubs() {
  Teacher.findById = (id) => {
    const hit = DOCS[String(id)];
    return leanChain(hit?.kind === 'teacher' ? hit.doc : null);
  };
  Student.findById = (id) => {
    const hit = DOCS[String(id)];
    return leanChain(hit?.kind === 'student' ? hit.doc : null);
  };
  Teacher.find = (query = {}) => {
    const ids = (query._id && query._id.$in) ? query._id.$in.map(String) : [];
    const rows = ids.map((id) => DOCS[id]).filter((h) => h?.kind === 'teacher').map((h) => ({ ...h.doc }));
    return { select() { return this; }, lean: async () => rows };
  };
  Student.find = (query = {}) => {
    const ids = (query._id && query._id.$in) ? query._id.$in.map(String) : [];
    const rows = ids.map((id) => DOCS[id]).filter((h) => h?.kind === 'student').map((h) => ({ ...h.doc }));
    return { select() { return this; }, lean: async () => rows };
  };
  // No Branch.tenantId fallback in these fixtures — tenants are explicit on docs
  Branch.findById = () => leanChain(null);
}

function restoreStubs() {
  Teacher.findById = origTeacherFindById;
  Student.findById = origStudentFindById;
  Teacher.find = origTeacherFind;
  Student.find = origStudentFind;
  Branch.findById = origBranchFindById;
}

function actor(id) {
  const d = DOCS[id].doc;
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

function createNotifyHarness() {
  const emits = [];
  const onlineUsers = new Map();
  const io = {
    to(room) {
      const rooms = [String(room)];
      const api = {
        to(next) { rooms.push(String(next)); return api; },
        emit(event, data) { emits.push({ rooms: [...rooms], event, data }); },
      };
      return api;
    },
  };
  function notifyUser(role, userId, eventName, data) {
    io.to(String(userId)).emit(eventName, data);
    return true;
  }
  return { io, emits, onlineUsers, notifyUser };
}

describe('Phase 5.1 tenant isolation', { concurrency: false }, () => {
  before(() => installStubs());
  after(() => {
    restoreStubs();
    Message.create = origMessageCreate;
    ConversationVisibility.findOneAndUpdate = origVisibility;
  });

  it('same tenant Student A1 → Support A1 ALLOW', async () => {
    const d = await canSendMessage(actor(IDS.studentA1), IDS.supportA1, 'staff');
    assert.equal(d.allowed, true);
    assert.equal(d.recipient.tenantId, TENANT_A);
  });

  it('cross tenant Student A1 → Support B1 DENY TENANT_MISMATCH', async () => {
    const d = await canSendMessage(actor(IDS.studentA1), IDS.supportB1, 'staff');
    assert.equal(d.allowed, false);
    assert.equal(d.code, POLICY_CODES.TENANT_MISMATCH);
    assert.equal(d.policy, 'TENANT');
  });

  it('cross tenant reversed Student B1 → Support A1 DENY', async () => {
    const d = await canSendMessage(actor(IDS.studentB1), IDS.supportA1, 'staff');
    assert.equal(d.allowed, false);
    assert.equal(d.code, POLICY_CODES.TENANT_MISMATCH);
  });

  it('Staff A1 → Staff B1 DENY (cross tenant)', async () => {
    const d = await canSendMessage(actor(IDS.staffA1), IDS.staffB1, 'staff');
    assert.equal(d.allowed, false);
    assert.equal(d.code, POLICY_CODES.TENANT_MISMATCH);
  });

  it('Support A1 → Support B1 DENY (cross tenant)', async () => {
    const d = await canSendMessage(actor(IDS.supportA1), IDS.supportB1, 'staff');
    assert.equal(d.allowed, false);
    assert.equal(d.code, POLICY_CODES.TENANT_MISMATCH);
  });

  it('same tenant Support A1 ↔ Staff A1 still allowed by matrix', async () => {
    const a = await canSendMessage(actor(IDS.supportA1), IDS.staffA1, 'staff');
    const b = await canSendMessage(actor(IDS.staffA1), IDS.supportA1, 'staff');
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, true);
  });

  it('Teacher/Student cross-tenant DENY regardless of pairing', async () => {
    assert.equal((await canSendMessage(actor(IDS.teacherA1), IDS.teacherB1, 'teacher')).allowed, false);
    assert.equal((await canSendMessage(actor(IDS.teacherA1), IDS.studentB1, 'student')).code, POLICY_CODES.TENANT_MISMATCH);
    assert.equal((await canSendMessage(actor(IDS.studentA1), IDS.teacherB1, 'teacher')).code, POLICY_CODES.TENANT_MISMATCH);
  });

  it('discover cross-tenant DENY (NO CONTACT)', () => {
    const d = canDiscoverContacts(actor(IDS.studentA1), actor(IDS.supportB1));
    assert.equal(d.allowed, false);
    assert.equal(d.code, POLICY_CODES.TENANT_MISMATCH);
  });

  it('missing actor tenant → SUPPORT ALLOW (org-wide inherit for unscoped teacher/student)', async () => {
    const a = { ...actor(IDS.studentA1) };
    delete a.tenantId;
    delete a.branchId; // prevent Branch fallback
    const d = await canSendMessage(a, IDS.supportA1, 'staff');
    assert.equal(d.allowed, true);
  });

  it('missing actor tenant → STAFF ALLOW via STAFF↔STUDENT soft-branch align', async () => {
    const a = { ...actor(IDS.studentA1) };
    delete a.tenantId;
    delete a.branchId;
    const d = await canSendMessage(a, IDS.staffA1, 'staff');
    assert.equal(d.allowed, true);
  });

  it('Teacher without branch still discovers SUPPORT', () => {
    const teacher = {
      id: IDS.teacherA1,
      role: 'teacher',
      branchId: null,
      branchCode: '',
      tenantId: null,
    };
    const support = actor(IDS.supportA1);
    const d = canDiscoverContacts(teacher, support);
    assert.equal(d.allowed, true);
  });

  it('missing recipient tenant on SUPPORT inherits actor tenant (org-wide helpdesk)', async () => {
    const prevT = DOCS[IDS.supportA1].doc.tenantId;
    const prevB = DOCS[IDS.supportA1].doc.branchId;
    delete DOCS[IDS.supportA1].doc.tenantId;
    delete DOCS[IDS.supportA1].doc.branchId;
    try {
      const d = await canSendMessage(actor(IDS.studentA1), IDS.supportA1, 'staff');
      assert.equal(d.allowed, true);
    } finally {
      DOCS[IDS.supportA1].doc.tenantId = prevT;
      DOCS[IDS.supportA1].doc.branchId = prevB;
    }
  });

  it('missing recipient tenant on STAFF: SUPPORT sender inherits (org-wide actor)', async () => {
    const prevT = DOCS[IDS.staffA1].doc.tenantId;
    const prevB = DOCS[IDS.staffA1].doc.branchId;
    delete DOCS[IDS.staffA1].doc.tenantId;
    delete DOCS[IDS.staffA1].doc.branchId;
    try {
      const d = await canSendMessage(actor(IDS.supportA1), IDS.staffA1, 'staff');
      assert.equal(d.allowed, true);
    } finally {
      DOCS[IDS.staffA1].doc.tenantId = prevT;
      DOCS[IDS.staffA1].doc.branchId = prevB;
    }
  });

  it('Staff synthetic branch → Support unscoped ALLOW', async () => {
    const staff = {
      ...actor(IDS.staffA1),
      tenantId: `branch:${BRANCH_A}`,
    };
    const prevT = DOCS[IDS.supportA1].doc.tenantId;
    const prevB = DOCS[IDS.supportA1].doc.branchId;
    delete DOCS[IDS.supportA1].doc.tenantId;
    delete DOCS[IDS.supportA1].doc.branchId;
    try {
      const d = await canSendMessage(staff, IDS.supportA1, 'staff');
      assert.equal(d.allowed, true);
    } finally {
      DOCS[IDS.supportA1].doc.tenantId = prevT;
      DOCS[IDS.supportA1].doc.branchId = prevB;
    }
  });

  it('Staff → Teacher with empty teacher branch ALLOW (pairing soft-allow + tenant align)', async () => {
    const prevT = DOCS[IDS.teacherA1].doc.tenantId;
    const prevB = DOCS[IDS.teacherA1].doc.branchId;
    const prevC = DOCS[IDS.teacherA1].doc.branchCode;
    delete DOCS[IDS.teacherA1].doc.tenantId;
    delete DOCS[IDS.teacherA1].doc.branchId;
    delete DOCS[IDS.teacherA1].doc.branchCode;
    try {
      const d = await canSendMessage(actor(IDS.staffA1), IDS.teacherA1, 'teacher');
      assert.equal(d.allowed, true);
      const rev = await canSendMessage(actor(IDS.teacherA1), IDS.staffA1, 'staff');
      assert.equal(rev.allowed, true);
    } finally {
      DOCS[IDS.teacherA1].doc.tenantId = prevT;
      DOCS[IDS.teacherA1].doc.branchId = prevB;
      DOCS[IDS.teacherA1].doc.branchCode = prevC;
    }
  });

  it('Student ↔ assigned Teacher with empty teacher branch ALLOW (assignment + tenant align)', async () => {
    const prevT = DOCS[IDS.teacherA1].doc.tenantId;
    const prevB = DOCS[IDS.teacherA1].doc.branchId;
    const prevC = DOCS[IDS.teacherA1].doc.branchCode;
    delete DOCS[IDS.teacherA1].doc.tenantId;
    delete DOCS[IDS.teacherA1].doc.branchId;
    delete DOCS[IDS.teacherA1].doc.branchCode;
    try {
      const a = await canSendMessage(actor(IDS.studentA1), IDS.teacherA1, 'teacher');
      assert.equal(a.allowed, true);
      const b = await canSendMessage(actor(IDS.teacherA1), IDS.studentA1, 'student');
      assert.equal(b.allowed, true);
    } finally {
      DOCS[IDS.teacherA1].doc.tenantId = prevT;
      DOCS[IDS.teacherA1].doc.branchId = prevB;
      DOCS[IDS.teacherA1].doc.branchCode = prevC;
    }
  });

  it('client receiverTenantId spoof cannot authorize cross-tenant', async () => {
    // Spoof fields on actor object must not override recipient authoritative tenant
    const spoofedActor = {
      ...actor(IDS.studentA1),
      receiverTenantId: TENANT_B,
      clientTenantId: TENANT_B,
    };
    const d = await canSendMessage(spoofedActor, IDS.supportB1, 'staff');
    assert.equal(d.allowed, false);
    assert.equal(d.code, POLICY_CODES.TENANT_MISMATCH);
  });

  it('wrong receiverRole still resolves SUPPORT but tenant deny wins first on cross-tenant', async () => {
    const r = await resolveCanonicalRecipient(IDS.supportB1, { roleHint: 'teacher' });
    assert.equal(r.recipient.productRole, 'SUPPORT');
    assert.equal(r.recipient.transportRole, 'staff');
    const d = await canSendMessage(actor(IDS.studentA1), IDS.supportB1, 'teacher');
    assert.equal(d.allowed, false);
    assert.equal(d.code, POLICY_CODES.TENANT_MISMATCH);
  });

  it('REST/Socket path: sendCanonicalMessage — no persistence / no receive on cross-tenant', async () => {
    const { sendCanonicalMessage } = require('../../services/directMessageService');
    let creates = 0;
    Message.create = async (doc) => {
      creates += 1;
      return {
        ...doc,
        _id: 'should_not_exist',
        createdAt: new Date(),
        toObject() { return { ...this }; },
      };
    };
    ConversationVisibility.findOneAndUpdate = async () => { throw new Error('should not hide/unhide'); };

    const harness = createNotifyHarness();
    harness.onlineUsers.set(`staff_${IDS.supportB1}`, { socketId: 'sock_b' });

    try {
      const result = await sendCanonicalMessage({
        sender: actor(IDS.studentA1),
        receiverId: IDS.supportB1,
        receiverRole: 'staff',
        receiverTenantId: TENANT_A, // client spoof — ignored
        content: 'cross-tenant probe',
        notifyUser: harness.notifyUser,
        io: harness.io,
      });
      assert.equal(result.ok, false);
      assert.equal(result.status, 403);
      assert.equal(creates, 0);
      assert.equal(harness.emits.filter((e) => e.event === 'message:receive').length, 0);
    } finally {
      Message.create = origMessageCreate;
      ConversationVisibility.findOneAndUpdate = origVisibility;
    }
  });

  it('same-tenant sendCanonicalMessage still persists + notifies exact recipient', async () => {
    const { sendCanonicalMessage } = require('../../services/directMessageService');
    let creates = 0;
    Message.create = async (doc) => {
      creates += 1;
      return {
        ...doc,
        _id: 'msg_ok',
        createdAt: new Date(),
        toObject() { return { ...this }; },
      };
    };
    ConversationVisibility.findOneAndUpdate = async () => ({});
    const harness = createNotifyHarness();

    try {
      const result = await sendCanonicalMessage({
        sender: actor(IDS.studentA1),
        receiverId: IDS.supportA1,
        receiverRole: 'staff',
        content: 'same tenant',
        notifyUser: harness.notifyUser,
        io: harness.io,
      });
      assert.equal(result.ok, true);
      assert.equal(creates, 1);
      const receives = harness.emits.filter((e) => e.event === 'message:receive');
      assert.equal(receives.length, 1);
      assert.ok(receives[0].rooms.includes(IDS.supportA1));
      assert.equal(receives[0].rooms.includes('ALL_STAFF'), false);
    } finally {
      Message.create = origMessageCreate;
      ConversationVisibility.findOneAndUpdate = origVisibility;
    }
  });

  it('wiring: tenant check lives in MessagingPolicy canSendMessage', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/messagingPolicy.js'), 'utf8');
    assert.ok(src.includes('assertTenantIsolation'));
    assert.ok(src.includes('MESSAGING_TENANT_MISMATCH'));
    assert.ok(src.includes('resolveAuthoritativeTenantId'));
    const dms = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
    assert.ok(dms.includes('assertCanDirectMessage'));
  });
});
