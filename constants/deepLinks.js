/**
 * Deep link registry — path chuẩn cho Notification Center (Phase 5 / ADR 0005).
 * Client navigate(n.path || resolveDeepLink(templateCode, data)).
 */
const DEEP_LINKS = Object.freeze({
  STUDENT_HOME: '/student',
  STUDENT_SCHEDULE: '/student#schedule',
  STUDENT_ASSIGNMENTS: '/student#assignments',
  STUDENT_EXAM: '/student/exam',
  STUDENT_EXAM_SUBJECT: '/student/exam/:subjectId',
  STUDENT_PROFILE: '/student#profile',
  TEACHER_HOME: '/teacher',
  TEACHER_SCHEDULE: '/teacher#schedule',
  TEACHER_FINANCE: '/teacher/finance',
  TEACHER_STUDENTS: '/teacher#students',
  ADMIN_STUDENTS: '/admin/students',
  ADMIN_SCHEDULE: '/admin/schedule',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  NOTIFICATION_CENTER: '/notifications',
});

/**
 * @param {string} key - key trong DEEP_LINKS hoặc path tuyệt đối bắt đầu bằng /
 * @param {Record<string, string|number>} [params] - thay :id trong path nếu có
 */
function resolveDeepLink(key, params = {}) {
  let path = DEEP_LINKS[key] || (String(key || '').startsWith('/') ? key : '');
  if (!path) return '';
  Object.entries(params || {}).forEach(([k, v]) => {
    path = path.replace(`:${k}`, encodeURIComponent(String(v)));
  });
  return path;
}

module.exports = {
  DEEP_LINKS,
  resolveDeepLink,
};
