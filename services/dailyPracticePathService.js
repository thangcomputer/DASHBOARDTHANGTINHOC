'use strict';

const mongoose = require('mongoose');
const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticeUnit = require('../models/DailyPracticeUnit');
const DailyPracticeQuestion = require('../models/DailyPracticeQuestion');
const DailyPracticePathProgress = require('../models/DailyPracticePathProgress');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');
const LessonUnit = require('../models/LessonUnit');
const Student = require('../models/Student');
const rules = require('./dailyPracticeRules');
const lessonPracticeService = require('./lessonPracticeService');
const subscriptionService = require('./subscriptionService');
const logger = require('../config/logger');

const { httpError } = rules;

/** Mỗi chặng: 3 cấp Dễ → Vừa → Khó (làm xong cấp trước mới mở cấp sau; xong Khó mở chặng tiếp). */
const PATH_STEPS = [
  { key: 'learn', label: 'Dễ', difficulty: 'easy' },
  { key: 'practice', label: 'Vừa', difficulty: 'medium' },
  { key: 'challenge', label: 'Khó', difficulty: 'hard' },
];
/** Chỉ dùng nội bộ / dữ liệu cũ (kiểm tra vượt, tiến độ legacy). */
const LEGACY_CHECKPOINT = 'checkpoint';
const STEPS = [...PATH_STEPS, { key: LEGACY_CHECKPOINT, label: 'Kiểm tra chặng', difficulty: null }];
const STEP_KEYS = STEPS.map((step) => step.key);
const PATH_STEP_KEYS = PATH_STEPS.map((step) => step.key);
const STEP_PASS_PERCENT = 60;
const CHECKPOINT_PASS_PERCENT = 80;
/** Nút mặc định trên lộ trình mỗi chặng mới (admin có thể thêm/bớt/sửa). */
const DEFAULT_PATH_NODES = [
  { key: 'study', label: 'Học bài', icon: 'book' },
  { key: 'practice-1', label: 'Luyện tập', icon: 'dumbbell' },
  { key: 'challenge', label: 'Thử thách', icon: 'flame' },
  { key: 'practice-2', label: 'Luyện tập', icon: 'dumbbell' },
  { key: 'complete', label: 'Hoàn thành', icon: 'crown' },
];
const MIN_UNIT_QUESTIONS = 4;
const GENERAL_UNIT = { autoKey: 'general', title: 'Tổng hợp', description: 'Ôn tập tổng hợp các câu hỏi của chủ đề' };

function requireId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) throw httpError(400, `${label} không hợp lệ`);
  return new mongoose.Types.ObjectId(String(value));
}

function stepMeta(key) {
  return STEPS.find((step) => step.key === key) || null;
}

function passPercent(step, { testOut = false } = {}) {
  if (testOut || step === LEGACY_CHECKPOINT) return CHECKPOINT_PASS_PERCENT;
  return STEP_PASS_PERCENT;
}

function hasTestOutAccess(student, now = new Date()) {
  if (student?.freePortal !== true) return true;
  const status = subscriptionService.statusOf(student, now);
  if (status.state === 'expired' || status.freeTier) return false;
  return Boolean(status.meetLifetime || status.state === 'active' || status.state === 'expiring');
}

function emptyStepVideos() {
  return { learn: [], practice: [], challenge: [] };
}

function isStudyNode(node) {
  return String(node?.icon || '') === 'book';
}

function normalizePathNodes(unit) {
  const raw = unit?.pathNodes;
  if (Array.isArray(raw) && raw.length) {
    return [...raw]
      .filter((node) => node.active !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.key).localeCompare(String(b.key)));
  }
  /** Chặng chưa cấu hình nút → đủ 5 nút kiểu Duolingo (Học bài → Luyện → Thử thách → …). */
  return DEFAULT_PATH_NODES.map((preset, index) => ({
    ...preset,
    sortOrder: index,
    active: true,
    stepVideos: index === 0 ? (unit?.stepVideos || emptyStepVideos()) : emptyStepVideos(),
  }));
}

function progressStepKey(nodeKey, levelKey) {
  return `${nodeKey}:${levelKey}`;
}

function usesCompositeProgress(done) {
  for (const key of done) {
    if (String(key).includes(':')) return true;
  }
  return false;
}

function isLevelDone(done, nodeKey, levelKey, nodeIndex, unitCompleted) {
  if (unitCompleted) return true;
  if (done.has(progressStepKey(nodeKey, levelKey))) return true;
  if (done.has(LEGACY_CHECKPOINT)) return true;
  if (nodeIndex === 0 && !usesCompositeProgress(done) && done.has(levelKey)) return true;
  return false;
}

function studyLessonVideos(node) {
  return node?.stepVideos?.learn || [];
}

function isLessonWatched(watched, nodeKey, video) {
  if (!watched) return false;
  const mongoId = String(video.id || video._id || '');
  if (!mongoId) return false;
  return watched.has(stepVideoId(nodeKey, 'learn', mongoId)) || watched.has(mongoId);
}

function isLevelConfigComplete(node, diff, completedSections) {
  if (!completedSections || completedSections.size === 0) return false;
  const levelConfigs = buildNodeLevelConfigsForStudent(node);
  const cfg = levelConfigs?.[diff];
  if (!cfg) return false;
  const hidden = new Set(Array.isArray(cfg.hiddenSections) ? cfg.hiddenSections : []);
  const order = (Array.isArray(cfg.sectionOrder) ? cfg.sectionOrder : DEFAULT_SECTION_ORDER)
    .filter((k) => DEFAULT_SECTION_ORDER.includes(k) && !hidden.has(k));
  if (!order.length) return true;
  return order.every((secKey) => completedSections.has(`${node.key}:${diff}:${secKey}`));
}

function hasConfiguredLevelContent(node) {
  if (!node?.levelConfigs) return false;
  return DIFFICULTY_KEYS.some((diff) => {
    const raw = node.levelConfigs[diff];
    if (!raw || typeof raw !== 'object') return false;
    return Boolean(
      String(raw.content?.body || '').trim()
      || String(raw.content?.title || '').trim()
      || String(raw.content?.description || '').trim()
      || (Array.isArray(raw.files) && raw.files.length > 0)
      || String(raw.video?.url || '').trim()
      || String(raw.practice?.title || '').trim()
      || String(raw.practice?.description || '').trim(),
    );
  });
}

/** Nút Học bài (icon book): xong khi hoàn thành cả 3 mức Dễ → Vừa → Khó (hoặc hết bài legacy); nút khác: xong 3 nấc Dễ/Vừa/Khó. */
function isNodeComplete(done, node, nodeIndex, unitCompleted, watched = null, completedSections = null) {
  if (unitCompleted) return true;
  if (isStudyNode(node)) {
    const hasConfiguredLevels = hasConfiguredLevelContent(node);
    const lessons = studyLessonVideos(node);
    if (!hasConfiguredLevels && !lessons.length) return true;
    if (hasConfiguredLevels) {
      return DIFFICULTY_KEYS.every((diff) => isLevelConfigComplete(node, diff, completedSections));
    }
    return lessons.every((video) => isLessonWatched(watched, node.key, video));
  }
  return PATH_STEP_KEYS.every((levelKey) => isLevelDone(done, node.key, levelKey, nodeIndex, false));
}

function isFinalUnitLevel(unit, nodeKey, levelKey) {
  const nodes = normalizePathNodes(unit);
  const last = nodes[nodes.length - 1];
  return Boolean(last && last.key === nodeKey && levelKey === 'challenge');
}

const DEFAULT_SECTION_ORDER = ['content', 'file', 'video', 'practice'];
const DIFFICULTY_KEYS = ['easy', 'medium', 'hard'];
const DIFFICULTY_STEP_MAP = { easy: 'learn', medium: 'practice', hard: 'challenge' };
const STEP_DIFFICULTY_MAP = { learn: 'easy', practice: 'medium', challenge: 'hard' };

function normalizeSectionOrder(raw) {
  const seen = new Set();
  const list = [];
  for (const key of Array.isArray(raw) ? raw : []) {
    const clean = String(key || '').trim();
    if (DEFAULT_SECTION_ORDER.includes(clean) && !seen.has(clean)) {
      seen.add(clean);
      list.push(clean);
    }
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) list.push(key);
  }
  return list;
}

function normalizeHiddenSections(raw) {
  const seen = new Set();
  const list = [];
  for (const key of Array.isArray(raw) ? raw : []) {
    const clean = String(key || '').trim();
    if (DEFAULT_SECTION_ORDER.includes(clean) && !seen.has(clean)) {
      seen.add(clean);
      list.push(clean);
    }
  }
  return list;
}

function mapLevelFiles(list) {
  return (Array.isArray(list) ? list : [])
    .filter((f) => f && String(f.url || '').trim())
    .map((f, idx) => ({
      id: String(f.id || `file-${idx + 1}`),
      title: String(f.title || f.name || '').trim().slice(0, 180),
      url: String(f.url || '').trim().slice(0, 500),
      name: String(f.name || f.title || '').trim().slice(0, 180) || 'Tài liệu bài học',
      size: Number(f.size) || 0,
    }));
}

function emptyLevelConfig() {
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sequentialSections: true,
    content: { title: '', description: '', body: '' },
    files: [],
    video: { title: '', url: '', antiSeek: true, checks: [] },
    practice: { title: '', description: '' },
  };
}

function mapSingleLevelConfig(raw, fallbackVideo = null, { admin = false } = {}) {
  const hasRaw = raw && typeof raw === 'object' && (
    raw.content?.body || raw.content?.title || raw.content?.description
    || (Array.isArray(raw.files) && raw.files.length)
    || raw.video?.url || (Array.isArray(raw.video?.checks) && raw.video.checks.length)
    || raw.practice?.title || raw.practice?.description
    || (Array.isArray(raw.sectionOrder) && raw.sectionOrder.length)
    || (Array.isArray(raw.hiddenSections) && raw.hiddenSections.length)
    || raw.sequentialSections === false
    || raw.video?.antiSeek === false
  );
  if (hasRaw) {
    return {
      sectionOrder: normalizeSectionOrder(raw.sectionOrder),
      hiddenSections: normalizeHiddenSections(raw.hiddenSections),
      sequentialSections: raw.sequentialSections !== false,
      content: {
        title: String(raw.content?.title || '').trim(),
        description: String(raw.content?.description || '').trim(),
        body: String(raw.content?.body || '').trim(),
      },
      files: mapLevelFiles(raw.files),
      video: {
        title: String(raw.video?.title || '').trim(),
        url: String(raw.video?.url || '').trim(),
        antiSeek: raw.video?.antiSeek !== false,
        checks: mapChecks(raw.video?.checks, { admin }),
      },
      practice: {
        title: String(raw.practice?.title || '').trim(),
        description: String(raw.practice?.description || '').trim(),
      },
    };
  }
  if (fallbackVideo && (fallbackVideo.content || fallbackVideo.fileUrl || fallbackVideo.url || fallbackVideo.title)) {
    return {
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      hiddenSections: [],
      sequentialSections: true,
      content: {
        title: String(fallbackVideo.title || '').trim(),
        description: '',
        body: String(fallbackVideo.content || '').trim(),
      },
      files: fallbackVideo.fileUrl
        ? [{
          id: 'legacy-file-1',
          title: String(fallbackVideo.fileName || 'Tài liệu đính kèm').trim(),
          url: String(fallbackVideo.fileUrl || '').trim(),
          name: String(fallbackVideo.fileName || 'Tài liệu đính kèm').trim(),
          size: 0,
        }]
        : [],
      video: {
        title: String(fallbackVideo.title || '').trim(),
        url: String(fallbackVideo.url || '').trim(),
        antiSeek: fallbackVideo.antiSeek !== false,
        checks: mapChecks(fallbackVideo.checks, { admin }),
      },
      practice: { title: '', description: '' },
    };
  }
  return emptyLevelConfig();
}

function mapNodeLevelConfigs(node, { admin = false } = {}) {
  const rawLevels = node?.levelConfigs || {};
  const sv = node?.stepVideos || {};
  return {
    easy: mapSingleLevelConfig(rawLevels.easy, sv.learn?.[0] || null, { admin }),
    medium: mapSingleLevelConfig(rawLevels.medium, sv.practice?.[0] || null, { admin }),
    hard: mapSingleLevelConfig(rawLevels.hard, sv.challenge?.[0] || null, { admin }),
  };
}

function levelConfigsInput(raw, nodeLabel = 'Bài') {
  const out = {};
  for (const diff of DIFFICULTY_KEYS) {
    const cfg = raw?.[diff] || {};
    const files = (Array.isArray(cfg.files) ? cfg.files : [])
      .map((f, idx) => {
        const url = String(f?.url || '').trim().slice(0, 500);
        if (!url) return null;
        if (!isValidMediaUrl(url)) throw httpError(400, `${nodeLabel} (${diff}): file ${idx + 1} không hợp lệ`);
        const name = String(f?.name || f?.title || '').trim().slice(0, 180) || `Tài liệu ${idx + 1}`;
        return {
          id: String(f?.id || `file-${idx + 1}`).trim().slice(0, 80),
          title: String(f?.title || name).trim().slice(0, 180),
          url,
          name,
          size: Math.max(0, Number(f?.size) || 0),
        };
      })
      .filter(Boolean)
      .slice(0, 20);
    const videoUrl = String(cfg.video?.url || '').trim().slice(0, 500);
    if (videoUrl && !isValidMediaUrl(videoUrl)) {
      throw httpError(400, `${nodeLabel} (${diff}): link video không hợp lệ`);
    }
    out[diff] = {
      sectionOrder: normalizeSectionOrder(cfg.sectionOrder),
      hiddenSections: normalizeHiddenSections(cfg.hiddenSections),
      sequentialSections: cfg.sequentialSections !== false,
      content: {
        title: String(cfg.content?.title || '').trim().slice(0, 160),
        description: String(cfg.content?.description || '').trim().slice(0, 320),
        body: String(cfg.content?.body || '').trim().slice(0, 15000),
      },
      files,
      video: {
        title: String(cfg.video?.title || '').trim().slice(0, 160),
        url: videoUrl,
        antiSeek: cfg.video?.antiSeek !== false,
        checks: checksInput(cfg.video?.checks, `${nodeLabel} (${diff})`),
      },
      practice: {
        title: String(cfg.practice?.title || '').trim().slice(0, 160),
        description: String(cfg.practice?.description || '').trim().slice(0, 320),
      },
    };
  }
  return out;
}

function mapPathNodesRaw(unit, { admin = false } = {}) {
  return normalizePathNodes(unit).map((node, index) => ({
    key: String(node.key),
    label: String(node.label || node.key),
    icon: String(node.icon || 'dumbbell'),
    sortOrder: node.sortOrder ?? index,
    active: node.active !== false,
    lockMode: ['sequential', 'unlocked', 'locked'].includes(node.lockMode) ? node.lockMode : 'sequential',
    stepVideos: mapStepVideos({ stepVideos: node.stepVideos || emptyStepVideos() }, { admin }),
    levelConfigs: mapNodeLevelConfigs(node, { admin }),
  }));
}

function mapChecks(list, { admin = false } = {}) {
  return (list || []).map((check) => {
    const pub = {
      id: String(check._id || check.id),
      atSec: Number(check.atSec) || 0,
      kind: check.kind || 'choice',
      prompt: check.prompt || '',
      choices: check.kind === 'choice' ? (check.choices || []) : [],
      hintCostXp: Number(check.hintCostXp) || 0,
    };
    if (!admin) return pub;
    return {
      ...pub,
      answer: check.answer || '',
      criteria: check.criteria || '',
      shortHint: check.shortHint || '',
      paidHint: check.paidHint || '',
    };
  });
}

function mapVideos(list, { admin = false } = {}) {
  return (list || []).map((video) => ({
    id: String(video._id || video.id),
    title: video.title,
    url: video.url || '',
    content: video.content || '',
    fileUrl: video.fileUrl || '',
    fileName: video.fileName || '',
    checks: mapChecks(video.checks, { admin }),
  }));
}

function isValidMediaUrl(url) {
  return /^https?:\/\/\S+$/i.test(url) || /^\/uploads\/\S+$/.test(url);
}

function mapStepVideos(unit, { admin = false } = {}) {
  const raw = unit.stepVideos || {};
  return {
    learn: mapVideos(raw.learn, { admin }),
    practice: mapVideos(raw.practice, { admin }),
    challenge: mapVideos(raw.challenge, { admin }),
  };
}

function stepVideoId(nodeKey, levelKey, videoId) {
  return `${nodeKey}:${levelKey}:${videoId}`;
}

function parseStepVideoId(videoId) {
  const modern = String(videoId || '').match(/^([^:]+):(learn|practice|challenge):(.+)$/);
  if (modern) return { nodeKey: modern[1], stepKey: modern[2], mongoId: modern[3] };
  const legacy = String(videoId || '').match(/^(learn|practice|challenge)-(.+)$/);
  if (legacy) return { nodeKey: 'study', stepKey: legacy[1], mongoId: legacy[2] };
  return null;
}

function unitIsCompleted(progress, done, unit) {
  if (progress?.completedAt) return true;
  if (done.has(LEGACY_CHECKPOINT)) return true;
  const nodes = normalizePathNodes(unit);
  if (!nodes.length) return false;
  const watched = new Set(progress?.watchedVideoIds || []);
  return nodes.every((node, nodeIndex) => {
    const mapped = { ...node, stepVideos: mapStepVideos({ stepVideos: node.stepVideos || emptyStepVideos() }) };
    return isNodeComplete(done, mapped, nodeIndex, false, watched);
  });
}

async function unitCounts(unitIds) {
  if (!unitIds.length) return new Map();
  const rows = await DailyPracticeQuestion.aggregate([
    { $match: { unitId: { $in: unitIds } } },
    { $group: { _id: { unitId: '$unitId', difficulty: '$difficulty', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byUnit = new Map();
  for (const row of rows) {
    const key = String(row._id.unitId);
    const counts = byUnit.get(key) || { easy: 0, medium: 0, hard: 0, draft: 0, total: 0 };
    if (row._id.status === 'published') {
      counts[row._id.difficulty] += row.n;
      counts.total += row.n;
    } else {
      counts.draft += row.n;
    }
    byUnit.set(key, counts);
  }
  return byUnit;
}

function normalizeImageUrl(raw) {
  const url = String(raw || '').trim().slice(0, 500);
  if (!url) return '';
  if (!/^https?:\/\/\S+$/i.test(url) && !/^\/uploads\/\S+$/.test(url)) {
    throw httpError(400, 'Link ảnh chặng không hợp lệ (http/https hoặc /uploads/...)');
  }
  return url;
}

function unitView(unit, counts) {
  return {
    id: String(unit._id),
    topicId: String(unit.topicId),
    title: unit.title,
    description: unit.description || '',
    imageUrl: unit.imageUrl || '',
    sortOrder: unit.sortOrder || 0,
    active: unit.active !== false,
    lessonUnitId: unit.lessonUnitId ? String(unit.lessonUnitId) : '',
    videos: mapVideos(unit.videos, { admin: true }),
    stepVideos: mapStepVideos(unit, { admin: true }),
    pathNodes: mapPathNodesRaw(unit, { admin: true }),
    auto: Boolean(unit.autoKey),
    counts: counts || { easy: 0, medium: 0, hard: 0, draft: 0, total: 0 },
  };
}

/**
 * Chủ đề chưa có chặng nào: gom các câu đã có vào chặng "Tổng hợp" để lộ trình dùng được ngay.
 * Idempotent (unique topicId + autoKey).
 */
async function ensureDefaultUnit(topicId) {
  if (await DailyPracticeUnit.exists({ topicId })) return false;
  const unassigned = await DailyPracticeQuestion.countDocuments({ topicId, unitId: null, status: 'published' });
  if (unassigned < MIN_UNIT_QUESTIONS) return false;
  let unit;
  try {
    unit = await DailyPracticeUnit.findOneAndUpdate(
      { topicId, autoKey: GENERAL_UNIT.autoKey },
      { $setOnInsert: { title: GENERAL_UNIT.title, description: GENERAL_UNIT.description, sortOrder: 1 } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
  } catch (err) {
    if (err?.code !== 11000) throw err;
    unit = await DailyPracticeUnit.findOne({ topicId, autoKey: GENERAL_UNIT.autoKey }).lean();
  }
  if (!unit) return false;
  await DailyPracticeQuestion.updateMany({ topicId, unitId: null }, { $set: { unitId: unit._id } });
  return true;
}

// ── Admin ────────────────────────────────────────────────────────────────────
async function assertTopic(topicId) {
  const id = requireId(topicId, 'Chủ đề');
  if (!await DailyPracticeTopic.exists({ _id: id })) throw httpError(404, 'Không tìm thấy chủ đề');
  return id;
}

async function listUnits(topicId) {
  const tid = await assertTopic(topicId);
  await ensureDefaultUnit(tid);
  const units = await DailyPracticeUnit.find({ topicId: tid }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const counts = await unitCounts(units.map((unit) => unit._id));
  const unassigned = await DailyPracticeQuestion.countDocuments({ topicId: tid, unitId: null });
  return { units: units.map((unit) => unitView(unit, counts.get(String(unit._id)))), unassigned };
}

const MAX_UNIT_VIDEOS = 20;

/**
 * Mục bài / video: giữ id cũ.
 * requireUrl=true (video chung chặng): bắt buộc link.
 * requireUrl=false (bài học nút Học bài): cần nội dung chữ và/hoặc video.
 */
function checksInput(list, label) {
  const items = Array.isArray(list) ? list.slice(0, 6) : [];
  return items.map((raw, index) => {
    const atSec = Math.max(0, Math.min(86400, Math.round(Number(raw?.atSec) || 0)));
    const kind = ['choice', 'text', 'screen'].includes(raw?.kind) ? raw.kind : 'choice';
    const prompt = String(raw?.prompt || '').trim().slice(0, 300);
    if (!prompt) throw httpError(400, `${label}, mốc ${index + 1}: chưa có câu hỏi`);
    const choices = (Array.isArray(raw?.choices) ? raw.choices : [])
      .map((item) => String(item || '').trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 4);
    const answer = String(raw?.answer ?? '').trim().slice(0, 200);
    if (kind === 'choice') {
      if (choices.length < 2) throw httpError(400, `${label}, mốc ${index + 1}: cần ít nhất 2 đáp án`);
      const picked = Number(answer);
      if (!Number.isInteger(picked) || picked < 0 || picked >= choices.length) {
        throw httpError(400, `${label}, mốc ${index + 1}: chọn đáp án đúng`);
      }
    }
    if (kind === 'text' && !answer) throw httpError(400, `${label}, mốc ${index + 1}: chưa có đáp án nhập`);
    const criteria = String(raw?.criteria || '').trim().slice(0, 500);
    if (kind === 'screen' && !criteria) throw httpError(400, `${label}, mốc ${index + 1}: chưa có tiêu chí AI chấm`);
    const check = {
      atSec,
      kind,
      prompt,
      choices: kind === 'choice' ? choices : [],
      answer: kind === 'screen' ? '' : answer,
      criteria,
      shortHint: String(raw?.shortHint || '').trim().slice(0, 160),
      paidHint: String(raw?.paidHint || '').trim().slice(0, 300),
      hintCostXp: Math.max(0, Math.min(50, Math.round(Number(raw?.hintCostXp) || 5))),
    };
    if (mongoose.Types.ObjectId.isValid(String(raw?.id || ''))) check._id = new mongoose.Types.ObjectId(String(raw.id));
    return check;
  }).sort((a, b) => a.atSec - b.atSec);
}

function videosInput(list, { requireUrl = true, label = 'Video' } = {}) {
  if (list.length > MAX_UNIT_VIDEOS) throw httpError(400, `Tối đa ${MAX_UNIT_VIDEOS} mục`);
  return list.map((raw, index) => {
    const title = String(raw?.title || '').trim().slice(0, 120);
    const url = String(raw?.url || '').trim().slice(0, 500);
    const content = String(raw?.content || '').trim().slice(0, 5000);
    const fileUrl = String(raw?.fileUrl || '').trim().slice(0, 500);
    const fileName = String(raw?.fileName || '').trim().slice(0, 180);
    if (!title) throw httpError(400, `${label} ${index + 1}: chưa nhập tên`);
    if (url && !isValidMediaUrl(url)) throw httpError(400, `${label} ${index + 1}: link video không hợp lệ`);
    if (fileUrl && !isValidMediaUrl(fileUrl)) throw httpError(400, `${label} ${index + 1}: file không hợp lệ`);
    if (requireUrl) {
      if (!url) throw httpError(400, `${label} ${index + 1}: chưa có link video`);
    } else if (!url && !content && !fileUrl) {
      throw httpError(400, `${label} ${index + 1}: cần nội dung, file hoặc video`);
    }
    const video = { title, url: url || '', content: content || '', fileUrl: fileUrl || '', fileName: fileName || '', checks: checksInput(raw?.checks, `${label} ${index + 1}`) };
    if (mongoose.Types.ObjectId.isValid(String(raw?.id || ''))) video._id = new mongoose.Types.ObjectId(String(raw.id));
    return video;
  });
}

function pathNodesInput(list) {
  if (!Array.isArray(list)) throw httpError(400, 'Danh sách nút lộ trình không hợp lệ');
  if (!list.length) throw httpError(400, 'Mỗi chặng cần ít nhất một nút trên lộ trình');
  if (list.length > 12) throw httpError(400, 'Mỗi chặng tối đa 12 nút lộ trình');
  const keys = new Set();
  return list.map((raw, index) => {
    const key = String(raw?.key || '').trim().slice(0, 40);
    if (!/^[a-z0-9][a-z0-9-_]*$/i.test(key)) throw httpError(400, `Nút ${index + 1}: mã nút không hợp lệ (chữ, số, -, _)`);
    if (keys.has(key)) throw httpError(400, `Trùng mã nút "${key}"`);
    keys.add(key);
    const label = String(raw?.label || '').trim().slice(0, 40);
    if (!label) throw httpError(400, `Nút ${index + 1}: chưa nhập tên hiển thị`);
    const node = {
      key,
      label,
      icon: String(raw?.icon || 'dumbbell').trim().slice(0, 24) || 'dumbbell',
      sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : index,
      active: raw?.active !== false,
      lockMode: ['sequential', 'unlocked', 'locked'].includes(raw?.lockMode) ? raw.lockMode : 'sequential',
      stepVideos: emptyStepVideos(),
    };
    const sv = raw?.stepVideos;
    if (sv && typeof sv === 'object') {
      const study = String(raw?.icon || '') === 'book';
      for (const level of PATH_STEP_KEYS) {
        if (!Array.isArray(sv[level])) continue;
        // Học bài · learn = bài học (nội dung/video); các cấp khác / nút luyện = video ôn (nếu có).
        const lessonLike = study && level === 'learn';
        node.stepVideos[level] = videosInput(sv[level], {
          requireUrl: !lessonLike,
          label: lessonLike ? 'Bài' : 'Video',
        });
      }
    }
    if (raw?.levelConfigs && typeof raw.levelConfigs === 'object') {
      node.levelConfigs = levelConfigsInput(raw.levelConfigs, label);
      // Đồng bộ ngược stepVideos.learn[0] từ levelConfigs.easy nếu stepVideos.learn đang trống (hỗ trợ API/UI cũ)
      const easy = node.levelConfigs.easy;
      const hasEasy = Boolean(easy.content.body || easy.files.length || easy.video.url);
      if (node.icon === 'book' && hasEasy && !node.stepVideos.learn.length) {
        node.stepVideos.learn = [{
          title: easy.content.title || label,
          url: easy.video.url || '',
          content: easy.content.body || '',
          fileUrl: easy.files[0]?.url || '',
          fileName: easy.files[0]?.name || '',
          checks: easy.video.checks || [],
        }];
      }
    }
    return node;
  });
}

async function unitInput(body = {}) {
  const title = String(body.title || '').trim().slice(0, 80);
  if (!title) throw httpError(400, 'Tên chặng không được để trống');
  const input = {
    title,
    description: String(body.description || '').trim().slice(0, 240),
    active: body.active !== false,
  };
  if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
    input.imageUrl = normalizeImageUrl(body.imageUrl);
  }
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) input.sortOrder = Number(body.sortOrder);
  if (Array.isArray(body.videos)) input.videos = videosInput(body.videos);
  if (body.stepVideos && typeof body.stepVideos === 'object') {
    input.stepVideos = {};
    for (const key of PATH_STEP_KEYS) {
      if (Array.isArray(body.stepVideos[key])) input.stepVideos[key] = videosInput(body.stepVideos[key]);
    }
  }
  if (Array.isArray(body.pathNodes)) input.pathNodes = pathNodesInput(body.pathNodes);
  if (Object.prototype.hasOwnProperty.call(body, 'lessonUnitId')) {
    const raw = String(body.lessonUnitId || '').trim();
    if (!raw) {
      input.lessonUnitId = null;
    } else {
      const lessonUnitId = requireId(raw, 'Buổi video');
      if (!await LessonUnit.exists({ _id: lessonUnitId })) throw httpError(400, 'Không tìm thấy buổi video');
      input.lessonUnitId = lessonUnitId;
    }
  }
  return input;
}

async function createUnit(topicId, body) {
  const tid = await assertTopic(topicId);
  const input = await unitInput(body);
  if (input.sortOrder === undefined) {
    const last = await DailyPracticeUnit.findOne({ topicId: tid }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    input.sortOrder = (last?.sortOrder || 0) + 1;
  }
  if (!input.pathNodes?.length) {
    input.pathNodes = DEFAULT_PATH_NODES.map((preset, index) => ({
      ...preset,
      sortOrder: index,
      active: true,
      stepVideos: emptyStepVideos(),
    }));
  }
  const unit = await DailyPracticeUnit.create({ ...input, topicId: tid });
  return unitView(unit.toObject());
}

async function updateUnit(id, body) {
  const unit = await DailyPracticeUnit.findByIdAndUpdate(
    requireId(id, 'Chặng'),
    { $set: await unitInput(body) },
    { returnDocument: 'after' },
  ).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const counts = await unitCounts([unit._id]);
  return unitView(unit, counts.get(String(unit._id)));
}

/** Đổi thứ tự chặng trong chủ đề theo danh sách id. */
async function reorderUnits(topicId, unitIds = []) {
  const tid = await assertTopic(topicId);
  const ids = (Array.isArray(unitIds) ? unitIds : []).map((value) => requireId(value, 'Chặng'));
  await Promise.all(ids.map((unitId, index) => DailyPracticeUnit.updateOne({ _id: unitId, topicId: tid }, { $set: { sortOrder: index + 1 } })));
  return listUnits(tid);
}

/** Xóa chặng: câu hỏi chuyển về "chưa xếp chặng", tiến độ của chặng bị xóa. */
async function deleteUnit(id) {
  const unitId = requireId(id, 'Chặng');
  const unit = await DailyPracticeUnit.findByIdAndDelete(unitId).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const { modifiedCount } = await DailyPracticeQuestion.updateMany({ unitId }, { $set: { unitId: null } });
  await DailyPracticePathProgress.deleteMany({ unitId });
  return { releasedQuestions: modifiedCount || 0 };
}

/** Xếp toàn bộ câu chưa có chặng của chủ đề vào một chặng (có sẵn hoặc tạo mới). */
async function assignUnassigned(topicId, { unitId = '', title = '' } = {}) {
  const tid = await assertTopic(topicId);
  let unit;
  if (unitId) {
    unit = await DailyPracticeUnit.findOne({ _id: requireId(unitId, 'Chặng'), topicId: tid }).lean();
    if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  } else {
    unit = await createUnit(tid, { title: String(title || '').trim() || GENERAL_UNIT.title });
    unit = { _id: new mongoose.Types.ObjectId(unit.id) };
  }
  const { modifiedCount } = await DailyPracticeQuestion.updateMany({ topicId: tid, unitId: null }, { $set: { unitId: unit._id } });
  return { unitId: String(unit._id), assigned: modifiedCount || 0 };
}

/** Kiểm tra chặng thuộc đúng chủ đề (dùng khi tạo/sửa câu hỏi). '' → null. */
async function resolveQuestionUnit(topicId, rawUnitId) {
  const raw = String(rawUnitId || '').trim();
  if (!raw) return null;
  const unitId = requireId(raw, 'Chặng');
  const unit = await DailyPracticeUnit.findOne({ _id: unitId, topicId }).select('_id').lean();
  if (!unit) throw httpError(400, 'Chặng không thuộc chủ đề này');
  return unit._id;
}

// ── Học viên ────────────────────────────────────────────────────────────────
function mapNodeForProgress(node) {
  return { ...node, stepVideos: mapStepVideos({ stepVideos: node.stepVideos || emptyStepVideos() }) };
}

function buildNodeLevelConfigsForStudent(node) {
  const mapped = mapNodeLevelConfigs(node, { admin: false });
  for (const diff of DIFFICULTY_KEYS) {
    const vid = mapped[diff].video;
    if (vid) {
      vid.id = `${node.key}:level:${diff}`;
      vid.nodeKey = node.key;
      vid.difficulty = diff;
    }
  }
  return mapped;
}

function buildNodeLevels(node, nodeIndex, nodes, done, unitUnlocked, unitCompleted, watched, completedSections = null) {
  const nodeKey = node.key;
  const prev = nodeIndex > 0 ? mapNodeForProgress(nodes[nodeIndex - 1]) : null;
  const prevNodeDone = nodeIndex === 0 || isNodeComplete(done, prev, nodeIndex - 1, unitCompleted, watched, completedSections);
  const lockMode = ['sequential', 'unlocked', 'locked'].includes(node.lockMode) ? node.lockMode : 'sequential';
  const nodeUnlocked = lockMode === 'locked'
    ? false
    : lockMode === 'unlocked'
      ? unitUnlocked
      : unitUnlocked && (unitCompleted || prevNodeDone);
  const icon = node.icon || 'dumbbell';
  const levelConfigs = buildNodeLevelConfigsForStudent(node);

  if (isStudyNode(node)) {
    const lessons = studyLessonVideos(node);
    const levels = lessons.map((video, index) => {
      const videoId = stepVideoId(nodeKey, 'learn', video.id);
      const lessonDone = unitCompleted || isLessonWatched(watched, nodeKey, video);
      const prevLessonDone = index === 0
        || unitCompleted
        || isLessonWatched(watched, nodeKey, lessons[index - 1]);
      const lessonUnlocked = nodeUnlocked && (unitCompleted || index === 0 || prevLessonDone);
      return {
        key: `lesson-${index + 1}`,
        label: `Bài ${index + 1}`,
        kind: 'lesson',
        title: video.title,
        content: video.content || '',
        fileUrl: video.fileUrl || '',
        fileName: video.fileName || '',
        passPercent: 0,
        state: lessonDone ? 'completed' : lessonUnlocked ? 'active' : 'locked',
        videos: [{
          id: videoId,
          title: video.title,
          url: video.url || '',
          content: video.content || '',
          fileUrl: video.fileUrl || '',
          fileName: video.fileName || '',
          checks: video.checks || [],
          nodeKey,
          nodeLabel: node.label,
          step: 'learn',
          stepLabel: `Bài ${index + 1}`,
          state: lessonDone ? 'completed' : lessonUnlocked ? 'active' : 'locked',
        }],
      };
    });
    const hasConfiguredLevels = hasConfiguredLevelContent(node);
    const nodeComplete = hasConfiguredLevels
      ? DIFFICULTY_KEYS.every((diff) => isLevelConfigComplete(node, diff, completedSections))
      : (!lessons.length || levels.every((level) => level.state === 'completed'));
    return {
      key: nodeKey,
      label: node.label,
      icon,
      kind: 'study',
      sortOrder: node.sortOrder ?? nodeIndex,
      lockMode,
      state: unitCompleted || (nodeUnlocked && nodeComplete) ? 'completed' : nodeUnlocked ? 'active' : 'locked',
      levels,
      levelConfigs,
    };
  }

  const levels = PATH_STEPS.map((step, levelIndex) => {
    const levelDone = isLevelDone(done, nodeKey, step.key, nodeIndex, unitCompleted);
    const prevLevelDone = levelIndex === 0 || isLevelDone(done, nodeKey, PATH_STEPS[levelIndex - 1].key, nodeIndex, unitCompleted);
    const levelUnlocked = nodeUnlocked && (unitCompleted || levelIndex === 0 || prevLevelDone);
    const stepVideos = node.stepVideos?.[step.key] || [];
    return {
      key: step.key,
      label: step.label,
      kind: 'quiz',
      difficulty: step.difficulty,
      passPercent: passPercent(step.key),
      state: levelDone ? 'completed' : levelUnlocked ? 'active' : 'locked',
      videos: stepVideos.map((video) => ({
        id: stepVideoId(nodeKey, step.key, video.id),
        title: video.title,
        url: video.url,
        checks: video.checks || [],
        nodeKey,
        nodeLabel: node.label,
        step: step.key,
        stepLabel: step.label,
        state: watched.has(stepVideoId(nodeKey, step.key, video.id)) ? 'completed' : levelUnlocked ? 'active' : 'locked',
      })),
    };
  });
  const nodeComplete = levels.every((level) => level.state === 'completed');
  return {
    key: nodeKey,
    label: node.label,
    icon,
    kind: 'quiz',
    sortOrder: node.sortOrder ?? nodeIndex,
    lockMode,
    state: unitCompleted || nodeComplete ? 'completed' : nodeUnlocked ? 'active' : 'locked',
    levels,
    levelConfigs,
  };
}

/** Trạng thái các chặng (đã sắp xếp) theo tiến độ: chặng sau mở khi chặng trước xong. */
function computeUnits(units, progressByUnit) {
  let previousCompleted = true;
  return units.map((unit, index) => {
    const progress = progressByUnit.get(String(unit.id)) || null;
    const done = new Set(progress?.completedSteps || []);
    const completed = unitIsCompleted(progress, done, unit);
    const unlocked = completed || index === 0 || previousCompleted;
    const watched = new Set(progress?.watchedVideoIds || []);
    const completedSections = new Set(progress?.completedSections || []);
    const rawNodes = normalizePathNodes(unit);
    const pathNodes = rawNodes.map((node, nodeIndex) => buildNodeLevels(
      { ...node, stepVideos: mapStepVideos({ stepVideos: node.stepVideos || emptyStepVideos() }) },
      nodeIndex,
      rawNodes,
      done,
      unlocked,
      completed,
      watched,
      completedSections,
    ));
    const steps = pathNodes.flatMap((node) => node.levels.map((level) => ({
      ...level,
      nodeKey: node.key,
      nodeLabel: node.label,
    })));
    previousCompleted = completed;
    return {
      ...unit,
      index: index + 1,
      state: completed ? 'completed' : unlocked ? 'active' : 'locked',
      testedOut: Boolean(progress?.testedOut),
      canTestOut: !completed,
      chestClaimed: Boolean(progress?.chestClaimedAt),
      chestRewardXp: rules.UNIT_CHEST_REWARD_XP,
      completedSections: progress?.completedSections || [],
      pathNodes,
      steps,
      stepVideos: mapStepVideos({ stepVideos: unit.stepVideos || emptyStepVideos() }),
      videos: (unit.videos || []).map((video) => ({
        id: String(video.id || video._id),
        title: video.title,
        url: video.url,
        checks: mapChecks(video.checks),
        state: watched.has(String(video.id || video._id)) ? 'completed' : unlocked ? 'active' : 'locked',
      })),
    };
  });
}

function nextStepOf(units) {
  for (const unit of units) {
    if (unit.state !== 'active') continue;
    for (const node of unit.pathNodes || []) {
      if (node.state === 'locked' || node.state === 'completed') continue;
      const level = (node.levels || []).find((item) => item.state === 'active');
      if (level) {
        return {
          unitId: unit.id,
          unitTitle: unit.title,
          nodeKey: node.key,
          nodeLabel: node.label,
          step: level.key,
          stepLabel: level.label,
          kind: level.kind || node.kind || 'quiz',
        };
      }
    }
  }
  return null;
}

async function loadTopicsPath(studentId, topics) {
  const topicIds = topics.map((topic) => topic._id);
  const units = await DailyPracticeUnit.find({ topicId: { $in: topicIds }, active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const counts = await unitCounts(units.map((unit) => unit._id));
  const playable = units.filter((unit) => (counts.get(String(unit._id))?.total || 0) >= MIN_UNIT_QUESTIONS);
  const [progressRows, lessonUnits] = await Promise.all([
    DailyPracticePathProgress.find({ studentId, unitId: { $in: playable.map((unit) => unit._id) } }).lean(),
    LessonUnit.find({ _id: { $in: playable.map((unit) => unit.lessonUnitId).filter(Boolean) } }).select('title subjectId').lean(),
  ]);
  const progressByUnit = new Map(progressRows.map((row) => [String(row.unitId), row]));
  const lessonById = new Map(lessonUnits.map((unit) => [String(unit._id), unit]));
  return topics.map((topic) => {
    const own = playable
      .filter((unit) => String(unit.topicId) === String(topic._id))
      .map((unit) => {
        const lesson = unit.lessonUnitId ? lessonById.get(String(unit.lessonUnitId)) : null;
        const { lessonUnitId: _lessonUnitId, auto: _auto, ...view } = unitView(unit, counts.get(String(unit._id)));
        return {
          ...view,
          lesson: lesson ? { unitId: String(lesson._id), subjectId: String(lesson.subjectId), title: lesson.title || '' } : null,
        };
      });
    const computed = computeUnits(own, progressByUnit);
    return {
      topic: {
        id: String(topic._id),
        name: topic.name,
        description: topic.description || '',
        icon: topic.icon || 'book',
        color: topic.color || 'red',
      },
      units: computed,
      completedUnits: computed.filter((unit) => unit.state === 'completed').length,
      totalUnits: computed.length,
      next: nextStepOf(computed),
    };
  });
}

async function readActivePathTopicId(studentId) {
  const profile = await DailyPracticeProfile.findOne({ studentId }).select('lastPathTopicId').lean();
  return String(profile?.lastPathTopicId || '').trim();
}

/** Lưu chủ đề lộ trình đang học (đồng bộ web + mobile). */
async function setActivePathTopic(studentId, topicId) {
  const sid = requireId(studentId, 'Học viên');
  const id = requireId(topicId, 'Chủ đề');
  const topic = await DailyPracticeTopic.findOne({ _id: id, active: true }).select('_id').lean();
  if (!topic) throw httpError(404, 'Chủ đề không còn hoạt động');
  await DailyPracticeProfile.findOneAndUpdate(
    { studentId: sid },
    { $set: { lastPathTopicId: String(topic._id) } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { topicId: String(topic._id) };
}

/** Lộ trình của mọi chủ đề đang mở (chỉ chủ đề có chặng đủ câu hỏi). */
async function getPath(studentId) {
  const sid = requireId(studentId, 'Học viên');
  const student = await Student.findById(sid).select('subscription freePortal enrollments').lean();
  const topics = await DailyPracticeTopic.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  for (const topic of topics) {
    try {
      await ensureDefaultUnit(topic._id);
    } catch (err) {
      logger.warn(`[DAILY_PRACTICE] ensure default unit failed: ${err.message}`);
    }
  }
  const paths = await loadTopicsPath(sid, topics);
  const topicsOut = paths.filter((path) => path.units.length > 0);
  const allowed = new Set(topicsOut.map((path) => String(path.topic.id)));
  const saved = await readActivePathTopicId(sid);
  const activeTopicId = allowed.has(saved) ? saved : '';
  return {
    canTestOut: hasTestOutAccess(student),
    steps: PATH_STEPS.map((step) => ({ ...step, passPercent: passPercent(step.key) })),
    topics: topicsOut,
    activeTopicId,
  };
}

async function topicPathForUnit(studentId, unit) {
  const topic = await DailyPracticeTopic.findOne({ _id: unit.topicId, active: true }).lean();
  if (!topic) throw httpError(404, 'Chủ đề không còn hoạt động');
  const [path] = await loadTopicsPath(studentId, [topic]);
  return { topic, path };
}

async function pickUnitQuestions(unitId, step, { testOut = false } = {}) {
  const base = { unitId, status: 'published' };
  let picked = [];
  if (testOut || step === LEGACY_CHECKPOINT) {
    picked = await DailyPracticeQuestion.aggregate([{ $match: base }, { $sample: { size: rules.SESSION_SIZE } }]);
    return rules.shuffle(picked);
  }
  const meta = stepMeta(step);
  if (!meta?.difficulty) {
    picked = await DailyPracticeQuestion.aggregate([{ $match: base }, { $sample: { size: rules.SESSION_SIZE } }]);
    return rules.shuffle(picked);
  }
  picked = await DailyPracticeQuestion.aggregate([
    { $match: { ...base, difficulty: meta.difficulty } },
    { $sample: { size: rules.SESSION_SIZE } },
  ]);
  if (picked.length < rules.SESSION_SIZE) {
    const more = await DailyPracticeQuestion.aggregate([
      { $match: { ...base, difficulty: { $ne: meta.difficulty } } },
      { $sample: { size: rules.SESSION_SIZE - picked.length } },
    ]);
    picked.push(...more);
  }
  return picked;
}

/** Kiểm tra quyền vào bước của chặng + chọn câu. testOut: làm kiểm tra chặng để vượt chặng chưa mở. */
async function preparePathSession(studentId, { unitId, step, nodeKey, testOut = false } = {}) {
  const sid = requireId(studentId, 'Học viên');
  if (!STEP_KEYS.includes(step)) throw httpError(400, 'Bước lộ trình không hợp lệ');
  const unit = await DailyPracticeUnit.findOne({ _id: requireId(unitId, 'Chặng'), active: true }).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const { topic, path } = await topicPathForUnit(sid, unit);
  const view = path.units.find((item) => item.id === String(unit._id));
  if (!view) throw httpError(404, 'Chặng này chưa đủ câu hỏi');
  let nk = String(nodeKey || '').trim();
  if (!nk && !testOut) {
    const activeQuiz = (view.pathNodes || []).find((node) => node.kind !== 'study' && node.state === 'active');
    nk = activeQuiz?.key || (view.pathNodes || []).find((node) => node.kind !== 'study')?.key || '';
  }
  if (!nk) nk = view.pathNodes?.[0]?.key || 'study';
  const pathNode = (view.pathNodes || []).find((item) => item.key === nk);
  if (!pathNode && !testOut) throw httpError(400, 'Nút lộ trình không hợp lệ');
  const levelState = pathNode?.levels?.find((item) => item.key === step)?.state || '';
  let studyStepCompleted = false;
  let studyQuestionIds = [];
  if (testOut) {
    // Kiểm tra vượt chặng là đặc quyền chỉ dành cho học viên mua khóa / gói Meet
    const student = await Student.findById(sid).select('subscription freePortal enrollments').lean();
    if (!hasTestOutAccess(student)) {
      throw httpError(403, 'Tính năng Kiểm tra vượt chặng chỉ dành riêng cho học viên đã mua gói học. Vui lòng nâng cấp gói để sử dụng.');
    }
    if (step !== 'challenge' && step !== LEGACY_CHECKPOINT) throw httpError(400, 'Kiểm tra vượt chặng chỉ dùng cấp Khó');
    if (!view.canTestOut) throw httpError(409, 'Chặng này đã hoàn thành');
  } else if (pathNode?.kind === 'study') {
    if (pathNode.state === 'locked') {
      throw httpError(403, 'Bài học này chưa mở');
    }
    const diff = STEP_DIFFICULTY_MAP[step];
    if (!diff) throw httpError(400, 'Mức độ luyện tập không hợp lệ');
    const prog = await DailyPracticePathProgress.findOne({ studentId: sid, unitId: unit._id })
      .select('completedSections')
      .lean();
    const completedSet = new Set(prog?.completedSections || []);
    const easyDone = isLevelConfigComplete(pathNode, 'easy', completedSet);
    const mediumDone = isLevelConfigComplete(pathNode, 'medium', completedSet);
    const diffUnlocked = view.testedOut || diff === 'easy'
      || (diff === 'medium' && easyDone)
      || (diff === 'hard' && easyDone && mediumDone);
    if (!diffUnlocked) {
      throw httpError(403, 'Hãy hoàn thành mức độ trước để mở khóa mức này');
    }
    const cfg = pathNode.levelConfigs?.[diff];
    if (!view.testedOut && cfg && cfg.sequentialSections !== false) {
      const hidden = new Set(cfg.hiddenSections || []);
      const order = (cfg.sectionOrder?.length ? cfg.sectionOrder : DEFAULT_SECTION_ORDER)
        .filter((k) => !hidden.has(k));
      const idx = order.indexOf('practice');
      if (idx > 0 && order.slice(0, idx).some((secKey) => !completedSet.has(`${nk}:${diff}:${secKey}`))) {
        throw httpError(403, 'Hãy hoàn thành phần trước để mở khóa phần luyện tập');
      }
    }
    studyStepCompleted = completedSet.has(`${nk}:${diff}:practice`);
    studyQuestionIds = Array.isArray(cfg?.practice?.questionIds) ? cfg.practice.questionIds.filter(Boolean) : [];
  } else if (levelState === 'locked') {
    throw httpError(403, 'Hoàn thành bước trước để mở khóa bước này');
  }
  let questions = [];
  if (studyQuestionIds.length) {
    const validIds = studyQuestionIds
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));
    if (validIds.length) {
      const picked = await DailyPracticeQuestion.find({ _id: { $in: validIds }, status: 'published' }).lean();
      questions = rules.shuffle(picked);
    }
  }
  if (!questions.length) {
    questions = await pickUnitQuestions(unit._id, step, { testOut });
  }
  if (!questions.length) throw httpError(404, 'Chặng này chưa có câu hỏi');
  return {
    topic,
    unit,
    questions,
    difficulty: stepMeta(step).difficulty || 'medium',
    pathInfo: {
      unitId: String(unit._id),
      unitTitle: unit.title,
      unitIndex: view.index,
      pathNodeKey: nk,
      pathNodeLabel: pathNode?.label || nk,
      step,
      stepLabel: stepMeta(step).label,
      testOut: Boolean(testOut),
      passPercent: passPercent(step, { testOut }),
      stepCompleted: !testOut && (pathNode?.kind === 'study' ? studyStepCompleted : levelState === 'completed'),
      failPenaltyXp: testOut ? rules.TEST_OUT_XP : 0,
    },
  };
}

async function markSteps(studentId, topicId, unitId, steps, { complete = false, testedOut = false } = {}) {
  const filter = { studentId, unitId };
  const update = { $addToSet: { completedSteps: { $each: steps } }, $setOnInsert: { topicId } };
  try {
    await DailyPracticePathProgress.updateOne(filter, update, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    await DailyPracticePathProgress.updateOne(filter, update);
  }
  if (complete) {
    await DailyPracticePathProgress.updateOne(
      { ...filter, completedAt: null },
      { $set: { completedAt: new Date(), ...(testedOut ? { testedOut: true } : {}) } },
    );
  }
}

/**
 * Danh sách phát của chặng cho popup video: video riêng của chặng + video của buổi bài giảng đã gắn
 * (chỉ khi HV được mở buổi đó - cùng luật mua khóa / mở tuần tự như trang bài giảng).
 */
async function unitVideos(studentId, unitId) {
  const sid = requireId(studentId, 'Học viên');
  const unit = await DailyPracticeUnit.findOne({ _id: requireId(unitId, 'Chặng'), active: true }).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const { path } = await topicPathForUnit(sid, unit);
  const view = path.units.find((item) => item.id === String(unit._id));
  if (!view) throw httpError(404, 'Chặng này chưa đủ câu hỏi');
  let lesson = null;
  if (unit.lessonUnitId) {
    const base = await LessonUnit.findById(unit.lessonUnitId).select('title subjectId').lean();
    if (base) {
      lesson = { unitId: String(base._id), subjectId: String(base.subjectId), title: base.title || '', locked: false, message: '', videos: [] };
      try {
        const { unit: lessonUnit } = await lessonPracticeService.loadStudentUnit(sid, unit.lessonUnitId);
        lesson.videos = (lessonUnit.videos || [])
          .filter((video) => video.url)
          .map((video, index) => ({ id: `lesson-${video.id || index}`, title: video.title || `${lessonUnit.title} · Video ${index + 1}`, url: video.url }));
      } catch (err) {
        lesson.locked = true;
        lesson.message = err?.status === 403 ? err.message : 'Buổi bài giảng này chưa mở';
      }
    }
  }
  const stepLabels = { learn: 'Dễ', practice: 'Vừa', challenge: 'Khó' };
  const diffLabels = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
  const progress = await DailyPracticePathProgress.findOne({ studentId: sid, unitId: unit._id })
    .select('passedVideoChecks watchedVideoIds completedSections')
    .lean();
  const watchedSet = new Set(progress?.watchedVideoIds || []);
  const completedSet = new Set(progress?.completedSections || []);
  const isDiffUnlockedInNode = (node, diff) => {
    if (view.testedOut || diff === 'easy') return true;
    const easyDone = isLevelConfigComplete(node, 'easy', completedSet);
    if (diff === 'medium') return easyDone;
    if (diff === 'hard') return easyDone && isLevelConfigComplete(node, 'medium', completedSet);
    return false;
  };
  const isVideoSectionUnlockedInNode = (node, diff) => {
    const cfg = node.levelConfigs?.[diff];
    if (!cfg?.video?.url) return false;
    const hidden = new Set(cfg.hiddenSections || []);
    if (hidden.has('video')) return false;
    if (view.testedOut || cfg.sequentialSections === false) return true;
    const order = (cfg.sectionOrder?.length ? cfg.sectionOrder : DEFAULT_SECTION_ORDER)
      .filter((k) => !hidden.has(k));
    const idx = order.indexOf('video');
    if (idx <= 0) return idx === 0;
    return order.slice(0, idx).every((secKey) => completedSet.has(`${node.key}:${diff}:${secKey}`));
  };
  const stepLevelVideos = (view.pathNodes || []).flatMap((node) => {
    const nodeUnlocked = view.state !== 'locked' && node.state !== 'locked';
    const rawLevelEntries = DIFFICULTY_KEYS.map((diff) => {
      const cfg = node.levelConfigs?.[diff];
      const vid = cfg?.video;
      if (!vid || !vid.url) return null;
      const hidden = new Set(cfg.hiddenSections || []);
      if (hidden.has('video')) return null;
      const vidId = `${node.key}:level:${diff}`;
      const unlocked = nodeUnlocked && isDiffUnlockedInNode(node, diff) && isVideoSectionUnlockedInNode(node, diff);
      return {
        rawUrl: String(vid.url || '').trim(),
        item: {
          id: vidId,
          title: vid.title || `${node.label} (${diffLabels[diff]})`,
          url: unlocked ? vid.url : '',
          antiSeek: vid.antiSeek !== false,
          checks: unlocked ? (vid.checks || []) : [],
          nodeKey: node.key,
          nodeLabel: node.label,
          step: DIFFICULTY_STEP_MAP[diff],
          stepLabel: diffLabels[diff],
          state: !unlocked ? 'locked' : watchedSet.has(vidId) ? 'completed' : 'active',
          source: 'step',
        },
      };
    }).filter(Boolean);
    const fromLevels = rawLevelEntries.map((e) => e.item);
    const hasLevelConfigVideo = DIFFICULTY_KEYS.some((d) => Boolean(node.levelConfigs?.[d]?.video?.url));
    const fromSteps = (node.levels || []).flatMap((level) => {
      const mappedDiff = STEP_DIFFICULTY_MAP[level.key];
      // Tránh lặp lại video từ stepVideos khi bài đã dùng levelConfigs (pathNodesInput đồng bộ easy -> learn[0])
      if (hasLevelConfigVideo && (node.kind === 'study' || Boolean(node.levelConfigs?.[mappedDiff]?.video?.url))) {
        return [];
      }
      const stepUnlocked = nodeUnlocked && level.state !== 'locked';
      return (level.videos || []).map((video) => ({
        ...video,
        url: stepUnlocked ? video.url : '',
        checks: stepUnlocked ? (video.checks || []) : [],
        state: !stepUnlocked ? 'locked' : video.state,
        step: level.key,
        stepLabel: stepLabels[level.key],
        nodeKey: node.key,
        nodeLabel: node.label,
        source: 'step',
      }));
    });
    const seenUrls = new Set(rawLevelEntries.map((e) => e.rawUrl).filter(Boolean));
    return [...fromLevels, ...fromSteps.filter((v) => !seenUrls.has(String(v.url || '').trim()))];
  });
  return {
    unitId: String(unit._id),
    unitTitle: unit.title,
    unitIndex: view.index,
    state: view.state,
    passedCheckIds: progress?.passedVideoChecks || [],
    videos: [
      ...(view.videos || []).map((video) => ({ ...video, source: 'unit' })),
      ...stepLevelVideos,
    ],
    lesson,
  };
}

function parseLevelVideoId(videoId) {
  const m = String(videoId || '').match(/^([^:]+):level:(easy|medium|hard)$/);
  return m ? { nodeKey: m[1], difficulty: m[2] } : null;
}

function locateVideo(unit, videoId) {
  const levelParsed = parseLevelVideoId(videoId);
  if (levelParsed) {
    const node = normalizePathNodes(unit).find((item) => item.key === levelParsed.nodeKey);
    if (!node) return null;
    const cfg = mapNodeLevelConfigs(node, { admin: true })[levelParsed.difficulty];
    const video = cfg?.video;
    if (!video || !video.url) return null;
    return {
      video: { ...video, title: video.title || node.label },
      storageId: `${levelParsed.nodeKey}:level:${levelParsed.difficulty}`,
      levelRef: levelParsed,
    };
  }
  const parsed = parseStepVideoId(videoId);
  if (parsed) {
    const node = normalizePathNodes(unit).find((item) => item.key === parsed.nodeKey);
    const video = (node?.stepVideos?.[parsed.stepKey] || []).find((item) => String(item._id) === parsed.mongoId);
    return video ? { video, storageId: stepVideoId(parsed.nodeKey, parsed.stepKey, parsed.mongoId) } : null;
  }
  const video = (unit.videos || []).find((item) => String(item._id) === String(videoId));
  return video ? { video, storageId: String(video._id) } : null;
}

function normAnswer(value) {
  return String(value || '').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
}

const VI_NUMBER_WORDS = [
  ['không', 0], ['khong', 0],
  ['một', 1], ['mot', 1],
  ['hai', 2],
  ['ba', 3],
  ['bốn', 4], ['bon', 4], ['tư', 4], ['tu', 4],
  ['năm', 5], ['nam', 5],
  ['sáu', 6], ['sau', 6],
  ['bảy', 7], ['bay', 7],
  ['tám', 8], ['tam', 8],
  ['chín', 9], ['chin', 9],
  ['mười', 10], ['muoi', 10],
];

function answerTokens(value) {
  return normAnswer(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function loneNumber(value) {
  const tokens = answerTokens(value);
  if (tokens.length !== 1) return null;
  if (/^\d+$/.test(tokens[0])) return String(Number(tokens[0]));
  const word = VI_NUMBER_WORDS.find(([label]) => label === tokens[0]);
  return word ? String(word[1]) : null;
}

function numbersIn(value) {
  const found = [];
  for (const token of answerTokens(value)) {
    if (/^\d+$/.test(token)) found.push(String(Number(token)));
    else {
      const word = VI_NUMBER_WORDS.find(([label]) => label === token);
      if (word) found.push(String(word[1]));
    }
  }
  return found;
}

/** true/false khi so được ngay. null thì đưa AI chấm ý. */
function textAnswersEquivalent(expected, given) {
  const left = normAnswer(expected);
  const right = normAnswer(given);
  if (!right) return false;
  if (left === right) return true;
  const expectedNum = loneNumber(expected);
  if (expectedNum == null) return null;
  const found = numbersIn(given);
  if (found.length === 1 && found[0] === expectedNum) return true;
  if (found.length && !found.includes(expectedNum)) return false;
  return null;
}

async function gradeText(check, text) {
  const given = String(text || '').trim().slice(0, 400);
  const fast = textAnswersEquivalent(check.answer, given);
  if (fast === true) return 'CORRECT';
  if (fast === false) return 'INCORRECT';
  const { gradeInstructorAnswer } = require('./ai/instructorGrade');
  const verdict = await gradeInstructorAnswer({
    prompt: check.prompt,
    officialAnswer: check.answer,
    rubric: '',
    studentAnswer: given,
  });
  return verdict.status;
}

async function gradeScreen(check, imageDataUrl) {
  const match = String(imageDataUrl || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw httpError(400, 'Ảnh chụp màn hình không hợp lệ');
  if (match[2].length > 900_000) throw httpError(400, 'Ảnh quá nặng. Hãy chụp vùng bài làm, không chụp cả màn hình lớn.');
  const { chatCompletion, isAiConfigured } = require('./ai/llmClient');
  if (!isAiConfigured()) throw httpError(503, 'Chưa chấm được lúc này. Hãy gửi lại ảnh sau.');
  const result = await chatCompletion({
    temperature: 0.1,
    maxTokens: 300,
    responseFormat: 'json',
    images: [{ mimeType: match[1], data: match[2] }],
    messages: [
      {
        role: 'system',
        content: 'Bạn chấm bài thực hành tin học qua ảnh chụp màn hình. Chỉ trả JSON {"correct":true|false}. correct=true khi ảnh thể hiện học viên đã làm đúng tiêu chí. Không viết lời giải.',
      },
      {
        role: 'user',
        content: `Đề: ${check.prompt}\nTiêu chí đúng (không tiết lộ cho học viên): ${check.criteria}`,
      },
    ],
  });
  let correct = false;
  try {
    correct = JSON.parse(String(result.content || '').replace(/```json|```/g, '').trim()).correct === true;
  } catch {
    correct = /"correct"\s*:\s*true/.test(String(result.content || ''));
  }
  return correct;
}

async function answerVideoCheck(studentId, { unitId, videoId, checkId, checkIndex, choiceIndex, text, imageDataUrl } = {}) {
  const sid = requireId(studentId, 'Học viên');
  const unit = await DailyPracticeUnit.findOne({ _id: requireId(unitId, 'Chặng'), active: true }).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const located = locateVideo(unit, videoId);
  if (!located) throw httpError(404, 'Không tìm thấy video');
  const check = (located.video.checks || []).find((item, idx) => (
    checkId ? String(item._id) === String(checkId) : idx === Number(checkIndex)
  ));
  if (!check) throw httpError(404, 'Không tìm thấy câu hỏi trong video');
  if (check.kind === 'text' && !normAnswer(text)) throw httpError(400, 'Hãy nhập đáp án');
  if (check.kind === 'choice' && !Number.isInteger(Number(choiceIndex))) throw httpError(400, 'Hãy chọn đáp án');
  if (check.kind === 'screen' && !imageDataUrl) throw httpError(400, 'Hãy gửi ảnh bài làm');
  const cost = rules.VIDEO_CHECK_ANSWER_XP;
  const { adjustProfileXp, getProfile } = require('./dailyPracticeService');
  let status = 'INCORRECT';
  if (check.kind === 'choice') status = Number(choiceIndex) === Number(check.answer) ? 'CORRECT' : 'INCORRECT';
  else if (check.kind === 'text') status = await gradeText(check, text);
  else status = (await gradeScreen(check, imageDataUrl)) ? 'CORRECT' : 'INCORRECT';
  const key = `${located.storageId}:${check._id}`;
  if (status === 'CORRECT') {
    const firstPass = await rememberPassedCheck(sid, unit, key);
    // Đúng lần đầu ở mốc này: +XP (mốc đã qua thì không cộng lại).
    const reward = firstPass ? cost : 0;
    const profile = reward > 0
      ? await adjustProfileXp(sid, reward, { source: 'reward' })
      : await getProfile(sid);
    return {
      correct: true,
      needsReview: false,
      hint: '',
      cost: 0,
      gainedXp: reward,
      profileXp: rules.clampXp(profile?.xpTotal),
      purchasedXp: rules.clampXp(profile?.purchasedXp),
      dailyXp: rules.clampXp(profile?.dailyXp),
    };
  }
  if (status === 'NEEDS_REVIEW') {
    const profile = await getProfile(sid);
    return {
      correct: false,
      needsReview: true,
      cost: 0,
      profileXp: rules.clampXp(profile?.xpTotal),
      purchasedXp: rules.clampXp(profile?.purchasedXp),
      dailyXp: rules.clampXp(profile?.dailyXp),
      hint: 'Chưa đủ ý để kết luận. Hãy viết rõ hơn, lần này không mất XP.',
    };
  }
  const profile = await getProfile(sid);
  if (cost > 0 && (profile?.xpTotal || 0) < cost) {
    const err = httpError(402, `Sai mất ${cost} XP. Bạn chưa đủ XP.`);
    err.currentXp = rules.clampXp(profile?.xpTotal);
    err.needXp = cost;
    throw err;
  }
  const next = cost > 0 ? await adjustProfileXp(sid, -cost, { source: 'spend' }) : profile;
  return {
    correct: false,
    needsReview: false,
    cost,
    profileXp: rules.clampXp(next?.xpTotal),
    purchasedXp: rules.clampXp(next?.purchasedXp),
    dailyXp: rules.clampXp(next?.dailyXp),
    hint: check.shortHint || 'Bài này chưa được. Xem lại thao tác vừa làm.',
  };
}

async function buyVideoHint(studentId, { unitId, videoId, checkId, checkIndex } = {}) {
  const sid = requireId(studentId, 'Học viên');
  const unit = await DailyPracticeUnit.findOne({ _id: requireId(unitId, 'Chặng'), active: true }).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const located = locateVideo(unit, videoId);
  const check = located && (located.video.checks || []).find((item, idx) => (
    checkId ? String(item._id) === String(checkId) : idx === Number(checkIndex)
  ));
  if (!check) throw httpError(404, 'Không tìm thấy câu hỏi trong video');
  if (!check.paidHint) throw httpError(400, 'Mốc này không có gợi ý thêm');
  const cost = Math.max(0, Number(check.hintCostXp) || 0);
  const { adjustProfileXp, getProfile } = require('./dailyPracticeService');
  if (cost > 0) {
    const profile = await getProfile(sid);
    if ((profile?.xpTotal || 0) < cost) {
      const err = httpError(402, `Cần ${cost} XP để xem gợi ý. Bạn chưa đủ XP.`);
      err.currentXp = rules.clampXp(profile?.xpTotal);
      err.needXp = cost;
      throw err;
    }
    const next = await adjustProfileXp(sid, -cost, { source: 'spend' });
    await rememberPassedCheck(sid, unit, `${located.storageId}:${check._id}`);
    return {
      hint: check.paidHint,
      cost,
      profileXp: rules.clampXp(next?.xpTotal),
      purchasedXp: rules.clampXp(next?.purchasedXp),
      dailyXp: rules.clampXp(next?.dailyXp),
      passed: true,
    };
  }
  const profile = await getProfile(sid);
  await rememberPassedCheck(sid, unit, `${located.storageId}:${check._id}`);
  return {
    hint: check.paidHint,
    cost: 0,
    profileXp: rules.clampXp(profile?.xpTotal),
    purchasedXp: rules.clampXp(profile?.purchasedXp),
    dailyXp: rules.clampXp(profile?.dailyXp),
    passed: true,
  };
}

async function rememberPassedCheck(studentId, unit, key) {
  const filter = { studentId, unitId: unit._id };
  const update = { $addToSet: { passedVideoChecks: key }, $setOnInsert: { topicId: unit.topicId } };
  try {
    const res = await DailyPracticePathProgress.updateOne(filter, update, { upsert: true });
    return Boolean(res.modifiedCount || res.upsertedCount);
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const res = await DailyPracticePathProgress.updateOne(filter, { $addToSet: { passedVideoChecks: key } });
    return Boolean(res.modifiedCount);
  }
}

/** HV xem đủ video của chặng (≥ 2/3 thời lượng) → đánh dấu đã xem. Chặng còn khóa thì không ghi. */
/** Nhận thưởng rương chặng (+UNIT_CHEST_REWARD_XP) một lần khi chặng đã hoàn thành. */
async function claimUnitChest(studentId, unitId) {
  const sid = requireId(studentId, 'Học viên');
  const uid = requireId(unitId, 'Chặng');
  const unit = await DailyPracticeUnit.findOne({ _id: uid, active: true }).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const { path } = await topicPathForUnit(sid, unit);
  const view = path.units.find((item) => item.id === String(unit._id));
  if (!view) throw httpError(404, 'Chặng này chưa đủ câu hỏi');
  if (view.state !== 'completed') {
    throw httpError(403, 'Hoàn thành toàn bộ chặng trước khi mở rương phần thưởng');
  }
  const existing = await DailyPracticePathProgress.findOne({ studentId: sid, unitId: uid }).lean();
  if (existing?.chestClaimedAt) {
    const dailyPracticeService = require('./dailyPracticeService');
    const profile = await dailyPracticeService.getProfile(sid);
    return {
      xp: 0,
      already: true,
      chestClaimed: true,
      profileXp: rules.clampXp(profile?.xpTotal),
    };
  }
  const claimed = await DailyPracticePathProgress.findOneAndUpdate(
    {
      studentId: sid,
      unitId: uid,
      $or: [{ chestClaimedAt: null }, { chestClaimedAt: { $exists: false } }],
    },
    {
      $set: { chestClaimedAt: new Date(), topicId: unit.topicId },
      $setOnInsert: { completedSteps: [] },
    },
    { new: true, upsert: true },
  ).lean();
  if (!claimed?.chestClaimedAt) {
    const row = await DailyPracticePathProgress.findOne({ studentId: sid, unitId: uid }).lean();
    const dailyPracticeService = require('./dailyPracticeService');
    const profile = await dailyPracticeService.getProfile(sid);
    if (row?.chestClaimedAt) {
      return {
        xp: 0,
        already: true,
        chestClaimed: true,
        profileXp: rules.clampXp(profile?.xpTotal),
      };
    }
    throw httpError(409, 'Không mở được rương lúc này. Hãy thử lại.');
  }
  const dailyPracticeService = require('./dailyPracticeService');
  const reward = rules.UNIT_CHEST_REWARD_XP;
  const profile = await dailyPracticeService.adjustProfileXp(sid, reward, { source: 'reward' });
  return {
    xp: reward,
    chestClaimed: true,
    profileXp: rules.clampXp(profile?.xpTotal),
  };
}

async function markVideoWatched(studentId, { unitId, videoId } = {}) {
  const sid = requireId(studentId, 'Học viên');
  const unit = await DailyPracticeUnit.findOne({ _id: requireId(unitId, 'Chặng'), active: true }).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const rawId = String(videoId || '');
  const levelParsed = parseLevelVideoId(rawId);
  const parsed = parseStepVideoId(rawId);
  let storageId = rawId;
  const extraWatchedIds = [];
  const extraSectionKeys = [];

  if (levelParsed) {
    const locatedLevel = locateVideo(unit, rawId);
    if (!locatedLevel) throw httpError(404, 'Không tìm thấy video');
    storageId = locatedLevel.storageId;
    extraSectionKeys.push(`${levelParsed.nodeKey}:${levelParsed.difficulty}:video`);
    // Đồng bộ legacy watchedVideoIds nếu là mức easy của node học bài
    if (levelParsed.difficulty === 'easy') {
      const node = normalizePathNodes(unit).find((item) => item.key === levelParsed.nodeKey);
      const legacyVid = node?.stepVideos?.learn?.[0];
      if (legacyVid?._id) extraWatchedIds.push(stepVideoId(levelParsed.nodeKey, 'learn', String(legacyVid._id)));
    }
  } else if (parsed) {
    const nodes = normalizePathNodes(unit);
    const node = nodes.find((item) => item.key === parsed.nodeKey);
    const list = node?.stepVideos?.[parsed.stepKey] || [];
    if (!list.some((video) => String(video._id) === parsed.mongoId)) throw httpError(404, 'Không tìm thấy video');
    storageId = stepVideoId(parsed.nodeKey, parsed.stepKey, parsed.mongoId);
    const diff = STEP_DIFFICULTY_MAP[parsed.stepKey];
    if (diff) extraSectionKeys.push(`${parsed.nodeKey}:${diff}:video`);
  } else if (!(unit.videos || []).some((video) => String(video._id) === rawId)) {
    throw httpError(404, 'Không tìm thấy video');
  }
  const located = locateVideo(unit, rawId);
  const pending = (located?.video?.checks || []).filter((check) => Boolean(check?._id || check?.id));
  if (pending.length) {
    const progress = await DailyPracticePathProgress.findOne({ studentId: sid, unitId: unit._id }).select('passedVideoChecks').lean();
    const passed = new Set(progress?.passedVideoChecks || []);
    const missing = pending.some((check) => !passed.has(`${storageId}:${check._id || check.id}`));
    if (missing) throw httpError(403, 'Hãy trả lời hết câu hỏi trong video rồi mới tính là đã xem');
  }
  const { path } = await topicPathForUnit(sid, unit);
  const view = path.units.find((item) => item.id === String(unit._id));
  if (!view || view.state === 'locked') throw httpError(403, 'Chặng này chưa mở');
  if (levelParsed || parsed) {
    const targetKey = levelParsed ? levelParsed.nodeKey : parsed.nodeKey;
    const targetNode = (view.pathNodes || []).find((n) => n.key === targetKey);
    if (!targetNode || targetNode.state === 'locked') {
      throw httpError(403, 'Bài học này chưa mở');
    }
    if (levelParsed) {
      const diff = levelParsed.difficulty;
      const prog = await DailyPracticePathProgress.findOne({ studentId: sid, unitId: unit._id })
        .select('completedSections')
        .lean();
      const completedSet = new Set(prog?.completedSections || []);
      const easyDone = isLevelConfigComplete(targetNode, 'easy', completedSet);
      const mediumDone = isLevelConfigComplete(targetNode, 'medium', completedSet);
      const diffUnlocked = view.testedOut || diff === 'easy'
        || (diff === 'medium' && easyDone)
        || (diff === 'hard' && easyDone && mediumDone);
      if (!diffUnlocked) throw httpError(403, 'Hãy hoàn thành mức độ trước rồi mới mở video này');
      const cfg = targetNode.levelConfigs?.[diff];
      if (!view.testedOut && cfg && cfg.sequentialSections !== false) {
        const hidden = new Set(cfg.hiddenSections || []);
        const order = (cfg.sectionOrder?.length ? cfg.sectionOrder : DEFAULT_SECTION_ORDER)
          .filter((k) => !hidden.has(k));
        const idx = order.indexOf('video');
        if (idx > 0 && order.slice(0, idx).some((secKey) => !completedSet.has(`${targetNode.key}:${diff}:${secKey}`))) {
          throw httpError(403, 'Hãy hoàn thành phần trước rồi mới mở video này');
        }
      }
    } else if (parsed) {
      const targetLevel = (targetNode.levels || []).find((l) => l.key === parsed.stepKey);
      if (targetLevel?.state === 'locked') {
        throw httpError(403, 'Cấp độ này chưa mở');
      }
    }
  }
  const filter = { studentId: sid, unitId: unit._id };
  const addSet = { watchedVideoIds: { $each: [storageId, ...extraWatchedIds] } };
  if (extraSectionKeys.length) addSet.completedSections = { $each: extraSectionKeys };
  const update = { $addToSet: addSet, $setOnInsert: { topicId: unit.topicId } };
  try {
    await DailyPracticePathProgress.updateOne(filter, update, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    await DailyPracticePathProgress.updateOne(filter, update);
  }
  return { unitId: String(unit._id), videoId: storageId, watched: true };
}

async function toggleSectionProgress(studentId, { unitId, nodeKey, difficulty, sectionKey, completed = true } = {}) {
  const sid = requireId(studentId, 'Học viên');
  const unit = await DailyPracticeUnit.findOne({ _id: requireId(unitId, 'Chặng'), active: true }).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy chặng');
  const cleanNodeKey = String(nodeKey || '').trim();
  const cleanDiff = String(difficulty || '').trim();
  const cleanSection = String(sectionKey || '').trim();
  if (!cleanNodeKey) throw httpError(400, 'Thiếu mã bài học');
  if (!DIFFICULTY_KEYS.includes(cleanDiff)) throw httpError(400, 'Mức độ không hợp lệ');
  if (!DEFAULT_SECTION_ORDER.includes(cleanSection)) throw httpError(400, 'Phần học không hợp lệ');

  const { path } = await topicPathForUnit(sid, unit);
  const view = path.units.find((item) => item.id === String(unit._id));
  if (!view || view.state === 'locked') throw httpError(403, 'Chặng này chưa mở');

  const key = `${cleanNodeKey}:${cleanDiff}:${cleanSection}`;
  const filter = { studentId: sid, unitId: unit._id };
  if (completed !== false) {
    const update = { $addToSet: { completedSections: key }, $setOnInsert: { topicId: unit.topicId } };
    try {
      await DailyPracticePathProgress.updateOne(filter, update, { upsert: true });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      await DailyPracticePathProgress.updateOne(filter, update);
    }
  } else {
    await DailyPracticePathProgress.updateOne(filter, { $pull: { completedSections: key } });
  }
  const doc = await DailyPracticePathProgress.findOne(filter).select('completedSections').lean();
  return { unitId: String(unit._id), completedSections: doc?.completedSections || [] };
}

/** Ghi kết quả một lượt lộ trình đã hoàn thành; trả trạng thái mới + bước kế tiếp. */
async function recordPathResult(session) {
  const unit = await DailyPracticeUnit.findById(session.unitId).lean();
  if (!unit || !STEP_KEYS.includes(session.step)) return null;
  const total = session.questionIds?.length || 0;
  const scorePercent = total ? Math.round(((session.correctCount || 0) / total) * 100) : 0;
  const required = passPercent(session.step, { testOut: session.testOut });
  const passed = scorePercent >= required;
  const studentId = session.studentId;
  const nodeKey = String(session.pathNodeKey || 'study').trim();

  if (session.review === true) {
    const { path } = await topicPathForUnit(studentId, unit);
    const after = path.units.find((item) => item.id === String(unit._id));
    const position = path.units.findIndex((item) => item.id === String(unit._id));
    const following = position >= 0 ? path.units[position + 1] : null;
    const pathNode = (after?.pathNodes || []).find((item) => item.key === nodeKey);
    return {
      unitId: String(unit._id),
      unitTitle: unit.title,
      pathNodeKey: nodeKey,
      pathNodeLabel: pathNode?.label || nodeKey,
      step: session.step,
      stepLabel: stepMeta(session.step).label,
      testOut: false,
      passed,
      scorePercent,
      passPercent: required,
      unitCompleted: after?.state === 'completed',
      unlockedUnit: null,
      topicCompleted: path.units.length > 0 && path.units.every((item) => item.state === 'completed'),
      next: path.next,
      review: true,
    };
  }

  if (passed) {
    if (session.testOut) {
      const { path } = await topicPathForUnit(studentId, unit);
      const target = path.units.findIndex((item) => item.id === String(unit._id));
      for (const item of path.units.slice(0, target + 1)) {
        if (item.state === 'completed') continue;
        const rawUnit = await DailyPracticeUnit.findById(item.id).lean();
        const nodes = normalizePathNodes(rawUnit || {});
        const allSteps = nodes.flatMap((node) => PATH_STEP_KEYS.map((level) => progressStepKey(node.key, level)));
        await markSteps(
          studentId,
          unit.topicId,
          new mongoose.Types.ObjectId(item.id),
          allSteps,
          { complete: true, testedOut: true },
        );
      }
    } else {
      const unitComplete = isFinalUnitLevel(unit, nodeKey, session.step);
      await markSteps(studentId, unit.topicId, unit._id, [progressStepKey(nodeKey, session.step)], { complete: unitComplete });
      const diff = STEP_DIFFICULTY_MAP[session.step];
      if (diff) {
        await DailyPracticePathProgress.updateOne(
          { studentId, unitId: unit._id },
          { $addToSet: { completedSections: `${nodeKey}:${diff}:practice` }, $setOnInsert: { topicId: unit.topicId } },
          { upsert: true },
        ).catch(() => {});
      }
    }
  }

  const { path } = await topicPathForUnit(studentId, unit);
  const after = path.units.find((item) => item.id === String(unit._id));
  const position = path.units.findIndex((item) => item.id === String(unit._id));
  const following = position >= 0 ? path.units[position + 1] : null;
  const pathNode = (after?.pathNodes || []).find((item) => item.key === nodeKey);
  return {
    unitId: String(unit._id),
    unitTitle: unit.title,
    pathNodeKey: nodeKey,
    pathNodeLabel: pathNode?.label || nodeKey,
    step: session.step,
    stepLabel: stepMeta(session.step).label,
    testOut: Boolean(session.testOut),
    passed,
    scorePercent,
    passPercent: required,
    unitCompleted: after?.state === 'completed',
    unlockedUnit: passed && after?.state === 'completed' && following && following.state !== 'locked'
      ? { id: following.id, title: following.title, index: following.index }
      : null,
    topicCompleted: path.units.length > 0 && path.units.every((item) => item.state === 'completed'),
    next: path.next,
  };
}

module.exports = {
  STEPS,
  DEFAULT_PATH_NODES,
  STEP_PASS_PERCENT,
  CHECKPOINT_PASS_PERCENT,
  MIN_UNIT_QUESTIONS,
  ensureDefaultUnit,
  listUnits,
  createUnit,
  updateUnit,
  reorderUnits,
  deleteUnit,
  assignUnassigned,
  resolveQuestionUnit,
  computeUnits,
  hasTestOutAccess,
  getPath,
  setActivePathTopic,
  preparePathSession,
  recordPathResult,
  markVideoWatched,
  toggleSectionProgress,
  answerVideoCheck,
  buyVideoHint,
  unitVideos,
  claimUnitChest,
};
