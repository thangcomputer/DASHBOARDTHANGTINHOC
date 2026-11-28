export function clampProgress(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Xác định trạng thái logic chuẩn hóa từ progress (0–100) và status/flag tùy chọn.
 * Hỗ trợ truyền (stepObj, explicitStatus) hoặc (progressNumber, explicitStatus).
 */
export function resolveStepStatus(stepOrProgress, explicitStatus = '') {
  const isObj = stepOrProgress !== null && typeof stepOrProgress === 'object';
  const rawProgress = isObj ? stepOrProgress.progress : stepOrProgress;
  const pct = clampProgress(rawProgress);
  const status = String(explicitStatus || (isObj ? stepOrProgress.status : '') || '').toLowerCase();
  const isReward = Boolean((isObj && stepOrProgress.reward) || status === 'reward' || status === 'milestone');
  const isLocked = Boolean((isObj && stepOrProgress.locked) || status === 'locked');

  if (isReward) return 'reward';
  if (isLocked) return 'locked';
  if (pct >= 100 || status === 'completed') return 'completed';
  if (pct >= 50) return 'in_progress';
  if (pct >= 1) return 'early';
  return status === 'active' ? 'active_zero' : 'locked';
}

const PROGRESS_THEMES = {
  reward: {
    key: 'reward',
    label: 'Vượt chặng',
    dropStart: '#FDE047',
    dropMid: '#F59E0B',
    dropEnd: '#D97706',
    ringStroke: '#F59E0B',
    ringTrack: '#FEF3C7',
    connectorColor: '#F59E0B',
    badgeClass: 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-[0_4px_10px_-2px_rgba(217,119,6,0.45)]',
    pillBorderClass: 'border-amber-200/90',
    pillIconClass: 'text-amber-500',
    pillShadowStyle: '0 8px 18px -10px rgba(245, 158, 11, 0.45), inset 0 1px 0 rgba(255,255,255,0.95)',
    glowClass: 'ring-4 ring-amber-200/70',
    textOnDrop: 'text-white',
  },
  completed: {
    key: 'completed',
    label: 'Hoàn thành',
    dropStart: '#34D399',
    dropMid: '#10B981',
    dropEnd: '#059669',
    ringStroke: '#10B981',
    ringTrack: '#D1FAE5',
    connectorColor: '#10B981',
    badgeClass: 'bg-gradient-to-r from-emerald-400 to-emerald-600 text-white shadow-[0_4px_10px_-2px_rgba(16,185,129,0.42)]',
    pillBorderClass: 'border-emerald-200/90',
    pillIconClass: 'text-emerald-600',
    pillShadowStyle: '0 8px 18px -10px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.95)',
    glowClass: '',
    textOnDrop: 'text-white',
  },
  in_progress: {
    key: 'in_progress',
    label: 'Đang học',
    dropStart: '#38BDF8',
    dropMid: '#2563EB',
    dropEnd: '#1D4ED8',
    ringStroke: '#2563EB',
    ringTrack: '#DBEAFE',
    connectorColor: '#2563EB',
    badgeClass: 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-[0_4px_10px_-2px_rgba(37,99,235,0.42)]',
    pillBorderClass: 'border-blue-200/90',
    pillIconClass: 'text-blue-600',
    pillShadowStyle: '0 8px 20px -10px rgba(37, 99, 235, 0.45), inset 0 1px 0 rgba(255,255,255,0.95)',
    glowClass: 'ring-4 ring-blue-200/75',
    textOnDrop: 'text-white',
  },
  early: {
    key: 'early',
    label: 'Mới bắt đầu',
    dropStart: '#BAE6FD',
    dropMid: '#38BDF8',
    dropEnd: '#0EA5E9',
    ringStroke: '#38BDF8',
    ringTrack: '#E0F2FE',
    connectorColor: '#38BDF8',
    badgeClass: 'bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-[0_4px_10px_-2px_rgba(14,165,233,0.38)]',
    pillBorderClass: 'border-sky-200/90',
    pillIconClass: 'text-sky-600',
    pillShadowStyle: '0 8px 18px -10px rgba(14, 165, 233, 0.35), inset 0 1px 0 rgba(255,255,255,0.95)',
    glowClass: 'ring-4 ring-sky-200/75',
    textOnDrop: 'text-white',
  },
  active_zero: {
    key: 'active_zero',
    label: 'Sẵn sàng',
    dropStart: '#BAE6FD',
    dropMid: '#38BDF8',
    dropEnd: '#0EA5E9',
    ringStroke: '#38BDF8',
    ringTrack: '#E0F2FE',
    connectorColor: '#38BDF8',
    badgeClass: 'bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-[0_4px_10px_-2px_rgba(14,165,233,0.38)]',
    pillBorderClass: 'border-sky-200/90',
    pillIconClass: 'text-sky-600',
    pillShadowStyle: '0 8px 18px -10px rgba(14, 165, 233, 0.35), inset 0 1px 0 rgba(255,255,255,0.95)',
    glowClass: 'ring-4 ring-sky-200/75',
    textOnDrop: 'text-white',
  },
  locked: {
    key: 'locked',
    label: 'Chưa mở',
    dropStart: '#E2E8F0',
    dropMid: '#94A3B8',
    dropEnd: '#64748B',
    ringStroke: '#CBD5E1',
    ringTrack: '#E2E8F0',
    connectorColor: '#CBD5E1',
    badgeClass: 'bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-[0_4px_8px_-2px_rgba(100,116,139,0.28)]',
    pillBorderClass: 'border-slate-200/80',
    pillIconClass: 'text-slate-400',
    pillShadowStyle: '0 6px 14px -10px rgba(100, 116, 139, 0.3), inset 0 1px 0 rgba(255,255,255,0.95)',
    glowClass: '',
    textOnDrop: 'text-slate-700',
  },
};

/**
 * Trả về bảng màu động đồng bộ cho vòng tiến độ, giọt nước, badge % và thanh nối.
 * Quy tắc:
 * - 0%: xám (locked)
 * - 1–49%: xanh dương nhạt (early)
 * - 50–99%: xanh dương đậm (in_progress)
 * - 100%: xanh lá (completed)
 * - reward / milestone: vàng gold (reward)
 */
export function getProgressColor(progress, status = '') {
  const key = resolveStepStatus(progress, status);
  return PROGRESS_THEMES[key] || PROGRESS_THEMES.locked;
}

/** Tính % và dải màu thanh nối giữa 2 chặng liền kề. */
export function getConnectorProgress(fromStep, toStep) {
  const fromPct = clampProgress(fromStep?.progress);
  const toPct = clampProgress(toStep?.progress);
  const fromTheme = getProgressColor(fromStep);
  const toTheme = getProgressColor(toStep);

  let fillPercent = 0;
  if (fromPct >= 100 && toPct > 0) {
    fillPercent = 100;
  } else if (fromPct >= 100 && toPct === 0) {
    fillPercent = 50;
  } else if (fromPct > 0 && fromPct < 100) {
    fillPercent = Math.max(18, Math.round(fromPct * 0.65));
  }

  return {
    fillPercent,
    fromHex: fromTheme.connectorColor,
    toHex: toPct > 0 || toTheme.key === 'reward' ? toTheme.connectorColor : fromTheme.connectorColor,
  };
}

