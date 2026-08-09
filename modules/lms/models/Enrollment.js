'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');

class Enrollment {
  constructor(data) {
    this._id = data.id || data._id;
    this.courseId = data.courseId;
    this.studentId = data.studentId;
    this.status = data.status || 'PENDING';
    this.paymentStatus = data.paymentStatus || 'UNPAID';
    this.tenantId = data.tenantId;
    this.branchId = data.branchId;
  }
  get id() { return this._id; }
  
  activate() {
    if (this.paymentStatus !== 'PAID') {
      throw new AppError('PaymentRequired', 'Enrollment must be paid before activation.');
    }
    if (this.status === 'ACTIVE') {
      throw new AppError('InvalidStatusTransition', 'Enrollment is already active.');
    }
    this.status = 'ACTIVE';
    return {
      type: 'EnrollmentActivated',
      aggregateId: this.id,
      payload: { courseId: this.courseId, studentId: this.studentId, tenantId: this.tenantId },
      occurredAt: new Date()
    };
  }
}
module.exports = Enrollment;
