'use strict';

const PRACTICE_VIDEO_TOKEN = '__video__';

function questionKeyOf(q) {
  return String(q?._id ?? q?.id ?? '').trim();
}

/**
 * Chuẩn hóa thứ tự các mục trong một lượt Luyện tập (video tương tác + danh sách câu hỏi).
 * Nếu có video mà itemOrder chưa chứa token video, video mặc định nằm ở vị trí đầu (#1)
 * để học viên xem & trả lời đúng các mốc trước khi qua trắc nghiệm.
 */
function buildPracticeSequence({ hasVideo = false, itemOrder = [], questions = [] } = {}) {
  const qList = Array.isArray(questions) ? questions : [];
  const byId = new Map();
  for (const q of qList) {
    const key = questionKeyOf(q);
    if (key && !byId.has(key)) byId.set(key, q);
  }

  const ordered = [];
  const seen = new Set();
  for (const raw of Array.isArray(itemOrder) ? itemOrder : []) {
    const token = String(raw || '').trim();
    if (!token || seen.has(token)) continue;
    if (token === PRACTICE_VIDEO_TOKEN) {
      if (hasVideo) {
        ordered.push({ kind: 'video', key: PRACTICE_VIDEO_TOKEN });
        seen.add(PRACTICE_VIDEO_TOKEN);
      }
      continue;
    }
    const q = byId.get(token);
    if (q) {
      ordered.push({ kind: 'question', key: token, question: q });
      seen.add(token);
    }
  }

  for (const q of qList) {
    const key = questionKeyOf(q);
    if (key && !seen.has(key)) {
      ordered.push({ kind: 'question', key, question: q });
      seen.add(key);
    }
  }

  if (hasVideo && !seen.has(PRACTICE_VIDEO_TOKEN)) {
    ordered.unshift({ kind: 'video', key: PRACTICE_VIDEO_TOKEN });
  }
  return ordered;
}

/** Tách danh sách câu hỏi thuần và chỉ số chèn video (-1 nếu không có video). */
function splitPracticeSequence(sequence = []) {
  const orderedQuestions = [];
  let videoInsertIndex = -1;
  for (const item of Array.isArray(sequence) ? sequence : []) {
    if (item?.kind === 'video') {
      if (videoInsertIndex < 0) videoInsertIndex = orderedQuestions.length;
    } else if (item?.kind === 'question' && item.question) {
      orderedQuestions.push(item.question);
    }
  }
  return { orderedQuestions, videoInsertIndex };
}

/** Di chuyển 1 phần tử trong mảng token vị trí từ fromIndex đến toIndex. */
function movePracticeOrderToken(keys = [], fromIndex, toIndex) {
  const copy = [...(Array.isArray(keys) ? keys : [])];
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= copy.length
    || toIndex >= copy.length
    || fromIndex === toIndex
  ) {
    return copy;
  }
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

module.exports = {
  PRACTICE_VIDEO_TOKEN,
  buildPracticeSequence,
  splitPracticeSequence,
  movePracticeOrderToken,
};
