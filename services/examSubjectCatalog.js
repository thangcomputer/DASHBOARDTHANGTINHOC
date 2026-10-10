const BUILTIN_EXAM_SUBJECTS = [
  { id: 'mon-kiem-thu', label: 'Môn kiểm thử' },
];

const BUILTIN_EXAM_SUBJECT_IDS = BUILTIN_EXAM_SUBJECTS.map((s) => s.id);
const OFFICE_EXAM_IDS = [];

function isExcludedExamSubjectId(id) {
  return !String(id || '').trim();
}

const EXAM_SUBJECT_LABELS = Object.fromEntries(BUILTIN_EXAM_SUBJECTS.map((s) => [s.id, s.label]));

function slugifyExamSubjectId(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function resolveExamSubjectId(inputId, label) {
  const fromInput = slugifyExamSubjectId(inputId);
  const fromLabel = slugifyExamSubjectId(label);
  if (fromInput && fromInput.length >= 2) return fromInput;
  return fromLabel;
}

function getExamSubjectInitials(label, id, shortHint) {
  const short = String(shortHint || '').trim();
  if (short && short.length <= 3 && !/\s/.test(short)) return short.toUpperCase();
  const words = String(label || '').trim().split(/[\s()\-–—/&,+]+/).filter((w) => /[a-zA-Z0-9]/.test(w));
  if (words.length >= 2) {
    return words.slice(0, 2).map((w) => (w.match(/[a-zA-Z0-9]/) || [''])[0]).join('').toUpperCase().slice(0, 3);
  }
  const alnum = String(label || id || '').replace(/[^a-zA-Z0-9]/g, '');
  return (alnum.slice(0, 2) || String(id || '?').slice(0, 2)).toUpperCase();
}

function sanitizeCustomExamSubjectEntry(raw) {
  const label = String(raw?.label || '').trim();
  if (!label) return null;
  const id = resolveExamSubjectId(raw?.id, label);
  if (!id || id.length < 2) return null;
  const short = getExamSubjectInitials(label, id, raw?.short);
  const bg = String(raw?.bg || 'bg-gray-600').trim();
  const minutesRaw = Number(raw?.minutes);
  const minutes = Number.isFinite(minutesRaw) && minutesRaw >= 1 && minutesRaw <= 600
    ? Math.round(minutesRaw)
    : 90;
  return {
    id,
    label,
    short,
    bg,
    minutes,
    custom: true,
    createdByAdmin: true,
    group: String(raw?.group || 'admin').trim() || 'admin',
  };
}

function normalizeCustomList(customRaw) {
  if (!Array.isArray(customRaw)) return [];
  const out = [];
  const seen = new Set(BUILTIN_EXAM_SUBJECT_IDS);
  customRaw.forEach((item) => {
    if (item?.createdByAdmin !== true) return;
    const entry = sanitizeCustomExamSubjectEntry(item);
    if (!entry || seen.has(entry.id) || isExcludedExamSubjectId(entry.id)) return;
    seen.add(entry.id);
    out.push(entry);
  });
  return out;
}

function getMergedExamCatalog(customRaw) {
  return [...BUILTIN_EXAM_SUBJECTS, ...normalizeCustomList(customRaw)];
}

function getValidExamSubjectIds(customRaw) {
  return new Set(getMergedExamCatalog(customRaw).map((s) => s.id));
}

function sanitizeExamSubjects(list, customRaw) {
  if (!Array.isArray(list)) return [];
  const valid = getValidExamSubjectIds(customRaw);
  return [...new Set(list.map(String).filter((id) => valid.has(id)))];
}

function normalizeCourseKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

function inferExamSubjectsFromCourseName(name, category, customRaw) {
  const n = normalizeCourseKey(name);
  for (const sub of getMergedExamCatalog(customRaw)) {
    if (n === sub.id || n === normalizeCourseKey(sub.label)) return [sub.id];
  }
  return [];
}

function resolveExamSubjectsForCourse(course, customRaw) {
  if (!course) return [];
  const sanitized = sanitizeExamSubjects(course.examSubjects, customRaw);
  if (sanitized.length) return sanitized;
  return inferExamSubjectsFromCourseName(course.name, course.category, customRaw);
}

function collectSubjectsFromCourses(courses, customRaw) {
  return [];
}

function mergeCourseSubjectsIntoCustom(customRaw, courses) {
  return { custom: normalizeCustomList(customRaw), added: [] };
}

module.exports = {
  BUILTIN_EXAM_SUBJECT_IDS,
  BUILTIN_EXAM_SUBJECTS,
  OFFICE_EXAM_IDS,
  isExcludedExamSubjectId,
  EXAM_SUBJECT_LABELS,
  slugifyExamSubjectId,
  sanitizeCustomExamSubjectEntry,
  normalizeCustomList,
  getMergedExamCatalog,
  getValidExamSubjectIds,
  sanitizeExamSubjects,
  resolveExamSubjectsForCourse,
  inferExamSubjectsFromCourseName,
  resolveExamSubjectId,
  collectSubjectsFromCourses,
  mergeCourseSubjectsIntoCustom,
};
