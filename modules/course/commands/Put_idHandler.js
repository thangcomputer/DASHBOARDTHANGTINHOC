'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const CoursePut_idCompleted = require('../events/CoursePut_idCompleted');

class Put_idHandler {
  async execute(command) {
    const result = await assignmentApplicationService.put_id(command);
    await eventBus.publish(new CoursePut_idCompleted(command));
    return result;
  }
}
module.exports = Put_idHandler;
