export function localeLabel(locale) {
  return locale === 'en' ? 'English' : 'Tiếng Việt';
}

export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds) {
  const n = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(n / 60);
  const s = n % 60;
  if (m <= 0) return `${s} giây`;
  return `${m} phút ${String(s).padStart(2, '0')} giây`;
}

export function formatExpiry(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function isAccessExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= now.getTime();
}

export function attemptsExhausted(test) {
  if (!test) return false;
  const submitted = Number(test.submittedCount) || 0;
  if (test.allowRetake === false && submitted > 0) return true;
  if (test.maxAttempts != null && Number(test.maxAttempts) >= 1) {
    return submitted >= Number(test.maxAttempts);
  }
  return false;
}

export function attemptsLabel(test) {
  if (!test) return '';
  if (test.maxAttempts == null || test.maxAttempts === '') {
    return 'Không giới hạn số lần làm bài.';
  }
  const submitted = Number(test.submittedCount) || 0;
  return `Bạn đã làm: ${submitted} / ${test.maxAttempts} lần`;
}
