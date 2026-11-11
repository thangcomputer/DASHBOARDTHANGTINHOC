const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const FeedPost = require('../models/FeedPost');
const FeedPostReport = require('../models/FeedPostReport');
const Student = require('../models/Student');
const { statusOf } = require('../services/subscriptionService');
const { REACTION_TYPES } = require('../models/FeedPost');
const { authMiddleware } = require('../middleware/auth');
const { policyShadowFeed } = require('../middleware/policyShadowFeed');
const { feedCutoverGate } = require('../middleware/feedCutoverGate');
const logger = require('../config/logger');
const NotificationService = require('../services/NotificationService');

/** Phase 7.17: auth → policyShadowFeed → feedCutoverGate → handler */
function feedGuard(action) {
  return [policyShadowFeed(action), feedCutoverGate(action)];
}

function normalizeRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'staff') return 'staff';
  if (r === 'admin') return 'admin';
  if (r === 'teacher') return 'teacher';
  return 'student';
}

function isSuperAdminUser(user) {
  if (!user) return false;
  const uid = String(user.id || user._id || '');
  const adminRole = String(user.adminRole || '').toUpperCase();
  return uid === 'admin' || adminRole === 'SUPER_ADMIN';
}

function isHighAdminUser(user) {
  if (!user) return false;
  const adminRole = String(user.adminRole || '').toUpperCase();
  return adminRole === 'HIGH_ADMIN';
}

function isSuperAdminAuthor(authorId, authorAdminRole, authorRole) {
  const uid = String(authorId || '');
  const aRole = String(authorAdminRole || '').toUpperCase();
  return uid === 'admin' || aRole === 'SUPER_ADMIN';
}

function isAdminLike(user) {
  const r = normalizeRole(user?.role);
  return r === 'admin' || r === 'staff' || isSuperAdminUser(user) || isHighAdminUser(user);
}

function canEditPost(user, post) {
  if (!user || !post) return false;
  if (isSuperAdminUser(user)) return true;
  return String(post.authorId) === String(user.id || user._id);
}

function buildFeedFilter(user) {
  if (!user) return { visibility: 'public' };
  const r = normalizeRole(user.role);
  const uid = String(user.id || user._id || '');
  if (isSuperAdminUser(user) || isHighAdminUser(user) || r === 'admin' || r === 'staff') {
    return {};
  }
  if (r === 'teacher') {
    return {
      $or: [
        { visibility: { $in: ['public', 'teachers'] } },
        { visibility: { $exists: false } },
        { visibility: null },
        { authorId: uid },
      ],
    };
  }
  if (r === 'student') {
    return {
      $or: [
        { visibility: { $in: ['public', 'students'] } },
        { visibility: { $exists: false } },
        { visibility: null },
        { authorId: uid },
      ],
    };
  }
  return {
    $or: [
      { visibility: 'public' },
      { visibility: { $exists: false } },
      { visibility: null },
      { authorId: uid },
    ],
  };
}

function canDeletePost(user, post) {
  if (!user || !post) return false;
  const isPostAuthor = String(post.authorId) === String(user.id || user._id);
  const isPostFromSuper = isSuperAdminAuthor(post.authorId, post.authorAdminRole, post.authorRole);

  // 1. Bài của Super Admin: CHỈ Super Admin mới xóa được
  if (isPostFromSuper) {
    return isSuperAdminUser(user);
  }

  // 2. Tác giả tự xóa bài của mình
  if (isPostAuthor) return true;

  // 3. Super Admin và High Admin xóa được bài của người khác
  if (isSuperAdminUser(user) || isHighAdminUser(user)) return true;

  // 4. Người khác không được xóa bài của người khác
  return false;
}

function emitFeed(io, event, payload) {
  if (!io) return;
  const visibility = payload?.visibility || 'public';
  if (event === 'feed:deleted' || event === 'feed:like' || event === 'feed:comment' || visibility === 'public') {
    io.to('feed_room').emit(event, payload);
    return;
  }
  let emitter = io;
  if (visibility === 'admin_only') {
    emitter = io.to('ALL_ADMIN').to('ALL_STAFF').to('admin_room');
  } else if (visibility === 'teachers') {
    emitter = io.to('ALL_ADMIN').to('ALL_STAFF').to('admin_room').to('ALL_TEACHER');
  } else if (visibility === 'students') {
    emitter = io.to('ALL_ADMIN').to('ALL_STAFF').to('admin_room').to('ALL_STUDENT');
  }
  if (payload?.authorId) {
    emitter = emitter.to(String(payload.authorId));
  }
  emitter.emit(event, payload);
}

async function notifyFeedAuthor(req, post, interactionType, details = {}) {
  const actorId = String(req.user?.id || req.user?._id || '');
  const isReply = interactionType === 'reply';
  const recipients = new Map();
  const postAuthorId = String(post.authorId || '');
  if (postAuthorId && postAuthorId !== actorId) {
    recipients.set(postAuthorId, post.authorRole);
  }
  const commentAuthorId = String(details.commentAuthorId || '');
  if (isReply && commentAuthorId && commentAuthorId !== actorId) {
    recipients.set(commentAuthorId, details.commentAuthorRole || 'student');
  }
  if (!recipients.size) return;

  const actorName = String(req.user?.name || 'Một người dùng').trim();
  const content = interactionType === 'comment'
    ? `${actorName} đã bình luận: ${details.content || 'đã thêm hình ảnh'}`
    : isReply
      ? `${actorName} đã trả lời bình luận của bạn: ${details.content || 'đã thêm hình ảnh'}`
      : `${actorName} đã bày tỏ cảm xúc về bài viết của bạn.`;

  await Promise.all([...recipients].map(async ([receiverId, receiverRole]) => {
    const normalizedRole = String(receiverRole || '').toLowerCase();
    const webRole = normalizedRole === 'admin' || normalizedRole === 'staff'
      ? 'admin'
      : normalizedRole === 'teacher' ? 'teacher' : 'student';
    try {
      await NotificationService.send(req.app.get('io'), {
        type: 'SYSTEM',
        title: interactionType === 'comment'
          ? 'Bình luận mới trên bài viết'
          : isReply ? 'Có người trả lời bình luận của bạn' : 'Cảm xúc mới trên bài viết',
        content: content.slice(0, 500),
        sender_id: actorId,
        receivers: [receiverId],
        payload: {
          kind: 'feed_interaction',
          interactionType,
          postId: String(post._id),
          ...(details.commentId ? { commentId: details.commentId } : {}),
          ...(details.parentCommentId ? { parentCommentId: details.parentCommentId } : {}),
          ...(details.reactionType ? { reactionType: details.reactionType } : {}),
        },
        link: `/${webRole}/feed?postId=${encodeURIComponent(String(post._id))}${details.commentId ? `&commentId=${encodeURIComponent(details.commentId)}` : ''}${details.parentCommentId ? `&parentCommentId=${encodeURIComponent(details.parentCommentId)}` : ''}`,
      });
    } catch (error) {
      logger.error('[FEED] author notification error', {
        error,
        postId: String(post._id),
        receiverId,
        interactionType,
      });
    }
  }));
}

const _feedHits = new Map();
function feedRateOk(userId, action, max, windowMs) {
  const key = action + ':' + String(userId || '');
  const now = Date.now();
  let arr = _feedHits.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    _feedHits.set(key, arr);
    return false;
  }
  arr.push(now);
  _feedHits.set(key, arr);
  return true;
}

function canDeleteComment(user, post, comment) {
  if (!user || !comment) return false;
  const isCommentAuthor = String(comment.authorId) === String(user.id || user._id);
  const isCommentFromSuper = isSuperAdminAuthor(comment.authorId, comment.authorAdminRole, comment.authorRole);

  // 1. Bình luận của Super Admin: CHỈ Super Admin mới xóa được (không ai khác được xóa)
  if (isCommentFromSuper) {
    return isSuperAdminUser(user);
  }

  // 2. Tác giả tự xóa bình luận của chính mình
  if (isCommentAuthor) return true;

  // 3. Super Admin và High Admin xóa được bình luận của tất cả mọi người
  if (isSuperAdminUser(user) || isHighAdminUser(user)) return true;

  // 4. Chủ bài viết (nếu không phải comment của Super Admin) có thể xóa comment trong bài mình
  if (post && String(post.authorId) === String(user.id || user._id)) return true;

  // 5. Người khác không được xóa bình luận của người khác
  return false;
}

function normalizeReactions(o) {
  let reactions = Array.isArray(o.reactions) ? [...o.reactions] : [];
  if (!reactions.length && Array.isArray(o.likes) && o.likes.length) {
    reactions = o.likes.map((l) => ({
      userId: l.userId,
      userName: l.userName || '',
      role: l.role || '',
      type: 'heart',
    }));
  }
  return reactions;
}

function existingFeedAvatar(value) {
  const avatar = String(value || '').trim();
  if (!avatar || !avatar.startsWith('/uploads/')) return avatar;
  const diskPath = path.join(__dirname, '..', avatar.replace(/^\/+/, ''));
  return fs.existsSync(diskPath) ? avatar : '';
}

function serializePost(doc, currentUserId) {
  const o = doc.toObject ? doc.toObject() : doc;
  const reactions = normalizeReactions(o);
  const uid = String(currentUserId || '');
  const counts = { heart: 0, like: 0, haha: 0, wow: 0, sad: 0 };
  let myReaction = null;
  for (const r of reactions) {
    const t = REACTION_TYPES.includes(r.type) ? r.type : 'heart';
    counts[t] = (counts[t] || 0) + 1;
    if (String(r.userId) === uid) myReaction = t;
  }
  const total = reactions.length;

  return {
    id: String(o._id),
    authorId: o.authorId,
    authorName: o.authorName,
    authorRole: o.authorRole,
    authorAdminRole: o.authorAdminRole || (String(o.authorId) === 'admin' ? 'SUPER_ADMIN' : null),
    authorAvatar: existingFeedAvatar(o.authorAvatar),
    authorGender: o.authorGender || '',
    content: o.content || '',
    images: o.images || [],
    visibility: o.visibility || 'public',
    isPinned: !!o.isPinned,
    pinnedAt: o.pinnedAt || null,
    isEdited: !!o.isEdited,
    editedAt: o.editedAt || null,
    reactions: counts,
    reactionsCount: total,
    reactionsList: reactions.map((r) => ({
      userId: String(r.userId || ''),
      userName: r.userName || 'Người dùng',
      role: r.role || 'student',
      gender: r.gender || '',
      type: r.type || 'heart',
    })),
    myReaction,
    likesCount: total,
    likedByMe: !!myReaction,
    comments: (o.comments || []).map((c) => ({
      id: String(c._id),
      authorId: c.authorId,
      authorName: c.authorName,
      authorRole: c.authorRole,
      authorAdminRole: c.authorAdminRole || (String(c.authorId) === 'admin' ? 'SUPER_ADMIN' : null),
      authorAvatar: existingFeedAvatar(c.authorAvatar),
      authorGender: c.authorGender || '',
      content: c.content || '',
      images: Array.isArray(c.images) ? c.images : [],
      parentId: c.parentId ? String(c.parentId) : null,
      createdAt: c.createdAt,
    })),
    commentsCount: (o.comments || []).length,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const feedDir = path.join(__dirname, '..', 'uploads', 'feed');
if (!fs.existsSync(feedDir)) fs.mkdirSync(feedDir, { recursive: true });

const feedStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, feedDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'feed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  },
});

const uploadFeed = multer({
  storage: feedStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chi cho phep file anh'));
  },
});

router.post('/upload', authMiddleware, ...feedGuard('upload'), (req, res) => {
  uploadFeed.array('images', 6)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'Anh qua lon (toi da 5MB)' : err.message });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const files = req.files || [];
      if (!files.length) return res.status(400).json({ success: false, message: 'Khong co anh' });
      const urls = files.map((f) => '/uploads/feed/' + f.filename);
      return res.json({ success: true, urls });
    } catch (e) {
      logger.error('[FEED] upload error', e);
      return res.status(500).json({ success: false, message: 'Loi upload' });
    }
  });
});

router.get('/', authMiddleware, ...feedGuard('list'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const query = buildFeedFilter(req.user);
    const [rows, total] = await Promise.all([
      FeedPost.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FeedPost.countDocuments(query),
    ]);
    return res.json({
      success: true,
      data: rows.map((p) => serializePost(p, req.user.id)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    logger.error({ err }, '[FEED] list error');
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

router.get('/reports', authMiddleware, ...feedGuard('report_list'), async (req, res) => {
  try {
    if (!isAdminLike(req.user)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem báo cáo.' });
    const reports = await FeedPostReport.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(100).lean();
    const postIds = [...new Set(reports.map((report) => report.postId))];
    const posts = await FeedPost.find({ _id: { $in: postIds } }).select('_id authorName content visibility').lean();
    const postsById = new Map(posts.map((post) => [String(post._id), post]));
    return res.json({
      success: true,
      data: reports.map((report) => {
        const post = postsById.get(report.postId);
        return {
          id: String(report._id),
          postId: report.postId,
          reporterName: report.reporterName,
          reporterRole: report.reporterRole,
          reason: report.reason,
          details: report.details,
          createdAt: report.createdAt,
          post: post ? { authorName: post.authorName, content: post.content, visibility: post.visibility || 'public' } : null,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, '[FEED] reports list error');
    return res.status(500).json({ success: false, message: 'Không thể tải báo cáo bài viết.' });
  }
});

router.post('/:id/reports', authMiddleware, ...feedGuard('report'), async (req, res) => {
  try {
    const post = await FeedPost.findOne({ _id: req.params.id, ...buildFeedFilter(req.user) });
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    if (String(post.authorId) === String(req.user.id || req.user._id)) {
      return res.status(400).json({ success: false, message: 'Bạn không thể báo cáo bài viết của chính mình.' });
    }
    if (!feedRateOk(req.user.id, 'report', 5, 10 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Bạn đã gửi nhiều báo cáo. Vui lòng thử lại sau.' });
    }
    const reasons = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'];
    const reason = String(req.body?.reason || '');
    const details = String(req.body?.details || '').trim();
    if (!reasons.includes(reason)) return res.status(400).json({ success: false, message: 'Vui lòng chọn lý do báo cáo hợp lệ.' });
    if (details.length > 500) return res.status(400).json({ success: false, message: 'Nội dung bổ sung tối đa 500 ký tự.' });
    const report = await FeedPostReport.create({
      postId: String(post._id),
      reporterId: String(req.user.id || req.user._id),
      reporterName: req.user.name || 'Người dùng',
      reporterRole: normalizeRole(req.user.role),
      reason,
      details,
    });
    return res.status(201).json({ success: true, message: 'Đã gửi báo cáo để trung tâm xem xét.', id: String(report._id) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Bạn đã báo cáo bài viết này rồi.' });
    }
    logger.error({ err }, '[FEED] report create error');
    return res.status(500).json({ success: false, message: 'Không thể gửi báo cáo bài viết.' });
  }
});

router.post('/:id/pin', authMiddleware, ...feedGuard('pin'), async (req, res) => {
  try {
    if (!isAdminLike(req.user)) return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới được ghim thông báo.' });
    const post = await FeedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    if ((post.visibility || 'public') !== 'public') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể ghim thông báo công khai.' });
    }
    post.isPinned = !post.isPinned;
    post.pinnedAt = post.isPinned ? new Date() : null;
    await post.save();
    const data = serializePost(post, req.user.id);
    emitFeed(req.app.get('io'), 'feed:updated', data);
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, '[FEED] pin toggle error');
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái ghim.' });
  }
});

router.post('/reports/:reportId/resolve', authMiddleware, ...feedGuard('resolve_report'), async (req, res) => {
  try {
    if (!isAdminLike(req.user)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xử lý báo cáo.' });
    const action = req.body?.action || 'keep';
    if (!['keep', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Lựa chọn xử lý báo cáo không hợp lệ.' });
    }
    const report = await FeedPostReport.findOne({ _id: req.params.reportId, status: 'pending' });
    if (!report) return res.status(404).json({ success: false, message: 'Báo cáo không tồn tại hoặc đã được xử lý.' });
    const resolvedBy = String(req.user.id || req.user._id);
    const resolvedAt = new Date();
    if (action === 'delete') {
      const post = await FeedPost.findById(report.postId);
      if (post) {
        await post.deleteOne();
        emitFeed(req.app.get('io'), 'feed:deleted', { id: String(post._id) });
      }
      await FeedPostReport.updateMany(
        { postId: report.postId, status: 'pending' },
        { $set: { status: 'reviewed', resolvedBy, resolvedAt } },
      );
      return res.json({ success: true, message: 'Đã xóa bài viết và xử lý các báo cáo liên quan.' });
    }
    await FeedPostReport.updateMany(
      { _id: report._id, status: 'pending' },
      { $set: { status: 'reviewed', resolvedBy, resolvedAt } },
    );
    return res.json({ success: true, message: 'Đã giữ lại bài viết và xử lý báo cáo.' });
  } catch (err) {
    logger.error({ err }, '[FEED] report resolve error');
    return res.status(500).json({ success: false, message: 'Không thể xử lý báo cáo.' });
  }
});

async function canStudentPostFeed(user) {
  if (!user || user.role !== 'student') return true;
  const dbStudent = await Student.findById(user.id || user._id).lean();
  if (!dbStudent) return false;
  const status = statusOf(dbStudent);
  if (status.state === 'expired' || status.state === 'free' || status.freeTier) return false;
  if (status.state === 'active' || status.state === 'expiring') return true;
  if (status.state === 'lifetime') {
    if (dbStudent.freePortal === true) return Boolean(status.meetLifetime || status.activated);
    return true;
  }
  return false;
}

router.post('/', authMiddleware, ...feedGuard('create'), async (req, res) => {
  try {
    if (!await canStudentPostFeed(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'FEED_POST_LOCKED',
        message: 'Chức năng đăng bài chỉ dành cho tài khoản đã mua gói còn hạn. Vui lòng đăng ký hoặc gia hạn gói.',
      });
    }
    const content = String(req.body?.content || '').trim();
    const images = Array.isArray(req.body?.images)
      ? req.body.images.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 6)
      : [];
    const safeVisibilities = ['public', 'teachers', 'students', 'admin_only'];
    const visibility = safeVisibilities.includes(req.body?.visibility) ? req.body.visibility : 'public';

    if (!content && images.length === 0) {
      return res.status(400).json({ success: false, message: 'Nhap noi dung hoac them anh' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ success: false, message: 'Noi dung qua dai' });
    }
    if (!feedRateOk(req.user.id, 'create', 8, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Ban dang bai qua nhanh, thu lai sau' });
    }
    const post = await FeedPost.create({
      authorId: req.user.id,
      authorName: req.user.name || 'Nguoi dung',
      authorRole: normalizeRole(req.user.role),
      authorAdminRole: (req.user.id === 'admin' || req.user.adminRole === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : (req.user.adminRole || null),
        authorGender: req.user.gender || '',
      authorAvatar: req.body?.authorAvatar || req.user.avatar || '',
      content,
      images,
      visibility,
      isEdited: false,
      reactions: [],
      comments: [],
    });
    const data = serializePost(post, req.user.id);
    emitFeed(req.app.get('io'), 'feed:new', { ...data, myReaction: null, likedByMe: false });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('[FEED] create error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

router.put('/:id', authMiddleware, ...feedGuard('update_post'), async (req, res) => {
  try {
    const post = await FeedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Khong tim thay bai viet' });
    if (!canEditPost(req.user, post)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen sua bai viet nay' });
    }

    const content = String(req.body?.content !== undefined ? req.body.content : post.content || '').trim();
    let images = post.images || [];
    if (Array.isArray(req.body?.images)) {
      images = req.body.images.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 6);
    }
    const safeVisibilities = ['public', 'teachers', 'students', 'admin_only'];
    const visibility = safeVisibilities.includes(req.body?.visibility) ? req.body.visibility : (post.visibility || 'public');

    if (!content && images.length === 0) {
      return res.status(400).json({ success: false, message: 'Noi dung hoac anh khong duoc de trong' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ success: false, message: 'Noi dung qua dai' });
    }

    post.content = content;
    post.images = images;
    post.visibility = visibility;
    post.isEdited = true;
    post.editedAt = new Date();

    await post.save();
    const data = serializePost(post, req.user.id);
    emitFeed(req.app.get('io'), 'feed:updated', data);
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[FEED] update error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

router.delete('/:id', authMiddleware, ...feedGuard('delete_post'), async (req, res) => {
  try {
    const post = await FeedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Khong tim thay bai viet' });
    if (!canDeletePost(req.user, post)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xoa bai nay' });
    }
    await post.deleteOne();
    emitFeed(req.app.get('io'), 'feed:deleted', { id: String(req.params.id) });
    return res.json({ success: true, message: 'Da xoa bai viet' });
  } catch (err) {
    logger.error('[FEED] delete error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

async function applyReaction(req, res, typeIn) {
  if (!feedRateOk(req.user.id, 'like', 40, 60 * 1000)) {
    return res.status(429).json({ success: false, message: 'Thao tac qua nhanh, thu lai sau' });
  }
  const type = REACTION_TYPES.includes(typeIn) ? typeIn : 'heart';
  const post = await FeedPost.findById(req.params.id);
  if (!post) return res.status(404).json({ success: false, message: 'Khong tim thay bai viet' });

  if (!Array.isArray(post.reactions)) post.reactions = [];
  // migrate legacy likes once
  if ((!post.reactions || post.reactions.length === 0) && Array.isArray(post.likes) && post.likes.length) {
    post.reactions = post.likes.map((l) => ({
      userId: l.userId, userName: l.userName || '', role: l.role || '', type: 'heart',
    }));
    post.likes = [];
    await post.save();
  }

  const uid = String(req.user.id);
  const isNewReaction = !post.reactions.some((r) => String(r.userId) === uid);
  const entry = {
    userId: uid,
    userName: req.user.name || '',
    role: normalizeRole(req.user.role),
    gender: req.user.gender || '',
    type,
  };
  // Cập nhật nguyên tử trong MongoDB: mỗi user chỉ còn đúng 1 cảm xúc trên bài viết.
  // - Chọn lại đúng cảm xúc đang có -> bỏ cảm xúc.
  // - Chọn cảm xúc khác (hoặc dữ liệu cũ bị trùng) -> xóa mọi bản ghi của user rồi ghi 1 bản ghi mới.
  // Nhờ vậy thao tác nhấn liên tục/đồng thời không thể tạo bản ghi trùng.
  await FeedPost.updateOne({ _id: post._id }, [{
    $set: {
      reactions: {
        $let: {
          vars: {
            current: { $ifNull: ['$reactions', []] },
          },
          in: {
            $let: {
              vars: {
                mine: { $filter: { input: '$$current', as: 'r', cond: { $eq: ['$$r.userId', { $literal: uid }] } } },
                others: { $filter: { input: '$$current', as: 'r', cond: { $ne: ['$$r.userId', { $literal: uid }] } } },
              },
              in: {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $size: '$$mine' }, 1] },
                      { $eq: [{ $arrayElemAt: ['$$mine.type', 0] }, { $literal: type }] },
                    ],
                  },
                  '$$others',
                  { $concatArrays: ['$$others', [{ $literal: entry }]] },
                ],
              },
            },
          },
        },
      },
    },
  }], { updatePipeline: true });
  const updatedPost = await FeedPost.findById(post._id);
  if (!updatedPost) return res.status(404).json({ success: false, message: 'Khong tim thay bai viet' });
  if (isNewReaction) {
    await notifyFeedAuthor(req, updatedPost, 'reaction', { reactionType: type });
  }
  const data = serializePost(updatedPost, req.user.id);
  emitFeed(req.app.get('io'), 'feed:like', {
    id: data.id,
    reactions: data.reactions,
    reactionsCount: data.reactionsCount,
    reactionsList: data.reactionsList,
    likesCount: data.likesCount,
    byUserId: uid,
  });
  return res.json({ success: true, data });
}

router.post('/:id/like', authMiddleware, ...feedGuard('like'), async (req, res) => {
  try {
    return await applyReaction(req, res, req.body?.type || 'heart');
  } catch (err) {
    logger.error('[FEED] like error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

router.post('/:id/react', authMiddleware, ...feedGuard('react'), async (req, res) => {
  try {
    return await applyReaction(req, res, req.body?.type || 'heart');
  } catch (err) {
    logger.error('[FEED] react error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

router.post('/:id/comments', authMiddleware, ...feedGuard('comment'), async (req, res) => {
  try {
    if (!await canStudentPostFeed(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'FEED_POST_LOCKED',
        message: 'Chức năng bình luận chỉ dành cho tài khoản đã mua gói còn hạn. Vui lòng đăng ký hoặc gia hạn gói.',
      });
    }
    if (!feedRateOk(req.user.id, 'comment', 20, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Binh luan qua nhanh, thu lai sau' });
    }
    const content = String(req.body?.content || '').trim();
    const images = Array.isArray(req.body?.images)
      ? req.body.images.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    let parentId = req.body?.parentId ? String(req.body.parentId) : null;

    if (!content && images.length === 0) {
      return res.status(400).json({ success: false, message: 'Nhap noi dung hoac them anh' });
    }
    if (content.length > 2000) return res.status(400).json({ success: false, message: 'Binh luan qua dai' });

    const post = await FeedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Khong tim thay bai viet' });

    if ((post.comments || []).length >= 500) {
      return res.status(400).json({ success: false, message: 'Bai viet da dat gioi han 500 binh luan' });
    }

    // Chi cho phep URL anh noi bo /uploads/feed/
    const safeImages = images.filter((u) => {
      try {
        if (u.startsWith('/uploads/feed/')) return true;
        if (u.startsWith('uploads/feed/')) return true;
        const parsed = new URL(u, 'http://local');
        return parsed.pathname.startsWith('/uploads/feed/');
      } catch {
        return false;
      }
    });

    if (parentId) {
      const parent = post.comments.id(parentId);
      if (!parent) return res.status(404).json({ success: false, message: 'Khong tim thay binh luan goc' });
      parentId = String(parent._id);
    }
    const parentComment = parentId ? post.comments.id(parentId) : null;

    post.comments.push({
      authorId: req.user.id,
      authorName: req.user.name || 'Nguoi dung',
      authorAvatar: req.user.avatar || '',
        authorGender: req.user.gender || '',
      authorRole: normalizeRole(req.user.role),
      authorAdminRole: (req.user.id === 'admin' || req.user.adminRole === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : (req.user.adminRole || null),
      content,
      images: safeImages,
      parentId,
      createdAt: new Date(),
    });
    await post.save();

    const createdComment = post.comments[post.comments.length - 1];
    await notifyFeedAuthor(req, post, parentComment ? 'reply' : 'comment', {
      content: content.slice(0, 240),
      commentId: String(createdComment._id),
      parentCommentId: parentComment ? String(parentComment._id) : '',
      commentAuthorId: parentComment?.authorId,
      commentAuthorRole: parentComment?.authorRole,
    });

    const data = serializePost(post, req.user.id);
    emitFeed(req.app.get('io'), 'feed:comment', {
      id: data.id,
      comments: data.comments,
      commentsCount: data.commentsCount,
    });
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[FEED] comment error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

router.delete('/:id/comments/:commentId', authMiddleware, ...feedGuard('delete_comment'), async (req, res) => {
  try {
    const post = await FeedPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Khong tim thay bai viet' });
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Khong tim thay binh luan' });
    if (!canDeleteComment(req.user, post, comment)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xoa binh luan nay' });
    }
    const cid = String(comment._id);
    // Xoa de quy tat ca binh luan con o moi cap bac
    const toRemove = new Set([cid]);
    let added = true;
    while (added) {
      added = false;
      for (const c of post.comments) {
        const id = String(c._id);
        const pid = c.parentId ? String(c.parentId) : null;
        if (pid && toRemove.has(pid) && !toRemove.has(id)) {
          toRemove.add(id);
          added = true;
        }
      }
    }
    post.comments = post.comments.filter((c) => !toRemove.has(String(c._id)));
    await post.save();
    const data = serializePost(post, req.user.id);
    emitFeed(req.app.get('io'), 'feed:comment', {
      id: data.id,
      comments: data.comments,
      commentsCount: data.commentsCount,
    });
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[FEED] delete comment error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

module.exports = router;