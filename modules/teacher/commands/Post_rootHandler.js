'use strict';
const employeeApplicationService = require('../services/TeacherApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TeacherPost_rootCompleted = require('../events/TeacherPost_rootCompleted');

class Post_rootHandler {
  async execute(command) {
    const result = await employeeApplicationService.post_root(command);
    await eventBus.publish(new TeacherPost_rootCompleted(command));
    return result;
  }
}
module.exports = Post_rootHandler;
