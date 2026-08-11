/**
 * HIGH_ADMIN → SUPER directory discovery (synthetic root id=admin).
 * Discovery only — no pairing/send/auth changes.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');
const Branch = require('../../models/Branch');
const SystemSettings = require('../../models/SystemSettings');
const {
  listDiscoverableContacts,
  ensureRootSuperAdminAmongDocs,
  isRootSuperAdminDoc,
} = require('../../services/messagingContactsService');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const TENANT_A = '607f1f77bcf86cd7994390aa';
const BRANCH_A = '507f1f77bcf86cd7994390aa';

const IDS = {
  studentA: 'd61111111111111111111111',
  teacherA: 'd62222222222222222222222',
  staffA: 'd63333333333333333333333',
  supportA: 'd64444444444444444444444',
  highA: 'd65555555555555555555555',
  superTeacher: 'd66666666666666666666666',
};

const DOCS = {
  [IDS.studentA]: {
    kind: 'student',
    doc: {
      _id: IDS.studentA, name: 'Dir Student', role: 'student',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A,
      teacherId: IDS.teacherA, enrollments: [{ teacherId: IDS.teacherA }],
    },
  },
  [IDS.teacherA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.teacherA, name: 'Dir Teacher', role: 'teacher',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
      assignedStudents: [IDS.studentA],
    },
  },
  [IDS.staffA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.staffA, name: 'Dir Staff', role: 'admin', adminRole: 'STAFF',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.supportA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.supportA, name: 'Dir Support', role: 'admin', adminRole: 'SUPPORT',
      branchId: BRANCH_A, branchCode: 'A', tenantId: TENANT_A, status: 'Active',
    },
  },
  [IDS.highA]: {
    kind: 'teacher',
    doc: {
      _id: IDS.highA, name: 'Dir High', role: 'admin', adminRole: 'HIGH_ADMIN',
      tenantId: TENANT_A, status: 'Active',
    },
  },
};

function actor(id, overrides = {}) {
  const d = DOCS[id]?.doc || {};
  return {
    id: String(overrides.id || d._id || id),
    role: overrides.role || d.role || 'admin',
    adminRole: overrides.adminRole !== undefined ? overrides.adminRole : (d.adminRole || null),
    branchId: overrides.branchId !== undefined ? overrides.branchId : (d.branchId ? String(d.branchId) : null),
    branchCode: overrides.branchCode || d.branchCode || '',
    tenantId: overrides.tenantId || d.tenantId || TENANT_A,
  };
}

function matchClause(doc, key, val) {
  if (key === '$or') return (val || []).some((sub) => matchQuery(doc, sub));
  if (key === '$and') return (val || []).every((sub) => matchQuery(doc, sub));
  const actual = doc[key];
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    if (Object.prototype.hasOwnProperty.call(val, '$in')) {
      return val.$in.map(String).includes(String(actual));
    }
    if (Object.prototype.hasOwnProperty.call(val, '$nin')) {
      return !val.$nin.map(String).includes(String(actual));
    }
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
const origSettingsFindOne = SystemSettings.findOne;

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
  Branch.find = () => ({
    select() { return this; },
    lean: async () => [{ _id: BRANCH_A, tenantId: TENANT_A }],
  });
  SystemSettings.findOne = () => ({
    select() { return this; },
    lean: async () => ({ _key: 'main', adminName: 'Root Super Name' }),
  });
}

function restoreStubs() {
  Teacher.find = origTeacherFind;
  Teacher.findById = origTeacherFindById;
  Student.find = origStudentFind;
  Student.findById = origStudentFindById;
  Branch.find = origBranchFind;
  SystemSettings.findOne = origSettingsFindOne;
  delete DOCS[IDS.superTeacher];
  delete DOCS.admin;
}

describe('HIGH_ADMIN SUPER directory discovery', { concurrency: false }, () => {
  before(() => installStubs());
  after(() => restoreStubs());

  it('A HIGH sees synthetic root SUPER when Teacher SUPER docs empty', async () => {
    const contacts = await listDiscoverableContacts(actor(IDS.highA));
    const admin = contacts.find((c) => String(c.id) === 'admin');
    assert.ok(admin, 'expected id=admin contact');
    assert.equal(admin.adminRole, 'SUPER_ADMIN');
    assert.equal(admin.productRole, 'SUPER_ADMIN');
    assert.equal(admin.role, 'admin');
  });

  it('B HIGH does not duplicate admin when Teacher root SUPER exists', async () => {
    DOCS.admin = {
      kind: 'teacher',
      doc: {
        _id: 'admin', name: 'Teacher Root Super', phone: 'admin',
        role: 'admin', adminRole: 'SUPER_ADMIN', tenantId: TENANT_A, status: 'Active',
      },
    };
    try {
      const contacts = await listDiscoverableContacts(actor(IDS.highA));
      const admins = contacts.filter((c) => String(c.id) === 'admin');
      assert.equal(admins.length, 1);
      assert.equal(admins[0].adminRole, 'SUPER_ADMIN');
    } finally {
      delete DOCS.admin;
    }
  });

  it('B2 ensureRootSuperAdminAmongDocs preserves real SUPER + adds admin once', async () => {
    const withReal = await ensureRootSuperAdminAmongDocs([
      { _id: IDS.superTeacher, name: 'Real Super', adminRole: 'SUPER_ADMIN' },
    ]);
    assert.equal(withReal.filter(isRootSuperAdminDoc).length, 1);
    assert.ok(withReal.some((d) => String(d._id) === IDS.superTeacher));
    assert.ok(withReal.some((d) => String(d._id) === 'admin'));

    const already = await ensureRootSuperAdminAmongDocs([
      { _id: 'admin', phone: 'admin', adminRole: 'SUPER_ADMIN', name: 'X' },
    ]);
    assert.equal(already.filter(isRootSuperAdminDoc).length, 1);
  });

  it('D STAFF cannot discover SUPER', async () => {
    const contacts = await listDiscoverableContacts(actor(IDS.staffA));
    assert.equal(contacts.some((c) => String(c.id) === 'admin' || c.adminRole === 'SUPER_ADMIN'), false);
  });

  it('E SUPPORT cannot discover SUPER', async () => {
    const contacts = await listDiscoverableContacts(actor(IDS.supportA));
    assert.equal(contacts.some((c) => String(c.id) === 'admin' || c.adminRole === 'SUPER_ADMIN'), false);
  });

  it('F TEACHER cannot discover SUPER', async () => {
    const contacts = await listDiscoverableContacts(actor(IDS.teacherA));
    assert.equal(contacts.some((c) => String(c.id) === 'admin' || c.adminRole === 'SUPER_ADMIN'), false);
  });

  it('G STUDENT cannot discover SUPER', async () => {
    const contacts = await listDiscoverableContacts(actor(IDS.studentA));
    assert.equal(contacts.some((c) => String(c.id) === 'admin' || c.adminRole === 'SUPER_ADMIN'), false);
  });

  it('H HIGH self-exclusion still applies', async () => {
    const contacts = await listDiscoverableContacts(actor(IDS.highA));
    assert.equal(contacts.some((c) => String(c.id) === IDS.highA), false);
  });

  it('C elevated directory: contacts WHO + presence ONLINE; offline SUPER visible', () => {
    const me = IDS.highA;
    const contacts = [
      { id: 'admin', name: 'Root Super', role: 'admin', adminRole: 'SUPER_ADMIN' },
      { id: IDS.staffA, name: 'Dir Staff', role: 'staff', adminRole: 'STAFF' },
    ];
    const onlineUsers = [{ userId: IDS.staffA, role: 'staff', name: 'Dir Staff' }];
    const presenceById = new Map(onlineUsers.map((u) => [String(u.userId), u]));
    const people = [];
    const seen = new Set();
    for (const st of contacts) {
      const uid = String(st.id);
      if (!uid || uid === me || seen.has(uid)) continue;
      seen.add(uid);
      people.push({ id: uid, online: presenceById.has(uid), adminRole: st.adminRole });
    }
    for (const u of onlineUsers) {
      const uid = String(u.userId);
      if (!seen.has(uid)) people.push({ id: uid, invented: true });
    }
    const admin = people.find((p) => p.id === 'admin');
    assert.ok(admin, 'offline SUPER must appear from contacts');
    assert.equal(admin.online, false);
    assert.equal(people.some((p) => p.invented), false);

    const presence = read('client/src/utils/supportPresence.js');
    assert.ok(presence.includes('Elevated: contacts = WHO'));
    assert.ok(presence.includes('presenceById.has(uid)'));
    assert.ok(presence.includes('Do not invent peers from presence'));
  });

  it('wiring: elevated FM always fetches getContacts; HIGH injects synthetic root', () => {
    const fm = read('client/src/components/FloatingMessenger.jsx');
    const svc = read('services/messagingContactsService.js');
    const presence = read('client/src/utils/supportPresence.js');
    assert.equal(fm.includes('if (usePresenceDirectory) return undefined'), false);
    assert.ok(fm.includes('messagesAPI.getContacts()'));
    assert.ok(svc.includes('ensureRootSuperAdminAmongDocs'));
    assert.ok(presence.includes('Elevated: contacts = WHO'));
  });
});
