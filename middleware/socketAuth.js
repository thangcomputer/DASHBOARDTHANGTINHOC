/**
 * Socket.io auth - mirror HTTP authMiddleware (blacklist + tokenVersion).
 */
const jwt = require('jsonwebtoken');
const blacklist = require('./tokenBlacklist');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const SystemSettings = require('../models/SystemSettings');
const logger = require('../config/logger');
const { isMobileMultiSessionAuthEnabled } = require('../config/mobileMultiSessionAuth');

async function verifyTokenVersion(decoded) {
  if (!decoded.id) return true;
  if (decoded.id === 'admin') {
    if (decoded.tokenVersion === undefined) return false;
    const settings = await SystemSettings.findOne({ _key: 'main' }).select('adminTokenVersion').lean();
    return (settings?.adminTokenVersion || 0) === decoded.tokenVersion;
  }
  if (decoded.tokenVersion === undefined) return true;

  let dbUser = null;
  if (decoded.role === 'student') {
    dbUser = await Student.findById(decoded.id).select('tokenVersion').lean();
  } else {
    dbUser = await Teacher.findById(decoded.id).select('tokenVersion').lean();
  }

  if (dbUser && dbUser.tokenVersion !== undefined && dbUser.tokenVersion !== decoded.tokenVersion) {
    return false;
  }
  return true;
}

async function verifySessionAccount(decoded) {
  const user = decoded.role === 'student'
    ? await Student.findById(decoded.id).select('status accountLocked').lean()
    : await Teacher.findById(decoded.id).select('status isLocked').lean();
  if (!user) return false;

  const status = String(user.status || '').toLowerCase();
  if (['inactive', 'suspended'].includes(status)) return false;
  if (decoded.role === 'student' && user.accountLocked) return false;
  if (decoded.role === 'teacher' && user.isLocked) return false;
  return true;
}

const HANDSHAKE_WINDOW_MS = 10_000;
const socketHandshakeMap = new Map();
const activeSocketsByIp = new Map();
const activeSocketsByUser = new Map();

function positiveLimit(envKey, fallback) {
  const n = parseInt(process.env[envKey] || String(fallback), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function socketRateLimitEnabled() {
  return process.env.NODE_ENV !== 'test' || process.env.SOCKET_RATE_LIMIT_FORCE === '1';
}

function getSocketClientIp(socket) {
  const xff = socket?.handshake?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return String(socket?.handshake?.address || socket?.conn?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
}

function consumeHandshakeQuota(ip) {
  const now = Date.now();
  if (socketHandshakeMap.size > 5000) {
    for (const [k, v] of socketHandshakeMap.entries()) {
      if (now >= v.resetAt) socketHandshakeMap.delete(k);
    }
  }
  let entry = socketHandshakeMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + HANDSHAKE_WINDOW_MS };
  }
  entry.count += 1;
  socketHandshakeMap.set(ip, entry);
  return entry.count <= positiveLimit('SOCKET_HANDSHAKE_MAX_PER_10S', 30);
}

function incrementCounter(map, key) {
  const nextCount = (map.get(key) || 0) + 1;
  map.set(key, nextCount);
  return nextCount;
}

function decrementCounter(map, key) {
  const cur = map.get(key) || 0;
  if (cur <= 1) map.delete(key);
  else map.set(key, cur - 1);
}

function resetSocketGuards() {
  socketHandshakeMap.clear();
  activeSocketsByIp.clear();
  activeSocketsByUser.clear();
}

async function socketAuthMiddleware(socket, next) {
  const enforceFloodGuards = socketRateLimitEnabled();
  const clientIp = getSocketClientIp(socket);

  if (enforceFloodGuards && !consumeHandshakeQuota(clientIp)) {
    logger.warn({ ip: clientIp, socketId: socket.id }, 'Socket handshake flood blocked');
    return next(new Error('Rate limit exceeded: Too many connection attempts'));
  }

  let ipSlotAcquired = false;
  if (enforceFloodGuards) {
    const maxPerIp = positiveLimit('SOCKET_MAX_CONNS_PER_IP', 40);
    if ((activeSocketsByIp.get(clientIp) || 0) >= maxPerIp) {
      logger.warn({ ip: clientIp, maxPerIp }, 'Socket max concurrent connections per IP reached');
      return next(new Error('Connection limit exceeded for network'));
    }
    incrementCounter(activeSocketsByIp, clientIp);
    ipSlotAcquired = true;
  }

  const releaseIpSlot = () => {
    if (ipSlotAcquired) {
      decrementCounter(activeSocketsByIp, clientIp);
      ipSlotAcquired = false;
    }
  };

  const token = socket.handshake.auth?.token;
  if (!token) {
    releaseIpSlot();
    return next(new Error('Authentication error: Token missing'));
  }

  if (await blacklist.isBlacklisted(token)) {
    releaseIpSlot();
    return next(new Error('Authentication error: Token revoked'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sid) {
      if (decoded.aud !== 'mobile' || !isMobileMultiSessionAuthEnabled()) {
        releaseIpSlot();
        return next(new Error('Authentication error: Mobile sessions disabled'));
      }
      const session = await require('../services/mobileAuthSessionService').validateSession({
        sessionId: decoded.sid,
        userId: decoded.id,
        role: decoded.role,
      });
      if (!session) {
        releaseIpSlot();
        return next(new Error('Authentication error: Session revoked'));
      }
      if (!(await verifySessionAccount(decoded))) {
        releaseIpSlot();
        return next(new Error('Authentication error: Account unavailable'));
      }
      socket.sessionId = decoded.sid;
    }

    if (!decoded.sid && !(await verifyTokenVersion(decoded))) {
      releaseIpSlot();
      return next(new Error('Authentication error: Token version mismatch'));
    }

    const userKey = `${decoded.role || 'unknown'}:${decoded.id || ''}`;
    let userSlotAcquired = false;
    if (enforceFloodGuards && decoded.id) {
      const maxPerUser = positiveLimit('SOCKET_MAX_CONNS_PER_USER', 5);
      if ((activeSocketsByUser.get(userKey) || 0) >= maxPerUser) {
        releaseIpSlot();
        logger.warn({ userKey, maxPerUser }, 'Socket max concurrent connections per user reached');
        return next(new Error('Connection limit exceeded for account'));
      }
      incrementCounter(activeSocketsByUser, userKey);
      userSlotAcquired = true;
    }

    socket.once('disconnect', () => {
      releaseIpSlot();
      if (userSlotAcquired) {
        decrementCounter(activeSocketsByUser, userKey);
        userSlotAcquired = false;
      }
    });

    socket.user = decoded;
    socket.accessToken = token;
    next();
  } catch (err) {
    releaseIpSlot();
    logger.warn({ err: err.message, socketId: socket.id }, 'Socket auth failed');
    next(new Error('Authentication error: Invalid token'));
  }
}

module.exports = {
  socketAuthMiddleware,
  verifyTokenVersion,
  verifySessionAccount,
  resetSocketGuards,
};
