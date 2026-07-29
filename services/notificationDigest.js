/**
 * Class reminder digest — 1 notification / học viên / ngày (Phase 5).
 * Idempotent qua eventId = class-digest:YYYY-MM-DD:studentId
 */
const Schedule = require('../models/Schedule');
const NotificationService = require('./NotificationService');
const logger = require('../config/logger');

function vnDayBounds(now = new Date()) {
  // UTC+7 calendar day
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth();
  const d = vn.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - 7 * 60 * 60 * 1000);
  const endUtc = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - 7 * 60 * 60 * 1000);
  const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { startUtc, endUtc, dateKey };
}

function buildSummary(sessions) {
  return sessions
    .slice(0, 5)
    .map((s) => `${s.course || 'Lớp'} lúc ${s.startTime || ''}`)
    .join('; ');
}

/**
 * @param {object} [io]
 * @param {Date} [now]
 * @returns {{ sent: number, skipped: number, dateKey: string }}
 */
async function runClassReminderDigest(io, now = new Date()) {
  const { startUtc, endUtc, dateKey } = vnDayBounds(now);

  const sessions = await Schedule.find({
    date: { $gte: startUtc, $lt: endUtc },
    status: { $in: ['scheduled'] },
    studentId: { $ne: null },
  })
    .select('studentId course startTime')
    .lean();

  const byStudent = new Map();
  for (const s of sessions) {
    const sid = String(s.studentId);
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid).push(s);
  }

  let sent = 0;
  let skipped = 0;

  for (const [studentId, list] of byStudent.entries()) {
    const eventId = `class-digest:${dateKey}:${studentId}`;
    try {
      const doc = await NotificationService.sendFromTemplate(io, {
        templateCode: 'CLASS_REMINDER_TODAY',
        receivers: [studentId],
        eventId,
        data: {
          count: list.length,
          summary: buildSummary(list) || 'xem lịch học',
        },
        payload: {
          dateKey,
          sessionCount: list.length,
          popup: true,
        },
      });
      // idempotent hit returns existing lean/doc
      if (doc && doc.createdAt && Date.now() - new Date(doc.createdAt).getTime() < 60_000) {
        sent += 1;
      } else if (doc && doc.eventId === eventId) {
        // existing from prior run
        skipped += 1;
      } else {
        sent += 1;
      }
    } catch (err) {
      skipped += 1;
      logger.warn({ err: err.message, studentId, eventId }, '[Digest] class reminder failed');
    }
  }

  logger.info({ dateKey, students: byStudent.size, sent, skipped }, '[Digest] class reminder done');
  return { sent, skipped, dateKey, students: byStudent.size };
}

module.exports = {
  vnDayBounds,
  buildSummary,
  runClassReminderDigest,
};
