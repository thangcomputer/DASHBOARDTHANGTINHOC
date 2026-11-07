const crypto = require('crypto');
const Schedule = require('../models/Schedule');
const MeetClass = require('../models/MeetClass');

const TICKET_MS = 3 * 60 * 1000;
const MAX_PEERS = 12;

const tickets = new Map();
const rooms = new Map();

function roomOf(scheduleId) {
  const id = String(scheduleId);
  if (!rooms.has(id)) rooms.set(id, new Map());
  return rooms.get(id);
}

function sweepTickets(now = Date.now()) {
  for (const [token, ticket] of tickets) {
    if (ticket.exp <= now) tickets.delete(token);
  }
}

function issueTicket({ userId, role, name, scheduleId }) {
  sweepTickets();
  const token = crypto.randomBytes(24).toString('hex');
  tickets.set(token, {
    userId: String(userId),
    role: String(role || ''),
    name: String(name || ''),
    scheduleId: String(scheduleId),
    exp: Date.now() + TICKET_MS,
  });
  return token;
}

function userKey(userOrId) {
  if (userOrId && typeof userOrId === 'object') {
    return String(userOrId.id || userOrId._id || '');
  }
  return String(userOrId || '');
}

function takeTicket(token, userId) {
  sweepTickets();
  const ticket = tickets.get(String(token || ''));
  if (!ticket) return null;
  if (ticket.userId !== userKey(userId)) return null;
  if (ticket.exp <= Date.now()) return null;
  return ticket;
}

function consumeTicket(token) {
  tickets.delete(String(token || ''));
}

function deny(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function assertCanJoin(user, scheduleId) {
  const role = String(user?.role || '');
  const userId = String(user?.id || user?._id || '');
  const isStaff = role === 'admin' || role === 'staff' || userId === 'admin';
  const schedule = await Schedule.findById(scheduleId).select('studentId teacherId status course studentName').lean();
  if (schedule) {
    if (schedule.status === 'cancelled') throw deny(403, 'Buổi học đã hủy');
    const isStudent = role === 'student' && String(schedule.studentId || '') === userId;
    const isTeacher = role === 'teacher' && String(schedule.teacherId || '') === userId;
    if (!isStaff && !isStudent && !isTeacher) throw deny(403, 'Chỉ tài khoản của buổi học này mới vào được');
    return { schedule, role: isStudent ? 'student' : (isTeacher ? 'teacher' : role), userId };
  }
  const meet = await MeetClass.findById(scheduleId).select('studentIds students status title').lean();
  if (!meet) throw deny(404, 'Không tìm thấy buổi học');
  if (meet.status === 'cancelled') throw deny(403, 'Buổi học đã hủy');
  const allowed = (meet.studentIds || []).some((id) => String(id) === userId)
    || (meet.students || []).some((row) => String(row.id || '') === userId);
  if (!isStaff && !(role === 'student' && allowed)) throw deny(403, 'Chỉ học viên được chọn mới vào được phòng này');
  return { schedule: meet, role: role === 'student' && allowed ? 'student' : role, userId };
}

function peersOf(scheduleId, exceptSocketId = '') {
  const room = rooms.get(String(scheduleId));
  if (!room) return [];
  return [...room.entries()]
    .filter(([socketId]) => socketId !== exceptSocketId)
    .map(([socketId, peer]) => ({ socketId, userId: peer.userId, role: peer.role, name: peer.name }));
}

function joinRoom(scheduleId, socketId, peer) {
  const room = roomOf(scheduleId);
  const replaced = [];
  for (const [existingId, existing] of room) {
    if (existing.userId === peer.userId && existingId !== socketId) {
      room.delete(existingId);
      replaced.push(existingId);
    }
  }
  if (room.size >= MAX_PEERS && !room.has(socketId)) {
    const err = new Error('Phòng đã đủ người');
    err.status = 403;
    throw err;
  }
  room.set(socketId, peer);
  return { peers: peersOf(scheduleId, socketId), replaced };
}

function member(scheduleId, socketId) {
  return rooms.get(String(scheduleId))?.get(socketId) || null;
}

function leaveSocket(socketId) {
  const left = [];
  for (const [scheduleId, room] of rooms) {
    if (!room.has(socketId)) continue;
    room.delete(socketId);
    left.push(scheduleId);
    if (!room.size) rooms.delete(scheduleId);
  }
  return left;
}

module.exports = {
  TICKET_MS,
  issueTicket,
  takeTicket,
  consumeTicket,
  userKey,
  assertCanJoin,
  joinRoom,
  member,
  peersOf,
  leaveSocket,
};
