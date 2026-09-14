const test = require('node:test');
const assert = require('node:assert/strict');

function syncPlan(role, isAdmin = false) {
  return {
    scheduleEndpoint: role === 'teacher' ? 'teacher-scoped' : role === 'student' ? 'student-scoped' : 'admin-list',
    fetchTeacherTraining: isAdmin || role === 'teacher',
    fetchStudentTraining: isAdmin || role === 'student',
  };
}

test('teacher sync uses scoped schedules and skips student training payload', () => {
  const plan = syncPlan('teacher');
  assert.equal(plan.scheduleEndpoint, 'teacher-scoped');
  assert.equal(plan.fetchTeacherTraining, true);
  assert.equal(plan.fetchStudentTraining, false);
});

test('student sync skips teacher training payload', () => {
  const plan = syncPlan('student');
  assert.equal(plan.scheduleEndpoint, 'student-scoped');
  assert.equal(plan.fetchTeacherTraining, false);
  assert.equal(plan.fetchStudentTraining, true);
});
