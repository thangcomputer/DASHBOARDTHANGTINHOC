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

export const LMS_PLAYER_TABS = [
  { key: 'video', label: 'Bài giảng', shortLabel: 'Bài giảng' },
  { key: 'list', label: 'Danh sách bài', shortLabel: 'DS bài' },
  { key: 'data', label: 'Tài liệu', shortLabel: 'Tài liệu' },
  { key: 'notice', label: 'Thông báo', shortLabel: 'Thông báo' },
];
