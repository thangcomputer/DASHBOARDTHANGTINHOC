'use strict';

/**
 * Parse deep-link params from location.hash
 * e.g. #materials?courseId=a&lessonId=b&tab=qa&qaId=c
 */
export function parseLmsHashQuery(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  const raw = String(hash || '').replace(/^#/, '');
  const qIdx = raw.indexOf('?');
  if (qIdx < 0) return { section: raw.split(/[?#]/)[0] || '', params: {} };
  const section = raw.slice(0, qIdx).split(/[?#]/)[0] || '';
  const params = Object.fromEntries(new URLSearchParams(raw.slice(qIdx + 1)));
  return { section, params };
}

/** Khóa id thống nhất — tránh lệch giữa course.id và course._id. */
export function courseKey(courseOrId) {
  if (courseOrId == null || courseOrId === '') return '';
  if (typeof courseOrId === 'object') {
    return String(courseOrId.id || courseOrId._id || '');
  }
  return String(courseOrId);
}

export function courseIdAliases(course) {
  if (!course) return [];
  return [...new Set([
    courseKey(course),
    String(course.id || ''),
    String(course._id || ''),
  ].filter(Boolean))];
}

const OWNED_CACHE_PREFIX = 'lms_video_owned_';

export function readOwnedVideoCourseCache(studentId) {
  if (!studentId) return new Set();
  try {
    const arr = JSON.parse(localStorage.getItem(`${OWNED_CACHE_PREFIX}${studentId}`) || '[]');
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

export function writeOwnedVideoCourseCache(studentId, ids) {
  if (!studentId) return;
  try {
    localStorage.setItem(`${OWNED_CACHE_PREFIX}${studentId}`, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

/** Xóa resumePay khỏi hash sau khi đã xử lý — tránh mở lại modal khi reload. */
export function clearResumePayFromHash(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  const { section, params } = parseLmsHashQuery(hash);
  if (params.resumePay !== '1') return;
  delete params.resumePay;
  const qs = new URLSearchParams(params).toString();
  const next = `#${section}${qs ? `?${qs}` : ''}`;
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', next);
  }
}

export function buildLmsDeepLink({ role, courseId, lessonId, qaId, tab = 'qa' }) {
  const q = new URLSearchParams();
  if (courseId) q.set('courseId', String(courseId));
  if (lessonId) q.set('lessonId', String(lessonId));
  if (tab) q.set('tab', String(tab));
  if (qaId) q.set('qaId', String(qaId));
  const qs = q.toString();
  if (role === 'teacher') return `/teacher#training${qs ? `?${qs}` : ''}`;
  if (role === 'student') return `/student#materials${qs ? `?${qs}` : ''}`;
  return `/admin/notifications${qaId ? `?qaId=${encodeURIComponent(String(qaId))}` : ''}`;
}
