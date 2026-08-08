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

test('flags: resolveCqrsFlag — explicit, master, auto RS', () => {
  const prevUri = process.env.MONGODB_URI;
  const prevMaster = process.env.ENABLE_CQRS;
  delete require.cache[require.resolve('../../shared/cqrs/flags')];
  const flags = require('../../shared/cqrs/flags');

  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db';
  delete process.env.ENABLE_CQRS;
  delete process.env.ENABLE_CQRS_TEACHER;
  assert.equal(flags.isTeacherCqrs(), false, 'standalone + unset → off');

  process.env.ENABLE_CQRS_TEACHER = 'yes';
  assert.equal(flags.isTeacherCqrs(), false, 'invalid value on standalone → off');

  process.env.ENABLE_CQRS_TEACHER = 'true';
  assert.equal(flags.isTeacherCqrs(), true);
  process.env.ENABLE_CQRS_TEACHER = '1';
  assert.equal(flags.isTeacherCqrs(), true);

  process.env.ENABLE_CQRS_TEACHER = 'false';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db?replicaSet=rs0';
  assert.equal(flags.isTeacherCqrs(), false, 'explicit false wins over RS');

  delete process.env.ENABLE_CQRS_TEACHER;
  assert.equal(flags.isTeacherCqrs(), true, 'unset + RS → on');
  assert.equal(flags.isFinanceCqrs(), true);

  process.env.ENABLE_CQRS = 'false';
  assert.equal(flags.isTeacherCqrs(), false, 'master off');
  assert.equal(flags.isFinanceCqrs(), false);

  if (prevUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = prevUri;
  if (prevMaster === undefined) delete process.env.ENABLE_CQRS;
  else process.env.ENABLE_CQRS = prevMaster;
  delete process.env.ENABLE_CQRS_TEACHER;
});
