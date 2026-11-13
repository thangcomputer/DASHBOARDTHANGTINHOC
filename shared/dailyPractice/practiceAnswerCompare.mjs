function stablePayload(answer) {
  if (!answer || typeof answer !== 'object') return answer;
  if (answer.placements && typeof answer.placements === 'object') {
    const keys = Object.keys(answer.placements).sort();
    const placements = {};
    keys.forEach((k) => { placements[k] = answer.placements[k]; });
    return { placements };
  }
  if (Array.isArray(answer.items)) {
    return { items: [...answer.items] };
  }
  if (Array.isArray(answer.blanks)) {
    return { blanks: [...answer.blanks] };
  }
  if (Array.isArray(answer.pairs)) {
    const pairs = [...answer.pairs]
      .map((p) => ({ left: p.left, right: p.right }))
      .sort((a, b) => String(a.left).localeCompare(String(b.left), 'vi'));
    return { pairs };
  }
  return answer;
}

/** Chuẩn hóa payload đáp án để so sánh «đã đổi chưa» sau khi sai. */
export function serializePracticeAnswer(answer) {
  if (answer == null) return '';
  try {
    return JSON.stringify(stablePayload(answer));
  } catch {
    return String(answer);
  }
}

/** Baseline sau reset — ghép / phân loại / điền khuyết chờ làm đủ mới bật Thử lại. */
export const RETRY_BASELINE_EMPTY = '__DP_RETRY_EMPTY__';

/** Đáp án hiện tại khác baseline (trạng thái ngay sau khi hiện Thử lại). */
export function retryAnswerChanged(pending, retryBaselineKey) {
  if (pending == null || !retryBaselineKey) return false;
  if (retryBaselineKey === RETRY_BASELINE_EMPTY) return false;
  return serializePracticeAnswer(pending) !== retryBaselineKey;
}

/** Ghép cặp, phân loại, điền khuyết: đủ đáp án sau reset là đủ. Sắp xếp: phải đổi thứ tự so với mốc đầu. */
export function canSubmitRetryAfterWrong({ pending, retryBaselineKey, questionType }) {
  if (pending == null || !retryBaselineKey) return false;
  if (retryBaselineKey === RETRY_BASELINE_EMPTY) {
    return questionType === 'match' || questionType === 'sort' || questionType === 'fill';
  }
  if (questionType === 'match' || questionType === 'sort' || questionType === 'fill') {
    return true;
  }
  return retryAnswerChanged(pending, retryBaselineKey);
}
