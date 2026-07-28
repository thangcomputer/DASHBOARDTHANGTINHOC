/** Chuẩn hóa document API → shape frontend */
export function mapSchedule(sch) {
  return {
    ...sch,
    id: sch._id || sch.id,
    studentId: typeof sch.studentId === 'object' && sch.studentId
      ? String(sch.studentId._id || sch.studentId)
      : String(sch.studentId || ''),
    teacherId: typeof sch.teacherId === 'object' && sch.teacherId
      ? String(sch.teacherId._id || sch.teacherId)
      : String(sch.teacherId || ''),
  };
}

export function mapStudent(s) {
  if (!s) return s;
  const teacherIdRaw = s.teacherId;
  let teacherId = '';
  let teacherIds = [];
  let teacherNames = [];

  if (Array.isArray(teacherIdRaw)) {
    // Backend có thể trả teacherId dạng mảng (nhiều môn / nhiều GV)
    teacherIds = teacherIdRaw
      .map((t) => {
        if (!t) return '';
        if (typeof t === 'object') return String(t._id || t.id || '');
        return String(t);
      })
      .filter(Boolean);

    teacherNames = teacherIdRaw
      .map((t) => (t && typeof t === 'object' ? (t.name || t.teacherName || '') : ''))
      .filter(Boolean);

    teacherId = teacherIds[0] || '';
  } else if (typeof teacherIdRaw === 'object' && teacherIdRaw) {
    teacherId = String(teacherIdRaw._id || teacherIdRaw.id || '');
    const singleName = teacherIdRaw?.name || teacherIdRaw?.teacherName || '';
    if (singleName) teacherNames = [singleName];
  } else {
    teacherId = String(teacherIdRaw || '');
  }

  // Bổ sung GV từ từng enrollment/course (Admin gán theo khóa)
  const seenIds = new Set(teacherIds.map(String));
  const seenNames = new Set(teacherNames.map((n) => String(n).toLowerCase()));
  const pushTeacher = (tid, tname) => {
    if (tid && !seenIds.has(String(tid))) {
      seenIds.add(String(tid));
      teacherIds.push(String(tid));
    }
    const name = String(tname || '').trim();
    if (name && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      teacherNames.push(name);
    }
  };

  [...(Array.isArray(s.enrollments) ? s.enrollments : []), ...(Array.isArray(s.courses) ? s.courses : [])]
    .forEach((e) => {
      if (!e) return;
      const tid = typeof e.teacherId === 'object' && e.teacherId
        ? String(e.teacherId._id || e.teacherId.id || '')
        : String(e.teacherId || '');
      const tname = e.teacherName
        || (typeof e.teacherId === 'object' ? (e.teacherId?.name || '') : '')
        || '';
      pushTeacher(tid, tname);
    });

  if (!teacherId && teacherIds.length) teacherId = teacherIds[0];
  if (!teacherNames.length && s.teacherName) teacherNames = [String(s.teacherName)];

  const teacherName = teacherNames[0] || s.teacherName || '';
  return {
    ...s,
    id: s._id || s.id,
    teacherId,
    ...(teacherIds.length ? { teacherIds } : {}),
    ...(teacherNames.length ? { teacherNames } : {}),
    ...(teacherName ? { teacherName } : {}),
  };
}

export function mapTeacher(t) {
  return { ...t, id: t._id || t.id };
}

export function mapTransaction(tx) {
  return { ...tx, id: tx._id || tx.id };
}
