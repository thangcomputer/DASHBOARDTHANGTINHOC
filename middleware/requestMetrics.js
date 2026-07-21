/**
 * Request metrics middleware — gan sau routes co the, nhung truoc handler ket thuc.
 * Dung res.on('finish') de do latency.
 */
const { metricsCollector } = require('../services/metricsCollector');

function requestMetrics(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      const path = req.originalUrl || req.url || '';
      // bo static / healthz de giam noise
      if (path.startsWith('/uploads') || path === '/healthz' || path.startsWith('/healthz?')) return;
      metricsCollector.record({
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
      });
    } catch {
      /* ignore metrics errors */
    }
  });
  next();
}

module.exports = requestMetrics;