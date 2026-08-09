'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPost_rootCompleted = require('../events/StudentPost_rootCompleted');

class Post_rootHandler {
  async execute(command) {
    const result = await studentApplicationService.post_root(command);
    await eventBus.publish(new StudentPost_rootCompleted(command));
    return result;
  }
}
module.exports = Post_rootHandler;
