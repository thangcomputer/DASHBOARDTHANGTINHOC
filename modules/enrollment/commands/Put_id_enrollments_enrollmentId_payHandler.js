'use strict';
const enrollmentApplicationService = require('../../services/EnrollmentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const EnrollmentPut_id_enrollments_enrollmentId_payCompleted = require('../events/EnrollmentPut_id_enrollments_enrollmentId_payCompleted');

class Put_id_enrollments_enrollmentId_payHandler {
  async execute(command) {
    const result = await enrollmentApplicationService.put_id_enrollments_enrollmentId_pay(command);
    await eventBus.publish(new EnrollmentPut_id_enrollments_enrollmentId_payCompleted(command));
    return result;
  }
}
module.exports = Put_id_enrollments_enrollmentId_payHandler;
