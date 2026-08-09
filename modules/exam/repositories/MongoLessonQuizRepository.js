const LessonQuizRepository = require('./LessonQuizRepository');
const LessonQuiz = require('../models/LessonQuiz');

class MongoLessonQuizRepository extends LessonQuizRepository {
  constructor() {
    super(LessonQuiz);
  }
}

module.exports = MongoLessonQuizRepository;
