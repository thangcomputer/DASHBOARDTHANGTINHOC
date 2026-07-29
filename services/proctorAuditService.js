const ProctorEvent = require('../models/ProctorEvent');
const logger = require('../config/logger');

const ALLOWED_TYPES = new Set([
  'camera_start',
  'camera_stop',
  'camera_lost',
  'camera_retry',
  'camera_denied',
  'face_absent',
  'face_present',
  'multi_face',
  'lens_blocked',
  'eye_miss',
  'gaze_off',
  'motion_stale',
  'tab_blur',
  'window_blur',
  'network_offline',
  'network_online',
  'device_change',
  'low_res',
  'low_fps',
  'low_light',
  'soft_warn',
  'hard_violation',
  'exam_submit',
  'exam_terminate',
  'risk_snapshot',
]);

const ALLOWED_SEVERITY = new Set(['info', 'soft', 'warn', 'critical']);

function sanitizeDetail(detail) {
  if (!detail || typeof detail !== 'object') return {};
  const out = { ...detail };
  delete out.frameData;
  delete out.imageData;
  delete out.snapshot;
  delete out.streamUrl;
  delete out.videoBlob;
  if (typeof out.deviceLabel === 'string') out.deviceLabel = out.deviceLabel.slice(0, 40);
  // Giới hạn kích thước JSON
  try {
    const raw = JSON.stringify(out);
    if (raw.length > 4000) return { truncated: true, keys: Object.keys(out).slice(0, 20) };
  } catch {
    return {};
  }
  return out;
}

/**
 * Lưu batch sự kiện từ client (JWT bắt buộc ở route).
 */
async function ingestEvents({ user, events, ip, userAgent, tenantId }) {
  if (!Array.isArray(events) || !events.length) {
    return { inserted: 0 };
  }
  const capped = events.slice(0, 50);
  const docs = [];
  for (const evt of capped) {
    const type = String(evt?.type || '').slice(0, 64);
    if (!ALLOWED_TYPES.has(type)) continue;
    const severity = ALLOWED_SEVERITY.has(evt?.severity) ? evt.severity : 'info';
    docs.push({
      tenantId: tenantId || undefined,
      userId: String(user?.id || user?._id || ''),
      role: user?.role || 'unknown',
      sessionId: String(evt?.sessionId || '').slice(0, 128),
      examType: String(evt?.examType || 'exam').slice(0, 64),
      type,
      severity,
      detail: sanitizeDetail(evt?.detail),
      clientTs: evt?.ts ? new Date(evt.ts) : undefined,
      ip: ip || '',
      userAgent: String(userAgent || '').slice(0, 300),
    });
  }
  if (!docs.length) return { inserted: 0 };
  await ProctorEvent.insertMany(docs, { ordered: false });
  logger.info(
    { userId: docs[0].userId, count: docs.length, types: [...new Set(docs.map((d) => d.type))] },
    '[Proctor] audit events ingested',
  );

  // Phase 9 — proctor violation path:
  // - luôn ghi nhận event (đã insert)
  // - chỉ auto-lock phòng thi khi exam_terminate hoặc detail.autoLock === true
  const lockTriggers = capped.filter((e) => {
    const t = String(e?.type || '');
    if (t === 'exam_terminate') return true;
    if (t === 'hard_violation' && e?.detail?.autoLock === true) return true;
    return false;
  });
  let violationApplied = false;
  if (lockTriggers.length && String(user?.role || '').toLowerCase() === 'student') {
    try {
      const { lockStudentExam } = require('./examLifecycleService');
      const Student = require('../models/Student');
      const st = await Student.findById(user.id).select('studentExamUnlocked').lean();
      if (st?.studentExamUnlocked) {
        const subjectId = lockTriggers.map((e) => e?.detail?.subjectId).find(Boolean) || null;
        const reason = lockTriggers.map((e) => e?.detail?.reason || e?.type).filter(Boolean).join('; ').slice(0, 400)
          || 'Vi phạm giám sát thi (proctor)';
        await lockStudentExam({
          studentId: user.id,
          actor: { id: user.id, role: 'student', name: 'Proctor' },
          io: global.io || null,
          reqMeta: { ip: ip || '', userAgent: String(userAgent || '').slice(0, 300) },
          reason,
          reasonKind: 'violation',
          subjectId,
        });
        violationApplied = true;
      }
    } catch (err) {
      logger.warn({ err: err.message }, '[Proctor] violation→exam lock skipped');
    }
  }

  return { inserted: docs.length, violationApplied };
}

async function listEventsForUser(userId, { limit = 100 } = {}) {
  return ProctorEvent.find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .lean();
}

module.exports = {
  ingestEvents,
  listEventsForUser,
  ALLOWED_TYPES,
};
