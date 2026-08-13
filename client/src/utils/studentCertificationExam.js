/**
 * Certification exam instance helpers (StudentTest only).
 * Shuffle is presentation-only — never mutate Question Bank source objects.
 */

/** Fisher–Yates. Optional `random` for deterministic tests. */
export function shuffleArray(array, random = Math.random) {
  const result = Array.isArray(array) ? [...array] : [];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Shuffle options and remap `answer` to the new index of the same option text/original slot.
 * Does not mutate the input question.
 */
export function withShuffledOptions(question, random = Math.random) {
  if (!question || typeof question !== 'object') return question;

  const options = Array.isArray(question.options)
    ? question.options.filter((o) => o != null && String(o).trim())
    : [];

  if (options.length < 2) {
    return { ...question, options: [...options] };
  }

  const originalAnswer = Number(question.answer);
  const indexed = options.map((text, originalIndex) => ({ text, originalIndex }));
  const shuffled = shuffleArray(indexed, random);
  let newAnswer = shuffled.findIndex((item) => item.originalIndex === originalAnswer);
  if (newAnswer < 0) newAnswer = 0;

  return {
    ...question,
    options: shuffled.map((item) => item.text),
    answer: newAnswer,
  };
}

/**
 * Build a one-shot exam instance: shuffle question order, then shuffle each question's options.
 * Shallow-copies each question so the bank is never mutated.
 */
export function buildCertificationExamInstance(rawQuestions, random = Math.random) {
  const list = (Array.isArray(rawQuestions) ? rawQuestions : []).map((q) => ({
    ...q,
    options: Array.isArray(q?.options) ? [...q.options] : [],
  }));
  return shuffleArray(list, random).map((q) => withShuffledOptions(q, random));
}

/** Stable bank identity (order-independent) for attempt restore. */
export function bankFingerprint(questions) {
  return (questions || [])
    .map((q) => String(q?.id ?? ''))
    .filter(Boolean)
    .sort()
    .join('|');
}

export function gradeMcByAnswerIndex(questions, answers) {
  return (answers || []).reduce(
    (acc, a, i) => acc + (a === questions?.[i]?.answer ? 1 : 0),
    0,
  );
}

export function getCertificationAttemptKey(studentId, subjectId) {
  return `cert_exam_attempt:${studentId || 'anon'}:${subjectId || 'unknown'}`;
}

export function loadCertificationAttempt(key) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCertificationAttempt(key, payload) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearCertificationAttempt(key) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Resume saved attempt if fingerprint + length match; otherwise build a new shuffled instance.
 */
export function resolveCertificationExamAttempt({
  rawQuestions,
  saved,
  random = Math.random,
}) {
  const fp = bankFingerprint(rawQuestions);
  const n = Array.isArray(rawQuestions) ? rawQuestions.length : 0;

  if (
    saved
    && saved.bankFingerprint === fp
    && Array.isArray(saved.questions)
    && saved.questions.length === n
    && n > 0
  ) {
    const answers = Array.isArray(saved.answers) && saved.answers.length === n
      ? saved.answers
      : Array(n).fill(null);
    return {
      questions: saved.questions,
      answers,
      currentQ: Math.min(Math.max(0, Number(saved.currentQ) || 0), n - 1),
      timeLeft: Number.isFinite(Number(saved.timeLeft)) ? Number(saved.timeLeft) : null,
      isTracNghiemSubmitted: Boolean(saved.isTracNghiemSubmitted),
      tab: saved.tab === 'tu_luan' ? 'tu_luan' : 'trac_nghiem',
      examPhase: saved.examPhase === 'essay' ? 'essay' : 'mc',
      resumed: true,
      bankFingerprint: fp,
    };
  }

  const questions = buildCertificationExamInstance(rawQuestions, random);
  return {
    questions,
    answers: Array(questions.length).fill(null),
    currentQ: 0,
    timeLeft: null,
    isTracNghiemSubmitted: false,
    tab: 'trac_nghiem',
    examPhase: 'mc',
    resumed: false,
    bankFingerprint: fp,
  };
}
