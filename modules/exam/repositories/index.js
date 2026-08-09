const MongoEvaluationRepository = require('./MongoEvaluationRepository');
const MongoExamResultRepository = require('./MongoExamResultRepository');
const MongoLessonQuizRepository = require('./MongoLessonQuizRepository');
const MongoProctorEventRepository = require('./MongoProctorEventRepository');

module.exports = {
  evaluationRepository: new MongoEvaluationRepository(),
  examResultRepository: new MongoExamResultRepository(),
  lessonQuizRepository: new MongoLessonQuizRepository(),
  proctorEventRepository: new MongoProctorEventRepository(),
};
