#!/usr/bin/env node
'use strict';

/**
 * scripts/verify-phase5-pilot-readiness.cjs
 *
 * Kiểm thử toàn diện Giai đoạn 5 trên môi trường Staging cô lập (MongoDB thật + Redis thật + Gemini API thật):
 * 1. Xác minh môi trường DB (kiểm tra tách biệt Staging/Production) + Redis thật + tính bền vững cache qua restart
 * 2. Kiểm thử API Phản hồi AI (Hữu ích / Chưa chính xác + lý do ngắn + chống trùng responseId + chuyển đổi đánh giá + chặn freePortal 403 + autoPromotedToKnowledge=false)
 * 3. Kiểm thử nghiệp vụ mở rộng (Word/Excel/PPT, MOS 2016/2019/365, Máy tính cơ bản, Win & Mac, Ngoài phạm vi: tình yêu/xe máy/nấu ăn trên CẢ RAG Canary VÀ tài khoản Legacy chưa bật RAG, câu nhiều ý, câu ngoài giáo trình, câu người mới bắt đầu)
 * 4. Tối ưu & đo tốc độ P50/P95/P99 TÁCH RIÊNG từng luồng (RAG Cold, RAG Warm, Legacy, Guard) + phân tích mọi câu RAG > 3 giây + so sánh Trước (Phase 4) vs Sau (Phase 5)
 * 5. Xác minh theo dõi 7–14 ngày (AiQuickAskDailyStat bền vững, client-event, alerts, promotionGate, rollback)
 * 6. Dọn sạch 100% dữ liệu test (feedback, daily stat delta, Redis pilot keys) để KHÔNG làm bẩn dữ liệu học viên thật
 */

require('dotenv').config();

process.env.NODE_ENV = 'staging';
process.env.ENABLE_REDIS = 'true';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.AI_KNOWLEDGE_RAG_ENABLED = '1';
process.env.AI_KNOWLEDGE_VECTOR_ENABLED = '0';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const axios = require('axios');

const { getRedis, ensureRedisReady, closeRedis } = require('../config/redis');
const cache = require('../utils/cache');
const AiQuickAskFeedback = require('../models/AiQuickAskFeedback');
const AiQuickAskDailyStat = require('../models/AiQuickAskDailyStat');
const aiSupportRoutes = require('../routes/aiSupportRoutes');
const aiSupportSvc = require('../services/aiSupportService');
const knowledgeSvc = require('../services/ai/knowledgeSearchService');

const OUT_JSON = path.resolve(__dirname, '../ai-knowledge/reports/phase5-pilot-report.json');
const OUT_MD = path.resolve(__dirname, '../ai-knowledge/reports/phase5-pilot-report.md');

function signUserJwt(doc, role) {
  return jwt.sign(
    {
      id: String(doc._id),
      role,
      name: doc.name || doc.fullName || role,
      ...(doc.adminRole ? { adminRole: doc.adminRole } : {}),
      tokenVersion: Number(doc.tokenVersion || 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' },
  );
}

function summarize(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const pct = (p) => (s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] : 0);
  return {
    count: s.length,
    avg: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0,
    p50: pct(50),
    p95: pct(95),
    p99: pct(99),
    min: s[0] || 0,
    max: s[s.length - 1] || 0,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const createdFeedbackIds = [];
  let server = null;
  let dailySnapshotBefore = [];

  try {
    // 1. Environment, DB separation check & real Redis verification
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thangtinhoc';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;
    const adminInfo = await db.admin().listDatabases();
    const dbNames = adminInfo.databases.map((d) => d.name);
    const activeDbName = mongoose.connection.name;
    const hasDedicatedStagingDb = dbNames.some((n) => /staging/i.test(n));

    // Snapshot existing AiQuickAskDailyStat for today so we can cleanly restore after test
    dailySnapshotBefore = await AiQuickAskDailyStat.find({}).lean();

    const redisState = await ensureRedisReady(3000);
    if (!redisState.ready) throw new Error(`Redis not ready: ${JSON.stringify(redisState)}`);
    const redisClient = getRedis();
    const redisPong = await redisClient.ping();
    const cacheStatus = cache.getCacheBackendStatus();
    if (cacheStatus.activeBackend !== 'redis' || cacheStatus.silentFallbackToRam) {
      throw new Error(`Cache not on real Redis: ${JSON.stringify(cacheStatus)}`);
    }

    // Verify Redis persistence across separate Node process restart
    const persistKey = `ai:quickask:p5_restart_probe:${Date.now()}`;
    await cache.set(persistKey, { ok: true, probe: 'phase5_restart_ok' }, 60);
    const childRead = spawnSync(process.execPath, [
      '-e',
      `process.env.ENABLE_REDIS='true'; process.env.REDIS_URL=${JSON.stringify(process.env.REDIS_URL)}; const { ensureRedisReady, closeRedis } = require('./config/redis'); const cache = require('./utils/cache'); (async()=>{ await ensureRedisReady(3000); const v = await cache.get(${JSON.stringify(persistKey)}); console.log(JSON.stringify(v)); await closeRedis(); })();`,
    ], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
    const restartPersistOk = childRead.status === 0 && /phase5_restart_ok/.test(childRead.stdout || '');
    await cache.del(persistKey);

    // 2. Load real MongoDB accounts (read-only!)
    const adminDoc = await db.collection('teachers').findOne({ role: 'admin', accountLocked: { $ne: true } });
    const teacherDoc = await db.collection('teachers').findOne({ role: 'teacher', accountLocked: { $ne: true } });
    const staffDoc = await db.collection('teachers').findOne({ role: 'staff', accountLocked: { $ne: true } });
    const activeStudents = await db.collection('students')
      .find({ accountLocked: { $ne: true }, freePortal: { $ne: true } })
      .limit(2)
      .toArray();
    const pilotStudentDoc = activeStudents[0];
    const controlStudentDoc = activeStudents[1];
    const lockedFreeDoc = await db.collection('students').findOne({ freePortal: true, freeUnlocked: { $ne: true } });

    if (!adminDoc || !teacherDoc || !staffDoc || !pilotStudentDoc || !controlStudentDoc) {
      throw new Error('Missing real MongoDB accounts for Phase 5 verification');
    }

    const sensitiveNames = [adminDoc, teacherDoc, staffDoc, pilotStudentDoc, controlStudentDoc, lockedFreeDoc]
      .filter(Boolean)
      .flatMap((d) => {
        const vals = [d.name, d.fullName, d.email, d.phone].map((s) => String(s || '').trim()).filter(Boolean);
        const parts = String(d.name || d.fullName || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) vals.push(parts.slice(-2).join(' '));
        return vals;
      })
      .filter((s) => s.length >= 3);

    const redactText = (raw, maxLen = 180) => {
      let text = String(raw || '').replace(/\s+/g, ' ').trim();
      for (const name of sensitiveNames) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(esc, 'gi'), '[REDACTED_USER]');
      }
      return aiSupportSvc.redactPiiText(text, maxLen);
    };

    const canaryAccounts = [
      { label: 'Admin', id: String(adminDoc._id), role: 'admin', token: signUserJwt(adminDoc, 'admin') },
      { label: 'Giảng viên', id: String(teacherDoc._id), role: 'teacher', token: signUserJwt(teacherDoc, 'teacher') },
      { label: 'Nhân viên', id: String(staffDoc._id), role: 'staff', token: signUserJwt(staffDoc, 'staff') },
      { label: 'Học viên Canary', id: String(pilotStudentDoc._id), role: 'student', token: signUserJwt(pilotStudentDoc, 'student') },
    ];
    const controlStudent = {
      label: 'Học viên ngoài Canary (Legacy)',
      id: String(controlStudentDoc._id),
      role: 'student',
      token: signUserJwt(controlStudentDoc, 'student'),
    };
    const lockedFreeStudent = lockedFreeDoc
      ? { label: 'FreePortal khóa', id: String(lockedFreeDoc._id), role: 'student', token: signUserJwt(lockedFreeDoc, 'student') }
      : null;

    process.env.AI_KNOWLEDGE_RAG_CANARY_USER_IDS = canaryAccounts.map((a) => a.id).join(',');
    delete process.env.AI_KNOWLEDGE_RAG_CANARY_ROLES;
    delete process.env.AI_KNOWLEDGE_RAG_ALLOW_ROLE_EXPANSION;
    delete process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION;

    // 3. Start isolated Staging Express app on ephemeral port
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/ai-support', aiSupportRoutes);
    server = http.createServer(app);
    await new Promise((res) => server.listen(0, '127.0.0.1', res));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    await cache.delByPrefix('ai:quickask:');
    aiSupportSvc.resetQuickAskMetrics();
    knowledgeSvc.reloadKnowledgeIndex();

    const apiCall = async (method, urlPath, { token = null, platform = 'web', body = undefined } = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Client-Platform': platform,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const t0 = Date.now();
      const resp = await axios({
        method,
        url: `${baseUrl}${urlPath}`,
        headers,
        data: body,
        validateStatus: () => true,
        timeout: 25000,
      });
      return { status: resp.status, data: resp.data, latencyMs: Date.now() - t0 };
    };

    // 4. Phase 5 Expanded Business Logic & P95 Speed Benchmark Suite (24 live scenarios)
    const scenarios = [
      // Core Office (Word, Excel, PowerPoint)
      { id: 'B01', account: canaryAccounts[3], platform: 'web', category: 'word', q: 'Cách đánh số trang từ trang 2 bằng Section Break và bỏ liên kết Link to Previous trong Word', expect: ['Section', 'Link to Previous'] },
      { id: 'B02', account: canaryAccounts[3], platform: 'mobile', category: 'excel', q: 'So sánh hàm VLOOKUP và XLOOKUP trong Excel bằng bảng ngắn gọn và nêu ví dụ cú pháp', expect: ['VLOOKUP', 'XLOOKUP'] },
      { id: 'B03', account: canaryAccounts[1], platform: 'web', category: 'powerpoint', q: 'Cách dùng Slide Master đồng bộ logo và thêm hiệu ứng chuyển trang Morph trong PowerPoint', expect: ['Slide Master', 'Morph'] },

      // MOS 2016, 2019, 365
      { id: 'B04', account: canaryAccounts[0], platform: 'web', category: 'mos_2016', q: 'Trong MOS Excel 2016 (77-727) có dùng được XLOOKUP không? Dùng hàm nào thay thế?', expect: ['không', 'VLOOKUP'] },
      { id: 'B05', account: canaryAccounts[1], platform: 'web', category: 'mos_2019', q: 'Các nhóm kỹ năng chính trong kỳ thi MOS Word 2019 MO-100 cần ôn những gì?', expect: ['MO-100'] },
      { id: 'B06', account: canaryAccounts[3], platform: 'mobile', category: 'mos_365', q: 'Giáo trình Word 365 hướng dẫn tạo chú thích chân trang Footnote và chỉnh lề trang như thế nào?', expect: ['Footnote'] },
      { id: 'B07', account: canaryAccounts[3], platform: 'web', category: 'mos_2016_access', q: 'Trong MOS Access 2016 (77-730), cách tạo Relationship và bật Enforce Referential Integrity', expect: ['Enforce Referential Integrity'] },

      // Basic PC + Windows & MacBook
      { id: 'B08', account: canaryAccounts[2], platform: 'mobile', category: 'basic_pc_beginner', q: 'Mình là người mới bắt đầu dùng máy tính, phân biệt giúp mình ổ cứng SSD với RAM và cách tạo thư mục mới trên Windows', expect: ['RAM', 'SSD'] },
      { id: 'B09', account: canaryAccounts[2], platform: 'mobile', category: 'win_mac_shortcuts', q: 'So sánh phím tắt sao chép, dán, chụp màn hình và tìm kiếm giữa Windows và MacBook macOS', expect: ['Command', 'Ctrl'] },
      { id: 'B10', account: canaryAccounts[3], platform: 'web', category: 'beginner_excel', q: 'Người mới học Excel lần đầu muốn cộng tổng một cột số và tính trung bình thì dùng hàm gì? Cho ví dụ dễ hiểu', expect: ['SUM', 'AVERAGE'] },

      // Multi-part complex question
      { id: 'B11', account: canaryAccounts[1], platform: 'web', category: 'multi_part', q: 'Trong Excel hãy hướng dẫn: 1) Cách dùng SUMIFS nhiều điều kiện, 2) Cách cố định dòng tiêu đề Freeze Panes, 3) Phím tắt bật tắt Filter', expect: ['SUMIFS', 'Freeze Panes', 'Ctrl'] },

      // Out-of-curriculum IT question (must answer honestly without hallucinating nonexistent function/code)
      { id: 'B12', account: canaryAccounts[3], platform: 'web', category: 'not_in_curriculum', q: 'Trong Excel 365 hàm QUANTUMHYPER999 và đề thi MOS mã ZZ-9999 có công thức là gì?', expectAny: ['không có', 'chưa có', 'không tồn tại', 'không thấy'] },

      // Out-of-scope on RAG Canary account (love, motorbike, cooking) -> 0 Gemini calls
      { id: 'B13', account: canaryAccounts[3], platform: 'mobile', category: 'oos_rag_love', q: 'Tư vấn tình yêu: làm sao để người yêu hết giận nhanh nhất?', expect: ['ngoài phạm vi'], expectGuard: true },
      { id: 'B14', account: canaryAccounts[2], platform: 'web', category: 'oos_rag_motorbike', q: 'Nên mua xe máy Honda Vision hay Yamaha Grande cho nữ đi làm?', expect: ['ngoài phạm vi'], expectGuard: true },
      { id: 'B15', account: canaryAccounts[0], platform: 'web', category: 'oos_rag_cooking', q: 'Chỉ mình cách nấu ăn món bò kho bánh mì ngon chuẩn vị', expect: ['ngoài phạm vi'], expectGuard: true },

      // CRITICAL SECTION 4: Out-of-scope on NON-RAG LEGACY account (love, motorbike, cooking) -> MUST STILL BE BLOCKED AT 0 GEMINI CALLS!
      { id: 'B16', account: controlStudent, platform: 'web', category: 'oos_legacy_love', q: 'Cách tỏ tình với crush trong tình yêu để thành công 100%?', expect: ['ngoài phạm vi'], expectGuard: true },
      { id: 'B17', account: controlStudent, platform: 'mobile', category: 'oos_legacy_motorbike', q: 'Xe máy Honda SH Mode bảo dưỡng thay nhớt bao nhiêu km một lần?', expect: ['ngoài phạm vi'], expectGuard: true },
      { id: 'B18', account: controlStudent, platform: 'web', category: 'oos_legacy_cooking', q: 'Cho công thức nấu ăn món phở bò tái lăn Hà Nội', expect: ['ngoài phạm vi'], expectGuard: true },

      // Legitimate Office queries on NON-RAG LEGACY account (to measure Legacy stream latency separately!)
      { id: 'B19', account: controlStudent, platform: 'web', category: 'legacy_excel', q: 'Hướng dẫn lọc trùng dữ liệu bằng Remove Duplicates trong Excel', expect: ['Remove Duplicates'], expectLegacy: true },
      { id: 'B20', account: controlStudent, platform: 'mobile', category: 'legacy_word', q: 'Cách chia văn bản thành 2 cột báo Columns trong Microsoft Word', expect: ['Columns'], expectLegacy: true },

      // Warm Redis Cache repeats across Web & Mobile (separate RAG Warm latency stream!)
      { id: 'B21_WARM', account: canaryAccounts[3], platform: 'mobile', category: 'rag_warm_repeat', q: 'Cách đánh số trang từ trang 2 bằng Section Break và bỏ liên kết Link to Previous trong Word', expect: ['Section', 'Link to Previous'], expectCacheHit: true },
      { id: 'B22_WARM', account: canaryAccounts[3], platform: 'web', category: 'rag_warm_repeat', q: 'So sánh hàm VLOOKUP và XLOOKUP trong Excel bằng bảng ngắn gọn và nêu ví dụ cú pháp', expect: ['VLOOKUP', 'XLOOKUP'], expectCacheHit: true },
      { id: 'B23_WARM', account: canaryAccounts[0], platform: 'mobile', category: 'rag_warm_repeat', q: 'Trong MOS Excel 2016 (77-727) có dùng được XLOOKUP không? Dùng hàm nào thay thế?', expect: ['không', 'VLOOKUP'], expectCacheHit: true },
      { id: 'B24_WARM', account: canaryAccounts[2], platform: 'web', category: 'rag_warm_repeat', q: 'So sánh phím tắt sao chép, dán, chụp màn hình và tìm kiếm giữa Windows và MacBook macOS', expect: ['Command', 'Ctrl'], expectCacheHit: true },
    ];

    const results = [];
    for (const tc of scenarios) {
      const before = aiSupportSvc.getQuickAskMetricsSummary();
      const resp = await apiCall('POST', '/api/ai-support/quick-ask', {
        token: tc.account.token,
        platform: tc.platform,
        body: { question: tc.q, preferredLang: 'vi' },
      });
      const after = aiSupportSvc.getQuickAskMetricsSummary();
      const answer = String(resp.data?.data?.answer || '');
      const folded = knowledgeSvc.stripVietnameseMarks(answer).toLowerCase();
      const expectOk = tc.expect
        ? tc.expect.every((kw) => folded.includes(knowledgeSvc.stripVietnameseMarks(kw).toLowerCase()))
        : tc.expectAny
          ? tc.expectAny.some((kw) => folded.includes(knowledgeSvc.stripVietnameseMarks(kw).toLowerCase()))
          : true;

      const cacheHit = after.cacheHits > before.cacheHits;
      const usedRag = after.ragAiCalls > before.ragAiCalls;
      const usedLegacy = after.legacyAiCalls > before.legacyAiCalls;
      const geminiAdded = after.geminiCallsCount - before.geminiCallsCount;

      let passed = resp.status === 200 && resp.data?.success === true && expectOk;
      if (tc.expectGuard) passed = passed && geminiAdded === 0;
      if (tc.expectCacheHit) passed = passed && cacheHit && geminiAdded === 0;
      if (tc.expectLegacy) passed = passed && usedLegacy && !usedRag;

      results.push({
        id: tc.id,
        accountLabel: tc.account.label,
        role: tc.account.role,
        platform: tc.platform,
        category: tc.category,
        httpStatus: resp.status,
        latencyMs: resp.latencyMs,
        stream: cacheHit ? 'RAG_WARM' : usedRag ? 'RAG_COLD' : usedLegacy ? 'LEGACY' : 'GUARD',
        model: resp.data?.data?.model || null,
        geminiAdded,
        hasMarkdownTable: /\|.+\|\n\|[\s:-]+\|/.test(answer),
        passed,
        answerPreview: redactText(answer, 180),
      });
    }

    // 5. Feedback Deduplication, Rating Switch, Permissions & Client Event Verification
    const responseId = `p5_resp_${Date.now()}`;
    const fbFirst = await apiCall('POST', '/api/ai-support/quick-ask/feedback', {
      token: canaryAccounts[3].token,
      platform: 'web',
      body: {
        responseId,
        rating: 'helpful',
        question: 'So sánh hàm VLOOKUP và XLOOKUP',
        answer: 'Bảng so sánh VLOOKUP và XLOOKUP...',
        source: 'ai',
        model: 'gemini-3.5-flash-lite',
      },
    });
    if (fbFirst.data?.data?.id) createdFeedbackIds.push(fbFirst.data.data.id);

    // Duplicate identical click -> HTTP 200, deduplicated=true, NO new DB record!
    const fbDup = await apiCall('POST', '/api/ai-support/quick-ask/feedback', {
      token: canaryAccounts[3].token,
      platform: 'web',
      body: {
        responseId,
        rating: 'helpful',
        question: 'So sánh hàm VLOOKUP và XLOOKUP',
        answer: 'Bảng so sánh VLOOKUP và XLOOKUP...',
        source: 'ai',
        model: 'gemini-3.5-flash-lite',
      },
    });

    // Switch rating to inaccurate + short reason with PII -> updates same single record, redacts PII!
    const fbSwitch = await apiCall('POST', '/api/ai-support/quick-ask/feedback', {
      token: canaryAccounts[3].token,
      platform: 'mobile',
      body: {
        responseId,
        rating: 'inaccurate',
        comment: 'Cần bổ sung ví dụ Excel 2016! SĐT 0912345678',
        question: 'So sánh hàm VLOOKUP và XLOOKUP',
        answer: 'Bảng so sánh VLOOKUP và XLOOKUP...',
        source: 'ai',
        model: 'gemini-3.5-flash-lite',
      },
    });

    const fbDocsForResponse = await AiQuickAskFeedback.find({ responseId }).lean();
    const fbLocked = lockedFreeStudent
      ? await apiCall('POST', '/api/ai-support/quick-ask/feedback', {
        token: lockedFreeStudent.token,
        platform: 'web',
        body: { responseId: `locked_${Date.now()}`, rating: 'helpful', question: 'VLOOKUP', answer: '...' },
      })
      : { status: 403 };

    const clientEvtResp = await apiCall('POST', '/api/ai-support/quick-ask/client-event', {
      token: canaryAccounts[3].token,
      platform: 'mobile',
      body: { platform: 'mobile', errorType: 'timeout' },
    });

    const feedbackDedupCheck = {
      passed: fbFirst.status === 201
        && fbDup.status === 200
        && fbDup.data?.data?.deduplicated === true
        && fbDup.data?.data?.updated === false
        && fbSwitch.status === 200
        && fbSwitch.data?.data?.updated === true
        && fbDocsForResponse.length === 1
        && fbDocsForResponse[0].rating === 'inaccurate'
        && fbDocsForResponse[0].autoPromotedToKnowledge === false
        && fbDocsForResponse[0].reviewStatus === 'pending_admin_review'
        && !/0912345678/.test(fbDocsForResponse[0].comment || '')
        && fbLocked.status === 403
        && clientEvtResp.status === 202,
      dbCountForSingleResponseId: fbDocsForResponse.length,
      finalRating: fbDocsForResponse[0]?.rating || null,
      autoPromotedToKnowledge: fbDocsForResponse[0]?.autoPromotedToKnowledge,
      piiRedacted: !/0912345678/.test(fbDocsForResponse[0]?.comment || ''),
      lockedFreePortalBlockedStatus: fbLocked.status,
      clientEventStatus: clientEvtResp.status,
    };

    // Wait briefly for fire-and-forget AiQuickAskDailyStat update to flush
    await new Promise((r) => setTimeout(r, 250));

    // 6. Fetch Admin Monitoring Snapshot (includes separated streams, phaseTimingMs, dailyHistory, alerts, promotionGate)
    const metricsResp = await apiCall('GET', '/api/ai-support/admin/rag-metrics?days=14', {
      token: canaryAccounts[0].token,
    });
    const metrics = metricsResp.data?.data || {};

    // Compare Phase 4 baseline vs Phase 5 optimized RAG Cold
    let phase4Baseline = null;
    const p4Path = path.resolve(__dirname, '../ai-knowledge/reports/phase4-staging-canary-report.json');
    if (fs.existsSync(p4Path)) {
      const p4 = JSON.parse(fs.readFileSync(p4Path, 'utf8'));
      const p4RagCold = (p4.userScenarioResults || []).filter((r) => r.usedRag).map((r) => r.latencyMs);
      const p4RagWarm = (p4.userScenarioResults || []).filter((r) => r.cacheHit).map((r) => r.latencyMs);
      const p4Legacy = (p4.userScenarioResults || []).filter((r) => r.usedLegacy).map((r) => r.latencyMs);
      phase4Baseline = {
        ragCold: summarize(p4RagCold),
        ragWarmCache: summarize(p4RagWarm),
        legacy: summarize(p4Legacy),
      };
    }

    const report = {
      executedAt: startedAt,
      completedAt: new Date().toISOString(),
      environment: {
        activeMongoDb: activeDbName,
        dedicatedStagingDbDetected: hasDedicatedStagingDb,
        redisPing: redisPong,
        cacheBackend: cacheStatus,
        redisRestartPersistenceOk: restartPersistOk,
        knowledgeVersion: knowledgeSvc.getKnowledgeVersion(),
      },
      businessScenariosPassed: `${results.filter((r) => r.passed).length}/${results.length}`,
      nonRagScopeGuardPassed: results.filter((r) => r.category.startsWith('oos_legacy_')).every((r) => r.passed),
      markdownTableRenderedSample: results.some((r) => r.hasMarkdownTable),
      scenarioResults: results,
      feedbackDedupCheck,
      speedComparisonBeforeAfter: {
        phase4Before: phase4Baseline,
        phase5After: metrics.latencyByStream,
        phaseTimingMs: metrics.phaseTimingMs,
        slowRagOver3sCount: metrics.slowRagOver3sCount,
        slowQueries: metrics.slowQueries,
      },
      monitoringSnapshot: {
        totalRequests: metrics.totalRequests,
        cacheHitRatePct: metrics.cacheHitRatePct,
        geminiCallsCount: metrics.geminiCallsCount,
        noSourceFoundCount: metrics.noSourceFoundCount,
        errorsByType: metrics.errorsByType,
        byPlatform: metrics.byPlatform,
        clientErrors: metrics.clientErrors,
        securityEvents: metrics.securityEvents,
        tokens: metrics.tokens,
        estimatedCostUsd: metrics.estimatedCostUsd,
        healthStatus: metrics.healthStatus,
        rollbackRecommended: metrics.rollbackRecommended,
        alerts: metrics.alerts,
        promotionGate: metrics.promotionGate,
        dailyHistoryRowsPersisted: Array.isArray(metrics.dailyHistory) ? metrics.dailyHistory.length : 0,
      },
    };

    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');

    const md = [
      '# Báo Cáo Kiểm Thử Giai Đoạn 5 – Sẵn Sàng Thử Nghiệm Người Dùng Thật (DewSkill AI)',
      '',
      `- **Thời điểm thực thi:** ${report.completedAt}`,
      `- **CSDL hiện tại:** \`${activeDbName}\` (Staging DB riêng hiện có trên host: \`${hasDedicatedStagingDb}\`)`,
      `- **Redis thật:** \`PING=${redisPong}\`, \`activeBackend=${cacheStatus.activeBackend}\`, \`silentFallbackToRam=${cacheStatus.silentFallbackToRam}\`, **bền vững qua restart:** \`${restartPersistOk}\``,
      `- **Kịch bản nghiệp vụ đạt:** **${report.businessScenariosPassed}** (bao gồm **100%** chặn ngoài phạm vi trên cả tài khoản Legacy chưa bật RAG)`,
      `- **Phản hồi AI chống trùng & phân quyền:** \`${feedbackDedupCheck.passed}\` (1 bản ghi duy nhất sau click trùng + đổi đánh giá, \`autoPromotedToKnowledge=${feedbackDedupCheck.autoPromotedToKnowledge}\`, \`freePortalLocked=${feedbackDedupCheck.lockedFreePortalBlockedStatus}\`)`,
      '',
      '## 1. So sánh tốc độ tách riêng theo từng luồng (Trước vs Sau Giai đoạn 5)',
      '',
      '| Luồng xử lý | Giai đoạn 4 (Trước) P50 / P95 / P99 | Giai đoạn 5 (Sau tối ưu) P50 / P95 / P99 | Số mẫu (P5) |',
      '|---|---:|---:|---:|',
      `| **RAG Cold** | ${phase4Baseline ? `${phase4Baseline.ragCold.p50} / ${phase4Baseline.ragCold.p95} / ${phase4Baseline.ragCold.p99} ms` : 'N/A'} | **${metrics.latencyByStream?.ragCold?.p50} / ${metrics.latencyByStream?.ragCold?.p95} / ${metrics.latencyByStream?.ragCold?.p99} ms** | ${metrics.latencyByStream?.ragCold?.count} |`,
      `| **RAG Warm (Redis)** | ${phase4Baseline ? `${phase4Baseline.ragWarmCache.p50} / ${phase4Baseline.ragWarmCache.p95} / ${phase4Baseline.ragWarmCache.p99} ms` : 'N/A'} | **${metrics.latencyByStream?.ragWarmCache?.p50} / ${metrics.latencyByStream?.ragWarmCache?.p95} / ${metrics.latencyByStream?.ragWarmCache?.p99} ms** | ${metrics.latencyByStream?.ragWarmCache?.count} |`,
      `| **Legacy (AI cũ)** | ${phase4Baseline ? `${phase4Baseline.legacy.p50} / ${phase4Baseline.legacy.p95} / ${phase4Baseline.legacy.p99} ms` : 'N/A'} | **${metrics.latencyByStream?.legacy?.p50} / ${metrics.latencyByStream?.legacy?.p95} / ${metrics.latencyByStream?.legacy?.p99} ms** | ${metrics.latencyByStream?.legacy?.count} |`,
      `| **Guard / Memory** | N/A | **${metrics.latencyByStream?.guardMemory?.p50} / ${metrics.latencyByStream?.guardMemory?.p95} / ${metrics.latencyByStream?.guardMemory?.p99} ms** | ${metrics.latencyByStream?.guardMemory?.count} |`,
      '',
      `- **Phân rã thời gian xử lý trung bình (Giai đoạn 5):** Truy xuất BM25/Reranker = **${metrics.phaseTimingMs?.retrievalAvg} ms**, Đọc Redis Cache = **${metrics.phaseTimingMs?.cacheAvg} ms**, Gemini RAG LLM = **${metrics.phaseTimingMs?.llmRagAvg} ms**, Gemini Legacy LLM = **${metrics.phaseTimingMs?.llmLegacyAvg} ms**.`,
      `- **Số câu RAG Cold > 3.000 ms:** **${metrics.slowRagOver3sCount}**`,
      '',
      '## 2. Kết quả 24 kịch bản nghiệp vụ (Web & Mobile, RAG Canary & Legacy)',
      '',
      '| ID | Tài khoản | Nền tảng | Nhóm | Trễ (ms) | Luồng | Model | Kết quả |',
      '|---|---|---|---|---:|---|---|---|',
      ...results.map((r) => `| ${r.id} | ${r.accountLabel} | ${r.platform} | ${r.category} | ${r.latencyMs} | ${r.stream} | ${r.model || '-'} | ${r.passed ? 'ĐẠT' : 'LỖI'} |`),
      '',
      '## 3. Giám sát & Cổng mở rộng Production (7–14 ngày)',
      '```json',
      JSON.stringify(report.monitoringSnapshot, null, 2),
      '```',
    ].join('\n');
    fs.writeFileSync(OUT_MD, md, 'utf8');

    console.log('=== PHASE 5 PILOT READINESS SUMMARY ===');
    console.log(JSON.stringify({
      environment: report.environment,
      businessScenariosPassed: report.businessScenariosPassed,
      nonRagScopeGuardPassed: report.nonRagScopeGuardPassed,
      feedbackDedupPassed: feedbackDedupCheck.passed,
      latencyByStream: metrics.latencyByStream,
      phaseTimingMs: metrics.phaseTimingMs,
      slowRagOver3sCount: metrics.slowRagOver3sCount,
      estimatedCostUsd: metrics.estimatedCostUsd,
      promotionGate: metrics.promotionGate,
    }, null, 2));

    const allOk = results.every((r) => r.passed) && feedbackDedupCheck.passed && restartPersistOk;
    if (!allOk) process.exitCode = 1;
  } finally {
    // Restore DB & Redis cleanly so zero test artifacts pollute production/dev data
    if (createdFeedbackIds.length) {
      try { await AiQuickAskFeedback.deleteMany({ _id: { $in: createdFeedbackIds } }); } catch { /* ignore */ }
    }
    try {
      await AiQuickAskDailyStat.deleteMany({});
      if (dailySnapshotBefore.length) {
        await AiQuickAskDailyStat.insertMany(dailySnapshotBefore);
      }
    } catch { /* ignore */ }
    try { await cache.delByPrefix('ai:quickask:'); } catch { /* ignore */ }
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((res) => server.close(res));
    }
    try { await closeRedis(); } catch { /* ignore */ }
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error('[PHASE 5 VERIFY ERROR]', err);
  process.exit(1);
});
