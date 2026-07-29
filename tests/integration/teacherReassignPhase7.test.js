/**
 * Phase 7 — Teacher reassignment / payroll split / progress preserve.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeCompletedSplitByTeacher,
  assertProgressUntouched,
} = require('../../services/teacherReassignmentService');

test('computeCompletedSplitByTeacher: 8 GV-A + 12 GV-B = 20 completed', () => {
  const sessions = [];
  for (let i = 0; i < 8; i += 1) {
    sessions.push({ teacherId: 'teacherA', status: 'completed' });
  }
  for (let i = 0; i < 12; i += 1) {
    sessions.push({ teacherId: 'teacherB', status: 'completed' });
  }
  // future scheduled must not count
  sessions.push({ teacherId: 'teacherB', status: 'scheduled' });
  sessions.push({ teacherId: 'teacherA', status: 'cancelled' });

  const split = computeCompletedSplitByTeacher(sessions);
  assert.equal(split.teacherA, 8);
  assert.equal(split.teacherB, 12);
});

test('computeCompletedSplitByTeacher: only completed count toward payroll', () => {
  const split = computeCompletedSplitByTeacher([
    { teacherId: 'A', status: 'completed' },
    { teacherId: 'A', status: 'scheduled' },
    { teacherId: 'B', status: 'no_show' },
  ]);
  assert.equal(split.A, 1);
  assert.equal(split.B, undefined);
});

test('assertProgressUntouched passes when same', () => {
  assert.doesNotThrow(() => assertProgressUntouched(
    { completedSessions: 8, remainingSessions: 12 },
    { completedSessions: 8, remainingSessions: 12 },
  ));
});

test('assertProgressUntouched throws when completedSessions reset', () => {
  assert.throws(
    () => assertProgressUntouched(
      { completedSessions: 8, remainingSessions: 12 },
      { completedSessions: 0, remainingSessions: 12 },
    ),
    /completedSessions/,
  );
});

test('TeacherAssignmentSegment model loads', () => {
  const TeacherAssignmentSegment = require('../../models/TeacherAssignmentSegment');
  assert.equal(TeacherAssignmentSegment.modelName, 'TeacherAssignmentSegment');
  assert.ok(TeacherAssignmentSegment.schema.paths.completedSessionsAtStart);
  assert.ok(TeacherAssignmentSegment.schema.paths.endedAt);
});

test('ScheduleHistory supports TEACHER_REASSIGNED', () => {
  const ScheduleHistory = require('../../models/ScheduleHistory');
  const actionPath = ScheduleHistory.schema.path('action');
  assert.ok(actionPath.enumValues.includes('TEACHER_REASSIGNED'));
  // scheduleId optional for summary reassignment logs
  assert.ok(ScheduleHistory.schema.paths.scheduleId);
});

test('assign-teacher route uses reassignTeacher service', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes('reassignTeacher'));
  assert.ok(src.includes('progressPreserved'));
  assert.ok(src.includes('teacherReassignmentService'));
});

test('scenario ADR: after 8 completed, new GV owns only future — split stays 8 for old', () => {
  // Mô phỏng: 8 buổi A đã dạy + 0 buổi B; 12 scheduled không tính
  const afterReassign = [];
  for (let i = 0; i < 8; i += 1) afterReassign.push({ teacherId: 'A', status: 'completed' });
  for (let i = 0; i < 12; i += 1) afterReassign.push({ teacherId: 'B', status: 'scheduled' });
  const split = computeCompletedSplitByTeacher(afterReassign);
  assert.equal(split.A, 8);
  assert.equal(split.B, undefined);
  // HV vẫn thấy đã học 8
  const studentProgress = { completedSessions: 8, remainingSessions: 12 };
  assertProgressUntouched(studentProgress, { completedSessions: 8, remainingSessions: 12 });
});
