import { PROCTOR_CONFIG as CONFIG } from './config.js';

/**
 * Điểm rủi ro cộng dồn — decay theo thời gian.
 * Hard violation chỉ khi score >= RISK_HARD_THRESHOLD (hoặc confirm riêng).
 */
export function createRiskEngine(overrides = {}) {
  const cfg = { ...CONFIG, ...overrides };
  let score = 0;
  let lastAt = Date.now();
  const history = [];

  function decay(now = Date.now()) {
    const dt = Math.max(0, (now - lastAt) / 1000);
    lastAt = now;
    if (dt > 0 && score > 0) {
      score = Math.max(0, score - cfg.RISK_DECAY_PER_SEC * dt);
    }
    return score;
  }

  return {
    getScore(now = Date.now()) {
      return decay(now);
    },
    add(kind, now = Date.now(), meta = {}) {
      decay(now);
      const weight = cfg.RISK_WEIGHTS[kind] ?? 5;
      score = Math.min(100, score + weight);
      const entry = { t: now, kind, weight, score, ...meta };
      history.push(entry);
      if (history.length > 200) history.shift();
      return {
        score,
        soft: score >= cfg.RISK_SOFT_THRESHOLD,
        hard: score >= cfg.RISK_HARD_THRESHOLD,
        entry,
      };
    },
    level(now = Date.now()) {
      const s = decay(now);
      if (s >= cfg.RISK_HARD_THRESHOLD) return 'high';
      if (s >= cfg.RISK_SOFT_THRESHOLD) return 'medium';
      return 'low';
    },
    reset() {
      score = 0;
      lastAt = Date.now();
      history.length = 0;
    },
    snapshot() {
      return { score, level: this.level(), history: [...history] };
    },
  };
}

/**
 * Bộ đếm xác nhận đa frame/thời gian — giảm false positive.
 */
export function createConfirmTracker({ minFrames, confirmMs }) {
  let frames = 0;
  let since = null;

  return {
    tick(active, now = Date.now()) {
      if (!active) {
        frames = 0;
        since = null;
        return { confirmed: false, frames: 0, durationMs: 0 };
      }
      frames += 1;
      if (!since) since = now;
      const durationMs = now - since;
      return {
        confirmed: frames >= minFrames && durationMs >= confirmMs,
        frames,
        durationMs,
      };
    },
    reset() {
      frames = 0;
      since = null;
    },
  };
}
