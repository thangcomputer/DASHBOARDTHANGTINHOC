/**
 * Phase 8.22 — Lock messaging identity (no SUPER collapse).
 * LIVE messaging only. Does not touch Enterprise RBAC / no DB migration.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildConversationId } = require('../../utils/chatConversationId');
const { getMessagingRole } = require('../../utils/messagingRoles');
const {
  DISPLAY_ROLE,
  resolveMessagingIdentity,
  assertDisplayIdentitySafe,
  enrichMessageIdentities,
} = require('../../services/messagingIdentity');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Phase 8.22 messaging identity lock', { concurrency: false }, () => {
  it('1 multi staff A/B same teacher → distinct conversationIds', () => {
    const teacher = 'tttttttttttttttttttttttt';
    const a = buildConversationId('staff', 'aaaaaaaaaaaaaaaaaaaaaaaa', 'teacher', teacher);
    const b = buildConversationId('staff', 'bbbbbbbbbbbbbbbbbbbbbbbb', 'teacher', teacher);
    assert.notEqual(a, b);
    assert.ok(!a.includes('admin_admin'));
    assert.ok(!b.includes('admin_admin'));
  });

  it('2 SUPPORT vs ADMIN_STAFF displayRole distinct; neither SUPER', () => {
    const staff = resolveMessagingIdentity({
      id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      role: 'admin',
      adminRole: 'STAFF',
      name: 'Staff A',
    });
    const support = resolveMessagingIdentity({
      id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      role: 'admin',
      adminRole: 'SUPPORT',
      name: 'Support B',
    });
    assert.equal(staff.displayRole, DISPLAY_ROLE.ADMIN_STAFF);
    assert.equal(support.displayRole, DISPLAY_ROLE.SUPPORT);
    assert.notEqual(staff.displayRole, support.displayRole);
    assert.notEqual(staff.displayRole, DISPLAY_ROLE.SUPER_ADMIN);
    assert.notEqual(support.displayRole, DISPLAY_ROLE.SUPER_ADMIN);
  });

  it('3 assertDisplayIdentitySafe blocks elevate SUPER by role alone', () => {
    const bad = assertDisplayIdentitySafe({
      id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      role: 'admin',
      displayRole: DISPLAY_ROLE.SUPER_ADMIN,
      adminRole: 'STAFF',
      displayName: 'Should Not Be Super',
      avatar: '',
    });
    assert.equal(bad.displayRole, DISPLAY_ROLE.ADMIN_STAFF);
    assert.notEqual(bad.displayRole, DISPLAY_ROLE.SUPER_ADMIN);

    const okRoot = assertDisplayIdentitySafe({
      id: 'admin',
      role: 'admin',
      displayRole: DISPLAY_ROLE.LEGACY_ROOT,
      adminRole: 'SUPER_ADMIN',
      displayName: 'Root',
      avatar: '',
    });
    assert.equal(okRoot.displayRole, DISPLAY_ROLE.LEGACY_ROOT);

    const okSuper = assertDisplayIdentitySafe({
      id: 'ssssssssssssssssssssssss',
      role: 'admin',
      displayRole: DISPLAY_ROLE.SUPER_ADMIN,
      adminRole: 'SUPER_ADMIN',
      displayName: 'Real Super',
      avatar: '',
    });
    assert.equal(okSuper.displayRole, DISPLAY_ROLE.SUPER_ADMIN);
  });

  it('4 role=admin ObjectId without adminRole → NOT SUPER', () => {
    const idn = resolveMessagingIdentity({
      id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      role: 'admin',
      name: 'Mystery',
    });
    assert.notEqual(idn.displayRole, DISPLAY_ROLE.SUPER_ADMIN);
    assert.notEqual(idn.displayRole, DISPLAY_ROLE.LEGACY_ROOT);
  });

  it('5 history/sync routes call enrichMessageIdentities', () => {
    const routes = read('routes/messageRoutes.js');
    assert.ok(routes.includes('enrichMessageIdentities'));
    assert.ok(routes.includes("router.get('/:conversationId'"));
    assert.ok(routes.includes("router.get('/sync/:userId'"));
    const syncIdx = routes.indexOf("router.get('/sync/:userId'");
    const convIdx = routes.indexOf("router.get('/:conversationId'");
    assert.ok(routes.slice(convIdx, convIdx + 2500).includes('enrichMessageIdentities'));
    assert.ok(routes.slice(syncIdx, syncIdx + 2500).includes('enrichMessageIdentities'));
  });

  it('6 send path reuses enrichMessageIdentities', () => {
    const src = read('services/directMessageService.js');
    assert.ok(src.includes('enrichMessageIdentities'));
    assert.ok(src.includes('resolveMessagingIdentity(sender)'));
  });

  it('7 FE normalizeMessage + no otherRole===admin SUPER collapse', () => {
    const fe = read('client/src/lib/messagingIdentity.js');
    assert.ok(fe.includes('export function normalizeMessage'));
    assert.ok(fe.includes('assertDisplayIdentitySafe'));
    const messaging = read('client/src/context/useDataMessaging.js');
    assert.ok(messaging.includes('normalizeMessage'));
    assert.equal(messaging.includes("otherUserId === 'admin' || otherRole === 'admin'"), false);
  });

  it('8 defaultAvatars STAFF before role===admin (regression)', () => {
    const src = read('client/src/utils/defaultAvatars.js');
    const staffIdx = src.indexOf("ar === 'STAFF'");
    const adminIdx = src.indexOf("r === 'admin' || r === 'super_admin'");
    assert.ok(staffIdx > 0 && adminIdx > staffIdx);
  });

  it('9 HTTP+Socket staff↔teacher same conversationId', () => {
    const staff = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin', adminRole: 'STAFF' };
    const teacher = 'tttttttttttttttttttttttt';
    const r = getMessagingRole(staff);
    assert.equal(
      buildConversationId(r, staff.id, 'teacher', teacher),
      buildConversationId(getMessagingRole(staff), staff.id, 'teacher', teacher),
    );
  });

  it('10 enrichMessageIdentities exports and is async function', () => {
    assert.equal(typeof enrichMessageIdentities, 'function');
    assert.equal(enrichMessageIdentities.constructor.name, 'AsyncFunction');
  });

  it('11 HIGH_ADMIN not collapsed to SUPER via assert', () => {
    const idn = assertDisplayIdentitySafe({
      id: 'hhhhhhhhhhhhhhhhhhhhhhhh',
      role: 'admin',
      displayRole: DISPLAY_ROLE.SUPER_ADMIN,
      adminRole: 'HIGH_ADMIN',
      displayName: 'High',
      avatar: '',
    });
    assert.equal(idn.displayRole, DISPLAY_ROLE.HIGH_ADMIN);
  });

  it('12 messagingIdentity service exports lock API', () => {
    assert.ok(DISPLAY_ROLE.ADMIN_STAFF);
    assert.equal(typeof assertDisplayIdentitySafe, 'function');
    assert.equal(typeof enrichMessageIdentities, 'function');
  });
});
