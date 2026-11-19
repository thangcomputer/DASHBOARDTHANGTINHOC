import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY_ID = 'cms_registered_device_key_v1';
const KEY_SECRET = 'cms_registered_device_secret_v1';

async function read(key: string): Promise<string> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key) || '';
  }
  return (await SecureStore.getItemAsync(key)) || '';
}

async function write(key: string, value: string) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

function randomId() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Định danh ổn định trên máy + khóa bí mật do server cấp lần đăng ký đầu. */
export async function getMobileDeviceAuthFields() {
  let deviceKey = await read(KEY_ID);
  if (!deviceKey) {
    deviceKey = randomId();
    await write(KEY_ID, deviceKey);
  }
  const deviceSecret = await read(KEY_SECRET);
  return { deviceKey, deviceFingerprint: deviceKey, deviceSecret };
}

export async function rememberMobileDeviceSecret(secret?: string | null) {
  if (!secret) return;
  await write(KEY_SECRET, String(secret));
}
