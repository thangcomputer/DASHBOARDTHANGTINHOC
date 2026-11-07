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

const json = (method, body) => ({ method, body: JSON.stringify(body || {}) });

const meetClassApi = {
  mine: async () => parse(await apiFetch('/meet-classes/mine')),
  list: async () => parse(await apiFetch('/meet-classes')),
  eligibleStudents: async () => parse(await apiFetch('/meet-classes/eligible-students')),
  create: async (body) => parse(await apiFetch('/meet-classes', json('POST', body))),
  setLink: async (id, linkHoc) => parse(await apiFetch(`/meet-classes/${id}/link`, { method: 'PATCH', body: JSON.stringify({ linkHoc }) })),
  cancel: async (id) => parse(await apiFetch(`/meet-classes/${id}/cancel`, json('POST'))),
};

export default meetClassApi;
