'use strict';
const employeeApplicationService = require('../services/TeacherApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TeacherDelete_idCompleted = require('../events/TeacherDelete_idCompleted');

class Delete_idHandler {
  async execute(command) {
    const result = await employeeApplicationService.delete_id(command);
    await eventBus.publish(new TeacherDelete_idCompleted(command));
    return result;
  }
}
module.exports = Delete_idHandler;
