const AppError = require('./AppError');

class ConflictError extends AppError {
  constructor(message = 'Xung đột dữ liệu hoặc bản ghi trùng lặp', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

module.exports = ConflictError;
