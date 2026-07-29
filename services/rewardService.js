/**
 * Reward engine (Phase 12) — % 5★ trên rating approved + minSample → payout draft → approve → ledger.
 *
 * Gate fixture: 10 HV, 8×5★, threshold 80%, amount 500_000 → qualifies 500_000.
 */
const RewardRule = require('../models/RewardRule');
const RewardPayout = require('../models/RewardPayout');
const Evaluation = require('../models/Evaluation');
const Teacher = require('../models/Teacher');
const { isPublicRating, extractStars } = require('./ratingLifecycleService');
const { postEntry } = require('./ledgerService');
const { writeAudit } = require('./auditLogService');
const NotificationService = require('./NotificationService');
const { DEEP_LINKS } = require('../constants/deepLinks');
const logger = require('../config/logger');

/**
 * Pure: thống kê 5★ từ danh sách rating (chỉ approved / legacy public).
 */
function computeFiveStarStats(ratings = []) {
  const approved = (ratings || []).filter((r) => {
    if (r.type && r.type !== 'teacher_rating') return false;
    return isPublicRating({ ...r, type: 'teacher_rating' });
  });
  const total = approved.length;
  let fiveStar = 0;
  for (const r of approved) {
    const stars = extractStars(r.criteria, r.stars);
    if (stars != null && stars >= 4.95) fiveStar += 1; // coi 5 / ~5
  }
  const pct = total > 0 ? Math.round((fiveStar / total) * 1000) / 10 : 0;
  return { total, fiveStar, pct };
}

function qualifiesForReward(stats, rule) {
  const minRatings = Number(rule.minRatings) || 0;
  const thresholdPct = Number(rule.thresholdPct) || 0;
  if ((stats.total || 0) < minRatings) return false;
  if ((stats.pct || 0) < thresholdPct) return false;
  return true;
}

function computeRewardAmount(stats, rule) {
  if (!qualifiesForReward(stats, rule)) return 0;
  return Math.max(0, Number(rule.amount) || 0);
}

/**
 * Period key helpers.
 * @param {Date} [date]
 */
function periodKeyFor(periodType, date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (periodType === 'year') return String(y);
  if (periodType === 'quarter') {
    const q = Math.ceil(m / 3);
    return `${y}-Q${q}`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function periodRange(periodType, periodKey) {
  // returns { from, to } inclusive-ish for query
  if (periodType === 'year') {
    const y = parseInt(periodKey, 10);
    return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
  }
  if (periodType === 'quarter') {
    const m = String(periodKey).match(/^(\d{4})-Q([1-4])$/i);
    if (!m) return null;
    const y = parseInt(m[1], 10);
    const q = parseInt(m[2], 10);
    const startMonth = (q - 1) * 3;
    return { from: new Date(y, startMonth, 1), to: new Date(y, startMonth + 3, 1) };
  }
  // month YYYY-MM
  const mm = String(periodKey).match(/^(\d{4})-(\d{2})$/);
  if (!mm) return null;
  const y = parseInt(mm[1], 10);
  const mo = parseInt(mm[2], 10) - 1;
  return { from: new Date(y, mo, 1), to: new Date(y, mo + 1, 1) };
}

/**
 * Aggregate approved ratings for teacher in period.
 */
async function loadTeacherRatingStats(teacherId, { from, to } = {}) {
  const filter = {
    type: 'teacher_rating',
    targetTeacherId: teacherId,
    $or: [
      { status: 'approved' },
      { status: { $exists: false } },
      { status: null },
    ],
  };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lt = to;
  }
  const rows = await Evaluation.find(filter).select('stars criteria status type').lean();
  return computeFiveStarStats(rows);
}

/**
 * Chạy job kỳ: tạo draft payout cho GV đạt rule (idempotent).
 */
async function runRewardPeriodJob({
  periodType = 'month',
  periodKey = null,
  branchId = null,
  ruleId = null,
  actor = {},
  io = null,
} = {}) {
  const key = periodKey || periodKeyFor(periodType);
  const range = periodRange(periodType, key);
  if (!range) {
    const err = new Error(`periodKey không hợp lệ: ${key}`);
    err.status = 400;
    throw err;
  }

  const ruleFilter = { active: true, period: periodType };
  if (ruleId) ruleFilter._id = ruleId;
  if (branchId) {
    ruleFilter.$or = [{ branchId }, { branchId: null }];
  }

  const rules = await RewardRule.find(ruleFilter).lean();
  const teacherFilter = {};
  if (branchId) teacherFilter.branchId = branchId;
  const teachers = await Teacher.find(teacherFilter).select('_id name branchId').lean();

  const created = [];
  const skipped = [];

  for (const rule of rules) {
    for (const teacher of teachers) {
      if (rule.branchId && teacher.branchId && String(rule.branchId) !== String(teacher.branchId)) {
        continue;
      }
      const stats = await loadTeacherRatingStats(teacher._id, range);
      const amount = computeRewardAmount(stats, rule);
      if (!(amount > 0)) {
        skipped.push({
          teacherId: teacher._id,
          ruleId: rule._id,
          reason: 'not_qualified',
          stats,
        });
        continue;
      }

      const idempotencyKey = `reward:${rule._id}:${teacher._id}:${key}`;
      try {
        const payout = await RewardPayout.create({
          ruleId: rule._id,
          teacherId: teacher._id,
          teacherName: teacher.name || '',
          branchId: teacher.branchId || rule.branchId || null,
          periodKey: key,
          periodType,
          metric: rule.metric || 'pct_5star',
          totalRatings: stats.total,
          fiveStarCount: stats.fiveStar,
          pct5Star: stats.pct,
          thresholdPct: rule.thresholdPct,
          minRatings: rule.minRatings,
          amount,
          status: 'draft',
          idempotencyKey,
          note: `Auto job ${key}: ${stats.fiveStar}/${stats.total} = ${stats.pct}% (≥${rule.thresholdPct}%, min ${rule.minRatings})`,
        });
        created.push(payout);

        try {
          await writeAudit({
            action: 'reward.draft',
            actorUserId: actor.id || 'system',
            actorRole: actor.role || 'system',
            branchId: payout.branchId,
            entityType: 'reward_payout',
            entityId: String(payout._id),
            teacherId: teacher._id,
            newValue: {
              amount,
              periodKey: key,
              pct5Star: stats.pct,
              totalRatings: stats.total,
            },
          });
        } catch { /* ignore */ }
      } catch (err) {
        if (err && err.code === 11000) {
          skipped.push({ teacherId: teacher._id, ruleId: rule._id, reason: 'already_exists' });
        } else {
          logger.warn('[reward] create payout: %s', err.message);
          skipped.push({ teacherId: teacher._id, ruleId: rule._id, reason: err.message });
        }
      }
    }
  }

  return { periodKey: key, periodType, created: created.length, skipped: skipped.length, drafts: created, skippedDetails: skipped };
}

/**
 * Admin approve draft → optional mark paid + ledger debit (chi thưởng).
 */
async function approveRewardPayout({
  payoutId,
  actor = {},
  markPaid = true,
  io = null,
  reqMeta = {},
  note = '',
}) {
  const payout = await RewardPayout.findById(payoutId);
  if (!payout) {
    const err = new Error('Không tìm thấy phiếu thưởng');
    err.status = 404;
    throw err;
  }
  if (payout.status !== 'draft' && payout.status !== 'approved') {
    const err = new Error(`Không thể duyệt phiếu trạng thái "${payout.status}"`);
    err.status = 400;
    throw err;
  }

  if (payout.status === 'draft') {
    payout.status = 'approved';
    payout.approvedBy = String(actor.id || actor.name || 'admin');
    payout.approvedAt = new Date();
    if (note) payout.note = String(note).slice(0, 500);
  }

  let ledgerEntry = null;
  if (markPaid && payout.status !== 'paid') {
    const { entry, created } = await postEntry({
      idempotencyKey: `reward:paid:${payout.idempotencyKey}`,
      type: 'adjustment',
      amount: payout.amount,
      studentId: null,
      branchId: payout.branchId || null,
      source: 'reward',
      sourceRef: String(payout._id),
      note: `Thưởng GV ${payout.teacherName} kỳ ${payout.periodKey}`,
      metadata: {
        direction: 'debit',
        teacherId: String(payout.teacherId),
        rewardPayoutId: String(payout._id),
        periodKey: payout.periodKey,
      },
      postedBy: actor.id || '',
      postedByRole: actor.role || '',
    });
    ledgerEntry = entry;
    payout.status = 'paid';
    payout.paidBy = String(actor.id || actor.name || 'admin');
    payout.paidAt = new Date();
    payout.ledgerEntryId = entry?._id || null;
    if (!created && entry) {
      // idempotent hit
      payout.ledgerEntryId = entry._id;
    }
  }

  await payout.save();

  try {
    await writeAudit({
      action: markPaid ? 'reward.payout' : 'reward.approve',
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || payout.branchId || null,
      entityType: 'reward_payout',
      entityId: String(payout._id),
      teacherId: payout.teacherId,
      newValue: {
        status: payout.status,
        amount: payout.amount,
        ledgerEntryId: payout.ledgerEntryId,
      },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[reward] audit: %s', err.message);
  }

  if (io && payout.teacherId) {
    try {
      await NotificationService.send(io, {
        type: 'FINANCE',
        title: '🎁 Thưởng đánh giá giảng viên',
        content: `Bạn được thưởng ${Number(payout.amount).toLocaleString('vi-VN')}đ kỳ ${payout.periodKey} (${payout.pct5Star}% 5★, n=${payout.totalRatings}).`,
        receivers: [String(payout.teacherId)],
        link: DEEP_LINKS.TEACHER_FINANCE || '/teacher/finance',
        eventId: `reward.paid:${payout._id}`,
        payload: { payoutId: String(payout._id), amount: payout.amount },
      });
    } catch (err) {
      logger.warn('[reward] notify: %s', err.message);
    }
  }

  return { payout, ledgerEntry };
}

async function rejectRewardPayout({ payoutId, actor = {}, reason = '', reqMeta = {} }) {
  const payout = await RewardPayout.findById(payoutId);
  if (!payout) {
    const err = new Error('Không tìm thấy phiếu thưởng');
    err.status = 404;
    throw err;
  }
  if (payout.status !== 'draft') {
    const err = new Error('Chỉ từ chối phiếu draft');
    err.status = 400;
    throw err;
  }
  payout.status = 'rejected';
  payout.note = String(reason || payout.note || 'Rejected').slice(0, 500);
  await payout.save();
  try {
    await writeAudit({
      action: 'reward.reject',
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || payout.branchId,
      entityType: 'reward_payout',
      entityId: String(payout._id),
      teacherId: payout.teacherId,
      newValue: { status: 'rejected', reason },
    });
  } catch { /* ignore */ }
  return payout;
}

module.exports = {
  computeFiveStarStats,
  qualifiesForReward,
  computeRewardAmount,
  periodKeyFor,
  periodRange,
  loadTeacherRatingStats,
  runRewardPeriodJob,
  approveRewardPayout,
  rejectRewardPayout,
};
