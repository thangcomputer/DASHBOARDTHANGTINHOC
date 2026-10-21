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

export function normalizePracticeWrongQuestionIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === 'string' && id))]
    : [];
}

export function retainKnownPracticeWrongQuestionIds(value, items) {
  const knownIds = new Set((Array.isArray(items) ? items : []).map((item) => String(item?.id)));
  return normalizePracticeWrongQuestionIds(value).filter((id) => knownIds.has(id));
}

export function addPracticeWrongQuestionId(current, itemId) {
  if (typeof itemId !== 'string' || !itemId) return normalizePracticeWrongQuestionIds(current);
  return [...new Set([...normalizePracticeWrongQuestionIds(current), itemId])];
}

export function isPracticeReviewSupported(item) {
  if (item?.confirmed !== true || item.correct !== true || !item.answer) return false;
  const optionIds = new Set((Array.isArray(item.options) ? item.options : []).map((option) => String(option.id)));
  if (item.type === 'mcq') {
    return typeof item.answer.choiceId === 'string' && optionIds.has(item.answer.choiceId);
  }
  if (item.type === 'multi') {
    return Array.isArray(item.answer.choiceIds)
      && item.answer.choiceIds.length > 0
      && item.answer.choiceIds.every((id) => optionIds.has(String(id)));
  }
  if (item.type === 'match') {
    if (!Array.isArray(item.pairs) || !item.pairs.length
      || !Array.isArray(item.answer.matches) || item.answer.matches.length !== item.pairs.length) return false;
    const expectedByLeft = new Map(item.answer.matches.map((pair) => [String(pair.leftId), String(pair.rightId)]));
    return item.pairs.every((pair) => expectedByLeft.has(String(pair.id)));
  }
  if (item.type === 'drag') {
    return optionIds.size > 0
      && Array.isArray(item.answer.order)
      && item.answer.order.length === optionIds.size
      && new Set(item.answer.order.map(String)).size === optionIds.size
      && item.answer.order.every((id) => optionIds.has(String(id)));
  }
  if (item.type === 'hotspot') {
    return [item.answer.x, item.answer.y, item.region?.x, item.region?.y, item.region?.w, item.region?.h]
      .every((value) => value !== null && value !== '' && Number.isFinite(Number(value)));
  }
  return false;
}

function sameStringSet(first, second) {
  const a = [...new Set((Array.isArray(first) ? first : []).map(String))].sort();
  const b = [...new Set((Array.isArray(second) ? second : []).map(String))].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isPointInReviewRegion(x, y, region) {
  const rawX = Number(x);
  const rawY = Number(y);
  const left = Number(region?.x);
  const top = Number(region?.y);
  const width = Number(region?.w);
  const height = Number(region?.h);
  if (![rawX, rawY, left, top, width, height].every(Number.isFinite)) return false;
  const pointX = Math.min(100, Math.max(0, rawX));
  const pointY = Math.min(100, Math.max(0, rawY));
  return [pointX, pointY, left, top, width, height].every(Number.isFinite)
    && pointX >= left && pointX <= left + width
    && pointY >= top && pointY <= top + height;
}

export function gradePracticeReviewAnswer(item, submitted) {
  if (!isPracticeReviewSupported(item) || !item.answer || !submitted) return null;
  if (item.type === 'mcq') {
    const choiceId = String(submitted.choiceId || '');
    const validOption = (item.options || []).some((option) => String(option.id) === choiceId);
    return validOption ? choiceId === String(item.answer.choiceId || '') : false;
  }
  if (item.type === 'multi') {
    const choiceIds = Array.isArray(submitted.choiceIds) ? submitted.choiceIds : [];
    const validIds = new Set((item.options || []).map((option) => String(option.id)));
    if (!choiceIds.length || choiceIds.some((id) => !validIds.has(String(id)))) return false;
    return sameStringSet(choiceIds, item.answer.choiceIds);
  }
  if (item.type === 'match') {
    const pairs = Array.isArray(item.pairs) ? item.pairs : [];
    const submittedByLeft = new Map(
      (Array.isArray(submitted.matches) ? submitted.matches : [])
        .map((pair) => [String(pair.leftId), String(pair.rightId)]),
    );
    const expectedByLeft = new Map(
      (Array.isArray(item.answer.matches) ? item.answer.matches : [])
        .map((pair) => [String(pair.leftId), String(pair.rightId)]),
    );
    return pairs.length > 0 && pairs.every((pair) => (
      submittedByLeft.get(String(pair.id)) === expectedByLeft.get(String(pair.id))
    ));
  }
  if (item.type === 'drag') {
    const expected = (Array.isArray(item.answer.order) ? item.answer.order : []).map(String);
    const order = (Array.isArray(submitted.order) ? submitted.order : []).map(String);
    const validIds = new Set((item.options || []).map((option) => String(option.id)));
    return expected.length > 0
      && order.length === expected.length
      && order.every((id) => validIds.has(id))
      && order.every((id, index) => id === expected[index]);
  }
  if (item.type === 'hotspot') {
    return isPointInReviewRegion(submitted.x, submitted.y, item.region);
  }
  return null;
}

export function normalizePracticeReviewResults(value, items) {
  const allowedIds = new Set(
    (Array.isArray(items) ? items : [])
      .filter(isPracticeReviewSupported)
      .map((item) => String(item.id)),
  );
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([id, correct]) => allowedIds.has(id) && typeof correct === 'boolean'),
  );
}

export function summarizePracticeReview(items, results) {
  const reviewableItems = (Array.isArray(items) ? items : []).filter(isPracticeReviewSupported);
  const validResults = normalizePracticeReviewResults(results, reviewableItems);
  const improved = Object.values(validResults).filter(Boolean).length;
  const needsReview = Object.values(validResults).filter((correct) => !correct).length;
  const remaining = reviewableItems.length - Object.keys(validResults).length;
  return {
    total: reviewableItems.length,
    improved,
    needsReview,
    remaining,
    complete: reviewableItems.length > 0 && remaining === 0,
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
