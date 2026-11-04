'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function conversationRoute(routes) {
  const start = routes.indexOf("router.get('/:conversationId'");
  const end = routes.indexOf("router.get('/sync/:userId'");
  assert.ok(start >= 0 && end > start);
  return routes.slice(start, end);
}

test('conversation thread returns the newest page and supports a before cursor', () => {
  const body = conversationRoute(read('routes/messageRoutes.js'));

  assert.ok(body.includes('.sort({ createdAt: -1, _id: -1 })'));
  assert.equal(body.includes('.sort({ createdAt: 1 })'), false);
  assert.ok(body.includes('.limit(limit + 1)'));
  assert.ok(body.includes('req.query.before'));
  assert.ok(body.includes('{ createdAt: { $lt: cursor.createdAt } }'));
  assert.ok(body.includes('hasMore'));
  assert.ok(body.includes('.reverse()'));
});

test('mobile conversation can load older messages without dropping the latest page', () => {
  const api = read('thang-tin-hoc-mobile/src/services/messageApi.ts');
  const service = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const screen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');

  assert.ok(api.includes('export async function getOlderMessages('));
  assert.ok(api.includes('before=${encodeURIComponent(beforeId)}'));
  assert.ok(service.includes('async olderThread('));
  assert.ok(screen.includes('messageService.olderThread(route.params.conversationId, oldest.id, user)'));
  assert.ok(screen.includes('accessibilityLabel="Xem tin nhắn cũ hơn"'));
  assert.ok(screen.includes('[...older, ...latest, ...callMessages]'));
});
