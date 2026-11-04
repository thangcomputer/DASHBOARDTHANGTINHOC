/**
 * Khóa màn hình bằng mã PIN — lưu riêng trên từng thiết bị (không gửi lên server).
 * Mã PIN chỉ lưu dạng băm SHA-256 có muối.
 */

export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_TIMEOUT_OPTIONS = Object.freeze([
  { minutes: 1, label: '1 phút' },
  { minutes: 5, label: '5 phút' },
  { minutes: 15, label: '15 phút' },
  { minutes: 30, label: '30 phút' },
  { minutes: 60, label: '1 giờ' },
]);
export const PIN_DEFAULT_TIMEOUT = 5;
export const PIN_SETTINGS_EVENT = 'open-pin-lock-settings';
export const PIN_CHANGED_EVENT = 'cms:pin-lock-changed';
export const PIN_LOCK_NOW_EVENT = 'cms:pin-lock-now';

export function openPinLockSettings() {
  window.dispatchEvent(new CustomEvent(PIN_SETTINGS_EVENT));
}

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

export function sha256Hex(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(shift >= 32 ? Math.floor(bitLength / 2 ** shift) & 0xff : (bitLength >>> shift) & 0xff);
  }
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
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

export function hashPin(pin, salt) {
  let digest = '';
  for (let i = 0; i < HASH_ROUNDS; i += 1) digest = sha256Hex(`${salt}:${pin}:${digest}`);
  return digest;
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isValidPin(pin) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(String(pin || ''));
}

const configKey = (userKey) => `cms_pin_lock:${userKey}`;
const activeKey = (userKey) => `cms_pin_last_active:${userKey}`;
const lockedKey = (userKey) => `cms_pin_locked:${userKey}`;

export function readPinConfig(userKey) {
  if (!userKey) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(configKey(userKey)) || 'null');
    if (!raw?.hash || !raw?.salt) return null;
    const timeoutMinutes = PIN_TIMEOUT_OPTIONS.some((o) => o.minutes === raw.timeoutMinutes)
      ? raw.timeoutMinutes
      : PIN_DEFAULT_TIMEOUT;
    return { hash: raw.hash, salt: raw.salt, timeoutMinutes };
  } catch {
    return null;
  }
}

function notifyChanged(userKey) {
  window.dispatchEvent(new CustomEvent(PIN_CHANGED_EVENT, { detail: { userKey } }));
}

export function savePin(userKey, pin, timeoutMinutes = PIN_DEFAULT_TIMEOUT) {
  if (!userKey || !isValidPin(pin)) throw new Error(`Mã PIN gồm đúng ${PIN_LENGTH} chữ số.`);
  const salt = randomSalt();
  localStorage.setItem(configKey(userKey), JSON.stringify({ salt, hash: hashPin(pin, salt), timeoutMinutes }));
  markActive(userKey);
  notifyChanged(userKey);
}

export function setPinTimeout(userKey, timeoutMinutes) {
  const config = readPinConfig(userKey);
  if (!config) return;
  localStorage.setItem(configKey(userKey), JSON.stringify({ ...config, timeoutMinutes }));
  notifyChanged(userKey);
}

export function verifyPin(userKey, pin) {
  const config = readPinConfig(userKey);
  if (!config || !isValidPin(pin)) return false;
  return hashPin(pin, config.salt) === config.hash;
}

export function removePin(userKey) {
  if (!userKey) return;
  localStorage.removeItem(configKey(userKey));
  localStorage.removeItem(lockedKey(userKey));
  notifyChanged(userKey);
}

export function readLastActive(userKey) {
  const value = Number(localStorage.getItem(activeKey(userKey)));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function markActive(userKey, at = Date.now()) {
  if (userKey) localStorage.setItem(activeKey(userKey), String(at));
}

export function clearLastActive(userKey) {
  if (userKey) localStorage.removeItem(activeKey(userKey));
}

export function isLockedFlag(userKey) {
  return localStorage.getItem(lockedKey(userKey)) === '1';
}

export function setLockedFlag(userKey, locked) {
  if (!userKey) return;
  if (locked) localStorage.setItem(lockedKey(userKey), '1');
  else localStorage.removeItem(lockedKey(userKey));
}

export function lockedStorageKey(userKey) {
  return lockedKey(userKey);
}

export function configStorageKey(userKey) {
  return configKey(userKey);
}

/** Đã quá thời gian khóa kể từ lần thao tác cuối chưa. */
export function isIdleExpired(lastActive, timeoutMinutes, now = Date.now()) {
  if (!lastActive) return false;
  return now - lastActive >= timeoutMinutes * 60 * 1000;
}
