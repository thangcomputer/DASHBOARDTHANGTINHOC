'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadOutboxHelpers() {
  delete require.cache[require.resolve('../../shared/outbox/OutboxWorker')];
  return require('../../shared/outbox/OutboxWorker');
}

test('shouldRunOutboxWorker: default true when unset', () => {
  delete process.env.RUN_OUTBOX_WORKER;
  const { shouldRunOutboxWorker } = loadOutboxHelpers();
  assert.equal(shouldRunOutboxWorker(), true);
});

test('shouldRunOutboxWorker: false for 0/false/off', () => {
  for (const v of ['0', 'false', 'FALSE', 'off']) {
    process.env.RUN_OUTBOX_WORKER = v;
    const { shouldRunOutboxWorker } = loadOutboxHelpers();
    assert.equal(shouldRunOutboxWorker(), false, `expected false for ${v}`);
  }
  delete process.env.RUN_OUTBOX_WORKER;
});

test('shouldRunOutboxWorker: true for 1/true', () => {
  process.env.RUN_OUTBOX_WORKER = '1';
  assert.equal(loadOutboxHelpers().shouldRunOutboxWorker(), true);
  process.env.RUN_OUTBOX_WORKER = 'true';
  assert.equal(loadOutboxHelpers().shouldRunOutboxWorker(), true);
  delete process.env.RUN_OUTBOX_WORKER;
});

test('OutboxWorker.start is no-op when RUN_OUTBOX_WORKER=0', () => {
  process.env.RUN_OUTBOX_WORKER = '0';
  const mod = loadOutboxHelpers();
  const { OutboxWorker } = mod;
  const w = new OutboxWorker(1000);
  w.start();
  assert.equal(w.isRunning, false);
  delete process.env.RUN_OUTBOX_WORKER;
});
