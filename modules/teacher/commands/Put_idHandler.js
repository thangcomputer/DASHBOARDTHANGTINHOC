'use strict';
const employeeApplicationService = require('../services/TeacherApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TeacherPut_idCompleted = require('../events/TeacherPut_idCompleted');

class Put_idHandler {
  async execute(command) {
    const result = await employeeApplicationService.put_id(command);
    await eventBus.publish(new TeacherPut_idCompleted(command));
    return result;
  }
}
module.exports = Put_idHandler;
