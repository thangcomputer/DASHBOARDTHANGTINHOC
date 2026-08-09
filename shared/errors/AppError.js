/**
 * Base Operational Error Class
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Indicates this is a trusted operational error
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
