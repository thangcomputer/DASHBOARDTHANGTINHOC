export function normalizeCourseName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export function financeMonthSortKey(value) {
  const text = String(value || '').trim();
  const yearMonth = text.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) return Number(yearMonth[1]) * 100 + Number(yearMonth[2]);

  const vietnameseMonth = text.match(/tháng\s*(\d{1,2})(?:\s*\/\s*(\d{4}))?/i);
  if (vietnameseMonth) {
    const year = vietnameseMonth[2] ? Number(vietnameseMonth[2]) : 0;
    return year * 100 + Number(vietnameseMonth[1]);
  }

  return Number.POSITIVE_INFINITY;
}

export function sortFinanceMonths(a, b) {
  const keyA = financeMonthSortKey(a);
  const keyB = financeMonthSortKey(b);
  if (keyA !== keyB) return keyA - keyB;
  return String(a || '').localeCompare(String(b || ''), 'vi');
}

export function isDateInCalendarMonth(value, referenceDate = new Date()) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime())
    && date.getMonth() === referenceDate.getMonth()
    && date.getFullYear() === referenceDate.getFullYear();
}

export function getSyntheticPendingCommissionAmount(unpaidAmount, payments) {
  const unpaid = Math.max(0, Number(unpaidAmount) || 0);
  const pendingPaid = (payments || [])
    .filter((payment) => !['completed', 'paid', 'confirmed'].includes(String(payment?.status || '')))
    .reduce((sum, payment) => sum + Math.max(0, Number(payment?.amount) || 0), 0);
  return Math.max(0, unpaid - pendingPaid);
}
