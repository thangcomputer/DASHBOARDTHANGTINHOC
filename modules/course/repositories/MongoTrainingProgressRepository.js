const TrainingProgressRepository = require('./TrainingProgressRepository');
const TrainingProgress = require('../models/TrainingProgress');

class MongoTrainingProgressRepository extends TrainingProgressRepository {
  constructor() {
    super(TrainingProgress);
  }
}

module.exports = MongoTrainingProgressRepository;
