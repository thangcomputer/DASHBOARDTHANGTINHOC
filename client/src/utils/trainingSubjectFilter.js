/** Training content visibility by exam subject */
import {
  mapCourseToExamSubjectIds,
  normalizeCourseKey,
  BUILTIN_EXAM_SUBJECTS,
} from './examSubjects.js';

export function getItemExamSubjects(item) {
  return Array.isArray(item?.examSubjects) ? item.examSubjects.filter(Boolean) : [];
}

export function resolveItemExamSubjects(item, catalog = BUILTIN_EXAM_SUBJECTS) {
  const explicit = getItemExamSubjects(item);
  if (explicit.length) return explicit;
  const title = String(item?.title || item?.courseName || item?.name || '').trim();
  if (!title) return [];
  return mapCourseToExamSubjectIds(title, catalog);
}

export function parseSpecialtyToSubjectIds(specialty, catalog = BUILTIN_EXAM_SUBJECTS) {
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

export function resolveTeacherSubjectIds(teacher, catalog = BUILTIN_EXAM_SUBJECTS) {
  const fromIds = Array.isArray(teacher?.subjectIds) ? teacher.subjectIds.filter(Boolean) : [];
  if (fromIds.length) return fromIds;
  return parseSpecialtyToSubjectIds(teacher?.specialty, catalog);
}

export function itemMatchesSubjectIds(item, allowedSubjectIds, catalog = BUILTIN_EXAM_SUBJECTS) {
  const itemSubs = resolveItemExamSubjects(item, catalog);
  // Nội dung chưa gắn môn → hiển thị chung (tránh GV/HV thấy list trống)
  if (!itemSubs.length) return true;
  // Người xem chưa có môn chuyên môn → vẫn xem được toàn bộ
  if (!allowedSubjectIds?.length) return true;
  const set = new Set(allowedSubjectIds);
  return itemSubs.some((id) => set.has(id));
}

export function filterTrainingItemsBySubject(items, allowedSubjectIds, catalog = BUILTIN_EXAM_SUBJECTS) {
  const list = Array.isArray(items) ? items : [];
  if (!allowedSubjectIds?.length) return list;
  return list.filter((item) => itemMatchesSubjectIds(item, allowedSubjectIds, catalog));
}
