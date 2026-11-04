'use strict';

const TYPES = ['mcq', 'truefalse', 'order', 'match', 'fill', 'sort'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const XP_BY_DIFFICULTY = { easy: 10, medium: 15, hard: 20 };
const SESSION_SIZE = 10;
const TOPIC_ICONS = ['book', 'monitor', 'file-text', 'sheet', 'presentation', 'globe', 'keyboard', 'shield', 'cpu', 'mail', 'image', 'code'];
const TOPIC_COLORS = ['red', 'blue', 'green', 'orange', 'purple', 'teal', 'pink', 'amber', 'sky', 'slate'];
const DEFAULT_HINT = 'Đọc kỹ đề và loại trừ những phương án chắc chắn sai trước nhé.';
const BLANK_RE = /\{\{([^{}]+)\}\}/g;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const clean = (value, max = 200) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const norm = (value) => clean(value).toLocaleLowerCase('vi');

function cleanList(list, { min, max, label, maxLen = 120 }) {
  const values = (Array.isArray(list) ? list : []).map((item) => clean(item, maxLen)).filter(Boolean);
  if (values.length < min || values.length > max) throw httpError(400, `${label} cần từ ${min} đến ${max} mục`);
  return values;
}

function assertUnique(values, label) {
  const seen = new Set(values.map(norm));
  if (seen.size !== values.length) throw httpError(400, `${label} không được trùng nhau`);
}

function shuffle(list, rng = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Trộn nhưng tránh trùng đúng thứ tự gốc (không thì câu sắp xếp đã có sẵn đáp án). */
function shuffleChanged(list, rng = Math.random) {
  if (list.length < 2) return [...list];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = shuffle(list, rng);
    if (next.some((item, index) => item !== list[index])) return next;
  }
  return [...list.slice(1), list[0]];
}

/** "Nhấn {{Ctrl}} + {{C}} để sao chép" → đoạn chữ + chỗ trống, và đáp án theo thứ tự. */
function parseFill(text) {
  const segments = [];
  const answers = [];
  let last = 0;
  String(text || '').replace(BLANK_RE, (match, word, offset) => {
    if (offset > last) segments.push({ text: text.slice(last, offset) });
    segments.push({ blank: answers.length });
    answers.push(clean(word, 60));
    last = offset + match.length;
    return match;
  });
  if (last < String(text || '').length) segments.push({ text: text.slice(last) });
  return { segments, answers };
}

/** Chuẩn hóa + kiểm tra câu hỏi do admin/AI gửi lên; trả về các trường lưu DB. */
function validateQuestion(input = {}) {
  const type = String(input.type || '');
  if (!TYPES.includes(type)) throw httpError(400, 'Dạng câu hỏi không hợp lệ');
  const difficulty = String(input.difficulty || '');
  if (!DIFFICULTIES.includes(difficulty)) throw httpError(400, 'Độ khó không hợp lệ');
  const prompt = clean(input.prompt, 600);
  if (!prompt) throw httpError(400, 'Câu hỏi không được để trống');

  const doc = {
    type,
    difficulty,
    prompt,
    imageUrl: clean(input.imageUrl, 500),
    explanation: clean(input.explanation, 800),
    hint: clean(input.hint, 300),
    options: undefined,
    correctIndex: undefined,
    answerBool: undefined,
    items: undefined,
    pairs: undefined,
    text: undefined,
    distractors: undefined,
    groups: undefined,
  };

  if (type === 'mcq') {
    doc.options = cleanList(input.options, { min: 2, max: 6, label: 'Phương án' });
    assertUnique(doc.options, 'Phương án');
    const index = Number(input.correctIndex);
    if (!Number.isInteger(index) || index < 0 || index >= doc.options.length) throw httpError(400, 'Chưa chọn đáp án đúng');
    doc.correctIndex = index;
  } else if (type === 'truefalse') {
    if (typeof input.answerBool !== 'boolean') throw httpError(400, 'Chưa chọn Đúng hoặc Sai');
    doc.answerBool = input.answerBool;
  } else if (type === 'order') {
    doc.items = cleanList(input.items, { min: 3, max: 8, label: 'Các bước' });
    assertUnique(doc.items, 'Các bước');
  } else if (type === 'match') {
    const pairs = (Array.isArray(input.pairs) ? input.pairs : [])
      .map((pair) => ({ left: clean(pair?.left, 120), right: clean(pair?.right, 120) }))
      .filter((pair) => pair.left && pair.right);
    if (pairs.length < 2 || pairs.length > 6) throw httpError(400, 'Cần từ 2 đến 6 cặp ghép');
    assertUnique(pairs.map((pair) => pair.left), 'Vế trái');
    assertUnique(pairs.map((pair) => pair.right), 'Vế phải');
    doc.pairs = pairs;
  } else if (type === 'fill') {
    const text = clean(input.text, 600);
    const { answers } = parseFill(text);
    if (answers.length < 1 || answers.length > 5) throw httpError(400, 'Đoạn văn cần 1–5 chỗ trống dạng {{từ}}');
    if (answers.some((word) => !word)) throw httpError(400, 'Chỗ trống không được rỗng');
    doc.text = text;
    doc.distractors = (Array.isArray(input.distractors) ? input.distractors : [])
      .map((word) => clean(word, 60)).filter(Boolean).slice(0, 6);
    const answerSet = new Set(answers.map(norm));
    if (doc.distractors.some((word) => answerSet.has(norm(word)))) throw httpError(400, 'Từ gây nhiễu không được trùng đáp án');
  } else if (type === 'sort') {
    const groups = (Array.isArray(input.groups) ? input.groups : [])
      .map((group) => ({
        name: clean(group?.name, 60),
        items: (Array.isArray(group?.items) ? group.items : []).map((item) => clean(item, 80)).filter(Boolean),
      }))
      .filter((group) => group.name && group.items.length);
    if (groups.length < 2 || groups.length > 4) throw httpError(400, 'Cần từ 2 đến 4 nhóm, mỗi nhóm ít nhất 1 mục');
    const allItems = groups.flatMap((group) => group.items);
    if (allItems.length > 12) throw httpError(400, 'Tối đa 12 mục để phân loại');
    assertUnique(groups.map((group) => group.name), 'Tên nhóm');
    assertUnique(allItems, 'Các mục phân loại');
    doc.groups = groups;
  }
  return doc;
}

/** Bản câu hỏi gửi cho học viên — không lộ đáp án. */
function publicQuestion(q, rng = Math.random) {
  const view = {
    id: String(q._id),
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    imageUrl: q.imageUrl || '',
    hasHint: true,
  };
  if (q.type === 'mcq') view.options = [...q.options];
  if (q.type === 'order') view.items = shuffleChanged(q.items, rng);
  if (q.type === 'match') {
    view.lefts = q.pairs.map((pair) => pair.left);
    view.rights = shuffleChanged(q.pairs.map((pair) => pair.right), rng);
  }
  if (q.type === 'fill') {
    const { segments, answers } = parseFill(q.text);
    view.segments = segments;
    view.bank = shuffle([...answers, ...(q.distractors || [])], rng);
  }
  if (q.type === 'sort') {
    view.groups = q.groups.map((group) => group.name);
    view.items = shuffle(q.groups.flatMap((group) => group.items), rng);
  }
  return view;
}

function gradeAnswer(q, answer = {}) {
  if (q.type === 'mcq') return Number(answer.index) === q.correctIndex;
  if (q.type === 'truefalse') return typeof answer.value === 'boolean' && answer.value === q.answerBool;
  if (q.type === 'order') {
    const items = Array.isArray(answer.items) ? answer.items : [];
    return items.length === q.items.length && q.items.every((item, index) => norm(items[index]) === norm(item));
  }
  if (q.type === 'match') {
    const given = new Map((Array.isArray(answer.pairs) ? answer.pairs : []).map((pair) => [norm(pair?.left), norm(pair?.right)]));
    return given.size === q.pairs.length && q.pairs.every((pair) => given.get(norm(pair.left)) === norm(pair.right));
  }
  if (q.type === 'fill') {
    const { answers } = parseFill(q.text);
    const blanks = Array.isArray(answer.blanks) ? answer.blanks : [];
    return blanks.length === answers.length && answers.every((word, index) => norm(blanks[index]) === norm(word));
  }
  if (q.type === 'sort') {
    const placements = answer.placements && typeof answer.placements === 'object' ? answer.placements : {};
    const given = new Map(Object.entries(placements).map(([item, group]) => [norm(item), norm(group)]));
    const expected = q.groups.flatMap((group) => group.items.map((item) => [norm(item), norm(group.name)]));
    return given.size === expected.length && expected.every(([item, group]) => given.get(item) === group);
  }
  return false;
}

/** Đáp án đúng để hiển thị sau khi học viên đã trả lời. */
function correctAnswerView(q) {
  if (q.type === 'mcq') return { correctIndex: q.correctIndex, text: q.options[q.correctIndex] };
  if (q.type === 'truefalse') return { answerBool: q.answerBool, text: q.answerBool ? 'Đúng' : 'Sai' };
  if (q.type === 'order') return { items: q.items, text: q.items.join(' → ') };
  if (q.type === 'match') return { pairs: q.pairs, text: q.pairs.map((pair) => `${pair.left} ↔ ${pair.right}`).join(' · ') };
  if (q.type === 'fill') {
    const { answers } = parseFill(q.text);
    return { answers, text: String(q.text).replace(BLANK_RE, (_, word) => word) };
  }
  if (q.type === 'sort') {
    return { groups: q.groups, text: q.groups.map((group) => `${group.name}: ${group.items.join(', ')}`).join(' · ') };
  }
  return { text: '' };
}

/** Gợi ý: lời nhắc + một phần đáp án (loại bớt phương án sai / lộ sẵn một bước). */
function hintReveal(q, rng = Math.random) {
  const hint = q.hint || DEFAULT_HINT;
  if (q.type === 'mcq') {
    const wrong = q.options.map((_, index) => index).filter((index) => index !== q.correctIndex);
    const removeCount = Math.min(2, Math.max(0, q.options.length - 2));
    return { hint, reveal: { eliminate: shuffle(wrong, rng).slice(0, removeCount).sort((a, b) => a - b) } };
  }
  if (q.type === 'order') return { hint, reveal: { first: q.items[0] } };
  if (q.type === 'match') return { hint, reveal: { pair: q.pairs[0] } };
  if (q.type === 'fill') return { hint, reveal: { blank: { index: 0, word: parseFill(q.text).answers[0] } } };
  if (q.type === 'sort') return { hint, reveal: { item: { name: q.groups[0].items[0], group: q.groups[0].name } } };
  return { hint, reveal: {} };
}

function xpFor(difficulty, { correct, hintUsed }) {
  if (!correct) return 0;
  const base = XP_BY_DIFFICULTY[difficulty] || XP_BY_DIFFICULTY.easy;
  return hintUsed ? Math.floor(base / 2) : base;
}

function starsFor(correct, total) {
  if (!total) return 0;
  const ratio = correct / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}

function bonusFor(correct, total) {
  if (!total) return 0;
  if (correct === total) return 20;
  return correct / total >= 0.8 ? 10 : 0;
}

function previousDayKey(dayKey) {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Chuỗi ngày sau khi hoàn thành một lượt trong ngày `day`. */
function nextStreak(profile, day) {
  const last = profile?.lastPlayedDay || '';
  const current = profile?.streak || 0;
  if (last === day) return current || 1;
  if (last && last === previousDayKey(day)) return current + 1;
  return 1;
}

/** Chuỗi đang hiển thị: chỉ còn giữ nếu đã chơi hôm nay hoặc hôm qua. */
function liveStreak(profile, today) {
  const last = profile?.lastPlayedDay || '';
  if (last === today || last === previousDayKey(today)) return profile?.streak || 0;
  return 0;
}

function dayDiff(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}

/**
 * Trạng thái chuỗi để chọn lời nhắc:
 * - new: chưa từng luyện; active: hôm nay đã luyện;
 * - at_risk: hôm qua có luyện, hôm nay chưa (chuỗi mất lúc nửa đêm);
 * - lost: đã bỏ ít nhất một ngày — lostStreak là chuỗi vừa mất, missedDays là số ngày đã bỏ.
 */
function streakStatus(profile, today) {
  const last = profile?.lastPlayedDay || '';
  const streak = profile?.streak || 0;
  if (!last) return { state: 'new', lostStreak: 0, missedDays: 0 };
  if (last === today) return { state: 'active', lostStreak: 0, missedDays: 0 };
  const missedDays = Math.max(0, dayDiff(last, today) - 1);
  if (missedDays === 0) return { state: 'at_risk', lostStreak: 0, missedDays: 0 };
  return { state: 'lost', lostStreak: streak, missedDays };
}

module.exports = {
  TYPES,
  DIFFICULTIES,
  XP_BY_DIFFICULTY,
  SESSION_SIZE,
  TOPIC_ICONS,
  TOPIC_COLORS,
  httpError,
  shuffle,
  parseFill,
  validateQuestion,
  publicQuestion,
  gradeAnswer,
  correctAnswerView,
  hintReveal,
  xpFor,
  starsFor,
  bonusFor,
  previousDayKey,
  nextStreak,
  liveStreak,
  streakStatus,
};
