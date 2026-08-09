const EmployeeRepository = require('./EmployeeRepository');
const Employee = require('../models/Employee');

class MongoEmployeeRepository extends EmployeeRepository {
  async findById(id) {
    return Employee.findById(id).lean();
  }

  async findActive(filter, limit = 0) {
    let q = Employee.find(filter).sort({ createdAt: -1 }).lean();
    if (limit > 0) q = q.limit(limit);
    return q;
  }

  async count(filter) {
    return Employee.countDocuments(filter);
  }

  async aggregate(pipeline) {
    return Employee.aggregate(pipeline);
  }

  async create(data) {
    return Employee.create(data);
  }

  async update(id, updates) {
    return Employee.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true });
  }

  async delete(id) {
    return Employee.findByIdAndDelete(id);
  }
}

module.exports = MongoEmployeeRepository;
