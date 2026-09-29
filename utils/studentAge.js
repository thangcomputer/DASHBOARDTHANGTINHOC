'use strict';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function getTodayAgeReferenceDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

module.exports = { getTodayAgeReferenceDate };
