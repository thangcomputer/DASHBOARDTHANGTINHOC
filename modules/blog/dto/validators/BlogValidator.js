'use strict';

const { z } = require('zod');
const ValidationException = require('../../../../shared/errors/ValidationException');
const ValidationMetrics = require('../../../../shared/metrics/ValidationMetrics');

class BlogValidator {

  static validateGet_posts(req) {
    const schema = z.object({
    limit: z.any().optional(),
    page: z.any().optional(),
    q: z.any().optional(),
    target: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Get_postsQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Get_postsQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_posts_slugOrId(req) {
    const schema = z.object({
    manage: z.any().optional(),
    slugOrId: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Get_posts_slugOrIdQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Get_posts_slugOrIdQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_manage_posts(req) {
    const schema = z.object({
    limit: z.any().optional(),
    page: z.any().optional(),
    q: z.any().optional(),
    status: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Get_manage_postsQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Get_manage_postsQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateGet_manage_posts_id(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Get_manage_posts_idQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Get_manage_posts_idQuery', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_manage_posts(req) {
    const schema = z.object({
    attachments: z.any().optional(),
    content: z.any().optional(),
    contentHtml: z.any().optional(),
    excerpt: z.any().optional(),
    slug: z.any().optional(),
    status: z.any().optional(),
    targetAudience: z.any().optional(),
    thumbnailUrl: z.any().optional(),
    title: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Post_manage_postsCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Post_manage_postsCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePut_manage_posts_id(req) {
    const schema = z.object({
    attachments: z.any().optional(),
    content: z.any().optional(),
    contentHtml: z.any().optional(),
    excerpt: z.any().optional(),
    slug: z.any().optional(),
    status: z.any().optional(),
    targetAudience: z.any().optional(),
    thumbnailUrl: z.any().optional(),
    title: z.any().optional(),
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Put_manage_posts_idCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Put_manage_posts_idCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_manage_posts_id_publish(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Post_manage_posts_id_publishCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Post_manage_posts_id_publishCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validatePost_manage_posts_id_hide(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Post_manage_posts_id_hideCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Post_manage_posts_id_hideCommand', Date.now() - start);
    return Object.freeze(result.data);
  }

  static validateDelete_manage_posts_id(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('blog', 'Delete_manage_posts_idCommand', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('blog', 'Delete_manage_posts_idCommand', Date.now() - start);
    return Object.freeze(result.data);
  }
}

module.exports = BlogValidator;
