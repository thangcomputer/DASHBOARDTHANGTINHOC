'use strict';

const { z } = require('zod');
const ValidationException = require('../../../../shared/errors/ValidationException');
const ValidationMetrics = require('../../../../shared/metrics/ValidationMetrics');

class EnrollmentValidator {

  static validatePost_id_enrollments(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('enrollment', 'Post_id_enrollmentsCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('enrollment', 'Post_id_enrollmentsCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePut_id_enrollments_enrollmentId_settings(req) {
    const schema = z.object({
    enrollmentId: z.any().optional(),
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('enrollment', 'Put_id_enrollments_enrollmentId_settingsCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('enrollment', 'Put_id_enrollments_enrollmentId_settingsCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePut_id_enrollments_enrollmentId_pay(req) {
    const schema = z.object({
    enrollmentId: z.any().optional(),
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('enrollment', 'Put_id_enrollments_enrollmentId_payCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('enrollment', 'Put_id_enrollments_enrollmentId_payCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateDelete_id_enrollments_enrollmentId(req) {
    const schema = z.object({
    refundAmount: z.any().optional(),
    enrollmentId: z.any().optional(),
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('enrollment', 'Delete_id_enrollments_enrollmentIdCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('enrollment', 'Delete_id_enrollments_enrollmentIdCommand', Date.now() - start);
    return Object.freeze(result.data);
  }
}

module.exports = EnrollmentValidator;
