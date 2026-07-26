/**
 * Monitoring service — health snapshot + process metrics.
 */
const mongoose = require('mongoose');
const os = require('os');
const { metricsCollector } = require('./metricsCollector');
const { isRedisEnabled, isRedisReady } = require('../config/redis');
const { getQueueMode } = require('./queue/jobQueue');

function memSnapshot() {
  const m = process.memoryUsage();
  const toMb = (n) => Math.round((n / 1024 / 1024) * 10) / 10;
  return {
    rssMb: toMb(m.rss),
    heapUsedMb: toMb(m.heapUsed),
    heapTotalMb: toMb(m.heapTotal),
    externalMb: toMb(m.external),
    systemFreeMb: toMb(os.freemem()),
    systemTotalMb: toMb(os.totalmem()),
  };
}

function dbStatus() {
  const state = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  const map = { 0: 'down', 1: 'up', 2: 'connecting', 3: 'disconnecting' };
  return {
    status: map[state] || 'unknown',
    readyState: state,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
}

function redisStatus() {
  const enabled = isRedisEnabled();
  if (!enabled) return { status: 'disabled' };
  return { status: isRedisReady() ? 'up' : 'down' };
}

function queueStatus() {
  return { mode: getQueueMode() };
}

/**
 * Public-ish health (dung cho /healthz va monitoring/health).
 */
function getHealth() {
  const db = dbStatus();
  const redis = redisStatus();
  const queue = queueStatus();
  const mem = memSnapshot();
  const ok = db.status === 'up';
  return {
    ok,
    status: ok ? 'healthy' : 'degraded',
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    pid: process.pid,
    db,
    redis,
    queue,
    memory: mem,
    timestamp: new Date().toISOString(),
  };
}

function getMetrics() {
  return metricsCollector.snapshot();
}

function getOverview() {
  const health = getHealth();
  const metrics = getMetrics();
  return {
    health,
    metrics,
    alerts: buildAlerts(health, metrics),
  };
}

function buildAlerts(health, metrics) {
  const alerts = [];
  if (health.db.status !== 'up') {
    alerts.push({ level: 'critical', code: 'DB_DOWN', message: 'MongoDB khong san sang' });
  }
  if (health.redis.status === 'down') {
    alerts.push({ level: 'warning', code: 'REDIS_DOWN', message: 'Redis cau hinh nhung khong ket noi' });
  }
  if (metrics.errorRate >= 10 && metrics.requestsTotal >= 20) {
    alerts.push({
      level: 'warning',
      code: 'HIGH_ERROR_RATE',
      message: 'Ty le loi ' + metrics.errorRate + '%',
    });
  }
  if (metrics.latency.p95Ms >= 2000 && metrics.latency.sampleSize >= 10) {
    alerts.push({
      level: 'warning',
      code: 'SLOW_P95',
      message: 'P95 latency ' + metrics.latency.p95Ms + 'ms',
    });
  }
  if (health.memory.heapUsedMb >= 512) {
    alerts.push({
      level: 'info',
      code: 'HIGH_HEAP',
      message: 'Heap dang dung ' + health.memory.heapUsedMb + ' MB',
    });
  }
  return alerts;
}

function resetMetrics() {
  metricsCollector.reset();
  return metricsCollector.snapshot();
}

module.exports = {
  getHealth,
  getMetrics,
  getOverview,
  resetMetrics,
  memSnapshot,
};