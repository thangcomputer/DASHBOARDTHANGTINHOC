export function resolveTeacherExamDate(t) {
  if (!t) return null;
  if (t.testDate) {
    const d = new Date(t.testDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const attempted =
    t.testStatus === 'passed' ||
    t.testStatus === 'failed' ||
    Number(t.testScore) > 0 ||
    (String(t.status) === 'Locked' && t.lockReason);
  if (attempted && t.updatedAt) {
    const d = new Date(t.updatedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function isTeacherExamDateApproximate(t) {
  return !t?.testDate && resolveTeacherExamDate(t) != null;
}

/** Chuẩn hóa đường dẫn file bài thực hành (hỗ trợ URL localhost cũ trong DB) */
export function resolvePracticalFileUrl(practicalFile) {
  if (!practicalFile) return '';
  const raw = String(practicalFile).trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).pathname;
    } catch {
      const m = raw.match(/^https?:\/\/[^/]+(\/.*)$/i);
      if (m) return m[1];
    }
  }

  if (raw.startsWith('/uploads/')) return raw;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  return `/uploads/practical/${raw.replace(/^\/+/, '')}`;
}

export function practicalFileDisplayName(practicalFile) {
  const path = resolvePracticalFileUrl(practicalFile);
  if (!path) return '';
  return decodeURIComponent(path.split('/').pop() || practicalFile);
}

/** URL tải file (ép download) */
export function practicalFileDownloadUrl(practicalFile) {
  const base = resolvePracticalFileUrl(practicalFile);
  if (!base) return '';
  const name = practicalFileDisplayName(practicalFile);
  return `${base}?download=1&downloadAs=${encodeURIComponent(name)}`;
}

/** URL mở xem trong tab trình duyệt */
export function practicalFileViewUrl(practicalFile) {
  return resolvePracticalFileUrl(practicalFile);
}
