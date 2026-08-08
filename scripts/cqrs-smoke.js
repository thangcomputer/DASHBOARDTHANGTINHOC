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
  delete process.env.ENABLE_CQRS;
  delete process.env.ENABLE_CQRS_FINANCE;
  delete process.env.ENABLE_CQRS_TEACHER;

  await mongoose.connect(uri);
  const phone = `09${String(Date.now()).slice(-8)}`;
  const Teacher = require('../models/Teacher');
  const Student = require('../models/Student');
  const Invoice = require('../models/Invoice');
  const LedgerEntry = require('../models/LedgerEntry');
  const OutboxEvent = require('../shared/outbox/OutboxEvent');
  const { createTeacherCqrs } = require('../services/cqrs');
  const { payStudentCqrs } = require('../services/cqrs/payStudentCqrs');
  const { refundStudentCqrs } = require('../services/cqrs/refundStudentCqrs');

  await Promise.all([
    Teacher.createCollection().catch(() => {}),
    Student.createCollection().catch(() => {}),
    Invoice.createCollection().catch(() => {}),
    LedgerEntry.createCollection().catch(() => {}),
    OutboxEvent.createCollection().catch(() => {}),
  ]);

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

  const hvPhone = `08${String(Date.now()).slice(-8)}`;
  const student = await Student.create({
    name: 'Smoke CQRS HV',
    phone: hvPhone,
    zalo: hvPhone,
    course: 'Smoke Course',
    price: 500000,
    paid: false,
    paidAmount: 0,
    totalSessions: 5,
    remainingSessions: 5,
    password: 'temp1234',
    isFirstLogin: true,
    enrollments: [{
      courseName: 'Smoke Course',
      price: 500000,
      paid: false,
      totalSessions: 5,
      remainingSessions: 5,
      status: 'pending_payment',
      learningAccess: false,
      isPrimary: true,
      registeredAt: new Date(),
    }],
  });

  const bust = () => {};
  const financeActor = () => ({ id: 'smoke', role: 'admin' });
  const financeReqMeta = () => ({ ip: '127.0.0.1', userAgent: 'cqrs-smoke' });
  const reqBase = {
    params: { id: String(student._id) },
    user: { id: 'smoke', role: 'admin' },
  };

  const paid = await payStudentCqrs(
    { ...reqBase, body: { paymentMethod: 'cash', note: 'smoke-pay' } },
    { financeActor, financeReqMeta, bustFinanceCaches: bust }
  );
  if (!paid.student?.paid) throw new Error('payStudentCqrs did not mark paid');
  if (!paid.invoice?.maHoaDon) throw new Error('payStudentCqrs missing invoice');

  const paymentCount = await LedgerEntry.countDocuments({
    studentId: student._id,
    type: 'payment',
    status: 'posted',
  });
  if (paymentCount < 1) throw new Error('ledger payment missing after pay');

  await refundStudentCqrs(
    { ...reqBase, body: { note: 'smoke-refund' } },
    { financeActor, financeReqMeta, bustFinanceCaches: bust }
  );
  const after = await Student.findById(student._id);
  if (after.paid) throw new Error('refundStudentCqrs did not clear paid');

  await OutboxEvent.deleteOne({ _id: outbox._id });
  await Teacher.deleteOne({ _id: teacher._id });
  await Invoice.deleteMany({ studentId: student._id });
  await LedgerEntry.deleteMany({ studentId: student._id });
  await Student.deleteOne({ _id: student._id });

  console.log(`[cqrs-smoke] OK — teacher + pay/refund TX + outbox + stats${memory ? ' (memory RS)' : ''}`);
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
