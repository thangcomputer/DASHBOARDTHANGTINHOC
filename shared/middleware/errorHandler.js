const responseBuilder = require('../utils/responseBuilder');
const logger = require('../logger/logger');
const correlationContext = require('../context/correlationContext');

/**
 * Central Global Error Handler middleware.
 * Production-safe JSON formatter.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Identify operational vs programming errors
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Lỗi hệ thống nội bộ';
  let details = err.details || null;

  // If it's mongoose validation or cast error, normalize it to AppError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Dữ liệu đầu vào không hợp lệ';
    details = Object.keys(err.errors).map((key) => ({
      field: key,
      message: err.errors[key].message,
    }));
  } else if (err.name === 'CastError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = `Tài nguyên không tìm thấy (Mã: ${err.value})`;
  } else if (err.code === 11000) {
    // Mongo duplicate key error
    statusCode = 409;
    errorCode = 'CONFLICT';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Dữ liệu '${field}' đã tồn tại và không thể trùng lặp`;
    details = [{ field, message: `Giá trị '${err.keyValue[field]}' đã được đăng ký` }];
  }

  const isOperational = err.isOperational || (statusCode !== 500);

  // 2. Log error
  if (statusCode >= 500) {
    logger.error({
      err: {
        message: err.message,
        stack: err.stack,
        ...err,
      },
      req: {
        url: req.originalUrl,
        method: req.method,
        id: req.id,
      },
    }, 'Unexpected internal server error');
  } else {
    logger.warn({
      statusCode,
      errorCode,
      message,
      url: req.originalUrl,
      method: req.method,
    }, 'Operational client error');
  }

  // 3. Hide internal message details in production if not operational
  if (isProd && !isOperational) {
    message = 'Có lỗi xảy ra trên hệ thống. Vui lòng liên hệ Admin hoặc thử lại sau.';
    details = null;
  }

  // 4. Return standard JSON
  const response = responseBuilder.error(message, errorCode, details);

  const store = correlationContext.getStore();
  const requestId = store?.requestId || req.requestId || req.id;
  const correlationId = store?.correlationId || req.correlationId;

  if (requestId) response.requestId = requestId;
  if (correlationId) response.correlationId = correlationId;

  // Expose stack trace in development for local debugging
  if (!isProd) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
