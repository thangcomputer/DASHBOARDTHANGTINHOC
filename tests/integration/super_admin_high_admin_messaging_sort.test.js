/**
 * Unit/Integration test: Super Admin message to High Admin properly updates convMap and sorts to top.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function loadConversationList() {
  const src = read('client/src/lib/conversationList.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\};?/g, '');
  const wrapped = `${src}\nmodule.exports = { conversationActivityTime, sortConversationsByLastMessageAt, mergeConversationsById };`;
  const mod = { exports: {} };
  vm.runInNewContext(wrapped, { module: mod, exports: mod.exports });
  return mod.exports;
}

describe('Super Admin to High Admin conversation mapping & priority sort', () => {
  const { sortConversationsByLastMessageAt, mergeConversationsById } = loadConversationList();

  it('High Admin viewing message from Super Admin sets sender/receiver correctly and does not drop', () => {
    const highAdminUser = {
      id: 'high_admin_123',
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      name: 'High Admin User'
    };
    const sId = highAdminUser.id;
    const isSuperAdmin = sId === 'admin' || highAdminUser.adminRole === 'SUPER_ADMIN';

    // High admin is NOT super admin
    assert.equal(isSuperAdmin, false);

    const safeMessages = [
      {
        id: 'msg_1',
        convId: 'admin_high_admin_123',
        senderId: 'admin',
        senderRole: 'admin',
        senderName: 'Super Admin',
        receiverId: 'high_admin_123',
        receiverRole: 'admin',
        receiverName: 'High Admin User',
        content: 'Chào High Admin, đây là tin nhắn mới!',
        time: '2026-08-24T10:30:00.000Z',
        read: false
      },
      {
        id: 'msg_old',
        convId: 'teacher_t1__admin_high_admin_123',
        senderId: 't1',
        senderRole: 'teacher',
        senderName: 'Giáo viên 1',
        receiverId: 'high_admin_123',
        receiverRole: 'admin',
        receiverName: 'High Admin User',
        content: 'Tin nhắn cũ từ giáo viên',
        time: '2026-08-24T09:00:00.000Z',
        read: true
      }
    ];

    const convMap = {};

    safeMessages.forEach(m => {
      const isMeSender = String(m.senderId) === sId;
      const otherUserId = isMeSender ? m.receiverId : m.senderId;
      const otherRole = isMeSender ? m.receiverRole : m.senderRole;

      if (String(otherUserId) === String(sId)) return;

      convMap[m.convId] = {
        id: m.convId,
        user: {
          id: otherUserId,
          name: isMeSender ? m.receiverName : m.senderName,
          role: otherRole,
        },
        lastMessage: m.content,
        lastTime: m.time,
        unread: m.read ? 0 : 1
      };
    });

    // Super Admin conversation is NOT dropped and has otherUserId = 'admin'
    assert.ok(convMap['admin_high_admin_123']);
    assert.equal(convMap['admin_high_admin_123'].user.id, 'admin');
    assert.equal(convMap['admin_high_admin_123'].user.name, 'Super Admin');
    assert.equal(convMap['admin_high_admin_123'].unread, 1);

    // Sorted conversations: Super Admin is at index 0 (Top)
    const sorted = sortConversationsByLastMessageAt(Object.values(convMap));
    assert.equal(sorted[0].id, 'admin_high_admin_123');
    assert.equal(sorted[0].user.name, 'Super Admin');
    assert.equal(sorted[1].id, 'teacher_t1__admin_high_admin_123');
  });

  it('Inbox merges Super Admin contact with latest conversation lastTime', () => {
    const contacts = [
      { id: 'admin', name: 'Super Admin', role: 'admin', adminRole: 'SUPER_ADMIN' },
      { id: 't1', name: 'Giáo viên 1', role: 'teacher', adminRole: null }
    ];

    const dataContextConvs = [
      {
        id: 'admin_high_admin_123',
        user: { id: 'admin', name: 'Super Admin', role: 'admin' },
        lastMessage: 'Chào High Admin',
        lastTime: '2026-08-24T10:30:00.000Z',
        unread: 1
      }
    ];

    const activityById = new Map();
    const activityByPeer = new Map();
    dataContextConvs.forEach(dc => {
      activityById.set(dc.id, dc);
      activityByPeer.set(dc.user.id, dc);
    });

    const entries = [];
    contacts.forEach(c => {
      const existingConv = activityById.get(c.id)
        || activityByPeer.get(String(c.id))
        || ((c.id === 'admin' || c.adminRole === 'SUPER_ADMIN') ? activityByPeer.get('admin') : null);

      entries.push({
        id: existingConv?.id || `conv_${c.id}`,
        user: { id: c.id, name: c.name, role: c.role },
        lastMessage: existingConv?.lastMessage || 'Bắt đầu cuộc trò chuyện',
        lastTime: existingConv?.lastTime || new Date(0),
        unread: existingConv?.unread || 0
      });
    });

    const merged = mergeConversationsById(entries);
    assert.equal(merged[0].user.name, 'Super Admin');
    assert.equal(merged[0].lastMessage, 'Chào High Admin');
    assert.equal(merged[0].unread, 1);
  });
});
