'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticeQuestion = require('../models/DailyPracticeQuestion');
const DailyPracticeSession = require('../models/DailyPracticeSession');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');
const LessonSubject = require('../models/LessonSubject');
const LessonUnit = require('../models/LessonUnit');
const DailyPracticeUnit = require('../models/DailyPracticeUnit');
const DailyPracticePathProgress = require('../models/DailyPracticePathProgress');
const Student = require('../models/Student');
const PaymentSession = require('../models/PaymentSession');
const DailyPracticeXpPackPrice = require('../models/DailyPracticeXpPackPrice');
const rules = require('./dailyPracticeRules');
const pathService = require('./dailyPracticePathService');
const learningGoalService = require('./learningGoalService');
const lessonPracticeService = require('./lessonPracticeService');
const subscriptionService = require('./subscriptionService');
const logger = require('../config/logger');

const { httpError } = rules;

async function listXpPacks() {
  const doc = await DailyPracticeXpPackPrice.findOne({ key: 'default' }).lean();
  const saved = doc?.prices && typeof doc.prices === 'object' ? doc.prices : {};
  return rules.XP_PACKS.map((pack) => {
    const raw = Number(saved[pack.id]);
    const priceVnd = Number.isFinite(raw) && raw >= 1000 && raw <= 5_000_000 ? Math.round(raw) : pack.priceVnd;
    return { id: pack.id, xp: pack.xp, label: pack.label, priceVnd };
  });
}

async function resolveXpPack(packId) {
  const packs = await listXpPacks();
  return packs.find((pack) => pack.id === String(packId || '')) || null;
}

async function saveXpPackPrices(prices = {}) {
  const next = {};
  for (const pack of rules.XP_PACKS) {
    const raw = Number(prices[pack.id]);
    if (!Number.isFinite(raw) || raw < 1000 || raw > 5_000_000) {
      throw httpError(400, `Giá gói ${pack.label} phải từ 1.000 đến 5.000.000 đồng`);
    }
    next[pack.id] = Math.round(raw);
  }
  await DailyPracticeXpPackPrice.updateOne(
    { key: 'default' },
    { $set: { prices: next } },
    { upsert: true },
  );
  return listXpPacks();
}

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
    unitId: q.unitId ? String(q.unitId) : '',
    updatedAt: q.updatedAt,
  };
}

async function questionCounts(topicIds, { freeOnly = false } = {}) {
  const match = { topicId: { $in: topicIds } };
  if (freeOnly) match.unitId = null;
  const rows = await DailyPracticeQuestion.aggregate([
    { $match: match },
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
  await DailyPracticeUnit.deleteMany({ topicId });
  await DailyPracticePathProgress.deleteMany({ topicId });
  return { deletedQuestions: deletedCount || 0 };
}

// ── Admin: câu hỏi ──────────────────────────────────────────────────────────
async function listQuestions({ topicId, difficulty, type, status, unitId } = {}) {
  const filter = { topicId: requireId(topicId, 'Chủ đề') };
  if (rules.DIFFICULTIES.includes(difficulty)) filter.difficulty = difficulty;
  if (rules.TYPES.includes(type)) filter.type = type;
  if (status === 'draft' || status === 'published') filter.status = status;
  if (unitId === 'none') filter.unitId = null;
  else if (mongoose.Types.ObjectId.isValid(String(unitId || ''))) filter.unitId = new mongoose.Types.ObjectId(String(unitId));
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
    unitId: await pathService.resolveQuestionUnit(topicId, body?.unitId),
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
  if (!onlyStatus) {
    const targetTopic = set.topicId || existing.topicId;
    if (body && Object.prototype.hasOwnProperty.call(body, 'unitId')) {
      set.unitId = await pathService.resolveQuestionUnit(targetTopic, body.unitId);
    } else if (set.topicId && String(set.topicId) !== String(existing.topicId)) {
      set.unitId = null;
    }
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
  if (!studentId) return null;
  await refillDailyXp(studentId);
  return DailyPracticeProfile.findOne({ studentId }).lean();
}

/** Đặt ví về mức gói theo chu kỳ (mỗi ngày, mỗi tháng hoặc không reset). */
async function refillDailyXp(studentId) {
  const today = learningGoalService.vnDayKey();
  const xpConfig = await subscriptionService.getXpConfig();
  const student = await Student.findById(studentId).select('subscription freePortal').lean();
  const status = subscriptionService.statusOf(student, new Date(), xpConfig);
  const allowance = rules.allowanceForSubscription(status, student, xpConfig);
  const isMeetActive = status.meetLifetime || ((status.state === 'active' || status.state === 'expiring') && status.plan !== 'lifetime');
  if (isMeetActive) {
    const { unlockFreePortal } = require('./freePortal');
    await unlockFreePortal(studentId);
  }

  const resetCycle = xpConfig.resetCycle || 'daily';
  let periodKey = today;
  let isSamePeriod = false;

  let profile = await DailyPracticeProfile.findOne({ studentId }).lean();

  if (resetCycle === 'daily') {
    periodKey = today;
    isSamePeriod = Boolean(profile) && String(profile.xpAllowanceDay || '') === periodKey;
  } else if (resetCycle === 'monthly') {
    periodKey = today.slice(0, 7); // YYYY-MM
    isSamePeriod = Boolean(profile) && String(profile.xpAllowanceDay || '').slice(0, 7) === periodKey;
  } else if (resetCycle === 'never') {
    periodKey = 'never';
    isSamePeriod = Boolean(profile?.xpAllowanceDay);
  }

  if (!profile) {
    try {
      return await DailyPracticeProfile.create({
        studentId,
        xpTotal: allowance,
        dailyXp: allowance,
        purchasedXp: 0,
        xpBrokeDay: '',
        xpAllowanceDay: periodKey,
        xpAllowanceAmount: allowance,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      profile = await DailyPracticeProfile.findOne({ studentId }).lean();
    }
  }
  const next = rules.applyDailyAllowance(profile, periodKey, allowance, isSamePeriod);
  if (!next.changed) return profile;
  const filter = next.sameDayUpgrade
    ? {
      studentId,
      xpAllowanceDay: periodKey,
      $or: [
        { xpAllowanceAmount: { $lt: allowance } },
        { xpAllowanceAmount: null },
        { xpAllowanceAmount: { $exists: false } },
      ],
    }
    : next.sameDayDowngrade
      ? {
        studentId,
        xpAllowanceDay: periodKey,
        $or: [
          { xpAllowanceAmount: { $gt: allowance } },
          { xpAllowanceAmount: null },
          { xpAllowanceAmount: { $exists: false } },
        ],
      }
      : {
        studentId,
        $or: [
          { xpAllowanceDay: { $ne: periodKey } },
          { xpAllowanceDay: null },
          { xpAllowanceDay: { $exists: false } },
        ],
      };
  const updated = await DailyPracticeProfile.findOneAndUpdate(
    filter,
    {
      $set: {
        xpTotal: next.xpTotal,
        dailyXp: next.dailyXp,
        purchasedXp: next.purchasedXp,
        xpBrokeDay: next.xpBrokeDay,
        xpAllowanceDay: periodKey,
        xpAllowanceAmount: next.xpAllowanceAmount,
      }
    },
    { new: true },
  ).lean();
  return updated || DailyPracticeProfile.findOne({ studentId }).lean();
}

async function sumRecoveryXpEarnedToday(studentId, day = learningGoalService.vnDayKey()) {
  const rows = await DailyPracticeSession.find({
    studentId,
    status: 'finished',
    mode: 'path',
    recovery: true,
    day,
  }).select('xp bonusXp').lean();
  return rows.reduce((sum, row) => sum + Math.max(0, (Number(row.xp) || 0) + (Number(row.bonusXp) || 0)), 0);
}

function profileView(profile, today, recoveryXpEarnedToday = 0) {
  const status = rules.streakStatus(profile, today);
  const xpTotal = rules.clampXp(profile?.xpTotal);
  const allowance = Number(profile?.xpAllowanceAmount) > 0 ? Number(profile.xpAllowanceAmount) : rules.DAILY_ALLOWANCE_XP;
  return {
    xpTotal,
    xpEmpty: xpTotal < rules.SESSION_STAKE_XP,
    recoveryXpEarnedToday,
    recoveryXpRemainingToday: Math.max(0, rules.RECOVERY_DAILY_CAP_XP - recoveryXpEarnedToday),
    recoveryDailyCapXp: rules.RECOVERY_DAILY_CAP_XP,
    dailyRefillXp: allowance,
    dailyAllowanceXp: allowance,
    purchasedXp: rules.clampXp(profile?.purchasedXp),
    xpRefillsTomorrow: xpTotal < rules.SESSION_STAKE_XP && profile?.xpBrokeDay === today,
    streak: rules.liveStreak(profile, today),
    bestStreak: profile?.bestStreak || 0,
    playedToday: profile?.lastPlayedDay === today,
    sessionsCount: profile?.sessionsCount || 0,
    streakState: status.state,
    lostStreak: status.lostStreak,
    missedDays: status.missedDays,
    checkpointFailPenalty: rules.CHECKPOINT_FAIL_PENALTY,
    sessionStakeXp: rules.SESSION_STAKE_XP,
    perQuestionStakeXp: rules.QUESTION_STAKE_XP,
    xpPacks: rules.XP_PACKS,
  };
}

/** Cộng/trừ XP hồ sơ, không âm. */
async function adjustProfileXp(studentId, delta, { source = 'reward' } = {}) {
  await refillDailyXp(studentId);
  const amount = Math.round(Number(delta) || 0);
  let profile = await DailyPracticeProfile.findOne({ studentId }).lean();
  if (!profile) {
    profile = await DailyPracticeProfile.create({
      studentId,
      xpTotal: 0,
      dailyXp: 0,
      purchasedXp: 0,
    });
    profile = profile.toObject();
  }
  if (!amount) return profile;
  const next = rules.applyXpDelta(profile, amount, source);
  const today = learningGoalService.vnDayKey();
  const broke = next.xpTotal < rules.SESSION_STAKE_XP;
  return DailyPracticeProfile.findOneAndUpdate(
    { studentId },
    {
      $set: {
        xpTotal: next.xpTotal,
        dailyXp: next.dailyXp,
        purchasedXp: next.purchasedXp,
        xpBrokeDay: broke ? today : '',
      }
    },
    { new: true },
  ).lean();
}

/**
 * Kiểm tra XP trước khi vào lượt.
 * - Lượt mới / cược: bắt buộc số XP trong ví (xpTotal) phải ≥ stake thì mới được làm.
 *   Nếu xpTotal < stake (ví dụ bài cần 50 XP mà chỉ có 15 XP): CHẶN TUYỆT ĐỐI, không cho làm, buộc mua gói hoặc đợi ngày mai.
 */
async function assertCanSpendXp(studentId, { recovery = false, stake = rules.SESSION_STAKE_XP } = {}) {
  const profile = await getProfile(studentId);
  const xpTotal = rules.clampXp(profile?.xpTotal);
  const need = Math.max(0, Number(stake) || rules.SESSION_STAKE_XP);
  const allowance = Number(profile?.xpAllowanceAmount) > 0 ? Number(profile.xpAllowanceAmount) : rules.DAILY_ALLOWANCE_XP;
  const today = learningGoalService.vnDayKey();

  if (xpTotal >= need) return { profile, stakeXp: need };

  const err = httpError(
    402,
    `Không đủ XP để làm bài này (Cần ${need} XP · Bạn đang có ${xpTotal} XP). Vui lòng nâng cấp gói Google Meet (+300 XP/ngày) hoặc đợi sang ngày mai để nhận lại ${allowance} XP.`,
  );
  err.code = 'XP_EMPTY';
  err.needXp = need;
  err.currentXp = xpTotal;
  throw err;
}

/** Tạo session + trừ stake (nếu có). */
async function createStakedSession(fields, { stakeXp = 0 } = {}) {
  const session = await DailyPracticeSession.create({
    ...fields,
    stakeXp,
    recovery: fields.recovery === true,
  });
  let profileXp = 0;
  if (stakeXp > 0) {
    const profile = await adjustProfileXp(fields.studentId, -stakeXp, { source: 'spend' });
    profileXp = rules.clampXp(profile?.xpTotal);
  } else {
    const profile = await getProfile(fields.studentId);
    profileXp = rules.clampXp(profile?.xpTotal);
  }
  return { session, profileXp, stakeXp };
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
  const topics = await DailyPracticeTopic.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const [freeCounts, profile, todaySessions, todayPlayers, recoveryEarned] = await Promise.all([
    questionCounts(topics.map((topic) => topic._id), { freeOnly: true }),
    getProfile(sid),
    DailyPracticeSession.find({ studentId: sid, status: 'finished', mode: 'path', day: today }).select('xp bonusXp stakeXp mode status recovery answers testOut').lean(),
    countTodayPlayers(today),
    sumRecoveryXpEarnedToday(sid, today),
  ]);
  return {
    /** Luyện tự do: chỉ câu chưa xếp chặng (không dùng câu lộ trình). */
    topics: topics
      .map((topic) => topicView(topic, freeCounts.get(String(topic._id))))
      .map(({ counts, ...topic }) => ({ ...topic, counts: { easy: counts.easy, medium: counts.medium, hard: counts.hard } }))
      .filter((topic) => topic.counts.easy + topic.counts.medium + topic.counts.hard > 0),
    stats: {
      ...profileView(profile, today, recoveryEarned),
      xpPacks: await listXpPacks(),
      todaySessions: todaySessions.length,
      todayXp: todaySessions.reduce((sum, s) => sum + rules.sessionTodayDisplayXp(s), 0),
      todayPlayers,
    },
  };
}

/** Luyện tự do: chỉ lấy câu published chưa gắn chặng lộ trình. */
async function pickQuestions(topicId, difficulty) {
  const base = { topicId, status: 'published', unitId: null };
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

async function startPathSession(studentId, { unitId, step, nodeKey, testOut }) {
  const sid = requireId(studentId, 'Học viên');
  const prepared = await pathService.preparePathSession(sid, { unitId, step, nodeKey, testOut });
  const stepCompleted = Boolean(prepared.pathInfo.stepCompleted) && !testOut;
  const qCount = prepared.questions.length;
  const stakeNeed = testOut ? rules.TEST_OUT_XP : rules.sessionStakeTotal(qCount);
  const review = stepCompleted; // Bước đã xong thì chỉ là ôn lại (không mất stake, không nhận XP ví)
  const recovery = false;
  let stakeDeductAtStart = 0;
  if (testOut) {
    const { stakeXp: stakeDeduct } = await assertCanSpendXp(sid, { recovery: false, stake: stakeNeed });
    stakeDeductAtStart = stakeDeduct;
  } else if (!review) {
    // Bước mới: Bắt buộc kiểm tra ví phải có ≥ stakeNeed XP (ví dụ 50 XP). Không đủ -> Chặn luôn!
    await assertCanSpendXp(sid, { recovery: false, stake: stakeNeed });
  }
  const sessionQuestions = prepared.questions;
  const { session, profileXp } = await createStakedSession({
    studentId: sid,
    topicId: prepared.topic._id,
    difficulty: prepared.difficulty,
    mode: 'path',
    unitId: prepared.unit._id,
    step,
    pathNodeKey: prepared.pathInfo.pathNodeKey,
    testOut: Boolean(testOut),
    questionIds: sessionQuestions.map((q) => q._id),
    recovery: false,
    review,
  }, { stakeXp: stakeDeductAtStart });
  const xpOff = review;
  return {
    id: String(session._id),
    mode: 'path',
    recovery: false,
    topic: topicView(prepared.topic),
    difficulty: prepared.difficulty,
    total: sessionQuestions.length,
    questions: sessionQuestions.map((q) => rules.publicQuestion(q)),
    path: { ...prepared.pathInfo, recovery, review },
    profileXp,
    review,
    stakeXp: stakeDeductAtStart,
    sessionStakeXp: review ? 0 : stakeNeed,
    perQuestionStakeXp: rules.QUESTION_STAKE_XP,
    testOutRewardXp: testOut ? rules.TEST_OUT_XP : 0,
    mandatory: !recovery && !review && stakeNeed > 0,
    xpDisabled: xpOff,
    checkpointFailPenalty: testOut ? rules.TEST_OUT_XP : rules.CHECKPOINT_FAIL_PENALTY,
  };
}

async function startSession(studentId, { topicId, difficulty, mode, unitId, step, nodeKey, testOut } = {}) {
  if (mode === 'path') return startPathSession(studentId, { unitId, step, nodeKey, testOut: Boolean(testOut) });
  const sid = requireId(studentId, 'Học viên');
  const tid = requireId(topicId, 'Chủ đề');
  if (!rules.DIFFICULTIES.includes(difficulty)) throw httpError(400, 'Độ khó không hợp lệ');
  const topic = await DailyPracticeTopic.findOne({ _id: tid, active: true }).lean();
  if (!topic) throw httpError(404, 'Chủ đề không còn hoạt động');
  const questions = await pickQuestions(tid, difficulty);
  if (!questions.length) throw httpError(404, 'Chủ đề này chưa có câu Luyện tự do (chưa xếp chặng). Hãy soạn câu riêng cho Luyện tự do.');
  // Luyện tự do: tuyệt đối không cược / không cộng trừ XP hồ sơ.
  const profile = await getProfile(sid);
  const shuffledQuestions = rules.shuffle(questions);
  const session = await DailyPracticeSession.create({
    studentId: sid,
    topicId: tid,
    difficulty,
    mode: 'free',
    questionIds: shuffledQuestions.map((q) => q._id),
    stakeXp: 0,
    recovery: false,
  });
  return {
    id: String(session._id),
    topic: topicView(topic),
    difficulty,
    total: shuffledQuestions.length,
    mode: 'free',
    questions: shuffledQuestions.map((q) => rules.publicQuestion(q)),
    profileXp: rules.clampXp(profile?.xpTotal),
    stakeXp: 0,
    sessionStakeXp: 0,
    mandatory: false,
    xpDisabled: true,
    checkpointFailPenalty: 0,
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
  const perQuestion = rules.usesPerQuestionStake(session);
  let xpDelta = 0;
  if (perQuestion && !correct) {
    xpDelta = -rules.QUESTION_STAKE_XP;
    await adjustProfileXp(session.studentId, xpDelta, { source: 'spend' });
  }
  // Gợi ý đã trừ ngay lúc mở → chỉ ghi lại để tính XP ròng của lượt.
  const hintPaid = perQuestion && hintUsed ? rules.hintCostXp() : 0;
  const updated = await DailyPracticeSession.findOneAndUpdate(
    { _id: session._id, status: 'in_progress', 'answers.questionId': { $ne: question._id } },
    {
      $push: { answers: { questionId: question._id, correct, hintUsed, xp: xpDelta - hintPaid, answeredAt: new Date() } },
      $inc: { correctCount: correct ? 1 : 0 },
    },
    { new: true },
  ).lean();
  if (!updated) throw httpError(409, 'Câu này đã được trả lời');
  const profile = await getProfile(session.studentId);
  learningGoalService.trackStudyActivity(session.studentId, { questions: 1 });
  return {
    correct,
    xp: xpDelta,
    stakeXp: session.stakeXp || 0,
    sessionXp: updated.xp || 0,
    profileXp: rules.clampXp(profile?.xpTotal),
    purchasedXp: rules.clampXp(profile?.purchasedXp),
    dailyXp: rules.clampXp(profile?.dailyXp),
    xpEmpty: rules.clampXp(profile?.xpTotal) <= 0,
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
  const perQuestionHint = rules.usesPerQuestionStake(session);
  let chargedXp = 0;
  if (perQuestionHint) {
    const before = await getProfile(session.studentId);
    const cost = rules.hintCostXp();
    const alreadyHinted = (session.hintsUsed || []).some((id) => String(id) === String(question._id));
    if (!alreadyHinted && rules.clampXp(before?.xpTotal) < cost) {
      const err = httpError(402, `Cần ${cost} XP để mở gợi ý. Bạn chưa đủ XP.`);
      err.currentXp = rules.clampXp(before?.xpTotal);
      err.needXp = cost;
      throw err;
    }
  }
  const marked = await DailyPracticeSession.updateOne(
    { _id: session._id, hintsUsed: { $ne: question._id } },
    { $addToSet: { hintsUsed: question._id } },
  );
  if (perQuestionHint && marked.modifiedCount > 0) {
    chargedXp = rules.hintCostXp();
    await adjustProfileXp(session.studentId, -chargedXp, { source: 'spend' });
  }
  const profileAfter = await getProfile(session.studentId);
  const total = session.questionIds?.length || rules.SESSION_SIZE;
  const perQuestion = rules.usesPerQuestionStake(session);
  const hintCostXp = session.mode === 'free' ? 0
    : (perQuestion ? rules.hintCostXp()
      : (session.stakeXp > 0 && total > 0 ? Math.floor(session.stakeXp / (2 * total)) : 0));
  const stakeXp = session.mode === 'free' ? 0 : (session.stakeXp || 0);
  return {
    ...rules.hintReveal(question),
    hintCostXp,
    charged: chargedXp,
    profileXp: rules.clampXp(profileAfter?.xpTotal),
    purchasedXp: rules.clampXp(profileAfter?.purchasedXp),
    dailyXp: rules.clampXp(profileAfter?.dailyXp),
    stakeXp,
    xpDisabled: session.mode === 'free',
  };
}

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function addDays(dayKey, delta) {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** Tuần hiện tại (T2 → CN) và những ngày đã hoàn thành ít nhất một lượt. */
async function weekActivity(studentId, today) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, weekday === 0 ? -6 : 1 - weekday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const played = new Set(await DailyPracticeSession.distinct('day', { studentId, status: 'finished', day: { $in: days } }));
  return days.map((day) => ({
    day,
    label: WEEKDAY_LABELS[new Date(`${day}T00:00:00Z`).getUTCDay()],
    played: played.has(day),
    today: day === today,
  }));
}

/** Chuỗi câu đúng liên tiếp dài nhất trong lượt. */
function maxComboOf(answers = []) {
  let best = 0;
  let current = 0;
  for (const answer of [...answers].sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt))) {
    current = answer.correct ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

async function finishSession(studentId, sessionId) {
  const session = await loadOwnSession(studentId, sessionId);
  if (session.status !== 'in_progress') throw httpError(409, 'Lượt chơi đã kết thúc');
  const total = session.questionIds.length;
  const correct = session.correctCount || 0;
  const stars = rules.starsFor(correct, total);
  const scorePercent = total ? Math.round((correct / total) * 100) : 0;
  const day = learningGoalService.vnDayKey();
  const finished = await DailyPracticeSession.findOneAndUpdate(
    { _id: session._id, status: 'in_progress' },
    { $set: { status: 'finished', stars, day, finishedAt: new Date() } },
    { new: true },
  ).lean();
  if (!finished) throw httpError(409, 'Lượt chơi đã kết thúc');

  const before = await getProfile(session.studentId);
  const streak = rules.nextStreak(before, day);
  let path = null;
  if (finished.mode === 'path') {
    try {
      path = await pathService.recordPathResult(finished);
    } catch (err) {
      logger.error(`[DAILY_PRACTICE] record path result failed: ${err.message}`);
    }
  }
  const isFree = finished.mode === 'free';
  const xpOff = rules.isPracticeXpDisabled(finished);
  const isReview = finished.review === true;
  const passed = isFree
    ? scorePercent >= rules.FREE_PASS_PERCENT
    : Boolean(path?.passed);
  let stakeXp = xpOff ? 0 : (finished.stakeXp || 0);
  const isRecovery = !xpOff && finished.recovery === true;
  const perQuestionStake = !xpOff && rules.usesPerQuestionStake(finished);
  const perQ = rules.QUESTION_STAKE_XP;
  const wrongCount = Math.max(0, total - correct);
  // Cược theo câu: sai và gợi ý đều đã trừ ngay - lấy đúng tổng đã trừ (ghi trong answers).
  const answerLossXp = perQuestionStake
    ? Math.max(-rules.answerXpLoss(finished), wrongCount * perQ)
    : 0;
  // Luyện tự do: không đụng XP. Lộ trình: cược theo câu hoặc lump test-out; phục hồi: +XP (cap/ngày).
  let rewardXp = 0;
  let hintPenaltyXp = 0;
  if (!xpOff && passed) {
    const hinted = new Set([
      ...(finished.hintsUsed || []).map(String),
      ...(finished.answers || []).filter((a) => a.hintUsed).map((a) => String(a.questionId)),
    ]);
    if (perQuestionStake) {
      // Gợi ý đã trừ ngay khi mở, không trừ thêm vào thưởng.
      hintPenaltyXp = Math.round(hinted.size * rules.hintCostXp());
      rewardXp = Math.max(0, correct * perQ);
    } else if (isRecovery) {
      const earnedBefore = await sumRecoveryXpEarnedToday(session.studentId, day);
      const room = Math.max(0, rules.RECOVERY_DAILY_CAP_XP - earnedBefore);
      const base = Math.min(correct * perQ, room);
      const perQuestion = total > 0 ? base / total : 0;
      hintPenaltyXp = Math.round(hinted.size * (perQuestion / 2));
      rewardXp = Math.max(0, Math.round(base - hintPenaltyXp));
    } else {
      const lump = stakeXp > 0 ? stakeXp : 0;
      const perQuestion = total > 0 ? lump / total : 0;
      hintPenaltyXp = Math.round(hinted.size * (perQuestion / 2));
      rewardXp = Math.max(0, Math.round(lump - hintPenaltyXp));
      if (finished.testOut) rewardXp += rules.TEST_OUT_XP;
    }
  }
  const lostXp = (!xpOff && !passed && !isRecovery)
    ? (perQuestionStake ? answerLossXp : stakeXp)
    : 0;
  let gainedXp = 0;
  if (!xpOff) {
    if (isRecovery && passed) gainedXp = rewardXp;
    else if (perQuestionStake) gainedXp = passed ? (rewardXp - answerLossXp) : -answerLossXp;
    else if (passed) gainedXp = rewardXp - stakeXp;
    else gainedXp = -lostXp;
  }
  if (rewardXp > 0) await adjustProfileXp(session.studentId, rewardXp, { source: 'reward' });
  if (perQuestionStake) stakeXp = answerLossXp;
  await DailyPracticeSession.updateOne(
    { _id: finished._id },
    { $set: { xp: rewardXp, bonusXp: 0, stakeXp } },
  );
  const profile = await DailyPracticeProfile.findOneAndUpdate(
    { studentId: session.studentId },
    {
      $inc: { sessionsCount: 1 },
      $set: { streak, lastPlayedDay: day },
      $max: { bestStreak: streak },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  const answered = new Map((finished.answers || []).map((a) => [String(a.questionId), a]));
  const missedIds = finished.questionIds.filter((id) => !answered.get(String(id))?.correct);
  const missed = await DailyPracticeQuestion.find({ _id: { $in: missedIds } }).lean();
  const relatedLesson = await relatedLessonForTopic(session.studentId, session.topicId);
  const finishedAt = finished.finishedAt ? new Date(finished.finishedAt) : new Date();
  const durationSeconds = Math.max(1, Math.round((finishedAt - new Date(finished.createdAt || finishedAt)) / 1000));
  learningGoalService.trackStudyDuration(session.studentId, durationSeconds);
  return {
    path,
    maxCombo: maxComboOf(finished.answers),
    durationSeconds,
    firstToday: before?.lastPlayedDay !== day,
    week: await weekActivity(session.studentId, day),
    relatedLesson,
    total,
    correctCount: correct,
    scorePercent,
    passed,
    stars,
    stakeXp,
    xp: rewardXp,
    bonusXp: 0,
    hintPenaltyXp,
    failPenaltyXp: lostXp,
    gainedXp,
    xpDisabled: xpOff,
    streakIncreased: streak > rules.liveStreak(before, day),
    stats: {
      ...(await (async () => {
        const recoveryEarned = await sumRecoveryXpEarnedToday(session.studentId, day);
        const todayRows = await DailyPracticeSession.find({
          studentId: session.studentId, status: 'finished', mode: 'path', day,
        }).select('xp bonusXp stakeXp mode status recovery answers testOut').lean();
        return {
          ...profileView(profile, day, recoveryEarned),
          todayXp: todayRows.reduce((sum, row) => sum + rules.sessionTodayDisplayXp(row), 0),
        };
      })()),
    },
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

/** Thoát giữa chừng - mất stake đã trừ / còn lại (theo câu hoặc lump). */
async function abandonSession(studentId, sessionId) {
  const session = await loadOwnSession(studentId, sessionId);
  if (session.status !== 'in_progress') return { abandoned: true, lostXp: session.stakeXp || 0 };
  const day = learningGoalService.vnDayKey();
  if (session.review === true) {
    await DailyPracticeSession.updateOne(
      { _id: session._id, status: 'in_progress' },
      { $set: { status: 'abandoned', xp: 0, bonusXp: 0, day, finishedAt: new Date() } },
    );
    const profile = await getProfile(session.studentId);
    const recoveryEarned = await sumRecoveryXpEarnedToday(session.studentId, day);
    return {
      abandoned: true,
      lostXp: 0,
      mandatory: false,
      profileXp: rules.clampXp(profile?.xpTotal),
      stats: profileView(profile, day, recoveryEarned),
    };
  }
  const perQuestionStake = rules.usesPerQuestionStake(session);
  const perQ = rules.QUESTION_STAKE_XP;
  const answered = (session.answers || []).length;
  const total = session.questionIds?.length || 0;
  const wrongLoss = -rules.answerXpLoss(session);
  const answeredIds = new Set((session.answers || []).map((a) => String(a.questionId)));
  const hintedOpen = (session.hintsUsed || []).filter((id) => !answeredIds.has(String(id))).length;
  const hintOpenPaid = perQuestionStake ? hintedOpen * rules.hintCostXp() : 0;
  let remainingLoss = 0;
  if (perQuestionStake) {
    // Câu chưa làm mất trọn XP câu; phần gợi ý đã trừ trước được tính vào.
    remainingLoss = Math.max(0, Math.max(0, total - answered) * perQ - hintOpenPaid);
    if (remainingLoss > 0) await adjustProfileXp(session.studentId, -remainingLoss, { source: 'spend' });
  }
  const lostXp = perQuestionStake ? wrongLoss + hintOpenPaid + remainingLoss : (session.stakeXp || 0);
  await DailyPracticeSession.updateOne(
    { _id: session._id, status: 'in_progress' },
    { $set: { status: 'abandoned', xp: 0, bonusXp: 0, stakeXp: perQuestionStake ? lostXp : session.stakeXp, day, finishedAt: new Date() } },
  );
  const profile = await getProfile(session.studentId);
  const recoveryEarned = await sumRecoveryXpEarnedToday(session.studentId, day);
  return {
    abandoned: true,
    lostXp,
    mandatory: perQuestionStake || (session.stakeXp || 0) > 0,
    profileXp: rules.clampXp(profile?.xpTotal),
    stats: profileView(profile, day, recoveryEarned),
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
  const match = { status: { $in: ['finished', 'abandoned'] }, finishedAt: { $gte: start, $lt: end }, mode: { $ne: 'free' } };
  if (studentIds) match.studentId = { $in: studentIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  const rows = await DailyPracticeSession.aggregate([
    { $match: match },
    {
      $addFields: {
        netXp: {
          $cond: [
            { $gt: [{ $add: [{ $ifNull: ['$xp', 0] }, { $ifNull: ['$bonusXp', 0] }] }, 0] },
            {
              $subtract: [
                { $add: [{ $ifNull: ['$xp', 0] }, { $ifNull: ['$bonusXp', 0] }] },
                { $ifNull: ['$stakeXp', 0] },
              ],
            },
            {
              $cond: [
                { $gt: [{ $ifNull: ['$stakeXp', 0] }, 0] },
                { $multiply: [{ $ifNull: ['$stakeXp', 0] }, -1] },
                0,
              ],
            },
          ],
        },
      },
    },
    { $group: { _id: '$studentId', xp: { $sum: '$netXp' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.xp]));
}

function makeXpRef(studentCode) {
  const code = String(studentCode || 'HV').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'HV';
  const suffix = String(crypto.randomInt(10000, 100000));
  return `${code} XP ${suffix}`;
}

/** Tạo phiên chuyển khoản mua gói XP. */
async function createXpPurchase(studentId, packId) {
  const sid = requireId(studentId, 'Học viên');
  const pack = await resolveXpPack(packId);
  if (!pack) throw httpError(400, 'Gói XP không hợp lệ');
  const student = await Student.findById(sid).select('name fullName studentCode branchId').lean();
  if (!student) throw httpError(404, 'Không tìm thấy học viên');

  const existing = await PaymentSession.findOne({
    studentId: sid,
    kind: 'daily_practice_xp',
    status: 'pending',
    plan: pack.id,
  }).sort({ createdAt: -1 }).lean();
  if (existing && Number(existing.amount) === pack.priceVnd) {
    return {
      sessionId: existing.sessionId,
      ref: existing.ref,
      amount: existing.amount,
      xp: pack.xp,
      pack,
      studentName: existing.studentName || student.name || student.fullName || '',
    };
  }

  const ref = makeXpRef(student.studentCode);
  const sessionId = `ps_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await PaymentSession.create({
    sessionId,
    ref,
    amount: pack.priceVnd,
    status: 'pending',
    studentName: student.name || student.fullName || '',
    courseName: `Luyện tập · ${pack.label}`,
    studentId: sid,
    branchId: student.branchId || null,
    kind: 'daily_practice_xp',
    plan: pack.id,
  });
  return {
    sessionId,
    ref,
    amount: pack.priceVnd,
    xp: pack.xp,
    pack,
    studentName: student.name || student.fullName || '',
  };
}

async function getXpPurchaseStatus(studentId, sessionId) {
  const sid = requireId(studentId, 'Học viên');
  const session = await PaymentSession.findOne({ sessionId: String(sessionId || ''), studentId: sid, kind: 'daily_practice_xp' }).lean();
  if (!session) throw httpError(404, 'Không tìm thấy đơn mua XP');
  const pack = await resolveXpPack(session.plan);
  const profile = await getProfile(sid);
  return {
    sessionId: session.sessionId,
    status: session.status,
    paid: session.status === 'paid',
    amount: session.amount,
    ref: session.ref,
    xp: pack?.xp || 0,
    pack,
    profileXp: rules.clampXp(profile?.xpTotal),
    purchasedXp: rules.clampXp(profile?.purchasedXp),
    dailyXp: rules.clampXp(profile?.dailyXp),
  };
}

/** Thanh toán ảo: đánh dấu đơn đã trả rồi cộng XP. Không dùng trên production. */
async function simulateXpPurchase(studentId, sessionId) {
  const sid = requireId(studentId, 'Học viên');
  const session = await PaymentSession.findOne({
    sessionId: String(sessionId || ''),
    studentId: sid,
    kind: 'daily_practice_xp',
  });
  if (!session) throw httpError(404, 'Không tìm thấy đơn mua XP');
  if (session.status === 'paid') return getXpPurchaseStatus(sid, session.sessionId);
  if (session.status !== 'pending') throw httpError(409, 'Đơn mua XP không còn hiệu lực');
  const claimed = await PaymentSession.findOneAndUpdate(
    { _id: session._id, status: 'pending' },
    { $set: { status: 'paid', paidAmount: session.amount } },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) throw httpError(409, 'Đơn mua XP không còn hiệu lực');
  try {
    await fulfillDailyPracticeXpPurchase({ session: claimed });
  } catch (err) {
    await PaymentSession.updateOne(
      { _id: session._id, status: 'paid', purchaseId: null },
      { $set: { status: 'pending' }, $unset: { paidAmount: 1 } },
    );
    throw err;
  }
  return getXpPurchaseStatus(sid, session.sessionId);
}

/** SePay đã khớp phiên → cộng XP một lần. */
async function fulfillDailyPracticeXpPurchase({ session }) {
  const pack = await resolveXpPack(session.plan);
  const xp = pack?.xp || 0;
  if (!session.studentId || xp <= 0) {
    logger.warn(`[DAILY_PRACTICE] XP purchase missing student/pack: ${session.sessionId}`);
    return { xp: 0 };
  }
  // Idempotent: chỉ cộng khi vừa chuyển pending→paid (caller đã claim). Dùng purchaseId null + plan.
  const claimed = await PaymentSession.findOneAndUpdate(
    { _id: session._id, kind: 'daily_practice_xp', purchaseId: null },
    { $set: { purchaseId: session._id } }, // đánh dấu đã fulfill (tái dùng field)
    { new: true },
  ).lean();
  if (!claimed) {
    const profile = await getProfile(session.studentId);
    return { xp: 0, already: true, profileXp: rules.clampXp(profile?.xpTotal) };
  }
  const profile = await adjustProfileXp(session.studentId, xp, { source: 'purchase' });
  await DailyPracticeProfile.updateOne(
    { studentId: session.studentId, 'xpPurchases.sessionId': { $ne: String(session.sessionId || '') } },
    {
      $push: {
        xpPurchases: {
          $each: [{
            sessionId: String(session.sessionId || ''),
            xp,
            amount: Number(session.paidAmount || session.amount || 0),
            packId: String(session.plan || ''),
            at: new Date(),
          }],
          $position: 0,
          $slice: 20,
        }
      }
    },
  );
  logger.info(`[DAILY_PRACTICE] Credited ${xp} XP to student ${session.studentId} via ${session.sessionId}`);
  return { xp, profileXp: rules.clampXp(profile?.xpTotal), studentId: String(session.studentId) };
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
  abandonSession,
  relatedTopics,
  xpByStudent,
  maxComboOf,
  createXpPurchase,
  getXpPurchaseStatus,
  simulateXpPurchase,
  fulfillDailyPracticeXpPurchase,
  listXpPacks,
  saveXpPackPrices,
  adjustProfileXp,
  getProfile,
};
