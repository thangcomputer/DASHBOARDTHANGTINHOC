import { DeviceEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Khóa màn hình bằng mã PIN — cùng cách băm và mốc thời gian với client/src/utils/pinLock.js.
 * Lưu riêng trên thiết bị: SecureStore trên điện thoại, localStorage khi chạy bản web.
 */

export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_TIMEOUT_OPTIONS = [
  { minutes: 1, label: '1 phút' },
  { minutes: 5, label: '5 phút' },
  { minutes: 15, label: '15 phút' },
  { minutes: 30, label: '30 phút' },
  { minutes: 60, label: '1 giờ' },
] as const;
export const PIN_DEFAULT_TIMEOUT = 5;
export const PIN_CHANGED_EVENT = 'mobile:pin-lock-changed';
export const PIN_LOCK_NOW_EVENT = 'mobile:pin-lock-now';

export type PinConfig = { hash: string; salt: string; timeoutMinutes: number };

const HASH_ROUNDS = 1000;

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function utf8Bytes(text: string) {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}

export function sha256Hex(text: string) {
  const bytes = utf8Bytes(String(text));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(shift >= 32 ? Math.floor(bitLength / 2 ** shift) & 0xff : (bitLength >>> shift) & 0xff);
  }
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}

export function hashPin(pin: string, salt: string) {
  let digest = '';
  for (let i = 0; i < HASH_ROUNDS; i += 1) digest = sha256Hex(`${salt}:${pin}:${digest}`);
  return digest;
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isValidPin(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(String(pin || ''));
}

export function pinUserKey(user: { id?: string; role?: string } | null | undefined) {
  if (!user?.id || !user.role) return '';
  return `${user.role}_${user.id}`.replace(/[^A-Za-z0-9._-]/g, '_');
}

const configKey = (userKey: string) => `pin_lock.${userKey}`;
const activeKey = (userKey: string) => `pin_last_active.${userKey}`;
const lockedKey = (userKey: string) => `pin_locked.${userKey}`;

async function secureGet(key: string) {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function readPinConfig(userKey: string): Promise<PinConfig | null> {
  if (!userKey) return null;
  try {
    const raw = JSON.parse((await secureGet(configKey(userKey))) || 'null') as Partial<PinConfig> | null;
    if (!raw?.hash || !raw.salt) return null;
    const timeoutMinutes = PIN_TIMEOUT_OPTIONS.some((option) => option.minutes === raw.timeoutMinutes)
      ? Number(raw.timeoutMinutes)
      : PIN_DEFAULT_TIMEOUT;
    return { hash: raw.hash, salt: raw.salt, timeoutMinutes };
  } catch {
    return null;
  }
}

export async function savePin(userKey: string, pin: string, timeoutMinutes: number = PIN_DEFAULT_TIMEOUT) {
  if (!userKey || !isValidPin(pin)) throw new Error(`Mã PIN gồm đúng ${PIN_LENGTH} chữ số.`);
  const salt = randomSalt();
  await secureSet(configKey(userKey), JSON.stringify({ salt, hash: hashPin(pin, salt), timeoutMinutes }));
  await markActive(userKey);
  DeviceEventEmitter.emit(PIN_CHANGED_EVENT, userKey);
}

export async function setPinTimeout(userKey: string, timeoutMinutes: number) {
  const config = await readPinConfig(userKey);
  if (!config) return;
  await secureSet(configKey(userKey), JSON.stringify({ ...config, timeoutMinutes }));
  DeviceEventEmitter.emit(PIN_CHANGED_EVENT, userKey);
}

export async function verifyPin(userKey: string, pin: string) {
  const config = await readPinConfig(userKey);
  if (!config || !isValidPin(pin)) return false;
  return hashPin(pin, config.salt) === config.hash;
}

export async function removePin(userKey: string) {
  if (!userKey) return;
  await secureDelete(configKey(userKey));
  await AsyncStorage.removeItem(lockedKey(userKey));
  DeviceEventEmitter.emit(PIN_CHANGED_EVENT, userKey);
}

export async function readLastActive(userKey: string) {
  const value = Number(await AsyncStorage.getItem(activeKey(userKey)));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function markActive(userKey: string, at = Date.now()) {
  if (userKey) await AsyncStorage.setItem(activeKey(userKey), String(at));
}

export async function clearLastActive(userKey: string) {
  if (!userKey) return;
  await AsyncStorage.multiRemove([activeKey(userKey), lockedKey(userKey)]);
}

export async function isLockedFlag(userKey: string) {
  return (await AsyncStorage.getItem(lockedKey(userKey))) === '1';
}

export async function setLockedFlag(userKey: string, locked: boolean) {
  if (!userKey) return;
  if (locked) await AsyncStorage.setItem(lockedKey(userKey), '1');
  else await AsyncStorage.removeItem(lockedKey(userKey));
}

let activityUserKey = '';
let memoryActiveAt = 0;
let lastPersistAt = 0;

export function setPinActivityUser(userKey: string) {
  activityUserKey = userKey;
  memoryActiveAt = 0;
  lastPersistAt = 0;
}

/** Gọi khi người dùng chạm màn hình; ghi xuống bộ nhớ máy tối đa 5 giây một lần. */
export function notePinActivity() {
  const now = Date.now();
  memoryActiveAt = now;
  if (!activityUserKey || now - lastPersistAt < 5000) return;
  lastPersistAt = now;
  void markActive(activityUserKey, now).catch(() => {});
}

export function getMemoryActiveAt() {
  return memoryActiveAt;
}

/** Màn khóa PIN đang hiện — popup khác (vd. thông báo nhận lương) phải chờ mở khóa. */
export const PIN_LOCK_STATE_EVENT = 'mobile:pin-lock-state';
let pinLockedNow = false;

export function setPinLockedState(locked: boolean) {
  if (pinLockedNow === locked) return;
  pinLockedNow = locked;
  DeviceEventEmitter.emit(PIN_LOCK_STATE_EVENT, locked);
}

export function isPinLockedNow() {
  return pinLockedNow;
}

export function isIdleExpired(lastActive: number, timeoutMinutes: number, now = Date.now()) {
  if (!lastActive) return false;
  return now - lastActive >= timeoutMinutes * 60 * 1000;
}
