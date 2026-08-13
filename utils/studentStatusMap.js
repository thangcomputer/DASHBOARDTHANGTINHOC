'use strict';

/**
 * Map enrollment.status (enum) → Student.root status (Vietnamese labels).
 * Does not invent new labels; passes through known root statuses.
 */
function mapEnrollmentStatusToRoot(status) {
  const s = String(status || '').trim();
  if (s === 'active') return 'Đang học';
  if (s === 'completed') return 'Hoàn thành';
  if (s === 'Đang học' || s === 'Hoàn thành' || s === 'Chờ xếp lớp') return s;
  return s;
}

module.exports = { mapEnrollmentStatusToRoot };
