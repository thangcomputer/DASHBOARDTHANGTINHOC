const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateParts(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
    return { year, month, day };
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, Number(part)]));
  return { year: values.year, month: values.month, day: values.day };
}

export function getTodayStudentAgeReferenceDate(now = new Date()) {
  const parts = dateParts(now);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getCurrentStudentAge(student, now = new Date()) {
  const age = student?.ageAtEntry ?? student?.age;
  if (age == null || age === '') return null;

  const baseAge = Number(age);
  if (!Number.isFinite(baseAge)) return null;

  const referenceDate = student.ageAsOf || student.createdAt;
  const reference = dateParts(referenceDate);
  const current = dateParts(now);
  if (!reference || !current) return baseAge;

  let elapsedYears = current.year - reference.year;
  const anniversaryDay = Math.min(reference.day, daysInMonth(current.year, reference.month));
  if (
    current.month < reference.month
    || (current.month === reference.month && current.day < anniversaryDay)
  ) {
    elapsedYears -= 1;
  }

  return baseAge + Math.max(0, elapsedYears);
}
