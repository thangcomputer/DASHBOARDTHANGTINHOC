const AppError = require('./AppError');

class ForbiddenError extends AppError {
  constructor(message = 'Không có quyền thực hiện hành động này', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

module.exports = ForbiddenError;
