export const RELOAD_ABANDON_NOTICE_KEY = 'dp_reload_abandon_notice';
const NOTICE_TTL_MS = 120_000;

export function writeReloadAbandonNotice(lostXp = 0) {
  try {
    sessionStorage.setItem(
      RELOAD_ABANDON_NOTICE_KEY,
      JSON.stringify({ lostXp: Math.max(0, Number(lostXp) || 0), at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function readReloadAbandonNotice() {
  try {
    const raw = sessionStorage.getItem(RELOAD_ABANDON_NOTICE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RELOAD_ABANDON_NOTICE_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.at !== 'number' || Date.now() - parsed.at > NOTICE_TTL_MS) return null;
    return { lostXp: Math.max(0, Number(parsed.lostXp) || 0) };
  } catch {
    return null;
  }
}