'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('badge Hộp thư chỉ đếm hội thoại người xem thực sự thấy (SUPER: chỉ HIGH_ADMIN, không nhóm)', () => {
  const helper = read('client/src/lib/inboxUnread.js');
  assert.ok(helper.includes("if (conversation.isGroup) return sum;"), 'SUPER không đếm nhóm');
  assert.ok(helper.includes("if (String(peer.adminRole || '') !== 'HIGH_ADMIN') return sum;"), 'SUPER chỉ đếm HIGH_ADMIN');
  assert.ok(helper.includes('AI_SUPPORT_PEER.id'), 'bỏ Trợ lý AI');

  const inbox = read('client/src/components/Inbox.jsx');
  assert.ok(inbox.includes('if (isSuperAdmin && entry?.isGroup) return false;'), 'Inbox ẩn nhóm với SUPER - badge phải khớp');

  assert.ok(read('client/src/components/AppSidebar.jsx').includes('return visibleInboxUnread(getConversations(session.id), {'));
  assert.ok(read('client/src/components/LoginInboxAlertPopup.jsx').includes('visibleInboxUnread(convs, {'));
});
