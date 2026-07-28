const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sumStudentPaidTuition,
  paidItemsPipeline,
} = require('../../services/revenueAggregate');

test('sumStudentPaidTuition sums all paid enrollments', () => {
  const total = sumStudentPaidTuition({
    paid: true,
    price: 2899000,
    paidAmount: 749000,
    enrollments: [
      { courseName: 'A', price: 2899000, paid: true },
      { courseName: 'B', price: 749000, paid: true },
    ],
  });
  assert.equal(total, 3648000);
});

test('sumStudentPaidTuition ignores unpaid enrollments', () => {
  const total = sumStudentPaidTuition({
    paid: true,
    price: 2899000,
    enrollments: [
      { courseName: 'A', price: 2899000, paid: true },
      { courseName: 'B', price: 749000, paid: false },
    ],
  });
  assert.equal(total, 2899000);
});

test('sumStudentPaidTuition legacy falls back to paidAmount then price', () => {
  assert.equal(sumStudentPaidTuition({ paid: true, price: 100, paidAmount: 250 }), 250);
  assert.equal(sumStudentPaidTuition({ paid: true, price: 100, paidAmount: 0 }), 100);
  assert.equal(sumStudentPaidTuition({ paid: false, price: 100 }), 0);
});

test('paidItemsPipeline includes date match when range provided', () => {
  const start = new Date('2026-01-01');
  const end = new Date('2026-02-01');
  const pipeline = paidItemsPipeline({ branchFilter: {}, start, end });
  const hasDate = pipeline.some(
    (stage) => stage.$match && stage.$match.paidAt && stage.$match.paidAt.$gte,
  );
  assert.equal(hasDate, true);
});
