/**
 * Thưởng sao GV (tách khỏi lương cứng / buổi):
 * - Trong 1 tháng: hướng dẫn ≥ MIN_STUDENTS học viên (distinct, lịch completed)
 * - VÀ điểm sao trung bình cộng dồn từ đánh giá HV ≥ MIN_STARS
 * → thưởng BONUS_PER_MONTH (VNĐ) cho tháng đó (có thể tích nhiều tháng chưa chi).
 */

const mongoose = require('mongoose');
const Schedule = require('../../attendance/models/Schedule');
const Evaluation = require('../../exam/models/Evaluation');

const MIN_STUDENTS = 10;
const MIN_STARS = 5;
const BONUS_PER_MONTH = 200000;
const MAX_LOOKBACK_MONTHS = 24;

function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(String(id));
  return null;
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parseMonthKey(ym) {
  const [ys, ms] = String(ym).split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m || m < 1 || m > 12) return null;
  return { year: y, month: m, start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

function listMonthKeysInclusive(fromDate, toDate) {
  const keys = [];
  const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  while (cur <= end) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

function extractStars(criteria) {
  if (!criteria || typeof criteria !== 'object') return null;
  const n = Number(criteria.stars);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.max(0, n));
}

async function getCumulativeRating(teacherId) {
  const oid = toObjectId(teacherId);
  if (!oid) return { avgStars: 0, ratingCount: 0 };

  const evals = await Evaluation.find({
    targetTeacherId: oid,
    type: 'teacher_rating',
  }).select('criteria').lean();

  let sum = 0;
  let count = 0;
  for (const e of evals) {
    const s = extractStars(e.criteria);
    if (s == null) continue;
    sum += s;
    count += 1;
  }
  const avgStars = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
  return { avgStars, ratingCount: count };
}

async function countUniqueStudentsInMonth(teacherId, year, month) {
  const oid = toObjectId(teacherId);
  if (!oid) return 0;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const rows = await Schedule.aggregate([
    {
      $match: {
        teacherId: oid,
        status: 'completed',
        date: { $gte: start, $lt: end },
        studentId: { $ne: null },
      },
    },
    { $group: { _id: '$studentId' } },
    { $count: 'n' },
  ]);
  return rows[0]?.n || 0;
}

async function resolveLookbackStart(teacherId, teacher) {
  const oid = toObjectId(teacherId);
  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() - Math.min(MAX_LOOKBACK_MONTHS - 1, 11));

  let start = teacher?.startDate ? new Date(teacher.startDate) : null;
  if (!start || Number.isNaN(start.getTime())) {
    const first = oid
      ? await Schedule.findOne({ teacherId: oid, status: 'completed' })
          .sort({ date: 1 })
          .select('date')
          .lean()
      : null;
    start = first?.date ? new Date(first.date) : fallback;
  }

  const minStart = new Date();
  minStart.setMonth(minStart.getMonth() - (MAX_LOOKBACK_MONTHS - 1));
  minStart.setDate(1);
  minStart.setHours(0, 0, 0, 0);
  if (start < minStart) start = minStart;
  return start;
}

/**
 * @returns {Promise<{
 *   avgStars: number,
 *   ratingCount: number,
 *   minStudents: number,
 *   minStars: number,
 *   bonusPerMonth: number,
 *   unpaidMonths: Array<{ month: string, studentsCount: number, avgStars: number, amount: number, eligible: boolean }>,
 *   unpaidBonusTotal: number,
 *   ruleLabel: string,
 * }>}
 */
async function computeStarBonusSummary(teacher) {
  const teacherId = teacher?._id || teacher?.id;
  const paidSet = new Set(
    (Array.isArray(teacher?.starBonusPaidMonths) ? teacher.starBonusPaidMonths : [])
      .map(String)
  );

  const { avgStars, ratingCount } = await getCumulativeRating(teacherId);
  const starsOk = avgStars >= MIN_STARS;

  const from = await resolveLookbackStart(teacherId, teacher);
  const now = new Date();
  const monthKeys = listMonthKeysInclusive(from, now);

  const unpaidMonths = [];
  for (const ym of monthKeys) {
    if (paidSet.has(ym)) continue;
    const parsed = parseMonthKey(ym);
    if (!parsed) continue;
    const studentsCount = await countUniqueStudentsInMonth(teacherId, parsed.year, parsed.month);
    const eligible = studentsCount >= MIN_STUDENTS && starsOk;
    if (!eligible) continue;
    unpaidMonths.push({
      month: ym,
      studentsCount,
      avgStars,
      amount: BONUS_PER_MONTH,
      eligible: true,
    });
  }

  const unpaidBonusTotal = unpaidMonths.reduce((s, m) => s + m.amount, 0);

  return {
    avgStars,
    ratingCount,
    minStudents: MIN_STUDENTS,
    minStars: MIN_STARS,
    bonusPerMonth: BONUS_PER_MONTH,
    unpaidMonths,
    unpaidBonusTotal,
    ruleLabel: `≥${MIN_STUDENTS} HV/tháng và ≥${MIN_STARS}★ (cộng dồn) → thưởng ${BONUS_PER_MONTH.toLocaleString('vi-VN')}đ/tháng`,
  };
}

/**
 * Chọn các tháng thưởng sẽ chi trong lần thanh toán này.
 * @param {object} teacher
 * @param {string[]|null} requestedMonths — null = tất cả tháng đủ điều kiện chưa chi
 */
async function resolveBonusForPayout(teacher, requestedMonths = null) {
  const summary = await computeStarBonusSummary(teacher);
  let months = summary.unpaidMonths;
  if (Array.isArray(requestedMonths) && requestedMonths.length > 0) {
    const want = new Set(requestedMonths.map(String));
    months = months.filter((m) => want.has(m.month));
  }
  return {
    ...summary,
    payoutMonths: months.map((m) => m.month),
    payoutBonusAmount: months.reduce((s, m) => s + m.amount, 0),
  };
}

module.exports = {
  MIN_STUDENTS,
  MIN_STARS,
  BONUS_PER_MONTH,
  computeStarBonusSummary,
  resolveBonusForPayout,
  getCumulativeRating,
  monthKey,
};
