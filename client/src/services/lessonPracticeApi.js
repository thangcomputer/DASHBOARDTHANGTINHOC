import { apiFetch, uploadWithAuth } from './api';

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Lỗi ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const lessonPracticeApi = {
  admin: {
    subjects: async () => parse(await apiFetch('/lesson-practice/subjects')),
    createSubject: async (body) => parse(await apiFetch('/lesson-practice/subjects', { method: 'POST', body: JSON.stringify(body) })),
    updateSubject: async (id, body) => parse(await apiFetch(`/lesson-practice/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),
    deleteSubject: async (id) => parse(await apiFetch(`/lesson-practice/subjects/${id}`, { method: 'DELETE' })),
    seedDefaults: async () => parse(await apiFetch('/lesson-practice/subjects/seed-defaults', { method: 'POST', body: '{}' })),
    units: async (subjectId) => parse(await apiFetch(`/lesson-practice/subjects/${subjectId}/units`)),
    createUnit: async (subjectId, body) => parse(await apiFetch(`/lesson-practice/subjects/${subjectId}/units`, { method: 'POST', body: JSON.stringify(body) })),
    updateUnit: async (id, body) => parse(await apiFetch(`/lesson-practice/units/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),
    deleteUnit: async (id) => parse(await apiFetch(`/lesson-practice/units/${id}`, { method: 'DELETE' })),
    items: async (unitId) => parse(await apiFetch(`/lesson-practice/units/${unitId}/items`)),
    createItem: async (unitId, body) => parse(await apiFetch(`/lesson-practice/units/${unitId}/items`, { method: 'POST', body: JSON.stringify(body) })),
    updateItem: async (id, body) => parse(await apiFetch(`/lesson-practice/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),
    deleteItem: async (id) => parse(await apiFetch(`/lesson-practice/items/${id}`, { method: 'DELETE' })),
    progress: async (subjectId) => parse(await apiFetch(`/lesson-practice/progress${subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''}`)),
  },
  student: {
    subjects: async () => parse(await apiFetch('/lesson-practice/my/subjects')),
    units: async (subjectId) => parse(await apiFetch(`/lesson-practice/my/subjects/${subjectId}/units`)),
    unit: async (unitId) => parse(await apiFetch(`/lesson-practice/my/units/${unitId}`)),
    confirm: async (itemId, body) => parse(await apiFetch(`/lesson-practice/my/items/${itemId}/confirm`, { method: 'POST', body: JSON.stringify(body) })),
  },
  upload: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadWithAuth('/lesson-practice/upload', fd);
  },
};

export default lessonPracticeApi;
