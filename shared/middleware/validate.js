const ValidationError = require('../errors/ValidationError');

/**
 * Reusable schema validation middleware (supports Joi & Zod schemas).
 * Validates req.body, req.query, or req.params.
 *
 * @param {Object} schema - Joi or Zod validation schema
 * @param {string} source - 'body' | 'query' | 'params' (default: 'body')
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    if (!schema) {
      return next();
    }

    // Support Joi Schemas
    if (typeof schema.validate === 'function') {
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: true,
      });

      if (error) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));
        return next(new ValidationError('Dữ liệu đầu vào không hợp lệ', details));
      }

      req[source] = value; // Override with sanitized values
      return next();
    }

    // Support Zod Schemas
    if (typeof schema.safeParse === 'function') {
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(new ValidationError('Dữ liệu đầu vào không hợp lệ', details));
      }

      req[source] = result.data; // Override with sanitized values
      return next();
    }

    return next();
  };
};

module.exports = validate;
