'use strict';
const Message = require('./../models/Message');
const Group   = require('./../../student/models/Group');
const Student = require('./../../student/models/Student');
const Teacher = require('./../../teacher/models/Teacher');
const ConversationVisibility = require('./../models/ConversationVisibility');
const logger = require('./../../../config/logger');
const { buildConversationId } = require('./../../../utils/chatConversationId');
const { sanitizeMessages, sanitizeMessageDoc } = require('./../../../utils/messageFileRetention');
const { normalizeMulterFile } = require('./../../../utils/escapeRegex');
const path = require('path');
const fs = require('fs');

const router  = express.Router();
router.use(authMiddleware);
const isStaffAccount = (u = {}) => u.role === 'staff' || u.adminRole === 'STAFF' || u.adminRole === 'SUPPORT' || u.adminRole === 'SUPPORT_AGENT';
const isSuperAdminAccount = (u = {}) => u.id === 'admin' || u.adminRole === 'SUPER_ADMIN';
const isHighAdminAccount = (u = {}) => u.adminRole === 'HIGH_ADMIN';
/** SUPER_ADMIN + HIGH_ADMIN — chia sẻ admin mailbox */
const isAdminLevelAccount = (u = {}) => isSuperAdminAccount(u) || isHighAdminAccount(u);
function toClientMessage(doc) {
  const plain = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  return sanitizeMessageDoc(plain);
}
/** Hiển thị tin nhắn tới học viên: STAFF vs SUPER_ADMIN */
const DEPT_STAFF_LABEL = 'Phòng Giáo Vụ';
const DEPT_SUPER_LABEL = 'ADMIN CẤP CAO';
function staffDisplayName(rawName, branchCode) {
  return (rawName && rawName.trim()) ? rawName.trim() : 'Nhân viên';
}
function deptOutboundToStudent(reqUser) {
  if (isStaffAccount(reqUser)) return DEPT_STAFF_LABEL;
  if (isAdminLevelAccount(reqUser)) return DEPT_SUPER_LABEL;
  if (reqUser.role === 'admin' || reqUser.role === 'staff') return DEPT_SUPER_LABEL;
  return null;
}
// AdminUser was wrong, they are stored in Teacher
// ══ GET /api/chat/contacts  ──  RBAC/ABAC Matrix ══
// ┌────────────────┼────────────────────────────────────────────┐
// │ CALLER         │ CÓ THỂ THẤY                                         │
// ├────────────────┼────────────────────────────────────────────┤
// │ STUDENT        │ SuperAdmin + STAFF(cùng branch) + Teacher(teacherId + enrollments) │
// │ TEACHER        │ SuperAdmin + STAFF(cùng branch) + Student(teacherId hoặc enrollments) │
// │ STAFF          │ SuperAdmin + Teacher(cùng branch) + Student(cùng branch)   │
// │ SUPER_ADMIN    │ Tất cả (có filter theo branch trên query)                  │
// └────────────────┴────────────────────────────────────────────┘

class ChatApplicationService {
  async get_contacts(data) {
  try {
    const { role: userRole, id: userId, adminRole } = data.currentUser;
    console.log('[API CONTACTS DEBUG] currentUser:', { userRole, userId, adminRole });
    const { branch_id: queryBranchId } = data.query; // SUPER_ADMIN có thể lọc theo CS

    // Helper: định dạng contact trả về
    const mapContact = (doc, role) => ({
      id:     doc._id.toString(),
      name:   doc.name || 'Không rõ tên',
      role,
      adminRole: doc.adminRole || null,
      gender: doc.gender || '',
      phone:  doc.phone || '',
      avatar: doc.avatar || String(doc.name || 'U').substring(0, 2).toUpperCase(),
      branchId:   doc.branchId   ? doc.branchId.toString()   : null,
      branchCode: doc.branchCode || ''
    });

    // ────── [1] SuperAdmin luôn được lấy trước (mọi role đều thấy) ──────
    const SystemSettings = require('../../system/models/SystemSettings');
    const sysSettings = await SystemSettings.findOne({ _key: 'main' }).lean();
    const systemAdminName = (sysSettings?.adminName && sysSettings.adminName.trim()) ? sysSettings.adminName.trim() : null;

    const superAdmins = await Teacher.find(
      { $or: [{ adminRole: 'SUPER_ADMIN' }, { role: 'admin', adminRole: { $ne: 'STAFF' } }] },
      'name adminRole gender phone branchId branchCode avatar'
    ).lean();

    const seenAdminNames = new Set();
    const superAdminContacts = [];

    for (const a of superAdmins) {
      const actualName = (systemAdminName && a.phone === 'admin') ? systemAdminName : ((a.name && a.name.trim()) ? a.name.trim() : (systemAdminName || 'P ĐÀO TẠO (ADMIN)'));
      const adminId = (a._id.toString() === 'admin' || a.phone === 'admin') ? 'admin' : a._id.toString();

      const key = actualName.toLowerCase();
      if (seenAdminNames.has(key)) continue;
      seenAdminNames.add(key);

      superAdminContacts.push({
        id: adminId,
        name: actualName,
        role: 'admin',
        phone: a.phone || '',
        avatar: a.avatar || String(actualName || 'AD').substring(0, 2).toUpperCase(),
        branchId: a.branchId || null,
        branchCode: a.branchCode || ''
      });
    }

    if (superAdminContacts.length === 0) {
      const actualName = systemAdminName || 'Hệ Thống';
      superAdminContacts.push({
        id: 'admin',
        name: actualName,
        role: 'admin',
        phone: '',
        avatar: String(actualName).substring(0, 2).toUpperCase(),
        branchId: null,
        branchCode: 'HỆ THỐNG'
      });
    }

    let staffContacts    = [];
    let teacherContacts  = [];
    let studentContacts  = [];

    // ══ [2] SUPER_ADMIN / SUPPORT: xem toàn hệ thống (kèm HV) ══
    if (adminRole === 'SUPER_ADMIN' || adminRole === 'SUPPORT' || adminRole === 'SUPPORT_AGENT') {
      const branchFilter = queryBranchId && queryBranchId !== 'all'
        ? { branchId: queryBranchId }
        : {};

      const [staffDocs, teacherDocs, studentDocs] = await Promise.all([
        Teacher.find({ adminRole: { $in: ['STAFF', 'SUPPORT', 'SUPPORT_AGENT'] }, ...branchFilter },
                     'name adminRole gender phone branchId branchCode avatar').lean(),
        Teacher.find({ role: 'teacher', ...branchFilter },
                     'name adminRole gender phone branchId branchCode avatar').lean(),
        Student.find({ ...branchFilter },
                     'name adminRole gender phone branchId branchCode avatar').lean(),
      ]);

      staffContacts   = staffDocs.map(d => ({
        ...mapContact(d, 'staff'),
        name: staffDisplayName(d.name, d.branchCode),
      }));
      teacherContacts = teacherDocs.map(d => mapContact(d, 'teacher'));
      studentContacts = studentDocs.map(d => mapContact(d, 'student'));
    }

    // ══ [2b] HIGH_ADMIN: GV + staff + support — không học viên ══
    else if (adminRole === 'HIGH_ADMIN') {
      const branchFilter = queryBranchId && queryBranchId !== 'all'
        ? { branchId: queryBranchId }
        : {};

      const [staffDocs, teacherDocs] = await Promise.all([
        Teacher.find({ adminRole: { $in: ['STAFF', 'SUPPORT', 'SUPPORT_AGENT'] }, ...branchFilter },
                     'name adminRole gender phone branchId branchCode avatar').lean(),
        Teacher.find({ role: 'teacher', ...branchFilter },
                     'name adminRole gender phone branchId branchCode avatar').lean(),
      ]);

      staffContacts   = staffDocs.map(d => ({
        ...mapContact(d, 'staff'),
        name: staffDisplayName(d.name, d.branchCode),
      }));
      teacherContacts = teacherDocs.map(d => mapContact(d, 'teacher'));
    }

    // ══ [3] STAFF ADMIN: chỉ thấy dữ liệu cùng branch ══
    else if (adminRole === 'STAFF') {
      // Lấy branchId của STAFF từ DB (máy chủ tin cậy hơn token)
      const staffUser = await Teacher.findById(userId).select('branchId').lean();
      const staffBranchId = staffUser?.branchId ? staffUser.branchId.toString() : null;

      if (!staffBranchId) {
        // STAFF chưa gán branch riêng → Hỗ trợ viên quản lý toàn bộ học viên & giảng viên
        const [staffDocs, teacherDocs, studentDocs] = await Promise.all([
          Teacher.find({ adminRole: { $in: ['STAFF', 'SUPPORT'] }, _id: { $ne: userId } }, 'name adminRole gender phone branchId branchCode avatar').lean(),
          Teacher.find({ role: 'teacher' }, 'name adminRole gender phone branchId branchCode avatar').lean(),
          Student.find({}, 'name adminRole gender phone branchId branchCode avatar').lean(),
        ]);
        staffContacts = staffDocs.map(d => ({ ...mapContact(d, 'staff'), name: staffDisplayName(d.name, d.branchCode) }));
        teacherContacts = teacherDocs.map(d => mapContact(d, 'teacher'));
        studentContacts = studentDocs.map(d => mapContact(d, 'student'));
      } else {
        const [teacherDocs, studentDocs, otherStaffDocs] = await Promise.all([
          Teacher.find(
            { role: 'teacher', branchId: staffBranchId },
            'name adminRole gender phone branchId branchCode avatar'
          ).lean(),
          Student.find(
            { branchId: staffBranchId },
            'name adminRole gender phone branchId branchCode avatar'
          ).lean(),
          Teacher.find(
            { adminRole: { $in: ['STAFF', 'SUPPORT'] }, branchId: staffBranchId, _id: { $ne: userId } },
            'name adminRole gender phone branchId branchCode avatar'
          ).lean(),
        ]);

        staffContacts = otherStaffDocs.map(d => ({
          ...mapContact(d, 'staff'),
          name: staffDisplayName(d.name, d.branchCode),
        }));
        teacherContacts = teacherDocs.map(d => mapContact(d, 'teacher'));
        studentContacts = studentDocs.map(d => mapContact(d, 'student'));
      }
    }

    // ══ [4] TEACHER: chỉ thấy STAFF cùng branch + Student được phân công ══
    else if (userRole === 'teacher') {
      const teacher = await Teacher.findById(userId).select('branchId assignedStudents').lean();
      const teacherBranchId = teacher?.branchId ? teacher.branchId.toString() : null;
      const assignedIds = (teacher?.assignedStudents || []).filter(Boolean);

      const studentQuery = {
        $or: [
          { teacherId: userId },
          { 'enrollments.teacherId': userId },
          ...(assignedIds.length ? [{ _id: { $in: assignedIds } }] : []),
        ],
      };

      const staffQuery = teacherBranchId
        ? { adminRole: { $in: ['STAFF', 'SUPPORT'] }, $or: [{ branchId: teacherBranchId }, { branchId: null }, { branchId: { $exists: false } }] }
        : { adminRole: { $in: ['STAFF', 'SUPPORT'] } };

      const [staffDocs, studentDocs] = await Promise.all([
        // STAFF (cả Hỗ trợ viên toàn hệ thống lẫn Staff cùng chi nhánh)
        Teacher.find(staffQuery, 'name adminRole gender phone branchId branchCode avatar').lean(),
        // HV: teacherId cấp hồ sơ HOẶC phân công theo enrollment (đa khóa)
        Student.find(studentQuery, 'name adminRole gender phone branchId branchCode avatar').lean(),
      ]);

      staffContacts   = staffDocs.map(d => ({
        ...mapContact(d, 'staff'),
        name: staffDisplayName(d.name, d.branchCode),
      }));
      studentContacts = studentDocs.map(d => mapContact(d, 'student'));
      // Không thêm GV khác vào danh bạ
    }

    // ══ [5] STUDENT: chỉ thấy STAFF cùng branch + Teacher đang dạy mình ══
    else if (userRole === 'student') {
      const student = await Student.findById(userId)
        .select('branchId teacherId enrollments.teacherId')
        .lean();

      const studentBranchId = student?.branchId ? student.branchId.toString() : null;
      const myTeacherIds = new Set();
      if (student?.teacherId) myTeacherIds.add(String(student.teacherId));
      (student?.enrollments || []).forEach((e) => {
        if (e?.teacherId) myTeacherIds.add(String(e.teacherId));
      });
      const teacherIdList = [...myTeacherIds].filter(Boolean);

      const staffQuery = studentBranchId
        ? { adminRole: { $in: ['STAFF', 'SUPPORT'] }, $or: [{ branchId: studentBranchId }, { branchId: null }, { branchId: { $exists: false } }] }
        : { adminRole: { $in: ['STAFF', 'SUPPORT'] } };

      const [staffDocs, teacherDocs] = await Promise.all([
        // STAFF (cả Hỗ trợ viên toàn hệ thống lẫn Staff cùng chi nhánh)
        Teacher.find(staffQuery, 'name adminRole gender phone branchId branchCode avatar').lean(),
        // Mọi GV đang dạy (cấp hồ sơ + từng enrollment)
        teacherIdList.length
          ? Teacher.find(
              { _id: { $in: teacherIdList }, role: 'teacher' },
              'name adminRole gender phone branchId branchCode avatar'
            ).lean()
          : Promise.resolve([]),
      ]);

      staffContacts   = staffDocs.map(d => ({
        ...mapContact(d, 'staff'),
        name: staffDisplayName(d.name, d.branchCode),
      }));
      teacherContacts = teacherDocs.map(d => mapContact(d, 'teacher'));
      // Không thêm HV khác vào danh bạ
    }

    // ──── Hợp nhất ────
    const contacts = [
      ...superAdminContacts,
      ...staffContacts,
      ...teacherContacts,
      ...studentContacts,
    ];

    // Loại trừ chính mình khỏi danh bạ (theo cả ID và Name để tránh trùng lặp tài khoản Admin/System)
    const selfId = userId?.toString();
    const selfName = data.currentUser?.name?.trim()?.toLowerCase();
    const deduped = contacts.filter(c => {
      if (c.id === selfId || c.id?.toString() === selfId) return false;
      if (selfName && c.name?.trim()?.toLowerCase() === selfName) return false;
      return true;
    });

    return { _status: 200, _body: ({ success: true, data: deduped });
  } catch (err) {
    logger.error('[CONTACTS]', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_conversations_userId(data) {
  try {
    const userId = data.userId;

    // Bảo vệ: Chỉ Admin hoặc chính User đó mới được xem
    if (data.currentUser.role !== 'admin' && data.currentUser.id !== userId) {
      return { _status: 403, _body: ({ success: false, message: 'Bạn không có quyền xem thông tin này' });
    }

    // Branch Filtering logic
    const isSuperAdmin = isAdminLevelAccount(data.currentUser);
    const userBranch = data.currentUser.branchCode || '';

    const matchQuery = { 
      $or: [
        { senderId: userId },
        { receiverId: userId },
        // Hộp chung admin (admin_admin) chỉ dành cho SUPER_ADMIN
        ...(isAdminLevelAccount(data.currentUser) ? [{ senderId: 'admin' }, { receiverId: 'admin' }] : [])
      ]
    };

    // If STAFF or TEACHER, filter by their branch
    if (!isSuperAdmin && userBranch) {
      matchQuery.$and = [
        { $or: [
          { senderBranchCode: userBranch },
          { receiverBranchCode: userBranch },
          // Không leak hộp chung admin cho STAFF/TEACHER
          ...(isAdminLevelAccount(data.currentUser) ? [{ senderId: 'admin' }, { receiverId: 'admin' }] : [])
        ]}
      ];
    }

    const messages = await Message.aggregate([
      { $match: matchQuery },
      { $sort: { createdAt: -1 }},
      { $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: { $sum: { $cond: [
          { $and: [
            { $in: ['$receiverId', isAdminLevelAccount(data.currentUser) ? ['admin', String(userId)] : [String(userId)]] },
            { $eq: ['$isRead', false] },
          ]}, 1, 0,
        ]}},
      }},
      { $sort: { 'lastMessage.createdAt': -1 }},
    ]);

    const conversations = messages.map(m => {
      const isReceiver = m.lastMessage.receiverId === userId;
      return {
        conversationId: m._id,
        otherUser: {
          id: isReceiver ? m.lastMessage.senderId : m.lastMessage.receiverId,
          name: isReceiver ? m.lastMessage.senderName : m.lastMessage.receiverName,
          role: isReceiver ? m.lastMessage.senderRole : m.lastMessage.receiverRole,
        },
        lastMessage: {
          content: m.lastMessage.content,
          createdAt: m.lastMessage.createdAt,
        },
        unreadCount: m.unreadCount,
      };
    });

    return { _status: 200, _body: ({ success: true, data: conversations });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_search_userId(data) {
  try {
    const userId = data.userId;
    const { q } = data.query;
    
    if (data.currentUser.role !== 'admin' && data.currentUser.id !== userId) {
      return { _status: 403, _body: ({ success: false, message: 'Bạn không có quyền tìm kiếm' });
    }

    if (!q) return { _status: 200, _body: ({ success: true, data: [] });

    const { sanitizeRegex } = require('../../../middleware/sanitizeRegex');
    const safeQ = sanitizeRegex(q);

    const isSuperAdmin = isAdminLevelAccount(data.currentUser);
    const userBranch = data.currentUser.branchCode || '';

    const searchQuery = {
      $or: [
        { senderId: userId }, 
        { receiverId: userId },
        ...(isAdminLevelAccount(data.currentUser) ? [{ senderId: 'admin' }, { receiverId: 'admin' }] : [])
      ],
      content: { $regex: safeQ, $options: 'i' }
    };

    if (!isSuperAdmin && userBranch) {
      searchQuery.$and = [
        { $or: [
          { senderBranchCode: userBranch },
          { receiverBranchCode: userBranch }
        ]}
      ];
    }

    const messages = await Message.find(searchQuery).sort({ createdAt: -1 }).limit(50);

    return { _status: 200, _body: ({ success: true, data: sanitizeMessages(messages) });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_hidden(data) {
  try {
    const userId = data.currentUser.id;
    const hiddenRows = await ConversationVisibility.find({ hiddenByUsers: userId }).lean();
    const hiddenList = hiddenRows.map(r => r.conversationId);
    return { _status: 200, _body: ({ success: true, data: hiddenList });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_conversationId(data) {
  try {
    const { conversationId } = data.params;

    // Bảo vệ: Phải là một trong hai bên trong conversationId (hoặc Admin)
    // conversationId format: role_id__role_id (sorted)
    const isStaffOrAdmin = data.currentUser.role === 'admin' || isStaffAccount(data.currentUser);
    const isParticipant = await (async () => {
      const parts = String(conversationId || '').split('__').filter(Boolean);
      const hasSelf = parts.some((p) => p.endsWith(`_${data.currentUser.id}`));
      if (hasSelf) return true;
      // Chỉ super admin (hardcoded admin / SUPER_ADMIN) mới được xem hộp chung admin_admin
      if (isStaffOrAdmin && isAdminLevelAccount(data.currentUser)) {
        return parts.includes('admin_admin');
      }
      // Fallback: check if user is sender/receiver of any message in this conversation
      const msgExist = await Message.findOne({
        conversationId,
        $or: [{ senderId: data.currentUser.id }, { receiverId: data.currentUser.id }]
      }).select('_id').lean();
      if (msgExist) return true;

      return false;
    })();

    if (!isParticipant) {
      return { _status: 403, _body: ({ success: false, message: 'Bạn không thuộc cuộc hội thoại này' });
    }
    const messages = await Message.find({ 
      conversationId: data.conversationId,
      hiddenFor: { $ne: data.currentUser.id }
    })
      .sort({ createdAt: 1 })
      .limit(200);

    return { _status: 200, _body: ({ success: true, data: sanitizeMessages(messages) });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_sync_userId(data) {
  try {
    const { userId } = data.params;
    if (data.currentUser.role !== 'admin' && String(data.currentUser.id) !== String(userId)) {
      return { _status: 403, _body: ({ success: false, message: 'Bạn không có quyền đồng bộ dữ liệu này' });
    }

    // Lấy các nhóm mà user là thành viên
    const userGroups = await Group.find({ 'participants.userId': userId });
    const groupIds = userGroups.map(g => String(g._id));

    // Lấy tin nhắn cá nhân + tin nhắn nhóm
    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { receiverId: userId },
        ...(isAdminLevelAccount(data.currentUser) ? [{ senderId: 'admin' }, { receiverId: 'admin' }] : []),
        ...(groupIds.length > 0 ? [{ conversationId: { $in: groupIds.map(id => `group_${id}`) } }] : [])
      ],
      hiddenFor: { $ne: userId }
    }).sort({ createdAt: -1 }).limit(500);

    return { _status: 200, _body: ({ success: true, data: sanitizeMessages(messages.reverse()) });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_upload(data) {
  try {
    if (!data.file) return { _status: 400, _body: ({ success: false, message: 'Không có file' });
    normalizeMulterFile(data.file);

    const { validateUploadedFileMagic } = require('../../../utils/uploadSniff');
    const sniff = validateUploadedFileMagic(data.file.path, data.file.originalname || data.file.filename);
    if (!sniff.ok) {
      try { fs.unlinkSync(data.file.path); } catch { /* ignore */ }
      return { _status: 400, _body: ({
        success: false,
        message: 'Nội dung file không khớp định dạng khai báo',
        code: 'MAGIC_MISMATCH',
      });
    }

    const fileUrl = `/${data.file.path.replace(/\\/g, '/')}`;
    // Đăng ký FileAsset (Phase 8) — không chặn response nếu registry lỗi
    try {
      const fileService = require('../../file/services/fileService');
      await fileService.registerUploadedFile(data.file, {
        category: 'messages',
        uploadedBy: String(data.currentUser?.id || ''),
        uploadedByRole: data.currentUser?.role || '',
        relatedType: 'message',
      });
    } catch (regErr) {
      logger.warn({ err: regErr.message }, '[MESSAGES] FileAsset register failed');
    }
    return { _status: 200, _body: ({ success: true, url: fileUrl, name: data.file.originalname });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_root(data) {
  try {
    // Luôn dùng ID và Role từ token để ngăn chặn giả mạo (impersonation)
    const senderId = data.currentUser.id;
    // Thống nhất role admin cho cả SUPER_ADMIN và STAFF trong hệ thống Chat
    const senderRole = isStaffAccount(data.currentUser) ? 'admin' : data.currentUser.role;
    const senderName = data.currentUser.name;

    const { receiverId, receiverName, receiverRole, content, isGroup, groupId, messageType, fileUrl, fileName } = data.body;

    const isBroadcast = receiverId === 'ALL_USERS' || receiverId === 'ALL_STUDENTS' || receiverId === 'ALL_TEACHERS';
    if (isBroadcast && !(data.currentUser.role === 'admin' || data.currentUser.role === 'staff')) {
      return { _status: 403, _body: ({ success: false, message: 'Chỉ admin/staff được gửi thông báo broadcast' });
    }
    if (isBroadcast && receiverId === 'ALL_STUDENTS' && data.currentUser.adminRole === 'HIGH_ADMIN') {
      return { _status: 403, _body: ({ success: false, message: 'Admin cấp cao không gửi thông báo tới học viên' });
    }

    if (isGroup && groupId) {
      const group = await Group.findById(groupId).select('participants').lean();
      if (!group) {
        return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy nhóm chat' });
      }
      const isMember = (group.participants || []).some((p) => String(p.userId) === String(senderId));
      if (!isMember && !isAdminLevelAccount(data.currentUser)) {
        return { _status: 403, _body: ({ success: false, message: 'Bạn không thuộc nhóm chat này' });
      }
    }

    // Enforce contacts matrix cho DM (không áp dụng broadcast/group)
    if (!isBroadcast && !(isGroup && groupId)) {
      const { assertCanDirectMessage } = require('../services/chatAccessService');
      const access = await assertCanDirectMessage(data.currentUser, receiverId, receiverRole);
      if (!access.ok) {
        return { _status: 403, _body: ({ success: false, message: access.message || 'Không được nhắn tin đến người này' });
      }
    }

    let conversationId;
    if (isGroup && groupId) {
      conversationId = `group_${groupId}`;
    } else if (isBroadcast) {
      conversationId = data.conversationId || [`${senderRole}_${senderId}`, `system_${String(receiverId).replace(/[^a-zA-Z0-9_]/g, '_')}`].sort().join('__');
    } else {
      // Luôn tính từ server (bỏ qua client) để HV→staff có conversationId riêng, không gộp nhầm với hộp admin
      conversationId = buildConversationId(senderRole, senderId, receiverRole, receiverId);
    }

    // Tìm branchCode của cả 2 bên để lưu vào Message (Cần check ID hợp lệ tránh lỗi findById('admin'))
    const Teacher = require('../../teacher/models/Teacher');
    const Student = require('../../student/models/Student');
    const mongoose = require('mongoose');
    
    let sBranch = '';
    if (senderId === 'admin') {
      sBranch = 'HỆ THỐNG';
    } else if (mongoose.Types.ObjectId.isValid(senderId)) {
      if (senderRole === 'teacher' || senderRole === 'admin' || senderRole === 'staff') {
        const t = await Teacher.findById(senderId).select('branchCode').lean();
        sBranch = t?.branchCode || '';
      } else if (senderRole === 'student') {
        const s = await Student.findById(senderId).select('branchCode').lean();
        sBranch = s?.branchCode || '';
      }
    }

    let rBranch = '';
    let resolvedReceiverName = receiverName;
    if (!isGroup) {
      if (receiverId === 'admin') {
        rBranch = 'HỆ THỐNG';
        if (!resolvedReceiverName) resolvedReceiverName = 'Admin';
      } else if (mongoose.Types.ObjectId.isValid(receiverId)) {
        if (receiverRole === 'teacher' || receiverRole === 'admin' || receiverRole === 'staff') {
          const t = await Teacher.findById(receiverId).select('branchCode name').lean();
          rBranch = t?.branchCode || '';
          if (!resolvedReceiverName) resolvedReceiverName = t?.name || 'Người nhận';
        } else if (receiverRole === 'student') {
          const s = await Student.findById(receiverId).select('branchCode name').lean();
          rBranch = s?.branchCode || '';
          if (!resolvedReceiverName) resolvedReceiverName = s?.name || 'Học viên';
        }
      }
    }
    if (!resolvedReceiverName && !isBroadcast && !isGroup) {
      resolvedReceiverName = 'Người nhận';
    }

    // ⭐ CHỐNG CHÉO CHI NHÁNH (Cross-Branch Protection)
    const isSuperAdmin = isAdminLevelAccount(data.currentUser);
    if (!isSuperAdmin && (senderRole === 'admin' || senderRole === 'staff') && receiverRole === 'student') {
        // Staff messaging student
        if (sBranch && rBranch && sBranch !== rBranch) {
            return { _status: 403, _body: ({ success: false, message: 'Bạn không được phép nhắn tin cho học viên chi nhánh khác' });
        }
    }

    let finalSenderId = senderId;
    let finalSenderName = senderName || 'Admin';
    
    let finalReceiverId = isBroadcast ? receiverId : (isGroup ? groupId : receiverId);
    let finalReceiverName = isBroadcast ? 'Thông báo hệ thống' : (isGroup ? 'Group' : (resolvedReceiverName || 'Người nhận'));
    if (!isBroadcast && !isGroup && senderRole === 'student' && (receiverRole === 'admin' || receiverRole === 'staff' || receiverRole === 'support')) {
      const rid = String(receiverId || '');
      if (rid === 'admin' || !mongoose.Types.ObjectId.isValid(rid)) {
        finalReceiverId = 'admin';
        finalReceiverName = resolvedReceiverName || 'Quản trị viên';
      } else {
        finalReceiverId = rid;
        finalReceiverName = resolvedReceiverName || 'Nhân viên';
      }
    }

    const message = await Message.create({
      conversationId, 
      senderId: finalSenderId, 
      senderName: finalSenderName, 
      senderRole,
      senderBranchCode: sBranch,
      receiverId: finalReceiverId, 
      receiverName: finalReceiverName, 
      receiverRole: isBroadcast ? 'system' : (isGroup ? 'admin' : receiverRole), 
      receiverBranchCode: rBranch,
      content,
      messageType: messageType || 'text',
      fileUrl: fileUrl || '',
      fileName: fileName || '',
      isGroup: isGroup || false,
      groupId: isGroup ? groupId : null,
    });

    // Cập nhật Group lastMessage
    if (isGroup && groupId) {
      await Group.findByIdAndUpdate(groupId, {
        lastMessage: { content, senderName, sentAt: new Date() }
      });
    }

    // Chỉ bỏ ẩn cho người gửi/nhận — không reset ẩn của user khác
    const unhideIds = [...new Set(
      [finalSenderId, finalReceiverId, senderId]
        .filter(Boolean)
        .map(String)
    )];
    if (unhideIds.length) {
      await ConversationVisibility.findOneAndUpdate(
        { conversationId },
        { $pullAll: { hiddenByUsers: unhideIds } },
        { upsert: true }
      );
    }

    // Gửi qua Socket.io real-time
    const io = data.app.get('io');
    const clientMessage = toClientMessage(message);
    if (io) {
      if (isGroup && groupId) {
        // Phát cho cả room group
        io.to(`group_${groupId}`).emit('message:receive', clientMessage);
      } else {
        // 1. Gửi cho người nhận (dùng bản đã lưu — receiverId có thể là 'admin' hoặc ObjectId staff/admin cụ thể)
        data.app.notifyUser(message.receiverRole, message.receiverId, 'message:receive', clientMessage);

        // 2. Confirm lại cho người gửi (để UI gửi xong cập nhật)
        // Luôn gửi confirm cho mọi sender (bao gồm admin/staff) - BUG-14 fix
        data.app.notifyUser(senderRole, senderId, 'message:sent', clientMessage);
      }
    }

    return { _status: 201, _body: ({ success: true, data: clientMessage });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_hide_conversationId(data) {
  try {
    const { conversationId } = data.params;
    const userId = data.currentUser.id;

    await ConversationVisibility.findOneAndUpdate(
      { conversationId },
      { $addToSet: { hiddenByUsers: userId } },
      { upsert: true, returnDocument: 'after' }
    );
    return { _status: 200, _body: ({ success: true, message: 'Đã ẩn cuộc trò chuyện' });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async put_read_conversationId(data) {
  try {
    const mongoose = require('mongoose');
    const { conversationId } = data.params;
    const readerId = data.currentUser.id;
    const isStaffOrAdmin = data.currentUser.role === 'admin' || isStaffAccount(data.currentUser);
    const isGroupConv = String(conversationId || '').startsWith('group_');
    let allowed = false;
    if (isGroupConv) {
      const groupId = String(conversationId).slice('group_'.length);
      if (mongoose.Types.ObjectId.isValid(groupId)) {
        const g = await Group.findOne({
          _id: groupId,
          'participants.userId': String(readerId),
        }).select('_id').lean();
        allowed = !!g;
      }
    } else {
      const parts = String(conversationId || '').split('__').filter(Boolean);
      const hasSelf = parts.some((p) => p.endsWith(`_${readerId}`));
      if (hasSelf) allowed = true;
      else if (isStaffOrAdmin && isAdminLevelAccount(data.currentUser) && parts.includes('admin_admin')) {
        allowed = true;
      }
    }
    if (!allowed) {
        return { _status: 403, _body: ({ success: false, message: 'Thao tác không hợp lệ' });
    }

    const receiverTargets = isAdminLevelAccount(data.currentUser)
      ? ['admin', String(readerId)]
      : [String(readerId)];

    const filter = isGroupConv
      ? { conversationId, isRead: false, senderId: { $nin: receiverTargets } }
      : { conversationId, receiverId: { $in: receiverTargets }, isRead: false };

    await Message.updateMany(
      filter,
      { $set: { isRead: true, readAt: new Date() } }
    );
    return { _status: 200, _body: ({ success: true, message: 'Đã đánh dấu đọc' });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async patch_messageId_reaction(data) {
  try {
    const { messageId } = data.params;
    const { type } = data.body; // 'heart' or 'like'
    const userId = data.currentUser.id;
    const userName = data.currentUser.name;

    const message = await Message.findById(messageId);
    if (!message) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy tin nhắn' });

    // BUG-04: Kiểm tra user thuộc cuộc hội thoại
    if (message.isGroup && message.groupId) {
      const group = await Group.findById(message.groupId).select('participants').lean();
      const isMember = group && (group.participants || []).some(p => String(p.userId) === String(userId));
      if (!isMember && !isAdminLevelAccount(data.currentUser)) {
        return { _status: 403, _body: ({ success: false, message: 'Bạn không thuộc nhóm chat này' });
      }
    } else {
      const isParticipant = String(message.senderId) === String(userId) ||
        String(message.receiverId) === String(userId) ||
        (isAdminLevelAccount(data.currentUser) && (message.senderId === 'admin' || message.receiverId === 'admin'));
      if (!isParticipant) {
        return { _status: 403, _body: ({ success: false, message: 'Bạn không thuộc cuộc hội thoại này' });
      }
    }

    // Kiểm tra đã có reaction chưa
    const existingIdx = message.reactions.findIndex(r => r.userId === userId && r.type === type);
    
    if (existingIdx >= 0) {
      // Bỏ reaction
      message.reactions.splice(existingIdx, 1);
    } else {
      // Thêm reaction
      message.reactions.push({ type, userId, userName });
    }

    await message.save();

    // Phát real-time via Socket.io
    const io = data.app.get('io');
    if (io) {
      if (message.isGroup && message.groupId) {
        io.to(`group_${message.groupId}`).emit('message:reaction', { 
           messageId: message._id, 
           reactions: message.reactions,
           groupId: message.groupId,
           conversationId: message.conversationId 
        });
      } else {
        // BUG-16: Parse conversationId đúng bằng indexOf thay vì split
        const parts = (message.conversationId || '').split('__');
        parts.forEach(p => {
          if (!p) return;
          const sepIdx = p.indexOf('_');
          if (sepIdx <= 0) return;
          const role = p.slice(0, sepIdx);
          const id = p.slice(sepIdx + 1);
          if (role && id) {
            data.app.notifyUser(role, id, 'message:reaction', { 
              messageId: message._id, 
              reactions: message.reactions,
              conversationId: message.conversationId 
            });
          }
        });
      }
    }

    return { _status: 200, _body: ({ success: true, data: message.reactions });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async patch_messageId_recall(data) {
  try {
    const { messageId } = data.params;
    const userId = data.currentUser.id;

    const message = await Message.findById(messageId);
    if (!message) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy tin nhắn' });

    const isStaffOrAdmin = data.currentUser.role === 'admin' || isStaffAccount(data.currentUser);
    const senderMatch = String(message.senderId) === String(userId) || 
      (isStaffOrAdmin && (message.senderId === 'admin' || String(message.senderId) === String(userId)));
    if (!senderMatch) {
      return { _status: 403, _body: ({ success: false, message: 'Bạn không có quyền thu hồi tin nhắn này' });
    }

    // 24h limit check
    const now = new Date();
    const sentAt = new Date(message.createdAt);
    const diffHours = (now - sentAt) / (1000 * 60 * 60);
    if (diffHours > 24) {
      return { _status: 403, _body: ({ success: false, message: 'Chỉ có thể thu hồi tin nhắn trong vòng 24 giờ kể từ lúc gửi' });
    }

    // BUG-11: Xóa file đính kèm khi thu hồi
    if (['file', 'image'].includes(message.messageType) && message.fileUrl && !message.fileExpired) {
      const { expireMessageFile } = require('../../../utils/messageFileRetention');
      await expireMessageFile(message, { save: false });
    }

    message.isRecalled = true;
    message.content = 'Tin nhắn đã được thu hồi';
    await message.save();

    const io = data.app.get('io');
    if (io) {
      if (message.isGroup && message.groupId) {
        io.to(`group_${message.groupId}`).emit('message:recall', { 
           messageId: message._id, 
           groupId: message.groupId 
        });
      } else {
        // BUG-08: Parse conversationId đúng bằng indexOf thay vì split('_')
        const parts = (message.conversationId || '').split('__');
        parts.forEach(p => {
          if (!p) return;
          const sepIdx = p.indexOf('_');
          if (sepIdx <= 0) return;
          const role = p.slice(0, sepIdx);
          const id = p.slice(sepIdx + 1);
          if (role && id) {
            data.app.notifyUser(role, id, 'message:recall', { 
              messageId: message._id, 
              conversationId: message.conversationId 
            });
          }
        });
      }
    }

    return { _status: 200, _body: ({ success: true, data: message });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async patch_messageId_soft_delete(data) {
  try {
    const { messageId } = data.params;
    const userId = data.currentUser.id;

    const message = await Message.findById(messageId);
    if (!message) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy tin nhắn' });

    // BUG-04: Kiểm tra user thuộc cuộc hội thoại trước khi cho xóa
    if (message.isGroup && message.groupId) {
      const group = await Group.findById(message.groupId).select('participants').lean();
      const isMember = group && (group.participants || []).some(p => String(p.userId) === String(userId));
      if (!isMember && !isAdminLevelAccount(data.currentUser)) {
        return { _status: 403, _body: ({ success: false, message: 'Bạn không thuộc nhóm chat này' });
      }
    } else {
      const isParticipant = String(message.senderId) === String(userId) ||
        String(message.receiverId) === String(userId) ||
        (isAdminLevelAccount(data.currentUser) && (message.senderId === 'admin' || message.receiverId === 'admin'));
      if (!isParticipant) {
        return { _status: 403, _body: ({ success: false, message: 'Bạn không thuộc cuộc hội thoại này' });
      }
    }

    // Thêm userId vào mảng hiddenFor nếu chưa có
    if (!message.hiddenFor) message.hiddenFor = [];
    if (!message.hiddenFor.includes(userId)) {
      message.hiddenFor.push(userId);
      await message.save();
    }

    return { _status: 200, _body: ({ success: true, message: 'Đã xóa tin nhắn', data: message.hiddenFor });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_groups(data) {
  try {
    if (data.currentUser.role === 'student') {
        return { _status: 403, _body: ({ success: false, message: 'Học viên không có quyền tạo nhóm' });
    }
    const { name, participants } = data.body;

    // BUG-03: Validate tên nhóm
    if (!name || typeof name !== 'string' || !name.trim()) {
      return { _status: 400, _body: ({ success: false, message: 'Tên nhóm không được để trống' });
    }

    // BUG-03: Validate & sanitize participants
    if (!Array.isArray(participants) || participants.length === 0) {
      return { _status: 400, _body: ({ success: false, message: 'Danh sách thành viên không hợp lệ' });
    }
    const validRoles = ['admin', 'teacher', 'student', 'staff'];
    const sanitizedParticipants = participants
      .filter(p => p && typeof p === 'object' && p.userId && p.name && validRoles.includes(p.role))
      .map(p => ({
        userId: String(p.userId).slice(0, 50),
        name: String(p.name).slice(0, 100),
        role: p.role,
        joinedAt: new Date(),
      }));
    if (sanitizedParticipants.length === 0) {
      return { _status: 400, _body: ({ success: false, message: 'Không có thành viên hợp lệ' });
    }

    const group = await Group.create({
      name: String(name).trim().slice(0, 100),
      participants: [...sanitizedParticipants, { userId: data.currentUser.id, name: data.currentUser.name, role: data.currentUser.role }],
      createdBy: { userId: data.currentUser.id, name: data.currentUser.name }
    });

    const io = data.app.get('io');
    if (io) {
      group.participants.forEach(p => {
        data.app.notifyUser(p.role, p.userId.toString(), 'group:new', group);
      });
    }

    return { _status: 201, _body: ({ success: true, data: group });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_groups_user_userId(data) {
  try {
    const targetId = String(data.userId || '');
    const isSelf = String(data.currentUser.id) === targetId;
    const isAdminOrStaff = data.currentUser.role === 'admin' || data.currentUser.role === 'staff';
    if (!isSelf && !isAdminOrStaff) {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền xem nhóm của người khác' });
    }
    const groups = await Group.find({ 'participants.userId': data.userId }).sort({ updatedAt: -1 });
    return { _status: 200, _body: ({ success: true, data: groups });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async delete_groups_groupId(data) {
  try {
    if (data.currentUser.role === 'student') {
        return { _status: 403, _body: ({ success: false, message: 'Học viên không có quyền xóa nhóm' });
    }
    const { groupId } = data.params;

    // BUG-02: Kiểm tra quyền — chỉ creator hoặc SuperAdmin mới được xóa nhóm
    const group = await Group.findById(groupId).select('createdBy').lean();
    if (!group) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy nhóm' });
    }
    const isCreator = String(group.createdBy?.userId) === String(data.currentUser.id);
    if (!isCreator && !isAdminLevelAccount(data.currentUser)) {
      return { _status: 403, _body: ({ success: false, message: 'Chỉ người tạo nhóm hoặc Super Admin mới có quyền xóa nhóm' });
    }
    
    // Xóa tất cả tin nhắn của nhóm này
    await Message.deleteMany({ conversationId: `group_${groupId}` });
    
    // Xóa Group
    await Group.findByIdAndDelete(groupId);

    return { _status: 200, _body: ({ success: true, message: 'Đã xóa nhóm vĩnh viễn' });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_unread_userId(data) {
  try {
    const { userId } = data.params;
    if (data.currentUser.id !== userId) {
       return { _status: 403, _body: ({ success: false, message: 'Quyền truy cập bị từ chối' });
    }
    const receiverTargets = isAdminLevelAccount(data.currentUser) ? ['admin', String(userId)] : [String(userId)];
    const count = await Message.countDocuments({
      receiverId: { $in: receiverTargets },
      isRead: false,
    });
    return { _status: 200, _body: ({ success: true, data: { unreadCount: count } });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_broadcast(data) {
  try {
    const { role: userRole, id: userId, adminRole, name: userName } = data.currentUser;
    const { targetRole, content, messageType = 'text', fileUrl, fileName } = data.body;

    // Chỉ Admin hoặc STAFF mới được gửi broadcast
    if (userRole !== 'admin' && userRole !== 'staff') {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền thực hiện' });
    }
    if (adminRole === 'HIGH_ADMIN' && targetRole === 'student') {
      return { _status: 403, _body: ({ success: false, message: 'Admin cấp cao không gửi thông báo tới học viên' });
    }

    if (!['student', 'teacher', 'admin'].includes(targetRole)) {
      return { _status: 400, _body: ({ success: false, message: 'Đối tượng nhận không hợp lệ' });
    }

    if (!content && messageType === 'text') {
      return { _status: 400, _body: ({ success: false, message: 'Nội dung không được trống' });
    }

    // Lấy branchId của người gửi (nếu là STAFF thì chỉ gửi trong branch đó)
    let senderDoc = null;
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(userId)) {
      senderDoc = await Teacher.findById(userId).select('branchId branchCode').lean();
    }
    const branchFilter = (adminRole === 'STAFF' && senderDoc?.branchId) 
      ? { branchId: senderDoc.branchId } 
      : {};

    let targets = [];
    if (targetRole === 'student') {
      targets = await Student.find(branchFilter, '_id name phone branchCode').lean();
    } else if (targetRole === 'teacher') {
      targets = await Teacher.find({ role: 'teacher', status: { $in: ['Active', 'active'] }, ...branchFilter }, '_id name phone branchCode').lean();
    } else if (targetRole === 'admin') {
      // Gửi cho toàn bộ Admin/Staff
      targets = await Teacher.find({ role: { $in: ['admin', 'staff'] }, ...branchFilter }, '_id name phone adminRole branchCode').lean();
    }

    const io = data.app.get('io');
    const results = [];

    // BUG-07: Tạo tin nhắn hàng loạt bằng insertMany thay vì loop save
    const bulkDocs = [];
    for (const target of targets) {
      if (target._id.toString() === userId) continue;

      const receiverId = target._id.toString();
      const receiverName = target.name;
      const receiverRole = (targetRole === 'admin') 
        ? (target.adminRole === 'STAFF' ? 'staff' : 'admin') 
        : targetRole;

      const conversationId = buildConversationId(userRole, userId, receiverRole, receiverId);

      bulkDocs.push({
        conversationId,
        senderId: userId,
        senderName: userName || 'Người gửi',
        senderRole: userRole,
        senderBranchCode: senderDoc?.branchCode || '',
        receiverId,
        receiverName,
        receiverRole,
        receiverBranchCode: target.branchCode || '',
        content,
        messageType,
        fileUrl: fileUrl || '',
        fileName: fileName || '',
      });
    }

    // Batch insert (tối đa 200 mỗi lần để tránh quá tải)
    const BATCH_SIZE = 200;
    for (let i = 0; i < bulkDocs.length; i += BATCH_SIZE) {
      const batch = bulkDocs.slice(i, i + BATCH_SIZE);
      const saved = await Message.insertMany(batch, { ordered: false });
      results.push(...saved);
    }

    // Emit socket real-time cho từng người nhận
    if (io) {
      for (const msg of results) {
        const msgPayload = toClientMessage(msg);
        io.to(String(msg.receiverId)).emit('message:receive', msgPayload);
      }
      // Đồng bộ 1 lần cho admin/staff
      if (results.length > 0) {
        const lastPayload = toClientMessage(results[results.length - 1]);
        io.to('ALL_ADMIN').emit('message:receive', lastPayload);
        io.to('ALL_STAFF').emit('message:receive', lastPayload);
      }
    }

    return { _status: 200, _body: ({ 
      success: true, 
      message: `Đã gửi tin nhắn tới ${results.length} người dùng.`,
      count: results.length 
    });

  } catch (err) {
    logger.error('[BROADCAST] Error:', err);
    return { _status: 500, _body: ({ success: false, message: 'Lỗi hệ thống khi gửi broadcast' });
  }
}

}

module.exports = new ChatApplicationService();
