/**
 * Test: Lock Student Selection When Scheduling From Messaging / Conversation
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Inbox & Messaging Student Schedule Locking Verification', () => {

  it('1. Weekly schedule sheet scopes slots to its selected student', () => {
    const code = read('client/src/components/teacher/TeacherStudentWeekSlotSheet.jsx');
    assert.ok(code.includes('const sid = studentIdOf(activeStudent)'));
    assert.ok(code.includes('findStudentDayOccupying(schedules, sid, dateKey)'));
    assert.ok(code.includes('studentId: sid'));
  });

  it('2. Inbox locks schedule sheet to the conversation student', () => {
    const code = read('client/src/components/Inbox.jsx');
    assert.ok(code.includes('const targetId = String(activeConv.user.id || activeConv.user._id || \'\')'));
    assert.ok(code.includes('s) => String(s.id || s._id) === targetId'));
    assert.ok(code.includes('student={preferred}'));
    assert.ok(code.includes('enrollments={enrollments.length ? enrollments : [preferred]}'));
  });

  it('3. TeacherStudentCard passes only that student to the quick schedule sheet', () => {
    const code = read('client/src/components/teacher/TeacherStudentCard.jsx');
    assert.ok(code.includes('student={student}'));
    assert.ok(code.includes('enrollments={[student]}'));
  });
});
