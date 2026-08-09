'use strict';
const enrollmentApplicationService = require('../../services/EnrollmentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const EnrollmentDelete_id_enrollments_enrollmentIdCompleted = require('../events/EnrollmentDelete_id_enrollments_enrollmentIdCompleted');

class Delete_id_enrollments_enrollmentIdHandler {
  async execute(command) {
    const result = await enrollmentApplicationService.delete_id_enrollments_enrollmentId(command);
    await eventBus.publish(new EnrollmentDelete_id_enrollments_enrollmentIdCompleted(command));
    return result;
  }
}
module.exports = Delete_id_enrollments_enrollmentIdHandler;
