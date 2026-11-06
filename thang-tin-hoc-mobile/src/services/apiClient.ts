import { DeviceEventEmitter, Platform, type ImageSourcePropType } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type MobileApiTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export type MobileStoredSession<TUser> = {
  tokens: MobileApiTokens;
  user: TUser;
};

export class MobileApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'MobileApiError';
    this.status = status;
    this.code = code;
  }
}

const sessionStorageKey = 'thang-tin-hoc.mobile-session.v1';
const API_REQUEST_TIMEOUT_MS = 20_000;
let tokens: MobileApiTokens | null = null;
let csrfToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

function readWebSession<TUser>() {
  let stored = globalThis.localStorage.getItem(sessionStorageKey);
  if (!stored) {
    stored = globalThis.sessionStorage.getItem(sessionStorageKey);
    if (stored) {
      globalThis.localStorage.setItem(sessionStorageKey, stored);
      globalThis.sessionStorage.removeItem(sessionStorageKey);
    }
  }
  if (!stored) return null;
  const session = JSON.parse(stored) as MobileStoredSession<TUser>;
  if (!session.user || !session.tokens?.accessToken || !session.tokens?.refreshToken || !session.tokens?.sessionId) {
    throw new Error('Dữ liệu phiên đăng nhập trong trình duyệt không hợp lệ.');
  }
  return session;
}

async function persistSessionTokens(nextTokens: MobileApiTokens) {
  if (Platform.OS === 'web') {
    const session = readWebSession<unknown>();
    if (session) globalThis.localStorage.setItem(sessionStorageKey, JSON.stringify({ ...session, tokens: nextTokens }));
    return;
  }
  const stored = await SecureStore.getItemAsync(sessionStorageKey);
  if (!stored) return;
  const session = JSON.parse(stored) as MobileStoredSession<unknown>;
  await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify({ ...session, tokens: nextTokens }));
}

export function getMobileApiBaseUrl() {
  const configuredBaseUrl = String(process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configuredBaseUrl) return configuredBaseUrl;
  if (__DEV__ && Platform.OS === 'web') return 'http://localhost:5000';
  throw new Error('Chưa cấu hình EXPO_PUBLIC_MOBILE_API_BASE_URL cho ứng dụng mobile.');
}

export function resolveMobilePublicUrl(value: string) {
  const path = value.trim();
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, `${getMobileApiBaseUrl()}/`).toString();
}

export function getMobileImageSource(value: string): ImageSourcePropType {
  const raw = String(value || '').trim();
  let imageUrl: URL;
  let apiUrl: URL;
  try {
    apiUrl = new URL(getMobileApiBaseUrl());
    imageUrl = new URL(raw, `${apiUrl.origin}/`);
  } catch {
    return { uri: raw };
  }
  if (!/^https?:$/.test(imageUrl.protocol)) return { uri: raw };
  const accessToken = tokens?.accessToken;
  const isProtectedUpload = imageUrl.origin === apiUrl.origin && imageUrl.pathname.startsWith('/uploads/');

  if (!accessToken || !isProtectedUpload) return { uri: imageUrl.toString() };
  if (Platform.OS === 'web') {
    imageUrl.searchParams.set('access_token', accessToken);
    return { uri: imageUrl.toString() };
  }
  return {
    uri: imageUrl.toString(),
    headers: { Authorization: `Bearer ${accessToken}` },
  };
}

function apiUrl(path: string) {
  const baseUrl = getMobileApiBaseUrl();
  return `${baseUrl}/api${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new MobileApiError('Máy chủ phản hồi quá lâu. Vui lòng thử lại.', 0, 'NETWORK_TIMEOUT');
    }
    if (error instanceof TypeError) {
      throw new MobileApiError(
        'Không thể kết nối máy chủ. Hãy kiểm tra Internet và thử lại.',
        0,
        'NETWORK_UNAVAILABLE',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getSafeApiErrorMessage(status: number, payload: Record<string, unknown>) {
  if (status === 0) return 'Không thể kết nối máy chủ. Hãy kiểm tra Internet và thử lại.';
  if (payload.publicMessage === true && typeof payload.message === 'string' && payload.message) return payload.message;
  if (payload.code === 'SUBSCRIPTION_EXPIRED') return 'Tài khoản đã hết hạn. Vui lòng gia hạn để tiếp tục học.';
  if (status === 400) return 'Yêu cầu chưa hợp lệ. Vui lòng kiểm tra thông tin và thử lại.';
  if (status === 401) return 'Thông tin đăng nhập hoặc phiên làm việc không hợp lệ.';
  if (status === 403) {
    if (payload.code === 'NEEDS_RE_ENROLL') {
      return 'Tài khoản học viên không còn khóa học đang học. Vui lòng liên hệ trung tâm để được hỗ trợ đăng ký khóa mới.';
    }
    if (payload.code === 'MOBILE_ROLE_NOT_ALLOWED') {
      return 'Vai trò đã chọn chưa được hỗ trợ trên ứng dụng mobile.';
    }
    if (payload.code === 'CSRF_INVALID') {
      return 'Phiên bảo mật đã hết hạn. Vui lòng tải lại ứng dụng rồi thử lại.';
    }
    if (payload.message === 'Tài khoản không thể đăng nhập. Vui lòng liên hệ quản trị.') {
      return 'Tài khoản hiện không thể đăng nhập. Vui lòng liên hệ quản trị.';
    }
    return 'Bạn không có quyền thực hiện thao tác này.';
  }
  if (status === 404) return 'Không tìm thấy nội dung yêu cầu.';
  if (status === 409) return 'Dữ liệu vừa thay đổi. Vui lòng tải lại và thử lại.';
  if (status === 422) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.';
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.';
  if (status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

function isMutating(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new MobileApiError('Máy chủ trả về dữ liệu không hợp lệ.', response.status);
    }
  }
  if (!response.ok || payload.success === false) {
    throw new MobileApiError(
      getSafeApiErrorMessage(response.status, payload),
      response.status,
      typeof payload.code === 'string' ? payload.code : undefined,
    );
  }
  return payload;
}

function cookieHeader(token: string) {
  return Platform.OS === 'web' ? undefined : `csrf_token=${token}`;
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetchWithTimeout(apiUrl('/auth/csrf-token'), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const payload = await parseResponse(response);
  const token = typeof payload.csrfToken === 'string' ? payload.csrfToken : '';
  if (!token) throw new Error('Máy chủ không cấp CSRF token cho ứng dụng mobile.');
  csrfToken = token;
  return token;
}

async function rotateTokens() {
  if (!tokens?.refreshToken) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const csrf = await getCsrfToken();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      };
      const cookie = cookieHeader(csrf);
      if (cookie) headers.Cookie = cookie;
      const response = await fetchWithTimeout(apiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ refreshToken: tokens?.refreshToken }),
      });
      const payload = await parseResponse(response);
      if (typeof payload.accessToken !== 'string' || typeof payload.refreshToken !== 'string') {
        throw new Error('Phản hồi làm mới phiên không hợp lệ.');
      }
      tokens = {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : tokens.sessionId,
      };
      DeviceEventEmitter.emit('mobile:tokens-updated');
      await persistSessionTokens(tokens);
    } catch (error) {
      if (error instanceof MobileApiError && [401, 403, 404].includes(error.status)) {
        await clearMobileSession();
        DeviceEventEmitter.emit('mobile:session-expired');
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(
  path: string,
  init: RequestInit,
  withAuth: boolean,
  canRefresh: boolean,
  csrfRetried = false,
): Promise<Record<string, unknown>> {
  const method = init.method || 'GET';
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (withAuth && tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`);

  if (isMutating(method)) {
    const csrf = await getCsrfToken();
    headers.set('X-CSRF-Token', csrf);
    const cookie = cookieHeader(csrf);
    if (cookie) headers.set('Cookie', cookie);
  }

  const response = await fetchWithTimeout(apiUrl(path), {
    ...init,
    method,
    headers,
    credentials: 'include',
  });
  if (response.status === 403 && isMutating(method) && !csrfRetried) {
    let payload: Record<string, unknown> | null = null;
    try {
      payload = await response.clone().json() as Record<string, unknown>;
    } catch {
      payload = null;
    }
    if (payload?.code === 'CSRF_INVALID') {
      csrfToken = null;
      return request(path, init, withAuth, canRefresh, true);
    }
  }
  if (response.status === 401 && withAuth && canRefresh && tokens?.refreshToken) {
    await rotateTokens();
    return request(path, init, withAuth, false, csrfRetried);
  }
  if (response.status === 403) {
    try {
      const payload = await response.clone().json() as Record<string, unknown>;
      if (payload?.code === 'SUBSCRIPTION_EXPIRED') DeviceEventEmitter.emit('mobile:subscription-expired');
    } catch { /* ignore */ }
  }
  return parseResponse(response);
}

export function setMobileApiTokens(value: MobileApiTokens | null) {
  tokens = value;
}

export function getMobileApiTokens() {
  return tokens;
}

export async function saveMobileSession<TUser>(session: MobileStoredSession<TUser>) {
  if (Platform.OS === 'web') {
    globalThis.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    tokens = session.tokens;
    return;
  }
  await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(session));
  tokens = session.tokens;
}

export async function loadMobileSession<TUser>() {
  if (Platform.OS === 'web') {
    const session = readWebSession<TUser>();
    if (session) tokens = session.tokens;
    return session;
  }
  const stored = await SecureStore.getItemAsync(sessionStorageKey);
  if (!stored) return null;
  const session = JSON.parse(stored) as MobileStoredSession<TUser>;
  if (!session.user || !session.tokens?.accessToken || !session.tokens?.refreshToken || !session.tokens?.sessionId) {
    throw new Error('Dữ liệu phiên mobile lưu trên thiết bị không hợp lệ.');
  }
  tokens = session.tokens;
  return session;
}

export async function clearMobileSession() {
  tokens = null;
  csrfToken = null;
  if (Platform.OS === 'web') {
    globalThis.sessionStorage.removeItem(sessionStorageKey);
    globalThis.localStorage.removeItem(sessionStorageKey);
    return;
  }
  await SecureStore.deleteItemAsync(sessionStorageKey);
}

export async function mobileApiRequest<TPayload = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
  withAuth = true,
): Promise<TPayload> {
  return await request(path, init, withAuth, true) as TPayload;
}
