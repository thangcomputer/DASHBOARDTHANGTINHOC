/** Combo ×3 / ×5 — ưu tiên GIF (động); fallback WebP nếu GIF chưa có (web). */
export const COMBO_ART_GIF = {
  3: '/daily-practice/combo-x3.gif',
  5: '/daily-practice/combo-x5.gif',
};

export const COMBO_ART_WEBP_FALLBACK = {
  3: '/daily-practice/combo-x3.webp',
  5: '/daily-practice/combo-x5.webp',
};

export function comboArtGifSrc(tier) {
  return COMBO_ART_GIF[tier] || COMBO_ART_GIF[3];
}

export function comboArtWebpFallback(tier) {
  return COMBO_ART_WEBP_FALLBACK[tier] || COMBO_ART_WEBP_FALLBACK[3];
}
