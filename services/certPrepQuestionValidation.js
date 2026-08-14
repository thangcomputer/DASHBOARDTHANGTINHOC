'use strict';

const QUESTION_TYPES = Object.freeze(['single_choice', 'multiple_choice', 'matching']);
const LOCALES = Object.freeze(['vi', 'en']);

function fail(message) {
  return { ok: false, message };
}

function ok() {
  return { ok: true };
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function isNonNegInt(n) {
  return Number.isInteger(n) && n >= 0;
}

function optionHasContent(opt) {
  if (!opt || typeof opt !== 'object') return false;
  return String(opt.text || '').trim() !== '' || String(opt.imageUrl || '').trim() !== '';
}

function matchingNodeHasContent(node) {
  if (!node || typeof node !== 'object') return false;
  const id = String(node.id || '').trim();
  if (!id) return false;
  return String(node.text || '').trim() !== '' || String(node.imageUrl || '').trim() !== '';
}

function validateSingleChoiceQuestion(payload) {
  const options = asArray(payload.options);
  if (options.length < 2) {
    return fail('Câu chọn 1 đáp án cần tối thiểu 2 lựa chọn');
  }
  if (!options.every(optionHasContent)) {
    return fail('Mỗi lựa chọn phải có nội dung hoặc hình ảnh');
  }
  const correct = payload.correctAnswer;
  if (!isNonNegInt(correct)) {
    return fail('Cần chọn đúng 1 đáp án');
  }
  if (correct >= options.length) {
    return fail('Đáp án đúng không tồn tại trong danh sách lựa chọn');
  }
  return ok();
}

function validateMultipleChoiceQuestion(payload) {
  const options = asArray(payload.options);
  if (options.length < 2) {
    return fail('Câu chọn nhiều đáp án cần tối thiểu 2 lựa chọn');
  }
  if (!options.every(optionHasContent)) {
    return fail('Mỗi lựa chọn phải có nội dung hoặc hình ảnh');
  }
  const indices = asArray(payload.correctIndices).map(Number);
  if (indices.length < 1) {
    return fail('Cần ít nhất 1 đáp án đúng');
  }
  if (indices.some((n) => !isNonNegInt(n))) {
    return fail('Chỉ số đáp án đúng không hợp lệ');
  }
  if (new Set(indices).size !== indices.length) {
    return fail('Danh sách đáp án đúng không được trùng');
  }
  if (indices.some((n) => n >= options.length)) {
    return fail('Chỉ số đáp án đúng không tồn tại');
  }
  if (payload.minSelect != null && payload.minSelect !== '') {
    const minSelect = Number(payload.minSelect);
    if (!Number.isInteger(minSelect) || minSelect < 1) {
      return fail('Số đáp án cần chọn không hợp lệ');
    }
    if (minSelect > indices.length) {
      return fail('Số đáp án cần chọn không được vượt quá số đáp án đúng');
    }
  }
  return ok();
}

function validateMatchingQuestion(payload) {
  const items = asArray(payload.matchingItems);
  const targets = asArray(payload.matchingTargets);
  const pairs = asArray(payload.matchingPairs);
  if (items.length < 1 || targets.length < 1) {
    return fail('Câu ghép cặp cần ít nhất 1 mục ở mỗi cột');
  }
  if (!items.every(matchingNodeHasContent) || !targets.every(matchingNodeHasContent)) {
    return fail('Mỗi mục ghép cặp phải có id và nội dung hoặc hình ảnh');
  }
  const itemIds = items.map((n) => String(n.id).trim());
  const targetIds = targets.map((n) => String(n.id).trim());
  if (new Set(itemIds).size !== itemIds.length) {
    return fail('Id cột A không được trùng');
  }
  if (new Set(targetIds).size !== targetIds.length) {
    return fail('Id cột B không được trùng');
  }
  if (pairs.length < 1) {
    return fail('Cần ít nhất 1 cặp đáp án đúng');
  }
  const pairItemIds = [];
  const pairTargetIds = [];
  for (const pair of pairs) {
    const itemId = String(pair?.itemId || '').trim();
    const targetId = String(pair?.targetId || '').trim();
    if (!itemId || !targetId) {
      return fail('Mỗi cặp phải có itemId và targetId');
    }
    if (!itemIds.includes(itemId) || !targetIds.includes(targetId)) {
      return fail('Cặp đáp án tham chiếu id không tồn tại');
    }
    pairItemIds.push(itemId);
    pairTargetIds.push(targetId);
  }
  if (new Set(pairItemIds).size !== pairItemIds.length) {
    return fail('Mỗi mục cột A chỉ được ghép một lần');
  }
  if (new Set(pairTargetIds).size !== pairTargetIds.length) {
    return fail('Mỗi mục cột B chỉ được ghép một lần');
  }
  return ok();
}

function validateQuestion(payload) {
  if (!payload || typeof payload !== 'object') {
    return fail('Dữ liệu câu hỏi không hợp lệ');
  }
  if (!QUESTION_TYPES.includes(payload.type)) {
    return fail('Loại câu hỏi không hợp lệ');
  }
  if (payload.locale != null && !LOCALES.includes(payload.locale)) {
    return fail('Ngôn ngữ câu hỏi không hợp lệ');
  }
  if (!String(payload.questionText || '').trim()) {
    return fail('Nội dung câu hỏi không được để trống');
  }
  if (payload.type === 'single_choice') return validateSingleChoiceQuestion(payload);
  if (payload.type === 'multiple_choice') return validateMultipleChoiceQuestion(payload);
  if (payload.type === 'matching') return validateMatchingQuestion(payload);
  return fail('Loại câu hỏi không hợp lệ');
}

module.exports = {
  QUESTION_TYPES,
  LOCALES,
  validateQuestion,
  validateSingleChoiceQuestion,
  validateMultipleChoiceQuestion,
  validateMatchingQuestion,
};
