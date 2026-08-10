/**
 * Phase 9 — Messaging observability helpers.
 * Reuses shared correlationContext + pino logger.
 * NEVER logs JWT, passwords, or message body.
 */
'use strict';

const crypto = require('crypto');
const correlationContext = require('../shared/context/correlationContext');
const logger = require('../config/logger');

const counters = {
  messages_sent_total: 0,
  messages_denied_total: 0,
  messages_persisted_total: 0,
  messages_delivery_success_total: 0,
  messages_delivery_failed_total: 0,
};

function newCorrelationId(prefix = 'msg') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function getCorrelation() {
  const store = correlationContext.getStore() || {};
  return {
    correlationId: store.correlationId || null,
    requestId: store.requestId || null,
    channel: store.channel || null,
  };
}

/**
 * Run fn inside ALS correlation store (HTTP or Socket).
 * @template T
 * @param {{ correlationId?: string, requestId?: string, channel?: string }} meta
 * @param {() => T|Promise<T>} fn
 * @returns {T|Promise<T>}
 */
function runWithMessagingCorrelation(meta, fn) {
  const existing = correlationContext.getStore();
  if (existing?.correlationId) {
    return fn();
  }
  const correlationId = meta?.correlationId || newCorrelationId();
  const requestId = meta?.requestId || correlationId;
  const channel = meta?.channel || 'messaging';
  return correlationContext.run({ correlationId, requestId, channel }, fn);
}

function bump(key) {
  if (Object.prototype.hasOwnProperty.call(counters, key)) {
    counters[key] += 1;
  }
}

function snapshotCounters() {
  return { ...counters };
}

function resetCountersForTests() {
  Object.keys(counters).forEach((k) => { counters[k] = 0; });
}

/**
 * Structured policy / delivery log — identifiers only.
 */
function logMessagingEvent(level, event, fields = {}) {
  const corr = getCorrelation();
  const payload = {
    msgDomain: 'messaging',
    event,
    correlationId: corr.correlationId,
    requestId: corr.requestId,
    channel: corr.channel || fields.channel || null,
    ...fields,
  };
  // Explicitly strip any accidental content keys
  delete payload.content;
  delete payload.body;
  delete payload.password;
  delete payload.token;
  delete payload.accessToken;
  delete payload.refreshToken;
  delete payload.authorization;

  const fn = typeof logger[level] === 'function' ? level : 'info';
  logger[fn](payload, event);
}

function logPolicyDecision({
  allowed,
  code,
  reason,
  policy,
  scope,
  senderId,
  receiverId,
  senderProductRole,
  receiverProductRole,
  senderTransportRole,
  receiverTransportRole,
  tenantId,
  branchId,
  channel,
}) {
  if (allowed) bump('messages_sent_total');
  else bump('messages_denied_total');

  logMessagingEvent(allowed ? 'info' : 'warn', allowed ? 'messaging.policy.allow' : 'messaging.policy.deny', {
    allowed: Boolean(allowed),
    code: code || null,
    reason: reason || null,
    policy: policy || null,
    scope: scope || null,
    senderId: senderId ? String(senderId) : null,
    receiverId: receiverId ? String(receiverId) : null,
    senderProductRole: senderProductRole || null,
    receiverProductRole: receiverProductRole || null,
    senderTransportRole: senderTransportRole || null,
    receiverTransportRole: receiverTransportRole || null,
    tenantId: tenantId ? String(tenantId) : null,
    branchId: branchId ? String(branchId) : null,
    channel: channel || null,
  });
}

function logPersisted({ messageId, conversationId, senderId, receiverId, senderRole, receiverRole }) {
  bump('messages_persisted_total');
  logMessagingEvent('info', 'messaging.persist.ok', {
    messageId: messageId ? String(messageId) : null,
    conversationId: conversationId || null,
    senderId: senderId ? String(senderId) : null,
    receiverId: receiverId ? String(receiverId) : null,
    senderRole: senderRole || null,
    receiverRole: receiverRole || null,
  });
}

/**
 * Wrong-recipient diagnostic: who was targeted and how.
 */
function logDelivery({
  eventName,
  targetRole,
  targetUserId,
  presenceKey,
  selectedSocketId,
  room,
  mode,
  messageId,
  conversationId,
  productRole,
  transportRole,
  ok = true,
}) {
  if (ok) bump('messages_delivery_success_total');
  else bump('messages_delivery_failed_total');

  logMessagingEvent(ok ? 'info' : 'warn', ok ? 'messaging.delivery.emit' : 'messaging.delivery.fail', {
    eventName: eventName || null,
    targetRole: targetRole || null,
    targetUserId: targetUserId ? String(targetUserId) : null,
    presenceKey: presenceKey || null,
    selectedSocketId: selectedSocketId || null,
    room: room || null,
    mode: mode || null,
    messageId: messageId ? String(messageId) : null,
    conversationId: conversationId || null,
    productRole: productRole || null,
    transportRole: transportRole || null,
  });
}

module.exports = {
  counters,
  snapshotCounters,
  resetCountersForTests,
  newCorrelationId,
  getCorrelation,
  runWithMessagingCorrelation,
  logMessagingEvent,
  logPolicyDecision,
  logPersisted,
  logDelivery,
  bump,
};
