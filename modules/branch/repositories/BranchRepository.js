class BranchRepository {
  async findAllActive() { throw new Error('Not implemented'); }
  async create(data) { throw new Error('Not implemented'); }
  async update(id, data) { throw new Error('Not implemented'); }
  async delete(id) { throw new Error('Not implemented'); }
  async findById(id) { throw new Error('Not implemented'); }
  async findByTenantId(tenantId) { throw new Error('Not implemented'); }
  async countByTenantId(tenantId) { throw new Error('Not implemented'); }
  async assignTenantToOrphans(tenantId) { throw new Error('Not implemented'); }
  async updateTenantId(branchId, tenantId) { throw new Error('Not implemented'); }
}

module.exports = BranchRepository;
