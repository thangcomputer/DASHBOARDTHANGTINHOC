const ExamResultRepository = require('./ExamResultRepository');
const ExamResult = require('../models/ExamResult');

class MongoExamResultRepository extends ExamResultRepository {
  constructor() {
    super(ExamResult);
  }
}

module.exports = MongoExamResultRepository;
