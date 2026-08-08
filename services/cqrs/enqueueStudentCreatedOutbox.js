'use strict';

const mongoose = require('mongoose');
const OutboxEvent = require('../../shared/outbox/OutboxEvent');
const logger = require('../../config/logger');

/**
 * After a successful legacy student create, record StudentCreatedEvent
 * so welcome mail/Zalo is processed by OutboxWorker (not inline).
 *
 * Full multi-doc TX (student+invoice+ledger) needs session support in
 * ledgerService — tracked as follow-up. This phase only moves side-effects.
 */
async function enqueueStudentCreatedOutbox({ student, plainPassword, actorId }) {
  if (!student?._id) return null;
  try {
    const [evt] = await OutboxEvent.create([{
      eventType: 'StudentCreatedEvent',
      aggregateType: 'Student',
      aggregateId: student._id,
      payload: {
        studentId: student._id,
        name: student.name,
        phone: student.phone,
        zalo: student.zalo,
        email: student.email,
        plainPassword,
      },
      status: 'PENDING',
      branchId: student.branchId || undefined,
      actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
    }]);
    return evt;
  } catch (err) {
    logger.error({ err: err.message, studentId: student._id }, '[CQRS] student outbox enqueue failed');
    throw err;
  }
}

module.exports = { enqueueStudentCreatedOutbox };
