'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI || '';
const canTx = /replicaSet=/i.test(URI) || /^mongodb\+srv:/i.test(URI);

function skipUnlessReplica(t) {
  if (!URI || !canTx) {
    t.skip('Needs MONGODB_URI with replicaSet (or mongodb+srv) for CQRS TX tests');
    return true;
  }
  return false;
}

test('CQRS teacher create: Teacher + Outbox atomic', async (t) => {
  if (skipUnlessReplica(t)) return;

  process.env.ENABLE_CQRS_TEACHER = 'true';
  await mongoose.connect(URI);
  const Teacher = require('../../models/Teacher');
  const OutboxEvent = require('../../shared/outbox/OutboxEvent');
  await Teacher.createCollection().catch(() => {});
  await OutboxEvent.createCollection().catch(() => {});
  await Teacher.syncIndexes().catch(() => {});
  await OutboxEvent.syncIndexes().catch(() => {});

  const phone = `09${String(Date.now()).slice(-8)}`;
  await Teacher.deleteMany({ phone });
  await OutboxEvent.deleteMany({ 'payload.phone': phone });

  const { createTeacherCqrs } = require('../../services/cqrs/createTeacherCqrs');
  const req = {
    body: { name: 'CQRS Test Teacher', phone },
    user: { id: 'admin', role: 'admin' },
    userBranchId: null,
  };
  const result = await createTeacherCqrs(req);
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.ok(result.body.data.tempPassword);

  const teacher = await Teacher.findOne({ phone });
  assert.ok(teacher);
  const outbox = await OutboxEvent.findOne({ aggregateId: teacher._id, eventType: 'TeacherCreatedEvent' });
  assert.ok(outbox);
  assert.equal(outbox.status, 'PENDING');
  assert.ok(outbox.payload.plainPassword);

  await Teacher.deleteOne({ _id: teacher._id });
  await OutboxEvent.deleteOne({ _id: outbox._id });
  delete process.env.ENABLE_CQRS_TEACHER;
  await mongoose.disconnect();
});

test('CQRS invoice create: Invoice + Outbox atomic', async (t) => {
  if (skipUnlessReplica(t)) return;

  process.env.ENABLE_CQRS_INVOICE = 'true';
  await mongoose.connect(URI);
  const Student = require('../../models/Student');
  const Invoice = require('../../models/Invoice');
  const OutboxEvent = require('../../shared/outbox/OutboxEvent');
  await Student.createCollection().catch(() => {});
  await Invoice.createCollection().catch(() => {});
  await OutboxEvent.createCollection().catch(() => {});

  const phone = `08${String(Date.now()).slice(-8)}`;
  const student = await Student.create({
    name: 'Invoice CQRS HV',
    phone,
    zalo: phone,
    course: 'Test Course',
    price: 1000000,
    totalSessions: 10,
    remainingSessions: 10,
    password: 'temp1234',
    isFirstLogin: true,
  });

  const { createInvoiceCqrs } = require('../../services/cqrs/createInvoiceCqrs');
  const result = await createInvoiceCqrs({
    body: { hocVienId: student._id.toString(), ghiChu: 'cqrs' },
    user: { _id: new mongoose.Types.ObjectId() },
  });
  assert.equal(result.status, 201);
  assert.ok(result.body.data.maHoaDon);

  const invoice = await Invoice.findById(result.body.data._id);
  assert.ok(invoice);
  const outbox = await OutboxEvent.findOne({ aggregateId: invoice._id, eventType: 'InvoiceCreatedEvent' });
  assert.ok(outbox);
  assert.equal(outbox.payload.invoiceId, String(invoice._id));

  await Invoice.deleteOne({ _id: invoice._id });
  await OutboxEvent.deleteOne({ _id: outbox._id });
  await Student.deleteOne({ _id: student._id });
  delete process.env.ENABLE_CQRS_INVOICE;
  await mongoose.disconnect();
});

test('Outbox handlers: TeacherCreatedEvent invokes welcome path without throw', async () => {
  const { registerOutboxHandlers } = require('../../shared/outbox/registerHandlers');
  registerOutboxHandlers();
  const { eventBus } = require('../../shared/events/EventBus');
  // No SMTP/Zalo configured — sendAccountWelcome should no-op safely
  await eventBus.publish({
    eventName: 'TeacherCreatedEvent',
    payload: {
      teacherId: new mongoose.Types.ObjectId(),
      name: 'Handler Test',
      phone: '0900000000',
      plainPassword: 'abc12345',
    },
  });
  assert.ok(true);
});
