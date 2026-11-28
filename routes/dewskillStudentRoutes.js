'use strict';

const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const StudentDewskillClassAccess = require('../models/StudentDewskillClassAccess');
const RegisteredDevice = require('../models/RegisteredDevice');
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { normalizeVNPhone, phoneLookupVariants } = require('../utils/phoneIdentity');
const { generateStudentCode } = require('../services/businessCodeService');
const { FREE_COURSE_NAME } = require('../services/freePortal');
const { resetAllForAccount: resetRegisteredDevicesForAccount } = require('../services/registeredDeviceService');
const { resetAccountDeviceSessions } = require('../services/deviceSessionService');
const { emitUser } = require('../utils/realtimeEmit');
const logger = require('../config/logger');

const requireDewskillStudentAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_DEWSKILL_STUDENTS)];

const DEWSKILL_STUDENT_FILTER = {
  $or: [
    { accountType: 'dewskill' },
    { freePortal: true },
  ],
};

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeStudent(doc, classes = [], registeredDevices = []) {
  const obj = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  delete obj.password;
  obj.dewskillClasses = classes;
  obj.registeredDevices = registeredDevices;
  obj.registeredDeviceCount = registeredDevices.length;
  return obj;
}

function isDewskillAccount(student) {
  return Boolean(student && (student.accountType === 'dewskill' || student.freePortal === true));
}

/**
 * GET /api/dewskill-students
 * Danh sách học viên thuộc hệ sinh thái DewSkill (tách biệt với học viên Trung tâm).
 */
router.get('/', ...requireDewskillStudentAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = String(req.query.filter || 'all').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const andConditions = [DEWSKILL_STUDENT_FILTER];

    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      andConditions.push({
        $or: [
          { name: rx },
          { studentCode: rx },
          { zalo: rx },
          { email: rx },
          { 'freeSurvey.gradeGroup': rx },
          { 'freeSurvey.target': rx },
          { 'freeSurvey.level': rx },
        ],
      });
    }

    if (filter === 'free') {
      andConditions.push({ freeUnlocked: { $ne: true }, accountLocked: { $ne: true } });
    } else if (filter === 'unlocked') {
      andConditions.push({ freeUnlocked: true, accountLocked: { $ne: true } });
    } else if (filter === 'locked') {
      andConditions.push({ accountLocked: true });
    }

    const mongoQuery = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const [items, total, freeCount, unlockedCount, lockedCount, allTotal] = await Promise.all([
      Student.find(mongoQuery)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(mongoQuery),
      Student.countDocuments({ $and: [DEWSKILL_STUDENT_FILTER, { freeUnlocked: { $ne: true }, accountLocked: { $ne: true } }] }),
      Student.countDocuments({ $and: [DEWSKILL_STUDENT_FILTER, { freeUnlocked: true, accountLocked: { $ne: true } }] }),
      Student.countDocuments({ $and: [DEWSKILL_STUDENT_FILTER, { accountLocked: true }] }),
      Student.countDocuments(DEWSKILL_STUDENT_FILTER),
    ]);

    const studentIds = items.map((s) => s._id);
    const studentIdStrings = studentIds.map((id) => String(id));
    const [accessDocs, registeredDeviceDocs] = studentIds.length
      ? await Promise.all([
          StudentDewskillClassAccess.find({ studentId: { $in: studentIds }, isVisible: true })
            .populate('classId', 'name code tier grade track isActive')
            .lean(),
          RegisteredDevice.find({
            userId: { $in: studentIdStrings },
            role: 'student',
            status: 'active',
          })
            .select('userId slot platform deviceLabel os browser lastActiveAt')
            .sort({ slot: 1 })
            .lean(),
        ])
      : [[], []];

    const accessMap = new Map();
    for (const acc of accessDocs) {
      const sid = String(acc.studentId);
      if (!accessMap.has(sid)) accessMap.set(sid, []);
      if (acc.classId) {
        accessMap.get(sid).push({
          accessId: acc._id,
          classId: acc.classId._id,
          name: acc.classId.name,
          code: acc.classId.code,
          tier: acc.classId.tier,
          grade: acc.classId.grade,
          track: acc.classId.track,
          accessLevel: acc.accessLevel,
          isActive: acc.classId.isActive,
        });
      }
    }

    const deviceMap = new Map();
    for (const dev of registeredDeviceDocs) {
      const sid = String(dev.userId);
      if (!deviceMap.has(sid)) deviceMap.set(sid, []);
      deviceMap.get(sid).push({
        slot: dev.slot,
        platform: dev.platform,
        deviceLabel: dev.deviceLabel,
        os: dev.os,
        browser: dev.browser,
        lastActiveAt: dev.lastActiveAt,
      });
    }

    return res.json({
      success: true,
      items: items.map((item) =>
        sanitizeStudent(
          item,
          accessMap.get(String(item._id)) || [],
          deviceMap.get(String(item._id)) || [],
        )
      ),
      stats: {
        all: allTotal,
        free: freeCount,
        unlocked: unlockedCount,
        locked: lockedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    logger.error('[DEWSKILL STUDENTS GET] %s', err.message);
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi tải danh sách học viên DewSkill' });
  }
});

/**
 * POST /api/dewskill-students
 * Tạo mới tài khoản học viên DewSkill.
 */
router.post('/', ...requireDewskillStudentAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const rawZalo = String(body.zalo || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const rawPassword = String(body.password || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Vui lòng nhập họ tên học viên DewSkill.' });
    }
    if (!rawZalo && !email) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại (Zalo) hoặc email đăng nhập.' });
    }

    let zalo = '';
    if (rawZalo) {
      zalo = normalizeVNPhone(rawZalo);
      if (!zalo) {
        return res.status(400).json({ message: 'Số điện thoại không đúng định dạng Việt Nam (10 số, bắt đầu bằng 03/05/07/08/09).' });
      }
      const variants = phoneLookupVariants(zalo);
      const dupPhone = await Student.findOne({ zalo: { $in: variants } }).select('_id accountType freePortal').lean();
      if (dupPhone) {
        return res.status(409).json({ message: `Số điện thoại ${zalo} đã tồn tại trong hệ thống.` });
      }
    }

    if (email) {
      const dupEmail = await Student.findOne({ email }).select('_id').lean();
      if (dupEmail) {
        return res.status(409).json({ message: `Email ${email} đã tồn tại trong hệ thống.` });
      }
    }

    const freeUnlocked = Boolean(body.freeUnlocked);
    const accountLocked = Boolean(body.accountLocked);
    const planDays = Math.max(0, parseInt(body.planDays, 10) || 0);
    const freeSurvey = body.freeSurvey && typeof body.freeSurvey === 'object'
      ? {
          gradeGroup: String(body.freeSurvey.gradeGroup || '').trim(),
          target: String(body.freeSurvey.target || '').trim(),
          level: String(body.freeSurvey.level || '').trim(),
          note: String(body.freeSurvey.note || '').trim(),
        }
      : undefined;

    const studentCode = await generateStudentCode();
    const initialPassword = rawPassword || zalo || '123456';

    const payload = {
      studentCode,
      name,
      ...(zalo ? { phone: zalo, zalo } : {}),
      email: email || undefined,
      password: initialPassword,
      accountType: 'dewskill',
      freePortal: true,
      freeUnlocked,
      accountLocked,
      accountLockReason: accountLocked ? String(body.accountLockReason || 'Tài khoản bị khóa bởi quản trị DewSkill').trim() : '',
      course: FREE_COURSE_NAME,
      price: 0,
      paid: true,
      paidAmount: 0,
      learningMode: 'ONLINE',
      status: 'Đang học',
      enrollments: [{
        courseName: FREE_COURSE_NAME,
        price: 0,
        paid: true,
        status: 'active',
        learningAccess: true,
        isPrimary: true,
        totalSessions: 0,
        remainingSessions: 0,
      }],
      ...(freeSurvey ? { freeSurvey } : {}),
    };

    if (freeUnlocked) {
      const expiresAt = body.expiresAt
        ? new Date(body.expiresAt)
        : (planDays > 0 ? new Date(Date.now() + planDays * 86400000) : null);
      payload.subscription = {
        status: 'active',
        planLabel: String(body.planLabel || 'Gói DewSkill').trim(),
        activatedAt: new Date(),
        ...(expiresAt && !Number.isNaN(expiresAt.getTime()) ? { expiresAt } : {}),
      };
    }

    const created = await Student.create(payload);
    return res.status(201).json({
      success: true,
      message: 'Đã tạo tài khoản học viên DewSkill.',
      student: sanitizeStudent(created, []),
    });
  } catch (err) {
    logger.error('[DEWSKILL STUDENTS CREATE] %s', err.message);
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi tạo tài khoản học viên DewSkill' });
  }
});

/**
 * PATCH /api/dewskill-students/:id
 * Cập nhật thông tin, gói học, khóa/mở khóa hoặc đặt lại mật khẩu học viên DewSkill.
 */
router.patch('/:id', ...requireDewskillStudentAdmin, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, ...DEWSKILL_STUDENT_FILTER });
    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy học viên DewSkill.' });
    }

    const body = req.body || {};

    if (body.name !== undefined) {
      const trimmed = String(body.name || '').trim();
      if (!trimmed) return res.status(400).json({ message: 'Họ tên không được để trống.' });
      student.name = trimmed;
    }

    if (body.zalo !== undefined) {
      const rawZalo = String(body.zalo || '').trim();
      if (rawZalo) {
        const normalized = normalizeVNPhone(rawZalo);
        if (!normalized) {
          return res.status(400).json({ message: 'Số điện thoại không đúng định dạng Việt Nam.' });
        }
        if (normalized !== student.zalo) {
          const dupPhone = await Student.findOne({
            _id: { $ne: student._id },
            zalo: { $in: phoneLookupVariants(normalized) },
          }).select('_id').lean();
          if (dupPhone) {
            return res.status(409).json({ message: `Số điện thoại ${normalized} đã thuộc tài khoản khác.` });
          }
          student.zalo = normalized;
        }
      }
    }

    if (body.email !== undefined) {
      const email = String(body.email || '').trim().toLowerCase();
      if (email && email !== student.email) {
        const dupEmail = await Student.findOne({ _id: { $ne: student._id }, email }).select('_id').lean();
        if (dupEmail) {
          return res.status(409).json({ message: `Email ${email} đã thuộc tài khoản khác.` });
        }
        student.email = email;
      } else if (!email && student.zalo) {
        student.email = undefined;
      }
    }

    if (body.accountLocked !== undefined) {
      student.accountLocked = Boolean(body.accountLocked);
      student.accountLockReason = student.accountLocked
        ? String(body.accountLockReason || student.accountLockReason || 'Tài khoản bị khóa bởi quản trị DewSkill').trim()
        : '';
      if (student.accountLocked) {
        student.tokenVersion = (Number(student.tokenVersion) || 0) + 1;
      }
    } else if (body.accountLockReason !== undefined && student.accountLocked) {
      student.accountLockReason = String(body.accountLockReason || '').trim();
    }

    if (body.freeUnlocked !== undefined) {
      const unlocked = Boolean(body.freeUnlocked);
      student.freeUnlocked = unlocked;
      if (unlocked) {
        const planDays = Math.max(0, parseInt(body.planDays, 10) || 0);
        const expiresAt = body.expiresAt
          ? new Date(body.expiresAt)
          : (planDays > 0 ? new Date(Date.now() + planDays * 86400000) : student.subscription?.expiresAt || null);
        student.subscription = {
          ...(student.subscription || {}),
          status: 'active',
          planLabel: String(body.planLabel || student.subscription?.planLabel || 'Gói DewSkill').trim(),
          activatedAt: student.subscription?.activatedAt || new Date(),
          ...(expiresAt && !Number.isNaN(new Date(expiresAt).getTime()) ? { expiresAt: new Date(expiresAt) } : {}),
        };
      } else {
        student.subscription = {
          ...(student.subscription || {}),
          status: 'expired',
        };
      }
    }

    if (body.freeSurvey && typeof body.freeSurvey === 'object') {
      student.freeSurvey = {
        gradeGroup: String(body.freeSurvey.gradeGroup ?? student.freeSurvey?.gradeGroup ?? '').trim(),
        target: String(body.freeSurvey.target ?? student.freeSurvey?.target ?? '').trim(),
        level: String(body.freeSurvey.level ?? student.freeSurvey?.level ?? '').trim(),
        note: String(body.freeSurvey.note ?? student.freeSurvey?.note ?? '').trim(),
      };
    }

    if (body.password !== undefined) {
      const nextPass = String(body.password || '').trim();
      if (nextPass.length < 4) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
      }
      student.password = nextPass;
      student.tokenVersion = (Number(student.tokenVersion) || 0) + 1;
    }

    if (!student.accountType) student.accountType = 'dewskill';
    if (student.freePortal !== true) student.freePortal = true;

    await student.save();

    const accessDocs = await StudentDewskillClassAccess.find({ studentId: student._id, isActive: true })
      .populate('classId', 'title code levelGroup subject isActive')
      .lean();

    const classes = accessDocs
      .filter((acc) => acc.classId)
      .map((acc) => ({
        accessId: acc._id,
        classId: acc.classId._id,
        title: acc.classId.title,
        code: acc.classId.code,
        levelGroup: acc.classId.levelGroup,
        subject: acc.classId.subject,
        isActive: acc.classId.isActive,
      }));

    return res.json({
      success: true,
      message: 'Đã cập nhật học viên DewSkill.',
      student: sanitizeStudent(student, classes),
    });
  } catch (err) {
    logger.error('[DEWSKILL STUDENTS PATCH] %s', err.message);
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi cập nhật học viên DewSkill' });
  }
});

/**
 * POST /api/dewskill-students/:id/reset-devices
 * Xóa toàn bộ lịch sử thiết bị đã đăng nhập (2 thiết bị cố định, knownDevices,
 * phiên Web/Mobile cũ) để học viên DewSkill đăng nhập và cập nhật lại máy mới.
 */
router.post('/:id/reset-devices', ...requireDewskillStudentAdmin, async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, ...DEWSKILL_STUDENT_FILTER },
      {
        $set: {
          knownDevices: [],
          knownDeviceCount: 0,
          knownDeviceSummary: '',
          accountLockReason: '',
        },
        $inc: { tokenVersion: 1 },
        $unset: { refreshToken: '', deviceFingerprint: '' },
      },
      { returnDocument: 'after' }
    );
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên DewSkill.' });
    }

    const io = req.app.get('io');
    const [registeredReset, sessionReset] = await (async () => {
      try {
        const regResult = await resetRegisteredDevicesForAccount({
          userId: student._id,
          role: 'student',
        });
        const sessResult = await resetAccountDeviceSessions({
          userId: student._id,
          role: 'student',
          reason: 'devices_reset',
          io,
        });
        return [regResult, sessResult];
      } catch (resetError) {
        logger.error('[DEWSKILL STUDENTS] Devices reset session/registry cleanup failed:', resetError);
        const err = new Error('Đã xóa danh sách thiết bị nhưng chưa thể thu hồi toàn bộ phiên đăng nhập cũ.');
        err.statusCode = 503;
        err.code = 'MOBILE_SESSION_REVOCATION_FAILED';
        throw err;
      }
    })();

    if (io) {
      emitUser(io, student._id, 'auth:forceLogout', {
        userId: String(student._id),
        role: 'student',
        reason: 'devices_reset',
      });
    }

    return res.json({
      success: true,
      message: 'Đã xóa toàn bộ lịch sử thiết bị đã đăng nhập và đăng xuất các phiên cũ. Học viên có thể đăng nhập để cập nhật lại máy mới.',
      data: {
        _id: student._id,
        registeredDeviceCount: 0,
        knownDeviceCount: 0,
        knownDeviceSummary: '',
        clearedRegisteredDevices: registeredReset.deletedCount,
        clearedWebSessions: sessionReset.clearedWebSessions,
        clearedMobileSessions: sessionReset.clearedMobileSessions,
      },
    });
  } catch (err) {
    if (err?.statusCode === 503) {
      return res.status(503).json({
        success: false,
        code: err.code || 'DEVICE_RESET_INCOMPLETE',
        message: err.message,
      });
    }
    logger.error('[DEWSKILL STUDENTS RESET DEVICES] %s', err.message);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Không reset được thiết bị' });
  }
});

/**
 * DELETE /api/dewskill-students/:id
 * Chỉ xóa tài khoản học viên DewSkill; từ chối xóa học viên Trung tâm.
 */
router.delete('/:id', ...requireDewskillStudentAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('_id accountType freePortal name studentCode').lean();
    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy học viên.' });
    }
    if (!isDewskillAccount(student)) {
      return res.status(403).json({ message: 'Chỉ được phép xóa tài khoản học viên thuộc hệ sinh thái DewSkill.' });
    }

    await StudentDewskillClassAccess.deleteMany({ studentId: student._id });
    await Student.deleteOne({ _id: student._id });

    return res.json({
      success: true,
      message: `Đã xóa học viên DewSkill ${student.name || student.studentCode || ''}.`.trim(),
    });
  } catch (err) {
    logger.error('[DEWSKILL STUDENTS DELETE] %s', err.message);
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi xóa học viên DewSkill' });
  }
});

module.exports = router;
