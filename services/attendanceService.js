/**
 * Attendance lifecycle (Phase 8) — điểm danh trên Schedule.
 * present|late → status completed (tính buổi / payroll)
 * absent|excused → status no_show
 */
const Schedule = require('../models/Schedule');
const ScheduleHistory = require('../models/ScheduleHistory');
const { writeAudit } = require('./auditLogService');
const NotificationService = require('./NotificationService');
const logger = require('../config/logger');

const ATTENDANCE_STATUSES = Object.freeze(['present', 'absent', 'late', 'excused']);

const TRANSITIONS = Object.freeze({
  null: ['present', 'absent', 'late', 'excused'],
  present: ['absent', 'late', 'excused', 'present'],
  absent: ['present', 'late', 'excused', 'absent'],
  late: ['present', 'absent', 'excused', 'late'],
  excused: ['present', 'absent', 'late', 'excused'],
});

function scheduleStatusFromAttendance(attendanceStatus) {
  if (attendanceStatus === 'present' || attendanceStatus === 'late') return 'completed';
  if (attendanceStatus === 'absent' || attendanceStatus === 'excused') return 'no_show';
  return null;
}

function isValidAttendanceStatus(status) {
  return ATTENDANCE_STATUSES.includes(String(status || ''));
}

function canTransitionAttendance(from, to) {
  const f = from == null || from === '' ? 'null' : String(from);
  const t = String(to || '');
  const allowed = TRANSITIONS[f];
  if (!allowed) return false;
  return allowed.includes(t);
}

function assertAttendanceTransition(from, to) {
  if (!isValidAttendanceStatus(to)) {
    const err = new Error(`Trạng thái điểm danh không hợp lệ: ${to}`);
    err.status = 400;
    throw err;
  }
  if (!canTransitionAttendance(from, to)) {
    const err = new Error(`Không thể đổi điểm danh từ "${from || 'chưa điểm danh'}" sang "${to}"`);
    err.status = 400;
    throw err;
  }
}

function isPayableAttendance(attendanceStatus) {
  return attendanceStatus === 'present' || attendanceStatus === 'late';
}

/**
 * Đánh dấu / sửa điểm danh 1 buổi.
 */
async function markAttendance({
  scheduleId,
  attendanceStatus,
  note = '',
  actor = {},
  io = null,
  reqMeta = {},
  checkAndUnlockExam = null,
}) {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    const err = new Error('Không tìm thấy lịch học');
    err.status = 404;
    throw err;
  }
  if (schedule.status === 'cancelled') {
    const err = new Error('Không thể điểm danh buổi đã hủy');
    err.status = 400;
    throw err;
  }

  const prevAtt = schedule.attendanceStatus || null;
  const prevStatus = schedule.status;
  assertAttendanceTransition(prevAtt, attendanceStatus);

  const nextScheduleStatus = scheduleStatusFromAttendance(attendanceStatus);
  const oldValue = {
    status: prevStatus,
    attendanceStatus: prevAtt,
  };

  schedule.attendanceStatus = attendanceStatus;
  schedule.status = nextScheduleStatus;
  schedule.attendanceMarkedAt = new Date();
  if (actor.id && String(actor.id).match(/^[a-f\d]{24}$/i)) {
    schedule.attendanceMarkedBy = actor.id;
  }
  if (note != null) schedule.attendanceNote = String(note).slice(0, 500);
  await schedule.save();

  const isCorrection = prevAtt != null && prevAtt !== attendanceStatus;

  try {
    await ScheduleHistory.create({
      scheduleId: schedule._id,
      actorId: actor.id && String(actor.id).match(/^[a-f\d]{24}$/i) ? actor.id : schedule.teacherId,
      actorName: String(actor.id || actor.role || 'system'),
      actorRole: ['teacher', 'admin', 'staff', 'system'].includes(actor.role) ? actor.role : 'admin',
      action: isCorrection ? 'UPDATED' : 'COMPLETED',
      reason: note || (isCorrection ? 'Sửa điểm danh' : 'Điểm danh'),
      oldValue,
      newValue: {
        status: schedule.status,
        attendanceStatus: schedule.attendanceStatus,
      },
      studentName: schedule.studentName,
      teacherName: schedule.teacherName,
      scheduledDate: schedule.date,
      course: schedule.course,
    });
  } catch (err) {
    logger.warn('[attendance] ScheduleHistory: %s', err.message);
  }

  try {
    await writeAudit({
      action: isCorrection ? 'attendance.correct' : 'attendance.mark',
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || schedule.branchId || null,
      entityType: 'schedule',
      entityId: String(schedule._id),
      studentId: schedule.studentId || null,
      teacherId: schedule.teacherId || null,
      sessionId: schedule._id,
      oldValue,
      newValue: {
        status: schedule.status,
        attendanceStatus: schedule.attendanceStatus,
        payable: isPayableAttendance(attendanceStatus),
      },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[attendance] audit: %s', err.message);
  }

  const notifDate = new Date(schedule.date).toLocaleDateString('vi-VN');
  if (io && schedule.studentId) {
    try {
      const labels = {
        present: 'Có mặt',
        absent: 'Vắng',
        late: 'Đi muộn',
        excused: 'Có phép',
      };
      const label = labels[attendanceStatus] || attendanceStatus;
      await NotificationService.send(io, {
        type: 'SCHEDULE',
        title: isCorrection ? '📝 Điểm danh đã được sửa' : '✅ Hệ thống đã điểm danh',
        content: isCorrection
          ? `Buổi ${notifDate}: điểm danh đổi thành "${label}".`
          : `Giảng viên đã điểm danh buổi học ngày ${notifDate}: ${label}.`,
        receivers: [String(schedule.studentId)],
        eventId: `attendance:${schedule._id}:${attendanceStatus}:${isCorrection ? 'fix' : 'mark'}`,
        link: '/student#schedule',
        channels: ['in_app', 'socket'],
        payload: {
          scheduleId: String(schedule._id),
          attendanceStatus,
          corrected: isCorrection,
        },
      });
    } catch (err) {
      logger.warn('[attendance] notify: %s', err.message);
    }
  }

  if (
    schedule.studentId
    && isPayableAttendance(attendanceStatus)
    && typeof checkAndUnlockExam === 'function'
  ) {
    await checkAndUnlockExam(String(schedule.studentId), io, schedule.course);
  }

  return {
    schedule,
    previous: oldValue,
    isCorrection,
    payable: isPayableAttendance(attendanceStatus),
  };
}

/**
 * Buổi scheduled đã qua giờ kết thúc nhưng chưa điểm danh.
 */
async function findMissedAttendanceSessions(now = new Date(), { limit = 100 } = {}) {
  const startOfYesterday = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const sessions = await Schedule.find({
    status: 'scheduled',
    date: { $gte: startOfYesterday, $lte: now },
    $or: [
      { attendanceStatus: null },
      { attendanceStatus: { $exists: false } },
    ],
  })
    .sort({ date: 1, startTime: 1 })
    .limit(limit)
    .lean();

  const missed = [];
  for (const s of sessions) {
    const endMins = parseEndMinutes(s);
    if (endMins == null) continue;
    const sessionEnd = combineDateAndMinutes(s.date, endMins);
    if (sessionEnd && sessionEnd < now) {
      missed.push(s);
    }
  }
  return missed;
}

function parseEndMinutes(schedule) {
  const raw = schedule.endTime || schedule.startTime;
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  // nếu chỉ có startTime, mặc định +90'
  if (!schedule.endTime && schedule.startTime) mins += 90;
  return mins;
}

function combineDateAndMinutes(date, mins) {
  if (!date) return null;
  const d = new Date(date);
  const base = new Date(d);
  base.setHours(0, 0, 0, 0);
  // date lưu có thể đã có giờ — dùng UTC date parts + local offset nhẹ: lấy Y-M-D từ ISO VN
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  return new Date(y, mo, day, Math.floor(mins / 60), mins % 60, 0, 0);
}

/**
 * Gửi notify thiếu điểm danh cho GV (idempotent theo ngày + schedule).
 */
async function notifyMissedAttendance(io, now = new Date()) {
  const missed = await findMissedAttendanceSessions(now);
  let notified = 0;
  const dateKey = now.toISOString().slice(0, 10);

  for (const s of missed) {
    if (!s.teacherId) continue;
    try {
      await NotificationService.send(io, {
        type: 'SCHEDULE',
        title: '⚠️ Thiếu điểm danh',
        content: `Buổi ${s.course || ''} của ${s.studentName || 'HV'} ngày ${new Date(s.date).toLocaleDateString('vi-VN')} ${s.startTime || ''} chưa được điểm danh.`,
        receivers: [String(s.teacherId)],
        eventId: `attendance.missing:${dateKey}:${s._id}`,
        link: '/teacher#schedule',
        channels: ['in_app', 'socket'],
        payload: { scheduleId: String(s._id), studentId: s.studentId },
        priority: 'high',
      });
      notified += 1;
    } catch (err) {
      logger.warn('[attendance] missed notify: %s', err.message);
    }
  }

  return { missed: missed.length, notified, dateKey };
}

module.exports = {
  ATTENDANCE_STATUSES,
  TRANSITIONS,
  scheduleStatusFromAttendance,
  isValidAttendanceStatus,
  canTransitionAttendance,
  assertAttendanceTransition,
  isPayableAttendance,
  markAttendance,
  findMissedAttendanceSessions,
  notifyMissedAttendance,
  parseEndMinutes,
  combineDateAndMinutes,
};
