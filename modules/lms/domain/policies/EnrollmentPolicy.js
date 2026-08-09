'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');
const coursePublishedSpec = require('../specifications/CoursePublishedSpecification');

class EnrollmentPolicy {
  static async check(studentId, course, enrollmentRepo) {
    if (!coursePublishedSpec.isSatisfiedBy(course)) {
      throw new AppError('CourseNotPublished', 'Cannot enroll in an unpublished course.');
    }
    if (course.enrolledCount >= course.capacity) {
      throw new AppError('CourseFull', 'Course capacity has been reached.');
    }
    const existing = await enrollmentRepo.findByStudentAndCourse(studentId, course.id);
    if (existing) {
      throw new AppError('DuplicateEnrollment', 'Student cannot enroll twice in the same course.');
    }
    return true;
  }
}
module.exports = EnrollmentPolicy;
