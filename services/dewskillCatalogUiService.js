'use strict';

const SystemSettings = require('../models/SystemSettings');

const VALID_TIERS = new Set([
  '',
  'all',
  'my-courses',
  'cap-1',
  'cap-2',
  'cap-3',
  'mos',
  'hs-sv',
  'nguoi-di-lam',
  'chung-chi',
]);

const VALID_IMAGE_MODES = new Set(['mascot', 'cover']);
const VALID_VISUALS = new Set(['trophy', 'excel-chart']);

const ACTION_TIER_OPTIONS = [
  { id: 'all', label: 'Tất cả khóa học' },
  { id: 'my-courses', label: 'Khóa của tôi' },
  { id: 'cap-1', label: 'Tiểu học (1–5)' },
  { id: 'cap-2', label: 'THCS (6–9)' },
  { id: 'cap-3', label: 'THPT (10–12)' },
  { id: 'mos', label: 'MOS' },
  { id: 'hs-sv', label: 'HS – Sinh viên' },
  { id: 'nguoi-di-lam', label: 'Người đi làm' },
  { id: 'chung-chi', label: 'Chứng chỉ khác' },
];

const GRADIENT_PRESETS = [
  {
    id: 'dew-emerald',
    label: 'Xanh Ngọc DewSkill',
    value: 'linear-gradient(120deg, #16C172 0%, #0EA885 52%, #08949E 100%)',
  },
  {
    id: 'dew-mos-blue',
    label: 'Xanh Dương MOS',
    value: 'linear-gradient(120deg, #2563EB 0%, #0EA5E9 56%, #0D9488 100%)',
  },
  {
    id: 'dew-school-green',
    label: 'Xanh Lá Học Đường',
    value: 'linear-gradient(120deg, #10B981 0%, #059669 52%, #0284C7 100%)',
  },
  {
    id: 'dew-orange-excel',
    label: 'Cam Thực Chiến Excel',
    value: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 58%, #FBBF24 100%)',
  },
  {
    id: 'dew-deep-blue',
    label: 'Xanh Lam Sâu',
    value: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 54%, #60A5FA 100%)',
  },
  {
    id: 'dew-violet',
    label: 'Tím Học Thuật',
    value: 'linear-gradient(120deg, #6366F1 0%, #4F46E5 52%, #7C3AED 100%)',
  },
  {
    id: 'dew-rose',
    label: 'Hồng Nổi Bật',
    value: 'linear-gradient(120deg, #F43F5E 0%, #E11D48 54%, #FB7185 100%)',
  },
];

const MASCOT_PRESETS = [
  { label: 'Mascot Office W/X/P', url: '/mascot/wor-excel-powerpoint-mascot.gif' },
  { label: 'Mascot Tốt nghiệp MOS', url: '/mascot/tot-nghiep-vui-ve.gif' },
  { label: 'Mascot Năng động', url: '/mascot/nang-dong.gif' },
  { label: 'Mascot Vui vẻ', url: '/mascot/cam-xuc-vui.gif' },
  { label: 'Mascot Học bài', url: '/mascot/cam-xuc-hoc-bai.gif' },
  { label: 'Mascot Đọc sách', url: '/mascot/doc-sach.gif' },
  { label: 'Mascot Quyết tâm', url: '/mascot/quyet-tam.gif' },
  { label: 'Mascot Hoàn thành', url: '/mascot/hoan-thanh-checklish.gif' },
  { label: 'Mascot Ý tưởng', url: '/mascot/y-tuong.gif' },
];

const DEFAULT_CATALOG_UI = {
  showHeroSection: true,
  showFilterBar: true,
  showFeaturedBanner: true,
  sectionTitle: 'KHÓA HỌC PHÙ HỢP',
  autoPlaySeconds: 5.5,
  heroSlides: [
    {
      id: 'trial-stage-1',
      title: 'Học thử miễn phí Chặng 1',
      description: 'Trải nghiệm bài giảng ngắn, bài tập thực hành và chấm điểm trực tiếp',
      ctaLabel: 'Khám phá ngay',
      mascotUrl: '/mascot/wor-excel-powerpoint-mascot.gif',
      imageMode: 'mascot',
      showOfficeBadges: true,
      gradient: 'linear-gradient(120deg, #16C172 0%, #0EA885 52%, #08949E 100%)',
      action: { type: 'scroll', tier: '' },
      isActive: true,
    },
    {
      id: 'mos-prep',
      title: 'Luyện thi MOS chuẩn Certiport',
      description: 'Ôn luyện từng kỹ năng Word, Excel, PowerPoint với phòng thi mô phỏng 50 phút sát đề thật',
      ctaLabel: 'Xem lớp MOS',
      mascotUrl: '/mascot/tot-nghiep-vui-ve.gif',
      imageMode: 'mascot',
      showOfficeBadges: false,
      gradient: 'linear-gradient(120deg, #2563EB 0%, #0EA5E9 56%, #0D9488 100%)',
      action: { type: 'tier', tier: 'mos' },
      isActive: true,
    },
    {
      id: 'k12-kntt',
      title: 'Tin học SGK Kết nối tri thức',
      description: 'Lộ trình Cấp 1–2–3 bám sát chương trình học, thực hành tương tác và tích lũy XP mỗi ngày',
      ctaLabel: 'Học ngay hôm nay',
      mascotUrl: '/mascot/nang-dong.gif',
      imageMode: 'mascot',
      showOfficeBadges: true,
      gradient: 'linear-gradient(120deg, #10B981 0%, #059669 52%, #0284C7 100%)',
      action: { type: 'tier', tier: 'cap-1' },
      isActive: true,
    },
  ],
  miniBanners: [
    {
      id: 'mini-mos',
      title: 'Luyện thi MOS sát đề 95%',
      subtitle: 'Mục tiêu từ 700/1000 điểm',
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 54%, #60A5FA 100%)',
      visual: 'trophy',
      customImageUrl: '',
      targetTier: 'mos',
      isActive: true,
    },
    {
      id: 'mini-excel',
      title: 'Excel Công sở Thực chiến',
      subtitle: 'Kèm 1-1 ca tối linh hoạt',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 58%, #FBBF24 100%)',
      visual: 'excel-chart',
      customImageUrl: '',
      targetTier: 'nguoi-di-lam',
      isActive: true,
    },
  ],
  featuredBanner: {
    titleLine1: 'DEWSKILL',
    titleLine2: 'CHỌN LỌC',
    subtitle: 'Lộ trình học thực hành bài bản cho mọi đối tượng',
    ctaLabel: 'Nhận tư vấn lộ trình',
    ctaPath: '/student/support',
    mascotUrl: '/mascot/cam-xuc-vui.gif',
    gradient: 'linear-gradient(180deg, #10B981 0%, #059669 52%, #0EA5E9 100%)',
  },
  updatedAt: null,
  updatedBy: '',
};

function sanitizeText(value, fallback = '', maxLen = 180) {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return trimmed.slice(0, maxLen);
}

function sanitizeImageUrl(url, fallback = '') {
  if (url === undefined || url === null) return fallback;
  const raw = String(url).trim();
  if (!raw) return '';
  if (raw.includes('..') || raw.includes('\\')) return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return fallback;
  }
  if (raw.startsWith('/mascot/') || raw.startsWith('/uploads/')) {
    return raw.slice(0, 500);
  }
  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    return raw.slice(0, 500);
  }
  return fallback;
}

function sanitizeGradient(val, fallback) {
  if (val === undefined || val === null) return fallback;
  const raw = String(val).trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.includes('url(') ||
    lower.includes('expression(') ||
    raw.includes(';') ||
    raw.includes('{') ||
    raw.includes('}')
  ) {
    return fallback;
  }
  if (
    lower.startsWith('linear-gradient(') ||
    lower.startsWith('radial-gradient(') ||
    /^#[0-9a-f]{3,8}$/i.test(raw)
  ) {
    return raw.slice(0, 220);
  }
  return fallback;
}

function sanitizeCtaPath(val, fallback = '/student/support') {
  if (val === undefined || val === null) return fallback;
  const raw = String(val).trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (
    !raw.startsWith('/student') ||
    raw.startsWith('//') ||
    raw.includes('..') ||
    lower.includes('javascript:')
  ) {
    return fallback;
  }
  return raw.slice(0, 200);
}

function sanitizeTier(val, fallback = 'all') {
  const s = String(val || '').trim();
  return VALID_TIERS.has(s) ? s : fallback;
}

function cloneDefaultUi() {
  return JSON.parse(JSON.stringify(DEFAULT_CATALOG_UI));
}

function sanitizeHeroSlide(slide, index, fallbackSlide) {
  const base = fallbackSlide || DEFAULT_CATALOG_UI.heroSlides[0];
  const rawId = sanitizeText(slide?.id, `slide-${index + 1}`, 48).replace(/[^a-zA-Z0-9_-]/g, '');
  const actionType = slide?.action?.type === 'tier' ? 'tier' : 'scroll';
  const actionTier = actionType === 'tier' ? sanitizeTier(slide?.action?.tier, 'mos') || 'mos' : '';
  const rawMode = String(slide?.imageMode || base.imageMode || 'mascot').trim();

  return {
    id: rawId || `slide-${index + 1}`,
    title: sanitizeText(slide?.title, base.title, 100) || base.title,
    description: sanitizeText(slide?.description, base.description, 260),
    ctaLabel: sanitizeText(slide?.ctaLabel, base.ctaLabel, 48) || base.ctaLabel,
    mascotUrl: sanitizeImageUrl(slide?.mascotUrl, base.mascotUrl) || base.mascotUrl,
    imageMode: VALID_IMAGE_MODES.has(rawMode) ? rawMode : 'mascot',
    showOfficeBadges: slide?.showOfficeBadges !== undefined ? Boolean(slide.showOfficeBadges) : Boolean(base.showOfficeBadges),
    gradient: sanitizeGradient(slide?.gradient, base.gradient),
    action: {
      type: actionType,
      tier: actionTier,
    },
    isActive: slide?.isActive !== undefined ? Boolean(slide.isActive) : true,
  };
}

function sanitizeMiniBanner(mini, index, fallbackMini) {
  const base = fallbackMini || DEFAULT_CATALOG_UI.miniBanners[index] || DEFAULT_CATALOG_UI.miniBanners[0];
  const rawId = sanitizeText(mini?.id, base.id || `mini-${index + 1}`, 48).replace(/[^a-zA-Z0-9_-]/g, '');
  const rawVisual = String(mini?.visual || base.visual || 'trophy').trim();

  return {
    id: rawId || `mini-${index + 1}`,
    title: sanitizeText(mini?.title, base.title, 80) || base.title,
    subtitle: sanitizeText(mini?.subtitle, base.subtitle, 120),
    gradient: sanitizeGradient(mini?.gradient, base.gradient),
    visual: VALID_VISUALS.has(rawVisual) ? rawVisual : base.visual,
    customImageUrl: sanitizeImageUrl(mini?.customImageUrl, ''),
    targetTier: sanitizeTier(mini?.targetTier, base.targetTier) || base.targetTier,
    isActive: mini?.isActive !== undefined ? Boolean(mini.isActive) : true,
  };
}

function sanitizeFeaturedBanner(featured) {
  const base = DEFAULT_CATALOG_UI.featuredBanner;
  if (!featured || typeof featured !== 'object') {
    return { ...base };
  }
  return {
    titleLine1: sanitizeText(featured.titleLine1, base.titleLine1, 40) || base.titleLine1,
    titleLine2: sanitizeText(featured.titleLine2, base.titleLine2, 40) || base.titleLine2,
    subtitle: sanitizeText(featured.subtitle, base.subtitle, 160),
    ctaLabel: sanitizeText(featured.ctaLabel, base.ctaLabel, 48) || base.ctaLabel,
    ctaPath: sanitizeCtaPath(featured.ctaPath, base.ctaPath),
    mascotUrl: sanitizeImageUrl(featured.mascotUrl, base.mascotUrl) || base.mascotUrl,
    gradient: sanitizeGradient(featured.gradient, base.gradient),
  };
}

function sanitizeCatalogUiConfig(input) {
  if (!input || typeof input !== 'object') {
    return cloneDefaultUi();
  }

  const rawSeconds = Number(input.autoPlaySeconds);
  const autoPlaySeconds = Number.isFinite(rawSeconds)
    ? Math.min(20, Math.max(2, Math.round(rawSeconds * 10) / 10))
    : DEFAULT_CATALOG_UI.autoPlaySeconds;

  const rawSlides = Array.isArray(input.heroSlides) && input.heroSlides.length > 0
    ? input.heroSlides.slice(0, 6)
    : DEFAULT_CATALOG_UI.heroSlides;
  const heroSlides = rawSlides.map((s, idx) =>
    sanitizeHeroSlide(s, idx, DEFAULT_CATALOG_UI.heroSlides[idx] || DEFAULT_CATALOG_UI.heroSlides[0])
  );

  const rawMinis = Array.isArray(input.miniBanners) && input.miniBanners.length > 0
    ? input.miniBanners.slice(0, 2)
    : DEFAULT_CATALOG_UI.miniBanners;
  const miniBanners = rawMinis.map((m, idx) =>
    sanitizeMiniBanner(m, idx, DEFAULT_CATALOG_UI.miniBanners[idx] || DEFAULT_CATALOG_UI.miniBanners[0])
  );

  return {
    showHeroSection: input.showHeroSection !== undefined ? Boolean(input.showHeroSection) : true,
    showFilterBar: input.showFilterBar !== undefined ? Boolean(input.showFilterBar) : true,
    showFeaturedBanner: input.showFeaturedBanner !== undefined ? Boolean(input.showFeaturedBanner) : true,
    sectionTitle: sanitizeText(input.sectionTitle, DEFAULT_CATALOG_UI.sectionTitle, 80) || DEFAULT_CATALOG_UI.sectionTitle,
    autoPlaySeconds,
    heroSlides,
    miniBanners,
    featuredBanner: sanitizeFeaturedBanner(input.featuredBanner),
    updatedAt: input.updatedAt ? String(input.updatedAt) : null,
    updatedBy: sanitizeText(input.updatedBy, '', 80),
  };
}

function actorLabel(actor) {
  if (!actor) return '';
  if (typeof actor === 'string') return actor;
  return String(actor.name || actor.username || actor.id || actor._id || '').trim();
}

async function getCatalogUiConfig() {
  const doc = await SystemSettings.findOne({ _key: 'main' })
    .select('dewskillCatalogUi')
    .lean();
  return sanitizeCatalogUiConfig(doc?.dewskillCatalogUi || null);
}

async function saveCatalogUiConfig(input, actor) {
  const sanitized = sanitizeCatalogUiConfig({
    ...(input || {}),
    updatedAt: new Date().toISOString(),
    updatedBy: actorLabel(actor),
  });

  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    { $set: { _key: 'main', dewskillCatalogUi: sanitized } },
    { upsert: true, new: true }
  );

  return sanitized;
}

async function resetCatalogUiConfig(actor) {
  const defaults = cloneDefaultUi();
  defaults.updatedAt = new Date().toISOString();
  defaults.updatedBy = actorLabel(actor);

  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    { $set: { _key: 'main', dewskillCatalogUi: defaults } },
    { upsert: true, new: true }
  );

  return defaults;
}

module.exports = {
  DEFAULT_CATALOG_UI,
  GRADIENT_PRESETS,
  MASCOT_PRESETS,
  ACTION_TIER_OPTIONS,
  sanitizeCatalogUiConfig,
  getCatalogUiConfig,
  saveCatalogUiConfig,
  resetCatalogUiConfig,
};
