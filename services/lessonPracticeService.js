'use strict';

const mongoose = require('mongoose');
const LessonSubject = require('../models/LessonSubject');
const LessonUnit = require('../models/LessonUnit');
const LessonItem = require('../models/LessonItem');
const LessonUnitProgress = require('../models/LessonUnitProgress');
const LessonAnswer = require('../models/LessonAnswer');
const Student = require('../models/Student');
const aiService = require('./aiService');
const logger = require('../config/logger');
const rules = require('./lessonPracticeRules');

const DEFAULT_SUBJECTS = [
  { name: 'Sử dụng máy tính', slug: 'su-dung-may-tinh', summary: 'Làm quen chuột, bàn phím và cửa sổ', sortOrder: 1 },
  { name: 'Word', slug: 'word', summary: 'Soạn thảo văn bản', sortOrder: 2 },
  { name: 'Excel', slug: 'excel', summary: 'Bảng tính và công thức', sortOrder: 3 },
  { name: 'PowerPoint', slug: 'powerpoint', summary: 'Trình chiếu', sortOrder: 4 },
];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function slugify(name) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'mon';
}

function mapSubject(doc, extra = {}) {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    summary: doc.summary || '',
    unlockMode: doc.unlockMode || 'sequential',
    sortOrder: doc.sortOrder || 0,
    isActive: doc.isActive !== false,
    ...extra,
  };
}

function mapUnit(doc, extra = {}) {
  return {
    id: String(doc._id),
    subjectId: String(doc.subjectId),
    title: doc.title,
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
    type: doc.type,
    sortOrder: doc.sortOrder || 0,
    prompt: doc.prompt || '',
    imageUrl: doc.imageUrl || '',
    caption: doc.caption || '',
    region: doc.region || null,
    options: doc.options || [],
    correctOptionId: doc.correctOptionId || '',
    rubric: doc.rubric || '',
    modelAnswer: doc.modelAnswer || '',
    explanation: doc.explanation || '',
  };
}

async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await LessonSubject.exists({ slug })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

async function listSubjectsAdmin() {
  const rows = await LessonSubject.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return rows.map((row) => mapSubject(row));
}

async function createSubject(body) {
  const name = String(body?.name || '').trim();
  if (!name) throw httpError(400, 'Tên môn không được để trống');
  const unlockMode = body?.unlockMode === 'open' ? 'open' : 'sequential';
  const doc = await LessonSubject.create({
    name,
    slug: await uniqueSlug(name),
    summary: String(body?.summary || '').trim(),
    unlockMode,
    sortOrder: Number(body?.sortOrder) || 0,
    isActive: body?.isActive !== false,
  });
  return mapSubject(doc);
}

async function updateSubject(id, body) {
  if (!isId(id)) throw httpError(400, 'Môn không hợp lệ');
  const doc = await LessonSubject.findById(id);
  if (!doc) throw httpError(404, 'Không tìm thấy môn');
  if (body.name != null) {
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
  if (!doc) throw httpError(404, 'Không tìm thấy môn');
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
  const created = [];
  for (const row of DEFAULT_SUBJECTS) {
    const exists = await LessonSubject.findOne({ slug: row.slug }).lean();
    if (exists) continue;
    const doc = await LessonSubject.create({ ...row, unlockMode: 'sequential', isActive: true });
    created.push(mapSubject(doc));
  }
  return created;
}

async function assertSubject(id) {
  if (!isId(id)) throw httpError(400, 'Môn không hợp lệ');
  const doc = await LessonSubject.findById(id);
  if (!doc) throw httpError(404, 'Không tìm thấy môn');
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
  const data = rules.normalizeItem(next);
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

async function completedUnitIds(studentId, subjectId) {
  const rows = await LessonUnitProgress.find({
    studentId, subjectId, status: 'completed',
  }).select('unitId').lean();
  return new Set(rows.map((r) => String(r.unitId)));
}

async function listSubjectsForStudent(studentId) {
  const subjects = await LessonSubject.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const subjectIds = subjects.map((s) => s._id);
  const [units, progress] = await Promise.all([
    LessonUnit.find({ subjectId: { $in: subjectIds }, isActive: true }).select('subjectId').lean(),
    LessonUnitProgress.find({ studentId, subjectId: { $in: subjectIds }, status: 'completed' }).select('subjectId').lean(),
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
  return subjects.map((s) => mapSubject(s, {
    completedUnitCount: doneBySubject.get(String(s._id)) || 0,
    totalUnitCount: totalBySubject.get(String(s._id)) || 0,
  }));
}

async function listUnitsForStudent(studentId, subjectId) {
  const subject = await assertSubject(subjectId);
  if (subject.isActive === false) throw httpError(404, 'Không tìm thấy môn');
  const units = await LessonUnit.find({ subjectId, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const progress = await LessonUnitProgress.find({ studentId, subjectId }).select('unitId status').lean();
  const statusByUnit = new Map(progress.map((p) => [String(p.unitId), p.status]));
  const done = new Set(progress.filter((p) => p.status === 'completed').map((p) => String(p.unitId)));
  return {
    subject: mapSubject(subject),
    units: units.map((unit) => {
      const locked = rules.isUnitLocked(units, done, subject.unlockMode, unit._id);
      const status = statusByUnit.get(String(unit._id)) || (locked ? 'locked' : 'open');
      return mapUnit(unit, { locked, status: locked ? 'locked' : status });
    }),
  };
}

async function loadStudentUnit(studentId, unitId) {
  if (!isId(unitId)) throw httpError(400, 'Buổi không hợp lệ');
  const unit = await LessonUnit.findById(unitId);
  if (!unit || unit.isActive === false) throw httpError(404, 'Không tìm thấy buổi');
  const subject = await LessonSubject.findById(unit.subjectId);
  if (!subject || subject.isActive === false) throw httpError(404, 'Không tìm thấy môn');
  const units = await LessonUnit.find({ subjectId: subject._id, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const done = await completedUnitIds(studentId, subject._id);
  if (rules.isUnitLocked(units, done, subject.unlockMode, unit._id)) {
    throw httpError(403, 'Hoàn thành buổi trước để mở buổi này');
  }
  return { unit, subject };
}

async function refreshUnitStatus(studentId, unit, items) {
  const questions = items.filter((item) => rules.isQuestionType(item.type));
  const answers = questions.length
    ? await LessonAnswer.find({
      studentId, unitId: unit._id, itemId: { $in: questions.map((q) => q._id) },
    }).select('itemId').lean()
    : [];
  const hasView = items.some((item) => item.type === 'image_view');
  const finished = questions.length > 0 ? answers.length >= questions.length : hasView;
  const existing = await LessonUnitProgress.findOne({ studentId, unitId: unit._id });
  if (existing?.status === 'completed') return 'completed';
  try {
    if (finished) {
      await LessonUnitProgress.updateOne(
        { studentId, unitId: unit._id },
        { $set: { status: 'completed', completedAt: new Date(), subjectId: unit.subjectId } },
        { upsert: true },
      );
      return 'completed';
    }
    if (!existing) {
      await LessonUnitProgress.create({
        studentId, unitId: unit._id, subjectId: unit.subjectId, status: 'in_progress',
      });
    }
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  return finished ? 'completed' : 'in_progress';
}

async function getUnitForStudent(studentId, unitId) {
  const { unit, subject } = await loadStudentUnit(studentId, unitId);
  const items = await LessonItem.find({ unitId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const answers = await LessonAnswer.find({ studentId, unitId }).lean();
  const byItem = new Map(answers.map((a) => [String(a.itemId), a]));
  const status = await refreshUnitStatus(studentId, unit, items);
  return {
    subject: mapSubject(subject),
    unit: mapUnit(unit, { status }),
    items: items.map((item) => {
      const saved = byItem.get(String(item._id));
      return saved ? rules.withConfirmedAnswer(item, saved) : rules.publicItem(item);
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
  const fallback = item.explanation || item.modelAnswer || 'Đã ghi nhận bài làm.';
  try {
    const result = await aiService.complete({
      system: 'Bạn là giáo viên tin học. Chỉ trả về JSON {"correct":true hoặc false,"explanation":"tiếng Việt, ngắn, giải thích cho học viên"}. correct = true khi bài nêu được ý chính. Không đưa điểm số.',
      prompt: `Đề: ${item.prompt}\nBarem: ${item.rubric || ''}\nĐáp án mẫu: ${item.modelAnswer || ''}\nBài học viên: ${answer}`,
    });
    const parsed = parseJsonLoose(result?.content);
    if (parsed && typeof parsed.explanation === 'string' && parsed.explanation.trim()) {
      return {
        correct: typeof parsed.correct === 'boolean' ? parsed.correct : null,
        explanation: String(parsed.explanation).slice(0, 2000),
      };
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[LESSON] written explain fallback');
  }
  return { correct: null, explanation: fallback };
}

async function confirmItem(studentId, itemId, body) {
  if (!isId(itemId)) throw httpError(400, 'Câu hỏi không hợp lệ');
  const item = await LessonItem.findById(itemId);
  if (!item || !rules.isQuestionType(item.type)) throw httpError(404, 'Không tìm thấy câu hỏi');
  await loadStudentUnit(studentId, item.unitId);
  const existing = await LessonAnswer.findOne({ studentId, itemId });
  if (existing) {
    return { item: rules.withConfirmedAnswer(item, existing), alreadyConfirmed: true };
  }
  let graded;
  if (item.type === 'written') {
    const explained = await explainWritten(item, body?.text);
    graded = { ...explained, answer: { text: String(body.text || '').trim() } };
  } else {
    graded = rules.gradeObjective(item, body || {});
  }
  let saved;
  try {
    saved = await LessonAnswer.create({
      studentId,
      itemId,
      unitId: item.unitId,
      subjectId: item.subjectId,
      answer: graded.answer,
      correct: graded.correct,
      explanation: graded.explanation,
    });
  } catch (err) {
    if (err?.code === 11000) {
      saved = await LessonAnswer.findOne({ studentId, itemId });
    } else {
      throw err;
    }
  }
  const items = await LessonItem.find({ unitId: item.unitId }).select('type').lean();
  const unit = await LessonUnit.findById(item.unitId);
  const unitStatus = await refreshUnitStatus(studentId, unit, items);
  return { item: rules.withConfirmedAnswer(item, saved), unitStatus, alreadyConfirmed: false };
}

module.exports = {
  listSubjectsAdmin,
  createSubject,
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
  getUnitForStudent,
  confirmItem,
};
