/**
 * Blog / Tin tức trung tâm — mọi role đọc; Admin/Staff (manage_blog) đăng bài.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const BlogTopic = require('../models/BlogTopic');
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
    topicId: o.topicId ? String(o.topicId) : '',
    topicName: o.topicName || '',
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

function vnYmd(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, day] = fmt.format(d).split('-').map(Number);
  return { y, m, day };
}

function vnDate(y, m, d, h = 0, min = 0, s = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}+07:00`);
}

function monthRangeVN(y, m) {
  const start = vnDate(y, m, 1);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return { start, end: vnDate(nextY, nextM, 1) };
}

function dateInRangeClause(start, end) {
  return {
    $or: [
      { publishedAt: { $gte: start, $lt: end } },
      { publishedAt: null, createdAt: { $gte: start, $lt: end } },
    ],
  };
}

function sortSpec(sortKey) {
  if (sortKey === 'oldest') return { publishedAt: 1, createdAt: 1 };
  if (sortKey === 'views') return { viewCount: -1, publishedAt: -1, createdAt: -1 };
  return { publishedAt: -1, createdAt: -1 };
}

async function uniqueTopicSlug(base, excludeId) {
  let slug = slugify(base).slice(0, 80) || `chu-de-${Date.now()}`;
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const q = { slug: candidate };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await BlogTopic.exists(q);
    if (!exists) return candidate;
    n += 1;
  }
}

async function resolveTopicFields(topicIdRaw) {
  if (topicIdRaw == null || topicIdRaw === '' || topicIdRaw === 'none') {
    return { topicId: null, topicName: '' };
  }
  const id = String(topicIdRaw);
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'Chủ đề không hợp lệ' };
  const t = await BlogTopic.findOne({ _id: id, deletedAt: null }).lean();
  if (!t) return { error: 'Không tìm thấy chủ đề' };
  return { topicId: t._id, topicName: t.name };
}

async function applyTopicAndPeriod(filter, { topic, period }) {
  const topicQ = String(topic || '').trim();
  if (topicQ && topicQ !== 'all') {
    if (mongoose.Types.ObjectId.isValid(topicQ) && topicQ.length === 24) {
      filter.topicId = topicQ;
    } else {
      const t = await BlogTopic.findOne({ slug: topicQ, deletedAt: null }).select('_id').lean();
      filter.topicId = t ? t._id : new mongoose.Types.ObjectId('000000000000000000000000');
    }
  }

  const p = String(period || '').trim();
  if (!p) return;
  const { y, m, day } = vnYmd();
  let start;
  let end;
  if (p === 'today') {
    start = vnDate(y, m, day);
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  } else if (p === 'this_month') {
    ({ start, end } = monthRangeVN(y, m));
  } else if (p === 'last_month') {
    const lm = m === 1 ? 12 : m - 1;
    const ly = m === 1 ? y - 1 : y;
    ({ start, end } = monthRangeVN(ly, lm));
  } else if (p === 'oldest_month') {
    const oldest = await BlogPost.findOne(filter).sort({ publishedAt: 1, createdAt: 1 }).select('publishedAt createdAt').lean();
    const raw = oldest?.publishedAt || oldest?.createdAt;
    if (!raw) {
      filter._id = { $in: [] };
      return;
    }
    const o = vnYmd(new Date(raw));
    ({ start, end } = monthRangeVN(o.y, o.m));
  } else {
    return;
  }
  const clause = dateInRangeClause(start, end);
  if (filter.$or) {
    const qOr = filter.$or;
    delete filter.$or;
    filter.$and = [{ $or: qOr }, clause];
  } else if (filter.$and) {
    filter.$and.push(clause);
  } else {
    Object.assign(filter, clause);
  }
}

function serializeTopic(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    name: o.name,
    slug: o.slug,
    sortOrder: o.sortOrder || 0,
  };
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

router.get('/topics', policyShadowBlog('list'), blogCutoverGate('list'), async (req, res) => {
  try {
    const rows = await BlogTopic.find({ deletedAt: null }).sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ success: true, data: rows.map(serializeTopic) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/blog/posts — danh sách public (đã xuất bản) ───────────────────
router.get('/posts', policyShadowBlog('list'), blogCutoverGate('list'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const q = String(req.query.q || '').trim();
    const target = String(req.query.target || '').trim();
    const sortKey = String(req.query.sort || '').trim();
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
    await applyTopicAndPeriod(filter, { topic: req.query.topic, period: req.query.period });
    const [rows, total] = await Promise.all([
      BlogPost.find(filter)
        .sort(sortSpec(sortKey))
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
    if (doc.topicId) relatedFilter.topicId = doc.topicId;

    if (!isAdminSide) {
      if (req.user?.role === 'teacher') {
        relatedFilter.targetAudience = { $in: ['all', 'teacher'] };
      } else if (req.user?.role === 'student') {
        relatedFilter.targetAudience = { $in: ['all', 'student'] };
      }
    }

    let related = await BlogPost.find(relatedFilter)
      .sort({ publishedAt: -1 })
      .limit(4)
      .select('-contentHtml -attachments')
      .lean();
    if (related.length < 4 && relatedFilter.topicId) {
      const extraFilter = { ...relatedFilter };
      delete extraFilter.topicId;
      extraFilter._id = { $nin: [doc._id, ...related.map((r) => r._id)] };
      const extra = await BlogPost.find(extraFilter)
        .sort({ publishedAt: -1 })
        .limit(4 - related.length)
        .select('-contentHtml -attachments')
        .lean();
      related = related.concat(extra);
    }

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
    const sortKey = String(req.query.sort || '').trim() || 'newest';
    const filter = { deletedAt: null };
    if (status && ['draft', 'published', 'hidden'].includes(status)) filter.status = status;
    if (q) {
      filter.$or = [
        { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { excerpt: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    await applyTopicAndPeriod(filter, { topic: req.query.topic, period: req.query.period });
    const manageSort = sortKey === 'newest' && !req.query.sort
      ? { updatedAt: -1 }
      : sortSpec(sortKey);
    const [rows, total] = await Promise.all([
      BlogPost.find(filter).sort(manageSort).skip((page - 1) * limit).limit(limit).lean(),
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
    const topicFields = await resolveTopicFields(req.body.topicId);
    if (topicFields.error) return res.status(400).json({ success: false, message: topicFields.error });
    const publishedAt = status === 'published' ? new Date() : null;

    const post = await BlogPost.create({
      title,
      slug,
      excerpt: String(req.body.excerpt || '').trim().slice(0, 500),
      contentHtml: sanitizeHtml(req.body.contentHtml || req.body.content || ''),
      thumbnailUrl: String(req.body.thumbnailUrl || '').trim(),
      topicId: topicFields.topicId,
      topicName: topicFields.topicName,
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
    if (req.body.topicId !== undefined) {
      const topicFields = await resolveTopicFields(req.body.topicId);
      if (topicFields.error) return res.status(400).json({ success: false, message: topicFields.error });
      post.topicId = topicFields.topicId;
      post.topicName = topicFields.topicName;
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

router.post('/manage/topics', manageGuard('manage_create'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ success: false, message: 'Nhập tên chủ đề' });
    const slug = await uniqueTopicSlug(name);
    const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : Date.now();
    const topic = await BlogTopic.create({ name, slug, sortOrder });
    res.status(201).json({ success: true, data: serializeTopic(topic) });
  } catch (err) {
    if (err?.code === 11000) return res.status(400).json({ success: false, message: 'Chủ đề đã tồn tại' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/manage/topics/:id', manageGuard('manage_update'), async (req, res) => {
  try {
    const topic = await BlogTopic.findOne({ _id: req.params.id, deletedAt: null });
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });
    if (req.body.name != null) {
      const name = String(req.body.name || '').trim().slice(0, 80);
      if (!name) return res.status(400).json({ success: false, message: 'Nhập tên chủ đề' });
      topic.name = name;
      topic.slug = await uniqueTopicSlug(name, topic._id);
    }
    await topic.save();
    await BlogPost.updateMany(
      { topicId: topic._id, deletedAt: null },
      { $set: { topicName: topic.name } },
    );
    res.json({ success: true, data: serializeTopic(topic) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/manage/topics/:id', manageGuard('manage_delete'), async (req, res) => {
  try {
    const topic = await BlogTopic.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { deletedAt: new Date() },
      { returnDocument: 'after' },
    );
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });
    await BlogPost.updateMany(
      { topicId: topic._id, deletedAt: null },
      { $set: { topicId: null, topicName: '' } },
    );
    res.json({ success: true, message: 'Đã xóa chủ đề' });
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
