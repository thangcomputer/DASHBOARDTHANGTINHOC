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

  it('1. TeacherScheduleModal accepts lockStudent prop and sets isStudentLocked', () => {
    const code = read('client/src/components/teacher/TeacherScheduleModal.jsx');
    assert.ok(code.includes('lockStudent = false'));
    assert.ok(code.includes('isStudentLocked = Boolean(lockStudent || students.length === 1'));
    assert.ok(code.includes('disabled={lockedPast || isStudentLocked}'));
    assert.ok(code.includes('Đã khóa theo học viên trong hội thoại'));
  });

  it('2. Inbox passes single target student and lockStudent=true when opening schedule modal', () => {
    const code = read('client/src/components/Inbox.jsx');
    assert.ok(code.includes('students={[chatStudent]}'));
    assert.ok(code.includes('lockStudent={true}'));
  });

  it('3. TeacherStudentCard passes single student and lockStudent=true for quick schedule', () => {
    const code = read('client/src/components/teacher/TeacherStudentCard.jsx');
    assert.ok(code.includes('students={[student]}'));
    assert.ok(code.includes('lockStudent={true}'));
  });
});
