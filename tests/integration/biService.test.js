const test = require('node:test');
const assert = require('node:assert/strict');
const biService = require('../../services/biService');

test('getPeriodRange returns prev window', () => {
  const r = biService.getPeriodRange('7d');
  assert.ok(r.start < r.end);
  assert.ok(r.prevStart < r.prevEnd);
  assert.ok(r.prevEnd.getTime() <= r.start.getTime() + 1000);
});

test('overviewToCsv includes metrics', () => {
  const csv = biService.overviewToCsv({
    period: '1m',
    kpis: { studentsTotal: 10, studentsPaid: 5, studentsUnpaid: 5, studentsNew: 2, studentsNewChange: 10, revenuePeriod: 1000, revenueChange: 5, teachersActive: 3, teachersPending: 1, schedulesCompleted: 4, schedulesCancelled: 0, examPassRate: 80, paidRate: 50 },
    byCourse: [{ course: 'Excel', count: 2, revenue: 500 }],
  });
  assert.ok(csv.includes('students_total,10'));
  assert.ok(csv.includes('Excel,2,500'));
});