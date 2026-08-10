'use strict';

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(samples) {
  const arr = (samples || []).filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!arr.length) {
    return { count: 0, p50: null, p95: null, p99: null, max: null, mean: null };
  }
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    count: arr.length,
    p50: percentile(arr, 50),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
    max: arr[arr.length - 1],
    mean: Math.round((sum / arr.length) * 100) / 100,
  };
}

function classifyTier({
  connectionSuccessRate,
  messageSuccessRate,
  deliverySuccessRate,
  wrongRecipient,
  crossTenant,
  p95DeliveryMs,
  peakCpuPct,
  peakRssMb,
  eventLoopP99Ms,
  stoppedReason,
}) {
  if (stoppedReason === 'unsafe_abort') return 'FAIL';
  if (wrongRecipient > 0 || crossTenant > 0) return 'FAIL';
  if (connectionSuccessRate < 0.95) return 'FAIL';
  if (messageSuccessRate < 0.95 || deliverySuccessRate < 0.9) return 'FAIL';
  if (peakCpuPct != null && peakCpuPct > 90) return 'DEGRADED';
  if (eventLoopP99Ms != null && eventLoopP99Ms > 250) return 'DEGRADED';
  if (p95DeliveryMs != null && p95DeliveryMs > 3000) return 'DEGRADED';
  if (peakRssMb != null && peakRssMb > 1500) return 'DEGRADED';
  return 'PASS';
}

module.exports = { summarize, percentile, classifyTier };