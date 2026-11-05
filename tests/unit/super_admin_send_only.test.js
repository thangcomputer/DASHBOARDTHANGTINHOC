'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('hội thoại với Admin Super chỉ một chiều: server chặn, web + mobile khóa khung nhập', () => {
  const policy = read('services/messagingPolicy.js');
  assert.ok(policy.includes("SUPER_ADMIN_SEND_ONLY: 'MESSAGING_SUPER_ADMIN_SEND_ONLY'"));
  assert.ok(policy.includes('&& resolved.recipient?.productRole === PRODUCT_ROLES.SUPER_ADMIN'));
  assert.ok(
    policy.includes('![PRODUCT_ROLES.SUPER_ADMIN, PRODUCT_ROLES.HIGH_ADMIN, PRODUCT_ROLES.STAFF].includes(actorN.productRole)'),
    'HIGH_ADMIN và STAFF giữ nghiệp vụ cũ',
  );
  assert.ok(read('client/src/components/Inbox.jsx').includes("&& !['HIGH_ADMIN', 'STAFF'].includes(currentUser?.adminRole)"));

  const web = read('client/src/components/Inbox.jsx');
  assert.ok(web.includes('const superAdminReadOnly = Boolean('));
  assert.ok(web.includes('if (superAdminReadOnly) return;'), 'không gửi được dù gọi trực tiếp');
  assert.ok(web.includes('Chỉ Admin Super được gửi tin nhắn trong cuộc trò chuyện này.'));

  const mobile = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  assert.ok(mobile.includes("(chatPeerId === 'admin' || chatPeerAdminRole === 'SUPER_ADMIN')"));
  assert.ok(mobile.includes('if (superAdminReadOnly) return;'));
  assert.ok(mobile.includes('Chỉ Admin Super được gửi tin nhắn trong cuộc trò chuyện này.'));
});
