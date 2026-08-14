'use strict';

/**
 * Nhật ký HV phía GV: điểm danh / hủy điểm danh / hủy ca.
 * Lưu trên Student.activityLog (không tính vào completedSessions).
 */

function extractSessionNumber(note, fallback) {
  const m = /buổi\s*(\d+)/i.exec(String(note || ''));
  if (m) return Number(m[1]);
  const n = Number(fallback);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildActivityEntry({
  type,
  date,
  note,
  sessionNumber,
  actor,
  scheduleId,
  course,
} = {}) {
  return {
    type: String(type || 'attendance'),
    date: date || new Date().toLocaleDateString('vi-VN'),
    note: String(note || '').slice(0, 500),
    sessionNumber: sessionNumber != null ? Number(sessionNumber) : undefined,
    at: new Date(),
    byId: actor?.id || actor?._id ? String(actor.id || actor._id) : '',
    byName: actor?.name ? String(actor.name) : '',
    scheduleId: scheduleId ? String(scheduleId) : undefined,
    course: course ? String(course) : undefined,
  };
}

module.exports = {
  extractSessionNumber,
  buildActivityEntry,
};
