'use strict';
const BUILTIN_EXAM_SUBJECTS = {
  'mon-kiem-thu': { id: 'mon-kiem-thu', label: 'Môn kiểm thử' },
};
function isSupportedExamSubjectId(id) {
  return Boolean(String(id || '').trim());
}
function normalizeCourseKey(name) {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd');
}
function mapCourseToExamSubjectIds(courseName) {
  const n = normalizeCourseKey(courseName);
  for (const sub of Object.values(BUILTIN_EXAM_SUBJECTS)) {
    if (n === normalizeCourseKey(sub.id) || n === normalizeCourseKey(sub.label)) return [sub.id];
  }
  return [];
}
function getItemExamSubjects(item) {
  return Array.isArray(item?.examSubjects)
    ? item.examSubjects.filter(isSupportedExamSubjectId)
    : [];
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
    .filter(([id]) => isSupportedExamSubjectId(id))
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
  const fromIds = Array.isArray(teacher?.subjectIds)
    ? teacher.subjectIds.filter(isSupportedExamSubjectId)
    : [];
  if (fromIds.length) return fromIds;
  return parseSpecialtyToSubjectIds(teacher?.specialty);
}
function itemMatchesSubjectIds(item, allowedSubjectIds) {
  const itemSubs = resolveItemExamSubjects(item);
  if (!itemSubs.length) return false;
  if (!allowedSubjectIds?.length) return false;
  const set = new Set(allowedSubjectIds);
  return itemSubs.some((id) => set.has(id));
}
function filterTrainingItemsBySubject(items, allowedSubjectIds) {
  const list = Array.isArray(items) ? items : [];
  if (!allowedSubjectIds?.length) return [];
  return list.filter((item) => itemMatchesSubjectIds(item, allowedSubjectIds));
}
module.exports = { resolveTeacherSubjectIds, resolveItemExamSubjects, itemMatchesSubjectIds, filterTrainingItemsBySubject };
