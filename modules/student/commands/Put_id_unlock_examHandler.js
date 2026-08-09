'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_id_unlock_examCompleted = require('../events/StudentPut_id_unlock_examCompleted');

class Put_id_unlock_examHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id_unlock_exam(command);
    await eventBus.publish(new StudentPut_id_unlock_examCompleted(command));
    return result;
  }
}
module.exports = Put_id_unlock_examHandler;
