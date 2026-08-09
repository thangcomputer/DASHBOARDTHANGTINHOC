'use strict';

const { z } = require('zod');
const ValidationException = require('../../../../shared/errors/ValidationException');
const ValidationMetrics = require('../../../../shared/metrics/ValidationMetrics');

class InvoiceValidator {

  static validateGet_root(req) {
    const schema = z.object({
      query: z.object({
        studentId: z.string().optional(),
        search: z.string().optional(),
        branchId: z.string().optional(),
        paymentMethod: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }).passthrough(),
      branchFilter: z.any().optional(),
      currentUser: z.any().optional(),
    });
    
    const start = Date.now();
    const payload = {
      query: req.query || {},
      branchFilter: req.branchFilter || {},
      currentUser: req.currentUser || req.user
    };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('invoice', 'Get_rootQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Get_rootQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_root(req) {
    const schema = z.object({
      body: z.object({
        hocVienId: z.string().min(1, 'Học viên ID là bắt buộc'),
        ghiChu: z.string().optional(),
      }).passthrough(),
      currentUser: z.any().optional(),
      app: z.any().optional(),
    });
    
    const start = Date.now();
    const payload = {
      body: req.body || {},
      currentUser: req.currentUser || req.user,
      app: req.app
    };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('invoice', 'Post_rootCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Post_rootCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_stats(req) {
    const schema = z.object({
    branch_id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('invoice', 'Get_statsQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Get_statsQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_id(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('invoice', 'Get_idQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Get_idQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_id_pdf(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('invoice', 'Get_id_pdfQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Get_id_pdfQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_id_pdf_queue(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('invoice', 'Post_id_pdf_queueCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Post_id_pdf_queueCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_id_email(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('invoice', 'Post_id_emailCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Post_id_emailCommand', Date.now() - start);
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
      ValidationMetrics.logFailure('invoice', 'Delete_idCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('invoice', 'Delete_idCommand', Date.now() - start);
    return Object.freeze(result.data);
  }
}

module.exports = InvoiceValidator;
