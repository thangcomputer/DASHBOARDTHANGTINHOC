import { apiFetch } from './api';

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Lỗi ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data.data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body || {}) });

const subscriptionApi = {
  student: {
    overview: async () => parse(await apiFetch('/subscription/my')),
    redeem: async (code) => parse(await apiFetch('/subscription/my/redeem', json('POST', { code }))),
    checkout: async (plan) => parse(await apiFetch('/subscription/my/checkout', json('POST', { plan }))),
    session: async (sessionId) => parse(await apiFetch(`/subscription/my/sessions/${encodeURIComponent(sessionId)}`)),
    simulatePaid: async (sessionId) => parse(await apiFetch(`/subscription/my/sessions/${encodeURIComponent(sessionId)}/simulate-paid`, json('POST'))),
  },
  admin: {
    plans: async () => parse(await apiFetch('/subscription/plans')),
    setPrices: async (prices) => parse(await apiFetch('/subscription/plans', json('PUT', { prices }))),
    codes: async (params = {}) => {
      const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
      return parse(await apiFetch(`/subscription/codes${query ? `?${query}` : ''}`));
    },
    generate: async ({ plan, quantity, note }) => parse(await apiFetch('/subscription/codes', json('POST', { plan, quantity, note }))),
    revoke: async (id) => parse(await apiFetch(`/subscription/codes/${id}/revoke`, json('POST'))),
    exportCsv: async (params = {}) => {
      const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
      const res = await apiFetch(`/subscription/codes/export.csv${query ? `?${query}` : ''}`);
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      return res.blob();
    },
    searchStudents: async (q) => parse(await apiFetch(`/subscription/students?q=${encodeURIComponent(q)}`)),
    student: async (studentId) => parse(await apiFetch(`/subscription/students/${studentId}`)),
    setStudent: async (studentId, body) => parse(await apiFetch(`/subscription/students/${studentId}`, json('PUT', body))),
  },
};

export default subscriptionApi;
