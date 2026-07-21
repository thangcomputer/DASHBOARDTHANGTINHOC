/**
 * In-process metrics collector (Phase 10 Monitoring).
 * Khong can Prometheus — snapshot qua API admin.
 */
const MAX_LATENCIES = 300;
const MAX_RECENT_ERRORS = 40;
const MAX_PATHS = 80;

function normalizePath(raw) {
  if (!raw || typeof raw !== 'string') return 'unknown';
  let p = raw.split('?')[0];
  // ObjectId
  p = p.replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id');
  // numeric ids
  p = p.replace(/\/\d+(?=\/|$)/g, '/:id');
  // uuid-ish
  p = p.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
    '/:id',
  );
  if (p.length > 120) p = p.slice(0, 120);
  return p;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

class MetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.startedAt = Date.now();
    this.requestsTotal = 0;
    this.errors4xx = 0;
    this.errors5xx = 0;
    this.latencySumMs = 0;
    this.latencyMaxMs = 0;
    this.byMethod = Object.create(null);
    this.byStatusClass = Object.create(null);
    this.byPath = new Map();
    this.recentLatencies = [];
    this.recentErrors = [];
  }

  record({ method, path, statusCode, durationMs }) {
    const ms = Math.max(0, Number(durationMs) || 0);
    const status = Number(statusCode) || 0;
    const m = (method || 'GET').toUpperCase();
    const p = normalizePath(path);

    this.requestsTotal += 1;
    this.latencySumMs += ms;
    if (ms > this.latencyMaxMs) this.latencyMaxMs = ms;

    this.byMethod[m] = (this.byMethod[m] || 0) + 1;
    const cls = status >= 500 ? '5xx' : status >= 400 ? '4xx' : status >= 300 ? '3xx' : status >= 200 ? '2xx' : 'other';
    this.byStatusClass[cls] = (this.byStatusClass[cls] || 0) + 1;

    if (status >= 500) this.errors5xx += 1;
    else if (status >= 400) this.errors4xx += 1;

    this.recentLatencies.push(ms);
    if (this.recentLatencies.length > MAX_LATENCIES) this.recentLatencies.shift();

    let entry = this.byPath.get(p);
    if (!entry) {
      if (this.byPath.size >= MAX_PATHS) {
        // drop least used
        let minKey = null;
        let minCount = Infinity;
        for (const [k, v] of this.byPath) {
          if (v.count < minCount) {
            minCount = v.count;
            minKey = k;
          }
        }
        if (minKey) this.byPath.delete(minKey);
      }
      entry = { path: p, count: 0, errors: 0, latencySumMs: 0, latencyMaxMs: 0 };
      this.byPath.set(p, entry);
    }
    entry.count += 1;
    entry.latencySumMs += ms;
    if (ms > entry.latencyMaxMs) entry.latencyMaxMs = ms;
    if (status >= 400) entry.errors += 1;

    if (status >= 400) {
      this.recentErrors.push({
        at: new Date().toISOString(),
        method: m,
        path: p,
        status,
        durationMs: Math.round(ms),
      });
      if (this.recentErrors.length > MAX_RECENT_ERRORS) this.recentErrors.shift();
    }
  }

  snapshot() {
    const uptimeSec = Math.round((Date.now() - this.startedAt) / 1000);
    const sorted = [...this.recentLatencies].sort((a, b) => a - b);
    const avg = this.requestsTotal
      ? Math.round(this.latencySumMs / this.requestsTotal)
      : 0;
    const topPaths = [...this.byPath.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((e) => ({
        path: e.path,
        count: e.count,
        errors: e.errors,
        avgMs: e.count ? Math.round(e.latencySumMs / e.count) : 0,
        maxMs: Math.round(e.latencyMaxMs),
      }));

    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSec,
      requestsTotal: this.requestsTotal,
      errors4xx: this.errors4xx,
      errors5xx: this.errors5xx,
      errorRate:
        this.requestsTotal > 0
          ? Number((((this.errors4xx + this.errors5xx) / this.requestsTotal) * 100).toFixed(2))
          : 0,
      latency: {
        avgMs: avg,
        maxMs: Math.round(this.latencyMaxMs),
        p50Ms: Math.round(percentile(sorted, 50)),
        p95Ms: Math.round(percentile(sorted, 95)),
        p99Ms: Math.round(percentile(sorted, 99)),
        sampleSize: sorted.length,
      },
      byMethod: { ...this.byMethod },
      byStatusClass: { ...this.byStatusClass },
      topPaths,
      recentErrors: [...this.recentErrors].reverse(),
    };
  }
}

const collector = new MetricsCollector();

module.exports = {
  metricsCollector: collector,
  MetricsCollector,
  normalizePath,
};