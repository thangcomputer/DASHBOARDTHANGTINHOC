'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertStagingDatabaseEnvironment, isProtectedProductionDbName } = require('../../config/stagingDatabaseGuard');
const redisConfig = require('../../config/redis');
const cache = require('../../utils/cache');
const knowledgeSvc = require('../../services/ai/knowledgeSearchService');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('P6-01: Staging DB guard strictly blocks Production/Runtime DBs and accepts isolated _staging DBs', () => {
  assert.equal(isProtectedProductionDbName('dashboardthangtinhoc'), true);
  assert.equal(isProtectedProductionDbName('cms_prod'), true);
  assert.equal(isProtectedProductionDbName('dashboardthangtinhoc_staging'), false);

  assert.throws(
    () => assertStagingDatabaseEnvironment({ STAGING_MONGODB_URI: 'mongodb://127.0.0.1:27017/dashboardthangtinhoc' }),
    /TỪ CHỐI KẾT NỐI STAGING/,
  );
  assert.throws(
    () => assertStagingDatabaseEnvironment({ STAGING_MONGODB_URI: 'mongodb://127.0.0.1:27017/cms_prod' }),
    /TỪ CHỐI KẾT NỐI STAGING/,
  );
  assert.throws(
    () => assertStagingDatabaseEnvironment({ STAGING_MONGODB_URI: 'mongodb://127.0.0.1:27017/random_db' }),
    /_staging/,
  );
  assert.throws(
    () => assertStagingDatabaseEnvironment(
      { STAGING_MONGODB_URI: 'mongodb://127.0.0.1:27017/app_staging' },
      { runtimeMongoUri: 'mongodb://127.0.0.1:27017/app_staging' },
    ),
    /trùng trực tiếp/,
  );

  const ok = assertStagingDatabaseEnvironment(
    { STAGING_MONGODB_URI: 'mongodb://127.0.0.1:27017/dashboardthangtinhoc_staging' },
    { runtimeMongoUri: 'mongodb://127.0.0.1:27017/dashboardthangtinhoc' },
  );
  assert.equal(ok.dbName, 'dashboardthangtinhoc_staging');
});

test('P6-02: Redis namespace isolation strictly separates Staging vs Production keys and BullMQ prefixes', async () => {
  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
    ENABLE_REDIS: process.env.ENABLE_REDIS,
  };
  try {
    delete process.env.REDIS_KEY_PREFIX;
    assert.equal(redisConfig.resolveRedisNamespace({ NODE_ENV: 'production' }), 'cms:prod:');
    assert.equal(redisConfig.resolveRedisNamespace({ NODE_ENV: 'staging' }), 'cms:staging:');
    assert.equal(redisConfig.resolveRedisNamespace({ NODE_ENV: 'test' }), 'cms:test:');
    assert.equal(redisConfig.resolveRedisNamespace({ NODE_ENV: 'development' }), 'cms:');
    assert.equal(redisConfig.resolveBullMqPrefix({ NODE_ENV: 'staging' }), 'bull-cms-staging');
    assert.equal(redisConfig.resolveBullMqPrefix({ NODE_ENV: 'production' }), 'bull-cms-prod');
    assert.equal(redisConfig.parseRedisMajorVersion('7.4.2'), 7);
    assert.equal(redisConfig.parseRedisMajorVersion('3.0.504'), 3);

    // Verify in-memory/cache prefix isolation: clearing Staging NEVER deletes Production keys
    process.env.ENABLE_REDIS = 'false';
    cache._resetMemoryForTests();

    process.env.NODE_ENV = 'production';
    await cache.set('ai:quickask:v3:sample', { env: 'prod' }, 60);
    assert.equal(cache.fullKey('ai:quickask:v3:sample'), 'cms:prod:ai:quickask:v3:sample');

    process.env.NODE_ENV = 'staging';
    await cache.set('ai:quickask:v3:sample', { env: 'staging' }, 60);
    assert.equal(cache.fullKey('ai:quickask:v3:sample'), 'cms:staging:ai:quickask:v3:sample');

    // Wipe staging prefix
    await cache.delByPrefix('ai:quickask:');
    assert.equal(await cache.get('ai:quickask:v3:sample'), undefined);

    // Production key MUST still exist intact!
    process.env.NODE_ENV = 'production';
    const prodVal = await cache.get('ai:quickask:v3:sample');
    assert.deepEqual(prodVal, { env: 'prod' });
  } finally {
    cache._resetMemoryForTests();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('P6-03: Pilot vs Benchmark traffic separation, rollback authority, Admin Dashboard, Mobile fix, and operational docs', async () => {
  const aiSupportSvc = require('../../services/aiSupportService');
  const origPersist = process.env.AI_QUICK_ASK_PERSIST_STATS;
  process.env.AI_QUICK_ASK_PERSIST_STATS = '0';
  aiSupportSvc.resetQuickAskMetrics();
  knowledgeSvc.setKnowledgeRagOverrideForTests(true);

  try {
    // Benchmark traffic (must NOT count as real pilot users/requests!)
    await aiSupportSvc.quickAskAssistant({
      user: { id: 'bench-u1', role: 'student', name: 'Bench' },
      question: 'Tư vấn tình yêu',
      preferredLang: 'vi',
      platform: 'web',
      trafficSource: 'benchmark',
    });
    // Real pilot traffic
    await aiSupportSvc.quickAskAssistant({
      user: { id: 'pilot-u1', role: 'student', name: 'Pilot' },
      question: 'Xin chào',
      preferredLang: 'vi',
      platform: 'mobile',
      trafficSource: 'pilot',
    });

    const m = aiSupportSvc.getQuickAskMetricsSummary();
    assert.equal(m.benchmarkRequests, 1);
    assert.equal(m.pilotRequests, 1);
    assert.equal(m.uniqueRealUsersCount, 1);
    assert.ok(Array.isArray(m.rollbackAuthority) && m.rollbackAuthority.includes('SUPER_ADMIN'));
    assert.equal(m.promotionGate.readyForAllStudentsProduction, false);
  } finally {
    if (origPersist === undefined) delete process.env.AI_QUICK_ASK_PERSIST_STATS;
    else process.env.AI_QUICK_ASK_PERSIST_STATS = origPersist;
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
  }

  // Structural verification of Phase 6 deliverables
  assert.doesNotMatch(read('thang-tin-hoc-mobile/src/components/ui.tsx'), /appSub\.remove\(\)/);
  assert.match(read('thang-tin-hoc-mobile/src/components/QuickAiPopupModal.tsx'), /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
  assert.match(read('client/src/components/MonitoringPage.jsx'), /Giám sát Pilot AI DewSkill/);
  assert.match(read('client/src/components/MonitoringPage.jsx'), /reviewRagFeedback/);
  assert.match(read('routes/aiSupportRoutes.js'), /router\.patch\('\/admin\/rag-feedback\/:id'/);
  assert.ok(fs.existsSync(path.join(ROOT, 'docker-compose.staging.yml')));
  assert.ok(fs.existsSync(path.join(ROOT, '.env.staging.example')));
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/AI_DEWSKILL_PILOT_GUIDE.md')));
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/AI_DEWSKILL_PILOT_RUNBOOK.md')));
});
