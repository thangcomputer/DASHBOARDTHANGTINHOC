const EvaluationRepository = require('./EvaluationRepository');
const Evaluation = require('../models/Evaluation');

class MongoEvaluationRepository extends EvaluationRepository {
  constructor() {
    super(Evaluation);
  }
}

module.exports = MongoEvaluationRepository;
