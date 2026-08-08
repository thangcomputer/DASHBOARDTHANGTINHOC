'use strict';

function shouldRunOutboxWorker() {
  const v = String(process.env.RUN_OUTBOX_WORKER ?? '1').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

module.exports = { shouldRunOutboxWorker };
