export function formatCourseExpiryDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getCourseTimeRemaining(expiresAt, now = new Date()) {
  if (!expiresAt) {
    return {
      hasExpiry: false,
      isExpired: false,
      isExpiringSoon: false,
      daysLeft: null,
      hoursLeft: null,
      expiryDateText: '',
      shortNote: 'Thời hạn 12 tháng',
      detailNote: 'Thời hạn 12 tháng',
    };
  }

  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) {
    return {
      hasExpiry: false,
      isExpired: false,
      isExpiringSoon: false,
      daysLeft: null,
      hoursLeft: null,
      expiryDateText: '',
      shortNote: 'Thời hạn 12 tháng',
      detailNote: 'Thời hạn 12 tháng',
    };
  }

  const expiryDateText = formatCourseExpiryDate(exp);
  const diffMs = exp.getTime() - now.getTime();
  if (diffMs <= 0) {
    return {
      hasExpiry: true,
      isExpired: true,
      isExpiringSoon: false,
      daysLeft: 0,
      hoursLeft: 0,
      expiryDateText,
      shortNote: 'Đã hết hạn',
      detailNote: 'Đã hết hạn · Đã khóa & đặt lại về ban đầu',
    };
  }

  const daysLeft = Math.max(1, Math.ceil(diffMs / 86400000));
  const hoursLeft = Math.max(1, Math.ceil(diffMs / 3600000));
  const isExpiringSoon = daysLeft <= 30;
  const monthsApprox = Math.max(1, Math.round(daysLeft / 30));
  const remainingLabel = daysLeft <= 1 && hoursLeft <= 24 ? `Còn ${hoursLeft} giờ` : `Còn ${daysLeft} ngày`;
  const shortNote = daysLeft >= 300 ? `${remainingLabel} (~${monthsApprox} tháng)` : remainingLabel;
  const detailNote = `${remainingLabel} · Hết hạn ${expiryDateText}`;

  return {
    hasExpiry: true,
    isExpired: false,
    isExpiringSoon,
    daysLeft,
    hoursLeft,
    expiryDateText,
    shortNote,
    detailNote,
  };
}
