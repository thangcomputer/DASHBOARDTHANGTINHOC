/**
 * Assignment writable DTOs — explicit allowlist (no req.body spread).
 * assignedBy* is always server-set.
 */
const CREATE_FIELDS = [
  'courseId',
  'studentId',
  'teacherId',
  'title',
  'description',
  'fileUrl',
  'deadline',
  'status',
];

const UPDATE_FIELDS = [
  'courseId',
  'studentId',
  'teacherId',
  'title',
  'description',
  'fileUrl',
  'deadline',
  'status',
];

function pickAssignmentCreate(body = {}) {
  const out = {};
  for (const key of CREATE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function pickAssignmentUpdate(body = {}) {
  const out = {};
  for (const key of UPDATE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

module.exports = {
  CREATE_FIELDS,
  UPDATE_FIELDS,
  pickAssignmentCreate,
  pickAssignmentUpdate,
};
