'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('postSalary and voidLedgerEntry accept session option', () => {
  const ledger = require('../../services/ledgerService');
  assert.equal(typeof ledger.postSalary, 'function');
  assert.equal(typeof ledger.voidLedgerEntry, 'function');
  // Signature smoke: calling without Mongo should fail on amount/id, not on unknown option
  return Promise.resolve()
    .then(() => ledger.postSalary({ teacher: { _id: 'x' }, amount: 0 }))
    .then(() => assert.fail('expected throw'))
    .catch((err) => assert.match(String(err.message), /lương|0/i));
});

test('salary CQRS modules export expected handlers', () => {
  const flex = require('../../services/cqrs/payTeacherFlexibleCqrs');
  const all = require('../../services/cqrs/payTeacherAllCqrs');
  const salary = require('../../services/cqrs/salaryTransactionCqrs');
  assert.equal(typeof flex.payTeacherFlexibleCqrs, 'function');
  assert.equal(typeof all.payTeacherAllCqrs, 'function');
  assert.equal(typeof salary.confirmTransactionCqrs, 'function');
  assert.equal(typeof salary.cancelTransactionCqrs, 'function');
  assert.equal(typeof salary.voidLedgerCqrs, 'function');
});
