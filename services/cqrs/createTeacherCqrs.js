'use strict';

const Teacher = require('../../models/Teacher');
const OutboxEvent = require('../../shared/outbox/OutboxEvent');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { generateTempPassword } = require('../../utils/tempPassword');
const { assertUniqueContact } = require('../../utils/uniqueContact');
const logger = require('../../config/logger');

/**
 * CQRS create teacher: Teacher + OutboxEvent in one transaction.
 * Welcome / socket emit happen via OutboxWorker (TeacherCreatedEvent).
 */
async function createTeacherCqrs(req) {
  const {
    name, phone, specialty, subjectIds, password, status,
    branchId: reqBranchId, branchCode: reqBranchCode,
    startDate, address, email: rawEmail, baseSalaryPerSession,
  } = req.body || {};

  if (!name || !phone) {
    const err = new Error('Vui lòng nhập Tên và Số điện thoại');
    err.status = 400;
    throw err;
  }

  const emailTrim = (rawEmail || '').trim();
  const email = emailTrim && emailTrim !== 'email@example.com' ? emailTrim : undefined;

  try {
    await assertUniqueContact({ phone, zalo: phone, email });
  } catch (dupErr) {
    if (dupErr.status === 409) throw dupErr;
    throw dupErr;
  }

  if (password && String(password).trim().length > 0 && String(password).trim().length < 6) {
    const err = new Error('Mật khẩu phải ít nhất 6 ký tự');
    err.status = 400;
    throw err;
  }

  let finalBranchId = null;
  let finalBranchCode = '';
  if (req.userBranchId) {
    finalBranchId = req.userBranchId;
    finalBranchCode = req.userBranchCode || '';
  } else if (reqBranchId) {
    finalBranchId = reqBranchId;
    finalBranchCode = reqBranchCode || '';
  }

  const normalizedSubjectIds = Array.isArray(subjectIds)
    ? [...new Set(subjectIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  const plainPassword = password && String(password).trim()
    ? String(password).trim()
    : generateTempPassword(8);

  const actor = req.user || {};

  try {
    const teacher = await withTransaction(async (session) => {
      const [doc] = await Teacher.create([{
        name,
        phone,
        email,
        specialty: specialty || normalizedSubjectIds.join(', '),
        subjectIds: normalizedSubjectIds,
        startDate: startDate || Date.now(),
        address: address || '',
        password: plainPassword,
        status: status || 'inactive',
        testStatus: null,
        role: 'teacher',
        isFirstLogin: true,
        branchId: finalBranchId,
        branchCode: finalBranchCode,
        baseSalaryPerSession: Math.max(0, Number(baseSalaryPerSession) || 0),
      }], { session });

      await OutboxEvent.create([{
        eventType: 'TeacherCreatedEvent',
        aggregateType: 'Teacher',
        aggregateId: doc._id,
        payload: {
          teacherId: doc._id,
          name: doc.name,
          branchCode: doc.branchCode,
          phone: doc.phone,
          email: doc.email,
          plainPassword,
          createdBy: actor.id || actor._id || null,
        },
        status: 'PENDING',
        branchId: finalBranchId || undefined,
        actorId: actor._id || undefined,
      }], { session });

      return doc;
    });

    return {
      status: 201,
      body: {
        success: true,
        message: `Đã tạo giảng viên ${teacher.name}`,
        data: {
          ...teacher.toObject(),
          password: undefined,
          tempPassword: plainPassword,
          // Side-effects deferred to outbox
          welcomeQueued: false,
          welcomeNotified: false,
        },
      },
    };
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = 'Số điện thoại đã tồn tại';
    }
    if (error.name === 'ValidationError') {
      error.status = 400;
      error.message = Object.values(error.errors || {}).map((e) => e.message).join(', ') || 'Dữ liệu không hợp lệ';
    }
    logger.error({ err: error.message }, '[CQRS] createTeacher failed');
    throw error;
  }
}

module.exports = { createTeacherCqrs };
