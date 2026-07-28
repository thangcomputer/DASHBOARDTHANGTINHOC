import { resolveMediaUrl, buildMediaDownloadUrl } from '../../../services/api';

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

  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      const m = raw.match(/^https?:\/\/[^/]+(\/.*)$/i);
      if (m) path = m[1];
    }
  } else if (raw.startsWith('/uploads/')) {
    path = raw;
  } else if (raw.startsWith('uploads/')) {
    path = `/${raw}`;
  } else {
    path = `/uploads/practical/${raw.replace(/^\/+/, '')}`;
  }
  return resolveMediaUrl(path);
}

export function practicalFileDisplayName(practicalFile) {
  const path = resolvePracticalFileUrl(practicalFile);
  if (!path) return '';
  const clean = path.split('?')[0];
  return decodeURIComponent(clean.split('/').pop() || practicalFile);
}

/** URL tải file (ép download) */
export function practicalFileDownloadUrl(practicalFile) {
  const base = resolvePracticalFileUrl(practicalFile);
  if (!base) return '';
  const name = practicalFileDisplayName(practicalFile);
  return buildMediaDownloadUrl(base, name) || base;
}

/** URL mở xem trong tab trình duyệt */
export function practicalFileViewUrl(practicalFile) {
  return resolvePracticalFileUrl(practicalFile);
}
