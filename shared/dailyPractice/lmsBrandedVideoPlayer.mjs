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
  fs: 0,
  playsinline: 1,
  enablejsapi: 1,
};

/** Crop iframe để tiêu đề YouTube (góc trên, hiện khi tạm dừng) nằm ngoài khung. */
export const YT_IFRAME_CROP = {
  scale: 1.24,
  sizePercent: 132,
  translateYPercent: -54,
  webSizePercent: 130,
  webTranslateYPercent: -60.5,
  topVeilPx: 72,
  nativeTopMaskPx: 68,
  bottomVeilHeightPx: 44,
  bottomVeilWidthPx: 148,
  nativeBottomMaskPx: 40,
  nativeBottomMaskWidthPx: 152,
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
