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
    finance: 'Luồng tài chính cũ đã tắt. Bật replica set (MONGODB_URI=?replicaSet=) hoặc ENABLE_CQRS_FINANCE=true.',
    teacher: 'Luồng tạo GV cũ đã tắt. Bật replica set hoặc ENABLE_CQRS_TEACHER=true.',
    invoice: 'Luồng tạo HĐ cũ đã tắt. Bật replica set hoặc ENABLE_CQRS_INVOICE=true.',
    student: 'Luồng tạo HV cũ đã tắt. Bật replica set hoặc ENABLE_CQRS_STUDENT_CREATE=true.',
  };
  return map[kind] || 'Luồng CQRS đã tắt. Kiểm tra replica set / ENABLE_CQRS.';
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

module.exports = {
  cqrsOffMessage,
  assertCqrsEnabled,
  assertFinanceCqrs,
  requireFinanceCqrs: makeMiddleware(isFinanceCqrs, 'finance'),
  requireTeacherCqrs: makeMiddleware(isTeacherCqrs, 'teacher'),
  requireInvoiceCqrs: makeMiddleware(isInvoiceCqrs, 'invoice'),
  requireStudentCreateCqrs: makeMiddleware(isStudentCreateCqrs, 'student'),
};
