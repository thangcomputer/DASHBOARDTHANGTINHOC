import { CloudSun, Moon, Sun } from 'lucide-react';

export const MEET_SLOTS = [
  { key: 'morning', label: 'Sáng', time: '9:00 – 12:00', icon: Sun, iconClass: 'text-amber-500' },
  { key: 'afternoon', label: 'Chiều', time: '14:00 – 16:00', icon: CloudSun, iconClass: 'text-orange-500' },
  { key: 'evening', label: 'Tối', time: '19:00 – 21:00', icon: Moon, iconClass: 'text-indigo-500' },
];

export const PLAN_META = {
  '1m': { hint: 'Làm quen', fallbackLabel: '1 tháng' },
  '3m': { hint: 'Nền tảng vững', fallbackLabel: '3 tháng', featured: true, badge: 'Nên chọn' },
  '6m': { hint: 'Học chắc', fallbackLabel: '6 tháng' },
  '12m': { hint: 'Tiết kiệm nhất', fallbackLabel: '1 năm' },
  lifetime: { hint: 'Học trọn đời', fallbackLabel: 'Vĩnh viễn' },
};

export const MEET_MODAL_SHELL_CLASS = 'relative my-auto flex w-full max-w-[840px] max-h-[92dvh] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)]';

export function formatCycleText(resetCycle) {
  if (resetCycle === 'monthly') return 'mỗi tháng';
  if (resetCycle === 'never') return 'tặng kèm';
  return 'mỗi ngày';
}

/** Tính nhất quán thông tin XP theo cấu hình Admin giữa các popup. */
export function resolveMeetXpSummary(overview) {
  const plans = overview?.plans || [];
  const xpCfg = overview?.xpConfig;
  const resetCycle = xpCfg?.resetCycle || plans[0]?.resetCycle || overview?.subscription?.resetCycle || 'daily';
  const cycleText = formatCycleText(resetCycle);
  const freeXp = xpCfg?.freeAccountXp ?? 60;
  const planXps = plans
    .map((p) => Number(xpCfg?.planXp?.[p.id] ?? p.dailyXp))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const minXp = planXps.length ? Math.min(...planXps) : null;
  const maxXp = planXps.length ? Math.max(...planXps) : null;
  const rangeText = minXp == null
    ? ''
    : minXp === maxXp
      ? `${minXp} XP`
      : `${minXp}–${maxXp} XP`;

  const getPlanXp = (plan) => {
    const raw = xpCfg?.planXp?.[plan.id] ?? plan.dailyXp;
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? num : null;
  };

  return {
    resetCycle,
    cycleText,
    freeXp,
    rangeText,
    getPlanXp,
  };
}

