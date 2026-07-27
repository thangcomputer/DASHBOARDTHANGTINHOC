import { getExamSubjectMeta, resolveTeacherSubjectIds } from './examSubjects';
import {
  questionMatchesExamSubject,
  isStudentEssayQuestion,
  getEssayQuestionFile,
  getStudentEssayQuestionsForExam,
  isValidMcQuestion,
} from './htmlContent';
export { isLegacyTeacherExamSection } from './teacherExamSections';

const DEFAULT_SUBJECT_ORDER = ['coban', 'word', 'excel', 'powerpoint', 'canva'];

export function orderTeacherExamSubjectIds(subjectIds) {
  const ids = Array.isArray(subjectIds) ? subjectIds.filter(Boolean) : [];
  if (!ids.length) return [];
  const ordered = DEFAULT_SUBJECT_ORDER.filter((id) => ids.includes(id));
  ids.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  return ordered;
}

export function getQuestionSubjectId(q, subjectIds) {
  if (q?._examSubjectId) return q._examSubjectId;
  const ordered = orderTeacherExamSubjectIds(subjectIds);
  for (const sid of ordered) {
    if (questionMatchesExamSubject(q?.section, sid)) return sid;
  }
  return String(q?.section || '').toLowerCase();
}

/** Lọc pool câu hỏi GV: bỏ MC thiếu đáp án/options */
export function filterTeacherExamQuestionPool(pool) {
  return (pool || []).filter((q) => {
    if (!q) return false;
    if (isStudentEssayQuestion(q)) return true;
    return isValidMcQuestion(q);
  });
}

export function resolveTeacherExamSubjectIds(teacher, catalog) {
  return orderTeacherExamSubjectIds(resolveTeacherSubjectIds(teacher, catalog));
}

function resolveMinutesForSubject(minutesMap, subjectId, fallback = 90) {
  const direct = Number(minutesMap?.[subjectId]);
  if (Number.isFinite(direct) && direct >= 1) return Math.round(direct);

  const aliasGroups = [
    ['coban', 'computer', 'maytinh'],
    ['powerpoint', 'ppt', 'pp'],
    ['situation', 'supham', 'su-pham'],
  ];
  const sid = String(subjectId || '').toLowerCase();
  for (const group of aliasGroups) {
    if (!group.includes(sid) && !group.includes(subjectId)) continue;
    for (const key of group) {
      const v = Number(minutesMap?.[key]);
      if (Number.isFinite(v) && v >= 1) return Math.round(v);
    }
  }
  return fallback;
}

/** Tổng phút TN theo các môn có câu trắc nghiệm trong bộ đề */
export function computeTeacherMcExamTotalMinutesBySubjects(questions, subjectIds, minutesMap) {
  const ordered = orderTeacherExamSubjectIds(subjectIds);
  let total = 0;
  let any = false;
  for (const sid of ordered) {
    const hasMc = (questions || []).some(
      (q) => !isStudentEssayQuestion(q) && (
        getQuestionSubjectId(q, ordered) === sid || questionMatchesExamSubject(q?.section, sid)
      ),
    );
    if (!hasMc) continue;
    any = true;
    total += resolveMinutesForSubject(minutesMap, sid, 90);
  }
  return any ? total : null;
}

/** Tổng phút TN + TL theo môn (giữ export cho import cũ) */
export function computeTeacherExamTotalMinutesBySubjects(questions, subjectIds, mcMinutesMap, essayMinutesMap) {
  const mc = computeTeacherMcExamTotalMinutesBySubjects(questions, subjectIds, mcMinutesMap) || 0;
  const ordered = orderTeacherExamSubjectIds(subjectIds);
  let essayTotal = 0;
  for (const sid of ordered) {
    const hasEssay = (questions || []).some(
      (q) => isStudentEssayQuestion(q) && (
        getQuestionSubjectId(q, ordered) === sid || questionMatchesExamSubject(q?.section, sid)
      ),
    );
    if (!hasEssay) continue;
    essayTotal += resolveMinutesForSubject(essayMinutesMap, sid, 60);
  }
  const total = mc + essayTotal;
  return total > 0 ? total : null;
}

/** Tổng phút thực hành/tự luận theo môn có file đề */
export function computeTeacherPracticalTotalMinutes(practiceFilesBySubject, essayMinutes) {
  let total = 0;
  let any = false;
  for (const group of practiceFilesBySubject || []) {
    if (!group?.files?.length) continue;
    any = true;
    total += resolveMinutesForSubject(essayMinutes, group.subjectId, 60);
  }
  return any ? total : null;
}

/** Lịch đề theo môn: số câu TN/TL + phút cấu hình */
export function buildTeacherExamScheduleBySubject(pool, subjectIds, examMinutes, essayMinutes, catalog) {
  return countTeacherQuestionsBySubject(pool, subjectIds)
    .filter((s) => s.total > 0)
    .map((s) => ({
      subjectId: s.subjectId,
      label: getExamSubjectMeta(s.subjectId, catalog).label,
      mc: s.mc,
      essay: s.essay,
      tnMinutes: s.mc > 0 ? resolveMinutesForSubject(examMinutes, s.subjectId, 90) : 0,
      tlMinutes: s.essay > 0 ? resolveMinutesForSubject(essayMinutes, s.subjectId, 60) : 0,
    }));
}

/** Gom cau theo mon GV: trac nghiem xao trong tung mon, tu luan cuoi moi phan */
export function buildGroupedTeacherExamQuestions(pool, subjectIds) {
  const ordered = orderTeacherExamSubjectIds(subjectIds);
  const result = [];
  for (const subjectId of ordered) {
    const sectionQs = (pool || []).filter((q) => questionMatchesExamSubject(q?.section, subjectId));
    const mc = sectionQs.filter((q) => !isStudentEssayQuestion(q));
    const essays = sectionQs.filter((q) => isStudentEssayQuestion(q));
    [...mc].sort(() => Math.random() - 0.5).forEach((q) => {
      result.push({ ...q, _examSubjectId: subjectId });
    });
    essays.forEach((q) => {
      result.push({ ...q, _examSubjectId: subjectId });
    });
  }
  return result;
}

export function buildTeacherExamSections(questions, subjectIds, catalog) {
  const ordered = orderTeacherExamSubjectIds(subjectIds);
  const sections = [];
  for (const subjectId of ordered) {
    const indices = [];
    questions.forEach((q, i) => {
      if (getQuestionSubjectId(q, ordered) === subjectId) indices.push(i);
    });
    sections.push({
      subjectId,
      label: getExamSubjectMeta(subjectId, catalog).label,
      indices,
      startIndex: indices[0] ?? -1,
      count: indices.length,
      empty: indices.length === 0,
    });
  }
  return sections;
}

/** De tu luan / thuc hanh tai xuong theo tung mon chuyen mon */
export function getTeacherPracticeFilesBySubject(pool, subjectIds, catalog) {
  const ordered = orderTeacherExamSubjectIds(subjectIds);
  return ordered.map((subjectId) => {
    const essays = getStudentEssayQuestionsForExam(pool || [], subjectId);
    const seen = new Set();
    const files = essays
      .map(getEssayQuestionFile)
      .filter(Boolean)
      .filter((f) => {
        if (seen.has(f.fileUrl)) return false;
        seen.add(f.fileUrl);
        return true;
      });
    return {
      subjectId,
      label: getExamSubjectMeta(subjectId, catalog).label,
      files,
    };
  });
}

export function countTeacherQuestionsBySubject(pool, subjectIds) {
  const ordered = orderTeacherExamSubjectIds(subjectIds);
  return ordered.map((subjectId) => {
    const qs = (pool || []).filter((q) => questionMatchesExamSubject(q?.section, subjectId));
    const mc = qs.filter((q) => !isStudentEssayQuestion(q)).length;
    const essay = qs.filter((q) => isStudentEssayQuestion(q)).length;
    return { subjectId, mc, essay, total: mc + essay };
  });
}
