'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const UserDeviceSession = require('../models/UserDeviceSession');
const AuthSession = require('../models/AuthSession');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const mobileAuthSessionService = require('./mobileAuthSessionService');

// Fast in-memory revocation & activity throttle caches to avoid per-request DB load.
const revokedSessionCache = new Map(); // sessionId -> expiresAtMs
const lastTouchCache = new Map(); // sessionId -> touchedAtMs

const REVOKED_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;
const SESSION_TTL_DAYS = 30;

function isDbReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function normalizeIp(rawIp) {
  if (!rawIp) return '';
  const first = String(rawIp).split(',')[0].trim();
  if (first.startsWith('::ffff:')) return first.slice(7);
  if (first === '::1') return '127.0.0.1';
  return first.slice(0, 64);
}

/**
 * Parses a User-Agent string into browser, OS, deviceType, and human-friendly label.
 */
function parseUserAgent(uaRaw) {
  const ua = String(uaRaw || '');
  if (!ua) {
    return { browser: 'Không rõ', os: 'Không rõ', deviceType: 'unknown', deviceLabel: 'Trình duyệt web' };
  }

  let browser = 'Trình duyệt khác';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/CocCoc|coccocbrowser/i.test(ua)) browser = 'Cốc Cốc';
  else if (/Zalo/i.test(ua)) browser = 'Zalo WebView';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Expo|okhttp|CFNetwork|Dalvik/i.test(ua)) browser = 'Ứng dụng Di động';

  let os = 'Không rõ HĐH';
  if (/Windows NT 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let deviceType = 'desktop';
  if (/iPad|Tablet/i.test(ua)) deviceType = 'tablet';
  else if (/Mobile|Android|iPhone|iPod/i.test(ua)) deviceType = 'mobile';

  return {
    browser,
    os,
    deviceType,
    deviceLabel: `${browser} · ${os}`,
  };
}

function extractRequestMeta(req) {
  const ip = normalizeIp(
    req?.headers?.['x-forwarded-for']
    || req?.ip
    || req?.socket?.remoteAddress
    || '',
  );
  const userAgent = String(req?.headers?.['user-agent'] || '').slice(0, 350);
  const parsed = parseUserAgent(userAgent);
  return {
    ip,
    userAgent,
    ...parsed,
  };
}

function createDeviceSessionId() {
  return crypto.randomUUID();
}

function markRevokedInCache(sessionId) {
  if (!sessionId) return;
  revokedSessionCache.set(String(sessionId), Date.now() + REVOKED_CACHE_TTL_MS);
  if (revokedSessionCache.size > 5000) {
    const now = Date.now();
    for (const [k, exp] of revokedSessionCache.entries()) {
      if (exp <= now) revokedSessionCache.delete(k);
    }
  }
}

async function recordWebDeviceSession({
  sessionId,
  userId,
  userName = '',
  role,
  adminRole = '',
  req = null,
  fingerprint = '',
  loginChannel = 'web',
  expiresAt = null,
}) {
  if (!sessionId || !userId || !role) return null;
  const meta = extractRequestMeta(req);
  const now = new Date();
  const exp = expiresAt || new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  if (!isDbReady()) return null;

  try {
    return await UserDeviceSession.findOneAndUpdate(
      { sessionId: String(sessionId) },
      {
        $set: {
          sessionId: String(sessionId),
          userId: String(userId),
          userName: String(userName || '').slice(0, 120),
          role: String(role),
          adminRole: String(adminRole || ''),
          clientType: 'web',
          loginChannel: String(loginChannel || 'web'),
          deviceLabel: meta.deviceLabel,
          deviceType: meta.deviceType,
          browser: meta.browser,
          os: meta.os,
          ip: meta.ip,
          userAgent: meta.userAgent,
          fingerprint: String(fingerprint || '').slice(0, 120),
          lastActiveAt: now,
          expiresAt: exp,
          revokedAt: null,
          revocationReason: '',
          revokedBy: '',
        },
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    logger.warn({ err: err.message, sessionId }, '[DEVICE_SESSION] record failed');
    return null;
  }
}

async function isDeviceSessionRevoked(sessionId) {
  if (!sessionId) return false;
  const id = String(sessionId);
  const cachedUntil = revokedSessionCache.get(id);
  if (cachedUntil && cachedUntil > Date.now()) {
    return true;
  }
  if (!isDbReady()) return false;

  try {
    const doc = await UserDeviceSession.findOne({ sessionId: id })
      .select('revokedAt expiresAt')
      .lean();
    if (!doc) return false;
    if (doc.revokedAt || (doc.expiresAt && doc.expiresAt.getTime() <= Date.now())) {
      markRevokedInCache(id);
      return true;
    }
    return false;
  } catch (err) {
    logger.warn({ err: err.message, sessionId: id }, '[DEVICE_SESSION] revocation lookup failed');
    return false;
  }
}

function touchDeviceSession(sessionId, req = null) {
  if (!sessionId || !isDbReady()) return;
  const id = String(sessionId);
  const now = Date.now();
  const prev = lastTouchCache.get(id) || 0;
  if (now - prev < TOUCH_INTERVAL_MS) return;
  lastTouchCache.set(id, now);
  if (lastTouchCache.size > 5000) {
    const cutoff = now - TOUCH_INTERVAL_MS * 2;
    for (const [k, ts] of lastTouchCache.entries()) {
      if (ts < cutoff) lastTouchCache.delete(k);
    }
  }

  const ip = req ? normalizeIp(req.headers?.['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '') : '';
  const update = { lastActiveAt: new Date(now) };
  if (ip) update.ip = ip;

  UserDeviceSession.updateOne(
    { sessionId: id, revokedAt: null },
    { $set: update },
  ).catch(() => {});
}

async function listDeviceSessions({
  scope = 'all',
  roleFilter = '',
  statusFilter = 'active',
  search = '',
  limit = 100,
  currentSessionId = '',
  currentUserId = '',
}) {
  if (!isDbReady()) {
    return {
      items: [],
      stats: { totalActive: 0, webActive: 0, mobileActive: 0, revokedCount: 0, adminStaffActive: 0 },
    };
  }

  const safeLimit = Math.min(200, Math.max(10, Number(limit) || 100));
  const webQuery = {};
  const mobileQuery = {};

  if (scope === 'mine' && currentUserId) {
    webQuery.userId = String(currentUserId);
    mobileQuery.userId = String(currentUserId);
  }
  if (roleFilter && ['admin', 'staff', 'teacher', 'student'].includes(roleFilter)) {
    webQuery.role = roleFilter;
    if (['teacher', 'student'].includes(roleFilter)) {
      mobileQuery.role = roleFilter;
    } else {
      mobileQuery.role = '__none__';
    }
  }

  const now = new Date();
  if (statusFilter === 'active') {
    webQuery.revokedAt = null;
    webQuery.expiresAt = { $gt: now };
    mobileQuery.revokedAt = null;
    mobileQuery.absoluteExpiresAt = { $gt: now };
  } else if (statusFilter === 'revoked') {
    webQuery.revokedAt = { $ne: null };
    mobileQuery.revokedAt = { $ne: null };
  }

  const [webRows, mobileRows] = await Promise.all([
    UserDeviceSession.find(webQuery).sort({ lastActiveAt: -1 }).limit(safeLimit).lean(),
    mobileQuery.role === '__none__'
      ? Promise.resolve([])
      : AuthSession.find(mobileQuery).sort({ lastUsedAt: -1 }).limit(safeLimit).lean(),
  ]);

  // Enrich mobile session user names from Teacher/Student collections
  const mobileTeacherIds = [];
  const mobileStudentIds = [];
  for (const m of mobileRows) {
    if (!m.userId || !mongoose.Types.ObjectId.isValid(m.userId)) continue;
    if (m.role === 'teacher') mobileTeacherIds.push(m.userId);
    else if (m.role === 'student') mobileStudentIds.push(m.userId);
  }

  const [mobileTeachers, mobileStudents] = await Promise.all([
    mobileTeacherIds.length
      ? Teacher.find({ _id: { $in: mobileTeacherIds } }).select('name phone role adminRole').lean()
      : Promise.resolve([]),
    mobileStudentIds.length
      ? Student.find({ _id: { $in: mobileStudentIds } }).select('name phone').lean()
      : Promise.resolve([]),
  ]);

  const teacherMap = new Map(mobileTeachers.map((t) => [String(t._id), t]));
  const studentMap = new Map(mobileStudents.map((s) => [String(s._id), s]));

  const normalizedWeb = webRows.map((s) => ({
    sessionId: s.sessionId,
    userId: s.userId,
    userName: s.userName || (s.userId === 'admin' ? 'Super Admin' : 'Người dùng'),
    role: s.role,
    adminRole: s.adminRole || '',
    clientType: 'web',
    platform: 'web',
    deviceLabel: s.deviceLabel || `${s.browser || 'Web'} · ${s.os || ''}`.trim(),
    browser: s.browser || '',
    os: s.os || '',
    deviceType: s.deviceType || 'desktop',
    ip: s.ip || '',
    loginChannel: s.loginChannel || 'web',
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt || s.updatedAt || s.createdAt,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt || null,
    revocationReason: s.revocationReason || '',
    isCurrent: Boolean(currentSessionId && s.sessionId === currentSessionId),
  }));

  const normalizedMobile = mobileRows.map((s) => {
    const info = s.role === 'teacher' ? teacherMap.get(String(s.userId)) : studentMap.get(String(s.userId));
    const parsedUa = parseUserAgent(s.userAgent);
    return {
      sessionId: s.sessionId,
      userId: String(s.userId),
      userName: info?.name || 'Người dùng Mobile',
      phone: info?.phone || '',
      role: info?.role || s.role,
      adminRole: info?.adminRole || '',
      clientType: 'mobile',
      platform: s.platform || 'mobile',
      deviceLabel: s.deviceLabel || `App ${(s.platform || 'Mobile').toUpperCase()}`,
      browser: `App v${s.appVersion || '1.0'}`,
      os: s.platform === 'ios' ? 'iOS' : s.platform === 'android' ? 'Android' : parsedUa.os,
      deviceType: 'mobile',
      ip: '',
      loginChannel: 'mobile',
      createdAt: s.createdAt,
      lastActiveAt: s.lastUsedAt || s.updatedAt || s.createdAt,
      expiresAt: s.absoluteExpiresAt,
      revokedAt: s.revokedAt || null,
      revocationReason: s.revocationReason || '',
      isCurrent: Boolean(currentSessionId && s.sessionId === currentSessionId),
    };
  });

  let merged = [...normalizedWeb, ...normalizedMobile]
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

  const q = String(search || '').trim().toLowerCase();
  if (q) {
    merged = merged.filter((item) =>
      String(item.userName || '').toLowerCase().includes(q)
      || String(item.deviceLabel || '').toLowerCase().includes(q)
      || String(item.ip || '').toLowerCase().includes(q)
      || String(item.os || '').toLowerCase().includes(q)
      || String(item.browser || '').toLowerCase().includes(q),
    );
  }

  merged = merged.slice(0, safeLimit);

  const [webActive, mobileActive, revokedWebCount, adminStaffActive] = await Promise.all([
    UserDeviceSession.countDocuments({ revokedAt: null, expiresAt: { $gt: now } }),
    AuthSession.countDocuments({ revokedAt: null, absoluteExpiresAt: { $gt: now } }),
    UserDeviceSession.countDocuments({ revokedAt: { $ne: null } }),
    UserDeviceSession.countDocuments({ revokedAt: null, expiresAt: { $gt: now }, role: { $in: ['admin', 'staff'] } }),
  ]);

  return {
    items: merged,
    stats: {
      totalActive: webActive + mobileActive,
      webActive,
      mobileActive,
      revokedCount: revokedWebCount,
      adminStaffActive,
    },
  };
}

function emitForceLogoutForSession({ io, sessionId, userId, role, reason }) {
  if (!io || !sessionId) return;
  try {
    const payload = {
      userId: String(userId || ''),
      role: role || '',
      deviceSessionId: String(sessionId),
      reason: reason || 'remote_logout',
    };
    io.in(`dsid:${sessionId}`).emit('auth:forceLogout', payload);
    io.in(`dsid:${sessionId}`).disconnectSockets(true);
    io.in(`session:${sessionId}`).emit('auth:forceLogout', payload);
    io.in(`session:${sessionId}`).disconnectSockets(true);
  } catch (err) {
    logger.warn({ err: err.message, sessionId }, '[DEVICE_SESSION] forceLogout emit failed');
  }
}

function hasAdminDeviceManageAccess(actor) {
  if (!actor) return false;
  if (actor.id === 'admin' || actor.adminRole === 'SUPER_ADMIN' || actor.adminRole === 'HIGH_ADMIN' || actor.role === 'admin') {
    return true;
  }
  const perms = Array.isArray(actor.permissions) ? actor.permissions : [];
  return actor.role === 'staff' && perms.includes('settings');
}

function canActorRevokeSession(actor, session) {
  if (!actor || !session) {
    return { ok: false, status: 403, message: 'Bạn không có quyền đăng xuất thiết bị này' };
  }
  const actorId = actor.id ? String(actor.id) : '';
  const targetUserId = session.userId ? String(session.userId) : '';
  const isOwner = Boolean(actorId && targetUserId && actorId === targetUserId);
  if (!hasAdminDeviceManageAccess(actor) && !isOwner) {
    return { ok: false, status: 403, message: 'Bạn chỉ có thể đăng xuất thiết bị của chính mình' };
  }
  const actorIsSuper = actor.id === 'admin' || actor.adminRole === 'SUPER_ADMIN';
  const targetIsProtectedAdmin = targetUserId === 'admin'
    || session.role === 'admin'
    || session.adminRole === 'SUPER_ADMIN'
    || session.adminRole === 'HIGH_ADMIN';
  if (targetIsProtectedAdmin && !actorIsSuper && !isOwner) {
    return { ok: false, status: 403, message: 'Chỉ Super Admin mới có quyền đăng xuất thiết bị của tài khoản quản trị' };
  }
  return { ok: true };
}

async function revokeDeviceSession({
  sessionId,
  clientType = '',
  actor = null,
  reason = 'remote_logout',
  io = null,
}) {
  if (!sessionId || !isDbReady()) {
    return { ok: false, status: 400, message: 'Thiếu sessionId' };
  }
  const id = String(sessionId);

  if (clientType === 'mobile') {
    const mSession = await AuthSession.findOne({ sessionId: id }).lean();
    if (!mSession) return { ok: false, status: 404, message: 'Không tìm thấy phiên mobile' };
    const authCheck = canActorRevokeSession(actor, mSession);
    if (!authCheck.ok) return authCheck;
    await mobileAuthSessionService.revokeSession({
      sessionId: id,
      userId: mSession.userId,
      role: mSession.role,
      reason,
    });
    emitForceLogoutForSession({ io, sessionId: id, userId: mSession.userId, role: mSession.role, reason });
    return { ok: true, clientType: 'mobile', session: mSession };
  }

  const webSession = await UserDeviceSession.findOne({ sessionId: id }).lean();
  if (!webSession) {
    const mSession = await AuthSession.findOne({ sessionId: id }).lean();
    if (mSession) {
      return revokeDeviceSession({ sessionId: id, clientType: 'mobile', actor, reason, io });
    }
    return { ok: false, status: 404, message: 'Không tìm thấy phiên thiết bị' };
  }

  const authCheck = canActorRevokeSession(actor, webSession);
  if (!authCheck.ok) return authCheck;

  await UserDeviceSession.updateOne(
    { sessionId: id, revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        revocationReason: reason,
        revokedBy: actor?.id ? String(actor.id) : '',
      },
    },
  );
  markRevokedInCache(id);
  emitForceLogoutForSession({ io, sessionId: id, userId: webSession.userId, role: webSession.role, reason });
  return { ok: true, clientType: 'web', session: webSession };
}

async function revokeOtherDeviceSessions({
  currentSessionId = '',
  userId = '',
  scope = 'mine',
  actor = null,
  io = null,
}) {
  if (!isDbReady()) return { revokedCount: 0 };

  const filter = { revokedAt: null };
  if (currentSessionId) {
    filter.sessionId = { $ne: String(currentSessionId) };
  }
  if (scope !== 'all') {
    filter.userId = String(userId || actor?.id || '');
  } else {
    const actorIsSuper = actor?.id === 'admin' || actor?.adminRole === 'SUPER_ADMIN';
    if (!actorIsSuper) {
      filter.role = { $ne: 'admin' };
      filter.adminRole = { $nin: ['SUPER_ADMIN', 'HIGH_ADMIN'] };
      filter.userId = { $ne: 'admin' };
    }
  }

  const targets = await UserDeviceSession.find(filter).select('sessionId userId role').lean();
  if (targets.length) {
    const now = new Date();
    const ids = targets.map((t) => t.sessionId);
    await UserDeviceSession.updateMany(
      { sessionId: { $in: ids }, revokedAt: null },
      { $set: { revokedAt: now, revocationReason: 'revoke_others', revokedBy: String(actor?.id || '') } },
    );
    for (const t of targets) {
      markRevokedInCache(t.sessionId);
      emitForceLogoutForSession({ io, sessionId: t.sessionId, userId: t.userId, role: t.role, reason: 'revoke_others' });
    }
  }

  let mobileCount = 0;
  if (scope !== 'all' && userId && userId !== 'admin') {
    const mFilter = { userId: String(userId), revokedAt: null };
    if (currentSessionId) mFilter.sessionId = { $ne: String(currentSessionId) };
    const mTargets = await AuthSession.find(mFilter).select('sessionId userId role').lean();
    for (const m of mTargets) {
      await mobileAuthSessionService.revokeSession({
        sessionId: m.sessionId,
        userId: m.userId,
        role: m.role,
        reason: 'revoke_others',
      });
      emitForceLogoutForSession({ io, sessionId: m.sessionId, userId: m.userId, role: m.role, reason: 'revoke_others' });
      mobileCount += 1;
    }
  }

  return { revokedCount: targets.length + mobileCount };
}

module.exports = {
  parseUserAgent,
  extractRequestMeta,
  createDeviceSessionId,
  markRevokedInCache,
  recordWebDeviceSession,
  isDeviceSessionRevoked,
  touchDeviceSession,
  listDeviceSessions,
  revokeDeviceSession,
  revokeOtherDeviceSessions,
  canActorRevokeSession,
  hasAdminDeviceManageAccess,
};

