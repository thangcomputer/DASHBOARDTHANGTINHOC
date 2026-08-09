'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_id_pay_teacherCompleted = require('../events/StudentPut_id_pay_teacherCompleted');

class Put_id_pay_teacherHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id_pay_teacher(command);
    await eventBus.publish(new StudentPut_id_pay_teacherCompleted(command));
    return result;
  }
}
module.exports = Put_id_pay_teacherHandler;
