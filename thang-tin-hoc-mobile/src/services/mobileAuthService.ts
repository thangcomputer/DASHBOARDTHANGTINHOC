import { mobileAuthApi, MobileAuthApiError } from './mobileAuthApi';
import { mobileAuthStorage } from './mobileAuthStorage';
import appConfig from '../../app.json';
import type {
  MobileAuthUser,
  MobileLoginResponse,
  MobileRefreshResponse,
  MobileSessionInfo,
  StoredMobileSession,
} from './mobileAuthTypes';
import type { UserRole } from '../types';

export type MobileAuthenticatedRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
};

type MobileAuthDependencies = {
  api?: typeof mobileAuthApi;
  storage?: typeof mobileAuthStorage;
  platform?: string;
  onSessionInvalidated?: () => void;
  onRefreshStateChange?: (refreshing: boolean) => void;
};

function resolvePlatform(platform: string): 'android' | 'ios' {
  if (platform === 'android' || platform === 'ios') return platform;
  if (platform === 'web') {
    const configuredPlatform = process.env.EXPO_PUBLIC_MOBILE_AUTH_PLATFORM;
    if (configuredPlatform === 'android' || configuredPlatform === 'ios') return configuredPlatform;
    throw new MobileAuthApiError(
      'Expo Web QA cần EXPO_PUBLIC_MOBILE_AUTH_PLATFORM=android hoặc ios.',
      0,
      'MOBILE_PLATFORM_REQUIRED',
    );
  }
  throw new MobileAuthApiError('Nền tảng này chưa được hỗ trợ cho Mobile Auth.', 0, 'MOBILE_PLATFORM_UNSUPPORTED');
}

function toAppUser(user: MobileAuthUser) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    code: '',
    course: '',
    branch: '',
    avatarColor: user.role === 'teacher' ? '#E9E5FA' : '#DDF1EB',
  };
}

function isRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'teacher';
}

function isSessionInvalidation(error: unknown) {
  return error instanceof MobileAuthApiError
    && [
      'REFRESH_REPLAY',
      'SESSION_REVOKED',
      'TOKEN_REVOKED',
      'TOKEN_VERSION_MISMATCH',
      'INVALID_SESSION_TOKEN',
      'MOBILE_SESSION_AUTH_DISABLED',
      'USER_NOT_FOUND',
      'ACCOUNT_LOCKED',
      'ACCOUNT_DISABLED',
    ].includes(error.code || '');
}

export function createMobileAuthService({
  api = mobileAuthApi,
  storage = mobileAuthStorage,
  platform = process.env.EXPO_OS || 'web',
  onSessionInvalidated = () => undefined,
  onRefreshStateChange = () => undefined,
}: MobileAuthDependencies = {}) {
  let accessToken: string | null = null;
  let storedSession: StoredMobileSession | null = null;
  let refreshPromise: Promise<StoredMobileSession> | null = null;

  async function clearLocalSession() {
    accessToken = null;
    storedSession = null;
    try {
      await storage.clearAuth();
    } finally {
      onSessionInvalidated();
    }
  }

  async function refreshOnce(session: StoredMobileSession): Promise<StoredMobileSession> {
    try {
      const response = await api.request<MobileRefreshResponse>('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
      });
      if (
        response.success !== true
        || typeof response.accessToken !== 'string'
        || !response.accessToken
        || typeof response.refreshToken !== 'string'
        || !response.refreshToken
        || response.sessionId !== session.sessionId
      ) {
        throw new MobileAuthApiError('Máy chủ trả về phiên xác thực không khớp.', 502, 'INVALID_REFRESH_RESPONSE');
      }
      const rotated: StoredMobileSession = {
        ...session,
        refreshToken: response.refreshToken,
      };

      try {
        await storage.saveAuth(rotated);
      } catch {
        throw new MobileAuthApiError(
          'Không thể lưu phiên mới an toàn; phiên cục bộ đã được xóa.',
          0,
          'SECURE_STORAGE_FAILED',
        );
      }

      storedSession = rotated;
      accessToken = response.accessToken;
      return rotated;
    } catch (error) {
      await clearLocalSession();
      if (error instanceof MobileAuthApiError && isSessionInvalidation(error)) {
        throw new MobileAuthApiError('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.', 401, error.code);
      }
      throw error;
    }
  }

  async function refresh(): Promise<StoredMobileSession> {
    if (refreshPromise) return refreshPromise;
    const session = storedSession || await storage.loadAuth();
    if (!session) {
      await clearLocalSession();
      throw new MobileAuthApiError('Không tìm thấy phiên đăng nhập để làm mới.', 401, 'SESSION_MISSING');
    }

    const pending = refreshOnce(session);
    refreshPromise = pending;
    onRefreshStateChange(true);
    try {
      return await pending;
    } finally {
      if (refreshPromise === pending) refreshPromise = null;
      onRefreshStateChange(false);
    }
  }

  async function restore(): Promise<ReturnType<typeof toAppUser> | null> {
    const session = await storage.loadAuth();
    if (!session) {
      accessToken = null;
      storedSession = null;
      return null;
    }
    storedSession = session;
    try {
      await refresh();
      return toAppUser(session.user);
    } catch {
      return null;
    }
  }

  async function signIn(role: UserRole, identifier: string, password: string) {
    const response = await api.request<MobileLoginResponse>('/api/auth/login/mobile', {
      method: 'POST',
      body: {
        identifier,
        password,
        role,
        platform: resolvePlatform(platform),
        appVersion: appConfig.expo.version,
      },
    });
    const responseUser = response.data?.user;
    const responseData = response.data;
    if (
      response.success !== true
      || typeof responseData?.accessToken !== 'string'
      || !responseData.accessToken
      || typeof responseData.refreshToken !== 'string'
      || !responseData.refreshToken
      || typeof responseData.sessionId !== 'string'
      || !responseData.sessionId
      || typeof responseUser?._id !== 'string'
      || !responseUser._id
      || typeof responseUser.name !== 'string'
      || !responseUser.name
      || !isRole(responseUser.role)
      || (responseUser.phone !== undefined && typeof responseUser.phone !== 'string')
    ) {
      throw new MobileAuthApiError('Máy chủ trả về dữ liệu đăng nhập không hợp lệ.', 502, 'INVALID_LOGIN_RESPONSE');
    }

    const user: MobileAuthUser = {
      id: responseUser._id,
      name: responseUser.name,
      phone: responseUser.phone || identifier,
      role: responseUser.role,
    };
    const session: StoredMobileSession = {
      refreshToken: responseData.refreshToken,
      sessionId: responseData.sessionId,
      user,
    };
    try {
      await storage.saveAuth(session);
    } catch {
      try {
        await api.request('/api/auth/logout', {
          method: 'POST',
          body: { refreshToken: session.refreshToken },
          accessToken: responseData.accessToken,
        });
      } finally {
        await clearLocalSession();
      }
      throw new MobileAuthApiError(
        'Không thể lưu phiên đăng nhập an toàn; phiên máy chủ đã được đăng xuất.',
        0,
        'SECURE_STORAGE_FAILED',
      );
    }

    storedSession = session;
    accessToken = responseData.accessToken;
    return toAppUser(user);
  }

  async function authenticatedRequest<T>(
    path: string,
    options: MobileAuthenticatedRequestOptions = {},
  ): Promise<T> {
    if (!accessToken) {
      throw new MobileAuthApiError('Cần đăng nhập để tiếp tục.', 401, 'AUTH_REQUIRED');
    }
    try {
      return await api.request<T>(path, { ...options, accessToken });
    } catch (error) {
      if (error instanceof MobileAuthApiError && error.code === 'TOKEN_EXPIRED') {
        await refresh();
        if (!accessToken) throw new MobileAuthApiError('Phiên đăng nhập đã hết hạn.', 401, 'SESSION_REVOKED');
        return api.request<T>(path, { ...options, accessToken });
      }
      if (isSessionInvalidation(error)) {
        await clearLocalSession();
      }
      throw error;
    }
  }

  async function signOut(): Promise<void> {
    const session = storedSession;
    const currentAccessToken = accessToken;
    let logoutError: unknown;
    try {
      if (session) {
        await api.request('/api/auth/logout', {
          method: 'POST',
          body: { refreshToken: session.refreshToken },
          ...(currentAccessToken ? { accessToken: currentAccessToken } : {}),
        });
      }
    } catch (error) {
      logoutError = error;
    }
    await clearLocalSession();
    if (logoutError) throw logoutError;
  }

  return {
    async signIn(role: UserRole, identifier: string, password: string) {
      return signIn(role, identifier, password);
    },
    request<T>(path: string, options: MobileAuthenticatedRequestOptions = {}) {
      return authenticatedRequest<T>(path, options);
    },
    restore,
    signOut,
    async getSessions() {
      const response = await authenticatedRequest<{ success: true; data: MobileSessionInfo[] }>('/api/auth/sessions');
      return response.data;
    },
    async revokeSession(sessionId: string) {
      return authenticatedRequest<{ success: true }>(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
    },
    getSessionId() {
      return storedSession?.sessionId || null;
    },
    getStoredSession() {
      return storedSession;
    },
  };
}
