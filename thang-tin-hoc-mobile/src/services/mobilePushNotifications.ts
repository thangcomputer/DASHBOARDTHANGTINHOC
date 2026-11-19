import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { getMobileApiTokens, mobileApiRequest } from './apiClient';
import { getMobileSoundEnabled } from './soundPreferences';

function getNotificationsModule(): typeof NotificationsType | null {
  if (Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof NotificationsType;
}

const nativeNotifications = getNotificationsModule();
if (nativeNotifications) {
  nativeNotifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const appIsActive = AppState.currentState === 'active';
      const isIncomingCall = notification.request.content.data?.event === 'call:incoming';
      return {
        shouldShowBanner: !appIsActive || !isIncomingCall,
        shouldShowList: !appIsActive || !isIncomingCall,
        shouldPlaySound: !appIsActive,
        shouldSetBadge: false,
      };
    },
  });
}

let registeredExpoPushToken = '';
let registeredSessionKey = '';

function getProjectId() {
  return Constants.easConfig?.projectId
    || Constants.expoConfig?.extra?.eas?.projectId
    || process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || '';
}

export type MobilePushCategory = 'schedule' | 'message' | 'promo' | 'default' | 'calls';

export const MOBILE_NOTIFICATION_ACTIONS = {
  OPEN_SCHEDULE: 'OPEN_SCHEDULE',
  JOIN_MEET: 'JOIN_MEET',
  OPEN_MESSAGE: 'OPEN_MESSAGE',
  OPEN_PROMO: 'OPEN_PROMO',
} as const;

async function configureNotificationCategories() {
  if (Platform.OS === 'web' || !nativeNotifications) return;
  try {
    await Promise.all([
      nativeNotifications.setNotificationCategoryAsync('schedule', [
        {
          identifier: MOBILE_NOTIFICATION_ACTIONS.JOIN_MEET,
          buttonTitle: 'Vào Meet ngay',
          options: { opensAppToForeground: true },
        },
        {
          identifier: MOBILE_NOTIFICATION_ACTIONS.OPEN_SCHEDULE,
          buttonTitle: 'Xem lịch học',
          options: { opensAppToForeground: true },
        },
      ]),
      nativeNotifications.setNotificationCategoryAsync('message', [
        {
          identifier: MOBILE_NOTIFICATION_ACTIONS.OPEN_MESSAGE,
          buttonTitle: 'Trả lời ngay',
          options: { opensAppToForeground: true },
        },
      ]),
      nativeNotifications.setNotificationCategoryAsync('promo', [
        {
          identifier: MOBILE_NOTIFICATION_ACTIONS.OPEN_PROMO,
          buttonTitle: 'Xem ưu đãi',
          options: { opensAppToForeground: true },
        },
      ]),
    ]);
  } catch (error) {
    console.warn('Không thể đăng ký nút hành động nhanh cho thông báo đẩy.', error);
  }
}

async function configureAndroidChannels() {
  if (Platform.OS !== 'android' || !nativeNotifications) return;
  await nativeNotifications.setNotificationChannelAsync('default', {
    name: 'Thông báo chung',
    importance: nativeNotifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
  await nativeNotifications.setNotificationChannelAsync('schedule', {
    name: 'Lịch học & Lớp Meet',
    importance: nativeNotifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 300, 150, 300],
  });
  await nativeNotifications.setNotificationChannelAsync('message', {
    name: 'Tin nhắn & Trao đổi',
    importance: nativeNotifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 220, 120, 220],
  });
  await nativeNotifications.setNotificationChannelAsync('promo', {
    name: 'Khuyến mãi & Sự kiện',
    importance: nativeNotifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
  await nativeNotifications.setNotificationChannelAsync('silent', {
    name: 'Thông báo (không âm thanh)',
    importance: nativeNotifications.AndroidImportance.HIGH,
    sound: null,
    vibrationPattern: [0, 250, 250, 250],
  });
  await nativeNotifications.setNotificationChannelAsync('calls', {
    name: 'Cuộc gọi đến',
    importance: nativeNotifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400, 200, 700],
    lockscreenVisibility: nativeNotifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function registerMobilePushNotifications(requestPermission = false) {
  if (Platform.OS === 'web' || !nativeNotifications) return false;
  const projectId = getProjectId();
  if (!projectId) {
    if (requestPermission) {
      throw new Error('Chưa cấu hình EAS Project ID cho thông báo đẩy.');
    }
    return false;
  }

  await configureAndroidChannels();
  await configureNotificationCategories();
  let permission = await nativeNotifications.getPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission) {
    permission = await nativeNotifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return false;

  const tokens = getMobileApiTokens();
  if (!tokens?.sessionId) return false;
  const pushToken = (await nativeNotifications.getExpoPushTokenAsync({ projectId })).data;
  const soundEnabled = await getMobileSoundEnabled();
  const sessionKey = `${tokens.sessionId}:${pushToken}:${soundEnabled}`;
  if (sessionKey === registeredSessionKey) return true;

  await mobileApiRequest('/mobile-push-tokens', {
    method: 'POST',
    body: JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
      projectId,
      soundEnabled,
    }),
  });
  registeredExpoPushToken = pushToken;
  registeredSessionKey = sessionKey;
  return true;
}

export async function enableMobilePushNotifications() {
  return registerMobilePushNotifications(true);
}

export async function requestWebNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Trình duyệt này không hỗ trợ thông báo. Hãy thử bằng trình duyệt mới hơn.');
  }
  if (!window.isSecureContext) {
    throw new Error('Thông báo trên web chỉ hoạt động qua HTTPS hoặc localhost.');
  }
  return window.Notification.requestPermission();
}

export type MobileNotificationResponse = NotificationsType.NotificationResponse;

export function addMobileNotificationReceivedListener(
  listener: (notification: NotificationsType.Notification) => void,
): { remove: () => void } | null {
  if (Platform.OS === 'web' || !nativeNotifications) return null;
  return nativeNotifications.addNotificationReceivedListener(listener);
}

export function addMobileNotificationResponseReceivedListener(
  listener: (response: NotificationsType.NotificationResponse) => void,
): { remove: () => void } | null {
  if (Platform.OS === 'web' || !nativeNotifications) return null;
  return nativeNotifications.addNotificationResponseReceivedListener(listener);
}

export async function getMobileLastNotificationResponseAsync(): Promise<NotificationsType.NotificationResponse | null> {
  if (Platform.OS === 'web' || !nativeNotifications) return null;
  return nativeNotifications.getLastNotificationResponseAsync();
}

export async function clearMobileLastNotificationResponseAsync(): Promise<void> {
  if (Platform.OS === 'web' || !nativeNotifications) return;
  return nativeNotifications.clearLastNotificationResponseAsync();
}

export async function unregisterMobilePushNotifications() {
  if (Platform.OS === 'web' || !registeredExpoPushToken) return;
  const token = registeredExpoPushToken;
  await mobileApiRequest('/mobile-push-tokens', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
  registeredExpoPushToken = '';
  registeredSessionKey = '';
}

export type MobilePushPreferences = {
  scheduleReminders: boolean;
  scheduleChanges: boolean;
  messages: boolean;
  calls: boolean;
  adminAnnouncements: boolean;
  assignmentsAndQuizzes: boolean;
  financeAndCourses: boolean;
  reminderOffsetsMinutes: number[];
};

export const DEFAULT_MOBILE_PUSH_PREFERENCES: MobilePushPreferences = {
  scheduleReminders: true,
  scheduleChanges: true,
  messages: true,
  calls: true,
  adminAnnouncements: true,
  assignmentsAndQuizzes: true,
  financeAndCourses: true,
  reminderOffsetsMinutes: [1440, 60, 15],
};

export async function getMobilePushPreferences(): Promise<MobilePushPreferences> {
  const response = await mobileApiRequest<{ data?: MobilePushPreferences }>('/mobile-push-tokens/preferences');
  return {
    ...DEFAULT_MOBILE_PUSH_PREFERENCES,
    ...(response?.data || {}),
  };
}

export async function updateMobilePushPreferences(
  updates: Partial<MobilePushPreferences>,
): Promise<MobilePushPreferences> {
  const response = await mobileApiRequest<{ data?: MobilePushPreferences }>('/mobile-push-tokens/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return {
    ...DEFAULT_MOBILE_PUSH_PREFERENCES,
    ...(response?.data || updates),
  };
}

export async function cancelScheduledRemindersForSchedule(scheduleId: string) {
  if (Platform.OS === 'web' || !nativeNotifications || !scheduleId) return 0;
  try {
    const scheduled = await nativeNotifications.getAllScheduledNotificationsAsync();
    const matches = scheduled.filter(
      (item) => String(item?.content?.data?.scheduleId || '') === String(scheduleId),
    );
    await Promise.all(
      matches.map((item) => nativeNotifications.cancelScheduledNotificationAsync(item.identifier)),
    );
    return matches.length;
  } catch {
    return 0;
  }
}

export async function setMobileBadgeCount(count: number) {
  if (Platform.OS === 'web' || !nativeNotifications) return;
  try {
    await nativeNotifications.setBadgeCountAsync(Math.max(0, Math.floor(Number(count) || 0)));
  } catch { /* ignore badge errors on unsupported devices */ }
}

export async function scheduleCategorizedLocalNotification(options: {
  category: MobilePushCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  secondsDelay?: number;
}) {
  if (Platform.OS === 'web' || !nativeNotifications) return null;
  await configureAndroidChannels();
  await configureNotificationCategories();
  const categoryIdentifier = options.category === 'schedule' || options.category === 'message' || options.category === 'promo'
    ? options.category
    : undefined;
  return nativeNotifications.scheduleNotificationAsync({
    content: {
      title: options.title,
      body: options.body,
      categoryIdentifier,
      data: {
        category: options.category,
        ...(options.data || {}),
      },
      ...(Platform.OS === 'android' ? { channelId: options.category } : {}),
    },
    trigger: options.secondsDelay && options.secondsDelay > 0
      ? { type: nativeNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, options.secondsDelay) }
      : null,
  });
}
