import { VIETNAM_JOURNEY_SPINE, VIETNAM_MAP_VIEWBOX } from './vietnamMapGeo.mjs';

/** Parse spine M/L path → [[x,y], ...] trong hệ viewBox bản đồ. */
export function parseSpinePoints(pathD = VIETNAM_JOURNEY_SPINE) {
  const raw = String(pathD || '').trim();
  if (!raw) return [];
  const nums = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return [];
  const points = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push([Number(nums[i]), Number(nums[i + 1])]);
  }
  return points;
}

const VIEWBOX_PARTS = (VIETNAM_MAP_VIEWBOX || '0 0 220 480').trim().split(/\s+/).map(Number);
export const VIEWBOX_W = VIEWBOX_PARTS[2] || 220;
export const VIEWBOX_H = VIEWBOX_PARTS[3] || 480;
const MAP_CENTER_X = VIEWBOX_W / 2;

/** ~ chiều cao một nút + nhãn (px) để trừ khi tính gap dọc. */
const DEFAULT_NODE_BLOCK_PX = 86;

function spineYBounds(spine = parseSpinePoints()) {
  if (!spine.length) return { yMin: 0, yMax: VIEWBOX_H };
  let yMin = spine[0][1];
  let yMax = spine[0][1];
  for (const [, y] of spine) {
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }
  return { yMin, yMax };
}

/** Nội suy (x,y) trên polyline spine tại toạ độ Y (viewBox). */
export function spinePointAtY(targetY, spine = parseSpinePoints()) {
  if (!spine.length) return [MAP_CENTER_X, targetY];
  const y = Number(targetY);
  for (let i = 0; i < spine.length - 1; i += 1) {
    const [x0, y0] = spine[i];
    const [x1, y1] = spine[i + 1];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (y < lo || y > hi) continue;
    const f = y1 === y0 ? 0.5 : (y - y0) / (y1 - y0);
    return [x0 + f * (x1 - x0), y];
  }
  const nearest = spine.reduce((best, pt) => (Math.abs(pt[1] - y) < Math.abs(best[1] - y) ? pt : best), spine[0]);
  return [nearest[0], nearest[1]];
}

function syncPositionFromView(pos, spine = parseSpinePoints()) {
  const [x] = spinePointAtY(pos.viewY, spine);
  pos.viewX = x;
  pos.xPct = (x / VIEWBOX_W) * 100;
  pos.yPct = (pos.viewY / VIEWBOX_H) * 100;
}

/**
 * Vị trí % trên viewBox bản đồ (nút 0 = Bắc, nút cuối = Nam).
 * Tự giãn dọc khi có nhiều hoạt động.
 */
export function journeyNodeMapPositions(nodeCount, opts = {}) {
  const count = Math.max(0, Number(nodeCount) || 0);
  if (!count) {
    return { positions: [], trackHeightPx: 0, viewBoxW: VIEWBOX_W, viewBoxH: VIEWBOX_H };
  }

  const spine = parseSpinePoints();
  const laneW = Math.max(200, Number(opts.laneWidthPx) || 280);
  const yPadding = Number(opts.yPadding ?? 32);
  const { yMin, yMax } = spineYBounds(spine);
  const usableYMin = yMin + yPadding * 0.4;
  const usableYMax = yMax - yPadding * 0.45;
  const ySpan = Math.max(1, usableYMax - usableYMin);

  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const targetY = usableYMin + t * ySpan;
    const [x, y] = spinePointAtY(targetY, spine);
    positions.push({
      viewX: x,
      viewY: y,
      xPct: (x / VIEWBOX_W) * 100,
      yPct: (y / VIEWBOX_H) * 100,
    });
  }

  const minDy = count <= 3 ? 0 : Math.max(38, ySpan / Math.max(count - 1, 1) * 0.95);
  for (let i = 1; i < count; i += 1) {
    if (positions[i].viewY - positions[i - 1].viewY < minDy) {
      positions[i].viewY = Math.min(usableYMax, positions[i - 1].viewY + minDy);
      syncPositionFromView(positions[i], spine);
    }
  }

  const aspect = VIEWBOX_H / VIEWBOX_W;
  const baseTrack = Math.round(laneW * aspect * 0.92);
  const extra = Math.max(0, count - 4) * 52;
  const trackHeightPx = Math.max(280, Math.round(baseTrack + extra));

  return {
    positions,
    trackHeightPx,
    viewBoxW: VIEWBOX_W,
    viewBoxH: VIEWBOX_H,
  };
}

/** Đường nối mềm qua các mốc (viewBox), trả về danh sách segment { d, index }. */
export function journeyLinkSegments(positions = []) {
  const segs = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const a = positions[i];
    const b = positions[i + 1];
    if (!a || !b) continue;
    const mx = (a.viewX + b.viewX) / 2;
    const my = (a.viewY + b.viewY) / 2;
  const lean = (b.viewX - a.viewX) * 0.12;
    const d = `M ${a.viewX} ${a.viewY} Q ${mx + lean} ${my} ${b.viewX} ${b.viewY}`;
    segs.push({ d, index: i });
  }
  return segs;
}

/**
 * Vị trí từng nút bám spine: nút 0 = phía Bắc (trên UI), nút cuối = Nam.
 * @deprecated dùng journeyNodeMapPositions — giữ cho mobile cũ / test
 */
export function journeyNodeLayout(nodeCount, opts = {}) {
  const { positions, trackHeightPx } = journeyNodeMapPositions(nodeCount, opts);
  const laneW = Math.max(200, Number(opts.laneWidthPx) || 280);
  const xScale = laneW / VIEWBOX_W;
  const offsets = positions.map((p) => Math.round((p.viewX - MAP_CENTER_X) * xScale * 10) / 10);
  const nodeBlock = Math.max(64, Number(opts.nodeBlockPx) || DEFAULT_NODE_BLOCK_PX);
  const verticalGaps = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const dy = positions[i + 1].viewY - positions[i].viewY;
    const along = (dy / VIEWBOX_H) * trackHeightPx;
    const gap = along - nodeBlock;
    verticalGaps.push(Math.round(Math.min(52, Math.max(10, gap))));
  }
  return { offsets, verticalGaps, trackHeightPx };
}

export function journeyNodeOffsets(nodeCount, laneWidthPx = 280) {
  const lane = Number(laneWidthPx);
  const useLane = lane > 96 ? lane : 280;
  return journeyNodeLayout(nodeCount, { laneWidthPx: useLane }).offsets;
}

export function journeyNodeVerticalGaps(nodeCount, laneWidthPx = 280) {
  const lane = Number(laneWidthPx);
  const useLane = lane > 96 ? lane : 280;
  return journeyNodeLayout(nodeCount, { laneWidthPx: useLane }).verticalGaps;
}
