'use strict';

const QUESTION_TYPES = new Set(['hotspot', 'mcq', 'multi', 'match', 'drag', 'written']);
const RETRY_TYPES = new Set(['hotspot', 'mcq', 'multi', 'match', 'drag']);

function clampPercent(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(100, Math.max(0, x));
}

function clampTimeLimit(n) {
  const x = Math.round(Number(n) || 0);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.min(3600, x);
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

function needsExactCorrect(type) {
  return RETRY_TYPES.has(type);
}

function writtenPercent(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function writtenPasses(score) {
  const percent = writtenPercent(score);
  return percent != null && percent > 70;
}

function compareByOrder(a, b) {
  const d = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  if (d !== 0) return d;
  const at = new Date(a.createdAt || 0).getTime();
  const bt = new Date(b.createdAt || 0).getTime();
  return at - bt;
}

function unitVideos(unit) {
  if (Array.isArray(unit?.videos) && unit.videos.length) return unit.videos;
  return String(unit?.videoUrl || '').trim()
    ? [{ id: 'legacy-video', url: unit.videoUrl }]
    : [];
}

function unitContents(unit) {
  if (Array.isArray(unit?.contents) && unit.contents.length) return unit.contents;
  return String(unit?.note || '').trim()
    ? [{ id: 'legacy-note', content: unit.note }]
    : [];
}

function unitChecklist(unit, progress = {}, practiceFinished = false) {
  const sticky = progress?.status === 'completed';
  const videos = unitVideos(unit);
  const contents = unitContents(unit);
  const videoIds = new Set((progress?.completedVideoIds || []).map(String));
  const noteIds = new Set((progress?.completedNoteIds || []).map(String));
  if (sticky && videos.some((video) => video.id === 'legacy-video')) videoIds.add('legacy-video');
  if (sticky && contents.some((content) => content.id === 'legacy-note')) noteIds.add('legacy-note');
  if (progress?.videoDone === true && videos.length === 1 && videos[0].id === 'legacy-video') videoIds.add('legacy-video');
  if (progress?.noteDone === true && contents.length === 1 && contents[0].id === 'legacy-note') noteIds.add('legacy-note');
  const videoDone = videos.every((video) => videoIds.has(String(video.id)));
  const noteDone = contents.every((content) => noteIds.has(String(content.id)));
  const practiceDone = progress?.practiceDone === true || practiceFinished === true;
  return {
    videoDone,
    noteDone,
    practiceDone,
    completed: videoDone && noteDone && practiceDone,
    videoDoneIds: [...videoIds],
    noteDoneIds: [...noteIds],
  };
}

function isUnitLocked(units, completedIds, unitId, previewUnitIds = new Set()) {
  const previews = previewUnitIds instanceof Set ? previewUnitIds : new Set(previewUnitIds || []);
  if (previews.has(String(unitId))) return false;
  const ordered = [...(units || [])].sort(compareByOrder);
  const index = ordered.findIndex((u) => String(u._id || u.id) === String(unitId));
  if (index <= 0) return false;
  const done = completedIds instanceof Set ? completedIds : new Set(completedIds || []);
  return ordered.slice(0, index).some((u) => !done.has(String(u._id || u.id)));
}

const SUBJECT_EXAM_KEYS = {
  'su-dung-may-tinh': ['coban', 'su-dung-may-tinh'],
  word: ['word', 'mos-word'],
  excel: ['excel', 'mos-excel'],
  powerpoint: ['powerpoint', 'mos-powerpoint'],
};

function normalizeSubjectKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function subjectOpenedByKeys(subject, grantedKeys) {
  const granted = grantedKeys instanceof Set ? grantedKeys : new Set(grantedKeys || []);
  const slug = normalizeSubjectKey(subject?.slug || subject?.name);
  const examId = normalizeSubjectKey(subject?.examSubjectId);
  const keys = new Set([slug, examId, ...(SUBJECT_EXAM_KEYS[slug] || []), ...(SUBJECT_EXAM_KEYS[examId] || [])].filter(Boolean));
  for (const key of keys) {
    if (granted.has(key)) return true;
  }
  return false;
}

function mapCourseSubjectsToLessons(examSubjectIds, subjects, labelsById, grantedKeys) {
  const granted = grantedKeys instanceof Set ? grantedKeys : new Set(grantedKeys || []);
  const rows = Array.isArray(subjects) ? subjects : [];
  const aliases = { coban: ['su-dung-may-tinh'] };
  return (Array.isArray(examSubjectIds) ? examSubjectIds : []).map((examSubjectId) => {
    const key = normalizeSubjectKey(examSubjectId);
    const lookupKeys = new Set([key, ...(aliases[key] || [])].filter(Boolean));
    const subject = rows.find((row) => {
      const examId = normalizeSubjectKey(row.examSubjectId);
      const slug = normalizeSubjectKey(row.slug);
      return (examId && lookupKeys.has(examId)) || (slug && lookupKeys.has(slug));
    });
    if (subject) {
      return {
        id: subject.id,
        name: subject.name,
        opened: subject.opened === true,
        completedUnitCount: subject.completedUnitCount || 0,
        totalUnitCount: subject.totalUnitCount || 0,
      };
    }
    return {
      id: '',
      name: labelsById?.get(examSubjectId) || examSubjectId,
      opened: granted.has(key),
      completedUnitCount: 0,
      totalUnitCount: 0,
    };
  });
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

function optionViews(item) {
  return (item.options || []).map((opt) => ({ id: opt.id, text: opt.text || '' }));
}

function publicItem(item) {
  const base = {
    id: String(item._id || item.id),
    videoId: String(item.videoId || ''),
    type: item.type,
    sortOrder: item.sortOrder || 0,
    prompt: item.prompt || '',
    imageUrl: item.imageUrl || '',
    caption: item.caption || '',
    timeLimitSec: clampTimeLimit(item.timeLimitSec),
  };
  if (item.type === 'mcq' || item.type === 'multi') {
    base.options = optionViews(item);
  }
  if (item.type === 'drag') {
    base.options = optionViews(item).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  if (item.type === 'match') {
    const pairs = item.pairs || [];
    base.lefts = pairs.map((pair) => ({ id: pair.id, text: pair.left || '' }));
    base.rights = pairs.map((pair) => ({ id: pair.id, text: pair.right || '' }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
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
  if (item.type === 'multi') view.correctOptionIds = item.correctOptionIds || [];
  if (item.type === 'drag') view.options = optionViews(item);
  if (item.type === 'match') {
    view.pairs = (item.pairs || []).map((pair) => ({ id: pair.id, left: pair.left || '', right: pair.right || '' }));
  }
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
  if (item.type === 'multi') {
    const chosen = [...new Set((Array.isArray(body?.choiceIds) ? body.choiceIds : []).map(String))].filter(Boolean).sort();
    const known = new Set((item.options || []).map((opt) => String(opt.id)));
    if (!chosen.length || chosen.some((id) => !known.has(id))) {
      const err = new Error('Hãy chọn đáp án');
      err.status = 400;
      throw err;
    }
    const expected = [...new Set(item.correctOptionIds || [])].map(String).sort();
    const correct = chosen.length === expected.length && chosen.every((id, index) => id === expected[index]);
    return {
      correct,
      answer: { choiceIds: chosen },
      explanation: item.explanation || (correct ? 'Bạn chọn đúng.' : 'Chưa đúng hết các đáp án.'),
    };
  }
  if (item.type === 'match') {
    const submitted = Array.isArray(body?.matches) ? body.matches : [];
    const byLeft = new Map(submitted.map((row) => [String(row.leftId), String(row.rightId)]));
    const pairs = item.pairs || [];
    if (pairs.some((pair) => !byLeft.get(String(pair.id)))) {
      const err = new Error('Hãy ghép hết các đáp án');
      err.status = 400;
      throw err;
    }
    const correct = pairs.every((pair) => byLeft.get(String(pair.id)) === String(pair.id));
    return {
      correct,
      answer: { matches: pairs.map((pair) => ({ leftId: pair.id, rightId: byLeft.get(String(pair.id)) })) },
      explanation: item.explanation || (correct ? 'Bạn ghép đúng.' : 'Ghép chưa đúng.'),
    };
  }
  if (item.type === 'drag') {
    const order = (Array.isArray(body?.order) ? body.order : []).map(String);
    const expected = (item.options || []).map((opt) => String(opt.id));
    if (order.length !== expected.length || order.some((id) => !expected.includes(id))) {
      const err = new Error('Hãy kéo đủ các đáp án');
      err.status = 400;
      throw err;
    }
    const correct = order.every((id, index) => id === expected[index]);
    return {
      correct,
      answer: { order },
      explanation: item.explanation || (correct ? 'Bạn xếp đúng.' : 'Thứ tự chưa đúng.'),
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

function cleanOptions(body) {
  const options = Array.isArray(body?.options) ? body.options : [];
  if (options.length < 2 || options.length > 6) return { error: 'Cần từ 2 đến 6 đáp án' };
  if (options.some((opt) => !String(opt?.text || '').trim() || !String(opt?.id || '').trim())) {
    return { error: 'Mỗi đáp án cần có nội dung' };
  }
  const ids = new Set(options.map((opt) => String(opt.id)));
  if (ids.size !== options.length) return { error: 'Mã đáp án bị trùng' };
  return { options, ids };
}

function validateItemPayload(body) {
  const type = String(body?.type || '');
  if (!['image_view', 'hotspot', 'mcq', 'multi', 'match', 'drag', 'written'].includes(type)) {
    return 'Loại nội dung không hợp lệ';
  }
  const imageUrl = String(body?.imageUrl || '').trim();
  const prompt = String(body?.prompt || '').trim();
  if (type === 'image_view' && !imageUrl) return 'Ảnh xem cần có hình';
  if (type === 'hotspot') {
    if (!imageUrl) return 'Câu chọn vùng ảnh cần có hình';
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
  if (type === 'mcq' || type === 'multi' || type === 'drag') {
    if (!prompt) return 'Câu hỏi cần nội dung';
    const checked = cleanOptions(body);
    if (checked.error) return checked.error;
    if (type === 'mcq' && !checked.ids.has(String(body?.correctOptionId || ''))) return 'Hãy chọn đáp án đúng';
    if (type === 'multi') {
      const picked = [...new Set((body?.correctOptionIds || []).map(String))].filter((id) => checked.ids.has(id));
      if (!picked.length) return 'Hãy chọn ít nhất một đáp án đúng';
    }
  }
  if (type === 'match') {
    if (!prompt) return 'Câu ghép cần nội dung';
    const pairs = Array.isArray(body?.pairs) ? body.pairs : [];
    if (pairs.length < 2 || pairs.length > 6) return 'Cần từ 2 đến 6 cặp đáp án';
    if (pairs.some((pair) => !String(pair?.left || '').trim() || !String(pair?.right || '').trim() || !String(pair?.id || '').trim())) {
      return 'Mỗi cặp cần đủ hai vế';
    }
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
    videoId: String(body.videoId || ''),
    prompt: String(body.prompt || '').trim(),
    imageUrl: String(body.imageUrl || '').trim(),
    imageName: String(body.imageName || '').trim().slice(0, 255),
    caption: String(body.caption || '').trim(),
    explanation: String(body.explanation || '').trim(),
    sortOrder: Number(body.sortOrder) || 0,
    timeLimitSec: clampTimeLimit(body.timeLimitSec),
    rubric: '',
    modelAnswer: '',
    correctOptionId: '',
    correctOptionIds: [],
    options: [],
    pairs: [],
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
  if (type === 'mcq' || type === 'multi' || type === 'drag') {
    item.options = body.options.map((opt) => ({ id: String(opt.id), text: String(opt.text || '').trim() }));
  }
  if (type === 'mcq') item.correctOptionId = String(body.correctOptionId);
  if (type === 'multi') {
    const ids = new Set(item.options.map((opt) => opt.id));
    item.correctOptionIds = [...new Set((body.correctOptionIds || []).map(String))].filter((id) => ids.has(id));
  }
  if (type === 'match') {
    item.pairs = body.pairs.map((pair) => ({
      id: String(pair.id),
      left: String(pair.left || '').trim(),
      right: String(pair.right || '').trim(),
    }));
  }
  if (type === 'written') {
    item.rubric = String(body.rubric || '').trim();
    item.modelAnswer = String(body.modelAnswer || '').trim();
  }
  return item;
}

module.exports = {
  clampPercent,
  clampTimeLimit,
  pointInRegion,
  isQuestionType,
  needsExactCorrect,
  writtenPercent,
  writtenPasses,
  compareByOrder,
  unitChecklist,
  unitVideos,
  unitContents,
  isUnitLocked,
  describeProgress,
  subjectOpenedByKeys,
  mapCourseSubjectsToLessons,
  normalizeSubjectKey,
  publicItem,
  withConfirmedAnswer,
  gradeObjective,
  validateItemPayload,
  normalizeItem,
};
