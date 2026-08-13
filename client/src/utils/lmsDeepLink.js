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
