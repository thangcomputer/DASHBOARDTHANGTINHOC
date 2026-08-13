/** Accent LMS thống nhất GV + HV (Emerald #10B981 ≈ emerald-500) */
export const LMS_ACCENT = {
  hex: '#10B981',
  tabActive: 'text-white border-emerald-500',
  tabIdle: 'text-slate-500 border-transparent hover:text-slate-300',
  lessonCurrent: 'bg-emerald-500/10 border-l-4 border-emerald-500',
  lessonIdle: 'border-l-4 border-transparent hover:bg-white/[0.04]',
  textCurrent: 'text-emerald-400',
  badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  progress: 'bg-emerald-500',
  progressDone: 'bg-emerald-400',
};

/** UI target for completion gate (server uses ceil(duration * 2/3)). */
export const COMPLETION_GATE_LABEL = '67%';

/**
 * Progress toward completion gate (2/3), not full video length.
 * towardGatePct: 0–100 relative to requiredSeconds; null if duration unknown.
 */
export function getLessonCompletionProgressUi(lesson) {
  const watched = Math.max(0, Number(lesson?.watchedSeconds) || 0);
  const required = Math.max(
    0,
    Number(lesson?.requiredSeconds ?? lesson?.requiredWatchSeconds) || 0,
  );
  const completed = !!lesson?.isCompleted;
  const freeSeek = lesson?.antiSeek === false;

  let towardGatePct = null;
  if (required > 0) {
    towardGatePct = Math.min(100, Math.round((watched / required) * 100));
  } else if (watched > 0) {
    towardGatePct = null;
  } else {
    towardGatePct = 0;
  }

  const eligible = completed
    || lesson?.completionEligible === true
    || (required > 0 && watched >= required);

  return {
    watched,
    required,
    towardGatePct,
    remainingPct: towardGatePct == null ? null : Math.max(0, 100 - towardGatePct),
    completed,
    eligible,
    freeSeek,
  };
}

/**
 * Short status lines for sidebar / mobile list.
 * @param {{ isCurrent?: boolean }} opts
 */
export function getLessonAccessStatusLines(lesson, opts = {}) {
  const { isCurrent = false } = opts;
  const p = getLessonCompletionProgressUi(lesson);
  const lines = [];

  if (lesson?.isUnlocked === false) {
    lines.push({ key: 'locked', text: 'Chưa thể học', tone: 'muted' });
    lines.push({
      key: 'hint',
      text: `Hoàn thành bài trước (≥${COMPLETION_GATE_LABEL}) để mở`,
      tone: 'muted',
    });
    return lines;
  }

  if (p.completed) {
    lines.push({ key: 'done', text: 'Đã hoàn thành', tone: 'success' });
    return lines;
  }

  if (isCurrent) {
    lines.push({ key: 'current', text: 'Đang học', tone: 'active' });
  } else if (lesson?.allowEarlyAccess && !lesson?.prerequisiteCompleted) {
    lines.push({ key: 'early', text: 'Có thể học sớm', tone: 'info' });
  } else {
    lines.push({ key: 'open', text: 'Có thể học', tone: 'muted' });
  }

  if (p.eligible) {
    lines.push({
      key: 'eligible',
      text: 'Đủ điều kiện · chờ mở bài tiếp',
      tone: 'success',
    });
  } else if (p.towardGatePct != null && p.required > 0) {
    lines.push({
      key: 'pct',
      text: `Đã xem ${p.towardGatePct}% · cần ${COMPLETION_GATE_LABEL} để mở bài tiếp`,
      tone: 'info',
    });
  } else if (p.required <= 0) {
    lines.push({
      key: 'duration',
      text: 'Đang lấy thời lượng YouTube…',
      tone: 'info',
    });
  } else {
    lines.push({
      key: 'need',
      text: `Cần xem ≥${COMPLETION_GATE_LABEL} để mở bài tiếp`,
      tone: 'info',
    });
  }

  if (p.freeSeek && !p.eligible) {
    lines.push({
      key: 'freeseek',
      text: 'Tua tự do — vẫn cần đủ tiến độ xem',
      tone: 'warn',
    });
  }

  return lines;
}

/**
 * Player overlay badge for completion (independent of antiSeek).
 */
export function getPlayerCompletionBadgeText({
  lessonCompleted,
  displayWatched,
  effectiveDuration,
  requiredWatchSecondsFn,
}) {
  if (lessonCompleted) return 'Đã hoàn thành';
  const req = typeof requiredWatchSecondsFn === 'function'
    ? (requiredWatchSecondsFn(effectiveDuration) || 1)
    : 1;
  const pct = Math.min(100, Math.round((Math.max(0, displayWatched) / req) * 100));
  if (displayWatched >= req) return 'Đủ điều kiện · có thể mở bài tiếp';
  return `Đã xem ${pct}% · cần ${COMPLETION_GATE_LABEL} để mở bài tiếp`;
}

export function lessonStatusToneClass(tone) {
  switch (tone) {
    case 'active': return 'text-emerald-400';
    case 'success': return 'text-emerald-500/80';
    case 'info': return 'text-red-400';
    case 'warn': return 'text-amber-400/90';
    default: return 'text-slate-600';
  }
}

/**
 * Chuẩn hóa tên bài: "Bài 1: Giới thiệu..." (capitalize, bỏ prefix trùng).
 */
export function formatLessonDisplayTitle(title, index = 0) {
  let raw = String(title || '').trim();
  if (!raw) return `Bài ${index + 1}`;
  raw = raw.replace(/^bài\s*\d+\s*[:.\-]?\s*/i, '').trim();
  if (!raw) return `Bài ${index + 1}`;
  const nice = raw.charAt(0).toUpperCase() + raw.slice(1);
  return `Bài ${index + 1}: ${nice}`;
}

export function formatLmsTimestamp(secs = 0) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Desktop + mobile tabs (list chỉ hiện trên <lg qua CSS trong TabBar) */
export const LMS_PLAYER_TABS = [
  { key: 'overview', label: 'Tổng quan', shortLabel: 'Tổng quan' },
  { key: 'qa', label: 'Hỏi đáp', shortLabel: 'Hỏi đáp' },
  { key: 'notes', label: 'Ghi chú', shortLabel: 'Ghi chú' },
  { key: 'announcements', label: 'Thông báo', shortLabel: 'Thông báo' },
  { key: 'reviews', label: 'Đánh giá', shortLabel: 'Đánh giá' },
  { key: 'resources', label: 'Tài liệu', shortLabel: 'Tài liệu' },
  { key: 'list', label: 'Mục lục', shortLabel: 'Mục lục', mobileOnly: true },
];
