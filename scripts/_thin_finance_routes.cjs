const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../routes/studentRoutes.js');
let s = fs.readFileSync(p, 'utf8');

const refundHandler = `router.put('/:id/refund', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const note = String(req.body?.note || 'Hoàn tiền / hủy xác nhận thanh toán').slice(0, 300);
    const result = await refundStudentTuition({
      studentId: req.params.id,
      amount: req.body?.amount,
      note,
      refundId: String(req.body?.refundId || req.headers['idempotency-key'] || '').trim(),
      actor: financeActor(req),
      reqMeta: financeReqMeta(req, null),
    });
    bustFinanceCaches();
    const student = result.student;
    const io = req.app.get('io');
    if (io && !result.idempotent) {
      const NotificationService = require('../services/NotificationService');
      const refundAmt = result.refundedAmount;
      const partial = result.partial;
      NotificationService.notifyAdmins(
        io,
        partial ? '↩️ Hoàn học phí (một phần)' : '↩️ Hoàn học phí',
        \`Đã hoàn \${refundAmt.toLocaleString('vi-VN')}đ của \${student.name}\${partial ? \` (còn \${Number(student.paidAmount).toLocaleString('vi-VN')}đ)\` : ''}\`,
        { studentId: student._id },
        '/admin/students',
      ).catch(() => {});
      NotificationService.send(io, {
        type: 'FINANCE',
        title: partial ? 'Hoàn học phí một phần' : 'Hoàn học phí',
        content: partial
          ? \`Đã hoàn \${refundAmt.toLocaleString('vi-VN')}đ. Số dư đã thanh toán còn \${Number(student.paidAmount).toLocaleString('vi-VN')}đ. \${note}\`
          : \`Trạng thái thanh toán của bạn đã được cập nhật (hoàn/hủy). \${note}\`,
        receivers: String(student._id),
        link: '/student#profile',
      }).catch(() => {});
      studentDataRefresh(io, student, { type: 'student', id: student._id });
      studentRealtime(io, student, 'revenue:updated', { amount: -refundAmt, studentName: student.name });
    }
    const o = student.toObject ? student.toObject() : student;
    delete o.password;
    delete o.refreshToken;
    return res.json({
      success: true,
      message: result.idempotent
        ? 'Hoàn tiền đã được ghi nhận trước đó (idempotent)'
        : (result.partial
          ? \`Đã hoàn một phần \${result.refundedAmount.toLocaleString('vi-VN')}đ (còn \${Number(result.remainingPaidAmount).toLocaleString('vi-VN')}đ)\`
          : \`Đã hoàn/hủy thanh toán \${result.refundedAmount.toLocaleString('vi-VN')}đ\`),
      data: {
        student: o,
        refundedAmount: result.refundedAmount,
        partial: result.partial,
        remainingPaidAmount: result.remainingPaidAmount,
        oldValue: result.oldSnapshot,
        ledgerEntryId: result.ledgerEntryId,
        idempotent: result.idempotent,
      },
    });
  } catch (error) {
    logger.error('[STUDENTS] Refund error:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
});`;

const payTeacherHandler = `router.put('/:id/pay-teacher', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const result = await payTeacherForStudent({
      studentId: req.params.id,
      action: req.body?.action || 'PARTIAL',
      idempotencyKey: String(req.headers['idempotency-key'] || req.body?.idempotencyKey || '').trim(),
      actor: { ...financeActor(req), name: req.user?.name || 'Admin' },
    });
    const { student, teacher, paidSessions, amount, transaction, action, defaultDesc } = result;
    const io = req.app.get('io');
    if (io && !result.idempotent) {
      const NotificationService = require('../services/NotificationService');
      await NotificationService.send(io, {
        type: 'FINANCE',
        title: '💵 Đã thanh toán lương (theo học viên)',
        content: action === 'PAID_IN_ADVANCE'
          ? \`Admin đã thiết lập TRẢ TRƯỚC cho học viên \${student.name}. Đã xác nhận \${paidSessions} buổi (\${amount.toLocaleString('vi-VN')}đ).\`
          : \`Admin đã thanh toán \${paidSessions} buổi dạy của học viên \${student.name} (\${amount.toLocaleString('vi-VN')}đ).\`,
        receivers: String(teacher._id),
        payload: { studentId: String(student._id), action, paidSessions },
        link: '/teacher/finance',
      });
      studentRealtime(io, student, 'student:updated', student._id.toString());
      studentDataRefresh(io, student, { type: 'student', id: student._id.toString(), action: 'pay_teacher' });
    }
    return res.json({
      success: true,
      message: result.idempotent
        ? 'Giao dịch đã tồn tại (idempotent)'
        : (action === 'PAID_IN_ADVANCE'
          ? 'Đã thiết lập thanh toán TRỌN GÓI và ghi sổ các buổi đã hoàn thành.'
          : \`Thanh toán thành công \${paidSessions} buổi dạy của HV \${student.name}.\`),
      data: { paidSessions, amount, transaction, idempotent: result.idempotent, note: defaultDesc },
    });
  } catch (error) {
    logger.error('[STUDENTS] Pay Teacher error:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});`;

function replaceRoute(src, marker, replacement) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('marker not found: ' + marker);
  // find matching router.put end: next "\nrouter." after start, but skip until closing of this route's async function
  // Simpler: find from marker to next "\\n// ───" or "\\nmodule.exports" after a closing }); of the route
  let i = start;
  // Find the end by counting braces from the first { of the async handler
  const asyncIdx = src.indexOf('async (req, res)', start);
  const braceStart = src.indexOf('{', asyncIdx);
  let depth = 0;
  let end = braceStart;
  for (; end < src.length; end++) {
    if (src[end] === '{') depth += 1;
    else if (src[end] === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        if (src[end] === ')') end += 1; // });
        if (src[end] === ';') end += 1;
        break;
      }
    }
  }
  return src.slice(0, start) + replacement + src.slice(end);
}

s = replaceRoute(s, "router.put('/:id/refund'", refundHandler);
s = replaceRoute(s, "router.put('/:id/pay-teacher'", payTeacherHandler);
fs.writeFileSync(p, s);
console.log('rewrote finance routes');
