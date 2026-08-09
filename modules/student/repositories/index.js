const MongoStudentRepository = require('./MongoStudentRepository');
const MongoGroupRepository = require('./MongoGroupRepository');

module.exports = {
  studentRepository: new MongoStudentRepository(),
  groupRepository: new MongoGroupRepository(),
};
