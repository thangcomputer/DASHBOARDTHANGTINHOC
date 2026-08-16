'use strict';

const mongoose = require('mongoose');
const Student = require('../models/Student');
const CertPrepCourse = require('../models/CertPrepCourse');
const CertPrepLevel = require('../models/CertPrepLevel');
const CertPrepTest = require('../models/CertPrepTest');
const CertPrepQuestion = require('../models/CertPrepQuestion');
const CertPrepSession = require('../models/CertPrepSession');
const StudentCertPrepAccess = require('../models/StudentCertPrepAccess');
const {
  LOCALES,
  validateQuestion,
} = require('./certPrepQuestionValidation');

class CertPrepError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CertPrepError';
    this.status = status;
  }
}

function isOid(id) {
  return /^[a-fA-F0-9]{24}$/.test(String(id || ''));
}

function requireOid(id, label = 'ID') {
  if (!isOid(id)) {
    throw new CertPrepError(400, `${label} không hợp lệ`);
  }
  return String(id);
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
  return s || `khoa-${Date.now()}`;
}

const SCORE_SCALE = 1000;

function computeScore(correctCount, totalQuestions) {
  const total = Number(totalQuestions) || 0;
  const correct = Number(correctCount) || 0;
  if (total <= 0) return 0;
  return Math.round((correct / total) * SCORE_SCALE);
}

function isPassed(score, passingScore) {
  return Number(score) >= Number(passingScore);
}

function pairKey(itemId, targetId) {
  return `${String(itemId)}=>${String(targetId)}`;
}

function gradeQuestion(question, value) {
  if (!question) return false;
  if (question.type === 'single_choice') {
    return Number(value) === Number(question.correctAnswer);
  }
  if (question.type === 'multiple_choice') {
    const selected = [...new Set((Array.isArray(value) ? value : []).map(Number))]
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
    const correct = [...new Set((question.correctIndices || []).map(Number))]
      .sort((a, b) => a - b);
    if (correct.length === 0) return false;
    if (selected.length !== correct.length) return false;
    return selected.every((n, i) => n === correct[i]);
  }
  if (question.type === 'matching') {
    const expected = new Set(
      (question.matchingPairs || []).map((p) => pairKey(p.itemId, p.targetId)),
    );
    const got = new Set(
      (Array.isArray(value) ? value : []).map((p) => pairKey(p?.itemId, p?.targetId)),
    );
    if (expected.size === 0 || expected.size !== got.size) return false;
    for (const key of expected) {
      if (!got.has(key)) return false;
    }
    return true;
  }
  if (question.type === 'true_false_grid') {
    const statements = Array.isArray(question.statements) ? question.statements : [];
    if (!statements.length) return false;
    const byId = new Map(
      (Array.isArray(value) ? value : []).map((row) => [String(row?.id), row?.value]),
    );
    return statements.every((s) => {
      const id = String(s.id);
      if (!byId.has(id)) return false;
      const v = byId.get(id);
      if (typeof v !== 'boolean') return false;
      return v === Boolean(s.correct);
    });
  }
  return false;
}

function isSessionExpired(session, timeLimitMinutes, now = new Date()) {
  const started = session?.startedAt ? new Date(session.startedAt) : null;
  const limit = Number(timeLimitMinutes);
  if (!started || !Number.isFinite(limit) || limit <= 0) return false;
  return now.getTime() - started.getTime() >= limit * 60 * 1000;
}

function elapsedSeconds(session, now = new Date()) {
  const started = session?.startedAt ? new Date(session.startedAt) : now;
  return Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000));
}

function assertSessionOwner(session, studentId) {
  if (!session) throw new CertPrepError(404, 'Không tìm thấy phiên làm bài');
  if (String(session.studentId) !== String(studentId)) {
    throw new CertPrepError(403, 'Bạn không có quyền truy cập phiên này');
  }
}

function isAccessCurrentlyValid(access, now = new Date()) {
  if (!access || access.isActive === false) return false;
  if (access.expiresAt && new Date(access.expiresAt).getTime() <= now.getTime()) return false;
  return true;
}

function assertRetakeAllowed(test, submittedCount) {
  if (submittedCount <= 0) return;
  if (test.allowRetake === false) {
    throw new CertPrepError(409, 'Bài kiểm tra không cho phép làm lại');
  }
  if (test.maxAttempts != null && Number(test.maxAttempts) >= 1) {
    if (submittedCount >= Number(test.maxAttempts)) {
      throw new CertPrepError(409, 'Bạn đã hết số lần làm bài');
    }
  }
}

function validateTestConfig(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new CertPrepError(400, 'Tên bài kiểm tra không được để trống');
    out.name = name;
  }
  if (!partial || body.locale !== undefined) {
    const locale = String(body.locale || '').trim();
    if (!LOCALES.includes(locale)) throw new CertPrepError(400, 'Ngôn ngữ không hợp lệ');
    out.locale = locale;
  }
  if (!partial || body.timeLimitMinutes !== undefined) {
    const n = Number(body.timeLimitMinutes);
    if (!Number.isFinite(n) || n <= 0) throw new CertPrepError(400, 'Thời gian phải lớn hơn 0');
    out.timeLimitMinutes = n;
  }
  if (!partial || body.questionCount !== undefined) {
    const n = Number(body.questionCount);
    if (!Number.isInteger(n) || n <= 0) throw new CertPrepError(400, 'Số câu phải lớn hơn 0');
    out.questionCount = n;
  }
  if (!partial || body.passingScore !== undefined) {
    const n = Number(body.passingScore);
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      throw new CertPrepError(400, 'Điểm đạt phải từ 0 đến 1000');
    }
    out.passingScore = n;
  }
  if (!partial || body.allowRetake !== undefined) {
    out.allowRetake = body.allowRetake !== false;
  }
  if (!partial || body.maxAttempts !== undefined) {
    if (body.maxAttempts == null || body.maxAttempts === '') {
      out.maxAttempts = null;
    } else {
      const n = Number(body.maxAttempts);
      if (!Number.isInteger(n) || n < 1) {
        throw new CertPrepError(400, 'Số lần làm tối đa không hợp lệ');
      }
      out.maxAttempts = n;
    }
  }
  if (!partial || body.sortOrder !== undefined) {
    out.sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  }
  if (!partial || body.isActive !== undefined) {
    out.isActive = body.isActive !== false;
  }
  return out;
}

async function uniqueCourseSlug(base, excludeId) {
  let slug = slugify(base);
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const q = { slug: candidate };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await CertPrepCourse.exists(q);
    if (!exists) return candidate;
    n += 1;
    if (n > 50) throw new CertPrepError(409, 'Không tạo được slug duy nhất');
  }
}

async function countSessionsForTest(testId) {
  return CertPrepSession.countDocuments({ testId });
}

async function countSessionsForLevel(levelId) {
  const tests = await CertPrepTest.find({ levelId }).select('_id').lean();
  const ids = tests.map((t) => t._id);
  if (!ids.length) return 0;
  return CertPrepSession.countDocuments({ testId: { $in: ids } });
}

async function countSessionsForCourse(courseId) {
  const levels = await CertPrepLevel.find({ courseId }).select('_id').lean();
  const levelIds = levels.map((l) => l._id);
  if (!levelIds.length) return 0;
  const tests = await CertPrepTest.find({ levelId: { $in: levelIds } }).select('_id').lean();
  const ids = tests.map((t) => t._id);
  if (!ids.length) return 0;
  return CertPrepSession.countDocuments({ testId: { $in: ids } });
}

async function loadTestChain(testId) {
  const test = await CertPrepTest.findById(testId).lean();
  if (!test) throw new CertPrepError(404, 'Không tìm thấy bài kiểm tra');
  const level = await CertPrepLevel.findById(test.levelId).lean();
  if (!level) throw new CertPrepError(404, 'Không tìm thấy level');
  const course = await CertPrepCourse.findById(level.courseId).lean();
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');
  return { test, level, course };
}

async function findValidAccess(studentId, courseId, now = new Date()) {
  const access = await StudentCertPrepAccess.findOne({
    studentId,
    courseId,
    isActive: true,
  }).lean();
  if (!isAccessCurrentlyValid(access, now)) return null;
  return access;
}

async function assertStudentCanAccessTest(studentId, testId) {
  const sid = requireOid(studentId, 'studentId');
  const tid = requireOid(testId, 'testId');
  const { test, level, course } = await loadTestChain(tid);
  if (!course.isActive || !level.isActive || !test.isActive) {
    throw new CertPrepError(403, 'Bài kiểm tra hiện không khả dụng');
  }
  const access = await findValidAccess(sid, course._id);
  if (!access) {
    throw new CertPrepError(403, 'Bạn chưa được cấp quyền khóa ôn thi này');
  }
  return { test, level, course, access };
}

function stripAnswerKeys(question, { reveal = false } = {}) {
  const statementsPublic = (question.statements || []).map((s) => ({
    id: String(s.id),
    text: s.text || '',
  }));
  const base = {
    id: String(question._id),
    testId: String(question.testId),
    locale: question.locale,
    type: question.type,
    questionText: question.questionText,
    questionImage: question.questionImage || '',
    options: question.options || [],
    matchingItems: question.matchingItems || [],
    matchingTargets: question.matchingTargets || [],
    statements: statementsPublic,
    hint: question.hint || '',
    hintImage: question.hintImage || '',
    sortOrder: question.sortOrder,
  };
  if (!reveal) return base;
  return {
    ...base,
    correctAnswer: question.correctAnswer,
    correctIndices: question.correctIndices,
    matchingPairs: question.matchingPairs,
    statements: (question.statements || []).map((s) => ({
      id: String(s.id),
      text: s.text || '',
      correct: Boolean(s.correct),
    })),
    explanation: question.explanation || '',
    explanationImage: question.explanationImage || '',
    minSelect: question.minSelect,
  };
}

function serializeSession(session, extra = {}) {
  return {
    id: String(session._id),
    studentId: String(session.studentId),
    testId: String(session.testId),
    locale: session.locale,
    status: session.status,
    questionIds: (session.questionIds || []).map((id) => String(id)),
    answers: session.answers || [],
    startedAt: session.startedAt,
    submittedAt: session.submittedAt,
    score: session.score,
    passed: session.passed,
    timeSpentSeconds: session.timeSpentSeconds,
    configSnapshot: session.configSnapshot || {},
    ...extra,
  };
}

function sessionTiming(session, now = new Date()) {
  const limitMin = Number(session?.configSnapshot?.timeLimitMinutes);
  const started = session?.startedAt ? new Date(session.startedAt) : now;
  const limitMs = (Number.isFinite(limitMin) && limitMin > 0 ? limitMin : 0) * 60 * 1000;
  const deadlineAt = new Date(started.getTime() + limitMs);
  const remainingSeconds = Math.max(0, Math.ceil((deadlineAt.getTime() - now.getTime()) / 1000));
  return {
    serverNow: now.toISOString(),
    deadlineAt: deadlineAt.toISOString(),
    remainingSeconds,
  };
}

function toStudentSession(session, questions = [], extra = {}) {
  const snap = session.configSnapshot || {};
  const timing = sessionTiming(session, extra.now || new Date());
  const feedbackMode = snap.feedbackMode === 'after_submit' ? 'after_submit' : 'immediate';
  const reveal = feedbackMode === 'immediate' && session.status === 'in_progress';
  return {
    id: String(session._id || session.id),
    testId: String(session.testId || ''),
    locale: session.locale,
    status: session.status,
    startedAt: session.startedAt,
    submittedAt: session.submittedAt || null,
    configSnapshot: {
      name: snap.name || '',
      timeLimitMinutes: snap.timeLimitMinutes,
      questionCount: snap.questionCount,
      feedbackMode,
    },
    answers: (session.answers || []).map((a) => ({
      questionId: String(a.questionId),
      value: a.value,
    })),
    questions: (questions || []).map((q) => stripAnswerKeys(q, { reveal })),
    remainingSeconds: timing.remainingSeconds,
    serverNow: timing.serverNow,
    deadlineAt: timing.deadlineAt,
    ...(extra.autoSubmitted ? { autoSubmitted: true } : {}),
  };
}

function cloneMatchingList(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    id: String(item.id || ''),
    text: item.text || '',
    imageUrl: item.imageUrl || '',
  }));
}

function freezeQuestion(question) {
  const id = String(question._id || question.id || '');
  return {
    id,
    type: question.type,
    questionText: question.questionText,
    questionImage: question.questionImage || '',
    options: (question.options || []).map((o) => ({
      text: o.text || '',
      imageUrl: o.imageUrl || '',
    })),
    matchingItems: cloneMatchingList(question.matchingItems),
    matchingTargets: cloneMatchingList(question.matchingTargets),
    correctAnswer: question.correctAnswer,
    correctIndices: [...(question.correctIndices || [])],
    matchingPairs: (question.matchingPairs || []).map((p) => ({
      itemId: String(p.itemId),
      targetId: String(p.targetId),
    })),
    statements: (question.statements || []).map((s) => ({
      id: String(s.id),
      text: s.text || '',
      correct: Boolean(s.correct),
    })),
    hint: question.hint || '',
    hintImage: question.hintImage || '',
    explanation: question.explanation || '',
    explanationImage: question.explanationImage || '',
  };
}

function isStudentAnswered(type, value, question = null) {
  if (type === 'single_choice') {
    return value !== undefined && value !== null && value !== '' && Number.isInteger(Number(value));
  }
  if (type === 'multiple_choice') {
    return Array.isArray(value) && value.length > 0;
  }
  if (type === 'matching') {
    return Array.isArray(value) && value.some((p) => p && p.itemId && p.targetId);
  }
  if (type === 'true_false_grid') {
    const statements = question?.statements || [];
    if (!statements.length || !Array.isArray(value)) return false;
    const byId = new Map(value.map((row) => [String(row?.id), row?.value]));
    return statements.every((s) => typeof byId.get(String(s.id)) === 'boolean');
  }
  return value != null && value !== '';
}

function durationSecondsOf(session) {
  if (Number.isFinite(Number(session.timeSpentSeconds)) && Number(session.timeSpentSeconds) > 0) {
    return Number(session.timeSpentSeconds);
  }
  if (session.startedAt && session.submittedAt) {
    const ms = new Date(session.submittedAt).getTime() - new Date(session.startedAt).getTime();
    return Math.max(0, Math.floor(ms / 1000));
  }
  return 0;
}

function buildReviewItems(session, questions) {
  const answersByQ = new Map((session.answers || []).map((a) => [String(a.questionId), a.value]));
  return (questions || []).map((q, index) => {
    const questionId = String(q._id || q.id);
    const studentAnswer = answersByQ.has(questionId) ? answersByQ.get(questionId) : null;
    const answered = isStudentAnswered(q.type, studentAnswer, q);
    const isCorrect = gradeQuestion(q, studentAnswer);
    return {
      questionId,
      order: index + 1,
      type: q.type,
      questionText: q.questionText,
      questionImage: q.questionImage || '',
      options: q.options || [],
      matchingItems: q.matchingItems || [],
      matchingTargets: q.matchingTargets || [],
      statements: q.statements || [],
      hint: q.hint || '',
      hintImage: q.hintImage || '',
      explanation: q.explanation || '',
      explanationImage: q.explanationImage || '',
      studentAnswer,
      correctAnswer: q.correctAnswer,
      correctIndices: q.correctIndices || [],
      matchingPairs: q.matchingPairs || [],
      answered,
      isCorrect,
    };
  });
}

function toStudentResult(session, questions) {
  const snap = session.configSnapshot || {};
  const review = buildReviewItems(session, questions);
  const totalQuestions = review.length || Number(snap.questionCount) || 0;
  const correctCount = session.correctCount != null
    ? Number(session.correctCount)
    : review.filter((row) => row.isCorrect).length;
  const answeredCount = session.answeredCount != null
    ? Number(session.answeredCount)
    : review.filter((row) => row.answered).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const incorrectCount = Math.max(0, answeredCount - correctCount);
  return {
    sessionId: String(session._id || session.id),
    testId: String(session.testId || ''),
    locale: session.locale,
    status: session.status,
    test: { name: snap.name || '' },
    course: snap.courseName ? { id: snap.courseId || '', name: snap.courseName } : null,
    level: snap.levelTitle ? { id: snap.levelId || '', title: snap.levelTitle } : null,
    totalQuestions,
    answeredCount,
    unansweredCount,
    correctCount,
    incorrectCount,
    score: session.score,
    scoreMax: SCORE_SCALE,
    passingScore: snap.passingScore,
    passed: session.passed,
    startedAt: session.startedAt,
    submittedAt: session.submittedAt || null,
    timeLimitMinutes: snap.timeLimitMinutes,
    durationSeconds: durationSecondsOf(session),
    questions: review,
  };
}

async function listCourses() {
  const courses = await CertPrepCourse.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const counts = await CertPrepLevel.aggregate([
    { $group: { _id: '$courseId', n: { $sum: 1 } } },
  ]);
  const byCourse = Object.fromEntries(counts.map((row) => [String(row._id), row.n]));
  return courses.map((c) => ({ ...c, levelCount: byCourse[String(c._id)] || 0 }));
}

async function createCourse(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new CertPrepError(400, 'Tên khóa không được để trống');
  const slug = await uniqueCourseSlug(body.slug || name);
  const doc = await CertPrepCourse.create({
    name,
    slug,
    logoUrl: String(body.logoUrl || ''),
    description: String(body.description || ''),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    isActive: body.isActive !== false,
  });
  return doc.toObject();
}

async function updateCourse(id, body) {
  const courseId = requireOid(id, 'courseId');
  const course = await CertPrepCourse.findById(courseId);
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');
  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new CertPrepError(400, 'Tên khóa không được để trống');
    course.name = name;
  }
  if (body.slug !== undefined) {
    course.slug = await uniqueCourseSlug(body.slug || course.name, course._id);
  }
  if (body.logoUrl !== undefined) course.logoUrl = String(body.logoUrl || '');
  if (body.description !== undefined) course.description = String(body.description || '');
  if (body.sortOrder !== undefined) course.sortOrder = Number(body.sortOrder) || 0;
  if (body.isActive !== undefined) course.isActive = body.isActive !== false;
  await course.save();
  return course.toObject();
}

async function deleteCourse(id) {
  const courseId = requireOid(id, 'courseId');
  const course = await CertPrepCourse.findById(courseId);
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');
  const used = await countSessionsForCourse(courseId);
  if (used > 0) {
    course.isActive = false;
    await course.save();
    return { id: String(course._id), isActive: false, softDeleted: true };
  }
  course.isActive = false;
  await course.save();
  return { id: String(course._id), isActive: false, softDeleted: true };
}

async function listLevels(courseId) {
  const id = requireOid(courseId, 'courseId');
  const course = await CertPrepCourse.findById(id).lean();
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');
  return CertPrepLevel.find({ courseId: id }).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

async function createLevel(courseId, body) {
  const id = requireOid(courseId, 'courseId');
  const course = await CertPrepCourse.findById(id).lean();
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');
  const title = String(body.title || '').trim();
  if (!title) throw new CertPrepError(400, 'Tên level không được để trống');
  const doc = await CertPrepLevel.create({
    courseId: id,
    title,
    subtitle: String(body.subtitle || ''),
    logoUrl: String(body.logoUrl || ''),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    isActive: body.isActive !== false,
  });
  return doc.toObject();
}

async function updateLevel(id, body) {
  const levelId = requireOid(id, 'levelId');
  const level = await CertPrepLevel.findById(levelId);
  if (!level) throw new CertPrepError(404, 'Không tìm thấy level');
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) throw new CertPrepError(400, 'Tên level không được để trống');
    level.title = title;
  }
  if (body.subtitle !== undefined) level.subtitle = String(body.subtitle || '');
  if (body.logoUrl !== undefined) level.logoUrl = String(body.logoUrl || '');
  if (body.sortOrder !== undefined) level.sortOrder = Number(body.sortOrder) || 0;
  if (body.isActive !== undefined) level.isActive = body.isActive !== false;
  await level.save();
  return level.toObject();
}

async function deleteLevel(id) {
  const levelId = requireOid(id, 'levelId');
  const level = await CertPrepLevel.findById(levelId);
  if (!level) throw new CertPrepError(404, 'Không tìm thấy level');
  level.isActive = false;
  await level.save();
  return { id: String(level._id), isActive: false, softDeleted: true };
}

async function listTestsAdmin(levelId) {
  const id = requireOid(levelId, 'levelId');
  const level = await CertPrepLevel.findById(id).lean();
  if (!level) throw new CertPrepError(404, 'Không tìm thấy level');
  return CertPrepTest.find({ levelId: id }).sort({ locale: 1, sortOrder: 1, createdAt: 1 }).lean();
}

async function createTest(levelId, body) {
  const id = requireOid(levelId, 'levelId');
  const level = await CertPrepLevel.findById(id).lean();
  if (!level) throw new CertPrepError(404, 'Không tìm thấy level');
  const cfg = validateTestConfig({
    name: body.name,
    locale: body.locale,
    timeLimitMinutes: body.timeLimitMinutes != null ? body.timeLimitMinutes : 50,
    questionCount: body.questionCount != null ? body.questionCount : 45,
    passingScore: body.passingScore != null ? body.passingScore : 700,
    allowRetake: body.allowRetake,
    maxAttempts: body.maxAttempts,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });
  const doc = await CertPrepTest.create({ levelId: id, ...cfg });
  return doc.toObject();
}

async function updateTest(id, body) {
  const testId = requireOid(id, 'testId');
  const test = await CertPrepTest.findById(testId);
  if (!test) throw new CertPrepError(404, 'Không tìm thấy bài kiểm tra');
  const cfg = validateTestConfig({
    name: body.name !== undefined ? body.name : test.name,
    locale: body.locale !== undefined ? body.locale : test.locale,
    timeLimitMinutes: body.timeLimitMinutes !== undefined ? body.timeLimitMinutes : test.timeLimitMinutes,
    questionCount: body.questionCount !== undefined ? body.questionCount : test.questionCount,
    passingScore: body.passingScore !== undefined ? body.passingScore : test.passingScore,
    allowRetake: body.allowRetake !== undefined ? body.allowRetake : test.allowRetake,
    maxAttempts: body.maxAttempts !== undefined ? body.maxAttempts : test.maxAttempts,
    sortOrder: body.sortOrder !== undefined ? body.sortOrder : test.sortOrder,
    isActive: body.isActive !== undefined ? body.isActive : test.isActive,
  });
  Object.assign(test, cfg);
  await test.save();
  return test.toObject();
}

async function deleteTest(id) {
  const testId = requireOid(id, 'testId');
  const test = await CertPrepTest.findById(testId);
  if (!test) throw new CertPrepError(404, 'Không tìm thấy bài kiểm tra');
  test.isActive = false;
  await test.save();
  return { id: String(test._id), isActive: false, softDeleted: true };
}

function normalizeQuestionPayload(body, test) {
  const payload = {
    testId: test._id,
    locale: body.locale != null ? body.locale : test.locale,
    type: body.type,
    questionText: body.questionText,
    questionImage: body.questionImage || '',
    options: body.options,
    correctAnswer: body.correctAnswer,
    correctIndices: body.correctIndices,
    minSelect: body.minSelect,
    matchingItems: body.matchingItems,
    matchingTargets: body.matchingTargets,
    matchingPairs: body.matchingPairs,
    statements: Array.isArray(body.statements)
      ? body.statements.map((s, i) => ({
        id: String(s?.id || `s${i + 1}`).trim(),
        text: String(s?.text || '').trim(),
        correct: Boolean(s?.correct),
      }))
      : [],
    hint: body.hint || '',
    hintImage: body.hintImage || '',
    explanation: body.explanation || '',
    explanationImage: body.explanationImage || '',
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    isActive: body.isActive !== false,
  };
  if (payload.locale !== test.locale) {
    throw new CertPrepError(400, 'Ngôn ngữ câu hỏi phải trùng ngôn ngữ bài kiểm tra');
  }
  const result = validateQuestion(payload);
  if (!result.ok) throw new CertPrepError(400, result.message);
  return payload;
}

async function listQuestions(testId, query = {}) {
  const id = requireOid(testId, 'testId');
  const test = await CertPrepTest.findById(id).lean();
  if (!test) throw new CertPrepError(404, 'Không tìm thấy bài kiểm tra');
  const filter = { testId: id };
  if (query.locale && LOCALES.includes(query.locale)) filter.locale = query.locale;
  if (query.type) filter.type = query.type;
  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;
  if (query.q) {
    const q = String(query.q).trim();
    if (q) filter.questionText = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  return CertPrepQuestion.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

async function createQuestion(testId, body) {
  const id = requireOid(testId, 'testId');
  const test = await CertPrepTest.findById(id).lean();
  if (!test) throw new CertPrepError(404, 'Không tìm thấy bài kiểm tra');
  const activeBefore = await countActiveQuestions(test);
  const payload = normalizeQuestionPayload(body, test);
  const doc = await CertPrepQuestion.create(payload);
  await maybeGrowQuestionCount(id, activeBefore);
  return doc.toObject();
}

async function updateQuestion(id, body) {
  const questionId = requireOid(id, 'questionId');
  const question = await CertPrepQuestion.findById(questionId);
  if (!question) throw new CertPrepError(404, 'Không tìm thấy câu hỏi');
  const test = await CertPrepTest.findById(question.testId).lean();
  if (!test) throw new CertPrepError(404, 'Không tìm thấy bài kiểm tra');
  const merged = {
    type: body.type !== undefined ? body.type : question.type,
    locale: body.locale !== undefined ? body.locale : question.locale,
    questionText: body.questionText !== undefined ? body.questionText : question.questionText,
    questionImage: body.questionImage !== undefined ? body.questionImage : question.questionImage,
    options: body.options !== undefined ? body.options : question.options,
    correctAnswer: body.correctAnswer !== undefined ? body.correctAnswer : question.correctAnswer,
    correctIndices: body.correctIndices !== undefined ? body.correctIndices : question.correctIndices,
    minSelect: body.minSelect !== undefined ? body.minSelect : question.minSelect,
    matchingItems: body.matchingItems !== undefined ? body.matchingItems : question.matchingItems,
    matchingTargets: body.matchingTargets !== undefined ? body.matchingTargets : question.matchingTargets,
    matchingPairs: body.matchingPairs !== undefined ? body.matchingPairs : question.matchingPairs,
    statements: body.statements !== undefined ? body.statements : question.statements,
    hint: body.hint !== undefined ? body.hint : question.hint,
    hintImage: body.hintImage !== undefined ? body.hintImage : question.hintImage,
    explanation: body.explanation !== undefined ? body.explanation : question.explanation,
    explanationImage: body.explanationImage !== undefined ? body.explanationImage : question.explanationImage,
    sortOrder: body.sortOrder !== undefined ? body.sortOrder : question.sortOrder,
    isActive: body.isActive !== undefined ? body.isActive : question.isActive,
  };
  const payload = normalizeQuestionPayload(merged, test);
  Object.assign(question, payload);
  await question.save();
  return question.toObject();
}

async function deleteQuestion(id, { permanent = false } = {}) {
  const questionId = requireOid(id, 'questionId');
  const question = await CertPrepQuestion.findById(questionId);
  if (!question) throw new CertPrepError(404, 'Không tìm thấy câu hỏi');
  if (permanent) {
    await CertPrepQuestion.deleteOne({ _id: questionId });
    return { id: String(questionId), hardDeleted: true };
  }
  question.isActive = false;
  await question.save();
  return { id: String(question._id), isActive: false, softDeleted: true };
}

async function deleteQuestionsByTest(testId, { permanent = true } = {}) {
  const id = requireOid(testId, 'testId');
  const test = await CertPrepTest.findById(id).lean();
  if (!test) throw new CertPrepError(404, 'Không tìm thấy bài kiểm tra');
  if (permanent) {
    const result = await CertPrepQuestion.deleteMany({ testId: id });
    return { deleted: result.deletedCount || 0, hardDeleted: true };
  }
  const result = await CertPrepQuestion.updateMany(
    { testId: id, isActive: { $ne: false } },
    { $set: { isActive: false } },
  );
  return { deleted: result.modifiedCount || 0, softDeleted: true };
}

async function reorderQuestions(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CertPrepError(400, 'Danh sách thứ tự không hợp lệ');
  }
  const ops = items.map((item, idx) => {
    const id = requireOid(item.id || item._id, 'questionId');
    const sortOrder = Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : idx;
    return {
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder } },
      },
    };
  });
  await CertPrepQuestion.bulkWrite(ops);
  return { updated: ops.length };
}

async function listAccess(query = {}) {
  const filter = {};
  if (query.studentId) filter.studentId = requireOid(query.studentId, 'studentId');
  if (query.courseId) filter.courseId = requireOid(query.courseId, 'courseId');
  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;
  return StudentCertPrepAccess.find(filter)
    .populate('studentId', 'name phone studentCode')
    .populate('courseId', 'name slug')
    .sort({ grantedAt: -1 })
    .lean();
}

async function searchStudents(q) {
  const text = String(q || '').trim();
  if (text.length < 2) return [];
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');
  return Student.find({
    $or: [{ name: rx }, { phone: rx }, { studentCode: rx }],
  })
    .select('name phone studentCode')
    .limit(20)
    .lean();
}

async function grantAccess(body, grantedBy) {
  const studentId = requireOid(body.studentId, 'studentId');
  const courseId = requireOid(body.courseId, 'courseId');
  const student = await Student.findById(studentId).select('_id').lean();
  if (!student) throw new CertPrepError(404, 'Không tìm thấy học viên');
  const course = await CertPrepCourse.findById(courseId).select('_id').lean();
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');
  let expiresAt = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) throw new CertPrepError(400, 'Ngày hết hạn không hợp lệ');
    expiresAt = d;
  }
  const doc = await StudentCertPrepAccess.findOneAndUpdate(
    { studentId, courseId },
    {
      $set: {
        isActive: true,
        expiresAt,
        grantedBy: String(grantedBy || ''),
        grantedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return doc.toObject();
}

async function revokeAccess(id) {
  const accessId = requireOid(id, 'accessId');
  const access = await StudentCertPrepAccess.findById(accessId);
  if (!access) throw new CertPrepError(404, 'Không tìm thấy quyền truy cập');
  access.isActive = false;
  await access.save();
  return { id: String(access._id), isActive: false };
}

async function getMyCatalog(studentId) {
  const sid = requireOid(studentId, 'studentId');
  const now = new Date();
  const accesses = await StudentCertPrepAccess.find({ studentId: sid, isActive: true }).lean();
  const valid = accesses.filter((a) => isAccessCurrentlyValid(a, now));
  const courseIds = valid.map((a) => a.courseId);
  if (!courseIds.length) return [];
  const courses = await CertPrepCourse.find({
    _id: { $in: courseIds },
    isActive: true,
  }).sort({ sortOrder: 1, name: 1 }).lean();
  const levels = await CertPrepLevel.find({
    courseId: { $in: courses.map((c) => c._id) },
    isActive: true,
  }).sort({ sortOrder: 1, title: 1 }).lean();
  const accessByCourse = Object.fromEntries(valid.map((a) => [String(a.courseId), a]));
  return courses.map((course) => {
    const access = accessByCourse[String(course._id)];
    return {
      id: String(course._id),
      name: course.name,
      slug: course.slug,
      logoUrl: course.logoUrl || '',
      description: course.description || '',
      expiresAt: access?.expiresAt || null,
      levels: levels
        .filter((l) => String(l.courseId) === String(course._id))
        .map((l) => ({
          id: String(l._id),
          title: l.title,
          subtitle: l.subtitle || '',
          logoUrl: l.logoUrl || '',
          sortOrder: l.sortOrder,
        })),
    };
  });
}

async function listTestsForStudent(studentId, levelId) {
  const sid = requireOid(studentId, 'studentId');
  const lid = requireOid(levelId, 'levelId');
  const level = await CertPrepLevel.findById(lid).lean();
  if (!level || !level.isActive) throw new CertPrepError(404, 'Không tìm thấy level');
  const course = await CertPrepCourse.findById(level.courseId).lean();
  if (!course || !course.isActive) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');
  const access = await findValidAccess(sid, course._id);
  if (!access) throw new CertPrepError(403, 'Bạn chưa được cấp quyền khóa ôn thi này');
  const tests = await CertPrepTest.find({
    levelId: lid,
    isActive: true,
  }).sort({ locale: 1, sortOrder: 1 }).lean();
  const testIds = tests.map((t) => t._id);
  let submittedByTest = {};
  if (testIds.length) {
    const submitted = await CertPrepSession.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(sid), testId: { $in: testIds }, status: 'submitted' } },
      { $group: { _id: '$testId', n: { $sum: 1 } } },
    ]);
    submittedByTest = Object.fromEntries(submitted.map((row) => [String(row._id), row.n]));
  }
  return {
    course: {
      id: String(course._id),
      name: course.name,
      description: course.description || '',
    },
    level: {
      id: String(level._id),
      title: level.title,
      subtitle: level.subtitle || '',
    },
    expiresAt: access.expiresAt || null,
    tests: tests.map((t) => ({
      id: String(t._id),
      name: t.name,
      locale: t.locale,
      timeLimitMinutes: t.timeLimitMinutes,
      questionCount: t.questionCount,
      passingScore: t.passingScore,
      allowRetake: t.allowRetake,
      maxAttempts: t.maxAttempts,
      submittedCount: submittedByTest[String(t._id)] || 0,
    })),
  };
}

async function countActiveQuestions(test) {
  return CertPrepQuestion.countDocuments({
    testId: test._id,
    locale: test.locale,
    isActive: true,
  });
}

/** Số câu lấy vào phiên: min(cấu hình, ngân hàng thực tế). */
function resolveDrawCount(test, availableCount) {
  const available = Math.max(0, Number(availableCount) || 0);
  if (available <= 0) return 0;
  const want = Number(test.questionCount);
  if (!Number.isInteger(want) || want <= 0) return available;
  return Math.min(want, available);
}

function normalizeQuestionText(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Key trùng nội dung: cùng loại + cùng đề bài (trong 1 test). */
function questionDedupeKey(q) {
  const type = String(q?.type || '').trim();
  const text = normalizeQuestionText(q?.questionText);
  return `${type}::${text}`;
}

function dedupeQuestionsByContent(questions) {
  const seen = new Set();
  const out = [];
  for (const q of questions || []) {
    const key = questionDedupeKey(q);
    if (!key || key === '::') {
      out.push(q);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

async function selectQuestionIds(test) {
  const questions = await CertPrepQuestion.find({
    testId: test._id,
    locale: test.locale,
    isActive: true,
  }).sort({ sortOrder: 1, createdAt: 1 }).select('_id type questionText').lean();
  const unique = dedupeQuestionsByContent(questions);
  if (!unique.length) {
    throw new CertPrepError(400, 'Bài kiểm tra chưa có câu hỏi.');
  }
  const take = resolveDrawCount(test, unique.length);
  return unique.slice(0, take).map((q) => q._id);
}

/** Phiên đang làm: bổ sung câu mới nếu admin thêm câu / tăng số câu lấy. */
async function expandSessionQuestionsIfNeeded(session, test) {
  if (!session || session.status !== 'in_progress' || !test) return session;
  const availableRaw = await CertPrepQuestion.find({
    testId: test._id,
    locale: test.locale,
    isActive: true,
  }).sort({ sortOrder: 1, createdAt: 1 }).select('_id type questionText').lean();
  const available = dedupeQuestionsByContent(availableRaw);
  if (!available.length) return session;

  const current = [...new Set((session.questionIds || []).map((id) => String(id)))];
  // Tránh nhân đôi nếu session đã lưu trùng id
  if (current.length !== (session.questionIds || []).length) {
    session.questionIds = current;
    session.markModified('questionIds');
  }

  let want = Number(test.questionCount) || 0;
  // Đề đang lấy đúng số câu cấu hình, admin vừa thêm vài câu → tự bắt kịp ngân hàng
  if (
    available.length > want
    && current.length === want
    && (available.length - want) <= 10
  ) {
    want = available.length;
    await CertPrepTest.updateOne({ _id: test._id }, { $set: { questionCount: want } });
  }

  const take = Math.min(want > 0 ? want : available.length, available.length);
  if (current.length >= take) {
    if (session.isModified?.('questionIds')) await session.save();
    return session;
  }

  const haveIds = new Set(current);
  const currentDocs = availableRaw.filter((q) => haveIds.has(String(q._id)));
  const haveContent = new Set(currentDocs.map(questionDedupeKey).filter((k) => k && k !== '::'));

  const extras = available.filter((q) => {
    if (haveIds.has(String(q._id))) return false;
    const key = questionDedupeKey(q);
    if (key && key !== '::' && haveContent.has(key)) return false;
    return true;
  }).slice(0, take - current.length);

  if (!extras.length) {
    if (session.isModified?.('questionIds')) await session.save();
    return session;
  }
  session.questionIds = [...current, ...extras.map((q) => q._id)];
  const snap = session.configSnapshot?.toObject
    ? session.configSnapshot.toObject()
    : { ...(session.configSnapshot || {}) };
  session.set('configSnapshot', {
    ...snap,
    questionCount: session.questionIds.length,
  });
  session.markModified('questionIds');
  await session.save();
  return session;
}

/** Khi ngân hàng = đúng số câu đang cấu hình, thêm câu → tự tăng số câu lấy. */
async function maybeGrowQuestionCount(testId, activeBefore) {
  const test = await CertPrepTest.findById(testId);
  if (!test) return;
  const activeAfter = await countActiveQuestions(test);
  if (activeAfter <= 0) return;
  const configured = Number(test.questionCount) || 0;
  if (configured === activeBefore || configured < activeAfter && configured <= 1) {
    test.questionCount = activeAfter;
    await test.save();
  }
}

async function startSession(studentId, body) {
  const sid = requireOid(studentId, 'studentId');
  const testId = requireOid(body.testId, 'testId');
  const { test, level, course } = await assertStudentCanAccessTest(sid, testId);
  if (body.locale && body.locale !== test.locale) {
    throw new CertPrepError(400, 'Ngôn ngữ không khớp bài kiểm tra');
  }

  const existing = await CertPrepSession.findOne({
    studentId: sid,
    testId: test._id,
    status: 'in_progress',
  });
  const feedbackMode = body.feedbackMode === 'after_submit' ? 'after_submit' : 'immediate';
  if (existing) {
    if (!isSessionExpired(existing, existing.configSnapshot?.timeLimitMinutes || test.timeLimitMinutes)) {
      const snap = existing.configSnapshot?.toObject
        ? existing.configSnapshot.toObject()
        : { ...(existing.configSnapshot || {}) };
      existing.set('configSnapshot', { ...snap, feedbackMode });
      await existing.save();
      await expandSessionQuestionsIfNeeded(existing, test);
      return toStudentSession(existing, []);
    }
    await finalizeSession(existing, { auto: true });
  }

  const submittedCount = await CertPrepSession.countDocuments({
    studentId: sid,
    testId: test._id,
    status: 'submitted',
  });
  assertRetakeAllowed(test, submittedCount);

  const questionIds = await selectQuestionIds(test);
  const session = await CertPrepSession.create({
    studentId: sid,
    testId: test._id,
    locale: test.locale,
    status: 'in_progress',
    questionIds,
    answers: [],
    startedAt: new Date(),
    configSnapshot: {
      timeLimitMinutes: test.timeLimitMinutes,
      questionCount: test.questionCount,
      passingScore: test.passingScore,
      allowRetake: test.allowRetake,
      maxAttempts: test.maxAttempts,
      name: test.name,
      courseId: String(course._id),
      courseName: course.name || '',
      levelId: String(level._id),
      levelTitle: level.title || '',
      feedbackMode,
    },
  });
  return toStudentSession(session, []);
}

function mergeAnswers(session, incoming) {
  const allowed = new Set((session.questionIds || []).map((id) => String(id)));
  const map = new Map((session.answers || []).map((a) => [String(a.questionId), a]));
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const qid = String(item.questionId || item.id || '');
    if (!allowed.has(qid)) continue;
    map.set(qid, {
      questionId: qid,
      value: item.value,
      answeredAt: new Date(),
    });
  }
  return [...map.values()];
}

async function loadSessionQuestions(session) {
  const ids = [...new Set((session.questionIds || []).map((id) => String(id)))];
  const docs = await CertPrepQuestion.find({ _id: { $in: ids } }).lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
  return dedupeQuestionsByContent(ordered);
}

async function scoreAndClose(session, questions, now = new Date()) {
  const answersByQ = new Map((session.answers || []).map((a) => [String(a.questionId), a.value]));
  const snapshot = (questions || []).map((q) => freezeQuestion(q));
  let correct = 0;
  let answered = 0;
  for (const q of questions) {
    const value = answersByQ.get(String(q._id || q.id));
    if (isStudentAnswered(q.type, value)) answered += 1;
    if (gradeQuestion(q, value)) correct += 1;
  }
  const total = snapshot.length;
  const passingScore = session.configSnapshot?.passingScore ?? 700;
  const score = computeScore(correct, total);
  const limitMin = session.configSnapshot?.timeLimitMinutes || 50;
  const spent = Math.min(elapsedSeconds(session, now), limitMin * 60);
  session.status = 'submitted';
  session.submittedAt = now;
  session.score = score;
  session.passed = isPassed(score, passingScore);
  session.correctCount = correct;
  session.answeredCount = answered;
  session.timeSpentSeconds = spent;
  session.questionSnapshot = snapshot;
  await session.save();
  return session;
}

async function finalizeSession(sessionDoc, { auto = false } = {}) {
  const session = sessionDoc;
  if (session.status === 'submitted') return serializeSession(session);
  const questions = await loadSessionQuestions(session);
  await scoreAndClose(session, questions);
  return serializeSession(session, { autoSubmitted: auto });
}

async function getSession(studentId, sessionId) {
  const sid = requireOid(studentId, 'studentId');
  const id = requireOid(sessionId, 'sessionId');
  const session = await CertPrepSession.findById(id);
  if (!session) throw new CertPrepError(404, 'Không tìm thấy phiên làm bài');
  assertSessionOwner(session, sid);
  try {
    const { test } = await loadTestChain(session.testId);
    await expandSessionQuestionsIfNeeded(session, test);
  } catch {
    /* keep session as-is if test chain missing */
  }
  const limit = session.configSnapshot?.timeLimitMinutes;
  let autoSubmitted = false;
  if (session.status === 'in_progress' && isSessionExpired(session, limit)) {
    await finalizeSession(session, { auto: true });
    autoSubmitted = true;
  }
  const questions = await loadSessionQuestions(session);
  return toStudentSession(session, questions, { autoSubmitted });
}

async function saveProgress(studentId, sessionId, body) {
  const sid = requireOid(studentId, 'studentId');
  const id = requireOid(sessionId, 'sessionId');
  const session = await CertPrepSession.findById(id);
  if (!session) throw new CertPrepError(404, 'Không tìm thấy phiên làm bài');
  assertSessionOwner(session, sid);
  if (session.status === 'submitted') {
    return toStudentSession(session, []);
  }
  if (session.status === 'abandoned') {
    throw new CertPrepError(409, 'Phiên làm bài đã bị hủy');
  }
  const limit = session.configSnapshot?.timeLimitMinutes;
  if (isSessionExpired(session, limit)) {
    await finalizeSession(session, { auto: true });
    return toStudentSession(session, [], { autoSubmitted: true });
  }
  session.answers = mergeAnswers(session, body?.answers);
  await session.save();
  // Client remainingSeconds is ignored; deadline is startedAt + timeLimitMinutes.
  return toStudentSession(session, []);
}

async function submitSession(studentId, sessionId) {
  const sid = requireOid(studentId, 'studentId');
  const id = requireOid(sessionId, 'sessionId');
  const session = await CertPrepSession.findById(id);
  if (!session) throw new CertPrepError(404, 'Không tìm thấy phiên làm bài');
  assertSessionOwner(session, sid);
  if (session.status === 'submitted') {
    return toStudentSession(session, []);
  }
  if (session.status === 'abandoned') {
    throw new CertPrepError(409, 'Phiên làm bài đã bị hủy');
  }
  const auto = isSessionExpired(session, session.configSnapshot?.timeLimitMinutes);
  await finalizeSession(session, { auto });
  return toStudentSession(session, [], { autoSubmitted: auto });
}

async function abandonSession(studentId, sessionId) {
  const sid = requireOid(studentId, 'studentId');
  const id = requireOid(sessionId, 'sessionId');
  const session = await CertPrepSession.findById(id);
  if (!session) throw new CertPrepError(404, 'Không tìm thấy phiên làm bài');
  assertSessionOwner(session, sid);
  if (session.status === 'submitted') {
    throw new CertPrepError(409, 'Không thể hủy phiên đã nộp');
  }
  session.status = 'abandoned';
  await session.save();
  return serializeSession(session);
}

function snapshotFromSession(session) {
  const rows = Array.isArray(session.questionSnapshot) ? session.questionSnapshot : [];
  return rows.map((q) => freezeQuestion(q));
}

async function ensureQuestionSnapshot(session) {
  if (Array.isArray(session.questionSnapshot) && session.questionSnapshot.length) {
    return snapshotFromSession(session);
  }
  const live = await loadSessionQuestions(session);
  const snapshot = live.map((q) => freezeQuestion(q));
  session.questionSnapshot = snapshot;
  if (session.correctCount == null || session.answeredCount == null) {
    const answersByQ = new Map((session.answers || []).map((a) => [String(a.questionId), a.value]));
    let correct = 0;
    let answered = 0;
    for (const q of snapshot) {
      const value = answersByQ.get(String(q.id));
      if (isStudentAnswered(q.type, value)) answered += 1;
      if (gradeQuestion(q, value)) correct += 1;
    }
    if (session.correctCount == null) session.correctCount = correct;
    if (session.answeredCount == null) session.answeredCount = answered;
  }
  await session.save();
  return snapshot;
}

async function getSessionResult(studentId, sessionId) {
  const sid = requireOid(studentId, 'studentId');
  const id = requireOid(sessionId, 'sessionId');
  const session = await CertPrepSession.findById(id);
  if (!session) throw new CertPrepError(404, 'Không tìm thấy phiên làm bài');
  assertSessionOwner(session, sid);
  if (session.status === 'in_progress') {
    throw new CertPrepError(409, 'Bạn chưa nộp bài.');
  }
  if (session.status === 'abandoned') {
    throw new CertPrepError(409, 'Phiên làm bài đã bị hủy');
  }
  if (session.status !== 'submitted') {
    throw new CertPrepError(409, 'Phiên làm bài chưa có kết quả');
  }
  const questions = await ensureQuestionSnapshot(session);
  return toStudentResult(session, questions);
}

async function listStudentAttempts(studentId, testId) {
  const sid = requireOid(studentId, 'studentId');
  const tid = requireOid(testId, 'testId');
  const rows = await CertPrepSession.find({
    studentId: sid,
    testId: tid,
    status: 'submitted',
  }).sort({ submittedAt: 1, startedAt: 1 }).lean();
  return rows.map((row, index) => ({
    sessionId: String(row._id),
    attempt: index + 1,
    status: row.status,
    score: row.score,
    passed: row.passed,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    durationSeconds: durationSecondsOf(row),
  }));
}

async function exportCourseQuestionsWorkbook(courseId) {
  const id = requireOid(courseId, 'courseId');
  const course = await CertPrepCourse.findById(id).lean();
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');

  const levels = await CertPrepLevel.find({ courseId: id }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const levelIds = levels.map((l) => l._id);
  const tests = levelIds.length
    ? await CertPrepTest.find({ levelId: { $in: levelIds } }).sort({ sortOrder: 1, createdAt: 1 }).lean()
    : [];
  const testIds = tests.map((t) => t._id);
  const questions = testIds.length
    ? await CertPrepQuestion.find({ testId: { $in: testIds } }).sort({ sortOrder: 1, createdAt: 1 }).lean()
    : [];

  const levelById = new Map(levels.map((l) => [String(l._id), l]));
  const testById = new Map(tests.map((t) => [String(t._id), t]));

  const {
    questionToRow,
    buildWorkbookBuffer,
  } = (() => {
    try {
      return require('./certPrepQuestionsExcel');
    } catch (err) {
      throw new CertPrepError(503, 'Thiếu thư viện Excel trên server (xlsx). Chạy npm install rồi restart.');
    }
  })();

  const rows = questions.map((q) => {
    const test = testById.get(String(q.testId));
    const level = test ? levelById.get(String(test.levelId)) : null;
    return questionToRow({
      levelTitle: level?.title || '',
      testName: test?.name || '',
      question: q,
    });
  });

  let buffer;
  try {
    buffer = buildWorkbookBuffer(rows);
  } catch (err) {
    throw new CertPrepError(500, err.message || 'Không tạo được file Excel');
  }
  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer);
  }
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const slug = String(course.slug || course.name || 'course').replace(/[^\w-]+/g, '-');
  return {
    buffer,
    filename: `certprep-${slug}-questions-${day}.xlsx`,
    questionCount: rows.length,
  };
}

async function resolveLevelForImport(courseId, levelTitle, cache) {
  const key = String(levelTitle || '').trim().toLowerCase();
  if (cache.levels.has(key)) return cache.levels.get(key);
  let level = await CertPrepLevel.findOne({
    courseId,
    title: new RegExp(`^${String(levelTitle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (!level) {
    level = await CertPrepLevel.create({
      courseId,
      title: String(levelTitle).trim(),
      subtitle: '',
      logoUrl: '',
      sortOrder: cache.levels.size,
      isActive: true,
    });
  }
  cache.levels.set(key, level);
  return level;
}

async function resolveTestForImport(levelId, testName, locale, cache) {
  const key = `${String(levelId)}::${String(testName).trim().toLowerCase()}::${locale}`;
  if (cache.tests.has(key)) return cache.tests.get(key);
  let test = await CertPrepTest.findOne({
    levelId,
    locale,
    name: new RegExp(`^${String(testName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (!test) {
    test = await CertPrepTest.create({
      levelId,
      name: String(testName).trim(),
      locale: locale === 'en' ? 'en' : 'vi',
      timeLimitMinutes: 50,
      questionCount: 45,
      passingScore: 700,
      allowRetake: true,
      maxAttempts: null,
      sortOrder: cache.tests.size,
      isActive: true,
    });
  }
  cache.tests.set(key, test);
  return test;
}

async function softDeleteCourseQuestions(courseId) {
  const levels = await CertPrepLevel.find({ courseId }).select('_id').lean();
  const levelIds = levels.map((l) => l._id);
  if (!levelIds.length) return 0;
  const tests = await CertPrepTest.find({ levelId: { $in: levelIds } }).select('_id').lean();
  const testIds = tests.map((t) => t._id);
  if (!testIds.length) return 0;
  const result = await CertPrepQuestion.updateMany(
    { testId: { $in: testIds }, isActive: { $ne: false } },
    { $set: { isActive: false } },
  );
  return result.modifiedCount || 0;
}

async function importCourseQuestionsFromWorkbook(courseId, buffer, { replace = false } = {}) {
  const id = requireOid(courseId, 'courseId');
  const course = await CertPrepCourse.findById(id).lean();
  if (!course) throw new CertPrepError(404, 'Không tìm thấy khóa ôn thi');

  const { parseWorkbookBuffer } = (() => {
    try {
      return require('./certPrepQuestionsExcel');
    } catch (err) {
      throw new CertPrepError(503, 'Thiếu thư viện Excel trên server (xlsx). Chạy npm install rồi restart.');
    }
  })();
  const { rows, errors } = parseWorkbookBuffer(buffer);

  let deactivated = 0;
  if (replace) {
    deactivated = await softDeleteCourseQuestions(id);
  }

  const cache = { levels: new Map(), tests: new Map(), contentKeys: new Map() };
  let created = 0;
  let skippedDup = 0;
  const importErrors = [...errors];

  for (const row of rows) {
    try {
      const level = await resolveLevelForImport(id, row.payload.levelTitle, cache);
      const test = await resolveTestForImport(
        level._id,
        row.payload.testName,
        row.payload.locale,
        cache,
      );
      const body = { ...row.payload };
      delete body.levelTitle;
      delete body.testName;
      // locale on question must match test
      body.locale = test.locale;

      const tid = String(test._id);
      if (!cache.contentKeys.has(tid)) {
        const existing = await CertPrepQuestion.find({
          testId: test._id,
          isActive: true,
        }).select('type questionText').lean();
        cache.contentKeys.set(
          tid,
          new Set(existing.map(questionDedupeKey).filter((k) => k && k !== '::')),
        );
      }
      const keySet = cache.contentKeys.get(tid);
      const key = questionDedupeKey(body);
      if (key && key !== '::' && keySet.has(key)) {
        skippedDup += 1;
        continue;
      }

      await createQuestion(test._id, body);
      if (key && key !== '::') keySet.add(key);
      created += 1;
    } catch (err) {
      importErrors.push({
        rowIndex: row.rowIndex,
        message: err.message || 'Không thể tạo câu hỏi',
      });
    }
  }

  return {
    created,
    skipped: importErrors.length + skippedDup,
    skippedDuplicates: skippedDup,
    deactivated,
    errors: importErrors.slice(0, 50),
    totalRows: rows.length + errors.length,
  };
}

module.exports = {
  CertPrepError,
  isOid,
  requireOid,
  SCORE_SCALE,
  computeScore,
  isPassed,
  gradeQuestion,
  isSessionExpired,
  elapsedSeconds,
  assertSessionOwner,
  isAccessCurrentlyValid,
  assertRetakeAllowed,
  stripAnswerKeys,
  sessionTiming,
  toStudentSession,
  freezeQuestion,
  toStudentResult,
  mergeAnswers,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  listLevels,
  createLevel,
  updateLevel,
  deleteLevel,
  listTestsAdmin,
  createTest,
  updateTest,
  deleteTest,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  deleteQuestionsByTest,
  reorderQuestions,
  exportCourseQuestionsWorkbook,
  importCourseQuestionsFromWorkbook,
  listAccess,
  searchStudents,
  grantAccess,
  revokeAccess,
  getMyCatalog,
  listTestsForStudent,
  assertStudentCanAccessTest,
  startSession,
  getSession,
  saveProgress,
  submitSession,
  abandonSession,
  getSessionResult,
  listStudentAttempts,
  countActiveQuestions,
  countSessionsForTest,
  countSessionsForLevel,
  countSessionsForCourse,
};
