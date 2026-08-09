'use strict';
// const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPost_importCompleted = require('../events/StudentPost_importCompleted');

class Post_importHandler {
  async execute(command) {
    const result = await studentApplicationService.post_import(command);
    await eventBus.publish(new StudentPost_importCompleted(command));
    return result;
  }
}
module.exports = Post_importHandler;
