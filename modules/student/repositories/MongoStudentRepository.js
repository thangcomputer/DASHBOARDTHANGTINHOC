const StudentRepository = require('./StudentRepository');
const Student = require('../models/Student');

class MongoStudentRepository extends StudentRepository {
  constructor() {
    super(Student);
  }

  async insertMany(docs, options = {}) {
    return this.model.insertMany(docs, options);
  }
}

module.exports = MongoStudentRepository;
