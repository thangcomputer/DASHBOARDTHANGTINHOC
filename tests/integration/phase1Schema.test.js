/**
 * Phase 1 — schema paths (load models, không cần Mongo đang chạy).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

test('Course soft-delete + tenantId paths', () => {
  const Course = require('../../models/Course');
  const paths = Course.schema.paths;
  assert.ok(paths.deletedAt);
  assert.ok(paths.deletedBy);
  assert.ok(paths.deleteReason);
  assert.ok(paths.tenantId);
});

test('Student displayCode + enrollmentCode paths', () => {
  const Student = require('../../models/Student');
  assert.ok(Student.schema.paths.displayCode);
  assert.ok(Student.schema.paths.tenantId);
  const en = Student.schema.path('enrollments');
  assert.ok(en);
  assert.ok(en.schema.paths.enrollmentCode);
});

test('Teacher displayCode + tenantId paths', () => {
  const Teacher = require('../../models/Teacher');
  assert.ok(Teacher.schema.paths.displayCode);
  assert.ok(Teacher.schema.paths.tenantId);
});

test('AuditLog / DomainOutbox / BranchCodeCounter models load', () => {
  const AuditLog = require('../../models/AuditLog');
  const DomainOutbox = require('../../models/DomainOutbox');
  const BranchCodeCounter = require('../../models/BranchCodeCounter');
  assert.equal(AuditLog.modelName, 'AuditLog');
  assert.ok(AuditLog.schema.paths.action);
  assert.ok(AuditLog.schema.paths.oldValue);
  assert.ok(AuditLog.schema.paths.newValue);
  assert.equal(DomainOutbox.modelName, 'DomainOutbox');
  assert.ok(DomainOutbox.schema.paths.eventId);
  assert.equal(BranchCodeCounter.modelName, 'BranchCodeCounter');
  assert.ok(BranchCodeCounter.schema.paths.seq);
});
