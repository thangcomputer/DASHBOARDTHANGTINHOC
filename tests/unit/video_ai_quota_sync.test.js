'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../../utils/cache');

function findRouteFinalHandler(router, method, routePath) {
  const layer = router.stack.find(
    (entry) => entry.route
      && entry.route.path === routePath
      && entry.route.methods?.[method.toLowerCase()],
  );
  assert.ok(layer, `Expected route ${method.toUpperCase()} ${routePath}`);
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(key, val) {
      this.headers[key] = val;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeInMemoryQuotaAdapter(initialUsedBp = 0, { isFree = true } = {}) {
  const DAILY_BUDGET_BP = 1000;
  const sessionDoc = {
    budgetDate: '2026-11-24',
    budgetUsedBp: initialUsedBp,
    _lastConsumedBp: 0,
  };
  const limit = isFree ? 2 : 10;
  const costPerTurnBp = isFree ? 500 : 80;

  const peekQuestionQuota = () => {
    const remainingBp = Math.max(0, DAILY_BUDGET_BP - sessionDoc.budgetUsedBp);
    const percentLeft = remainingBp <= 0
      ? 0
      : Math.min(100, Math.max(1, Math.round((remainingBp * 100) / DAILY_BUDGET_BP)));
    return {
      applies: true,
      mode: 'percent',
      unit: 'percent',
      used: 100 - percentLeft,
      remaining: percentLeft,
      limit: 100,
      percentUsed: 100 - percentLeft,
      percentLeft,
      budgetUsedBp: sessionDoc.budgetUsedBp,
      budgetLimitBp: DAILY_BUDGET_BP,
      resetInMs: 3600_000,
    };
  };

  const peekImageQuota = () => ({
    applies: true,
    allowed: !isFree,
    limit: isFree ? 0 : 100,
    percentLeft: isFree ? 0 : peekQuestionQuota().percentLeft,
    remaining: isFree ? 0 : peekQuestionQuota().percentLeft,
    used: isFree ? 100 : peekQuestionQuota().percentUsed,
  });

  return {
    sessionDoc,
    async open(user) {
      return { applies: Boolean(user), sessionDoc, quotaUser: user };
    },
    peekQuestionQuota,
    peekImageQuota,
    async consume() {
      if (sessionDoc.budgetUsedBp >= DAILY_BUDGET_BP) {
        return { applies: true, blocked: true, consumedBp: 0 };
      }
      const delta = Math.min(DAILY_BUDGET_BP - sessionDoc.budgetUsedBp, costPerTurnBp);
      sessionDoc.budgetUsedBp += delta;
      sessionDoc._lastConsumedBp = delta;
      return { applies: true, blocked: false, consumedBp: delta };
    },
    async refund(_doc, amountBp) {
      sessionDoc.budgetUsedBp = Math.max(0, sessionDoc.budgetUsedBp - (amountBp || 0));
    },
    buildQuotaError() {
      const err = new Error('Bạn đã dùng hết 100% hạn mức AI hôm nay. Hạn mức sẽ tự động làm mới vào 00:00.');
      err.status = 403;
      err.code = 'AI_QUESTION_QUOTA';
      err.questionQuota = peekQuestionQuota();
      err.imageQuota = peekImageQuota();
      err.limit = limit;
      return err;
    },
  };
}

describe('Video Lesson AI unified quota synchronization', () => {
  let llmPath;
  let dpAiPath;
  let origLlm;
  let origDpAi;
  let llmCalls;
  let llmShouldFail;

  beforeEach(async () => {
    llmPath = require.resolve('../../services/ai/llmClient');
    dpAiPath = require.resolve('../../services/dailyPracticeAi');
    origLlm = require.cache[llmPath];
    origDpAi = require.cache[dpAiPath];
    llmCalls = [];
    llmShouldFail = false;
    await cache.delByPrefix('lesson_ai:');

    require.cache[llmPath] = {
      id: llmPath,
      filename: llmPath,
      loaded: true,
      exports: {
        isAiConfigured: () => true,
        getConfig: () => ({ model: 'gemini-3.5-flash-lite', baseUrl: 'https://example.test' }),
        chatCompletion: async (opts) => {
          llmCalls.push(opts);
          if (llmShouldFail) {
            throw new Error('Upstream Gemini timeout');
          }
          return {
            content: 'Hướng dẫn dùng hàm SUMIFS đúng chuẩn trong bài học Excel.',
            model: opts.model,
          };
        },
      },
    };
    delete require.cache[dpAiPath];
  });

  afterEach(() => {
    if (origLlm) require.cache[llmPath] = origLlm;
    else delete require.cache[llmPath];
    if (origDpAi) require.cache[dpAiPath] = origDpAi;
    else delete require.cache[dpAiPath];
  });

  it('hard-blocks video AI at 0% remaining across AI, memory, and cache queries with zero LLM calls', async () => {
    const dpAi = require('../../services/dailyPracticeAi');
    const adapter = makeInMemoryQuotaAdapter(1000, { isFree: true }); // 0% left
    const student = { id: 'stu_1', role: 'student', freePortal: true };

    await assert.rejects(
      () => dpAi.askLessonAssistant({
        question: 'chào bạn',
        lessonTitle: 'Bài 1',
        unitTitle: 'Chương 1',
        user: student,
        _quotaAdapter: adapter,
      }),
      (err) => err.status === 403 && err.code === 'AI_QUESTION_QUOTA' && err.questionQuota?.percentLeft === 0,
    );

    // Must also block short 0-token memory queries (e.g. VLOOKUP) once daily quota hits 0%
    await assert.rejects(
      () => dpAi.askLessonAssistant({
        question: 'Hàm VLOOKUP dùng sao?',
        lessonTitle: 'Bài 1',
        user: student,
        _quotaAdapter: adapter,
      }),
      (err) => err.status === 403 && err.code === 'AI_QUESTION_QUOTA' && err.questionQuota?.percentLeft === 0,
    );

    assert.equal(llmCalls.length, 0);
  });

  it('consumes shared daily budget on video AI replies and blocks once 0% is reached', async () => {
    const dpAi = require('../../services/dailyPracticeAi');
    const adapter = makeInMemoryQuotaAdapter(0, { isFree: true }); // 50% per turn for free student -> 2 turns max
    const student = { id: 'stu_2', role: 'student', freePortal: true };

    const first = await dpAi.askLessonAssistant({
      question: 'Giải thích cách viết hàm SUMIFS trong bài học này?',
      lessonTitle: 'Bài 2',
      unitTitle: 'Excel',
      user: student,
      _quotaAdapter: adapter,
    });
    assert.equal(first.source, 'ai');
    assert.equal(first.questionQuota.percentLeft, 50);
    assert.equal(adapter.sessionDoc.budgetUsedBp, 500);

    // Second turn (even from cache) consumes remaining 50% -> reaches 0%
    const second = await dpAi.askLessonAssistant({
      question: 'Giải thích cách viết hàm SUMIFS trong bài học này?',
      lessonTitle: 'Bài 2',
      unitTitle: 'Excel',
      user: student,
      _quotaAdapter: adapter,
    });
    assert.equal(second.source, 'cache');
    assert.equal(second.questionQuota.percentLeft, 0);
    assert.equal(adapter.sessionDoc.budgetUsedBp, 1000);

    // Third turn is blocked immediately
    await assert.rejects(
      () => dpAi.askLessonAssistant({
        question: 'Hỏi thêm một câu nữa về Excel trong bài 2 nhé?',
        lessonTitle: 'Bài 2',
        user: student,
        _quotaAdapter: adapter,
      }),
      (err) => err.status === 403 && err.code === 'AI_QUESTION_QUOTA' && err.questionQuota?.percentLeft === 0,
    );
  });

  it('refunds consumed quota if all Gemini fallback models fail', async () => {
    const dpAi = require('../../services/dailyPracticeAi');
    const adapter = makeInMemoryQuotaAdapter(500, { isFree: true }); // 50% left
    const student = { id: 'stu_3', role: 'student', freePortal: true };
    llmShouldFail = true;

    await assert.rejects(
      () => dpAi.askLessonAssistant({
        question: 'Giải thích lỗi công thức nâng cao trong bài tập thực hành số 5?',
        lessonTitle: 'Bài 5',
        user: student,
        _quotaAdapter: adapter,
      }),
      (err) => err.status === 503,
    );
    assert.equal(adapter.sessionDoc.budgetUsedBp, 500, 'Budget must be refunded on Gemini failure');
  });

  it('POST /my/ai-assistant forwards req.user and returns 403 + questionQuota on AI_QUESTION_QUOTA', async () => {
    const dpAi = require('../../services/dailyPracticeAi');
    const routesPath = require.resolve('../../routes/dailyPracticeRoutes');
    const origRoutes = require.cache[routesPath];
    delete require.cache[routesPath];
    const origAsk = dpAi.askLessonAssistant;
    let receivedUser = null;

    dpAi.askLessonAssistant = async (args) => {
      receivedUser = args.user;
      const err = new Error('Bạn đã dùng hết 100% hạn mức AI hôm nay.');
      err.status = 403;
      err.code = 'AI_QUESTION_QUOTA';
      err.questionQuota = { applies: true, percentLeft: 0, remaining: 0, limit: 100, used: 100 };
      err.imageQuota = { applies: true, allowed: false, limit: 0, percentLeft: 0, remaining: 0, used: 100 };
      throw err;
    };

    try {
      const freshRoutes = require('../../routes/dailyPracticeRoutes');
      const handler = findRouteFinalHandler(freshRoutes, 'post', '/my/ai-assistant');
      const req = {
        user: { id: 'stu_http_1', role: 'student', freePortal: true },
        body: { question: 'chào bạn', lessonTitle: 'Bài 1' },
      };
      const res = createMockRes();
      await handler(req, res);

      assert.equal(receivedUser?.id, 'stu_http_1');
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'AI_QUESTION_QUOTA');
      assert.equal(res.body.questionQuota?.percentLeft, 0);
      assert.equal(res.body.imageQuota?.limit, 0);
    } finally {
      dpAi.askLessonAssistant = origAsk;
      if (origRoutes) require.cache[routesPath] = origRoutes;
      else delete require.cache[routesPath];
    }
  });
});
