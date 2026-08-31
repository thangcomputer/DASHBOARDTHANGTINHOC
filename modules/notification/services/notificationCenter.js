/**
 * Notification Center — list / count / mark-read / dismiss / broadcast.
 */
const Notification = require('../models/Notification');
const logger = require('../config/logger');

const VALID_TYPES = ['SYSTEM', 'COURSE', 'FINANCE', 'EVALUATION', 'MESSAGE', 'EXAM', 'SCHEDULE'];

function getAccountCreationTime(user) {
  if (user.createdAt) return new Date(user.createdAt);
  if (user.created_at) return new Date(user.created_at);
  const uid = String(user.id || user._id || '');
  if (uid.length === 24 && /^[0-9a-fA-F]{24}$/.test(uid)) {
    try {
      const timestamp = parseInt(uid.substring(0, 8), 16) * 1000;
      return new Date(timestamp);
    } catch { /* ignore */ }
  }
  return null;
}

function buildReceiverMatch(user) {
  const userId = String(user.id || user._id || '');
  const role = user.role;
  const adminRole = user.adminRole;
  const branchId = user.branchId ? String(user.branchId) : '';
  const userCreatedAt = getAccountCreationTime(user);

  const isSuperAdmin = userId === 'admin' || adminRole === 'SUPER_ADMIN';
  const isSupport = adminRole === 'SUPPORT' || role === 'support';
  const isAdminSide = !isSupport && (
    role === 'admin' || role === 'staff' || adminRole === 'SUPER_ADMIN' || adminRole === 'STAFF'
  );

  // Helper cho broad receivers — loại bỏ thông báo cũ trước ngày nhân viên được tạo
  const broadCond = (rec) => {
    if (!isSuperAdmin && userCreatedAt && !isNaN(userCreatedAt.getTime())) {
      return { receivers: rec, createdAt: { $gte: userCreatedAt } };
    }
    return { receivers: rec };
  };

  const match = [
    { receivers: userId },
    broadCond('GLOBAL'),
  ];

  if (isSuperAdmin) {
    match.push(broadCond('ALL_ADMIN'));
    match.push(broadCond('ALL_SUPER_ADMIN'));
  } else if (isSupport) {
    // Support chỉ nhận hộp ALL_SUPPORT — không lẫn ALL_ADMIN/ALL_STAFF
    match.push(broadCond('ALL_SUPPORT'));
    if (branchId) match.push(broadCond('ALL_SUPPORT_' + branchId));
  } else if (adminRole === 'HIGH_ADMIN') {
    match.push(broadCond('ALL_ADMIN'));
    if (branchId) {
      match.push(broadCond('ALL_ADMIN_' + branchId));
      match.push(broadCond('ALL_STAFF_' + branchId));
    }
  } else if (isAdminSide) {
    if (branchId) {
      match.push(broadCond('ALL_ADMIN_' + branchId));
      match.push(broadCond('ALL_STAFF_' + branchId));
    } else {
      match.push(broadCond('ALL_ADMIN'));
    }
  }

  if (role === 'teacher' && !isSupport) {
    match.push(broadCond('ALL_TEACHER'));
    if (branchId) match.push(broadCond('ALL_TEACHER_' + branchId));
  }
  if (role === 'student') {
    match.push(broadCond('ALL_STUDENT'));
    if (branchId) match.push(broadCond('ALL_STUDENT_' + branchId));
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

function isSupportStaffOnly(user) {
  if (!user) return false;
  if (user.id === 'admin' || user.adminRole === 'SUPER_ADMIN') return false;
  // Tài khoản Support (adminRole SUPPORT) được xem hỏi đáp LMS — không coi là “support mailbox hẹp”
  if (user.adminRole === 'SUPPORT') return false;
  const isStaff = user.role === 'staff' || user.adminRole === 'STAFF';
  if (!isStaff) return false;

  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  const hasStudentMgmt = perms.includes('manage_students');
  const hasTeacherMgmt = perms.includes('manage_teachers');
  const hasFinanceMgmt = perms.includes('manage_finance');

  if (perms.length === 1 && perms.includes('manage_messages')) return true;
  if (!hasStudentMgmt && !hasTeacherMgmt && !hasFinanceMgmt) return true;
  return false;
}

/** Bộ lọc hộp thư hẹp của staff chỉ chat — vẫn cho phép hỏi đáp LMS (payload.kind = lms_qa). */
function supportMailboxRestrictAnd() {
  return {
    $or: [
      { 'payload.kind': 'lms_qa' },
      {
        type: { $nin: ['FINANCE', 'EVALUATION', 'EXAM', 'SCHEDULE', 'COURSE'] },
        'payload.studentId': { $exists: false },
        'payload.teacherId': { $exists: false },
        title: { $not: /Học viên|Giảng viên|học phí|Đánh giá|Kỳ thi|Lịch dạy/i },
      },
    ],
  };
}

async function listForUser(user, { page = 1, limit = 20, type, unreadOnly = false } = {}) {
  const { userId, match } = buildReceiverMatch(user);
  const filter = {
    $or: match,
    dismissed_by: { $ne: userId },
  };

  const isAdminSide = user.role === 'admin' || user.role === 'staff' || user.adminRole === 'SUPER_ADMIN' || user.adminRole === 'STAFF';
  if (!isAdminSide) {
    if (user.role === 'teacher') {
      filter['payload.targetAudience'] = { $ne: 'student' };
    } else if (user.role === 'student') {
      filter['payload.targetAudience'] = { $ne: 'teacher' };
    }
  }

  if (isSupportStaffOnly(user)) {
    filter.$and = filter.$and || [];
    filter.$and.push(supportMailboxRestrictAnd());
  }

  if (type && VALID_TYPES.includes(String(type).toUpperCase())) {
    filter.type = String(type).toUpperCase();
  }
  if (unreadOnly) {
    filter.read_by = { $ne: userId };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const unreadFilter = {
    $or: match,
    dismissed_by: { $ne: userId },
    read_by: { $ne: userId },
  };
  if (!isAdminSide) {
    if (user.role === 'teacher') {
      unreadFilter['payload.targetAudience'] = { $ne: 'student' };
    } else if (user.role === 'student') {
      unreadFilter['payload.targetAudience'] = { $ne: 'teacher' };
    }
  }

  if (isSupportStaffOnly(user)) {
    unreadFilter.$and = unreadFilter.$and || [];
    unreadFilter.$and.push(supportMailboxRestrictAnd());
  }

  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments(unreadFilter),
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
  const filter = {
    $or: match,
    dismissed_by: { $ne: userId },
    read_by: { $ne: userId },
  };

  const isAdminSide = user.role === 'admin' || user.role === 'staff' || user.adminRole === 'SUPER_ADMIN' || user.adminRole === 'STAFF';
  if (!isAdminSide) {
    if (user.role === 'teacher') {
      filter['payload.targetAudience'] = { $ne: 'student' };
    } else if (user.role === 'student') {
      filter['payload.targetAudience'] = { $ne: 'teacher' };
    }
  }

  if (isSupportStaffOnly(user)) {
    filter.$and = filter.$and || [];
    filter.$and.push(supportMailboxRestrictAnd());
  }

  const count = await Notification.countDocuments(filter);
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
    { returnDocument: 'after' },
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