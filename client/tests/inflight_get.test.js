import test from 'node:test';
import assert from 'node:assert/strict';
import { shareInflight, inflightSize } from '../src/services/inflightGet.js';

test('concurrent identical loads share one request and each caller can read the body', async () => {
  let calls = 0;
  const loader = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response(JSON.stringify({ success: true, n: calls }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const [a, b] = await Promise.all([
    shareInflight('GET /api/courses', loader),
    shareInflight('GET /api/courses', loader),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(await a.json(), { success: true, n: 1 });
  assert.deepEqual(await b.json(), { success: true, n: 1 });
  assert.equal(inflightSize(), 0);
});

test('a later call after completion hits the network again', async () => {
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return new Response(JSON.stringify({ n: calls }), { status: 200 });
  };
  const first = await shareInflight('GET /api/settings', loader);
  const second = await shareInflight('GET /api/settings', loader);
  assert.equal((await first.json()).n, 1);
  assert.equal((await second.json()).n, 2);
});

test('a failed load is not reused after it settles', async () => {
  let calls = 0;
  const loader = async () => {
    calls += 1;
    if (calls === 1) throw new Error('network');
    return new Response('{}', { status: 200 });
  };
  await assert.rejects(() => shareInflight('GET /api/fail', loader), /network/);
  const res = await shareInflight('GET /api/fail', loader);
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});
