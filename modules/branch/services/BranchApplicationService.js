
const branchRepository = require('../repositories');
const { teacherRepository } = require('../../teacher/repositories');
const { studentRepository } = require('../../student/repositories');
const tenantService = require('../../tenant/services/TenantApplicationService');

class BranchApplicationService {
  async getAllBranches() {
    return await branchRepository.findAllActive();
  }

  async createBranch({ name, code, address, phone, tenantId, headerTenantId }) {
    if (!name || !code) {
      const err = new Error('Thiếu tên hoặc mã chi nhánh');
      err.status = 400;
      throw err;
    }

    let tid = tenantId || headerTenantId || null;
    if (!tid) {
      const def = await tenantService.ensureDefaultTenant();
      tid = def._id;
    }

    try {
      const branch = await branchRepository.create({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address || '',
        phone: phone || '',
        tenantId: tid,
      });
      return branch;
    } catch (err) {
      if (err.code === 11000) {
        const field = err.keyValue?.code ? 'Mã chi nhánh' : 'Tên chi nhánh';
        const e = new Error(`${field} đã tồn tại`);
        e.status = 409;
        throw e;
      }
      throw err;
    }
  }

  async updateBranch(id, data) {
    const updates = {};
    const allowed = ['name', 'code', 'address', 'phone', 'isActive'];
    allowed.forEach(f => { if (data[f] !== undefined) updates[f] = data[f]; });

    const updated = await branchRepository.update(id, updates);
    if (!updated) {
      const err = new Error('Không tìm thấy chi nhánh');
      err.status = 404;
      throw err;
    }
    return updated;
  }

  async deleteBranch(id) {
    const deleted = await branchRepository.delete(id);
    if (!deleted) {
      const err = new Error('Không tìm thấy chi nhánh');
      err.status = 404;
      throw err;
    }

    await teacherRepository.updateMany({ branchId: id }, { branchId: null, branchCode: '' });
    await studentRepository.updateMany({ branchId: id }, { branchId: null, branchCode: '' });

    return deleted;
  }
}

module.exports = new BranchApplicationService();
