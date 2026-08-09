'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentDelete_idCompleted = require('../events/StudentDelete_idCompleted');

class Delete_idHandler {
  async execute(command) {
    const result = await studentApplicationService.delete_id(command);
    await eventBus.publish(new StudentDelete_idCompleted(command));
    return result;
  }
}
module.exports = Delete_idHandler;
