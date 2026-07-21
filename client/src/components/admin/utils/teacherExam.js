export function resolveTeacherExamDate(t) {
  if (!t) return null;
  if (t.testDate) {
    const d = new Date(t.testDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const attempted =
    t.testStatus === 'passed' ||
    t.testStatus === 'failed' ||
    Number(t.testScore) > 0 ||
    (String(t.status) === 'Locked' && t.lockReason);
  if (attempted && t.updatedAt) {
    const d = new Date(t.updatedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function isTeacherExamDateApproximate(t) {
  return !t?.testDate && resolveTeacherExamDate(t) != null;
}
