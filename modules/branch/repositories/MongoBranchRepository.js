const BranchRepository = require('./BranchRepository');
const Branch = require('../models/Branch');

class MongoBranchRepository extends BranchRepository {
  async findAllActive() {
    return Branch.find({ isActive: { $ne: false } }).sort({ createdAt: -1 }).lean();
  }

  async create(data) {
    return Branch.create(data);
  }

  async update(id, data) {
    return Branch.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
  }

  async delete(id) {
    return Branch.findByIdAndDelete(id);
  }

  async findById(id) {
    return Branch.findById(id).lean();
  }

  async findByTenantId(tenantId) {
    return Branch.find({ tenantId }).sort({ name: 1 }).lean();
  }
  
  async findActiveByTenantId(tenantId) {
    return Branch.find({ tenantId, isActive: { $ne: false } }).select('_id code name').lean();
  }

  async countByTenantId(tenantId) {
    return Branch.countDocuments({ tenantId });
  }

  async assignTenantToOrphans(tenantId) {
    return Branch.updateMany(
      { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] },
      { $set: { tenantId } }
    );
  }

  async updateTenantId(branchId, tenantId) {
    return Branch.findByIdAndUpdate(
      branchId,
      { tenantId },
      { returnDocument: 'after' }
    );
  }
  
  async findAllSimple() {
    return Branch.find().select('name code tenantId isActive').sort({ name: 1 }).lean();
  }
}

module.exports = MongoBranchRepository;
