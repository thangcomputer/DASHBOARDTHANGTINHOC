class EmployeeRepository {
  async findById(id) { throw new Error('Not implemented'); }
  async findActive(filter, limit) { throw new Error('Not implemented'); }
  async count(filter) { throw new Error('Not implemented'); }
  async aggregate(pipeline) { throw new Error('Not implemented'); }
  async create(data) { throw new Error('Not implemented'); }
  async update(id, updates) { throw new Error('Not implemented'); }
  async delete(id) { throw new Error('Not implemented'); }
}

module.exports = EmployeeRepository;
