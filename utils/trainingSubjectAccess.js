'use strict';
const BUILTIN_EXAM_SUBJECTS = {
  coban: { id: 'coban', label: 'May vi tinh (Co ban)' },
  word: { id: 'word', label: 'Word' },
  excel: { id: 'excel', label: 'Excel' },
  powerpoint: { id: 'powerpoint', label: 'PowerPoint' },
  canva: { id: 'canva', label: 'Canva' },
};
function normalizeCourseKey(name) {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd');
}
function mapCourseToExamSubjectIds(courseName) {
  const n = normalizeCourseKey(courseName);
  const pick = (ids) => ids.filter((id) => BUILTIN_EXAM_SUBJECTS[id]);
  if (n.includes('canva')) return pick(['canva']);
  if (n.includes('thvp') || n.includes('van phong') || n.includes('tin hoc van phong') || n.includes('microsoft office')) return pick(['coban', 'word', 'excel', 'powerpoint']);
  if (n.includes('excel') && !n.includes('van phong')) return pick(['coban', 'excel']);
  if (n.includes('word') && !n.includes('van phong')) return pick(['coban', 'word']);
  if (n.includes('powerpoint') || n.includes('ppt')) return pick(['coban', 'powerpoint']);
  for (const sub of Object.values(BUILTIN_EXAM_SUBJECTS)) {
    if (n.includes(sub.id) || n.includes(normalizeCourseKey(sub.label))) return [sub.id];
  }
  return [];
}
function getItemExamSubjects(item) {
  return Array.isArray(item?.examSubjects) ? item.examSubjects.filter(Boolean) : [];
}
function resolveItemExamSubjects(item) {
  const explicit = getItemExamSubjects(item);
  if (explicit.length) return explicit;
  const title = String(item?.title || item?.courseName || item?.name || '').trim();
  if (!title) return [];
  return mapCourseToExamSubjectIds(title);
}
function parseSpecialtyToSubjectIds(specialty, catalog) {
  const text = String(specialty || '').trim();
  if (!text) return [];
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const parts = text.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean);
  const ids = new Set();

  const entries = Object.entries(cat)
    .map(([id, meta]) => ({
      id,
      labelN: normalizeCourseKey(meta.label || ''),
      idN: normalizeCourseKey(id),
    }))
    .sort((a, b) => b.labelN.length - a.labelN.length);

  for (const part of parts) {
    const np = normalizeCourseKey(part);
    if (!np) continue;

    const byLabel = entries.find((e) => e.labelN === np);
    if (byLabel) {
      ids.add(byLabel.id);
      continue;
    }

    const byId = entries.find((e) => e.idN === np || e.id === String(part).toLowerCase());
    if (byId) {
      ids.add(byId.id);
      continue;
    }
  }

  if (!ids.size) {
    mapCourseToExamSubjectIds(text, cat).forEach((id) => ids.add(id));
  }

  return [...ids];
}
function resolveTeacherSubjectIds(teacher) {
  const fromIds = Array.isArray(teacher?.subjectIds) ? teacher.subjectIds.filter(Boolean) : [];
  if (fromIds.length) return fromIds;
  return parseSpecialtyToSubjectIds(teacher?.specialty);
}
function itemMatchesSubjectIds(item, allowedSubjectIds) {
  const itemSubs = resolveItemExamSubjects(item);
  if (!itemSubs.length) return true;
  if (!allowedSubjectIds?.length) return true;
  const set = new Set(allowedSubjectIds);
  return itemSubs.some((id) => set.has(id));
}
function filterTrainingItemsBySubject(items, allowedSubjectIds) {
  const list = Array.isArray(items) ? items : [];
  if (!allowedSubjectIds?.length) return list;
  return list.filter((item) => itemMatchesSubjectIds(item, allowedSubjectIds));
}
module.exports = { resolveTeacherSubjectIds, resolveItemExamSubjects, itemMatchesSubjectIds, filterTrainingItemsBySubject };
