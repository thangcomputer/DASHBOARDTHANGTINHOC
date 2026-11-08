import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import { authService } from '../services/mockService';
import { clearMobileSession, getMobileApiTokens, mobileApiRequest, saveMobileSession } from '../services/apiClient';
import { connect as connectSocket, disconnect as disconnectSocket } from '../services/socketService';
import { registerMobilePushNotifications, unregisterMobilePushNotifications } from '../services/mobilePushNotifications';
import { subscribeToMobileSoundPreference } from '../services/soundPreferences';
import { clearLastActive, pinUserKey } from '../services/pinLock';
import { subscriptionApi, type SubscriptionOverview } from '../services/subscriptionApi';
import type { DemoUser, UserRole } from '../types';

type AuthContextValue = {
  user: DemoUser | null;
  isRestoringSession: boolean;
  isSigningIn: boolean;
  authError: string;
  /** Gói tài khoản HV (null với GV / chưa tải). Hết hạn → RootNavigator chỉ hiện màn gia hạn. */
  subscription: SubscriptionOverview | null;
  refreshSubscription: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
  const [subscription, setSubscription] = useState<SubscriptionOverview | null>(null);
  const userRef = useRef<DemoUser | null>(null);
  userRef.current = user;

  const refreshSubscription = useMemo(() => async () => {
    const current = userRef.current;
    if (!current || current.role !== 'student' || current.previewMode) {
      setSubscription(null);
      return;
    }
    try {
      setSubscription(await subscriptionApi.overview());
    } catch {
      // Lỗi mạng: giữ trạng thái cũ.
    }
  }, []);

  useEffect(() => {
    void refreshSubscription();
    if (!user || user.role !== 'student' || user.previewMode) return undefined;
    const expired = DeviceEventEmitter.addListener('mobile:subscription-expired', () => { void refreshSubscription(); });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshSubscription();
    });
    return () => {
      expired.remove();
      appState.remove();
    };
  }, [user?.id, user?.role, user?.previewMode, refreshSubscription]);

  const refreshUser = useMemo(() => async () => {
    const sessionUser = userRef.current;
    if (!sessionUser || sessionUser.previewMode) return;
    try {
      const me = await mobileApiRequest<{
        data?: {
          status?: string;
          learningAccess?: boolean;
          freePortal?: boolean;
          freeUnlocked?: boolean;
          needsFreeSurvey?: boolean;
          course?: string;
          avatar?: string;
        };
      }>('/auth/me');
      const status = String(me.data?.status || '').toLowerCase();
      const reason = sessionUser.role === 'student' && me.data?.learningAccess === false
        ? 'Bạn không còn khóa học đang học (đã hủy/hoàn phí). Vui lòng đăng ký và thanh toán khóa mới để đăng nhập lại.'
        : sessionUser.role === 'teacher' && ['pending', 'locked'].includes(status)
          ? 'Tài khoản giảng viên chưa được duyệt. Vui lòng hoàn thành bài kiểm tra đầu vào trên máy tính.'
          : '';
      if (reason) {
        await unregisterMobilePushNotifications().catch(() => {});
        await authService.signOut().catch(() => {});
        await clearLastActive(pinUserKey(sessionUser)).catch(() => {});
        disconnectSocket();
        setUser(null);
        setAuthError(reason);
        return;
      }
      if (sessionUser.role === 'student' && me.data) {
        const nextFreePortal = me.data.freePortal === true;
        const nextFreeUnlocked = me.data.freeUnlocked === true;
        const nextNeedsFreeSurvey = me.data.needsFreeSurvey === true;
        const nextCourse = typeof me.data.course === 'string' && me.data.course ? me.data.course : sessionUser.course;
        if (
          sessionUser.freePortal !== nextFreePortal
          || sessionUser.freeUnlocked !== nextFreeUnlocked
          || sessionUser.needsFreeSurvey !== nextNeedsFreeSurvey
          || sessionUser.course !== nextCourse
        ) {
          const updatedUser: DemoUser = {
            ...sessionUser,
            freePortal: nextFreePortal,
            freeUnlocked: nextFreeUnlocked,
            needsFreeSurvey: nextNeedsFreeSurvey,
            course: nextCourse,
          };
          const tokens = getMobileApiTokens();
          if (tokens) {
            await saveMobileSession({ user: updatedUser, tokens }).catch(() => {});
          }
          setUser(updatedUser);
        }
      }
    } catch {
      // Lỗi mạng bỏ qua; phiên hết hạn đã được apiClient phát sự kiện mobile:session-expired.
    }
  }, []);

  useEffect(() => {
    const current = userRef.current;
    if (!current || current.previewMode) return undefined;
    void refreshUser();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUser();
    });
    const freeUnlockedListener = DeviceEventEmitter.addListener('mobile:free-portal-unlocked', () => {
      void refreshUser();
      void refreshSubscription();
    });
    return () => {
      subscription.remove();
      freeUnlockedListener.remove();
    };
  }, [user?.id, user?.role, user?.previewMode, refreshUser, refreshSubscription]);

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
    if (!user || user.previewMode) return undefined;
    const registerPush = () => {
      void registerMobilePushNotifications().catch((error: unknown) => {
        console.warn('Không thể đồng bộ đăng ký thông báo đẩy cho thiết bị.', error);
      });
    };
    registerPush();
    const unsubscribe = subscribeToMobileSoundPreference(registerPush);
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    let active = true;
    let sessionReplaced = false;
    const subscription = DeviceEventEmitter.addListener('mobile:session-expired', () => {
      setUser(null);
      setAuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    });
    const replacedSubscription = DeviceEventEmitter.addListener(
      'mobile:session-replaced',
      async (event?: { token?: string }) => {
        if (!event?.token || getMobileApiTokens()?.accessToken !== event.token) return;
        sessionReplaced = true;
        try {
          await clearMobileSession();
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : 'Không thể xóa phiên đăng nhập đã bị thay thế.');
        }
        disconnectSocket();
        setUser(null);
        setAuthError('Tài khoản đã đăng nhập trên thiết bị khác. Vui lòng đăng nhập lại.');
      },
    );
    authService.restore()
      .then((session) => {
        if (active && !sessionReplaced && session) setUser(session.user);
      })
      .catch((error: unknown) => {
        if (active && !sessionReplaced) setAuthError(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.');
      })
      .finally(() => {
        if (active) setIsRestoringSession(false);
      });
    return () => {
      active = false;
      subscription.remove();
      replacedSubscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isRestoringSession,
    isSigningIn,
    authError,
    subscription,
    refreshSubscription,
    refreshUser,
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
        try {
          await unregisterMobilePushNotifications();
        } catch (error) {
          console.warn('Không thể hủy đăng ký thông báo đẩy trước khi đăng xuất.', error);
        }
        await authService.signOut();
      } finally {
        await clearLastActive(pinUserKey(user)).catch(() => {});
        setUser(null);
        setSubscription(null);
        setAuthError('');
      }
    },
  }), [user, isRestoringSession, isSigningIn, authError, subscription, refreshSubscription, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
