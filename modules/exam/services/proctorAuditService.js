const { proctorEventRepository } = require('../repositories');
const ProctorEvent = require('../models/ProctorEvent'); // Temp for new ProctorEvent
const logger = require('../../../config/logger');

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
  await proctorEventRepository.insertMany(docs, { ordered: false });
  logger.info(
    { userId: docs[0].userId, count: docs.length, types: [...new Set(docs.map((d) => d.type))] },
    '[Proctor] audit events ingested',
  );
  return { inserted: docs.length };
}

async function listEventsForUser(userId, { limit = 100 } = {}) {
  return proctorEventRepository.findMany({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .lean();
}

module.exports = {
  ingestEvents,
  listEventsForUser,
  ALLOWED_TYPES,
};
