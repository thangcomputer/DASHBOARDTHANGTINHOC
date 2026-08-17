/**
 * Course-complete fireworks: show only after the scheduled session end time.
 * Socket emit targets both userId room and student_${id} room.
 */
const Schedule = require('../models/Schedule');

function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function addMinutesToTimeHHmm(time, addMins) {
  const mins = parseTimeToMinutes(time);
  if (mins == null) return '';
  const total = Math.min(mins + addMins, 23 * 60 + 59);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeScheduleDateKey(raw) {
  if (raw == null || raw === '') return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local Date of schedule slot end (date + endTime, fallback start+90'). */
function scheduleSlotEndDate(sch) {
  if (!sch) return null;
  const dateKey = normalizeScheduleDateKey(sch.date || sch.createdAt);
  if (!dateKey) return null;
  let endHHmm = String(sch.endTime || '').trim();
  if (!endHHmm || parseTimeToMinutes(endHHmm) == null) {
    endHHmm = addMinutesToTimeHHmm(sch.startTime || '00:00', 90) || '23:59';
  }
  const mins = parseTimeToMinutes(endHHmm);
  if (mins == null) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const h = Math.floor(mins / 60);
  const min = mins % 60;
  const dt = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Thời điểm được phép hiện pháo hoa = hết giờ lịch completed gần nhất (khóa đó).
 * Không tìm thấy lịch → hiện ngay (ISO now).
 */
async function resolveCelebrationShowAfter(studentId, courseName) {
  const sid = String(studentId || '');
  if (!sid) return new Date().toISOString();
  const filter = { studentId: sid, status: 'completed' };
  const course = String(courseName || '').trim();
  if (course) filter.course = course;
  let sch = await Schedule.findOne(filter)
    .sort({ date: -1, updatedAt: -1, createdAt: -1 })
    .select('date startTime endTime updatedAt createdAt')
    .lean();
  // Fallback: studentId có thể là ObjectId trong DB
  if (!sch) {
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(sid)) {
        sch = await Schedule.findOne({ ...filter, studentId: new mongoose.Types.ObjectId(sid) })
          .sort({ date: -1, updatedAt: -1, createdAt: -1 })
          .select('date startTime endTime updatedAt createdAt')
          .lean();
      }
    } catch { /* ignore */ }
  }
  const endAt = scheduleSlotEndDate(sch);
  return (endAt || new Date()).toISOString();
}

function emitCourseCelebrationSocket(io, payload) {
  if (!io || !payload?.studentId) return;
  const sid = String(payload.studentId);
  try {
    io.to(sid).emit('course:celebration', payload);
    io.to(`student_${sid}`).emit('course:celebration', payload);
  } catch { /* ignore */ }
}

async function buildPendingCourseCelebration(user) {
  if (!user) return null;
  const ens = Array.isArray(user.enrollments) ? user.enrollments : [];
  const pending = ens.find((e) => e && e.courseCelebrationSeen === false);
  if (pending) {
    const courseName = pending.courseName || user.course || 'khóa học';
    const showAfter = await resolveCelebrationShowAfter(user._id || user.id, courseName);
    return {
      courseName,
      enrollmentId: pending._id ? String(pending._id) : null,
      completedSessions: pending.completedSessions,
      totalRequired: pending.totalSessions,
      showAfter,
    };
  }
  if (user.courseCelebrationSeen === false) {
    const courseName = user.course || 'khóa học';
    const showAfter = await resolveCelebrationShowAfter(user._id || user.id, courseName);
    return {
      courseName,
      enrollmentId: null,
      completedSessions: user.completedSessions,
      totalRequired: user.totalSessions,
      showAfter,
    };
  }
  return null;
}

module.exports = {
  resolveCelebrationShowAfter,
  emitCourseCelebrationSocket,
  buildPendingCourseCelebration,
  scheduleSlotEndDate,
};
