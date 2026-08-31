const VOLUME_KEY = 'lms_player_volume';
const MUTED_KEY = 'lms_player_muted';

export function readLmsVolume(defaultVolume = 80) {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  } catch { /* ignore */ }
  return defaultVolume;
}

export function readLmsMuted(defaultMuted = false) {
  try {
    const raw = localStorage.getItem(MUTED_KEY);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch { /* ignore */ }
  return defaultMuted;
}

export function writeLmsVolume(volume) {
  try {
    const n = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
    localStorage.setItem(VOLUME_KEY, String(n));
  } catch { /* ignore */ }
}

export function writeLmsMuted(muted) {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch { /* ignore */ }
}

/** Áp volume/mute đã lưu lên YouTube player (không reset về 100). */
export function applyLmsVolumeToPlayer(player, volume, muted) {
  if (!player) return;
  try {
    const v = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
    player.setVolume?.(v);
    if (muted || v === 0) player.mute?.();
    else player.unMute?.();
  } catch { /* ignore */ }
}
