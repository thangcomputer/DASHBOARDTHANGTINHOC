export const TEACHER_EXAM_SECTIONS = [
  { id: 'mon-kiem-thu', label: 'Môn kiểm thử' },
];

const LEGACY_TEACHER_SECTIONS = new Set();

/** Section cũ trong DB — vẫn hiện để admin sửa/xóa */
export function isLegacyTeacherExamSection(section) {
  return LEGACY_TEACHER_SECTIONS.has(String(section || '').toLowerCase().trim());
}

export const DEFAULT_TEACHER_EXAM_MINUTES = Object.fromEntries(
  TEACHER_EXAM_SECTIONS.map((s) => [s.id, 90]),
);

export const DEFAULT_TEACHER_ESSAY_EXAM_MINUTES = Object.fromEntries(
  TEACHER_EXAM_SECTIONS.map((s) => [s.id, 60]),
);

export function getTeacherSectionOptions() {
  return TEACHER_EXAM_SECTIONS;
}
