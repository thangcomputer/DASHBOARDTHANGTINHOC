'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('web shows the AI is replying until the AI answers', async () => {
  const { isAwaitingAiReply, AI_REPLY_WAIT_MS } = await import(
    pathToFileURL(path.join(ROOT, 'client/src/utils/aiSupport.js')).href
  );
  const now = Date.parse('2026-11-04T05:00:00Z');
  const mine = { senderId: 'u1', content: 'đúng rồi', createdAt: new Date(now - 3000).toISOString() };
  const ai = { senderId: 'ai_support', content: 'Dạ', createdAt: new Date(now - 1000).toISOString() };

  assert.equal(isAwaitingAiReply([ai, mine], 'u1', now), true);
  assert.equal(isAwaitingAiReply([mine, ai], 'u1', now), false);
  assert.equal(isAwaitingAiReply([mine, { senderId: 'x', messageType: 'system' }], 'u1', now), true);
  assert.equal(isAwaitingAiReply([mine], 'u1', now + AI_REPLY_WAIT_MS), false);
  assert.equal(isAwaitingAiReply([], 'u1', now), false);
});

test('web and mobile both render the AI replying label', () => {
  const web = read('client/src/components/FloatingMessenger.jsx');
  const mobile = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');

  assert.ok(web.includes('isAwaitingAiReply(messages, meId)'));
  assert.ok(web.includes('peerTyping || sending || awaitingAiReply'));
  assert.ok(web.includes("'Trợ lý AI đang trả lời'"));
  assert.ok(mobile.includes('peerTyping || aiAwaitingReply'));
  assert.ok(mobile.includes("'Trợ lý AI đang trả lời…'"));
  assert.ok(mobile.includes('const AI_REPLY_WAIT_MS = 90 * 1000;'));
});
