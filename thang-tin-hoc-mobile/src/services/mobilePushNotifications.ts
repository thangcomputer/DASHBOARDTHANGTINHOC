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

async function configureAndroidChannels() {
  if (Platform.OS !== 'android' || !nativeNotifications) return;
  await nativeNotifications.setNotificationChannelAsync('default', {
    name: 'Thông báo',
    importance: nativeNotifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
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
