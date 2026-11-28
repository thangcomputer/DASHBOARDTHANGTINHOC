'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const DewskillClass = require('../models/DewskillClass');
const StudentDewskillClassAccess = require('../models/StudentDewskillClassAccess');
const DewskillClassPurchaseLog = require('../models/DewskillClassPurchaseLog');
const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticePathProgress = require('../models/DailyPracticePathProgress');
const DailyPracticeSession = require('../models/DailyPracticeSession');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');
const CertPrepCourse = require('../models/CertPrepCourse');
const Student = require('../models/Student');
const PaymentSession = require('../models/PaymentSession');
const SystemSettings = require('../models/SystemSettings');
const ActivationCode = require('../models/ActivationCode');
const { settlePayment } = require('./ledgerService');

const TIER_OPTIONS = [
  { id: 'cap-1', label: 'Tiểu học (Lớp 1–5)', shortLabel: 'Tiểu học', rank: 1 },
  { id: 'cap-2', label: 'THCS (Lớp 6–9)', shortLabel: 'THCS', rank: 2 },
  { id: 'cap-3', label: 'THPT (Lớp 10–12)', shortLabel: 'THPT', rank: 3 },
  { id: 'mos', label: 'MOS (Chứng chỉ Office)', shortLabel: 'MOS', rank: 4 },
  { id: 'hs-sv', label: 'Sinh viên', shortLabel: 'Sinh viên', rank: 5 },
  { id: 'nguoi-di-lam', label: 'Người đi làm', shortLabel: 'Người đi làm', rank: 6 },
  { id: 'chung-chi', label: 'Chứng chỉ khác (IC3 / TT03)', shortLabel: 'Chứng chỉ', rank: 7 },
];

const TIER_RANK = Object.fromEntries(TIER_OPTIONS.map((t) => [t.id, t.rank]));

const VISIBILITY_MODES = [
  {
    id: 'hidden',
    label: 'Ẩn (Nháp)',
    shortLabel: 'Đang ẩn',
    description: 'Chưa hiển thị cho bất kỳ học viên nào. Dùng khi Admin đang soạn khung lớp.',
  },
  {
    id: 'selected',
    label: 'Chỉ học viên được cấp quyền',
    shortLabel: 'Theo từng HV',
    description: 'Chỉ hiển thị với danh sách học viên được Admin chọn và bật quyền.',
  },
  {
    id: 'free_portal',
    label: 'Tất cả tài khoản miễn phí',
    shortLabel: 'TK Miễn phí',
    description: 'Mở hiển thị tự động cho học viên tự đăng ký miễn phí (và các HV được cấp riêng).',
  },
  {
    id: 'all',
    label: 'Tất cả học viên',
    shortLabel: 'Toàn hệ thống',
    description: 'Hiển thị cho mọi tài khoản học viên (trừ tài khoản bị tắt thủ công).',
  },
];

const CURRICULUM_SOURCES = [
  { id: 'KNTT_GDPT2018', label: 'SGK Kết nối tri thức (GDPT 2018)' },
  { id: 'CERTIPORT', label: 'Chuẩn Quốc tế Certiport (MOS / IC3)' },
  { id: 'TT03_IC3', label: 'Chuẩn Thông tư 03 / Đầu ra CNTT' },
  { id: 'DEWSKILL', label: 'Giáo trình thực chiến DewSkill' },
];

const TRACK_OPTIONS = [
  { id: '', label: 'Không phân nhánh' },
  { id: 'general', label: 'Chuẩn chung' },
  { id: 'ict', label: 'Tin học ứng dụng (ICT)' },
  { id: 'cs', label: 'Khoa học máy tính (CS)' },
  { id: 'word', label: 'MOS Word' },
  { id: 'excel', label: 'MOS Excel' },
  { id: 'powerpoint', label: 'MOS PowerPoint' },
  { id: 'combo', label: 'Combo 3 môn MOS' },
];

const LEVEL_OPTIONS = [
  { id: '', label: 'Tự động (theo tên / đối tượng)' },
  { id: 'basic', label: 'Cơ bản' },
  { id: 'intermediate', label: 'Trung cấp' },
  { id: 'advanced', label: 'Nâng cao' },
];

const DEFAULT_CLASS_TEMPLATES = [
  // Cấp 1
  {
    name: 'Tin học Lớp 1–2 (Khởi động)',
    slug: 'tin-hoc-lop-1-2-khoi-dong',
    code: 'TH-L12',
    tier: 'cap-1',
    grade: 1,
    track: 'general',
    curriculumSource: 'DEWSKILL',
    badge: 'Khởi động',
    shortDescription: 'Làm quen máy tính, chuột, bàn phím an toàn và tư duy khối Scratch Jr.',
    accentColor: 'sky',
    sortOrder: 10,
  },
  {
    name: 'Tin học Lớp 3 – Kết nối tri thức',
    slug: 'tin-hoc-lop-3-kntt',
    code: 'KNTT-L3',
    tier: 'cap-1',
    grade: 3,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Thông tin & gõ phím 10 ngón, tổ chức tệp/thư mục, an toàn trên mạng.',
    accentColor: 'emerald',
    sortOrder: 20,
  },
  {
    name: 'Tin học Lớp 4 – Kết nối tri thức',
    slug: 'tin-hoc-lop-4-kntt',
    code: 'KNTT-L4',
    tier: 'cap-1',
    grade: 4,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Soạn thảo Word, trình chiếu PowerPoint cơ bản và lập trình kéo thả Scratch.',
    accentColor: 'violet',
    sortOrder: 30,
  },
  {
    name: 'Tin học Lớp 5 – Kết nối tri thức',
    slug: 'tin-hoc-lop-5-kntt',
    code: 'KNTT-L5',
    tier: 'cap-1',
    grade: 5,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Tìm kiếm thông tin, bản quyền số và dự án game mini với Scratch.',
    accentColor: 'amber',
    sortOrder: 40,
  },
  // Cấp 2
  {
    name: 'Tin học Lớp 6 – Kết nối tri thức',
    slug: 'tin-hoc-lop-6-kntt',
    code: 'KNTT-L6',
    tier: 'cap-2',
    grade: 6,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Mạng Internet, sơ đồ tư duy, định dạng văn bản Word & thuật toán tuần tự.',
    accentColor: 'emerald',
    sortOrder: 10,
  },
  {
    name: 'Tin học Lớp 7 – Kết nối tri thức',
    slug: 'tin-hoc-lop-7-kntt',
    code: 'KNTT-L7',
    tier: 'cap-2',
    grade: 7,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Ứng xử văn minh trên mạng xã hội, bảng tính Excel & trình chiếu đa phương tiện.',
    accentColor: 'sky',
    sortOrder: 20,
  },
  {
    name: 'Tin học Lớp 8 – Kết nối tri thức',
    slug: 'tin-hoc-lop-8-kntt',
    code: 'KNTT-L8',
    tier: 'cap-2',
    grade: 8,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Đạo đức & pháp luật số, lọc/sắp xếp biểu đồ Excel và lập trình cấu trúc lặp.',
    accentColor: 'indigo',
    sortOrder: 30,
  },
  {
    name: 'Tin học Lớp 9 – Kết nối tri thức',
    slug: 'tin-hoc-lop-9-kntt',
    code: 'KNTT-L9',
    tier: 'cap-2',
    grade: 9,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Phần mềm mô phỏng, hàm xác thực bảng tính, video ngắn và dự án giải quyết vấn đề.',
    accentColor: 'amber',
    sortOrder: 40,
  },
  // Cấp 3
  {
    name: 'Tin học Lớp 10 – Kết nối tri thức',
    slug: 'tin-hoc-lop-10-kntt',
    code: 'KNTT-L10',
    tier: 'cap-3',
    grade: 10,
    track: 'general',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'SGK KNTT',
    shortDescription: 'Biểu diễn thông tin, thiết kế đồ họa vector & nhập môn lập trình Python.',
    accentColor: 'emerald',
    sortOrder: 10,
  },
  {
    name: 'Tin học Lớp 11 – Tin học ứng dụng (ICT)',
    slug: 'tin-hoc-lop-11-ict-kntt',
    code: 'KNTT-L11-ICT',
    tier: 'cap-3',
    grade: 11,
    track: 'ict',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'ICT · KNTT',
    shortDescription: 'Hệ điều hành, cơ sở dữ liệu quan hệ Access/SQL và biên tập đa phương tiện.',
    accentColor: 'sky',
    sortOrder: 20,
  },
  {
    name: 'Tin học Lớp 11 – Khoa học máy tính (CS)',
    slug: 'tin-hoc-lop-11-cs-kntt',
    code: 'KNTT-L11-CS',
    tier: 'cap-3',
    grade: 11,
    track: 'cs',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'CS · KNTT',
    shortDescription: 'Thiết kế thuật toán, mảng, tìm kiếm – sắp xếp và đánh giá độ phức tạp.',
    accentColor: 'violet',
    sortOrder: 30,
  },
  {
    name: 'Tin học Lớp 12 – Tin học ứng dụng (ICT)',
    slug: 'tin-hoc-lop-12-ict-kntt',
    code: 'KNTT-L12-ICT',
    tier: 'cap-3',
    grade: 12,
    track: 'ict',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'ICT · Ôn THPT',
    shortDescription: 'Trí tuệ nhân tạo, mạng máy tính, thiết kế trang web HTML/CSS và luyện đề THPT.',
    accentColor: 'rose',
    sortOrder: 40,
  },
  {
    name: 'Tin học Lớp 12 – Khoa học máy tính (CS)',
    slug: 'tin-hoc-lop-12-cs-kntt',
    code: 'KNTT-L12-CS',
    tier: 'cap-3',
    grade: 12,
    track: 'cs',
    curriculumSource: 'KNTT_GDPT2018',
    badge: 'CS · Ôn THPT',
    shortDescription: 'Trí tuệ nhân tạo, kết nối mạng, HTML/CSS chuyên sâu & đề thi THPT theo hướng CS.',
    accentColor: 'amber',
    sortOrder: 50,
  },
  // MOS
  {
    name: 'MOS Word (2019 / Microsoft 365)',
    slug: 'mos-word',
    code: 'MOS-WORD',
    tier: 'mos',
    grade: null,
    track: 'word',
    curriculumSource: 'CERTIPORT',
    badge: 'Certiport',
    shortDescription: 'Soạn thảo chuẩn mẫu, mục lục tự động, Mail Merge & bộ đề thi thử 50 phút.',
    accentColor: 'sky',
    sortOrder: 10,
  },
  {
    name: 'MOS Excel (2019 / Microsoft 365)',
    slug: 'mos-excel',
    code: 'MOS-EXCEL',
    tier: 'mos',
    grade: null,
    track: 'excel',
    curriculumSource: 'CERTIPORT',
    badge: 'Certiport',
    shortDescription: 'Hàm nâng cao, PivotTable, biểu đồ phân tích & luyện đề mô phỏng chuẩn IIG.',
    accentColor: 'emerald',
    sortOrder: 20,
  },
  {
    name: 'MOS PowerPoint (2019 / Microsoft 365)',
    slug: 'mos-powerpoint',
    code: 'MOS-PPT',
    tier: 'mos',
    grade: null,
    track: 'powerpoint',
    curriculumSource: 'CERTIPORT',
    badge: 'Certiport',
    shortDescription: 'Slide Master, Animation đồng bộ, SmartArt & mẹo tăng tốc làm bài thi MOS.',
    accentColor: 'amber',
    sortOrder: 30,
  },
  {
    name: 'Combo 3 môn MOS (Associate / Expert)',
    slug: 'mos-combo-3-mon',
    code: 'MOS-COMBO',
    tier: 'mos',
    grade: null,
    track: 'combo',
    curriculumSource: 'CERTIPORT',
    badge: 'Trọn bộ',
    shortDescription: 'Lộ trình đầy đủ Word, Excel, PowerPoint cho sinh viên cần chuẩn đầu ra.',
    accentColor: 'violet',
    sortOrder: 40,
  },
  // HS - SV
  {
    name: 'Tin học Văn phòng cho HS – Sinh viên',
    slug: 'tin-hoc-van-phong-hs-sv',
    code: 'HSSV-VP',
    tier: 'hs-sv',
    grade: null,
    track: 'general',
    curriculumSource: 'DEWSKILL',
    badge: 'HS – SV',
    shortDescription: 'Trình bày tiểu luận, báo cáo thực tập, slide bảo vệ và xử lý bảng số liệu.',
    accentColor: 'sky',
    sortOrder: 10,
  },
  {
    name: 'Ôn chuẩn đầu ra CNTT (Thông tư 03 / IC3)',
    slug: 'chuan-dau-ra-cntt-tt03-ic3',
    code: 'HSSV-TT03',
    tier: 'hs-sv',
    grade: null,
    track: 'general',
    curriculumSource: 'TT03_IC3',
    badge: 'Đầu ra ĐH',
    shortDescription: '6 mô-đun ứng dụng CNTT cơ bản & nâng cao, trắc nghiệm + thực hành.',
    accentColor: 'indigo',
    sortOrder: 20,
  },
  // Người đi làm
  {
    name: 'Excel Thực chiến cho Kế toán & Nhân sự',
    slug: 'excel-thuc-chien-nguoi-di-lam',
    code: 'WORK-EXCEL',
    tier: 'nguoi-di-lam',
    grade: null,
    track: 'excel',
    curriculumSource: 'DEWSKILL',
    badge: 'Người đi làm',
    shortDescription: 'XLOOKUP, SUMIFS, PivotTable lập báo cáo tổng hợp và xử lý dữ liệu nhanh.',
    accentColor: 'emerald',
    sortOrder: 10,
  },
  {
    name: 'Word & PowerPoint Công sở Chuyên nghiệp',
    slug: 'word-powerpoint-cong-so',
    code: 'WORK-OFFICE',
    tier: 'nguoi-di-lam',
    grade: null,
    track: 'general',
    curriculumSource: 'DEWSKILL',
    badge: 'Công sở',
    shortDescription: 'Soạn thảo hợp đồng, công văn chuẩn Nghị định 30 và thuyết trình báo cáo.',
    accentColor: 'amber',
    sortOrder: 20,
  },
];

function makeErr(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function toSlug(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'lop-hoc';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertObjectId(id, label = 'ID') {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw makeErr(400, `${label} không hợp lệ.`);
  }
  return new mongoose.Types.ObjectId(String(id));
}

function normalizeObjectIdList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const raw = item && typeof item === 'object' ? (item._id || item.id) : item;
    if (!raw) continue;
    const str = String(raw).trim();
    if (!mongoose.Types.ObjectId.isValid(str)) {
      throw makeErr(400, `Mã liên kết không hợp lệ: ${str}`);
    }
    if (!seen.has(str)) {
      seen.add(str);
      out.push(new mongoose.Types.ObjectId(str));
    }
  }
  return out;
}

async function resolveUniqueSlug(baseRaw, excludeId = null) {
  const base = toSlug(baseRaw);
  let candidate = base;
  let step = 1;
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await DewskillClass.exists(query);
    if (!exists) return candidate;
    step += 1;
    candidate = `${base.slice(0, 128)}-${step}`;
  }
}

function isAccessExpired(accessRow, now = new Date()) {
  if (!accessRow || !accessRow.expiresAt) return false;
  return new Date(accessRow.expiresAt).getTime() <= now.getTime();
}

function actorLabel(actor) {
  if (!actor) return '';
  if (typeof actor === 'string') return actor;
  return String(actor.name || actor.username || actor.id || actor._id || '').trim();
}

const DEFAULT_COURSE_DURATION_MONTHS = 12;

function addMonthsCalendar(date, months) {
  const d = date instanceof Date ? date : new Date(date);
  const next = new Date(d.getTime());
  const day = next.getDate();
  const safeMonths = Math.max(1, Math.min(60, Math.round(Number(months) || DEFAULT_COURSE_DURATION_MONTHS)));
  next.setMonth(next.getMonth() + safeMonths);
  if (next.getDate() < day) next.setDate(0);
  return next;
}

function computeCourseExpiry(currentExpiresAt, durationMonths = DEFAULT_COURSE_DURATION_MONTHS, now = new Date()) {
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base = current && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime()
    ? current
    : now;
  return addMonthsCalendar(base, durationMonths);
}

function sanitizeClassPayload(payload = {}) {
  const out = {};
  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) throw makeErr(400, 'Tên lớp học không được để trống.');
    out.name = name;
  }
  if (payload.code !== undefined) {
    out.code = String(payload.code || '').trim().toUpperCase().slice(0, 40);
  }
  if (payload.tier !== undefined) {
    const tier = String(payload.tier || '').trim();
    if (!TIER_RANK[tier]) throw makeErr(400, 'Cấp bậc lớp học không hợp lệ.');
    out.tier = tier;
  }
  if (payload.grade !== undefined) {
    if (payload.grade === null || payload.grade === '') {
      out.grade = null;
    } else {
      const g = Number(payload.grade);
      if (!Number.isInteger(g) || g < 1 || g > 12) {
        throw makeErr(400, 'Khối lớp phải từ 1 đến 12.');
      }
      out.grade = g;
    }
  }
  if (payload.track !== undefined) {
    out.track = String(payload.track || '').trim();
  }
  if (payload.level !== undefined) {
    const level = String(payload.level || '').trim();
    if (!['', 'basic', 'intermediate', 'advanced'].includes(level)) {
      throw makeErr(400, 'Trình độ lớp học không hợp lệ.');
    }
    out.level = level;
  }
  if (payload.curriculumSource !== undefined) {
    out.curriculumSource = String(payload.curriculumSource || 'KNTT_GDPT2018').trim();
  }
  if (payload.badge !== undefined) {
    out.badge = String(payload.badge || '').trim().slice(0, 60);
  }
  if (payload.shortDescription !== undefined) {
    out.shortDescription = String(payload.shortDescription || '').trim().slice(0, 320);
  }
  if (payload.description !== undefined) {
    out.description = String(payload.description || '').trim().slice(0, 2000);
  }
  if (payload.accentColor !== undefined) {
    out.accentColor = String(payload.accentColor || 'emerald').trim();
  }
  if (payload.dailyPracticeTopicIds !== undefined) {
    out.dailyPracticeTopicIds = normalizeObjectIdList(payload.dailyPracticeTopicIds);
  }
  if (payload.certPrepCourseIds !== undefined) {
    out.certPrepCourseIds = normalizeObjectIdList(payload.certPrepCourseIds);
  }
  if (payload.visibilityMode !== undefined) {
    const mode = String(payload.visibilityMode || '').trim();
    if (!['hidden', 'selected', 'free_portal', 'all'].includes(mode)) {
      throw makeErr(400, 'Chế độ hiển thị không hợp lệ.');
    }
    out.visibilityMode = mode;
  }
  if (payload.freePreviewTopics !== undefined) {
    const n = Number(payload.freePreviewTopics);
    out.freePreviewTopics = Number.isFinite(n) ? Math.max(0, Math.min(50, Math.round(n))) : 1;
  }
  if (payload.dailyXpAllowance !== undefined) {
    const xpVal = Number(payload.dailyXpAllowance);
    out.dailyXpAllowance = Number.isFinite(xpVal) ? Math.max(0, Math.min(100000, Math.round(xpVal))) : 100;
  }
  if (payload.durationMonths !== undefined) {
    const dm = Number(payload.durationMonths);
    out.durationMonths = Number.isFinite(dm)
      ? Math.max(1, Math.min(60, Math.round(dm)))
      : DEFAULT_COURSE_DURATION_MONTHS;
  }
  if (payload.includesMeet !== undefined) {
    out.includesMeet = Boolean(payload.includesMeet);
  }
  if (payload.price !== undefined) {
    const p = Number(payload.price);
    out.price = Number.isFinite(p) ? Math.max(0, Math.round(p)) : 0;
  }
  if (payload.originalPrice !== undefined) {
    const op = Number(payload.originalPrice);
    out.originalPrice = Number.isFinite(op) ? Math.max(0, Math.round(op)) : 0;
  }
  if (payload.allowTrial !== undefined) {
    out.allowTrial = Boolean(payload.allowTrial);
  }
  if (payload.allowRegistration !== undefined) {
    out.allowRegistration = Boolean(payload.allowRegistration);
  }
  if (payload.sortOrder !== undefined) {
    const n = Number(payload.sortOrder);
    out.sortOrder = Number.isFinite(n) ? Math.round(n) : 0;
  }
  if (payload.isActive !== undefined) {
    out.isActive = Boolean(payload.isActive);
  }
  return out;
}

async function getMeta() {
  const [topics, certCourses] = await Promise.all([
    DailyPracticeTopic.find({})
      .sort({ sortOrder: 1, createdAt: 1 })
      .select('_id name icon color active')
      .lean(),
    CertPrepCourse.find({})
      .sort({ sortOrder: 1, createdAt: 1 })
      .select('_id name slug isActive')
      .lean(),
  ]);

  return {
    tiers: TIER_OPTIONS,
    visibilityModes: VISIBILITY_MODES,
    curriculumSources: CURRICULUM_SOURCES,
    tracks: TRACK_OPTIONS,
    levels: LEVEL_OPTIONS,
    dailyPracticeTopics: topics,
    certPrepCourses: certCourses,
  };
}

async function listAdminClasses({ tier = '', visibilityMode = '', q = '' } = {}) {
  const filter = {};
  if (tier && TIER_RANK[tier]) filter.tier = tier;
  if (visibilityMode && ['hidden', 'selected', 'free_portal', 'all'].includes(visibilityMode)) {
    filter.visibilityMode = visibilityMode;
  }
  if (q && String(q).trim()) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [{ name: rx }, { code: rx }, { shortDescription: rx }, { badge: rx }];
  }

  const now = new Date();
  const [classes, allCountsSource, activeAccessAgg] = await Promise.all([
    DewskillClass.find(filter)
      .populate('dailyPracticeTopicIds', '_id name icon color active')
      .populate('certPrepCourseIds', '_id name slug isActive')
      .lean(),
    DewskillClass.find({}).select('_id tier visibilityMode isActive').lean(),
    StudentDewskillClassAccess.aggregate([
      {
        $match: {
          isVisible: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        },
      },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = new Map(activeAccessAgg.map((row) => [String(row._id), row.count]));

  const sorted = classes
    .map((cls) => ({
      ...cls,
      grantedStudentCount: countMap.get(String(cls._id)) || 0,
    }))
    .sort((a, b) => {
      const ra = TIER_RANK[a.tier] || 99;
      const rb = TIER_RANK[b.tier] || 99;
      if (ra !== rb) return ra - rb;
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const tierCounts = {};
  for (const t of TIER_OPTIONS) tierCounts[t.id] = 0;
  let hiddenCount = 0;
  let selectedCount = 0;
  let publicCount = 0;
  for (const row of allCountsSource) {
    if (tierCounts[row.tier] !== undefined) tierCounts[row.tier] += 1;
    if (row.visibilityMode === 'hidden' || !row.isActive) hiddenCount += 1;
    else if (row.visibilityMode === 'selected') selectedCount += 1;
    else publicCount += 1;
  }

  const totalActiveGrants = activeAccessAgg.reduce((sum, r) => sum + (r.count || 0), 0);

  return {
    items: sorted,
    summary: {
      totalClasses: allCountsSource.length,
      hiddenCount,
      selectedCount,
      publicCount,
      totalActiveGrants,
      tierCounts,
    },
  };
}

async function createClass(payload, actor) {
  const data = sanitizeClassPayload(payload);
  if (!data.name) throw makeErr(400, 'Tên lớp học không được để trống.');
  if (!data.tier) throw makeErr(400, 'Vui lòng chọn cấp bậc lớp học.');

  const slug = await resolveUniqueSlug(payload.slug || data.name);
  const by = actorLabel(actor);

  const created = await DewskillClass.create({
    ...data,
    slug,
    visibilityMode: data.visibilityMode || 'hidden',
    createdBy: by,
    updatedBy: by,
  });

  return DewskillClass.findById(created._id)
    .populate('dailyPracticeTopicIds', '_id name icon color active')
    .populate('certPrepCourseIds', '_id name slug isActive')
    .lean();
}

async function updateClass(id, payload, actor) {
  const classId = assertObjectId(id, 'Lớp học');
  const existing = await DewskillClass.findById(classId);
  if (!existing) throw makeErr(404, 'Không tìm thấy lớp học.');

  const data = sanitizeClassPayload(payload);
  if (payload.slug !== undefined && String(payload.slug).trim()) {
    data.slug = await resolveUniqueSlug(payload.slug, classId);
  }
  data.updatedBy = actorLabel(actor);

  const updated = await DewskillClass.findByIdAndUpdate(
    classId,
    { $set: data },
    { new: true, runValidators: true }
  )
    .populate('dailyPracticeTopicIds', '_id name icon color active')
    .populate('certPrepCourseIds', '_id name slug isActive')
    .lean();

  return updated;
}

async function updateVisibility(id, payload = {}, actor) {
  const classId = assertObjectId(id, 'Lớp học');
  const patch = {};
  if (payload.visibilityMode !== undefined) {
    const mode = String(payload.visibilityMode || '').trim();
    if (!['hidden', 'selected', 'free_portal', 'all'].includes(mode)) {
      throw makeErr(400, 'Chế độ hiển thị không hợp lệ.');
    }
    patch.visibilityMode = mode;
  }
  if (payload.isActive !== undefined) {
    patch.isActive = Boolean(payload.isActive);
  }
  if (Object.keys(patch).length === 0) {
    throw makeErr(400, 'Không có thông tin hiển thị cần cập nhật.');
  }
  patch.updatedBy = actorLabel(actor);

  const updated = await DewskillClass.findByIdAndUpdate(
    classId,
    { $set: patch },
    { new: true, runValidators: true }
  ).lean();
  if (!updated) throw makeErr(404, 'Không tìm thấy lớp học.');
  return updated;
}

async function deleteClass(id) {
  const classId = assertObjectId(id, 'Lớp học');
  const deleted = await DewskillClass.findByIdAndDelete(classId).lean();
  if (!deleted) throw makeErr(404, 'Không tìm thấy lớp học.');
  const revoked = await StudentDewskillClassAccess.deleteMany({ classId });
  return { deleted, revokedCount: revoked.deletedCount || 0 };
}

async function seedDefaultTemplates(actor) {
  const existingSlugs = new Set(
    (await DewskillClass.find({}).select('slug').lean()).map((x) => x.slug)
  );
  const by = actorLabel(actor);
  let createdCount = 0;
  let skippedCount = 0;

  for (const tpl of DEFAULT_CLASS_TEMPLATES) {
    if (existingSlugs.has(tpl.slug)) {
      skippedCount += 1;
      continue;
    }
    await DewskillClass.create({
      ...tpl,
      visibilityMode: 'hidden',
      freePreviewTopics: 1,
      isActive: true,
      createdBy: by,
      updatedBy: by,
    });
    createdCount += 1;
  }

  return {
    createdCount,
    skippedCount,
    totalTemplates: DEFAULT_CLASS_TEMPLATES.length,
  };
}

async function searchStudents({ q = '', accountFilter = 'all', limit = 30 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const filter = {};
  if (accountFilter === 'free') {
    filter.freePortal = true;
  } else if (accountFilter === 'center') {
    filter.freePortal = { $ne: true };
  }

  const trimmed = String(q || '').trim();
  if (trimmed) {
    const rx = new RegExp(escapeRegex(trimmed), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { studentCode: rx }];
  }

  const rows = await Student.find(filter)
    .sort({ createdAt: -1 })
    .limit(cap)
    .select('_id name phone studentCode freePortal status createdAt')
    .lean();

  return rows;
}

async function listAccess({ classId = '', studentId = '', statusFilter = 'all', q = '' } = {}) {
  const filter = {};
  if (classId) filter.classId = assertObjectId(classId, 'Lớp học');
  if (studentId) filter.studentId = assertObjectId(studentId, 'Học viên');

  const rows = await StudentDewskillClassAccess.find(filter)
    .populate('studentId', '_id name phone studentCode freePortal status')
    .populate('classId', '_id name code tier visibilityMode isActive')
    .sort({ updatedAt: -1 })
    .lean();

  const now = new Date();
  const keyword = String(q || '').trim().toLowerCase();

  return rows.filter((row) => {
    const s = row.studentId && typeof row.studentId === 'object' ? row.studentId : null;
    const c = row.classId && typeof row.classId === 'object' ? row.classId : null;
    if (!s || !c) return false;

    const expired = isAccessExpired(row, now);
    if (statusFilter === 'visible' && (!row.isVisible || expired)) return false;
    if (statusFilter === 'disabled' && row.isVisible) return false;
    if (statusFilter === 'expired' && !expired) return false;

    if (keyword) {
      const hay = [
        s.name,
        s.phone,
        s.studentCode,
        c.name,
        c.code,
        row.note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(keyword)) return false;
    }

    return true;
  });
}

async function grantAccess(payload = {}, actor) {
  const rawStudents = Array.isArray(payload.studentIds)
    ? payload.studentIds
    : payload.studentId
      ? [payload.studentId]
      : [];
  const rawClasses = Array.isArray(payload.classIds)
    ? payload.classIds
    : payload.classId
      ? [payload.classId]
      : [];

  const studentIds = normalizeObjectIdList(rawStudents);
  const classIds = normalizeObjectIdList(rawClasses);

  if (studentIds.length === 0) throw makeErr(400, 'Vui lòng chọn ít nhất 1 học viên.');
  if (classIds.length === 0) throw makeErr(400, 'Vui lòng chọn ít nhất 1 lớp học.');

  const accessLevel = payload.accessLevel === 'preview' ? 'preview' : 'full';
  const note = String(payload.note || '').trim().slice(0, 300);
  let expiresAt = null;
  if (payload.expiresAt) {
    const parsed = new Date(payload.expiresAt);
    if (Number.isNaN(parsed.getTime())) throw makeErr(400, 'Ngày hết hạn không hợp lệ.');
    expiresAt = parsed;
  }

  const [studentsCount, classesFound] = await Promise.all([
    Student.countDocuments({ _id: { $in: studentIds } }),
    DewskillClass.find({ _id: { $in: classIds } }).select('_id visibilityMode').lean(),
  ]);

  if (studentsCount !== studentIds.length) {
    throw makeErr(404, 'Có học viên không tồn tại trong hệ thống.');
  }
  if (classesFound.length !== classIds.length) {
    throw makeErr(404, 'Có lớp học không tồn tại trong hệ thống.');
  }

  const by = actorLabel(actor);
  const now = new Date();
  const ops = [];
  for (const sid of studentIds) {
    for (const cid of classIds) {
      ops.push({
        updateOne: {
          filter: { studentId: sid, classId: cid },
          update: {
            $set: {
              isVisible: true,
              accessLevel,
              expiresAt,
              note,
              grantedBy: by,
              grantedAt: now,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length > 0) {
    await StudentDewskillClassAccess.bulkWrite(ops);
    if (accessLevel === 'full') {
      const dpSvc = require('./dailyPracticeService');
      const { unlockFreePortal } = require('./freePortal');
      await Promise.all([
        ...studentIds.map((sid) => dpSvc.refillDailyXp(sid).catch(() => {})),
        ...studentIds.map((sid) => unlockFreePortal(sid).catch(() => {})),
      ]);
    }
  }

  let updatedHiddenClassCount = 0;
  if (payload.autoEnableSelected) {
    const hiddenIds = classesFound
      .filter((c) => c.visibilityMode === 'hidden')
      .map((c) => c._id);
    if (hiddenIds.length > 0) {
      const upd = await DewskillClass.updateMany(
        { _id: { $in: hiddenIds } },
        { $set: { visibilityMode: 'selected', updatedBy: by } }
      );
      updatedHiddenClassCount = upd.modifiedCount || 0;
    }
  }

  return {
    grantedCount: ops.length,
    updatedHiddenClassCount,
  };
}

async function updateAccess(accessId, payload = {}) {
  const id = assertObjectId(accessId, 'Bản ghi phân quyền');
  const patch = {};
  if (payload.isVisible !== undefined) patch.isVisible = Boolean(payload.isVisible);
  if (payload.accessLevel !== undefined) {
    patch.accessLevel = payload.accessLevel === 'preview' ? 'preview' : 'full';
  }
  if (payload.note !== undefined) {
    patch.note = String(payload.note || '').trim().slice(0, 300);
  }
  if (payload.expiresAt !== undefined) {
    if (!payload.expiresAt) {
      patch.expiresAt = null;
    } else {
      const d = new Date(payload.expiresAt);
      if (Number.isNaN(d.getTime())) throw makeErr(400, 'Ngày hết hạn không hợp lệ.');
      patch.expiresAt = d;
    }
  }
  if (Object.keys(patch).length === 0) {
    throw makeErr(400, 'Không có thay đổi để cập nhật.');
  }

  const updated = await StudentDewskillClassAccess.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true, runValidators: true }
  )
    .populate('studentId', '_id name phone studentCode freePortal status')
    .populate('classId', '_id name code tier visibilityMode isActive')
    .lean();

  if (!updated) throw makeErr(404, 'Không tìm thấy quyền hiển thị lớp học.');
  return updated;
}

async function revokeAccess(accessId) {
  const id = assertObjectId(accessId, 'Bản ghi phân quyền');
  const deleted = await StudentDewskillClassAccess.findByIdAndDelete(id).lean();
  if (!deleted) throw makeErr(404, 'Không tìm thấy quyền hiển thị lớp học.');
  return deleted;
}

async function enforceExpiredCourseAccessAndReset({ studentId = null, now = new Date(), io = null } = {}) {
  const filter = {
    accessLevel: 'full',
    expiresAt: { $ne: null, $lte: now },
  };
  if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(String(studentId))) {
      return { lockedCount: 0, resetTopicsCount: 0, affectedStudents: [] };
    }
    filter.studentId = new mongoose.Types.ObjectId(String(studentId));
  }

  const expiredRows = await StudentDewskillClassAccess.find(filter).lean();
  if (!expiredRows.length) {
    return { lockedCount: 0, resetTopicsCount: 0, affectedStudents: [] };
  }

  const classIds = [...new Set(expiredRows.map((r) => String(r.classId)).filter(Boolean))];
  const classDocs = await DewskillClass.find({ _id: { $in: classIds } })
    .select('_id name dailyPracticeTopicIds')
    .lean();
  const classMap = new Map(classDocs.map((c) => [String(c._id), c]));

  let lockedCount = 0;
  let resetTopicsCount = 0;
  const affectedStudents = [];

  for (const row of expiredRows) {
    const expStr = row.expiresAt ? new Date(row.expiresAt).toLocaleDateString('vi-VN') : '';
    const claimed = await StudentDewskillClassAccess.findOneAndUpdate(
      { _id: row._id, accessLevel: 'full', expiresAt: { $ne: null, $lte: now } },
      {
        $set: {
          accessLevel: 'preview',
          expiredResetAt: now,
          note: `Hết hạn khóa học (${expStr}) — đã khóa & đặt lại về ban đầu`,
        },
      },
      { new: true }
    ).lean();
    if (!claimed) continue;

    lockedCount += 1;
    await DewskillClassPurchaseLog.updateMany(
      {
        studentId: row.studentId,
        classId: row.classId,
        status: 'active',
        expiresAt: { $ne: null, $lte: now },
      },
      { $set: { status: 'expired' } }
    );

    const expiredCls = classMap.get(String(row.classId));
    const candidateTopicIds = (expiredCls?.dailyPracticeTopicIds || [])
      .map((tid) => String(tid || '').trim())
      .filter((tid) => mongoose.Types.ObjectId.isValid(tid));

    const remainingActiveAccess = await StudentDewskillClassAccess.find({
      studentId: row.studentId,
      isVisible: true,
      accessLevel: 'full',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select('classId')
      .lean();

    const remainingClassIds = remainingActiveAccess.map((r) => r.classId).filter(Boolean);
    const keepTopicIds = new Set();
    if (remainingClassIds.length) {
      const remainingClasses = await DewskillClass.find({ _id: { $in: remainingClassIds }, isActive: true })
        .select('dailyPracticeTopicIds')
        .lean();
      for (const rc of remainingClasses) {
        for (const tid of rc.dailyPracticeTopicIds || []) {
          if (tid) keepTopicIds.add(String(tid));
        }
      }
    }

    const topicIdsToReset = candidateTopicIds
      .filter((tid) => !keepTopicIds.has(tid))
      .map((tid) => new mongoose.Types.ObjectId(tid));

    if (topicIdsToReset.length) {
      await Promise.all([
        DailyPracticePathProgress.deleteMany({ studentId: row.studentId, topicId: { $in: topicIdsToReset } }),
        DailyPracticeSession.deleteMany({ studentId: row.studentId, topicId: { $in: topicIdsToReset } }),
      ]);
      resetTopicsCount += topicIdsToReset.length;
    }

    const studentDoc = await Student.findById(row.studentId).select('freePortal subscription').lean();
    let hasActiveSubOrMeet = false;
    if (studentDoc) {
      const subscriptionService = require('./subscriptionService');
      hasActiveSubOrMeet = subscriptionService.hasMeetAccess(studentDoc, now);
      if (!remainingClassIds.length && !hasActiveSubOrMeet && studentDoc.freePortal === true) {
        await Student.updateOne({ _id: row.studentId }, { $set: { freeUnlocked: false } });
      }
    }

    affectedStudents.push({
      studentId: String(row.studentId),
      classId: String(row.classId),
      courseName: expiredCls?.name || 'Khóa học DewSkill',
    });

    if (io) {
      const sidStr = String(row.studentId);
      io.to([sidStr, `student_${sidStr}`]).emit('dewskillClass:expired', {
        classId: String(row.classId),
        courseName: expiredCls?.name || '',
        expiredAt: row.expiresAt,
      });
    }
  }

  return { lockedCount, resetTopicsCount, affectedStudents };
}

async function listVisibleClassesForStudent(studentId) {
  const sid = assertObjectId(studentId, 'Học viên');
  const now = new Date();
  await enforceExpiredCourseAccessAndReset({ studentId: sid, now });

  const [student, activeClasses, accessRows] = await Promise.all([
    Student.findById(sid).select('_id freePortal accountType').lean(),
    DewskillClass.find({ isActive: true, visibilityMode: { $ne: 'hidden' } })
      .populate('dailyPracticeTopicIds', '_id name icon color active')
      .populate('certPrepCourseIds', '_id name slug isActive')
      .lean(),
    StudentDewskillClassAccess.find({ studentId: sid }).lean(),
  ]);

  if (!student) throw makeErr(404, 'Không tìm thấy học viên.');

  const isDewskillStudent = student.accountType === 'dewskill' || student.freePortal === true;
  if (!isDewskillStudent) {
    return [];
  }

  const accessByClass = new Map(accessRows.map((a) => [String(a.classId), a]));
  const isFree = Boolean(student.freePortal);

  const visible = [];
  for (const cls of activeClasses) {
    const acc = accessByClass.get(String(cls._id)) || null;
    const accExplicitlyOff = Boolean(acc && acc.isVisible === false);
    const accActive = Boolean(acc && acc.isVisible === true && !isAccessExpired(acc, now));

    let allow = false;
    let accessSource = null;
    let accessLevel = 'preview';

    if (cls.visibilityMode === 'selected') {
      if (accActive) {
        allow = true;
        accessSource = 'granted';
        accessLevel = acc.accessLevel || 'full';
      }
    } else if (cls.visibilityMode === 'free_portal') {
      if (!accExplicitlyOff && (accActive || isFree)) {
        allow = true;
        accessSource = accActive ? 'granted' : 'free_portal';
        accessLevel = accActive ? (acc.accessLevel || 'full') : 'preview';
      }
    } else if (cls.visibilityMode === 'all') {
      if (!accExplicitlyOff) {
        allow = true;
        accessSource = accActive ? 'granted' : 'all';
        accessLevel = accActive ? (acc.accessLevel || 'full') : 'preview';
      }
    }

    if (allow) {
      visible.push({
        ...cls,
        durationMonths: Math.max(1, Number(cls.durationMonths) || DEFAULT_COURSE_DURATION_MONTHS),
        includesMeet: cls.includesMeet !== false,
        accessSource,
        accessLevel,
        accessExpiresAt: accActive ? acc.expiresAt : null,
        purchasedAt: accActive ? (acc.purchasedAt || acc.grantedAt || null) : null,
        accessExpiredAt: acc?.expiredResetAt || null,
        wasExpired: Boolean(acc?.expiredResetAt && accessLevel !== 'full'),
      });
    }
  }

  visible.sort((a, b) => {
    const ra = TIER_RANK[a.tier] || 99;
    const rb = TIER_RANK[b.tier] || 99;
    if (ra !== rb) return ra - rb;
    if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return visible;
}

async function listActiveClassesForAdminPreview() {
  const activeClasses = await DewskillClass.find({ isActive: true })
    .populate('dailyPracticeTopicIds', '_id name icon color active')
    .populate('certPrepCourseIds', '_id name slug isActive')
    .lean();

  activeClasses.sort((a, b) => {
    const ra = TIER_RANK[a.tier] || 99;
    const rb = TIER_RANK[b.tier] || 99;
    if (ra !== rb) return ra - rb;
    if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return activeClasses.map((cls) => ({
    ...cls,
    accessSource: 'admin_preview',
    accessLevel: 'full',
    accessExpiresAt: null,
  }));
}

async function loadBankPaymentInfo() {
  const settings = await SystemSettings.findOne({ _key: 'main' })
    .select('centerBankCode centerBankName centerBankAccountNumber centerBankAccountName')
    .lean();
  return {
    bankCode: String(settings?.centerBankCode || '').trim(),
    bankName: String(settings?.centerBankName || '').trim(),
    accountNumber: String(settings?.centerBankAccountNumber || '').trim(),
    accountName: String(settings?.centerBankAccountName || '').trim(),
  };
}

function buildVietQrUrl(bank, amount, ref) {
  if (!bank?.bankCode || !bank?.accountNumber) return null;
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(Number(amount) || 0))),
    addInfo: String(ref || ''),
    accountName: String(bank.accountName || ''),
  });
  return `https://img.vietqr.io/image/${bank.bankCode}-${bank.accountNumber}-qr_only.png?${params.toString()}`;
}

function makeDewskillClassRef(student, cls) {
  const stuPart = String(student?.studentCode || student?.phone || student?.zalo || 'HV')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)
    .toUpperCase() || 'HV';
  const clsPart = String(cls?.code || 'LOP')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)
    .toUpperCase() || 'LOP';
  const suffix = String(crypto.randomInt(10000, 100000));
  return `DS ${stuPart} ${clsPart} ${suffix}`;
}

async function hasFullClassAccess(studentId, classId, now = new Date()) {
  const acc = await StudentDewskillClassAccess.findOne({
    studentId,
    classId,
    isVisible: true,
    accessLevel: 'full',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();
  return Boolean(acc);
}

/** Tổng hợp quyền khóa học DewSkill theo môn và mức XP/ngày của học viên. */
async function getStudentOwnedClassXpSummary(studentId, now = new Date()) {
  if (!studentId || !mongoose.Types.ObjectId.isValid(String(studentId))) {
    return {
      hasOwnedClass: false,
      ownedClassCount: 0,
      dailyXpAllowance: 0,
      primaryClassName: '',
      includesMeet: false,
      latestExpiresAt: null,
    };
  }
  await enforceExpiredCourseAccessAndReset({ studentId, now });
  const rows = await StudentDewskillClassAccess.find({
    studentId,
    isVisible: true,
    accessLevel: 'full',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .select('classId expiresAt')
    .lean();
  const classIds = [...new Set(rows.map((r) => r.classId).filter(Boolean))];
  if (!classIds.length) {
    return {
      hasOwnedClass: false,
      ownedClassCount: 0,
      dailyXpAllowance: 0,
      primaryClassName: '',
      includesMeet: false,
      latestExpiresAt: null,
    };
  }
  const classes = await DewskillClass.find({ _id: { $in: classIds }, isActive: true })
    .select('_id name dailyXpAllowance includesMeet')
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  if (!classes.length) {
    return {
      hasOwnedClass: false,
      ownedClassCount: 0,
      dailyXpAllowance: 0,
      primaryClassName: '',
      includesMeet: false,
      latestExpiresAt: null,
    };
  }
  const allowances = classes.map((cls) => {
    const raw = cls?.dailyXpAllowance;
    if (raw === null || raw === undefined) return 100;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 100;
  });
  const activeClassIdSet = new Set(classes.map((c) => String(c._id)));
  const expDates = rows
    .filter((r) => activeClassIdSet.has(String(r.classId)) && r.expiresAt)
    .map((r) => new Date(r.expiresAt))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return {
    hasOwnedClass: true,
    ownedClassCount: classes.length,
    dailyXpAllowance: Math.max(...allowances),
    primaryClassName: String(classes[0]?.name || '').trim(),
    includesMeet: classes.some((cls) => cls.includesMeet !== false),
    latestExpiresAt: expDates[0] ? expDates[0].toISOString() : null,
  };
}

async function checkoutClass({ user, classId }) {
  const cid = assertObjectId(classId, 'Lớp học');
  const sid = assertObjectId(user?.id || user?._id, 'Học viên');

  const [cls, student, bankInfo] = await Promise.all([
    DewskillClass.findOne({ _id: cid, isActive: true }).lean(),
    Student.findById(sid).select('_id name studentCode phone zalo branchId freePortal accountType').lean(),
    loadBankPaymentInfo(),
  ]);

  if (!cls) throw makeErr(404, 'Lớp học không tồn tại hoặc đã tạm ngưng.');
  if (cls.allowRegistration === false) {
    throw makeErr(400, 'Lớp học này hiện chưa mở đăng ký trực tuyến.');
  }
  if (!student) throw makeErr(404, 'Không tìm thấy tài khoản học viên.');
  if (student.accountType !== 'dewskill' && student.freePortal !== true) {
    throw makeErr(403, 'Danh mục khóa học DewSkill chỉ áp dụng cho tài khoản học viên DewSkill.');
  }

  const alreadyFull = await hasFullClassAccess(sid, cid);
  if (alreadyFull) {
    return {
      owned: true,
      classId: String(cls._id),
      courseTitle: cls.name,
    };
  }

  const basePrice = Math.max(0, Math.round(Number(cls.price) || 0));
  const referralConfigService = require('./referralConfigService');
  const [dpProfile, referralCfg, pending] = await Promise.all([
    DailyPracticeProfile.findOne({ studentId: sid })
      .select('referralDiscountAvailableVnd referredByCode')
      .lean(),
    referralConfigService.getReferralConfig(),
    PaymentSession.findOne({
      studentId: sid,
      courseId: cid,
      kind: 'dewskill_class',
      status: 'pending',
    }).sort({ createdAt: -1 }),
  ]);

  const { appliedDiscountVnd, finalAmount: amount } = referralConfigService.calculateReferralDiscount({
    basePrice,
    availableDiscountVnd: dpProfile?.referralDiscountAvailableVnd || 0,
    config: referralCfg,
    target: 'course',
  });
  const referralCodeApplied = appliedDiscountVnd > 0 ? String(dpProfile?.referredByCode || '') : '';

  if (
    pending
    && Number(pending.amount) === amount
    && Number(pending.referralDiscountVnd || 0) === appliedDiscountVnd
  ) {
    return {
      owned: false,
      sessionId: pending.sessionId,
      ref: pending.ref,
      amount: pending.amount,
      basePrice: Number(pending.originalAmount) || basePrice,
      referralDiscountVnd: Number(pending.referralDiscountVnd) || 0,
      referralCodeApplied,
      classId: String(cls._id),
      courseTitle: cls.name,
      studentName: student.name || user?.name || '',
      bankInfo,
      qrUrl: buildVietQrUrl(bankInfo, pending.amount, pending.ref),
    };
  }

  if (pending) {
    pending.status = 'expired';
    await pending.save();
  }

  const sessionId = `dsc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const ref = makeDewskillClassRef(student, cls);

  await PaymentSession.create({
    sessionId,
    ref,
    amount,
    originalAmount: basePrice,
    referralDiscountVnd: appliedDiscountVnd,
    status: 'pending',
    studentName: student.name || user?.name || '',
    courseName: cls.name,
    courseId: cls._id,
    branchId: student.branchId || null,
    studentId: sid,
    kind: 'dewskill_class',
  });

  return {
    owned: false,
    sessionId,
    ref,
    amount,
    basePrice,
    referralDiscountVnd: appliedDiscountVnd,
    referralCodeApplied,
    classId: String(cls._id),
    courseTitle: cls.name,
    studentName: student.name || user?.name || '',
    bankInfo,
    qrUrl: buildVietQrUrl(bankInfo, amount, ref),
  };
}

async function getPaymentSession({ user, sessionId }) {
  const sidStr = String(sessionId || '').trim();
  if (!sidStr) throw makeErr(400, 'Thiếu mã phiên thanh toán.');

  const session = await PaymentSession.findOne({
    sessionId: sidStr,
    kind: 'dewskill_class',
  });

  if (!session) {
    return {
      status: 'not_found',
      paid: false,
      unlockedByAdmin: false,
    };
  }

  const requesterId = String(user?.id || user?._id || '');
  if (user?.role !== 'admin' && String(session.studentId || '') !== requesterId) {
    throw makeErr(403, 'Bạn không có quyền truy cập phiên chuyển khoản này.');
  }

  let unlockedByAdmin = false;
  if (session.status !== 'paid' && session.studentId && session.courseId) {
    const fullNow = await hasFullClassAccess(session.studentId, session.courseId);
    if (fullNow) {
      unlockedByAdmin = true;
      session.status = 'paid';
      await session.save();
    }
  }

  const bankInfo = await loadBankPaymentInfo();
  const paid = session.status === 'paid';
  let expiresAt = null;
  let durationMonths = DEFAULT_COURSE_DURATION_MONTHS;
  if (paid && session.studentId && session.courseId) {
    const accessRow = await StudentDewskillClassAccess.findOne({
      studentId: session.studentId,
      classId: session.courseId,
      accessLevel: 'full',
    })
      .select('expiresAt durationMonths')
      .lean();
    if (accessRow) {
      expiresAt = accessRow.expiresAt || null;
      durationMonths = Number(accessRow.durationMonths) || DEFAULT_COURSE_DURATION_MONTHS;
    }
  }

  return {
    status: session.status,
    paid,
    unlockedByAdmin,
    sessionId: session.sessionId,
    ref: session.ref,
    amount: session.amount,
    basePrice: Number(session.originalAmount) || Number(session.amount) || 0,
    referralDiscountVnd: Number(session.referralDiscountVnd) || 0,
    paidAmount: session.paidAmount || 0,
    classId: session.courseId ? String(session.courseId) : '',
    courseName: session.courseName || '',
    studentName: session.studentName || '',
    expiresAt,
    durationMonths,
    includesMeet: true,
    bankInfo,
    qrUrl: buildVietQrUrl(bankInfo, session.amount, session.ref),
  };
}

async function fulfillClassPurchase({ session, amount, grantedBy = 'sepay', io = null }) {
  if (!session?.studentId || !session?.courseId) {
    throw new Error(`Thiếu học viên hoặc lớp học trong session ${session?.sessionId || ''}`);
  }

  const now = new Date();
  await enforceExpiredCourseAccessAndReset({ studentId: session.studentId, now, io });

  const [student, cls, existingAccess] = await Promise.all([
    Student.findById(session.studentId).select('_id name branchId').lean(),
    DewskillClass.findById(session.courseId).select('_id name code visibilityMode durationMonths includesMeet').lean(),
    StudentDewskillClassAccess.findOne({ studentId: session.studentId, classId: session.courseId }).lean(),
  ]);

  if (!student) throw new Error(`Không tìm thấy học viên ${session.studentId}`);
  if (!cls) throw new Error(`Không tìm thấy lớp học ${session.courseId}`);

  const paidAmt = Math.max(0, Number(amount) || 0);
  if (paidAmt > 0) {
    await settlePayment({
      student: { _id: student._id, branchId: session.branchId || student.branchId || null },
      amount: paidAmt,
      courseName: cls.name,
      source: 'sepay_session',
      sourceRef: session.sessionId,
      idempotencyKey: `payment:sepay:dewskill-class:${session.sessionId}`,
      actor: { id: grantedBy, role: 'system' },
      note: 'Thanh toán mở lớp DewSkill qua chuyển khoản',
      metadata: {
        sessionId: session.sessionId,
        ref: session.ref,
        studentName: session.studentName || student.name || '',
        classId: String(cls._id),
        purchaseType: 'dewskill_class',
        paymentMethod: 'transfer',
      },
      reqMeta: { ip: '', userAgent: grantedBy, branchId: session.branchId || student.branchId || null },
    });
  }

  const durationMonths = Math.max(1, Number(cls.durationMonths) || DEFAULT_COURSE_DURATION_MONTHS);
  const includesMeet = cls.includesMeet !== false;
  const activeCurrentExpiry = existingAccess?.accessLevel === 'full' ? existingAccess.expiresAt : null;
  const expiresAt = computeCourseExpiry(activeCurrentExpiry, durationMonths, now);

  await StudentDewskillClassAccess.findOneAndUpdate(
    { studentId: student._id, classId: cls._id },
    {
      $set: {
        isVisible: true,
        accessLevel: 'full',
        expiresAt,
        purchasedAt: now,
        durationMonths,
        expiredResetAt: null,
        grantedBy,
        grantedAt: now,
        note: `Mở toàn bộ lớp ${durationMonths} tháng (gồm học Meet GV) sau chuyển khoản (${session.ref})`,
      },
    },
    { upsert: true, new: true }
  );

  const existingLog = session.sessionId
    ? await DewskillClassPurchaseLog.findOne({ sessionId: session.sessionId }).lean()
    : null;
  if (!existingLog) {
    const discountNote = Number(session.referralDiscountVnd) > 0
      ? ` · Giảm mã giới thiệu ${Number(session.referralDiscountVnd).toLocaleString('vi-VN')}đ`
      : '';
    await DewskillClassPurchaseLog.create({
      studentId: student._id,
      classId: cls._id,
      courseName: cls.name,
      courseCode: cls.code || '',
      source: grantedBy === 'dev_simulate' ? 'dev_simulate' : 'payment',
      amount: paidAmt,
      durationMonths,
      includesMeet,
      paymentRef: session.ref || '',
      sessionId: session.sessionId || '',
      startsAt: now,
      expiresAt,
      status: 'active',
      note: `Gói khóa học ${durationMonths} tháng${includesMeet ? ' · Có học Meet cùng giảng viên' : ''}${discountNote}`,
    });
  }

  if (Number(session.referralDiscountVnd) > 0 && session.sessionId) {
    await require('./referralConfigService')
      .consumeStudentReferralDiscount(student._id, session.referralDiscountVnd, session.sessionId)
      .catch(() => {});
  }

  await require('./dailyPracticeService').refillDailyXp(student._id).catch(() => {});
  await require('./freePortal').unlockFreePortal(student._id).catch(() => {});

  if (!existingLog) {
    const NotificationService = require('./NotificationService');
    const { buildPurchaseNotification } = require('./purchaseNotificationHelper');
    const notif = buildPurchaseNotification({
      purchaseType: 'course',
      itemName: cls.name,
      amount: paidAmt,
      source: grantedBy === 'dev_simulate' ? 'dev_simulate' : 'payment',
      purchasedAt: now,
      durationText: `${durationMonths} tháng`,
      expiresAt,
      includesMeet,
      paymentRef: session.ref || '',
      classId: String(cls._id),
    });
    await NotificationService.send(io, {
      ...notif,
      receivers: [String(student._id)],
    }).catch(() => {});
  }

  if (io) {
    const { emitFinanceEvent } = require('../utils/realtimeEmit');
    emitFinanceEvent(
      io,
      {
        branchId: session.branchId || student.branchId || null,
        userIds: [String(student._id)],
      },
      'dewskillClass:paid',
      {
        sessionId: session.sessionId,
        classId: String(cls._id),
        amount: paidAmt,
        expiresAt: expiresAt.toISOString(),
        durationMonths,
        includesMeet,
        message: `Đã mở khóa lớp ${cls.name}`,
      }
    );
  }

  return {
    studentId: String(student._id),
    classId: String(cls._id),
    courseName: cls.name,
    expiresAt: expiresAt.toISOString(),
    durationMonths,
    includesMeet,
  };
}

async function simulateClassPurchase({ studentId, sessionId, io = null }) {
  const sid = assertObjectId(studentId, 'Học viên');
  const session = await PaymentSession.findOne({
    sessionId: String(sessionId || '').trim(),
    studentId: sid,
    kind: 'dewskill_class',
  });
  if (!session) throw makeErr(404, 'Không tìm thấy phiên chuyển khoản.');
  if (session.status === 'expired') throw makeErr(409, 'Phiên chuyển khoản đã hết hạn.');

  let claimed = false;
  if (session.status === 'pending') {
    const paidSession = await PaymentSession.findOneAndUpdate(
      { _id: session._id, status: 'pending' },
      { $set: { status: 'paid', paidAmount: session.amount } },
      { returnDocument: 'after' }
    );
    if (!paidSession) {
      const latest = await PaymentSession.findById(session._id);
      if (latest?.status !== 'paid') throw makeErr(409, 'Phiên chuyển khoản không còn hiệu lực.');
      Object.assign(session, latest.toObject());
    } else {
      Object.assign(session, paidSession.toObject());
      claimed = true;
    }
  }

  try {
    const purchase = await fulfillClassPurchase({
      session,
      amount: session.amount,
      grantedBy: 'dev_simulate',
      io,
    });
    return { ...purchase, sessionId: session.sessionId, status: 'paid', paid: true };
  } catch (err) {
    if (claimed) {
      await PaymentSession.updateOne(
        { _id: session._id, status: 'paid' },
        { $set: { status: 'pending' }, $unset: { paidAmount: 1 } }
      );
    }
    throw err;
  }
}

async function redeemClassActivationCode({ user, classId, code, io = null }) {
  const cid = assertObjectId(classId, 'Lớp học');
  const sid = assertObjectId(user?.id || user?._id, 'Học viên');
  const rawCode = String(code || '').trim();
  if (!rawCode) {
    throw makeErr(400, 'Vui lòng nhập mã kích hoạt.');
  }

  const [cls, student] = await Promise.all([
    DewskillClass.findOne({ _id: cid, isActive: true }).lean(),
    Student.findById(sid).select('_id name branchId freePortal accountType').lean(),
  ]);

  if (!cls) throw makeErr(404, 'Lớp học không tồn tại hoặc đã tạm ngưng.');
  if (!student) throw makeErr(404, 'Không tìm thấy tài khoản học viên.');
  if (student.accountType !== 'dewskill' && student.freePortal !== true) {
    throw makeErr(403, 'Danh mục khóa học DewSkill chỉ áp dụng cho tài khoản học viên DewSkill.');
  }

  if (await hasFullClassAccess(sid, cid)) {
    return {
      owned: true,
      alreadyOwned: true,
      classId: String(cls._id),
      courseTitle: cls.name,
    };
  }

  const upper = rawCode.toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');
  const core = compact.replace(/^(DEW|TTH)/, '');
  const candidates = new Set([upper]);
  if (core.length === 8) {
    candidates.add(`DEW-${core.slice(0, 4)}-${core.slice(4)}`);
    candidates.add(`TTH-${core.slice(0, 4)}-${core.slice(4)}`);
  }

  const existing = await ActivationCode.findOne({ code: { $in: [...candidates] } }).lean();
  if (!existing) {
    throw makeErr(404, 'Mã kích hoạt không tồn tại hoặc chưa chính xác. Vui lòng kiểm tra lại hoặc liên hệ hotline 0984 623 486.');
  }
  if (existing.status === 'used') throw makeErr(409, 'Mã kích hoạt đã được sử dụng.');
  if (existing.status === 'revoked') throw makeErr(409, 'Mã kích hoạt đã bị thu hồi.');
  if (existing.classId && String(existing.classId) !== String(cls._id)) {
    throw makeErr(409, 'Mã kích hoạt này không áp dụng cho khóa học đang chọn.');
  }

  const claimed = await ActivationCode.findOneAndUpdate(
    { _id: existing._id, status: 'unused' },
    {
      $set: {
        status: 'used',
        usedBy: sid,
        usedByName: student.name || '',
        usedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  ).lean();

  if (!claimed) throw makeErr(409, 'Mã kích hoạt đã được sử dụng.');

  const now = new Date();
  await enforceExpiredCourseAccessAndReset({ studentId: student._id, now, io });
  const existingAccess = await StudentDewskillClassAccess.findOne({ studentId: student._id, classId: cls._id }).lean();
  const durationMonths = Math.max(1, Number(cls.durationMonths) || DEFAULT_COURSE_DURATION_MONTHS);
  const includesMeet = cls.includesMeet !== false;
  const activeCurrentExpiry = existingAccess?.accessLevel === 'full' ? existingAccess.expiresAt : null;
  const expiresAt = computeCourseExpiry(activeCurrentExpiry, durationMonths, now);

  try {
    await StudentDewskillClassAccess.findOneAndUpdate(
      { studentId: student._id, classId: cls._id },
      {
        $set: {
          isVisible: true,
          accessLevel: 'full',
          expiresAt,
          purchasedAt: now,
          durationMonths,
          expiredResetAt: null,
          grantedBy: 'activation_code',
          grantedAt: now,
          note: `Kích hoạt khóa học ${durationMonths} tháng bằng mã (${claimed.code})`,
        },
      },
      { upsert: true, new: true }
    );
    await DewskillClassPurchaseLog.create({
      studentId: student._id,
      classId: cls._id,
      courseName: cls.name,
      courseCode: cls.code || '',
      source: 'code',
      amount: Math.max(0, Number(cls.price) || 0),
      durationMonths,
      includesMeet,
      activationCode: claimed.code,
      startsAt: now,
      expiresAt,
      status: 'active',
      note: `Kích hoạt bằng mã ${claimed.code} · ${durationMonths} tháng${includesMeet ? ' · Có học Meet' : ''}`,
    });
    await require('./dailyPracticeService').refillDailyXp(student._id).catch(() => {});
    await require('./freePortal').unlockFreePortal(student._id).catch(() => {});
  } catch (err) {
    await ActivationCode.updateOne(
      { _id: claimed._id, status: 'used', usedBy: sid },
      { $set: { status: 'unused', usedBy: null, usedByName: '', usedAt: null } }
    );
    throw err;
  }

  {
    const NotificationService = require('./NotificationService');
    const { buildPurchaseNotification } = require('./purchaseNotificationHelper');
    const notif = buildPurchaseNotification({
      purchaseType: 'course',
      itemName: cls.name,
      amount: Math.max(0, Number(cls.price) || 0),
      source: 'code',
      purchasedAt: now,
      durationText: `${durationMonths} tháng`,
      expiresAt,
      includesMeet,
      activationCode: claimed.code,
      classId: String(cls._id),
    });
    await NotificationService.send(io, {
      ...notif,
      receivers: [String(student._id)],
    }).catch(() => {});
  }

  if (io) {
    const { emitFinanceEvent } = require('../utils/realtimeEmit');
    emitFinanceEvent(
      io,
      {
        branchId: student.branchId || null,
        userIds: [String(student._id)],
      },
      'dewskillClass:paid',
      {
        classId: String(cls._id),
        amount: 0,
        expiresAt: expiresAt.toISOString(),
        durationMonths,
        includesMeet,
        message: `Đã mở khóa lớp ${cls.name}`,
      }
    );
  }

  return {
    owned: true,
    classId: String(cls._id),
    courseTitle: cls.name,
    code: claimed.code,
    expiresAt: expiresAt.toISOString(),
    durationMonths,
    includesMeet,
  };
}

async function listMyPurchaseHistory(studentId) {
  const sid = assertObjectId(studentId, 'Học viên');
  const now = new Date();
  await enforceExpiredCourseAccessAndReset({ studentId: sid, now });

  const LedgerEntry = require('../models/LedgerEntry');
  const aiPackageService = require('./aiPackageService');

  const [logs, accessRows, aiLedgerRows, studentDoc] = await Promise.all([
    DewskillClassPurchaseLog.find({ studentId: sid }).sort({ createdAt: -1 }).limit(50).lean(),
    StudentDewskillClassAccess.find({
      studentId: sid,
      $or: [{ accessLevel: 'full' }, { expiredResetAt: { $ne: null } }],
    })
      .populate('classId', '_id name code price durationMonths includesMeet')
      .sort({ updatedAt: -1 })
      .lean(),
    LedgerEntry.find({ studentId: sid, status: 'posted', 'metadata.purchaseType': 'ai_package' })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    Student.findById(sid).select('aiPlan').lean(),
  ]);

  const seenClassIds = new Set(
    logs.filter((r) => (r.purchaseType || 'course') === 'course' && r.classId).map((row) => String(row.classId))
  );
  const seenSessionIds = new Set(logs.map((row) => String(row.sessionId || '')).filter(Boolean));

  const items = logs.map((row) => {
    const isAi = row.purchaseType === 'ai_package';
    const expiredByDate = Boolean(row.expiresAt && new Date(row.expiresAt).getTime() <= now.getTime());
    const months = Number(row.durationMonths);
    const fallbackLabel = isAi
      ? (aiPackageService.getAiPackagePlan(row.planId)?.shortLabel || (months > 0 ? `${months} tháng` : '24 giờ'))
      : `${months || DEFAULT_COURSE_DURATION_MONTHS} tháng`;
    return {
      id: String(row._id),
      purchaseType: isAi ? 'ai_package' : 'course',
      classId: row.classId ? String(row.classId) : '',
      planId: row.planId || '',
      courseName: row.courseName || (isAi ? 'Gói hỗ trợ AI' : 'Khóa học DewSkill'),
      courseCode: row.courseCode || '',
      source: row.source || 'payment',
      amount: Number(row.amount || 0),
      durationMonths: Number.isFinite(months) ? months : DEFAULT_COURSE_DURATION_MONTHS,
      durationLabel: row.durationLabel || fallbackLabel,
      includesMeet: isAi ? false : row.includesMeet !== false,
      paymentRef: row.paymentRef || '',
      activationCode: row.activationCode || '',
      startsAt: row.startsAt || row.createdAt,
      expiresAt: row.expiresAt || null,
      status: expiredByDate || row.status === 'expired' ? 'expired' : 'active',
      note: row.note || '',
      createdAt: row.createdAt,
    };
  });

  for (const acc of accessRows) {
    const cls = acc.classId && typeof acc.classId === 'object' ? acc.classId : null;
    const cid = cls?._id ? String(cls._id) : String(acc.classId || '');
    if (!cid || seenClassIds.has(cid)) continue;
    const expired = Boolean(acc.expiredResetAt) || (acc.expiresAt && new Date(acc.expiresAt).getTime() <= now.getTime());
    const months = Number(acc.durationMonths || cls?.durationMonths) || DEFAULT_COURSE_DURATION_MONTHS;
    items.push({
      id: `access-${String(acc._id)}`,
      purchaseType: 'course',
      classId: cid,
      planId: '',
      courseName: cls?.name || 'Khóa học DewSkill',
      courseCode: cls?.code || '',
      source: acc.grantedBy === 'activation_code' ? 'code' : (acc.grantedBy === 'admin' ? 'admin' : 'payment'),
      amount: Number(cls?.price || 0),
      durationMonths: months,
      durationLabel: `${months} tháng`,
      includesMeet: cls ? cls.includesMeet !== false : true,
      paymentRef: '',
      activationCode: '',
      startsAt: acc.purchasedAt || acc.grantedAt || acc.createdAt,
      expiresAt: acc.expiresAt || acc.expiredResetAt || null,
      status: expired ? 'expired' : 'active',
      note: acc.note || '',
      createdAt: acc.purchasedAt || acc.grantedAt || acc.createdAt,
    });
  }

  for (const led of aiLedgerRows) {
    const sessId = String(led.metadata?.sessionId || led.sourceRef || '').trim();
    if (sessId && seenSessionIds.has(sessId)) continue;
    if (sessId) seenSessionIds.add(sessId);
    const planId = String(led.metadata?.aiPlan || '').trim().toLowerCase();
    const planDef = aiPackageService.getAiPackagePlan(planId);
    const aiMonths = { '1d': 0, '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
    const matchedCurrent = Boolean(
      studentDoc?.aiPlan?.lastPaymentSessionId
      && sessId
      && studentDoc.aiPlan.lastPaymentSessionId === sessId
    );
    const startsAt = led.postedAt || led.createdAt;
    const expDate = matchedCurrent && studentDoc.aiPlan?.expiresAt
      ? new Date(studentDoc.aiPlan.expiresAt)
      : (planDef ? aiPackageService.computeNextAiPlanExpiry(null, planDef, startsAt) : null);
    const expired = Boolean(expDate && expDate.getTime() <= now.getTime());
    items.push({
      id: `ledger-${String(led._id)}`,
      purchaseType: 'ai_package',
      classId: '',
      planId,
      courseName: led.courseName || planDef?.name || 'Gói hỗ trợ AI',
      courseCode: planDef?.code || '',
      source: 'payment',
      amount: Number(led.amount || planDef?.price || 0),
      durationMonths: aiMonths[planId] ?? 1,
      durationLabel: planDef?.shortLabel || planDef?.durationLabel || '',
      includesMeet: false,
      paymentRef: led.metadata?.ref || '',
      activationCode: '',
      startsAt,
      expiresAt: expDate ? expDate.toISOString() : null,
      status: expired ? 'expired' : 'active',
      note: 'Gói Hỏi AI Không Giới Hạn',
      createdAt: startsAt,
    });
  }

  const aiPlan = studentDoc?.aiPlan;
  if (aiPlan?.plan) {
    const lastSess = String(aiPlan.lastPaymentSessionId || '').trim();
    const alreadyInList = (lastSess && seenSessionIds.has(lastSess))
      || items.some((it) => it.purchaseType === 'ai_package' && it.planId === aiPlan.plan);
    if (!alreadyInList) {
      const planDef = aiPackageService.getAiPackagePlan(aiPlan.plan);
      const aiMonths = { '1d': 0, '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
      const expDate = aiPlan.expiresAt ? new Date(aiPlan.expiresAt) : null;
      const expired = Boolean(expDate && expDate.getTime() <= now.getTime());
      items.push({
        id: `ai-plan-${aiPlan.plan}`,
        purchaseType: 'ai_package',
        classId: '',
        planId: aiPlan.plan,
        courseName: planDef?.name || `Gói hỗ trợ AI (${aiPlan.plan})`,
        courseCode: planDef?.code || '',
        source: 'payment',
        amount: Number(planDef?.price || 0),
        durationMonths: aiMonths[aiPlan.plan] ?? 1,
        durationLabel: planDef?.shortLabel || planDef?.durationLabel || '',
        includesMeet: false,
        paymentRef: '',
        activationCode: '',
        startsAt: aiPlan.activatedAt || now,
        expiresAt: expDate ? expDate.toISOString() : null,
        status: expired ? 'expired' : 'active',
        note: 'Gói Hỏi AI Không Giới Hạn',
        createdAt: aiPlan.activatedAt || now,
      });
    }
  }

  return items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

module.exports = {
  TIER_OPTIONS,
  VISIBILITY_MODES,
  CURRICULUM_SOURCES,
  TRACK_OPTIONS,
  LEVEL_OPTIONS,
  DEFAULT_CLASS_TEMPLATES,
  DEFAULT_COURSE_DURATION_MONTHS,
  addMonthsCalendar,
  computeCourseExpiry,
  enforceExpiredCourseAccessAndReset,
  getMeta,
  listAdminClasses,
  createClass,
  updateClass,
  updateVisibility,
  deleteClass,
  seedDefaultTemplates,
  searchStudents,
  listAccess,
  grantAccess,
  updateAccess,
  revokeAccess,
  listVisibleClassesForStudent,
  listActiveClassesForAdminPreview,
  getStudentOwnedClassXpSummary,
  checkoutClass,
  getPaymentSession,
  fulfillClassPurchase,
  simulateClassPurchase,
  redeemClassActivationCode,
  listMyPurchaseHistory,
};
