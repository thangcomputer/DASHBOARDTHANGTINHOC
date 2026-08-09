'use strict';
const path = require('path');
const fs = require('fs');
const BlogPost = require('./../models/BlogPost');
const NotificationService = require('./../../notification/services/NotificationService');
const logger = require('./../../../config/logger');

/**
 * Blog / Tin tức trung tâm — mọi role đọc; Admin/Staff (manage_blog) đăng bài.
 */
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
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
router.use(authMiddleware);
// ─── GET /api/blog/posts — danh sách public (đã xuất bản) ───────────────────

class BlogApplicationService {
  async get_posts(data) {
  try {
    const page = Math.max(1, parseInt(data.page, 10) || 1);
    const limit = Math.min(40, Math.max(1, parseInt(data.limit, 10) || 12));
    const q = String(data.q || '').trim();
    const target = String(data.target || '').trim();
    const filter = { deletedAt: null, status: 'published' };

    if (target && ['all', 'teacher', 'student'].includes(target)) {
      filter.targetAudience = { $in: ['all', target] };
    } else if (data.currentUser?.role === 'teacher') {
      filter.targetAudience = { $in: ['all', 'teacher'] };
    } else if (data.currentUser?.role === 'student') {
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
    return { _status: 200, _body: ({
      success: true,
      data: rows.map(serializeCard),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    logger.error('[BLOG] list:', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_posts_slugOrId(data) {
  try {
    const key = data.slugOrId;
    const manage = String(data.manage || '') === '1';
    let filter = { deletedAt: null };
    if (/^[a-f0-9]{24}$/i.test(key)) filter._id = key;
    else filter.slug = key;

    if (!manage) filter.status = 'published';

    const doc = await BlogPost.findOne(filter);
    if (!doc) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài viết' });

    const isAdminSide = data.currentUser?.role === 'admin' || data.currentUser?.role === 'staff' || data.currentUser?.adminRole === 'SUPER_ADMIN' || data.currentUser?.adminRole === 'STAFF';

    if (manage) {
      const ok = await userHasPermission(data.currentUser, PERMISSIONS.MANAGE_BLOG);
      if (!ok && doc.status !== 'published') {
        return { _status: 403, _body: ({ success: false, message: 'Không có quyền xem bản nháp' });
      }
    } else if (!isAdminSide) {
      if (data.currentUser?.role === 'teacher' && doc.targetAudience === 'student') {
        return { _status: 403, _body: ({ success: false, message: 'Bài viết này dành cho Học viên' });
      }
      if (data.currentUser?.role === 'student' && doc.targetAudience === 'teacher') {
        return { _status: 403, _body: ({ success: false, message: 'Bài viết này dành cho Giảng viên' });
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
      if (data.currentUser?.role === 'teacher') {
        relatedFilter.targetAudience = { $in: ['all', 'teacher'] };
      } else if (data.currentUser?.role === 'student') {
        relatedFilter.targetAudience = { $in: ['all', 'student'] };
      }
    }

    const related = await BlogPost.find(relatedFilter)
      .sort({ publishedAt: -1 })
      .limit(4)
      .select('-contentHtml -attachments')
      .lean();

    return { _status: 200, _body: ({
      success: true,
      data: serializeDetail(doc),
      related: related.map(serializeCard),
    });
  } catch (err) {
    logger.error('[BLOG] detail:', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_manage_posts(data) {
  try {
    const page = Math.max(1, parseInt(data.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(data.limit, 10) || 20));
    const status = String(data.status || '').trim();
    const q = String(data.q || '').trim();
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
    return { _status: 200, _body: ({
      success: true,
      data: rows.map(serializeCard),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_manage_posts_id(data) {
  try {
    const doc = await BlogPost.findOne({ _id: data.id, deletedAt: null });
    if (!doc) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài' });
    return { _status: 200, _body: ({ success: true, data: serializeDetail(doc) });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_manage_posts(data) {
  try {
    const title = String(data.title || '').trim();
    if (!title) return { _status: 400, _body: ({ success: false, message: 'Thiếu tiêu đề' });
    const slug = await uniqueSlug(data.slug || title);
    const status = ['draft', 'published', 'hidden'].includes(data.status) ? data.status : 'draft';
    const targetAudience = ['all', 'teacher', 'student'].includes(data.targetAudience) ? data.targetAudience : 'all';
    const publishedAt = status === 'published' ? new Date() : null;

    const post = await BlogPost.create({
      title,
      slug,
      excerpt: String(data.excerpt || '').trim().slice(0, 500),
      contentHtml: sanitizeHtml(data.contentHtml || data.content || ''),
      thumbnailUrl: String(data.thumbnailUrl || '').trim(),
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      authorId: String(data.currentUser.id),
      authorName: data.currentUser.name || 'Admin',
      authorRole: data.currentUser.role === 'staff' ? 'staff' : 'admin',
      status,
      targetAudience,
      publishedAt,
    });

    if (status === 'published') {
      await notifyPublished(data.app.get('io'), post);
    }

    return { _status: 201, _body: ({ success: true, data: serializeDetail(post) });
  } catch (err) {
    logger.error('[BLOG] create:', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async put_manage_posts_id(data) {
  try {
    const post = await BlogPost.findOne({ _id: data.id, deletedAt: null });
    if (!post) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài' });

    if (data.title != null) post.title = String(data.title).trim().slice(0, 200);
    if (data.excerpt != null) post.excerpt = String(data.excerpt).trim().slice(0, 500);
    if (data.contentHtml != null || data.content != null) {
      post.contentHtml = sanitizeHtml(data.contentHtml || data.content || '');
    }
    if (data.thumbnailUrl != null) post.thumbnailUrl = String(data.thumbnailUrl).trim();
    if (Array.isArray(data.attachments)) post.attachments = data.attachments;
    if (data.slug) post.slug = await uniqueSlug(data.slug, post._id);
    if (data.targetAudience && ['all', 'teacher', 'student'].includes(data.targetAudience)) {
      post.targetAudience = data.targetAudience;
    }

    const prevStatus = post.status;
    if (data.status && ['draft', 'published', 'hidden'].includes(data.status)) {
      post.status = data.status;
      if (post.status === 'published' && prevStatus !== 'published') {
        post.publishedAt = post.publishedAt || new Date();
      }
    }

    await post.save();

    if (post.status === 'published' && prevStatus !== 'published') {
      await notifyPublished(data.app.get('io'), post);
    }

    return { _status: 200, _body: ({ success: true, data: serializeDetail(post) });
  } catch (err) {
    logger.error('[BLOG] update:', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_manage_posts_id_publish(data) {
  try {
    const post = await BlogPost.findOne({ _id: data.id, deletedAt: null });
    if (!post) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài' });
    const wasPublished = post.status === 'published';
    post.status = 'published';
    post.publishedAt = post.publishedAt || new Date();
    await post.save();
    if (!wasPublished) await notifyPublished(data.app.get('io'), post);
    return { _status: 200, _body: ({ success: true, data: serializeDetail(post) });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_manage_posts_id_hide(data) {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { _id: data.id, deletedAt: null },
      { status: 'hidden' },
      { returnDocument: 'after' },
    );
    if (!post) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài' });
    return { _status: 200, _body: ({ success: true, data: serializeDetail(post) });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async delete_manage_posts_id(data) {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(data.id)) {
      return { _status: 400, _body: ({ success: false, message: 'ID bài viết không hợp lệ' });
    }
    const post = await BlogPost.findOneAndUpdate(
      { _id: data.id, deletedAt: null },
      { deletedAt: new Date(), status: 'hidden' },
      { returnDocument: 'after' },
    );
    if (!post) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài viết hoặc bài đã bị xóa' });
    return { _status: 200, _body: ({ success: true, message: 'Đã xóa bài viết' });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_manage_upload(data) {}

}

module.exports = new BlogApplicationService();
