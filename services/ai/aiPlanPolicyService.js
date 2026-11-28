'use strict';

const mongoose = require('mongoose');
const SystemSettings = require('../../models/SystemSettings');

const PLAN_TIER_KEYS = ['free', '1d', '1m', '3m', '6m', '12m', 'course_student'];
const PAID_AI_PLAN_KEYS = new Set(['1d', '1m', '3m', '6m', '12m']);

const ALLOWED_MODELS = {
  lite: ['gemini-3.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-flash-lite-latest'],
  standard: ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.8-flash'],
  fileFlash: ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.8-flash'],
  filePro: ['gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'],
};

const NON_CHAT_AGENT_RE = /antigravity|deep.?research|computer.?use/i;
const CACHE_TTL_MS = 30 * 1000;

const DEFAULT_TIERS = {
  free: {
    label: 'Miễn phí (Chưa mua gói)',
    liteModel: 'gemini-3.5-flash-lite',
    standardModel: 'gemini-3.6-flash',
    fileFlashModel: 'gemini-3.6-flash',
    fileProModel: 'gemini-3.1-pro-preview',
    allow38Fallback: false,
    standardDailyLimit: 0,
    imageDailyLimit: 0,
    fileFlashDailyLimit: 0,
    fileProDailyLimit: 0,
    fileProThinkingBudget: 0,
    fairUseDailySoftCap: 10,
    fairUseMaxTokens: 600,
    normalMaxTokens: 900,
    standardMaxTokens: 900,
    fileMaxTokens: 900,
    maxAttachmentChars: 3000,
    maxHistoryMessages: 4,
    rateLimitPerMinute: 4,
  },
  '1d': {
    label: 'Gói 1 Ngày',
    liteModel: 'gemini-3.5-flash-lite',
    standardModel: 'gemini-3.6-flash',
    fileFlashModel: 'gemini-3.6-flash',
    fileProModel: 'gemini-3.1-pro-preview',
    allow38Fallback: false,
    standardDailyLimit: 15,
    imageDailyLimit: 5,
    fileFlashDailyLimit: 5,
    fileProDailyLimit: 0,
    fileProThinkingBudget: 0,
    fairUseDailySoftCap: 120,
    fairUseMaxTokens: 700,
    normalMaxTokens: 1150,
    standardMaxTokens: 1500,
    fileMaxTokens: 2800,
    maxAttachmentChars: 6000,
    maxHistoryMessages: 5,
    rateLimitPerMinute: 8,
  },
  '1m': {
    label: 'Gói Tiêu Chuẩn · 1 Tháng',
    liteModel: 'gemini-3.5-flash-lite',
    standardModel: 'gemini-3.6-flash',
    fileFlashModel: 'gemini-3.6-flash',
    fileProModel: 'gemini-3.1-pro-preview',
    allow38Fallback: false,
    standardDailyLimit: 15,
    imageDailyLimit: 8,
    fileFlashDailyLimit: 3,
    fileProDailyLimit: 0,
    fileProThinkingBudget: 0,
    fairUseDailySoftCap: 100,
    fairUseMaxTokens: 700,
    normalMaxTokens: 1150,
    standardMaxTokens: 1500,
    fileMaxTokens: 2800,
    maxAttachmentChars: 6000,
    maxHistoryMessages: 5,
    rateLimitPerMinute: 8,
  },
  '3m': {
    label: 'Gói Tiêu Chuẩn · 3 Tháng',
    liteModel: 'gemini-3.5-flash-lite',
    standardModel: 'gemini-3.6-flash',
    fileFlashModel: 'gemini-3.6-flash',
    fileProModel: 'gemini-3.1-pro-preview',
    allow38Fallback: false,
    standardDailyLimit: 20,
    imageDailyLimit: 10,
    fileFlashDailyLimit: 5,
    fileProDailyLimit: 2,
    fileProThinkingBudget: 1024,
    fairUseDailySoftCap: 120,
    fairUseMaxTokens: 750,
    normalMaxTokens: 1150,
    standardMaxTokens: 1500,
    fileMaxTokens: 3500,
    maxAttachmentChars: 10000,
    maxHistoryMessages: 6,
    rateLimitPerMinute: 8,
  },
  '6m': {
    label: 'Gói Dài Hạn · 6 Tháng',
    liteModel: 'gemini-3.5-flash-lite',
    standardModel: 'gemini-3.6-flash',
    fileFlashModel: 'gemini-3.6-flash',
    fileProModel: 'gemini-3.1-pro-preview',
    allow38Fallback: true,
    standardDailyLimit: 30,
    imageDailyLimit: 15,
    fileFlashDailyLimit: 8,
    fileProDailyLimit: 4,
    fileProThinkingBudget: 1536,
    fairUseDailySoftCap: 150,
    fairUseMaxTokens: 800,
    normalMaxTokens: 1200,
    standardMaxTokens: 1600,
    fileMaxTokens: 4096,
    maxAttachmentChars: 15000,
    maxHistoryMessages: 6,
    rateLimitPerMinute: 10,
  },
  '12m': {
    label: 'Gói Dài Hạn · 12 Tháng',
    liteModel: 'gemini-3.5-flash-lite',
    standardModel: 'gemini-3.6-flash',
    fileFlashModel: 'gemini-3.6-flash',
    fileProModel: 'gemini-3.1-pro-preview',
    allow38Fallback: true,
    standardDailyLimit: 40,
    imageDailyLimit: 20,
    fileFlashDailyLimit: 12,
    fileProDailyLimit: 6,
    fileProThinkingBudget: 2048,
    fairUseDailySoftCap: 200,
    fairUseMaxTokens: 900,
    normalMaxTokens: 1300,
    standardMaxTokens: 1800,
    fileMaxTokens: 4096,
    maxAttachmentChars: 15000,
    maxHistoryMessages: 6,
    rateLimitPerMinute: 10,
  },
  course_student: {
    label: 'HV Khóa học / Trung tâm (Mặc định)',
    liteModel: 'gemini-3.5-flash-lite',
    standardModel: 'gemini-3.6-flash',
    fileFlashModel: 'gemini-3.6-flash',
    fileProModel: 'gemini-3.1-pro-preview',
    allow38Fallback: true,
    standardDailyLimit: 20,
    imageDailyLimit: 5,
    fileFlashDailyLimit: 5,
    fileProDailyLimit: 3,
    fileProThinkingBudget: 2048,
    fairUseDailySoftCap: 120,
    fairUseMaxTokens: 800,
    normalMaxTokens: 1150,
    standardMaxTokens: 1500,
    fileMaxTokens: 4096,
    maxAttachmentChars: 28000,
    maxHistoryMessages: 8,
    rateLimitPerMinute: 10,
  },
};

const DEFAULT_AI_PLAN_MODEL_POLICY = Object.freeze({
  tiers: DEFAULT_TIERS,
  updatedAt: null,
  updatedBy: '',
  updatedByName: '',
});

let cachedPolicy = null;
let cachedAtMs = 0;

/** @type {Map<string, number[]>} */
const perMinuteHits = new Map();

function uniqueList(items) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const val = String(raw || '').trim();
    if (!val || seen.has(val)) continue;
    seen.add(val);
    out.push(val);
  }
  return out;
}

function clampInt(val, min, max, fallback) {
  if (val === '' || val === null || val === undefined) return fallback;
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pickAllowedModel(rawModel, allowedList, fallback) {
  const candidate = String(rawModel || '').trim();
  if (!candidate || NON_CHAT_AGENT_RE.test(candidate)) return fallback;
  return allowedList.includes(candidate) ? candidate : fallback;
}

function cloneDefaultPolicy() {
  const tiers = {};
  for (const key of PLAN_TIER_KEYS) {
    tiers[key] = { ...DEFAULT_TIERS[key] };
  }
  return {
    tiers,
    updatedAt: null,
    updatedBy: '',
    updatedByName: '',
  };
}

function normalizeTier(tierKey, rawTier = {}) {
  const base = DEFAULT_TIERS[tierKey] || DEFAULT_TIERS['1m'];
  const src = rawTier && typeof rawTier === 'object' ? rawTier : {};
  const label = String(src.label || base.label).trim().slice(0, 80) || base.label;

  return {
    label,
    liteModel: pickAllowedModel(src.liteModel, ALLOWED_MODELS.lite, base.liteModel),
    standardModel: pickAllowedModel(src.standardModel, ALLOWED_MODELS.standard, base.standardModel),
    fileFlashModel: pickAllowedModel(src.fileFlashModel, ALLOWED_MODELS.fileFlash, base.fileFlashModel),
    fileProModel: pickAllowedModel(src.fileProModel, ALLOWED_MODELS.filePro, base.fileProModel),
    allow38Fallback: typeof src.allow38Fallback === 'boolean' ? src.allow38Fallback : base.allow38Fallback,
    standardDailyLimit: clampInt(src.standardDailyLimit, 0, 500, base.standardDailyLimit),
    imageDailyLimit: clampInt(src.imageDailyLimit, 0, 200, base.imageDailyLimit),
    fileFlashDailyLimit: clampInt(src.fileFlashDailyLimit, 0, 200, base.fileFlashDailyLimit),
    fileProDailyLimit: clampInt(src.fileProDailyLimit, 0, 100, base.fileProDailyLimit),
    fileProThinkingBudget: clampInt(src.fileProThinkingBudget, 0, 4096, base.fileProThinkingBudget),
    fairUseDailySoftCap: clampInt(src.fairUseDailySoftCap, 0, 2000, base.fairUseDailySoftCap),
    fairUseMaxTokens: clampInt(src.fairUseMaxTokens, 300, 4096, base.fairUseMaxTokens),
    normalMaxTokens: clampInt(src.normalMaxTokens, 400, 4096, base.normalMaxTokens),
    standardMaxTokens: clampInt(src.standardMaxTokens, 500, 4096, base.standardMaxTokens),
    fileMaxTokens: clampInt(src.fileMaxTokens, 600, 8192, base.fileMaxTokens),
    maxAttachmentChars: clampInt(src.maxAttachmentChars, 1000, 40000, base.maxAttachmentChars),
    maxHistoryMessages: clampInt(src.maxHistoryMessages, 2, 12, base.maxHistoryMessages),
    rateLimitPerMinute: clampInt(src.rateLimitPerMinute, 0, 60, base.rateLimitPerMinute),
  };
}

function normalizeAiPlanModelPolicy(raw = null) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const rawTiers = input.tiers && typeof input.tiers === 'object' ? input.tiers : input;
  const tiers = {};
  for (const key of PLAN_TIER_KEYS) {
    tiers[key] = normalizeTier(key, rawTiers[key]);
  }
  return {
    tiers,
    updatedAt: input.updatedAt ? new Date(input.updatedAt).toISOString() : null,
    updatedBy: String(input.updatedBy || '').trim().slice(0, 80),
    updatedByName: String(input.updatedByName || '').trim().slice(0, 120),
  };
}

function invalidateAiPlanPolicyCache() {
  cachedPolicy = null;
  cachedAtMs = 0;
}

function getCachedAiPlanModelPolicySync() {
  if (cachedPolicy && (Date.now() - cachedAtMs) < CACHE_TTL_MS) {
    return cachedPolicy;
  }
  return cloneDefaultPolicy();
}

async function getAiPlanModelPolicy({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedPolicy && (now - cachedAtMs) < CACHE_TTL_MS) {
    return cachedPolicy;
  }
  const canQueryDb = Boolean(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);
  if (!canQueryDb) {
    const fallback = cloneDefaultPolicy();
    cachedPolicy = fallback;
    cachedAtMs = now;
    return fallback;
  }
  try {
    const doc = await SystemSettings.findOne({ _key: 'main' })
      .select('aiPlanModelPolicy')
      .lean();
    const normalized = normalizeAiPlanModelPolicy(doc?.aiPlanModelPolicy || null);
    cachedPolicy = normalized;
    cachedAtMs = Date.now();
    return normalized;
  } catch {
    return cachedPolicy || cloneDefaultPolicy();
  }
}

async function saveAiPlanModelPolicy(rawPolicy, actor = {}) {
  const normalized = normalizeAiPlanModelPolicy(rawPolicy);
  const storedPayload = {
    tiers: normalized.tiers,
    updatedAt: new Date(),
    updatedBy: String(actor?.id || actor?._id || '').trim().slice(0, 80),
    updatedByName: String(actor?.name || 'Admin').trim().slice(0, 120),
  };
  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    { $set: { aiPlanModelPolicy: storedPayload } },
    { upsert: true, returnDocument: 'after' },
  );
  const next = normalizeAiPlanModelPolicy(storedPayload);
  cachedPolicy = next;
  cachedAtMs = Date.now();
  return next;
}

async function resetAiPlanModelPolicy(actor = {}) {
  const defaults = cloneDefaultPolicy();
  const storedPayload = {
    tiers: defaults.tiers,
    updatedAt: new Date(),
    updatedBy: String(actor?.id || actor?._id || '').trim().slice(0, 80),
    updatedByName: String(actor?.name || 'Admin').trim().slice(0, 120),
  };
  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    { $set: { aiPlanModelPolicy: storedPayload } },
    { upsert: true, returnDocument: 'after' },
  );
  const next = normalizeAiPlanModelPolicy(storedPayload);
  cachedPolicy = next;
  cachedAtMs = Date.now();
  return next;
}

function hasValidAiPlanRecord(user) {
  const plan = user?.aiPlan;
  if (!plan || !plan.isUnlimited || !plan.expiresAt) return false;
  const ms = new Date(plan.expiresAt).getTime();
  return Number.isFinite(ms) && ms > Date.now();
}

function resolveStudentPlanTier(user, { isFreeStudent = false, hasActivePlan = false } = {}) {
  if (!user || typeof user !== 'object') return null;
  const role = String(user.role || '').trim().toLowerCase();
  if (role && role !== 'student') return null;

  const active = Boolean(hasActivePlan || hasValidAiPlanRecord(user));
  if (active) {
    const rawPlan = String(user?.aiPlan?.plan || '').trim().toLowerCase();
    return PAID_AI_PLAN_KEYS.has(rawPlan) ? rawPlan : '1m';
  }
  if (isFreeStudent) return 'free';
  return 'course_student';
}

function resolvePlanRouting({
  tier,
  task = 'qa_simple',
  hasImage = false,
  hasFile = false,
  usage = {},
  policy = null,
} = {}) {
  const activePolicy = policy && policy.tiers ? policy : getCachedAiPlanModelPolicySync();
  const tierKey = PLAN_TIER_KEYS.includes(tier) ? tier : 'course_student';
  const tierPolicy = activePolicy.tiers[tierKey] || DEFAULT_TIERS[tierKey];
  const isSupport = String(task || '').startsWith('support_');

  const totalCount = Math.max(0, Number(usage?.totalCount) || 0);
  const standardCount = Math.max(0, Number(usage?.standardCount) || 0);
  const imageCount = Math.max(0, Number(usage?.imageCount) || 0);
  const fileFlashCount = Math.max(0, Number(usage?.fileFlashCount) || 0);
  const fileProCount = Math.max(0, Number(usage?.fileProCount) || 0);

  const isFairUseThrottled = tierPolicy.fairUseDailySoftCap > 0 && totalCount >= tierPolicy.fairUseDailySoftCap;

  if (isFairUseThrottled) {
    return {
      tier: tierKey,
      tierPolicy,
      bucket: 'lite',
      models: uniqueList([tierPolicy.liteModel, 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: tierPolicy.fairUseMaxTokens,
      temperature: 0.3,
      timeoutMs: 14000,
      isFairUseThrottled: true,
      downgradedReason: 'fair_use_cap',
      maxAttachmentChars: tierPolicy.maxAttachmentChars,
      maxHistoryMessages: tierPolicy.maxHistoryMessages,
    };
  }

  if (task === 'qa_file_solve' || hasFile) {
    if (tierPolicy.fileProDailyLimit > 0 && fileProCount < tierPolicy.fileProDailyLimit) {
      return {
        tier: tierKey,
        tierPolicy,
        bucket: 'file_pro',
        models: uniqueList([
          tierPolicy.fileProModel,
          ...(tierPolicy.allow38Fallback ? ['gemini-3.8-flash', 'gemini-3.7-flash'] : []),
          tierPolicy.fileFlashModel,
          'gemini-2.5-flash',
          'gemini-2.0-flash-lite',
        ]),
        thinkingBudget: tierPolicy.fileProThinkingBudget,
        maxTokens: tierPolicy.fileMaxTokens,
        temperature: 0.1,
        timeoutMs: 45000,
        isFairUseThrottled: false,
        downgradedReason: '',
        maxAttachmentChars: tierPolicy.maxAttachmentChars,
        maxHistoryMessages: tierPolicy.maxHistoryMessages,
      };
    }

    if (tierPolicy.fileFlashDailyLimit > 0 && fileFlashCount < tierPolicy.fileFlashDailyLimit) {
      return {
        tier: tierKey,
        tierPolicy,
        bucket: 'file_flash',
        models: uniqueList([
          tierPolicy.fileFlashModel,
          ...(tierPolicy.allow38Fallback ? ['gemini-3.8-flash'] : []),
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
        ]),
        thinkingBudget: 0,
        maxTokens: Math.min(tierPolicy.fileMaxTokens, 3200),
        temperature: 0.15,
        timeoutMs: 28000,
        isFairUseThrottled: false,
        downgradedReason: tierPolicy.fileProDailyLimit > 0 ? 'file_pro_exhausted' : 'plan_file_flash',
        maxAttachmentChars: tierPolicy.maxAttachmentChars,
        maxHistoryMessages: tierPolicy.maxHistoryMessages,
      };
    }

    return {
      tier: tierKey,
      tierPolicy,
      bucket: 'lite',
      models: uniqueList([tierPolicy.liteModel, 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: tierPolicy.normalMaxTokens,
      temperature: 0.2,
      timeoutMs: 18000,
      isFairUseThrottled: false,
      downgradedReason: 'file_quota_downgraded_to_lite',
      maxAttachmentChars: tierPolicy.maxAttachmentChars,
      maxHistoryMessages: tierPolicy.maxHistoryMessages,
    };
  }

  if (['qa_vision', 'qa_complex', 'support_vision', 'support_complex'].includes(task)) {
    const imageOk = !hasImage || (tierPolicy.imageDailyLimit > 0 && imageCount < tierPolicy.imageDailyLimit);
    const stdOk = tierPolicy.standardDailyLimit > 0 && standardCount < tierPolicy.standardDailyLimit;

    if (imageOk && stdOk) {
      return {
        tier: tierKey,
        tierPolicy,
        bucket: 'standard',
        models: uniqueList([
          tierPolicy.standardModel,
          ...(tierPolicy.allow38Fallback ? ['gemini-3.8-flash'] : []),
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
        ]),
        thinkingBudget: 0,
        maxTokens: tierPolicy.standardMaxTokens,
        temperature: isSupport ? 0.35 : 0.3,
        timeoutMs: hasImage ? 22000 : 18000,
        isFairUseThrottled: false,
        downgradedReason: '',
        maxAttachmentChars: tierPolicy.maxAttachmentChars,
        maxHistoryMessages: tierPolicy.maxHistoryMessages,
      };
    }

    return {
      tier: tierKey,
      tierPolicy,
      bucket: 'lite',
      models: uniqueList([tierPolicy.liteModel, 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: tierPolicy.normalMaxTokens,
      temperature: 0.3,
      timeoutMs: 14000,
      isFairUseThrottled: false,
      downgradedReason: !imageOk ? 'image_priority_exhausted' : 'standard_priority_exhausted',
      maxAttachmentChars: tierPolicy.maxAttachmentChars,
      maxHistoryMessages: tierPolicy.maxHistoryMessages,
    };
  }

  return {
    tier: tierKey,
    tierPolicy,
    bucket: 'lite',
    models: uniqueList([
      tierPolicy.liteModel,
      'gemini-flash-lite-latest',
      tierPolicy.standardModel,
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
    ]),
    thinkingBudget: 0,
    maxTokens: tierPolicy.normalMaxTokens,
    temperature: isSupport ? 0.35 : 0.3,
    timeoutMs: 12000,
    isFairUseThrottled: false,
    downgradedReason: '',
    maxAttachmentChars: tierPolicy.maxAttachmentChars,
    maxHistoryMessages: tierPolicy.maxHistoryMessages,
  };
}

function formatPlanModelQuotaSummary({ tier, usage = {}, policy = null, date = '' } = {}) {
  const activePolicy = policy && policy.tiers ? policy : getCachedAiPlanModelPolicySync();
  const tierKey = PLAN_TIER_KEYS.includes(tier) ? tier : 'course_student';
  const tierPolicy = activePolicy.tiers[tierKey] || DEFAULT_TIERS[tierKey];

  const totalUsed = Math.max(0, Number(usage?.totalCount) || 0);
  const stdUsed = Math.max(0, Number(usage?.standardCount) || 0);
  const imgUsed = Math.max(0, Number(usage?.imageCount) || 0);
  const fileFlashUsed = Math.max(0, Number(usage?.fileFlashCount) || 0);
  const fileProUsed = Math.max(0, Number(usage?.fileProCount) || 0);

  return {
    tier: tierKey,
    label: tierPolicy.label,
    date: String(date || ''),
    totalUsed,
    fairUseSoftCap: tierPolicy.fairUseDailySoftCap,
    fairUseThrottled: tierPolicy.fairUseDailySoftCap > 0 && totalUsed >= tierPolicy.fairUseDailySoftCap,
    standard: {
      used: stdUsed,
      limit: tierPolicy.standardDailyLimit,
      remaining: Math.max(0, tierPolicy.standardDailyLimit - stdUsed),
      model: tierPolicy.standardModel,
    },
    image: {
      used: imgUsed,
      limit: tierPolicy.imageDailyLimit,
      remaining: Math.max(0, tierPolicy.imageDailyLimit - imgUsed),
    },
    fileFlash: {
      used: fileFlashUsed,
      limit: tierPolicy.fileFlashDailyLimit,
      remaining: Math.max(0, tierPolicy.fileFlashDailyLimit - fileFlashUsed),
      model: tierPolicy.fileFlashModel,
    },
    filePro: {
      used: fileProUsed,
      limit: tierPolicy.fileProDailyLimit,
      remaining: Math.max(0, tierPolicy.fileProDailyLimit - fileProUsed),
      model: tierPolicy.fileProModel,
      thinkingBudget: tierPolicy.fileProThinkingBudget,
    },
    liteModel: tierPolicy.liteModel,
    allow38Fallback: tierPolicy.allow38Fallback,
    maxAttachmentChars: tierPolicy.maxAttachmentChars,
    maxHistoryMessages: tierPolicy.maxHistoryMessages,
    rateLimitPerMinute: tierPolicy.rateLimitPerMinute,
  };
}

function checkPerMinuteRateLimit(userId, limitPerMinute = 0, nowMs = Date.now()) {
  const limit = Math.max(0, Math.round(Number(limitPerMinute) || 0));
  const uid = String(userId || '').trim();
  if (!uid || limit <= 0) {
    return { allowed: true, limit, used: 0, retryAfterSec: 0 };
  }

  const windowStart = nowMs - 60_000;
  if (perMinuteHits.size > 2000) {
    for (const [k, stamps] of perMinuteHits.entries()) {
      const fresh = stamps.filter((t) => t > windowStart);
      if (fresh.length) perMinuteHits.set(k, fresh);
      else perMinuteHits.delete(k);
    }
  }

  const recent = (perMinuteHits.get(uid) || []).filter((t) => t > windowStart);
  if (recent.length >= limit) {
    perMinuteHits.set(uid, recent);
    const oldest = recent[0] || nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000));
    return { allowed: false, limit, used: recent.length, retryAfterSec };
  }

  recent.push(nowMs);
  perMinuteHits.set(uid, recent);
  return { allowed: true, limit, used: recent.length, retryAfterSec: 0 };
}

function resetPerMinuteRateLimitForTests() {
  perMinuteHits.clear();
}

module.exports = {
  PLAN_TIER_KEYS,
  ALLOWED_MODELS,
  DEFAULT_AI_PLAN_MODEL_POLICY,
  normalizeAiPlanModelPolicy,
  getAiPlanModelPolicy,
  getCachedAiPlanModelPolicySync,
  saveAiPlanModelPolicy,
  resetAiPlanModelPolicy,
  invalidateAiPlanPolicyCache,
  resolveStudentPlanTier,
  resolvePlanRouting,
  formatPlanModelQuotaSummary,
  checkPerMinuteRateLimit,
  resetPerMinuteRateLimitForTests,
};
