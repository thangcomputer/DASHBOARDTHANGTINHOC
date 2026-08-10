'use strict';

const {
  isFinanceCqrs,
  isTeacherCqrs,
  isInvoiceCqrs,
  isStudentCreateCqrs,
  requireReplicaOrThrow,
} = require('./flags');

function cqrsOffMessage(kind) {
  const map = {
    finance: 'Luồng tài chính CQRS chưa bật. Bật replica set hoặc ENABLE_CQRS_FINANCE=true.',
    teacher: 'Luồng tạo GV CQRS chưa bật. Bật replica set hoặc ENABLE_CQRS_TEACHER=true.',
    invoice: 'Luồng tạo HĐ CQRS chưa bật. Bật replica set hoặc ENABLE_CQRS_INVOICE=true.',
    student: 'Luồng tạo HV CQRS chưa bật. Bật replica set hoặc ENABLE_CQRS_STUDENT_CREATE=true.',
  };
  return map[kind] || 'Luồng CQRS chưa bật. Kiểm tra replica set / ENABLE_CQRS.';
}

function assertCqrsEnabled(checker, kind) {
  if (!checker()) {
    const err = new Error(cqrsOffMessage(kind));
    err.status = 503;
    err.code = 'CQRS_DISABLED';
    throw err;
  }
  requireReplicaOrThrow();
}

function assertFinanceCqrs() {
  assertCqrsEnabled(isFinanceCqrs, 'finance');
}

/**
 * Hard gate — only for routes that are CQRS-only (no legacy).
 * Prefer requireStudentCreateCqrsSoft on POST /students so legacy can run when flag is off.
 */
function makeMiddleware(checker, kind) {
  return function requireCqrs(req, res, next) {
    try {
      assertCqrsEnabled(checker, kind);
      return next();
    } catch (err) {
      return res.status(err.status || 503).json({ success: false, message: err.message });
    }
  };
}

/**
 * Soft gate for student create: never 503 when CQRS is off.
 * Sets req.cqrsStudentCreate so the handler can choose CQRS vs legacy.
 */
function requireStudentCreateCqrsSoft(req, res, next) {
  try {
    if (!isStudentCreateCqrs()) {
      req.cqrsStudentCreate = false;
      return next();
    }
    requireReplicaOrThrow();
    req.cqrsStudentCreate = true;
    return next();
  } catch (err) {
    return res.status(err.status || 503).json({ success: false, message: err.message });
  }
}

module.exports = {
  cqrsOffMessage,
  assertCqrsEnabled,
  assertFinanceCqrs,
  requireFinanceCqrs: makeMiddleware(isFinanceCqrs, 'finance'),
  requireTeacherCqrs: makeMiddleware(isTeacherCqrs, 'teacher'),
  requireInvoiceCqrs: makeMiddleware(isInvoiceCqrs, 'invoice'),
  /** @deprecated Prefer requireStudentCreateCqrsSoft — hard gate breaks create when flag=false */
  requireStudentCreateCqrs: requireStudentCreateCqrsSoft,
  requireStudentCreateCqrsSoft,
  requireStudentCreateCqrsHard: makeMiddleware(isStudentCreateCqrs, 'student'),
};
