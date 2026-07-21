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
  const teacherId = typeof s.teacherId === 'object' && s.teacherId
    ? String(s.teacherId._id || s.teacherId.id || '')
    : String(s.teacherId || '');
  const teacherName = (typeof s.teacherId === 'object' && s.teacherId?.name)
    ? s.teacherId.name
    : (s.teacherName || '');
  return {
    ...s,
    id: s._id || s.id,
    teacherId,
    ...(teacherName ? { teacherName } : {}),
  };
}

export function mapTeacher(t) {
  return { ...t, id: t._id || t.id };
}

export function mapTransaction(tx) {
  return { ...tx, id: tx._id || tx.id };
}
