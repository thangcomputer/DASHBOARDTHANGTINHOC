import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  expandStudentsForTeacher as expandClient,
  getActiveClientEnrollments,
} from '../../client/src/utils/enrollments.js';
import {
  getStudentScheduleGate,
  resolveEnrollmentProgress,
} from '../../client/src/utils/schedulingLimits.js';

const require = createRequire(import.meta.url);
const {
  expandStudentsForTeacher: expandServer,
  syncStudentFromPrimaryEnrollment,
} = require('../../services/enrollmentService.js');

const DAY = '2026-12-01';
const OID_OLD = '64f000000000000000000001';
const OID_NEW = '64f000000000000000000002';
const OID_T1 = '64f100000000000000000001';
const OID_T2 = '64f100000000000000000002';
const OID_STU = '64f200000000000000000001';

test('refunded old course + active new course: client expandStudentsForTeacher prioritizes active row & resets stale dropped root status', () => {
  const student = {
    _id: OID_STU,
    id: OID_STU,
    name: 'NGUYỄN VĂN A',
    status: 'Thôi học',
    course: 'Excel Cơ Bản',
    enrollments: [
      {
        _id: OID_OLD,
        courseName: 'Excel Cơ Bản',
        status: 'refunded',
        teacherId: OID_T1,
        teacherName: 'GV Cũ',
        totalSessions: 12,
        completedSessions: 5,
        remainingSessions: 7,
        isPrimary: false,
        registeredAt: '2026-09-01T00:00:00.000Z',
      },
      {
        _id: OID_NEW,
        courseName: 'Excel Cơ Bản',
        status: 'active',
        teacherId: OID_T1,
        teacherName: 'GV Cũ',
        totalSessions: 12,
        completedSessions: 0,
        remainingSessions: 12,
        isPrimary: false,
        registeredAt: '2026-11-10T00:00:00.000Z',
      },
    ],
  };

  const clientRows = expandClient([student], OID_T1);
  assert.equal(clientRows.length, 2);
  assert.equal(clientRows[0].enrollmentStatus, 'active');
  assert.equal(clientRows[0].interactionLocked, false);
  assert.equal(clientRows[0].status, 'Đang học');
  assert.equal(clientRows[1].enrollmentStatus, 'refunded');
  assert.equal(clientRows[1].interactionLocked, true);

  const serverRows = expandServer([student], OID_T1);
  assert.equal(serverRows.length, 2);
  assert.equal(serverRows[0].enrollmentStatus, 'active');
  assert.equal(serverRows[0].interactionLocked, false);
  assert.equal(serverRows[0].status, 'Đang học');
});

test('refunded old course completed schedules do NOT pollute new active enrollment gate in Inbox / StudentCard', () => {
  const student = {
    _id: OID_STU,
    id: OID_STU,
    name: 'TRẦN THỊ B',
    status: 'Thôi học',
    course: 'Tin học VP',
    enrollments: [
      {
        _id: OID_OLD,
        courseName: 'Tin học VP',
        status: 'cancelled',
        teacherId: OID_T1,
        totalSessions: 12,
        completedSessions: 12,
        remainingSessions: 0,
        registeredAt: '2026-08-01T00:00:00.000Z',
      },
      {
        _id: OID_NEW,
        courseName: 'Tin học VP',
        status: 'active',
        teacherId: OID_T1,
        totalSessions: 12,
        completedSessions: 0,
        remainingSessions: 12,
        registeredAt: '2026-11-10T00:00:00.000Z',
      },
    ],
  };

  const oldSchedules = Array.from({ length: 12 }, (_, i) => ({
    _id: `64f3000000000000000000${String(i).padStart(2, '0')}`,
    studentId: OID_STU,
    enrollmentId: i < 10 ? OID_OLD : null,
    course: 'Tin học VP',
    status: 'completed',
    date: `2026-08-${String(i + 2).padStart(2, '0')}`,
    createdAt: `2026-08-${String(i + 2).padStart(2, '0')}T10:00:00.000Z`,
  }));

  const rows = expandClient([student], OID_T1);
  const activeRow = rows[0];
  const gate = getStudentScheduleGate(activeRow, oldSchedules, DAY);
  const progress = resolveEnrollmentProgress(activeRow, oldSchedules);

  assert.equal(progress.used, 0);
  assert.equal(progress.remaining, 12);
  assert.equal(gate.canSchedule, true);

  // Even if called on raw unexpanded student object (no enrollmentStatus)
  const rawGate = getStudentScheduleGate(student, oldSchedules, DAY);
  assert.equal(rawGate.canSchedule, true);
  assert.equal(rawGate.used, 0);
});

test('syncStudentFromPrimaryEnrollment promotes new active enrollment and reassigns teacher cleanly after previous refund', () => {
  const doc = {
    course: '(Đã hủy)',
    status: 'Thôi học',
    teacherId: OID_T1,
    teacherName: 'GV Cũ',
    enrollments: [
      {
        _id: OID_OLD,
        courseName: 'Word',
        status: 'refunded',
        teacherId: OID_T1,
        teacherName: 'GV Cũ',
        paid: true,
        price: 1500000,
        totalSessions: 12,
        completedSessions: 4,
        remainingSessions: 8,
        isPrimary: false,
      },
      {
        _id: OID_NEW,
        courseName: 'Excel',
        status: 'active',
        teacherId: OID_T2,
        teacherName: 'GV Mới',
        paid: true,
        price: 2000000,
        totalSessions: 12,
        completedSessions: 0,
        remainingSessions: 12,
        isPrimary: false,
      },
    ],
  };

  syncStudentFromPrimaryEnrollment(doc);
  assert.equal(doc.course, 'Excel');
  assert.equal(String(doc.teacherId), OID_T2);
  assert.equal(doc.teacherName, 'GV Mới');
  assert.equal(doc.status, 'Đang học');
  assert.equal(doc.enrollments[1].isPrimary, true);
  assert.equal(doc.enrollments[0].isPrimary, false);

  // Old teacher has no active rows left if reassigned; getActiveClientEnrollments only returns Excel
  const activeEnrs = getActiveClientEnrollments(doc);
  assert.equal(activeEnrs.length, 1);
  assert.equal(activeEnrs[0].courseName, 'Excel');
});
