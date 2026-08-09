'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_id_payCompleted = require('../events/StudentPut_id_payCompleted');

class Put_id_payHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id_pay(command);
    await eventBus.publish(new StudentPut_id_payCompleted(command));
    return result;
  }
}
module.exports = Put_id_payHandler;
