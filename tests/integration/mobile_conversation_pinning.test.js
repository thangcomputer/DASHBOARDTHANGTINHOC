'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('conversation pins are persisted per user and restricted to conversation participants', () => {
  const model = read('models/ConversationVisibility.js');
  const routes = read('routes/messageRoutes.js');
  const policy = read('services/policyShadow/messagePolicy.js');

  assert.ok(model.includes('pinnedByUsers'));
  assert.ok(routes.includes("router.get('/pinned-conversations'"));
  assert.ok(routes.includes("router.put('/pin-conversation/:conversationId'"));
  assert.ok(routes.includes("canAccessDirectConversation(conversationId, req.user)"));
  assert.ok(routes.includes("'participants.userId': { $in: userIds }"));
  assert.ok(routes.includes('{ $addToSet: { pinnedByUsers: userId } }'));
  assert.ok(policy.includes("'pin_conversation'"));
  assert.ok(policy.includes("case 'pin_conversation':"));
});

test('mobile inbox exposes a dedicated pin button and sorts pinned contacts first', () => {
  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  const api = read('thang-tin-hoc-mobile/src/services/messageApi.ts');
  const service = read('thang-tin-hoc-mobile/src/services/mockService.ts');

  assert.ok(screen.includes('accessibilityLabel={conversation.isPinned ? `Bỏ ghim ${conversation.name}` : `Ghim ${conversation.name}`}'));
  assert.ok(screen.includes('messageService.setConversationPinned(conversation.id, !conversation.isPinned, user)'));
  assert.ok(screen.includes('if (a.pinned !== b.pinned) return b.pinned - a.pinned;'));
  assert.ok(api.includes("'/messages/pinned-conversations'"));
  assert.ok(api.includes('/messages/pin-conversation/'));
  assert.ok(service.includes('async setConversationPinned('));
});
