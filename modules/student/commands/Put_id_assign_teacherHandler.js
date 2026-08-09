'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_id_assign_teacherCompleted = require('../events/StudentPut_id_assign_teacherCompleted');

class Put_id_assign_teacherHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id_assign_teacher(command);
    await eventBus.publish(new StudentPut_id_assign_teacherCompleted(command));
    return result;
  }
}
module.exports = Put_id_assign_teacherHandler;
