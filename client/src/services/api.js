// ─── API Service - Hệ thống CMS Thắng Tin Học ───────────────────────────────

export const SOCKET_BASE = import.meta.env.VITE_API_URL || '';
export const BASE_URL = SOCKET_BASE;
export const API_BASE = BASE_URL ? (BASE_URL + '/api') : '/api';

/** CSRF double-submit (cookie csrf_token + header X-CSRF-Token) */
let _csrfToken = null;
let _csrfPromise = null;

export async function ensureCsrfToken(force = false) {
  if (_csrfToken && !force) return _csrfToken;
  if (_csrfPromise) return _csrfPromise;
  _csrfPromise = (async () => {
    const res = await fetch(`${API_BASE}/auth/csrf-token`, { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    _csrfToken = body.csrfToken || null;
    return _csrfToken;
  })();
  try {
    return await _csrfPromise;
  } finally {
    _csrfPromise = null;
  }
}

function isMutatingMethod(method) {
  const m = (method || 'GET').toUpperCase();
  return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS';
}

/** fetch kèm credentials + CSRF (dùng cho chỗ còn gọi fetch thô) */
export async function csrfFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (isMutatingMethod(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  return fetch(url, { ...options, credentials: 'include', headers });
}

/** POST FormData (upload) với CSRF + Bearer */
async function uploadWithAuth(path, formData, roleHint = null) {
  const token = roleHint ? getAccessToken(roleHint) : getAccessToken();
  const csrf = await ensureCsrfToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: formData,
  });
  return res.json();
}

/**
 * Xác định Role dựa trên dữ liệu đang có trong LocalStorage hoặc URL.
 */
export const getRolePrefix = (overrideRole = null) => {
  if (overrideRole) return overrideRole;
  if (typeof window === 'undefined') return 'thvp';

  const path = window.location.pathname;
  const roles = ['admin', 'staff', 'teacher', 'student'];

  const pathRole = path.startsWith('/admin') ? 'admin'
    : path.startsWith('/teacher') ? 'teacher'
    : path.startsWith('/student') ? 'student'
    : null;

  const hasToken = (r) => {
    if (localStorage.getItem(`${r}_access_token`)) return true;
    try {
      const u = JSON.parse(localStorage.getItem(`${r}_user`) || 'null');
      return !!(u?.token || u?.accessToken);
    } catch {
      return false;
    }
  };

  // 1. Ưu tiên vai trò khớp URL (tránh dùng token admin cũ khi đang ở /student)
  if (pathRole && hasToken(pathRole)) return pathRole;

  // 2. Fallback: bất kỳ vai trò nào còn token
  for (const r of roles) {
    if (hasToken(r)) return r;
  }

  if (pathRole) return pathRole;
  return 'thvp';
};

/** Chuẩn hóa URL file upload (IP/http cũ → domain hiện tại) */
export const resolveMediaUrl = (url) => {
  if (!url || url === '#') return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;

  const uploadsPath = trimmed.match(/\/uploads\/[^\s?#]+/i);
  if (uploadsPath) return uploadsPath[0];

  if (typeof window === 'undefined') return trimmed;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${window.location.origin}${parsed.pathname}${parsed.search || ''}`;
    }
    if (parsed.hostname === window.location.hostname) {
      return `${window.location.origin}${parsed.pathname}${parsed.search || ''}`;
    }
    return parsed.href;
  } catch {
    return trimmed.includes('/') ? (trimmed.startsWith('/') ? trimmed : `/${trimmed}`) : '';
  }
};

/** URL tải file với tên hiển thị đúng như lúc upload (fileOriginalName) */
export const buildMediaDownloadUrl = (url, displayName) => {
  const base = resolveMediaUrl(url);
  if (!base) return '';
  const name = String(displayName || '').trim();
  if (!name) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}downloadAs=${encodeURIComponent(name)}`;
};

/** Tải file upload — phải đồng bộ trong click handler (không await trước khi mở link) */
export const downloadMediaFile = (url, fileName) => {
  const fullUrl = resolveMediaUrl(url);
  if (!fullUrl) throw new Error('Không có link tải file');

  // Server đã gửi Content-Disposition: attachment — navigate trực tiếp là cách tin cậy nhất
  if (typeof window !== 'undefined') {
    const a = document.createElement('a');
    a.href = fullUrl;
    a.rel = 'noopener noreferrer';
    if (fileName) a.setAttribute('download', fileName);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }
  return false;
};

/**
 * Lấy Access Token từ LocalStorage.
 */
export const getAccessToken = (role = null) => {
  const prefix = getRolePrefix(role);
  const directToken = localStorage.getItem(`${prefix}_access_token`);
  if (directToken) return directToken;

  // Fallback: đọc từ object session user
  try {
    const session = JSON.parse(localStorage.getItem(`${prefix}_user`) || 'null');
    return session?.token || session?.accessToken || null;
  } catch {
    return null;
  }
};

/**
 * Lưu trữ Token một cách tường minh vào LocalStorage.
 */
export const setTokens = (access, refresh, role) => {
  if (!role) return;
  const prefix = role.toLowerCase();
  
  if (access)  localStorage.setItem(`${prefix}_access_token`, access);
  else         localStorage.removeItem(`${prefix}_access_token`);
  
  if (refresh) localStorage.setItem(`${prefix}_refresh_token`, refresh);
  else         localStorage.removeItem(`${prefix}_refresh_token`);
};

/**
 * Xóa sạch thông tin phiên đăng nhập của Role.
 */
export const clearTokens = (role) => {
  if (!role) return;
  const prefix = role.toLowerCase();
  localStorage.removeItem(`${prefix}_access_token`);
  localStorage.removeItem(`${prefix}_refresh_token`);
  localStorage.removeItem(`${prefix}_user`);
};

/** Xóa phiên các vai khác khi đăng nhập (tránh token admin cũ gây 401 trên /student) */
export const clearOtherRoleSessions = (keepRole) => {
  const keep = (keepRole || '').toLowerCase();
  for (const r of ['admin', 'staff', 'teacher', 'student']) {
    if (r !== keep) clearTokens(r);
  }
};

/**
 * Lấy thông tin Refresh Token.
 */
export const getRefreshToken = (role = null) => {
  const prefix = getRolePrefix(role);
  const directToken = localStorage.getItem(`${prefix}_refresh_token`);
  if (directToken) return directToken;
  
  try {
    const session = JSON.parse(localStorage.getItem(`${prefix}_user`) || 'null');
    return session?.refreshToken || null;
  } catch {
    return null;
  }
};

/**
 * Refresh access token bằng refresh token đang lưu (rotate cả refresh token).
 * Gọi đồng thời nhiều request → chia sẻ chung 1 promise để chỉ refresh 1 lần.
 */
let _refreshPromise = null;

const redirectToLogin = (prefix) => {
  if (typeof window === 'undefined') return;
  const target = prefix === 'admin' || prefix === 'staff' ? '/admin/login' : '/login';
  if (window.location.pathname !== target) {
    window.location.href = target;
  }
};

const tryRefreshAccessToken = async () => {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const role = getRolePrefix();
    const refresh = getRefreshToken(role);
    if (!refresh) return null;

    try {
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success || !body.accessToken) return null;

      const nextRefresh = body.refreshToken || refresh;
      setTokens(body.accessToken, nextRefresh, role);

      try {
        const userKey = `${role}_user`;
        const userStr = localStorage.getItem(userKey);
        if (userStr) {
          const user = JSON.parse(userStr);
          user.token = body.accessToken;
          user.accessToken = body.accessToken;
          user.refreshToken = nextRefresh;
          localStorage.setItem(userKey, JSON.stringify(user));
        }
      } catch { /* noop */ }

      return body.accessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await _refreshPromise;
  } finally {
    _refreshPromise = null;
  }
};

const FATAL_AUTH_CODES = new Set([
  'TOKEN_VERSION_MISMATCH',
  'UNAUTHORIZED',
  'TOKEN_REVOKED',
  'REFRESH_REUSE',
  'DEVICE_CONFLICT',
]);

/**
 * CORE FETCH HELPER: Tự động đính kèm Auth Header và xử lý lỗi hệ thống.
 * Tự động refresh token khi nhận 401/TOKEN_EXPIRED và retry 1 lần.
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url     = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const method  = options.method || 'GET';
  const buildHeaders = async (token) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && !options.skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    };
    // Multi-tenant: Super Admin chon tenant trong UI
    try {
      const tenantId = localStorage.getItem('selected_tenant_id');
      if (tenantId && tenantId !== 'all') headers['X-Tenant-Id'] = tenantId;
    } catch { /* ignore */ }
    if (isMutatingMethod(method) && !options.skipCsrf) {
      const csrf = await ensureCsrfToken(!!options._csrfRetried);
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
    return headers;
  };

  const activeToken = getAccessToken();
  let res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: await buildHeaders(activeToken),
  });

  // CSRF hết hạn / chưa có cookie → lấy token mới và thử lại 1 lần
  if (res.status === 403 && isMutatingMethod(method) && !options._csrfRetried) {
    let body = null;
    try { body = await res.clone().json(); } catch { /* noop */ }
    if (body?.code === 'CSRF_INVALID') {
      _csrfToken = null;
      return apiFetch(endpoint, { ...options, _csrfRetried: true });
    }
  }

  if (res.status !== 401 || options.skipAuth || options._retried) {
    return res;
  }

  let errBody = null;
  try {
    errBody = await res.clone().json();
  } catch { /* noop */ }

  const code = errBody?.code;
  if (code && FATAL_AUTH_CODES.has(code)) {
    const prefix = getRolePrefix();
    clearTokens(prefix);
    redirectToLogin(prefix);
    return res;
  }

  // TOKEN_EXPIRED hoặc 401 thường → thử refresh
  const newToken = await tryRefreshAccessToken();
  if (!newToken) {
    const prefix = getRolePrefix();
    clearTokens(prefix);
    redirectToLogin(prefix);
    return res;
  }

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: await buildHeaders(newToken),
    _retried: true,
  });
};

// ─── AUTH API ───────────────────────────────────────────────────────────────
export const authAPI = {
  login: async (identifier, password) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
      skipAuth: true
    });
    return res.json();
  },

  mfaVerify: async (mfaToken, code) => {
    const res = await apiFetch('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code }),
      skipAuth: true,
    });
    return res.json();
  },

  mfaStatus: async () => {
    const res = await apiFetch('/auth/mfa/status');
    return res.json();
  },

  mfaSetup: async () => {
    const res = await apiFetch('/auth/mfa/setup', { method: 'POST' });
    return res.json();
  },

  mfaEnable: async (code) => {
    const res = await apiFetch('/auth/mfa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return res.json();
  },

  mfaDisable: async (password, code) => {
    const res = await apiFetch('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    });
    return res.json();
  },
  
  me: async () => {
    const res = await apiFetch('/auth/me');
    return res.json();
  },

  logout: async () => {
    const role = getRolePrefix();
    const refresh = getRefreshToken(role);
    const res = await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh || undefined }),
    });
    clearTokens(role);
    return res;
  },

  changePassword: async (oldPassword, newPassword) => {
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    return res.json();
  },

  resetPasswordRequest: async (phone, zalo, role) => {
    const res = await apiFetch('/auth/reset-password-request', {
      method: 'POST',
      body: JSON.stringify({ phone, zalo, role }),
      skipAuth: true,
    });
    return res.json();
  },

  adminResetPassword: async (userId, userRole, newPassword) => {
    const res = await apiFetch('/auth/admin/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, userRole, newPassword }),
    });
    return res.json();
  },

  adminGenerateOTP: async (userId, userRole) => {
    const res = await apiFetch('/auth/admin/generate-otp', {
      method: 'POST',
      body: JSON.stringify({ userId, userRole }),
    });
    return res.json();
  },


  adminUpdateProfile: async (data) => {
    const res = await apiFetch('/auth/admin/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

};

// ─── STUDENT API ────────────────────────────────────────────────────────────
export const studentsAPI = {
  getAll: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/students${q ? `?${q}` : ''}`);
    return res.json();
  },
  getById: async (id) => {
    const res = await apiFetch(`/students/${id}`);
    return res.json();
  },
  getFullDetail: async (id) => {
    const res = await apiFetch(`/students/${id}/full-detail`);
    return res.json();
  },
  create: async (student) => {
    const res = await apiFetch('/students', {
      method: 'POST',
      body: JSON.stringify(student),
    });
    return res.json();
  },
  importBulk: async (students) => {
    const res = await apiFetch('/students/import', {
      method: 'POST',
      body: JSON.stringify({ students }),
    });
    return res.json();
  },
  update: async (id, updates) => {
    const res = await apiFetch(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.json();
  },
  remove: async (id) => {
    const res = await apiFetch(`/students/${id}`, { method: 'DELETE' });
    return res.json();
  },
  payTeacher: async (studentId, action) => {
    const res = await apiFetch(`/students/${studentId}/pay-teacher`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    return res.json();
  },
  getStats: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/students/stats${q ? `?${q}` : ''}`);
    return res.json();
  },
  resetTodayAttendance: async (id) => {
    const res = await apiFetch(`/students/${id}/reset-today-attendance`, { method: 'POST' });
    return res.json();
  },
  assignTeacher: async (id, teacherId) => {
    const res = await apiFetch(`/students/${id}/assign-teacher`, {
      method: 'PUT',
      body: JSON.stringify({ teacherId }),
    });
    return res.json();
  },
  pay: async (id, data) => {
    const res = await apiFetch(`/students/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

// ─── TEACHER API ────────────────────────────────────────────────────────────
export const teachersAPI = {
  getAll: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/teachers${q ? `?${q}` : ''}`);
    return res.json();
  },
  getById: async (id) => {
    const res = await apiFetch(`/teachers/${id}`);
    return res.json();
  },
  create: async (teacher) => {
    const res = await apiFetch('/teachers', {
      method: 'POST',
      body: JSON.stringify(teacher),
    });
    return res.json();
  },
  getPendingSessions: async (id) => {
    const res = await apiFetch(`/teachers/${id}/finance/pending`);
    return res.json();
  },
  payFlexible: async (teacherId, sessionsCount, amount, note) => {
    const res = await apiFetch(`/teachers/${teacherId}/finance/pay-flexible`, {
      method: 'PUT',
      body: JSON.stringify({ sessionsCount, amount, note }),
    });
    return res.json();
  },
  update: async (id, updates) => {
    const res = await apiFetch(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.json();
  },
  remove: async (id) => {
    const res = await apiFetch(`/teachers/${id}`, { method: 'DELETE' });
    return res.json();
  },
  getFinance: async (teacherId) => {
    const res = await apiFetch(`/teachers/${teacherId}/finance`);
    return res.json();
  },
  approve: async (id) => {
    const res = await apiFetch(`/teachers/${id}/approve`, { method: 'POST' });
    return res.json();
  },
  uploadPractical: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithAuth('/teachers/upload-practical', formData, getAccessToken('teacher') ? 'teacher' : 'admin');
  },
};

// ─── FINANCE / INVOICES API ─────────────────────────────────────────────────
export const invoicesAPI = {
  getAll: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/invoices${q ? `?${q}` : ''}`);
    return res.json();
  },
  getStats: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/invoices/stats${q ? `?${q}` : ''}`);
    return res.json();
  },
};

export const transactionsAPI = {
  getAll: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/transactions${q ? `?${q}` : ''}`);
    return res.json();
  },
  getByTeacher: async (teacherId) => {
    const res = await apiFetch(`/transactions/teacher/${teacherId}`);
    return res.json();
  },
  create: async (data) => {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  confirm: async (id, status) => {
    const res = await apiFetch(`/transactions/${id}/confirm`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return res.json();
  },
};

export const staffAPI = {
  getAll: async () => {
    const res = await apiFetch('/staff');
    return res.json();
  },
  create: async (data) => {
    const res = await apiFetch('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  update: async (id, data) => {
    const res = await apiFetch(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  remove: async (id) => {
    const res = await apiFetch(`/staff/${id}`, { method: 'DELETE' });
    return res.json();
  },
};

// ─── MESSAGE API ────────────────────────────────────────────────────────────
export const messagesAPI = {
  getContacts: async () => {
    const res = await apiFetch('/messages/contacts');
    return res.json();
  },
  getHiddenConversations: async () => {
    const res = await apiFetch('/messages/hidden');
    return res.json();
  },
  hideConversation: async (conversationId) => {
    const res = await apiFetch(`/messages/hide/${conversationId}`, { method: 'POST' });
    return res.json();
  },
  getGroups: async (userId) => {
    // Nếu có userId thì gọi route đúng, nếu không thì fallback về /groups
    const url = userId ? `/messages/groups/user/${userId}` : '/messages/groups';
    const res = await apiFetch(url);
    return res.json();
  },
  getHistory: async (groupId) => {
    const res = await apiFetch(`/messages/history/${groupId}`);
    return res.json();
  },
  send: async (data) => {
    const res = await apiFetch('/messages', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.json();
  },
  uploadMessageFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithAuth('/messages/upload', formData);
  },
  syncByUser: async (userId) => {
    const res = await apiFetch(`/messages/sync/${userId}`);
    return res.json();
  },
  toggleReaction: async (messageId, type) => {
    const res = await apiFetch(`/messages/${messageId}/reaction`, {
      method: 'PATCH',
      body: JSON.stringify({ type })
    });
    return res.json();
  },
  recall: async (messageId) => {
    const res = await apiFetch(`/messages/${messageId}/recall`, { method: 'PATCH' });
    return res.json();
  },
  softDelete: async (messageId) => {
    const res = await apiFetch(`/messages/${messageId}/soft-delete`, { method: 'PATCH' });
    return res.json();
  },
  createGroup: async (name, participants) => {
    const res = await apiFetch('/messages/groups', {
      method: 'POST',
      body: JSON.stringify({ name, participants })
    });
    return res.json();
  },
  deleteGroup: async (groupId) => {
    const res = await apiFetch(`/messages/groups/${groupId}`, { method: 'DELETE' });
    return res.json();
  },

  markRead: async (conversationId) => {
    const res = await apiFetch(`/messages/read/${conversationId}`, { method: 'PUT' });
    return res.json();
  },
  broadcast: async (targetRole, content, extra = {}) => {
    const res = await apiFetch('/messages/broadcast', {
      method: 'POST',
      body: JSON.stringify({ targetRole, content, ...extra })
    });
    return res.json();
  }
};


// ─── SCHEDULE API ───────────────────────────────────────────────────────────
export const schedulesAPI = {
  getAll: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/schedules${q ? `?${q}` : ''}`);
    return res.json();
  },
  getStats: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/schedules/stats${q ? `?${q}` : ''}`);
    return res.json();
  },
  getByTeacher: async (teacherId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiFetch(`/schedules/teacher/${teacherId}${q ? `?${q}` : ''}`);
    return res.json();
  },
  getByStudent: async (studentId) => {
    const res = await apiFetch(`/schedules/student/${studentId}`);
    return res.json();
  },
  create: async (data) => {
    const res = await apiFetch('/schedules', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.json();
  },
  update: async (id, data) => {
    const res = await apiFetch(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.json();
  },
  remove: async (id) => {
    const res = await apiFetch(`/schedules/${id}`, { method: 'DELETE' });
    return res.json();
  }
};

// ─── EVALUATION API ─────────────────────────────────────────────────────────
export const evaluationsAPI = {
  getPrivate: async () => {
    const res = await apiFetch('/evaluations/admin');
    return res.json();
  },
  getByTeacher: async (teacherId) => {
    const res = await apiFetch(`/evaluations/teacher/${encodeURIComponent(teacherId)}`);
    return res.json();
  },
  submit: async (data) => {
    const res = await apiFetch('/evaluations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  markRead: async (id) => {
    const res = await apiFetch(`/evaluations/${id}/read`, { method: 'POST' });
    return res.json();
  },
};

// ─── ASSIGNMENT API ─────────────────────────────────────────────────────────
export const assignmentsAPI = {
  getByCourse: async (courseId) => {
    const res = await apiFetch(`/assignments/course/${encodeURIComponent(courseId)}`);
    return res.json();
  },
  getByStudentAndCourse: async (studentId, courseId) => {
    const res = await apiFetch(`/assignments/student/${encodeURIComponent(studentId)}/course/${encodeURIComponent(courseId)}`);
    return res.json();
  },
  create: async (data) => {
    const res = await apiFetch(`/assignments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  update: async (assignmentId, data) => {
    const res = await apiFetch(`/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (assignmentId) => {
    const res = await apiFetch(`/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
    return res.json();
  },
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithAuth('/assignments/upload', formData);
  },
  submit: async (assignmentId, data) => {
    const res = await apiFetch(`/assignments/${assignmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  grade: async (submissionId, data) => {
    const res = await apiFetch(`/assignments/submissions/${submissionId}/grade`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

// ─── EXAM RESULTS API ───────────────────────────────────────────────────────
export const examResultsAPI = {
  getAll: async (type = '') => {
    const q = type ? `?type=${type}` : '';
    const res = await apiFetch(`/exam-results${q}`);
    const data = await res.json();
    return data.data || [];
  },
  create: async (data) => {
    const res = await apiFetch('/exam-results', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  update: async (id, data) => {
    const res = await apiFetch(`/exam-results/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  remove: async (id) => {
    const res = await apiFetch(`/exam-results/${id}`, { method: 'DELETE' });
    return res.json();
  },
};

// ─── SETTINGS API ───────────────────────────────────────────────────────────
export const settingsAPI = {
  getAll: async () => {
    const res = await apiFetch('/settings');
    return res.json();
  },
  update: async (data) => {
    const res = await apiFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  resetData: async (data) => {
    const res = await apiFetch('/settings/reset-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  uploadLogo: async (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return uploadWithAuth('/settings/upload-logo', fd);
  },
  uploadPopupImage: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return uploadWithAuth('/settings/upload-popup-image', fd);
  },
  uploadInvoiceSignature: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return uploadWithAuth('/settings/upload-invoice-signature', fd);
  },
  uploadInvoiceLogo: async (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return uploadWithAuth('/settings/upload-invoice-logo', fd);
  },
  getPopup: async () => {
    const res = await apiFetch('/settings/popup');
    return res.json();
  },
  getTrainingData: async () => {
    const res = await apiFetch('/settings/training-data');
    return res.json();
  },
  updateTrainingData: async (trainingData) => {
    const res = await apiFetch('/settings/training-data', {
      method: 'PUT',
      body: JSON.stringify({ trainingData }),
    });
    return res.json();
  },
  getStudentTrainingData: async () => {
    const res = await apiFetch('/settings/student-training-data');
    return res.json();
  },
  updateStudentTrainingData: async (studentTrainingData) => {
    const res = await apiFetch('/settings/student-training-data', {
      method: 'PUT',
      body: JSON.stringify({ studentTrainingData }),
    });
    return res.json();
  },
  getTeacherExamConfig: async () => {
    const res = await apiFetch('/settings/teacher-exam-config');
    return res.json();
  },
  updateTeacherExamConfig: async (payload) => {
    const res = await apiFetch('/settings/teacher-exam-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  getStudentExamConfig: async () => {
    const res = await apiFetch('/settings/student-exam-config');
    return res.json();
  },
  updateStudentExamConfig: async (payload) => {
    const res = await apiFetch('/settings/student-exam-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  uploadTrainingFile: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadWithAuth('/settings/upload-training-file', fd);
  },
};


// ─── SYSTEM LOGS API ────────────────────────────────────────────────────────
export const systemLogsAPI = {
  getAll: async (page = 1, limit = 50) => {
    const res = await apiFetch(`/system-logs?page=${page}&limit=${limit}`);
    return res.json();
  },
};

// ─── NOTIFICATIONS API (Notification Center) ────────────────────────────────
// ─── TENANTS API (Multi-tenant, Super Admin) ────────────────────────────────
export const tenantsAPI = {
  list: async (status = 'all') => {
    const q = status !== 'all' ? `?status=${status}` : '';
    const res = await apiFetch(`/tenants${q}`);
    return res.json();
  },
  get: async (id) => {
    const res = await apiFetch(`/tenants/${id}`);
    return res.json();
  },
  stats: async (id) => {
    const res = await apiFetch(`/tenants/${id}/stats`);
    return res.json();
  },
  create: async (payload) => {
    const res = await apiFetch('/tenants', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
  update: async (id, payload) => {
    const res = await apiFetch(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return res.json();
  },
  assignBranch: async (tenantId, branchId) => {
    const res = await apiFetch(`/tenants/${tenantId}/branches`, {
      method: 'POST',
      body: JSON.stringify({ branchId }),
    });
    return res.json();
  },
  listBranchesMeta: async () => {
    const res = await apiFetch('/tenants/meta/branches');
    return res.json();
  },
};

// ─── FORM / REPORT BUILDER API ──────────────────────────────────────────────
export const builderAPI = {
  listForms: async (status = 'all') => {
    const q = status && status !== 'all' ? `?status=${status}` : '';
    const res = await apiFetch(`/builder/forms${q}`);
    return res.json();
  },
  getForm: async (idOrSlug) => {
    const res = await apiFetch(`/builder/forms/${idOrSlug}`);
    return res.json();
  },
  createForm: async (payload) => {
    const res = await apiFetch('/builder/forms', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
  updateForm: async (id, payload) => {
    const res = await apiFetch(`/builder/forms/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return res.json();
  },
  deleteForm: async (id) => {
    const res = await apiFetch(`/builder/forms/${id}`, { method: 'DELETE' });
    return res.json();
  },
  listSubmissions: async (formId, page = 1) => {
    const res = await apiFetch(`/builder/forms/${formId}/submissions?page=${page}`);
    return res.json();
  },
  exportSubmissions: async (formId, slug = 'form') => {
    const res = await apiFetch(`/builder/forms/${formId}/submissions/export`);
    if (!res.ok) throw new Error('Export thất bại');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-${slug}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  listReportSources: async () => {
    const res = await apiFetch('/builder/reports/sources');
    return res.json();
  },
  listReports: async () => {
    const res = await apiFetch('/builder/reports');
    return res.json();
  },
  createReport: async (payload) => {
    const res = await apiFetch('/builder/reports', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
  updateReport: async (id, payload) => {
    const res = await apiFetch(`/builder/reports/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return res.json();
  },
  deleteReport: async (id) => {
    const res = await apiFetch(`/builder/reports/${id}`, { method: 'DELETE' });
    return res.json();
  },
  runReport: async (id) => {
    const res = await apiFetch(`/builder/reports/${id}/run`);
    return res.json();
  },
  exportReport: async (id, name = 'report') => {
    const res = await apiFetch(`/builder/reports/${id}/export`);
    if (!res.ok) throw new Error('Export thất bại');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${name}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ─── WORKFLOWS API ──────────────────────────────────────────────────────────
export const workflowsAPI = {
  definitions: async () => {
    const res = await apiFetch('/workflows/definitions');
    return res.json();
  },
  list: async ({ status = 'open', definitionKey, sync = true, page = 1 } = {}) => {
    const q = new URLSearchParams({ status, page: String(page) });
    if (definitionKey) q.set('definitionKey', definitionKey);
    if (sync) q.set('sync', '1');
    const res = await apiFetch(`/workflows?${q}`);
    return res.json();
  },
  get: async (id) => {
    const res = await apiFetch(`/workflows/${id}`);
    return res.json();
  },
  start: async (payload) => {
    const res = await apiFetch('/workflows', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
  advance: async (id, { action, note }) => {
    const res = await apiFetch(`/workflows/${id}/advance`, {
      method: 'POST',
      body: JSON.stringify({ action, note }),
    });
    return res.json();
  },
  sync: async () => {
    const res = await apiFetch('/workflows/sync', { method: 'POST' });
    return res.json();
  },
};

// ─── BI API ─────────────────────────────────────────────────────────────────
export const biAPI = {
  overview: async ({ period = '1m', branchId = 'all' } = {}) => {
    const q = new URLSearchParams({ period, branchId });
    const res = await apiFetch(`/bi/overview?${q}`);
    return res.json();
  },
  exportCsv: async ({ period = '1m', branchId = 'all' } = {}) => {
    const q = new URLSearchParams({ period, branchId });
    const res = await apiFetch(`/bi/export?${q}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || 'Export thất bại');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bi-overview-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ─── AI API (Admin) ─────────────────────────────────────────────────────────
export const aiAPI = {
  status: async () => {
    const res = await apiFetch('/ai/status');
    return res.json();
  },
  quiz: async (payload) => {
    const res = await apiFetch('/ai/quiz', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
  notificationDraft: async (payload) => {
    const res = await apiFetch('/ai/notification-draft', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
  summarize: async (payload) => {
    const res = await apiFetch('/ai/summarize', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
  complete: async (payload) => {
    const res = await apiFetch('/ai/complete', { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
  },
};

// ─── MONITORING API ─────────────────────────────────────────────────────────
export const monitoringAPI = {
  overview: async () => {
    const res = await apiFetch('/monitoring/overview');
    return res.json();
  },
  health: async () => {
    const res = await apiFetch('/monitoring/health');
    return res.json();
  },
  metrics: async () => {
    const res = await apiFetch('/monitoring/metrics');
    return res.json();
  },
  resetMetrics: async () => {
    const res = await apiFetch('/monitoring/metrics/reset', { method: 'POST' });
    return res.json();
  },
};

// ─── BACKUPS API (Super Admin) ──────────────────────────────────────────────
export const backupsAPI = {
  list: async ({ page = 1, limit = 20 } = {}) => {
    const res = await apiFetch(`/backups?page=${page}&limit=${limit}`);
    return res.json();
  },
  stats: async () => {
    const res = await apiFetch('/backups/stats');
    return res.json();
  },
  create: async () => {
    const res = await apiFetch('/backups', { method: 'POST' });
    return res.json();
  },
  remove: async (id) => {
    const res = await apiFetch(`/backups/${id}`, { method: 'DELETE' });
    return res.json();
  },
  download: async (id, filename = 'backup.json.gz') => {
    const res = await apiFetch(`/backups/${id}/download`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || 'Tải backup thất bại');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ─── FILES API (File Center) ────────────────────────────────────────────────
export const filesAPI = {
  list: async ({ page = 1, limit = 20, category, status = 'active', q } = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    const res = await apiFetch(`/files?${params}`);
    return res.json();
  },
  stats: async () => {
    const res = await apiFetch('/files/stats');
    return res.json();
  },
  categories: async () => {
    const res = await apiFetch('/files/categories');
    return res.json();
  },
  upload: async (file, category = 'general') => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await uploadWithAuth(`/files/upload?category=${encodeURIComponent(category)}`, fd);
    return res;
  },
  remove: async (id) => {
    const res = await apiFetch(`/files/${id}`, { method: 'DELETE' });
    return res.json();
  },
  purgeExpired: async () => {
    const res = await apiFetch('/files/purge-expired', { method: 'POST' });
    return res.json();
  },
};

export const notificationsAPI = {
  list: async ({ page = 1, limit = 20, type, unreadOnly } = {}) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) q.set('type', type);
    if (unreadOnly) q.set('unreadOnly', '1');
    const res = await apiFetch(`/notifications?${q}`);
    return res.json();
  },
  count: async () => {
    const res = await apiFetch('/notifications/count');
    return res.json();
  },
  markRead: async (notificationId) => {
    const res = await apiFetch('/notifications/mark-read', {
      method: 'PUT',
      body: JSON.stringify(notificationId ? { notificationId } : { markAll: true }),
    });
    return res.json();
  },
  dismiss: async (id) => {
    const res = await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
    return res.json();
  },
  broadcast: async (payload) => {
    const res = await apiFetch('/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};

export default {
  auth:         authAPI,
  students:     studentsAPI,
  teachers:     teachersAPI,
  invoices:     invoicesAPI,
  transactions: transactionsAPI,
  messages:     messagesAPI,
  schedules:    schedulesAPI,
  evaluations:  evaluationsAPI,
  assignments:  assignmentsAPI,
  examResults:  examResultsAPI,
  settings:     settingsAPI,
  systemLogs:   systemLogsAPI,
  staff:        staffAPI,
  notifications: notificationsAPI,
  files:         filesAPI,
  backups:       backupsAPI,
  monitoring:    monitoringAPI,
  ai:            aiAPI,
  bi:            biAPI,
  workflows:     workflowsAPI,
  builder:       builderAPI,
  tenants:       tenantsAPI,
};
