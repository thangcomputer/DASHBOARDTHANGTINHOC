'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPost_id_reset_today_attendanceCompleted = require('../events/StudentPost_id_reset_today_attendanceCompleted');

class Post_id_reset_today_attendanceHandler {
  async execute(command) {
    const result = await studentApplicationService.post_id_reset_today_attendance(command);
    await eventBus.publish(new StudentPost_id_reset_today_attendanceCompleted(command));
    return result;
  }
}
module.exports = Post_id_reset_today_attendanceHandler;
