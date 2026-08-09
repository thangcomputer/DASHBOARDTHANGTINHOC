const express = require('express');
const multer = require('multer');
const router = express.Router();
const feedController = require('../controllers/FeedController');
const FeedPost = require('../models/FeedPost');
const { REACTION_TYPES } = require('../models/FeedPost');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const logger = require('../../../config/logger');

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

router.post('/upload', authMiddleware, (req, res) => {
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

router.get('/', authMiddleware,feedController.get_root);

router.post('/', authMiddleware,feedController.post_root);

router.delete('/:id', authMiddleware,feedController.delete_id);

async function applyReaction(req, res, typeIn) {
  if (!feedRateOk(req.currentUser.id, 'like', 40, 60 * 1000)) {
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

  const uid = String(req.currentUser.id);
  const idx = post.reactions.findIndex((r) => String(r.userId) === uid);
  if (idx >= 0) {
    if (post.reactions[idx].type === type) post.reactions.splice(idx, 1);
    else post.reactions[idx].type = type;
  } else {
    post.reactions.push({
      userId: uid,
      userName: req.currentUser.name || '',
      role: normalizeRole(req.currentUser.role),
      type,
    });
  }
  await post.save();
  const data = serializePost(post, req.currentUser.id);
  emitFeed(req.app.get('io'), 'feed:like', {
    id: data.id,
    reactions: data.reactions,
    reactionsCount: data.reactionsCount,
    likesCount: data.likesCount,
    byUserId: uid,
  });
  return res.json({ success: true, data });
}

router.post('/:id/like', authMiddleware,feedController.post_id_like);

router.post('/:id/react', authMiddleware,feedController.post_id_react);

router.post('/:id/comments', authMiddleware,feedController.post_id_comments);

router.delete('/:id/comments/:commentId', authMiddleware,feedController.delete_id_comments_commentId);

module.exports = router;