'use strict';
class CoursePublishedSpecification {
  isSatisfiedBy(course) {
    return course.status === 'PUBLISHED';
  }
}
module.exports = new CoursePublishedSpecification();
