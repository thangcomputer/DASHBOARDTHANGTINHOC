/**
 * Phase 8.23B — Messaging contact/conversation discovery (updated Phase 6).
 * Contacts authority moved to MessagingPolicy + messagingContactsService.
 * FE must not seed unauthorized peers; conversation ID rules unchanged.
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
  it('1 contacts API: student candidates load STAFF+SUPPORT+assigned teachers (no SUPER)', () => {
    const src = read('services/messagingContactsService.js');
    const idx = src.indexOf("else if (userRole === 'student')");
    assert.ok(idx > 0);
    const chunk = src.slice(idx, idx + 2500);
    assert.ok(chunk.includes("adminRole: 'STAFF'"));
    assert.ok(chunk.includes("adminRole: 'SUPPORT'"));
    assert.ok(chunk.includes("role: 'teacher'"));
    assert.ok(chunk.includes('teacherIdList') || chunk.includes('myTeacherIds'));
    assert.equal(chunk.includes('loadHighAdminDocs'), false);
  });

  it('2 contacts API: teacher candidates load HIGH+STAFF+SUPPORT+assigned students', () => {
    const src = read('services/messagingContactsService.js');
    const idx = src.indexOf("else if (userRole === 'teacher')");
    assert.ok(idx > 0);
    const chunk = src.slice(idx, idx + 2000);
    assert.ok(chunk.includes('loadHighAdminDocs'));
    assert.ok(chunk.includes("adminRole: { $in: ['STAFF', 'SUPPORT'] }"));
    assert.ok(chunk.includes('Student.find'));
  });

  it('3 Inbox discovers contacts from API; message-activity DMs from dataContext', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.equal(inbox.includes("!== 'Chưa có tin nhắn'"), false);
    assert.ok(inbox.includes('Discovery contacts come only') || inbox.includes('Phase 6'));
    assert.ok(inbox.includes('pushEntry'));
  });

  it('4 Admin/Staff/Support tabs are separated (Phase 8.24)', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.ok(inbox.includes("contactTab === 'admin'"));
    assert.ok(inbox.includes("contactTab === 'staff'"));
    assert.ok(inbox.includes("contactTab === 'support'"));
    assert.ok(inbox.includes("ar === 'SUPPORT'"));
    assert.ok(inbox.includes("{ id: 'support', label: 'Support' }"));
    assert.ok(inbox.includes("ar !== 'STAFF'") || inbox.includes("ar !== 'SUPPORT'"));
  });

  it('5 useDataMessaging does not seed discovery contacts (Phase 6)', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.ok(src.includes('server-authoritative'));
    assert.equal(src.includes("name: t?.name || 'Giảng viên'"), false);
    assert.equal(src.includes('teacherIds.forEach'), false);
  });

  it('6 student/teacher STAFF/SUPPORT threads use staff_* not admin_admin', () => {
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

  it('9 useDataMessaging no longer seeds staff contacts', () => {
    const src = read('client/src/context/useDataMessaging.js');
    assert.equal(src.includes("buildConversationId('student', sId, 'staff', stId)"), false);
    assert.equal(src.includes("buildConversationId('teacher', sId, 'staff', stId)"), false);
  });

  it('10 Inbox does not poison seenConvIds before push', () => {
    const inbox = read('client/src/components/Inbox.jsx');
    assert.equal(/seenConvIds\.add\(convId\);\s*\n\s*\/\/ Prefer exact/.test(inbox), false);
    assert.ok(inbox.includes('if (seenConvIds.has(canonicalId)) return'));
  });

  it('11 route delegates to messagingContactsService (Phase 6)', () => {
    const routes = read('routes/messageRoutes.js');
    assert.ok(routes.includes('listDiscoverableContacts'));
    assert.ok(routes.includes('messagingContactsService'));
  });
});
