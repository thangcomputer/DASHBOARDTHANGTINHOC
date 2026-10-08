'use strict';

const QUESTION_TYPES = new Set(['hotspot', 'mcq', 'written']);

function clampPercent(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(100, Math.max(0, x));
}

function pointInRegion(x, y, region) {
  const px = clampPercent(x);
  const py = clampPercent(y);
  if (px == null || py == null || !region) return false;
  const rx = Number(region.x);
  const ry = Number(region.y);
  const rw = Number(region.w);
  const rh = Number(region.h);
  if (![rx, ry, rw, rh].every(Number.isFinite)) return false;
  return px >= rx && py >= ry && px <= rx + rw && py <= ry + rh;
}

function isQuestionType(type) {
  return QUESTION_TYPES.has(type);
}

function compareByOrder(a, b) {
  const d = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  if (d !== 0) return d;
  const at = new Date(a.createdAt || 0).getTime();
  const bt = new Date(b.createdAt || 0).getTime();
  return at - bt;
}

function isUnitLocked(units, completedIds, unlockMode, unitId) {
  if (unlockMode !== 'sequential') return false;
  const ordered = [...(units || [])].sort(compareByOrder);
  const index = ordered.findIndex((u) => String(u._id || u.id) === String(unitId));
  if (index <= 0) return false;
  const done = completedIds instanceof Set ? completedIds : new Set(completedIds || []);
  return ordered.slice(0, index).some((u) => !done.has(String(u._id || u.id)));
}

function describeProgress(units, progressDocs) {
  const activeUnits = [...(units || [])].filter((u) => u.isActive !== false).sort(compareByOrder);
  const byUnit = new Map((progressDocs || []).map((p) => [String(p.unitId), p]));
  const completedUnitCount = activeUnits.filter((u) => byUnit.get(String(u._id || u.id))?.status === 'completed').length;
  const inProgress = activeUnits.filter((u) => byUnit.get(String(u._id || u.id))?.status === 'in_progress');
  const started = (progressDocs || []).length > 0;
  let status = 'not_started';
  if (activeUnits.length && completedUnitCount === activeUnits.length) status = 'completed';
  else if (started) status = 'in_progress';
  const current = inProgress[inProgress.length - 1]
    || activeUnits.find((u) => byUnit.get(String(u._id || u.id))?.status !== 'completed');
  return {
    completedUnitCount,
    totalUnitCount: activeUnits.length,
    currentUnitTitle: status === 'completed' ? '' : (current?.title || ''),
    status,
  };
}

function publicItem(item) {
  const base = {
    id: String(item._id || item.id),
    type: item.type,
    sortOrder: item.sortOrder || 0,
    prompt: item.prompt || '',
    imageUrl: item.imageUrl || '',
    caption: item.caption || '',
  };
  if (item.type === 'mcq') {
    base.options = (item.options || []).map((opt) => ({ id: opt.id, text: opt.text || '' }));
  }
  return base;
}

function withConfirmedAnswer(item, answerDoc) {
  const view = {
    ...publicItem(item),
    confirmed: true,
    correct: answerDoc.correct == null ? null : !!answerDoc.correct,
    explanation: answerDoc.explanation || '',
    answer: answerDoc.answer || null,
  };
  if (item.type === 'mcq') view.correctOptionId = item.correctOptionId || '';
  if (item.type === 'hotspot' && item.region) {
    view.region = {
      x: item.region.x, y: item.region.y, w: item.region.w, h: item.region.h,
    };
  }
  return view;
}

function gradeObjective(item, body) {
  if (item.type === 'mcq') {
    const choiceId = String(body?.choiceId || '');
    if (!choiceId) {
      const err = new Error('Hãy chọn một đáp án');
      err.status = 400;
      throw err;
    }
    const known = (item.options || []).some((opt) => opt.id === choiceId);
    if (!known) {
      const err = new Error('Đáp án không thuộc câu hỏi này');
      err.status = 400;
      throw err;
    }
    const correct = choiceId === String(item.correctOptionId || '');
    return {
      correct,
      answer: { choiceId },
      explanation: item.explanation || (correct ? 'Bạn chọn đúng.' : 'Chưa đúng. Đáp án đúng được đánh dấu bên dưới.'),
    };
  }
  if (item.type === 'hotspot') {
    const x = clampPercent(body?.x);
    const y = clampPercent(body?.y);
    if (x == null || y == null) {
      const err = new Error('Hãy bấm một điểm trên ảnh');
      err.status = 400;
      throw err;
    }
    const correct = pointInRegion(x, y, item.region);
    return {
      correct,
      answer: { x, y },
      explanation: item.explanation || (correct ? 'Bạn bấm đúng vùng.' : 'Chưa đúng vùng. Vùng đúng được khoanh bên dưới.'),
    };
  }
  return null;
}

function validateItemPayload(body) {
  const type = String(body?.type || '');
  if (!['image_view', 'hotspot', 'mcq', 'written'].includes(type)) {
    return 'Loại nội dung không hợp lệ';
  }
  const imageUrl = String(body?.imageUrl || '').trim();
  const prompt = String(body?.prompt || '').trim();
  if (type === 'image_view' && !imageUrl) return 'Ảnh xem cần có hình';
  if (type === 'hotspot') {
    if (!imageUrl) return 'Câu bấm vùng cần có hình';
    const region = body?.region || {};
    const x = clampPercent(region.x);
    const y = clampPercent(region.y);
    const w = clampPercent(region.w);
    const h = clampPercent(region.h);
    if (x == null || y == null || w == null || h == null || w < 1 || h < 1) {
      return 'Hãy khoanh vùng đúng trên ảnh';
    }
    if (x + w > 100.01 || y + h > 100.01) return 'Vùng khoanh nằm ngoài ảnh';
  }
  if (type === 'mcq') {
    if (!prompt) return 'Câu trắc nghiệm cần nội dung';
    const options = Array.isArray(body?.options) ? body.options : [];
    if (options.length < 2 || options.length > 6) return 'Trắc nghiệm cần từ 2 đến 6 đáp án';
    if (options.some((opt) => !String(opt?.text || '').trim() || !String(opt?.id || '').trim())) {
      return 'Mỗi đáp án cần có nội dung';
    }
    const ids = new Set(options.map((opt) => String(opt.id)));
    if (ids.size !== options.length) return 'Mã đáp án bị trùng';
    if (!ids.has(String(body?.correctOptionId || ''))) return 'Hãy chọn đáp án đúng';
  }
  if (type === 'written') {
    if (!prompt) return 'Câu tự ghi cần nội dung';
    if (!String(body?.rubric || '').trim() && !String(body?.modelAnswer || '').trim()) {
      return 'Câu tự ghi cần barem hoặc đáp án mẫu để AI giải thích';
    }
  }
  return '';
}

function normalizeItem(body) {
  const type = String(body.type);
  const item = {
    type,
    prompt: String(body.prompt || '').trim(),
    imageUrl: String(body.imageUrl || '').trim(),
    caption: String(body.caption || '').trim(),
    explanation: String(body.explanation || '').trim(),
    sortOrder: Number(body.sortOrder) || 0,
    rubric: '',
    modelAnswer: '',
    correctOptionId: '',
    options: [],
    region: undefined,
  };
  if (type === 'hotspot') {
    item.region = {
      x: clampPercent(body.region.x),
      y: clampPercent(body.region.y),
      w: clampPercent(body.region.w),
      h: clampPercent(body.region.h),
    };
  }
  if (type === 'mcq') {
    item.options = body.options.map((opt) => ({ id: String(opt.id), text: String(opt.text || '').trim() }));
    item.correctOptionId = String(body.correctOptionId);
  }
  if (type === 'written') {
    item.rubric = String(body.rubric || '').trim();
    item.modelAnswer = String(body.modelAnswer || '').trim();
  }
  return item;
}

module.exports = {
  clampPercent,
  pointInRegion,
  isQuestionType,
  compareByOrder,
  isUnitLocked,
  describeProgress,
  publicItem,
  withConfirmedAnswer,
  gradeObjective,
  validateItemPayload,
  normalizeItem,
};
