const mongoose = require('mongoose');
const { metricsCollector } = require('./metricsCollector');
const { isRedisReady, isRedisEnabled } = require('../../config/redis');
const presenceStore = require('../../config/presenceStore');
const { getQueueMode } = require('../../services/queue/jobQueue');
const PermissionCache = require('../cache/permissionCache');

const prometheusExporter = {
  /**
   * Output current system and HTTP metrics in Prometheus text format.
   *
   * @returns {Promise<string>}
   */
  toPrometheusText: async () => {
    const lines = [];

    // App live indicator
    lines.push('# HELP app_up Indicator if application is running');
    lines.push('# TYPE app_up gauge');
    lines.push('app_up 1');

    // MongoDB connection status
    const dbReady = mongoose.connection.readyState === 1 ? 1 : 0;
    lines.push('# HELP database_connected Indicator if MongoDB is connected');
    lines.push('# TYPE database_connected gauge');
    lines.push(`database_connected ${dbReady}`);

    // Redis connection status
    const redisReady = isRedisEnabled() && isRedisReady() ? 1 : 0;
    lines.push('# HELP redis_connected Indicator if Redis is connected');
    lines.push('# TYPE redis_connected gauge');
    lines.push(`redis_connected ${redisReady}`);

    // Active users
    let activeUsers = 0;
    try {
      activeUsers = presenceStore.listPresence().length;
    } catch { /* ignore */ }
    lines.push('# HELP active_users Current active users count');
    lines.push('# TYPE active_users gauge');
    lines.push(`active_users ${activeUsers}`);

    // Queue status
    const qMode = getQueueMode() === 'bullmq' ? 1 : 0;
    lines.push('# HELP queue_mode Indicator if queue is in bullmq (1) or inline (0) mode');
    lines.push('# TYPE queue_mode gauge');
    lines.push(`queue_mode ${qMode}`);

    // Memory usage
    const mem = process.memoryUsage();
    lines.push('# HELP memory_rss_bytes Resident Set Size memory in bytes');
    lines.push('# TYPE memory_rss_bytes gauge');
    lines.push(`memory_rss_bytes ${mem.rss}`);
    lines.push('# HELP memory_heap_used_bytes Heap used memory in bytes');
    lines.push('# TYPE memory_heap_used_bytes gauge');
    lines.push(`memory_heap_used_bytes ${mem.heapUsed}`);

    // CPU usage
    const cpu = process.cpuUsage();
    lines.push('# HELP cpu_usage_user_seconds Total user CPU time spent in seconds');
    lines.push('# TYPE cpu_usage_user_seconds counter');
    lines.push(`cpu_usage_user_seconds ${cpu.user / 1000000}`);
    lines.push('# HELP cpu_usage_system_seconds Total system CPU time spent in seconds');
    lines.push('# TYPE cpu_usage_system_seconds counter');
    lines.push(`cpu_usage_system_seconds ${cpu.system / 1000000}`);

    // HTTP metrics
    const snapshot = metricsCollector.snapshot();
    lines.push('# HELP http_requests_total Total number of HTTP requests processed');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${snapshot.requestsTotal}`);

    lines.push('# HELP http_request_duration_seconds_avg Average request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds_avg gauge');
    lines.push(`http_request_duration_seconds_avg ${snapshot.latency.avgMs / 1000}`);

    lines.push('# HELP http_request_duration_seconds_max Maximum request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds_max gauge');
    lines.push(`http_request_duration_seconds_max ${snapshot.latency.maxMs / 1000}`);

    // Messaging counters (Phase 9) — identifiers only, no message bodies
    try {
      const { snapshotCounters } = require('../../services/messagingObservability');
      const m = snapshotCounters();
      lines.push('# HELP messaging_messages_sent_total Policy-allowed private DM attempts');
      lines.push('# TYPE messaging_messages_sent_total counter');
      lines.push(`messaging_messages_sent_total ${m.messages_sent_total}`);
      lines.push('# HELP messaging_messages_denied_total Policy-denied private DM attempts');
      lines.push('# TYPE messaging_messages_denied_total counter');
      lines.push(`messaging_messages_denied_total ${m.messages_denied_total}`);
      lines.push('# HELP messaging_messages_persisted_total Messages written to MongoDB');
      lines.push('# TYPE messaging_messages_persisted_total counter');
      lines.push(`messaging_messages_persisted_total ${m.messages_persisted_total}`);
      lines.push('# HELP messaging_messages_delivery_success_total notifyUser emit attempts marked success');
      lines.push('# TYPE messaging_messages_delivery_success_total counter');
      lines.push(`messaging_messages_delivery_success_total ${m.messages_delivery_success_total}`);
      lines.push('# HELP messaging_messages_delivery_failed_total notifyUser emit failures');
      lines.push('# TYPE messaging_messages_delivery_failed_total counter');
      lines.push(`messaging_messages_delivery_failed_total ${m.messages_delivery_failed_total}`);
    } catch { /* optional */ }

    lines.push('# HELP http_request_errors_4xx_total Total 4xx client errors');
    lines.push('# TYPE http_request_errors_4xx_total counter');
    lines.push(`http_request_errors_4xx_total ${snapshot.errors4xx}`);

    lines.push('# HELP http_request_errors_5xx_total Total 5xx server errors');
    lines.push('# TYPE http_request_errors_5xx_total counter');
    lines.push(`http_request_errors_5xx_total ${snapshot.errors5xx}`);

    // RBAC Permission Cache metrics
    const cacheMetrics = PermissionCache.getMetrics();
    lines.push('# HELP permission_cache_hit_total Total permission cache hits');
    lines.push('# TYPE permission_cache_hit_total counter');
    lines.push(`permission_cache_hit_total ${cacheMetrics.permission_cache_hit_total}`);

    lines.push('# HELP permission_cache_miss_total Total permission cache misses');
    lines.push('# TYPE permission_cache_miss_total counter');
    lines.push(`permission_cache_miss_total ${cacheMetrics.permission_cache_miss_total}`);

    lines.push('# HELP permission_cache_invalidation_total Total permission cache invalidation events');
    lines.push('# TYPE permission_cache_invalidation_total counter');
    lines.push(`permission_cache_invalidation_total ${cacheMetrics.permission_cache_invalidation_total}`);

    return lines.join('\n') + '\n';
  }
};

module.exports = prometheusExporter;
