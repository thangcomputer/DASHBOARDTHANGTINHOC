import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RELOAD_ABANDON_NOTICE_KEY = 'dp_reload_abandon_notice';
const NOTICE_TTL_MS = 120_000;

async function writeStorage(payload: string) {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(RELOAD_ABANDON_NOTICE_KEY, payload);
    return;
  }
  await AsyncStorage.setItem(RELOAD_ABANDON_NOTICE_KEY, payload);
}

async function readStorage(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    const raw = sessionStorage.getItem(RELOAD_ABANDON_NOTICE_KEY);
    if (raw) sessionStorage.removeItem(RELOAD_ABANDON_NOTICE_KEY);
    return raw;
  }
  const raw = await AsyncStorage.getItem(RELOAD_ABANDON_NOTICE_KEY);
  if (raw) await AsyncStorage.removeItem(RELOAD_ABANDON_NOTICE_KEY);
  return raw;
}

export async function writeReloadAbandonNotice(lostXp = 0) {
  const payload = JSON.stringify({ lostXp: Math.max(0, Number(lostXp) || 0), at: Date.now() });
  try {
    await writeStorage(payload);
  } catch {
    /* ignore */
  }
}

export async function readReloadAbandonNotice(): Promise<{ lostXp: number } | null> {
  try {
    const raw = await readStorage();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; lostXp?: number };
    if (!parsed || typeof parsed.at !== 'number' || Date.now() - parsed.at > NOTICE_TTL_MS) return null;
    return { lostXp: Math.max(0, Number(parsed.lostXp) || 0) };
  } catch {
    return null;
  }
}