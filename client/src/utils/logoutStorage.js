/**
 * Đăng xuất xóa token, cache dữ liệu và nháp tin nhắn, nhưng giữ cài đặt thiết bị
 * để lần đăng nhập sau không phải cài lại (ghim menu, mã PIN, âm thanh...).
 * Mã PIN chỉ lưu dạng hash theo từng tài khoản (cms_pin_lock:<role>:<id>).
 */
const PRESERVED_KEYS = new Set([
  'cms_device_id_v1',
  'cms_sidebar_pinned',
  'cms_sidebar_groups',
  'thvp_muted',
  'lms_player_volume_v2',
  'lms_player_muted_v2',
  'cms_fm_win_size',
  'cms-news-view',
  'cms_screen_capture_guide_skip',
  'thvp_recent_chat_stickers_v1',
]);

const PRESERVED_PREFIXES = ['cms_login_alert', 'cms_pin_lock:'];

export function isPreservedPreferenceKey(key) {
  if (!key) return false;
  return PRESERVED_KEYS.has(key) || PRESERVED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function clearStorageKeepingPreferences() {
  const kept = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (isPreservedPreferenceKey(key)) kept[key] = localStorage.getItem(key);
    }
  } catch { /* ignore */ }
  try { localStorage.clear(); } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  Object.entries(kept).forEach(([key, value]) => {
    try {
      if (value != null) localStorage.setItem(key, value);
    } catch { /* ignore */ }
  });
}
