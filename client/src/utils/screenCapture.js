/**
 * Chụp màn hình (getDisplayMedia) → File PNG.
 * Toàn màn: chọn màn trong hộp thoại → chụp frame ngay, tắt share.
 * Một phần: capture rồi crop vùng kéo.
 */

export function isScreenCaptureSupported() {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getDisplayMedia;
}

function screenshotFileName(suffix = '') {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `screenshot${suffix ? `-${suffix}` : ''}-${stamp}.png`;
}

export function stopMediaStream(stream) {
  try {
    stream?.getTracks?.().forEach((t) => {
      try { t.stop(); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

function canvasFromBitmap(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas không khả dụng');
  ctx.drawImage(bitmap, 0, 0);
  if (typeof bitmap.close === 'function') bitmap.close();
  return canvas;
}

/** Lấy 1 frame ngay khi track đã live (ImageCapture ưu tiên). */
async function grabCanvasFromTrack(track, stream) {
  // 1) ImageCapture — nhanh, đúng surface user vừa chọn
  if (typeof ImageCapture !== 'undefined') {
    try {
      const ic = new ImageCapture(track);
      // Một số browser cần track unmuted
      if (track.readyState === 'live') {
        const bitmap = await ic.grabFrame();
        return canvasFromBitmap(bitmap);
      }
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout unmute')), 4000);
        const done = () => { clearTimeout(t); resolve(); };
        track.addEventListener('unmute', done, { once: true });
        if (!track.muted) done();
      }).catch(() => {});
      const bitmap = await ic.grabFrame();
      return canvasFromBitmap(bitmap);
    } catch {
      /* fallback video */
    }
  }

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  try {
    await video.play();
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout chờ khung hình')), 6000);
      const tick = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearTimeout(t);
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      video.onloadeddata = () => tick();
      video.onloadedmetadata = () => tick();
      tick();
    });
    await new Promise((r) => requestAnimationFrame(r));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas không khả dụng');
    ctx.drawImage(video, 0, 0);
    return canvas;
  } finally {
    video.srcObject = null;
    try { video.pause(); } catch { /* ignore */ }
  }
}

async function requestDisplayStream({ preferMonitor = false } = {}) {
  const attempts = [];
  if (preferMonitor) {
    attempts.push({
      video: { displaySurface: 'monitor', frameRate: { ideal: 5, max: 15 } },
      audio: false,
    });
  }
  attempts.push({
    video: { frameRate: { ideal: 5, max: 15 } },
    audio: false,
  });
  attempts.push({ video: true, audio: false });

  let lastErr;
  for (const opts of attempts) {
    try {
      return await navigator.mediaDevices.getDisplayMedia(opts);
    } catch (e) {
      lastErr = e;
      // User cancel — không thử tiếp
      if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') throw e;
    }
  }
  throw lastErr || new Error('Không chụp được màn hình');
}

/**
 * Mở picker trình duyệt — user chọn màn/cửa sổ nào thì chụp đúng surface đó ngay.
 * @returns {Promise<{ canvas: HTMLCanvasElement, width: number, height: number }>}
 */
export async function captureDisplayFrame(options = {}) {
  if (!isScreenCaptureSupported()) {
    const err = new Error('Trình duyệt không hỗ trợ chụp màn hình');
    err.code = 'SCREEN_CAPTURE_UNSUPPORTED';
    throw err;
  }

  let stream;
  try {
    stream = await requestDisplayStream({ preferMonitor: options.preferMonitor !== false });
  } catch (e) {
    const err = new Error(
      e?.name === 'NotAllowedError' || e?.name === 'AbortError'
        ? 'Bạn đã hủy hoặc không cho phép chia sẻ màn hình'
        : (e?.message || 'Không chụp được màn hình'),
    );
    err.code = (e?.name === 'NotAllowedError' || e?.name === 'AbortError')
      ? 'SCREEN_CAPTURE_DENIED'
      : 'SCREEN_CAPTURE_FAILED';
    err.cause = e;
    throw err;
  }

  const track = stream.getVideoTracks()?.[0];
  if (!track) {
    stopMediaStream(stream);
    const err = new Error('Không lấy được hình từ màn hình');
    err.code = 'SCREEN_CAPTURE_FAILED';
    throw err;
  }

  // Khi user đổi / dừng share giữa chừng
  const onEnded = () => {};
  track.addEventListener('ended', onEnded);

  try {
    const canvas = await grabCanvasFromTrack(track, stream);
    return {
      canvas,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (e) {
    const err = new Error(e?.message || 'Không chụp được khung hình');
    err.code = 'SCREEN_CAPTURE_FAILED';
    err.cause = e;
    throw err;
  } finally {
    track.removeEventListener('ended', onEnded);
    stopMediaStream(stream);
  }
}

export function canvasToPngFile(canvas, name) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Không tạo được ảnh PNG'));
        return;
      }
      resolve(new File([blob], name || screenshotFileName(), { type: 'image/png' }));
    }, 'image/png');
  });
}

/**
 * Chụp toàn bộ bề mặt user vừa chọn trong picker (màn A / màn B / cửa sổ).
 * Chọn xong → chụp luôn, không bước phụ.
 */
export async function captureFullScreenFile() {
  const { canvas } = await captureDisplayFrame({ preferMonitor: true });
  return canvasToPngFile(canvas, screenshotFileName('full'));
}

/**
 * Crop canvas theo vùng pixel gốc.
 * @param {{ x: number, y: number, w: number, h: number }} region
 */
export async function cropCanvasToPngFile(sourceCanvas, region) {
  const x = Math.max(0, Math.round(region.x));
  const y = Math.max(0, Math.round(region.y));
  const w = Math.max(1, Math.round(region.w));
  const h = Math.max(1, Math.round(region.h));
  const maxW = sourceCanvas.width - x;
  const maxH = sourceCanvas.height - y;
  const cw = Math.min(w, maxW);
  const ch = Math.min(h, maxH);
  if (cw < 2 || ch < 2) {
    const err = new Error('Vùng chọn quá nhỏ');
    err.code = 'SCREEN_CAPTURE_REGION_TOO_SMALL';
    throw err;
  }
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const ctx = out.getContext('2d');
  ctx.drawImage(sourceCanvas, x, y, cw, ch, 0, 0, cw, ch);
  return canvasToPngFile(out, screenshotFileName('region'));
}
