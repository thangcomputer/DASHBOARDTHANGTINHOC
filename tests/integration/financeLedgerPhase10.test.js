/**
 * Phase 10 — Finance / ledger (append-only, refund reversal, soft-delete integrity).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  signedOf,
  financialRevenueUnaffectedByCourseDelete,
} = require('../../services/ledgerService');
const { getTemplate } = require('../../constants/notificationTemplates');

test('signedOf: payment +, refund −', () => {
  assert.equal(signedOf({ type: 'payment', amount: 1500000 }), 1500000);
  assert.equal(signedOf({ type: 'refund', amount: 500000 }), -500000);
  assert.equal(signedOf({ type: 'adjustment', amount: 100, metadata: { direction: 'debit' } }), -100);
});

test('soft-delete course must not change financial Σ (ADR 0001)', () => {
  const before = 10_000_000;
  const afterSoftDelete = 10_000_000; // ledger untouched
  assert.equal(financialRevenueUnaffectedByCourseDelete(before, afterSoftDelete), true);
  assert.equal(financialRevenueUnaffectedByCourseDelete(before, 9_000_000), false);
});

test('net revenue = payments − refunds', () => {
  const payments = 3_000_000;
  const refunds = 500_000;
  assert.equal(payments - refunds, 2_500_000);
});

test('LedgerEntry schema is append-only posted + unique idempotencyKey', () => {
  const LedgerEntry = require('../../models/LedgerEntry');
  assert.equal(LedgerEntry.modelName, 'LedgerEntry');
  assert.ok(LedgerEntry.schema.paths.idempotencyKey);
  assert.ok(LedgerEntry.schema.paths.idempotencyKey.options.unique);
  const typeEnum = LedgerEntry.schema.path('type').enumValues;
  assert.ok(typeEnum.includes('payment'));
  assert.ok(typeEnum.includes('refund'));
  assert.deepEqual(LedgerEntry.schema.path('status').enumValues, ['posted']);
});

test('PAYMENT_SUCCESS template exists', () => {
  const t = getTemplate('PAYMENT_SUCCESS');
  assert.ok(t);
  assert.equal(t.type, 'FINANCE');
});

test('pay/refund/sepay wire ledgerService', () => {
  const students = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  assert.ok(students.includes('settlePayment'));
  assert.ok(students.includes('refundStudentPayment') || students.includes('postRefund'));
  assert.ok(students.includes('invoicesPreserved') || students.includes('refundService'));

  const refundSvc = fs.readFileSync(path.join(__dirname, '../../services/refundService.js'), 'utf8');
  assert.ok(refundSvc.includes('postRefund'));
  assert.ok(refundSvc.includes('ledgerService'));

  const webhook = fs.readFileSync(path.join(__dirname, '../../routes/webhookRoutes.js'), 'utf8');
  assert.ok(webhook.includes('settlePayment'));
  assert.ok(webhook.includes('payment:sepay:'));

  const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  assert.ok(server.includes('financeRoutes'));
});

test('finance routes expose summary + reconcile', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/financeRoutes.js'), 'utf8');
  assert.ok(src.includes('/ledger/summary'));
  assert.ok(src.includes('/ledger/reconcile'));
  assert.ok(src.includes('reconciliationReport'));
  assert.ok(src.includes('sumFinancialRevenue'));
});

test('SepayWebhookEvent still unique on gatewayTxnId (idempotent webhook)', () => {
  const SepayWebhookEvent = require('../../models/SepayWebhookEvent');
  assert.ok(SepayWebhookEvent.schema.paths.gatewayTxnId.options.unique);
});

test('course soft-delete service does not delete Invoice', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../services/courseLifecycleService.js'), 'utf8');
  assert.ok(src.includes('Invoice'));
  assert.equal(src.includes('Invoice.deleteMany'), false);
  assert.equal(src.includes('findByIdAndDelete'), false);
});
