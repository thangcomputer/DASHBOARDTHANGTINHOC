'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_idCompleted = require('../events/StudentPut_idCompleted');

class Put_idHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id(command);
    await eventBus.publish(new StudentPut_idCompleted(command));
    return result;
  }
}
module.exports = Put_idHandler;
