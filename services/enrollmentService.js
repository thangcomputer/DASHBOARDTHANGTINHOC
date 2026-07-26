const mongoose = require('mongoose');
const { resolveExamSubjectsForCourse } = require('./examSubjectCatalog');

function teacherIdStr(teacherId) {
  if (!teacherId) return '';
  if (typeof teacherId === 'object') return String(teacherId._id || teacherId.id || '');
  return String(teacherId);
}

function legacyEnrollmentFromStudent(student) {
  const doc = student.toObject ? student.toObject() : student;
  const tid = teacherIdStr(doc.teacherId);
  const completed = doc.completedSessions != null
    ? doc.completedSessions
    : Math.max(0, (doc.totalSessions || 12) - (doc.remainingSessions ?? doc.totalSessions ?? 12));
  return {
    courseName: doc.course,
    teacherId: tid || doc.teacherId,
    teacherName: doc.teacherId?.name || doc.teacherName || '',
    price: doc.price,
    paid: doc.paid,
    paidAt: doc.paidAt,
    totalSessions: doc.totalSessions || 12,
    remainingSessions: doc.remainingSessions ?? Math.max(0, (doc.totalSessions || 12) - completed),
    completedSessions: completed,
    avgGrade: doc.avgGrade || 0,
    grades: doc.grades || [],
    linkHoc: doc.linkHoc || '',
    nextClass: doc.nextClass || '',
    nextClassTime: doc.nextClassTime || '',
    status: (doc.remainingSessions ?? 1) <= 0 || doc.status === 'Hoàn thành' ? 'completed' : 'active',
    isPrimary: true,
    registeredAt: doc.createdAt,
    examSubjects: [],
  };
}

async function resolveEnrollmentExamSubjects({ courseName, courseId }) {
  const Course = require('../models/Course');
  const { getCachedSettings } = require('./settingsCache');
  let course = null;
  if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId).lean();
  }
  if (!course && courseName) {
    const escaped = String(courseName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    course = await Course.findOne({ name: new RegExp(`^${escaped}$`, 'i') }).lean();
  }
  const settings = await getCachedSettings();
  const custom = settings?.examSubjectsCustomRaw;
  return resolveExamSubjectsForCourse(course || { name: courseName }, custom);
}

function getEnrollmentsFromStudent(student) {
  const doc = student.toObject ? student.toObject() : { ...student };
  if (Array.isArray(doc.enrollments) && doc.enrollments.length > 0) {
    return doc.enrollments.map((e) => ({
      ...e,
      courseName: e.courseName || e.course,
      teacherId: e.teacherId,
      teacherName: e.teacherName || e.teacherId?.name || '',
    }));
  }
  if (doc.course) return [legacyEnrollmentFromStudent(doc)];
  return [];
}

function toClientCourse(enrollment, index) {
  const id = enrollment._id ? String(enrollment._id) : `enr-${index}`;
  const completed = enrollment.completedSessions != null
    ? enrollment.completedSessions
    : Math.max(0, (enrollment.totalSessions || 12) - (enrollment.remainingSessions ?? 0));
  return {
    id,
    enrollmentId: id,
    name: enrollment.courseName,
    courseName: enrollment.courseName,
    courseId: enrollment.courseId ? String(enrollment.courseId) : '',
    examSubjects: Array.isArray(enrollment.examSubjects) ? enrollment.examSubjects : [],
    teacherId: teacherIdStr(enrollment.teacherId),
    teacherName: enrollment.teacherName || '',
    completedSessions: completed,
    totalSessions: enrollment.totalSessions || 12,
    remainingSessions: enrollment.remainingSessions ?? Math.max(0, (enrollment.totalSessions || 12) - completed),
    avgGrade: enrollment.avgGrade || 0,
    grades: enrollment.grades || [],
    linkHoc: enrollment.linkHoc || '',
    nextClass: enrollment.nextClass || '',
    nextClassTime: enrollment.nextClassTime || '',
    paid: enrollment.paid,
    price: enrollment.price,
    status: enrollment.status || (completed >= (enrollment.totalSessions || 12) ? 'completed' : 'active'),
    registeredAt: enrollment.registeredAt,
    isPrimary: enrollment.isPrimary,
  };
}

async function applyEnrollmentStats(doc, studentId, Schedule) {
  const enrollments = getEnrollmentsFromStudent(doc);
  if (!enrollments.length) {
    doc.enrollments = [];
    doc.courses = [];
    return doc;
  }

  let sessionByCourse = {};
  if (Schedule && studentId) {
    const sid = mongoose.Types.ObjectId.isValid(studentId)
      ? new mongoose.Types.ObjectId(studentId)
      : studentId;
    const rows = await Schedule.aggregate([
      { $match: { studentId: sid, status: 'completed' } },
      { $group: { _id: '$course', completed: { $sum: 1 } } },
    ]);
    sessionByCourse = Object.fromEntries(rows.map((r) => [r._id, r.completed]));
  }

  for (let i = 0; i < enrollments.length; i++) {
    const e = enrollments[i];
    if (!Array.isArray(e.examSubjects) || !e.examSubjects.length) {
      // eslint-disable-next-line no-await-in-loop
      const resolved = await resolveEnrollmentExamSubjects({
        courseName: e.courseName || e.course,
        courseId: e.courseId,
      });
      enrollments[i] = { ...e, examSubjects: resolved };
    }
  }

  doc.enrollments = enrollments.map((e, idx) => {
    const courseName = e.courseName || e.course;
    const completed = sessionByCourse[courseName] ?? e.completedSessions ?? 0;
    const total = e.totalSessions || 12;
    return {
      ...e,
      _id: e._id,
      courseName,
      completedSessions: completed,
      remainingSessions: Math.max(0, total - completed),
      status: completed >= total ? 'completed' : (e.status || 'active'),
    };
  });

  doc.courses = doc.enrollments.map(toClientCourse);

  const primary = doc.enrollments.find((e) => e.isPrimary) || doc.enrollments[0];
  if (primary) {
    doc.course = primary.courseName;
    doc.teacherId = primary.teacherId;
    doc.completedSessions = primary.completedSessions;
    doc.remainingSessions = primary.remainingSessions;
    doc.totalSessions = primary.totalSessions;
    doc.grades = primary.grades?.length ? primary.grades : doc.grades;
  }

  return doc;
}

function studentMatchesTeacher(student, teacherId) {
  const tid = String(teacherId);
  if (teacherIdStr(student.teacherId) === tid) return true;
  const enrollments = getEnrollmentsFromStudent(student);
  return enrollments.some((e) => teacherIdStr(e.teacherId) === tid);
}

function expandStudentsForTeacher(students, teacherId) {
  const tid = String(teacherId);
  const result = [];

  students.forEach((student) => {
    const enrollments = getEnrollmentsFromStudent(student);
    const mine = enrollments.filter((e) => teacherIdStr(e.teacherId) === tid);

    if (mine.length > 0) {
      mine.forEach((enr, idx) => {
        const courseName = enr.courseName || enr.course;
        const completed = enr.completedSessions != null
          ? enr.completedSessions
          : Math.max(0, (enr.totalSessions || 12) - (enr.remainingSessions ?? 0));
        result.push({
          ...student,
          id: student.id || student._id,
          _enrollmentKey: `${student._id || student.id}-${enr._id || idx}`,
          _enrollmentId: enr._id ? String(enr._id) : `enr-${idx}`,
          course: courseName,
          teacherId: teacherIdStr(enr.teacherId),
          teacherName: enr.teacherName,
          totalSessions: enr.totalSessions || 12,
          remainingSessions: enr.remainingSessions ?? Math.max(0, (enr.totalSessions || 12) - completed),
          completedSessions: completed,
          grades: enr.grades || [],
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

module.exports = {
  legacyEnrollmentFromStudent,
  getEnrollmentsFromStudent,
  toClientCourse,
  applyEnrollmentStats,
  studentMatchesTeacher,
  expandStudentsForTeacher,
  teacherIdStr,
  resolveEnrollmentExamSubjects,
};
