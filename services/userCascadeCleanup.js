'use strict';

/**
 * Cascade cleanup khi hard-delete Student / Teacher.
 * Giữ Invoice + Ledger (audit tài chính) — chỉ dọn lịch, chat orphan, assignedStudents.
 */
const mongoose = require('mongoose');
const Schedule = require('../models/Schedule');
const Message = require('../models/Message');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const ConversationVisibility = require('../models/ConversationVisibility');
const logger = require('../config/logger');

function asIdString(id) {
  if (!id) return '';
  return String(id);
}

async function purgeStudentSideEffects(studentId, { studentName } = {}) {
  const id = asIdString(studentId);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return { schedules: 0, messages: 0, teachersUpdated: 0 };
  }

  const [schedRes, msgRes, teacherRes] = await Promise.all([
    Schedule.deleteMany({ studentId: id }),
    Message.deleteMany({
      $or: [{ senderId: id }, { receiverId: id }],
    }),
    Teacher.updateMany(
      { assignedStudents: id },
      { $pull: { assignedStudents: id } },
    ),
  ]);

  // Visibility records mentioning this user
  try {
    await ConversationVisibility.updateMany(
      { hiddenByUsers: id },
      { $pull: { hiddenByUsers: id } },
    );
  } catch (err) {
    logger.warn('[CASCADE] ConversationVisibility cleanup:', err.message);
  }

  logger.info('[CASCADE] student purge', {
    studentId: id,
    studentName: studentName || '',
    schedules: schedRes.deletedCount || 0,
    messages: msgRes.deletedCount || 0,
    teachersUpdated: teacherRes.modifiedCount || 0,
  });

  return {
    schedules: schedRes.deletedCount || 0,
    messages: msgRes.deletedCount || 0,
    teachersUpdated: teacherRes.modifiedCount || 0,
  };
}

async function purgeTeacherSideEffects(teacherId, { teacherName } = {}) {
  const id = asIdString(teacherId);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return { schedules: 0, messages: 0, studentsUnassigned: 0 };
  }

  const [schedRes, msgRes, studentRes] = await Promise.all([
    Schedule.deleteMany({ teacherId: id }),
    Message.deleteMany({
      $or: [{ senderId: id }, { receiverId: id }],
    }),
    Student.updateMany(
      { teacherId: id },
      { $unset: { teacherId: 1 } },
    ),
  ]);

  // Clear enrollment.teacherId refs
  try {
    await Student.updateMany(
      { 'enrollments.teacherId': id },
      { $set: { 'enrollments.$[e].teacherId': null } },
      { arrayFilters: [{ 'e.teacherId': id }] },
    );
  } catch (err) {
    logger.warn('[CASCADE] enrollment teacherId cleanup:', err.message);
  }

  try {
    await ConversationVisibility.updateMany(
      { hiddenByUsers: id },
      { $pull: { hiddenByUsers: id } },
    );
  } catch (err) {
    logger.warn('[CASCADE] ConversationVisibility cleanup:', err.message);
  }

  logger.info('[CASCADE] teacher purge', {
    teacherId: id,
    teacherName: teacherName || '',
    schedules: schedRes.deletedCount || 0,
    messages: msgRes.deletedCount || 0,
    studentsUnassigned: studentRes.modifiedCount || 0,
  });

  return {
    schedules: schedRes.deletedCount || 0,
    messages: msgRes.deletedCount || 0,
    studentsUnassigned: studentRes.modifiedCount || 0,
  };
}

/** HV không còn khóa active — chỉ cancelled/refunded (hoặc không enrollment). */
function isCancelledOnlyStudent(student) {
  const enrollments = Array.isArray(student?.enrollments) ? student.enrollments : [];
  if (!enrollments.length) {
    // Legacy single-course: nếu đã refund/cancel flag
    const st = String(student?.status || '').toLowerCase();
    return st === 'cancelled' || st === 'refunded' || st === 'inactive';
  }
  const hasActive = enrollments.some((e) => {
    const s = String(e?.status || 'active').toLowerCase();
    return s === 'active' || s === 'paused' || s === '';
  });
  if (hasActive) return false;
  return enrollments.some((e) => {
    const s = String(e?.status || '').toLowerCase();
    return s === 'cancelled' || s === 'refunded';
  });
}

/**
 * Xóa hàng loạt HV chỉ còn khóa đã hủy/hoàn (ghost sau refund).
 * @param {{ branchId?: string|null, dryRun?: boolean }} opts
 */
async function purgeCancelledOnlyStudents(opts = {}) {
  const { branchId = null, dryRun = false } = opts;
  const filter = {};
  if (branchId && branchId !== 'all') {
    filter.branchId = branchId;
  }

  const students = await Student.find(filter).lean();
  const targets = students.filter(isCancelledOnlyStudent);

  if (dryRun) {
    return {
      dryRun: true,
      count: targets.length,
      names: targets.slice(0, 50).map((s) => s.name),
    };
  }

  let deleted = 0;
  const cascade = { schedules: 0, messages: 0, teachersUpdated: 0 };
  for (const s of targets) {
    const id = String(s._id);
    const side = await purgeStudentSideEffects(id, { studentName: s.name });
    cascade.schedules += side.schedules;
    cascade.messages += side.messages;
    cascade.teachersUpdated += side.teachersUpdated;
    await Student.findByIdAndDelete(id);
    deleted += 1;
  }

  return { dryRun: false, deleted, cascade, names: targets.slice(0, 50).map((s) => s.name) };
}

/**
 * Dọn message / visibility orphan (sender/receiver không còn Student|Teacher).
 */
async function purgeOrphanMessages() {
  const messages = await Message.find({}).select('senderId receiverId').lean();
  const userIds = new Set();
  for (const m of messages) {
    const sId = m.senderId ? String(m.senderId) : '';
    const rId = m.receiverId ? String(m.receiverId) : '';
    if (sId && sId !== 'admin') userIds.add(sId);
    if (rId && rId !== 'admin' && !rId.startsWith('ALL_') && !rId.startsWith('group_')) {
      userIds.add(rId);
    }
  }

  const ids = [...userIds].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const [teachers, students] = await Promise.all([
    Teacher.find({ _id: { $in: ids } }).select('_id').lean(),
    Student.find({ _id: { $in: ids } }).select('_id').lean(),
  ]);
  const existing = new Set([
    ...teachers.map((t) => String(t._id)),
    ...students.map((s) => String(s._id)),
  ]);

  let deletedMessages = 0;
  for (const m of messages) {
    const sId = m.senderId ? String(m.senderId) : null;
    const rId = m.receiverId ? String(m.receiverId) : null;
    const senderMissing = sId && sId !== 'admin' && !existing.has(sId);
    const isSpecialReceiver = rId && (rId === 'admin' || rId.startsWith('ALL_') || rId.startsWith('group_'));
    const receiverMissing = rId && !isSpecialReceiver && !existing.has(rId);
    if (senderMissing || receiverMissing) {
      await Message.findByIdAndDelete(m._id);
      deletedMessages += 1;
    }
  }

  return { deletedMessages };
}

module.exports = {
  purgeStudentSideEffects,
  purgeTeacherSideEffects,
  purgeCancelledOnlyStudents,
  purgeOrphanMessages,
  isCancelledOnlyStudent,
};
