#!/usr/bin/env node
'use strict';

/**
 * Staging smoke for CQRS TX paths.
 * Usage:
 *   MONGODB_URI='mongodb://127.0.0.1:27017/db?replicaSet=rs0' node scripts/cqrs-smoke.js
 *   CQRS_SMOKE_MEMORY=1 node scripts/cqrs-smoke.js   # in-memory replica (dev)
 * Exits 0 on pass; skips (exit 0) when URI lacks replica set (unless MEMORY=1).
 */
const mongoose = require('mongoose');

async function resolveUri() {
  if (process.env.CQRS_SMOKE_MEMORY === '1') {
    const { startMemoryReplicaSet } = require('../tests/helpers/memoryReplica');
    return { uri: await startMemoryReplicaSet(), memory: true };
  }
  const URI = process.env.MONGODB_URI || '';
  const canTx = /replicaSet=/i.test(URI) || /^mongodb\+srv:/i.test(URI);
  if (!URI || !canTx) {
    console.log('[cqrs-smoke] SKIP — set MONGODB_URI with ?replicaSet= or CQRS_SMOKE_MEMORY=1');
    return { uri: null, memory: false };
  }
  return { uri: URI, memory: false };
}

async function main() {
  const { uri, memory } = await resolveUri();
  if (!uri) return;

  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
  const phone = `09${String(Date.now()).slice(-8)}`;
  const Teacher = require('../models/Teacher');
  const OutboxEvent = require('../shared/outbox/OutboxEvent');
  const { createTeacherCqrs } = require('../services/cqrs');

  await Teacher.createCollection().catch(() => {});
  await OutboxEvent.createCollection().catch(() => {});

  const result = await createTeacherCqrs({
    body: { name: 'Smoke CQRS GV', phone },
    user: { id: 'smoke', role: 'admin' },
    userBranchId: null,
  });
  if (result.status !== 201) throw new Error(`teacher create status ${result.status}`);

  const teacher = await Teacher.findOne({ phone });
  const outbox = await OutboxEvent.findOne({
    aggregateId: teacher._id,
    eventType: 'TeacherCreatedEvent',
  });
  if (!outbox || outbox.status !== 'PENDING') {
    throw new Error('Outbox TeacherCreatedEvent missing/PENDING expected');
  }

  const { getOutboxStats } = require('../shared/outbox/stats');
  const stats = await getOutboxStats();
  if (!stats.available) throw new Error('outbox stats unavailable');

  await OutboxEvent.deleteOne({ _id: outbox._id });
  await Teacher.deleteOne({ _id: teacher._id });
  console.log(`[cqrs-smoke] OK — teacher TX + outbox + stats${memory ? ' (memory RS)' : ''}`);
  await mongoose.disconnect();
  if (memory) {
    const { stopMemoryReplicaSet } = require('../tests/helpers/memoryReplica');
    await stopMemoryReplicaSet();
  }
}

main().catch(async (err) => {
  console.error('[cqrs-smoke] FAIL', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
