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
