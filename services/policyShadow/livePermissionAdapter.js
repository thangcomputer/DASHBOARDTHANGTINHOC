/**
 * Live permission adapter for Policy shadow (Wave 6+).
 * Authority: constants/permissions.js — NOT shared/constants/permissions.js.
 */
const { PERMISSIONS } = require('../../constants/permissions');

const TEACHER_WRITE_LIVE = PERMISSIONS.MANAGE_TEACHERS;
const QUIZ_ADMIN_READ_LIVE = PERMISSIONS.MANAGE_TRAINING;
const STUDENT_READ_LIVE = PERMISSIONS.MANAGE_STUDENTS;
const STUDENT_WRITE_LIVE = PERMISSIONS.MANAGE_STUDENTS;
const STUDENT_TRAINING_LIVE = PERMISSIONS.MANAGE_STUDENT_TRAINING;
const FINANCE_WRITE_LIVE = PERMISSIONS.MANAGE_FINANCE;
const VIEW_BRANCH_REVENUE_LIVE = PERMISSIONS.VIEW_BRANCH_REVENUE;
const SYSTEM_SETTINGS_LIVE = PERMISSIONS.SYSTEM_SETTINGS;
const MANAGE_TRAINING_LIVE = PERMISSIONS.MANAGE_TRAINING;
const MANAGE_STAFF_LIVE = PERMISSIONS.MANAGE_STAFF;
const MANAGE_HR_LIVE = PERMISSIONS.MANAGE_HR;
const MANAGE_BLOG_LIVE = PERMISSIONS.MANAGE_BLOG;

function toPolicyPermission(livePermission) {
  if (livePermission === PERMISSIONS.MANAGE_TEACHERS) return TEACHER_WRITE_LIVE;
  if (livePermission === PERMISSIONS.VIEW_TEACHERS) return PERMISSIONS.VIEW_TEACHERS;
  if (livePermission === PERMISSIONS.MANAGE_TRAINING) return QUIZ_ADMIN_READ_LIVE;
  if (livePermission === PERMISSIONS.MANAGE_STUDENTS) return STUDENT_WRITE_LIVE;
  if (livePermission === PERMISSIONS.MANAGE_STUDENT_TRAINING) return STUDENT_TRAINING_LIVE;
  if (livePermission === PERMISSIONS.MANAGE_FINANCE) return FINANCE_WRITE_LIVE;
  if (livePermission === PERMISSIONS.VIEW_BRANCH_REVENUE) return VIEW_BRANCH_REVENUE_LIVE;
  if (livePermission === PERMISSIONS.SYSTEM_SETTINGS) return SYSTEM_SETTINGS_LIVE;
  if (livePermission === PERMISSIONS.MANAGE_STAFF) return MANAGE_STAFF_LIVE;
  if (livePermission === PERMISSIONS.MANAGE_HR) return MANAGE_HR_LIVE;
  if (livePermission === PERMISSIONS.MANAGE_BLOG) return MANAGE_BLOG_LIVE;
  return String(livePermission || '');
}

function actorHasLivePermission(actor, livePermission) {
  if (!actor) return false;
  if (actor.id === 'admin' || actor._id === 'admin') return true;
  if (actor.adminRole === 'SUPER_ADMIN') return true;
  const perms = Array.isArray(actor.permissions) ? actor.permissions : [];
  return perms.includes(toPolicyPermission(livePermission));
}

function actorHasAnyLivePermission(actor, livePermissions) {
  if (!actor) return false;
  if (actor.id === 'admin' || actor._id === 'admin') return true;
  if (actor.adminRole === 'SUPER_ADMIN') return true;
  const list = (livePermissions || []).map(toPolicyPermission);
  const perms = Array.isArray(actor.permissions) ? actor.permissions : [];
  return list.some((p) => perms.includes(p));
}

module.exports = {
  TEACHER_WRITE_LIVE,
  QUIZ_ADMIN_READ_LIVE,
  STUDENT_READ_LIVE,
  STUDENT_WRITE_LIVE,
  STUDENT_TRAINING_LIVE,
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
  SYSTEM_SETTINGS_LIVE,
  MANAGE_TRAINING_LIVE,
  MANAGE_STAFF_LIVE,
  MANAGE_HR_LIVE,
  MANAGE_BLOG_LIVE,
  toPolicyPermission,
  actorHasLivePermission,
  actorHasAnyLivePermission,
  PERMISSIONS,
};
