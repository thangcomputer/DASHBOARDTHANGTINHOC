'use strict';
const enrollmentApplicationService = require('../../services/EnrollmentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const EnrollmentPut_id_enrollments_enrollmentId_settingsCompleted = require('../events/EnrollmentPut_id_enrollments_enrollmentId_settingsCompleted');

class Put_id_enrollments_enrollmentId_settingsHandler {
  async execute(command) {
    const result = await enrollmentApplicationService.put_id_enrollments_enrollmentId_settings(command);
    await eventBus.publish(new EnrollmentPut_id_enrollments_enrollmentId_settingsCompleted(command));
    return result;
  }
}
module.exports = Put_id_enrollments_enrollmentId_settingsHandler;
