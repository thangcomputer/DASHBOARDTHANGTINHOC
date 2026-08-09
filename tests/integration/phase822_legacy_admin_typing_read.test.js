/**
 * Phase 8.22 — Legacy admin_admin typing/read room targeting.
 * Does NOT change RBAC, identity, conversationId, or DM message send.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildConversationId } = require('../../utils/chatConversationId');
const {
  canAccessDirectConversation,
  resolveTypingReadPeerRooms,
  listTypingReadPeerTokens,
  isLegacyAdminMailboxToken,
} = require('../../utils/messagingRoles');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const STUDENT = '333333333333333333333333';
const STAFF = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SUPPORT = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TEACHER = '111111111111111111111111';
const SUPER = 'ssssssssssssssssssssssss';
const HIGH = 'hhhhhhhhhhhhhhhhhhhhhhhh';

describe('Phase 8.22 legacy admin_admin typing/read', { concurrency: false }, () => {
  const legacy = buildConversationId('admin', 'admin', 'student', STUDENT);

  it('A SUPER can access legacy admin_admin; typing peer rooms include admin+ALL_ADMIN', () => {
    const superUser = { id: SUPER, role: 'admin', adminRole: 'SUPER_ADMIN' };
    assert.equal(canAccessDirectConversation(legacy, superUser), true);
    const peers = listTypingReadPeerTokens(legacy, SUPER);
    assert.ok(peers.some((t) => String(t.id) === STUDENT));
    assert.ok(peers.some((t) => isLegacyAdminMailboxToken(t)));
    const adminRooms = resolveTypingReadPeerRooms(peers.find((t) => isLegacyAdminMailboxToken(t)));
    assert.deepEqual(adminRooms, ['admin', 'ALL_ADMIN']);
    const studentRooms = resolveTypingReadPeerRooms(peers.find((t) => String(t.id) === STUDENT));
    assert.deepEqual(studentRooms, [STUDENT]);
  });

  it('B HIGH same as SUPER for access + ALL_ADMIN targeting', () => {
    const high = { id: HIGH, role: 'admin', adminRole: 'HIGH_ADMIN' };
    assert.equal(canAccessDirectConversation(legacy, high), true);
    const peers = listTypingReadPeerTokens(legacy, HIGH);
    const adminTok = peers.find((t) => isLegacyAdminMailboxToken(t));
    assert.ok(adminTok);
    assert.deepEqual(resolveTypingReadPeerRooms(adminTok), ['admin', 'ALL_ADMIN']);
  });

  it('C STUDENT typing peers target legacy admin rooms (not staff id)', () => {
    const student = { id: STUDENT, role: 'student' };
    assert.equal(canAccessDirectConversation(legacy, student), true);
    const peers = listTypingReadPeerTokens(legacy, STUDENT);
    assert.equal(peers.length, 1);
    assert.ok(isLegacyAdminMailboxToken(peers[0]));
    assert.deepEqual(resolveTypingReadPeerRooms(peers[0]), ['admin', 'ALL_ADMIN']);
  });

  it('D STAFF cannot access legacy admin_admin → no typing/read', () => {
    const staff = { id: STAFF, role: 'admin', adminRole: 'STAFF' };
    assert.equal(canAccessDirectConversation(legacy, staff), false);
  });

  it('E SUPPORT cannot access legacy admin_admin → no typing/read', () => {
    const support = { id: SUPPORT, role: 'admin', adminRole: 'SUPPORT' };
    assert.equal(canAccessDirectConversation(legacy, support), false);
  });

  it('F unauthorized / teacher not in thread receives nothing (no access)', () => {
    const outsider = { id: TEACHER, role: 'teacher' };
    assert.equal(canAccessDirectConversation(legacy, outsider), false);
  });

  it('G normal staff/support/teacher threads keep exact userId rooms', () => {
    const staffStudent = buildConversationId('staff', STAFF, 'student', STUDENT);
    const supportStudent = buildConversationId('staff', SUPPORT, 'student', STUDENT);
    const staffTeacher = buildConversationId('staff', STAFF, 'teacher', TEACHER);
    const teacherStudent = buildConversationId('teacher', TEACHER, 'student', STUDENT);

    const cases = [
      [staffStudent, STAFF, STUDENT],
      [supportStudent, SUPPORT, STUDENT],
      [staffTeacher, STAFF, TEACHER],
      [teacherStudent, TEACHER, STUDENT],
    ];
    for (const [cid, selfId, peerId] of cases) {
      const peers = listTypingReadPeerTokens(cid, selfId);
      assert.equal(peers.length, 1);
      const rooms = resolveTypingReadPeerRooms(peers[0]);
      assert.deepEqual(rooms, [peerId]);
      assert.equal(rooms.includes('ALL_ADMIN'), false);
      assert.equal(rooms.includes('ALL_STAFF'), false);
      assert.equal(rooms.includes('ALL_SUPPORT'), false);
      assert.equal(rooms.includes('ALL_USERS'), false);
    }
  });

  it('H server typing/read use resolveTypingReadPeerRooms; no ALL_STAFF fanout', () => {
    const src = read('server.js');
    const typingStart = src.indexOf("socket.on('typing:start'");
    const typingStop = src.indexOf("socket.on('typing:stop'");
    const readStart = src.indexOf("socket.on('message:read'");
    const examStart = src.indexOf("socket.on('exam:violation'");
    assert.ok(typingStart > 0 && readStart > 0);

    const readChunk = src.slice(readStart, typingStart);
    const typingChunk = src.slice(typingStart, examStart > typingStart ? examStart : typingStop + 800);
    assert.ok(readChunk.includes('resolveTypingReadPeerRooms'));
    assert.ok(readChunk.includes('listTypingReadPeerTokens'));
    assert.ok(typingChunk.includes('resolveTypingReadPeerRooms'));
    assert.equal(readChunk.includes("io.to('ALL_STAFF')"), false);
    assert.equal(typingChunk.includes("io.to('ALL_STAFF')"), false);
    assert.equal(readChunk.includes('ALL_SUPPORT'), false);
    assert.equal(typingChunk.includes('ALL_SUPPORT'), false);
    assert.equal(readChunk.includes('ALL_USERS'), false);
    // Legacy admin targeting present
    assert.ok(src.includes("resolveTypingReadPeerRooms") || src.includes('ALL_ADMIN'));
    const roles = read('utils/messagingRoles.js');
    assert.ok(roles.includes("return ['admin', 'ALL_ADMIN']"));
    assert.ok(roles.includes('NEVER ALL_STAFF') || roles.includes('Never ALL_STAFF') || roles.includes('NEVER ALL_STAFF / ALL_SUPPORT'));
  });

  it('root id=admin typing skips self admin token; only student peer', () => {
    const peers = listTypingReadPeerTokens(legacy, 'admin');
    assert.equal(peers.length, 1);
    assert.equal(String(peers[0].id), STUDENT);
    assert.deepEqual(resolveTypingReadPeerRooms(peers[0]), [STUDENT]);
  });
});
