const fs = require('fs');
const path = require('path');

const examSubjects = `/** Catalog mon thi + map khoa hoc -> mon (fallback khi chua co examSubjects tren enrollment) */
export const EXAM_SUBJECTS = {
  coban: { id: 'coban', label: 'M\u00E1y vi t\u00EDnh (C\u01A1 b\u1EA3n)', short: 'C', bg: 'bg-slate-600' },
  word: { id: 'word', label: 'Microsoft Word', short: 'W', bg: 'bg-blue-600' },
  excel: { id: 'excel', label: 'Microsoft Excel', short: 'X', bg: 'bg-green-600' },
  powerpoint: { id: 'powerpoint', label: 'Microsoft PowerPoint', short: 'P', bg: 'bg-orange-500' },
  canva: { id: 'canva', label: 'Canva', short: 'V', bg: 'bg-purple-600' },
};

export const OFFICE_EXAM_IDS = ['coban', 'word', 'excel', 'powerpoint'];

export function normalizeCourseKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/\\u0111/g, 'd');
}

/** Fallback: doan ten khoa khi enrollment chua co examSubjects */
export function mapCourseToExamSubjectIds(courseName) {
  const n = normalizeCourseKey(courseName);
  if (n.includes('canva')) return ['canva'];
  if (
    n.includes('thvp')
    || n.includes('van phong')
    || n.includes('tin hoc van phong')
    || n.includes('microsoft office')
  ) {
    return [...OFFICE_EXAM_IDS];
  }
  if (n.includes('excel') && !n.includes('van phong')) return ['coban', 'excel'];
  if (n.includes('word') && !n.includes('van phong')) return ['coban', 'word'];
  if (n.includes('powerpoint') || n.includes('ppt')) return ['coban', 'powerpoint'];
  for (const id of Object.keys(EXAM_SUBJECTS)) {
    if (n.includes(id)) return [id];
  }
  return [...OFFICE_EXAM_IDS];
}

export function getSubjectIdsForEnrollment(enrollment) {
  if (Array.isArray(enrollment?.examSubjects) && enrollment.examSubjects.length) {
    return enrollment.examSubjects.filter((id) => EXAM_SUBJECTS[id]);
  }
  return mapCourseToExamSubjectIds(enrollment?.courseName || enrollment?.name);
}

export function getSubjectIdsForStudent(enrollments, fallbackCourse) {
  const ids = new Set();
  if (Array.isArray(enrollments) && enrollments.length) {
    enrollments.forEach((e) => {
      getSubjectIdsForEnrollment(e).forEach((id) => ids.add(id));
    });
  } else if (fallbackCourse) {
    mapCourseToExamSubjectIds(fallbackCourse).forEach((id) => ids.add(id));
  } else {
    OFFICE_EXAM_IDS.forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function getSubjectIdsForCourseFilter(enrollments, filterCourse, fallbackCourse) {
  if (filterCourse === 'all') {
    return getSubjectIdsForStudent(enrollments, fallbackCourse);
  }
  const enr = enrollments.find((e) => (e.courseName || e.name) === filterCourse);
  if (enr) return getSubjectIdsForEnrollment(enr);
  return mapCourseToExamSubjectIds(filterCourse);
}

export function buildExamSubjectsFromProgress(examProgress, subjectIds) {
  const ids = subjectIds?.length ? subjectIds : [...OFFICE_EXAM_IDS];
  return ids.map((id) => {
    const def = { id, status: 'chua_thi', tracNghiem: null, thucHanh: 'chua_nop', lockUntil: null };
    const saved = (examProgress || []).find((s) => s.id === id);
    if (saved) return { ...def, ...saved };
    return def;
  });
}

export function resolveExamFilterStatus(subject) {
  if (subject.lockUntil && subject.lockUntil > Date.now()) return 'rot';
  if (subject.status === 'khong_dat') return 'rot';
  if (subject.status === 'dat' || subject.status === 'dang_thi') return 'da_thi';
  return 'chua_thi';
}

export function getExamSubjectMeta(subjectId) {
  return EXAM_SUBJECTS[subjectId] || {
    id: subjectId,
    label: subjectId,
    short: String(subjectId || '?').charAt(0).toUpperCase(),
    bg: 'bg-gray-600',
  };
}

export const EXAM_SUBJECT_OPTIONS = Object.values(EXAM_SUBJECTS).map(({ id, label }) => ({ id, label }));

export function formatExamSubjectsSummary(examSubjects) {
  const ids = Array.isArray(examSubjects) ? examSubjects : [];
  if (!ids.length) return '\u2014';
  return ids.map((id) => getExamSubjectMeta(id).label).join(', ');
}
`;

const enrollments = `/** Client helpers \u2014 da khoa hoc / da giang vien */
export function teacherIdStr(teacherId) {
  if (!teacherId) return '';
  if (typeof teacherId === 'object') return String(teacherId._id || teacherId.id || '');
  return String(teacherId);
}

export function getClientEnrollments(student) {
  if (!student) return [];
  if (Array.isArray(student.courses) && student.courses.length > 0) {
    return student.courses.map((c) => ({
      ...c,
      courseName: c.courseName || c.name,
      name: c.name || c.courseName,
    }));
  }
  if (Array.isArray(student.enrollments) && student.enrollments.length > 0) {
    return student.enrollments.map((e, idx) => ({
      id: e._id ? String(e._id) : \`enr-\${idx}\`,
      enrollmentId: e._id ? String(e._id) : \`enr-\${idx}\`,
      name: e.courseName,
      courseName: e.courseName,
      courseId: e.courseId ? String(e.courseId) : '',
      examSubjects: Array.isArray(e.examSubjects) ? e.examSubjects : [],
      teacherId: teacherIdStr(e.teacherId),
      teacherName: e.teacherName || '',
      completedSessions: e.completedSessions ?? Math.max(0, (e.totalSessions || 12) - (e.remainingSessions ?? 0)),
      totalSessions: e.totalSessions || 12,
      remainingSessions: e.remainingSessions,
      avgGrade: e.avgGrade || 0,
      grades: e.grades || [],
      linkHoc: e.linkHoc || '',
      nextClass: e.nextClass || '',
      nextClassTime: e.nextClassTime || '',
      paid: e.paid,
      price: e.price,
      status: e.status || 'active',
      registeredAt: e.registeredAt,
      isPrimary: e.isPrimary,
    }));
  }
  if (student.course) {
    const tid = teacherIdStr(student.teacherId);
    const completed = student.completedSessions ?? Math.max(0, (student.totalSessions || 12) - (student.remainingSessions ?? 0));
    return [{
      id: 'main',
      enrollmentId: 'main',
      name: student.course,
      courseName: student.course,
      courseId: '',
      examSubjects: [],
      teacherId: tid,
      teacherName: student.teacherName || (typeof student.teacherId === 'object' ? student.teacherId?.name : '') || '',
      completedSessions: completed,
      totalSessions: student.totalSessions || 12,
      remainingSessions: student.remainingSessions,
      avgGrade: student.avgGrade || 0,
      grades: student.grades || [],
      linkHoc: student.linkHoc || '',
      nextClass: student.nextClass || '',
      nextClassTime: student.nextClassTime || '',
      paid: student.paid,
      price: student.price,
      status: student.status === 'Ho\u00E0n th\u00E0nh' ? 'completed' : 'active',
      registeredAt: student.createdAt,
      isPrimary: true,
    }];
  }
  return [];
}

export function expandStudentsForTeacher(students, teacherId) {
  const tid = String(teacherId);
  const result = [];
  (students || []).filter(Boolean).forEach((student) => {
    const enrollments = getClientEnrollments(student);
    const mine = enrollments.filter((e) => String(e.teacherId) === tid);
    if (mine.length > 0) {
      mine.forEach((enr, idx) => {
        result.push({
          ...student,
          id: student.id || student._id,
          _enrollmentKey: \`\${student._id || student.id}-\${enr.enrollmentId || idx}\`,
          _enrollmentId: enr.enrollmentId || \`enr-\${idx}\`,
          course: enr.courseName,
          teacherId: enr.teacherId,
          teacherName: enr.teacherName,
          totalSessions: enr.totalSessions || 12,
          remainingSessions: enr.remainingSessions,
          completedSessions: enr.completedSessions,
          examSubjects: enr.examSubjects || [],
          grades: enr.grades?.length ? enr.grades : (enr.isPrimary ? student.grades : []),
          linkHoc: enr.linkHoc || student.linkHoc,
          nextClass: enr.nextClass || student.nextClass,
          nextClassTime: enr.nextClassTime || student.nextClassTime,
          avgGrade: enr.avgGrade ?? student.avgGrade,
          paid: enr.paid ?? student.paid,
          price: enr.price ?? student.price,
        });
      });
      return;
    }
    if (teacherIdStr(student.teacherId) === tid) {
      result.push({ ...student, _enrollmentKey: String(student._id || student.id) });
    }
  });
  return result;
}

export function scopeStudentToEnrollment(student, enrollment) {
  if (!student || !enrollment) return student;
  const teacherLabel = enrollment.teacherName
    ? \`Th\u1EA7y \${enrollment.teacherName}\`
    : (student.teacher || 'Ch\u01B0a ph\u00E2n c\u00F4ng');
  return {
    ...student,
    course: enrollment.courseName || enrollment.name,
    teacherId: enrollment.teacherId,
    teacher: teacherLabel,
    teacherName: enrollment.teacherName,
    completedSessions: enrollment.completedSessions ?? student.completedSessions,
    totalSessions: enrollment.totalSessions ?? student.totalSessions,
    remainingSessions: enrollment.remainingSessions ?? student.remainingSessions,
    avgGrade: enrollment.avgGrade ?? student.avgGrade,
    lastGrade: enrollment.isPrimary ? student.lastGrade : (enrollment.avgGrade ?? 0),
    grades: enrollment.grades?.length ? enrollment.grades : student.grades,
    linkHoc: enrollment.linkHoc || student.linkHoc,
    nextClass: enrollment.nextClass || student.nextClass,
    nextClassTime: enrollment.nextClassTime || student.nextClassTime,
    paid: enrollment.paid ?? student.paid,
    price: enrollment.price ?? student.price,
    activeEnrollmentId: enrollment.enrollmentId || enrollment.id,
  };
}

export function filterSchedulesByCourse(schedules, courseName) {
  if (!courseName) return schedules || [];
  return (schedules || []).filter((s) => String(s.course || '') === String(courseName));
}
`;

const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'client/src/utils/examSubjects.js'), examSubjects, 'utf8');
fs.writeFileSync(path.join(root, 'client/src/utils/enrollments.js'), enrollments, 'utf8');
console.log('Wrote examSubjects.js and enrollments.js (UTF-8)');
