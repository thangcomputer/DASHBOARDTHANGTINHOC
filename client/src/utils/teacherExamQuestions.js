import { getExamSubjectMeta } from './examSubjects';
import {
  questionMatchesExamSubject,
  isStudentEssayQuestion,
  getEssayQuestionFile,
  getStudentEssayQuestionsForExam,
} from './htmlContent';

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
