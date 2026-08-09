/**
 * Phase 8.23B — Messaging contact/conversation discovery.
 * FE list only — does not change assertCanDirectMessage / RBAC / Enterprise.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildConversationId } = require('../../utils/chatConversationId');
const { getMessagingRole, canAccessDirectConversation } = require('../../utils/messagingRoles');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Phase 8.23B messaging contact discovery', { concurrency: false }, () => {
  it('1 contacts API: student branch includes STAFF+SUPPORT+assigned teachers', () => {
    const src = read('routes/messageRoutes.js');
    const idx = src.indexOf("else if (userRole === 'student')");
    assert.ok(idx > 0);
    const chunk = src.slice(idx, idx + 2200);
    assert.ok(chunk.includes("adminRole: { $in: ['STAFF', 'SUPPORT'] }"));
    assert.ok(chunk.includes("role: 'teacher'"));
    assert.ok(chunk.includes('teacherIdList') || chunk.includes('myTeacherIds'));
  });

  it('2 contacts API: teacher branch includes STAFF+SUPPORT+assigned students', () => {
    const src = read('routes/messageRoutes.js');
    const idx = src.indexOf("else if (userRole === 'teacher')");
    assert.ok(idx > 0);
    const chunk = src.slice(idx, idx + 1800);
    assert.ok(chunk.includes("adminRole: { $in: ['STAFF', 'SUPPORT'] }"));
    assert.ok(chunk.includes('Student.find'));
  });

  it('3 Inbox no longer requires hasActivity to show seed contacts', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.equal(inbox.includes("!== 'Chưa có tin nhắn'"), false);
    assert.ok(inbox.includes('include ALL dataContext DMs') || inbox.includes('Phase 8.23B'));
    assert.ok(inbox.includes('pushEntry'));
  });

  it('4 Admin tab includes transport staff (ADMIN_STAFF/SUPPORT)', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.ok(inbox.includes("contactTab === 'admin'"));
    assert.ok(inbox.includes("r === 'admin' || r === 'staff'"));
  });

  it('5 student seeds teacher stub even without teachers[] cache', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.ok(src.includes("name: t?.name || 'Giảng viên'"));
    assert.ok(src.includes('teacherIds.forEach'));
  });

  it('6 student/teacher seed ADMIN_STAFF/SUPPORT as staff_* not admin_admin', () => {
    const studentId = '333333333333333333333333';
    const staffId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const supportId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const teacherId = '111111111111111111111111';
    const sStaff = buildConversationId('student', studentId, 'staff', staffId);
    const sSupport = buildConversationId('student', studentId, 'staff', supportId);
    const tStaff = buildConversationId('teacher', teacherId, 'staff', staffId);
    assert.ok(sStaff.includes(`staff_${staffId}`));
    assert.ok(sSupport.includes(`staff_${supportId}`));
    assert.equal(sStaff.includes('admin_admin'), false);
    assert.equal(sSupport.includes('admin_admin'), false);
    assert.equal(tStaff.includes('admin_admin'), false);
    assert.notEqual(sStaff, sSupport);
  });

  it('7 legacy admin_admin still SUPER/HIGH only', () => {
    const student = '333333333333333333333333';
    const conv = buildConversationId('admin', 'admin', 'student', student);
    assert.ok(conv.includes('admin_admin'));
    assert.equal(
      canAccessDirectConversation(conv, { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin', adminRole: 'STAFF' }),
      false,
    );
    assert.equal(
      canAccessDirectConversation(conv, { id: 'ssssssssssssssssssssssss', role: 'admin', adminRole: 'SUPER_ADMIN' }),
      true,
    );
  });

  it('8 transport roles remain canonical', () => {
    assert.equal(getMessagingRole({ id: 'a', role: 'admin', adminRole: 'STAFF' }), 'staff');
    assert.equal(getMessagingRole({ id: 'b', role: 'admin', adminRole: 'SUPPORT' }), 'staff');
    assert.equal(getMessagingRole({ id: 't', role: 'teacher' }), 'teacher');
    assert.equal(getMessagingRole({ id: 's', role: 'student' }), 'student');
  });

  it('9 useDataMessaging seeds staff for student and teacher', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.ok(src.includes("buildConversationId('student', sId, 'staff', stId)"));
    assert.ok(src.includes("buildConversationId('teacher', sId, 'staff', stId)"));
  });

  it('10 Inbox does not poison seenConvIds before push', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    // Old bug: seenConvIds.add(convId) before canonical check then return
    assert.equal(/seenConvIds\.add\(convId\);\s*\n\s*\/\/ Prefer exact/.test(inbox), false);
    assert.ok(inbox.includes('if (seenConvIds.has(canonicalId)) return'));
  });
});
