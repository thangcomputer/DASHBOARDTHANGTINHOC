'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const LessonSubject = require('../models/LessonSubject');
const LessonUnit = require('../models/LessonUnit');
const LessonItem = require('../models/LessonItem');
const LessonUnitProgress = require('../models/LessonUnitProgress');
const LessonAnswer = require('../models/LessonAnswer');
const Student = require('../models/Student');
const Course = require('../models/Course');
const { isCourseDiscountActive, effectiveCoursePrice } = require('../utils/coursePricing');
const SystemSettings = require('../models/SystemSettings');
const {
  getMergedExamCatalog,
  resolveExamSubjectsForCourse,
  isExcludedExamSubjectId,
} = require('./examSubjectCatalog');
const { isAiConfigured, chatCompletion } = require('./ai/llmClient');
const logger = require('../config/logger');
const rules = require('./lessonPracticeRules');

function isPreviewUnit(unit) {
  return unit?.isPreviewAllowed === true;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function mapSubject(doc, extra = {}) {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    examSubjectId: doc.examSubjectId || '',
    summary: doc.summary || '',
    unlockMode: doc.unlockMode || 'sequential',
    sortOrder: doc.sortOrder || 0,
    isActive: doc.isActive !== false,
    ...extra,
  };
}

function safeHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/') || raw.startsWith('uploads/')) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') return raw.slice(0, 2000);
  } catch { /* not a url */ }
  return null;
}

function mapUnit(doc, extra = {}) {
  const videos = Array.isArray(doc.videos) && doc.videos.length
    ? doc.videos
    : (String(doc.videoUrl || '').trim() ? [{ id: 'legacy-video', title: 'Video 1', url: doc.videoUrl }] : []);
  const contents = Array.isArray(doc.contents) && doc.contents.length
    ? doc.contents
    : (String(doc.note || '').trim() ? [{ id: 'legacy-note', title: 'Nội dung 1', content: doc.note }] : []);
  return {
    id: String(doc._id),
    subjectId: String(doc.subjectId),
    title: doc.title,
    videoUrl: doc.videoUrl || '',
    note: doc.note || '',
    videos: videos.map((item, index) => ({
      id: String(item.id || `video-${index + 1}`),
      title: String(item.title || `Video ${index + 1}`),
      url: String(item.url || ''),
      antiSeek: typeof item.antiSeek === 'boolean' ? item.antiSeek : doc.antiSeek !== false,
    })),
    contents: contents.map((item, index) => ({
      id: String(item.id || `note-${index + 1}`),
      title: String(item.title || `Nội dung ${index + 1}`),
      content: String(item.content || ''),
    })),
    contentOrder: Array.isArray(doc.contentOrder) ? doc.contentOrder.map(String) : [],
    antiSeek: doc.antiSeek !== false,
    isPreviewAllowed: doc.isPreviewAllowed === true,
    timeLimitSec: rules.clampTimeLimit(doc.timeLimitSec),
    sortOrder: doc.sortOrder || 0,
    isActive: doc.isActive !== false,
    ...extra,
  };
}

function mapItemAdmin(doc) {
  return {
    id: String(doc._id),
    unitId: String(doc.unitId),
    subjectId: String(doc.subjectId),
    videoId: String(doc.videoId || ''),
    type: doc.type,
    sortOrder: doc.sortOrder || 0,
    prompt: doc.prompt || '',
    imageUrl: doc.imageUrl || '',
    imageName: doc.imageName || '',
    caption: doc.caption || '',
    region: doc.region || null,
    options: doc.options || [],
    correctOptionId: doc.correctOptionId || '',
    correctOptionIds: doc.correctOptionIds || [],
    pairs: doc.pairs || [],
    rubric: doc.rubric || '',
    modelAnswer: doc.modelAnswer || '',
    explanation: doc.explanation || '',
    timeLimitSec: rules.clampTimeLimit(doc.timeLimitSec),
  };
}

function catalogLabel(entry) {
  return entry.label;
}

async function syncCatalogSubjects() {
  const settings = await SystemSettings.findOne().select('examSubjectsCustomRaw').lean();
  const catalog = getMergedExamCatalog(settings?.examSubjectsCustomRaw);
  const rows = await LessonSubject.find({});
  const byExam = new Map(rows.filter((row) => row.examSubjectId).map((row) => [row.examSubjectId, row]));
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  for (let i = 0; i < catalog.length; i += 1) {
    const entry = catalog[i];
    const found = byExam.get(entry.id) || bySlug.get(entry.id);
    const name = catalogLabel(entry);
    const sortOrder = i + 1;
    if (!found) {
      try {
        const doc = await LessonSubject.create({
          name,
          slug: entry.id,
          examSubjectId: entry.id,
          unlockMode: 'sequential',
          sortOrder,
          isActive: true,
        });
        byExam.set(entry.id, doc);
        bySlug.set(doc.slug, doc);
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
      continue;
    }
    let changed = false;
    if (found.examSubjectId !== entry.id) {
      found.examSubjectId = entry.id;
      changed = true;
    }
    if (found.name !== name) {
      found.name = name;
      changed = true;
    }
    if (found.sortOrder !== sortOrder) {
      found.sortOrder = sortOrder;
      changed = true;
    }
    if (changed) await found.save();
  }
}

async function listSubjectsAdmin() {
  await syncCatalogSubjects();
  const settings = await SystemSettings.findOne().select('examSubjectsCustomRaw').lean();
  const catalogIds = getMergedExamCatalog(settings?.examSubjectsCustomRaw).map((entry) => entry.id);
  const rows = await LessonSubject.find({
    isActive: { $ne: false },
    examSubjectId: { $in: catalogIds },
  }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return rows.map((row) => mapSubject(row));
}

async function listCoursesForAdmin() {
  const [settings, courses] = await Promise.all([
    SystemSettings.findOne().select('examSubjectsCustomRaw').lean(),
    Course.find({ status: 'published', deletedAt: null })
      .select('name examSubjects')
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return courses.map((course) => ({
    id: String(course._id),
    name: course.name,
    examSubjects: rules.normalizeCourseExamSubjectIds(
      resolveExamSubjectsForCourse(course, settings?.examSubjectsCustomRaw),
    ),
  }));
}

async function updateSubject(id, body) {
  if (!isId(id)) throw httpError(400, 'Môn không hợp lệ');
  const doc = await LessonSubject.findById(id);
  if (!doc || isExcludedExamSubjectId(doc.examSubjectId) || isExcludedExamSubjectId(doc.slug)) {
    throw httpError(404, 'Không tìm thấy môn');
  }
  if (body.name != null && !doc.examSubjectId) {
    const name = String(body.name).trim();
    if (!name) throw httpError(400, 'Tên môn không được để trống');
    doc.name = name;
  }
  if (body.summary != null) doc.summary = String(body.summary).trim();
  if (body.unlockMode != null) doc.unlockMode = body.unlockMode === 'open' ? 'open' : 'sequential';
  if (body.sortOrder != null) doc.sortOrder = Number(body.sortOrder) || 0;
  if (body.isActive != null) doc.isActive = !!body.isActive;
  await doc.save();
  return mapSubject(doc);
}

async function deleteSubject(id) {
  if (!isId(id)) throw httpError(400, 'Môn không hợp lệ');
  const doc = await LessonSubject.findById(id);
  if (!doc || isExcludedExamSubjectId(doc.examSubjectId) || isExcludedExamSubjectId(doc.slug)) {
    throw httpError(404, 'Không tìm thấy môn');
  }
  if (doc.examSubjectId) throw httpError(400, 'Môn có sẵn trong danh sách khóa học, không xóa được');
  const units = await LessonUnit.find({ subjectId: id }).select('_id').lean();
  const unitIds = units.map((u) => u._id);
  await LessonItem.deleteMany({ subjectId: id });
  await LessonUnit.deleteMany({ subjectId: id });
  await LessonUnitProgress.deleteMany({ subjectId: id });
  await LessonAnswer.deleteMany({ subjectId: id });
  await doc.deleteOne();
  return { id: String(id), removedUnits: unitIds.length };
}

async function seedDefaults() {
  await syncCatalogSubjects();
  const settings = await SystemSettings.findOne().select('examSubjectsCustomRaw').lean();
  const catalogIds = getMergedExamCatalog(settings?.examSubjectsCustomRaw).map((entry) => entry.id);
  const rows = await LessonSubject.find({
    examSubjectId: { $in: catalogIds },
    isActive: { $ne: false },
  }).sort({ sortOrder: 1 }).lean();
  return rows.map((row) => mapSubject(row));
}

async function assertSubject(id) {
  if (!isId(id)) throw httpError(400, 'Môn không hợp lệ');
  const doc = await LessonSubject.findById(id);
  if (!doc || isExcludedExamSubjectId(doc.examSubjectId) || isExcludedExamSubjectId(doc.slug)) {
    throw httpError(404, 'Không tìm thấy môn');
  }
  return doc;
}

async function listUnits(subjectId) {
  await assertSubject(subjectId);
  const rows = await LessonUnit.find({ subjectId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return rows.map((row) => mapUnit(row));
}

async function createUnit(subjectId, body) {
  await assertSubject(subjectId);
  const title = String(body?.title || '').trim();
  if (!title) throw httpError(400, 'Tên buổi không được để trống');
  const last = await LessonUnit.find({ subjectId }).sort({ sortOrder: -1 }).limit(1).lean();
  const sortOrder = body?.sortOrder != null ? Number(body.sortOrder) || 0 : ((last[0]?.sortOrder || 0) + 1);
  const doc = await LessonUnit.create({
    subjectId,
    title,
    sortOrder,
    isActive: body?.isActive !== false,
  });
  return mapUnit(doc);
}

async function updateUnit(id, body) {
  if (!isId(id)) throw httpError(400, 'Buổi không hợp lệ');
  const doc = await LessonUnit.findById(id);
  if (!doc) throw httpError(404, 'Không tìm thấy buổi');
  if (body.title != null) {
    const title = String(body.title).trim();
    if (!title) throw httpError(400, 'Tên buổi không được để trống');
    doc.title = title;
  }
  if (body.sortOrder != null) doc.sortOrder = Number(body.sortOrder) || 0;
  if (body.isActive != null) doc.isActive = !!body.isActive;
  if (body.isPreviewAllowed != null) doc.isPreviewAllowed = body.isPreviewAllowed === true;
  if (body.videoUrl != null) {
    const videoUrl = safeHttpUrl(body.videoUrl);
    if (videoUrl == null) throw httpError(400, 'Link video cần là địa chỉ http hoặc https');
    doc.videoUrl = videoUrl;
  }
  if (body.note != null) doc.note = String(body.note).slice(0, 20000);
  if (Array.isArray(body.videos)) {
    const usedIds = new Set();
    doc.videos = body.videos.flatMap((item, index) => {
      const url = safeHttpUrl(item?.url);
      if (url == null) throw httpError(400, `Link video ${index + 1} cần là địa chỉ http hoặc https`);
      if (!url) return [];
      const videoId = String(item.id || crypto.randomUUID()).slice(0, 100);
      if (usedIds.has(videoId)) throw httpError(400, 'Mỗi video cần có mã riêng');
      usedIds.add(videoId);
      return [{
        id: videoId,
        title: String(item.title || '').trim().slice(0, 200) || `Video ${index + 1}`,
        url,
        antiSeek: typeof item.antiSeek === 'boolean' ? item.antiSeek : body.antiSeek !== false && doc.antiSeek !== false,
      }];
    });
    doc.videoUrl = doc.videos[0]?.url || '';
  }
  if (Array.isArray(body.contents)) {
    const usedIds = new Set();
    doc.contents = body.contents.flatMap((item, index) => {
      const content = String(item?.content || '').slice(0, 200000);
      if (!content.trim()) return [];
      const contentId = String(item.id || crypto.randomUUID()).slice(0, 100);
      if (usedIds.has(contentId)) throw httpError(400, 'Mỗi nội dung cần có mã riêng');
      usedIds.add(contentId);
      return [{
        id: contentId,
        title: String(item.title || '').trim().slice(0, 200) || `Nội dung ${index + 1}`,
        content,
      }];
    });
    doc.note = doc.contents[0]?.content || '';
  }
  if (Array.isArray(body.contentOrder)) {
    const videos = mapUnit(doc).videos;
    const contents = mapUnit(doc).contents;
    const allowed = new Set([
      ...videos.map((item) => `video:${item.id}`),
      ...contents.map((item) => `content:${item.id}`),
      `practice:${doc._id}`,
      ...((await LessonItem.find({ unitId: doc._id }).select('_id').lean()).map((item) => `quiz:${item._id}`)),
    ]);
    const seen = new Set();
    doc.contentOrder = body.contentOrder
      .map((entry) => String(entry))
      .filter((entry) => allowed.has(entry) && !seen.has(entry) && seen.add(entry));
  }
  if (body.antiSeek != null) doc.antiSeek = !!body.antiSeek;
  if (body.timeLimitSec != null) doc.timeLimitSec = rules.clampTimeLimit(body.timeLimitSec);
  await doc.save();
  return mapUnit(doc);
}

async function deleteUnit(id) {
  if (!isId(id)) throw httpError(400, 'Buổi không hợp lệ');
  const doc = await LessonUnit.findById(id);
  if (!doc) throw httpError(404, 'Không tìm thấy buổi');
  await LessonItem.deleteMany({ unitId: id });
  await LessonUnitProgress.deleteMany({ unitId: id });
  await LessonAnswer.deleteMany({ unitId: id });
  await doc.deleteOne();
  return { id: String(id) };
}

async function listItems(unitId) {
  if (!isId(unitId)) throw httpError(400, 'Buổi không hợp lệ');
  const unit = await LessonUnit.findById(unitId).lean();
  if (!unit) throw httpError(404, 'Không tìm thấy buổi');
  const rows = await LessonItem.find({ unitId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return rows.map(mapItemAdmin);
}

async function createItem(unitId, body) {
  if (!isId(unitId)) throw httpError(400, 'Buổi không hợp lệ');
  const unit = await LessonUnit.findById(unitId);
  if (!unit) throw httpError(404, 'Không tìm thấy buổi');
  const message = rules.validateItemPayload(body);
  if (message) throw httpError(400, message);
  const data = rules.normalizeItem(body);
  data.videoId = '';
  if (body?.sortOrder == null) {
    const last = await LessonItem.find({ unitId }).sort({ sortOrder: -1 }).limit(1).lean();
    data.sortOrder = (last[0]?.sortOrder || 0) + 1;
  }
  const doc = await LessonItem.create({ ...data, unitId, subjectId: unit.subjectId });
  return mapItemAdmin(doc);
}

async function updateItem(id, body) {
  if (!isId(id)) throw httpError(400, 'Nội dung không hợp lệ');
  const doc = await LessonItem.findById(id);
  if (!doc) throw httpError(404, 'Không tìm thấy nội dung');
  const next = { ...mapItemAdmin(doc), ...body, type: body?.type || doc.type };
  const message = rules.validateItemPayload(next);
  if (message) throw httpError(400, message);
  const unit = await LessonUnit.findById(doc.unitId);
  if (!unit) throw httpError(404, 'Không tìm thấy buổi');
  const data = rules.normalizeItem(next);
  data.videoId = '';
  Object.assign(doc, data);
  if (data.region) doc.region = data.region;
  else doc.region = undefined;
  await doc.save();
  return mapItemAdmin(doc);
}

async function deleteItem(id) {
  if (!isId(id)) throw httpError(400, 'Nội dung không hợp lệ');
  const doc = await LessonItem.findById(id);
  if (!doc) throw httpError(404, 'Không tìm thấy nội dung');
  await LessonAnswer.deleteMany({ itemId: id });
  await doc.deleteOne();
  return { id: String(id) };
}

async function listProgress(subjectId) {
  const filter = {};
  if (subjectId) {
    if (!isId(subjectId)) throw httpError(400, 'Môn không hợp lệ');
    filter.subjectId = subjectId;
  }
  const progress = await LessonUnitProgress.find(filter).select('studentId subjectId unitId status').lean();
  const subjectIds = [...new Set(progress.map((p) => String(p.subjectId)))];
  const studentIds = [...new Set(progress.map((p) => String(p.studentId)))];
  const [subjects, units, students] = await Promise.all([
    LessonSubject.find({ _id: { $in: subjectIds } }).select('name').lean(),
    LessonUnit.find({ subjectId: { $in: subjectIds }, isActive: true }).select('subjectId title sortOrder isActive createdAt').lean(),
    Student.find({ _id: { $in: studentIds } }).select('name').lean(),
  ]);
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));
  const studentName = new Map(students.map((s) => [String(s._id), s.name]));
  const groups = new Map();
  progress.forEach((row) => {
    const key = `${row.studentId}:${row.subjectId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.entries()].map(([key, docs]) => {
    const [sid, subId] = key.split(':');
    const subjectUnits = units.filter((u) => String(u.subjectId) === subId);
    const summary = rules.describeProgress(subjectUnits, docs);
    return {
      studentId: sid,
      studentName: studentName.get(sid) || 'Học viên',
      subjectId: subId,
      subjectName: subjectName.get(subId) || 'Môn học',
      ...summary,
    };
  }).sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));
}

async function completionStates(studentId, units) {
  const unitIds = units.map((unit) => unit._id || unit.id);
  if (!unitIds.length) return new Map();
  const [progressRows, itemRows] = await Promise.all([
    LessonUnitProgress.find({ studentId, unitId: { $in: unitIds } }).lean(),
    LessonItem.find({ unitId: { $in: unitIds } }).lean(),
  ]);
  const questions = itemRows.filter((item) => rules.isQuestionType(item.type));
  const answers = questions.length
    ? await LessonAnswer.find({
      studentId,
      itemId: { $in: questions.map((item) => item._id) },
    }).select('itemId correct').lean()
    : [];
  const progressByUnit = new Map(progressRows.map((row) => [String(row.unitId), row]));
  const itemsByUnit = new Map();
  itemRows.forEach((item) => {
    const key = String(item.unitId);
    if (!itemsByUnit.has(key)) itemsByUnit.set(key, []);
    itemsByUnit.get(key).push(item);
  });
  const answersByItem = new Map(answers.map((answer) => [String(answer.itemId), answer]));
  return new Map(units.map((unit) => {
    const id = String(unit._id || unit.id);
    const unitQuestions = (itemsByUnit.get(id) || []).filter((item) => rules.isQuestionType(item.type));
    const practiceFinished = unitQuestions.every((question) => {
      const answer = answersByItem.get(String(question._id));
      if (!answer) return false;
      return !(rules.needsExactCorrect(question.type) || question.type === 'written') || answer.correct === true;
    });
    const progress = progressByUnit.get(id) || {};
    const check = rules.unitChecklist(unit, progress, practiceFinished);
    return [id, { check, completed: check.completed }];
  }));
}

async function completedUnitIds(studentId, subjectId, units) {
  const rows = units || await LessonUnit.find({ subjectId, isActive: true }).lean();
  const states = await completionStates(studentId, rows);
  return new Set([...states.entries()].filter(([, state]) => state.completed).map(([id]) => id));
}

async function grantedSubjectKeys(studentId, studentRecord = null) {
  const student = studentRecord || await Student.findById(studentId).select('course courseId enrollments').lean();
  const enrollments = Array.isArray(student?.enrollments) && student.enrollments.length
    ? student.enrollments
    : (student?.course ? [{ courseName: student.course, courseId: student.courseId, status: 'active', learningAccess: true }] : []);
  const open = enrollments.filter((enr) => {
    const status = String(enr?.status || 'active').toLowerCase();
    return status === 'active' && enr?.learningAccess !== false;
  });
  const keys = new Set();
  const courseIds = [];
  open.forEach((enr) => {
    (enr.examSubjects || []).forEach((id) => {
      const key = rules.normalizeSubjectKey(id);
      if (key) keys.add(key);
    });
    const nameKey = rules.normalizeSubjectKey(enr.courseName);
    if (nameKey) keys.add(nameKey);
    if (enr.courseId) courseIds.push(enr.courseId);
  });
  if (courseIds.length) {
    const courses = await Course.find({ _id: { $in: courseIds }, deletedAt: null }).select('name examSubjects').lean();
    courses.forEach((course) => {
      (course.examSubjects || []).forEach((id) => {
        const key = rules.normalizeSubjectKey(id);
        if (key) keys.add(key);
      });
      const nameKey = rules.normalizeSubjectKey(course.name);
      if (nameKey) keys.add(nameKey);
    });
  }
  return keys;
}

async function previewCourseForSubject(subject, requestedCourseId = '') {
  const [settings, courses] = await Promise.all([
    SystemSettings.findOne().select('examSubjectsCustomRaw').lean(),
    Course.find({ status: 'published', deletedAt: null })
      .select('name price discountPrice discountPercent discountStartsAt discountEndsAt examSubjects')
      .lean(),
  ]);
  const candidates = courses.filter((course) => {
    const subjectIds = resolveExamSubjectsForCourse(course, settings?.examSubjectsCustomRaw);
    return rules.subjectOpenedByKeys(subject, subjectIds.map((id) => rules.normalizeSubjectKey(id)));
  });
  const selected = candidates.find((course) => String(course._id) === String(requestedCourseId))
    || candidates
      .filter((course) => (course.examSubjects || []).length === 1)
      .sort((a, b) => effectiveCoursePriceForPreview(a) - effectiveCoursePriceForPreview(b))[0]
    || candidates.sort((a, b) => effectiveCoursePriceForPreview(a) - effectiveCoursePriceForPreview(b))[0];
  if (!selected) return null;
  const catalogById = new Map(
    getMergedExamCatalog(settings?.examSubjectsCustomRaw)
      .map((entry) => [entry.id, catalogLabel(entry)]),
  );
  const subjectIds = resolveExamSubjectsForCourse(selected, settings?.examSubjectsCustomRaw);
  return {
    id: String(selected._id),
    name: selected.name,
    price: effectiveCoursePriceForPreview(selected),
    subjects: subjectIds.map((id) => catalogById.get(id) || id),
  };
}

function effectiveCoursePriceForPreview(course) {
  return effectiveCoursePrice(course);
}

/**
 * Gợi ý đăng ký cho môn chưa mở, lấy từ khóa học admin cấu hình:
 * ưu tiên khóa lẻ (1 môn); nếu không có thì dùng gói rẻ nhất chứa môn đó.
 */
async function courseOffersBySubject(subjects) {
  const courses = await Course.find({ status: 'published', deletedAt: null }).select('name description thumbnail price discountPrice discountPercent discountStartsAt discountEndsAt examSubjects').lean();
  const offers = courses.map((course) => {
    const hasDiscount = isCourseDiscountActive(course);
    return {
      keys: new Set((course.examSubjects || []).map((id) => rules.normalizeSubjectKey(id)).filter(Boolean)),
      single: (course.examSubjects || []).length === 1,
      courseName: course.name,
      description: String(course.description || '').trim(),
      thumbnail: String(course.thumbnail || '').trim(),
      price: hasDiscount ? effectiveCoursePrice(course) : course.price,
      originalPrice: hasDiscount ? course.price : null,
      discountPercent: hasDiscount ? course.discountPercent : 0,
    };
  }).filter((o) => Number.isFinite(o.price) && o.price > 0);
  const result = new Map();
  subjects.forEach((subject) => {
    const matches = offers.filter((o) => rules.subjectOpenedByKeys(subject, o.keys));
    if (!matches.length) return;
    const pool = matches.some((o) => o.single) ? matches.filter((o) => o.single) : matches;
    const best = pool.reduce((a, b) => (b.price < a.price ? b : a));
    result.set(String(subject._id), {
      price: best.price,
      originalPrice: best.originalPrice,
      discountPercent: best.discountPercent,
      courseName: best.courseName,
      description: best.description,
      thumbnail: best.thumbnail || matches.find((o) => o.thumbnail)?.thumbnail || '',
      offerType: best.single ? 'single' : 'bundle',
    });
  });
  return result;
}
async function listSubjectsForStudent(studentId) {
  await syncCatalogSubjects();
  const settings = await SystemSettings.findOne().select('examSubjectsCustomRaw').lean();
  const catalogIds = getMergedExamCatalog(settings?.examSubjectsCustomRaw).map((entry) => entry.id);
  const subjects = await LessonSubject.find({
    isActive: true,
    examSubjectId: { $in: catalogIds },
  }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const subjectIds = subjects.map((s) => s._id);
  const [units, progress, student, courses] = await Promise.all([
    LessonUnit.find({ subjectId: { $in: subjectIds }, isActive: true }).select('subjectId').lean(),
    LessonUnitProgress.find({ studentId, subjectId: { $in: subjectIds }, status: 'completed' }).select('subjectId').lean(),
    Student.findById(studentId).select('course courseId teacherId enrollments').lean(),
    Course.find({ status: 'published', deletedAt: null })
      .select('name description thumbnail bannerColorStart bannerColorEnd price discountPrice discountPercent discountStartsAt discountEndsAt totalSessions examSubjects deliveryMode')
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const totalBySubject = new Map();
  units.forEach((u) => {
    const key = String(u.subjectId);
    totalBySubject.set(key, (totalBySubject.get(key) || 0) + 1);
  });
  const doneBySubject = new Map();
  progress.forEach((p) => {
    const key = String(p.subjectId);
    doneBySubject.set(key, (doneBySubject.get(key) || 0) + 1);
  });
  const granted = await grantedSubjectKeys(studentId, student);
  const offerBySubject = await courseOffersBySubject(subjects);
  const catalog = getMergedExamCatalog(settings?.examSubjectsCustomRaw);
  const labelsById = new Map(catalog.map((entry) => [entry.id, catalogLabel(entry)]));
  const studentSubjects = subjects.map((s) => mapSubject(s, {
    name: labelsById.get(s.examSubjectId) || s.name,
    completedUnitCount: doneBySubject.get(String(s._id)) || 0,
    totalUnitCount: totalBySubject.get(String(s._id)) || 0,
    opened: rules.subjectOpenedByKeys(s, granted),
    offer: rules.subjectOpenedByKeys(s, granted) ? null : (offerBySubject.get(String(s._id)) || null),
    thumbnail: offerBySubject.get(String(s._id))?.thumbnail || '',
  }));
  const enrollmentRows = Array.isArray(student?.enrollments) && student.enrollments.length
    ? student.enrollments
    : (student?.course ? [{
      courseName: student.course,
      courseId: student.courseId,
      teacherId: student.teacherId,
      status: 'active',
      learningAccess: true,
    }] : []);
  const learningEnrollments = enrollmentRows.filter((enrollment) =>
    String(enrollment?.status || 'active').toLowerCase() === 'active'
    && enrollment?.learningAccess !== false);
  const courseCatalog = courses.map((course) => {
    const examSubjectIds = rules.normalizeCourseExamSubjectIds(
      resolveExamSubjectsForCourse(course, settings?.examSubjectsCustomRaw),
    );
    const courseSubjects = rules.mapCourseSubjectsToLessons(
      examSubjectIds,
      studentSubjects,
      labelsById,
      granted,
    );
    const lessonCount = courseSubjects.reduce(
      (total, subject) => total + (Number(subject.totalUnitCount) || 0),
      0,
    );
    const completedLessonCount = courseSubjects.reduce(
      (total, subject) => total + (Number(subject.completedUnitCount) || 0),
      0,
    );
    const matchesCourse = (enrollment) =>
      (enrollment.courseId && String(enrollment.courseId) === String(course._id))
      || (
        enrollment.courseName
        && rules.normalizeSubjectKey(enrollment.courseName) === rules.normalizeSubjectKey(course.name)
      );
    const courseEnrollment = learningEnrollments.find(matchesCourse);
    const enrolled = Boolean(courseEnrollment);
    const hasDiscount = isCourseDiscountActive(course);
    return {
      id: String(course._id),
      name: course.name,
      description: String(course.description || '').trim(),
      thumbnail: String(course.thumbnail || '').trim(),
      bannerColorStart: course.bannerColorStart || '',
      bannerColorEnd: course.bannerColorEnd || '',
      price: hasDiscount ? effectiveCoursePrice(course) : course.price,
      originalPrice: hasDiscount ? course.price : null,
      discountPercent: hasDiscount ? course.discountPercent : 0,
      discountStartsAt: hasDiscount && course.discountStartsAt ? course.discountStartsAt : null,
      discountEndsAt: hasDiscount && course.discountEndsAt ? course.discountEndsAt : null,
      totalSessions: course.totalSessions || 0,
      offerType: examSubjectIds.length === 1 ? 'single' : 'bundle',
      subjectKeys: [...new Set(examSubjectIds.map(rules.normalizeSubjectKey).filter(Boolean))],
      subjects: courseSubjects,
      lessonCount,
      completedLessonCount,
      enrolled,
      deliveryMode: course.deliveryMode === 'video' ? 'video' : 'instructor',
    };
  });
  const ownedSubjectKeys = new Set(
    courseCatalog
      .filter((course) => course.enrolled)
      .flatMap((course) => course.subjectKeys),
  );
  const visibleCourseCatalog = courseCatalog.map((course) => {
    const { subjectKeys, ...publicCourse } = course;
    return {
      ...publicCourse,
      hiddenByEnrollment: !course.enrolled
        && rules.courseSubjectsCovered(subjectKeys, ownedSubjectKeys),
    };
  });
  return { subjects: studentSubjects, courses: visibleCourseCatalog };
}

async function listUnitsForStudent(studentId, subjectId, requestedCourseId = '') {
  const subject = await assertSubject(subjectId);
  if (subject.isActive === false) throw httpError(404, 'Không tìm thấy môn');
  const granted = await grantedSubjectKeys(studentId);
  const subjectIsOpen = rules.subjectOpenedByKeys(subject, granted);
  const purchaseCourse = subjectIsOpen ? null : await previewCourseForSubject(subject, requestedCourseId);
  if (!subjectIsOpen && !purchaseCourse) throw httpError(403, 'Đăng ký khóa học này để mở môn');
  const units = await LessonUnit.find({ subjectId, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const progress = await LessonUnitProgress.find({ studentId, subjectId }).lean();
  const progressByUnit = new Map(progress.map((p) => [String(p.unitId), p]));
  const states = await completionStates(studentId, units);
  const done = new Set([...states.entries()].filter(([, state]) => state.completed).map(([id]) => id));
  const previewUnitIds = new Set(units.filter(isPreviewUnit).map((unit) => String(unit._id)));
  return {
    subject: mapSubject(subject, {
      previewOnly: !subjectIsOpen,
      purchaseCourse,
    }),
    units: units.map((unit) => {
      const previewAllowed = previewUnitIds.has(String(unit._id));
      const isPreview = !subjectIsOpen && previewAllowed;
      const locked = rules.isUnitLocked(units, done, unit._id, previewAllowed ? previewUnitIds : undefined);
      const row = progressByUnit.get(String(unit._id));
      const check = states.get(String(unit._id))?.check || rules.unitChecklist(unit, row, false);
      const purchaseRequired = !subjectIsOpen && !isPreview;
      const status = check.completed ? 'completed' : row ? 'in_progress' : (locked ? 'locked' : 'open');
      return mapUnit(unit, {
        locked: purchaseRequired || locked,
        purchaseRequired,
        isPreview,
        status: purchaseRequired ? 'locked' : status,
        videoDone: check.videoDone,
        noteDone: check.noteDone,
        videoDoneIds: check.videoDoneIds,
        noteDoneIds: check.noteDoneIds,
        practiceDone: check.practiceDone,
        videos: purchaseRequired ? [] : mapUnit(unit).videos,
        contents: purchaseRequired ? [] : mapUnit(unit).contents,
        videoUrl: purchaseRequired ? '' : (unit.videoUrl || ''),
        note: purchaseRequired ? '' : (unit.note || ''),
      });
    }),
  };
}

async function loadStudentUnit(studentId, unitId) {
  if (!isId(unitId)) throw httpError(400, 'Buổi không hợp lệ');
  const unit = await LessonUnit.findById(unitId);
  if (!unit || unit.isActive === false) throw httpError(404, 'Không tìm thấy buổi');
  const subject = await LessonSubject.findById(unit.subjectId);
  if (
    !subject
    || subject.isActive === false
    || isExcludedExamSubjectId(subject.examSubjectId)
    || isExcludedExamSubjectId(subject.slug)
  ) {
    throw httpError(404, 'Không tìm thấy môn');
  }
  const granted = await grantedSubjectKeys(studentId);
  const subjectIsOpen = rules.subjectOpenedByKeys(subject, granted);
  const units = await LessonUnit.find({ subjectId: subject._id, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const isPreview = !subjectIsOpen && isPreviewUnit(unit);
  if (!subjectIsOpen && !isPreview) {
    throw httpError(403, 'Mua khóa học để mở buổi này');
  }
  if (!subjectIsOpen && !(await previewCourseForSubject(subject))) {
    throw httpError(403, 'Khóa học này hiện không mở bán');
  }
  const done = await completedUnitIds(studentId, subject._id, units);
  if (rules.isUnitLocked(units, done, unit._id, isPreviewUnit(unit) ? new Set([String(unit._id)]) : undefined)) {
    throw httpError(403, 'Hoàn thành buổi trước để mở buổi này');
  }
  return { unit, subject, isPreview };
}

async function practiceFinishedFor(studentId, unit, items) {
  const questions = items.filter((item) => rules.isQuestionType(item.type));
  if (!questions.length) return true;
  const answers = await LessonAnswer.find({
    studentId, unitId: unit._id, itemId: { $in: questions.map((q) => q._id) },
  }).select('itemId correct').lean();
  const byItem = new Map(answers.map((row) => [String(row.itemId), row]));
  return questions.every((question) => {
    const saved = byItem.get(String(question._id));
    if (!saved) return false;
    if (rules.needsExactCorrect(question.type) || question.type === 'written') return saved.correct === true;
    return true;
  });
}

function checklistPayload(status, check) {
  return {
    status,
    videoDone: check.videoDone,
    noteDone: check.noteDone,
    videoDoneIds: check.videoDoneIds,
    noteDoneIds: check.noteDoneIds,
    practiceDone: check.practiceDone,
  };
}

async function refreshUnitStatus(studentId, unit, items) {
  const practiceFinished = await practiceFinishedFor(studentId, unit, items);
  const existing = await LessonUnitProgress.findOne({ studentId, unitId: unit._id });
  const check = rules.unitChecklist(unit, {
    ...existing?.toObject?.() || existing || {},
    practiceDone: practiceFinished,
  }, practiceFinished);
  const nextStatus = check.completed ? 'completed' : 'in_progress';
  const patch = {
    subjectId: unit.subjectId,
    status: nextStatus,
    videoDone: check.videoDone,
    noteDone: check.noteDone,
    practiceDone: check.practiceDone,
  };
  if (nextStatus === 'completed' && existing?.status !== 'completed') patch.completedAt = new Date();
  try {
    await LessonUnitProgress.updateOne(
      { studentId, unitId: unit._id },
      { $set: patch },
      { upsert: true },
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  return nextStatus;
}

async function markUnitSection(studentId, unitId, section, itemId = '') {
  const { unit } = await loadStudentUnit(studentId, unitId);
  const items = await LessonItem.find({ unitId: unit._id }).select('type').lean();
  const collection = section === 'video' ? rules.unitVideos(unit) : section === 'note' ? rules.unitContents(unit) : null;
  if (!collection) throw httpError(400, 'Phần không hợp lệ');
  if (!collection.length) throw httpError(400, section === 'video' ? 'Buổi này chưa có video' : 'Buổi này chưa có nội dung');
  const selectedId = String(itemId || collection[0].id || '');
  if (!collection.some((item) => String(item.id) === selectedId)) throw httpError(400, 'Nội dung không hợp lệ');
  const field = section === 'video' ? 'completedVideoIds' : 'completedNoteIds';
  await LessonUnitProgress.updateOne(
    { studentId, unitId: unit._id },
    { $addToSet: { [field]: selectedId }, $set: { subjectId: unit.subjectId } },
    { upsert: true },
  );
  const status = await refreshUnitStatus(studentId, unit, items);
  const row = await LessonUnitProgress.findOne({ studentId, unitId: unit._id }).lean();
  return checklistPayload(status, rules.unitChecklist(unit, row, row?.practiceDone));
}

async function getUnitForStudent(studentId, unitId) {
  const { unit, subject, isPreview } = await loadStudentUnit(studentId, unitId);
  const items = await LessonItem.find({ unitId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const answers = await LessonAnswer.find({ studentId, unitId }).lean();
  const byItem = new Map(answers.map((a) => [String(a.itemId), a]));
  const status = await refreshUnitStatus(studentId, unit, items);
  const row = await LessonUnitProgress.findOne({ studentId, unitId }).lean();
  const check = rules.unitChecklist(unit, row, row?.practiceDone);
  return {
    subject: mapSubject(subject),
    unit: mapUnit(unit, { ...checklistPayload(status, check), isPreview }),
    items: items.map((item) => {
      const saved = byItem.get(String(item._id));
      if (!saved) return rules.publicItem(item);
      if ((rules.needsExactCorrect(item.type) || item.type === 'written') && saved.correct !== true) return rules.publicItem(item);
      return rules.withConfirmedAnswer(item, saved);
    }),
  };
}

function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch { /* continue */ }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function explainWritten(item, text) {
  const answer = String(text || '').trim();
  if (!answer) throw httpError(400, 'Hãy ghi câu trả lời trước khi xác nhận');
  if (answer.length > 4000) throw httpError(400, 'Câu trả lời quá dài');
  if (!isAiConfigured()) {
    logger.warn('[LESSON] written grade skipped: chatbot AI key is not configured');
    return {
      passed: false,
      score: null,
      explanation: '',
      feedback: 'Trợ lý AI chưa kết nối được. Vui lòng thử lại sau.',
    };
  }
  const { getSupportModelFallbacks } = require('./aiSupportService');
  const messages = [
    {
      role: 'system',
      content: 'Bạn là giáo viên tin học. Đối chiếu câu hỏi, barem và đáp án mẫu với bài học viên. Chỉ trả về JSON {"score":0-100,"explanation":"tiếng Việt, một câu"}. score là phần trăm ý đúng. explanation khi chưa đạt chỉ nói còn thiếu ý gì, không chép lại đáp án mẫu.',
    },
    {
      role: 'user',
      content: `Câu hỏi: ${item.prompt}\nBarem: ${item.rubric || ''}\nĐáp án mẫu: ${item.modelAnswer || ''}\nBài học viên: ${answer}`,
    },
  ];
  let lastErr = null;
  for (const model of getSupportModelFallbacks()) {
    try {
      const result = await chatCompletion({
        messages,
        model,
        temperature: 0.2,
        maxTokens: 400,
        responseFormat: 'json',
      });
      const parsed = parseJsonLoose(result?.content);
      const score = rules.writtenPercent(parsed?.score);
      if (!parsed || score == null) {
        lastErr = new Error('missing score');
        continue;
      }
      const passed = rules.writtenPasses(score);
      const note = String(parsed.explanation || '').trim().slice(0, 500);
      return {
        passed,
        score,
        explanation: passed ? (note || `Chúc mừng! Bạn đã đạt ${score}%.`) : note,
        feedback: passed ? '' : `Bạn đúng khoảng ${score}%. Cần đúng trên 70% mới qua, vui lòng trả lời lại.${note ? ` ${note}` : ''}`,
      };
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: err.message }, '[LESSON] written grade model failed');
    }
  }
  logger.warn({ err: lastErr?.message }, '[LESSON] written explain fallback');
  return {
    passed: false,
    score: null,
    explanation: '',
    feedback: 'Chưa đối chiếu được câu trả lời. Vui lòng viết lại.',
  };
}

async function confirmItem(studentId, itemId, body) {
  if (!isId(itemId)) throw httpError(400, 'Câu hỏi không hợp lệ');
  const item = await LessonItem.findById(itemId);
  if (!item || !rules.isQuestionType(item.type)) throw httpError(404, 'Không tìm thấy câu hỏi');
  await loadStudentUnit(studentId, item.unitId);
  const existing = await LessonAnswer.findOne({ studentId, itemId });
  if (existing?.correct === true) {
    return { item: rules.withConfirmedAnswer(item, existing), alreadyConfirmed: true };
  }
  let graded;
  if (rules.needsExactCorrect(item.type)) {
    graded = rules.gradeObjective(item, body || {});
    if (!graded.correct) {
      return {
        retry: true,
        item: {
          ...rules.publicItem(item),
          confirmed: false,
          correct: false,
          feedback: 'Bạn sai rồi, vui lòng chọn lại đáp án',
        },
      };
    }
    graded.explanation = 'Chúc mừng! Bạn đã chọn đúng.';
  } else if (item.type === 'written') {
    const explained = await explainWritten(item, body?.text);
    if (!explained.passed) {
      return {
        retry: true,
        item: {
          ...rules.publicItem(item),
          confirmed: false,
          correct: false,
          feedback: explained.feedback,
        },
      };
    }
    graded = {
      correct: true,
      explanation: explained.explanation,
      answer: { text: String(body.text || '').trim() },
    };
  } else {
    graded = rules.gradeObjective(item, body || {});
  }
  const saved = await LessonAnswer.findOneAndUpdate(
    { studentId, itemId },
    {
      $set: {
        studentId,
        itemId,
        unitId: item.unitId,
        subjectId: item.subjectId,
        answer: graded.answer,
        correct: graded.correct,
        explanation: graded.explanation,
      },
    },
    { upsert: true, new: true },
  );
  const items = await LessonItem.find({ unitId: item.unitId }).select('type').lean();
  const unit = await LessonUnit.findById(item.unitId);
  const unitStatus = await refreshUnitStatus(studentId, unit, items);
  return { item: rules.withConfirmedAnswer(item, saved), unitStatus, alreadyConfirmed: false };
}

async function resetPractice(studentId, unitId) {
  const { unit } = await loadStudentUnit(studentId, unitId);
  const quizzes = await LessonItem.find({
    unitId: unit._id,
    type: { $in: ['mcq', 'multi', 'match', 'drag', 'hotspot', 'written'] },
  }).select('_id').lean();
  if (quizzes.length) {
    await LessonAnswer.deleteMany({
      studentId,
      unitId: unit._id,
      itemId: { $in: quizzes.map((item) => item._id) },
    });
  }
  return getUnitForStudent(studentId, unit._id);
}

const BACKUP_FORMAT = 'lesson-practice-backup';

async function exportBackup() {
  const [subjects, units, items] = await Promise.all([
    LessonSubject.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    LessonUnit.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    LessonItem.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean(),
  ]);
  const itemsByUnit = new Map();
  items.forEach((item) => {
    const key = String(item.unitId);
    if (!itemsByUnit.has(key)) itemsByUnit.set(key, []);
    itemsByUnit.get(key).push(mapItemAdmin(item));
  });
  const unitsBySubject = new Map();
  units.forEach((unit) => {
    const key = String(unit.subjectId);
    if (!unitsBySubject.has(key)) unitsBySubject.set(key, []);
    unitsBySubject.get(key).push({
      ...mapUnit(unit),
      items: itemsByUnit.get(String(unit._id)) || [],
    });
  });
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    subjects: subjects.map((subject) => ({
      ...mapSubject(subject),
      units: unitsBySubject.get(String(subject._id)) || [],
    })),
  };
}

async function findBackupSubject(entry) {
  const examSubjectId = String(entry?.examSubjectId || '').trim();
  if (examSubjectId) {
    const found = await LessonSubject.findOne({ examSubjectId });
    if (found) return found;
  }
  const slug = String(entry?.slug || '').trim();
  if (slug) {
    const found = await LessonSubject.findOne({ slug });
    if (found) return found;
  }
  const name = String(entry?.name || '').trim();
  return name ? LessonSubject.findOne({ name }) : null;
}

async function importBackup(payload) {
  if (!payload || payload.format !== BACKUP_FORMAT || !Array.isArray(payload.subjects)) {
    throw httpError(400, 'File sao lưu không hợp lệ');
  }
  const result = {
    subjects: 0, units: 0, items: 0, skippedSubjects: [], skippedItems: 0,
  };
  for (const entry of payload.subjects) {
    const subject = await findBackupSubject(entry);
    if (!subject) {
      result.skippedSubjects.push(String(entry?.name || 'Không rõ tên'));
      continue;
    }
    result.subjects += 1;
    for (const unitEntry of Array.isArray(entry.units) ? entry.units : []) {
      const title = String(unitEntry?.title || '').trim();
      if (!title) continue;
      let unit = null;
      if (isId(unitEntry.id)) {
        unit = await LessonUnit.findById(unitEntry.id);
        if (unit && String(unit.subjectId) !== String(subject._id)) unit = null;
      }
      if (!unit) unit = await LessonUnit.findOne({ subjectId: subject._id, title });
      if (!unit) {
        const reuseId = isId(unitEntry.id) && !(await LessonUnit.exists({ _id: unitEntry.id }));
        unit = await LessonUnit.create({
          ...(reuseId ? { _id: unitEntry.id } : {}),
          subjectId: subject._id,
          title,
          sortOrder: Number(unitEntry.sortOrder) || 0,
        });
      }
      await updateUnit(unit._id, {
        title,
        sortOrder: unitEntry.sortOrder,
        isActive: unitEntry.isActive,
        isPreviewAllowed: unitEntry.isPreviewAllowed,
        antiSeek: unitEntry.antiSeek,
        timeLimitSec: unitEntry.timeLimitSec,
        videos: Array.isArray(unitEntry.videos) ? unitEntry.videos : undefined,
        contents: Array.isArray(unitEntry.contents) ? unitEntry.contents : undefined,
      });
      for (const itemEntry of Array.isArray(unitEntry.items) ? unitEntry.items : []) {
        if (rules.validateItemPayload(itemEntry)) {
          result.skippedItems += 1;
          continue;
        }
        const data = { ...rules.normalizeItem(itemEntry), videoId: '', unitId: unit._id, subjectId: subject._id };
        let item = isId(itemEntry.id) ? await LessonItem.findById(itemEntry.id) : null;
        if (item && String(item.unitId) !== String(unit._id)) item = null;
        if (item) {
          Object.assign(item, data);
          if (!data.region) item.region = undefined;
          await item.save();
        } else {
          const reuseId = isId(itemEntry.id) && !(await LessonItem.exists({ _id: itemEntry.id }));
          await LessonItem.create({ ...(reuseId ? { _id: itemEntry.id } : {}), ...data });
        }
        result.items += 1;
      }
      if (Array.isArray(unitEntry.contentOrder)) {
        await updateUnit(unit._id, { contentOrder: unitEntry.contentOrder });
      }
      result.units += 1;
    }
  }
  return result;
}

module.exports = {
  exportBackup,
  importBackup,
  listSubjectsAdmin,
  listCoursesForAdmin,
  updateSubject,
  deleteSubject,
  seedDefaults,
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  listProgress,
  listSubjectsForStudent,
  listUnitsForStudent,
  previewCourseForSubject,
  isPreviewUnit,
  getUnitForStudent,
  markUnitSection,
  confirmItem,
  resetPractice,
};
