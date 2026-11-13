/** Vòng tiến độ quanh nút lộ trình — kiểu Duolingo: track xám + cung vàng/xanh. */
export const PATH_HUB_PROGRESS_RING = {
  track: '#D1D5DB',
  progressActive: '#FBBF24',
  progressDone: '#22C55E',
  stroke: 5,
  /** Khoảng hở giữa nút và vòng (px) — web/mobile cộng vào size nút. */
  pad: 26,
};

export function pathHubNodeProgress(node) {
  if (!node) return 0;
  const levels = node.levels || [];
  const lessons = node.lessons || [];
  const items = levels.length ? levels : lessons;
  if (!items.length) {
    return node.state === 'completed' ? 1 : 0;
  }
  const done = items.filter((item) => item.state === 'completed').length;
  const active = items.some((item) => item.state === 'active');
  if (done >= items.length || node.state === 'completed') return 1;
  if (done > 0) return done / items.length;
  if (active) return Math.min(0.34, 1 / Math.max(items.length, 1));
  return 0;
}

export function pathHubProgressColor(node, progress, nodeTone) {
  if (node?.state === 'locked') return PATH_HUB_PROGRESS_RING.track;
  const accent = nodeTone?.from || PATH_HUB_PROGRESS_RING.progressActive;
  const accentDeep = nodeTone?.to || PATH_HUB_PROGRESS_RING.progressDone;
  if (progress >= 1 || node?.state === 'completed') return accentDeep;
  return accent;
}
