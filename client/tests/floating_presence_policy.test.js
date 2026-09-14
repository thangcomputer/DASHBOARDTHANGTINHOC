import assert from 'node:assert/strict';
import test from 'node:test';

function isFloatingPeerOnline({ peerId, onlineUsers, isGroup = false }) {
  if (isGroup || !peerId || !Array.isArray(onlineUsers)) return false;
  return onlineUsers.some((user) => String(user?.userId || user?.id || user?._id || '') === String(peerId));
}

test('shows online only when the peer exists in the live presence list', () => {
  assert.equal(isFloatingPeerOnline({
    peerId: 'teacher-1',
    onlineUsers: [{ userId: 'teacher-1' }],
  }), true);
  assert.equal(isFloatingPeerOnline({
    peerId: 'teacher-1',
    onlineUsers: [{ userId: 'teacher-2' }],
  }), false);
});

test('does not mark stale tabs or group chats as online', () => {
  assert.equal(isFloatingPeerOnline({
    peerId: 'teacher-1',
    onlineUsers: [],
  }), false);
  assert.equal(isFloatingPeerOnline({
    peerId: 'group-1',
    onlineUsers: [{ userId: 'teacher-1' }],
    isGroup: true,
  }), false);
});
