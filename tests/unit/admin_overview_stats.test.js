'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isStudentPaidOrPurchased,
  isStudentEngaged,
  computeAtRiskStudentsServer,
  buildAutomationsForStudents,
  computeOnlineAndTodayUsers,
  summarizeExamProgress,
} = require('../../services/adminOverviewStatsService');

test('isStudentPaidOrPurchased excludes 0đ freePortal registrations unless they actually paid', () => {
  const freeUnpaid = {
    _id: 's1',
    freePortal: true,
    freeUnlocked: false,
    course: 'Tài khoản miễn phí',
    price: 0,
    paid: true,
    paidAmount: 0,
    subscription: { plan: 'lifetime' },
    enrollments: [{ courseName: 'Tài khoản miễn phí', price: 0, paid: true, status: 'active' }],
  };
  assert.equal(isStudentPaidOrPurchased(freeUnpaid, 0), false);

  const freeBoughtXp = { ...freeUnpaid, _id: 's2' };
  assert.equal(isStudentPaidOrPurchased(freeBoughtXp, 50000), true);

  const freeBoughtMeet = {
    ...freeUnpaid,
    _id: 's3',
    freeUnlocked: true,
    subscription: { plan: '1m' },
  };
  assert.equal(isStudentPaidOrPurchased(freeBoughtMeet, 0), true);

  const centerPaid = {
    _id: 's4',
    freePortal: false,
    course: 'Excel Thực Chiến',
    price: 2500000,
    paid: true,
    enrollments: [{ courseName: 'Excel Thực Chiến', price: 2500000, paid: true, status: 'active' }],
  };
  assert.equal(isStudentPaidOrPurchased(centerPaid, 2500000), true);

  const refundedStudent = {
    _id: 's5',
    freePortal: false,
    status: 'refunded',
    paid: false,
    enrollments: [{ courseName: 'Word', price: 2000000, paid: true, status: 'refunded' }],
  };
  assert.equal(isStudentPaidOrPurchased(refundedStudent, 0), false);
});

test('isStudentEngaged requires real access/learning/practice rather than bare freePortal flag', () => {
  const neverLoggedInFree = {
    _id: 's-idle',
    freePortal: true,
    lastAccessAt: null,
    completedSessions: 0,
  };
  assert.equal(isStudentEngaged(neverLoggedInFree, new Set()), false);
  assert.equal(isStudentEngaged(neverLoggedInFree, new Set(['s-idle'])), true);

  const studied = { _id: 's-done', completedSessions: 1 };
  assert.equal(isStudentEngaged(studied, new Set()), true);
});

test('computeOnlineAndTodayUsers counts all roles (Admin/Staff/Teacher/Student), deduplicates sockets + sessions, and does not force Math.max(1)', () => {
  const allScope = computeOnlineAndTodayUsers({
    hasBranchScope: false,
    branchStudentIds: new Set(['stu1', 'stu2', 'stu3']),
    presenceList: [
      { userId: 'admin', role: 'admin' },
      { userId: 'stu1', role: 'student' },
    ],
    activeWebSessions: [
      { userId: 'admin', role: 'admin' }, // duplicate of socket
      { userId: 'staff1', role: 'staff' },
      { userId: 'tea1', role: 'teacher' },
      { userId: 'stu1', role: 'student' }, // duplicate of socket
    ],
    activeMobileSessions: [
      { userId: 'stu2', role: 'student' },
    ],
    todayWebStudentIds: ['stu1', 'stu3'],
    todayMobileStudentIds: ['stu2'],
    todayRegisteredStudentIds: ['stu1'],
    studentsWithAccessToday: ['stu3'],
    requesterUser: { id: 'admin', role: 'admin' },
  });

  // Distinct online: admin, staff1, tea1, stu1, stu2 => 5
  assert.equal(allScope.onlineTotal, 5);
  // Distinct active today students: stu1, stu2, stu3 => 3
  assert.equal(allScope.activeToday, 3);

  const emptyBranch = computeOnlineAndTodayUsers({
    hasBranchScope: true,
    branchId: 'branch-a',
    allowedAccountIds: new Set(['stu-a']),
    branchStudentIds: new Set(['stu-a']),
    presenceList: [{ userId: 'admin', role: 'admin', branchId: null }],
    requesterUser: { id: 'admin', role: 'admin', branchId: null },
  });
  assert.equal(emptyBranch.onlineTotal, 0);
  assert.equal(emptyBranch.activeToday, 0);
});

test('computeAtRiskStudentsServer uses latest session activity and real schedules in VN timezone', () => {
  const now = new Date('2026-11-20T03:00:00.000Z'); // 10:00 VN
  const tenDaysAgo = new Date('2026-11-08T10:00:00+07:00');
  const students = [
    {
      _id: 'stu-active-via-session',
      name: 'Active In Session',
      course: 'Excel',
      status: 'Đang học',
      lastAccessAt: tenDaysAgo, // stale disconnect
      remainingSessions: 5,
      createdAt: tenDaysAgo,
    },
    {
      _id: 'stu-risk',
      name: 'Dropped Rhythm',
      course: 'Word',
      status: 'Đang học',
      lastAccessAt: tenDaysAgo,
      remainingSessions: 4,
      createdAt: tenDaysAgo,
    },
    {
      _id: 'stu-cancelled',
      name: 'Cancelled User',
      course: '(Đã hủy)',
      status: '(Đã hủy)',
      lastAccessAt: tenDaysAgo,
      remainingSessions: 0,
      createdAt: tenDaysAgo,
    },
  ];
  const latestActivityByStudent = new Map([
    ['stu-active-via-session', new Date('2026-11-20T09:00:00+07:00').getTime()],
  ]);
  const schedules = [
    { studentId: 'stu-active-via-session', status: 'scheduled', date: new Date('2026-11-21T19:00:00+07:00') },
  ];

  const atRisk = computeAtRiskStudentsServer(students, schedules, latestActivityByStudent, now);
  assert.equal(atRisk.total, 1);
  assert.equal(atRisk.items[0].id, 'stu-risk');
  assert.ok(atRisk.items[0].reasons.some((r) => r.includes('Không truy cập')));
  assert.ok(atRisk.items[0].reasons.some((r) => r.includes('chưa xếp lịch')));

  const autos = buildAutomationsForStudents(students, atRisk.items, now);
  assert.equal(autos.total, 1);
  assert.equal(autos.items[0].kind, 'nudge');
});

test('summarizeExamProgress aggregates across full list', () => {
  const summary = summarizeExamProgress([
    { examProgress: [{ status: 'dat', tracNghiem: { score: 8, total: 10 }, thucHanh: 'da_nop', essayScore: 8 }] },
    { examProgress: [{ status: 'dang_thi', tracNghiem: { score: 8, total: 10 }, thucHanh: 'chua_nop' }] },
  ]);
  assert.equal(summary.dat, 1);
  assert.equal(summary.choNop, 1);
});

test('AdminOverviewTab reads server stats rather than 5-item pagination or updatedAt revenue hack', () => {
  const overviewSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'components', 'admin', 'tabs', 'AdminOverviewTab.jsx'),
    'utf8',
  );
  assert.doesNotMatch(overviewSrc, /vnDayKeyFrom\(s\?\.updatedAt\)/);
  assert.doesNotMatch(overviewSrc, /Math\.max\(1,\s*onlineStudents/);
  assert.match(overviewSrc, /branchStats\?\.todayRevenue/);
  assert.match(overviewSrc, /branchStats\?\.realtime\?\.onlineTotal/);
  assert.match(overviewSrc, /branchStats\?\.realtime\?\.activeToday/);
  assert.match(overviewSrc, /branchStats\?\.funnel/);
  assert.match(overviewSrc, /branchStats\?\.certificationStats/);
  assert.match(overviewSrc, /mutateBranchStats/);
});
