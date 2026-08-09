'use strict';
const { systemLogRepository } = require('./../repositories');
const SystemLog = require('./../models/SystemLog'); // Temp for new SystemLog // Temp for new SystemLog

const {
  SYSTEM_LOG_VISIBLE_ACTIONS,
  isVisibleSystemLogAction,
} = require('../../../constants/systemLogActions');
// GET /api/system-logs — chỉ các hành động trong allowlist

class SystemLogApplicationService {
  async get_root(data) {
  try {
    const page = Math.max(1, parseInt(data.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(data.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = { action: { $in: SYSTEM_LOG_VISIBLE_ACTIONS } };

    const [totalLogs, logs] = await Promise.all([
      systemLogRepository.count(filter),
      systemLogRepository.findMany(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { _status: 200, _body: ({
      success: true,
      data: logs,
      pagination: {
        total: totalLogs,
        page,
        pages: Math.ceil(totalLogs / limit) || 1,
      },
    });
  } catch (error) {
    return { _status: 500, _body: ({ success: false, message: 'Lỗi khi lấy System Logs: ' + error.message });
  }
}

  async post_root(data) {
  try {
    const action = String(data.body?.action || '').trim();
    if (!isVisibleSystemLogAction(action)) {
      return { _status: 400, _body: ({
        success: false,
        message: 'Hành động không thuộc nhật ký hệ thống được phép ghi',
      });
    }

    const amount = Number(data.body?.amount);
    const log = await systemLogRepository.create({
      user_id: String(data.currentUser?.id || data.currentUser?._id || 'admin'),
      name: String(data.currentUser?.name || 'Admin'),
      role: String(data.currentUser?.role || 'admin'),
      adminRole: data.currentUser?.adminRole || null,
      branchCode: data.currentUser?.branchCode || '',
      action,
      category: String(data.body?.category || 'finance'),
      target: String(data.body?.target || 'client-export'),
      method: 'POST',
      message: String(data.body?.message || action).slice(0, 500),
      amount: Number.isFinite(amount) && amount !== 0 ? amount : 0,
      ip: data.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || data.ip
        || 'unknown',
      device: '',
      userAgent: String(data.headers['user-agent'] || '').slice(0, 500),
    });

    return { _status: 201, _body: ({ success: true, data: log });
  } catch (error) {
    return { _status: 500, _body: ({ success: false, message: error.message });
  }
}

  async delete_id(data) {
  try {
    const deleted = await systemLogRepository.deleteById(data.id);
    if (!deleted) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy nhật ký' });
    }
    return { _status: 200, _body: ({ success: true, message: 'Đã xóa nhật ký' });
  } catch (error) {
    return { _status: 500, _body: ({ success: false, message: error.message });
  }
}

}

module.exports = new SystemLogApplicationService();
