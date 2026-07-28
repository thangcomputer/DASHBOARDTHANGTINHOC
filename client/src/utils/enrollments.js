/** Client helpers */
import { itemMatchesSubjectIds, resolveItemExamSubjects } from './trainingSubjectFilter.js';

export function teacherIdStr(teacherId) {
  if (!teacherId) return '';
  if (typeof teacherId === 'object') return String(teacherId._id || teacherId.id || '');
  return String(teacherId);
}

export function teacherNameFromRef(teacherId, teacherName) {
  if (teacherName && String(teacherName).trim()) return String(teacherName).trim();
  if (teacherId && typeof teacherId === 'object') {
    return String(teacherId.name || teacherId.teacherName || '').trim();
  }
  return '';
}

/** Gắn tên GV từ danh sách teachers khi enrollment chỉ có teacherId */
export function enrichEnrollmentsWithTeachers(enrollments, teachers) {
  const list = Array.isArray(enrollments) ? enrollments : [];
  const teacherList = Array.isArray(teachers) ? teachers : [];
  return list.map((e) => {
    const tid = teacherIdStr(e.teacherId);
    let name = teacherNameFromRef(e.teacherId, e.teacherName);
    if (!name && tid) {
      const found = teacherList.find((t) => String(t.id || t._id) === tid);
      name = found?.name || '';
    }
    return { ...e, teacherId: tid, teacherName: name };
  });
}

/** Tên GV duy nhất (trùng thì 1, khác thì phẩy) */
export function uniqueTeacherNames(enrollments) {
  const names = [];
  const seen = new Set();
  (enrollments || []).forEach((e) => {
    const n = String(e?.teacherName || '').trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(n);
  });
  return names;
}

export function formatTeacherDisplay(names, { prefix = 'Thầy ' } = {}) {
  const list = (Array.isArray(names) ? names : []).filter(Boolean);
  if (!list.length) return 'Chưa phân công';
  return list.map((n) => (n.startsWith('Thầy ') || n.startsWith('Cô ') ? n : `${prefix}${n}`)).join(', ');
}

export function getClientEnrollments(student) {
  if (!student) return [];
  if (Array.isArray(student.courses) && student.courses.length > 0) {
    return student.courses.map((c, idx) => ({
      ...c,
      id: c.id || c.enrollmentId || `course-${idx}`,
      enrollmentId: c.enrollmentId || c.id || `course-${idx}`,
      courseName: c.courseName || c.name,
      name: c.name || c.courseName,
      teacherId: teacherIdStr(c.teacherId),
      teacherName: teacherNameFromRef(c.teacherId, c.teacherName),
    }));
  }
  if (Array.isArray(student.enrollments) && student.enrollments.length > 0) {
    return student.enrollments.map((e, idx) => ({
      id: e._id ? String(e._id) : `enr-${idx}`,
      enrollmentId: e._id ? String(e._id) : `enr-${idx}`,
      name: e.courseName, courseName: e.courseName,
      courseId: e.courseId ? String(e.courseId) : '',
      examSubjects: Array.isArray(e.examSubjects) ? e.examSubjects : [],
      teacherId: teacherIdStr(e.teacherId),
      teacherName: teacherNameFromRef(e.teacherId, e.teacherName),
      completedSessions: e.completedSessions ?? Math.max(0, (e.totalSessions || 12) - (e.remainingSessions ?? 0)),
      totalSessions: e.totalSessions || 12, remainingSessions: e.remainingSessions,
      avgGrade: e.avgGrade || 0, grades: e.grades || [], linkHoc: e.linkHoc || '',
      nextClass: e.nextClass || '', nextClassTime: e.nextClassTime || '',
      paid: e.paid, price: e.price, status: e.status || 'active',
      registeredAt: e.registeredAt, isPrimary: e.isPrimary,
      requireWebcam: e.requireWebcam !== false,
      examUnlocked: e.examUnlocked === true,
    }));
  }
  if (student.course) {
    const tid = teacherIdStr(student.teacherId);
    const completed = student.completedSessions ?? Math.max(0, (student.totalSessions || 12) - (student.remainingSessions ?? 0));
    return [{ id: 'main', enrollmentId: 'main', name: student.course, courseName: student.course,
      courseId: '', examSubjects: [], teacherId: tid,
      teacherName: teacherNameFromRef(student.teacherId, student.teacherName),
      completedSessions: completed, totalSessions: student.totalSessions || 12, remainingSessions: student.remainingSessions,
      avgGrade: student.avgGrade || 0, grades: student.grades || [], linkHoc: student.linkHoc || '',
      nextClass: student.nextClass || '', nextClassTime: student.nextClassTime || '',
      paid: student.paid, price: student.price,
      status: student.status === 'Ho\u00E0n th\u00E0nh' ? 'completed' : 'active',
      registeredAt: student.createdAt, isPrimary: true,
      requireWebcam: student.requireWebcam !== false,
      examUnlocked: !!student.studentExamUnlocked,
    }];
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
  const name = String(enrollment.teacherName || '').trim();
  const teacherLabel = name
    ? (name.startsWith('Thầy ') || name.startsWith('Cô ') ? name : `Thầy ${name}`)
    : 'Chưa phân công';
  return { ...student, course: enrollment.courseName || enrollment.name, teacherId: enrollment.teacherId || '',
    teacher: teacherLabel, teacherName: name,
    completedSessions: enrollment.completedSessions ?? 0,
    totalSessions: enrollment.totalSessions ?? 12,
    remainingSessions: enrollment.remainingSessions ?? Math.max(0, (enrollment.totalSessions || 12) - (enrollment.completedSessions || 0)),
    avgGrade: enrollment.avgGrade ?? student.avgGrade,
    lastGrade: enrollment.isPrimary ? student.lastGrade : (enrollment.avgGrade ?? 0),
    grades: enrollment.grades?.length ? enrollment.grades : (enrollment.isPrimary ? student.grades : []),
    linkHoc: enrollment.linkHoc || student.linkHoc, nextClass: enrollment.nextClass || student.nextClass,
    nextClassTime: enrollment.nextClassTime || student.nextClassTime,
    paid: enrollment.paid ?? student.paid, price: enrollment.price ?? student.price,
    activeEnrollmentId: enrollment.enrollmentId || enrollment.id };
}

/** SUM học phí đã thu của mọi khóa — đồng bộ BI / báo cáo doanh thu. */
export function sumClientPaidTuition(student) {
  if (!student) return 0;
  const list = getClientEnrollments(student);
  const isPaidEnr = (e) =>
    e?.paid === true
    || e?.paid === 'Đã đóng phí'
    || e?.paid === 'true'
    || e?.paid === 1;

  if (list.length > 0) {
    const fromPaid = list
      .filter(isPaidEnr)
      .reduce((s, e) => s + (Number(e.price) || 0), 0);
    if (fromPaid > 0) return fromPaid;
    const paidAmount = Number(student.paidAmount) || 0;
    if (paidAmount > 0) return paidAmount;
    if (student.paid) return list.reduce((s, e) => s + (Number(e.price) || 0), 0);
    return 0;
  }
  if (!student.paid) return 0;
  const paidAmount = Number(student.paidAmount) || 0;
  if (paidAmount > 0) return paidAmount;
  return Number(student.price) || 0;
}

/** Flatten HV → từng dòng khóa học (dùng tab Tài chính). */
export function expandFinanceEnrollmentRows(students) {
  const rows = [];
  (students || []).forEach((student) => {
    const sid = student.id || student._id;
    const list = getClientEnrollments(student);
    if (list.length === 0) {
      rows.push({
        key: String(sid),
        studentId: sid,
        studentName: student.name || '—',
        courseName: student.course || '—',
        price: Number(student.price) || 0,
        paid: !!student.paid,
        enrollmentId: null,
        isLegacy: true,
      });
      return;
    }
    list.forEach((enr, idx) => {
      const enrId = enr.enrollmentId || enr.id;
      rows.push({
        key: `${sid}-${enrId || idx}`,
        studentId: sid,
        studentName: student.name || '—',
        courseName: enr.courseName || enr.name || student.course || '—',
        price: Number(enr.price) || 0,
        paid: enr.paid === true || enr.paid === 'Đã đóng phí' || enr.paid === 'true' || enr.paid === 1,
        enrollmentId: enrId && enrId !== 'main' ? enrId : null,
        isLegacy: !enrId || enrId === 'main',
      });
    });
  });
  return rows;
}

export function sumClientListedTuition(student) {
  if (!student) return 0;
  const list = getClientEnrollments(student);
  if (list.length > 0) {
    return list.reduce((s, e) => s + (Number(e.price) || 0), 0);
  }
  return Number(student.price) || 0;
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
  if (!activeCourseName || activeCourseName === 'all') return true;
  const activeNorm = normCourseKey(activeCourseName);
  if (item.courseName && normCourseKey(item.courseName) === activeNorm) return true;
  const enr = (enrollments || []).find((e) => normCourseKey(e.courseName || e.name) === activeNorm);
  if (item.courseId && enr?.courseId && String(item.courseId) === String(enr.courseId)) return true;
  // Tài liệu không gắn khóa cụ thể → hiện theo môn (đã lọc subject ở ngoài)
  if (!item.courseId && !item.courseName) return true;
  return false;
}

export function filterStudentTrainingFiles(files, { enrollments, fallbackCourse, activeCourseName, allowedSubjectIds, catalog } = {}) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return [];

  const accessKeys = getStudentCourseAccessKeys(enrollments, fallbackCourse);
  const hasEnrollment = !!(enrollments?.length || fallbackCourse);

  return list.filter((f) => {
    // 1) Khớp môn của khóa HV đang xem / đang học
    if (allowedSubjectIds?.length && itemMatchesSubjectIds(f, allowedSubjectIds, catalog)) {
      return matchesActiveCourse(f, activeCourseName, enrollments);
    }

    // 2) Gắn đúng khóa enrollment
    if (studentCanAccessTrainingItem(f, accessKeys, enrollments, fallbackCourse)) {
      return matchesActiveCourse(f, activeCourseName, enrollments);
    }

    // 3) Tài liệu chung chưa gắn môn
    if (hasEnrollment && !resolveItemExamSubjects(f, catalog).length) {
      return matchesActiveCourse(f, activeCourseName, enrollments);
    }

    return false;
  });
}

export function filterStudentTrainingVideos(videos, { enrollments, fallbackCourse, allowedSubjectIds, catalog } = {}) {
  const list = Array.isArray(videos) ? videos : [];
  if (!list.length) return [];

  const accessKeys = getStudentCourseAccessKeys(enrollments, fallbackCourse);
  const hasEnrollment = !!(enrollments?.length || fallbackCourse);

  return list.filter((v) => {
    // 1) Khớp môn thi của khóa HV đang học (cách chính để thấy video Admin xuất bản)
    if (allowedSubjectIds?.length && itemMatchesSubjectIds(v, allowedSubjectIds, catalog)) {
      return true;
    }

    // 2) Gắn trực tiếp theo enrollment (id / tên khóa)
    const id = v.id || v._id;
    if (id && accessKeys.has(`id:${String(id)}`)) return true;
    if (v.title && accessKeys.has(`name:${normCourseKey(v.title)}`)) return true;
    const linkedByEnrollment = (enrollments || []).some((e) => {
      if (id && e.courseId && String(e.courseId) === String(id)) return true;
      const en = e.courseName || e.name;
      return v.title && en && normCourseKey(en) === normCourseKey(v.title);
    });
    if (linkedByEnrollment) return true;
    if (fallbackCourse && v.title && normCourseKey(fallbackCourse) === normCourseKey(v.title)) return true;

    // 3) Nội dung chung chưa gắn môn: HV đã xếp lớp được xem
    if (hasEnrollment) {
      const itemSubs = resolveItemExamSubjects(v, catalog);
      if (!itemSubs.length) return true;
    }

    return false;
  });
}
