/** Client helpers */
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
      id: e._id ? String(e._id) : `enr-${idx}`,
      enrollmentId: e._id ? String(e._id) : `enr-${idx}`,
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
      status: student.status === 'Ho\u00E0n th\u00E0nh' ? 'completed' : 'active',
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
        _enrollmentKey: `${student._id || student.id}-${enr.enrollmentId || idx}`,
        _enrollmentId: enr.enrollmentId || `enr-${idx}`, course: enr.courseName,
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
  const teacherLabel = enrollment.teacherName ? `Th\u1EA7y ${enrollment.teacherName}` : (student.teacher || 'Ch\u01B0a ph\u00E2n c\u00F4ng');
  return { ...student, course: enrollment.courseName || enrollment.name, teacherId: enrollment.teacherId,
    teacher: teacherLabel, teacherName: enrollment.teacherName,
    completedSessions: enrollment.completedSessions ?? student.completedSessions,
    totalSessions: enrollment.totalSessions ?? student.totalSessions,
    remainingSessions: enrollment.remainingSessions ?? student.remainingSessions,
    avgGrade: enrollment.avgGrade ?? student.avgGrade,
    lastGrade: enrollment.isPrimary ? student.lastGrade : (enrollment.avgGrade ?? 0),
    grades: (enrollment.grades && enrollment.grades.length)
      ? enrollment.grades
      : (student.grades || []),
    attendanceHistory: (enrollment.grades && enrollment.grades.length)
      ? enrollment.grades
      : (student.grades || student.attendanceHistory || []),
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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getStudentCourseAccessKeys(enrollments, fallbackCourse) {
  const keys = new Set();
  (enrollments || []).forEach((e) => {
    if (e.courseId) keys.add(`id:${String(e.courseId)}`);
    const name = e.courseName || e.name;
    if (name) keys.add(`name:${normCourseKey(name)}`);
  });
  if (fallbackCourse) keys.add(`name:${normCourseKey(fallbackCourse)}`);
  return keys;
}

export function studentCanAccessTrainingItem(item, accessKeys, enrollments, fallbackCourse) {
  if (!item) return false;
  const { courseId: cid, courseName: cname } = item;
  if (!cid && !cname) return true;
  if (cid && accessKeys.has(`id:${String(cid)}`)) return true;
  if (cname && accessKeys.has(`name:${normCourseKey(cname)}`)) return true;
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
  // Match by exam subjects (same idea as teacher LMS). Do NOT require LMS title
  // to equal the pricing-catalog course name — admin video titles rarely match.
  if (!enrollments?.length && !fallbackCourse && !allowedSubjectIds?.length) return [];
  return list.filter((v) => itemMatchesSubjectIds(v, allowedSubjectIds, catalog));
}
