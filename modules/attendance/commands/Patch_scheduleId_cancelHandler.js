'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const AttendancePatch_scheduleId_cancelCompleted = require('../events/AttendancePatch_scheduleId_cancelCompleted');

class Patch_scheduleId_cancelHandler {
  async execute(command) {
    const result = await attendanceApplicationService.patch_scheduleId_cancel(command);
    await eventBus.publish(new AttendancePatch_scheduleId_cancelCompleted(command));
    return result;
  }
}
module.exports = Patch_scheduleId_cancelHandler;
