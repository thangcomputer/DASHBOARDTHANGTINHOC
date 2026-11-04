/**
 * Popup "Bạn vừa nhận được thanh toán" phía giảng viên.
 * Mỗi phiếu lương đã xác nhận được đánh dấu teacherPaymentNoticePending=true; GV xem xong thì tắt cờ.
 * Nhờ vậy GV offline lúc Admin chi vẫn thấy popup ở lần vào tiếp theo, và mỗi phiếu chỉ hiện một lần.
 */
const { emitUsers } = require('../utils/realtimeEmit');

const TEACHER_PAYMENT_RECEIVED_EVENT = 'teacher:payment-received';

function refId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

function teacherPaymentNotice(transaction, overrides = {}) {
  const tx = transaction && typeof transaction.toObject === 'function' ? transaction.toObject() : (transaction || {});
  const details = Array.isArray(tx.paymentSessionDetails) ? tx.paymentSessionDetails : [];
  const sessionIds = Array.isArray(tx.paymentSessionIds) ? tx.paymentSessionIds : [];
  return {
    id: refId(tx._id || tx.id),
    teacherId: refId(tx.teacherId),
    amount: Number(tx.amount) || 0,
    sessions: Number(overrides.sessions ?? (tx.sessionsCount || details.length || sessionIds.length)) || 0,
    starBonusAmount: Number(tx.starBonusAmount) || 0,
    description: tx.description || '',
    month: tx.month || '',
    confirmedAt: tx.confirmedAt || tx.updatedAt || tx.createdAt || null,
  };
}

/** Realtime cho GV đang mở web; nếu GV offline, popup vẫn chờ qua cờ pending. */
function notifyTeacherPaymentReceived(io, transaction, overrides = {}) {
  if (!io || !transaction) return;
  const notice = teacherPaymentNotice(transaction, overrides);
  if (!notice.id || !notice.teacherId) return;
  emitUsers(io, [notice.teacherId], TEACHER_PAYMENT_RECEIVED_EVENT, notice);
}

module.exports = {
  TEACHER_PAYMENT_RECEIVED_EVENT,
  teacherPaymentNotice,
  notifyTeacherPaymentReceived,
};
