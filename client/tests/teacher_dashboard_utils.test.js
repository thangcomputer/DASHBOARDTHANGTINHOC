import assert from 'node:assert/strict';
import test from 'node:test';
import {
  financeMonthSortKey,
  getSyntheticPendingCommissionAmount,
  isDateInCalendarMonth,
  normalizeCourseName,
  sortFinanceMonths,
} from '../src/utils/teacherFinance.js';

test('normalizes course names before attendance matching', () => {
  assert.equal(
    normalizeCourseName('  Tin   học văn phòng '),
    normalizeCourseName('TIN HỌC VĂN PHÒNG'),
  );
});

test('counts only schedules in the current calendar year and month', () => {
  const reference = new Date(2026, 8, 14);
  assert.equal(isDateInCalendarMonth('2026-09-04', reference), true);
  assert.equal(isDateInCalendarMonth('2025-09-04', reference), false);
  assert.equal(isDateInCalendarMonth('2026-10-04', reference), false);
});

test('sorts finance months numerically instead of lexicographically', () => {
  assert.deepEqual(
    ['Tháng 10/2026', 'Tháng 2/2026', 'Tháng 1/2026']
      .sort(sortFinanceMonths),
    ['Tháng 1/2026', 'Tháng 2/2026', 'Tháng 10/2026'],
  );
  assert.equal(financeMonthSortKey('Tháng 10/2026'), 202610);
});

test('only shows the uncovered amount when a real pending transaction exists', () => {
  assert.equal(getSyntheticPendingCommissionAmount(100000, [{ status: 'pending', amount: 100000 }]), 0);
  assert.equal(getSyntheticPendingCommissionAmount(100000, [{ status: 'pending', amount: 40000 }]), 60000);
  assert.equal(getSyntheticPendingCommissionAmount(100000, [{ status: 'confirmed', amount: 100000 }]), 100000);
  assert.equal(getSyntheticPendingCommissionAmount(0, []), 0);
});
