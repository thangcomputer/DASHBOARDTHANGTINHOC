const BUILTIN_EXAM_SUBJECTS = [
  { id: 'coban', label: 'May vi tinh (Co ban)', short: 'C', bg: 'bg-slate-600', minutes: 90, builtin: true, group: 'office' },
  { id: 'word', label: 'Word', short: 'W', bg: 'bg-blue-600', minutes: 90, builtin: true, group: 'office' },
  { id: 'excel', label: 'Excel', short: 'X', bg: 'bg-green-600', minutes: 90, builtin: true, group: 'office' },
  { id: 'powerpoint', label: 'PowerPoint', short: 'P', bg: 'bg-orange-500', minutes: 90, builtin: true, group: 'office' },
  { id: 'photoshop', label: 'Photoshop', short: 'PS', bg: 'bg-sky-600', minutes: 90, builtin: true, group: 'design' },
  { id: 'canva', label: 'Canva', short: 'CA', bg: 'bg-purple-600', minutes: 90, builtin: true, group: 'design' },
  { id: 'corel', label: 'Corel', short: 'CR', bg: 'bg-pink-600', minutes: 90, builtin: true, group: 'design' },
  { id: 'autocad', label: 'AutoCAD', short: 'AU', bg: 'bg-amber-600', minutes: 90, builtin: true, group: 'design' },
  { id: 'mos-word', label: 'MOS-Word', short: 'MW', bg: 'bg-indigo-600', minutes: 90, builtin: true, group: 'mos' },
  { id: 'mos-excel', label: 'MOS-Excel', short: 'ME', bg: 'bg-emerald-700', minutes: 90, builtin: true, group: 'mos' },
  { id: 'mos-powerpoint', label: 'MOS-PowerPoint', short: 'MP', bg: 'bg-rose-600', minutes: 90, builtin: true, group: 'mos' },
  { id: 'cpp', label: 'C++', short: 'C+', bg: 'bg-cyan-700', minutes: 90, builtin: true, group: 'programming' },
  { id: 'web', label: 'Web', short: 'WB', bg: 'bg-teal-700', minutes: 90, builtin: true, group: 'programming' },
  { id: 'python', label: 'Python', short: 'PY', bg: 'bg-yellow-600', minutes: 90, builtin: true, group: 'programming' },
  { id: 'situation', label: 'Su pham (Tinh huong)', short: 'SP', bg: 'bg-red-600', minutes: 90, builtin: true, group: 'pedagogy' },
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
  return { id, label, short, bg, minutes, custom: true, group: String(raw?.group || 'admin').trim() || 'admin' };
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
  if (n.includes('mos')) return pick(['mos-word', 'mos-excel', 'mos-powerpoint']);
  if (n.includes('photoshop')) return pick(['photoshop']);
  if (n.includes('corel')) return pick(['corel']);
  if (n.includes('autocad')) return pick(['autocad']);
  if (n.includes('python')) return pick(['python']);
  if (n.includes('c++') || n.includes('cpp')) return pick(['cpp']);
  if (n.includes('web')) return pick(['web']);
  if (n.includes('canva')) return pick(['canva']);
  if (category === 'van-phong') return pick([...OFFICE_EXAM_IDS]);
  if (category === 'chung-chi') return pick(['mos-word', 'mos-excel', 'mos-powerpoint']);
  if (category === 'do-hoa') return pick(['photoshop', 'canva', 'corel', 'autocad']);
  if (category === 'lap-trinh') return pick(['cpp', 'web', 'python']);
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

/**
 * Quét Course.examSubjects / tên khóa → sinh môn custom còn thiếu (group: admin).
 * Dùng để Teacher/Student nhìn thấy đúng các môn Admin đã gắn vào khóa học cũ.
 */
function collectSubjectsFromCourses(courses, customRaw) {
  const existing = new Set(getMergedExamCatalog(customRaw).map((s) => s.id));
  const discovered = [];
  const seen = new Set();

  (Array.isArray(courses) ? courses : []).forEach((course) => {
    const rawIds = Array.isArray(course?.examSubjects)
      ? course.examSubjects.map(String)
      : [];

    rawIds.forEach((rawId) => {
      const id = String(rawId || '').trim();
      if (!id || existing.has(id) || seen.has(id) || BUILTIN_EXAM_SUBJECT_IDS.includes(id)) return;
      seen.add(id);
      const labelFromId = id
        .split('-')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const entry = sanitizeCustomExamSubjectEntry({
        id,
        label: labelFromId || id,
        group: 'admin',
      });
      if (entry) discovered.push(entry);
    });
  });

  return discovered;
}

function mergeCourseSubjectsIntoCustom(customRaw, courses) {
  const base = normalizeCustomList(customRaw);
  const discovered = collectSubjectsFromCourses(courses, base);
  if (!discovered.length) return { custom: base, added: [] };
  const seen = new Set(base.map((s) => s.id));
  const added = [];
  discovered.forEach((entry) => {
    if (seen.has(entry.id) || BUILTIN_EXAM_SUBJECT_IDS.includes(entry.id)) return;
    seen.add(entry.id);
    base.push(entry);
    added.push(entry);
  });
  return { custom: base, added };
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
  collectSubjectsFromCourses,
  mergeCourseSubjectsIntoCustom,
};
