'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('Quick Ask shares daily Gemini quota with messenger session', async (t) => {
  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const sessionPath = require.resolve('../../models/AiSupportSession');
  const origLlm = require.cache[llmPath];
  const origSvc = require.cache[svcPath];
  const origSession = require.cache[sessionPath];

  const sessions = new Map();

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

  const userId = `quota-unit-${Date.now()}`;
  const user = { id: userId, role: 'student', name: 'Quota Test' };
  let llmCalls = 0;

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

  const prevLimit = process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT;
  process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT = '2';
  delete require.cache[svcPath];
  const svc = require('../../services/aiSupportService');
  const mongoose = require('mongoose');
  const origReadyDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  t.after(() => {
    if (prevLimit === undefined) delete process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT;
    else process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT = prevLimit;
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
  });

  const q1 = 'API là gì trong lập trình web?';
  const q2 = 'REST API khác gRPC như thế nào?';
  const q3 = 'GraphQL so với REST API có ưu nhược điểm gì?';

  const r1 = await svc.quickAskAssistant({ user, question: q1, preferredLang: 'vi' });
  assert.equal(r1.source, 'ai');
  assert.ok(r1.questionQuota);

  await svc.quickAskAssistant({ user, question: q2, preferredLang: 'vi' });

  await assert.rejects(
    () => svc.quickAskAssistant({ user, question: q3, preferredLang: 'vi' }),
    (err) => err?.code === 'AI_QUESTION_QUOTA',
  );

  assert.equal(llmCalls, 2, 'Third question must be blocked after limit of 2');
});