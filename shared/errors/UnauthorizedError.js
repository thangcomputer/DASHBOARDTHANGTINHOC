const AppError = require('./AppError');

class UnauthorizedError extends AppError {
  constructor(message = 'Chưa đăng nhập hoặc phiên làm việc hết hạn', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

module.exports = UnauthorizedError;
