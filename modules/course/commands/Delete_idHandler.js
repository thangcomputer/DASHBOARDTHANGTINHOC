'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const CourseDelete_idCompleted = require('../events/CourseDelete_idCompleted');

class Delete_idHandler {
  async execute(command) {
    const result = await assignmentApplicationService.delete_id(command);
    await eventBus.publish(new CourseDelete_idCompleted(command));
    return result;
  }
}
module.exports = Delete_idHandler;
