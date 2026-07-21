/** localStorage helpers for DataContext domains */

export const DATA_VERSION = 'v7_strict_isolation_no_staff_admin_mailbox';

export const STUDENT_QUESTIONS_KEY = 'thvp_studentQuestions';
export const HV_QUESTIONS_LEGACY_SEED = 'thvp_hv_questions_legacy_seed_v1';
export const STUDENT_EXAM_MINUTES_KEY = 'thvp_studentExamMinutes';
export const TEACHER_EXAM_TIME_LIMIT_KEY = 'thvp_teacherExamTimeLimitMinutes';
export const DEFAULT_STUDENT_EXAM_MINUTES = { coban: 90, word: 90, excel: 90, powerpoint: 90 };
export const INITIAL_TRAINING = { videos: [], guides: [], files: [] };

export function loadState(key, defaultValue) {
  try {
    const saved = localStorage.getItem(key);
    if (saved != null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return parsed;
    }
  } catch { /* ignore */ }
  return defaultValue;
}

export function loadInitialStudentQuestions() {
  try {
    const raw = localStorage.getItem(STUDENT_QUESTIONS_KEY);
    if (raw != null) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function loadInitialStudentExamMinutes() {
  const out = { ...DEFAULT_STUDENT_EXAM_MINUTES };
  try {
    const raw = localStorage.getItem(STUDENT_EXAM_MINUTES_KEY);
    if (!raw) return out;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return out;
    for (const k of Object.keys(DEFAULT_STUDENT_EXAM_MINUTES)) {
      const n = Number(p[k]);
      if (Number.isFinite(n) && n >= 1 && n <= 600) out[k] = Math.round(n);
    }
  } catch { /* ignore */ }
  return out;
}

export function applyDataVersionReset() {
  try {
    const vKey = 'thvp_data_version';
    const prev = localStorage.getItem(vKey);
    if (prev !== DATA_VERSION) {
      [
        'thvp_messages',
        'thvp_groups',
        'thvp_staffs',
        'thvp_students',
        'thvp_teachers',
      ].forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(vKey, DATA_VERSION);
    }
  } catch { /* ignore */ }
}