export const LAST_STUDY_UPDATED_EVENT = 'cms:last-study-updated';
const STORAGE_PREFIX = 'th_last_study_v1_';

export function resolveCurrentStudentId(explicitId = '') {
  const direct = String(explicitId || '').trim();
  if (direct) return direct;
  try {
    const raw = JSON.parse(localStorage.getItem('student_user') || 'null');
    return String(raw?.id || raw?._id || '').trim() || 'guest';
  } catch {
    return 'guest';
  }
}

function normalizeStudyPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const href = String(raw.href || '').trim();
  if (!href) return null;
  const atSec = Math.max(0, Math.floor(Number(raw.atSec) || 0));
  const durationSec = Math.max(0, Math.floor(Number(raw.durationSec) || 0));
  const progressPct = raw.progressPct != null
    ? Math.max(0, Math.min(100, Math.round(Number(raw.progressPct) || 0)))
    : (durationSec > 0 ? Math.max(0, Math.min(100, Math.round((atSec / durationSec) * 100))) : null);

  return {
    kind: raw.kind === 'lesson_practice'
      ? 'lesson_practice'
      : raw.kind === 'daily_practice'
        ? 'daily_practice'
        : 'lms_video',
    studentId: resolveCurrentStudentId(raw.studentId),
    courseId: String(raw.courseId || ''),
    courseTitle: String(raw.courseTitle || '').trim(),
    subjectId: String(raw.subjectId || ''),
    subjectName: String(raw.subjectName || '').trim(),
    lessonId: String(raw.lessonId || ''),
    lessonTitle: String(raw.lessonTitle || '').trim(),
    unitId: String(raw.unitId || ''),
    unitTitle: String(raw.unitTitle || '').trim(),
    sectionId: String(raw.sectionId || ''),
    sectionLabel: String(raw.sectionLabel || '').trim(),
    atSec,
    durationSec,
    progressPct,
    href,
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

export function readLastStudySession(studentId = '') {
  if (typeof window === 'undefined') return null;
  try {
    const sid = resolveCurrentStudentId(studentId);
    const raw = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${sid}`) || 'null');
    return normalizeStudyPayload(raw);
  } catch {
    return null;
  }
}

export function saveLastStudySession(payload) {
  if (typeof window === 'undefined') return null;
  const normalized = normalizeStudyPayload({
    ...payload,
    updatedAt: payload?.updatedAt || Date.now(),
  });
  if (!normalized) return null;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${normalized.studentId}`, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(LAST_STUDY_UPDATED_EVENT, { detail: normalized }));
  } catch {
    /* ignore storage quota errors */
  }
  return normalized;
}

export function formatResumeTimeAgo(updatedAt) {
  const ts = Number(updatedAt) || 0;
  if (!ts) return 'Gần đây';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return 'Vừa xong';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return `${Math.floor(diff / 86_400_000)} ngày trước`;
}

