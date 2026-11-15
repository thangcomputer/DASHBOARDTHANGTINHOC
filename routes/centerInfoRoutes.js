'use strict';

/**
 * Thông tin trung tâm - nhập tay, độc lập Branch/HR/Settings.
 * GET /api/center-info - mọi user đã login (chỉ published)
 * /api/center-info/manage/* - Super Admin hoặc manage_center_info
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();

const CenterOverview = require('../models/CenterOverview');
const CenterInfoItem = require('../models/CenterInfoItem');
const { authMiddleware, userHasPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { normalizeMulterFile } = require('../utils/escapeRegex');

const SECTIONS = CenterInfoItem.SECTIONS || [
  'staff', 'branch', 'social', 'service', 'exam_venue', 'certificate',
];

async function canManage(user) {
  if (!user) return false;
  if (user.id === 'admin' || user._id === 'admin' || user.username === 'admin') return true;
  if (user.adminRole === 'SUPER_ADMIN') return true;
  return Boolean(await userHasPermission(user, PERMISSIONS.MANAGE_CENTER_INFO));
}

async function manageOnly(req, res, next) {
  try {
    if (await canManage(req.user)) return next();
    return res.status(403).json({ success: false, message: 'Chỉ Super Admin / quyền Quản trị Thông tin trung tâm' });
  } catch (err) {
    return next(err);
  }
}

function sanitizeCenterHtml(html) {
  let s = String(html || '');
  s = s.replace(/<(script|iframe|object|embed|form|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<\/?(script|iframe|object|embed|form|meta|link|style|base|svg)[^>]*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/vbscript\s*:/gi, '');
  s = s.replace(/data\s*:\s*text\/html/gi, '');
  return s.slice(0, 200000);
}

function sanitizeSafeUrl(raw, { allowRelativeUploads = true } = {}) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (allowRelativeUploads && /^\/uploads\/[a-zA-Z0-9._\-/%]+$/i.test(s) && !s.includes('..')) {
    return s;
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) {
    return s;
  }
  return '';
}

async function getOrCreateOverview() {
  let doc = await CenterOverview.findOne({ _key: 'main' });
  if (!doc) {
    doc = await CenterOverview.create({ _key: 'main', status: 'draft', name: '' });
  }
  return doc;
}

function serializeOverview(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: String(o._id),
    status: o.status || 'draft',
    name: o.name || '',
    logoUrl: o.logoUrl || '',
    bannerUrl: o.bannerUrl || '',
    intro: o.intro || '',
    mission: o.mission || '',
    vision: o.vision || '',
    coreValues: o.coreValues || '',
    foundedYear: o.foundedYear || '',
    contactEmail: o.contactEmail || '',
    contactPhone: o.contactPhone || '',
    website: o.website || '',
    headquartersAddress: o.headquartersAddress || '',
    detailHtml: o.detailHtml || '',
    galleryUrls: Array.isArray(o.galleryUrls) ? o.galleryUrls : [],
    introVideoUrl: o.introVideoUrl || '',
    updatedAt: o.updatedAt,
  };
}

function serializeItem(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: String(o._id),
    section: o.section,
    status: o.status || 'published',
    sortOrder: Number(o.sortOrder) || 0,
    title: o.title || '',
    subtitle: o.subtitle || '',
    description: o.description || '',
    detailHtml: o.detailHtml || '',
    imageUrl: o.imageUrl || '',
    icon: o.icon || '',
    url: o.url || '',
    email: o.email || '',
    phone: o.phone || '',
    address: o.address || '',
    city: o.city || '',
    mapsUrl: o.mapsUrl || '',
    code: o.code || '',
    managerName: o.managerName || '',
    hours: o.hours || '',
    department: o.department || '',
    expertise: o.expertise || '',
    experience: o.experience || '',
    audience: o.audience || '',
    curriculum: o.curriculum || '',
    duration: o.duration || '',
    learningMode: o.learningMode || '',
    priceInfo: o.priceInfo || '',
    examType: o.examType || '',
    scheduleInfo: o.scheduleInfo || '',
    capacity: o.capacity || '',
    issuer: o.issuer || '',
    requirements: o.requirements || '',
    relatedExam: o.relatedExam || '',
    validity: o.validity || '',
    verifyInfo: o.verifyInfo || '',
    verifyUrl: o.verifyUrl || '',
    showEmail: Boolean(o.showEmail),
    isActive: o.isActive !== false,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const ITEM_FIELDS = [
  'title', 'subtitle', 'description', 'detailHtml', 'imageUrl', 'icon', 'url',
  'email', 'phone', 'address', 'city', 'mapsUrl', 'code', 'managerName', 'hours',
  'department', 'expertise', 'experience', 'audience', 'curriculum', 'duration',
  'learningMode', 'priceInfo', 'examType', 'scheduleInfo', 'capacity', 'issuer',
  'requirements', 'relatedExam', 'validity', 'verifyInfo', 'verifyUrl',
  'showEmail', 'isActive', 'status', 'sortOrder',
];

function pickItemBody(body = {}) {
  const out = {};
  for (const k of ITEM_FIELDS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (out.sortOrder != null) out.sortOrder = Number(out.sortOrder) || 0;
  if (out.showEmail != null) out.showEmail = Boolean(out.showEmail);
  if (out.isActive != null) out.isActive = Boolean(out.isActive);
  if (out.detailHtml !== undefined) out.detailHtml = sanitizeCenterHtml(out.detailHtml);
  for (const urlKey of ['imageUrl', 'url', 'mapsUrl', 'verifyUrl']) {
    if (out[urlKey] !== undefined) out[urlKey] = sanitizeSafeUrl(out[urlKey]);
  }
  if (out.status && !['draft', 'published', 'archived'].includes(out.status)) {
    delete out.status;
  }
  return out;
}

const OVERVIEW_FIELDS = [
  'status', 'name', 'logoUrl', 'bannerUrl', 'intro', 'mission', 'vision', 'coreValues',
  'foundedYear', 'contactEmail', 'contactPhone', 'website', 'headquartersAddress',
  'detailHtml', 'galleryUrls', 'introVideoUrl',
];

function pickOverviewBody(body = {}) {
  const out = {};
  for (const k of OVERVIEW_FIELDS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (out.detailHtml !== undefined) out.detailHtml = sanitizeCenterHtml(out.detailHtml);
  for (const urlKey of ['logoUrl', 'bannerUrl', 'website', 'introVideoUrl']) {
    if (out[urlKey] !== undefined) out[urlKey] = sanitizeSafeUrl(out[urlKey]);
  }
  if (out.galleryUrls != null) {
    const rawGallery = Array.isArray(out.galleryUrls)
      ? out.galleryUrls
      : String(out.galleryUrls || '').split('\n');
    out.galleryUrls = rawGallery
      .map((s) => sanitizeSafeUrl(s))
      .filter(Boolean);
  }
  if (out.status && !['draft', 'published', 'archived'].includes(out.status)) {
    delete out.status;
  }
  return out;
}

// ── Upload ảnh ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'center-info');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_CENTER_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_CENTER_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function centerImageFileFilter(_req, file, cb) {
  const mime = String(file?.mimetype || '').toLowerCase();
  const ext = path.extname(file?.originalname || '').toLowerCase();
  if (ALLOWED_CENTER_IMAGE_MIMES.has(mime) && ALLOWED_CENTER_IMAGE_EXT.has(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Chỉ cho phép file ảnh JPG, JPEG, PNG, WEBP hoặc GIF'));
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const rawExt = path.extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_CENTER_IMAGE_EXT.has(rawExt)) {
        return cb(new Error('Định dạng ảnh không được phép'));
      }
      cb(null, `center_${Date.now()}_${Math.round(Math.random() * 1e6)}${rawExt}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: centerImageFileFilter,
});

// ── Public (authenticated) ──────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [overview, userCanManage] = await Promise.all([
      getOrCreateOverview(),
      canManage(req.user),
    ]);
    const publishedOnly = overview.status === 'published';
    const items = publishedOnly
      ? await CenterInfoItem.find({
        status: 'published',
        isActive: true,
      }).sort({ section: 1, sortOrder: 1, createdAt: 1 }).lean()
      : [];

    const bySection = {};
    for (const s of SECTIONS) bySection[s] = [];
    for (const it of items) {
      if (bySection[it.section]) bySection[it.section].push(serializeItem(it));
    }

    return res.json({
      success: true,
      data: {
        overview: publishedOnly ? serializeOverview(overview) : null,
        published: publishedOnly,
        sections: bySection,
        canManage: userCanManage,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Manage ──────────────────────────────────────────────────────────────────
router.get('/manage/overview', authMiddleware, manageOnly, async (req, res) => {
  try {
    const overview = await getOrCreateOverview();
    return res.json({ success: true, data: serializeOverview(overview) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/manage/overview', authMiddleware, manageOnly, async (req, res) => {
  try {
    const overview = await getOrCreateOverview();
    const patch = pickOverviewBody(req.body || {});
    Object.assign(overview, patch);
    await overview.save();
    return res.json({ success: true, data: serializeOverview(overview), message: 'Đã lưu tổng quan' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/manage/items', authMiddleware, manageOnly, async (req, res) => {
  try {
    const section = String(req.query.section || '').trim();
    if (!SECTIONS.includes(section)) {
      return res.status(400).json({ success: false, message: 'section không hợp lệ' });
    }
    const rows = await CenterInfoItem.find({ section })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    return res.json({ success: true, data: rows.map(serializeItem) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manage/items', authMiddleware, manageOnly, async (req, res) => {
  try {
    const section = String(req.body?.section || '').trim();
    if (!SECTIONS.includes(section)) {
      return res.status(400).json({ success: false, message: 'section không hợp lệ' });
    }
    const patch = pickItemBody(req.body || {});
    if (!String(patch.title || '').trim()) {
      return res.status(400).json({ success: false, message: 'Nhập tiêu đề / tên' });
    }
    const maxOrder = await CenterInfoItem.findOne({ section }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    const doc = await CenterInfoItem.create({
      section,
      ...patch,
      sortOrder: patch.sortOrder != null ? patch.sortOrder : ((maxOrder?.sortOrder || 0) + 1),
      status: patch.status || 'published',
      isActive: patch.isActive !== false,
    });
    return res.status(201).json({ success: true, data: serializeItem(doc) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/manage/items/:id', authMiddleware, manageOnly, async (req, res) => {
  try {
    const doc = await CenterInfoItem.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    Object.assign(doc, pickItemBody(req.body || {}));
    await doc.save();
    return res.json({ success: true, data: serializeItem(doc) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/manage/items/:id', authMiddleware, manageOnly, async (req, res) => {
  try {
    const doc = await CenterInfoItem.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    return res.json({ success: true, message: 'Đã xóa' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manage/items/reorder', authMiddleware, manageOnly, async (req, res) => {
  try {
    const section = String(req.body?.section || '').trim();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!SECTIONS.includes(section) || !ids.length) {
      return res.status(400).json({ success: false, message: 'Thiếu section hoặc ids' });
    }
    await Promise.all(
      ids.map((id, idx) =>
        CenterInfoItem.updateOne({ _id: id, section }, { $set: { sortOrder: idx + 1 } })
      )
    );
    const rows = await CenterInfoItem.find({ section }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return res.json({ success: true, data: rows.map(serializeItem) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manage/upload', authMiddleware, manageOnly, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Ảnh tối đa 8MB' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Upload thất bại' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Chưa chọn ảnh' });
    normalizeMulterFile(req.file);
    const imageUrl = `/uploads/center-info/${req.file.filename}`;
    return res.json({ success: true, imageUrl });
  });
});

router._test = {
  canManage,
  manageOnly,
  sanitizeCenterHtml,
  sanitizeSafeUrl,
  centerImageFileFilter,
  pickItemBody,
  pickOverviewBody,
};

module.exports = router;
