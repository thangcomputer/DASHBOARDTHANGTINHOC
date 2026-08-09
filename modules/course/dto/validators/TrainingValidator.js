'use strict';

const { z } = require('zod');
const ValidationException = require('../../../../shared/errors/ValidationException');
const ValidationMetrics = require('../../../../shared/metrics/ValidationMetrics');

class TrainingValidator {

  static validateGet_courses_id_lessons(req) {
    const schema = z.object({
    id: z.any().optional(),
    }).passthrough();
    
    const start = Date.now();
    const payload = { ...req.body, ...req.query, ...req.params, file: req.file, files: req.files, user: req.user, currentUser: req.currentUser };
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      ValidationMetrics.logFailure('course', 'Get_courses_id_lessonsQuery', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({ field: err.path.join('.'), code: 'invalid_field', message: err.message }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('course', 'Get_courses_id_lessonsQuery', Date.now() - start);
    return Object.freeze(result.data);
  }
}

module.exports = TrainingValidator;
