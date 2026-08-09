'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const CoursePost_id_submitCompleted = require('../events/CoursePost_id_submitCompleted');

class Post_id_submitHandler {
  async execute(command) {
    const result = await assignmentApplicationService.post_id_submit(command);
    await eventBus.publish(new CoursePost_id_submitCompleted(command));
    return result;
  }
}
module.exports = Post_id_submitHandler;
