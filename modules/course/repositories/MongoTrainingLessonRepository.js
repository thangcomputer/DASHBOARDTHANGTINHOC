const TrainingLessonRepository = require('./TrainingLessonRepository');
const TrainingLesson = require('../models/TrainingLesson');

class MongoTrainingLessonRepository extends TrainingLessonRepository {
  constructor() {
    super(TrainingLesson);
  }
}

module.exports = MongoTrainingLessonRepository;
