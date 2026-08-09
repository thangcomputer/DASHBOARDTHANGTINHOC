const MongoScheduleRepository = require('./MongoScheduleRepository');
const MongoScheduleHistoryRepository = require('./MongoScheduleHistoryRepository');

module.exports = {
  scheduleRepository: new MongoScheduleRepository(),
  scheduleHistoryRepository: new MongoScheduleHistoryRepository(),
};
