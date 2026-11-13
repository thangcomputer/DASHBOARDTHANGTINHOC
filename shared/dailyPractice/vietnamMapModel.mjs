/** Màu & logic vùng bản đồ Việt Nam (web + mobile). */

export const VN_MAP_COLORS = {
  mintFill: '#D1FAE5',
  mintStroke: '#A7F3D0',
  lockedFill: '#E2E8F0',
  lockedStroke: '#CBD5E1',
  progressFill: '#6EE7B7',
  progressStroke: '#10B981',
  doneFill: '#34D399',
  doneStroke: '#059669',
  journeyLocked: '#CBD5E1',
  journeyActive: '#6EE7B7',
  journeyDone: '#10B981',
};

const BAND_Y = {
  north: { y0: 0, y1: 158 },
  central: { y0: 150, y1: 318 },
  south: { y0: 308, y1: 480 },
};

export function vietnamMapBandStates({
  topicCompletedUnits = 0,
  topicTotalUnits = 1,
  unitIndex = 0,
  unitTotal = 1,
  unitState = 'locked',
} = {}) {
  const total = Math.max(1, Number(topicTotalUnits) || 1);
  const done = Math.max(0, Number(topicCompletedUnits) || 0);
  const ratio = Math.min(1, done / total);

  const unitDone = unitState === 'completed';
  const unitActive = unitState !== 'locked' && !unitDone;

  const bandForUnit = (() => {
    if (unitTotal <= 1) return 'south';
    const t = unitIndex / Math.max(1, unitTotal - 1);
    if (t < 0.34) return 'north';
    if (t < 0.67) return 'central';
    return 'south';
  })();

  const northOn = ratio > 0 || unitIndex === 0;
  const centralOn = ratio >= 0.34 || done >= 1;
  const southOn = ratio >= 0.68 || done >= total;

  function bandVisual(band) {
    const topicUnlocked = band === 'north' ? northOn : band === 'central' ? centralOn : southOn;
    const isFocus = band === bandForUnit;
    if (!topicUnlocked && !isFocus) return 'locked';
    if (unitDone && isFocus) return 'done';
    if (unitActive && isFocus) return 'active';
    if (topicUnlocked) return 'progress';
    return 'mint';
  }

  return {
    north: bandVisual('north'),
    central: bandVisual('central'),
    south: bandVisual('south'),
    bands: BAND_Y,
    journeyLit: ratio,
    unitDone,
  };
}

export function bandPaint(state) {
  const c = VN_MAP_COLORS;
  switch (state) {
    case 'done':
      return { fill: c.doneFill, stroke: c.doneStroke, fillOpacity: 0.38, strokeOpacity: 0.45 };
    case 'active':
      return { fill: c.progressFill, stroke: c.progressStroke, fillOpacity: 0.3, strokeOpacity: 0.38 };
    case 'progress':
      return { fill: c.progressFill, stroke: c.progressStroke, fillOpacity: 0.22, strokeOpacity: 0.32 };
    case 'mint':
      return { fill: c.mintFill, stroke: c.mintStroke, fillOpacity: 0.18, strokeOpacity: 0.28 };
    default:
      return { fill: c.lockedFill, stroke: c.lockedStroke, fillOpacity: 0.14, strokeOpacity: 0.24 };
  }
}
