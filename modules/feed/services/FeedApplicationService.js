'use strict';
const path = require('path');
const fs = require('fs');
const FeedPost = require('./../models/FeedPost');
const { REACTION_TYPES } = require('./../models/FeedPost');
const logger = require('./../../../config/logger');

function normalizeRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'staff') return 'staff';
  if (r === 'admin') return 'admin';
  if (r === 'teacher') return 'teacher';
  return 'student';
}
function isAdminLike(user) {
  const r = normalizeRole(user?.role);
  return r === 'admin' || r === 'staff' || user?.id === 'admin' || user?.adminRole === 'SUPER_ADMIN';
}
function canDeletePost(user, post) {
  if (!user || !post) return false;
  if (isAdminLike(user)) return true;
  return String(post.authorId) === String(user.id);
}
function emitFeed(io, event, payload) {
  if (!io) return;
  io.to('feed_room').emit(event, payload);
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
  if (isAdminLike(user)) return true;
  if (String(comment.authorId) === String(user.id)) return true;
  return String(post.authorId) === String(user.id);
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
    authorAvatar: o.authorAvatar || '',
    content: o.content || '',
    images: o.images || [],
    reactions: counts,
    reactionsCount: total,
    myReaction,
    likesCount: total,
    likedByMe: !!myReaction,
    comments: (o.comments || []).map((c) => ({
      id: String(c._id),
      authorId: c.authorId,
      authorName: c.authorName,
      authorRole: c.authorRole,
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

class FeedApplicationService {
  async post_upload(data) {}

  async get_root(data) {
  try {
    const page = Math.max(1, parseInt(data.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(data.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      FeedPost.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FeedPost.countDocuments({}),
    ]);
    return { _status: 200, _body: ({
      success: true,
      data: rows.map((p) => serializePost(p, data.currentUser.id)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    logger.error('[FEED] list error', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async post_root(data) {
  try {
    const content = String(data.body?.content || '').trim();
    const images = Array.isArray(data.body?.images)
      ? data.images.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 6)
      : [];
    if (!content && images.length === 0) {
      return { _status: 400, _body: ({ success: false, message: 'Nhap noi dung hoac them anh' });
    }
    if (content.length > 5000) {
      return { _status: 400, _body: ({ success: false, message: 'Noi dung qua dai' });
    }
    if (!feedRateOk(data.currentUser.id, 'create', 8, 60 * 1000)) {
      return { _status: 429, _body: ({ success: false, message: 'Ban dang bai qua nhanh, thu lai sau' });
    }
    const post = await FeedPost.create({
      authorId: data.currentUser.id,
      authorName: data.currentUser.name || 'Nguoi dung',
      authorRole: normalizeRole(data.currentUser.role),
      authorAvatar: data.body?.authorAvatar || data.currentUser.avatar || '',
      content,
      images,
      reactions: [],
      comments: [],
    });
    const data = serializePost(post, data.currentUser.id);
    emitFeed(data.app.get('io'), 'feed:new', { ...data, myReaction: null, likedByMe: false });
    return { _status: 201, _body: ({ success: true, data });
  } catch (err) {
    logger.error('[FEED] create error', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async delete_id(data) {
  try {
    const post = await FeedPost.findById(data.id);
    if (!post) return { _status: 404, _body: ({ success: false, message: 'Khong tim thay bai viet' });
    if (!canDeletePost(data.currentUser, post)) {
      return { _status: 403, _body: ({ success: false, message: 'Ban khong co quyen xoa bai nay' });
    }
    await post.deleteOne();
    emitFeed(data.app.get('io'), 'feed:deleted', { id: String(data.id) });
    return { _status: 200, _body: ({ success: true, message: 'Da xoa bai viet' });
  } catch (err) {
    logger.error('[FEED] delete error', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async post_id_like(data) {
  try {
    return await applyReaction(req, res, data.body?.type || 'heart');
  } catch (err) {
    logger.error('[FEED] like error', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async post_id_react(data) {
  try {
    return await applyReaction(req, res, data.body?.type || 'heart');
  } catch (err) {
    logger.error('[FEED] react error', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async post_id_comments(data) {
  try {
    if (!feedRateOk(data.currentUser.id, 'comment', 20, 60 * 1000)) {
      return { _status: 429, _body: ({ success: false, message: 'Binh luan qua nhanh, thu lai sau' });
    }
    const content = String(data.body?.content || '').trim();
    const images = Array.isArray(data.body?.images)
      ? data.images.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    let parentId = data.body?.parentId ? String(data.parentId) : null;

    if (!content && images.length === 0) {
      return { _status: 400, _body: ({ success: false, message: 'Nhap noi dung hoac them anh' });
    }
    if (content.length > 2000) return { _status: 400, _body: ({ success: false, message: 'Binh luan qua dai' });

    const post = await FeedPost.findById(data.id);
    if (!post) return { _status: 404, _body: ({ success: false, message: 'Khong tim thay bai viet' });

    if ((post.comments || []).length >= 500) {
      return { _status: 400, _body: ({ success: false, message: 'Bai viet da dat gioi han 500 binh luan' });
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
      if (!parent) return { _status: 404, _body: ({ success: false, message: 'Khong tim thay binh luan goc' });
      // Flatten: reply to a reply still attaches under the root comment (1 UI thread)
      if (parent.parentId) {
        parentId = String(parent.parentId);
      }
    }

    post.comments.push({
      authorId: data.currentUser.id,
      authorName: data.currentUser.name || 'Nguoi dung',
      authorAvatar: data.currentUser.avatar || '',
      authorRole: normalizeRole(data.currentUser.role),
      content,
      images: safeImages,
      parentId,
      createdAt: new Date(),
    });
    await post.save();

    const data = serializePost(post, data.currentUser.id);
    emitFeed(data.app.get('io'), 'feed:comment', {
      id: data.id,
      comments: data.comments,
      commentsCount: data.commentsCount,
    });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    logger.error('[FEED] comment error', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async delete_id_comments_commentId(data) {
  try {
    const post = await FeedPost.findById(data.id);
    if (!post) return { _status: 404, _body: ({ success: false, message: 'Khong tim thay bai viet' });
    const comment = post.comments.id(data.commentId);
    if (!comment) return { _status: 404, _body: ({ success: false, message: 'Khong tim thay binh luan' });
    if (!canDeleteComment(data.currentUser, post, comment)) {
      return { _status: 403, _body: ({ success: false, message: 'Ban khong co quyen xoa binh luan nay' });
    }
    const cid = String(comment._id);
    // xoa ca reply con
    post.comments = post.comments.filter((c) => {
      const id = String(c._id);
      const pid = c.parentId ? String(c.parentId) : null;
      return id !== cid && pid !== cid;
    });
    await post.save();
    const data = serializePost(post, data.currentUser.id);
    emitFeed(data.app.get('io'), 'feed:comment', {
      id: data.id,
      comments: data.comments,
      commentsCount: data.commentsCount,
    });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    logger.error('[FEED] delete comment error', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

}

module.exports = new FeedApplicationService();
