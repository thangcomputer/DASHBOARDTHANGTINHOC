const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const exam = `/** Catalog mon thi (mac dinh + tuy chinh tu server) */
export const BUILTIN_EXAM_SUBJECTS = {
  coban: { id: 'coban', label: 'M\\u00E1y vi t\\u00EDnh (C\\u01A1 b\\u1EA3n)', short: 'C', bg: 'bg-slate-600', minutes: 90 },
  word: { id: 'word', label: 'Word', short: 'W', bg: 'bg-blue-600', minutes: 90 },
  excel: { id: 'excel', label: 'Excel', short: 'X', bg: 'bg-green-600', minutes: 90 },
  powerpoint: { id: 'powerpoint', label: 'PowerPoint', short: 'P', bg: 'bg-orange-500', minutes: 90 },
  canva: { id: 'canva', label: 'Canva', short: 'CA', bg: 'bg-purple-600', minutes: 90 },
  situation: { id: 'situation', label: 'S\\u01B0 ph\\u1EA1m (T\\u00ECnh hu\\u1ED1ng)', short: 'SP', bg: 'bg-rose-600', minutes: 90 },
};
export const EXAM_SUBJECTS = BUILTIN_EXAM_SUBJECTS;
export const OFFICE_EXAM_IDS = ['coban', 'word', 'excel', 'powerpoint'];

export function slugifyExamSubjectId(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/\\u0111/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export function getExamSubjectInitials(meta) {
  const short = String(meta?.short || '').trim();
  if (short && short.length <= 3 && !/\\s/.test(short)) return short.toUpperCase();
  const label = String(meta?.label || '').trim();
  if (label) {
    const words = label.split(/[\\s()\\-–—/&,+]+/).filter((w) => /[a-zA-Z0-9]/.test(w));
    if (words.length >= 2) {
      return words.slice(0, 2).map((w) => (w.match(/[a-zA-Z0-9]/) || [''])[0]).join('').toUpperCase().slice(0, 3);
    }
    const alnum = label.replace(/[^a-zA-Z0-9]/g, '');
    if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
    if (alnum.length === 1) return alnum.toUpperCase();
  }
  return String(meta?.id || '?').slice(0, 2).toUpperCase();
}

export function mergeExamCatalog(customList) {
  const merged = { ...BUILTIN_EXAM_SUBJECTS };
  (Array.isArray(customList) ? customList : []).forEach((item) => {
    if (!item?.id || !item?.label) return;
    const entry = { id: item.id, label: item.label, bg: item.bg || 'bg-gray-600', minutes: item.minutes || 90, custom: true };
    merged[item.id] = { ...entry, short: getExamSubjectInitials({ ...entry, short: item.short }) };
  });
  return merged;
}

export function mergedArrayToCatalog(list) {
  const custom = (Array.isArray(list) ? list : []).filter((s) => s?.id && !BUILTIN_EXAM_SUBJECTS[s.id]);
  return mergeExamCatalog(custom);
}

export function getExamSubjectOptions(catalog) {
  const map = catalog || BUILTIN_EXAM_SUBJECTS;
  return Object.values(map).map(({ id, label }) => ({ id, label }));
}

export function normalizeCourseKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/\\u0111/g, 'd');
}

export function mapCourseToExamSubjectIds(courseName, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const n = normalizeCourseKey(courseName);
  const pick = (ids) => ids.filter((id) => cat[id]);
  if (n.includes('canva')) return pick(['canva']);
  if (n.includes('thvp') || n.includes('van phong') || n.includes('tin hoc van phong') || n.includes('microsoft office')) return pick([...OFFICE_EXAM_IDS]);
  if (n.includes('excel') && !n.includes('van phong')) return pick(['coban', 'excel']);
  if (n.includes('word') && !n.includes('van phong')) return pick(['coban', 'word']);
  if (n.includes('powerpoint') || n.includes('ppt')) return pick(['coban', 'powerpoint']);
  for (const sub of Object.values(cat)) {
    if (n.includes(sub.id) || n.includes(normalizeCourseKey(sub.label))) return [sub.id];
  }
  return pick([...OFFICE_EXAM_IDS]);
}

export function getSubjectIdsForEnrollment(enrollment, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  if (Array.isArray(enrollment?.examSubjects) && enrollment.examSubjects.length) {
    return enrollment.examSubjects.filter((id) => cat[id]);
  }
  return mapCourseToExamSubjectIds(enrollment?.courseName || enrollment?.name, cat);
}

export function getSubjectIdsForStudent(enrollments, fallbackCourse, catalog) {
  const ids = new Set();
  if (Array.isArray(enrollments) && enrollments.length) {
    enrollments.forEach((e) => getSubjectIdsForEnrollment(e, catalog).forEach((id) => ids.add(id)));
  } else if (fallbackCourse) {
    mapCourseToExamSubjectIds(fallbackCourse, catalog).forEach((id) => ids.add(id));
  } else {
    OFFICE_EXAM_IDS.forEach((id) => { if ((catalog || BUILTIN_EXAM_SUBJECTS)[id]) ids.add(id); });
  }
  return [...ids];
}

export function getSubjectIdsForCourseFilter(enrollments, filterCourse, fallbackCourse, catalog) {
  if (filterCourse === 'all') return getSubjectIdsForStudent(enrollments, fallbackCourse, catalog);
  const enr = enrollments.find((e) => (e.courseName || e.name) === filterCourse);
  if (enr) return getSubjectIdsForEnrollment(enr, catalog);
  return mapCourseToExamSubjectIds(filterCourse, catalog);
}

export function buildExamSubjectsFromProgress(examProgress, subjectIds) {
  const ids = subjectIds?.length ? subjectIds : [...OFFICE_EXAM_IDS];
  return ids.map((id) => {
    const def = { id, status: 'chua_thi', tracNghiem: null, thucHanh: 'chua_nop', lockUntil: null };
    const saved = (examProgress || []).find((s) => s.id === id);
    return saved ? { ...def, ...saved } : def;
  });
}

export function resolveExamFilterStatus(subject) {
  if (subject.lockUntil && subject.lockUntil > Date.now()) return 'rot';
  if (subject.status === 'khong_dat') return 'rot';
  if (subject.status === 'dat' || subject.status === 'dang_thi') return 'da_thi';
  return 'chua_thi';
}

export function getExamSubjectMeta(subjectId, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const base = cat[subjectId] || {
    id: subjectId,
    label: subjectId,
    bg: 'bg-gray-600',
  };
  return { ...base, short: getExamSubjectInitials(base) };
}

export const EXAM_SUBJECT_OPTIONS = getExamSubjectOptions(BUILTIN_EXAM_SUBJECTS);

export function formatExamSubjectsSummary(examSubjects, catalog) {
  const ids = Array.isArray(examSubjects) ? examSubjects : [];
  if (!ids.length) return '\\u2014';
  return ids.map((id) => getExamSubjectMeta(id, catalog).label).join(', ');
}

export function formatSubjectIdsAsSpecialty(subjectIds, catalog) {
  const ids = Array.isArray(subjectIds) ? subjectIds : [];
  if (!ids.length) return '';
  return ids.map((id) => getExamSubjectMeta(id, catalog).label).join(', ');
}

export function parseSpecialtyToSubjectIds(specialty, catalog = BUILTIN_EXAM_SUBJECTS) {
  const text = String(specialty || '').trim();
  if (!text) return [];
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const parts = text.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean);
  const ids = new Set();

  const entries = Object.entries(cat)
    .map(([id, meta]) => ({
      id,
      labelN: normalizeCourseKey(meta.label || ''),
      idN: normalizeCourseKey(id),
    }))
    .sort((a, b) => b.labelN.length - a.labelN.length);

  for (const part of parts) {
    const np = normalizeCourseKey(part);
    if (!np) continue;

    const byLabel = entries.find((e) => e.labelN === np);
    if (byLabel) {
      ids.add(byLabel.id);
      continue;
    }

    const byId = entries.find((e) => e.idN === np || e.id === String(part).toLowerCase());
    if (byId) {
      ids.add(byId.id);
      continue;
    }
  }

  if (!ids.size) {
    mapCourseToExamSubjectIds(text, cat).forEach((id) => ids.add(id));
  }

  return [...ids];
}

export function resolveTeacherSubjectIds(teacher, catalog = BUILTIN_EXAM_SUBJECTS) {
  const fromIds = Array.isArray(teacher?.subjectIds) ? teacher.subjectIds.filter(Boolean) : [];
  if (fromIds.length) return fromIds;
  return parseSpecialtyToSubjectIds(teacher?.specialty, catalog);
}
`;

const enr = `/** Client helpers */
import { itemMatchesSubjectIds } from './trainingSubjectFilter.js';

export function teacherIdStr(teacherId) {
  if (!teacherId) return '';
  if (typeof teacherId === 'object') return String(teacherId._id || teacherId.id || '');
  return String(teacherId);
}
export function getClientEnrollments(student) {
  if (!student) return [];
  if (Array.isArray(student.courses) && student.courses.length > 0) return student.courses.map((c) => ({ ...c, courseName: c.courseName || c.name, name: c.name || c.courseName }));
  if (Array.isArray(student.enrollments) && student.enrollments.length > 0) {
    return student.enrollments.map((e, idx) => ({
      id: e._id ? String(e._id) : \`enr-\${idx}\`,
      enrollmentId: e._id ? String(e._id) : \`enr-\${idx}\`,
      name: e.courseName, courseName: e.courseName,
      courseId: e.courseId ? String(e.courseId) : '',
      examSubjects: Array.isArray(e.examSubjects) ? e.examSubjects : [],
      teacherId: teacherIdStr(e.teacherId), teacherName: e.teacherName || '',
      completedSessions: e.completedSessions ?? Math.max(0, (e.totalSessions || 12) - (e.remainingSessions ?? 0)),
      totalSessions: e.totalSessions || 12, remainingSessions: e.remainingSessions,
      avgGrade: e.avgGrade || 0, grades: e.grades || [], linkHoc: e.linkHoc || '',
      nextClass: e.nextClass || '', nextClassTime: e.nextClassTime || '',
      paid: e.paid, price: e.price, status: e.status || 'active',
      registeredAt: e.registeredAt, isPrimary: e.isPrimary,
    }));
  }
  if (student.course) {
    const tid = teacherIdStr(student.teacherId);
    const completed = student.completedSessions ?? Math.max(0, (student.totalSessions || 12) - (student.remainingSessions ?? 0));
    return [{ id: 'main', enrollmentId: 'main', name: student.course, courseName: student.course,
      courseId: '', examSubjects: [], teacherId: tid,
      teacherName: student.teacherName || (typeof student.teacherId === 'object' ? student.teacherId?.name : '') || '',
      completedSessions: completed, totalSessions: student.totalSessions || 12, remainingSessions: student.remainingSessions,
      avgGrade: student.avgGrade || 0, grades: student.grades || [], linkHoc: student.linkHoc || '',
      nextClass: student.nextClass || '', nextClassTime: student.nextClassTime || '',
      paid: student.paid, price: student.price,
      status: student.status === 'Ho\\u00E0n th\\u00E0nh' ? 'completed' : 'active',
      registeredAt: student.createdAt, isPrimary: true }];
  }
  return [];
}
export function expandStudentsForTeacher(students, teacherId) {
  const tid = String(teacherId); const result = [];
  (students || []).filter(Boolean).forEach((student) => {
    const enrollments = getClientEnrollments(student);
    const mine = enrollments.filter((e) => String(e.teacherId) === tid);
    if (mine.length > 0) {
      mine.forEach((enr, idx) => result.push({ ...student, id: student.id || student._id,
        _enrollmentKey: \`\${student._id || student.id}-\${enr.enrollmentId || idx}\`,
        _enrollmentId: enr.enrollmentId || \`enr-\${idx}\`, course: enr.courseName,
        teacherId: enr.teacherId, teacherName: enr.teacherName,
        totalSessions: enr.totalSessions || 12, remainingSessions: enr.remainingSessions,
        completedSessions: enr.completedSessions, examSubjects: enr.examSubjects || [],
        grades: enr.grades?.length ? enr.grades : (enr.isPrimary ? student.grades : []),
        linkHoc: enr.linkHoc || student.linkHoc, nextClass: enr.nextClass || student.nextClass,
        nextClassTime: enr.nextClassTime || student.nextClassTime,
        avgGrade: enr.avgGrade ?? student.avgGrade, paid: enr.paid ?? student.paid, price: enr.price ?? student.price,
      }));
      return;
    }
    if (teacherIdStr(student.teacherId) === tid) result.push({ ...student, _enrollmentKey: String(student._id || student.id) });
  });
  return result;
}
export function scopeStudentToEnrollment(student, enrollment) {
  if (!student || !enrollment) return student;
  const teacherLabel = enrollment.teacherName ? \`Th\\u1EA7y \${enrollment.teacherName}\` : (student.teacher || 'Ch\\u01B0a ph\\u00E2n c\\u00F4ng');
  return { ...student, course: enrollment.courseName || enrollment.name, teacherId: enrollment.teacherId,
    teacher: teacherLabel, teacherName: enrollment.teacherName,
    completedSessions: enrollment.completedSessions ?? student.completedSessions,
    totalSessions: enrollment.totalSessions ?? student.totalSessions,
    remainingSessions: enrollment.remainingSessions ?? student.remainingSessions,
    avgGrade: enrollment.avgGrade ?? student.avgGrade,
    lastGrade: enrollment.isPrimary ? student.lastGrade : (enrollment.avgGrade ?? 0),
    grades: enrollment.grades?.length ? enrollment.grades : student.grades,
    linkHoc: enrollment.linkHoc || student.linkHoc, nextClass: enrollment.nextClass || student.nextClass,
    nextClassTime: enrollment.nextClassTime || student.nextClassTime,
    paid: enrollment.paid ?? student.paid, price: enrollment.price ?? student.price,
    activeEnrollmentId: enrollment.enrollmentId || enrollment.id };
}
export function filterSchedulesByCourse(schedules, courseName) {
  if (!courseName) return schedules || [];
  return (schedules || []).filter((s) => String(s.course || '') === String(courseName));
}

function normCourseKey(name) {
  return String(name || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
}

export function getStudentCourseAccessKeys(enrollments, fallbackCourse) {
  const keys = new Set();
  (enrollments || []).forEach((e) => {
    if (e.courseId) keys.add(\`id:\${String(e.courseId)}\`);
    const name = e.courseName || e.name;
    if (name) keys.add(\`name:\${normCourseKey(name)}\`);
  });
  if (fallbackCourse) keys.add(\`name:\${normCourseKey(fallbackCourse)}\`);
  return keys;
}

export function studentCanAccessTrainingItem(item, accessKeys, enrollments, fallbackCourse) {
  if (!item) return false;
  const { courseId: cid, courseName: cname } = item;
  if (!cid && !cname) return true;
  if (cid && accessKeys.has(\`id:\${String(cid)}\`)) return true;
  if (cname && accessKeys.has(\`name:\${normCourseKey(cname)}\`)) return true;
  const enrolled = (enrollments || []).some((e) => {
    if (cid && e.courseId && String(e.courseId) === String(cid)) return true;
    const en = e.courseName || e.name;
    return cname && en && normCourseKey(en) === normCourseKey(cname);
  });
  if (enrolled) return true;
  return !!(fallbackCourse && cname && normCourseKey(fallbackCourse) === normCourseKey(cname));
}

function matchesActiveCourse(item, activeCourseName, enrollments) {
  if (!activeCourseName) return true;
  if (item.courseId && item.courseName) return true;
  const activeNorm = normCourseKey(activeCourseName);
  if (item.courseName && normCourseKey(item.courseName) === activeNorm) return true;
  const enr = (enrollments || []).find((e) => normCourseKey(e.courseName || e.name) === activeNorm);
  if (item.courseId && enr?.courseId && String(item.courseId) === String(enr.courseId)) return true;
  return false;
}

export function filterStudentTrainingFiles(files, { enrollments, fallbackCourse, activeCourseName, allowedSubjectIds, catalog } = {}) {
  const list = Array.isArray(files) ? files : [];
  const accessKeys = getStudentCourseAccessKeys(enrollments, fallbackCourse);
  return list.filter((f) =>
    studentCanAccessTrainingItem(f, accessKeys, enrollments, fallbackCourse)
    && matchesActiveCourse(f, activeCourseName, enrollments)
    && itemMatchesSubjectIds(f, allowedSubjectIds, catalog)
  );
}

export function filterStudentTrainingVideos(videos, { enrollments, fallbackCourse, allowedSubjectIds, catalog } = {}) {
  const list = Array.isArray(videos) ? videos : [];
  if (!enrollments?.length && !fallbackCourse) {
    return list.filter((v) => itemMatchesSubjectIds(v, allowedSubjectIds, catalog));
  }
  const accessKeys = getStudentCourseAccessKeys(enrollments, fallbackCourse);
  return list.filter((v) => {
    const id = v.id || v._id;
    let courseOk = false;
    if (id && accessKeys.has(\`id:\${String(id)}\`)) courseOk = true;
    else if (v.title && accessKeys.has(\`name:\${normCourseKey(v.title)}\`)) courseOk = true;
    else courseOk = (enrollments || []).some((e) => {
      if (id && e.courseId && String(e.courseId) === String(id)) return true;
      const en = e.courseName || e.name;
      return v.title && en && normCourseKey(en) === normCourseKey(v.title);
    }) || (fallbackCourse && v.title && normCourseKey(fallbackCourse) === normCourseKey(v.title));
    return courseOk && itemMatchesSubjectIds(v, allowedSubjectIds, catalog);
  });
}
`;

const teacherExamQs = `import { getExamSubjectMeta } from './examSubjects';
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
`;

fs.writeFileSync(path.join(root, 'client/src/utils/teacherExamQuestions.js'), teacherExamQs, 'utf8');
fs.writeFileSync(path.join(root, 'client/src/utils/examSubjects.js'), exam, 'utf8');
fs.writeFileSync(path.join(root, 'client/src/utils/enrollments.js'), enr, 'utf8');

const trainingFilter = `/** Training content visibility by exam subject */
import {
  mapCourseToExamSubjectIds,
  normalizeCourseKey,
  BUILTIN_EXAM_SUBJECTS,
} from './examSubjects.js';

export function getItemExamSubjects(item) {
  return Array.isArray(item?.examSubjects) ? item.examSubjects.filter(Boolean) : [];
}

export function resolveItemExamSubjects(item, catalog = BUILTIN_EXAM_SUBJECTS) {
  const explicit = getItemExamSubjects(item);
  if (explicit.length) return explicit;
  const title = String(item?.title || item?.courseName || item?.name || '').trim();
  if (!title) return [];
  return mapCourseToExamSubjectIds(title, catalog);
}

export function parseSpecialtyToSubjectIds(specialty, catalog = BUILTIN_EXAM_SUBJECTS) {
  const text = String(specialty || '').trim();
  if (!text) return [];
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const parts = text.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean);
  const ids = new Set();

  const entries = Object.entries(cat)
    .map(([id, meta]) => ({
      id,
      labelN: normalizeCourseKey(meta.label || ''),
      idN: normalizeCourseKey(id),
    }))
    .sort((a, b) => b.labelN.length - a.labelN.length);

  for (const part of parts) {
    const np = normalizeCourseKey(part);
    if (!np) continue;

    const byLabel = entries.find((e) => e.labelN === np);
    if (byLabel) {
      ids.add(byLabel.id);
      continue;
    }

    const byId = entries.find((e) => e.idN === np || e.id === String(part).toLowerCase());
    if (byId) {
      ids.add(byId.id);
      continue;
    }
  }

  if (!ids.size) {
    mapCourseToExamSubjectIds(text, cat).forEach((id) => ids.add(id));
  }

  return [...ids];
}

export function resolveTeacherSubjectIds(teacher, catalog = BUILTIN_EXAM_SUBJECTS) {
  const fromIds = Array.isArray(teacher?.subjectIds) ? teacher.subjectIds.filter(Boolean) : [];
  if (fromIds.length) return fromIds;
  return parseSpecialtyToSubjectIds(teacher?.specialty, catalog);
}

export function itemMatchesSubjectIds(item, allowedSubjectIds, catalog = BUILTIN_EXAM_SUBJECTS) {
  const itemSubs = resolveItemExamSubjects(item, catalog);
  if (!itemSubs.length) return false;
  if (!allowedSubjectIds?.length) return false;
  const set = new Set(allowedSubjectIds);
  return itemSubs.some((id) => set.has(id));
}

export function filterTrainingItemsBySubject(items, allowedSubjectIds, catalog = BUILTIN_EXAM_SUBJECTS) {
  const list = Array.isArray(items) ? items : [];
  if (!allowedSubjectIds?.length) return [];
  return list.filter((item) => itemMatchesSubjectIds(item, allowedSubjectIds, catalog));
}
`;
fs.writeFileSync(path.join(root, 'client/src/utils/trainingSubjectFilter.js'), trainingFilter, 'utf8');

const checkboxGrid = `import React from 'react';
import { getExamSubjectOptions } from '../../../utils/examSubjects';

export default function ExamSubjectCheckboxGrid({
  catalog,
  value = [],
  onChange,
  accent = 'green',
}) {
  const options = getExamSubjectOptions(catalog);
  const selected = Array.isArray(value) ? value : [];
  const ring = accent === 'purple' ? 'border-purple-500 bg-purple-50' : 'border-green-500 bg-green-50';
  const dot = accent === 'purple' ? 'text-purple-700' : 'text-green-700';

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-500 uppercase block">
        Môn học <span className="text-red-500">*</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, label }) => {
          const on = selected.includes(id);
          return (
            <label
              key={id}
              className={\`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-colors \${on ? ring : 'border-gray-200 bg-white hover:border-gray-300'}\`}
            >
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={on}
                onChange={() => toggle(id)}
              />
              <span className={on ? dot : 'text-gray-700'}>{label}</span>
            </label>
          );
        })}
      </div>
      {!options.length && (
        <p className="text-xs text-amber-600">Chưa có danh mục môn. Cấu hình tại Cài đặt hệ thống.</p>
      )}
    </div>
  );
}
`;
fs.writeFileSync(path.join(root, 'client/src/components/admin/shared/ExamSubjectCheckboxGrid.jsx'), checkboxGrid, 'utf8');

const serverAccess = `'use strict';
const BUILTIN_EXAM_SUBJECTS = {
  coban: { id: 'coban', label: 'May vi tinh (Co ban)' },
  word: { id: 'word', label: 'Word' },
  excel: { id: 'excel', label: 'Excel' },
  powerpoint: { id: 'powerpoint', label: 'PowerPoint' },
  canva: { id: 'canva', label: 'Canva' },
};
function normalizeCourseKey(name) {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\u0111/g, 'd');
}
function mapCourseToExamSubjectIds(courseName) {
  const n = normalizeCourseKey(courseName);
  const pick = (ids) => ids.filter((id) => BUILTIN_EXAM_SUBJECTS[id]);
  if (n.includes('canva')) return pick(['canva']);
  if (n.includes('thvp') || n.includes('van phong') || n.includes('tin hoc van phong') || n.includes('microsoft office')) return pick(['coban', 'word', 'excel', 'powerpoint']);
  if (n.includes('excel') && !n.includes('van phong')) return pick(['coban', 'excel']);
  if (n.includes('word') && !n.includes('van phong')) return pick(['coban', 'word']);
  if (n.includes('powerpoint') || n.includes('ppt')) return pick(['coban', 'powerpoint']);
  for (const sub of Object.values(BUILTIN_EXAM_SUBJECTS)) {
    if (n.includes(sub.id) || n.includes(normalizeCourseKey(sub.label))) return [sub.id];
  }
  return [];
}
function getItemExamSubjects(item) {
  return Array.isArray(item?.examSubjects) ? item.examSubjects.filter(Boolean) : [];
}
function resolveItemExamSubjects(item) {
  const explicit = getItemExamSubjects(item);
  if (explicit.length) return explicit;
  const title = String(item?.title || item?.courseName || item?.name || '').trim();
  if (!title) return [];
  return mapCourseToExamSubjectIds(title);
}
function parseSpecialtyToSubjectIds(specialty, catalog) {
  const text = String(specialty || '').trim();
  if (!text) return [];
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const parts = text.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean);
  const ids = new Set();

  const entries = Object.entries(cat)
    .map(([id, meta]) => ({
      id,
      labelN: normalizeCourseKey(meta.label || ''),
      idN: normalizeCourseKey(id),
    }))
    .sort((a, b) => b.labelN.length - a.labelN.length);

  for (const part of parts) {
    const np = normalizeCourseKey(part);
    if (!np) continue;

    const byLabel = entries.find((e) => e.labelN === np);
    if (byLabel) {
      ids.add(byLabel.id);
      continue;
    }

    const byId = entries.find((e) => e.idN === np || e.id === String(part).toLowerCase());
    if (byId) {
      ids.add(byId.id);
      continue;
    }
  }

  if (!ids.size) {
    mapCourseToExamSubjectIds(text, cat).forEach((id) => ids.add(id));
  }

  return [...ids];
}
function resolveTeacherSubjectIds(teacher) {
  const fromIds = Array.isArray(teacher?.subjectIds) ? teacher.subjectIds.filter(Boolean) : [];
  if (fromIds.length) return fromIds;
  return parseSpecialtyToSubjectIds(teacher?.specialty);
}
function itemMatchesSubjectIds(item, allowedSubjectIds) {
  const itemSubs = resolveItemExamSubjects(item);
  if (!itemSubs.length) return false;
  if (!allowedSubjectIds?.length) return false;
  const set = new Set(allowedSubjectIds);
  return itemSubs.some((id) => set.has(id));
}
function filterTrainingItemsBySubject(items, allowedSubjectIds) {
  const list = Array.isArray(items) ? items : [];
  if (!allowedSubjectIds?.length) return [];
  return list.filter((item) => itemMatchesSubjectIds(item, allowedSubjectIds));
}
module.exports = { resolveTeacherSubjectIds, resolveItemExamSubjects, itemMatchesSubjectIds, filterTrainingItemsBySubject };
`;
fs.writeFileSync(path.join(root, 'utils/trainingSubjectAccess.js'), serverAccess, 'utf8');
console.log('Wrote examSubjects.js, enrollments.js, trainingSubjectFilter.js, ExamSubjectCheckboxGrid.jsx, trainingSubjectAccess.js');

if (process.argv.includes('--fix-mojibake')) {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const { fixMojibakeText, MOJIBAKE_RE } = require('../utils/escapeRegex');

  async function patchModel(Model, fields) {
    const rows = await Model.find().limit(10000).lean();
    let updated = 0;
    for (const row of rows) {
      let changed = false;
      const doc = await Model.findById(row._id);
      if (!doc) continue;
      for (const f of fields) {
        const raw = doc[f];
        if (!raw || !MOJIBAKE_RE.test(String(raw))) continue;
        const fixed = fixMojibakeText(String(raw));
        if (fixed !== raw) { doc[f] = fixed; changed = true; }
      }
      if (changed) { await doc.save(); updated += 1; }
    }
    return { scanned: rows.length, updated };
  }

  (async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
    await mongoose.connect(uri);
    const FileAsset = require('../models/FileAsset');
    const Message = require('../models/Message');
    console.log('FileAsset:', await patchModel(FileAsset, ['originalName']));
    console.log('Message:', await patchModel(Message, ['fileName']));
    await mongoose.disconnect();
  })().catch((err) => { console.error(err); process.exit(1); });
}

if (process.argv.includes('--test-gemini')) {
  require('dotenv').config();
  const { GoogleGenAI } = require('@google/genai');
  (async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { console.log('No GEMINI_API_KEY'); process.exit(1); }
    console.log('Key prefix:', key.slice(0, 6) + '...');
    const ai = new GoogleGenAI({ apiKey: key });
    try {
      const res = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: 'Tra loi 1 tu: OK' });
      console.log('OK:', res.text);
    } catch (e) {
      console.log('FAIL:', e.status || e.code, e.message);
    }
  })();
}
