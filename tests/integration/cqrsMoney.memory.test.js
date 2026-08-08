'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startMemoryReplicaSet, stopMemoryReplicaSet } = require('../helpers/memoryReplica');

test('CQRS money TX: pay + refund + discount on memory replica', async (t) => {
  let uri;
  try {
    uri = await startMemoryReplicaSet();
  } catch (err) {
    t.skip(`mongodb-memory-server unavailable: ${err.message}`);
    return;
  }

  process.env.MONGODB_URI = uri;
  delete process.env.ENABLE_CQRS;
  delete process.env.ENABLE_CQRS_FINANCE;

  await mongoose.connect(uri);

  const Student = require('../../models/Student');
  const Invoice = require('../../models/Invoice');
  const LedgerEntry = require('../../models/LedgerEntry');
  await Promise.all([
    Student.createCollection().catch(() => {}),
    Invoice.createCollection().catch(() => {}),
    LedgerEntry.createCollection().catch(() => {}),
  ]);
  await Promise.all([
    Student.syncIndexes().catch(() => {}),
    Invoice.syncIndexes().catch(() => {}),
    LedgerEntry.syncIndexes().catch(() => {}),
  ]);

  const phone = `07${String(Date.now()).slice(-8)}`;
  const student = await Student.create({
    name: 'Money TX HV',
    phone,
    zalo: phone,
    course: 'TX Course',
    price: 1500000,
    paid: false,
    paidAmount: 0,
    totalSessions: 10,
    remainingSessions: 10,
    password: 'temp1234',
    isFirstLogin: true,
    enrollments: [{
      courseName: 'TX Course',
      price: 1500000,
      paid: false,
      totalSessions: 10,
      remainingSessions: 10,
      status: 'pending_payment',
      learningAccess: false,
      isPrimary: true,
      registeredAt: new Date(),
    }],
  });

  const { payStudentCqrs } = require('../../services/cqrs/payStudentCqrs');
  const { refundStudentCqrs } = require('../../services/cqrs/refundStudentCqrs');
  const { postDiscountCqrs } = require('../../services/cqrs/postDiscountCqrs');

  const bust = () => {};
  const financeActor = () => ({ id: 'admin', role: 'admin' });
  const financeReqMeta = () => ({ ip: '127.0.0.1', userAgent: 'test' });

  const paid = await payStudentCqrs(
    { params: { id: String(student._id) }, body: { paymentMethod: 'cash', note: 'tx-test' }, user: { id: 'admin', role: 'admin' } },
    { financeActor, financeReqMeta, bustFinanceCaches: bust }
  );
  assert.equal(paid.student.paid, true);
  assert.ok(paid.invoice?.maHoaDon);

  const paymentEntries = await LedgerEntry.find({ studentId: student._id, type: 'payment', status: 'posted' });
  assert.equal(paymentEntries.length, 1);

  await postDiscountCqrs(
    {
      body: {
        studentId: String(student._id),
        amount: 100000,
        kind: 'discount',
        note: 'promo',
        sourceRef: `discount:test:${student._id}`,
      },
      user: { id: 'admin', role: 'admin' },
    },
    { actorOf: () => ({ id: 'admin', role: 'admin' }) }
  );
  const discounts = await LedgerEntry.find({ studentId: student._id, type: 'discount', status: 'posted' });
  assert.equal(discounts.length, 1);

  const refunded = await refundStudentCqrs(
    { params: { id: String(student._id) }, body: { note: 'full refund' }, user: { id: 'admin', role: 'admin' } },
    { financeActor, financeReqMeta, bustFinanceCaches: bust }
  );
  assert.equal(refunded.student.paid, false);
  assert.equal(refunded.partial, false);

  const refundEntries = await LedgerEntry.find({ studentId: student._id, type: 'refund', status: 'posted' });
  assert.ok(refundEntries.length >= 1);

  await LedgerEntry.deleteMany({ studentId: student._id });
  await Invoice.deleteMany({ hocVien: student._id });
  await Student.deleteOne({ _id: student._id });
  await mongoose.disconnect();
  await stopMemoryReplicaSet();
});

test('CQRS create teacher TX on memory replica', async (t) => {
  let uri;
  try {
    uri = await startMemoryReplicaSet();
  } catch (err) {
    t.skip(`mongodb-memory-server unavailable: ${err.message}`);
    return;
  }

  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
  const Teacher = require('../../models/Teacher');
  const OutboxEvent = require('../../shared/outbox/OutboxEvent');
  await Teacher.createCollection().catch(() => {});
  await OutboxEvent.createCollection().catch(() => {});
  await Teacher.syncIndexes().catch(() => {});
  await OutboxEvent.syncIndexes().catch(() => {});

  const phone = `06${String(Date.now()).slice(-8)}`;
  const { createTeacherCqrs } = require('../../services/cqrs');
  const result = await createTeacherCqrs({
    body: { name: 'Memory RS Teacher', phone },
    user: { id: 'admin', role: 'admin' },
    userBranchId: null,
  });
  assert.equal(result.status, 201);
  const teacher = await Teacher.findOne({ phone });
  const outbox = await OutboxEvent.findOne({ aggregateId: teacher._id, eventType: 'TeacherCreatedEvent' });
  assert.ok(outbox);
  assert.equal(outbox.status, 'PENDING');

  await OutboxEvent.deleteOne({ _id: outbox._id });
  await Teacher.deleteOne({ _id: teacher._id });
  await mongoose.disconnect();
  await stopMemoryReplicaSet();
});

test('CQRS enrollment pay + teacher salary + SePay session on memory replica', async (t) => {
  let uri;
  try {
    uri = await startMemoryReplicaSet();
  } catch (err) {
    t.skip(`mongodb-memory-server unavailable: ${err.message}`);
    return;
  }

  process.env.MONGODB_URI = uri;
  delete process.env.ENABLE_CQRS;
  delete process.env.ENABLE_CQRS_FINANCE;
  await mongoose.connect(uri);

  try {
  const Student = require('../../models/Student');
  const Teacher = require('../../models/Teacher');
  const Schedule = require('../../models/Schedule');
  const Transaction = require('../../models/Transaction');
  const Invoice = require('../../models/Invoice');
  const LedgerEntry = require('../../models/LedgerEntry');
  const PaymentSession = require('../../models/PaymentSession');

  await Promise.all([
    Student, Teacher, Schedule, Transaction, Invoice, LedgerEntry, PaymentSession,
  ].map((M) => M.createCollection().catch(() => {})));

  const phone = `05${String(Date.now()).slice(-8)}`;
  const student = await Student.create({
    name: 'Enroll TX HV',
    phone,
    zalo: phone,
    course: 'Primary',
    price: 1000000,
    paid: true,
    paidAmount: 1000000,
    totalSessions: 10,
    remainingSessions: 10,
    password: 'temp1234',
    isFirstLogin: true,
    enrollments: [
      {
        courseName: 'Primary',
        price: 1000000,
        paid: true,
        totalSessions: 10,
        remainingSessions: 10,
        status: 'active',
        learningAccess: true,
        isPrimary: true,
        registeredAt: new Date(),
      },
      {
        courseName: 'Secondary',
        price: 500000,
        paid: false,
        totalSessions: 8,
        remainingSessions: 8,
        status: 'pending_payment',
        learningAccess: false,
        isPrimary: false,
        registeredAt: new Date(),
      },
    ],
  });
  const enrId = String(student.enrollments[1]._id);

  const { payEnrollmentCqrs } = require('../../services/cqrs/payEnrollmentCqrs');
  const bust = () => {};
  const financeActor = () => ({ id: 'admin', role: 'admin' });
  const financeReqMeta = () => ({ ip: '127.0.0.1', userAgent: 'test' });
  const enrPay = await payEnrollmentCqrs(
    {
      params: { id: String(student._id), enrollmentId: enrId },
      body: { paymentMethod: 'cash', note: 'enr' },
      user: { id: 'admin', role: 'admin' },
    },
    { financeActor, financeReqMeta, bustFinanceCaches: bust }
  );
  assert.equal(enrPay.amount, 500000);
  assert.ok(enrPay.claimedEnr.paid);

  const tPhone = `04${String(Date.now()).slice(-8)}`;
  const teacher = await Teacher.create({
    name: 'Salary TX GV',
    phone: tPhone,
    password: 'temp1234',
    status: 'active',
    role: 'teacher',
    isFirstLogin: true,
    baseSalaryPerSession: 100000,
  });

  await Schedule.create({
    teacherId: teacher._id,
    teacherName: teacher.name,
    studentId: student._id,
    studentName: student.name,
    date: new Date(),
    startTime: '19:00',
    course: 'Primary',
    status: 'completed',
    is_paid_to_teacher: false,
    paymentStatus: 'pending',
  });

  const { payTeacherAllCqrs } = require('../../services/cqrs/payTeacherAllCqrs');
  const salary = await payTeacherAllCqrs({
    params: { id: String(teacher._id) },
    user: { id: 'admin', role: 'admin', name: 'Admin' },
  });
  assert.equal(salary.paidSessions, 1);
  assert.equal(salary.totalAmount, 100000);
  const salaryLedger = await LedgerEntry.find({
    teacherId: teacher._id,
    type: 'salary',
    status: 'posted',
  });
  assert.equal(salaryLedger.length, 1);

  const session = await PaymentSession.create({
    sessionId: `sess_${Date.now()}`,
    ref: `ref${Date.now()}`,
    amount: 200000,
    status: 'pending',
    studentName: 'Guest',
    courseName: 'Open',
  });
  const { sepaySettleSessionCqrs } = require('../../services/cqrs/sepaySettleCqrs');
  const sepay = await sepaySettleSessionCqrs({
    sessionDoc: session,
    amount: 200000,
    note: 'sepay test',
    reqMeta: { ip: '127.0.0.1', userAgent: 'test' },
  });
  assert.equal(sepay.matched, true);
  const refreshed = await PaymentSession.findById(session._id);
  assert.equal(refreshed.status, 'paid');

  await Promise.all([
    LedgerEntry.deleteMany({}),
    Invoice.deleteMany({}),
    Transaction.deleteMany({}),
    Schedule.deleteMany({}),
    PaymentSession.deleteMany({}),
    Student.deleteOne({ _id: student._id }),
    Teacher.deleteOne({ _id: teacher._id }),
  ]);
  } finally {
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    await stopMemoryReplicaSet();
  }
});
