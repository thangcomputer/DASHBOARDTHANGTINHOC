/**
 * Logic chấm bài thi Giảng viên / Trắc nghiệm.
 * Ngân hàng câu hỏi do Admin quản lý (API + DataContext), không còn seed cứng trong file này.
 */

import { isStudentEssayQuestion, normalizeMcCorrectIndex } from '../utils/htmlContent';

/** @deprecated Giữ export rỗng để tránh import cũ; dùng `questions` từ DataContext / API. */
export const QUESTION_BANK = [];

/**
 * Lấy ngẫu nhiên tối đa `total` câu từ một mảng ngân hàng (xáo trộn).
 * @param {number} total
 * @param {object[]} bank
 */
export const getRandomQuestions = (total = 10, bank = []) => {
  const source = Array.isArray(bank) ? bank.filter(Boolean) : [];
  if (!source.length) return [];
  return [...source].sort(() => Math.random() - 0.5).slice(0, Math.min(total, source.length));
};

/**
 * Chấm điểm theo phần (section). Câu tự luận (essay) không tính vào % tự động.
 */
export const gradeAnswers = (questions, answers) => {
  const count = {};
  const bySection = {};
  let correct = 0;
  let mcCount = 0;

  (questions || []).forEach((q, i) => {
    if (isStudentEssayQuestion(q)) return;
    mcCount += 1;
    const sec = q._examSubjectId || q.section || 'unknown';
    count[sec] = (count[sec] || 0) + 1;
    const correctIdx = normalizeMcCorrectIndex(q.correct);
    const raw = answers[i];
    const userIdx = raw === undefined || raw === null || raw === ''
      ? null
      : Number(raw);
    const isCorrect = correctIdx != null && userIdx != null && !Number.isNaN(userIdx) && userIdx === correctIdx;
    if (isCorrect) {
      correct += 1;
      bySection[sec] = (bySection[sec] || 0) + 1;
    }
  });

  const sectionFailures = Object.keys(count)
    .filter((sec) => count[sec] > 0 && ((bySection[sec] || 0) / count[sec]) < 0.5)
    .map((sec) => ({
      sectionId: sec,
      correct: bySection[sec] || 0,
      total: count[sec],
    }));

  const total = mcCount > 0 ? Math.round((correct / mcCount) * 100) : 0;
  const pass = total >= 80 && sectionFailures.length === 0;

  return {
    excel: bySection.excel || 0,
    word: bySection.word || 0,
    powerpoint: bySection.powerpoint || 0,
    coban: bySection.coban || 0,
    situation: bySection.situation || 0,
    total,
    count,
    correctCount: correct,
    mcTotal: mcCount,
    wrongCount: mcCount - correct,
    needsReviewCount: mcCount - correct,
    sectionFailures,
    pass,
  };
};
