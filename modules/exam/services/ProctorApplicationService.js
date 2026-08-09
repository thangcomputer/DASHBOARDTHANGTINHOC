'use strict';
const proctorAudit = require('./proctorAuditService');

/**
 * POST /api/proctor/events — thí sinh/GV gửi batch sự kiện giám sát (JWT).
 * Không nhận video/frame.
 */

class ProctorApplicationService {
  async post_events(data) {
  try {
    const events = data.body?.events;
    if (!Array.isArray(events)) {
      return { _status: 400, _body: ({ success: false, message: 'events phải là mảng' });
    }
    const result = await proctorAudit.ingestEvents({
      user: data.currentUser,
      events,
      ip: data.ip,
      userAgent: data.get('user-agent'),
      tenantId: data.tenantId || data.currentUser?.tenantId,
    });
    return { _status: 200, _body: ({ success: true, data: result });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message || 'Lỗi ghi audit' });
  }
}

  async get_events_me(data) {
  try {
    const limit = parseInt(data.limit, 10) || 50;
    const data = await proctorAudit.listEventsForUser(data.currentUser.id, { limit });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_events_userId(data) {
  try {
    const limit = parseInt(data.limit, 10) || 100;
    const data = await proctorAudit.listEventsForUser(data.userId, { limit });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

}

module.exports = new ProctorApplicationService();
