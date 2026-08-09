'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const AttendancePost_rootCompleted = require('../events/AttendancePost_rootCompleted');

class Post_rootHandler {
  async execute(command) {
    const result = await attendanceApplicationService.post_root(command);
    await eventBus.publish(new AttendancePost_rootCompleted(command));
    return result;
  }
}
module.exports = Post_rootHandler;
