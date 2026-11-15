import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { API_BASE } from '../services/api';

let initialized = false;
const sentVitals = new Set();
const recentErrorFingerprints = new Map();

function readCurrentAccessToken() {
  if (typeof localStorage === 'undefined') return '';
  for (const key of ['admin_token', 'staff_token', 'teacher_token', 'student_token', 'token']) {
    const val = localStorage.getItem(key);
    if (val) return val;
  }
  return '';
}

function getCurrentRoute() {
  if (typeof window === 'undefined') return '/';
  const pathname = window.location.pathname || '/';
  const hash = (window.location.hash || '').split('?')[0];
  if (pathname === '/admin' && hash) return `/admin${hash}`;
  if (pathname === '/student' && hash) return `/student${hash}`;
  if (pathname === '/teacher' && hash) return `/teacher${hash}`;
  return pathname;
}

function getViewportString() {
  if (typeof window === 'undefined') return '';
  return `${window.innerWidth || 0}x${window.innerHeight || 0}`;
}

function getConnectionType() {
  try {
    return navigator?.connection?.effectiveType || '';
  } catch {
    return '';
  }
}

function postTelemetry(path, payload) {
  try {
    const token = readCurrentAccessToken();
    const url = `${API_BASE}/monitoring/ingest/${path}`;
    const body = JSON.stringify(payload);

    if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        keepalive: true,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      }).catch(() => {});
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    }
  } catch {
    // Telemetry must never interrupt UX.
  }
}

function handleVitalMetric(metric) {
  if (!metric?.name || !Number.isFinite(metric.value)) return;
  const route = getCurrentRoute();
  const dedupeKey = `${metric.name}:${metric.id || route}:${Math.round(metric.value * 100)}`;
  if (sentVitals.has(dedupeKey)) return;
  sentVitals.add(dedupeKey);
  if (sentVitals.size > 200) sentVitals.clear();

  postTelemetry('vital', {
    name: metric.name,
    value: metric.name === 'CLS' ? Number(metric.value.toFixed(4)) : Math.round(metric.value),
    delta: Number.isFinite(metric.delta) ? metric.delta : null,
    rating: metric.rating || '',
    navigationType: metric.navigationType || '',
    route,
    viewport: getViewportString(),
    connectionType: getConnectionType(),
    release: import.meta.env.VITE_APP_VERSION || '',
  });
}

export function captureClientError(error, extra = {}) {
  try {
    const name = error?.name || extra.name || 'ClientError';
    const message = String(error?.message || error || 'Unknown error').slice(0, 500);
    const stack = String(error?.stack || extra.stack || '').slice(0, 3000);
    const route = extra.route || getCurrentRoute();

    const dedupeKey = `${name}|${message.slice(0, 100)}|${route}`;
    const now = Date.now();
    const prev = recentErrorFingerprints.get(dedupeKey) || 0;
    if (now - prev < 5000) return;
    recentErrorFingerprints.set(dedupeKey, now);
    if (recentErrorFingerprints.size > 100) recentErrorFingerprints.clear();

    postTelemetry('error', {
      source: 'frontend',
      name,
      message,
      stack,
      componentStack: String(extra.componentStack || '').slice(0, 1500),
      route,
      viewport: getViewportString(),
      release: import.meta.env.VITE_APP_VERSION || '',
    });
  } catch {
    // Ignore telemetry failures.
  }
}

export function initTelemetry() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  try {
    onLCP(handleVitalMetric);
    onINP(handleVitalMetric);
    onCLS(handleVitalMetric);
    onFCP(handleVitalMetric);
    onTTFB(handleVitalMetric);
  } catch {
    // Ignore if PerformanceObserver unsupported.
  }

  window.addEventListener('error', (event) => {
    if (!event) return;
    captureClientError(event.error || { name: 'WindowError', message: event.message || 'Script error' }, {
      stack: event.error?.stack || `${event.filename || ''}:${event.lineno || 0}:${event.colno || 0}`,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    captureClientError(
      reason instanceof Error ? reason : { name: 'UnhandledRejection', message: String(reason || 'Promise rejected') },
    );
  });
}

