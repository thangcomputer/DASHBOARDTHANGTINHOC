'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function createMockAiSupportHarness({ envOverrides = {}, failLlm = false } = {}) {
  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const sessionPath = require.resolve('../../models/AiSupportSession');
  const origLlm = require.cache[llmPath];
  const origSvc = require.cache[svcPath];
  const origSession = require.cache[sessionPath];

  const sessions = new Map();
  let llmCalls = 0;
  let shouldFailLlm = Boolean(failLlm);

  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: {
      findOne: async (query) => {
        const cid = String(query?.conversationId || '');
        const row = sessions.get(cid);
        if (!row) return null;
        row.save = async function save() {
          sessions.set(cid, this);
          return this;
        };
        return row;
      },
      create: async (data) => {
        const doc = {
          ...data,
          questionCount: 0,
          imageUploadCount: 0,
          budgetDate: '',
          budgetUsedBp: 0,
          save: async function save() {
            sessions.set(String(this.conversationId), this);
            return this;
          },
        };
        sessions.set(String(data.conversationId), doc);
        return doc;
      },
    },
  };

  require.cache[llmPath] = {
    id: llmPath,
    filename: llmPath,
    loaded: true,
    exports: {
      isAiConfigured: () => true,
      getApiKeys: () => ['mock-key'],
      chatCompletion: async () => {
        llmCalls += 1;
        if (shouldFailLlm) {
          throw new Error('Mock Gemini temporary failure');
        }
        return {
          content: 'Hướng dẫn Word từ **DewSkill AI** — căn giữa đoạn văn qua tab Home.',
          model: 'gemini-3.5-flash-lite',
          usage: { totalTokenCount: 120 },
        };
      },
    },
  };

  const knowledgeSvc = require('../../services/ai/knowledgeSearchService');
  knowledgeSvc.setKnowledgeRagOverrideForTests(false);

  const envKeys = [
    'AI_SUPPORT_QUESTION_DAILY_LIMIT',
    'AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT',
    'AI_SUPPORT_QUESTION_DAILY_LIMIT_FREE_STUDENT',
    'AI_SUPPORT_QUESTION_DAILY_LIMIT_TEACHER',
    'AI_SUPPORT_IMAGE_DAILY_LIMIT',
    'AI_SUPPORT_IMAGE_DAILY_LIMIT_STUDENT',
    'AI_SUPPORT_IMAGE_DAILY_LIMIT_FREE_STUDENT',
    'AI_SUPPORT_IMAGE_DAILY_LIMIT_TEACHER',
  ];
  const prevEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  for (const key of envKeys) {
    if (Object.prototype.hasOwnProperty.call(envOverrides, key)) {
      if (envOverrides[key] === undefined) delete process.env[key];
      else process.env[key] = String(envOverrides[key]);
    } else {
      delete process.env[key];
    }
  }

  delete require.cache[svcPath];
  const svc = require('../../services/aiSupportService');
  const mongoose = require('mongoose');
  const origReadyDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  const restore = () => {
    for (const key of envKeys) {
      if (prevEnv[key] === undefined) delete process.env[key];
      else process.env[key] = prevEnv[key];
    }
    if (origLlm) require.cache[llmPath] = origLlm;
    else delete require.cache[llmPath];
    if (origSvc) require.cache[svcPath] = origSvc;
    else delete require.cache[svcPath];
    if (origSession) require.cache[sessionPath] = origSession;
    else delete require.cache[sessionPath];
    if (origReadyDescriptor) {
      Object.defineProperty(mongoose.connection, 'readyState', origReadyDescriptor);
    }
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
  };

  return {
    svc,
    sessions,
    getLlmCalls: () => llmCalls,
    setFailLlm: (v) => { shouldFailLlm = Boolean(v); },
    restore,
  };
}

function repeatedWords(count, prefix = 'excel') {
  return Array.from({ length: count }, (_, idx) => `${prefix}${idx + 1}`).join(' ');
}

test('calculateAiUsageCostBp computes weighted basis-points by tier, word count, and attachment', (t) => {
  const harness = createMockAiSupportHarness();
  t.after(harness.restore);
  const { calculateAiUsageCostBp, DAILY_BUDGET_BP } = harness.svc;

  assert.equal(DAILY_BUDGET_BP, 1000);

  // Free student: 50% short, +25% per 50 extra words > 40, max 100%
  assert.equal(calculateAiUsageCostBp({ role: 'student', isFreeStudent: true, text: 'VLOOKUP dùng sao?' }), 500);
  assert.equal(calculateAiUsageCostBp({ role: 'student', isFreeStudent: true, text: repeatedWords(70) }), 750);
  assert.equal(calculateAiUsageCostBp({ role: 'student', isFreeStudent: true, text: repeatedWords(140) }), 1000);

  // Official student: 8% short, +3%/50 extra words (max +20%), +12% image/PDF, +6% text file
  assert.equal(calculateAiUsageCostBp({ role: 'student', isFreeStudent: false, text: 'SUMIFS là gì?' }), 80);
  assert.equal(calculateAiUsageCostBp({ role: 'student', isFreeStudent: false, text: repeatedWords(90) }), 110);
  assert.equal(calculateAiUsageCostBp({ role: 'student', isFreeStudent: false, text: repeatedWords(600) }), 280);
  assert.equal(
    calculateAiUsageCostBp({
      role: 'student',
      isFreeStudent: false,
      text: 'Giải thích ảnh giúp mình',
      attachment: { mimeType: 'image/png', dataBase64: 'AAA' },
    }),
    200,
  );
  assert.equal(
    calculateAiUsageCostBp({
      role: 'student',
      isFreeStudent: false,
      text: 'Tóm tắt tệp CSV',
      attachment: { name: 'data.csv', mimeType: 'text/csv', textContent: 'col1 col2 col3' },
    }),
    140,
  );

  // Teacher: 5% short, +2%/50 extra words (max +15%), +7% image/PDF, +4% text file
  assert.equal(calculateAiUsageCostBp({ role: 'teacher', text: 'Soạn rubric Word?' }), 50);
  assert.equal(
    calculateAiUsageCostBp({
      role: 'teacher',
      text: 'Xem ảnh bài làm học viên',
      hasImage: true,
    }),
    120,
  );
  assert.equal(
    calculateAiUsageCostBp({
      role: 'teacher',
      text: 'Đọc file txt',
      attachment: { name: 'notes.txt', mimeType: 'text/plain', textContent: 'abc' },
    }),
    90,
  );

  // Admin & staff exempt -> 0 bp
  assert.equal(calculateAiUsageCostBp({ role: 'admin', text: repeatedWords(100), hasImage: true }), 0);
  assert.equal(calculateAiUsageCostBp({ role: 'staff', text: repeatedWords(100), hasImage: true }), 0);
});

test('Official student gets unified 100% daily budget shared across text, image, and Messenger peek', async (t) => {
  const harness = createMockAiSupportHarness();
  t.after(harness.restore);
  const { svc } = harness;

  const officialCenterStudent = { id: `stu-center-${Date.now()}`, role: 'student', freePortal: false, name: 'HV Chinh Thuc' };
  const unlockedMeetStudent = {
    id: `stu-meet-${Date.now()}`,
    role: 'student',
    freePortal: true,
    freeUnlocked: true,
    subscription: { plan: '3m', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    enrollments: [],
  };
  const enrolledFreePortalStudent = {
    id: `stu-enrolled-${Date.now()}`,
    role: 'student',
    freePortal: true,
    freeUnlocked: false,
    enrollments: [{ courseName: 'MOS Excel 2019', status: 'active', learningAccess: true }],
  };

  for (const stu of [officialCenterStudent, unlockedMeetStudent, enrolledFreePortalStudent]) {
    const qPeek = svc.peekQuestionQuota({ userRole: 'student' }, stu);
    const iPeek = svc.peekImageQuota({ userRole: 'student' }, stu);
    assert.equal(qPeek.applies, true);
    assert.equal(qPeek.mode, 'percent');
    assert.equal(qPeek.limit, 100);
    assert.equal(qPeek.percentLeft, 100);
    assert.equal(iPeek.allowed, true);
    assert.equal(iPeek.limit, 100);
    assert.equal(iPeek.percentLeft, 100);
  }

  // Send 5 short image queries: each costs 8% + 12% = 20%, reaching 0% cleanly
  const imgStu = { id: `stu-img-pct-${Date.now()}`, role: 'student', freePortal: false };
  for (let i = 1; i <= 5; i += 1) {
    const res = await svc.quickAskAssistant({
      user: imgStu,
      question: `Giải thích lỗi công thức Excel trong ảnh số ${i} giúp em?`,
      preferredLang: 'vi',
      attachment: { name: `img-${i}.png`, mimeType: 'image/png', dataBase64: 'iVBORw0KGgo=' },
    });
    assert.equal(res.questionQuota.mode, 'percent');
    assert.equal(res.questionQuota.percentLeft, 100 - i * 20);
    assert.equal(res.questionQuota.used, i * 20);
    assert.equal(res.imageQuota.percentLeft, 100 - i * 20);
  }

  // 6th call (either image or text) is blocked because daily % is 0%
  await assert.rejects(
    () => svc.quickAskAssistant({
      user: imgStu,
      question: 'Cách hoạt động của DNS và địa chỉ IP trong mạng máy tính?',
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_QUESTION_QUOTA' && err?.questionQuota?.percentLeft === 0,
  );

  // Last-turn partial drain test: 4 images (80% used, 20% left) + 1 short text (8% used, 12% left) + 1 image (costs 20%, still allowed to drain remaining 12% to 0%)
  const drainStu = { id: `stu-drain-${Date.now()}`, role: 'student', freePortal: false };
  for (let i = 1; i <= 4; i += 1) {
    await svc.quickAskAssistant({
      user: drainStu,
      question: `Kiểm tra lỗi hệ thống mạng nội bộ lần ${i}`,
      attachment: { name: `d-${i}.png`, mimeType: 'image/png', dataBase64: 'AAA' },
    });
  }
  const afterText = await svc.quickAskAssistant({
    user: drainStu,
    question: 'Giao thức TCP và UDP khác nhau điểm nào trong lập trình mạng?',
  });
  assert.equal(afterText.questionQuota.percentLeft, 12);

  const lastImage = await svc.quickAskAssistant({
    user: drainStu,
    question: 'Giải thích sơ đồ kiến trúc client-server trong ảnh cuối này',
    attachment: { name: 'last.png', mimeType: 'image/png', dataBase64: 'AAA' },
  });
  assert.equal(lastImage.questionQuota.percentLeft, 0);
  assert.equal(lastImage.questionQuota.budgetUsedBp, 1000);

  await assert.rejects(
    () => svc.quickAskAssistant({
      user: drainStu,
      question: 'So sánh mô hình OSI và TCP/IP trong truyền thông dữ liệu?',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_QUESTION_QUOTA',
  );
});

test('Free locked student gets 50%/short turn, no images, and scaled long-question drain', async (t) => {
  const harness = createMockAiSupportHarness();
  t.after(harness.restore);
  const { svc } = harness;

  const freeLockedStudent = {
    id: `stu-free-locked-${Date.now()}`,
    role: 'student',
    freePortal: true,
    freeUnlocked: false,
    enrollments: [],
  };

  assert.equal(svc.peekQuestionQuota({ userRole: 'student' }, freeLockedStudent).percentLeft, 100);
  const iPeek = svc.peekImageQuota({ userRole: 'student' }, freeLockedStudent);
  assert.equal(iPeek.allowed, false);
  assert.equal(iPeek.limit, 0);

  // consumeAiImageQuota rejects free student immediately
  const messengerImgQuota = await svc.consumeAiImageQuota({ userRole: 'student' }, freeLockedStudent);
  assert.equal(messengerImgQuota.blocked, true);
  assert.equal(messengerImgQuota.disallowed, true);
  assert.equal(messengerImgQuota.limit, 0);

  // Free student sending image/PDF in Quick Ask -> 403 AI_IMAGE_QUOTA, 0 LLM calls, preserves 100% text quota
  await assert.rejects(
    () => svc.quickAskAssistant({
      user: freeLockedStudent,
      question: 'Xem hộ lỗi hàm Python trong ảnh này với',
      preferredLang: 'vi',
      attachment: { name: 'hw.png', mimeType: 'image/png', dataBase64: 'AAA' },
    }),
    (err) => err?.status === 403 && err?.code === 'AI_IMAGE_QUOTA' && err?.imageQuota?.limit === 0,
  );
  await assert.rejects(
    () => svc.quickAskAssistant({
      user: freeLockedStudent,
      question: 'Xem hộ file PDF đề thi Python này',
      preferredLang: 'vi',
      attachment: { name: 'doc.pdf', mimeType: 'application/pdf', dataBase64: 'JVBERi0xLjQ=' },
    }),
    (err) => err?.status === 403 && err?.code === 'AI_IMAGE_QUOTA' && err?.imageQuota?.limit === 0,
  );
  assert.equal(harness.getLlmCalls(), 0);

  // Two short text questions consume 50% each -> 50% then 0%, third blocks
  const r1 = await svc.quickAskAssistant({
    user: freeLockedStudent,
    question: `Sự khác nhau giữa REST API và GraphQL trong lập trình web ${Date.now()}?`,
    preferredLang: 'vi',
  });
  assert.equal(r1.questionQuota.percentLeft, 50);
  assert.equal(r1.imageQuota.allowed, false);

  const r2 = await svc.quickAskAssistant({
    user: freeLockedStudent,
    question: `Giải thích cơ chế HTTPS và chứng chỉ SSL trong bảo mật web ${Date.now()}?`,
    preferredLang: 'vi',
  });
  assert.equal(r2.questionQuota.percentLeft, 0);

  await assert.rejects(
    () => svc.quickAskAssistant({
      user: freeLockedStudent,
      question: `Docker container khác máy ảo VM ở điểm nào ${Date.now()}?`,
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_QUESTION_QUOTA',
  );

  // Single long question (>90 words) consumes full 100% on one turn
  const freeLongStudent = {
    id: `stu-free-long-${Date.now()}`,
    role: 'student',
    freePortal: true,
    freeUnlocked: false,
    enrollments: [],
  };
  const rLong = await svc.quickAskAssistant({
    user: freeLongStudent,
    question: `Giải thích kiến trúc microservices và API gateway: ${repeatedWords(100, 'service')}`,
    preferredLang: 'vi',
  });
  assert.equal(rLong.questionQuota.percentLeft, 0);
  assert.equal(harness.getLlmCalls(), 3);
});

test('Teacher gets lighter % weights (5% text, 12% image) and Admin/Staff stay exempt', async (t) => {
  const harness = createMockAiSupportHarness();
  t.after(harness.restore);
  const { svc } = harness;

  const teacher = { id: `teacher-pct-${Date.now()}`, role: 'teacher', name: 'GV Tin Hoc' };
  const tQPeek = svc.peekQuestionQuota({ userRole: 'teacher' }, teacher);
  const tIPeek = svc.peekImageQuota({ userRole: 'teacher' }, teacher);
  assert.equal(tQPeek.percentLeft, 100);
  assert.equal(tIPeek.allowed, true);

  // 1st query: short text + image = 5% + 7% = 12% -> 88% left
  const rImg = await svc.quickAskAssistant({
    user: teacher,
    question: `Đánh giá sơ đồ quan hệ bảng SQL trong ảnh bài thực hành ${Date.now()}`,
    attachment: { name: 't-1.png', mimeType: 'image/png', dataBase64: 'AAA' },
  });
  assert.equal(rImg.questionQuota.percentLeft, 88);

  // 2nd query: short text = 5% -> 83% left
  const rTxt = await svc.quickAskAssistant({
    user: teacher,
    question: `Gợi ý tiêu chí chấm bài thiết kế cơ sở dữ liệu SQL của lớp ${Date.now()}`,
  });
  assert.equal(rTxt.questionQuota.percentLeft, 83);

  for (const exemptRole of ['admin', 'staff']) {
    const q = svc.peekQuestionQuota({ userRole: exemptRole }, { id: `${exemptRole}-1`, role: exemptRole });
    const img = svc.peekImageQuota({ userRole: exemptRole }, { id: `${exemptRole}-1`, role: exemptRole });
    assert.equal(q.applies, false);
    assert.equal(q.remaining, null);
    assert.equal(img.applies, false);
    assert.equal(img.allowed, true);
  }
});

test('Non-LLM interactions cost 0% and Gemini failures refund exact consumed % budget', async (t) => {
  const harness = createMockAiSupportHarness();
  t.after(harness.restore);
  const { svc } = harness;

  const stu = { id: `stu-refund-${Date.now()}`, role: 'student', freePortal: false };

  // Greeting costs 0% and makes 0 LLM calls
  const greetRes = await svc.quickAskAssistant({ user: stu, question: 'xin chào', preferredLang: 'vi' });
  assert.equal(greetRes.source, 'memory');
  assert.equal(harness.getLlmCalls(), 0);
  const findStudentSession = () => [...harness.sessions.values()].find((s) => String(s.userId) === String(stu.id));
  assert.equal(findStudentSession(), undefined);

  // First image succeeds: 100% -> 80%
  const okImg = await svc.quickAskAssistant({
    user: stu,
    question: `Kiểm tra lỗi truy vấn SQL trên ảnh ${Date.now()}`,
    attachment: { name: 'ok.png', mimeType: 'image/png', dataBase64: 'AAA' },
  });
  assert.equal(okImg.questionQuota.percentLeft, 80);

  // Next query fails at Gemini -> must refund its 20% cleanly back to 80%
  harness.setFailLlm(true);
  const failRes = await svc.quickAskAssistant({
    user: stu,
    question: `Ảnh thứ 2 phân tích mã lỗi JavaScript gặp lỗi API Gemini ${Date.now()}`,
    attachment: { name: 'fail.png', mimeType: 'image/png', dataBase64: 'AAA' },
  });
  assert.equal(failRes.source, 'fallback');
  harness.setFailLlm(false);

  const sessionAfterFail = findStudentSession();
  assert.ok(sessionAfterFail);
  assert.equal(svc.peekQuestionQuota(sessionAfterFail, stu).percentLeft, 80);
  assert.equal(sessionAfterFail.budgetUsedBp, 200);

  // Yesterday's exhausted session resets to 100% today & reset meta is bounded within 24h
  const expiredSession = { userRole: 'student', budgetDate: '2020-01-01', budgetUsedBp: 1000 };
  assert.equal(svc.peekQuestionQuota(expiredSession, stu).percentLeft, 100);
  const resetMeta = svc.getVietnamResetMeta();
  assert.ok(resetMeta.resetInMs >= 1000 && resetMeta.resetInMs <= 24 * 60 * 60 * 1000);
  assert.ok(Date.parse(resetMeta.resetsAt) > Date.now());
});
