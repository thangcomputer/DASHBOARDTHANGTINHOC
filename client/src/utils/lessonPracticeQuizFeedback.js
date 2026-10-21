export const PRACTICE_PRAISES = [
  { text: 'Bạn giỏi quá!', icon: '🌟' },
  { text: 'Quá đỉnh!', icon: '⚡' },
  { text: 'Quá VIP!', icon: '🔥' },
  { text: 'Xuất sắc luôn!', icon: '🏆' },
  { text: 'Siêu trí tuệ!', icon: '🧠' },
  { text: 'Đỉnh của chóp!', icon: '🚀' },
  { text: 'Không thể tin nổi!', icon: '🤩' },
  { text: 'Cao thủ xuất hiện!', icon: '👑' },
  { text: 'Bạn quá tuyệt vời!', icon: '💎' },
  { text: 'HOÀN HẢO! Bạn là nhà vô địch!', icon: '🥇' },
];

export const PRACTICE_ENCOURAGEMENTS = [
  'Không sao đâu, cố lên nhé!',
  'Mỗi lần thử là thêm một điều bạn hiểu!',
  'Bạn đang tiến bộ từng ngày!',
  'Thử lại nhé, bạn sắp hiểu rồi!',
  'Kiên trì là sẽ làm được!',
  'Học từng bước, giỏi từng ngày!',
  'Cùng bình tĩnh, rồi mình thử tiếp nhé!',
  'Xem lại kiến thức rồi thử tiếp nào!',
  'Mỗi lần thử là một lần tiến bộ!',
  'Bạn làm được mà, cố lên!',
];

export function createPracticeAttemptStats() {
  return { correctAttempts: 0, wrongAttempts: 0, streak: 0, bestStreak: 0 };
}

export function normalizePracticeAttemptStats(value) {
  const stats = value && typeof value === 'object' ? value : {};
  const nonNegativeInteger = (number) => (
    Number.isFinite(Number(number)) ? Math.max(0, Math.floor(Number(number))) : 0
  );
  return {
    correctAttempts: nonNegativeInteger(stats.correctAttempts),
    wrongAttempts: nonNegativeInteger(stats.wrongAttempts),
    streak: nonNegativeInteger(stats.streak),
    bestStreak: nonNegativeInteger(stats.bestStreak),
  };
}

export function advancePracticeAttemptStats(current, correct) {
  const stats = normalizePracticeAttemptStats(current);
  if (!correct) {
    return { ...stats, wrongAttempts: stats.wrongAttempts + 1, streak: 0 };
  }
  const streak = stats.streak + 1;
  return {
    ...stats,
    correctAttempts: stats.correctAttempts + 1,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  };
}

export function getPracticePraise(correctCount) {
  const count = Math.max(1, Math.floor(Number(correctCount) || 1));
  return PRACTICE_PRAISES[(count - 1) % PRACTICE_PRAISES.length];
}

export function getPracticeEncouragement(wrongCount) {
  const count = Math.max(1, Math.floor(Number(wrongCount) || 1));
  return PRACTICE_ENCOURAGEMENTS[(count - 1) % PRACTICE_ENCOURAGEMENTS.length];
}

export function summarizePracticeAttempt(items, attemptStats) {
  const questions = Array.isArray(items) ? items : [];
  const stats = normalizePracticeAttemptStats(attemptStats);
  const correct = questions.filter((item) => item.confirmed === true && item.correct === true).length;
  const total = questions.length;
  const attempts = correct + stats.wrongAttempts;
  return {
    correct,
    total,
    wrong: stats.wrongAttempts,
    percentage: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    bestStreak: stats.bestStreak,
  };
}

export function isPracticeAttemptComplete(items) {
  return Array.isArray(items) && items.length > 0
    && items.every((item) => item.confirmed === true && item.correct === true);
}

export function isPerfectTenPracticeResult(result) {
  return result?.total === 10 && result?.correct === 10;
}

export function claimPracticeSubmission(activeIds, itemId, confirmed = false) {
  if (confirmed || activeIds.has(itemId)) return false;
  activeIds.add(itemId);
  return true;
}
