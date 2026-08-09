const TeachingGuideRepository = require('./TeachingGuideRepository');
const TeachingGuide = require('../models/TeachingGuide');

class MongoTeachingGuideRepository extends TeachingGuideRepository {
  constructor() {
    super(TeachingGuide);
  }
}

module.exports = MongoTeachingGuideRepository;
