/** Mở Vào Meet trước giờ học 1 phút, đến hết ca (giờ VN). */
export const MEET_JOIN_EARLY_MINUTES = 1;

export function clockMinutes(value?: string) {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hour)) return 0;
  return hour * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function vnScheduleClock(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function isMeetJoinWindow({
  day,
  startTime,
  endTime,
  nowDay,
  nowMinutes,
  earlyMinutes = MEET_JOIN_EARLY_MINUTES,
}: {
  day?: string;
  startTime?: string;
  endTime?: string;
  nowDay: string;
  nowMinutes: number;
  earlyMinutes?: number;
}) {
  if (!day || day !== nowDay) return false;
  const start = clockMinutes(startTime);
  const end = clockMinutes(endTime) || start + 60;
  return nowMinutes >= start - earlyMinutes && nowMinutes < end;
}

/** Tên buổi HV thấy: ghi chú admin/GV, không dùng nhãn mặc định «Học Meet». */
export function meetLessonName(row?: { note?: string; title?: string } | null) {
  const note = String(row?.note || '').trim();
  if (note) return note;
  const title = String(row?.title || '').trim();
  if (title && title !== 'Học Meet') return title;
  return 'Buổi Meet';
}

export function isMeetEnded({
  day,
  endTime,
  nowDay,
  nowMinutes,
}: {
  day?: string;
  endTime?: string;
  nowDay: string;
  nowMinutes: number;
}) {
  if (!day || !nowDay) return false;
  if (day < nowDay) return true;
  if (day !== nowDay) return false;
  const end = clockMinutes(endTime);
  if (!end) return false;
  return nowMinutes >= end;
}

export function isMeetLiveNow({
  day,
  startTime,
  endTime,
  nowDay,
  nowMinutes,
}: {
  day?: string;
  startTime?: string;
  endTime?: string;
  nowDay: string;
  nowMinutes: number;
}) {
  if (!day || day !== nowDay) return false;
  const start = clockMinutes(startTime);
  const end = clockMinutes(endTime) || start + 60;
  return nowMinutes >= start && nowMinutes < end;
}
