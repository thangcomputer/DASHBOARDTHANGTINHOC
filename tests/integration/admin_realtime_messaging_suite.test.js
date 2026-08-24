/**
 * Comprehensive test suite: Realtime messaging between Admin roles
 * (Super Admin, High Admin, Staff, Support Admin)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getMessagingRole, canAccessDirectConversation, listTypingReadPeerTokens, resolveTypingReadPeerRooms } = require('../../utils/messagingRoles');
const { buildCanonicalConversationId } = require('../../services/messagingPairing');
const { buildConversationId } = require('../../utils/chatConversationId');

describe('Admin-to-Admin Realtime Messaging Matrix Verification', () => {

  const superAdmin = { id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', name: 'Super Admin' };
  const highAdmin1 = { id: 'high_111', role: 'admin', adminRole: 'HIGH_ADMIN', name: 'High Admin 1' };
  const highAdmin2 = { id: 'high_222', role: 'admin', adminRole: 'HIGH_ADMIN', name: 'High Admin 2' };
  const staff1 = { id: 'staff_111', role: 'staff', adminRole: 'STAFF', name: 'Staff User 1' };
  const staff2 = { id: 'staff_222', role: 'staff', adminRole: 'SUPPORT', name: 'Support User 2' };

  it('1. Role Resolution for Admin tiers', () => {
    assert.equal(getMessagingRole(superAdmin), 'admin');
    assert.equal(getMessagingRole(highAdmin1), 'admin');
    assert.equal(getMessagingRole(highAdmin2), 'admin');
    assert.equal(getMessagingRole(staff1), 'staff');
    assert.equal(getMessagingRole(staff2), 'staff');
  });

  it('2. Canonical Conversation IDs for all Admin combinations', () => {
    // Super Admin <-> High Admin 1
    const convSuperHigh = buildCanonicalConversationId(superAdmin, 'admin', 'high_111');
    assert.equal(convSuperHigh, 'admin_admin__admin_high_111');

    // High Admin 1 <-> High Admin 2
    const convHighHigh = buildCanonicalConversationId(highAdmin1, 'admin', 'high_222');
    assert.equal(convHighHigh, 'admin_high_111__admin_high_222');

    // High Admin 1 <-> Staff 1
    const convHighStaff = buildCanonicalConversationId(highAdmin1, 'staff', 'staff_111');
    assert.equal(convHighStaff, 'admin_high_111__staff_staff_111');

    // Staff 1 <-> Staff 2
    const convStaffStaff = buildCanonicalConversationId(staff1, 'staff', 'staff_222');
    assert.equal(convStaffStaff, 'staff_staff_111__staff_staff_222');
  });

  it('3. Access Control for Admin Conversations', () => {
    const convSuperHigh = 'admin_admin__admin_high_111';
    assert.equal(canAccessDirectConversation(convSuperHigh, superAdmin), true);
    assert.equal(canAccessDirectConversation(convSuperHigh, highAdmin1), true);

    const convHighHigh = 'admin_high_111__admin_high_222';
    assert.equal(canAccessDirectConversation(convHighHigh, highAdmin1), true);
    assert.equal(canAccessDirectConversation(convHighHigh, highAdmin2), true);
    // Unrelated staff cannot access
    assert.equal(canAccessDirectConversation(convHighHigh, staff1), false);

    const convStaffStaff = 'staff_staff_111__staff_staff_222';
    assert.equal(canAccessDirectConversation(convStaffStaff, staff1), true);
    assert.equal(canAccessDirectConversation(convStaffStaff, staff2), true);
  });

  it('4. Realtime Typing Peer Rooms for Admin-to-Admin', () => {
    const convSuperHigh = 'admin_admin__admin_high_111';
    
    // When Super Admin is typing, peer is High Admin 1
    const peersForSuper = listTypingReadPeerTokens(convSuperHigh, 'admin');
    assert.equal(peersForSuper.length, 1);
    assert.equal(peersForSuper[0].id, 'high_111');
    const roomsForSuper = resolveTypingReadPeerRooms(peersForSuper[0]);
    assert.deepEqual(roomsForSuper, ['high_111']);

    // When High Admin 1 is typing, peer is Super Admin ('admin')
    const peersForHigh = listTypingReadPeerTokens(convSuperHigh, 'high_111');
    assert.equal(peersForHigh.length, 1);
    assert.equal(peersForHigh[0].id, 'admin');
    const roomsForHigh = resolveTypingReadPeerRooms(peersForHigh[0]);
    assert.deepEqual(roomsForHigh, ['admin', 'ALL_ADMIN']);

    // High Admin 1 <-> Staff 1
    const convHighStaff = 'admin_high_111__staff_staff_111';
    const peersForStaff = listTypingReadPeerTokens(convHighStaff, 'staff_111');
    assert.deepEqual(resolveTypingReadPeerRooms(peersForStaff[0]), ['high_111']);
  });

  it('5. Realtime Read Receipt Peer Rooms for Admin-to-Admin', () => {
    const convHighHigh = 'admin_high_111__admin_high_222';
    const peerOf1 = listTypingReadPeerTokens(convHighHigh, 'high_111');
    assert.deepEqual(resolveTypingReadPeerRooms(peerOf1[0]), ['high_222']);
  });
});
