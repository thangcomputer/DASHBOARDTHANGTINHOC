const AppError = require('./AppError');

class ValidationException extends AppError {
  constructor(message = 'Invalid request', errors = []) {
    super(message, 400, 'VALIDATION_ERROR', errors);
    this.errors = errors;
  }
}

module.exports = ValidationException;
