'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const AttendancePut_scheduleIdCompleted = require('../events/AttendancePut_scheduleIdCompleted');

class Put_scheduleIdHandler {
  async execute(command) {
    const result = await attendanceApplicationService.put_scheduleId(command);
    await eventBus.publish(new AttendancePut_scheduleIdCompleted(command));
    return result;
  }
}
module.exports = Put_scheduleIdHandler;
