'use strict';
const employeeRepository = require('./../../auth/repositories');
const PayrollLog = require('./../../finance/models/PayrollLog');

/**
 * employeeRoutes.js — CRUD Nhân sự + Trả lương
 * Branch-aware: STAFF chỉ thấy nhân viên chi nhánh mình
 */
const router     = express.Router();
function emitEmployeesChanged(req, action = 'update') {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('employees:updated', { action });
  io.emit('data:refresh', { type: 'employees', action });
}
// ─── GET /api/employees ─────────────────────────────────────────────────────────
// Danh sách nhân sự (branch-aware)

class EmployeeApplicationService {
  async get_root(data) {
  try {
    const filter = { ...data.branchFilter };
    if (data.position && data.position !== 'all') filter.position = data.position;
    if (data.status && data.status !== 'all')     filter.status   = data.status;
    if (data.search) {
      // Escape ký tự đặc biệt regex → chống ReDoS / injection
      const safeSearch = String(data.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      filter.$or = [
        { name:  { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const employees = await employeeRepository.findActive(filter);
    return { _status: 200, _body: ({ success: true, data: employees });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_stats(data) {
  try {
    const bf = { ...data.branchFilter };
    const total  = await employeeRepository.count({ ...bf, status: 'active' });
    const salaryResult = await employeeRepository.aggregate([
      { $match: { ...bf, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$baseSalary' } } },
    ]);
    const totalSalary = salaryResult[0]?.total || 0;

    // Tổng đã trả trong tháng hiện tại
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const startOfMonth = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), 1) - 7 * 60 * 60 * 1000);
    const paidFilter = { ...bf, payDate: { $gte: startOfMonth }, salaryType: 'LUONG_CUNG' };
    const paidResult = await PayrollLog.aggregate([
      { $match: paidFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const paidThisMonth = paidResult[0]?.total || 0;

    // Phân bổ theo chức vụ
    const byPosition = await employeeRepository.aggregate([
      { $match: { ...bf, status: 'active' } },
      { $group: { _id: '$position', count: { $sum: 1 }, salary: { $sum: '$baseSalary' } } },
      { $sort: { count: -1 } },
    ]);

    return { _status: 200, _body: ({ success: true, data: { total, totalSalary, paidThisMonth, byPosition } });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_root(data) {
  try {
    const { name, phone, position, baseSalary, startDate, note, branchId, branchCode, linkedTeacherId, bankAccount } = data.body;
    if (!name) return { _status: 400, _body: ({ success: false, message: 'Tên nhân viên là bắt buộc' });

    // STAFF: auto-assign branch
    const finalBranchId   = data.userBranchId || branchId || '';
    const finalBranchCode = data.userBranchCode || branchCode || '';

    const employee = await employeeRepository.create({
      name, phone: phone || '', gender: data.gender || 'male',
      position: position || 'KHAC',
      baseSalary: Number(baseSalary) || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      note: note || '',
      branchId: finalBranchId,
      branchCode: finalBranchCode,
      linkedTeacherId: linkedTeacherId || null,
      bankAccount: bankAccount || { bankCode: '', accountNumber: '', accountName: '' }
    });

    emitEmployeesChanged(req, 'create');
    return { _status: 201, _body: ({ success: true, data: employee });
  } catch (err) {
    return { _status: 400, _body: ({ success: false, message: err.message });
  }
}

  async put_id(data) {
  try {
    // Branch guard
    if (data.userBranchId) {
      const emp = await employeeRepository.findById(data.id);
      if (emp && String(emp.branchId) !== String(data.userBranchId)) {
        return { _status: 403, _body: ({ success: false, message: 'Bạn không có quyền sửa nhân viên chi nhánh khác' });
      }
    }
    const updates = { ...data.body };
    if (updates.baseSalary !== undefined) updates.baseSalary = Number(updates.baseSalary);
    if (updates.startDate) updates.startDate = new Date(updates.startDate);

    const employee = await employeeRepository.update(data.id, updates);
    if (!employee) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy nhân viên' });
    emitEmployeesChanged(req, 'update');
    return { _status: 200, _body: ({ success: true, data: employee });
  } catch (err) {
    return { _status: 400, _body: ({ success: false, message: err.message });
  }
}

  async delete_id(data) {
  try {
    if (data.userBranchId) {
      const emp = await employeeRepository.findById(data.id);
      if (emp && String(emp.branchId) !== String(data.userBranchId)) {
        return { _status: 403, _body: ({ success: false, message: 'Không có quyền xóa nhân viên chi nhánh khác' });
      }
    }
    const employee = await employeeRepository.delete(data.id);
    if (!employee) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy nhân viên' });
    emitEmployeesChanged(req, 'delete');
    return { _status: 200, _body: ({ success: true, message: `Đã xóa nhân viên ${employee.name}` });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_id_pay(data) {
  try {
    const employee = await employeeRepository.findById(data.id);
    if (!employee) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy nhân viên' });

    // Branch guard
    if (data.userBranchId && String(employee.branchId) !== String(data.userBranchId)) {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền trả lương nhân viên chi nhánh khác' });
    }

    const { amount, note, payDate } = data.body;
    if (!amount || isNaN(amount)) return { _status: 400, _body: ({ success: false, message: 'Số tiền không hợp lệ' });

    const finalPayDate = payDate ? new Date(payDate) : new Date();

    const log = await PayrollLog.create({
      employeeId: employee._id,
      amount: Number(amount),
      note: note || `Trả lương cơ bản: ${employee.position}`,
      payDate: finalPayDate,
      salaryType: 'LUONG_CUNG',
      branchId: employee.branchId,
      branchCode: employee.branchCode
    });

    emitEmployeesChanged(req, 'pay');
    return { _status: 201, _body: ({ success: true, message: `Đã ghi nhận trả ${amount} cho ${employee.name}`, data: log });
  } catch (err) {
    return { _status: 400, _body: ({ success: false, message: err.message });
  }
}

  async get_id_payroll(data) {
  try {
    const employee = await employeeRepository.findById(data.id);
    if (!employee) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy nhân viên' });

    if (data.userBranchId && String(employee.branchId) !== String(data.userBranchId)) {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền xem chi nhánh khác' });
    }

    const logs = await PayrollLog.find({ employeeId: data.id }).sort({ payDate: -1 }).lean();
    return { _status: 200, _body: ({ success: true, data: logs });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

}

module.exports = new EmployeeApplicationService();
