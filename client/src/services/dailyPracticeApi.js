import { apiFetch } from './api';

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Lỗi ${res.status}`);
    err.status = res.status;
    err.code = data.code || '';
    throw err;
  }
  return data.data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body || {}) });

const dailyPracticeApi = {
  student: {
    overview: async () => parse(await apiFetch('/daily-practice/my/overview')),
    start: async (topicId, difficulty) => parse(await apiFetch('/daily-practice/my/sessions', json('POST', { topicId, difficulty }))),
    path: async () => parse(await apiFetch('/daily-practice/my/path')),
    unitVideos: async (unitId) => parse(await apiFetch(`/daily-practice/my/path/units/${unitId}/videos`)),
    videoWatched: async (unitId, videoId) => parse(await apiFetch('/daily-practice/my/path/videos/watched', json('POST', { unitId, videoId }))),
    answerVideoCheck: async (unitId, videoId, checkId, body) => parse(await apiFetch(
      `/daily-practice/my/path/units/${unitId}/videos/${encodeURIComponent(videoId)}/checks/${checkId}/answer`,
      json('POST', body),
    )),
    buyVideoHint: async (unitId, videoId, checkId) => parse(await apiFetch(
      `/daily-practice/my/path/units/${unitId}/videos/${encodeURIComponent(videoId)}/checks/${checkId}/hint`,
      json('POST', {}),
    )),
    startPath: async (unitId, step, testOut = false, nodeKey = '') => parse(await apiFetch('/daily-practice/my/sessions', json('POST', {
      mode: 'path', unitId, step, testOut, nodeKey,
    }))),
    answer: async (sessionId, questionId, answer) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/answer`, json('POST', { questionId, answer }))),
    hint: async (sessionId, questionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/hint`, json('POST', { questionId }))),
    finish: async (sessionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/finish`, json('POST'))),
    abandon: async (sessionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/abandon`, json('POST'))),
    relatedTopics: async (subjectId, unitId = '') => {
      const query = new URLSearchParams({ subjectId, ...(unitId ? { unitId } : {}) }).toString();
      return parse(await apiFetch(`/daily-practice/my/related-topics?${query}`));
    },
    buyXp: async (packId) => parse(await apiFetch('/daily-practice/my/xp/purchase', json('POST', { packId }))),
    xpPurchaseStatus: async (sessionId) => parse(await apiFetch(`/daily-practice/my/xp/purchase/${encodeURIComponent(sessionId)}`)),
    simulateXpPaid: async (sessionId) => parse(await apiFetch(`/daily-practice/my/xp/purchase/${encodeURIComponent(sessionId)}/simulate-paid`, json('POST'))),
  },
  admin: {
    topics: async () => parse(await apiFetch('/daily-practice/topics')),
    createTopic: async (body) => parse(await apiFetch('/daily-practice/topics', json('POST', body))),
    updateTopic: async (id, body) => parse(await apiFetch(`/daily-practice/topics/${id}`, json('PUT', body))),
    deleteTopic: async (id) => parse(await apiFetch(`/daily-practice/topics/${id}`, { method: 'DELETE' })),
    publishDrafts: async (id) => parse(await apiFetch(`/daily-practice/topics/${id}/publish-drafts`, json('POST'))),
    installStarter: async () => parse(await apiFetch('/daily-practice/starter', json('POST'))),
    xpPacks: async () => parse(await apiFetch('/daily-practice/xp-packs')),
    saveXpPacks: async (prices) => parse(await apiFetch('/daily-practice/xp-packs', json('PUT', { prices }))),
    questions: async (params) => {
      const query = new URLSearchParams(Object.entries(params || {}).filter(([, value]) => value)).toString();
      return parse(await apiFetch(`/daily-practice/questions?${query}`));
    },
    createQuestion: async (body) => parse(await apiFetch('/daily-practice/questions', json('POST', body))),
    updateQuestion: async (id, body) => parse(await apiFetch(`/daily-practice/questions/${id}`, json('PUT', body))),
    deleteQuestion: async (id) => parse(await apiFetch(`/daily-practice/questions/${id}`, { method: 'DELETE' })),
    aiGenerate: async (body) => parse(await apiFetch('/daily-practice/questions/ai-generate', json('POST', body))),
    units: async (topicId) => parse(await apiFetch(`/daily-practice/topics/${topicId}/units`)),
    createUnit: async (topicId, body) => parse(await apiFetch(`/daily-practice/topics/${topicId}/units`, json('POST', body))),
    reorderUnits: async (topicId, unitIds) => parse(await apiFetch(`/daily-practice/topics/${topicId}/units/order`, json('PUT', { unitIds }))),
    assignUnassigned: async (topicId, body) => parse(await apiFetch(`/daily-practice/topics/${topicId}/units/assign-unassigned`, json('POST', body))),
    updateUnit: async (id, body) => parse(await apiFetch(`/daily-practice/units/${id}`, json('PUT', body))),
    deleteUnit: async (id) => parse(await apiFetch(`/daily-practice/units/${id}`, { method: 'DELETE' })),
  },
};

export default dailyPracticeApi;
