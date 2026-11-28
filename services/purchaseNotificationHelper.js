'use strict';

function formatVnDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const timePart = d.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const datePart = d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${timePart} · ${datePart}`;
}

function formatVnDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatVndAmount(amount) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  return `${n.toLocaleString('vi-VN')}đ`;
}

function paymentMethodText(source) {
  if (source === 'code') return 'Mã kích hoạt';
  if (source === 'admin') return 'Trung tâm cấp';
  if (source === 'dev_simulate') return 'Chuyển khoản QR';
  return 'Chuyển khoản QR';
}

function buildPurchaseNotification({
  purchaseType = 'course',
  itemName = '',
  amount = 0,
  source = 'payment',
  purchasedAt = new Date(),
  durationText = '12 tháng',
  expiresAt = null,
  includesMeet = true,
  paymentRef = '',
  activationCode = '',
  classId = '',
  planId = '',
} = {}) {
  const isAi = purchaseType === 'ai_package';
  const cleanName = String(itemName || (isAi ? 'Gói hỗ trợ AI' : 'Khóa học DewSkill')).trim();
  const numericAmount = Math.max(0, Math.round(Number(amount) || 0));
  const methodLabel = paymentMethodText(source);
  const amountText = numericAmount > 0
    ? `${formatVndAmount(numericAmount)} (${methodLabel})`
    : `${source === 'code' ? 'Kích hoạt bằng mã' : '0đ'} (${methodLabel})`;
  const purchasedAtDate = purchasedAt instanceof Date ? purchasedAt : new Date(purchasedAt);
  const purchasedAtIso = Number.isNaN(purchasedAtDate.getTime()) ? new Date().toISOString() : purchasedAtDate.toISOString();
  const purchasedAtText = formatVnDateTime(purchasedAtIso);

  const expDate = expiresAt ? new Date(expiresAt) : null;
  const expiresAtIso = expDate && !Number.isNaN(expDate.getTime()) ? expDate.toISOString() : null;
  const expiresAtText = expiresAtIso ? formatVnDate(expiresAtIso) : '';
  const cleanDuration = String(durationText || (isAi ? 'Không giới hạn' : '12 tháng')).trim();

  const expiryLine = expiresAtText
    ? `${cleanDuration} (Hết hạn ${expiresAtText})`
    : cleanDuration;
  const benefitLine = isAi
    ? 'Quyền lợi: Hỏi AI không giới hạn (Unlimited) trên Web & Mobile.'
    : `${includesMeet !== false ? 'Bao gồm học Google Meet cùng giảng viên. ' : ''}Lưu ý: Khi hết hạn, khóa học sẽ bị khóa & đặt lại về ban đầu.`;

  const title = isAi
    ? `Kích hoạt thành công ${cleanName}`
    : `Đăng ký thành công ${cleanName}`;

  const lines = [
    `Sản phẩm: ${cleanName}`,
    `Thời gian mua: ${purchasedAtText}`,
    `Số tiền: ${amountText}`,
    `Hạn sử dụng: ${expiryLine}`,
    benefitLine,
  ];
  if (paymentRef) lines.push(`Nội dung CK: ${paymentRef}`);
  if (activationCode) lines.push(`Mã kích hoạt: ${activationCode}`);

  return {
    type: 'FINANCE',
    title,
    content: lines.join('\n'),
    payload: {
      kind: isAi ? 'ai_package_paid' : 'dewskill_course_paid',
      purchaseType: isAi ? 'ai_package' : 'course',
      itemName: cleanName,
      amount: numericAmount,
      amountText,
      paymentMethodLabel: methodLabel,
      purchasedAt: purchasedAtIso,
      purchasedAtText,
      durationText: cleanDuration,
      expiresAt: expiresAtIso,
      expiresAtText,
      includesMeet: isAi ? false : includesMeet !== false,
      benefitNote: benefitLine,
      paymentRef: String(paymentRef || ''),
      activationCode: String(activationCode || ''),
      classId: String(classId || ''),
      planId: String(planId || ''),
    },
    link: '/student#profile',
  };
}

module.exports = {
  formatVnDateTime,
  formatVnDate,
  formatVndAmount,
  buildPurchaseNotification,
};
