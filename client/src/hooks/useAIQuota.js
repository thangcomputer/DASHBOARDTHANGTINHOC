import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiSupportAPI } from '../services/api';
import { AI_QUOTA_UPDATED_EVENT } from '../components/ui/AiUsageIndicator';
import { useSocket } from '../context/SocketContext';
import { useData } from '../context/DataContext';

function normalizePercent(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isPlanStillValid(aiPlan) {
  if (!aiPlan?.isUnlimited) return false;
  if (!aiPlan?.expiresAt) return true;
  const ms = new Date(aiPlan.expiresAt).getTime();
  return Number.isFinite(ms) && ms > Date.now();
}

export function dispatchOpenAiPackagesModal(group = null) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('cms:open-ai-packages', { detail: { group } }));
  } catch { /* ignore */ }
}

/**
 * Hook quản lý Dung lượng Hỏi AI theo % (0–100%, reset 00:00 mỗi ngày)
 * và trạng thái Gói Hỏi AI Không Giới Hạn (dùng chung DewSkill & Trung tâm).
 */
export default function useAIQuota({ autoFetch = true } = {}) {
  const { socket } = useSocket() || {};
  const { currentUser } = useData() || {};
  const [dailyQuota, setDailyQuota] = useState(null);
  const [aiPlanState, setAiPlanState] = useState(() => currentUser?.aiPlan || null);
  const [loading, setLoading] = useState(false);

  const applyQuotaUpdate = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') return;
    const nextQuestionQuota = payload.questionQuota || (payload.dailyQuota?.questionQuota);
    const nextImageQuota = payload.imageQuota || (payload.dailyQuota?.imageQuota);
    const nextAiPlan = payload.aiPlan || payload.dailyQuota?.aiPlan || nextQuestionQuota?.aiPlan;
    if (nextQuestionQuota || nextImageQuota) {
      setDailyQuota((prev) => ({
        ...(prev || {}),
        ...(nextQuestionQuota ? { questionQuota: nextQuestionQuota } : {}),
        ...(nextImageQuota ? { imageQuota: nextImageQuota } : {}),
        ...(nextAiPlan ? { aiPlan: nextAiPlan } : {}),
      }));
    }
    if (nextAiPlan) {
      setAiPlanState(nextAiPlan);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiSupportAPI.status();
      if (res?.success && res?.data) {
        if (res.data.dailyQuota) {
          setDailyQuota(res.data.dailyQuota);
        }
        const plan = res.data.aiPlan || res.data.dailyQuota?.aiPlan || res.data.dailyQuota?.questionQuota?.aiPlan;
        if (plan) setAiPlanState(plan);
      }
    } catch {
      /* ignore optional quota fetch errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return undefined;
    refresh();
    return undefined;
  }, [autoFetch, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onQuotaUpdated = (event) => applyQuotaUpdate(event?.detail);
    const onPlanUpdated = (event) => {
      if (event?.detail?.aiPlan) {
        setAiPlanState(event.detail.aiPlan);
      }
      refresh();
    };
    window.addEventListener(AI_QUOTA_UPDATED_EVENT, onQuotaUpdated);
    window.addEventListener('cms:ai-plan-updated', onPlanUpdated);
    window.addEventListener('cms:subscription-updated', onPlanUpdated);
    window.addEventListener('free-portal-unlocked', onPlanUpdated);
    return () => {
      window.removeEventListener(AI_QUOTA_UPDATED_EVENT, onQuotaUpdated);
      window.removeEventListener('cms:ai-plan-updated', onPlanUpdated);
      window.removeEventListener('cms:subscription-updated', onPlanUpdated);
      window.removeEventListener('free-portal-unlocked', onPlanUpdated);
    };
  }, [applyQuotaUpdate, refresh]);

  useEffect(() => {
    if (!socket) return undefined;
    const onAiPackagePaid = (payload) => {
      if (payload?.aiPlan) {
        setAiPlanState(payload.aiPlan);
        applyQuotaUpdate({
          aiPlan: payload.aiPlan,
          questionQuota: {
            applies: true,
            mode: 'percent',
            unit: 'percent',
            isUnlimited: true,
            percentLeft: 100,
            percentUsed: 0,
            aiPlan: payload.aiPlan,
          },
        });
      }
      refresh();
    };
    socket.on('aiPackage:paid', onAiPackagePaid);
    return () => socket.off('aiPackage:paid', onAiPackagePaid);
  }, [socket, applyQuotaUpdate, refresh]);

  const computed = useMemo(() => {
    const q = dailyQuota?.questionQuota || {};
    const img = dailyQuota?.imageQuota || {};
    const role = String(currentUser?.role || '').toLowerCase();
    const isAdminOrStaff = role === 'admin' || role === 'staff';
    const applies = q.applies !== undefined ? Boolean(q.applies) : !isAdminOrStaff;

    const mergedPlan = aiPlanState || dailyQuota?.aiPlan || q.aiPlan || currentUser?.aiPlan || null;
    const isPaidUnlimited = isPlanStillValid(mergedPlan) || Boolean(q.isUnlimited && !isAdminOrStaff);
    const isAdminUnlimited = !applies;
    const isUnlimited = isPaidUnlimited || isAdminUnlimited;

    const rawLeft = q.percentLeft ?? q.remaining;
    const aiQuotaPercent = isUnlimited ? 100 : (rawLeft != null ? normalizePercent(rawLeft) : 100);

    const status = isUnlimited
      ? 'unlimited'
      : aiQuotaPercent <= 0
        ? 'empty'
        : aiQuotaPercent <= 20
          ? 'low'
          : 'ready';

    const rawImgLimit = img.limit;
    const imageDisallowed = !isUnlimited && Boolean(
      img.allowed === false
      || (rawImgLimit !== null && rawImgLimit !== undefined && rawImgLimit !== '' && Number(rawImgLimit) === 0),
    );

    return {
      dailyQuota,
      aiQuotaPercent,
      aiPlan: mergedPlan,
      planModelQuota: dailyQuota?.planModelQuota || q.planModelQuota || null,
      isPaidUnlimited,
      isAdminUnlimited,
      isUnlimited,
      applies,
      status,
      isOutOfQuota: !isUnlimited && applies && aiQuotaPercent <= 0,
      resetInMs: q.resetInMs ?? null,
      resetsAt: q.resetsAt ?? null,
      imageDisallowed,
    };
  }, [dailyQuota, aiPlanState, currentUser?.role, currentUser?.aiPlan]);

  return {
    ...computed,
    loading,
    refresh,
    applyQuotaUpdate,
    openPackagesModal: dispatchOpenAiPackagesModal,
  };
}
