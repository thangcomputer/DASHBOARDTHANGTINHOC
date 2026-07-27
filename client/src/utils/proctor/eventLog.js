import { PROCTOR_CONFIG as CONFIG } from './config.js';

const SEVERITY = {
  info: 0,
  soft: 1,
  warn: 2,
  critical: 3,
};

/**
 * Nhật ký sự kiện giám sát (ring buffer) + flush JWT lên API.
 * Không lưu video/frame.
 */
export function createProctorEventLog({
  sessionId = '',
  examType = 'exam',
  flushMs = CONFIG.AUDIT_FLUSH_MS,
  maxBuffer = CONFIG.AUDIT_MAX_BUFFER,
  postEvents = null,
} = {}) {
  const events = [];
  let flushTimer = null;
  let pending = [];

  function push(type, severity = 'info', detail = {}) {
    const evt = {
      type,
      severity,
      severityRank: SEVERITY[severity] ?? 0,
      ts: new Date().toISOString(),
      t: Date.now(),
      sessionId,
      examType,
      detail: sanitizeDetail(detail),
    };
    events.push(evt);
    if (events.length > maxBuffer) events.shift();
    pending.push(evt);
    return evt;
  }

  function sanitizeDetail(detail) {
    if (!detail || typeof detail !== 'object') return {};
    const out = { ...detail };
    // Không lộ device label đầy đủ / URL nhạy cảm
    if (out.deviceLabel) out.deviceLabel = String(out.deviceLabel).slice(0, 40);
    delete out.streamUrl;
    delete out.frameData;
    delete out.imageData;
    delete out.snapshot;
    return out;
  }

  async function flush() {
    if (!postEvents || !pending.length) {
      pending = [];
      return;
    }
    const batch = pending.splice(0, pending.length);
    try {
      await postEvents(batch);
    } catch {
      // Giữ lại tối đa nửa batch nếu fail (tránh mất hết)
      pending = [...batch.slice(-Math.floor(maxBuffer / 2)), ...pending].slice(-maxBuffer);
    }
  }

  function startAutoFlush() {
    if (!flushMs || flushTimer) return;
    flushTimer = setInterval(() => {
      flush();
    }, flushMs);
  }

  function stop() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    return flush();
  }

  return {
    push,
    flush,
    startAutoFlush,
    stop,
    getEvents: () => [...events],
    clear() {
      events.length = 0;
      pending = [];
    },
  };
}

/** Trạng thái UX hiển thị cho thí sinh */
export function resolveProctorUiStatus({
  cameraStatus,
  facePresent,
  multiFace,
  inOval,
  lowLight,
  lensBlocked,
  checking,
}) {
  if (cameraStatus === 'denied' || cameraStatus === 'error' || cameraStatus === 'lost') {
    return {
      code: 'camera_error',
      level: 'red',
      label: 'Camera lỗi / mất tín hiệu',
      guide: 'Kiểm tra quyền camera và thử lại.',
    };
  }
  if (cameraStatus === 'loading' || checking) {
    return {
      code: 'checking',
      level: 'yellow',
      label: 'Đang kiểm tra khuôn mặt',
      guide: 'Giữ mặt trong vòng oval, nhìn thẳng màn hình.',
    };
  }
  if (lensBlocked) {
    return {
      code: 'lens_blocked',
      level: 'red',
      label: 'Camera bị che',
      guide: 'Bỏ vật cản / khăn che ống kính.',
    };
  }
  if (multiFace) {
    return {
      code: 'multi_face',
      level: 'red',
      label: 'Phát hiện nhiều khuôn mặt',
      guide: 'Chỉ một người trong khung hình.',
    };
  }
  if (!facePresent) {
    return {
      code: 'no_face',
      level: 'red',
      label: 'Không phát hiện khuôn mặt',
      guide: 'Đưa mặt vào giữa vòng oval.',
    };
  }
  if (facePresent && inOval === false) {
    return {
      code: 'out_of_oval',
      level: 'orange',
      label: 'Khuôn mặt chưa ở đúng vị trí',
      guide: 'Căn mặt vào giữa vòng oval.',
    };
  }
  if (lowLight) {
    return {
      code: 'low_light',
      level: 'orange',
      label: 'Ánh sáng yếu',
      guide: 'Ngồi gần nguồn sáng hơn.',
    };
  }
  return {
    code: 'ok',
    level: 'green',
    label: 'Camera hoạt động bình thường',
    guide: 'Tiếp tục làm bài bình thường.',
  };
}
