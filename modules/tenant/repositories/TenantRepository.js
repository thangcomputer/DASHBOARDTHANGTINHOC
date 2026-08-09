class TenantRepository {
  async findDefault() { throw new Error('Not implemented'); }
  async create(data) { throw new Error('Not implemented'); }
  async update(id, data) { throw new Error('Not implemented'); }
  async findById(id) { throw new Error('Not implemented'); }
  async findAll(status) { throw new Error('Not implemented'); }
  async findByCode(code) { throw new Error('Not implemented'); }
}

module.exports = TenantRepository;
