'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_id_refundCompleted = require('../events/StudentPut_id_refundCompleted');

class Put_id_refundHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id_refund(command);
    await eventBus.publish(new StudentPut_id_refundCompleted(command));
    return result;
  }
}
module.exports = Put_id_refundHandler;
