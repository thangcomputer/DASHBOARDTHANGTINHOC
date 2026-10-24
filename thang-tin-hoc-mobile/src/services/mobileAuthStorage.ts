import type { StoredMobileSession } from './mobileAuthTypes';

const SESSION_KEY = 'mobile-auth-session-v1';

type SecureStoreAdapter = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

type MobileAuthStorageOptions = {
  isWebRuntime?: () => boolean;
  loadSecureStore?: () => Promise<SecureStoreAdapter>;
};

function detectWebRuntime() {
  return typeof document !== 'undefined';
}

function isStoredMobileSession(value: unknown): value is StoredMobileSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<StoredMobileSession>;
  const user = session.user;
  return typeof session.refreshToken === 'string'
    && session.refreshToken.length > 0
    && typeof session.sessionId === 'string'
    && session.sessionId.length > 0
    && !!user
    && typeof user.id === 'string'
    && typeof user.name === 'string'
    && typeof user.phone === 'string'
    && (user.role === 'student' || user.role === 'teacher');
}

export function createMobileAuthStorage({
  isWebRuntime: isWeb = detectWebRuntime,
  loadSecureStore = async () => import('expo-secure-store'),
}: MobileAuthStorageOptions = {}) {
  let webSession: StoredMobileSession | null = null;

  return {
    async loadAuth(): Promise<StoredMobileSession | null> {
      // SecureStore has no web backend, so Expo Web POC credentials remain memory-only.
      if (isWeb()) return webSession;
      const secureStore = await loadSecureStore();
      const serialized = await secureStore.getItemAsync(SESSION_KEY);
      if (serialized === null) return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        await secureStore.deleteItemAsync(SESSION_KEY);
        return null;
      }

      if (isStoredMobileSession(parsed)) return parsed;
      await secureStore.deleteItemAsync(SESSION_KEY);
      return null;
    },

    async saveAuth(session: StoredMobileSession): Promise<void> {
      if (isWeb()) {
        webSession = session;
        return;
      }
      const secureStore = await loadSecureStore();
      await secureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    },

    async clearAuth(): Promise<void> {
      if (isWeb()) {
        webSession = null;
        return;
      }
      const secureStore = await loadSecureStore();
      await secureStore.deleteItemAsync(SESSION_KEY);
    },
  };
}

export const mobileAuthStorage = createMobileAuthStorage();
