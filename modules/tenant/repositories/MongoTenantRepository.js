const TenantRepository = require('./TenantRepository');
const Tenant = require('../models/Tenant');

class MongoTenantRepository extends TenantRepository {
  async findDefault() {
    return Tenant.findOne({ isDefault: true });
  }

  async findByCode(code) {
    return Tenant.findOne({ code });
  }

  async create(data) {
    return Tenant.create(data);
  }

  async update(id, data) {
    const tenant = await Tenant.findById(id);
    if (!tenant) return null;
    
    if (data.name != null) tenant.name = String(data.name).trim().slice(0, 120);
    if (data.contactEmail != null) tenant.contactEmail = String(data.contactEmail).slice(0, 120);
    if (data.contactPhone != null) tenant.contactPhone = String(data.contactPhone).slice(0, 40);
    if (data.maxBranches != null) tenant.maxBranches = Math.max(1, Number(data.maxBranches) || 50);
    if (data.notes != null) tenant.notes = String(data.notes).slice(0, 500);
    
    if (data.status && ['active', 'suspended', 'trial'].includes(data.status)) {
      if (tenant.isDefault && data.status === 'suspended') {
        const err = new Error('Khong the tam dung tenant mac dinh');
        err.status = 400;
        throw err;
      }
      tenant.status = data.status;
    }
    
    if (data.settings && typeof data.settings === 'object') {
      tenant.settings = { ...tenant.settings?.toObject?.() || tenant.settings || {}, ...data.settings };
    }
    
    await tenant.save();
    return tenant;
  }

  async findById(id) {
    return Tenant.findById(id).lean();
  }

  async findAll(status) {
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    return Tenant.find(filter).sort({ isDefault: -1, name: 1 }).lean();
  }
}

module.exports = MongoTenantRepository;
