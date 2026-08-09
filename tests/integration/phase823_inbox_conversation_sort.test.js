/**
 * Phase 8.23 — Inbox conversation sort / new-message priority.
 * FE-only. Does not touch RBAC / backend conversationId / Enterprise.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Load ESM-like conversationList via Function (no bundler). */
function loadConversationList() {
  const src = read('client/src/lib/conversationList.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\};?/g, '');
  const wrapped = `${src}\nmodule.exports = { conversationActivityTime, sortConversationsByLastMessageAt, mergeConversationsById };`;
  const mod = { exports: {} };
  vm.runInNewContext(wrapped, { module: mod, exports: mod.exports });
  return mod.exports;
}

describe('Phase 8.23 conversation list ordering', { concurrency: false }, () => {
  const {
    sortConversationsByLastMessageAt,
    mergeConversationsById,
    conversationActivityTime,
  } = loadConversationList();

  it('1 new message from B → B, A, C', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: '2026-01-01T10:00:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
      { id: 'C', lastTime: '2026-01-01T09:55:00Z' },
    ]);
    assert.equal(list.map((c) => c.id).join(','), 'B,A,C');
  });

  it('2 new message from A at 10:10 → A, B, C', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: '2026-01-01T10:10:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
      { id: 'C', lastTime: '2026-01-01T09:55:00Z' },
    ]);
    assert.equal(list.map((c) => c.id).join(','), 'A,B,C');
  });

  it('3 two messages from C → C first', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: '2026-01-01T10:10:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
      { id: 'C', lastTime: '2026-01-01T10:20:00Z' },
    ]);
    assert.equal(list.map((c) => c.id).join(','), 'C,A,B');
  });

  it('4 immutable sort does not mutate input', () => {
    const input = [
      { id: 'A', lastTime: '2026-01-01T10:00:00Z' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
    ];
    const copy = input.map((c) => ({ ...c }));
    sortConversationsByLastMessageAt(input);
    assert.deepEqual(input.map((c) => c.id), copy.map((c) => c.id));
  });

  it('5 merge by conversationId keeps newer lastTime + single row', () => {
    const merged = mergeConversationsById([
      { id: 'staff_1__student_s', lastTime: '2026-01-01T10:00:00Z', lastMessage: 'old', unread: 0, user: { id: '1', name: 'Staff' } },
      { id: 'staff_1__student_s', lastTime: '2026-01-01T10:10:00Z', lastMessage: 'new', unread: 1, user: { id: '1', name: 'Staff' } },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].lastMessage, 'new');
    assert.equal(merged[0].unread, 1);
    assert.equal(conversationActivityTime(merged[0]), new Date('2026-01-01T10:10:00Z').getTime());
  });

  it('6 teacher/staff/support threads stay separate when ordered', () => {
    const merged = mergeConversationsById([
      { id: 'teacher_t__student_s', lastTime: '2026-01-01T10:00:00Z', user: { id: 't' } },
      { id: 'staff_a__student_s', lastTime: '2026-01-01T10:05:00Z', user: { id: 'a' } },
      { id: 'staff_b__student_s', lastTime: '2026-01-01T10:03:00Z', user: { id: 'b' } },
    ]);
    assert.equal(merged.length, 3);
    assert.equal(merged.map((c) => c.id).join(','), 'staff_a__student_s,staff_b__student_s,teacher_t__student_s');
  });

  it('7 Inbox uses mergeConversationsById / no in-place list.sort + userKey dedupe', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.ok(inbox.includes('mergeConversationsById'));
    assert.ok(inbox.includes('activityByPeer') || inbox.includes('activityById'));
    assert.equal(inbox.includes('finalSeenUserKeys'), false);
    assert.equal(/list\.sort\(/.test(inbox), false);
  });

  it('8 useDataMessaging uses immutable sortConversationsByLastMessageAt', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.ok(src.includes('sortConversationsByLastMessageAt'));
    assert.equal(/Object\.values\(convMap\)\.sort\(/.test(src), false);
  });

  it('9 invalid lastTime does not break ordering', () => {
    const list = sortConversationsByLastMessageAt([
      { id: 'A', lastTime: 'bogus' },
      { id: 'B', lastTime: '2026-01-01T10:05:00Z' },
    ]);
    assert.equal(list[0].id, 'B');
  });
});
