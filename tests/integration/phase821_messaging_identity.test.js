/**
 * Phase 8.21 — Messaging identity / display / isolation forensic tests.
 * LIVE messaging only. Does not touch Enterprise RBAC.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildConversationId } = require('../../utils/chatConversationId');
const { getMessagingRole, canAccessDirectConversation } = require('../../utils/messagingRoles');
const {
  resolveMessagingIdentity,
  resolveDisplayRole,
  DISPLAY_ROLE,
} = require('../../services/messagingIdentity');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Phase 8.21 messaging identity', { concurrency: false }, () => {
  it('A ADMIN_STAFF identity is not SUPER_ADMIN', () => {
    const staff = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin', adminRole: 'STAFF', name: 'Staff A', avatar: '/a.png' };
    const idn = resolveMessagingIdentity(staff);
    assert.equal(idn.id, staff.id);
    assert.equal(idn.role, 'staff');
    assert.equal(idn.displayRole, DISPLAY_ROLE.ADMIN_STAFF);
    assert.notEqual(idn.displayRole, DISPLAY_ROLE.SUPER_ADMIN);
    assert.equal(idn.displayName, 'Staff A');
    assert.equal(idn.avatar, '/a.png');
  });

  it('B SUPPORT identity distinct from ADMIN_STAFF', () => {
    const support = { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'admin', adminRole: 'SUPPORT', name: 'Support B' };
    const idn = resolveMessagingIdentity(support);
    assert.equal(idn.role, 'staff');
    assert.equal(idn.displayRole, DISPLAY_ROLE.SUPPORT);
    assert.notEqual(idn.displayRole, DISPLAY_ROLE.ADMIN_STAFF);
    assert.notEqual(idn.displayRole, DISPLAY_ROLE.SUPER_ADMIN);
  });

  it('C SUPER_ADMIN and HIGH_ADMIN keep distinct display roles', () => {
    assert.equal(
      resolveDisplayRole({ id: 's1', role: 'admin', adminRole: 'SUPER_ADMIN' }),
      DISPLAY_ROLE.SUPER_ADMIN,
    );
    assert.equal(
      resolveDisplayRole({ id: 'h1', role: 'admin', adminRole: 'HIGH_ADMIN' }),
      DISPLAY_ROLE.HIGH_ADMIN,
    );
    assert.equal(resolveDisplayRole({ id: 'admin', role: 'admin' }), DISPLAY_ROLE.LEGACY_ROOT);
  });

  it('D TEACHER / STUDENT identity', () => {
    assert.equal(resolveDisplayRole({ id: 't1', role: 'teacher' }), DISPLAY_ROLE.TEACHER);
    assert.equal(resolveDisplayRole({ id: 'st1', role: 'student' }), DISPLAY_ROLE.STUDENT);
  });

  it('E ADMIN_STAFF↔TEACHER conversationId distinct from SUPER↔TEACHER', () => {
    const staffId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const superId = 'ssssssssssssssssssssssss';
    const teacherId = 'tttttttttttttttttttttttt';
    const staffConv = buildConversationId('staff', staffId, 'teacher', teacherId);
    const superConv = buildConversationId('admin', superId, 'teacher', teacherId);
    const legacy = buildConversationId('admin', 'admin', 'teacher', teacherId);
    assert.notEqual(staffConv, superConv);
    assert.notEqual(staffConv, legacy);
    assert.ok(staffConv.includes(`staff_${staffId}`));
    assert.ok(!staffConv.includes('admin_admin'));
  });

  it('F SUPPORT↔TEACHER distinct from ADMIN_STAFF↔TEACHER', () => {
    const staffId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const supportId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const teacherId = 'tttttttttttttttttttttttt';
    const a = buildConversationId('staff', staffId, 'teacher', teacherId);
    const b = buildConversationId('staff', supportId, 'teacher', teacherId);
    assert.notEqual(a, b);
  });

  it('G STAFF cannot enter legacy admin_admin; SUPER can', () => {
    const conv = buildConversationId('admin', 'admin', 'teacher', 'tttttttttttttttttttttttt');
    assert.equal(
      canAccessDirectConversation(conv, { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin', adminRole: 'STAFF' }),
      false,
    );
    assert.equal(
      canAccessDirectConversation(conv, { id: 'ssssssssssssssssssssssss', role: 'admin', adminRole: 'SUPER_ADMIN' }),
      true,
    );
  });

  it('H FE never collapses otherRole===admin → SUPER (useDataMessaging)', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.equal(src.includes("otherUserId === 'admin' || otherRole === 'admin'"), false);
    assert.ok(src.includes('resolveMessagingActor'));
  });

  it('I FE Inbox resolveSenderName does not map role admin alone to SUPER', () => {
    const src = read('client/src/components/Inbox.jsx');
    assert.ok(src.includes('resolveMessagingActor'));
    assert.equal(src.includes("if (msg.senderId === 'admin') {\n      const superDoc"), false);
  });

  it('J defaultAvatars: STAFF/SUPPORT checked before role===admin', () => {
    const src = read('client/src/utils/defaultAvatars.js');
    const staffIdx = src.indexOf("ar === 'STAFF'");
    const supportIdx = src.indexOf("ar === 'SUPPORT'");
    const adminRoleIdx = src.indexOf("r === 'admin' || r === 'super_admin'");
    assert.ok(staffIdx > 0 && supportIdx > 0 && adminRoleIdx > 0);
    assert.ok(Math.min(staffIdx, supportIdx) < adminRoleIdx);
    // Must not treat role===admin as SUPER before staff check
    assert.equal(
      /uid === 'admin' \|\| ar === 'SUPER_ADMIN' \|\| ar === 'HIGH_ADMIN' \|\| r === 'admin'/.test(src),
      false,
    );
  });

  it('K backend enrich payload embeds sender identity object', () => {
    const svc = read('services/directMessageService.js');
    const idn = read('services/messagingIdentity.js');
    assert.ok(svc.includes('enrichMessageIdentities') || svc.includes('resolveMessagingIdentity'));
    assert.ok(idn.includes('attachIdentitiesToPlain') || idn.includes('sender:'));
    assert.ok(idn.includes('displayName'));
    assert.ok(idn.includes('senderAvatar') || idn.includes('avatar'));
  });

  it('L notifyUser never fans private DM to ALL_STAFF', () => {
    const src = read('server.js');
    const idx = src.indexOf('app.notifyUser =');
    const chunk = src.slice(idx, idx + 1200);
    assert.equal(chunk.includes("io.to('ALL_STAFF').emit"), false);
    assert.ok(chunk.includes("io.to(strUserId).emit"));
  });

  it('M spoof contract: HTTP send uses req.user via sendCanonicalMessage', () => {
    const routes = read('routes/messageRoutes.js');
    assert.ok(routes.includes('sendCanonicalMessage'));
    assert.ok(routes.includes('sender: req.user'));
  });

  it('N HTTP+Socket same pair → same conversationId (staff↔teacher)', () => {
    const staff = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin', adminRole: 'STAFF' };
    const teacherId = 'tttttttttttttttttttttttt';
    const role = getMessagingRole(staff);
    assert.equal(role, 'staff');
    const httpId = buildConversationId(role, staff.id, 'teacher', teacherId);
    const socketId = buildConversationId(getMessagingRole(staff), staff.id, 'teacher', teacherId);
    assert.equal(httpId, socketId);
  });

  it('O transport alias admin must not become display SUPER for STAFF ObjectId', () => {
    // Simulated corruption path: legacy senderRole=admin but senderId=staff ObjectId
    const staffId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const idn = resolveMessagingIdentity({
      id: staffId,
      role: 'admin',
      adminRole: 'STAFF',
      name: 'Staff Real',
    });
    assert.equal(idn.id, staffId);
    assert.notEqual(idn.id, 'admin');
    assert.equal(idn.displayRole, DISPLAY_ROLE.ADMIN_STAFF);
  });

  it('P messagingIdentity service exports stable contract', () => {
    assert.ok(DISPLAY_ROLE.ADMIN_STAFF);
    assert.ok(DISPLAY_ROLE.SUPPORT);
    assert.ok(DISPLAY_ROLE.SUPER_ADMIN);
    assert.ok(DISPLAY_ROLE.HIGH_ADMIN);
    assert.ok(DISPLAY_ROLE.TEACHER);
    assert.ok(DISPLAY_ROLE.STUDENT);
  });
});
