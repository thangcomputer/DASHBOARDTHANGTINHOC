'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const Teacher = require('../../models/Teacher');
const {
  isSupportAdminRole,
  findExistingSupportAgent,
  assertSingletonSupportAgent,
} = require('../../services/supportAgentService');
const staffRoutes = require('../../routes/staffRoutes');

function findRouteFinalHandler(router, method, routePath) {
  const layer = router.stack.find(
    (entry) => entry.route
      && entry.route.path === routePath
      && entry.route.methods?.[method.toLowerCase()],
  );
  assert.ok(layer, `Expected route ${method.toUpperCase()} ${routePath}`);
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function makeLeanSelectChain(doc) {
  return {
    select() {
      return {
        async lean() {
          return doc;
        },
      };
    },
    async lean() {
      return doc;
    },
  };
}

describe('SUPPORT AGENT singleton backend enforcement', () => {
  it('detects SUPPORT and SUPPORT_AGENT adminRole values case-insensitively', () => {
    assert.equal(isSupportAdminRole('SUPPORT'), true);
    assert.equal(isSupportAdminRole('support'), true);
    assert.equal(isSupportAdminRole('SUPPORT_AGENT'), true);
    assert.equal(isSupportAdminRole('STAFF'), false);
    assert.equal(isSupportAdminRole('HIGH_ADMIN'), false);
    assert.equal(isSupportAdminRole(''), false);
  });

  it('allows assigning SUPPORT when no existing holder exists', async () => {
    const db = [];
    const FakeTeacher = {
      findOne(filter) {
        const hit = db.find((row) => (
          filter.adminRole.$in.includes(row.adminRole)
          && (!filter._id?.$ne || String(row._id) !== String(filter._id.$ne))
        )) || null;
        return makeLeanSelectChain(hit);
      },
    };

    const result = await assertSingletonSupportAgent({
      TeacherModel: FakeTeacher,
      adminRole: 'SUPPORT',
    });
    assert.deepEqual(result, { ok: true });
  });

  it('rejects assigning a 2nd SUPPORT account with 409 naming current holder', async () => {
    const db = [
      { _id: 'sup_1', name: 'HỖ TRỢ TIN HỌC', phone: '0902895006', adminRole: 'SUPPORT', status: 'active' },
      { _id: 'staff_2', name: 'HỒ THỊ NGA', phone: '0393703659', adminRole: 'STAFF', status: 'active' },
    ];
    const FakeTeacher = {
      findOne(filter) {
        const hit = db.find((row) => (
          filter.adminRole.$in.includes(row.adminRole)
          && (!filter._id?.$ne || String(row._id) !== String(filter._id.$ne))
        )) || null;
        return makeLeanSelectChain(hit);
      },
    };

    const createCheck = await assertSingletonSupportAgent({
      TeacherModel: FakeTeacher,
      adminRole: 'SUPPORT',
    });
    assert.equal(createCheck.ok, false);
    assert.equal(createCheck.status, 409);
    assert.equal(createCheck.code, 'SUPPORT_AGENT_ALREADY_ASSIGNED');
    assert.equal(createCheck.holder.name, 'HỖ TRỢ TIN HỌC');
    assert.ok(createCheck.message.includes('HỖ TRỢ TIN HỌC'));

    const updateOtherCheck = await assertSingletonSupportAgent({
      TeacherModel: FakeTeacher,
      adminRole: 'SUPPORT',
      excludeId: 'staff_2',
    });
    assert.equal(updateOtherCheck.ok, false);
    assert.equal(updateOtherCheck.status, 409);
  });

  it('allows editing current holder itself and reassigning after holder switches to STAFF', async () => {
    const db = [
      { _id: 'sup_1', name: 'HỖ TRỢ TIN HỌC', phone: '0902895006', adminRole: 'SUPPORT', status: 'active' },
      { _id: 'staff_2', name: 'HỒ THỊ NGA', phone: '0393703659', adminRole: 'STAFF', status: 'active' },
    ];
    const FakeTeacher = {
      findOne(filter) {
        const hit = db.find((row) => (
          filter.adminRole.$in.includes(row.adminRole)
          && (!filter._id?.$ne || String(row._id) !== String(filter._id.$ne))
        )) || null;
        return makeLeanSelectChain(hit);
      },
    };

    const editSelf = await assertSingletonSupportAgent({
      TeacherModel: FakeTeacher,
      adminRole: 'SUPPORT',
      excludeId: 'sup_1',
    });
    assert.equal(editSelf.ok, true);

    const switchSelfToStaff = await assertSingletonSupportAgent({
      TeacherModel: FakeTeacher,
      adminRole: 'STAFF',
      excludeId: 'sup_1',
    });
    assert.equal(switchSelfToStaff.ok, true);

    db[0].adminRole = 'STAFF';
    const existingAfterSwitch = await findExistingSupportAgent(FakeTeacher);
    assert.equal(existingAfterSwitch, null);

    const assignSecond = await assertSingletonSupportAgent({
      TeacherModel: FakeTeacher,
      adminRole: 'SUPPORT',
      excludeId: 'staff_2',
    });
    assert.equal(assignSecond.ok, true);
  });
});

describe('routes/staffRoutes.js singleton SUPPORT HTTP enforcement', () => {
  let origFindOne;
  let origFindById;
  let origFindByIdAndUpdate;
  let postHandler;
  let putHandler;

  beforeEach(() => {
    origFindOne = Teacher.findOne;
    origFindById = Teacher.findById;
    origFindByIdAndUpdate = Teacher.findByIdAndUpdate;
    postHandler = findRouteFinalHandler(staffRoutes, 'post', '/');
    putHandler = findRouteFinalHandler(staffRoutes, 'put', '/:id');
  });

  afterEach(() => {
    Teacher.findOne = origFindOne;
    Teacher.findById = origFindById;
    Teacher.findByIdAndUpdate = origFindByIdAndUpdate;
  });

  it('POST / returns 409 when another SUPPORT account already exists', async () => {
    Teacher.findOne = (filter) => {
      if (filter?.adminRole?.$in?.includes('SUPPORT')) {
        return makeLeanSelectChain({
          _id: 'sup_1',
          name: 'HỖ TRỢ TIN HỌC',
          phone: '0902895006',
          adminRole: 'SUPPORT',
        });
      }
      return makeLeanSelectChain(null);
    };

    const req = {
      user: { id: 'admin', adminRole: 'SUPER_ADMIN', name: 'ADMIN SUPER' },
      body: {
        name: 'NHÂN VIÊN MỚI',
        phone: '0911222333',
        password: 'password123',
        adminRole: 'SUPPORT',
      },
      app: { get: () => null },
    };
    const res = createMockRes();
    await postHandler(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'SUPPORT_AGENT_ALREADY_ASSIGNED');
    assert.ok(res.body.message.includes('HỖ TRỢ TIN HỌC'));
  });

  it('PUT /:id returns 409 when promoting a 2nd account to SUPPORT, and emits CONTACT_LIST_UPDATED on valid edit', async () => {
    const emitted = [];
    Teacher.findById = () => makeLeanSelectChain({
      _id: 'staff_2',
      name: 'HỒ THỊ NGA',
      adminRole: 'STAFF',
    });
    Teacher.findOne = (filter) => {
      if (filter?.adminRole?.$in?.includes('SUPPORT') && String(filter?._id?.$ne) === 'staff_2') {
        return makeLeanSelectChain({
          _id: 'sup_1',
          name: 'HỖ TRỢ TIN HỌC',
          phone: '0902895006',
          adminRole: 'SUPPORT',
        });
      }
      return makeLeanSelectChain(null);
    };

    const conflictReq = {
      params: { id: 'staff_2' },
      user: { id: 'admin', adminRole: 'SUPER_ADMIN', name: 'ADMIN SUPER' },
      body: { adminRole: 'SUPPORT', name: 'HỒ THỊ NGA' },
      app: { get: () => ({ emit: (ev, payload) => emitted.push({ ev, payload }) }) },
    };
    const conflictRes = createMockRes();
    await putHandler(conflictReq, conflictRes);

    assert.equal(conflictRes.statusCode, 409);
    assert.equal(conflictRes.body.code, 'SUPPORT_AGENT_ALREADY_ASSIGNED');
    assert.equal(emitted.length, 0);

    Teacher.findById = () => makeLeanSelectChain({
      _id: 'sup_1',
      name: 'HỖ TRỢ TIN HỌC',
      adminRole: 'SUPPORT',
    });
    Teacher.findByIdAndUpdate = () => makeLeanSelectChain({
      _id: 'sup_1',
      name: 'HỖ TRỢ TIN HỌC (ĐÃ SỬA)',
      adminRole: 'SUPPORT',
    });

    const selfReq = {
      params: { id: 'sup_1' },
      user: { id: 'admin', adminRole: 'SUPER_ADMIN', name: 'ADMIN SUPER' },
      body: { adminRole: 'SUPPORT', name: 'HỖ TRỢ TIN HỌC (ĐÃ SỬA)' },
      app: { get: () => ({ emit: (ev, payload) => emitted.push({ ev, payload }) }) },
    };
    const selfRes = createMockRes();
    await putHandler(selfReq, selfRes);

    assert.equal(selfRes.statusCode, 200);
    assert.equal(selfRes.body.success, true);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].ev, 'CONTACT_LIST_UPDATED');
  });
});

describe('client supportPresence designated SUPPORT agent resolution', () => {
  it('selects exact SUPPORT account even when STAFF/HIGH_ADMIN are online or alphabetically earlier', async () => {
    const modUrl = pathToFileURL(path.resolve(__dirname, '../../client/src/utils/supportPresence.js')).href;
    const { findDesignatedSupportAgent, isDesignatedSupportContact } = await import(modUrl);

    const contacts = [
      { id: 'admin_1', name: 'ADMIN HIGHT', role: 'admin', adminRole: 'HIGH_ADMIN', productRole: 'HIGH_ADMIN', status: 'active' },
      { id: 'staff_1', name: 'HỒ THỊ NGA', role: 'staff', adminRole: 'STAFF', productRole: 'STAFF', status: 'active' },
      { id: 'sup_1', name: 'HỖ TRỢ TIN HỌC', role: 'staff', adminRole: 'SUPPORT', productRole: 'SUPPORT', status: 'active' },
    ];
    const onlineUsers = [
      { userId: 'admin_1' },
      { userId: 'staff_1' },
    ];

    assert.equal(isDesignatedSupportContact(contacts[0]), false);
    assert.equal(isDesignatedSupportContact(contacts[1]), false);
    assert.equal(isDesignatedSupportContact(contacts[2]), true);

    const offlinePick = findDesignatedSupportAgent(contacts, onlineUsers);
    assert.equal(offlinePick.id, 'sup_1');
    assert.equal(offlinePick.name, 'HỖ TRỢ TIN HỌC');
    assert.equal(offlinePick.online, false);

    const onlinePick = findDesignatedSupportAgent(contacts, [...onlineUsers, { userId: 'sup_1' }]);
    assert.equal(onlinePick.id, 'sup_1');
    assert.equal(onlinePick.online, true);
  });

  it('returns null when no active SUPPORT account exists (ignores STAFF and inactive SUPPORT)', async () => {
    const modUrl = pathToFileURL(path.resolve(__dirname, '../../client/src/utils/supportPresence.js')).href;
    const { findDesignatedSupportAgent } = await import(modUrl);

    const contacts = [
      { id: 'staff_1', name: 'HỒ THỊ NGA', role: 'staff', adminRole: 'STAFF', productRole: 'STAFF', status: 'active' },
      { id: 'sup_old', name: 'CŨ ĐÃ KHÓA', role: 'staff', adminRole: 'SUPPORT', productRole: 'SUPPORT', status: 'inactive' },
    ];
    assert.equal(findDesignatedSupportAgent(contacts, [{ userId: 'staff_1' }, { userId: 'sup_old' }]), null);
  });
});
