'use strict';

/**
 * Cascade cleanup khi hard-delete Student / Teacher.
 * Giữ Invoice + Ledger (audit tài chính) — chỉ dọn lịch, chat orphan, assignedStudents.
 */
const mongoose = require('mongoose');
const Schedule = require('../models/Schedule');
const Message = require('../models/Message');
const Group = require('../models/Group');
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

function isSpecialMessagingPeerId(id) {
  const s = String(id || '');
  return !s
    || s === 'admin'
    || s === 'ai_support'
    || s.startsWith('ALL_')
    || s.startsWith('group_');
}

/**
 * Dọn message orphan (sender/receiver không còn Student|Teacher).
 * KHÔNG được xóa group chat: receiverId của tin nhóm là Group._id (không phải user).
 */
async function purgeOrphanMessages() {
  const rows = await Message.aggregate([
    // Group messages use receiverId = Group._id — never treat those ids as peers
    { $match: { isGroup: { $ne: true } } },
    { $project: { ids: ['$senderId', '$receiverId'] } },
    { $unwind: '$ids' },
    { $match: { ids: { $nin: [null, ''] } } },
    { $group: { _id: '$ids' } },
  ]);

  const ids = [...new Set(
    rows
      .map((r) => String(r._id || ''))
      .filter((id) => !isSpecialMessagingPeerId(id) && mongoose.Types.ObjectId.isValid(id)),
  )];
  if (ids.length === 0) return { deletedMessages: 0, deadPeerIds: 0 };

  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [teachers, students, groups] = await Promise.all([
    Teacher.find({ _id: { $in: objectIds } }).select('_id').lean(),
    Student.find({ _id: { $in: objectIds } }).select('_id').lean(),
    Group.find({ _id: { $in: objectIds } }).select('_id').lean(),
  ]);
  const existing = new Set([
    ...teachers.map((t) => String(t._id)),
    ...students.map((s) => String(s._id)),
    ...groups.map((g) => String(g._id)),
  ]);

  const deadIds = ids.filter((id) => !existing.has(id));
  if (deadIds.length === 0) return { deletedMessages: 0, deadPeerIds: 0 };

  const res = await Message.deleteMany({
    // Defense-in-depth: never purge group threads even if a groupId slipped into deadIds
    isGroup: { $ne: true },
    conversationId: { $not: /^group_/ },
    $or: [
      { senderId: { $in: deadIds } },
      { receiverId: { $in: deadIds } },
    ],
  });

  return {
    deletedMessages: res.deletedCount || 0,
    deadPeerIds: deadIds.length,
  };
}

module.exports = {
  purgeStudentSideEffects,
  purgeTeacherSideEffects,
  purgeCancelledOnlyStudents,
  purgeOrphanMessages,
  isCancelledOnlyStudent,
};
