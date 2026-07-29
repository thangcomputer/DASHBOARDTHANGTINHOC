/**
 * Phase 5 — Notification platform (templates, deep links, idempotency, digest).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  renderTemplate,
  renderTpl,
  buildIdempotencyKey,
  getTemplate,
  TEMPLATES,
} = require('../../constants/notificationTemplates');
const { resolveDeepLink, DEEP_LINKS } = require('../../constants/deepLinks');
const { vnDayBounds, buildSummary } = require('../../services/notificationDigest');
const { buildReceiverMatch } = require('../../services/notificationCenter');

test('TEMPLATES include CLASS_REMINDER_TODAY and PASSWORD_PROVISIONED', () => {
  assert.ok(TEMPLATES.CLASS_REMINDER_TODAY);
  assert.ok(TEMPLATES.PASSWORD_PROVISIONED);
  assert.equal(getTemplate('password_provisioned').code, 'PASSWORD_PROVISIONED');
});

test('renderTpl replaces placeholders', () => {
  assert.equal(renderTpl('Hi {{name}}', { name: 'An' }), 'Hi An');
});

test('renderTemplate CLASS_REMINDER_TODAY', () => {
  const r = renderTemplate('CLASS_REMINDER_TODAY', {
    count: 2,
    summary: 'Excel lúc 19:00; Word lúc 20:30',
  });
  assert.equal(r.type, 'SCHEDULE');
  assert.ok(r.content.includes('2'));
  assert.ok(r.content.includes('Excel'));
  assert.equal(r.link, DEEP_LINKS.STUDENT_SCHEDULE);
  assert.ok(r.channels.includes('in_app'));
});

test('buildIdempotencyKey stable for same receivers unordered', () => {
  const a = buildIdempotencyKey('evt1', ['u2', 'u1']);
  const b = buildIdempotencyKey('evt1', ['u1', 'u2']);
  assert.equal(a, b);
  assert.equal(buildIdempotencyKey('', ['u1']), '');
});

test('resolveDeepLink registry', () => {
  assert.equal(resolveDeepLink('STUDENT_EXAM'), '/student/exam');
  assert.equal(resolveDeepLink('/custom/path'), '/custom/path');
});

test('vnDayBounds returns dateKey YYYY-MM-DD', () => {
  const { dateKey, startUtc, endUtc } = vnDayBounds(new Date('2026-07-29T10:00:00+07:00'));
  assert.match(dateKey, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(endUtc > startUtc);
});

test('buildSummary truncates list', () => {
  const s = buildSummary([
    { course: 'A', startTime: '19:00' },
    { course: 'B', startTime: '20:00' },
  ]);
  assert.ok(s.includes('A lúc 19:00'));
  assert.ok(s.includes('B lúc 20:00'));
});

test('NotificationDelivery model loads', () => {
  const NotificationDelivery = require('../../models/NotificationDelivery');
  assert.equal(NotificationDelivery.modelName, 'NotificationDelivery');
  assert.ok(NotificationDelivery.schema.paths.channel);
  assert.ok(NotificationDelivery.schema.paths.status);
});

test('Notification schema has Phase 5 fields', () => {
  const Notification = require('../../models/Notification');
  assert.ok(Notification.schema.paths.idempotencyKey);
  assert.ok(Notification.schema.paths.templateCode);
  assert.ok(Notification.schema.paths.archived_by);
  assert.ok(Notification.schema.paths.eventId);
});

test('notificationCenter exports archive', () => {
  const center = require('../../services/notificationCenter');
  assert.equal(typeof center.archive, 'function');
  const { match } = buildReceiverMatch({ id: 's1', role: 'student' });
  assert.ok(match.some((m) => m.receivers === 'ALL_STUDENT'));
});

test('enqueueNotifyText exported', () => {
  const q = require('../../services/queue/jobQueue');
  assert.equal(typeof q.enqueueNotifyText, 'function');
});
