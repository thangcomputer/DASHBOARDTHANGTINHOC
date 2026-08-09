'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const AttendanceDelete_scheduleIdCompleted = require('../events/AttendanceDelete_scheduleIdCompleted');

class Delete_scheduleIdHandler {
  async execute(command) {
    const result = await attendanceApplicationService.delete_scheduleId(command);
    await eventBus.publish(new AttendanceDelete_scheduleIdCompleted(command));
    return result;
  }
}
module.exports = Delete_scheduleIdHandler;
