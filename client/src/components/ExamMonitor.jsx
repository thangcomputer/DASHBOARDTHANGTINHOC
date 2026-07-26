import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const CONFIG = {
  /** Số lần vi phạm đã xác nhận tối đa (mắt hoặc bất động) trước khi hủy bài */
  MAX_FACE_VIOLATIONS: 5,
  /** Lấy mẫu frame (ms) */
  SAMPLE_INTERVAL_MS: 280,
  /** Không thấy người/mặt trong khung */
  FACE_ABSENT_CONFIRM_MS: 1200,
  FACE_ABSENT_MIN_FRAMES: 4,
  /** Không thấy mắt liên tục ≥ N ms */
  EYE_MISS_CONFIRM_MS: 1800,
  EYE_MISS_MIN_FRAMES: 5,
  /** Không có chuyển động trong khung này (ms) */
  MOTION_STALE_MS: 28000,
  /** Grace period sau khi bật camera */
  MOTION_GRACE_MS: 8000,
  MOTION_LUMA_DELTA: 12,
  MOTION_CHANGED_RATIO: 0.014,
  WARN_COOLDOWN_MS: 4500,
  GAZE_CENTER_MIN: 0.38,
  GAZE_CENTER_MAX: 0.62,
  /** Vùng oval giám sát (khớp UI preview) — chỉ chấp nhận mặt trong vùng này */
  OVAL_CX: 0.5,
  OVAL_CY: 0.43,
  OVAL_RX: 0.21,
  OVAL_RY: 0.3,
  /** Mặt nhìn xuống (điện thoại): tâm mặt quá thấp trong khung */
  GAZE_CY_MAX: 0.48,
  GAZE_CY_MIN: 0.18,
  GAZE_MISS_CONFIRM_MS: 1500,
  GAZE_MISS_MIN_FRAMES: 4,
  DETECT_W: 320,
  DETECT_H: 240,
  MIN_FACE_AREA_RATIO: 0.028,
  MIN_FACE_BOX_ASPECT: 0.42,
  MAX_FACE_BOX_ASPECT: 1.22,
  MIN_FACE_SKIN_RATIO: 0.052,
  MIN_EYE_SKIN_RATIO: 0.038,
  /** Tỷ lệ pixel da tối thiểu trong bbox mặt (loại false-positive ghế/tường) */
  MIN_BBOX_SKIN_RATIO: 0.075,
  GRID_COLS: 18,
  GRID_ROWS: 14,
};

/** Điểm chuẩn hóa (0–1) có nằm trong oval giám sát không */
function pointInProctorOval(nx, ny, margin = 1) {
  const dx = (nx - CONFIG.OVAL_CX) / (CONFIG.OVAL_RX * margin);
  const dy = (ny - CONFIG.OVAL_CY) / (CONFIG.OVAL_RY * margin);
  return dx * dx + dy * dy <= 1;
}

function faceBoxMetrics(box, vw, vh) {
  const bw = box.width;
  const bh = box.height;
  const cx = (box.left + bw / 2) / vw;
  const eyeY = (box.top + bh * 0.32) / vh;
  const centerY = (box.top + bh / 2) / vh;
  const areaRatio = (bw * bh) / (vw * vh);
  const ar = bw / Math.max(bh, 1);
  return { cx, eyeY, centerY, areaRatio, ar };
}

function faceBoxInProctorOval(box, vw, vh) {
  if (!box || !vw || !vh) return false;
  const { cx, eyeY, areaRatio, ar } = faceBoxMetrics(box, vw, vh);
  if (areaRatio < CONFIG.MIN_FACE_AREA_RATIO) return false;
  if (ar < CONFIG.MIN_FACE_BOX_ASPECT || ar > CONFIG.MAX_FACE_BOX_ASPECT) return false;
  return pointInProctorOval(cx, eyeY, 0.96);
}

function getValidatedOvalFaces(faces, frame, w, h) {
  return (faces || []).filter((face) => {
    const box = face?.boundingBox;
    if (!box || !faceBoxInProctorOval(box, w, h)) return false;
    return faceBoxHasRealSkin(frame, w, h, box);
  });
}

/** Da tập trung rõ ràng ngoài oval (người ngồi lệch) */
function isSkinClearlyOutsideOval(imageData, w, h) {
  const mass = measureSkinMass(imageData, w, h);
  if (!mass || mass.skinHits < 28) return false;
  return !pointInProctorOval(mass.centroidX, mass.centroidY, 0.7);
}

function evaluateFacePresence(frame, faces, w, h) {
  const ovalFaces = getValidatedOvalFaces(faces, frame, w, h);
  if (ovalFaces.length > 0) {
    return { present: true, ovalFaces };
  }
  if (isSkinClearlyOutsideOval(frame, w, h)) {
    return { present: false, ovalFaces: [] };
  }
  if (heuristicFacePresent(frame, w, h)) {
    return { present: true, ovalFaces: [] };
  }
  return { present: false, ovalFaces: [] };
}

/** Tâm khối da toàn khung — người lệch mép sẽ có tâm ngoài oval */
function measureSkinMass(imageData, w, h) {
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

/** Xác nhận bbox FaceDetector có da thật (không phải ghế/tường) */
function faceBoxHasRealSkin(imageData, w, h, box) {
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

/** Vẽ frame camera lật ngang — khớp preview oval (scale-x-[-1]) */
function drawMirroredVideoFrame(ctx, vid, w, h) {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(vid, 0, 0, w, h);
  ctx.restore();
}

function isSkinLike(r, g, b) {
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331364 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const sum = r + g + b + 1e-6;
  const nr = r / sum;
  const ng = g / sum;
  const rgbLoose =
    nr > 0.31 &&
    nr < 0.64 &&
    ng > 0.17 &&
    ng < 0.47 &&
    r > 50 &&
    r > g * 0.82 &&
    r > b;
  const darkerTone =
    L > 24 &&
    L < 158 &&
    r > 30 &&
    g > 24 &&
    b > 14 &&
    Math.max(r, g, b) - Math.min(r, g, b) > 10;
  const chromaRg = Math.max(r, g, b) - Math.min(r, g, b);
  if (chromaRg < 13 && L > 18 && L < 138) return false;
  const neutralGray =
    Math.abs(cb - 128) < 22 && Math.abs(cr - 128) < 22 && chromaRg < 22;
  if (neutralGray && L > 22 && L < 125) return false;
  const skinYcbcr2 =
    !neutralGray && cr >= 123 && cr <= 198 && cb >= 62 && cb <= 140;
  return skinYcbcr2 || rgbLoose || darkerTone;
}

function frameLooksLikeLensBlocked(imageData, w, h) {
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

function getEyePoints(face, vw, vh) {
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

/** Heuristic: da tập trung trong oval trung tâm (không tính người ở mép khung) */
function heuristicFacePresent(imageData, w, h) {
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

  const centroidX = sumX / skinHits;
  const centroidY = sumY / skinHits;
  return pointInProctorOval(centroidX, centroidY, 0.94);
}

/** Mắt nhìn thấy — mặt phải nằm trong oval giám sát */
function eyesVisibleFromFace(face, vw, vh) {
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

/** Vùng mắt: nửa trên của oval giám sát */
function heuristicEyesInFrame(imageData, w, h) {
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
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      if (L < 10) continue;
      samples++;
      if (isSkinLike(r, g, b)) skinHits++;
    }
  }

  if (samples === 0) return false;
  return skinHits / samples >= CONFIG.MIN_EYE_SKIN_RATIO;
}

/** Mặt nhìn thẳng màn hình — trong oval, không cúi xuống điện thoại */
function faceLookingStraightAtScreen(face, vw, vh) {
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

function heuristicLookingStraight(imageData, w, h) {
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

function sampleLumaGrid(imageData, w, h) {
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
      const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      grid[gy * cols + gx] = L;
    }
  }
  return grid;
}

function detectMotionFromGrids(prev, curr) {
  if (!prev || !curr || prev.length !== curr.length) return false;
  let changed = 0;
  for (let i = 0; i < curr.length; i++) {
    if (Math.abs(curr[i] - prev[i]) >= CONFIG.MOTION_LUMA_DELTA) changed++;
  }
  return changed / curr.length >= CONFIG.MOTION_CHANGED_RATIO;
}

function readStoredFaceViolations(persistKey, initialCount = 0) {
  let fromLs = 0;
  if (persistKey) {
    try {
      fromLs = parseInt(localStorage.getItem(persistKey) || '0', 10) || 0;
    } catch { /* ignore */ }
  }
  const fromServer = Number(initialCount) || 0;
  return Math.min(CONFIG.MAX_FACE_VIOLATIONS, Math.max(0, fromLs, fromServer));
}

function writeStoredFaceViolations(persistKey, count) {
  if (!persistKey) return;
  try {
    localStorage.setItem(persistKey, String(count));
  } catch { /* ignore */ }
}

const ExamMonitor = forwardRef(({
  isActive,
  onViolate,
  requireWebcam = true,
  enableTabGuard = true,
  persistKey = null,
  initialFaceViolations = 0,
  onFaceViolationChange = null,
}, ref) => {
  const [tabWarnings, setTabWarnings] = useState(0);
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [lastFaceDetected, setLastFaceDetected] = useState(false);
  const [lastFacePresent, setLastFacePresent] = useState(false);
  const [lastMotionDetected, setLastMotionDetected] = useState(false);
  const [lastLookingStraight, setLastLookingStraight] = useState(false);
  const [warningOverlay, setWarningOverlay] = useState(null);
  const [isTerminated, setIsTerminated] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const faceViolationCountRef = useRef(readStoredFaceViolations(persistKey, initialFaceViolations));
  const tabWarningsRef = useRef(0);
  const onViolateRef = useRef(onViolate);
  const onFaceViolationChangeRef = useRef(onFaceViolationChange);

  const prevLumaGridRef = useRef(null);
  const prevFaceCenterRef = useRef(null);
  const consecutiveNoEyeFramesRef = useRef(0);
  const consecutiveNoFaceFramesRef = useRef(0);
  const eyeMissSinceRef = useRef(null);
  const faceAbsentSinceRef = useRef(null);
  const consecutiveGazeOffFramesRef = useRef(0);
  const gazeMissSinceRef = useRef(null);
  const lastMotionAtRef = useRef(Date.now());
  const monitorStartedAtRef = useRef(Date.now());
  const lastWarnAtRef = useRef({ eye: 0, motion: 0, gaze: 0, absence: 0 });
  const eyeViolationPendingRef = useRef(false);
  const absenceViolationPendingRef = useRef(false);
  const motionViolationPendingRef = useRef(false);
  const gazeViolationPendingRef = useRef(false);

  useEffect(() => { onViolateRef.current = onViolate; }, [onViolate]);
  useEffect(() => { onFaceViolationChangeRef.current = onFaceViolationChange; }, [onFaceViolationChange]);

  useEffect(() => {
    faceViolationCountRef.current = readStoredFaceViolations(persistKey, initialFaceViolations);
  }, [persistKey, initialFaceViolations, isActive]);

  const terminateExam = useCallback((reason) => {
    if (isTerminated) return;
    setIsTerminated(true);
    setWarningOverlay({ type: 'terminated', message: 'KẾT THÚC BÀI THI!', sub: reason, persistent: true });
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (onViolateRef.current) onViolateRef.current(reason);
  }, [isTerminated]);

  const playWarningBeep = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      oscillator.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch { /* ignore */ }
  }, []);

  const registerViolation = useCallback((kind, overlay) => {
    const now = Date.now();
    if (now - (lastWarnAtRef.current[kind] || 0) < CONFIG.WARN_COOLDOWN_MS) return false;

    faceViolationCountRef.current = Math.min(
      CONFIG.MAX_FACE_VIOLATIONS,
      faceViolationCountRef.current + 1,
    );
    const total = faceViolationCountRef.current;
    writeStoredFaceViolations(persistKey, total);
    if (onFaceViolationChangeRef.current) {
      onFaceViolationChangeRef.current(total);
    }

    lastWarnAtRef.current[kind] = now;
    playWarningBeep();
    setWarningOverlay({
      ...overlay,
      count: total,
      max: CONFIG.MAX_FACE_VIOLATIONS,
    });

    if (total >= CONFIG.MAX_FACE_VIOLATIONS) {
      terminateExam(
        `Vi phạm giám sát camera đủ ${CONFIG.MAX_FACE_VIOLATIONS} lần (cộng dồn). Bài thi bị hủy tự động!`,
      );
    }
    return true;
  }, [persistKey, playWarningBeep, terminateExam]);

  const confirmViolation = useCallback((kind, overlay, resetFn) => {
    const ok = registerViolation(kind, overlay);
    if (ok && typeof resetFn === 'function') resetFn();
    return ok;
  }, [registerViolation]);

  useImperativeHandle(ref, () => ({
    getStats: () => ({
      cameraWarnings: faceViolationCountRef.current,
      tabWarnings: tabWarningsRef.current,
      lastFaceDetected,
      lastFacePresent,
      lastMotionDetected,
      lastLookingStraight,
      cameraStatus,
      consecutiveNoFace: faceViolationCountRef.current,
      faceViolationCount: faceViolationCountRef.current,
    }),
    getStream: () => streamRef.current,
    videoRef,
  }), [lastFaceDetected, lastFacePresent, lastMotionDetected, lastLookingStraight, cameraStatus]);

  useEffect(() => {
    if (!isActive || isTerminated) return;
    if (!requireWebcam) {
      setCameraStatus('active');
      setLastFaceDetected(true);
      setLastFacePresent(true);
      setLastMotionDetected(true);
      return;
    }

    const already = readStoredFaceViolations(persistKey, initialFaceViolations);
    faceViolationCountRef.current = already;
    if (already >= CONFIG.MAX_FACE_VIOLATIONS) {
      terminateExam(
        `Đã đủ ${CONFIG.MAX_FACE_VIOLATIONS} lần vi phạm giám sát (cộng dồn). Bài thi bị hủy!`,
      );
      return;
    }

    let isMounted = true;
    monitorStartedAtRef.current = Date.now();
    lastMotionAtRef.current = Date.now();
    consecutiveNoEyeFramesRef.current = 0;
    consecutiveNoFaceFramesRef.current = 0;
    eyeMissSinceRef.current = null;
    faceAbsentSinceRef.current = null;
    consecutiveGazeOffFramesRef.current = 0;
    gazeMissSinceRef.current = null;
    prevLumaGridRef.current = null;
    prevFaceCenterRef.current = null;
    eyeViolationPendingRef.current = false;
    absenceViolationPendingRef.current = false;
    motionViolationPendingRef.current = false;
    gazeViolationPendingRef.current = false;

    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.DETECT_W;
    canvas.height = CONFIG.DETECT_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let faceDetector = null;
    if ('FaceDetector' in window) {
      try {
        faceDetector = new window.FaceDetector({ maxDetectedFaces: 3, fastMode: true });
      } catch {
        try {
          faceDetector = new window.FaceDetector({ maxDetectedFaces: 3 });
        } catch {
          faceDetector = null;
        }
      }
    }

    const waitForVideoFrames = (video, timeoutMs = 10000) =>
      new Promise((resolve) => {
        if (!video) {
          resolve();
          return;
        }
        const done = () => {
          clearTimeout(tid);
          video.removeEventListener('loadeddata', tick);
          video.removeEventListener('playing', tick);
          video.removeEventListener('canplay', tick);
          resolve();
        };
        const tick = () => {
          if (video.readyState >= 2 && video.videoWidth > 0) done();
        };
        const tid = setTimeout(done, timeoutMs);
        if (video.readyState >= 2 && video.videoWidth > 0) {
          clearTimeout(tid);
          resolve();
          return;
        }
        video.addEventListener('loadeddata', tick, { passive: true });
        video.addEventListener('playing', tick, { passive: true });
        video.addEventListener('canplay', tick, { passive: true });
        tick();
      });

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', '');
          videoRef.current.play().catch(() => {});
        }
        await waitForVideoFrames(videoRef.current);
        if (!isMounted) return;

        setCameraStatus('active');

        const runSample = async () => {
          if (!isMounted || isTerminated || !videoRef.current || videoRef.current.readyState < 2) return;
          const vid = videoRef.current;
          if (!vid.videoWidth) return;

          try {
            drawMirroredVideoFrame(ctx, vid, CONFIG.DETECT_W, CONFIG.DETECT_H);
            const frame = ctx.getImageData(0, 0, CONFIG.DETECT_W, CONFIG.DETECT_H);
            const now = Date.now();

            const lensBlocked = frameLooksLikeLensBlocked(frame, CONFIG.DETECT_W, CONFIG.DETECT_H);

            let facePresent = false;
            let eyesVisible = false;
            let lookingStraight = false;
            let faceMoved = false;
            const bboxW = CONFIG.DETECT_W;
            const bboxH = CONFIG.DETECT_H;

            if (faceDetector) {
              let faces = null;
              try {
                faces = await faceDetector.detect(canvas);
              } catch {
                faces = null;
              }

              const presence = evaluateFacePresence(frame, faces, bboxW, bboxH);
              facePresent = presence.present;
              const ovalFaces = presence.ovalFaces;

              if (ovalFaces.length > 0) {
                eyesVisible = ovalFaces.some((face) => eyesVisibleFromFace(face, bboxW, bboxH));
                lookingStraight = ovalFaces.some((face) => faceLookingStraightAtScreen(face, bboxW, bboxH));
                const box = ovalFaces[0]?.boundingBox;
                if (box) {
                  const cx = (box.left + box.width / 2) / bboxW;
                  const cy = (box.top + box.height / 2) / bboxH;
                  const prev = prevFaceCenterRef.current;
                  if (prev) {
                    const dx = Math.abs(cx - prev.cx);
                    const dy = Math.abs(cy - prev.cy);
                    if (dx > 0.01 || dy > 0.01) faceMoved = true;
                  }
                  prevFaceCenterRef.current = { cx, cy };
                }
              } else if (facePresent) {
                eyesVisible = heuristicEyesInFrame(frame, bboxW, bboxH);
                lookingStraight = heuristicLookingStraight(frame, bboxW, bboxH);
                prevFaceCenterRef.current = null;
              } else {
                eyesVisible = false;
                lookingStraight = false;
                prevFaceCenterRef.current = null;
              }
            } else {
              const presence = evaluateFacePresence(frame, null, bboxW, bboxH);
              facePresent = presence.present;
              eyesVisible = facePresent && heuristicEyesInFrame(frame, bboxW, bboxH);
              lookingStraight = facePresent && heuristicLookingStraight(frame, bboxW, bboxH);
            }

            if (lensBlocked) {
              facePresent = false;
              eyesVisible = false;
              lookingStraight = false;
            }

            const lumaGrid = sampleLumaGrid(frame, CONFIG.DETECT_W, CONFIG.DETECT_H);
            const pixelMotion = detectMotionFromGrids(prevLumaGridRef.current, lumaGrid);
            prevLumaGridRef.current = lumaGrid;

            const hadMotion = pixelMotion || faceMoved;
            if (hadMotion) {
              lastMotionAtRef.current = now;
              motionViolationPendingRef.current = false;
            }

            setLastFacePresent(facePresent);
            setLastFaceDetected(eyesVisible);
            setLastLookingStraight(lookingStraight);
            setLastMotionDetected(
              now - lastMotionAtRef.current < CONFIG.MOTION_STALE_MS,
            );

            // ── Không thấy người trong khung ──
            if (!facePresent) {
              consecutiveNoFaceFramesRef.current += 1;
              if (!faceAbsentSinceRef.current) faceAbsentSinceRef.current = now;
              consecutiveNoEyeFramesRef.current = 0;
              eyeMissSinceRef.current = null;
              eyeViolationPendingRef.current = false;
              consecutiveGazeOffFramesRef.current = 0;
              gazeMissSinceRef.current = null;
              gazeViolationPendingRef.current = false;

              const absentDuration = now - faceAbsentSinceRef.current;
              const absentFrames = consecutiveNoFaceFramesRef.current;
              const absentConfirmed =
                absentFrames >= CONFIG.FACE_ABSENT_MIN_FRAMES &&
                absentDuration >= CONFIG.FACE_ABSENT_CONFIRM_MS;

              if (absentConfirmed) {
                confirmViolation('absence', {
                  type: 'camera',
                  message: '🚫 KHÔNG THẤY NGƯỜI TRONG KHUNG!',
                  sub: `Đưa mặt vào giữa khung camera (vòng oval). Lỗi cộng dồn — đủ ${CONFIG.MAX_FACE_VIOLATIONS} lần sẽ hủy bài.`,
                }, () => {
                  consecutiveNoFaceFramesRef.current = 0;
                  faceAbsentSinceRef.current = null;
                });
              }
            } else {
              consecutiveNoFaceFramesRef.current = 0;
              faceAbsentSinceRef.current = null;

            // ── Eye tracking: có người nhưng không thấy mắt ──
            if (eyesVisible) {
              consecutiveNoEyeFramesRef.current = 0;
              eyeMissSinceRef.current = null;
            } else {
              consecutiveNoEyeFramesRef.current += 1;
              if (!eyeMissSinceRef.current) eyeMissSinceRef.current = now;

              const missDuration = now - eyeMissSinceRef.current;
              const missFrames = consecutiveNoEyeFramesRef.current;
              const confirmed =
                missFrames >= CONFIG.EYE_MISS_MIN_FRAMES &&
                missDuration >= CONFIG.EYE_MISS_CONFIRM_MS;

              if (confirmed) {
                confirmViolation('eye', {
                  type: 'camera',
                  message: '👁 KHÔNG THẤY MẮT TRONG KHUNG!',
                  sub: `Nhìn thẳng vào camera, không che mặt. Lỗi cộng dồn — đủ ${CONFIG.MAX_FACE_VIOLATIONS} lần sẽ hủy bài.`,
                }, () => {
                  consecutiveNoEyeFramesRef.current = 0;
                  eyeMissSinceRef.current = null;
                });
              }
            }

            // ── Gaze: mặt không nhìn thẳng màn hình ──
            if (facePresent && eyesVisible && !lookingStraight) {
              consecutiveGazeOffFramesRef.current += 1;
              if (!gazeMissSinceRef.current) gazeMissSinceRef.current = now;
              const gazeDuration = now - gazeMissSinceRef.current;
              const gazeFrames = consecutiveGazeOffFramesRef.current;
              const gazeConfirmed =
                gazeFrames >= CONFIG.GAZE_MISS_MIN_FRAMES &&
                gazeDuration >= CONFIG.GAZE_MISS_CONFIRM_MS;
              if (gazeConfirmed) {
                confirmViolation('gaze', {
                  type: 'camera',
                  message: '⚠ MẶT KHÔNG NHÌN THẲNG MÀN HÌNH!',
                  sub: `Hãy quay mặt vào giữa màn hình khi làm bài. Lỗi cộng dồn — đủ ${CONFIG.MAX_FACE_VIOLATIONS} lần sẽ hủy bài.`,
                }, () => {
                  consecutiveGazeOffFramesRef.current = 0;
                  gazeMissSinceRef.current = null;
                });
              }
            } else if (lookingStraight) {
              consecutiveGazeOffFramesRef.current = 0;
              gazeMissSinceRef.current = null;
            }
            }

            // ── Motion tracking: không chuyển động quá lâu ──
            const sinceStart = now - monitorStartedAtRef.current;
            const sinceMotion = now - lastMotionAtRef.current;
            if (
              facePresent &&
              sinceStart > CONFIG.MOTION_GRACE_MS &&
              sinceMotion >= CONFIG.MOTION_STALE_MS
            ) {
              confirmViolation('motion', {
                type: 'camera',
                message: '⚠ KHÔNG PHÁT HIỆN CHUYỂN ĐỘNG!',
                sub: `Không có chuyển động đầu/mắt/vai trong ${Math.round(CONFIG.MOTION_STALE_MS / 1000)}s. Có thể rời chỗ hoặc dùng ảnh tĩnh. Lỗi cộng dồn — đủ ${CONFIG.MAX_FACE_VIOLATIONS} lần sẽ hủy bài.`,
              }, () => {
                lastMotionAtRef.current = now;
                motionViolationPendingRef.current = false;
              });
            }
          } catch (e) {
            console.error('ExamMonitor: sample error', e);
          }
        };

        await new Promise((r) => setTimeout(r, 300));
        await runSample();
        intervalRef.current = setInterval(runSample, CONFIG.SAMPLE_INTERVAL_MS);
      } catch (err) {
        console.error('ExamMonitor: Camera access denied', err);
        setCameraStatus('denied');
        setLastFaceDetected(true);
        setLastMotionDetected(true);
      }
    };

    setupCamera();
    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [isActive, isTerminated, requireWebcam, terminateExam, persistKey, initialFaceViolations, confirmViolation]);

  useEffect(() => {
    if (!isActive || isTerminated || !enableTabGuard) return;

    tabWarningsRef.current = 0;
    setTabWarnings(0);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabWarningsRef.current += 1;
        setTabWarnings(tabWarningsRef.current);
        const w = tabWarningsRef.current;
        playWarningBeep();

        if (w >= 2) {
          terminateExam('Chuyển tab hoặc rời khỏi màn hình thi quá 2 lần. Bài thi bị hủy tự động!');
        } else {
          setWarningOverlay({
            type: 'tab',
            message: 'CẢNH BÁO CHUYỂN TAB!',
            sub: 'Hệ thống phát hiện bạn vừa rời khỏi màn hình thi. Nếu tiếp tục vi phạm nốt lần nữa, bài thi sẽ tự động HỦY.',
            count: w,
            max: 2,
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, isTerminated, enableTabGuard, terminateExam, playWarningBeep]);

  if (!isActive && !warningOverlay) return null;

  const warningPortal = warningOverlay ? createPortal(
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-red-950/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[40px] shadow-[0_32px_120px_-15px_rgba(220,38,38,0.5)] w-full max-w-sm overflow-hidden border-t-[12px] border-red-600 animate-in zoom-in duration-500 scale-100">
        <div className="p-10 text-center space-y-6">
          <div className={`w-24 h-24 rounded-[35%] flex items-center justify-center mx-auto shadow-2xl ${warningOverlay.type === 'tab' ? 'bg-orange-100 text-orange-600 shadow-orange-100' : 'bg-red-100 text-red-600 shadow-red-100'} animate-bounce`}>
            <AlertTriangle size={48} />
          </div>
          <div>
            <h2 className="text-gray-900 font-extrabold text-3xl uppercase tracking-tighter leading-none">{warningOverlay.message}</h2>
            <p className="text-gray-400 font-bold mt-3 text-sm leading-relaxed">{warningOverlay.sub}</p>
          </div>

          {warningOverlay.count != null && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-end">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Mức độ vi phạm</span>
                <span className="text-sm font-black text-red-600">{warningOverlay.count}/{warningOverlay.max}</span>
              </div>
              <div className="h-5 bg-gray-100 rounded-full overflow-hidden border border-gray-200 p-1">
                <div className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(220,38,38,0.4)]" style={{ width: `${(warningOverlay.count / warningOverlay.max) * 100}%` }} />
              </div>
              <p className="text-xs cms-min-text-xs text-gray-400 font-bold uppercase italic">* Đạt {warningOverlay.max}/{warningOverlay.max} bài thi sẽ bị hủy tự động</p>
            </div>
          )}

          {!warningOverlay.persistent ? (
            <button type="button" onClick={() => setWarningOverlay(null)} className="w-full py-5 bg-gray-900 text-white font-black rounded-3xl shadow-2xl shadow-gray-200 hover:bg-black hover:scale-[1.03] active:scale-95 transition-all text-lg tracking-tight">
              TÔI ĐÃ HIỂU, TIẾP TỤC THI
            </button>
          ) : (
            <div className="pt-4">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {isActive && (
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          width: 320,
          height: 240,
          opacity: 0.02,
          pointerEvents: 'none',
          zIndex: 2147483646,
          objectFit: 'cover',
        }}
      />
      )}
      {warningPortal}
    </>
  );
});

export const CameraHeaderPanel = ({ monitorRef, variant = 'default' }) => {
  const isLarge = variant === 'large';
  const [stats, setStats] = useState({
    cameraWarnings: 0,
    tabWarnings: 0,
    lastFaceDetected: true,
    lastFacePresent: true,
    lastMotionDetected: true,
    cameraStatus: 'loading',
    consecutiveNoFace: 0,
  });
  const previewVideoRef = useRef(null);

  useEffect(() => {
    const syncPreview = () => {
      const mon = monitorRef.current;
      const prev = previewVideoRef.current;
      if (!mon || !prev) return;
      const stream = typeof mon.getStream === 'function' ? mon.getStream() : null;
      const monitorVideo = mon.videoRef?.current;
      const source = stream || monitorVideo?.srcObject;
      if (source && prev.srcObject !== source) {
        prev.srcObject = source;
        prev.muted = true;
        prev.setAttribute('playsinline', '');
        prev.play().catch(() => {});
      }
    };

    const t = setInterval(() => {
      if (monitorRef.current) {
        setStats(monitorRef.current.getStats());
        syncPreview();
      }
    }, 400);
    return () => clearInterval(t);
  }, [monitorRef]);

  return (
    <div
      className={`backdrop-blur-xl shadow-2xl min-w-0 max-w-full ${
        isLarge
          ? 'flex flex-col gap-1.5 rounded-xl border border-white/15 bg-gradient-to-br from-slate-800/95 to-slate-950/95 p-2 md:gap-2 md:rounded-2xl md:p-2.5'
          : 'flex items-center gap-4 rounded-2xl border border-white/5 bg-slate-900/90 p-2.5'
      }`}
    >
      <div
        className={`relative bg-black/40 overflow-hidden border border-white/10 rounded-lg ${
          isLarge
            ? 'block aspect-[5/3] w-full max-h-[4.75rem] sm:max-h-[5.25rem] md:max-h-24'
            : 'block h-12 w-[4.5rem] shrink-0 sm:h-14 sm:w-20'
        }`}
      >
        <video ref={previewVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
        <div className="absolute inset-0 flex items-start justify-center pt-0.5 pointer-events-none">
          <div
            className="w-[58%] aspect-[3/4] max-h-[78%] rounded-[42%] border-2 border-dashed border-white/55 opacity-90 shadow-[0_0_6px_rgba(0,0,0,0.6)]"
            aria-hidden
          />
        </div>
        <div className={`absolute inset-0 pointer-events-none ${stats.lastFacePresent && stats.lastFaceDetected ? 'bg-emerald-500/10' : 'bg-red-500/25 animate-pulse'}`} />
        <div className="absolute top-1 left-1.5 flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className={`text-white/60 font-black uppercase ${isLarge ? 'text-xs cms-min-text-xs' : 'text-xs cms-min-text-xs'}`}>Live</span>
        </div>
        {(!stats.lastFacePresent || !stats.lastFaceDetected) && (
          <div className="absolute bottom-0.5 left-0 right-0 text-center px-0.5">
            <span className="text-xs cms-min-text-xs leading-tight text-amber-200 font-black bg-black/70 px-1 py-0.5 rounded block animate-pulse">
              {!stats.lastFacePresent ? 'Không thấy người' : 'Không thấy mắt'}
            </span>
          </div>
        )}
      </div>
      <div className={`flex flex-col ${isLarge ? 'w-full min-w-0' : 'pr-3'}`}>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-sky-400 shrink-0" />
          <span className={`text-white/60 uppercase font-black tracking-wider ${isLarge ? 'text-xs md:text-xs' : 'text-xs text-white/50'}`}>Giám sát bài thi</span>
        </div>
        <div className={`flex flex-col font-mono ${isLarge ? 'mt-1 gap-0' : 'mt-1.5 gap-0.5'}`}>
          {stats.cameraStatus === 'denied' && (
            <span className="text-xs cms-min-text-xs font-bold text-red-400 leading-tight">
              Camera bị chặn — cho phép truy cập camera và tải lại trang.
            </span>
          )}
          {stats.cameraStatus === 'loading' && (
            <span className="text-xs cms-min-text-xs font-bold text-amber-200/90 leading-tight">Đang bật camera…</span>
          )}
          <span className={`font-bold text-white/75 leading-tight ${isLarge ? 'text-xs md:text-xs' : 'text-xs text-white/70'}`}>
            Người trong khung:{' '}
            <span className={stats.lastFacePresent ? 'text-emerald-400' : 'text-red-400'}>
              {stats.lastFacePresent ? 'có' : 'không'}
            </span>
          </span>
          <span className={`font-bold text-white/75 leading-tight ${isLarge ? 'text-xs md:text-xs' : 'text-xs text-white/70'}`}>
            Mắt trong khung:{' '}
            <span className={stats.lastFaceDetected ? 'text-emerald-400' : 'text-amber-300'}>
              {stats.lastFaceDetected ? 'có' : 'chưa có'}
            </span>
          </span>
          <span className={`font-bold text-white/75 leading-tight ${isLarge ? 'text-xs md:text-xs' : 'text-xs text-white/70'}`}>
            Nhìn thẳng màn hình:{' '}
            <span className={stats.lastLookingStraight !== false ? 'text-emerald-400' : 'text-amber-300'}>
              {stats.lastLookingStraight !== false ? 'có' : 'chưa'}
            </span>
          </span>
          <span className={`font-bold text-white/75 leading-tight ${isLarge ? 'text-xs md:text-xs' : 'text-xs text-white/70'}`}>
            Chuyển động:{' '}
            <span className={stats.lastMotionDetected !== false ? 'text-emerald-400' : 'text-amber-300'}>
              {stats.lastMotionDetected !== false ? 'có' : 'không'}
            </span>
          </span>
          <div className={`flex flex-wrap items-center ${isLarge ? 'gap-x-3 gap-y-0' : 'gap-4'}`}>
            <span
              className={`font-bold text-white ${isLarge ? 'text-xs md:text-xs' : 'text-xs'}`}
              title={`Vi phạm đã xác nhận (mắt / nhìn lệch / bất động) — cộng dồn, đủ ${CONFIG.MAX_FACE_VIOLATIONS} lần hủy bài.`}
            >
              Vi phạm:{' '}
              <span className={(stats.faceViolationCount ?? stats.consecutiveNoFace ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}>
                {stats.faceViolationCount ?? stats.consecutiveNoFace ?? 0}/{CONFIG.MAX_FACE_VIOLATIONS}
              </span>
            </span>
            <span className={`font-bold text-white ${isLarge ? 'text-xs md:text-xs' : 'text-xs'}`}>
              Tab:{' '}
              <span className={stats.tabWarnings > 0 ? 'text-orange-400' : 'text-emerald-400'}>{stats.tabWarnings}/2</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamMonitor;
