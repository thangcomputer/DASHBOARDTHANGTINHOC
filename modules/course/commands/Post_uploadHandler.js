'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const CoursePost_uploadCompleted = require('../events/CoursePost_uploadCompleted');

class Post_uploadHandler {
  async execute(command) {
    const result = await assignmentApplicationService.post_upload(command);
    await eventBus.publish(new CoursePost_uploadCompleted(command));
    return result;
  }
}
module.exports = Post_uploadHandler;
