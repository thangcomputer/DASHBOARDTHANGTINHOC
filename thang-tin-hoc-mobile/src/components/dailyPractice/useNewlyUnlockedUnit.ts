import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UNLOCK_SEEN_KEY = 'dp_unlocked_units_seen_v1';

async function readSeenUnlockedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCK_SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

async function writeSeenUnlockedIds(set: Set<string>) {
  try {
    await AsyncStorage.setItem(UNLOCK_SEEN_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

type UnlockableUnit = { id: string; state?: string };

/** Phát hiện chặng mới vừa mở khóa từ dữ liệu lộ trình. */
export function useNewlyUnlockedUnit(units: UnlockableUnit[] = []) {
  const [newlyUnlockedId, setNewlyUnlockedId] = useState<string | null>(null);

  useEffect(() => {
    if (!units.length) return undefined;
    let cancelled = false;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const seen = await readSeenUnlockedIds();
      if (cancelled) return;
      const unlocked = units.filter((u) => u && u.state !== 'locked').map((u) => String(u.id));

      if (seen.size === 0) {
        unlocked.forEach((id) => seen.add(id));
        await writeSeenUnlockedIds(seen);
        return;
      }

      const freshId = unlocked.find((id) => !seen.has(id));
      if (!freshId) return;

      unlocked.forEach((id) => seen.add(id));
      await writeSeenUnlockedIds(seen);
      if (cancelled) return;
      setNewlyUnlockedId(freshId);
      clearTimer = setTimeout(() => setNewlyUnlockedId(null), 2000);
    })();

    return () => {
      cancelled = true;
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [units]);

  return newlyUnlockedId;
}
