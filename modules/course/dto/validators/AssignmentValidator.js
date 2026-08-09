'use strict';

const { z } = require('zod');
const ValidationException = require('../../../../shared/errors/ValidationException');
const ValidationMetrics = require('../../../../shared/metrics/ValidationMetrics');

class AssignmentValidator {

  static validatePost_upload(req) {
    const schema = z.object({

    file: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('course', 'Post_uploadCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Post_uploadCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_course_courseId(req) {
    const schema = z.object({
    courseId: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('course', 'Get_course_courseIdQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Get_course_courseIdQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_student_studentId_course_courseId(req) {
    const schema = z.object({
    courseId: z.any().optional(),
    studentId: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('course', 'Get_student_studentId_course_courseIdQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Get_student_studentId_course_courseIdQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_root(req) {
    const schema = z.object({
    courseId: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('course', 'Post_rootCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Post_rootCommand', Date.now() - start);
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
      ValidationMetrics.logFailure('course', 'Put_idCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Put_idCommand', Date.now() - start);
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
      ValidationMetrics.logFailure('course', 'Delete_idCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Delete_idCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_id_submit(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('course', 'Post_id_submitCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Post_id_submitCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePut_submissions_submissionId_grade(req) {
    const schema = z.object({
    submissionId: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('course', 'Put_submissions_submissionId_gradeCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Put_submissions_submissionId_gradeCommand', Date.now() - start);
    return Object.freeze(result.data);
  }
}

module.exports = AssignmentValidator;
