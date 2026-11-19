'use strict';

const crypto = require('crypto');
const RegisteredDevice = require('../models/RegisteredDevice');
const { parseUserAgent } = require('./deviceSessionService');
const { detectOsFamily } = require('./studentKnownDevices');

const LIMIT_MESSAGE = 'Tài khoản này đã được đăng ký trên 2 thiết bị cố định. Bạn không thể đăng nhập bằng thiết bị khác. Vui lòng liên hệ trung tâm nếu cần thay đổi thiết bị.';

function deviceError(code, message, status = 403) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret || '')).digest('hex');
}

function secretsMatch(storedHash, secret) {
  if (!storedHash || !secret) return false;
  const incoming = hashSecret(secret);
  const a = Buffer.from(storedHash);
  const b = Buffer.from(incoming);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeKey(deviceKey) {
  return String(deviceKey || '').trim().slice(0, 128);
}

/**
 * Quyết định thuần (dùng cho kiểm thử, không đụng DB).
 * registered: [{ deviceKey, status, slot }]
 */
function decideRegisteredDeviceAccess(registered, deviceKey, proofOk) {
  const key = normalizeKey(deviceKey);
  const rows = (Array.isArray(registered) ? registered : []).filter((row) => row && row.status !== 'revoked');
  const mine = rows.find((row) => row.deviceKey === key);
  if (mine) {
    return proofOk
      ? { allow: true, action: 'touch', slot: mine.slot }
      : { allow: false, code: 'DEVICE_PROOF_INVALID' };
  }
  if (rows.length >= 2) {
    return { allow: false, code: 'DEVICE_NOT_REGISTERED_LIMIT_REACHED' };
  }
  const used = new Set(rows.map((row) => Number(row.slot)));
  const slot = [1, 2].find((n) => !used.has(n));
  return { allow: true, action: 'register', slot };
}

/**
 * Đăng ký slot trong bộ nhớ — mô phỏng unique slot + unique key (kiểm thử đồng thời).
 */
async function claimInMemory(store, deviceKey) {
  const key = normalizeKey(deviceKey);
  if (!key) throw deviceError('DEVICE_KEY_REQUIRED', 'Thiếu định danh thiết bị', 400);
  if (store.keys.has(key)) return { action: 'touch', slot: store.keys.get(key), deviceKey: key };
  const decision = decideRegisteredDeviceAccess(
    [...store.slots.entries()].map(([slot, k]) => ({ slot, deviceKey: k, status: 'active' })),
    key,
    false,
  );
  if (!decision.allow) throw deviceError(decision.code, LIMIT_MESSAGE);
  if (store.slots.has(decision.slot) || store.keys.has(key)) {
    return claimInMemory(store, key);
  }
  store.slots.set(decision.slot, key);
  store.keys.set(key, decision.slot);
  return { action: 'register', slot: decision.slot, deviceKey: key };
}

function matchesAnyDeviceSecret(doc, deviceSecret) {
  if (!doc || !deviceSecret) return false;
  if (secretsMatch(doc.secretHash, deviceSecret)) return true;
  if (!Array.isArray(doc.secretHashes)) return false;
  return doc.secretHashes.some((hash) => secretsMatch(hash, deviceSecret));
}

function appendSecretHash(existingDoc, nextHash) {
  const list = Array.isArray(existingDoc?.secretHashes) ? [...existingDoc.secretHashes] : [];
  if (existingDoc?.secretHash && !list.includes(existingDoc.secretHash)) {
    list.unshift(existingDoc.secretHash);
  }
  if (nextHash && !list.includes(nextHash)) {
    list.push(nextHash);
  }
  return list.slice(-15);
}

/**
 * Allows switching between different browsers or Incognito on the same physical Web device
 * (same hardware deviceKey, OS family, and deviceType) while rejecting cross-OS/blank-UA spoofing
 * and keeping native mobile platforms strictly bound to their registered deviceSecret.
 */
function samePhysicalWebDevice(existingDoc, { platform = 'web', ua = null } = {}) {
  const incomingPlatform = String(platform || 'web').trim().toLowerCase();
  const storedPlatform = String(existingDoc?.platform || 'web').trim().toLowerCase();
  if (incomingPlatform !== 'web' || storedPlatform !== 'web') return false;

  const existingOs = detectOsFamily(existingDoc?.os || '');
  const incomingOs = detectOsFamily(ua?.os || '');
  if (existingOs !== 'other' && incomingOs === 'other') return false;

  const appleSet = new Set(['mac', 'ios', 'ipad']);
  const osMatches = (
    existingOs === 'other'
    || existingOs === incomingOs
    || (appleSet.has(existingOs) && appleSet.has(incomingOs))
  );
  if (!osMatches) return false;

  const existingType = String(existingDoc?.deviceType || 'unknown');
  const incomingType = String(ua?.deviceType || 'unknown');
  if (
    existingType !== 'unknown'
    && incomingType !== 'unknown'
    && existingType !== incomingType
    && !(appleSet.has(existingOs) && ['desktop', 'tablet'].includes(existingType) && ['desktop', 'tablet'].includes(incomingType))
  ) {
    return false;
  }
  if (existingType !== 'unknown' && incomingType === 'unknown') return false;

  return true;
}

function verifyExistingDeviceProof(existingDoc, { deviceSecret, platform = 'web', ua = null } = {}) {
  if (matchesAnyDeviceSecret(existingDoc, deviceSecret)) {
    return { ok: true, needsNewBrowserSecret: false };
  }
  if (samePhysicalWebDevice(existingDoc, { platform, ua })) {
    return { ok: true, needsNewBrowserSecret: true };
  }
  return { ok: false, needsNewBrowserSecret: false };
}

async function previewLoginDevice({ userId, role, deviceKey, deviceSecret, platform = 'web', req = null }) {
  const key = normalizeKey(deviceKey);
  if (!userId || !['student', 'teacher'].includes(role)) {
    throw deviceError('DEVICE_ROLE_UNSUPPORTED', 'Chỉ áp dụng cho học viên và giảng viên', 400);
  }
  if (!key) throw deviceError('DEVICE_KEY_REQUIRED', 'Thiếu định danh thiết bị', 400);
  const rows = await RegisteredDevice.find({
    userId: String(userId),
    role,
    status: 'active',
  }).lean();
  const mine = rows.find((row) => row.deviceKey === key);
  const ua = parseUserAgent(req?.headers?.['user-agent'] || '');
  if (mine && !verifyExistingDeviceProof(mine, { deviceSecret, platform, ua }).ok) {
    throw deviceError(
      'DEVICE_PROOF_INVALID',
      'Không xác minh được thiết bị đã đăng ký. Nếu bạn đã xóa dữ liệu trình duyệt, hãy liên hệ trung tâm.',
    );
  }
  const decision = decideRegisteredDeviceAccess(rows, key, true);
  if (!decision.allow) throw deviceError(decision.code, LIMIT_MESSAGE);
  return { alreadyRegistered: Boolean(mine), slot: decision.slot || mine?.slot };
}

async function claimLoginDevice({
  userId,
  role,
  deviceKey,
  deviceSecret,
  platform = 'web',
  req = null,
}) {
  const key = normalizeKey(deviceKey);
  if (!userId || !['student', 'teacher'].includes(role)) {
    throw deviceError('DEVICE_ROLE_UNSUPPORTED', 'Chỉ áp dụng cho học viên và giảng viên', 400);
  }
  if (!key) throw deviceError('DEVICE_KEY_REQUIRED', 'Thiếu định danh thiết bị', 400);

  const ua = parseUserAgent(req?.headers?.['user-agent'] || '');
  const existing = await RegisteredDevice.findOne({
    userId: String(userId),
    role,
    deviceKey: key,
    status: 'active',
  });
  if (existing) {
    const proof = verifyExistingDeviceProof(existing, { deviceSecret, platform, ua });
    if (!proof.ok) {
      throw deviceError(
        'DEVICE_PROOF_INVALID',
        'Không xác minh được thiết bị đã đăng ký. Nếu bạn đã xóa dữ liệu trình duyệt, hãy liên hệ trung tâm.',
      );
    }
    existing.lastActiveAt = new Date();
    if (ua.browser && ua.browser !== 'Không rõ') existing.browser = ua.browser;
    if (ua.deviceLabel) existing.deviceLabel = ua.deviceLabel;
    let issuedSecret = null;
    if (proof.needsNewBrowserSecret) {
      issuedSecret = crypto.randomBytes(32).toString('hex');
      existing.secretHashes = appendSecretHash(existing, hashSecret(issuedSecret));
      existing.markModified('secretHashes');
    }
    await existing.save();
    return { newlyRegistered: false, slot: existing.slot, deviceSecret: issuedSecret };
  }

  const secret = crypto.randomBytes(32).toString('hex');
  const initialHash = hashSecret(secret);
  const base = {
    userId: String(userId),
    role,
    deviceKey: key,
    secretHash: initialHash,
    secretHashes: [initialHash],
    status: 'active',
    platform: String(platform || 'web').slice(0, 24),
    deviceLabel: ua.deviceLabel,
    deviceType: ua.deviceType,
    os: ua.os,
    browser: ua.browser,
    registeredAt: new Date(),
    lastActiveAt: new Date(),
  };

  for (const slot of [1, 2]) {
    try {
      await RegisteredDevice.create({ ...base, slot });
      return { newlyRegistered: true, slot, deviceSecret: secret };
    } catch (err) {
      if (err?.code !== 11000) throw err;
      const won = await RegisteredDevice.findOne({
        userId: String(userId),
        role,
        deviceKey: key,
        status: 'active',
      });
      if (won) {
        if (!verifyExistingDeviceProof(won, { deviceSecret, platform, ua }).ok && won.secretHash !== base.secretHash) {
          return { newlyRegistered: false, slot: won.slot, deviceSecret: null, raced: true };
        }
        return { newlyRegistered: won.secretHash === base.secretHash, slot: won.slot, deviceSecret: won.secretHash === base.secretHash ? secret : null };
      }
    }
  }

  throw deviceError('DEVICE_NOT_REGISTERED_LIMIT_REACHED', LIMIT_MESSAGE);
}

async function listForAccount(userId, role) {
  return RegisteredDevice.find({
    userId: String(userId),
    ...(role ? { role } : {}),
  }).sort({ status: 1, slot: 1, registeredAt: 1 }).lean();
}

async function revokeByAdmin({ id, actorId, reason }) {
  const doc = await RegisteredDevice.findById(id);
  if (!doc || doc.status !== 'active') {
    throw deviceError('DEVICE_NOT_FOUND', 'Không tìm thấy thiết bị đang đăng ký', 404);
  }
  doc.status = 'revoked';
  doc.revokedAt = new Date();
  doc.revokedBy = String(actorId || '');
  doc.revokeReason = String(reason || 'Admin thay thế thiết bị').slice(0, 240);
  await doc.save();
  return doc.toObject();
}

/**
 * Removes all registered device records (active slots and revoked history) for an account
 * so the user can re-register and log in on new machines starting from slot 1.
 */
async function resetAllForAccount({ userId, role }, { model = RegisteredDevice } = {}) {
  if (!userId) return { deletedCount: 0 };
  const filter = {
    userId: String(userId),
    ...(role ? { role } : {}),
  };
  const result = await model.deleteMany(filter);
  return { deletedCount: Number(result?.deletedCount) || 0 };
}

module.exports = {
  LIMIT_MESSAGE,
  decideRegisteredDeviceAccess,
  claimInMemory,
  previewLoginDevice,
  claimLoginDevice,
  listForAccount,
  revokeByAdmin,
  resetAllForAccount,
  hashSecret,
  samePhysicalWebDevice,
  verifyExistingDeviceProof,
};
