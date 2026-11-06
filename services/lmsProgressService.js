'use strict';

const mongoose = require('mongoose');
const LmsLearnerProgress = require('../models/LmsLearnerProgress');
const LmsXpGrant = require('../models/LmsXpGrant');
const LmsXpSettings = require('../models/LmsXpSettings');
const rules = require('./lmsXpRules');
const Student = require('../models/Student');
const Course = require('../models/Course');

const WELCOME_XP = 100;

function vnDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function shiftDayKey(dayKey, delta) {
  const [year, month, day] = String(dayKey || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function present(doc) {
  const level = rules.levelFromXp(doc?.xpTotal || 0);
  return {
    ...level,
    streak: doc?.streak || 0,
    bestStreak: doc?.bestStreak || 0,
    lastStudyDay: doc?.lastStudyDay || '',
    separateFromDailyPractice: true,
  };
}

async function loadSettings() {
  const doc = await LmsXpSettings.findOne({ key: 'default' }).lean();
  return {
    videoRatio: rules.sanitizeVideoRatio(doc?.videoRatio ?? rules.DEFAULT_VIDEO_RATIO),
    amounts: rules.sanitizeAmounts(doc?.amounts),
    levels: rules.LEVELS,
    badges: rules.badgeCatalog(doc?.badges),
  };
}

async function saveSettings(input = {}) {
  const videoRatio = rules.sanitizeVideoRatio(input.videoRatio);
  const amounts = rules.sanitizeAmounts(input.amounts);
  const set = { videoRatio, amounts };
  if (input.badges && typeof input.badges === 'object') set.badges = rules.sanitizeBadges(input.badges);
  await LmsXpSettings.updateOne(
    { key: 'default' },
    { $set: set },
    { upsert: true },
  );
  return loadSettings();
}

function vnRange(startKey, endKey) {
  const start = new Date(`${startKey}T00:00:00+07:00`);
  const end = new Date(`${endKey}T00:00:00+07:00`);
  return { start, end };
}

async function grantRows(studentId) {
  return LmsXpGrant.find({ studentId }).sort({ createdAt: -1 }).select('amount reason createdAt sourceKey').lean();
}

function studyDaySet(rows) {
  const days = new Set();
  for (const row of rows) {
    if (!rules.ACTIVITY_REASONS.includes(row.reason)) continue;
    days.add(vnDayKey(row.createdAt));
  }
  return [...days];
}

async function courseNamesOf(studentId, rows) {
  const ids = rows
    .filter((row) => row.reason === 'course')
    .map((row) => String(row.sourceKey || '').split(':').pop())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return [];
  const courses = await Course.find({ _id: { $in: ids } }).select('name').lean();
  return courses.map((course) => course.name || '');
}

async function learnerBundle(studentId, month) {
  const base = await summary(studentId);
  if (!mongoose.Types.ObjectId.isValid(String(studentId || ''))) {
    return { ...base, history: [], calendar: null, badges: [] };
  }
  const [rows, settings] = await Promise.all([
    grantRows(studentId),
    loadSettings(),
  ]);
  const studyDays = studyDaySet(rows);
  const today = vnDayKey();
  const monthKey = /^\d{4}-\d{2}$/.test(String(month || '')) ? String(month) : rules.monthKeyOf(today);
  const activities = rows.filter((row) => rules.ACTIVITY_REASONS.includes(row.reason)).length;
  const practice = rows.filter((row) => row.reason === 'practice').length;
  const names = await courseNamesOf(studentId, rows);
  const badges = settings.badges
    .filter((badge) => badge.enabled)
    .map((badge) => ({
      key: badge.key,
      title: badge.title,
      description: badge.description,
      earned: rules.badgeEarned(badge.key, {
        activities,
        practice,
        bestStreak: base.bestStreak,
        xpTotal: base.xpTotal,
        courseNames: names,
      }),
    }));
  return {
    ...base,
    history: rows.slice(0, 20).map((row) => ({
      id: String(row._id),
      amount: row.amount,
      reason: row.reason,
      label: rules.reasonLabel(row.reason),
      at: row.createdAt,
    })),
    calendar: {
      month: monthKey,
      today,
      days: rules.monthCells(monthKey, studyDays, today),
      studiedCount: studyDays.filter((day) => day.startsWith(monthKey)).length,
      marks: rules.STREAK_MARKS,
    },
    badges,
  };
}

async function leaderboard(studentId, period) {
  const key = ['week', 'month', 'all'].includes(period) ? period : 'week';
  const me = await Student.findById(studentId).select('name avatar branchId').lean();
  if (!me) return { period: key, top: [], me: null };
  const peerFilter = { status: { $nin: ['suspended', 'inactive'] } };
  if (me.branchId) peerFilter.branchId = me.branchId;
  const peers = await Student.find(peerFilter).select('name avatar').lean();
  const allowed = new Set(peers.map((row) => String(row._id)));
  allowed.add(String(me._id));
  const today = vnDayKey();
  let match = {};
  if (key === 'week') {
    const bounds = rules.weekBounds(today);
    const range = vnRange(bounds.start, bounds.end);
    match = { createdAt: { $gte: range.start, $lt: range.end } };
  } else if (key === 'month') {
    const month = rules.monthKeyOf(today);
    const [year, mon] = month.split('-').map(Number);
    const next = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
    const range = vnRange(`${month}-01`, next);
    match = { createdAt: { $gte: range.start, $lt: range.end } };
  }
  const grouped = key === 'all'
    ? (await LmsLearnerProgress.find({ studentId: { $in: [...allowed] } }).select('studentId xpTotal streak').lean())
      .map((row) => ({ studentId: String(row.studentId), xp: row.xpTotal || 0, streak: row.streak || 0 }))
    : (await LmsXpGrant.aggregate([
      { $match: { ...match, studentId: { $in: [...allowed].filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: '$studentId', xp: { $sum: '$amount' } } },
    ])).map((row) => ({ studentId: String(row._id), xp: row.xp || 0 }));
  const profiles = key === 'all'
    ? null
    : await LmsLearnerProgress.find({ studentId: { $in: [...allowed] } }).select('studentId xpTotal streak').lean();
  const profileById = new Map((profiles || []).map((row) => [String(row.studentId), row]));
  const byId = new Map(peers.map((row) => [String(row._id), row]));
  if (!byId.has(String(me._id))) byId.set(String(me._id), me);
  const ranked = grouped
    .filter((row) => allowed.has(row.studentId) && row.xp > 0)
    .sort((a, b) => b.xp - a.xp || String(byId.get(a.studentId)?.name || '').localeCompare(String(byId.get(b.studentId)?.name || ''), 'vi'));
  const rows = ranked.map((row, index) => {
    const person = byId.get(row.studentId);
    const profile = profileById?.get(row.studentId);
    const total = key === 'all' ? row.xp : (profile?.xpTotal || 0);
    const level = rules.levelFromXp(total);
    return {
      rank: index + 1,
      name: person?.name || 'Học viên',
      avatar: person?.avatar || '',
      xp: row.xp,
      level: level.level,
      title: level.title,
      streak: key === 'all' ? (row.streak || 0) : (profile?.streak || 0),
      isMe: row.studentId === String(studentId),
    };
  });
  const mine = rows.find((row) => row.isMe) || null;
  return { period: key, top: rows.slice(0, 10), me: mine };
}

async function summary(studentId) {
  if (!mongoose.Types.ObjectId.isValid(String(studentId || ''))) return present(null);
  const doc = await LmsLearnerProgress.findOne({ studentId }).lean();
  return present(doc);
}

async function grantXp({ studentId, amount, reason, sourceKey, countsForStreak = true }) {
  const xp = Math.floor(Number(amount) || 0);
  const key = String(sourceKey || '').trim();
  if (!mongoose.Types.ObjectId.isValid(String(studentId || '')) || xp <= 0 || !key) return summary(studentId);
  try {
    await LmsXpGrant.create({ studentId, amount: xp, reason: reason || 'activity', sourceKey: key });
  } catch (err) {
    if (err?.code === 11000) return summary(studentId);
    throw err;
  }
  const today = vnDayKey();
  const current = await LmsLearnerProgress.findOne({ studentId }).lean();
  const before = rules.levelFromXp(current?.xpTotal || 0);
  const progress = countsForStreak
    ? rules.streakProgress(current, today, shiftDayKey(today, -1))
    : {
      streak: current?.streak || 0,
      streakStartedOn: current?.streakStartedOn || '',
    };
  const streak = progress.streak;
  const bestStreak = Math.max(streak, current?.bestStreak || 0, current?.streak || 0);
  const after = rules.levelFromXp((current?.xpTotal || 0) + xp);
  const levelUps = [];
  for (let level = before.level + 1; level <= after.level; level += 1) {
    levelUps.push({ level, title: rules.titleForLevel(level), at: new Date() });
  }
  const update = {
    $inc: { xpTotal: xp },
    $set: countsForStreak
      ? { streak, bestStreak, lastStudyDay: today, streakStartedOn: progress.streakStartedOn }
      : { bestStreak },
  };
  if (levelUps.length) update.$push = { levelUps: { $each: levelUps, $slice: -20 } };
  const updated = await LmsLearnerProgress.findOneAndUpdate(
    { studentId },
    update,
    { upsert: true, new: true },
  );
  if (countsForStreak) await grantStreakBonuses(studentId, streak, progress.streakStartedOn);
  return present(updated);
}

async function grantStreakBonuses(studentId, streak, streakStartedOn) {
  if (!streakStartedOn || streak < 3) return;
  const settings = await loadSettings();
  for (const milestone of rules.STREAK_MILESTONES) {
    if (streak < milestone) continue;
    const amount = settings.amounts[`streak${milestone}`] || 0;
    if (amount <= 0) continue;
    await grantXp({
      studentId,
      amount,
      reason: `streak${milestone}`,
      sourceKey: `streak:${milestone}:${studentId}:${streakStartedOn}`,
      countsForStreak: false,
    });
  }
}

async function grantActivity({ studentId, activity, sourceKey, watchRatio }) {
  const settings = await loadSettings();
  if (activity === 'video') {
    const ratio = Number(watchRatio);
    if (!(ratio >= settings.videoRatio)) return summary(studentId);
  }
  const amount = settings.amounts[activity] || 0;
  return grantXp({
    studentId,
    amount,
    reason: activity,
    sourceKey,
    countsForStreak: true,
  });
}

async function grantWelcomeXp(studentId) {
  return grantXp({
    studentId,
    amount: WELCOME_XP,
    reason: 'welcome',
    sourceKey: `welcome:${studentId}`,
    countsForStreak: false,
  });
}

/** Xóa XP học bài của mọi học viên rồi tặng lại 100 XP chào mừng. Không đụng điểm luyện tập. */
async function resetAllToWelcomeXp() {
  const Student = require('../models/Student');
  await LmsXpGrant.deleteMany({});
  await LmsLearnerProgress.deleteMany({});
  const students = await Student.find({}).select('_id').lean();
  for (const student of students) {
    await grantWelcomeXp(student._id);
  }
  return { students: students.length, welcomeXp: WELCOME_XP };
}

async function grantExam(studentId, subjectId, percent) {
  const subject = String(subjectId || '').trim();
  if (!subject || !mongoose.Types.ObjectId.isValid(String(studentId || ''))) return summary(studentId);
  const settings = await loadSettings();
  const band = rules.examBandXp(percent, settings.amounts);
  if (band <= 0) return summary(studentId);
  const prefix = `exam:${studentId}:${subject}:`;
  const prev = await LmsXpGrant.find({
    studentId,
    sourceKey: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  }).select('amount').lean();
  const already = prev.reduce((sum, row) => sum + (row.amount || 0), 0);
  const delta = rules.examUpgradeXp(percent, already, settings.amounts);
  if (delta <= 0) return summary(studentId);
  return grantXp({
    studentId,
    amount: delta,
    reason: 'exam',
    sourceKey: `${prefix}${band}`,
    countsForStreak: true,
  });
}

module.exports = {
  vnDayKey,
  shiftDayKey,
  levelFromXp: rules.levelFromXp,
  summary,
  learnerBundle,
  leaderboard,
  grantXp,
  grantActivity,
  grantExam,
  grantWelcomeXp,
  resetAllToWelcomeXp,
  WELCOME_XP,
  loadSettings,
  saveSettings,
};
