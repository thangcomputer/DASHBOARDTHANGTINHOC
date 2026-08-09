'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_id_lock_examCompleted = require('../events/StudentPut_id_lock_examCompleted');

class Put_id_lock_examHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id_lock_exam(command);
    await eventBus.publish(new StudentPut_id_lock_examCompleted(command));
    return result;
  }
}
module.exports = Put_id_lock_examHandler;
