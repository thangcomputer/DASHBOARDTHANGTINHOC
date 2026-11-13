import { DEW_STAGE_ANCHORS, DEW_VN_CROP, DEW_VN_VIEWBOX } from './dewSkillVietnamOutline.mjs';

function pctFromView(viewX, viewY) {
  return {
    xPct: ((viewX - DEW_VN_CROP.x) / DEW_VN_CROP.w) * 100,
    yPct: ((viewY - DEW_VN_CROP.y) / DEW_VN_CROP.h) * 100,
  };
}

function lerpAnchorAtY(targetY, anchors = DEW_STAGE_ANCHORS) {
  if (!anchors.length) return [DEW_VN_VIEWBOX.w / 2, targetY];
  if (targetY <= anchors[0][1]) return [...anchors[0]];
  const last = anchors[anchors.length - 1];
  if (targetY >= last[1]) return [...last];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (targetY < lo || targetY > hi) continue;
    const f = y1 === y0 ? 0.5 : (targetY - y0) / (y1 - y0);
    return [x0 + f * (x1 - x0), y0 + f * (y1 - y0)];
  }
  return [...last];
}

export function dewSkillAnchorsForCount(nodeCount) {
  const count = Math.max(0, Number(nodeCount) || 0);
  if (!count) return [];

  const yMin = DEW_STAGE_ANCHORS[0][1] - 24;
  const yMax = DEW_STAGE_ANCHORS[DEW_STAGE_ANCHORS.length - 1][1] + 22;
  const span = Math.max(1, yMax - yMin);

  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const viewY = yMin + t * span;
    const [viewX] = lerpAnchorAtY(viewY);
    positions.push({
      viewX,
      viewY,
      ...pctFromView(viewX, viewY),
    });
  }

  const minDy = count <= 1 ? 0 : Math.max(78, (span / Math.max(count - 1, 1)) * 0.96);
  for (let i = 1; i < count; i += 1) {
    if (positions[i].viewY - positions[i - 1].viewY < minDy) {
      positions[i].viewY = Math.min(yMax, positions[i - 1].viewY + minDy);
      const [x] = lerpAnchorAtY(positions[i].viewY);
      positions[i].viewX = x;
      Object.assign(positions[i], pctFromView(x, positions[i].viewY));
    }
  }

  return positions;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    viewX: uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0],
    viewY: uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1],
  };
}

/** Các điểm trang trí trên mỗi đoạn nối (2 giọt nước + 1 ngôi sao vàng). */
export function dewSkillDropletPoints(positions, tsp = [0.28, 0.54, 0.78]) {
  const drops = [];
  const usePct = positions[0]?.xPct != null;
  for (let i = 0; i < positions.length - 1; i += 1) {
    const a = positions[i];
    const b = positions[i + 1];
    if (usePct) {
      const midY = (a.yPct + b.yPct) / 2;
      const p0 = [a.xPct, a.yPct];
      const p1 = [a.xPct, midY];
      const p2 = [b.xPct, midY];
      const p3 = [b.xPct, b.yPct];
      tsp.forEach((t, tIdx) => {
        const { viewX: xPct, viewY: yPct } = cubicBezierPoint(p0, p1, p2, p3, t);
        const kind = tIdx === 2 ? 'star' : 'droplet';
        drops.push({ xPct, yPct, plain: true, segmentIndex: i, kind });
      });
    } else {
      const midY = (a.viewY + b.viewY) / 2;
      const p0 = [a.viewX, a.viewY];
      const p1 = [a.viewX, midY];
      const p2 = [b.viewX, midY];
      const p3 = [b.viewX, b.viewY];
      tsp.forEach((t, tIdx) => {
        const kind = tIdx === 2 ? 'star' : 'droplet';
        drops.push({ ...cubicBezierPoint(p0, p1, p2, p3, t), segmentIndex: i, kind });
      });
    }
  }
  return drops;
}

export function dewSkillRouteD(anchors) {
  if (!anchors?.length) return '';
  return anchors.slice(1).reduce((d, [x, y], i) => {
    const [px, py] = anchors[i];
    const midY = (py + y) / 2;
    return `${d} C ${px} ${midY}, ${x} ${midY}, ${x} ${y}`;
  }, `M ${anchors[0][0]} ${anchors[0][1]}`);
}

/** Nhãn nút đặt ra phía ngoài (tránh về tâm đường zigzag). */
export function dewSkillLabelSide(xPct = 50) {
  return Number(xPct) < 52 ? 'left' : 'right';
}

/** Góc badge tích/khóa — đối diện phía nhãn để không che chữ. */
export function dewSkillBadgeCorner(labelSide = 'right') {
  return labelSide === 'right' ? 'top-left' : 'top-right';
}

export function dewSkillLinkSegments(positions) {
  const segs = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const a = positions[i];
    const b = positions[i + 1];
    const midY = (a.viewY + b.viewY) / 2;
    const d = `M ${a.viewX} ${a.viewY} C ${a.viewX} ${midY}, ${b.viewX} ${midY}, ${b.viewX} ${b.viewY}`;
    segs.push({ d, index: i });
  }
  return segs;
}
