/**
 * Socket.io auth — mirror HTTP authMiddleware (blacklist + tokenVersion).
 */
const jwt = require('jsonwebtoken');
const blacklist = require('./tokenBlacklist');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const { isMobileMultiSessionAuthEnabled } = require('../config/mobileMultiSessionAuth');

async function verifyTokenVersion(decoded) {
  if (!decoded.id || decoded.id === 'admin' || decoded.tokenVersion === undefined) {
    return true;
  }

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

async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  if (await blacklist.isBlacklisted(token)) {
    return next(new Error('Authentication error: Token revoked'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sid) {
      if (decoded.aud !== 'mobile' || !isMobileMultiSessionAuthEnabled()) {
        return next(new Error('Authentication error: Mobile sessions disabled'));
      }
      const session = await require('../services/mobileAuthSessionService').validateSession({
        sessionId: decoded.sid,
        userId: decoded.id,
        role: decoded.role,
      });
      if (!session) {
        return next(new Error('Authentication error: Session revoked'));
      }
      if (!(await verifySessionAccount(decoded))) {
        return next(new Error('Authentication error: Account unavailable'));
      }
      socket.sessionId = decoded.sid;
    }

    if (!decoded.sid && !(await verifyTokenVersion(decoded))) {
      return next(new Error('Authentication error: Token version mismatch'));
    }

    socket.user = decoded;
    socket.accessToken = token;
    next();
  } catch (err) {
    logger.warn({ err: err.message, socketId: socket.id }, 'Socket auth failed');
    next(new Error('Authentication error: Invalid token'));
  }
}

module.exports = { socketAuthMiddleware, verifyTokenVersion, verifySessionAccount };
