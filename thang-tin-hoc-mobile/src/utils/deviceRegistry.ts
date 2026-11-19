import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY_ID = 'cms_registered_device_key_v1';
const KEY_SECRET = 'cms_registered_device_secret_v1';

export type DeviceAuthScope = {
  role?: string | null;
  identifier?: string | null;
};

function buildScopedSecretKey(scope?: DeviceAuthScope | null): string {
  if (!scope) return '';
  const role = String(scope.role || '').trim().toLowerCase();
  const identifier = String(scope.identifier || '').trim().toLowerCase();
  if (!identifier) return '';
  const raw = `${KEY_SECRET}:${role || 'user'}:${identifier}`;
  // expo-secure-store allows alphanumeric, '.', '-', and '_' on native platforms.
  return Platform.OS === 'web' ? raw : raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

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
export async function getMobileDeviceAuthFields(scope?: DeviceAuthScope | null) {
  let deviceKey = await read(KEY_ID);
  if (!deviceKey) {
    deviceKey = randomId();
    await write(KEY_ID, deviceKey);
  }
  const scopedKey = buildScopedSecretKey(scope);
  const deviceSecret = (scopedKey ? await read(scopedKey) : '') || (await read(KEY_SECRET));
  return { deviceKey, deviceFingerprint: deviceKey, deviceSecret };
}

export async function rememberMobileDeviceSecret(secret?: string | null, scope?: DeviceAuthScope | null) {
  if (!secret) return;
  const value = String(secret);
  await write(KEY_SECRET, value);
  const scopedKey = buildScopedSecretKey(scope);
  if (scopedKey) {
    await write(scopedKey, value);
  }
}
