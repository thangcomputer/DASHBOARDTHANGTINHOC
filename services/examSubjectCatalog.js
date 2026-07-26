const BUILTIN_EXAM_SUBJECTS = [
  { id: 'coban', label: 'May vi tinh (Co ban)', short: 'C', bg: 'bg-slate-600', minutes: 90, builtin: true },
  { id: 'word', label: 'Word', short: 'W', bg: 'bg-blue-600', minutes: 90, builtin: true },
  { id: 'excel', label: 'Excel', short: 'X', bg: 'bg-green-600', minutes: 90, builtin: true },
  { id: 'powerpoint', label: 'PowerPoint', short: 'P', bg: 'bg-orange-500', minutes: 90, builtin: true },
  { id: 'canva', label: 'Canva', short: 'CA', bg: 'bg-purple-600', minutes: 90, builtin: true },
];

const BUILTIN_EXAM_SUBJECT_IDS = BUILTIN_EXAM_SUBJECTS.map((s) => s.id);
const OFFICE_EXAM_IDS = ['coban', 'word', 'excel', 'powerpoint'];

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
  return { id, label, short, bg, minutes, custom: true };
}

function normalizeCustomList(customRaw) {
  if (!Array.isArray(customRaw)) return [];
  const out = [];
  const seen = new Set(BUILTIN_EXAM_SUBJECT_IDS);
  customRaw.forEach((item) => {
    const entry = sanitizeCustomExamSubjectEntry(item);
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);
    out.push(entry);
  });
  return out;
}

function getMergedExamCatalog(customRaw) {
  const custom = normalizeCustomList(customRaw);
  return [...BUILTIN_EXAM_SUBJECTS, ...custom];
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
  const valid = getValidExamSubjectIds(customRaw);
  const pick = (ids) => ids.filter((id) => valid.has(id));
  if (n.includes('canva')) return pick(['canva']);
  if (category === 'van-phong' || category === 'chung-chi') return pick([...OFFICE_EXAM_IDS]);
  if (category === 'do-hoa') return pick(['canva']);
  if (n.includes('excel') && !n.includes('van phong')) return pick(['coban', 'excel']);
  if (n.includes('word') && !n.includes('van phong')) return pick(['coban', 'word']);
  if (n.includes('powerpoint') || n.includes('ppt')) return pick(['coban', 'powerpoint']);
  for (const sub of getMergedExamCatalog(customRaw)) {
    if (n.includes(sub.id) || n.includes(normalizeCourseKey(sub.label))) return [sub.id];
  }
  return pick([...OFFICE_EXAM_IDS]);
}

function resolveExamSubjectsForCourse(course, customRaw) {
  if (!course) return sanitizeExamSubjects([...OFFICE_EXAM_IDS], customRaw);
  const sanitized = sanitizeExamSubjects(course.examSubjects, customRaw);
  if (sanitized.length) return sanitized;
  return inferExamSubjectsFromCourseName(course.name, course.category, customRaw);
}

module.exports = {
  BUILTIN_EXAM_SUBJECT_IDS,
  BUILTIN_EXAM_SUBJECTS,
  OFFICE_EXAM_IDS,
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
};
