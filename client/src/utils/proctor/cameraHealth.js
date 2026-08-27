import { PROCTOR_CONFIG as CONFIG } from './config.js';

/**
 * Kiểm tra quyền camera (Permissions API — không có trên mọi trình duyệt).
 * @returns {'granted'|'denied'|'prompt'|'unknown'}
 */
export async function queryCameraPermission() {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const r = await navigator.permissions.query({ name: 'camera' });
    return r.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function getTrackHealth(stream) {
  if (!stream) {
    return { ok: false, reason: 'no_stream', message: 'Chưa có luồng camera.' };
  }
  const tracks = stream.getVideoTracks();
  if (!tracks.length) {
    return { ok: false, reason: 'no_track', message: 'Không tìm thấy track video.' };
  }
  const track = tracks[0];
  if (track.readyState === 'ended') {
    return { ok: false, reason: 'ended', message: 'Camera đã dừng / mất tín hiệu.' };
  }
  if (track.muted) {
    return { ok: false, reason: 'muted', message: 'Camera đang bị mute bởi hệ thống.' };
  }
  if (!track.enabled) {
    return { ok: false, reason: 'disabled', message: 'Camera bị tắt giữa chừng.' };
  }
  const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
  const w = settings.width || 0;
  const h = settings.height || 0;
  const deviceId = settings.deviceId || '';
  const lowRes = (w > 0 && w < CONFIG.MIN_VIDEO_WIDTH) || (h > 0 && h < CONFIG.MIN_VIDEO_HEIGHT);
  return {
    ok: true,
    reason: lowRes ? 'low_res' : 'ok',
    message: lowRes
      ? `Độ phân giải thấp (${w}×${h}). Nên dùng camera ≥ ${CONFIG.MIN_VIDEO_WIDTH}×${CONFIG.MIN_VIDEO_HEIGHT}.`
      : 'Camera hoạt động.',
    width: w,
    height: h,
    deviceId,
    label: track.label || '',
    lowRes,
  };
}

export function createFpsTracker() {
  let lastTs = 0;
  let samples = [];
  return {
    /** Gọi mỗi lần nhận frame mới (video.currentTime đổi hoặc sample OK) */
    tick(now = performance.now()) {
      if (lastTs > 0) {
        const dt = now - lastTs;
        if (dt > 0 && dt < 2000) {
          samples.push(1000 / dt);
          if (samples.length > 20) samples.shift();
        }
      }
      lastTs = now;
    },
    getFps() {
      if (!samples.length) return 0;
      const sum = samples.reduce((a, b) => a + b, 0);
      return sum / samples.length;
    },
    isStable() {
      const fps = this.getFps();
      return fps >= CONFIG.MIN_STABLE_FPS;
    },
    reset() {
      lastTs = 0;
      samples = [];
    },
  };
}

export function waitForVideoFrames(video, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!video) {
      resolve(false);
      return;
    }
    const done = (ok) => {
      clearTimeout(tid);
      video.removeEventListener('loadeddata', tick);
      video.removeEventListener('playing', tick);
      video.removeEventListener('canplay', tick);
      resolve(ok);
    };
    const tick = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) done(true);
    };
    const tid = setTimeout(() => done(video.videoWidth > 0), timeoutMs);
    if (video.readyState >= 2 && video.videoWidth > 0) {
      clearTimeout(tid);
      resolve(true);
      return;
    }
    video.addEventListener('loadeddata', tick, { passive: true });
    video.addEventListener('playing', tick, { passive: true });
    video.addEventListener('canplay', tick, { passive: true });
    tick();
  });
}

export async function openProctorCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('Trình duyệt không hỗ trợ getUserMedia.');
    err.code = 'UNSUPPORTED';
    throw err;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  });
  return stream;
}

export function stopStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch { /* ignore */ }
}

export function mapGetUserMediaError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'denied',
      message: 'Camera bị từ chối. Cho phép quyền camera trong trình duyệt rồi thử lại.',
      guide: 'Chrome/Edge: biểu tượng khóa trên URL › Quyền trang web › Camera › Cho phép. Firefox: Quyền › Camera.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'not_found',
      message: 'Không tìm thấy camera trên thiết bị.',
      guide: 'Kiểm tra webcam đã cắm / chưa bị chiếm bởi ứng dụng khác.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'busy',
      message: 'Camera đang được ứng dụng khác sử dụng.',
      guide: 'Đóng Zoom/Teams/ứng dụng khác đang dùng camera, rồi thử lại.',
    };
  }
  return {
    code: 'error',
    message: err?.message || 'Không mở được camera.',
    guide: 'Thử tải lại trang hoặc dùng Chrome/Edge mới nhất.',
  };
}
