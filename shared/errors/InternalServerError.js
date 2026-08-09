const AppError = require('./AppError');

class InternalServerError extends AppError {
  constructor(message = 'Lỗi hệ thống nội bộ', details = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

module.exports = InternalServerError;
