/** Client-side grading for CertPrep immediate-feedback mode (keys come from server). */

function pairKey(itemId, targetId) {
  return `${String(itemId)}=>${String(targetId)}`;
}

export function gradeCertPrepQuestion(question, value) {
  if (!question) return false;
  if (question.type === 'single_choice') {
    return Number(value) === Number(question.correctAnswer);
  }
  if (question.type === 'multiple_choice') {
    const selected = [...new Set((Array.isArray(value) ? value : []).map(Number))]
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
    const correct = [...new Set((question.correctIndices || []).map(Number))]
      .sort((a, b) => a - b);
    if (correct.length === 0) return false;
    if (selected.length !== correct.length) return false;
    return selected.every((n, i) => n === correct[i]);
  }
  if (question.type === 'matching') {
    const expected = new Set(
      (question.matchingPairs || []).map((p) => pairKey(p.itemId, p.targetId)),
    );
    const got = new Set(
      (Array.isArray(value) ? value : []).map((p) => pairKey(p?.itemId, p?.targetId)),
    );
    if (expected.size === 0 || expected.size !== got.size) return false;
    for (const key of expected) {
      if (!got.has(key)) return false;
    }
    return true;
  }
  if (question.type === 'true_false_grid') {
    const statements = Array.isArray(question.statements) ? question.statements : [];
    if (!statements.length) return false;
    const byId = new Map(
      (Array.isArray(value) ? value : []).map((row) => [String(row?.id), row?.value]),
    );
    return statements.every((s) => {
      const id = String(s.id);
      if (!byId.has(id)) return false;
      const v = byId.get(id);
      if (typeof v !== 'boolean') return false;
      return v === Boolean(s.correct);
    });
  }
  return false;
}

export function isImmediateFeedback(session) {
  return String(session?.configSnapshot?.feedbackMode || '') === 'immediate';
}
