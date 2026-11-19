'use strict';

let registeredIo = null;

function setIo(ioInstance) {
  registeredIo = ioInstance || null;
}

function getIo() {
  return registeredIo || (typeof global !== 'undefined' ? global.io : null) || null;
}

/**
 * Phát sự kiện realtime khi học viên mở khóa / gia hạn / thay đổi trạng thái gói Meet.
 * Gửi đồng thời tới cả room `<studentId>` và `student_<studentId>` (Socket.IO tự khử trùng lặp).
 */
function emitSubscriptionRealtime(studentId, subscription, options = {}) {
  const sid = String(studentId || '').trim();
  if (!sid) return;
  const io = options.io || getIo();
  if (!io || typeof io.to !== 'function') return;

  const unlocked = Boolean(options.unlocked);
  const locked = Boolean(options.locked);
  const rooms = [sid, `student_${sid}`];

  io.to(rooms).emit('subscription:updated', {
    studentId: sid,
    subscription: subscription || null,
    freeUnlocked: unlocked ? true : (locked ? false : undefined),
  });

  if (unlocked) {
    io.to(rooms).emit('free-portal-unlocked', {
      studentId: sid,
      subscription: subscription || null,
    });
  } else if (locked) {
    io.to(rooms).emit('free-portal-locked', {
      studentId: sid,
      subscription: subscription || null,
    });
  }
}

module.exports = {
  setIo,
  getIo,
  emitSubscriptionRealtime,
};
