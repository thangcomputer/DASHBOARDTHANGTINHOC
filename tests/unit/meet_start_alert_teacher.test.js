'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Schedule = require('../../models/Schedule');
const Student = require('../../models/Student');
const scheduleRoutes = require('../../routes/scheduleRoutes');

const ROOT = path.join(__dirname, '../..');
const readUtf8 = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('scheduleRoutes exports attachFallbackScheduleLinks', () => {
  assert.equal(typeof scheduleRoutes.attachFallbackScheduleLinks, 'function');
});

test('attachFallbackScheduleLinks resolves active enrollment link before cancelled/profile and falls back to teacher schedule/student link', async () => {
  const origStudentFind = Student.find;
  const origScheduleFind = Schedule.find;

  const studentIdA = '6aaaaaaaaaaaaaaaaaaaaaa1';
  const studentIdB = '6aaaaaaaaaaaaaaaaaaaaaa2';
  const teacherIdA = '6bbbbbbbbbbbbbbbbbbbbbb1';
  const teacherIdB = '6bbbbbbbbbbbbbbbbbbbbbb2';

  try {
    Student.find = (query) => ({
      select() {
        return {
          async lean() {
            if (query?._id?.$in) {
              return [
                {
                  _id: studentIdA,
                  linkHoc: 'https://meet.google.com/profile-link',
                  online_meeting_url: '',
                  enrollments: [
                    {
                      _id: '6cccccccccccccccccccccc1',
                      teacherId: teacherIdA,
                      courseName: 'TIN HỌC VĂN PHÒNG NC (1 KÈM 1)',
                      status: 'cancelled',
                      linkHoc: 'https://meet.google.com/old-cancelled',
                    },
                    {
                      _id: '6cccccccccccccccccccccc2',
                      teacherId: teacherIdA,
                      courseName: 'TIN HỌC VĂN PHÒNG NC (1 KÈM 1)',
                      status: 'active',
                      linkHoc: 'https://meet.google.com/active-1on1-room',
                    },
                  ],
                },
                {
                  _id: studentIdB,
                  linkHoc: '',
                  online_meeting_url: '',
                  enrollments: [],
                },
              ];
            }
            // Teacher-assigned student fallback
            return [];
          },
        };
      },
    });

    Schedule.find = () => ({
      sort() {
        return {
          limit() {
            return {
              select() {
                return {
                  async lean() {
                    return [
                      {
                        studentId: '6aaaaaaaaaaaaaaaaaaaaaa9',
                        teacherId: teacherIdB,
                        linkHoc: 'https://meet.google.com/teacher-b-room',
                      },
                    ];
                  },
                };
              },
            };
          },
        };
      },
    });

    const schedules = [
      {
        _id: '6dddddddddddddddddddddd1',
        studentId: studentIdA,
        teacherId: teacherIdA,
        course: 'TIN HỌC VĂN PHÒNG NC (1 KÈM 1)',
        linkHoc: '',
      },
      {
        _id: '6dddddddddddddddddddddd2',
        studentId: studentIdB,
        teacherId: teacherIdB,
        course: 'TIN HỌC VĂN PHÒNG CB (1 KÈM 1)',
        linkHoc: '',
      },
    ];

    await scheduleRoutes.attachFallbackScheduleLinks(schedules);

    assert.equal(schedules[0].linkHoc, 'https://meet.google.com/active-1on1-room');
    assert.equal(schedules[1].linkHoc, 'https://meet.google.com/teacher-b-room');
  } finally {
    Student.find = origStudentFind;
    Schedule.find = origScheduleFind;
  }
});

test('server cron resolves fallback links before emitting class:reminder', () => {
  const serverCode = readUtf8('server.js');
  const cronIdx = serverCode.indexOf("cron.schedule('* * * * *'");
  const attachIdx = Math.max(
    serverCode.indexOf('scheduleRoutes.attachFallbackScheduleLinks(todaySchedules)', cronIdx),
    serverCode.indexOf('scheduleRoutes.attachFallbackScheduleLinks(upcomingSchedules)', cronIdx),
  );
  const notifyIdx = serverCode.indexOf("'class:reminder'", cronIdx);

  assert.ok(cronIdx > 0, 'cron job present in server.js');
  assert.ok(attachIdx > cronIdx, 'attachFallbackScheduleLinks runs in cron');
  assert.ok(notifyIdx > attachIdx, 'attachFallbackScheduleLinks runs before class:reminder emission');
});

test('MeetStartAlert uses earlyMinutes: 2, immediately triggers tickRef when reminder lacks link, and keeps join CTA button for teachers', () => {
  const alertCode = readUtf8('client/src/components/student/MeetStartAlert.jsx');
  const earlyMatches = alertCode.match(/earlyMinutes:\s*2\b/g) || [];
  assert.equal(earlyMatches.length, 2, 'both scheduleRows and meetRows use earlyMinutes: 2');
  assert.ok(alertCode.includes('if (!incoming.linkHoc)'), 'checks empty incoming linkHoc');
  assert.ok(alertCode.includes('tickRef.current?.()'), 'triggers immediate schedule refetch when link missing');
  assert.ok(alertCode.includes(') : isTeacher ? ('), 'teacher branch renders primary join button even if link missing');
  assert.ok(alertCode.includes('/teacher/students'), 'teacher fallback action navigates to student link configuration');
});

test('index.css does not strip .meet-start-alert__nolink border/background CSS', () => {
  const css = readUtf8('client/src/index.css');
  assert.ok(!/\.meet-start-alert__later,\s*\.meet-start-alert__nolink\s*\{/.test(css));
  const nolinkBlock = css.match(/\.meet-start-alert__nolink\s*\{([^}]*)\}/);
  assert.ok(nolinkBlock, '.meet-start-alert__nolink CSS block exists');
  assert.ok(!/background:\s*transparent/.test(nolinkBlock[1]), '.meet-start-alert__nolink must not set transparent background');
  assert.ok(/background:\s*#fffbeb/.test(nolinkBlock[1]), '.meet-start-alert__nolink sets amber pill background');
});

