/**
 * Chuẩn trình phát LMS branded (web: StudentVideoPlayer + LmsBrandedPlayerChrome;
 * mobile: VideoPlayerFrame WebView + MobileLmsPlayerChrome).
 */

/** playerVars khi brandedChrome / controls tắt (không gồm autoplay, origin, start). */
export const YT_BRANDED_PLAYER_VARS = {
  controls: 0,
  disablekb: 1,
  rel: 0,
  modestbranding: 1,
  iv_load_policy: 3,
  cc_load_policy: 0,
  cc_lang_pref: '',
  fs: 0,
  playsinline: 1,
  enablejsapi: 1,
};

/** Khung iframe YouTube ở kích thước gốc (100%, không zoom/crop). */
export const YT_IFRAME_CROP = {
  scale: 1,
  sizePercent: 100,
  translateYPercent: -50,
  webSizePercent: 100,
  webTranslateYPercent: -50,
  topVeilPx: 0,
  nativeTopMaskPx: 0,
  bottomVeilHeightPx: 0,
  bottomVeilWidthPx: 0,
  nativeBottomMaskPx: 0,
  nativeBottomMaskWidthPx: 0,
  veilGradient: 'linear-gradient(180deg,var(--yt-chrome-bg) 0%,var(--yt-chrome-bg) 78%,rgba(0,0,0,0) 100%)',
  playerBg: '#080D19',
};

/** PathVideoModal — token màu / nền (web + mobile). */
export const PATH_VIDEO_MODAL_LAYOUT = {
  backdrop: 'rgba(255, 255, 255, 0.42)',
  cardBg: '#1C1F26',
  headerBg: '#16181E',
  videoAreaBg: '#23262E',
  headerBorder: 'rgba(255,255,255,0.05)',
};

export function buildYtBrandedPlayerVars({ origin, start = 0 }) {
  return {
    ...YT_BRANDED_PLAYER_VARS,
    origin: String(origin || ''),
    start: Math.max(0, Math.floor(Number(start) || 0)),
  };
}

export function buildYtMobilePlayerVars(brandedChrome, origin, startAt) {
  const base = {
    ...YT_BRANDED_PLAYER_VARS,
    autoplay: brandedChrome ? 0 : 1,
    origin,
    start: Math.floor(startAt),
  };
  if (!brandedChrome) {
    return { ...base, controls: 1, disablekb: 0, fs: 1 };
  }
  return base;
}

/** Tắt phụ đề (captions/cc) qua YouTube IFrame API kể cả khi người dùng bật sẵn. */
export function disableYouTubeCaptions(player) {
  if (!player) return;
  try { player.unloadModule?.('captions'); } catch { /* ignore */ }
  try { player.unloadModule?.('cc'); } catch { /* ignore */ }
  try { player.setOption?.('captions', 'track', {}); } catch { /* ignore */ }
  try { player.setOption?.('cc', 'track', {}); } catch { /* ignore */ }
}
