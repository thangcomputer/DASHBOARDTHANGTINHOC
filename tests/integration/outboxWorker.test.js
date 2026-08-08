'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadConfig() {
  delete require.cache[require.resolve('../../shared/outbox/config')];
  return require('../../shared/outbox/config');
}

test('shouldRunOutboxWorker: default true', () => {
  delete process.env.RUN_OUTBOX_WORKER;
  assert.equal(loadConfig().shouldRunOutboxWorker(), true);
});

test('shouldRunOutboxWorker: false for 0/false/off', () => {
  for (const v of ['0', 'false', 'off']) {
    process.env.RUN_OUTBOX_WORKER = v;
    assert.equal(loadConfig().shouldRunOutboxWorker(), false, v);
  }
  delete process.env.RUN_OUTBOX_WORKER;
});

test('shouldRunOutboxWorker: true for 1/true', () => {
  process.env.RUN_OUTBOX_WORKER = '1';
  assert.equal(loadConfig().shouldRunOutboxWorker(), true);
  process.env.RUN_OUTBOX_WORKER = 'true';
  assert.equal(loadConfig().shouldRunOutboxWorker(), true);
  delete process.env.RUN_OUTBOX_WORKER;
});

test('flags: only true/1 enable CQRS', () => {
  delete require.cache[require.resolve('../../shared/cqrs/flags')];
  const flags = require('../../shared/cqrs/flags');
  process.env.ENABLE_CQRS_TEACHER = 'yes';
  assert.equal(flags.isTeacherCqrs(), false);
  process.env.ENABLE_CQRS_TEACHER = 'true';
  assert.equal(flags.isTeacherCqrs(), true);
  process.env.ENABLE_CQRS_TEACHER = '1';
  assert.equal(flags.isTeacherCqrs(), true);
  delete process.env.ENABLE_CQRS_TEACHER;
});
