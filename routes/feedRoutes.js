const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const FeedPost = require('../models/FeedPost');
const { REACTION_TYPES } = require('../models/FeedPost');
const { authMiddleware } = require('../middleware/auth');
const { policyShadowFeed } = require('../middleware/policyShadowFeed');
const { feedCutoverGate } = require('../middleware/feedCutoverGate');
const logger = require('../config/logger');

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
    authorAvatar: o.authorAvatar || '',
    content: o.content || '',
    images: o.images || [],
    visibility: o.visibility || 'public',
    isEdited: !!o.isEdited,
    editedAt: o.editedAt || null,
    reactions: counts,
    reactionsCount: total,
    reactionsList: reactions.map((r) => ({
      userId: String(r.userId || ''),
      userName: r.userName || 'Người dùng',
      role: r.role || 'student',
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
      authorAvatar: c.authorAvatar || '',
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
    logger.error('[FEED] list error', err);
    return res.status(500).json({ success: false, message: 'Loi server' });
  }
});

router.post('/', authMiddleware, ...feedGuard('create'), async (req, res) => {
  try {
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
  }

  const uid = String(req.user.id);
  const idx = post.reactions.findIndex((r) => String(r.userId) === uid);
  if (idx >= 0) {
    if (post.reactions[idx].type === type) post.reactions.splice(idx, 1);
    else post.reactions[idx].type = type;
  } else {
    post.reactions.push({
      userId: uid,
      userName: req.user.name || '',
      role: normalizeRole(req.user.role),
      type,
    });
  }
  await post.save();
  const data = serializePost(post, req.user.id);
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
      // Flatten: reply to a reply still attaches under the root comment (1 UI thread)
      if (parent.parentId) {
        parentId = String(parent.parentId);
      }
    }

    post.comments.push({
      authorId: req.user.id,
      authorName: req.user.name || 'Nguoi dung',
      authorAvatar: req.user.avatar || '',
      authorRole: normalizeRole(req.user.role),
      authorAdminRole: (req.user.id === 'admin' || req.user.adminRole === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : (req.user.adminRole || null),
      content,
      images: safeImages,
      parentId,
      createdAt: new Date(),
    });
    await post.save();

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
    // xoa ca reply con
    post.comments = post.comments.filter((c) => {
      const id = String(c._id);
      const pid = c.parentId ? String(c.parentId) : null;
      return id !== cid && pid !== cid;
    });
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