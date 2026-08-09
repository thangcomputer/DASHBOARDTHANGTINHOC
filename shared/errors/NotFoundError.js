const AppError = require('./AppError');

class NotFoundError extends AppError {
  constructor(message = 'Tài nguyên không tồn tại', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

module.exports = NotFoundError;
