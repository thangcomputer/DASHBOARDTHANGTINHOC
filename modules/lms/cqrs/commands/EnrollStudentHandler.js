'use strict';
const Enrollment = require('../../models/Enrollment');
const EnrollmentPolicy = require('../../domain/policies/EnrollmentPolicy');

class EnrollStudentHandler {
  constructor(courseRepo, enrollmentRepo, eventBus, outbox) {
    this.courseRepo = courseRepo;
    this.enrollmentRepo = enrollmentRepo;
    this.eventBus = eventBus;
    this.outbox = outbox;
  }
  
  async handle(command) {
    const { studentId, courseId, tenantId, branchId, traceId } = command;
    
    const course = await this.courseRepo.findById(courseId);
    if (!course) throw new Error('NotFound');
    
    // Policy Check
    await EnrollmentPolicy.check(studentId, course, this.enrollmentRepo);
    
    const enrollment = new Enrollment({
      studentId, courseId, tenantId, branchId, status: 'PENDING', paymentStatus: 'UNPAID'
    });
    
    const event = {
      type: 'StudentEnrolled',
      aggregateId: enrollment.id,
      payload: { studentId, courseId, tenantId, branchId },
      traceId,
      occurredAt: new Date()
    };
    
    await this.enrollmentRepo.save(enrollment);
    await this.outbox.saveEvent(event);
    await this.eventBus.publish(event);
    
    return { success: true, enrollmentId: enrollment.id };
  }
}
module.exports = EnrollStudentHandler;
