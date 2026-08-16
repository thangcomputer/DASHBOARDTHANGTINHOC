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

export function certPrepErrorMessage(err, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
  const status = err?.status;
  if (status === 403) return 'Bạn không có quyền quản lý Ôn thi MOS/IC3.';
  if (status === 401) return err?.message || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
  if (status === 500 || status >= 500) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  return err?.message || fallback;
}

export function certPrepStudentErrorMessage(err, fallback = 'Không thể tải dữ liệu. Vui lòng thử lại.') {
  const status = err?.status;
  if (status === 401) return err?.message || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return err?.message || 'Bạn không có quyền truy cập nội dung này.';
  if (status === 404) return 'Không tìm thấy nội dung.';
  if (status === 409) return err?.message || 'Không thể bắt đầu bài thi.';
  if (status === 410) return err?.message || 'Phiên làm bài đã kết thúc.';
  if (status === 500 || status >= 500) return 'Không thể tải dữ liệu. Vui lòng thử lại.';
  return err?.message || fallback;
}

export function certPrepPlayerErrorMessage(err, fallback = 'Không thể tải phiên làm bài.') {
  const status = err?.status;
  if (status === 403) return 'Bạn không có quyền truy cập phiên làm bài này.';
  if (status === 404) return 'Không tìm thấy phiên làm bài.';
  if (status === 410) return 'Phiên làm bài đã kết thúc.';
  return certPrepStudentErrorMessage(err, fallback);
}

export function certPrepResultErrorMessage(err, fallback = 'Không thể tải kết quả. Vui lòng thử lại.') {
  const status = err?.status;
  if (status === 403) return 'Bạn không có quyền xem kết quả này.';
  if (status === 404) return 'Không tìm thấy phiên làm bài.';
  if (status === 409) return err?.message || 'Bạn chưa nộp bài.';
  if (status === 500 || status >= 500) return 'Không thể tải kết quả. Vui lòng thử lại.';
  return certPrepStudentErrorMessage(err, fallback);
}

export const certPrepApi = {
  courses: {
    list: async () => parse(await apiFetch('/cert-prep/courses')),
    create: async (body) => parse(await apiFetch('/cert-prep/courses', { method: 'POST', body: JSON.stringify(body) })),
    update: async (id, body) => parse(await apiFetch(`/cert-prep/courses/${id}`, { method: 'PUT', body: JSON.stringify(body) })),
    remove: async (id) => parse(await apiFetch(`/cert-prep/courses/${id}`, { method: 'DELETE' })),
    exportQuestions: async (id, filename) => {
      // Client-side export (tránh 500 khi server chưa có package xlsx)
      const { questionToExcelRow, downloadCertPrepQuestionsExcel } = await import('../utils/certPrepQuestionsExcel');
      const levelsRes = await parse(await apiFetch(`/cert-prep/courses/${id}/levels`));
      const levels = Array.isArray(levelsRes.data) ? levelsRes.data : [];
      const rows = [];
      for (const level of levels) {
        const lid = level._id || level.id;
        const testsRes = await parse(await apiFetch(`/cert-prep/levels/${lid}/tests`));
        const tests = Array.isArray(testsRes.data) ? testsRes.data : [];
        for (const test of tests) {
          const tid = test._id || test.id;
          const qsRes = await parse(await apiFetch(`/cert-prep/tests/${tid}/questions`));
          const questions = Array.isArray(qsRes.data) ? qsRes.data : [];
          for (const q of questions) {
            rows.push(questionToExcelRow({
              levelTitle: level.title || '',
              testName: test.name || '',
              question: q,
            }));
          }
        }
      }
      await downloadCertPrepQuestionsExcel(rows, filename || `certprep-questions-${id}.xlsx`);
      return { success: true, data: { questionCount: rows.length } };
    },
    importQuestions: async (id, file, { replace = false } = {}) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('replace', replace ? 'true' : 'false');
      return uploadWithAuth(`/cert-prep/courses/${id}/questions/import`, fd);
    },
  },
  levels: {
    list: async (courseId) => parse(await apiFetch(`/cert-prep/courses/${courseId}/levels`)),
    create: async (courseId, body) => parse(await apiFetch(`/cert-prep/courses/${courseId}/levels`, { method: 'POST', body: JSON.stringify(body) })),
    update: async (id, body) => parse(await apiFetch(`/cert-prep/levels/${id}`, { method: 'PUT', body: JSON.stringify(body) })),
    remove: async (id) => parse(await apiFetch(`/cert-prep/levels/${id}`, { method: 'DELETE' })),
  },
  tests: {
    list: async (levelId) => parse(await apiFetch(`/cert-prep/levels/${levelId}/tests`)),
    create: async (levelId, body) => parse(await apiFetch(`/cert-prep/levels/${levelId}/tests`, { method: 'POST', body: JSON.stringify(body) })),
    update: async (id, body) => parse(await apiFetch(`/cert-prep/tests/${id}`, { method: 'PUT', body: JSON.stringify(body) })),
    remove: async (id) => parse(await apiFetch(`/cert-prep/tests/${id}`, { method: 'DELETE' })),
  },
  questions: {
    list: async (testId, params = {}) => parse(await apiFetch(`/cert-prep/tests/${testId}/questions${qs(params)}`)),
    create: async (testId, body) => parse(await apiFetch(`/cert-prep/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify(body) })),
    update: async (id, body) => parse(await apiFetch(`/cert-prep/questions/${id}`, { method: 'PUT', body: JSON.stringify(body) })),
    remove: async (id, { permanent = true } = {}) => parse(await apiFetch(
      `/cert-prep/questions/${id}${permanent ? '?permanent=1' : ''}`,
      { method: 'DELETE' },
    )),
    removeAllForTest: async (testId, { permanent = true } = {}) => parse(await apiFetch(
      `/cert-prep/tests/${testId}/questions${permanent ? '?permanent=1' : ''}`,
      { method: 'DELETE' },
    )),
    reorder: async (items) => parse(await apiFetch('/cert-prep/questions/reorder', { method: 'PATCH', body: JSON.stringify({ items }) })),
  },
  access: {
    list: async (params = {}) => parse(await apiFetch(`/cert-prep/access${qs(params)}`)),
    grant: async (body) => parse(await apiFetch('/cert-prep/access', { method: 'POST', body: JSON.stringify(body) })),
    disable: async (id) => parse(await apiFetch(`/cert-prep/access/${id}`, { method: 'DELETE' })),
  },
  students: {
    search: async (q) => parse(await apiFetch(`/cert-prep/students${qs({ q })}`)),
  },
  student: {
    getCatalog: async () => parse(await apiFetch('/cert-prep/my-catalog')),
    getTests: async (levelId) => parse(await apiFetch(`/cert-prep/levels/${levelId}/tests`)),
    startSession: async (testId, options = {}) => parse(await apiFetch('/cert-prep/sessions', {
      method: 'POST',
      body: JSON.stringify({
        testId,
        feedbackMode: options.feedbackMode === 'after_submit' ? 'after_submit' : 'immediate',
      }),
    })),
    getSession: async (sessionId) => parse(await apiFetch(`/cert-prep/sessions/${sessionId}`)),
    saveAnswers: async (sessionId, answers) => parse(await apiFetch(`/cert-prep/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ answers }),
    })),
    submitSession: async (sessionId) => parse(await apiFetch(`/cert-prep/sessions/${sessionId}/submit`, {
      method: 'POST',
    })),
    getResult: async (sessionId) => parse(await apiFetch(`/cert-prep/sessions/${sessionId}/result`)),
    getReview: async (sessionId) => parse(await apiFetch(`/cert-prep/sessions/${sessionId}/result`)),
    getAttempts: async (testId) => parse(await apiFetch(`/cert-prep/tests/${testId}/attempts`)),
  },
  enrollmentMappings: {
    list: async () => parse(await apiFetch('/cert-prep/enrollment-mappings')),
    save: async (body) => parse(await apiFetch('/cert-prep/enrollment-mappings', {
      method: 'POST',
      body: JSON.stringify(body),
    })),
    disable: async (id) => parse(await apiFetch(`/cert-prep/enrollment-mappings/${id}`, { method: 'DELETE' })),
    sync: async (body = {}) => parse(await apiFetch('/cert-prep/enrollment-mappings/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    })),
  },
  uploadImage: async (file, relatedId = '') => {
    const fd = new FormData();
    fd.append('file', file);
    if (relatedId) fd.append('relatedId', relatedId);
    return uploadWithAuth('/cert-prep/upload', fd);
  },
};

export default certPrepApi;
