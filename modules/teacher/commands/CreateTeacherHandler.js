'use strict';
const TransactionContext = require('../../../shared/transaction/TransactionContext');
const OutboxEvent = require('../../../shared/outbox/OutboxEvent');
const teacherApplicationService = require('../services/TeacherApplicationService');

class CreateTeacherHandler {
  async execute(command) {
    const tx = TransactionContext.current();
    if (!tx || !tx.session) {
      throw new Error('CreateTeacherHandler must be executed within a transaction context.');
    }

    const { data } = command.payload;
    
    // Inject flag to skip synchronous side effects in legacy service
    const serviceData = {
      ...command.payload,
      skipSideEffects: true
    };

    // Execute core domain logic inside transaction
    const result = await teacherApplicationService.post_root(serviceData);

    // If successful, persist OutboxEvent inside the SAME transaction
    if (result && result._status === 201 && result._body && result._body.success) {
      const teacherResponse = result._body.data;
      
      const actor = command.payload.currentUser || {};
      const payload = {
        teacherId: teacherResponse._id,
        name: teacherResponse.name,
        branchCode: teacherResponse.branchCode,
        phone: teacherResponse.phone,
        email: teacherResponse.email,
        plainPassword: teacherResponse.tempPassword, // required for welcome email
        createdBy: actor.id || actor._id || null,
      };

      await OutboxEvent.create([{
        eventType: 'TeacherCreatedEvent',
        aggregateId: teacherResponse._id,
        aggregateType: 'Teacher',
        payload: payload,
        status: 'PENDING'
      }], { session: tx.session });
    }

    return result;
  }
}

module.exports = CreateTeacherHandler;
