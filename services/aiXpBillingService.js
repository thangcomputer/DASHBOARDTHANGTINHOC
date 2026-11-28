'use strict';

const mongoose = require('mongoose');
const rules = require('./dailyPracticeRules');
const learningGoalService = require('./learningGoalService');

function getDbDeps() {
  return {
    DailyPracticeProfile: require('../models/DailyPracticeProfile'),
    Student: require('../models/Student'),
    subscriptionService: require('./subscriptionService'),
    dewskillClassService: require('./dewskillClassService'),
    dailyPracticeService: require('./dailyPracticeService'),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const FREE_AI_DAILY_QUESTION_LIMIT = 2;

function getVietnamResetMeta(now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const vnWallMs = nowMs + VIETNAM_UTC_OFFSET_MS;
  const elapsedTodayMs = ((vnWallMs % DAY_MS) + DAY_MS) % DAY_MS;
  const resetInMs = Math.max(1000, DAY_MS - elapsedTodayMs);
  const resetsAt = new Date(nowMs + (DAY_MS - elapsedTodayMs)).toISOString();
  return { resetInMs, resetsAt };
}

function isStudentXpBillingAvailable(user) {
  if (!user || typeof user !== 'object') return false;
  const role = String(user.role || user.userRole || '').trim().toLowerCase();
  if (role !== 'student') return false;
  const uid = String(user.id || user._id || '').trim();
  if (!uid || !mongoose.Types.ObjectId.isValid(uid)) return false;
  return Boolean(mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db);
}

function resolveAiActionCostXp(xpConfig = null, { hasImage = false } = {}) {
  const qRaw = Number(xpConfig?.aiQuestionCostXp);
  const imgRaw = Number(xpConfig?.aiImageCostXp);
  const questionCost = Number.isFinite(qRaw) && qRaw >= 0 ? Math.round(qRaw) : 10;
  const imageCost = Number.isFinite(imgRaw) && imgRaw >= 0 ? Math.round(imgRaw) : 20;
  return hasImage ? imageCost : questionCost;
}

function buildWalletView({ profile, xpConfig, subStatus }) {
  const xpTotal = rules.clampXp(profile?.xpTotal);
  const dailyXp = rules.clampXp(profile?.dailyXp);
  const purchasedXp = rules.clampXp(profile?.purchasedXp);
  const studyXpTotal = rules.clampXp(profile?.studyXpTotal);
  const allowanceRaw = Number(profile?.xpAllowanceAmount) > 0
    ? Number(profile.xpAllowanceAmount)
    : Number(subStatus?.dailyXpLimit) || rules.DAILY_ALLOWANCE_XP;
  const dailyAllowanceXp = Math.max(0, Math.round(allowanceRaw));
  const aiQuestionCostXp = resolveAiActionCostXp(xpConfig, { hasImage: false });
  const aiImageCostXp = resolveAiActionCostXp(xpConfig, { hasImage: true });
  const isFreeTier = Boolean(subStatus?.freeTier);
  const today = learningGoalService.vnDayKey();
  const freeDailyLimit = isFreeTier ? FREE_AI_DAILY_QUESTION_LIMIT : 0;
  const freeUsedToday = isFreeTier && String(profile?.aiFreeAskDay || '') === today
    ? Math.max(0, Math.round(Number(profile?.aiFreeAskCount) || 0))
    : 0;
  const freeRemainingToday = isFreeTier ? Math.max(0, freeDailyLimit - freeUsedToday) : 0;
  const freeLimitReached = isFreeTier && freeRemainingToday <= 0;
  const suggestedAction = isFreeTier
    ? (freeLimitReached ? 'register_course' : 'upgrade_plan')
    : 'buy_xp';
  const resetMeta = getVietnamResetMeta();
  return {
    applies: true,
    mode: 'xp',
    unit: 'xp',
    xpTotal,
    dailyXp,
    purchasedXp,
    studyXpTotal,
    dailyAllowanceXp,
    aiQuestionCostXp,
    aiImageCostXp,
    isFreeTier,
    freeDailyLimit,
    freeUsedToday,
    freeRemainingToday,
    freeLimitReached,
    suggestedAction,
    hasOwnedClass: Boolean(subStatus?.hasOwnedClass),
    ownedClassName: String(subStatus?.ownedClassName || ''),
    plan: String(subStatus?.plan || ''),
    planLabel: String(subStatus?.planLabel || ''),
    resetInMs: resetMeta.resetInMs,
    resetsAt: resetMeta.resetsAt,
  };
}

function isWalletBlockedForAi(wallet, { hasImage = false } = {}) {
  if (!wallet || !wallet.applies) return false;
  if (wallet.isFreeTier) return Boolean(wallet.freeLimitReached);
  const cost = hasImage ? Number(wallet.aiImageCostXp) || 0 : Number(wallet.aiQuestionCostXp) || 0;
  return cost > 0 && (Number(wallet.xpTotal) || 0) < cost;
}

function buildAiXpQuotaView(wallet) {
  if (!wallet) {
    return {
      applies: false,
      mode: 'xp',
      unit: 'xp',
      xpTotal: 0,
      dailyAllowanceXp: 0,
      xpCost: 0,
      xpImageCost: 0,
      isFreeTier: false,
      freeDailyLimit: 0,
      freeUsedToday: 0,
      freeRemainingToday: 0,
      freeLimitReached: false,
      suggestedAction: 'buy_xp',
      used: 0,
      remaining: 0,
      limit: 100,
      percentUsed: 0,
      percentLeft: 100,
    };
  }
  const cost = Math.max(0, Number(wallet.aiQuestionCostXp) || 0);
  const xpTotal = Math.max(0, Number(wallet.xpTotal) || 0);
  const isFreeCount = Boolean(wallet.isFreeTier && Number(wallet.freeDailyLimit) > 0);
  const freeDailyLimit = isFreeCount ? Math.max(1, Number(wallet.freeDailyLimit) || FREE_AI_DAILY_QUESTION_LIMIT) : 0;
  const freeUsedToday = isFreeCount ? Math.max(0, Number(wallet.freeUsedToday) || 0) : 0;
  const freeRemainingToday = isFreeCount ? Math.max(0, Number(wallet.freeRemainingToday ?? (freeDailyLimit - freeUsedToday))) : 0;
  const freeLimitReached = isFreeCount && (Boolean(wallet.freeLimitReached) || freeRemainingToday <= 0);
  const baseCap = isFreeCount ? freeDailyLimit : Math.max(cost || 1, Number(wallet.dailyAllowanceXp) || 100);
  const canAsk = isFreeCount ? !freeLimitReached : (cost <= 0 || xpTotal >= cost);
  const percentLeft = !canAsk
    ? 0
    : isFreeCount
      ? Math.min(100, Math.max(1, Math.round((freeRemainingToday * 100) / freeDailyLimit)))
      : Math.min(100, Math.max(1, Math.round((xpTotal * 100) / Math.max(1, baseCap))));
  const percentUsed = 100 - percentLeft;
  const resetMeta = wallet.resetsAt ? { resetInMs: wallet.resetInMs, resetsAt: wallet.resetsAt } : getVietnamResetMeta();

  return {
    applies: true,
    mode: 'xp',
    unit: 'xp',
    xpTotal,
    dailyXp: Math.max(0, Number(wallet.dailyXp) || 0),
    purchasedXp: Math.max(0, Number(wallet.purchasedXp) || 0),
    dailyAllowanceXp: Math.max(0, Number(wallet.dailyAllowanceXp) || 0),
    xpCost: cost,
    xpImageCost: Math.max(0, Number(wallet.aiImageCostXp) || 0),
    isFreeTier: Boolean(wallet.isFreeTier),
    freeDailyLimit,
    freeUsedToday,
    freeRemainingToday,
    freeLimitReached,
    suggestedAction: wallet.suggestedAction || (wallet.isFreeTier ? (freeLimitReached ? 'register_course' : 'upgrade_plan') : 'buy_xp'),
    used: isFreeCount ? freeUsedToday : Math.max(0, baseCap - xpTotal),
    remaining: isFreeCount ? freeRemainingToday : xpTotal,
    limit: baseCap,
    percentUsed,
    percentLeft,
    resetInMs: resetMeta.resetInMs,
    resetsAt: resetMeta.resetsAt,
  };
}

function buildInsufficientXpError({
  costXp,
  currentXp,
  dailyAllowanceXp,
  isFreeTier,
  freeLimitReached = false,
  freeDailyLimit = FREE_AI_DAILY_QUESTION_LIMIT,
  wallet,
  lang = 'vi',
} = {}) {
  const isEn = lang === 'en';
  const safeCost = Math.max(1, Number(costXp) || 10);
  const safeCurrent = Math.max(0, Number(currentXp) || 0);
  const safeAllow = Math.max(0, Number(dailyAllowanceXp) || 0);
  const isFreeQuotaBlocked = Boolean(isFreeTier && (freeLimitReached || wallet?.freeLimitReached));
  const safeFreeLimit = Math.max(1, Number(freeDailyLimit ?? wallet?.freeDailyLimit) || FREE_AI_DAILY_QUESTION_LIMIT);
  const suggestedAction = isFreeTier ? (isFreeQuotaBlocked ? 'register_course' : 'upgrade_plan') : 'buy_xp';

  const message = isFreeQuotaBlocked
    ? (isEn
      ? `You have used all ${safeFreeLimit}/${safeFreeLimit} free AI questions today. Please register a course to unlock full daily AI access and all lessons!`
      : `Bạn đã dùng hết ${safeFreeLimit}/${safeFreeLimit} câu hỏi AI miễn phí hôm nay. Hãy đăng ký khóa học để nhận đầy đủ quyền lợi hỏi AI mỗi ngày và mở toàn bộ bài học!`)
    : isFreeTier
      ? (isEn
        ? `Not enough XP for AI Assistant (requires ${safeCost} XP, you have ${safeCurrent} XP). Free accounts are limited to ${safeAllow} XP/day — upgrade to a monthly/yearly plan for more daily XP.`
        : `Bạn đã hết XP dùng Trợ lý AI (cần ${safeCost} XP, hiện còn ${safeCurrent} XP). Tài khoản miễn phí bị giới hạn ${safeAllow} XP/ngày — hãy đăng ký gói tháng/năm để nhận thêm XP mỗi ngày!`)
      : (isEn
        ? `Not enough XP for AI Assistant today (requires ${safeCost} XP, you have ${safeCurrent} XP). Please buy an XP pack to continue using AI.`
        : `Bạn đã hết XP dùng Trợ lý AI hôm nay (cần ${safeCost} XP, hiện còn ${safeCurrent} XP). Vui lòng mua thêm gói XP để tiếp tục sử dụng AI!`);

  const err = new Error(message);
  err.status = 402;
  err.code = 'AI_XP_INSUFFICIENT';
  err.needXp = safeCost;
  err.currentXp = safeCurrent;
  err.isFreeTier = Boolean(isFreeTier);
  err.freeLimitReached = isFreeQuotaBlocked;
  err.freeDailyLimit = isFreeTier ? safeFreeLimit : 0;
  err.suggestedAction = suggestedAction;
  err.xpWallet = wallet || null;
  err.questionQuota = buildAiXpQuotaView(wallet);
  return err;
}

async function loadStudentXpContext(studentId) {
  const { Student, subscriptionService, dewskillClassService, dailyPracticeService } = getDbDeps();
  const [profile, student, xpConfig, ownedClassSummary] = await Promise.all([
    dailyPracticeService.refillDailyXp(studentId),
    Student.findById(studentId).select('subscription freePortal accountType').lean(),
    subscriptionService.getXpConfig(),
    dewskillClassService.getStudentOwnedClassXpSummary(studentId).catch(() => null),
  ]);
  const subStatus = subscriptionService.statusOf(student || {}, new Date(), xpConfig, ownedClassSummary);
  return { profile, student, xpConfig, ownedClassSummary, subStatus };
}

async function getStudentAiXpStatus(studentId) {
  const { profile, xpConfig, subStatus } = await loadStudentXpContext(studentId);
  return buildWalletView({ profile, xpConfig, subStatus });
}

async function chargeStudentAiXp(studentId, { hasImage = false, lang = 'vi' } = {}) {
  const { DailyPracticeProfile } = getDbDeps();
  const ctx = await loadStudentXpContext(studentId);
  const costXp = resolveAiActionCostXp(ctx.xpConfig, { hasImage });
  const currentWallet = buildWalletView({ profile: ctx.profile, xpConfig: ctx.xpConfig, subStatus: ctx.subStatus });

  if (costXp <= 0) {
    return {
      applies: true,
      charged: false,
      costXp: 0,
      fromDaily: 0,
      fromPurchased: 0,
      wallet: currentWallet,
    };
  }

  const today = learningGoalService.vnDayKey();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const profile = attempt === 0
      ? ctx.profile
      : await DailyPracticeProfile.findOne({ studentId }).lean();
    if (!profile) break;

    const currentXp = rules.clampXp(profile.xpTotal);
    const wallet = buildWalletView({ profile, xpConfig: ctx.xpConfig, subStatus: ctx.subStatus });

    if (wallet.isFreeTier) {
      const sameDay = String(profile.aiFreeAskDay || '') === today;
      const usedToday = sameDay ? Math.max(0, Math.round(Number(profile.aiFreeAskCount) || 0)) : 0;
      if (usedToday >= FREE_AI_DAILY_QUESTION_LIMIT) {
        throw buildInsufficientXpError({
          costXp,
          currentXp,
          dailyAllowanceXp: wallet.dailyAllowanceXp,
          isFreeTier: true,
          freeLimitReached: true,
          freeDailyLimit: FREE_AI_DAILY_QUESTION_LIMIT,
          wallet,
          lang,
        });
      }
      const deductXp = Math.min(currentXp, costXp);
      const prevDaily = rules.clampXp(profile.dailyXp);
      const prevPurchased = rules.clampXp(profile.purchasedXp);
      const next = deductXp > 0
        ? rules.applyXpDelta(profile, -deductXp, 'spend')
        : { xpTotal: currentXp, dailyXp: prevDaily, purchasedXp: prevPurchased };
      const fromDaily = Math.max(0, prevDaily - next.dailyXp);
      const fromPurchased = Math.max(0, prevPurchased - next.purchasedXp);
      const broke = next.xpTotal < rules.SESSION_STAKE_XP;

      const updated = await DailyPracticeProfile.findOneAndUpdate(
        {
          _id: profile._id,
          xpTotal: currentXp,
          ...(sameDay ? { aiFreeAskDay: today, aiFreeAskCount: usedToday } : { aiFreeAskDay: { $ne: today } }),
        },
        {
          $set: {
            xpTotal: next.xpTotal,
            dailyXp: next.dailyXp,
            purchasedXp: next.purchasedXp,
            xpBrokeDay: broke ? today : '',
            aiFreeAskDay: today,
            aiFreeAskCount: usedToday + 1,
          },
        },
        { returnDocument: 'after' },
      ).lean();

      if (updated) {
        return {
          applies: true,
          charged: true,
          costXp: deductXp,
          fromDaily,
          fromPurchased,
          freeAskCounted: true,
          freeAskDay: today,
          wallet: buildWalletView({ profile: updated, xpConfig: ctx.xpConfig, subStatus: ctx.subStatus }),
        };
      }
      continue;
    }

    if (currentXp < costXp) {
      throw buildInsufficientXpError({
        costXp,
        currentXp,
        dailyAllowanceXp: wallet.dailyAllowanceXp,
        isFreeTier: wallet.isFreeTier,
        wallet,
        lang,
      });
    }

    const prevDaily = rules.clampXp(profile.dailyXp);
    const prevPurchased = rules.clampXp(profile.purchasedXp);
    const next = rules.applyXpDelta(profile, -costXp, 'spend');
    const fromDaily = Math.max(0, prevDaily - next.dailyXp);
    const fromPurchased = Math.max(0, prevPurchased - next.purchasedXp);
    const broke = next.xpTotal < rules.SESSION_STAKE_XP;

    const updated = await DailyPracticeProfile.findOneAndUpdate(
      { _id: profile._id, xpTotal: currentXp },
      {
        $set: {
          xpTotal: next.xpTotal,
          dailyXp: next.dailyXp,
          purchasedXp: next.purchasedXp,
          xpBrokeDay: broke ? today : '',
        },
      },
      { returnDocument: 'after' },
    ).lean();

    if (updated) {
      return {
        applies: true,
        charged: true,
        costXp,
        fromDaily,
        fromPurchased,
        freeAskCounted: false,
        wallet: buildWalletView({ profile: updated, xpConfig: ctx.xpConfig, subStatus: ctx.subStatus }),
      };
    }
  }

  throw buildInsufficientXpError({
    costXp,
    currentXp: currentWallet.xpTotal,
    dailyAllowanceXp: currentWallet.dailyAllowanceXp,
    isFreeTier: currentWallet.isFreeTier,
    freeLimitReached: currentWallet.isFreeTier && currentWallet.freeLimitReached,
    freeDailyLimit: currentWallet.freeDailyLimit || FREE_AI_DAILY_QUESTION_LIMIT,
    wallet: currentWallet,
    lang,
  });
}

async function refundStudentAiXp(studentId, chargeInfo = null) {
  if (!studentId || !chargeInfo) return null;
  const { DailyPracticeProfile } = getDbDeps();
  const fromDaily = typeof chargeInfo === 'number'
    ? Math.max(0, Math.round(chargeInfo))
    : Math.max(0, Math.round(Number(chargeInfo.fromDaily) || 0));
  const fromPurchased = typeof chargeInfo === 'number'
    ? 0
    : Math.max(0, Math.round(Number(chargeInfo.fromPurchased) || 0));
  const fallbackCost = typeof chargeInfo === 'object' ? Math.max(0, Math.round(Number(chargeInfo.costXp) || 0)) : 0;
  const totalRefund = fromDaily + fromPurchased > 0 ? fromDaily + fromPurchased : fallbackCost;
  const freeAskCounted = Boolean(typeof chargeInfo === 'object' && chargeInfo.freeAskCounted);
  const freeAskDay = (typeof chargeInfo === 'object' && chargeInfo.freeAskDay) || learningGoalService.vnDayKey();

  if (totalRefund <= 0 && !freeAskCounted) return null;

  const restoreDaily = fromDaily + fromPurchased > 0 ? fromDaily : totalRefund;
  const restorePurchased = fromDaily + fromPurchased > 0 ? fromPurchased : 0;

  let updated = null;
  if (totalRefund > 0) {
    updated = await DailyPracticeProfile.findOneAndUpdate(
      { studentId },
      {
        $inc: {
          xpTotal: totalRefund,
          dailyXp: restoreDaily,
          purchasedXp: restorePurchased,
        },
        $set: { xpBrokeDay: '' },
      },
      { returnDocument: 'after' },
    ).lean();
  }

  if (freeAskCounted) {
    const reverted = await DailyPracticeProfile.findOneAndUpdate(
      { studentId, aiFreeAskDay: freeAskDay, aiFreeAskCount: { $gt: 0 } },
      { $inc: { aiFreeAskCount: -1 } },
      { returnDocument: 'after' },
    ).lean();
    if (reverted) updated = reverted;
  }

  if (!updated) return null;
  const { xpConfig, subStatus } = await loadStudentXpContext(studentId);
  return buildWalletView({ profile: updated, xpConfig, subStatus });
}

module.exports = {
  FREE_AI_DAILY_QUESTION_LIMIT,
  isStudentXpBillingAvailable,
  isWalletBlockedForAi,
  resolveAiActionCostXp,
  buildWalletView,
  buildAiXpQuotaView,
  formatXpQuotaView: buildAiXpQuotaView,
  buildInsufficientXpError,
  getStudentAiXpStatus,
  chargeStudentAiXp,
  refundStudentAiXp,
};
