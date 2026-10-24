import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { createMobileAuthService } from '../services/mobileAuthService';
import { authService } from '../services/mockService';
import type { DemoUser, UserRole } from '../types';

export type AuthStatus =
  | 'initializing'
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated'
  | 'refreshing'
  | 'loggingOut'
  | 'error';

export const isMobileAuthPocEnabled = process.env.EXPO_PUBLIC_MOBILE_AUTH_POC === 'true';

type AuthContextValue = {
  user: DemoUser | null;
  status: AuthStatus;
  authMode: 'mock' | 'real';
  isSigningIn: boolean;
  apiRequest: <T>(
    path: string,
    options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
  ) => Promise<T>;
  signIn: (role: UserRole, phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isMobileAuthPocEnabled ? 'initializing' : 'unauthenticated');
  const userRef = useRef(user);
  userRef.current = user;
  const authServiceRef = useRef<ReturnType<typeof createMobileAuthService> | null>(null);
  if (!authServiceRef.current) {
    authServiceRef.current = createMobileAuthService({
      platform: Platform.OS,
      onSessionInvalidated: () => {
        userRef.current = null;
        setUser(null);
        setStatus('unauthenticated');
      },
      onRefreshStateChange: (refreshing) => {
        if (userRef.current) setStatus(refreshing ? 'refreshing' : 'authenticated');
      },
    });
  }
  const mobileAuth = authServiceRef.current;
  const apiRequest = React.useCallback(<T,>(
    path: string,
    options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
  ) => mobileAuth.request<T>(path, options), [mobileAuth]);

  React.useEffect(() => {
    if (!isMobileAuthPocEnabled) return undefined;
    let active = true;
    mobileAuth.restore().then((restoredUser) => {
      if (!active) return;
      setUser(restoredUser);
      setStatus(restoredUser ? 'authenticated' : 'unauthenticated');
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setStatus('error');
    });
    return () => {
      active = false;
    };
  }, [mobileAuth]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    authMode: isMobileAuthPocEnabled ? 'real' : 'mock',
    isSigningIn: status === 'authenticating',
    apiRequest,
    async signIn(role, phone, password) {
      setStatus('authenticating');
      try {
        const signedInUser = isMobileAuthPocEnabled
          ? await mobileAuth.signIn(role, phone, password)
          : await authService.signIn(role, phone, password);
        setUser(signedInUser);
        setStatus('authenticated');
      } catch (error) {
        setUser(null);
        setStatus('error');
        throw error;
      }
    },
    async signOut() {
      if (!isMobileAuthPocEnabled) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      setStatus('loggingOut');
      try {
        await mobileAuth.signOut();
      } finally {
        setUser(null);
        setStatus('unauthenticated');
      }
    },
  }), [user, status, apiRequest]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
