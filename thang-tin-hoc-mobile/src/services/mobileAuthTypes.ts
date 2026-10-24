import type { UserRole } from '../types';

export type MobileAuthUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
};

export type StoredMobileSession = {
  refreshToken: string;
  sessionId: string;
  user: MobileAuthUser;
};

export type MobileLoginResponse = {
  success?: unknown;
  data?: {
    user: {
      _id?: unknown;
      name?: unknown;
      phone?: unknown;
      role?: unknown;
    };
    accessToken?: unknown;
    refreshToken?: unknown;
    sessionId?: unknown;
  };
};

export type MobileRefreshResponse = {
  success?: unknown;
  accessToken?: unknown;
  refreshToken?: unknown;
  sessionId?: unknown;
};

export type MobileSessionInfo = {
  sessionId: string;
  clientType: string;
  platform: string;
  deviceLabel: string;
  appVersion: string;
  createdAt: string;
  lastUsedAt: string;
  absoluteExpiresAt: string;
  status: 'active' | 'revoked' | 'expired';
};
