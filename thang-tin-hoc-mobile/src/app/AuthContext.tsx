import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import { authService } from '../services/mockService';
import { getMobileApiTokens, saveMobileSession } from '../services/apiClient';
import { connect as connectSocket, disconnect as disconnectSocket } from '../services/socketService';
import type { DemoUser, UserRole } from '../types';

type AuthContextValue = {
  user: DemoUser | null;
  isRestoringSession: boolean;
  isSigningIn: boolean;
  authError: string;
  signIn: (role: UserRole, phone: string, password: string) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const connectAuthenticatedSocket = () => {
      if (!user || user.previewMode) {
        disconnectSocket();
        return;
      }
      const token = getMobileApiTokens()?.accessToken;
      if (token) connectSocket(token, user.id, user.role);
    };
    connectAuthenticatedSocket();
    const tokenSubscription = DeviceEventEmitter.addListener('mobile:tokens-updated', connectAuthenticatedSocket);
    return () => {
      tokenSubscription.remove();
      disconnectSocket();
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    const subscription = DeviceEventEmitter.addListener('mobile:session-expired', () => {
      setUser(null);
      setAuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    });
    authService.restore()
      .then((session) => {
        if (active && session) setUser(session.user);
      })
      .catch((error: unknown) => {
        if (active) setAuthError(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.');
      })
      .finally(() => {
        if (active) setIsRestoringSession(false);
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isRestoringSession,
    isSigningIn,
    authError,
    async signIn(role, phone, password) {
      setIsSigningIn(true);
      setAuthError('');
      try {
        const session = await authService.signIn(role, phone, password);
        setUser(session.user);
      } finally {
        setIsSigningIn(false);
      }
    },
    async updateAvatar(avatar) {
      if (!user || !avatar) throw new Error('Không thể cập nhật ảnh đại diện khi chưa đăng nhập.');
      const tokens = getMobileApiTokens();
      if (!tokens) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      const updatedUser = { ...user, avatar };
      await saveMobileSession({ user: updatedUser, tokens });
      setUser(updatedUser);
    },
    async signOut() {
      try {
        await authService.signOut();
      } finally {
        setUser(null);
        setAuthError('');
      }
    },
  }), [user, isRestoringSession, isSigningIn, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
