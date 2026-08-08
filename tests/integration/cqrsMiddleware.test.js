'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('cqrs middleware assertFinanceCqrs respects flags', () => {
  const prevUri = process.env.MONGODB_URI;
  const prevMaster = process.env.ENABLE_CQRS;
  delete require.cache[require.resolve('../../shared/cqrs/flags')];
  delete require.cache[require.resolve('../../shared/cqrs/middleware')];

  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db';
  delete process.env.ENABLE_CQRS;
  delete process.env.ENABLE_CQRS_FINANCE;
  const mw = require('../../shared/cqrs/middleware');
  assert.throws(() => mw.assertFinanceCqrs(), (e) => e.status === 503);

  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db?replicaSet=rs0';
  delete require.cache[require.resolve('../../shared/cqrs/flags')];
  delete require.cache[require.resolve('../../shared/cqrs/middleware')];
  const mw2 = require('../../shared/cqrs/middleware');
  assert.doesNotThrow(() => mw2.assertFinanceCqrs());

  if (prevUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = prevUri;
  if (prevMaster === undefined) delete process.env.ENABLE_CQRS;
  else process.env.ENABLE_CQRS = prevMaster;
  delete process.env.ENABLE_CQRS_FINANCE;
});

test('cqrs barrel exports key handlers', () => {
  const cqrs = require('../../services/cqrs');
  assert.equal(typeof cqrs.createTeacherCqrs, 'function');
  assert.equal(typeof cqrs.payStudentCqrs, 'function');
  assert.equal(typeof cqrs.postDiscountCqrs, 'function');
  assert.equal(typeof cqrs.voidLedgerCqrs, 'function');
  assert.equal(typeof cqrs.payTeacherFlexibleCqrs, 'function');
});

test('requireFinanceCqrs middleware returns 503 when off', () => {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db';
  delete process.env.ENABLE_CQRS;
  delete process.env.ENABLE_CQRS_FINANCE;
  delete require.cache[require.resolve('../../shared/cqrs/flags')];
  delete require.cache[require.resolve('../../shared/cqrs/middleware')];
  const { requireFinanceCqrs } = require('../../shared/cqrs/middleware');

  let status = null;
  let body = null;
  const res = {
    status(code) { status = code; return this; },
    json(payload) { body = payload; return this; },
  };
  let nextCalled = false;
  requireFinanceCqrs({}, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(status, 503);
  assert.equal(body.success, false);
});
