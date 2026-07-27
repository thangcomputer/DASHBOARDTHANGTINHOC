import { PROCTOR_CONFIG as CONFIG } from './config.js';

export function pointInProctorOval(nx, ny, margin = 1) {
  const dx = (nx - CONFIG.OVAL_CX) / (CONFIG.OVAL_RX * margin);
  const dy = (ny - CONFIG.OVAL_CY) / (CONFIG.OVAL_RY * margin);
  return dx * dx + dy * dy <= 1;
}

export function faceBoxMetrics(box, vw, vh) {
  const bw = box.width;
  const bh = box.height;
  const cx = (box.left + bw / 2) / vw;
  const eyeY = (box.top + bh * 0.32) / vh;
  const centerY = (box.top + bh / 2) / vh;
  const areaRatio = (bw * bh) / (vw * vh);
  const ar = bw / Math.max(bh, 1);
  return { cx, eyeY, centerY, areaRatio, ar };
}

export function faceBoxInProctorOval(box, vw, vh) {
  if (!box || !vw || !vh) return false;
  const { cx, eyeY, areaRatio, ar } = faceBoxMetrics(box, vw, vh);
  if (areaRatio < CONFIG.MIN_FACE_AREA_RATIO) return false;
  if (ar < CONFIG.MIN_FACE_BOX_ASPECT || ar > CONFIG.MAX_FACE_BOX_ASPECT) return false;
  return pointInProctorOval(cx, eyeY, 0.96);
}

export function isSkinLike(r, g, b) {
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331364 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const sum = r + g + b + 1e-6;
  const nr = r / sum;
  const ng = g / sum;
  const rgbLoose =
    nr > 0.31 && nr < 0.64 && ng > 0.17 && ng < 0.47 && r > 50 && r > g * 0.82 && r > b;
  const darkerTone =
    L > 24 && L < 158 && r > 30 && g > 24 && b > 14 && Math.max(r, g, b) - Math.min(r, g, b) > 10;
  const chromaRg = Math.max(r, g, b) - Math.min(r, g, b);
  if (chromaRg < 13 && L > 18 && L < 138) return false;
  const neutralGray = Math.abs(cb - 128) < 22 && Math.abs(cr - 128) < 22 && chromaRg < 22;
  if (neutralGray && L > 22 && L < 125) return false;
  const skinYcbcr2 = !neutralGray && cr >= 123 && cr <= 198 && cb >= 62 && cb <= 140;
  return skinYcbcr2 || rgbLoose || darkerTone;
}

export function faceBoxHasRealSkin(imageData, w, h, box) {
  if (!box) return false;
  const d = imageData.data;
  const x0 = Math.max(0, Math.floor(box.left));
  const y0 = Math.max(0, Math.floor(box.top));
  const x1 = Math.min(w, Math.ceil(box.left + box.width));
  const y1 = Math.min(h, Math.ceil(box.top + box.height * 0.72));
  let skinHits = 0;
  let samples = 0;

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (L < 12) continue;
      samples++;
      if (isSkinLike(d[i], d[i + 1], d[i + 2])) skinHits++;
    }
  }
  if (samples < 8) return false;
  return skinHits / samples >= CONFIG.MIN_BBOX_SKIN_RATIO;
}

export function measureSkinMass(imageData, w, h) {
  const d = imageData.data;
  let skinHits = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      if (L < 12) continue;
      if (!isSkinLike(r, g, b)) continue;
      skinHits++;
      sumX += x / w;
      sumY += y / h;
    }
  }
  if (skinHits < 18) return null;
  return { centroidX: sumX / skinHits, centroidY: sumY / skinHits, skinHits };
}

export function isSkinClearlyOutsideOval(imageData, w, h) {
  const mass = measureSkinMass(imageData, w, h);
  if (!mass || mass.skinHits < 28) return false;
  return !pointInProctorOval(mass.centroidX, mass.centroidY, 0.7);
}

export function getValidatedOvalFaces(faces, frame, w, h) {
  return (faces || []).filter((face) => {
    const box = face?.boundingBox;
    if (!box || !faceBoxInProctorOval(box, w, h)) return false;
    return faceBoxHasRealSkin(frame, w, h, box);
  });
}

/** Mọi khuôn mặt có da thật trong khung (không chỉ oval) — phát hiện người thứ 2 */
export function getValidatedFrameFaces(faces, frame, w, h) {
  return (faces || []).filter((face) => {
    const box = face?.boundingBox;
    if (!box || !w || !h) return false;
    const { areaRatio, ar } = faceBoxMetrics(box, w, h);
    if (areaRatio < CONFIG.MIN_FACE_AREA_RATIO * 0.85) return false;
    if (ar < CONFIG.MIN_FACE_BOX_ASPECT * 0.9 || ar > CONFIG.MAX_FACE_BOX_ASPECT * 1.15) return false;
    return faceBoxHasRealSkin(frame, w, h, box);
  });
}

export function heuristicFacePresent(imageData, w, h) {
  const d = imageData.data;
  let skinHits = 0;
  let samples = 0;
  let sumX = 0;
  let sumY = 0;
  let upperSkin = 0;
  let upperSamples = 0;
  const cx = w * CONFIG.OVAL_CX;
  const cy = h * CONFIG.OVAL_CY;
  const rx = w * CONFIG.OVAL_RX;
  const ry = h * CONFIG.OVAL_RY;
  const upperCutoff = cy - ry * 0.15;

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      if (L < 12) continue;
      samples++;
      if (y <= cy + ry * 0.1) upperSamples++;
      if (isSkinLike(r, g, b)) {
        skinHits++;
        sumX += x / w;
        sumY += y / h;
        if (y <= upperCutoff) upperSkin++;
      }
    }
  }
  if (samples === 0 || skinHits < 12) return false;
  if (skinHits / samples < CONFIG.MIN_FACE_SKIN_RATIO) return false;
  if (upperSamples > 0 && upperSkin / upperSamples < 0.025) return false;
  return pointInProctorOval(sumX / skinHits, sumY / skinHits, 0.94);
}

export function evaluateFacePresence(frame, faces, w, h) {
  const ovalFaces = getValidatedOvalFaces(faces, frame, w, h);
  if (ovalFaces.length > 0) return { present: true, ovalFaces };
  if (isSkinClearlyOutsideOval(frame, w, h)) return { present: false, ovalFaces: [] };
  if (heuristicFacePresent(frame, w, h)) return { present: true, ovalFaces: [] };
  return { present: false, ovalFaces: [] };
}

export function frameLooksLikeLensBlocked(imageData, w, h) {
  const d = imageData.data;
  let sumL = 0;
  let sumL2 = 0;
  let chromaSum = 0;
  let dark = 0;
  let n = 0;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      sumL += L;
      sumL2 += L * L;
      chromaSum += Math.max(r, g, b) - Math.min(r, g, b);
      if (L < 14) dark++;
      n++;
    }
  }
  if (n === 0) return true;
  const avgL = sumL / n;
  const variance = Math.max(0, sumL2 / n - avgL * avgL);
  const stdL = Math.sqrt(variance);
  const darkRatio = dark / n;
  const avgChroma = chromaSum / n;
  if (avgL < 10 && darkRatio > 0.8) return true;
  if (avgL < 20 && stdL < 3.5 && avgChroma < 4) return true;
  return false;
}

/** Độ sáng trung bình vùng oval (0–255) */
export function measureOvalBrightness(imageData, w, h) {
  const d = imageData.data;
  const cx = w * CONFIG.OVAL_CX;
  const cy = h * CONFIG.OVAL_CY;
  const rx = w * CONFIG.OVAL_RX;
  const ry = h * CONFIG.OVAL_RY;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * w + x) * 4;
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function getEyePoints(face, vw, vh) {
  const landmarks = face?.landmarks;
  if (!Array.isArray(landmarks) || !vw || !vh) return [];
  const eyes = [];
  for (const lm of landmarks) {
    const type = String(lm?.type || '').toLowerCase();
    if (!type.includes('eye')) continue;
    const locs = lm.locations || lm.location || [];
    const list = Array.isArray(locs) ? locs : [locs];
    for (const p of list) {
      if (p == null || p.x == null || p.y == null) continue;
      eyes.push({ nx: p.x / vw, ny: p.y / vh });
    }
  }
  return eyes;
}

export function eyesVisibleFromFace(face, vw, vh) {
  const box = face?.boundingBox;
  if (!box || !vw || !vh) return false;
  if (!faceBoxInProctorOval(box, vw, vh)) return false;
  const { areaRatio, ar } = faceBoxMetrics(box, vw, vh);
  if (ar < CONFIG.MIN_FACE_BOX_ASPECT || ar > CONFIG.MAX_FACE_BOX_ASPECT) return false;
  const eyes = getEyePoints(face, vw, vh);
  if (eyes.length >= 2) {
    const inOval = eyes.filter((e) => pointInProctorOval(e.nx, e.ny, 1.02));
    if (inOval.length < 2) return false;
    const avgEyeY = inOval.reduce((s, e) => s + e.ny, 0) / inOval.length;
    return avgEyeY >= CONFIG.GAZE_CY_MIN && avgEyeY <= CONFIG.GAZE_CY_MAX;
  }
  if (eyes.length === 1) {
    const e = eyes[0];
    if (!pointInProctorOval(e.nx, e.ny, 1.02)) return false;
    return e.ny >= CONFIG.GAZE_CY_MIN && e.ny <= CONFIG.GAZE_CY_MAX;
  }
  if (areaRatio < 0.04) return false;
  const { eyeY } = faceBoxMetrics(box, vw, vh);
  return eyeY >= CONFIG.GAZE_CY_MIN && eyeY <= CONFIG.GAZE_CY_MAX;
}

export function heuristicEyesInFrame(imageData, w, h) {
  const d = imageData.data;
  let skinHits = 0;
  let samples = 0;
  const cx = w * CONFIG.OVAL_CX;
  const cy = h * CONFIG.OVAL_CY;
  const rx = w * CONFIG.OVAL_RX;
  const ry = h * CONFIG.OVAL_RY;
  const yCut = cy + ry * 0.05;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1 || y > yCut) continue;
      const i = (y * w + x) * 4;
      const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (L < 10) continue;
      samples++;
      if (isSkinLike(d[i], d[i + 1], d[i + 2])) skinHits++;
    }
  }
  if (samples === 0) return false;
  return skinHits / samples >= CONFIG.MIN_EYE_SKIN_RATIO;
}

export function faceLookingStraightAtScreen(face, vw, vh) {
  const box = face?.boundingBox;
  if (!box || !vw || !vh) return false;
  if (!faceBoxInProctorOval(box, vw, vh)) return false;
  const { cx, eyeY, centerY, areaRatio, ar } = faceBoxMetrics(box, vw, vh);
  if (areaRatio < CONFIG.MIN_FACE_AREA_RATIO) return false;
  if (cx < CONFIG.GAZE_CENTER_MIN || cx > CONFIG.GAZE_CENTER_MAX) return false;
  if (eyeY < CONFIG.GAZE_CY_MIN || eyeY > CONFIG.GAZE_CY_MAX) return false;
  if (centerY > CONFIG.GAZE_CY_MAX + 0.06) return false;
  const eyes = getEyePoints(face, vw, vh);
  if (eyes.length >= 2) {
    const sorted = [...eyes].sort((a, b) => a.nx - b.nx);
    const eyeSpan = sorted[sorted.length - 1].nx - sorted[0].nx;
    const midX = (sorted[0].nx + sorted[sorted.length - 1].nx) / 2;
    const avgEyeY = eyes.reduce((s, e) => s + e.ny, 0) / eyes.length;
    if (Math.abs(midX - cx) > 0.1) return false;
    if (eyeSpan < 0.045 || eyeSpan > 0.42) return false;
    if (avgEyeY > CONFIG.GAZE_CY_MAX) return false;
  }
  if (ar < 0.48 || ar > 1.35) return false;
  return true;
}

export function heuristicLookingStraight(imageData, w, h) {
  if (!heuristicEyesInFrame(imageData, w, h)) return false;
  const d = imageData.data;
  let sumX = 0;
  let sumY = 0;
  let skin = 0;
  const cx = w * CONFIG.OVAL_CX;
  const cy = h * CONFIG.OVAL_CY;
  const rx = w * CONFIG.OVAL_RX;
  const ry = h * CONFIG.OVAL_RY;
  const yCut = cy + ry * 0.08;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1 || y > yCut) continue;
      const i = (y * w + x) * 4;
      if (isSkinLike(d[i], d[i + 1], d[i + 2])) {
        sumX += x / w;
        sumY += y / h;
        skin++;
      }
    }
  }
  if (skin < 10) return false;
  const avgX = sumX / skin;
  const avgY = sumY / skin;
  return (
    avgX >= CONFIG.GAZE_CENTER_MIN &&
    avgX <= CONFIG.GAZE_CENTER_MAX &&
    avgY >= CONFIG.GAZE_CY_MIN &&
    avgY <= CONFIG.GAZE_CY_MAX
  );
}

export function sampleLumaGrid(imageData, w, h) {
  const cols = CONFIG.GRID_COLS;
  const rows = CONFIG.GRID_ROWS;
  const grid = new Uint8Array(cols * rows);
  const d = imageData.data;
  const cellW = w / cols;
  const cellH = h / rows;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = Math.min(w - 1, Math.floor((gx + 0.5) * cellW));
      const py = Math.min(h - 1, Math.floor((gy + 0.5) * cellH));
      const i = (py * w + px) * 4;
      grid[gy * cols + gx] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
  }
  return grid;
}

export function detectMotionFromGrids(prev, curr) {
  if (!prev || !curr || prev.length !== curr.length) return false;
  let changed = 0;
  for (let i = 0; i < curr.length; i++) {
    if (Math.abs(curr[i] - prev[i]) >= CONFIG.MOTION_LUMA_DELTA) changed++;
  }
  return changed / curr.length >= CONFIG.MOTION_CHANGED_RATIO;
}

export function drawMirroredVideoFrame(ctx, vid, w, h) {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(vid, 0, 0, w, h);
  ctx.restore();
}
