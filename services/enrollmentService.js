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
    requireWebcam: doc.requireWebcam !== false,
    examUnlocked: !!doc.studentExamUnlocked,
  };
}

async function resolveEnrollmentExamSubjects({ courseName, courseId }) {
  const Course = require('../models/Course');
  const { getCachedSettings } = require('./settingsCache');
  let course = null;
  if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findOne({ _id: courseId, deletedAt: null }).lean();
  }
  if (!course && courseName) {
    const escaped = String(courseName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    course = await Course.findOne({
      name: new RegExp(`^${escaped}$`, 'i'),
      deletedAt: null,
    }).lean();
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
    teacherName: enrollment.teacherName
      || (enrollment.teacherId && typeof enrollment.teacherId === 'object' ? (enrollment.teacherId.name || '') : '')
      || '',
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
    requireWebcam: enrollment.requireWebcam !== false,
    examUnlocked: enrollment.examUnlocked === true,
  };
}

function normCourseName(name) {
  return String(name || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function gradeDateKeys(raw) {
  if (!raw) return [];
  const keys = new Set([String(raw).trim()]);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    keys.add(d.toLocaleDateString('vi-VN'));
    keys.add(d.toISOString().slice(0, 10));
  }
  // dd/mm/yyyy already in set if raw is that format
  return [...keys];
}

/**
 * Ghi/cập nhật nhật ký điểm danh vào enrollment + root grades.
 * Cùng ngày → cập nhật điểm/ghi chú (không bỏ qua khi đã có grade=0).
 */
function recordAttendanceGrade(studentDoc, {
  courseName,
  note,
  grade = 0,
  date = new Date(),
} = {}) {
  if (!studentDoc) return false;
  const dateObj = date instanceof Date ? date : new Date(date);
  const dateVN = Number.isNaN(dateObj.getTime())
    ? new Date().toLocaleDateString('vi-VN')
    : dateObj.toLocaleDateString('vi-VN');
  const gradeNum = Number(grade);
  const entry = {
    date: dateVN,
    note: note || 'Đã điểm danh hoàn thành buổi học',
    grade: Number.isFinite(gradeNum) ? gradeNum : 0,
  };
  const entryKeys = new Set(gradeDateKeys(dateVN).concat(gradeDateKeys(dateObj)));

  const upsertGrades = (grades) => {
    const list = Array.isArray(grades) ? [...grades] : [];
    const idx = list.findIndex((g) => {
      const keys = gradeDateKeys(g.date);
      return keys.some((k) => entryKeys.has(k));
    });
    if (idx >= 0) {
      const prev = list[idx];
      const nextGrade = Number.isFinite(gradeNum) ? gradeNum : (Number(prev.grade) || 0);
      const nextNote = note || prev.note || entry.note;
      if (Number(prev.grade) === nextGrade && String(prev.note || '') === String(nextNote)) {
        return { list, changed: false };
      }
      list[idx] = { ...prev, grade: nextGrade, note: nextNote, date: prev.date || dateVN };
      return { list, changed: true };
    }
    list.unshift(entry);
    return { list, changed: true };
  };

  let changed = false;
  const courseKey = normCourseName(courseName);

  if (Array.isArray(studentDoc.enrollments) && studentDoc.enrollments.length) {
    let idx = courseKey
      ? studentDoc.enrollments.findIndex((e) => normCourseName(e.courseName) === courseKey)
      : -1;
    if (idx < 0) {
      idx = studentDoc.enrollments.findIndex((e) => e.isPrimary);
    }
    if (idx < 0) idx = 0;

    const enrResult = upsertGrades(studentDoc.enrollments[idx].grades);
    if (enrResult.changed) {
      studentDoc.enrollments[idx].grades = enrResult.list;
      changed = true;
    }
    const valid = enrResult.list.filter((g) => Number(g.grade) > 0);
    if (valid.length) {
      studentDoc.enrollments[idx].avgGrade = Math.round(
        (valid.reduce((s, g) => s + Number(g.grade), 0) / valid.length) * 10
      ) / 10;
    }
    // Luôn đồng bộ root grades để HV đọc được
    const rootResult = upsertGrades(studentDoc.grades);
    if (rootResult.changed) {
      studentDoc.grades = rootResult.list;
      changed = true;
    }
    if (Number.isFinite(gradeNum) && gradeNum > 0) studentDoc.lastGrade = gradeNum;
    const rootValid = (studentDoc.grades || []).filter((g) => Number(g.grade) > 0);
    if (rootValid.length) {
      studentDoc.avgGrade = Math.round(
        (rootValid.reduce((s, g) => s + Number(g.grade), 0) / rootValid.length) * 10
      ) / 10;
    }
  } else {
    const rootResult = upsertGrades(studentDoc.grades);
    if (rootResult.changed) {
      studentDoc.grades = rootResult.list;
      changed = true;
    }
    if (Number.isFinite(gradeNum) && gradeNum > 0) studentDoc.lastGrade = gradeNum;
  }

  if (changed && typeof studentDoc.markModified === 'function') {
    studentDoc.markModified('enrollments');
    studentDoc.markModified('grades');
  }
  return changed;
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

  // Backfill teacherName khi chỉ có teacherId (HV không load danh sách GV)
  const missingNameIds = [...new Set(
    enrollments
      .filter((e) => teacherIdStr(e.teacherId) && !String(e.teacherName || '').trim())
      .map((e) => teacherIdStr(e.teacherId)),
  )].filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (missingNameIds.length) {
    try {
      const Teacher = require('../models/Teacher');
      const rows = await Teacher.find({ _id: { $in: missingNameIds } }).select('name').lean();
      const nameById = Object.fromEntries(rows.map((t) => [String(t._id), t.name || '']));
      enrollments.forEach((e, i) => {
        if (String(e.teacherName || '').trim()) return;
        const tid = teacherIdStr(e.teacherId);
        if (tid && nameById[tid]) enrollments[i] = { ...e, teacherName: nameById[tid] };
      });
    } catch (_) { /* ignore */ }
  }

  doc.enrollments = enrollments.map((e, idx) => {
    const courseName = e.courseName || e.course;
    const completed = sessionByCourse[courseName] ?? e.completedSessions ?? 0;
    const total = e.totalSessions || 12;
    const enrGrades = (e.grades && e.grades.length)
      ? e.grades
      : ((e.isPrimary || enrollments.length === 1) ? (doc.grades || []) : (e.grades || []));
    const inheritUnlock = e.examUnlocked == null && !!(e.isPrimary || enrollments.length === 1) && !!doc.studentExamUnlocked;
    const inheritWebcamOff = e.requireWebcam == null && !!(e.isPrimary || enrollments.length === 1) && doc.requireWebcam === false;
    return {
      ...e,
      _id: e._id,
      courseName,
      teacherName: e.teacherName
        || (e.teacherId && typeof e.teacherId === 'object' ? (e.teacherId.name || '') : '')
        || '',
      completedSessions: completed,
      remainingSessions: Math.max(0, total - completed),
      status: completed >= total ? 'completed' : (e.status || 'active'),
      grades: enrGrades,
      requireWebcam: inheritWebcamOff ? false : (e.requireWebcam !== false),
      examUnlocked: e.examUnlocked === true || inheritUnlock,
    };
  });

  doc.courses = doc.enrollments.map(toClientCourse);

  const primary = doc.enrollments.find((e) => e.isPrimary) || doc.enrollments[0];
  if (primary) {
    doc.course = primary.courseName;
    doc.teacherId = primary.teacherId;
    doc.teacherName = primary.teacherName || doc.teacherName || '';
    doc.completedSessions = primary.completedSessions;
    doc.remainingSessions = primary.remainingSessions;
    doc.totalSessions = primary.totalSessions;
    doc.grades = primary.grades?.length ? primary.grades : doc.grades;
  }

  const allNames = [];
  const seenN = new Set();
  doc.enrollments.forEach((e) => {
    const n = String(e.teacherName || '').trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seenN.has(key)) return;
    seenN.add(key);
    allNames.push(n);
  });
  if (allNames.length) {
    doc.teacherNames = allNames;
    if (!doc.teacherName) doc.teacherName = allNames[0];
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
  recordAttendanceGrade,
  normCourseName,
};
