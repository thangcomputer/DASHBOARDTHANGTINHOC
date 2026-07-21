/**
 * Multi-tenant service — Tenant bọc Branch, default tenant cho du lieu cu.
 */
const Tenant = require('../models/Tenant');
const Branch = require('../models/Branch');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const logger = require('../config/logger');

const DEFAULT_CODE = 'MAIN';

async function ensureDefaultTenant() {
  let tenant = await Tenant.findOne({ isDefault: true });
  if (!tenant) {
    tenant = await Tenant.findOne({ code: DEFAULT_CODE });
  }
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'To chuc mac dinh',
      code: DEFAULT_CODE,
      status: 'active',
      isDefault: true,
      notes: 'Tao tu dong — gan tat ca chi nhanh hien co',
    });
    logger.info({ tenantId: String(tenant._id) }, '[Tenant] created default tenant');
  }
  const orphan = await Branch.updateMany(
    { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] },
    { $set: { tenantId: tenant._id } },
  );
  if (orphan.modifiedCount > 0) {
    logger.info({ count: orphan.modifiedCount }, '[Tenant] assigned orphan branches to default');
  }
  return tenant;
}

async function listTenants({ status } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  const tenants = await Tenant.find(filter).sort({ isDefault: -1, name: 1 }).lean();
  const withCounts = await Promise.all(tenants.map(async (t) => {
    const branchCount = await Branch.countDocuments({ tenantId: t._id });
    return { ...t, branchCount };
  }));
  return withCounts;
}

async function getTenant(id) {
  const tenant = await Tenant.findById(id).lean();
  if (!tenant) {
    const err = new Error('Khong tim thay tenant');
    err.status = 404;
    throw err;
  }
  const branches = await Branch.find({ tenantId: id }).sort({ name: 1 }).lean();
  return { ...tenant, branches };
}

async function createTenant({ name, code, contactEmail, contactPhone, maxBranches, notes, settings }) {
  if (!name?.trim() || !code?.trim()) {
    const err = new Error('Thieu name hoac code');
    err.status = 400;
    throw err;
  }
  try {
    return await Tenant.create({
      name: name.trim().slice(0, 120),
      code: code.trim().toUpperCase().slice(0, 16),
      contactEmail: String(contactEmail || '').slice(0, 120),
      contactPhone: String(contactPhone || '').slice(0, 40),
      maxBranches: Math.max(1, Number(maxBranches) || 50),
      notes: String(notes || '').slice(0, 500),
      settings: settings || {},
      status: 'active',
      isDefault: false,
    });
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Ma tenant da ton tai');
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

async function updateTenant(id, patch) {
  const tenant = await Tenant.findById(id);
  if (!tenant) {
    const err = new Error('Khong tim thay tenant');
    err.status = 404;
    throw err;
  }
  if (patch.name != null) tenant.name = String(patch.name).trim().slice(0, 120);
  if (patch.contactEmail != null) tenant.contactEmail = String(patch.contactEmail).slice(0, 120);
  if (patch.contactPhone != null) tenant.contactPhone = String(patch.contactPhone).slice(0, 40);
  if (patch.maxBranches != null) tenant.maxBranches = Math.max(1, Number(patch.maxBranches) || 50);
  if (patch.notes != null) tenant.notes = String(patch.notes).slice(0, 500);
  if (patch.status && ['active', 'suspended', 'trial'].includes(patch.status)) {
    if (tenant.isDefault && patch.status === 'suspended') {
      const err = new Error('Khong the tam dung tenant mac dinh');
      err.status = 400;
      throw err;
    }
    tenant.status = patch.status;
  }
  if (patch.settings && typeof patch.settings === 'object') {
    tenant.settings = { ...tenant.settings?.toObject?.() || tenant.settings || {}, ...patch.settings };
  }
  await tenant.save();
  return tenant;
}

async function assignBranch(tenantId, branchId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const err = new Error('Khong tim thay tenant');
    err.status = 404;
    throw err;
  }
  if (tenant.status === 'suspended') {
    const err = new Error('Tenant dang bi tam dung');
    err.status = 400;
    throw err;
  }
  const count = await Branch.countDocuments({ tenantId });
  if (count >= (tenant.maxBranches || 50)) {
    const err = new Error('Vuot gioi han chi nhanh cua tenant');
    err.status = 400;
    throw err;
  }
  const branch = await Branch.findByIdAndUpdate(
    branchId,
    { tenantId },
    { new: true },
  );
  if (!branch) {
    const err = new Error('Khong tim thay chi nhanh');
    err.status = 404;
    throw err;
  }
  return branch;
}

async function getTenantStats(tenantId) {
  const branches = await Branch.find({ tenantId }).select('_id code name').lean();
  const ids = branches.map((b) => b._id);
  if (!ids.length) {
    return {
      branchCount: 0,
      students: 0,
      teachers: 0,
      schedules: 0,
      branches: [],
    };
  }
  const [students, teachers, schedules] = await Promise.all([
    Student.countDocuments({ branchId: { $in: ids } }),
    Teacher.countDocuments({ branchId: { $in: ids }, role: 'teacher' }),
    Schedule.countDocuments({ branchId: { $in: ids } }),
  ]);
  return {
    branchCount: branches.length,
    students,
    teachers,
    schedules,
    branches,
  };
}

async function resolveBranchIdsForTenant(tenantId) {
  const branches = await Branch.find({ tenantId, isActive: { $ne: false } }).select('_id').lean();
  return branches.map((b) => b._id);
}

module.exports = {
  DEFAULT_CODE,
  ensureDefaultTenant,
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  assignBranch,
  getTenantStats,
  resolveBranchIdsForTenant,
};