const CQRSTeacherController = require('../controllers/CQRSTeacherController');

/**
 * Strangler for teacher create.
 * Production path: routes/teacherRoutes.js keeps legacy inline when flag is off,
 * and calls CQRSTeacherController when ENABLE_CQRS_TEACHER=true.
 * This module is used by audit scripts / modules/teacher/routes.
 */
module.exports = {
  post_root: async (req, res, next) => {
    if (process.env.ENABLE_CQRS_TEACHER === 'true' || process.env.ENABLE_CQRS_TEACHER === '1') {
      return CQRSTeacherController.post_root(req, res, next);
    }
    // Legacy fallback for scripts that mount module routes (not server.js)
    const teacherController = require('../controllers/TeacherController');
    return teacherController.post_root(req, res, next);
  },
};
