const AppError = require('../AppError');
const ValidationError = require('../ValidationError');

describe('AppError & Subclasses', () => {
  test('should create custom AppError with parameters', () => {
    const err = new AppError('Operational error occurred', 400, 'BAD_REQ_CODE', { field: 'name' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('Operational error occurred');
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('BAD_REQ_CODE');
    expect(err.details).toEqual({ field: 'name' });
    expect(err.isOperational).toBe(true);
    expect(err.stack).toBeDefined();
  });

  test('should create ValidationError default parameters', () => {
    const err = new ValidationError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('Dữ liệu đầu vào không hợp lệ');
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('VALIDATION_ERROR');
    expect(err.details).toBeNull();
  });
});
