'use strict';

const mongoose = require('mongoose');
const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticeQuestion = require('../models/DailyPracticeQuestion');
const DailyPracticeSession = require('../models/DailyPracticeSession');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');
const LessonSubject = require('../models/LessonSubject');
const LessonUnit = require('../models/LessonUnit');
const rules = require('./dailyPracticeRules');
const learningGoalService = require('./learningGoalService');
const lessonPracticeService = require('./lessonPracticeService');
const logger = require('../config/logger');

const { httpError } = rules;

function requireId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) throw httpError(400, `${label} không hợp lệ`);
  return new mongoose.Types.ObjectId(String(value));
}

function topicView(topic, counts = {}) {
  return {
    id: String(topic._id),
    name: topic.name,
    description: topic.description || '',
    icon: topic.icon || 'book',
    color: topic.color || 'red',
    sortOrder: topic.sortOrder || 0,
    active: topic.active !== false,
    lessonSubjectId: topic.lessonSubjectId ? String(topic.lessonSubjectId) : '',
    lessonUnitIds: (topic.lessonUnitIds || []).map(String),
    counts: { easy: counts.easy || 0, medium: counts.medium || 0, hard: counts.hard || 0, draft: counts.draft || 0 },
  };
}

function questionAdminView(q) {
  return {
    id: String(q._id),
    topicId: String(q.topicId),
    difficulty: q.difficulty,
    type: q.type,
    status: q.status,
    source: q.source,
    prompt: q.prompt,
    imageUrl: q.imageUrl || '',
    explanation: q.explanation || '',
    hint: q.hint || '',
    options: q.options,
    correctIndex: q.correctIndex,
    answerBool: q.answerBool,
    items: q.items,
    pairs: q.pairs,
    text: q.text,
    distractors: q.distractors,
    groups: q.groups,
    updatedAt: q.updatedAt,
  };
}

async function questionCounts(topicIds) {
  const rows = await DailyPracticeQuestion.aggregate([
    { $match: { topicId: { $in: topicIds } } },
    { $group: { _id: { topicId: '$topicId', difficulty: '$difficulty', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byTopic = new Map();
  for (const row of rows) {
    const key = String(row._id.topicId);
    const counts = byTopic.get(key) || {};
    if (row._id.status === 'published') counts[row._id.difficulty] = (counts[row._id.difficulty] || 0) + row.n;
    else counts.draft = (counts.draft || 0) + row.n;
    byTopic.set(key, counts);
  }
  return byTopic;
}

// ── Admin: chủ đề ───────────────────────────────────────────────────────────
async function listTopics({ includeInactive = false } = {}) {
  const topics = await DailyPracticeTopic.find(includeInactive ? {} : { active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const counts = await questionCounts(topics.map((topic) => topic._id));
  return topics.map((topic) => topicView(topic, counts.get(String(topic._id))));
}

function topicInput(body = {}) {
  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) throw httpError(400, 'Tên chủ đề không được để trống');
  return {
    name,
    description: String(body.description || '').trim().slice(0, 240),
    icon: rules.TOPIC_ICONS.includes(body.icon) ? body.icon : 'book',
    color: rules.TOPIC_COLORS.includes(body.color) ? body.color : 'red',
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    active: body.active !== false,
  };
}

/** Môn + buổi video khớp với chủ đề; chỉ nhận buổi thuộc đúng môn đã chọn. */
async function lessonLinkInput(body = {}) {
  if (!Object.prototype.hasOwnProperty.call(body, 'lessonSubjectId')) return {};
  const raw = String(body.lessonSubjectId || '').trim();
  if (!raw) return { lessonSubjectId: null, lessonUnitIds: [] };
  const subjectId = requireId(raw, 'Môn video');
  if (!(await LessonSubject.exists({ _id: subjectId }))) throw httpError(400, 'Không tìm thấy môn video');
  const wanted = (Array.isArray(body.lessonUnitIds) ? body.lessonUnitIds : [])
    .map(String)
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .slice(0, 50);
  const units = wanted.length
    ? await LessonUnit.find({ _id: { $in: wanted }, subjectId }).select('_id').lean()
    : [];
  return { lessonSubjectId: subjectId, lessonUnitIds: units.map((unit) => unit._id) };
}

async function createTopic(body) {
  const topic = await DailyPracticeTopic.create({ ...topicInput(body), ...(await lessonLinkInput(body)) });
  return topicView(topic.toObject());
}

async function updateTopic(id, body) {
  const update = { ...topicInput(body), ...(await lessonLinkInput(body)) };
  const topic = await DailyPracticeTopic.findByIdAndUpdate(requireId(id, 'Chủ đề'), { $set: update }, { new: true }).lean();
  if (!topic) throw httpError(404, 'Không tìm thấy chủ đề');
  const counts = await questionCounts([topic._id]);
  return topicView(topic, counts.get(String(topic._id)));
}

async function deleteTopic(id) {
  const topicId = requireId(id, 'Chủ đề');
  const topic = await DailyPracticeTopic.findByIdAndDelete(topicId);
  if (!topic) throw httpError(404, 'Không tìm thấy chủ đề');
  const { deletedCount } = await DailyPracticeQuestion.deleteMany({ topicId });
  return { deletedQuestions: deletedCount || 0 };
}

// ── Admin: câu hỏi ──────────────────────────────────────────────────────────
async function listQuestions({ topicId, difficulty, type, status } = {}) {
  const filter = { topicId: requireId(topicId, 'Chủ đề') };
  if (rules.DIFFICULTIES.includes(difficulty)) filter.difficulty = difficulty;
  if (rules.TYPES.includes(type)) filter.type = type;
  if (status === 'draft' || status === 'published') filter.status = status;
  const questions = await DailyPracticeQuestion.find(filter).sort({ status: 1, updatedAt: -1 }).limit(500).lean();
  return questions.map(questionAdminView);
}

async function createQuestion(body, userId) {
  const topicId = requireId(body?.topicId, 'Chủ đề');
  if (!await DailyPracticeTopic.exists({ _id: topicId })) throw httpError(404, 'Không tìm thấy chủ đề');
  const doc = rules.validateQuestion(body);
  const question = await DailyPracticeQuestion.create({
    ...doc,
    topicId,
    status: body?.status === 'draft' ? 'draft' : 'published',
    source: 'manual',
    createdBy: mongoose.Types.ObjectId.isValid(String(userId || '')) ? userId : null,
  });
  return questionAdminView(question.toObject());
}

async function updateQuestion(id, body) {
  const questionId = requireId(id, 'Câu hỏi');
  const existing = await DailyPracticeQuestion.findById(questionId).lean();
  if (!existing) throw httpError(404, 'Không tìm thấy câu hỏi');
  const onlyStatus = body && Object.keys(body).length === 1 && 'status' in body;
  const set = onlyStatus ? {} : rules.validateQuestion({ ...existing, ...body });
  if (body?.status === 'draft' || body?.status === 'published') set.status = body.status;
  if (!onlyStatus && body?.topicId) {
    const topicId = requireId(body.topicId, 'Chủ đề');
    if (!await DailyPracticeTopic.exists({ _id: topicId })) throw httpError(404, 'Không tìm thấy chủ đề');
    set.topicId = topicId;
  }
  const unset = {};
  for (const [key, value] of Object.entries(set)) {
    if (value === undefined) {
      unset[key] = 1;
      delete set[key];
    }
  }
  const question = await DailyPracticeQuestion.findByIdAndUpdate(
    questionId,
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true },
  ).lean();
  return questionAdminView(question);
}

async function deleteQuestion(id) {
  const result = await DailyPracticeQuestion.deleteOne({ _id: requireId(id, 'Câu hỏi') });
  if (!result.deletedCount) throw httpError(404, 'Không tìm thấy câu hỏi');
  return { deleted: true };
}

async function publishDrafts(topicId) {
  const { modifiedCount } = await DailyPracticeQuestion.updateMany(
    { topicId: requireId(topicId, 'Chủ đề'), status: 'draft' },
    { $set: { status: 'published' } },
  );
  return { published: modifiedCount || 0 };
}

// ── Học viên ────────────────────────────────────────────────────────────────
async function getProfile(studentId) {
  return DailyPracticeProfile.findOne({ studentId }).lean();
}

function profileView(profile, today) {
  const status = rules.streakStatus(profile, today);
  return {
    xpTotal: profile?.xpTotal || 0,
    streak: rules.liveStreak(profile, today),
    bestStreak: profile?.bestStreak || 0,
    playedToday: profile?.lastPlayedDay === today,
    sessionsCount: profile?.sessionsCount || 0,
    streakState: status.state,
    lostStreak: status.lostStreak,
    missedDays: status.missedDays,
  };
}

/** Số học viên đã hoàn thành ít nhất một lượt hôm nay (tạo động lực thi đua). */
async function countTodayPlayers(today) {
  const [row] = await DailyPracticeSession.aggregate([
    { $match: { status: 'finished', day: today } },
    { $group: { _id: '$studentId' } },
    { $count: 'n' },
  ]);
  return row?.n || 0;
}

async function getOverview(studentId) {
  const sid = requireId(studentId, 'Học viên');
  const today = learningGoalService.vnDayKey();
  const [topics, profile, todaySessions, todayPlayers] = await Promise.all([
    listTopics(),
    getProfile(sid),
    DailyPracticeSession.find({ studentId: sid, status: 'finished', day: today }).select('xp bonusXp').lean(),
    countTodayPlayers(today),
  ]);
  return {
    topics: topics
      .map(({ counts, ...topic }) => ({ ...topic, counts: { easy: counts.easy, medium: counts.medium, hard: counts.hard } }))
      .filter((topic) => topic.counts.easy + topic.counts.medium + topic.counts.hard > 0),
    stats: {
      ...profileView(profile, today),
      todaySessions: todaySessions.length,
      todayXp: todaySessions.reduce((sum, s) => sum + (s.xp || 0) + (s.bonusXp || 0), 0),
      todayPlayers,
    },
  };
}

async function pickQuestions(topicId, difficulty) {
  const base = { topicId, status: 'published' };
  const picked = await DailyPracticeQuestion.aggregate([
    { $match: { ...base, difficulty } },
    { $sample: { size: rules.SESSION_SIZE } },
  ]);
  if (picked.length < rules.SESSION_SIZE) {
    const more = await DailyPracticeQuestion.aggregate([
      { $match: { ...base, difficulty: { $ne: difficulty } } },
      { $sample: { size: rules.SESSION_SIZE - picked.length } },
    ]);
    picked.push(...more);
  }
  return picked;
}

async function startSession(studentId, { topicId, difficulty } = {}) {
  const sid = requireId(studentId, 'Học viên');
  const tid = requireId(topicId, 'Chủ đề');
  if (!rules.DIFFICULTIES.includes(difficulty)) throw httpError(400, 'Độ khó không hợp lệ');
  const topic = await DailyPracticeTopic.findOne({ _id: tid, active: true }).lean();
  if (!topic) throw httpError(404, 'Chủ đề không còn hoạt động');
  const questions = await pickQuestions(tid, difficulty);
  if (!questions.length) throw httpError(404, 'Chủ đề này chưa có câu hỏi');
  const session = await DailyPracticeSession.create({
    studentId: sid,
    topicId: tid,
    difficulty,
    questionIds: questions.map((q) => q._id),
  });
  return {
    id: String(session._id),
    topic: topicView(topic),
    difficulty,
    total: questions.length,
    questions: questions.map((q) => rules.publicQuestion(q)),
  };
}

async function loadOwnSession(studentId, sessionId) {
  const sid = requireId(studentId, 'Học viên');
  const session = await DailyPracticeSession.findById(requireId(sessionId, 'Lượt chơi')).lean();
  if (!session || String(session.studentId) !== String(sid)) throw httpError(404, 'Không tìm thấy lượt chơi');
  return session;
}

async function loadSessionQuestion(session, questionId) {
  const qid = requireId(questionId, 'Câu hỏi');
  if (!session.questionIds.some((id) => String(id) === String(qid))) throw httpError(400, 'Câu hỏi không thuộc lượt chơi này');
  const question = await DailyPracticeQuestion.findById(qid).lean();
  if (!question) throw httpError(404, 'Câu hỏi đã bị xóa');
  return question;
}

async function answerQuestion(studentId, sessionId, { questionId, answer } = {}) {
  const session = await loadOwnSession(studentId, sessionId);
  if (session.status !== 'in_progress') throw httpError(409, 'Lượt chơi đã kết thúc');
  const question = await loadSessionQuestion(session, questionId);
  const correct = rules.gradeAnswer(question, answer || {});
  const hintUsed = (session.hintsUsed || []).some((id) => String(id) === String(question._id));
  const xp = rules.xpFor(question.difficulty, { correct, hintUsed });
  const updated = await DailyPracticeSession.findOneAndUpdate(
    { _id: session._id, status: 'in_progress', 'answers.questionId': { $ne: question._id } },
    {
      $push: { answers: { questionId: question._id, correct, hintUsed, xp, answeredAt: new Date() } },
      $inc: { xp, correctCount: correct ? 1 : 0 },
    },
    { new: true },
  ).lean();
  if (!updated) throw httpError(409, 'Câu này đã được trả lời');
  learningGoalService.trackStudyActivity(session.studentId, { questions: 1 });
  return {
    correct,
    xp,
    sessionXp: updated.xp,
    correctCount: updated.correctCount,
    answered: updated.answers.length,
    correctAnswer: rules.correctAnswerView(question),
    explanation: question.explanation || '',
  };
}

async function useHint(studentId, sessionId, { questionId } = {}) {
  const session = await loadOwnSession(studentId, sessionId);
  if (session.status !== 'in_progress') throw httpError(409, 'Lượt chơi đã kết thúc');
  const question = await loadSessionQuestion(session, questionId);
  if ((session.answers || []).some((a) => String(a.questionId) === String(question._id))) {
    throw httpError(409, 'Câu này đã được trả lời');
  }
  await DailyPracticeSession.updateOne({ _id: session._id }, { $addToSet: { hintsUsed: question._id } });
  return rules.hintReveal(question);
}

async function finishSession(studentId, sessionId) {
  const session = await loadOwnSession(studentId, sessionId);
  if (session.status !== 'in_progress') throw httpError(409, 'Lượt chơi đã kết thúc');
  const total = session.questionIds.length;
  const correct = session.correctCount || 0;
  const stars = rules.starsFor(correct, total);
  const bonusXp = rules.bonusFor(correct, total);
  const day = learningGoalService.vnDayKey();
  const finished = await DailyPracticeSession.findOneAndUpdate(
    { _id: session._id, status: 'in_progress' },
    { $set: { status: 'finished', stars, bonusXp, day, finishedAt: new Date() } },
    { new: true },
  ).lean();
  if (!finished) throw httpError(409, 'Lượt chơi đã kết thúc');

  const before = await getProfile(session.studentId);
  const streak = rules.nextStreak(before, day);
  const gained = (finished.xp || 0) + bonusXp;
  const profile = await DailyPracticeProfile.findOneAndUpdate(
    { studentId: session.studentId },
    {
      $inc: { xpTotal: gained, sessionsCount: 1 },
      $set: { streak, lastPlayedDay: day },
      $max: { bestStreak: streak },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  const answered = new Map((finished.answers || []).map((a) => [String(a.questionId), a]));
  const missedIds = finished.questionIds.filter((id) => !answered.get(String(id))?.correct);
  const missed = await DailyPracticeQuestion.find({ _id: { $in: missedIds } }).lean();
  const relatedLesson = await relatedLessonForTopic(session.studentId, session.topicId);
  return {
    relatedLesson,
    total,
    correctCount: correct,
    stars,
    xp: finished.xp || 0,
    bonusXp,
    gainedXp: gained,
    streakIncreased: streak > rules.liveStreak(before, day),
    stats: profileView(profile, day),
    review: missed.map((q) => ({
      id: String(q._id),
      type: q.type,
      prompt: q.prompt,
      answered: answered.has(String(q._id)),
      correctAnswer: rules.correctAnswerView(q),
      explanation: q.explanation || '',
    })),
  };
}

async function relatedLessonForTopic(studentId, topicId) {
  try {
    const topic = await DailyPracticeTopic.findById(topicId).select('lessonSubjectId lessonUnitIds').lean();
    if (!topic?.lessonSubjectId) return null;
    return await lessonPracticeService.relatedLessonForStudent(studentId, {
      subjectId: topic.lessonSubjectId,
      unitIds: topic.lessonUnitIds || [],
    });
  } catch (err) {
    logger.warn(`[DAILY_PRACTICE] related lesson lookup failed: ${err.message}`);
    return null;
  }
}

/** Chủ đề luyện tập gắn với một môn/buổi video (để gợi ý ngay trong bài học). */
async function relatedTopics({ subjectId, unitId } = {}) {
  const sid = requireId(subjectId, 'Môn video');
  const or = [{ lessonSubjectId: sid, lessonUnitIds: { $size: 0 } }];
  if (mongoose.Types.ObjectId.isValid(String(unitId || ''))) {
    or.push({ lessonSubjectId: sid, lessonUnitIds: new mongoose.Types.ObjectId(String(unitId)) });
  }
  const topics = await DailyPracticeTopic.find({ active: true, $or: or }).sort({ sortOrder: 1, createdAt: 1 }).limit(6).lean();
  const counts = await questionCounts(topics.map((topic) => topic._id));
  return topics
    .map((topic) => topicView(topic, counts.get(String(topic._id))))
    .filter((topic) => topic.counts.easy + topic.counts.medium + topic.counts.hard > 0)
    .map(({ counts, lessonUnitIds: _units, ...topic }) => ({
      ...topic,
      counts: { easy: counts.easy, medium: counts.medium, hard: counts.hard },
    }));
}

/** XP luyện tập theo học viên trong khoảng thời gian (cho bảng xếp hạng tuần). */
async function xpByStudent(start, end, studentIds = null) {
  const match = { status: 'finished', finishedAt: { $gte: start, $lt: end } };
  if (studentIds) match.studentId = { $in: studentIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  const rows = await DailyPracticeSession.aggregate([
    { $match: match },
    { $group: { _id: '$studentId', xp: { $sum: { $add: [{ $ifNull: ['$xp', 0] }, { $ifNull: ['$bonusXp', 0] }] } } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.xp]));
}

module.exports = {
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  publishDrafts,
  getOverview,
  startSession,
  answerQuestion,
  useHint,
  finishSession,
  relatedTopics,
  xpByStudent,
};
