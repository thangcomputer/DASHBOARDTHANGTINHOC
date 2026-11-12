import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Star, Zap } from 'lucide-react';
import { GameSoundManager } from '../../../utils/sound';
import { DEWSKILL_ANIMATION, useAnimatedNumber, useReducedMotion } from './animationConstants';

const rewardedKeyMemory = new Set();

function hasClaimedRewardKey(rewardKey) {
  if (!rewardKey) return false;
  if (rewardedKeyMemory.has(rewardKey)) return true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(`dp_xp_reward_seen:${rewardKey}`) === '1';
    }
  } catch {
    /* ignore storage error */
  }
  return false;
}

function markClaimedRewardKey(rewardKey) {
  if (!rewardKey) return;
  rewardedKeyMemory.add(rewardKey);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`dp_xp_reward_seen:${rewardKey}`, '1');
    }
  } catch {
    /* ignore storage error */
  }
}

const STAR_TRAJECTORIES = [
  { id: 0, dx: '-42px', dy: '-54px', delay: '0ms', scale: 0.95 },
  { id: 1, dx: '38px', dy: '-62px', delay: '65ms', scale: 1.1 },
  { id: 2, dx: '-18px', dy: '-74px', delay: '120ms', scale: 0.85 },
  { id: 3, dx: '52px', dy: '-44px', delay: '160ms', scale: 1.0 },
  { id: 4, dx: '6px', dy: '-82px', delay: '90ms', scale: 1.15 },
];

/**
 * XPRewardAnimation - Hiệu ứng thưởng XP xác nhận từ Backend:
 * - Chỉ hiển thị khi xpAmount > 0 đã được hệ thống xác nhận.
 * - Hiện số +XP bay lên kèm các hạt sao vàng di chuyển nhẹ về thanh XP.
 * - Chống kích hoạt trùng lặp khi bấm liên tục, gửi lại request hoặc tải lại trang thông qua rewardKey.
 */
export default function XPRewardAnimation({
  xpAmount = 0,
  rewardKey = '',
  playSound = true,
  className = '',
}) {
  const reducedMotion = useReducedMotion();
  const numericXp = Number(xpAmount) || 0;
  const [visible, setVisible] = useState(false);
  const animatedXp = useAnimatedNumber(numericXp, DEWSKILL_ANIMATION.XP_FLOAT_MS, visible && numericXp > 0);

  useEffect(() => {
    if (numericXp <= 0) {
      setVisible(false);
      return undefined;
    }

    if (rewardKey && hasClaimedRewardKey(rewardKey)) {
      return undefined;
    }

    if (rewardKey) {
      markClaimedRewardKey(rewardKey);
    }

    setVisible(true);
    if (playSound) {
      GameSoundManager.xp();
    }

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, DEWSKILL_ANIMATION.XP_FLOAT_MS + 350);

    return () => window.clearTimeout(timer);
  }, [numericXp, rewardKey, playSound]);

  const stars = useMemo(() => STAR_TRAJECTORIES, []);

  if (!visible || numericXp <= 0) return null;

  return (
    <div
      className={`pointer-events-none relative inline-flex items-center justify-center ${className}`}
      data-xp-reward={numericXp}
      aria-live="polite"
    >
      {/* Các hạt sao vàng bay nhẹ về khu vực thanh XP */}
      {!reducedMotion && stars.map((star) => (
        <span
          key={star.id}
          className="dp-xp-star-particle absolute inline-flex items-center justify-center text-amber-400"
          style={{
            '--star-dx': star.dx,
            '--star-dy': star.dy,
            '--star-scale': star.scale,
            animationDelay: star.delay,
          }}
          aria-hidden="true"
        >
          <Star size={14} className="fill-amber-400 text-amber-500 drop-shadow-xs" />
        </span>
      ))}

      {/* Huy hiệu +XP bay lên */}
      <span className="dp-xp-reward-badge inline-flex items-center gap-1 rounded-full border border-amber-300 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-3 py-1 text-xs font-black tracking-wide text-amber-950 shadow-[0_6px_18px_rgba(245,158,11,0.38)] ring-2 ring-white">
        <Zap size={13} className="fill-white text-white" aria-hidden="true" />
        <span>+{animatedXp} XP</span>
        <Sparkles size={12} className="text-amber-950" aria-hidden="true" />
      </span>
    </div>
  );
}

/**
 * Hiển thị tổng XP với hiệu ứng chuyển số mượt mà khi XP thay đổi.
 */
export function AnimatedXpCounter({
  value = 0,
  duration = DEWSKILL_ANIMATION.XP_FLOAT_MS,
  formatLocale = false,
  className = '',
}) {
  const animated = useAnimatedNumber(value, duration, true);
  const text = formatLocale ? animated.toLocaleString('vi-VN') : String(animated);
  return (
    <span className={`tabular-nums ${className}`} data-xp-counter={value}>
      {text}
    </span>
  );
}
