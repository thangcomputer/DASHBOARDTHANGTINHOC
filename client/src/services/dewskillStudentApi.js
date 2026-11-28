import { apiFetch } from './api';

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Lỗi ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const dewskillStudentApi = {
  list: async (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.filter && params.filter !== 'all') qs.set('filter', params.filter);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return parse(await apiFetch(`/dewskill-students${suffix}`));
  },

  create: async (payload) =>
    parse(
      await apiFetch('/dewskill-students', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    ),

  update: async (id, payload) =>
    parse(
      await apiFetch(`/dewskill-students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    ),

  remove: async (id) =>
    parse(
      await apiFetch(`/dewskill-students/${id}`, {
        method: 'DELETE',
      })
    ),

  resetDevices: async (id) =>
    parse(
      await apiFetch(`/dewskill-students/${id}/reset-devices`, {
        method: 'POST',
      })
    ),
};
