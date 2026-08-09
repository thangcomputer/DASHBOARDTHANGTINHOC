/**
 * Blog / Tin tức trung tâm — mọi role đọc; Admin/Staff (manage_blog) đăng bài.
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const blogController = require('../controllers/BlogController');
const BlogPost = require('../models/BlogPost');
const { authMiddleware, userHasPermission } = require('../../../shared/middleware/authMiddleware');
const { authorize } = require('../../../shared/middleware/authorize');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { PERMISSIONS } = require('../../../constants/permissions');
const NotificationService = require('../../notification/services/NotificationService');
const logger = require('../../../config/logger');

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
router.get('/posts',blogController.get_posts);

// ─── GET /api/blog/posts/:slugOrId — chi tiết ────────────────────────────────
router.get('/posts/:slugOrId',blogController.get_posts_slugOrId);

// ─── Manage ──────────────────────────────────────────────────────────────────
router.get('/manage/posts', authorize(NEW_PERMISSIONS.CMS_PUBLISH),blogController.get_manage_posts);

/** Chi tiết bài cho editor (đủ contentHtml + attachments) */
router.get('/manage/posts/:id', authorize(NEW_PERMISSIONS.CMS_PUBLISH),blogController.get_manage_posts_id);

router.post('/manage/posts', authorize(NEW_PERMISSIONS.CMS_PUBLISH),blogController.post_manage_posts);

router.put('/manage/posts/:id', authorize(NEW_PERMISSIONS.CMS_PUBLISH),blogController.put_manage_posts_id);

router.post('/manage/posts/:id/publish', authorize(NEW_PERMISSIONS.CMS_PUBLISH),blogController.post_manage_posts_id_publish);

router.post('/manage/posts/:id/hide', authorize(NEW_PERMISSIONS.CMS_PUBLISH),blogController.post_manage_posts_id_hide);

router.delete('/manage/posts/:id', authorize(NEW_PERMISSIONS.CMS_PUBLISH),blogController.delete_manage_posts_id);

router.post('/manage/upload', authorize(NEW_PERMISSIONS.CMS_PUBLISH), (req, res) => {
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
    const Notification = require('../../notification/models/Notification');
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
