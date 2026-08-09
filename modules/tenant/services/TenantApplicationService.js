/**
 * Multi-tenant service — Tenant bọc Branch, default tenant cho du lieu cu.
 */
const tenantRepository = require('../repositories');
const branchRepository = require('../../branch/repositories');
const Student = require('../../student/models/Student');
const Teacher = require('../../teacher/models/Teacher');
const Schedule = require('../../attendance/models/Schedule');
const logger = require('../../../config/logger');

const DEFAULT_CODE = 'MAIN';

async function ensureDefaultTenant() {
  let tenant = await tenantRepository.findDefault();
  if (!tenant) {
    tenant = await tenantRepository.findByCode(DEFAULT_CODE);
  }
  if (!tenant) {
    tenant = await tenantRepository.create({
      name: 'To chuc mac dinh',
      code: DEFAULT_CODE,
      status: 'active',
      isDefault: true,
      notes: 'Tao tu dong — gan tat ca chi nhanh hien co',
    });
    logger.info({ tenantId: String(tenant._id) }, '[Tenant] created default tenant');
  }
  const orphan = await branchRepository.assignTenantToOrphans(tenant._id);
  if (orphan.modifiedCount > 0) {
    logger.info({ count: orphan.modifiedCount }, '[Tenant] assigned orphan branches to default');
  }
  return tenant;
}

async function listTenants({ status } = {}) {
  const tenants = await tenantRepository.findAll(status);
  const withCounts = await Promise.all(tenants.map(async (t) => {
    const branchCount = await branchRepository.countByTenantId(t._id);
    return { ...t, branchCount };
  }));
  return withCounts;
}

async function getTenant(id) {
  const tenant = await tenantRepository.findById(id);
  if (!tenant) {
    const err = new Error('Khong tim thay tenant');
    err.status = 404;
    throw err;
  }
  const branches = await branchRepository.findByTenantId(id);
  return { ...tenant, branches };
}

async function createTenant({ name, code, contactEmail, contactPhone, maxBranches, notes, settings }) {
  if (!name?.trim() || !code?.trim()) {
    const err = new Error('Thieu name hoac code');
    err.status = 400;
    throw err;
  }
  try {
    return await tenantRepository.create({
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
  const tenant = await tenantRepository.update(id, patch);
  if (!tenant) {
    const err = new Error('Khong tim thay tenant');
    err.status = 404;
    throw err;
  }
  return tenant;
}

async function assignBranch(tenantId, branchId) {
  const tenant = await tenantRepository.findById(tenantId);
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
  const count = await branchRepository.countByTenantId(tenantId);
  if (count >= (tenant.maxBranches || 50)) {
    const err = new Error('Vuot gioi han chi nhanh cua tenant');
    err.status = 400;
    throw err;
  }
  const branch = await branchRepository.updateTenantId(branchId, tenantId);
  if (!branch) {
    const err = new Error('Khong tim thay chi nhanh');
    err.status = 404;
    throw err;
  }
  return branch;
}

async function getTenantStats(tenantId) {
  const branches = await branchRepository.findActiveByTenantId(tenantId);
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
  const branches = await branchRepository.findActiveByTenantId(tenantId);
  return branches.map((b) => b._id);
}

async function getBranches() {
  return await branchRepository.findAllSimple();
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
  getBranches,
};
