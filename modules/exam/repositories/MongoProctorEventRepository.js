const ProctorEventRepository = require('./ProctorEventRepository');
const ProctorEvent = require('../models/ProctorEvent');

class MongoProctorEventRepository extends ProctorEventRepository {
  constructor() {
    super(ProctorEvent);
  }
}

module.exports = MongoProctorEventRepository;
