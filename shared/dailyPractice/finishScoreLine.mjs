/** Ô thống kê hoàn thành luyện: «7 câu trên 7 câu». */
export function formatPracticeScoreQuestions(correct, total) {
  const t = Math.max(1, Number(total) || 1);
  const c = Math.max(0, Math.min(t, Number(correct) || 0));
  return `${c} câu trên ${t} câu`;
}
