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
  const duration = Math.max(0, Number(lesson?.duration) || 0);
  
  if (duration > 0) {
    towardGatePct = Math.min(100, Math.round((watched / duration) * 100));
  } else if (required > 0) {
    towardGatePct = Math.min(100, Math.round((watched / (required * 1.5)) * 100));
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
    const remaining = Math.max(0, p.required - p.watched);
    lines.push({
      key: 'pct',
      text: remaining > 0 ? `Còn ${remaining} giây nữa để mở bài tiếp` : 'Đang xử lý mở bài...',
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
 * Sidebar compact: tối đa vài chip + 1 dòng phụ + thanh % (tránh 3–4 dòng uppercase).
 */
export function getLessonSidebarUi(lesson, opts = {}) {
  const { isCurrent = false } = opts;
  const p = getLessonCompletionProgressUi(lesson);

  if (lesson?.isUnlocked === false) {
    return {
      primary: null,
      chips: [{ key: 'locked', text: 'Chưa mở', tone: 'muted' }],
      showProgressBar: false,
      towardGatePct: null,
    };
  }

  if (p.completed) {
    return {
      primary: null,
      chips: [{ key: 'done', text: 'Hoàn thành', tone: 'success' }],
      showProgressBar: false,
      towardGatePct: 100,
    };
  }

  const chips = [];
  if (isCurrent) chips.push({ key: 'current', text: 'Đang học', tone: 'active' });
  else if (lesson?.allowEarlyAccess && !lesson?.prerequisiteCompleted) {
    chips.push({ key: 'early', text: 'Học sớm', tone: 'info' });
  }
  if (p.freeSeek && !p.eligible) {
    chips.push({ key: 'freeseek', text: 'Tua tự do', tone: 'warn' });
  }

  let primary = null;
  if (p.eligible) {
    primary = { text: 'Đủ điều kiện', tone: 'success' };
  } else if (p.required <= 0) {
    primary = { text: 'Đang tải video…', tone: 'muted' };
  }

  const showProgressBar = p.required > 0 && p.towardGatePct != null;

  return {
    primary,
    chips,
    showProgressBar,
    towardGatePct: p.towardGatePct,
  };
}

export function lessonSidebarChipClass(tone) {
  switch (tone) {
    case 'active': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25';
    case 'success': return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20';
    case 'info': return 'bg-white/10 text-slate-200 border border-white/10';
    case 'warn': return 'bg-amber-500/15 text-amber-200 border border-amber-500/25';
    default: return 'bg-white/5 text-slate-400 border border-white/10';
  }
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
  const remainingSecs = Math.max(0, req - Math.max(0, displayWatched));
  
  if (displayWatched >= req) return 'Đủ điều kiện · có thể học tiếp phần còn lại hoặc bấm qua bài sau';
  return `Còn ${remainingSecs} giây nữa để được mở bài tiếp`;
}

export function lessonStatusToneClass(tone, surface = 'dark') {
  if (surface === 'dark') {
    switch (tone) {
      case 'active': return 'text-emerald-400';
      case 'success': return 'text-emerald-400';
      case 'info': return 'text-white/90';
      case 'warn': return 'text-amber-300';
      default: return 'text-slate-400';
    }
  }
  switch (tone) {
    case 'active': return 'text-emerald-600';
    case 'success': return 'text-emerald-600';
    case 'info': return 'text-red-700';
    case 'warn': return 'text-amber-700';
    default: return 'text-slate-500';
  }
}

/** Badge overlay trên video: nền đỏ đặc + chữ trắng (tránh đỏ mờ trên nền đỏ). */
export const LMS_PLAYER_PROGRESS_BADGE_CLASS =
  'bg-red-600/90 text-white border border-white/25 backdrop-blur-md shadow-md';

/** Thanh tiến độ trên sidebar tối: track trắng mờ + fill đỏ + viền trắng. */
export const LMS_DARK_PROGRESS_TRACK_CLASS = 'h-1.5 rounded-full bg-white/25 overflow-hidden';
export const LMS_DARK_PROGRESS_FILL_CLASS =
  'h-full rounded-full bg-red-500 border border-white/40 shadow-[0_0_6px_rgba(255,255,255,0.25)] transition-all duration-300';

/** Khớp groupedLessons: thiếu chapterTitle → 'Chương 1'. */
export function lessonChapterKey(lesson) {
  return String(lesson?.chapterTitle || 'Chương 1');
}

/** Số thứ tự trong chương (0-based) — tránh nhảy cóc khi dùng index toàn khóa. */
export function getChapterLessonIndex(lessons, lesson) {
  if (!lesson) return 0;
  const key = lessonChapterKey(lesson);
  const id = String(lesson._id || lesson.id || '');
  let n = 0;
  for (const l of lessons || []) {
    if (lessonChapterKey(l) !== key) continue;
    if (String(l._id || l.id) === id) return n;
    n += 1;
  }
  return 0;
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
  { key: 'reviews', label: 'Đánh giá', shortLabel: 'Đánh giá' },
  { key: 'resources', label: 'Tài liệu', shortLabel: 'Tài liệu' },
  { key: 'list', label: 'Bài giảng', shortLabel: 'Bài giảng', mobileOnly: true },
];

export function normalizeLmsPlayerTab(tab) {
  const allowed = new Set(LMS_PLAYER_TABS.map((t) => t.key));
  if (tab === 'announcements' || !allowed.has(tab)) return 'overview';
  return tab;
}
