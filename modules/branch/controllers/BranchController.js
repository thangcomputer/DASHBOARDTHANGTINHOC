
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
      return res.status(201).json({ success: true, message: `Đã thêm chi nhánh: ${branch.name}`, data: branch });
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
      return res.json({ success: true, message: `Đã xóa chi nhánh: ${deleted.name}` });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new BranchController();
