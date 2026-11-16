/** Combo ×3 / ×5 — ảnh PNG tại client/public/daily-practice/. */
export const COMBO_ART_GIF = {
  3: '/daily-practice/combo-x3.png',
  5: '/daily-practice/combo-x5.png',
};

export const COMBO_ART_WEBP_FALLBACK = {
  3: '/daily-practice/combo-x3.png',
  5: '/daily-practice/combo-x5.png',
};

export function comboArtGifSrc(tier) {
  return COMBO_ART_GIF[tier] || COMBO_ART_GIF[3];
}

export function comboArtWebpFallback(tier) {
  return COMBO_ART_WEBP_FALLBACK[tier] || COMBO_ART_WEBP_FALLBACK[3];
}
