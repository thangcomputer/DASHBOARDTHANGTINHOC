const fs = require('fs');
const path = require('path');

const branchDir = path.join(__dirname, 'modules/branch');
const controllersDir = path.join(branchDir, 'controllers');
const servicesDir = path.join(branchDir, 'services');
if (!fs.existsSync(controllersDir)) fs.mkdirSync(controllersDir, { recursive: true });
if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

// 1. BranchApplicationService.js
const branchServiceCode = `
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
        const e = new Error(\`\${field} đã tồn tại\`);
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
`;
fs.writeFileSync(path.join(servicesDir, 'BranchApplicationService.js'), branchServiceCode);


// 2. BranchController.js
const branchControllerCode = `
const branchService = require('../services/BranchApplicationService');

class BranchController {
  async getAllBranches(req, res) {
    try {
      const branches = await branchService.getAllBranches();
      return res.json({ success: true, count: branches.length, data: branches });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async createBranch(req, res) {
    try {
      const branch = await branchService.createBranch({
        ...req.body,
        headerTenantId: req.headers['x-tenant-id']
      });
      return res.status(201).json({ success: true, message: \`Đã thêm chi nhánh: \${branch.name}\`, data: branch });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async updateBranch(req, res) {
    try {
      const updated = await branchService.updateBranch(req.params.id, req.body || {});
      return res.json({ success: true, message: 'Đã cập nhật chi nhánh', data: updated });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async deleteBranch(req, res) {
    try {
      const deleted = await branchService.deleteBranch(req.params.id);
      return res.json({ success: true, message: \`Đã xóa chi nhánh: \${deleted.name}\` });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new BranchController();
`;
fs.writeFileSync(path.join(controllersDir, 'BranchController.js'), branchControllerCode);

// 3. branchRoutes.js
const routesCode = fs.readFileSync(path.join(branchDir, 'branchRoutes.js'), 'utf8');
fs.writeFileSync(path.join(branchDir, 'branchRoutes.js'), routesCode.replace(/branchController/g, 'controllers/BranchController'));
fs.unlinkSync(path.join(branchDir, 'branchController.js'));

console.log('Branch extracted successfully.');
