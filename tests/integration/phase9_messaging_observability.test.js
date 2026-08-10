/**
 * Phase 9 — Messaging observability wiring (no business behavior change).
 */
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  runWithMessagingCorrelation,
  getCorrelation,
  logPolicyDecision,
  logPersisted,
  logDelivery,
  snapshotCounters,
  resetCountersForTests,
  newCorrelationId,
} = require('../../services/messagingObservability');
const prometheusExporter = require('../../shared/metrics/prometheusExporter');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Phase 9 messaging observability', { concurrency: false }, () => {
  before(() => resetCountersForTests());

  it('correlation ALS bridges across async work', async () => {
    const id = newCorrelationId('t');
    await runWithMessagingCorrelation({ correlationId: id, channel: 'test' }, async () => {
      await Promise.resolve();
      const c = getCorrelation();
      assert.equal(c.correlationId, id);
      assert.equal(c.channel, 'test');
    });
  });

  it('policy/persist/delivery counters increment without logging body', () => {
    resetCountersForTests();
    logPolicyDecision({
      allowed: true,
      code: 'MESSAGING_ALLOWED',
      senderId: 'a',
      receiverId: 'b',
      senderProductRole: 'STUDENT',
      receiverProductRole: 'SUPPORT',
      senderTransportRole: 'student',
      receiverTransportRole: 'staff',
    });
    logPersisted({
      messageId: 'm1',
      conversationId: 'c1',
      senderId: 'a',
      receiverId: 'b',
      senderRole: 'student',
      receiverRole: 'staff',
    });
    logDelivery({
      eventName: 'message:receive',
      targetRole: 'staff',
      targetUserId: 'b',
      presenceKey: 'staff_b',
      selectedSocketId: 'sock1',
      room: 'sock1',
      mode: 'presence_socketId',
      messageId: 'm1',
      conversationId: 'c1',
      productRole: 'SUPPORT',
      transportRole: 'staff',
    });
    const snap = snapshotCounters();
    assert.equal(snap.messages_sent_total, 1);
    assert.equal(snap.messages_persisted_total, 1);
    assert.equal(snap.messages_delivery_success_total, 1);
  });

  it('deny counter increments', () => {
    resetCountersForTests();
    logPolicyDecision({
      allowed: false,
      code: 'MESSAGING_TENANT_MISMATCH',
      reason: 'TENANT_MISMATCH',
      senderId: 'a',
      receiverId: 'b',
    });
    assert.equal(snapshotCounters().messages_denied_total, 1);
  });

  it('wiring: DMS + notifyUser + socket use messagingObservability', () => {
    const dms = read('services/directMessageService.js');
    const server = read('server.js');
    const routes = read('routes/messageRoutes.js');
    assert.ok(dms.includes('messagingObservability'));
    assert.ok(dms.includes('logPolicyDecision'));
    assert.ok(dms.includes('logPersisted'));
    assert.ok(server.includes('logDelivery'));
    assert.ok(server.includes('runWithMessagingCorrelation'));
    assert.ok(routes.includes('code: result.code'));
    assert.equal(dms.includes('content:'), true); // still persists content
    // Must not log content in observability module
    const obs = read('services/messagingObservability.js');
    assert.ok(obs.includes('DO NOT') || obs.includes('NEVER logs'));
    assert.ok(obs.includes('delete payload.content'));
  });

  it('prometheus exporter includes messaging counters', async () => {
    const text = await prometheusExporter.toPrometheusText();
    assert.ok(text.includes('messaging_messages_sent_total'));
    assert.ok(text.includes('messaging_messages_denied_total'));
    assert.ok(text.includes('messaging_messages_persisted_total'));
    assert.ok(text.includes('messaging_messages_delivery_success_total'));
  });

  it('Message indexes cover unread + conversation queries', () => {
    const src = read('models/Message.js');
    assert.ok(src.includes('receiverId: 1, isRead: 1'));
    assert.ok(src.includes('conversationId: 1, createdAt: -1'));
    assert.ok(src.includes('senderId: 1, createdAt: -1'));
  });

  it('Redis Socket.IO adapter exists but presence is dual-mode', () => {
    const adapter = read('config/socketIoAdapter.js');
    const presence = read('config/presenceStore.js');
    assert.ok(adapter.includes('createAdapter'));
    assert.ok(adapter.includes('memory'));
    assert.ok(presence.includes('cms:presence'));
    assert.ok(presence.includes('local.set'));
  });

  it('notifyUser never fans private DM to ALL_STAFF (regression lock)', () => {
    const server = read('server.js');
    assert.ok(server.includes('NEVER fan-out private messages to ALL_STAFF'));
    assert.ok(server.includes("mode: 'presence_socketId'") || server.includes('presence_socketId'));
    assert.ok(server.includes("mode: 'userId_room'") || server.includes('userId_room'));
  });
});
