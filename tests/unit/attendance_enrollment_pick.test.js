'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pickAttendanceEnrollment, enrollmentIsClosed } = require('../../services/attendanceService');
const { syncEnrollmentLifecycle, completedCountFromSchedules } = require('../../services/enrollmentService');

test('điểm danh lấy khóa đang học khi cùng tên với khóa đã hoàn thành', () => {
  const oldId = '65f0000000000000000000aa';
  const liveId = '65f0000000000000000000bb';
  const picked = pickAttendanceEnrollment([
    { _id: oldId, courseName: 'Tin học văn phòng CB', status: 'completed' },
    { _id: liveId, courseName: 'TIN HOC VAN PHONG CB', status: 'active' },
  ], { course: 'TIN HOC VĂN PHÒNG CB', enrollmentId: oldId });
  assert.equal(String(picked._id), liveId);
});

test('khóa đã hoàn thành nhưng admin tăng tổng buổi thì điểm danh được', () => {
  const enr = {
    _id: '65f0000000000000000000cc',
    courseName: 'Excel',
    status: 'completed',
    totalSessions: 8,
    completedSessions: 2,
  };
  assert.equal(enrollmentIsClosed(enr), false);
  const picked = pickAttendanceEnrollment([enr], { course: 'Excel', enrollmentId: enr._id });
  assert.equal(String(picked._id), enr._id);
});

test('đủ buổi thì khóa completed vẫn đóng', () => {
  assert.equal(enrollmentIsClosed({
    status: 'completed', totalSessions: 2, completedSessions: 2,
  }), true);
  assert.equal(enrollmentIsClosed({ status: 'cancelled', totalSessions: 8, completedSessions: 2 }), true);
  assert.equal(enrollmentIsClosed({ status: 'refunded', totalSessions: 8, completedSessions: 0 }), true);
});

test('tăng tổng buổi đưa khóa completed về đang học, không mở khóa hủy', () => {
  const reopened = syncEnrollmentLifecycle({
    status: 'completed', totalSessions: 8, completedSessions: 2,
  });
  assert.equal(reopened.status, 'active');
  const cancelled = syncEnrollmentLifecycle({
    status: 'cancelled', totalSessions: 8, completedSessions: 2,
  });
  assert.equal(cancelled.status, 'cancelled');
  const paused = syncEnrollmentLifecycle({
    status: 'paused', totalSessions: 8, completedSessions: 2,
  });
  assert.equal(paused.status, 'paused');
  const full = syncEnrollmentLifecycle({
    status: 'active', totalSessions: 2, completedSessions: 2,
  });
  assert.equal(full.status, 'completed');
});

test('đăng ký lại cùng tên khóa không nhận buổi của khóa đã hoàn phí', () => {
  const oldId = 'old';
  const newId = 'new';
  const buckets = {
    sessionByEnrollment: { old: 2 },
    allByCourse: { excel: 2 },
    unlinkedByCourse: { excel: 2 },
    sameCourseCounts: { excel: 2 },
    firstIdxByCourse: { excel: 0 },
  };
  assert.equal(completedCountFromSchedules({
    enrollmentKey: oldId, courseKey: 'excel', idx: 0, ...buckets,
  }), 2);
  assert.equal(completedCountFromSchedules({
    enrollmentKey: newId, courseKey: 'excel', idx: 1, ...buckets,
  }), undefined);
});

test('khóa đã hủy và không còn khóa active thì vẫn bị chặn', () => {
  const picked = pickAttendanceEnrollment([
    { _id: '65f0000000000000000000aa', courseName: 'Excel', status: 'cancelled' },
  ], { course: 'Excel', enrollmentId: '65f0000000000000000000aa' });
  assert.equal(picked.status, 'cancelled');
});
