/**
 * Room-scoped Socket.IO emits — tránh io.emit toàn cục (cross-branch leak).
 * Rooms: userId, ALL_ADMIN, ALL_STAFF, ALL_SUPPORT, branch_{id}, teacher_{id}, student_{id}
 *
 * Fail-closed: thiếu branchId → chỉ ALL_ADMIN (không fan-out ALL_STAFF/ALL_SUPPORT/global).
 */
const logger = require('../config/logger');

/** Authenticated role rooms — không gồm socket chưa register / guest */
const AUTHENTICATED_ROLE_ROOMS = [
  'ALL_ADMIN',
  'ALL_STAFF',
  'ALL_SUPPORT',
  'ALL_TEACHER',
  'ALL_STUDENT',
];

function branchRoom(branchId) {
  if (branchId == null || branchId === '') return null;
  return `branch_${String(branchId)}`;
}

/**
 * Emit tới chi nhánh (+ ALL_ADMIN để Super/High nhận). Không dùng GLOBAL.
 * Không silent-fallback sang ALL_STAFF khi thiếu branch.
 */
function emitBranch(io, branchId, event, payload) {
  if (!io) return;
  const room = branchRoom(branchId);
  if (room) {
    io.to(room).emit(event, payload);
    io.to('ALL_ADMIN').emit(event, payload);
    return;
  }
  logger.warn(
    { event, reason: 'missing_branchId' },
    '[realtime] emitBranch fail-closed — ALL_ADMIN only',
  );
  io.to('ALL_ADMIN').emit(event, payload);
}

function emitUser(io, userId, event, payload) {
  if (!io || !userId) return;
  io.to(String(userId)).emit(event, payload);
}

function emitUsers(io, userIds, event, payload) {
  if (!io) return;
  for (const id of userIds || []) {
    if (id) io.to(String(id)).emit(event, payload);
  }
}

/**
 * System-wide to authenticated role rooms only.
 * Dùng cho settings TENANT/GLOBAL và SYSTEM_RESET — không io.emit(*) toàn socket.
 * Payload phải không chứa secret.
 */
function emitSystemWide(io, event, payload) {
  if (!io) return;
  for (const room of AUTHENTICATED_ROLE_ROOMS) {
    io.to(room).emit(event, payload);
  }
}

/** data:refresh scoped theo branch + optional user rooms */
function emitDataRefresh(io, payload, { branchId, userIds } = {}) {
  if (!io) return;
  emitBranch(io, branchId, 'data:refresh', payload);
  emitUsers(io, userIds, 'data:refresh', payload);
}

/**
 * Teacher business event: branch + teacher user room + teacher_{id} room.
 */
function emitTeacherEvent(io, teacherLike, event, payload) {
  if (!io) return;
  const branchId = teacherLike?.branchId || null;
  const tid = teacherLike?._id || teacherLike?.id || teacherLike?.teacherId;
  emitBranch(io, branchId, event, payload);
  if (tid) {
    const id = String(tid);
    emitUser(io, id, event, payload);
    io.to(`teacher_${id}`).emit(event, payload);
  }
}

/**
 * Finance / ledger style: branch + optional user rooms. Never global.
 */
function emitFinanceEvent(io, { branchId, userIds } = {}, event, payload) {
  if (!io) return;
  emitBranch(io, branchId, event, payload);
  emitUsers(io, userIds, event, payload);
}

/**
 * Schedule / attendance: branch + teacher + student user rooms.
 */
function emitScheduleEvent(io, { branchId, teacherId, studentId } = {}, event, payload) {
  if (!io) return;
  emitBranch(io, branchId, event, payload);
  const users = [teacherId, studentId].filter(Boolean);
  emitUsers(io, users, event, payload);
  if (studentId) io.to(`student_${String(studentId)}`).emit(event, payload);
  if (teacherId) io.to(`teacher_${String(teacherId)}`).emit(event, payload);
}

module.exports = {
  AUTHENTICATED_ROLE_ROOMS,
  branchRoom,
  emitBranch,
  emitUser,
  emitUsers,
  emitSystemWide,
  emitDataRefresh,
  emitTeacherEvent,
  emitFinanceEvent,
  emitScheduleEvent,
};
