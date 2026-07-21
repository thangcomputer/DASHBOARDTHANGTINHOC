const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.REDIS_URL;

const { initJobQueue, enqueueOtp, getQueueMode, closeJobQueue } = require('../../services/queue/jobQueue');
const { processOtpJob } = require('../../services/queue/processors');

test('queue defaults to inline without REDIS_URL', async () => {
  await initJobQueue();
  assert.equal(getQueueMode(), 'inline');
  const job = await enqueueOtp({ phone: '0900000000', otp: '123456', userName: 'Test' });
  assert.equal(job.mode, 'inline');
  assert.ok(job.id);
  await closeJobQueue();
});

test('processOtpJob returns not_configured when no Zalo/SMTP', async () => {
  const prevZalo = process.env.ZALO_OA_TOKEN;
  const prevSmtp = process.env.SMTP_HOST;
  delete process.env.ZALO_OA_TOKEN;
  delete process.env.SMTP_HOST;
  const r = await processOtpJob({ phone: '0900000000', email: 'a@b.c', otp: '999999', userName: 'A' });
  assert.equal(r.zalo.ok, false);
  assert.equal(r.zalo.reason, 'not_configured');
  assert.equal(r.email.ok, false);
  assert.equal(r.email.reason, 'not_configured');
  if (prevZalo) process.env.ZALO_OA_TOKEN = prevZalo;
  if (prevSmtp) process.env.SMTP_HOST = prevSmtp;
});