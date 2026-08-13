/**
 * Business timezone helpers — Asia/Ho_Chi_Minh (UTC+7, no DST).
 * Use for analytics calendar buckets; avoid Date#toISOString().slice(0,10) for VN days.
 */
'use strict';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET = '+07:00';

function getVnParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** YYYY-MM-DD in Asia/Ho_Chi_Minh */
function vnDateKey(date = new Date()) {
  const p = getVnParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** YYYY-MM in Asia/Ho_Chi_Minh */
function vnMonthKey(date = new Date()) {
  const p = getVnParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

/** Instant of local VN midnight for the calendar day containing `date`. */
function vnStartOfDay(date = new Date()) {
  return new Date(`${vnDateKey(date)}T00:00:00${VN_OFFSET}`);
}

function addCalendarDaysVn(date, deltaDays) {
  const key = vnDateKey(date);
  const [y, m, d] = key.split('-').map(Number);
  // Noon UTC+7 avoids DST edge cases (VN has none) when shifting days
  const base = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00${VN_OFFSET}`);
  base.setTime(base.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return vnStartOfDay(base);
}

/**
 * Analytics period ranges (business calendar, VN).
 * - 1d: today 00:00 VN → now
 * - Nd/Nm: start of calendar day N units back → now (inclusive of today)
 */
function getAnalyticsPeriodRange(period, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const end = now;
  let start;

  switch (String(period || '1m')) {
    case '1d':
      start = vnStartOfDay(now);
      break;
    case '7d':
      start = addCalendarDaysVn(now, -6);
      break;
    case '1m':
      start = addCalendarDaysVn(now, -29);
      break;
    case '2m':
      start = addCalendarDaysVn(now, -59);
      break;
    case '10m':
      start = addCalendarDaysVn(now, -299);
      break;
    case '1y':
      start = addCalendarDaysVn(now, -364);
      break;
    case '2y':
      start = addCalendarDaysVn(now, -729);
      break;
    default:
      start = addCalendarDaysVn(now, -29);
      break;
  }

  // Previous window: same duration ending at current start (aligned).
  // For 1d: yesterday 00:00 → yesterday (same clock time as now).
  const elapsed = Math.max(0, end.getTime() - start.getTime());
  let prevStart;
  let prevEnd;
  if (String(period) === '1d') {
    prevStart = addCalendarDaysVn(now, -1);
    prevEnd = new Date(prevStart.getTime() + elapsed);
  } else {
    prevEnd = new Date(start.getTime());
    prevStart = new Date(start.getTime() - Math.max(elapsed, 1));
  }

  return { start, end, prevStart, prevEnd, timezone: VN_TZ };
}

/**
 * Choose bucket granularity from inclusive span.
 * @returns {'day'|'month'}
 */
function pickRevenueBucketSize(start, end) {
  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  if (days > 60) return 'month';
  return 'day';
}

/** Enumerate empty bucket keys from start→end in VN calendar. */
function enumerateVnBucketKeys(start, end, bucketSize = 'day') {
  const keys = [];
  if (bucketSize === 'month') {
    let cur = vnStartOfDay(start);
    const endKey = vnMonthKey(end);
    let guard = 0;
    while (guard < 120) {
      const k = vnMonthKey(cur);
      keys.push(k);
      if (k >= endKey) break;
      const p = getVnParts(cur);
      const nextMonth = p.month === 12 ? 1 : p.month + 1;
      const nextYear = p.month === 12 ? p.year + 1 : p.year;
      cur = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00${VN_OFFSET}`);
      guard += 1;
    }
    return keys;
  }

  let cur = vnStartOfDay(start);
  const endDay = vnStartOfDay(end);
  let guard = 0;
  while (cur <= endDay && guard < 800) {
    keys.push(vnDateKey(cur));
    cur = addCalendarDaysVn(cur, 1);
    guard += 1;
  }
  return keys;
}

module.exports = {
  VN_TZ,
  getVnParts,
  vnDateKey,
  vnMonthKey,
  vnStartOfDay,
  addCalendarDaysVn,
  getAnalyticsPeriodRange,
  pickRevenueBucketSize,
  enumerateVnBucketKeys,
};
