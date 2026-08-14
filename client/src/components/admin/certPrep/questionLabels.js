export const QUESTION_TYPES = [
  { value: 'single_choice', label: 'Một đáp án' },
  { value: 'multiple_choice', label: 'Nhiều đáp án' },
  { value: 'matching', label: 'Ghép câu' },
];

export function questionTypeLabel(type) {
  return QUESTION_TYPES.find((t) => t.value === type)?.label || type || '—';
}
