import { apiFetch } from './api';

export const DAILY_PRACTICE_STATS_EVENT = 'cms:daily-practice-stats';

export function emitDailyPracticeStats(patch) {
  if (!patch || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(DAILY_PRACTICE_STATS_EVENT, { detail: patch }));
  } catch { /* ignore */ }
}

async function parse(res, emitStats = false) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    if (emitStats && typeof data?.currentXp === 'number') {
      emitDailyPracticeStats({ xpTotal: data.currentXp });
    }
    const err = new Error(data.message || `Lỗi ${res.status}`);
    err.status = res.status;
    err.code = data.code || '';
    if (typeof data?.currentXp === 'number') err.currentXp = data.currentXp;
    if (typeof data?.needXp === 'number') err.needXp = data.needXp;
    throw err;
  }
  const payload = data.data;
  if (emitStats && payload && typeof payload === 'object') {
    const statsPatch = payload.stats && typeof payload.stats === 'object' ? { ...payload.stats } : {};
    if (typeof payload.profileXp === 'number') statsPatch.xpTotal = payload.profileXp;
    if (typeof payload.purchasedXp === 'number') statsPatch.purchasedXp = payload.purchasedXp;
    if (typeof payload.dailyXp === 'number') statsPatch.dailyXp = payload.dailyXp;
    if (Object.keys(statsPatch).length > 0) {
      emitDailyPracticeStats(statsPatch);
    }
  }
  return payload;
}

const json = (method, body) => ({ method, body: JSON.stringify(body || {}) });

const dailyPracticeApi = {
  student: {
    overview: async () => parse(await apiFetch('/daily-practice/my/overview', { cache: 'no-store' }), true),
    start: async (topicId, difficulty) => parse(await apiFetch('/daily-practice/my/sessions', json('POST', { topicId, difficulty })), true),
    path: async () => parse(await apiFetch('/daily-practice/my/path', { cache: 'no-store' })),
    setActivePathTopic: async (topicId) => parse(await apiFetch('/daily-practice/my/path/active-topic', {
      method: 'PUT',
      body: JSON.stringify({ topicId }),
    })),
    unitVideos: async (unitId) => parse(await apiFetch(`/daily-practice/my/path/units/${unitId}/videos`, { cache: 'no-store' })),
    videoWatched: async (unitId, videoId) => parse(await apiFetch('/daily-practice/my/path/videos/watched', json('POST', { unitId, videoId }))),
    claimUnitChest: async (unitId) => parse(await apiFetch(`/daily-practice/my/path/units/${encodeURIComponent(unitId)}/chest/claim`, json('POST', {})), true),
    answerVideoCheck: async (unitId, videoId, checkId, body) => parse(await apiFetch(
      `/daily-practice/my/path/units/${unitId}/videos/${encodeURIComponent(videoId)}/checks/${checkId}/answer`,
      json('POST', body),
    ), true),
    buyVideoHint: async (unitId, videoId, checkId) => parse(await apiFetch(
      `/daily-practice/my/path/units/${unitId}/videos/${encodeURIComponent(videoId)}/checks/${checkId}/hint`,
      json('POST', {}),
    ), true),
    startPath: async (unitId, step, testOut = false, nodeKey = '') => parse(await apiFetch('/daily-practice/my/sessions', json('POST', {
      mode: 'path', unitId, step, testOut, nodeKey,
    })), true),
    answer: async (sessionId, questionId, answer) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/answer`, json('POST', { questionId, answer })), true),
    hint: async (sessionId, questionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/hint`, json('POST', { questionId })), true),
    finish: async (sessionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/finish`, json('POST')), true),
    abandon: async (sessionId) => parse(await apiFetch(`/daily-practice/my/sessions/${sessionId}/abandon`, json('POST')), true),
    relatedTopics: async (subjectId, unitId = '') => {
      const query = new URLSearchParams({ subjectId, ...(unitId ? { unitId } : {}) }).toString();
      return parse(await apiFetch(`/daily-practice/my/related-topics?${query}`));
    },
    buyXp: async (packId) => parse(await apiFetch('/daily-practice/my/xp/purchase', json('POST', { packId }))),
    xpPurchaseStatus: async (sessionId) => parse(await apiFetch(`/daily-practice/my/xp/purchase/${encodeURIComponent(sessionId)}`, { cache: 'no-store' }), true),
    simulateXpPaid: async (sessionId) => parse(await apiFetch(`/daily-practice/my/xp/purchase/${encodeURIComponent(sessionId)}/simulate-paid`, json('POST')), true),
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
