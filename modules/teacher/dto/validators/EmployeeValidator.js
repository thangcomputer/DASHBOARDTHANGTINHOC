'use strict';

const { z } = require('zod');
const ValidationException = require('../../../../shared/errors/ValidationException');
const ValidationMetrics = require('../../../../shared/metrics/ValidationMetrics');

class EmployeeValidator {

  static validateGet_root(req) {
    const schema = z.object({
    position: z.any().optional(),
    search: z.any().optional(),
    status: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('teacher', 'Get_rootQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('teacher', 'Get_rootQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_root(req) {
    const schema = z.object({
    gender: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('teacher', 'Post_rootCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('teacher', 'Post_rootCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePut_id(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('teacher', 'Put_idCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('teacher', 'Put_idCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateDelete_id(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('teacher', 'Delete_idCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('teacher', 'Delete_idCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_id_pay(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('teacher', 'Post_id_payCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('teacher', 'Post_id_payCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_id_payroll(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('teacher', 'Get_id_payrollQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('teacher', 'Get_id_payrollQuery', Date.now() - start);
    return Object.freeze(result.data);
  }
}

module.exports = EmployeeValidator;
