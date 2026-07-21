/**
 * Notification Center — list / count / mark-read / dismiss / broadcast.
 */
const Notification = require('../models/Notification');

const VALID_TYPES = ['SYSTEM', 'COURSE', 'FINANCE', 'EVALUATION', 'MESSAGE', 'EXAM', 'SCHEDULE'];

function buildReceiverMatch(user) {
  const userId = String(user.id || user._id || '');
  const role = user.role;
  const adminRole = user.adminRole;
  const branchId = user.branchId ? String(user.branchId) : '';

  const match = [
    { receivers: userId },
    { receivers: 'GLOBAL' },
  ];

  const isAdminSide = role === 'admin' || role === 'staff' || adminRole === 'SUPER_ADMIN' || adminRole === 'STAFF';
  if (isAdminSide) {
    match.push({ receivers: 'ALL_ADMIN' });
    if (branchId) match.push({ receivers: 'ALL_ADMIN_' + branchId });
  }
  if (role === 'teacher') {
    match.push({ receivers: 'ALL_TEACHER' });
    if (branchId) match.push({ receivers: 'ALL_TEACHER_' + branchId });
  }
  if (role === 'student') {
    match.push({ receivers: 'ALL_STUDENT' });
    if (branchId) match.push({ receivers: 'ALL_STUDENT_' + branchId });
  }

  return { userId, match };
}

function mapForClient(doc, userId) {
  const n = doc.toObject ? doc.toObject() : { ...doc };
  const readBy = Array.isArray(n.read_by) ? n.read_by.map(String) : [];
  const dismissedBy = Array.isArray(n.dismissed_by) ? n.dismissed_by.map(String) : [];
  return {
    ...n,
    id: String(n._id),
    message: n.content,
    time: n.createdAt,
    read: readBy.includes(String(userId)),
    dismissed: dismissedBy.includes(String(userId)),
  };
}

async function listForUser(user, { page = 1, limit = 20, type, unreadOnly = false } = {}) {
  const { userId, match } = buildReceiverMatch(user);
  const filter = {
    $or: match,
    dismissed_by: { $ne: userId },
  };
  if (type && VALID_TYPES.includes(String(type).toUpperCase())) {
    filter.type = String(type).toUpperCase();
  }
  if (unreadOnly) {
    filter.read_by = { $ne: userId };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({
      $or: match,
      dismissed_by: { $ne: userId },
      read_by: { $ne: userId },
    }),
  ]);

  return {
    data: rows.map((r) => mapForClient(r, userId)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
    unread,
  };
}

async function countUnread(user) {
  const { userId, match } = buildReceiverMatch(user);
  const count = await Notification.countDocuments({
    $or: match,
    dismissed_by: { $ne: userId },
    read_by: { $ne: userId },
  });
  return count;
}

async function markRead(user, { notificationId, markAll } = {}) {
  const { userId, match } = buildReceiverMatch(user);
  if (markAll) {
    await Notification.updateMany(
      { $or: match, dismissed_by: { $ne: userId }, read_by: { $ne: userId } },
      { $addToSet: { read_by: userId } },
    );
    return { marked: 'all' };
  }
  if (!notificationId) {
    const err = new Error('Thieu notificationId');
    err.status = 400;
    throw err;
  }
  await Notification.findByIdAndUpdate(notificationId, { $addToSet: { read_by: userId } });
  return { marked: notificationId };
}

async function dismiss(user, notificationId) {
  const { userId } = buildReceiverMatch(user);
  if (!notificationId) {
    const err = new Error('Thieu notificationId');
    err.status = 400;
    throw err;
  }
  const doc = await Notification.findByIdAndUpdate(
    notificationId,
    { $addToSet: { dismissed_by: userId, read_by: userId } },
    { new: true },
  );
  if (!doc) {
    const err = new Error('Khong tim thay thong bao');
    err.status = 404;
    throw err;
  }
  return mapForClient(doc, userId);
}

/**
 * Broadcast / send — uy quyen goi tu route (admin) hoac service khac.
 */
async function createAndEmit(io, options) {
  const NotificationService = require('./NotificationService');
  return NotificationService.send(io, options);
}

module.exports = {
  VALID_TYPES,
  buildReceiverMatch,
  mapForClient,
  listForUser,
  countUnread,
  markRead,
  dismiss,
  createAndEmit,
};