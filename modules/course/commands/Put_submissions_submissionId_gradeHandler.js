'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const CoursePut_submissions_submissionId_gradeCompleted = require('../events/CoursePut_submissions_submissionId_gradeCompleted');

class Put_submissions_submissionId_gradeHandler {
  async execute(command) {
    const result = await assignmentApplicationService.put_submissions_submissionId_grade(command);
    await eventBus.publish(new CoursePut_submissions_submissionId_gradeCompleted(command));
    return result;
  }
}
module.exports = Put_submissions_submissionId_gradeHandler;
