const TrainingCourseRepository = require('./TrainingCourseRepository');
const TrainingCourse = require('../models/TrainingCourse');

class MongoTrainingCourseRepository extends TrainingCourseRepository {
  constructor() {
    super(TrainingCourse);
  }
}

module.exports = MongoTrainingCourseRepository;
