const norm = (value) => String(value ?? '').trim().toLowerCase();

/** Chấm ôn lại trên client — dùng đáp án đã nhận từ lần nộp chính thức. */
export function gradePracticeAnswer(question, answer, correctAnswer) {
  if (!question?.type || !correctAnswer) return false;
  switch (question.type) {
    case 'mcq':
      return Number(answer.index) === Number(correctAnswer.correctIndex);
    case 'truefalse':
      return typeof answer.value === 'boolean' && answer.value === correctAnswer.answerBool;
    case 'order': {
      const items = Array.isArray(answer.items) ? answer.items : [];
      const expected = Array.isArray(correctAnswer.items) ? correctAnswer.items : [];
      return items.length === expected.length
        && expected.every((item, index) => norm(items[index]) === norm(item));
    }
    case 'match': {
      const given = new Map(
        (Array.isArray(answer.pairs) ? answer.pairs : []).map((pair) => [norm(pair?.left), norm(pair?.right)]),
      );
      const expected = Array.isArray(correctAnswer.pairs) ? correctAnswer.pairs : [];
      return given.size === expected.length
        && expected.every((pair) => given.get(norm(pair.left)) === norm(pair.right));
    }
    case 'fill': {
      const expected = Array.isArray(correctAnswer.answers) ? correctAnswer.answers : [];
      const blanks = Array.isArray(answer.blanks) ? answer.blanks : [];
      return blanks.length === expected.length
        && expected.every((word, index) => norm(blanks[index]) === norm(word));
    }
    case 'sort': {
      const placements = answer.placements && typeof answer.placements === 'object' ? answer.placements : {};
      const given = new Map(Object.entries(placements).map(([item, group]) => [norm(item), norm(group)]));
      const expected = (correctAnswer.groups || []).flatMap((group) => (
        (group.items || []).map((item) => [norm(item), norm(group.name)])
      ));
      return given.size === expected.length
        && expected.every(([item, group]) => given.get(item) === group);
    }
    default:
      return false;
  }
}
