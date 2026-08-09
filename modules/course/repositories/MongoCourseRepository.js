const CourseRepository = require('./CourseRepository');
const Course = require('../models/Course');

class MongoCourseRepository extends CourseRepository {
  constructor() {
    super(Course);
  }
}

module.exports = MongoCourseRepository;
