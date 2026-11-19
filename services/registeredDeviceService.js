'use strict';

const crypto = require('crypto');
const RegisteredDevice = require('../models/RegisteredDevice');
const { parseUserAgent } = require('./deviceSessionService');

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

async function previewLoginDevice({ userId, role, deviceKey, deviceSecret }) {
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
  if (mine && !secretsMatch(mine.secretHash, deviceSecret)) {
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

  const existing = await RegisteredDevice.findOne({
    userId: String(userId),
    role,
    deviceKey: key,
    status: 'active',
  });
  if (existing) {
    if (!secretsMatch(existing.secretHash, deviceSecret)) {
      throw deviceError(
        'DEVICE_PROOF_INVALID',
        'Không xác minh được thiết bị đã đăng ký. Nếu bạn đã xóa dữ liệu trình duyệt, hãy liên hệ trung tâm.',
      );
    }
    existing.lastActiveAt = new Date();
    await existing.save();
    return { newlyRegistered: false, slot: existing.slot, deviceSecret: null };
  }

  const ua = parseUserAgent(req?.headers?.['user-agent'] || '');
  const secret = crypto.randomBytes(32).toString('hex');
  const base = {
    userId: String(userId),
    role,
    deviceKey: key,
    secretHash: hashSecret(secret),
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
        if (!secretsMatch(won.secretHash, deviceSecret) && won.secretHash !== base.secretHash) {
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
};
