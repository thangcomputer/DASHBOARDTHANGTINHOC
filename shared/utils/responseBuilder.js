/**
 * Standard API Response Builder.
 */
const responseBuilder = {
  success: (data = null, message = 'Thao tác thành công', meta = null) => {
    return {
      success: true,
      data,
      message,
      ...(meta && { meta }),
    };
  },

  error: (message = 'Thao tác thất bại', errorCode = 'INTERNAL_ERROR', details = null) => {
    return {
      success: false,
      message,
      code: errorCode,
      ...(details && { errors: details }),
    };
  },
};

module.exports = responseBuilder;
