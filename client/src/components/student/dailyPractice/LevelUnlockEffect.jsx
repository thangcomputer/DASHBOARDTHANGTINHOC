import { useEffect, useState } from 'react';
import { LockOpen, Sparkles, Unlock } from 'lucide-react';
import { GameSoundManager } from '../../../utils/sound';
import MascotEmotion from './MascotEmotion';
import { DEWSKILL_ANIMATION } from './animationConstants';

const UNLOCK_SEEN_KEY = 'dp_unlocked_units_seen_v1';

function readSeenUnlockedIds() {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(UNLOCK_SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function writeSeenUnlockedIds(set) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(UNLOCK_SEEN_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/**
 * Hook phát hiện chặng mới vừa được mở khóa tự động từ dữ liệu lộ trình thực tế.
 */
export function useNewlyUnlockedUnit(units = []) {
  const [newlyUnlockedId, setNewlyUnlockedId] = useState(null);

  useEffect(() => {
    if (!Array.isArray(units) || !units.length) return undefined;
    const seen = readSeenUnlockedIds();
    const currentlyUnlocked = units.filter((u) => u && u.state !== 'locked').map((u) => u.id);

    // Lần đầu tiên khởi tạo: ghi nhận các chặng đã mở sẵn mà không bắn hiệu ứng giả
    if (seen.size === 0) {
      currentlyUnlocked.forEach((id) => seen.add(id));
      writeSeenUnlockedIds(seen);
      return undefined;
    }

    const freshId = currentlyUnlocked.find((id) => !seen.has(id));
    if (freshId) {
      currentlyUnlocked.forEach((id) => seen.add(id));
      writeSeenUnlockedIds(seen);
      setNewlyUnlockedId(freshId);
      GameSoundManager.unlock();
      const timer = window.setTimeout(() => {
        setNewlyUnlockedId(null);
      }, DEWSKILL_ANIMATION.UNLOCK_MS + 900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [units]);

  return newlyUnlockedId;
}

/**
 * LevelUnlockEffect - Hiệu ứng mở khóa chặng mới:
 * - Biểu tượng khóa biến mất (fade + scale out)
 * - Nút/chặng mới xuất hiện với hiệu ứng scale và ánh sáng
 * - Đường nối tới chặng tiếp theo sáng lên
 * - Mascot hiển thị trạng thái ăn mừng (unlocked)
 */
export default function LevelUnlockEffect({
  unlockedUnit = null,
  active = false,
  className = '',
}) {
  if (!unlockedUnit && !active) return null;

  return (
    <div
      data-level-unlock="true"
      className={`dp-unlock-banner relative overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/70 px-4 py-3 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.35)] ${className}`}
    >
      {/* Ánh sáng lan tỏa */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-300/30 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3.5">
        {/* Biểu tượng khóa biến mất & thay bằng mở khóa phát sáng */}
        <div className="dp-unlock-icon-pop relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_4px_0_#047857] ring-2 ring-emerald-200">
          <LockOpen size={22} strokeWidth={2.5} aria-hidden="true" />
          <Sparkles
            size={14}
            className="dp-twinkle absolute -right-1.5 -top-1.5 fill-amber-300 text-amber-500"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
            <Unlock size={11} aria-hidden="true" /> Mở khóa chặng mới
          </span>
          <p className="mt-0.5 truncate text-sm font-black text-slate-900">
            {unlockedUnit?.index ? `Chặng ${unlockedUnit.index}: ` : ''}
            {unlockedUnit?.title || 'Chặng tiếp theo đã sẵn sàng!'}
          </p>
          <p className="text-xs font-semibold text-emerald-700">
            Đường dẫn tới chặng mới đã bừng sáng — tiếp tục chinh phục nhé!
          </p>
        </div>

        <div className="shrink-0">
          <MascotEmotion emotion="unlocked" size={56} />
        </div>
      </div>
    </div>
  );
}

