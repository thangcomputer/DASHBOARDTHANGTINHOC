/** Exam subjects are loaded from server configuration. */
export const BUILTIN_EXAM_SUBJECTS = {
  'mon-kiem-thu': {
    id: 'mon-kiem-thu',
    label: 'Môn kiểm thử',
    short: 'TEST',
    bg: 'bg-gray-600',
    minutes: 90,
    group: 'admin',
  },
};
export const EXAM_SUBJECTS = BUILTIN_EXAM_SUBJECTS;
export const OFFICE_EXAM_IDS = [];
export const MOS_EXAM_IDS = [];
export const DESIGN_EXAM_IDS = [];
export const PROGRAMMING_EXAM_IDS = [];
export const EXAM_SUBJECT_GROUP_LABELS = {
  admin: 'Admin tạo',
};
function isExcludedExamSubjectId(id) {
  return !String(id || '').trim();
}

function isCatalogSubjectId(id, catalog = BUILTIN_EXAM_SUBJECTS) {
  const subjectId = String(id || '').trim();
  return Boolean(subjectId)
    && !isExcludedExamSubjectId(subjectId)
    && Object.prototype.hasOwnProperty.call(catalog || BUILTIN_EXAM_SUBJECTS, subjectId);
}

export function slugifyExamSubjectId(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export function getExamSubjectInitials(meta) {
  const short = String(meta?.short || '').trim();
  if (short && short.length <= 3 && !/\s/.test(short)) return short.toUpperCase();
  const label = String(meta?.label || '').trim();
  if (label) {
    const words = label.split(/[\s()\-–—/&,+]+/).filter((w) => /[a-zA-Z0-9]/.test(w));
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
  (Array.isArray(customList) ? customList : []).forEach((subject) => {
    const id = String(subject?.id || '').trim().toLowerCase();
    const label = String(subject?.label || '').trim();
    if (!id || !label || isExcludedExamSubjectId(id) || Object.prototype.hasOwnProperty.call(merged, id)) return;
    if (subject.createdByAdmin !== true) return;
    merged[id] = {
      ...subject,
      id,
      label,
      custom: true,
      group: String(subject.group || 'admin'),
    };
  });
  return merged;
}

export function mergedArrayToCatalog(list) {
  const custom = (Array.isArray(list) ? list : []).filter((s) => (
    s?.id && !BUILTIN_EXAM_SUBJECTS[s.id] && s.createdByAdmin === true
  ));
  return mergeExamCatalog(custom);
}

export function getExamSubjectOptions(catalog) {
  const map = catalog || BUILTIN_EXAM_SUBJECTS;
  return Object.values(map)
    .filter(({ id }) => !isExcludedExamSubjectId(id))
    .map(({ id, label, group }) => ({ id, label, group: group || 'admin' }));
}

export function getExamSubjectGroupLabel(group, overrides = null) {
  const key = String(group || '');
  if (overrides && typeof overrides === 'object' && overrides[key]) {
    const custom = String(overrides[key]).trim();
    if (custom) return custom;
  }
  return EXAM_SUBJECT_GROUP_LABELS[key] || 'Khác';
}

export function normalizeCourseKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

export function mapCourseToExamSubjectIds(courseName, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const n = normalizeCourseKey(courseName);
  if (!n) return [];
  for (const sub of Object.values(cat)) {
    if (isExcludedExamSubjectId(sub.id)) continue;
    if (n === sub.id || n === normalizeCourseKey(sub.label)) return [sub.id];
  }
  return [];
}

/** Resolve a course name only when it exactly identifies a catalog subject. */
export function mapCourseToExamSubjectIdsStrict(courseName, catalog) {
  return mapCourseToExamSubjectIds(courseName, catalog);
}

export function getCourseTeachingFocus(courseOrEnrollment, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const courseName = typeof courseOrEnrollment === 'string'
    ? courseOrEnrollment
    : (courseOrEnrollment?.courseName || courseOrEnrollment?.name || '');
  const enrollmentSubjects = Array.isArray(courseOrEnrollment?.examSubjects)
    ? courseOrEnrollment.examSubjects.filter(Boolean)
    : [];
  if (enrollmentSubjects.length) {
    return [...new Set(enrollmentSubjects.map(String).filter((id) => isCatalogSubjectId(id, cat)))];
  }
  return mapCourseToExamSubjectIdsStrict(courseName, cat);
}

/** Resolve a teacher's configured subject IDs. */
export function getTeacherTeachingFocus(teacher, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  return [...new Set(resolveTeacherSubjectIds(teacher, cat).map(String).filter((id) => isCatalogSubjectId(id, cat)))];
}

/** A teacher matches only when their configured subject IDs cover the course IDs. */
export function teacherMatchesCourse(teacher, courseOrEnrollment, catalog) {
  if (!teacher) return false;
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const hasCourseSubjects = Array.isArray(courseOrEnrollment?.examSubjects)
    && courseOrEnrollment.examSubjects.length > 0;
  const courseSubjectIds = (hasCourseSubjects
    ? courseOrEnrollment.examSubjects
    : mapCourseToExamSubjectIdsStrict(
      typeof courseOrEnrollment === 'string'
        ? courseOrEnrollment
        : (courseOrEnrollment?.courseName || courseOrEnrollment?.name || ''),
      cat,
    ))
    .map(String)
    .filter((id) => isCatalogSubjectId(id, cat));
  const teacherSubjectIds = new Set(resolveTeacherSubjectIds(teacher, cat)
    .map(String)
    .filter((id) => isCatalogSubjectId(id, cat)));
  return courseSubjectIds.length > 0
    && courseSubjectIds.every((id) => teacherSubjectIds.has(id));
}

export function getSubjectIdsForEnrollment(enrollment, catalog = BUILTIN_EXAM_SUBJECTS) {
  if (!Array.isArray(enrollment?.examSubjects)) return [];
  return [...new Set(enrollment.examSubjects
    .map((id) => String(id || '').trim())
    .filter((id) => isCatalogSubjectId(id, catalog)))];
}

/** Các enrollment gắn với một môn thi (theo examSubjects / tên khóa). */
export function findEnrollmentsForSubject(enrollments, subjectId, catalog) {
  const sid = String(subjectId || '');
  if (!sid) return [];
  return (enrollments || []).filter((e) =>
    getSubjectIdsForEnrollment(e, catalog).map(String).includes(sid)
  );
}

/** Mở khóa thi theo khóa: true nếu bất kỳ enrollment nào của môn đó đã mở. */
export function isExamUnlockedForSubject(enrollments, subjectId, catalog, fallbackUnlocked = false) {
  const list = findEnrollmentsForSubject(enrollments, subjectId, catalog);
  if (list.length) return list.some((e) => e.examUnlocked === true);
  return !!fallbackUnlocked;
}

/**
 * Yêu cầu webcam theo khóa: chỉ khi enrollment/root được admin bật tường minh (=== true).
 * Mặc định tắt — không bắt camera khi chưa cấu hình.
 */
export function requireWebcamForSubject(enrollments, subjectId, catalog, fallbackRequire = false) {
  const list = findEnrollmentsForSubject(enrollments, subjectId, catalog);
  if (list.length) return list.some((e) => e.requireWebcam === true);
  return fallbackRequire === true;
}

export function getSubjectIdsForStudent(enrollments, fallbackCourse, catalog = BUILTIN_EXAM_SUBJECTS) {
  const ids = new Set();
  if (Array.isArray(enrollments) && enrollments.length) {
    enrollments.forEach((e) => {
      if (e.cancelledAt || e.status === 'cancelled' || e.status === 'refunded') return; // Bỏ qua khóa học đã hủy
      getSubjectIdsForEnrollment(e, catalog).forEach((id) => ids.add(id));
    });
  }
  return [...ids];
}

export function getSubjectIdsForCourseFilter(enrollments, filterCourse, fallbackCourse, catalog = BUILTIN_EXAM_SUBJECTS) {
  if (filterCourse === 'all') return getSubjectIdsForStudent(enrollments, fallbackCourse, catalog);
  const enr = enrollments.find((e) => (e.courseName || e.name) === filterCourse);
  if (enr) {
    if (enr.cancelledAt || enr.status === 'cancelled' || enr.status === 'refunded') return []; // Bỏ qua khóa học đã hủy
    return getSubjectIdsForEnrollment(enr, catalog);
  }
  return [];
}

export function buildExamSubjectsFromProgress(examProgress, subjectIds, catalog = BUILTIN_EXAM_SUBJECTS) {
  const ids = (subjectIds || []).filter((id) => isCatalogSubjectId(id, catalog));
  return ids.map((id) => {
    const def = { id, status: 'chua_thi', tracNghiem: null, thucHanh: 'chua_nop', lockUntil: null };
    const saved = (examProgress || []).find((s) => s.id === id);
    return saved ? { ...def, ...saved } : def;
  });
}

/**
 * Môn bị khóa với HV: còn countdown, đã rớt (khong_dat), hoặc dang_khoa.
 * Thi lại chỉ khi admin reset status về chua_thi (và xóa lockUntil).
 */
export function isExamProgressLocked(entry, now = Date.now()) {
  if (!entry) return false;
  const lu = Number(entry.lockUntil);
  if (Number.isFinite(lu) && lu > now) return true;
  const st = String(entry.status || '');
  if (st === 'khong_dat' || st === 'dang_khoa') return true;
  return false;
}

/** HV được phép START/RESUME certification exam cho môn này. */
export function canEnterCertificationExam(entry, now = Date.now()) {
  if (isExamProgressLocked(entry, now)) return false;
  const st = String(entry?.status || '');
  return !st || st === 'chua_thi' || st === 'dang_thi';
}

export function examMilestone(subjectIds, subjectId, completedSessions, totalSessions) {
  const ids = (subjectIds || []).map(String);
  const idx = ids.findIndex((id) => id === String(subjectId));
  const count = Math.max(1, ids.length);
  const total = Math.max(1, Number(totalSessions) || 12);
  const interval = Math.max(1, Math.floor(total / count));
  const requiredSessions = idx < 0 ? interval : interval * (idx + 1);
  const done = Number(completedSessions) || 0;
  return { requiredSessions, meetsMilestone: idx >= 0 && done >= requiredSessions };
}

/** Mở khóa khóa học, đang thi, hoặc đủ mốc buổi — khớp nút Phòng thi. */
export function canStartCertificationSubject({
  student,
  enrollments,
  subjectId,
  catalog,
  examProgressEntry,
  now,
} = {}) {
  if (!canEnterCertificationExam(examProgressEntry, now)) return false;
  const unlocked = isExamUnlockedForSubject(
    enrollments,
    subjectId,
    catalog,
    student?.studentExamUnlocked === true || student?.examApproved === true,
  );
  if (unlocked) return true;
  const ids = getSubjectIdsForStudent(enrollments, student?.course, catalog);
  if (examMilestone(ids, subjectId, student?.completedSessions, student?.totalSessions).meetsMilestone) {
    return true;
  }
  return findEnrollmentsForSubject(enrollments, subjectId, catalog).some((enr) => {
    const eids = getSubjectIdsForEnrollment(enr, catalog);
    return examMilestone(eids, subjectId, enr.completedSessions, enr.totalSessions).meetsMilestone;
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
  const ids = Array.isArray(examSubjects) ? examSubjects.filter((id) => !isExcludedExamSubjectId(id)) : [];
  if (!ids.length) return '\u2014';
  return ids.map((id) => getExamSubjectMeta(id, catalog).label).join(', ');
}

export function formatSubjectIdsAsSpecialty(subjectIds, catalog) {
  const ids = Array.isArray(subjectIds) ? subjectIds.filter((id) => !isExcludedExamSubjectId(id)) : [];
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
    .filter(([id]) => !isExcludedExamSubjectId(id))
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
  const fromIds = Array.isArray(teacher?.subjectIds)
    ? teacher.subjectIds.filter((id) => Boolean(id) && !isExcludedExamSubjectId(id))
    : [];
  if (fromIds.length) return fromIds;
  return parseSpecialtyToSubjectIds(teacher?.specialty, catalog);
}
