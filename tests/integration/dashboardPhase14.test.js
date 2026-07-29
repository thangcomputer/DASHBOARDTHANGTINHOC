/**
 * Phase 14 — Dashboard KPI split (ops vs financial) + notify load accuracy + archive.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  KPI_SOURCES,
  applySoftDeleteToOpsCatalog,
  assertKpisNotMixed,
  simulateNotifyIdempotentLoad,
  reportAccuracyAfterCourseSoftDelete,
} = require('../../services/dashboardKpiService');

test('KPI sources distinguish operational vs financial_ledger', () => {
  assert.equal(KPI_SOURCES.OPERATIONAL, 'operational');
  assert.equal(KPI_SOURCES.FINANCIAL_LEDGER, 'financial_ledger');
  assert.notEqual(KPI_SOURCES.OPERATIONAL, KPI_SOURCES.FINANCIAL_LEDGER);
});

test('assertKpisNotMixed rejects mixed / course_price financial', () => {
  assert.equal(assertKpisNotMixed({
    operational: { source: KPI_SOURCES.OPERATIONAL },
    financial: { source: KPI_SOURCES.FINANCIAL_LEDGER, derivedFrom: 'ledger_entries' },
  }), true);

  assert.equal(assertKpisNotMixed({
    operational: { source: KPI_SOURCES.OPERATIONAL },
    financial: { source: KPI_SOURCES.OPERATIONAL },
  }), false);

  assert.equal(assertKpisNotMixed({
    operational: { source: KPI_SOURCES.OPERATIONAL },
    financial: { source: KPI_SOURCES.FINANCIAL_LEDGER, derivedFrom: 'course_price_times_count' },
  }), false);
});

test('soft-delete reduces ops catalog only; financial report stays accurate', () => {
  const courses = [
    { name: 'Excel', deletedAt: null },
    { name: 'Word', deletedAt: new Date() },
  ];
  const ops = applySoftDeleteToOpsCatalog(courses);
  assert.equal(ops.length, 1);

  const report = reportAccuracyAfterCourseSoftDelete({
    ledgerNetBefore: 10_000_000,
    ledgerNetAfter: 10_000_000,
    opsCatalogBefore: 2,
    opsCatalogAfter: 1,
  });
  assert.equal(report.financialUnchanged, true);
  assert.equal(report.operationalCatalogReduced, true);
  assert.equal(report.accurate, true);

  const bad = reportAccuracyAfterCourseSoftDelete({
    ledgerNetBefore: 10_000_000,
    ledgerNetAfter: 9_000_000,
    opsCatalogBefore: 2,
    opsCatalogAfter: 1,
  });
  assert.equal(bad.accurate, false);
});

test('notify load test: 100 sends same eventId → 1 delivered (idempotent accuracy)', () => {
  const r = simulateNotifyIdempotentLoad({ total: 100, eventId: 'load:notify' });
  assert.equal(r.attempted, 100);
  assert.equal(r.delivered, 1);
  assert.equal(r.duplicates, 99);
  assert.equal(r.accurate, true);
});

test('AuditLog has archivedAt (archive ≠ delete)', () => {
  const AuditLog = require('../../models/AuditLog');
  assert.ok(AuditLog.schema.paths.archivedAt);
});

test('analytics routes expose /kpi /queue-metrics /audit/archive', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/analyticsRoutes.js'), 'utf8');
  assert.ok(src.includes("'/kpi'"));
  assert.ok(src.includes('queue-metrics'));
  assert.ok(src.includes('audit/archive'));
  assert.ok(src.includes('buildDashboardKpis'));
  assert.ok(src.includes("source: 'operational_enrollment'"));
  // không được duplicate router.get('/revenue' sai
  const revenueMatches = src.match(/router\.get\('\/revenue'/g) || [];
  assert.equal(revenueMatches.length, 1);
});

test('dashboardKpiService exports archive + queue metrics', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../services/dashboardKpiService.js'), 'utf8');
  assert.ok(src.includes('archiveOldAuditLogs'));
  assert.ok(src.includes('getQueueMetrics'));
  assert.ok(src.includes('sumFinancialRevenue'));
  assert.ok(src.includes('activeCourseFilter'));
});
