const test = require('node:test');
const assert = require('node:assert/strict');

// Dam bao khong dung Redis that trong unit test
delete process.env.REDIS_URL;

const cache = require('../../utils/cache');

test('cache memory: set/get/del', async () => {
  cache._resetMemoryForTests();
  await cache.set('t:a', { n: 1 }, 30);
  const v = await cache.get('t:a');
  assert.deepEqual(v, { n: 1 });
  await cache.del('t:a');
  assert.equal(await cache.get('t:a'), undefined);
});

test('cache memory: wrap only calls fn once', async () => {
  cache._resetMemoryForTests();
  let calls = 0;
  const a = await cache.wrap('t:wrap', 30, async () => {
    calls += 1;
    return { ok: true };
  });
  const b = await cache.wrap('t:wrap', 30, async () => {
    calls += 1;
    return { ok: false };
  });
  assert.deepEqual(a, { ok: true });
  assert.deepEqual(b, { ok: true });
  assert.equal(calls, 1);
});

test('cache memory: delByPrefix', async () => {
  cache._resetMemoryForTests();
  await cache.set('courses:list:a', [1], 30);
  await cache.set('courses:stats', { total: 1 }, 30);
  await cache.set('branches:active', [2], 30);
  await cache.delByPrefix('courses:');
  assert.equal(await cache.get('courses:list:a'), undefined);
  assert.equal(await cache.get('courses:stats'), undefined);
  assert.deepEqual(await cache.get('branches:active'), [2]);
});