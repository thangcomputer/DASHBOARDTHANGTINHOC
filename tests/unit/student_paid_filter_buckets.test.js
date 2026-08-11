'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyStudentPaidBucket,
  buildMongoPaidFilterCondition,
} = require('../../utils/studentPaidFilterBuckets');

describe('classifyStudentPaidBucket', () => {
  it('unpaid-only active → unpaid', () => {
    assert.equal(classifyStudentPaidBucket({
      enrollments: [{ courseName: 'A', status: 'active', paid: false }],
    }), 'unpaid');
  });

  it('paid active + cancelled → paid (not refunded)', () => {
    assert.equal(classifyStudentPaidBucket({
      paid: true,
      enrollments: [
        { courseName: 'keep', status: 'active', paid: true },
        { courseName: 'old', status: 'cancelled', paid: false, refundedAmount: 3_000_000 },
      ],
    }), 'paid');
  });

  it('only cancelled/refunded → refunded', () => {
    assert.equal(classifyStudentPaidBucket({
      enrollments: [
        { courseName: 'x', status: 'cancelled', paid: false, refundedAmount: 4_000_000 },
      ],
    }), 'refunded');
  });

  it('paid active only → paid', () => {
    assert.equal(classifyStudentPaidBucket({
      enrollments: [{ courseName: 'A', status: 'active', paid: true }],
    }), 'paid');
  });

  it('mix unpaid active + cancelled → unpaid (priority over paid sibling none)', () => {
    assert.equal(classifyStudentPaidBucket({
      enrollments: [
        { courseName: 'owe', status: 'active', paid: false },
        { courseName: 'old', status: 'cancelled', refundedAmount: 1 },
      ],
    }), 'unpaid');
  });

  it('buckets are mutually exclusive for core cases', () => {
    const samples = [
      { enrollments: [{ status: 'active', paid: false }] },
      { enrollments: [{ status: 'active', paid: true }] },
      { enrollments: [{ status: 'cancelled', refundedAmount: 1 }] },
      {
        enrollments: [
          { status: 'active', paid: true },
          { status: 'cancelled', refundedAmount: 1 },
        ],
      },
    ];
    const buckets = samples.map(classifyStudentPaidBucket);
    assert.deepEqual(buckets, ['unpaid', 'paid', 'refunded', 'paid']);
  });
});

describe('buildMongoPaidFilterCondition', () => {
  it('returns null for all', () => {
    assert.equal(buildMongoPaidFilterCondition('all'), null);
    assert.equal(buildMongoPaidFilterCondition(''), null);
  });

  it('paid / unpaid / refunded return distinct shapes', () => {
    const paid = buildMongoPaidFilterCondition('paid');
    const unpaid = buildMongoPaidFilterCondition('unpaid');
    const refunded = buildMongoPaidFilterCondition('refunded');
    const falseLegacy = buildMongoPaidFilterCondition('false');
    assert.ok(paid && unpaid && refunded);
    assert.deepEqual(refunded, falseLegacy);
    assert.notDeepEqual(paid, unpaid);
    assert.notDeepEqual(unpaid, refunded);
    assert.notDeepEqual(paid, refunded);
  });
});
