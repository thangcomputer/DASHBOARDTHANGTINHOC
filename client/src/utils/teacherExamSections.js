export const TEACHER_EXAM_SECTIONS = [
  { id: 'excel', label: 'Excel' },
  { id: 'word', label: 'Word' },
  { id: 'powerpoint', label: 'PowerPoint' },
  { id: 'computer', label: 'M\u00e1y t\u00ednh & Windows' },
  { id: 'situation', label: 'T\u00ecnh Hu\u1ed1ng S\u01b0 Ph\u1ea1m' },
  { id: 'other', label: 'Ki\u1ebfn th\u1ee9c Kh\u00e1c' },
];

const LEGACY_TEACHER_SECTIONS = new Set([
  'computer', 'situation', 'other', 'supham', 'su-pham', 'ppt', 'pp', 'maytinh',
]);

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
