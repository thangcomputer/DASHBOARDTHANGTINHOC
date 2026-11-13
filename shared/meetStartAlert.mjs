/** Cửa sổ nhắc lớp: gom ID trùng, tắt/vào lớp thì im tới hết ca. */

export const MEET_ALERT_SNOOZE_MS = 5 * 60 * 1000;
export const MEET_ALERT_MIN_DISMISS_MS = 2 * 60 * 60 * 1000;

function clockMinutes(value) {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hour)) return 0;
  return hour * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function meetAlertSlotKey(item) {
  const start = String(item?.startTime || '').trim();
  const course = String(item?.course || item?.title || '').trim().toLowerCase();
  const day = String(item?.day || '').trim();
  return `slot:${day}|${start}|${course}`;
}

/** Mọi khóa dùng để nhớ “đã tắt / đã vào” — socket và API không được coi là 2 ca. */
export function meetAlertIds(item) {
  const ids = [];
  const raw = String(item?.id || '').trim();
  const scheduleId = String(item?.scheduleId || '').trim();
  if (raw) ids.push(raw);
  if (scheduleId && !ids.includes(scheduleId)) ids.push(scheduleId);
  ids.push(meetAlertSlotKey(item));
  const start = String(item?.startTime || '').trim();
  if (start) ids.push(`socket-${start}`);
  return [...new Set(ids.filter(Boolean))];
}

export function sameMeetAlert(a, b) {
  if (!a || !b) return false;
  const aIds = new Set(meetAlertIds(a));
  return meetAlertIds(b).some((id) => aIds.has(id));
}

export function meetAlertDismissMs(item, nowMinutes) {
  const start = clockMinutes(item?.startTime);
  const end = clockMinutes(item?.endTime) || start + 90;
  const remainMs = Math.max(0, end - nowMinutes) * 60 * 1000;
  return Math.max(MEET_ALERT_MIN_DISMISS_MS, remainMs + MEET_ALERT_SNOOZE_MS);
}

export function resolveMeetJoinLink(...sources) {
  for (const source of sources) {
    const value = String(source || '').trim();
    if (value) return value;
  }
  return '';
}

export function minutesUntilMeetStart(startTime, nowMinutes) {
  return clockMinutes(startTime) - nowMinutes;
}

export function meetAlertKicker({ isLive, isTeacher, minutesUntilStart }) {
  if (isLive || minutesUntilStart <= 0) {
    return isTeacher ? '🔴 ĐÃ ĐẾN GIỜ VÀO LỚP DẠY!' : '🔴 ĐÃ ĐẾN GIỜ VÀO HỌC!';
  }
  const abs = Math.max(1, minutesUntilStart);
  const label = abs >= 60 ? `CÒN ${Math.round(abs / 60)} GIỜ` : `CÒN ${abs} PHÚT`;
  return isTeacher
    ? `⏰ SẮP ĐẾN GIỜ DẠY HỌC (${label})`
    : `⏰ SẮP ĐẾN GIỜ VÀO HỌC (${label})`;
}
