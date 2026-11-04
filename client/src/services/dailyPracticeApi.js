import { apiFetch } from './api';

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Lỗi ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data.data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body || {}) });

const dailyPracticeApi = {
  student: {
    overview: async () => parse(await apiFetch('/daily-practice/my/overview')),
    start: async (topicId, difficulty) => parse(await apiFetch('/daily-practice/my/sessions', json('POST', { topicId, difficulty }))),
    answer: async (sessionId, questionId, answer) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/answer`, json('POST', { questionId, answer }))),
    hint: async (sessionId, questionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/hint`, json('POST', { questionId }))),
    finish: async (sessionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/finish`, json('POST'))),
    relatedTopics: async (subjectId, unitId = '') => {
      const query = new URLSearchParams({ subjectId, ...(unitId ? { unitId } : {}) }).toString();
      return parse(await apiFetch(`/daily-practice/my/related-topics?${query}`));
    },
  },
  admin: {
    topics: async () => parse(await apiFetch('/daily-practice/topics')),
    createTopic: async (body) => parse(await apiFetch('/daily-practice/topics', json('POST', body))),
    updateTopic: async (id, body) => parse(await apiFetch(`/daily-practice/topics/${id}`, json('PUT', body))),
    deleteTopic: async (id) => parse(await apiFetch(`/daily-practice/topics/${id}`, { method: 'DELETE' })),
    publishDrafts: async (id) => parse(await apiFetch(`/daily-practice/topics/${id}/publish-drafts`, json('POST'))),
    installStarter: async () => parse(await apiFetch('/daily-practice/starter', json('POST'))),
    questions: async (params) => {
      const query = new URLSearchParams(Object.entries(params || {}).filter(([, value]) => value)).toString();
      return parse(await apiFetch(`/daily-practice/questions?${query}`));
    },
    createQuestion: async (body) => parse(await apiFetch('/daily-practice/questions', json('POST', body))),
    updateQuestion: async (id, body) => parse(await apiFetch(`/daily-practice/questions/${id}`, json('PUT', body))),
    deleteQuestion: async (id) => parse(await apiFetch(`/daily-practice/questions/${id}`, { method: 'DELETE' })),
    aiGenerate: async (body) => parse(await apiFetch('/daily-practice/questions/ai-generate', json('POST', body))),
  },
};

export default dailyPracticeApi;
