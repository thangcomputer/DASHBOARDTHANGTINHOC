'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const {
  TEACHER_PAYMENT_RECEIVED_EVENT,
  teacherPaymentNotice,
  notifyTeacherPaymentReceived,
} = require('../../services/teacherPaymentNotice');

test('payment notice payload carries id, teacher, amount, sessions and star bonus', () => {
  const notice = teacherPaymentNotice({
    _id: 'tx1',
    teacherId: { _id: 't1', name: 'GV' },
    amount: 750000,
    sessionsCount: 5,
    starBonusAmount: 50000,
    month: 'Tháng 11/2026',
  });
  assert.equal(notice.id, 'tx1');
  assert.equal(notice.teacherId, 't1');
  assert.equal(notice.amount, 750000);
  assert.equal(notice.sessions, 5);
  assert.equal(notice.starBonusAmount, 50000);
  assert.equal(teacherPaymentNotice({ _id: 'tx2', teacherId: 't1', amount: 1, paymentSessionIds: ['a', 'b'] }).sessions, 2);
  assert.equal(teacherPaymentNotice({ _id: 'tx3', teacherId: 't1', amount: 1 }, { sessions: 4 }).sessions, 4);
});

test('realtime notice goes only to the paid teacher room', () => {
  const sent = [];
  const io = { to: (room) => ({ emit: (event, payload) => sent.push({ room, event, payload }) }) };
  notifyTeacherPaymentReceived(io, { _id: 'tx1', teacherId: 't9', amount: 100 });
  assert.deepEqual(sent.map(({ room, event }) => ({ room, event })), [{ room: 't9', event: TEACHER_PAYMENT_RECEIVED_EVENT }]);
});

test('every salary payment path marks the notice pending and notifies the teacher', () => {
  const teacherRoutes = read('routes/teacherRoutes.js');
  assert.equal((teacherRoutes.match(/teacherPaymentNoticePending: true/g) || []).length, 2, 'pay-flexible + pay-all');
  assert.equal((teacherRoutes.match(/notifyTeacherPaymentReceived\(io, transaction\)/g) || []).length, 2);

  const studentService = read('services/studentFinanceService.js');
  assert.ok(studentService.includes('teacherPaymentNoticePending: true'), 'pay per student');
  assert.ok(read('routes/studentRoutes.js').includes('notifyTeacherPaymentReceived(io, transaction, { sessions: paidSessions })'));

  const txRoutes = read('routes/transactionRoutes.js');
  assert.ok(txRoutes.includes('...(firstConfirm ? { teacherPaymentNoticePending: true } : {})'), 'confirm pending slip');
  assert.ok(txRoutes.includes('if (firstConfirm) notifyTeacherPaymentReceived(io, transaction);'));
  assert.ok(txRoutes.includes("{ status: 'cancelled', teacherPaymentNoticePending: false }"), 'cancel clears notice');
  assert.ok(txRoutes.includes("router.get('/me/payment-notices'"));
  assert.ok(txRoutes.includes("router.put('/:id/payment-notice-seen'"));
  assert.ok(txRoutes.includes('{ _id: req.params.id, teacherId: req.user.id }'), 'teacher can only ack own slips');
});

test('mobile app shows the same payment popup through the shared APIs', () => {
  const api = read('thang-tin-hoc-mobile/src/services/teacherPaymentNoticeApi.ts');
  assert.ok(api.includes("'/transactions/me/payment-notices'"));
  assert.ok(api.includes('/payment-notice-seen'));
  const socket = read('thang-tin-hoc-mobile/src/services/socketService.ts');
  assert.ok(socket.includes("instance.on('teacher:payment-received'"));
  const modal = read('thang-tin-hoc-mobile/src/components/TeacherPaymentNoticeModal.tsx');
  assert.ok(modal.includes('getTeacherPaymentNotices()'), 'loads notices missed while offline');
  assert.ok(modal.includes('markTeacherPaymentNoticeSeen(current.id)'));
  assert.ok(modal.includes('const known = new Set(existing.map((notice) => notice.id));'), 'dedupes by transaction id');
  assert.ok(modal.includes("if (state === 'active') load();"), 'reloads when the app returns to foreground');
  assert.ok(modal.includes('if (!enabled || !current || pinLocked) return null;'), 'never shows over the PIN lock');
  const navigator = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.ok(navigator.includes('<TeacherPaymentNoticeModal'));
  assert.ok(read('thang-tin-hoc-mobile/src/components/pinLock/PinLockGate.tsx').includes('setPinLockedState(locked)'));
});

test('teacher dashboard queues pending notices and shows each payment once', () => {
  const layout = read('client/src/components/DashboardLayout.jsx');
  assert.ok(layout.includes('api.transactions.getPaymentNotices()'), 'loads notices missed while offline');
  assert.ok(layout.includes("socket.on('teacher:payment-received', onTeacherPayment)"));
  assert.ok(layout.includes('api.transactions.markPaymentNoticeSeen(currentId)'));
  assert.ok(layout.includes('const known = new Set(queue.map((notice) => notice.id));'), 'dedupes by transaction id');
  assert.ok(!layout.includes("socket.on('transactions:new', onTeacherPayment)"));
});
