'use strict';

const mongoose = require('mongoose');
const SystemSettings = require('../models/SystemSettings');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');

const DEFAULT_REFERRAL_CONFIG = Object.freeze({
  enabled: true,
  discountAmountVnd: 50000,
  referrerRewardVnd: 50000,
  minOrderAmountVnd: 100000,
  applyToCourses: true,
  applyToAiPackages: false,
  maxReferralsPerStudent: 10,
  maxReferralsPerDay: 2,
  requireFinishedSession: false,
});

const CACHE_TTL_MS = 15 * 1000;
let cachedConfig = null;
let cachedAt = 0;

function clampInt(raw, fallback, min, max) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function sanitizeReferralConfig(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: src.enabled !== undefined ? Boolean(src.enabled) : DEFAULT_REFERRAL_CONFIG.enabled,
    discountAmountVnd: clampInt(src.discountAmountVnd, DEFAULT_REFERRAL_CONFIG.discountAmountVnd, 0, 5000000),
    referrerRewardVnd: clampInt(src.referrerRewardVnd, DEFAULT_REFERRAL_CONFIG.referrerRewardVnd, 0, 5000000),
    minOrderAmountVnd: clampInt(src.minOrderAmountVnd, DEFAULT_REFERRAL_CONFIG.minOrderAmountVnd, 0, 50000000),
    applyToCourses: src.applyToCourses !== undefined
      ? Boolean(src.applyToCourses)
      : DEFAULT_REFERRAL_CONFIG.applyToCourses,
    applyToAiPackages: src.applyToAiPackages !== undefined
      ? Boolean(src.applyToAiPackages)
      : DEFAULT_REFERRAL_CONFIG.applyToAiPackages,
    maxReferralsPerStudent: clampInt(
      src.maxReferralsPerStudent,
      DEFAULT_REFERRAL_CONFIG.maxReferralsPerStudent,
      1,
      500,
    ),
    maxReferralsPerDay: clampInt(
      src.maxReferralsPerDay,
      DEFAULT_REFERRAL_CONFIG.maxReferralsPerDay,
      1,
      50,
    ),
    requireFinishedSession: src.requireFinishedSession !== undefined
      ? Boolean(src.requireFinishedSession)
      : DEFAULT_REFERRAL_CONFIG.requireFinishedSession,
    updatedAt: src.updatedAt || null,
    updatedBy: String(src.updatedBy || ''),
  };
}

function formatShortVnd(amount) {
  const val = Math.max(0, Math.round(Number(amount) || 0));
  if (val === 0) return '0đ';
  if (val >= 1000 && val % 1000 === 0) return `${val / 1000}K`;
  return `${val.toLocaleString('vi-VN')}đ`;
}

function calculateReferralDiscount({
  basePrice = 0,
  availableDiscountVnd = 0,
  config = DEFAULT_REFERRAL_CONFIG,
  target = 'course',
} = {}) {
  const safeBase = Math.max(0, Math.round(Number(basePrice) || 0));
  const safeAvail = Math.max(0, Math.round(Number(availableDiscountVnd) || 0));
  const cfg = sanitizeReferralConfig(config);

  if (!cfg.enabled || safeBase <= 0 || safeAvail <= 0) {
    return { basePrice: safeBase, appliedDiscountVnd: 0, finalAmount: safeBase };
  }
  if (target === 'course' && !cfg.applyToCourses) {
    return { basePrice: safeBase, appliedDiscountVnd: 0, finalAmount: safeBase };
  }
  if (target === 'ai_package' && !cfg.applyToAiPackages) {
    return { basePrice: safeBase, appliedDiscountVnd: 0, finalAmount: safeBase };
  }
  if (safeBase < cfg.minOrderAmountVnd) {
    return { basePrice: safeBase, appliedDiscountVnd: 0, finalAmount: safeBase };
  }

  const perOrderCap = Math.max(cfg.discountAmountVnd, cfg.referrerRewardVnd);
  if (perOrderCap <= 0) {
    return { basePrice: safeBase, appliedDiscountVnd: 0, finalAmount: safeBase };
  }

  const maxAllowable = safeBase > 10000 ? safeBase - 10000 : 0;
  const appliedDiscountVnd = Math.max(0, Math.min(safeAvail, perOrderCap, maxAllowable));
  return {
    basePrice: safeBase,
    appliedDiscountVnd,
    finalAmount: safeBase - appliedDiscountVnd,
  };
}

function invalidateReferralConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

async function getReferralConfig({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }
  const settings = await SystemSettings.findOne({ _key: 'main' })
    .select('referralSettings')
    .lean();
  const normalized = sanitizeReferralConfig(settings?.referralSettings || {});
  cachedConfig = normalized;
  cachedAt = now;
  return normalized;
}

async function saveReferralConfig(payload = {}, actor = null) {
  const actorName = typeof actor === 'string'
    ? actor
    : String(actor?.name || actor?.username || actor?.id || actor?._id || '').trim();
  const next = sanitizeReferralConfig({
    ...payload,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  });
  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    { $set: { referralSettings: next } },
    { upsert: true },
  );
  cachedConfig = next;
  cachedAt = Date.now();
  return next;
}

async function resetReferralConfig(actor = null) {
  const actorName = typeof actor === 'string'
    ? actor
    : String(actor?.name || actor?.username || actor?.id || actor?._id || '').trim();
  const next = sanitizeReferralConfig({
    ...DEFAULT_REFERRAL_CONFIG,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  });
  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    { $set: { referralSettings: next } },
    { upsert: true },
  );
  cachedConfig = next;
  cachedAt = Date.now();
  return next;
}

async function getReferralStats() {
  const [agg] = await DailyPracticeProfile.aggregate([
    {
      $group: {
        _id: null,
        totalReferredStudents: {
          $sum: {
            $cond: [{ $ifNull: ['$referredByStudentId', false] }, 1, 0],
          },
        },
        totalAvailableDiscountVnd: { $sum: { $ifNull: ['$referralDiscountAvailableVnd', 0] } },
        totalUsedDiscountVnd: { $sum: { $ifNull: ['$referralDiscountUsedVnd', 0] } },
        totalEarnedDiscountVnd: { $sum: { $ifNull: ['$referralDiscountEarnedVnd', 0] } },
      },
    },
  ]);

  return {
    totalReferredStudents: Number(agg?.totalReferredStudents) || 0,
    totalAvailableDiscountVnd: Number(agg?.totalAvailableDiscountVnd) || 0,
    totalUsedDiscountVnd: Number(agg?.totalUsedDiscountVnd) || 0,
    totalEarnedDiscountVnd: Number(agg?.totalEarnedDiscountVnd) || 0,
  };
}

async function consumeStudentReferralDiscount(studentId, discountVnd, sessionId = '') {
  const amount = Math.max(0, Math.round(Number(discountVnd) || 0));
  const sidStr = String(sessionId || '').trim();
  if (!amount || !studentId || !mongoose.Types.ObjectId.isValid(String(studentId))) {
    return { consumed: false, appliedVnd: 0 };
  }

  const sid = new mongoose.Types.ObjectId(String(studentId));
  const filter = { studentId: sid };
  if (sidStr) {
    filter.referralDiscountConsumedSessions = { $ne: sidStr };
  }

  const profile = await DailyPracticeProfile.findOne(filter)
    .select('_id referralDiscountAvailableVnd referralDiscountUsedVnd')
    .lean();
  if (!profile) {
    return { consumed: false, appliedVnd: 0 };
  }

  const available = Math.max(0, Math.round(Number(profile.referralDiscountAvailableVnd) || 0));
  const deduct = Math.min(available, amount);
  const nextAvailable = Math.max(0, available - deduct);

  const update = {
    $set: { referralDiscountAvailableVnd: nextAvailable },
    $inc: { referralDiscountUsedVnd: deduct },
  };
  if (sidStr) {
    update.$addToSet = { referralDiscountConsumedSessions: sidStr };
  }

  const res = await DailyPracticeProfile.updateOne(filter, update);
  return {
    consumed: Boolean(res?.modifiedCount),
    appliedVnd: deduct,
    remainingVnd: nextAvailable,
  };
}

module.exports = {
  DEFAULT_REFERRAL_CONFIG,
  sanitizeReferralConfig,
  formatShortVnd,
  calculateReferralDiscount,
  invalidateReferralConfigCache,
  getReferralConfig,
  saveReferralConfig,
  resetReferralConfig,
  getReferralStats,
  consumeStudentReferralDiscount,
};
