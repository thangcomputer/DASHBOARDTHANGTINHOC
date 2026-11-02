import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getMobileApiTokens, mobileApiRequest } from './apiClient';
import { getMobileSoundEnabled } from './soundPreferences';

Notifications.setNotificationHandler({
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

let registeredExpoPushToken = '';
let registeredSessionKey = '';

function getProjectId() {
  return Constants.easConfig?.projectId
    || Constants.expoConfig?.extra?.eas?.projectId
    || process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || '';
}

async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Thông báo',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('silent', {
    name: 'Thông báo (không âm thanh)',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Cuộc gọi đến',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400, 200, 700],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function registerMobilePushNotifications() {
  if (Platform.OS === 'web') return;
  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Chưa cấu hình EXPO_PUBLIC_EAS_PROJECT_ID; chưa thể đăng ký push notification.');
    return;
  }

  await configureAndroidChannels();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  const tokens = getMobileApiTokens();
  if (!tokens?.sessionId) return;
  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const soundEnabled = await getMobileSoundEnabled();
  const sessionKey = `${tokens.sessionId}:${pushToken}:${soundEnabled}`;
  if (sessionKey === registeredSessionKey) return;

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
