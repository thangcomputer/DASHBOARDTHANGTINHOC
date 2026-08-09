'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');

class Course {
  constructor(data) {
    this._id = data.id || data._id;
    this.title = data.title;
    this.status = data.status || 'DRAFT';
    this.tenantId = data.tenantId;
    this.branchId = data.branchId;
    this.instructorId = data.instructorId;
    this.capacity = data.capacity || 50;
    this.enrolledCount = data.enrolledCount || 0;
  }
  get id() { return this._id; }
  
  publish() {
    if (this.status === 'PUBLISHED') {
      throw new AppError('InvalidStatusTransition', 'Course is already published.');
    }
    this.status = 'PUBLISHED';
    return {
      type: 'CoursePublished',
      aggregateId: this.id,
      payload: { tenantId: this.tenantId, branchId: this.branchId },
      occurredAt: new Date()
    };
  }

  archive() {
    if (this.status === 'ARCHIVED') {
      throw new AppError('InvalidStatusTransition', 'Course is already archived.');
    }
    this.status = 'ARCHIVED';
    return {
      type: 'CourseArchived',
      aggregateId: this.id,
      payload: { tenantId: this.tenantId, branchId: this.branchId },
      occurredAt: new Date()
    };
  }
}
module.exports = Course;
