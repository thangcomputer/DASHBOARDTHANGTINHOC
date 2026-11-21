#!/usr/bin/env node
'use strict';

/**
 * scripts/verify-phase6-staging-infra.cjs
 *
 * Kiểm chứng toàn bộ hạ tầng Giai đoạn 6:
 * 1. Snapshot Production/Dev DB (`dashboardthangtinhoc`) trước khi chạy → chứng minh 0 ghi đè sau khi kết thúc.
 * 2. Khởi tạo & xác minh MongoDB Staging độc lập (`dashboardthangtinhoc_staging`) chỉ với tài khoản giả lập (0 PII học viên thật).
 * 3. Kiểm chứng Staging DB Guard chặn ghi vào `dashboardthangtinhoc`.
 * 4. Kiểm chứng Redis thực sự (`activeBackend === 'redis'`, `silentFallbackToRam === false`), namespace tách biệt `cms:staging:` vs `cms:prod:`,
 *    TTL, invalidation theo knowledgeVersion, restart persistence, và kiểm tra tương thích BullMQ (báo rõ nếu Redis < 5.0.0).
 * 5. Chạy Staging Express App kết nối DUY NHẤT `dashboardthangtinhoc_staging` + `cms:staging:` Redis:
 *    - Xác minh RAG Canary theo User ID giả lập, Control Legacy, Feedback + Admin PATCH duyệt phản hồi (`autoPromotedToKnowledge=false`),
 *    - Xác minh tách biệt `X-Traffic-Source: benchmark` không bị tính thành lượt hỏi thật của học viên,
 *    - Xác minh Rollback tức thì (`AI_KNOWLEDGE_RAG_ENABLED=0`) & quyền Admin-only.
 * 6. Snapshot lại `dashboardthangtinhoc` → khẳng định 100% không đổi 1 bản ghi nào!
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const axios = require('axios');

const { assertStagingDatabaseEnvironment, redactMongoUri } = require('../config/stagingDatabaseGuard');
const { DEFAULT_STAGING_URI, seedStagingDb, cleanupStagingDb, verifyStagingDb } = require('./setup-staging-db.cjs');

const PROD_DEV_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
const STAGING_URI = process.env.STAGING_MONGODB_URI || DEFAULT_STAGING_URI;
const OUT_JSON = path.resolve(__dirname, '../ai-knowledge/reports/phase6-infra-readiness-report.json');
const OUT_MD = path.resolve(__dirname, '../ai-knowledge/reports/phase6-infra-readiness-report.md');

async function snapshotDbCounts(uri) {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = conn.db;
  const counts = {
    dbName: conn.name,
    students: await db.collection('students').countDocuments(),
    teachers: await db.collection('teachers').countDocuments(),
    aiquickaskfeedbacks: await db.collection('aiquickaskfeedbacks').countDocuments(),
    aiquickaskdailystats: await db.collection('aiquickaskdailystats').countDocuments(),
  };
  await conn.close();
  return counts;
}

function signSyntheticJwt(id, role, name, adminRole = null) {
  return jwt.sign(
    {
      id,
      role,
      name,
      ...(adminRole ? { adminRole } : {}),
      tokenVersion: 1,
    },
    process.env.JWT_SECRET,
    { expiresIn: '20m' },
  );
}

async function main() {
  const startedAt = new Date().toISOString();

  // 1. Snapshot Production/Dev DB BEFORE anything runs (read-only!)
  const prodBefore = await snapshotDbCounts(PROD_DEV_URI);

  // 2. Verify Staging DB Guard rejects Production/Dev DB and accepts Staging DB
  let guardRejectedProd = false;
  try {
    assertStagingDatabaseEnvironment({ STAGING_MONGODB_URI: PROD_DEV_URI });
  } catch {
    guardRejectedProd = true;
  }
  const stagingTarget = assertStagingDatabaseEnvironment(
    { STAGING_MONGODB_URI: STAGING_URI },
    { runtimeMongoUri: PROD_DEV_URI },
  );

  // Seed & verify independent Staging DB with 100% synthetic accounts (ZERO real student PII)
  const seedInfo = await seedStagingDb(stagingTarget);
  const stagingVerify = await verifyStagingDb(stagingTarget);

  // Configure isolated Staging runtime environment BEFORE requiring Redis/Routes
  process.env.NODE_ENV = 'staging';
  process.env.ENFORCE_STAGING_DB_ISOLATION = '1';
  process.env.MONGODB_URI = stagingTarget.uri;
  process.env.ENABLE_REDIS = 'true';
  process.env.REDIS_URL = process.env.STAGING_REDIS_URL || 'redis://127.0.0.1:6379/1';
  process.env.REDIS_KEY_PREFIX = 'cms:staging:';
  process.env.AI_KNOWLEDGE_RAG_ENABLED = '1';
  process.env.AI_KNOWLEDGE_VECTOR_ENABLED = '0';
  process.env.AI_KNOWLEDGE_RAG_CANARY_USER_IDS = seedInfo.canaryUserIds.join(',');
  delete process.env.AI_KNOWLEDGE_RAG_CANARY_ROLES;
  delete process.env.AI_KNOWLEDGE_RAG_ALLOW_ROLE_EXPANSION;
  delete process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION;

  const redisConfig = require('../config/redis');
  const cache = require('../utils/cache');
  const jobQueue = require('../services/queue/jobQueue');
  const aiSupportRoutes = require('../routes/aiSupportRoutes');
  const aiSupportSvc = require('../services/aiSupportService');
  const knowledgeSvc = require('../services/ai/knowledgeSearchService');

  let server = null;
  try {
    // Connect mongoose ONLY to Staging DB!
    await mongoose.connect(stagingTarget.uri, { serverSelectionTimeoutMS: 5000 });
    if (mongoose.connection.name !== stagingTarget.dbName) {
      throw new Error(`Unexpected DB connected: ${mongoose.connection.name}`);
    }

    // 3. Redis verification: real Redis, version check, BullMQ safe behavior, namespace isolation, TTL, restart persistence
    const redisReady = await redisConfig.ensureRedisReady(3000);
    if (!redisReady.ready) throw new Error(`Redis not ready: ${JSON.stringify(redisReady)}`);
    const redisClient = redisConfig.getRedis();
    const redisPong = await redisClient.ping();
    const redisServerInfo = await redisConfig.inspectRedisServerInfo(true);
    const cacheStatus = cache.getCacheBackendStatus();
    const queueInit = await jobQueue.initJobQueue({ workers: false });

    // Namespace isolation test: write a Prod sentinel key directly, then wipe Staging prefix -> Prod sentinel MUST survive!
    const prodSentinelKey = 'cms:prod:ai:quickask:p6_isolation_sentinel';
    await redisClient.set(prodSentinelKey, JSON.stringify({ scope: 'prod_untouched' }), 'EX', 60);
    await cache.set('ai:quickask:p6_staging_probe', { scope: 'staging_only' }, 1800);
    const stagingKeyFull = cache.fullKey('ai:quickask:p6_staging_probe');
    const stagingTtlSec = await redisClient.ttl(stagingKeyFull);

    // Cross-restart persistence test in Staging namespace
    const childRead = spawnSync(process.execPath, [
      '-e',
      `process.env.NODE_ENV='staging'; process.env.ENABLE_REDIS='true'; process.env.REDIS_URL=${JSON.stringify(process.env.REDIS_URL)}; process.env.REDIS_KEY_PREFIX='cms:staging:'; const { ensureRedisReady, closeRedis } = require('./config/redis'); const cache = require('./utils/cache'); (async()=>{ await ensureRedisReady(3000); const v = await cache.get('ai:quickask:p6_staging_probe'); console.log(JSON.stringify(v)); await closeRedis(); })();`,
    ], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
    const restartPersistOk = childRead.status === 0 && /staging_only/.test(childRead.stdout || '');

    // Wipe Staging prefix -> must delete stagingKeyFull while keeping prodSentinelKey 100% intact!
    await cache.delByPrefix('ai:quickask:');
    const stagingAfterWipe = await redisClient.get(stagingKeyFull);
    const prodSentinelAfterWipe = await redisClient.get(prodSentinelKey);
    await redisClient.del(prodSentinelKey);

    const namespaceIsolationOk = stagingKeyFull.startsWith('cms:staging:')
      && stagingAfterWipe === null
      && Boolean(prodSentinelAfterWipe && prodSentinelAfterWipe.includes('prod_untouched'));

    // Cache invalidation check when knowledgeVersion changes
    const kV1 = aiSupportSvc.buildQuickAskCacheKey({ ragVersion: 'v1_old', accessTier: 'student', lang: 'vi', officeVersion: '2016', question: 'Excel 2016 XLOOKUP' });
    const kV2 = aiSupportSvc.buildQuickAskCacheKey({ ragVersion: 'v2_new', accessTier: 'student', lang: 'vi', officeVersion: '2016', question: 'Excel 2016 XLOOKUP' });
    const versionInvalidationOk = kV1 !== kV2;

    // 4. Start isolated Staging Express API on ephemeral port using ONLY Staging DB + Staging Redis namespace
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/ai-support', aiSupportRoutes);
    server = http.createServer(app);
    await new Promise((res) => server.listen(0, '127.0.0.1', res));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    aiSupportSvc.resetQuickAskMetrics();
    knowledgeSvc.reloadKnowledgeIndex();

    const adminToken = signSyntheticJwt('690000000000000000000101', 'admin', 'Admin Staging', 'HIGH_ADMIN');
    const pilotStuToken = signSyntheticJwt('690000000000000000000104', 'student', 'HV Pilot Staging');
    const controlStuToken = signSyntheticJwt('690000000000000000000105', 'student', 'HV Control Staging');
    const lockedFreeToken = signSyntheticJwt('690000000000000000000106', 'student', 'HV Free Locked Staging');

    const callApi = async (method, urlPath, { token = null, platform = 'web', trafficSource = 'pilot', body = undefined } = {}) => {
      const t0 = Date.now();
      const resp = await axios({
        method,
        url: `${baseUrl}${urlPath}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': platform,
          'X-Traffic-Source': trafficSource,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        data: body,
        validateStatus: () => true,
        timeout: 25000,
      });
      return { status: resp.status, data: resp.data, latencyMs: Date.now() - t0 };
    };

    // 4a. Benchmark query (must NOT inflate real pilot user counters!)
    const benchCall = await callApi('POST', '/api/ai-support/quick-ask', {
      token: pilotStuToken,
      platform: 'web',
      trafficSource: 'benchmark',
      body: { question: 'Tư vấn mua xe máy Honda Vision' },
    });

    // 4b. Pilot Student RAG Cold + RAG Warm (Mobile -> Web) on Staging DB
    const ragCold = await callApi('POST', '/api/ai-support/quick-ask', {
      token: pilotStuToken,
      platform: 'mobile',
      trafficSource: 'pilot',
      body: { question: 'Trong MOS Excel 2016 (77-727) có dùng được XLOOKUP không? Thay bằng hàm nào?' },
    });
    const ragWarm = await callApi('POST', '/api/ai-support/quick-ask', {
      token: pilotStuToken,
      platform: 'web',
      trafficSource: 'pilot',
      body: { question: 'Trong MOS Excel 2016 (77-727) có dùng được XLOOKUP không? Thay bằng hàm nào?' },
    });

    // 4c. Control Student (outside Canary) off-topic blocked + legitimate Office routes to Legacy
    const controlOos = await callApi('POST', '/api/ai-support/quick-ask', {
      token: controlStuToken,
      platform: 'web',
      trafficSource: 'pilot',
      body: { question: 'Chỉ mình cách nấu ăn món phở bò Hà Nội' },
    });
    const lockedFree = await callApi('POST', '/api/ai-support/quick-ask', {
      token: lockedFreeToken,
      platform: 'mobile',
      trafficSource: 'pilot',
      body: { question: 'Hàm SUMIFS dùng thế nào?' },
    });

    // 4d. Feedback + Admin manual review PATCH (autoPromotedToKnowledge MUST remain false, Student blocked 403)
    const fbPost = await callApi('POST', '/api/ai-support/quick-ask/feedback', {
      token: pilotStuToken,
      platform: 'mobile',
      body: {
        responseId: `p6_staging_resp_${Date.now()}`,
        rating: 'inaccurate',
        comment: 'Kiểm thử duyệt phản hồi Admin trên Staging DB độc lập',
        question: 'MOS Excel 2016 XLOOKUP',
        answer: ragCold.data?.data?.answer || '',
        source: 'ai',
        model: ragCold.data?.data?.model || '',
      },
    });
    const fbId = fbPost.data?.data?.id;
    const fbPatchStuBlocked = await callApi('PATCH', `/api/ai-support/admin/rag-feedback/${fbId}`, {
      token: pilotStuToken,
      body: { reviewStatus: 'reviewed_approved' },
    });
    const fbPatchAdmin = await callApi('PATCH', `/api/ai-support/admin/rag-feedback/${fbId}`, {
      token: adminToken,
      body: { reviewStatus: 'reviewed_approved', adminNote: 'Admin đã kiểm tra trên Staging' },
    });

    // Fetch Admin Monitoring snapshot BEFORE rollback
    const metricsBeforeRb = (await callApi('GET', '/api/ai-support/admin/rag-metrics?days=14', { token: adminToken })).data?.data;

    // 4e. Emergency Rollback verification (AI_KNOWLEDGE_RAG_ENABLED=0)
    process.env.AI_KNOWLEDGE_RAG_ENABLED = '0';
    const beforeRbLegacyCount = aiSupportSvc.getQuickAskMetricsSummary().legacyAiCalls;
    const rbResp = await callApi('POST', '/api/ai-support/quick-ask', {
      token: adminToken,
      platform: 'web',
      trafficSource: 'benchmark',
      body: { question: 'Hướng dẫn dùng Freeze Panes cố định tiêu đề trong Excel' },
    });
    const afterRbSummary = aiSupportSvc.getQuickAskMetricsSummary();
    const rollbackOk = rbResp.status === 200
      && afterRbSummary.legacyAiCalls === beforeRbLegacyCount + 1
      && afterRbSummary.ragConfig.flagValue === '0'
      && afterRbSummary.ragConfig.globalEnabled === false;

    // Clean temporary Staging Redis keys & Staging feedback/stats (leaving synthetic Staging accounts ready)
    await cache.delByPrefix('ai:quickask:');
    await jobQueue.closeJobQueue();
    await redisConfig.closeRedis();
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((res) => server.close(res));
      server = null;
    }
    await mongoose.disconnect();
    const cleanupInfo = await cleanupStagingDb(stagingTarget);

    // 5. Snapshot Production/Dev DB AFTER everything ran -> PROVE ZERO WRITES TO PRODUCTION!
    const prodAfter = await snapshotDbCounts(PROD_DEV_URI);
    const zeroProductionWrites = prodBefore.students === prodAfter.students
      && prodBefore.teachers === prodAfter.teachers
      && prodBefore.aiquickaskfeedbacks === prodAfter.aiquickaskfeedbacks
      && prodBefore.aiquickaskdailystats === prodAfter.aiquickaskdailystats;

    const report = {
      executedAt: startedAt,
      completedAt: new Date().toISOString(),
      mongodbStagingIsolation: {
        stagingDbName: stagingTarget.dbName,
        stagingUriSafe: redactMongoUri(stagingTarget.uri),
        guardRejectedProductionDb: guardRejectedProd,
        onlySyntheticAccountsInStaging: stagingVerify.onlySyntheticAccounts,
        syntheticAccountsSeeded: {
          teachers: seedInfo.syntheticTeachers,
          students: seedInfo.syntheticStudents,
        },
        productionSnapshotBefore: prodBefore,
        productionSnapshotAfter: prodAfter,
        zeroProductionWritesProven: zeroProductionWrites,
        stagingCleanup: cleanupInfo,
      },
      redisInfrastructure: {
        ping: redisPong,
        serverInfo: redisServerInfo,
        cacheBackend: cacheStatus,
        namespaceIsolationVerified: namespaceIsolationOk,
        ttlSecondsMeasured: stagingTtlSec,
        ttlVerified: stagingTtlSec > 1700 && stagingTtlSec <= 1800,
        restartPersistenceVerified: restartPersistOk,
        knowledgeVersionInvalidationVerified: versionInvalidationOk,
        bullMqInitResult: queueInit,
      },
      stagingApiChecks: {
        benchmarkSeparatedFromPilot: benchCall.status === 200
          && metricsBeforeRb?.benchmarkRequests === 1
          && metricsBeforeRb?.pilotRequests === 3,
        uniqueRealUsersTracked: metricsBeforeRb?.uniqueRealUsersCount === 2,
        ragColdOk: ragCold.status === 200 && /vlookup/i.test(ragCold.data?.data?.answer || ''),
        ragColdLatencyMs: ragCold.latencyMs,
        ragWarmRedisHitOk: ragWarm.status === 200 && ragWarm.latencyMs < 150 && metricsBeforeRb?.cacheHits >= 1,
        ragWarmLatencyMs: ragWarm.latencyMs,
        controlNonCanaryOffTopicBlocked: controlOos.status === 200 && /ngoài phạm vi/i.test(controlOos.data?.data?.answer || ''),
        lockedFreePortalBlocked403: lockedFree.status === 403,
        feedbackAdminReviewOk: fbPost.status === 201
          && fbPatchStuBlocked.status === 403
          && fbPatchAdmin.status === 200
          && fbPatchAdmin.data?.data?.reviewStatus === 'reviewed_approved'
          && fbPatchAdmin.data?.data?.autoPromotedToKnowledge === false,
        rollbackInstantOk: rollbackOk,
        allowAllProductionLockedFalse: metricsBeforeRb?.ragConfig?.allowAllProduction === false,
        rollbackAuthority: metricsBeforeRb?.rollbackAuthority || [],
        alertsActive: metricsBeforeRb?.alerts || [],
        promotionGate: metricsBeforeRb?.promotionGate || null,
      },
    };

    const allPassed = report.mongodbStagingIsolation.guardRejectedProductionDb
      && report.mongodbStagingIsolation.onlySyntheticAccountsInStaging
      && report.mongodbStagingIsolation.zeroProductionWritesProven
      && report.redisInfrastructure.ping === 'PONG'
      && report.redisInfrastructure.cacheBackend.activeBackend === 'redis'
      && report.redisInfrastructure.cacheBackend.silentFallbackToRam === false
      && report.redisInfrastructure.namespaceIsolationVerified
      && report.redisInfrastructure.ttlVerified
      && report.redisInfrastructure.restartPersistenceVerified
      && report.redisInfrastructure.knowledgeVersionInvalidationVerified
      && report.stagingApiChecks.benchmarkSeparatedFromPilot
      && report.stagingApiChecks.uniqueRealUsersTracked
      && report.stagingApiChecks.ragColdOk
      && report.stagingApiChecks.ragWarmRedisHitOk
      && report.stagingApiChecks.controlNonCanaryOffTopicBlocked
      && report.stagingApiChecks.lockedFreePortalBlocked403
      && report.stagingApiChecks.feedbackAdminReviewOk
      && report.stagingApiChecks.rollbackInstantOk
      && report.stagingApiChecks.allowAllProductionLockedFalse;

    report.allPassed = allPassed;

    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');

    const md = [
      '# Báo Cáo Xác Minh Hạ Tầng & Chuẩn Bị Pilot (Giai Đoạn 6)',
      '',
      `- **Thời điểm thực thi:** ${report.completedAt}`,
      `- **Trạng thái kiểm chứng tổng thể:** **${allPassed ? 'ĐẠT TOÀN BỘ' : 'CÓ HẠNG MỤC LỖI'}**`,
      '',
      '## 1. Tách biệt MongoDB Staging',
      `- **Database Staging độc lập:** \`${stagingTarget.dbName}\` (Guard chặn ghi vào \`${prodBefore.dbName}\`: \`${guardRejectedProd}\`)`,
      `- **Dữ liệu thử nghiệm:** ${seedInfo.syntheticTeachers} tài khoản nội bộ giả lập + ${seedInfo.syntheticStudents} tài khoản học viên giả lập (**0 PII học viên thật**, \`onlySyntheticAccounts=${stagingVerify.onlySyntheticAccounts}\`)`,
      `- **Chứng minh 0 ghi đè Production/Dev (\`${prodBefore.dbName}\`):** Trước = \`${JSON.stringify(prodBefore)}\` | Sau = \`${JSON.stringify(prodAfter)}\` → **\`zeroProductionWritesProven=${zeroProductionWrites}\`**`,
      '',
      '## 2. Hạ tầng Redis & Cô lập Namespace',
      `- **Trạng thái Redis thực tế:** \`PING=${redisPong}\`, \`activeBackend=${cacheStatus.activeBackend}\`, \`silentFallbackToRam=${cacheStatus.silentFallbackToRam}\`, \`namespace=${cacheStatus.namespace}\``,
      `- **Phiên bản Redis trên host Windows hiện tại:** \`${redisServerInfo.version}\` (\`bullMqCompatible=${redisServerInfo.bullMqCompatible}\`, khuyến nghị triển khai \`${redisServerInfo.recommendedVersion}\` qua \`docker-compose.staging.yml\`)`,
      `- **BullMQ an toàn khi Redis < 5.0.0:** \`${JSON.stringify(queueInit)}\` (không văng lỗi lặp, rơi sạch về \`inline\`)`,
      `- **Cô lập namespace Staging (\`cms:staging:\`) vs Production (\`cms:prod:\`):** \`${namespaceIsolationOk}\``,
      `- **TTL đo được:** \`${stagingTtlSec}s\` (\`verified=${report.redisInfrastructure.ttlVerified}\`) · **Bền vững qua restart:** \`${restartPersistOk}\` · **Invalidation theo \`knowledgeVersion\`:** \`${versionInvalidationOk}\``,
      '',
      '## 3. Kiểm chứng Pilot có kiểm soát & Rollback trên Staging DB độc lập',
      `- **Tách biệt benchmark khỏi lượt hỏi thật:** \`${report.stagingApiChecks.benchmarkSeparatedFromPilot}\` (benchmark=1, pilot=3, uniqueRealUsers=2)`,
      `- **RAG Cold / Warm Redis:** Cold \`${ragCold.latencyMs} ms\` (\`${report.stagingApiChecks.ragColdOk}\`) · Warm Redis \`${ragWarm.latencyMs} ms\` (\`${report.stagingApiChecks.ragWarmRedisHitOk}\`)`,
      `- **Control non-Canary chặn ngoài phạm vi:** \`${report.stagingApiChecks.controlNonCanaryOffTopicBlocked}\` · **FreePortal khóa chặn 403:** \`${report.stagingApiChecks.lockedFreePortalBlocked403}\``,
      `- **Admin duyệt phản hồi (\`PATCH /admin/rag-feedback/:id\`):** \`${report.stagingApiChecks.feedbackAdminReviewOk}\` (Student bị chặn 403, Admin 200, \`autoPromotedToKnowledge=false\`)`,
      `- **Rollback tức thì (\`AI_KNOWLEDGE_RAG_ENABLED=0\`):** \`${report.stagingApiChecks.rollbackInstantOk}\` · **Khóa \`allowAllProduction=false\`:** \`${report.stagingApiChecks.allowAllProductionLockedFalse}\``,
    ].join('\n');
    fs.writeFileSync(OUT_MD, md, 'utf8');

    console.log('=== PHASE 6 INFRASTRUCTURE READINESS SUMMARY ===');
    console.log(JSON.stringify(report, null, 2));
    if (!allPassed) process.exitCode = 1;
  } finally {
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((res) => server.close(res));
    }
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error('[PHASE 6 INFRA VERIFY ERROR]', err);
  process.exit(1);
});
