const AppError = require('./AppError');

class ValidationError extends AppError {
  constructor(message = 'Dữ liệu đầu vào không hợp lệ', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

module.exports = ValidationError;
