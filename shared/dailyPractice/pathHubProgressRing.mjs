/** Vòng tiến độ 3 nấc quanh nút lộ trình — kiểu Duolingo: track xám + nấc hoàn thành lên màu. */
export const PATH_HUB_PROGRESS_RING = {
  track: '#D1D5DB',
  progressActive: '#22C55E',
  progressDone: '#16A34A',
  stroke: 6,
  /** Khoảng hở giữa nút và vòng (px) — web/mobile cộng vào size nút. */
  pad: 22,
  /** 3 cung tròn đối xứng (góc độ SVG) chừa khe thoáng ở 12h, 4h, 8h. */
  segmentAngles: [-81, 39, 159],
  segmentSweepDeg: 102,
};

const DIFF_KEYS = ['easy', 'medium', 'hard'];
const DEFAULT_SECTIONS = ['content', 'file', 'video', 'practice'];

/** Trạng thái hoàn thành 3 nấc [Dễ, Vừa, Khó] của một nút trên lộ trình. */
export function pathHubLevelStates(node, completedSections = []) {
  if (!node) return [false, false, false];
  if (node.state === 'completed') return [true, true, true];
  if (node.state === 'locked') return [false, false, false];

  const isStudy = node.kind === 'study' || node.icon === 'book';
  const levels = node.levels || [];
  if (isStudy && node.levelConfigs) {
    const completedSet = new Set(Array.isArray(completedSections) ? completedSections : []);
    return DIFF_KEYS.map((diff) => {
      const cfg = node.levelConfigs?.[diff];
      const hidden = new Set(Array.isArray(cfg?.hiddenSections) ? cfg.hiddenSections : []);
      const locks = cfg?.sectionLocks || {};
      const order = (Array.isArray(cfg?.sectionOrder) && cfg.sectionOrder.length ? cfg.sectionOrder : DEFAULT_SECTIONS)
        .filter((k) => !hidden.has(k) && locks[k] !== 'locked');
      return order.length > 0 && order.every((secKey) => completedSet.has(`${node.key}:${diff}:${secKey}`));
    });
  }

  return [0, 1, 2].map((i) => levels[i]?.state === 'completed');
}

export function pathHubNodeProgress(node, completedSections = []) {
  if (!node) return 0;
  if (node.state === 'completed') return 1;
  const states = pathHubLevelStates(node, completedSections);
  const done = states.filter(Boolean).length;
  return done / 3;
}

export function pathHubProgressColor(node, progress, nodeTone) {
  if (node?.state === 'locked') return PATH_HUB_PROGRESS_RING.track;
  if (progress >= 1 || node?.state === 'completed') return PATH_HUB_PROGRESS_RING.progressDone;
  if (progress > 0) return PATH_HUB_PROGRESS_RING.progressActive;
  return nodeTone?.from || PATH_HUB_PROGRESS_RING.progressActive;
}
