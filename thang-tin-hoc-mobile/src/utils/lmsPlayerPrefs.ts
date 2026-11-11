import AsyncStorage from '@react-native-async-storage/async-storage';

const VOLUME_KEY = 'lms_player_volume_v2';
const MUTED_KEY = 'lms_player_muted_v2';

export async function readLmsVolume(defaultVolume = 50) {
  try {
    const raw = await AsyncStorage.getItem(VOLUME_KEY);
    if (raw !== null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
    }
  } catch { /* ignore */ }
  return defaultVolume;
}

export async function readLmsMuted(defaultMuted = false) {
  try {
    const raw = await AsyncStorage.getItem(MUTED_KEY);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch { /* ignore */ }
  return defaultMuted;
}

export async function writeLmsVolume(volume: number) {
  try {
    const n = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
    await AsyncStorage.setItem(VOLUME_KEY, String(n));
  } catch { /* ignore */ }
}

export async function writeLmsMuted(muted: boolean) {
  try {
    await AsyncStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch { /* ignore */ }
}
