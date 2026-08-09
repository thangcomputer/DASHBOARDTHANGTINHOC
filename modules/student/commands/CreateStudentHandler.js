'use strict';

const StudentAggregate = require('../domain/StudentAggregate');
const StudentRepository = require('../repositories/StudentRepository');
const mongoose = require('mongoose');
const TransactionContext = require('../../../shared/transaction/TransactionContext');
const OutboxEvent = require('../../../shared/outbox/OutboxEvent');

class CreateStudentHandler {
  async execute(command) {
    const { studentData, branchId, actorId, tenantId, correlationId } = command;

    // Domain invariant: uniqueness
    const exists = await StudentRepository.existsByPhoneOrEmail(studentData.phone, studentData.email);
    if (exists) {
      const err = new Error('Email hoặc số điện thoại đã tồn tại');
      err.status = 409;
      throw err;
    }

    const studentId = new mongoose.Types.ObjectId();
    const aggregate = StudentAggregate.create(studentId, studentData, branchId);

    // Persist Student using the current TransactionContext session
    const tx = TransactionContext.current();
    const session = tx ? tx.session : null;

    const studentDoc = await StudentRepository.save(aggregate, session);

    // Extract domain events and map to Outbox records within the same transaction
    for (const event of aggregate.events) {
      const outboxRecord = new OutboxEvent({
        eventType: event.type,
        aggregateType: 'Student',
        aggregateId: aggregate.id,
        payload: {
          ...event.payload,
          courseId: studentData.courseId,
          price: studentData.price,
          isPaidOnCreate: studentData.isPaidOnCreate || studentData.paid,
          paidAmount: studentData.paidAmount,
          paymentMethod: studentData.paymentMethod
        },
        tenantId,
        branchId,
        actorId
      });
      await outboxRecord.save({ session });
    }

    aggregate.clearEvents();

    return studentDoc.toObject();
  }
}

module.exports = new CreateStudentHandler();
