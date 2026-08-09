'use strict';
const studentApplicationService = require('../services/StudentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const StudentPut_id_exam_progressCompleted = require('../events/StudentPut_id_exam_progressCompleted');

class Put_id_exam_progressHandler {
  async execute(command) {
    const result = await studentApplicationService.put_id_exam_progress(command);
    await eventBus.publish(new StudentPut_id_exam_progressCompleted(command));
    return result;
  }
}
module.exports = Put_id_exam_progressHandler;
