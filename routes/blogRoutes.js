/**
 * Blog / Tin tức trung tâm — mọi role đọc; Admin/Staff (manage_blog) đăng bài.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const { authMiddleware, userHasPermission } = require('../middleware/auth');
const { policyShadowBlog } = require('../middleware/policyShadowBlog');
const { blogCutoverGate } = require('../middleware/blogCutoverGate');
const { PERMISSIONS } = require('../constants/permissions');
const NotificationService = require('../services/NotificationService');
const logger = require('../config/logger');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function manageGuard(action) {
  return [policyShadowBlog(action), blogCutoverGate(action)];
}

function slugify(raw) {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
  return s || `bai-viet-${Date.now()}`;
}

async function uniqueSlug(base, excludeId) {
  let slug = slugify(base);
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const q = { slug: candidate, deletedAt: null };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await BlogPost.exists(q);
    if (!exists) return candidate;
    n += 1;
  }
}

function isNewPost(publishedAt) {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() <= THREE_DAYS_MS;
}

function serializeCard(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    title: o.title,
    slug: o.slug,
    excerpt: o.excerpt || '',
    thumbnailUrl: o.thumbnailUrl || '',
    authorName: o.authorName || 'Admin',
    authorRole: o.authorRole,
    status: o.status,
    targetAudience: o.targetAudience || 'all',
    publishedAt: o.publishedAt,
    viewCount: o.viewCount || 0,
    isNew: isNewPost(o.publishedAt),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function serializeDetail(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    ...serializeCard(o),
    contentHtml: o.contentHtml || '',
    attachments: Array.isArray(o.attachments) ? o.attachments : [],
    authorId: o.authorId,
  };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Cho phép subset HTML từ editor nội bộ (không SEO) */
function sanitizeHtml(html) {
  let s = String(html || '');
  s = s.replace(/<\/?(script|iframe|object|embed|form|meta|link|style)[^>]*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/javascript:/gi, '');
  s = s.replace(/data:text\/html/gi, '');
  return s.slice(0, 200000);
}

const blogDir = path.join(__dirname, '..', 'uploads', 'blog');
if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

const blogStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, blogDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `blog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage: blogStorage,
  limits: { fileSize: 80 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video|application|text)\//.test(file.mimetype)
      || /\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i.test(file.originalname);
    cb(ok ? null : new Error('Loại file không được hỗ trợ'), ok);
  },
});

/**
 * Phase 7.16 — Controlled cutover for /api/blog ONLY.
 * Flow: router.use(auth) → policyShadowBlog → blogCutoverGate → handler
 * Legacy fallback: list/get pass-through; manage_* → checkPermission(MANAGE_BLOG).
 */
router.use(authMiddleware);

// ─── GET /api/blog/posts — danh sách public (đã xuất bản) ───────────────────
router.get('/posts', policyShadowBlog('list'), blogCutoverGate('list'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const q = String(req.query.q || '').trim();
    const target = String(req.query.target || '').trim();
    const filter = { deletedAt: null, status: 'published' };

    if (target && ['all', 'teacher', 'student'].includes(target)) {
      filter.targetAudience = { $in: ['all', target] };
    } else if (req.user?.role === 'teacher') {
      filter.targetAudience = { $in: ['all', 'teacher'] };
    } else if (req.user?.role === 'student') {
      filter.targetAudience = { $in: ['all', 'student'] };
    }

    if (q) {
      filter.$or = [
        { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { excerpt: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    const [rows, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-contentHtml -attachments')
        .lean(),
      BlogPost.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: rows.map(serializeCard),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    logger.error('[BLOG] list:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/blog/posts/:slugOrId — chi tiết ────────────────────────────────
router.get('/posts/:slugOrId', policyShadowBlog('get'), blogCutoverGate('get'), async (req, res) => {
  try {
    const key = req.params.slugOrId;
    const manage = String(req.query.manage || '') === '1';
    let filter = { deletedAt: null };
    if (/^[a-f0-9]{24}$/i.test(key)) filter._id = key;
    else filter.slug = key;

    if (!manage) filter.status = 'published';

    const doc = await BlogPost.findOne(filter);
    if (!doc) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });

    const isAdminSide = req.user?.role === 'admin' || req.user?.role === 'staff' || req.user?.adminRole === 'SUPER_ADMIN' || req.user?.adminRole === 'STAFF';

    if (manage) {
      const ok = await userHasPermission(req.user, PERMISSIONS.MANAGE_BLOG);
      if (!ok && doc.status !== 'published') {
        return res.status(403).json({ success: false, message: 'Không có quyền xem bản nháp' });
      }
    } else if (!isAdminSide) {
      if (req.user?.role === 'teacher' && doc.targetAudience === 'student') {
        return res.status(403).json({ success: false, message: 'Bài viết này dành cho Học viên' });
      }
      if (req.user?.role === 'student' && doc.targetAudience === 'teacher') {
        return res.status(403).json({ success: false, message: 'Bài viết này dành cho Giảng viên' });
      }
    }

    // Tăng view (public)
    if (doc.status === 'published') {
      BlogPost.updateOne({ _id: doc._id }, { $inc: { viewCount: 1 } }).catch(() => {});
      doc.viewCount = (doc.viewCount || 0) + 1;
    }

    const relatedFilter = {
      deletedAt: null,
      status: 'published',
      _id: { $ne: doc._id },
    };

    if (!isAdminSide) {
      if (req.user?.role === 'teacher') {
        relatedFilter.targetAudience = { $in: ['all', 'teacher'] };
      } else if (req.user?.role === 'student') {
        relatedFilter.targetAudience = { $in: ['all', 'student'] };
      }
    }

    const related = await BlogPost.find(relatedFilter)
      .sort({ publishedAt: -1 })
      .limit(4)
      .select('-contentHtml -attachments')
      .lean();

    res.json({
      success: true,
      data: serializeDetail(doc),
      related: related.map(serializeCard),
    });
  } catch (err) {
    logger.error('[BLOG] detail:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Manage ──────────────────────────────────────────────────────────────────
router.get('/manage/posts', manageGuard('manage_list'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim();
    const filter = { deletedAt: null };
    if (status && ['draft', 'published', 'hidden'].includes(status)) filter.status = status;
    if (q) {
      filter.$or = [
        { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { excerpt: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    const [rows, total] = await Promise.all([
      BlogPost.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      BlogPost.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: rows.map(serializeCard),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Chi tiết bài cho editor (đủ contentHtml + attachments) */
router.get('/manage/posts/:id', manageGuard('manage_get'), async (req, res) => {
  try {
    const doc = await BlogPost.findOne({ _id: req.params.id, deletedAt: null });
    if (!doc) return res.status(404).json({ success: false, message: 'Không tìm thấy bài' });
    res.json({ success: true, data: serializeDetail(doc) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manage/posts', manageGuard('manage_create'), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ success: false, message: 'Thiếu tiêu đề' });
    const slug = await uniqueSlug(req.body.slug || title);
    const status = ['draft', 'published', 'hidden'].includes(req.body.status) ? req.body.status : 'draft';
    const targetAudience = ['all', 'teacher', 'student'].includes(req.body.targetAudience) ? req.body.targetAudience : 'all';
    const publishedAt = status === 'published' ? new Date() : null;

    const post = await BlogPost.create({
      title,
      slug,
      excerpt: String(req.body.excerpt || '').trim().slice(0, 500),
      contentHtml: sanitizeHtml(req.body.contentHtml || req.body.content || ''),
      thumbnailUrl: String(req.body.thumbnailUrl || '').trim(),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      authorId: String(req.user.id),
      authorName: req.user.name || 'Admin',
      authorRole: req.user.role === 'staff' ? 'staff' : 'admin',
      status,
      targetAudience,
      publishedAt,
    });

    if (status === 'published') {
      await notifyPublished(req.app.get('io'), post);
    }

    res.status(201).json({ success: true, data: serializeDetail(post) });
  } catch (err) {
    logger.error('[BLOG] create:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/manage/posts/:id', manageGuard('manage_update'), async (req, res) => {
  try {
    const post = await BlogPost.findOne({ _id: req.params.id, deletedAt: null });
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài' });

    if (req.body.title != null) post.title = String(req.body.title).trim().slice(0, 200);
    if (req.body.excerpt != null) post.excerpt = String(req.body.excerpt).trim().slice(0, 500);
    if (req.body.contentHtml != null || req.body.content != null) {
      post.contentHtml = sanitizeHtml(req.body.contentHtml || req.body.content || '');
    }
    if (req.body.thumbnailUrl != null) post.thumbnailUrl = String(req.body.thumbnailUrl).trim();
    if (Array.isArray(req.body.attachments)) post.attachments = req.body.attachments;
    if (req.body.slug) post.slug = await uniqueSlug(req.body.slug, post._id);
    if (req.body.targetAudience && ['all', 'teacher', 'student'].includes(req.body.targetAudience)) {
      post.targetAudience = req.body.targetAudience;
    }

    const prevStatus = post.status;
    if (req.body.status && ['draft', 'published', 'hidden'].includes(req.body.status)) {
      post.status = req.body.status;
      if (post.status === 'published' && prevStatus !== 'published') {
        post.publishedAt = post.publishedAt || new Date();
      }
    }

    await post.save();

    if (post.status === 'published' && prevStatus !== 'published') {
      await notifyPublished(req.app.get('io'), post);
    }

    res.json({ success: true, data: serializeDetail(post) });
  } catch (err) {
    logger.error('[BLOG] update:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manage/posts/:id/publish', manageGuard('manage_publish'), async (req, res) => {
  try {
    const post = await BlogPost.findOne({ _id: req.params.id, deletedAt: null });
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài' });
    const wasPublished = post.status === 'published';
    post.status = 'published';
    post.publishedAt = post.publishedAt || new Date();
    await post.save();
    if (!wasPublished) await notifyPublished(req.app.get('io'), post);
    res.json({ success: true, data: serializeDetail(post) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manage/posts/:id/hide', manageGuard('manage_hide'), async (req, res) => {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { status: 'hidden' },
      { returnDocument: 'after' },
    );
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài' });
    res.json({ success: true, data: serializeDetail(post) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/manage/posts/:id', manageGuard('manage_delete'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID bài viết không hợp lệ' });
    }
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { deletedAt: new Date(), status: 'hidden' },
      { returnDocument: 'after' },
    );
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết hoặc bài đã bị xóa' });
    res.json({ success: true, message: 'Đã xóa bài viết' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manage/upload', manageGuard('manage_upload'), (req, res) => {
  upload.array('files', 8)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'File quá lớn'
        : (err.message || 'Upload thất bại');
      return res.status(400).json({ success: false, message: msg });
    }
    try {
      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ success: false, message: 'Không có file được gửi lên' });
      }
      const items = files.map((f) => {
        let kind = 'file';
        if (f.mimetype.startsWith('image/')) kind = 'image';
        else if (f.mimetype.startsWith('video/')) kind = 'video';
        return {
          url: `/uploads/blog/${f.filename}`,
          name: f.originalname,
          mime: f.mimetype,
          size: f.size,
          kind,
        };
      });
      return res.json({ success: true, data: items });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });
});

async function notifyPublished(io, post) {
  if (!io || !post) return;
  const title = `Có bài viết mới: '${post.title}'`;
  const content = post.excerpt || 'Mở Tin tức để đọc bài viết mới từ trung tâm.';
  const link = ''; // client tự navigate theo role + slug

  let receivers;
  if (post.targetAudience === 'teacher') {
    receivers = ['ALL_ADMIN', 'ALL_TEACHER'];
  } else if (post.targetAudience === 'student') {
    receivers = ['ALL_ADMIN', 'ALL_STUDENT'];
  } else {
    receivers = 'GLOBAL';
  }

  try {
    await NotificationService.send(io, {
      type: 'SYSTEM',
      title,
      content,
      receivers,
      payload: {
        blogPostId: String(post._id),
        slug: post.slug,
        targetAudience: post.targetAudience || 'all',
        action: 'blog_published',
      },
      link,
    });
    io.emit('blog:published', {
      id: String(post._id),
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || '',
      thumbnailUrl: post.thumbnailUrl || '',
      targetAudience: post.targetAudience || 'all',
    });
  } catch (err) {
    logger.warn('[BLOG] notify:', err.message);
  }
}

/** Tự động đồng bộ các bản ghi thông báo tin tức cũ trong DB cho đúng receivers */
async function syncOldBlogNotifications() {
  try {
    const Notification = require('../models/Notification');
    const notifs = await Notification.find({ 'payload.action': 'blog_published' }).lean();
    for (const n of notifs) {
      const postId = n.payload?.blogPostId;
      const slug = n.payload?.slug;
      if (!postId && !slug) continue;

      const post = await BlogPost.findOne({
        $or: [{ _id: postId }, { slug: slug }],
      }).select('targetAudience').lean();

      if (!post) continue;
      const audience = post.targetAudience || 'all';

      let receivers;
      if (audience === 'teacher') receivers = ['ALL_ADMIN', 'ALL_TEACHER'];
      else if (audience === 'student') receivers = ['ALL_ADMIN', 'ALL_STUDENT'];
      else receivers = ['GLOBAL'];

      await Notification.updateOne(
        { _id: n._id },
        {
          $set: {
            receivers,
            'payload.targetAudience': audience,
          },
        }
      );
    }
  } catch (err) {
    logger.warn('[BLOG] syncOldBlogNotifications error:', err.message);
  }
}

// Gọi đồng bộ ngay khi load module
setTimeout(syncOldBlogNotifications, 2000);

// silence unused helper warning in some linters
void escapeHtml;

module.exports = router;
