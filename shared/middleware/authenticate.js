const jwt = require('jsonwebtoken');
const User = require('../../modules/users/User');
const blacklist = require('../../middleware/tokenBlacklist');
const logger = require('../logger/logger');

/**
 * Shared authentication middleware.
 * Verifies JWT token and sets req.currentUser / req.user.
 * Returns direct JSON responses for 100% backward compatibility.
 */
const authenticate = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    // Check if token is blacklisted
    if (await blacklist.isBlacklisted(token)) {
      return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'Not authorized, token failed' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Not authorized, token failed' });
      }
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }

    // SUPER_ADMIN override logic matching old routes
    if (decoded.id === 'admin') {
      const adminUser = {
        _id: 'admin',
        id: 'admin',
        roleCode: 'SUPER_ADMIN',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        name: decoded.name || 'System Admin',
        status: 'active',
        permissions: ['ALL'],
        tokenAudience: decoded.aud || 'public'
      };
      req.currentUser = adminUser;
      req.user = adminUser;
      req.tokenAudience = decoded.aud || 'public';
      return next();
    }

    let user = await User.findById(decoded.id).populate('roleId');

    // Fallback to legacy collections if not found in User collection (copied from original middleware)
    if (!user) {
      if (decoded.role === 'student') {
        const Student = require('../../modules/student/models/Student');
        const student = await Student.findById(decoded.id);
        if (student) {
          user = student.toObject();
          user.roleCode = 'STUDENT';
          user.role = 'student';
          user.id = user._id;
        }
      } else {
        const Teacher = require('../../modules/teacher/models/Teacher');
        const teacher = await Teacher.findById(decoded.id);
        if (teacher) {
          user = teacher.toObject();
          let mappedRoleCode = teacher.adminRole;
          if (mappedRoleCode === 'STAFF') mappedRoleCode = 'ADMIN_STAFF';
          if (mappedRoleCode === 'SUPPORT') mappedRoleCode = 'SUPPORT_AGENT';

          user.roleCode = mappedRoleCode || (teacher.role === 'admin' ? 'SUPER_ADMIN' : teacher.role === 'staff' ? 'ADMIN_STAFF' : 'TEACHER');
          user.role = teacher.role;
          user.adminRole = mappedRoleCode || teacher.adminRole;
          user.id = user._id;
        }
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    // Check status
    const status = String(user.status || '').toLowerCase();
    if (user.roleCode === 'STUDENT' || user.role === 'student') {
      if (status === 'inactive' || status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Account is locked or inactive' });
      }
    } else {
      if (status !== 'active') {
        return res.status(403).json({ success: false, message: 'Account is locked or inactive' });
      }
    }

    // Backward compatibility patches
    if (!user.role) {
      user.role = user.roleCode === 'STUDENT' ? 'student' 
                : user.roleCode === 'TEACHER' ? 'teacher' 
                : user.roleCode === 'ADMIN_STAFF' ? 'staff'
                : user.roleCode === 'SUPPORT_AGENT' ? 'staff'
                : 'admin';
    }
              
    if (['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT'].includes(user.roleCode)) {
      user.adminRole = user.roleCode;
    }

    req.currentUser = user;
    req.user = user;
    req.decodedToken = decoded;
    req.tokenAudience = decoded.aud;
    next();
  } catch (err) {
    logger.error({ err: err.message }, 'Authentication middleware failure');
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

module.exports = authenticate;
