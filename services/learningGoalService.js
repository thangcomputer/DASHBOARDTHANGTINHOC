'use strict';

const mongoose = require('mongoose');
const LearningGoal = require('../models/LearningGoal');
const StudyTimeLog = require('../models/StudyTimeLog');

const PERIOD_DAYS = { week: 7, month: 30, quarter: 90 };
const MAX_HOURS_PER_DAY = 5;
/** Một heartbeat = tối đa 1 phút; heartbeat sát nhau hơn khoảng này bị bỏ qua (chống bơm phút). */
const MIN_BEAT_GAP_MS = 50 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function vnDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function assertStudentId(studentId) {
  if (!mongoose.Types.ObjectId.isValid(String(studentId || ''))) throw httpError(400, 'Học viên không hợp lệ');
}

async function goalWithProgress(studentId, goalDoc, now = new Date()) {
  const goal = goalDoc && typeof goalDoc.toObject === 'function' ? goalDoc.toObject() : goalDoc;
  const today = vnDayKey(now);
  const todayLog = await StudyTimeLog.findOne({ studentId, day: today }).select('minutes questions videos').lean();
  const todayStats = {
    todayMinutes: todayLog?.minutes || 0,
    todayQuestions: todayLog?.questions || 0,
    todayVideos: todayLog?.videos || 0,
  };
  if (!goal) return { goal: null, progress: todayStats };

  const totalDays = PERIOD_DAYS[goal.period] || 7;
  const startDay = vnDayKey(new Date(goal.startedAt));
  const endDay = vnDayKey(new Date(goal.endsAt - 1));
  const logs = await StudyTimeLog.find({ studentId, day: { $gte: startDay, $lte: endDay } }).select('minutes questions videos').lean();
  const sum = (field) => logs.reduce((total, log) => total + (log[field] || 0), 0);
  const periodMinutes = sum('minutes');
  const expired = now >= new Date(goal.endsAt);
  const daysElapsed = Math.min(totalDays, Math.max(1, Math.ceil((now - new Date(goal.startedAt)) / DAY_MS)));

  return {
    goal: {
      period: goal.period,
      hoursPerDay: goal.hoursPerDay,
      startedAt: goal.startedAt,
      endsAt: goal.endsAt,
      expired,
    },
    progress: {
      ...todayStats,
      dailyTargetMinutes: goal.hoursPerDay * 60,
      periodMinutes,
      periodQuestions: sum('questions'),
      periodVideos: sum('videos'),
      periodTargetMinutes: goal.hoursPerDay * 60 * totalDays,
      daysElapsed,
      totalDays,
      daysLeft: expired ? 0 : Math.max(0, totalDays - daysElapsed + 1),
    },
  };
}

async function getLearningGoal(studentId) {
  assertStudentId(studentId);
  const goal = await LearningGoal.findOne({ studentId }).lean();
  return goalWithProgress(studentId, goal);
}

async function setLearningGoal(studentId, { period, hoursPerDay } = {}) {
  assertStudentId(studentId);
  if (!PERIOD_DAYS[period]) throw httpError(400, 'Thời gian mục tiêu không hợp lệ');
  const hours = Number(hoursPerDay);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS_PER_DAY) {
    throw httpError(400, `Số giờ mỗi ngày phải từ 1 đến ${MAX_HOURS_PER_DAY}`);
  }
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + PERIOD_DAYS[period] * DAY_MS);
  const goal = await LearningGoal.findOneAndUpdate(
    { studentId },
    { $set: { period, hoursPerDay: hours, startedAt, endsAt } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  return goalWithProgress(studentId, goal);
}

/** +1 phút học cho hôm nay; bỏ qua nếu heartbeat trước đó quá gần hoặc đã đủ 24 giờ. */
async function recordStudyMinute(studentId, now = new Date()) {
  assertStudentId(studentId);
  const day = vnDayKey(now);
  const cutoff = new Date(now.getTime() - MIN_BEAT_GAP_MS);
  try {
    await StudyTimeLog.updateOne(
      {
        studentId,
        day,
        minutes: { $lt: 24 * 60 },
        $or: [{ lastBeatAt: null }, { lastBeatAt: { $lte: cutoff } }],
      },
      { $inc: { minutes: 1 }, $set: { lastBeatAt: now } },
      { upsert: true },
    );
  } catch (err) {
    // Upsert trùng khóa (studentId, day) nghĩa là đã có log nhưng heartbeat quá sát → bỏ qua.
    if (err?.code !== 11000) throw err;
  }
  const log = await StudyTimeLog.findOne({ studentId, day }).select('minutes').lean();
  return { todayMinutes: log?.minutes || 0 };
}

const MAX_ACTIVITY_PER_CALL = 500;
/** Tối đa phút ghi một lần hoàn thành lượt luyện tập hằng ngày. */
const MAX_SESSION_STUDY_MINUTES = 120;
const MAX_DAY_STUDY_MINUTES = 24 * 60;

/** Ghi bằng chứng học hôm nay: số câu vừa trả lời / số video vừa xem xong. */
async function recordStudyActivity(studentId, { questions = 0, videos = 0 } = {}, now = new Date()) {
  if (!mongoose.Types.ObjectId.isValid(String(studentId || ''))) return;
  const clamp = (value) => Math.min(MAX_ACTIVITY_PER_CALL, Math.max(0, Math.floor(Number(value) || 0)));
  const inc = {};
  if (clamp(questions)) inc.questions = clamp(questions);
  if (clamp(videos)) inc.videos = clamp(videos);
  if (!Object.keys(inc).length) return;
  try {
    await StudyTimeLog.updateOne({ studentId, day: vnDayKey(now) }, { $inc: inc }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    await StudyTimeLog.updateOne({ studentId, day: vnDayKey(now) }, { $inc: inc });
  }
}

/** Gọi sau khi nghiệp vụ chính đã xong - lỗi ghi nhật ký học không được làm hỏng bài nộp. */
function trackStudyActivity(studentId, counts) {
  recordStudyActivity(studentId, counts).catch(() => { });
}

/**
 * Cộng phút học từ một lượt luyện tập hằng ngày (từ lúc bắt đầu đến khi hoàn thành).
 * Dùng cho mục tiêu «X giờ/ngày» - khác heartbeat từng phút khi xem bài giảng.
 */
async function recordStudyDuration(studentId, seconds, now = new Date()) {
  assertStudentId(studentId);
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  if (sec < 1) return { todayMinutes: 0, addedMinutes: 0 };
  let minutes = Math.ceil(sec / 60);
  minutes = Math.min(MAX_SESSION_STUDY_MINUTES, minutes);
  const day = vnDayKey(now);
  const existing = await StudyTimeLog.findOne({ studentId, day }).select('minutes').lean();
  const current = existing?.minutes || 0;
  const add = Math.min(minutes, MAX_DAY_STUDY_MINUTES - current);
  if (add <= 0) return { todayMinutes: current, addedMinutes: 0 };
  try {
    await StudyTimeLog.updateOne({ studentId, day }, { $inc: { minutes: add } }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    await StudyTimeLog.updateOne({ studentId, day }, { $inc: { minutes: add } });
  }
  return { todayMinutes: current + add, addedMinutes: add };
}

function trackStudyDuration(studentId, seconds) {
  recordStudyDuration(studentId, seconds).catch(() => { });
}

/** Đếm số câu có trả lời trong mảng hoặc object đáp án. */
function countAnswered(answers) {
  const values = Array.isArray(answers)
    ? answers
    : answers && typeof answers === 'object' ? Object.values(answers) : [];
  return values.filter((value) => {
    const raw = value && typeof value === 'object' && !Array.isArray(value) && 'value' in value ? value.value : value;
    if (raw == null || raw === '') return false;
    if (Array.isArray(raw)) return raw.length > 0;
    if (typeof raw === 'object') return Object.keys(raw).length > 0;
    return true;
  }).length;
}

module.exports = {
  PERIOD_DAYS,
  MAX_HOURS_PER_DAY,
  vnDayKey,
  getLearningGoal,
  setLearningGoal,
  recordStudyMinute,
  recordStudyActivity,
  recordStudyDuration,
  trackStudyActivity,
  trackStudyDuration,
  countAnswered,
};
