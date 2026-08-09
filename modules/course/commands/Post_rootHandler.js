'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const CoursePost_rootCompleted = require('../events/CoursePost_rootCompleted');

class Post_rootHandler {
  async execute(command) {
    const result = await assignmentApplicationService.post_root(command);
    await eventBus.publish(new CoursePost_rootCompleted(command));
    return result;
  }
}
module.exports = Post_rootHandler;
