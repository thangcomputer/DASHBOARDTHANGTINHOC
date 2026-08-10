/**
 * Phase 6 — Canonical contact discovery consolidation.
 * Authority: MessagingPolicy.canDiscoverContacts via messagingContactsService.
 * DISCOVER ≠ SEND preserved (C1/C2).
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');
const Branch = require('../../models/Branch');
const {
  PRODUCT_ROLES,
  POLICY_CODES,
  canDiscoverContacts,
  canSendStructurally,
  canSendMessage,
} = require('../../services/messagingPolicy');
const { listDiscoverableContacts } = require('../../services/messagingContactsService');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const TENANT_A = '607f1f77bcf86cd7994390aa';
const TENANT_B = '607f1f77bcf86cd7994390bb';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';

const IDS = {
  studentA: 'c61111111111111111111111',
  teacherA: 'c62222222222222222222222',
  staffA: 'c63333333333333333333333',
  supportA: 'c64444444444444444444444',
  highA: 'c65555555555555555555555',
  superA: 'c66666666666666666666666',
  studentB: 'c67777777777777777777777',
  supportB: 'c68888888888888888888888',
  staffB: 'c69999999999999999999999',
  teacherB: 'c6aaaaaaaaaaaaaaaaaaaaaa',
};

const DOCS = {
  [IDS.studentA]: {
    kind: 'student',
    doc: {
      _id: IDS.studentA, name: 'P6 Student A', role: 'student',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A,
      teacherId: IDS.teacherA, enrollments: [{ teacherId: IDS.teacherA }],
    },
  },
  [IDS.teacherA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.teacherA, name: 'P6 Teacher A', role: 'teacher',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
      assignedStudents: [IDS.studentA],
    },
  },
  [IDS.staffA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.staffA, name: 'P6 Staff A', role: 'admin', adminRole: 'STAFF',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.supportA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.supportA, name: 'P6 Support A', role: 'admin', adminRole: 'SUPPORT',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.highA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.highA, name: 'P6 High A', role: 'admin', adminRole: 'HIGH_ADMIN',
      tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.superA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.superA, name: 'P6 Super A', role: 'admin', adminRole: 'SUPER_ADMIN',
      tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.studentB]: {
    kind: 'student',
    doc: {
      _id: IDS.studentB, name: 'P6 Student B', role: 'student',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B,
      teacherId: IDS.teacherB, enrollments: [{ teacherId: IDS.teacherB }],
    },
  },
  [IDS.supportB]: {
    kind: 'teacher',
    doc: {
      _id: IDS.supportB, name: 'P6 Support B', role: 'admin', adminRole: 'SUPPORT',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B, status: 'Active',
    },
  },
  [IDS.staffB]: {
    kind: 'teacher',
    doc: {
      _id: IDS.staffB, name: 'P6 Staff B', role: 'admin', adminRole: 'STAFF',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B, status: 'Active',
    },
  },
  [IDS.teacherB]: {
    kind: 'teacher',
    doc: {
      _id: IDS.teacherB, name: 'P6 Teacher B', role: 'teacher',
      branchId: BRANCH_B, branchCode: 'B', tenantId: TENANT_B, status: 'Active',
      assignedStudents: [IDS.studentB],
    },
  },
};

function actorFrom(id) {
  const d = DOCS[id].doc;
  return {
    id: String(d._id),
    role: d.role,
    adminRole: d.adminRole || null,
    branchId: d.branchId ? String(d.branchId) : null,
    branchCode: d.branchCode || '',
    tenantId: d.tenantId ? String(d.tenantId) : null,
  };
}

function idsOf(contacts) {
  return new Set((contacts || []).map((c) => String(c.id)));
}

function contactById(contacts, id) {
  return (contacts || []).find((c) => String(c.id) === String(id));
}

function getPath(doc, dotted) {
  if (!dotted.includes('.')) return doc[dotted];
  const parts = dotted.split('.');
  // Mongo dotted path on array: enrollments.teacherId → any element
  if (parts.length === 2 && Array.isArray(doc[parts[0]])) {
    return doc[parts[0]].map((el) => el?.[parts[1]]);
  }
  let cur = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function matchClause(doc, key, val) {
  if (key === '$or') {
    return (val || []).some((sub) => matchQuery(doc, sub));
  }
  if (key === '$and') {
    return (val || []).every((sub) => matchQuery(doc, sub));
  }

  const actual = getPath(doc, key);

  if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(val, '$in')) {
      const set = val.$in.map((x) => String(x));
      if (Array.isArray(actual)) {
        return actual.some((a) => set.includes(String(a)));
      }
      return set.includes(String(actual));
    }
    if (Object.prototype.hasOwnProperty.call(val, '$nin')) {
      const set = val.$nin.map((x) => String(x));
      return !set.includes(String(actual));
    }
    if (Object.prototype.hasOwnProperty.call(val, '$exists')) {
      const exists = actual !== undefined && actual !== null;
      return Boolean(val.$exists) === exists;
    }
  }

  if (val === null) {
    return actual === null || actual === undefined;
  }

  if (Array.isArray(actual)) {
    return actual.some((a) => String(a) === String(val));
  }
  return String(actual) === String(val);
}

function matchQuery(doc, query = {}) {
  return Object.entries(query).every(([k, v]) => matchClause(doc, k, v));
}

function leanDocs(kind, query = {}) {
  return Object.values(DOCS)
    .filter((e) => e.kind === kind)
    .map((e) => ({ ...e.doc }))
    .filter((doc) => matchQuery(doc, query || {}));
}

function chain(docs) {
  return {
    select() { return this; },
    lean: async () => docs,
    then(resolve, reject) {
      return Promise.resolve(docs).then(resolve, reject);
    },
  };
}

const origTeacherFind = Teacher.find;
const origTeacherFindById = Teacher.findById;
const origStudentFind = Student.find;
const origStudentFindById = Student.findById;
const origBranchFind = Branch.find;

function installStubs() {
  Teacher.find = (query) => chain(leanDocs('teacher', query || {}));
  Teacher.findById = (id) => ({
    select() { return this; },
    lean: async () => {
      const e = DOCS[String(id)];
      return e && e.kind === 'teacher' ? { ...e.doc } : null;
    },
  });
  Student.find = (query) => chain(leanDocs('student', query || {}));
  Student.findById = (id) => ({
    select() { return this; },
    lean: async () => {
      const e = DOCS[String(id)];
      return e && e.kind === 'student' ? { ...e.doc } : null;
    },
  });
  Branch.find = (query) => ({
    select() { return this; },
    lean: async () => {
      const ids = (query?._id?.$in || []).map(String);
      const rows = [];
      if (ids.includes(BRANCH_A)) rows.push({ _id: BRANCH_A, tenantId: TENANT_A });
      if (ids.includes(BRANCH_B)) rows.push({ _id: BRANCH_B, tenantId: TENANT_B });
      return rows;
    },
  });
}

function restoreStubs() {
  Teacher.find = origTeacherFind;
  Teacher.findById = origTeacherFindById;
  Student.find = origStudentFind;
  Student.findById = origStudentFindById;
  Branch.find = origBranchFind;
}

describe('Phase 6 messaging contacts policy', { concurrency: false }, () => {
  before(() => installStubs());
  after(() => restoreStubs());

  it('wiring: GET /contacts → listDiscoverableContacts → canDiscoverContacts', () => {
    const routes = read('routes/messageRoutes.js');
    const svc = read('services/messagingContactsService.js');
    assert.ok(routes.includes('listDiscoverableContacts'));
    assert.ok(routes.includes("require('../services/messagingContactsService')"));
    assert.equal(routes.includes("else if (userRole === 'student')"), false);
    assert.ok(svc.includes('canDiscoverContacts'));
    assert.ok(svc.includes("require('./messagingPolicy')"));
    assert.equal(svc.includes('function canDiscoverContacts'), false);
  });

  it('no second discovery authority function introduced', () => {
    const svc = read('services/messagingContactsService.js');
    const policy = read('services/messagingPolicy.js');
    assert.equal(/\bisContactAllowed\b/.test(svc), false);
    assert.equal(/\bcanMessageUser\b/.test(svc), false);
    assert.equal(/\bisAllowedContact\b/.test(svc), false);
    assert.ok(policy.includes('function canDiscoverContacts'));
  });

  it('FE removed unauthorized contact seeding', () => {
    const msg = read('client/src/context/useDataMessaging.js');
    const inbox = read('client/src/components/Inbox.jsx');
    const fm = read('client/src/components/FloatingMessenger.jsx');
    assert.ok(msg.includes('server-authoritative'));
    assert.equal(msg.includes("buildConversationId('student', sId, 'staff', stId)"), false);
    assert.equal(msg.includes('teacherIds.forEach'), false);
    assert.ok(inbox.includes('Discovery contacts come only'));
    assert.ok(fm.includes('never fall back to local staffs'));
    assert.equal(fm.includes('fmContacts.length > 0 ? fmContacts : staffs'), false);
  });

  it('MessagesContext remains legacy / unmounted', () => {
    const app = read('client/src/App.jsx');
    const data = read('client/src/context/DataContext.jsx');
    assert.equal(app.includes('MessagesContext'), false);
    assert.ok(data.includes('MessagesContext chưa mount') || data.includes('useDataMessaging'));
  });

  it('matrix: Student discovery vs Staff/Support/Teacher/HIGH/SUPER', async () => {
    const contacts = await listDiscoverableContacts(actorFrom(IDS.studentA));
    const ids = idsOf(contacts);
    assert.equal(ids.has(IDS.staffA), true, `got ${[...ids]}`);
    assert.equal(ids.has(IDS.supportA), true);
    assert.equal(ids.has(IDS.teacherA), true);
    assert.equal(ids.has(IDS.highA), false);
    assert.equal(ids.has(IDS.superA), false);
    assert.equal(ids.has(IDS.supportB), false);

    const support = contactById(contacts, IDS.supportA);
    assert.equal(support.productRole, PRODUCT_ROLES.SUPPORT);
    assert.equal(support.transportRole, 'staff');
    assert.equal(support.adminRole, 'SUPPORT');
    assert.notEqual(support.productRole, PRODUCT_ROLES.STAFF);

    const staff = contactById(contacts, IDS.staffA);
    assert.equal(staff.productRole, PRODUCT_ROLES.STAFF);
    assert.equal(staff.transportRole, 'staff');
  });

  it('matrix: Teacher discovery', async () => {
    const contacts = await listDiscoverableContacts(actorFrom(IDS.teacherA));
    const ids = idsOf(contacts);
    assert.equal(ids.has(IDS.studentA), true, `got ${[...ids]}`);
    assert.equal(ids.has(IDS.staffA), true);
    assert.equal(ids.has(IDS.supportA), true);
    assert.equal(ids.has(IDS.highA), true);
    assert.equal(ids.has(IDS.superA), false);
    assert.equal(ids.has(IDS.studentB), false);
  });

  it('matrix: Staff discovery', async () => {
    const contacts = await listDiscoverableContacts(actorFrom(IDS.staffA));
    const ids = idsOf(contacts);
    assert.equal(ids.has(IDS.supportA), true, `got ${[...ids]}`);
    assert.equal(ids.has(IDS.studentA), true);
    assert.equal(ids.has(IDS.teacherA), true);
    assert.equal(ids.has(IDS.highA), true);
    assert.equal(ids.has(IDS.superA), false);
    assert.equal(ids.has(IDS.supportB), false);
  });

  it('matrix: Support discovery', async () => {
    const contacts = await listDiscoverableContacts(actorFrom(IDS.supportA));
    const ids = idsOf(contacts);
    assert.equal(ids.has(IDS.staffA), true, `got ${[...ids]}`);
    assert.equal(ids.has(IDS.studentA), true);
    assert.equal(ids.has(IDS.teacherA), true);
    assert.equal(ids.has(IDS.highA), true);
    assert.equal(ids.has(IDS.superA), false);
  });

  it('tenant isolation: Student A never discovers Support B', async () => {
    const contacts = await listDiscoverableContacts(actorFrom(IDS.studentA));
    assert.equal(idsOf(contacts).has(IDS.supportB), false);
    assert.equal(
      canDiscoverContacts(actorFrom(IDS.studentA), actorFrom(IDS.supportB), { sameBranch: false }).allowed,
      false,
    );
  });

  it('branch isolation: Student A does not discover Staff B', async () => {
    const contacts = await listDiscoverableContacts(actorFrom(IDS.studentA));
    assert.equal(idsOf(contacts).has(IDS.staffB), false);
  });

  it('DISCOVER ≠ SEND: Student → HIGH / SUPER', async () => {
    const contacts = await listDiscoverableContacts(actorFrom(IDS.studentA));
    assert.equal(idsOf(contacts).has(IDS.highA), false);
    assert.equal(idsOf(contacts).has(IDS.superA), false);

    assert.equal(canDiscoverContacts(actorFrom(IDS.studentA), actorFrom(IDS.highA)).allowed, false);
    assert.equal(canDiscoverContacts(actorFrom(IDS.studentA), actorFrom(IDS.superA)).allowed, false);
    assert.equal(canSendStructurally(actorFrom(IDS.studentA), actorFrom(IDS.highA)).allowed, true);
    assert.equal(canSendStructurally(actorFrom(IDS.studentA), actorFrom(IDS.superA)).allowed, true);

    const sendHigh = await canSendMessage(actorFrom(IDS.studentA), IDS.highA, 'admin');
    const sendSuper = await canSendMessage(actorFrom(IDS.studentA), IDS.superA, 'admin');
    assert.equal(sendHigh.allowed, true);
    assert.equal(sendSuper.allowed, true);
  });

  it('policy fail-closed for unknown roles', () => {
    const weird = { id: IDS.studentA, role: 'ghost', tenantId: TENANT_A };
    const d = canDiscoverContacts(weird, actorFrom(IDS.supportA));
    assert.equal(d.allowed, false);
    assert.ok(
      d.code === POLICY_CODES.DISCOVER_DENIED
      || d.code === POLICY_CODES.UNKNOWN_PRODUCT_ROLE
      || d.code === 'MESSAGING_UNKNOWN_PRODUCT_ROLE',
    );
  });
});
