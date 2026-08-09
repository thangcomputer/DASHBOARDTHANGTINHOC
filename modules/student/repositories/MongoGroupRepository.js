const GroupRepository = require('./GroupRepository');
const Group = require('../models/Group');

class MongoGroupRepository extends GroupRepository {
  constructor() {
    super(Group);
  }
}

module.exports = MongoGroupRepository;
