/**
 * Unit tests for shared/cache/permissionCache.js (Step 8)
 *
 * Covers:
 *  - Memory cache hit
 *  - Memory cache miss
 *  - TTL expiration
 *  - Cache invalidation (single + all)
 *  - Redis unavailable fallback
 *  - Concurrent requests (cache-aside idempotency)
 *  - Observability counters (hit/miss/invalidation)
 *  - Integration with permission.service.js (compatibility mode)
 */

// Isolate module state between tests
let PermissionCache;

// Helper: advance time without real delays
const REAL_DATE_NOW = Date.now;
function advanceMs(ms) {
  const now = REAL_DATE_NOW();
  Date.now = () => now + ms;
}
function resetTime() {
  Date.now = REAL_DATE_NOW;
}

beforeEach(() => {
  // Re-require each time to get a fresh module instance
  jest.resetModules();
  PermissionCache = require('../../../shared/cache/permissionCache');
  // Reset counters
  PermissionCache._counters.hit = 0;
  PermissionCache._counters.miss = 0;
  PermissionCache._counters.invalidation = 0;
  // Clear memory store
  PermissionCache._memProvider.clear();
  resetTime();
});

afterEach(() => {
  resetTime();
});

// ─── Memory cache hit ────────────────────────────────────────────────────────
describe('Memory cache hit', () => {
  test('returns cached permissions and increments hit counter', async () => {
    await PermissionCache.set('user-1', ['student:view', 'student:create']);
    const result = await PermissionCache.get('user-1');

    expect(result).toEqual(['student:view', 'student:create']);
    expect(PermissionCache._counters.hit).toBe(1);
    expect(PermissionCache._counters.miss).toBe(0);
  });

  test('subsequent gets all count as hits', async () => {
    await PermissionCache.set('user-2', ['finance:view']);
    await PermissionCache.get('user-2');
    await PermissionCache.get('user-2');
    await PermissionCache.get('user-2');

    expect(PermissionCache._counters.hit).toBe(3);
  });
});

// ─── Memory cache miss ───────────────────────────────────────────────────────
describe('Memory cache miss', () => {
  test('returns null and increments miss counter for unknown user', async () => {
    const result = await PermissionCache.get('nonexistent-user');

    expect(result).toBeNull();
    expect(PermissionCache._counters.miss).toBe(1);
    expect(PermissionCache._counters.hit).toBe(0);
  });
});

// ─── TTL expiration ──────────────────────────────────────────────────────────
describe('TTL expiration', () => {
  test('returns null after TTL has expired', async () => {
    await PermissionCache.set('user-3', ['student:view'], 1); // 1 second TTL

    // Advance time past expiry
    advanceMs(1001);

    const result = await PermissionCache.get('user-3');
    expect(result).toBeNull();
    expect(PermissionCache._counters.miss).toBe(1);
  });

  test('returns data before TTL has expired', async () => {
    await PermissionCache.set('user-4', ['student:view'], 60); // 60 second TTL

    advanceMs(30000); // Only 30 seconds later

    const result = await PermissionCache.get('user-4');
    expect(result).toEqual(['student:view']);
    expect(PermissionCache._counters.hit).toBe(1);
  });
});

// ─── Cache invalidation ──────────────────────────────────────────────────────
describe('Cache invalidation', () => {
  test('invalidate(userId) removes entry and increments invalidation counter', async () => {
    await PermissionCache.set('user-5', ['finance:view']);
    await PermissionCache.invalidate('user-5');

    const result = await PermissionCache.get('user-5');
    expect(result).toBeNull();
    expect(PermissionCache._counters.invalidation).toBe(1);
  });

  test('invalidate(null) flushes all entries', async () => {
    await PermissionCache.set('user-a', ['student:view']);
    await PermissionCache.set('user-b', ['finance:view']);
    await PermissionCache.set('user-c', ['teacher:view']);

    await PermissionCache.invalidate(null);

    expect(await PermissionCache.get('user-a')).toBeNull();
    expect(await PermissionCache.get('user-b')).toBeNull();
    expect(await PermissionCache.get('user-c')).toBeNull();
    expect(PermissionCache._counters.invalidation).toBe(1);
    expect(PermissionCache.memorySize()).toBe(0);
  });

  test('invalidate() with no args flushes all entries', async () => {
    await PermissionCache.set('user-d', ['student:view']);
    await PermissionCache.invalidate();

    expect(await PermissionCache.get('user-d')).toBeNull();
    expect(PermissionCache._counters.invalidation).toBe(1);
  });
});

// ─── Redis unavailable fallback ───────────────────────────────────────────────
describe('Redis unavailable fallback', () => {
  test('falls back to memory when Redis is not ready', async () => {
    // Redis is not configured in test env → isRedisReady() returns false
    await PermissionCache.set('user-6', ['student:view']);
    const result = await PermissionCache.get('user-6');

    expect(result).toEqual(['student:view']);
    expect(PermissionCache._counters.hit).toBe(1);
  });

  test('no request fails when Redis throws during get', async () => {
    // Monkeypatch to simulate Redis available but erroring
    const redisService = require('../../../infrastructure/redis/redisService');
    const originalIsReady = redisService.isRedisReady;
    const originalGetRedis = redisService.getRedis;

    redisService.isRedisReady = () => true;
    redisService.getRedis = () => ({
      status: 'ready',
      get: async () => { throw new Error('ECONNRESET'); },
    });

    // Must not throw
    const result = await PermissionCache.get('user-7');
    expect(result).toBeNull(); // falls back to memory, which is also empty

    redisService.isRedisReady = originalIsReady;
    redisService.getRedis = originalGetRedis;
  });
});

// ─── Concurrent requests (cache-aside idempotency) ───────────────────────────
describe('Concurrent requests', () => {
  test('two simultaneous gets for the same key both resolve correctly', async () => {
    await PermissionCache.set('user-8', ['course:view']);

    const [r1, r2] = await Promise.all([
      PermissionCache.get('user-8'),
      PermissionCache.get('user-8'),
    ]);

    expect(r1).toEqual(['course:view']);
    expect(r2).toEqual(['course:view']);
    expect(PermissionCache._counters.hit).toBe(2);
  });

  test('concurrent sets do not corrupt the stored value', async () => {
    await Promise.all([
      PermissionCache.set('user-9', ['student:view']),
      PermissionCache.set('user-9', ['student:view', 'student:create']),
    ]);

    const result = await PermissionCache.get('user-9');
    expect(Array.isArray(result)).toBe(true);
    expect(result.includes('student:view')).toBe(true);
  });
});

// ─── Observability counters ───────────────────────────────────────────────────
describe('getMetrics()', () => {
  test('returns correct counter structure', async () => {
    await PermissionCache.set('user-m1', ['student:view']);
    await PermissionCache.get('user-m1');      // hit
    await PermissionCache.get('user-m2');      // miss
    await PermissionCache.invalidate('user-m1'); // invalidation

    const metrics = PermissionCache.getMetrics();
    expect(metrics).toMatchObject({
      permission_cache_hit_total: 1,
      permission_cache_miss_total: 1,
      permission_cache_invalidation_total: 1,
    });
  });

  test('metrics keys match Prometheus naming spec', () => {
    const metrics = PermissionCache.getMetrics();
    expect(Object.keys(metrics)).toEqual([
      'permission_cache_hit_total',
      'permission_cache_miss_total',
      'permission_cache_invalidation_total',
    ]);
  });
});

// ─── Compatibility mode — PermissionService integration ──────────────────────
describe('PermissionService cache integration (compatibility mode)', () => {
  test('hasPermission uses cache on second call', async () => {
    const PermissionService = require('../../../modules/rbac/permission.service');

    const user = { id: 'svc-user-1', roleCode: 'ADMIN_STAFF' };

    // First call: cache miss → resolve → store
    const r1 = await PermissionService.hasPermission(user, 'finance:view');

    // Second call: should be served from cache
    const hitsBefore = PermissionCache._counters.hit;
    const r2 = await PermissionService.hasPermission(user, 'finance:view');

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(PermissionCache._counters.hit).toBeGreaterThan(hitsBefore);
  });

  test('cache invalidation clears permission.service resolution cache', async () => {
    const PermissionService = require('../../../modules/rbac/permission.service');

    const user = { id: 'svc-user-2', roleCode: 'STUDENT' };
    await PermissionService.hasPermission(user, 'student:view');

    // Invalidate
    await PermissionService.invalidateCache('svc-user-2');

    const result = await PermissionCache.get('svc-user-2');
    expect(result).toBeNull();
  });
});
