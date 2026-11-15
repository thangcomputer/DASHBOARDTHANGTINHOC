'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const axios = require('axios');
const logger = require('../config/logger');
const ClientTelemetryEvent = require('../models/ClientTelemetryEvent');
const { parseUserAgent } = require('./deviceSessionService');

const VITAL_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000, unit: 'ms', label: 'Largest Contentful Paint' },
  INP: { good: 200, poor: 500, unit: 'ms', label: 'Interaction to Next Paint' },
  CLS: { good: 0.1, poor: 0.25, unit: '', label: 'Cumulative Layout Shift' },
  FCP: { good: 1800, poor: 3000, unit: 'ms', label: 'First Contentful Paint' },
  TTFB: { good: 800, poor: 1800, unit: 'ms', label: 'Time to First Byte' },
};

const ALLOWED_VITALS = new Set(Object.keys(VITAL_THRESHOLDS));
const SECRET_RE = /(bearer\s+[a-z0-9\-._~+/]+=*|password|refreshToken|accessToken|otp\s*[:=]\s*\d{4,8})/gi;

function isDbReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function sanitizeText(raw, maxLen = 1000) {
  if (!raw) return '';
  return String(raw).replace(SECRET_RE, '[REDACTED]').slice(0, maxLen);
}

function normalizeRoute(rawRoute) {
  const raw = String(rawRoute || '/').trim();
  if (!raw) return '/';
  const cleaned = raw.split('?')[0].replace(/\/[a-f0-9]{24}/gi, '/:id');
  return cleaned.slice(0, 200) || '/';
}

function computeVitalRating(metricName, value) {
  const num = Number(value);
  const spec = VITAL_THRESHOLDS[metricName];
  if (!spec || !Number.isFinite(num)) return '';
  if (num <= spec.good) return 'good';
  if (num <= spec.poor) return 'needs-improvement';
  return 'poor';
}

function computeErrorFingerprint({ source = 'frontend', name = 'Error', message = '', stack = '', route = '/' }) {
  const firstFrame = String(stack || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('at ')) || route;
  const normalizedMsg = String(message || '').replace(/[0-9a-f]{24}/gi, ':id').replace(/\d{4,}/g, ':num').slice(0, 200);
  const raw = `${source}|${name}|${normalizedMsg}|${firstFrame.slice(0, 120)}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

function parseSentryDsn(dsn) {
  if (!dsn || typeof dsn !== 'string') return null;
  try {
    const u = new URL(dsn.trim());
    const projectId = u.pathname.replace(/^\/+/, '').split('/')[0];
    const publicKey = u.username;
    if (!projectId || !publicKey) return null;
    return {
      envelopeUrl: `${u.protocol}//${u.host}/api/${projectId}/envelope/`,
      authHeader: `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=thangtinhoc-telemetry/1.0`,
      maskedDsn: `${u.protocol}//***@${u.host}/${projectId}`,
    };
  } catch {
    return null;
  }
}

async function forwardToSentryDsn(eventDoc) {
  const dsn = parseSentryDsn(process.env.SENTRY_DSN || '');
  if (!dsn) return false;
  try {
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const sentAt = new Date().toISOString();
    const header = JSON.stringify({ event_id: eventId, sent_at: sentAt });
    const itemHeader = JSON.stringify({ type: 'event' });
    const payload = JSON.stringify({
      event_id: eventId,
      timestamp: Math.floor(Date.now() / 1000),
      level: 'error',
      platform: eventDoc.source === 'backend' ? 'node' : 'javascript',
      environment: eventDoc.environment || process.env.NODE_ENV || 'production',
      release: eventDoc.release || undefined,
      transaction: eventDoc.route || '/',
      tags: {
        source: eventDoc.source,
        role: eventDoc.userRole || 'anonymous',
        browser: eventDoc.browser || '',
        os: eventDoc.os || '',
      },
      exception: {
        values: [{
          type: eventDoc.name || 'Error',
          value: eventDoc.message || 'Unknown error',
        }],
      },
      extra: {
        stack: eventDoc.stack,
        componentStack: eventDoc.componentStack,
        fingerprint: eventDoc.fingerprint,
      },
    });
    const body = `${header}\n${itemHeader}\n${payload}`;
    await axios.post(dsn.envelopeUrl, body, {
      timeout: 3000,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': dsn.authHeader,
      },
    });
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, '[TELEMETRY] Sentry DSN forward failed');
    return false;
  }
}

async function ingestVital(payload = {}, req = null) {
  const metricName = String(payload.name || '').toUpperCase().trim();
  const numVal = Number(payload.value);
  if (!ALLOWED_VITALS.has(metricName) || !Number.isFinite(numVal) || numVal < 0) {
    return null;
  }
  const rating = computeVitalRating(metricName, numVal);
  const meta = parseUserAgent(req?.headers?.['user-agent'] || '');

  if (!isDbReady()) return { recorded: false, rating };

  return ClientTelemetryEvent.create({
    kind: 'vital',
    name: metricName,
    value: numVal,
    delta: Number.isFinite(Number(payload.delta)) ? Number(payload.delta) : null,
    rating: ['good', 'needs-improvement', 'poor'].includes(payload.rating) ? payload.rating : rating,
    navigationType: sanitizeText(payload.navigationType, 40),
    route: normalizeRoute(payload.route),
    source: 'frontend',
    userRole: String(req?.user?.role || payload.userRole || 'anonymous').slice(0, 30),
    userId: String(req?.user?.id || payload.userId || '').slice(0, 64),
    browser: meta.browser,
    os: meta.os,
    deviceType: meta.deviceType,
    viewport: sanitizeText(payload.viewport, 30),
    connectionType: sanitizeText(payload.connectionType, 30),
    release: sanitizeText(payload.release, 60),
    environment: process.env.NODE_ENV || 'development',
  });
}

async function ingestError(payload = {}, req = null) {
  const source = payload.source === 'backend' ? 'backend' : 'frontend';
  const name = sanitizeText(payload.name || 'Error', 80) || 'Error';
  const message = sanitizeText(payload.message || 'Unknown error', 500);
  const stack = sanitizeText(payload.stack || '', 3000);
  const componentStack = sanitizeText(payload.componentStack || '', 1500);
  const route = normalizeRoute(payload.route || req?.originalUrl || '/');
  const meta = parseUserAgent(req?.headers?.['user-agent'] || '');
  const fingerprint = computeErrorFingerprint({ source, name, message, stack, route });

  const eventPayload = {
    kind: 'error',
    name,
    message,
    stack,
    componentStack,
    fingerprint,
    route,
    source,
    statusCode: Number.isFinite(Number(payload.statusCode)) ? Number(payload.statusCode) : null,
    httpMethod: sanitizeText(payload.httpMethod || req?.method || '', 10),
    userRole: String(req?.user?.role || payload.userRole || 'anonymous').slice(0, 30),
    userId: String(req?.user?.id || payload.userId || '').slice(0, 64),
    browser: source === 'backend' ? 'Node.js' : meta.browser,
    os: source === 'backend' ? process.platform : meta.os,
    deviceType: source === 'backend' ? 'desktop' : meta.deviceType,
    viewport: sanitizeText(payload.viewport, 30),
    release: sanitizeText(payload.release, 60),
    environment: process.env.NODE_ENV || 'development',
    resolved: false,
  };

  let sentryForwarded = false;
  if (process.env.SENTRY_DSN) {
    sentryForwarded = await forwardToSentryDsn(eventPayload);
    eventPayload.sentryForwarded = sentryForwarded;
  }

  if (!isDbReady()) return { recorded: false, fingerprint, sentryForwarded };
  const doc = await ClientTelemetryEvent.create(eventPayload);
  return doc;
}

function captureBackendError(err, req = null) {
  if (!err) return;
  ingestError({
    source: 'backend',
    name: err.name || 'ServerError',
    message: err.message || 'Internal Server Error',
    stack: err.stack || '',
    route: req?.originalUrl || '/',
    statusCode: err.status || err.statusCode || 500,
    httpMethod: req?.method || '',
  }, req).catch((e) => {
    logger.warn({ err: e.message }, '[TELEMETRY] captureBackendError failed');
  });
}

function percentile(sortedNums, p) {
  if (!sortedNums.length) return null;
  const idx = Math.min(sortedNums.length - 1, Math.max(0, Math.ceil((p / 100) * sortedNums.length) - 1));
  return sortedNums[idx];
}

async function getTelemetrySummary({ windowHours = 24, issueStatus = 'all' } = {}) {
  const hours = Math.min(24 * 30, Math.max(1, Number(windowHours) || 24));
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const dsnInfo = parseSentryDsn(process.env.SENTRY_DSN || '');

  if (!isDbReady()) {
    return {
      windowHours: hours,
      sentry: { configured: Boolean(dsnInfo), dsnMasked: dsnInfo?.maskedDsn || '' },
      vitals: {},
      routes: [],
      issues: [],
      totals: { vitalSamples: 0, errorEvents: 0, openIssues: 0 },
    };
  }

  const [vitalRows, rawErrors] = await Promise.all([
    ClientTelemetryEvent.find({ kind: 'vital', createdAt: { $gte: since } })
      .select('name value rating route browser deviceType createdAt')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean(),
    ClientTelemetryEvent.find({ kind: 'error', createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean(),
  ]);

  const vitals = {};
  for (const [metricName, spec] of Object.entries(VITAL_THRESHOLDS)) {
    const subset = vitalRows.filter((r) => r.name === metricName);
    const values = subset.map((r) => Number(r.value)).filter(Number.isFinite).sort((a, b) => a - b);
    const good = subset.filter((r) => r.rating === 'good').length;
    const needsImprovement = subset.filter((r) => r.rating === 'needs-improvement').length;
    const poor = subset.filter((r) => r.rating === 'poor').length;
    const p75 = percentile(values, 75);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    vitals[metricName] = {
      name: metricName,
      label: spec.label,
      unit: spec.unit,
      thresholds: { good: spec.good, poor: spec.poor },
      count: subset.length,
      p50: percentile(values, 50),
      p75,
      p95: percentile(values, 95),
      avg: avg === null ? null : (metricName === 'CLS' ? Number(avg.toFixed(3)) : Math.round(avg)),
      p75Rating: p75 === null ? '' : computeVitalRating(metricName, p75),
      breakdown: {
        good,
        needsImprovement,
        poor,
        goodPct: subset.length ? Math.round((good / subset.length) * 100) : 0,
      },
    };
  }

  // Group Core Web Vitals by route to highlight slowest pages
  const routeMap = new Map();
  for (const row of vitalRows) {
    const key = row.route || '/';
    if (!routeMap.has(key)) {
      routeMap.set(key, { route: key, samples: 0, lcp: [], inp: [], cls: [] });
    }
    const bucket = routeMap.get(key);
    bucket.samples += 1;
    if (row.name === 'LCP') bucket.lcp.push(Number(row.value));
    if (row.name === 'INP') bucket.inp.push(Number(row.value));
    if (row.name === 'CLS') bucket.cls.push(Number(row.value));
  }
  const routes = Array.from(routeMap.values())
    .map((b) => {
      b.lcp.sort((a, c) => a - c);
      b.inp.sort((a, c) => a - c);
      const avgCls = b.cls.length ? Number((b.cls.reduce((x, y) => x + y, 0) / b.cls.length).toFixed(3)) : null;
      const p75Lcp = percentile(b.lcp, 75);
      return {
        route: b.route,
        samples: b.samples,
        p75Lcp: p75Lcp === null ? null : Math.round(p75Lcp),
        p75Inp: percentile(b.inp, 75) === null ? null : Math.round(percentile(b.inp, 75)),
        avgCls,
        lcpRating: p75Lcp === null ? '' : computeVitalRating('LCP', p75Lcp),
      };
    })
    .sort((a, b) => (b.p75Lcp || 0) - (a.p75Lcp || 0) || b.samples - a.samples)
    .slice(0, 12);

  // Group errors by Sentry-style fingerprint
  const issueMap = new Map();
  for (const ev of rawErrors) {
    const fp = ev.fingerprint || String(ev._id);
    if (!issueMap.has(fp)) {
      issueMap.set(fp, {
        fingerprint: fp,
        name: ev.name || 'Error',
        message: ev.message || 'Unknown error',
        source: ev.source || 'frontend',
        route: ev.route || '/',
        browser: ev.browser || '',
        os: ev.os || '',
        userRole: ev.userRole || 'anonymous',
        statusCode: ev.statusCode || null,
        stack: ev.stack || '',
        componentStack: ev.componentStack || '',
        occurrences: 0,
        affectedRoutes: new Set(),
        firstSeenAt: ev.createdAt,
        lastSeenAt: ev.createdAt,
        resolved: Boolean(ev.resolved),
        resolvedAt: ev.resolvedAt || null,
        sentryForwarded: Boolean(ev.sentryForwarded),
      });
    }
    const issue = issueMap.get(fp);
    issue.occurrences += 1;
    issue.affectedRoutes.add(ev.route || '/');
    if (new Date(ev.createdAt) < new Date(issue.firstSeenAt)) issue.firstSeenAt = ev.createdAt;
    if (new Date(ev.createdAt) >= new Date(issue.lastSeenAt)) {
      issue.lastSeenAt = ev.createdAt;
      issue.resolved = Boolean(ev.resolved);
      issue.resolvedAt = ev.resolvedAt || null;
      if (ev.stack) issue.stack = ev.stack;
    }
  }

  let issues = Array.from(issueMap.values()).map((it) => ({
    ...it,
    affectedRoutes: Array.from(it.affectedRoutes),
  }));
  const openIssuesCount = issues.filter((i) => !i.resolved).length;
  if (issueStatus === 'open') issues = issues.filter((i) => !i.resolved);
  else if (issueStatus === 'resolved') issues = issues.filter((i) => i.resolved);

  issues.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  return {
    windowHours: hours,
    sentry: {
      configured: Boolean(dsnInfo),
      dsnMasked: dsnInfo?.maskedDsn || '',
      environment: process.env.NODE_ENV || 'development',
    },
    vitals,
    routes,
    issues: issues.slice(0, 50),
    totals: {
      vitalSamples: vitalRows.length,
      errorEvents: rawErrors.length,
      openIssues: openIssuesCount,
    },
  };
}

async function setIssueResolved(fingerprint, resolved, actorName = '') {
  if (!fingerprint || !isDbReady()) return { modifiedCount: 0 };
  const flag = Boolean(resolved);
  const res = await ClientTelemetryEvent.updateMany(
    { kind: 'error', fingerprint: String(fingerprint) },
    {
      $set: {
        resolved: flag,
        resolvedBy: flag ? String(actorName || 'admin') : '',
        resolvedAt: flag ? new Date() : null,
      },
    },
  );
  return { modifiedCount: res.modifiedCount || 0 };
}

module.exports = {
  VITAL_THRESHOLDS,
  computeVitalRating,
  computeErrorFingerprint,
  sanitizeText,
  parseSentryDsn,
  ingestVital,
  ingestError,
  captureBackendError,
  getTelemetrySummary,
  setIssueResolved,
};

