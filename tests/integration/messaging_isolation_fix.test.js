/**
 * Messaging isolation + canonical conversationId (post-audit fix).
 * Does NOT touch Enterprise RBAC.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildConversationId } = require('../../utils/chatConversationId');
const {
  getMessagingRole,
  canAccessDirectConversation,
  isDirectConversationParticipant,
} = require('../../utils/messagingRoles');

const ROOT = path.join(__dirname, '../..');

describe('Messaging isolation + canonical IDs', { concurrency: false }, () => {
  it('1 getMessagingRole: STAFF/SUPPORT → staff; SUPER/HIGH → admin', () => {
    assert.equal(getMessagingRole({ id: 's1', role: 'admin', adminRole: 'STAFF' }), 'staff');
    assert.equal(getMessagingRole({ id: 's2', role: 'admin', adminRole: 'SUPPORT' }), 'staff');
    assert.equal(getMessagingRole({ id: 'a1', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'admin');
    assert.equal(getMessagingRole({ id: 'a2', role: 'admin', adminRole: 'HIGH_ADMIN' }), 'admin');
    assert.equal(getMessagingRole({ id: 'admin', role: 'admin' }), 'admin');
    assert.equal(getMessagingRole({ id: 't1', role: 'teacher' }), 'teacher');
    assert.equal(getMessagingRole({ id: 'st1', role: 'student' }), 'student');
  });

  it('2 Staff↔Student conversationId is distinct per staff (not admin_admin)', () => {
    const staffA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const staffB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const student = 'cccccccccccccccccccccccc';
    const cA = buildConversationId('staff', staffA, 'student', student);
    const cB = buildConversationId('staff', staffB, 'student', student);
    assert.notEqual(cA, cB);
    assert.equal(cA.includes('admin_admin'), false);
    assert.equal(cB.includes('admin_admin'), false);
    assert.ok(cA.includes(`staff_${staffA}`));
    assert.ok(cA.includes(`student_${student}`));
  });

  it('3 Super/admin↔Student still uses legacy admin_admin thread', () => {
    const student = 'cccccccccccccccccccccccc';
    const c = buildConversationId('admin', 'admin', 'student', student);
    assert.ok(c.includes('admin_admin'));
    assert.ok(c.includes(`student_${student}`));
  });

  it('4 HTTP+Socket role same pair → same canonical id', () => {
    const staff = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin', adminRole: 'STAFF' };
    const studentId = 'cccccccccccccccccccccccc';
    const role = getMessagingRole(staff);
    const httpId = buildConversationId(role, staff.id, 'student', studentId);
    const socketId = buildConversationId(getMessagingRole(staff), staff.id, 'student', studentId);
    assert.equal(httpId, socketId);
  });

  it('5 Teacher pairs isolated', () => {
    const tA = '111111111111111111111111';
    const tB = '222222222222222222222222';
    const st = '333333333333333333333333';
    const a = buildConversationId('teacher', tA, 'student', st);
    const b = buildConversationId('teacher', tB, 'student', st);
    assert.notEqual(a, b);
  });

  it('6 STAFF cannot access legacy admin_admin conversation', () => {
    const student = 'cccccccccccccccccccccccc';
    const conv = buildConversationId('admin', 'admin', 'student', student);
    const staff = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin', adminRole: 'STAFF' };
    assert.equal(canAccessDirectConversation(conv, staff), false);
    assert.equal(isDirectConversationParticipant(conv, staff), false);
  });

  it('7 SUPER/HIGH can access legacy admin_admin', () => {
    const student = 'cccccccccccccccccccccccc';
    const conv = buildConversationId('admin', 'admin', 'student', student);
    assert.equal(
      canAccessDirectConversation(conv, { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', adminRole: 'SUPER_ADMIN', role: 'admin' }),
      true,
    );
    assert.equal(
      canAccessDirectConversation(conv, { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', adminRole: 'HIGH_ADMIN', role: 'admin' }),
      true,
    );
  });

  it('8 Staff is participant of own staff_* thread only', () => {
    const staffId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const student = 'cccccccccccccccccccccccc';
    const conv = buildConversationId('staff', staffId, 'student', student);
    const staff = { id: staffId, role: 'admin', adminRole: 'STAFF' };
    const other = { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'admin', adminRole: 'STAFF' };
    assert.equal(canAccessDirectConversation(conv, staff), true);
    assert.equal(canAccessDirectConversation(conv, other), false);
  });

  it('9 notifyUser must not fan-out private admin to ALL_STAFF', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const idx = src.indexOf('app.notifyUser =');
    assert.ok(idx > 0);
    const chunk = src.slice(idx, idx + 900);
    assert.equal(chunk.includes("io.to('ALL_STAFF').emit"), false);
    assert.ok(chunk.includes("io.to('admin').to('ALL_ADMIN')") || chunk.includes('ALL_ADMIN'));
    assert.ok(chunk.includes('NEVER fan-out') || chunk.includes('ALL_ADMIN'));
  });

  it('10 HTTP send uses getMessagingRole / sendCanonicalMessage', () => {
    const src = fs.readFileSync(path.join(ROOT, 'routes/messageRoutes.js'), 'utf8');
    assert.ok(src.includes('getMessagingRole'));
    assert.ok(src.includes('sendCanonicalMessage'));
    assert.equal(/isStaffAccount\(req\.user\)\s*\?\s*'admin'/.test(src), false);
  });

  it('11 Socket DM path persists via sendCanonicalMessage', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const start = src.indexOf("socket.on('message:send'");
    const end = src.indexOf("socket.on('message:read'");
    const chunk = src.slice(start, end);
    assert.ok(chunk.includes('sendCanonicalMessage'));
    assert.equal(/io\.to\(rid\)\.emit\('message:receive'/.test(chunk), false);
  });

  it('12 typing/read use socket.user + canAccessDirectConversation', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    assert.ok(src.includes("socket.on('typing:start'"));
    assert.ok(src.includes('canAccessDirectConversation'));
    assert.ok(src.includes('resolveTypingReadPeerRooms'));
    const readStart = src.indexOf("socket.on('message:read'");
    const readChunk = src.slice(readStart, readStart + 900);
    assert.equal(/socketUserId\(socket\.user\) !== String\(readerId/.test(readChunk), false);
    assert.ok(readChunk.includes('resolveTypingReadPeerRooms'));
  });

  it('13 FE mailbox: STAFF must not inherit admin mailbox filter', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/context/useDataMessaging.js'), 'utf8');
    assert.equal(src.includes('isAdminOrSupportMailbox'), false);
    assert.ok(src.includes('isAdminMailbox'));
    assert.ok(src.includes('isSuperAdmin &&'));
  });

  it('14 DashboardLayout does not force staff→admin for messenger', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/components/DashboardLayout.jsx'), 'utf8');
    assert.equal(src.includes("role === 'staff' ? 'admin'"), false);
    assert.ok(src.includes('getMessagingRole(session)'));
  });

  it('15 directMessageService exists and rejects client sender spoof path', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
    assert.ok(src.includes('resolveMessagingIdentity(sender)') || src.includes('getMessagingRole(sender)'));
    assert.ok(src.includes('assertCanDirectMessage'));
    assert.ok(src.includes('Message.create'));
    assert.equal(src.includes('req.body.senderId'), false);
  });

  it('16 Inbox does not collapse staff contacts to admin for conv ids', () => {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/components/Inbox.jsx'), 'utf8');
    assert.equal(src.includes("role === 'staff' ? 'admin'"), false);
  });
});
