const express = require('express');
const router  = express.Router();
const Message = require('../models/Message');
const Group   = require('../../student/models/Group');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
console.log('--- MESSAGE ROUTES LOADED ---', typeof authMiddleware);
router.use(authMiddleware);

const Student = require('../../student/models/Student');
const Teacher = require('../../teacher/models/Teacher');
const ConversationVisibility = require('../models/ConversationVisibility');
const logger = require('../../../config/logger');
const { buildConversationId } = require('../../../utils/chatConversationId');
const { sanitizeMessages, sanitizeMessageDoc } = require('../../../utils/messageFileRetention');
const { normalizeMulterFile } = require('../../../utils/escapeRegex');
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
router.get('/contacts',chatController.get_contacts);


// ── Lấy danh sách cuộc trò chuyện ──
router.get('/conversations/:userId',chatController.get_conversations_userId);

// ── Tìm kiếm tin nhắn toàn cục (bỏ qua is_hidden) ──
router.get('/search/:userId',chatController.get_search_userId);

// ── Lấy danh sách cuộc trò chuyện bị ẨN (phải đặt TRƯỚC /:conversationId vì không thì "hidden" bị coi là conversationId → 403) ──
router.get('/hidden',chatController.get_hidden);

// ── Lấy tin nhắn của cuộc trò chuyện ──
router.get('/:conversationId',chatController.get_conversationId);

// ── Lấy toàn bộ tin nhắn của một user (để đồng bộ) ──
router.get('/sync/:userId',chatController.get_sync_userId);


const multer = require('multer');

// Create uploads/messages folder if not exists
const uploadDir = 'uploads/messages';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMsgExt = /\.(jpe?g|png|gif|webp|pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|mp4|webm|mp3|wav)$/i;
const allowedMsgMime = /^(image\/(jpeg|png|gif|webp)|application\/pdf|application\/zip|application\/x-zip-compressed|application\/x-rar-compressed|application\/vnd\.rar|application\/x-7z-compressed|application\/vnd\.|application\/msword|application\/octet-stream|text\/plain|video\/(mp4|webm)|audio\/(mpeg|mp3|wav|x-wav|wave))$/i;
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okMime = allowedMsgMime.test(file.mimetype || '');
    const okExt = allowedMsgExt.test(file.originalname || '');
    // Bắt buộc cả mime và extension (chống spoof một phía)
    if (okMime && okExt) return cb(null, true);
    cb(new Error('Định dạng file không được phép'));
  },
});

// ── Upload file ──
router.post('/upload', upload.single('file'),chatController.post_upload);

// ── Gửi tin nhắn ──
router.post('/',chatController.post_root);

// ── Ẩn cuộc trò chuyện ──
router.post('/hide/:conversationId',chatController.post_hide_conversationId);

// ── Đánh dấu đã đọc ──
router.put('/read/:conversationId',chatController.put_read_conversationId);
router.put('/:conversationId/pin', chatController.put_pinMessage);
router.get('/message/:id', chatController.get_message_ById);

// ── Phản ứng (Reaction) ──
router.patch('/:messageId/reaction',chatController.patch_messageId_reaction);

// ── Thu hồi tin nhắn ──
router.patch('/:messageId/recall',chatController.patch_messageId_recall);

// ── Xóa mềm tin nhắn (Chỉ xóa phía mình) ──
router.patch('/:messageId/soft-delete',chatController.patch_messageId_soft_delete);

// ── Tạo nhóm mới ──
router.post('/groups',chatController.post_groups);

// ── Lấy danh sách nhóm của user ──
router.get('/groups/user/:userId',chatController.get_groups_user_userId);

// ── Xóa nhóm vĩnh viễn ──
router.delete('/groups/:groupId',chatController.delete_groups_groupId);

// ── Lấy số tin nhắn chưa đọc ──
router.get('/unread/:userId',chatController.get_unread_userId);


// ══ POST /api/chat/broadcast  ──  Gửi tin nhắn hàng loạt ══
router.post('/broadcast',chatController.post_broadcast);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File quá lớn (tối đa 50MB).' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.message === 'Định dạng file không được phép') {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

module.exports = router;



