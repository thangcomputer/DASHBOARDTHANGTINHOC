'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function createMockAiSupportHarness({ envOverrides = {} } = {}) {
  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const sessionPath = require.resolve('../../models/AiSupportSession');
  const origLlm = require.cache[llmPath];
  const origSvc = require.cache[svcPath];
  const origSession = require.cache[sessionPath];

  const sessions = new Map();
  let llmCalls = 0;

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
    restore,
  };
}

test('Quick Ask shares daily Gemini quota with messenger session', async (t) => {
  const harness = createMockAiSupportHarness({
    envOverrides: { AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT: '2' },
  });
  t.after(harness.restore);

  const user = { id: `quota-unit-${Date.now()}`, role: 'student', name: 'Quota Test' };
  const q1 = 'API là gì trong lập trình web?';
  const q2 = 'REST API khác gRPC như thế nào?';
  const q3 = 'GraphQL so với REST API có ưu nhược điểm gì?';

  const r1 = await harness.svc.quickAskAssistant({ user, question: q1, preferredLang: 'vi' });
  assert.equal(r1.source, 'ai');
  assert.ok(r1.questionQuota);

  await harness.svc.quickAskAssistant({ user, question: q2, preferredLang: 'vi' });

  await assert.rejects(
    () => harness.svc.quickAskAssistant({ user, question: q3, preferredLang: 'vi' }),
    (err) => err?.code === 'AI_QUESTION_QUOTA',
  );

  assert.equal(harness.getLlmCalls(), 2, 'Third question must be blocked after limit of 2');
});

test('Official student gets 10 questions and 5 images per day across Quick Ask and Messenger', async (t) => {
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
    assert.equal(qPeek.limit, 10);
    assert.equal(qPeek.remaining, 10);
    assert.equal(iPeek.applies, true);
    assert.equal(iPeek.allowed, true);
    assert.equal(iPeek.limit, 5);
    assert.equal(iPeek.remaining, 5);
  }

  for (let i = 1; i <= 10; i += 1) {
    const res = await svc.quickAskAssistant({
      user: officialCenterStudent,
      question: `Giải thích khái niệm DNS số ${i} trong mạng máy tính?`,
      preferredLang: 'vi',
    });
    assert.equal(res.questionQuota.limit, 10);
    assert.equal(res.questionQuota.used, i);
    assert.equal(res.questionQuota.remaining, 10 - i);
  }

  await assert.rejects(
    () => svc.quickAskAssistant({
      user: officialCenterStudent,
      question: 'Giải thích khái niệm DNS số 11 trong mạng máy tính?',
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_QUESTION_QUOTA',
  );

  // Separate official student tests 5 image quota limit + ensures 6th image does NOT burn question quota
  const imgUser = { id: `stu-img-${Date.now()}`, role: 'student', freePortal: false, name: 'HV Anh' };
  const fakeImage = { name: 'sheet.png', mimeType: 'image/png', dataBase64: 'iVBORw0KGgo=' };
  for (let i = 1; i <= 5; i += 1) {
    const res = await svc.quickAskAssistant({
      user: imgUser,
      question: `Xem giúp lỗi Excel trong ảnh số ${i}`,
      attachment: fakeImage,
      preferredLang: 'vi',
    });
    assert.equal(res.imageQuota.limit, 5);
    assert.equal(res.imageQuota.allowed, true);
    assert.equal(res.imageQuota.used, i);
    assert.equal(res.imageQuota.remaining, 5 - i);
    assert.equal(res.questionQuota.used, i);
  }

  await assert.rejects(
    () => svc.quickAskAssistant({
      user: imgUser,
      question: 'Xem giúp lỗi Excel trong ảnh số 6',
      attachment: fakeImage,
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_IMAGE_QUOTA',
  );

  // Still has 5 text questions remaining after 5 images (and 6th rejected image didn't consume one)
  const textAfterImageLimit = await svc.quickAskAssistant({
    user: imgUser,
    question: 'Cách kết hợp Power Query gộp nhiều sheet bán hàng tự động trong Excel?',
    preferredLang: 'vi',
  });
  assert.equal(textAfterImageLimit.source, 'ai');
  assert.equal(textAfterImageLimit.questionQuota.used, 6);
  assert.equal(textAfterImageLimit.questionQuota.remaining, 4);
});

test('Free student gets 2 text questions and 0 images per day (images blocked without LLM/question cost)', async (t) => {
  const harness = createMockAiSupportHarness();
  t.after(harness.restore);
  const { svc } = harness;

  const freeLockedStudent = {
    id: `stu-free-${Date.now()}`,
    role: 'student',
    freePortal: true,
    freeUnlocked: false,
    enrollments: [],
  };
  const expiredMeetStudent = {
    id: `stu-free-exp-${Date.now()}`,
    role: 'student',
    freePortal: true,
    freeUnlocked: true,
    subscription: { plan: '1m', expiresAt: new Date(Date.now() - 86_400_000).toISOString() },
    enrollments: [],
  };

  for (const stu of [freeLockedStudent, expiredMeetStudent]) {
    assert.equal(svc.isFreeTierAiStudent(stu), true);
    const qPeek = svc.peekQuestionQuota({ userRole: 'student' }, stu);
    const iPeek = svc.peekImageQuota({ userRole: 'student' }, stu);
    assert.equal(qPeek.applies, true);
    assert.equal(qPeek.limit, 2);
    assert.equal(qPeek.remaining, 2);
    assert.equal(iPeek.applies, true);
    assert.equal(iPeek.allowed, false);
    assert.equal(iPeek.limit, 0);
    assert.equal(iPeek.remaining, 0);
  }

  // Blocking applies cleanly even before any session exists or via consumeAiImageQuota
  const messengerImgQuota = await svc.consumeAiImageQuota({ userRole: 'student' }, freeLockedStudent);
  assert.equal(messengerImgQuota.applies, true);
  assert.equal(messengerImgQuota.blocked, true);
  assert.equal(messengerImgQuota.disallowed, true);
  assert.equal(messengerImgQuota.limit, 0);

  // Quick Ask image or PDF vision MUST be rejected immediately with zero LLM calls and zero question consumption
  const callsBeforeImg = harness.getLlmCalls();
  await assert.rejects(
    () => svc.quickAskAssistant({
      user: freeLockedStudent,
      question: 'Xem lỗi Excel trong ảnh',
      attachment: { name: 'err.png', mimeType: 'image/png', dataBase64: 'iVBORw0KGgo=' },
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_IMAGE_QUOTA' && err?.imageQuota?.limit === 0,
  );
  await assert.rejects(
    () => svc.quickAskAssistant({
      user: freeLockedStudent,
      question: 'Đọc file PDF này giúp mình',
      attachment: { name: 'bai.pdf', mimeType: 'application/pdf', dataBase64: 'JVBERi0x' },
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_IMAGE_QUOTA' && err?.imageQuota?.limit === 0,
  );
  assert.equal(harness.getLlmCalls(), callsBeforeImg);

  // Plain text attachment + 1st memory-hit question still count toward 2/day limit for free students
  const r1 = await svc.quickAskAssistant({
    user: freeLockedStudent,
    question: 'VLOOKUP là gì',
    preferredLang: 'vi',
  });
  assert.equal(r1.questionQuota.limit, 2);
  assert.equal(r1.questionQuota.used, 1);
  assert.equal(r1.questionQuota.remaining, 1);
  assert.equal(r1.imageQuota.limit, 0);
  assert.equal(r1.imageQuota.allowed, false);

  const r2 = await svc.quickAskAssistant({
    user: freeLockedStudent,
    question: 'Giải thích công thức CSV này giúp mình',
    attachment: { name: 'data.csv', mimeType: 'text/csv', textContent: 'Name,Score\nAn,9' },
    preferredLang: 'vi',
  });
  assert.equal(r2.questionQuota.used, 2);
  assert.equal(r2.questionQuota.remaining, 0);

  // 3rd question rejected for both locked free student and expired Meet free student
  await assert.rejects(
    () => svc.quickAskAssistant({
      user: freeLockedStudent,
      question: 'Hàm SUMIFS dùng ra sao?',
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_QUESTION_QUOTA' && err?.questionQuota?.limit === 2,
  );

  await assert.rejects(
    () => svc.quickAskAssistant({
      user: expiredMeetStudent,
      question: 'Xem lỗi Excel này',
      attachment: { name: 'err.jpg', mimeType: 'image/jpeg', dataBase64: '/9j/4AAQ' },
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_IMAGE_QUOTA',
  );
});

test('Teacher gets 15 questions and 10 images per day; admin/staff remain exempt', async (t) => {
  const harness = createMockAiSupportHarness();
  t.after(harness.restore);
  const { svc } = harness;

  const teacher = { id: `tea-${Date.now()}`, role: 'teacher', name: 'Thay Giao' };
  const tQPeek = svc.peekQuestionQuota({ userRole: 'teacher' }, teacher);
  const tIPeek = svc.peekImageQuota({ userRole: 'teacher' }, teacher);
  assert.equal(tQPeek.applies, true);
  assert.equal(tQPeek.limit, 15);
  assert.equal(tIPeek.applies, true);
  assert.equal(tIPeek.allowed, true);
  assert.equal(tIPeek.limit, 10);

  const fakeImg = { name: 'slide.png', mimeType: 'image/png', dataBase64: 'iVBORw0KGgo=' };
  for (let i = 1; i <= 10; i += 1) {
    const r = await svc.quickAskAssistant({
      user: teacher,
      question: `Gợi ý chỉnh slide ${i}`,
      attachment: fakeImg,
      preferredLang: 'vi',
    });
    assert.equal(r.imageQuota.limit, 10);
    assert.equal(r.imageQuota.used, i);
    assert.equal(r.imageQuota.remaining, 10 - i);
    assert.equal(r.questionQuota.limit, 15);
    assert.equal(r.questionQuota.used, i);
  }

  await assert.rejects(
    () => svc.quickAskAssistant({
      user: teacher,
      question: 'Gợi ý chỉnh slide 11',
      attachment: fakeImg,
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_IMAGE_QUOTA',
  );

  for (let i = 11; i <= 15; i += 1) {
    const r = await svc.quickAskAssistant({
      user: teacher,
      question: `Soạn đề bài thực hành Excel nâng cao số ${i}`,
      preferredLang: 'vi',
    });
    assert.equal(r.questionQuota.used, i);
    assert.equal(r.questionQuota.remaining, 15 - i);
  }

  await assert.rejects(
    () => svc.quickAskAssistant({
      user: teacher,
      question: 'Soạn đề bài thực hành Excel nâng cao số 16',
      preferredLang: 'vi',
    }),
    (err) => err?.status === 403 && err?.code === 'AI_QUESTION_QUOTA',
  );

  for (const exemptRole of ['admin', 'staff']) {
    const q = svc.peekQuestionQuota({ userRole: exemptRole }, { id: `${exemptRole}-1`, role: exemptRole });
    const img = svc.peekImageQuota({ userRole: exemptRole }, { id: `${exemptRole}-1`, role: exemptRole });
    assert.equal(q.applies, false);
    assert.equal(q.remaining, null);
    assert.equal(img.applies, false);
    assert.equal(img.allowed, true);
    assert.equal(img.remaining, null);
  }
});
