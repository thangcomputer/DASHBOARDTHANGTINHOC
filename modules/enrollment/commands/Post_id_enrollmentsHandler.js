'use strict';
const enrollmentApplicationService = require('../../services/EnrollmentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const EnrollmentPost_id_enrollmentsCompleted = require('../events/EnrollmentPost_id_enrollmentsCompleted');

class Post_id_enrollmentsHandler {
  async execute(command) {
    const result = await enrollmentApplicationService.post_id_enrollments(command);
    await eventBus.publish(new EnrollmentPost_id_enrollmentsCompleted(command));
    return result;
  }
}
module.exports = Post_id_enrollmentsHandler;
