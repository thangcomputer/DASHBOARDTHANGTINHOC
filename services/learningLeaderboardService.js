'use strict';

const mongoose = require('mongoose');
const LearningGoal = require('../models/LearningGoal');
const StudyTimeLog = require('../models/StudyTimeLog');
const Student = require('../models/Student');
const { vnDayKey } = require('./learningGoalService');

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const TOP_SIZE = 5;
const CACHE_MS = 60 * 1000;

let cache = { key: '', at: 0, rows: [] };

/** Tuần hiện tại theo giờ Việt Nam, bắt đầu thứ Hai. */
function vnWeek(now = new Date()) {
  const todayKey = vnDayKey(now);
  const todayStart = Date.parse(`${todayKey}T00:00:00+07:00`);
  const dow = new Date(todayStart + VN_OFFSET_MS).getUTCDay();
  const offset = (dow + 6) % 7;
  const start = todayStart - offset * DAY_MS;
  const days = Array.from({ length: 7 }, (_, i) => vnDayKey(new Date(start + i * DAY_MS)));
  return {
    startKey: days[0],
    endKey: days[6],
    start: new Date(start),
    end: new Date(start + 7 * DAY_MS),
    daysSoFar: offset + 1,
  };
}

/** "Nguyễn Văn An" → "Nguyễn V. An" - đủ nhận ra nhau mà không lộ họ tên đầy đủ. */
function shortName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ') || 'Học viên';
  const middle = parts.slice(1, -1).map((part) => `${part[0].toUpperCase()}.`).join(' ');
  return `${parts[0]} ${middle} ${parts[parts.length - 1]}`;
}

function scoreRow(goal, logs) {
  const target = goal.hoursPerDay * 60;
  const goalStart = vnDayKey(new Date(goal.startedAt));
  const goalEnd = vnDayKey(new Date(new Date(goal.endsAt).getTime() - 1));
  let goalDays = 0;
  let minutes = 0;
  for (const log of logs) {
    minutes += log.minutes || 0;
    if (log.day >= goalStart && log.day <= goalEnd && (log.minutes || 0) >= target) goalDays += 1;
  }
  return { studentId: String(goal.studentId), hoursPerDay: goal.hoursPerDay, goalDays, minutes };
}

/** Hơn nhau: nhiều ngày đạt mục tiêu hơn, bằng nhau thì nhiều phút học hơn. */
function isBetter(a, b) {
  return a.goalDays > b.goalDays || (a.goalDays === b.goalDays && a.minutes > b.minutes);
}

function compareRows(a, b) {
  return b.goalDays - a.goalDays || b.minutes - a.minutes;
}

async function weekGoals(week, filter = {}) {
  return LearningGoal.find({ ...filter, startedAt: { $lt: week.end }, endsAt: { $gt: week.start } })
    .select('studentId hoursPerDay startedAt endsAt')
    .lean();
}

/** XP luyện tập hằng ngày trong tuần - hiển thị kèm, không dùng để xếp hạng. */
async function weekXp(week, studentIds) {
  if (!studentIds.length) return new Map();
  const dailyPracticeService = require('./dailyPracticeService');
  return dailyPracticeService.xpByStudent(week.start, week.end, studentIds);
}

async function weekLogs(week, filter = {}) {
  return StudyTimeLog.find({ ...filter, day: { $gte: week.startKey, $lte: week.endKey }, minutes: { $gt: 0 } })
    .select('studentId day minutes')
    .lean();
}

/** Xếp hạng toàn trung tâm (chỉ HV có mục tiêu và đã học trong tuần), cache 60 giây. */
async function rankedRows(week, now = Date.now()) {
  if (cache.key === week.startKey && now - cache.at < CACHE_MS) return cache.rows;
  const [goals, logs] = await Promise.all([weekGoals(week), weekLogs(week)]);
  const logsByStudent = new Map();
  for (const log of logs) {
    const id = String(log.studentId);
    if (!logsByStudent.has(id)) logsByStudent.set(id, []);
    logsByStudent.get(id).push(log);
  }
  const rows = goals
    .map((goal) => scoreRow(goal, logsByStudent.get(String(goal.studentId)) || []))
    .filter((row) => row.minutes > 0);
  const [students, xpMap] = await Promise.all([
    Student.find({ _id: { $in: rows.map((row) => row.studentId) } }).select('name avatar').lean(),
    weekXp(week, rows.map((row) => row.studentId)),
  ]);
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const ranked = rows
    .filter((row) => byId.has(row.studentId))
    .map((row) => ({
      ...row,
      xp: xpMap.get(row.studentId) || 0,
      name: shortName(byId.get(row.studentId).name),
      avatar: byId.get(row.studentId).avatar || '',
    }))
    .sort(compareRows);
  cache = { key: week.startKey, at: now, rows: ranked };
  return ranked;
}

function rankOf(row, others) {
  return 1 + others.filter((other) => other.studentId !== row.studentId && isBetter(other, row)).length;
}

async function getWeeklyLeaderboard(studentId, now = new Date()) {
  if (!mongoose.Types.ObjectId.isValid(String(studentId || ''))) {
    const err = new Error('Học viên không hợp lệ');
    err.status = 400;
    throw err;
  }
  const week = vnWeek(now);
  const rows = await rankedRows(week, now.getTime());
  const myId = String(studentId);

  const [myGoal] = await weekGoals(week, { studentId });
  const myXp = (await weekXp(week, [myId])).get(myId) || 0;
  let me = { hasGoal: Boolean(myGoal), rank: null, goalDays: 0, minutes: 0, xp: myXp, hoursPerDay: myGoal?.hoursPerDay || 0, ahead: null };
  let others = rows.filter((row) => row.studentId !== myId);
  if (myGoal) {
    const mine = { ...scoreRow(myGoal, await weekLogs(week, { studentId })), xp: myXp };
    me = { ...me, goalDays: mine.goalDays, minutes: mine.minutes };
    if (mine.minutes > 0) {
      me.rank = rankOf(mine, others);
      const better = others.filter((row) => isBetter(row, mine)).sort(compareRows);
      const next = better[better.length - 1];
      me.ahead = next ? { rank: rankOf(next, [...others, mine]), goalDays: next.goalDays, minutes: next.minutes } : null;
      const self = rows.find((row) => row.studentId === myId)
        || await Student.findById(studentId).select('name avatar').lean()
          .then((s) => ({ name: shortName(s?.name), avatar: s?.avatar || '' }));
      others = [...others, { ...mine, name: self.name, avatar: self.avatar || '' }];
    }
  }

  const board = others.sort(compareRows);
  const top = board.slice(0, TOP_SIZE).map((row) => ({
    rank: rankOf(row, board),
    name: row.name,
    avatar: row.avatar,
    goalDays: row.goalDays,
    minutes: row.minutes,
    xp: row.xp || 0,
    hoursPerDay: row.hoursPerDay,
    isMe: row.studentId === myId,
  }));

  return {
    weekStart: week.startKey,
    weekEnd: week.endKey,
    daysSoFar: week.daysSoFar,
    participants: board.length,
    top,
    me,
  };
}

function resetLeaderboardCache() {
  cache = { key: '', at: 0, rows: [] };
}

module.exports = { vnWeek, shortName, getWeeklyLeaderboard, resetLeaderboardCache };
