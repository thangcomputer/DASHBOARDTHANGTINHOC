/** Catalog mon thi (mac dinh + tuy chinh tu server) */
export const BUILTIN_EXAM_SUBJECTS = {
  coban: { id: 'coban', label: 'M\u00E1y vi t\u00EDnh (C\u01A1 b\u1EA3n)', short: 'C', bg: 'bg-slate-600', minutes: 90 },
  word: { id: 'word', label: 'Word', short: 'W', bg: 'bg-blue-600', minutes: 90 },
  excel: { id: 'excel', label: 'Excel', short: 'X', bg: 'bg-green-600', minutes: 90 },
  powerpoint: { id: 'powerpoint', label: 'PowerPoint', short: 'P', bg: 'bg-orange-500', minutes: 90 },
  canva: { id: 'canva', label: 'Canva', short: 'CA', bg: 'bg-purple-600', minutes: 90 },
  situation: { id: 'situation', label: 'S\u01B0 ph\u1EA1m (T\u00ECnh hu\u1ED1ng)', short: 'SP', bg: 'bg-rose-600', minutes: 90 },
};
export const EXAM_SUBJECTS = BUILTIN_EXAM_SUBJECTS;
export const OFFICE_EXAM_IDS = ['coban', 'word', 'excel', 'powerpoint'];

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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

export function mapCourseToExamSubjectIds(courseName, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const n = normalizeCourseKey(courseName);
  const pick = (ids) => ids.filter((id) => cat[id]);
  if (!n) return [];
  // Combo Powerpoint + Canva trong cùng tên khóa
  if (n.includes('canva') && (n.includes('powerpoint') || n.includes('ppt'))) {
    return pick(['coban', 'powerpoint', 'canva']);
  }
  if (n.includes('canva')) return pick(['canva']);
  if (n.includes('thvp') || n.includes('van phong') || n.includes('tin hoc van phong') || n.includes('microsoft office')) return pick([...OFFICE_EXAM_IDS]);
  if (n.includes('excel') && !n.includes('van phong')) return pick(['coban', 'excel']);
  if (n.includes('word') && !n.includes('van phong')) return pick(['coban', 'word']);
  if (n.includes('powerpoint') || n.includes('ppt')) return pick(['coban', 'powerpoint']);
  // Đồ họa — không mặc định sang tin học văn phòng
  if (n.includes('photoshop') || n.includes('illustrator') || n.includes('do hoa') || n.includes('thiet ke')) {
    for (const sub of Object.values(cat)) {
      const ln = normalizeCourseKey(sub.label || '');
      const idn = normalizeCourseKey(sub.id || '');
      if (n.includes(idn) || n.includes(ln) || ln.includes(n) || idn.includes('photoshop')) return [sub.id];
    }
    return [];
  }
  for (const sub of Object.values(cat)) {
    if (n.includes(sub.id) || n.includes(normalizeCourseKey(sub.label))) return [sub.id];
  }
  return pick([...OFFICE_EXAM_IDS]);
}

/**
 * Map khóa → subjectIds nhưng KHÔNG fallback sang Office khi không nhận ra tên khóa.
 * Dùng khi lọc giảng viên phù hợp môn.
 */
export function mapCourseToExamSubjectIdsStrict(courseName, catalog) {
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const n = normalizeCourseKey(courseName);
  if (!n) return [];
  const loose = mapCourseToExamSubjectIds(courseName, cat);
  const looksOffice =
    n.includes('thvp')
    || n.includes('van phong')
    || n.includes('tin hoc van phong')
    || n.includes('microsoft office')
    || n.includes('excel')
    || n.includes('word')
    || n.includes('powerpoint')
    || n.includes('ppt')
    || n.includes('coban')
    || n.includes('may vi tinh')
    || n.includes('co ban');
  const allOffice = loose.length > 0 && loose.every((id) => OFFICE_EXAM_IDS.includes(id));
  if (allOffice && !looksOffice) return [];
  return loose;
}

/** Khớp mờ tên khóa ↔ specialty / label môn của GV */
function fuzzyCourseTeacherMatch(courseName, teacher, catalog) {
  const courseKey = normalizeCourseKey(courseName);
  if (!courseKey) return false;
  const specialtyKey = normalizeCourseKey(teacher?.specialty || '');
  if (specialtyKey) {
    if (specialtyKey.includes(courseKey) || courseKey.includes(specialtyKey)) return true;
    for (const part of specialtyKey.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean)) {
      if (part.length >= 3 && (courseKey.includes(part) || part.includes(courseKey))) return true;
    }
  }
  const teacherIds = resolveTeacherSubjectIds(teacher, catalog);
  for (const id of teacherIds) {
    const meta = getExamSubjectMeta(id, catalog);
    const label = normalizeCourseKey(meta.label || id);
    if (label && label.length >= 3 && (courseKey.includes(label) || label.includes(courseKey))) return true;
    const idn = normalizeCourseKey(id);
    if (idn && courseKey.includes(idn)) return true;
  }
  return false;
}

/**
 * GV có thể dạy khóa này không?
 * - Trùng subjectIds với khóa (enrollment.examSubjects hoặc map từ tên khóa)
 * - hoặc specialty/tên môn khớp mờ với tên khóa
 * Dùng để gợi ý UI (nhãn "khác môn") — không chặn phân công.
 */
export function teacherMatchesCourse(teacher, courseOrEnrollment, catalog) {
  if (!teacher) return false;
  const cat = catalog || BUILTIN_EXAM_SUBJECTS;
  const courseName = typeof courseOrEnrollment === 'string'
    ? courseOrEnrollment
    : (courseOrEnrollment?.courseName || courseOrEnrollment?.name || '');
  const enrollmentSubjects = Array.isArray(courseOrEnrollment?.examSubjects)
    ? courseOrEnrollment.examSubjects.filter(Boolean)
    : [];

  const teacherIds = resolveTeacherSubjectIds(teacher, cat);
  const courseIds = enrollmentSubjects.length
    ? enrollmentSubjects.filter((id) => cat[id] || true)
    : mapCourseToExamSubjectIdsStrict(courseName, cat);

  if (teacherIds.length && courseIds.length) {
    const set = new Set(teacherIds.map(String));
    if (courseIds.some((id) => set.has(String(id)))) return true;
  }

  return fuzzyCourseTeacherMatch(courseName, teacher, cat);
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
  if (!ids.length) return '\u2014';
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
