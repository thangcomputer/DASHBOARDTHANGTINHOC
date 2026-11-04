'use strict';

const { sendCanonicalMessage } = require('./directMessageService');

function referenceId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

function displayDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function sendScheduleConversationMessage({
  schedule,
  actor,
  action,
  previous = {},
  io,
  notifyUser,
} = {}) {
  const studentId = referenceId(schedule?.studentId);
  if (!studentId) throw new Error('Không thể gửi tin lịch: thiếu học viên của buổi học.');

  const student = typeof schedule.studentId === 'object' ? schedule.studentId : {};
  const teacher = typeof schedule.teacherId === 'object' ? schedule.teacherId : {};
  const date = schedule.date;
  const dateLabel = displayDate(date);
  const startTime = String(schedule.startTime || '');
  const endTime = String(schedule.endTime || '');
  const kind = action === 'cancelled'
    ? 'schedule_cancelled'
    : action === 'changed'
      ? 'schedule_changed'
      : 'schedule_created';
  const previousLabel = previous.startTime
    ? ` (trước đó: ${previous.startTime}${previous.endTime ? `–${previous.endTime}` : ''})`
    : '';
  const content = action === 'cancelled'
    ? `Đã hủy ca học của học viên ngày ${dateLabel} từ ${startTime} đến ${endTime}.`
    : action === 'changed'
      ? `Đã đổi ca học của học viên sang ngày ${dateLabel} từ ${startTime} đến ${endTime}${previousLabel}.`
      : `Đã xếp lịch học thành công cho học viên vào ngày ${dateLabel} từ ${startTime} đến ${endTime}.`;

  const result = await sendCanonicalMessage({
    sender: actor,
    receiverId: studentId,
    receiverName: String(schedule.studentName || student.name || 'Học viên'),
    receiverRole: 'student',
    content,
    messageType: 'system',
    payload: {
      kind,
      scheduleId: referenceId(schedule._id || schedule.id),
      date: date || null,
      dateLabel,
      weekday: date instanceof Date
        ? date.toLocaleDateString('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' })
        : '',
      startTime,
      endTime,
      prevStartTime: previous.startTime || null,
      prevEndTime: previous.endTime || null,
      course: String(schedule.course || ''),
      studentName: String(schedule.studentName || student.name || 'Học viên'),
      teacherName: String(schedule.teacherName || teacher.name || actor?.name || 'Giảng viên'),
    },
    io,
    notifyUser,
  });
  if (!result?.ok) {
    const error = new Error(result?.message || 'Không thể lưu tin lịch vào hội thoại.');
    error.code = result?.code || 'SCHEDULE_MESSAGE_FAILED';
    throw error;
  }
  return result;
}

module.exports = { sendScheduleConversationMessage };
