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

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function dewskillClassErrorMessage(err, fallback = 'Không thể thực hiện thao tác. Vui lòng thử lại.') {
  const status = err?.status;
  if (status === 403) return 'Bạn không có quyền quản lý Danh mục lớp học DewSkill.';
  if (status === 401) return err?.message || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
  if (status >= 500) return 'Lỗi máy chủ, vui lòng thử lại sau.';
  return err?.message || fallback;
}

export const dewskillClassApi = {
  meta: async () => parse(await apiFetch('/dewskill-classes/meta')),
  list: async (params = {}) => parse(await apiFetch(`/dewskill-classes${qs(params)}`)),
  create: async (body) =>
    parse(await apiFetch('/dewskill-classes', { method: 'POST', body: JSON.stringify(body) })),
  update: async (id, body) =>
    parse(await apiFetch(`/dewskill-classes/${id}`, { method: 'PUT', body: JSON.stringify(body) })),
  updateVisibility: async (id, body) =>
    parse(
      await apiFetch(`/dewskill-classes/${id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    ),
  remove: async (id) =>
    parse(await apiFetch(`/dewskill-classes/${id}`, { method: 'DELETE' })),
  seedDefaults: async () =>
    parse(await apiFetch('/dewskill-classes/seed-defaults', { method: 'POST' })),
  searchStudents: async (params = {}) =>
    parse(await apiFetch(`/dewskill-classes/students/search${qs(params)}`)),
  listAccess: async (params = {}) =>
    parse(await apiFetch(`/dewskill-classes/access${qs(params)}`)),
  grantAccess: async (body) =>
    parse(
      await apiFetch('/dewskill-classes/access/grant', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    ),
  updateAccess: async (accessId, body) =>
    parse(
      await apiFetch(`/dewskill-classes/access/${accessId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    ),
  revokeAccess: async (accessId) =>
    parse(await apiFetch(`/dewskill-classes/access/${accessId}`, { method: 'DELETE' })),
  myVisible: async () => parse(await apiFetch('/dewskill-classes/my-visible')),
  myPurchaseHistory: async () => parse(await apiFetch('/dewskill-classes/my/purchase-history')),
  checkoutClass: async (classId) =>
    parse(
      await apiFetch('/dewskill-classes/my/checkout', {
        method: 'POST',
        body: JSON.stringify({ classId }),
      })
    ),
  redeemClassCode: async (classId, code) =>
    parse(
      await apiFetch('/dewskill-classes/my/redeem-code', {
        method: 'POST',
        body: JSON.stringify({ classId, code }),
      })
    ),
  getPaymentSession: async (sessionId) =>
    parse(await apiFetch(`/dewskill-classes/my/payment-sessions/${encodeURIComponent(sessionId)}`)),
  simulateClassPaid: async (sessionId) =>
    parse(
      await apiFetch(`/dewskill-classes/my/payment-sessions/${encodeURIComponent(sessionId)}/simulate-paid`, {
        method: 'POST',
        body: '{}',
      })
    ),
  getCatalogUi: async () => parse(await apiFetch('/dewskill-classes/catalog-ui')),
  updateCatalogUi: async (body) =>
    parse(
      await apiFetch('/dewskill-classes/catalog-ui', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    ),
  resetCatalogUi: async () =>
    parse(
      await apiFetch('/dewskill-classes/catalog-ui/reset', {
        method: 'POST',
        body: '{}',
      })
    ),
  uploadCatalogImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return uploadWithAuth('/dewskill-classes/catalog-ui/upload-image', formData, 'admin');
  },
};

export default dewskillClassApi;
