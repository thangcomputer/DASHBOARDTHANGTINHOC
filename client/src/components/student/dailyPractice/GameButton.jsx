import { useEffect, useState } from 'react';
import { Check, Lock, Volume2, VolumeX } from 'lucide-react';
import { GameSoundManager, SOUND_MUTE_CHANGED_EVENT } from '../../../utils/sound';
import { DEWSKILL_ANIMATION } from './animationConstants';

const VARIANT_STYLES = {
  primary: {
    bg: 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border-emerald-600',
    shadow: '0 4px 0 #047857, 0 8px 18px -4px rgba(16, 185, 129, 0.35)',
    activeShadow: '0 1px 0 #047857',
  },
  completed: {
    bg: 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white border-emerald-600',
    shadow: '0 4px 0 #047857, 0 8px 16px -4px rgba(16, 185, 129, 0.3)',
    activeShadow: '0 1px 0 #047857',
  },
  active: {
    bg: 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-600 text-white border-emerald-500 dp-btn-active-glow',
    shadow: '0 5px 0 #047857, 0 0 20px rgba(16, 185, 129, 0.42)',
    activeShadow: '0 1px 0 #047857',
  },
  locked: {
    bg: 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed',
    shadow: '0 4px 0 #CBD5E1',
    activeShadow: '0 4px 0 #CBD5E1',
  },
  amber: {
    bg: 'bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 border-amber-500',
    shadow: '0 4px 0 #B45309, 0 8px 18px -4px rgba(245, 158, 11, 0.35)',
    activeShadow: '0 1px 0 #B45309',
  },
  danger: {
    bg: 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border-emerald-600',
    shadow: '0 4px 0 #B91C1C, 0 8px 18px -4px rgba(225, 29, 72, 0.3)',
    activeShadow: '0 1px 0 #B91C1C',
  },
  outline: {
    bg: 'bg-white text-slate-700 border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30',
    shadow: '0 4px 0 #CBD5E1',
    activeShadow: '0 1px 0 #CBD5E1',
  },
};

/**
 * GameButton - Nút bấm 3D chuẩn Game Hóa DewSkill:
 * - Chiều sâu 3D rõ nét
 * - Hover: phóng to rất nhẹ (scale 1.025) + bóng đổ
 * - Nhấn: lún xuống rồi bật trở lại mượt mà (180ms)
 * - Nút đang học (state="active"): phát sáng nhẹ
 * - Nút khóa (state="locked"): màu xám, khóa tương tác
 * - Nút đã hoàn thành (state="completed"): chuyển xanh lá, có dấu tích
 */
export default function GameButton({
  children,
  state = 'default',
  variant = 'primary',
  disabled = false,
  showStateIcon = false,
  playSoundOnClick = true,
  onClick,
  type = 'button',
  className = '',
  style,
  ...rest
}) {
  const isLocked = state === 'locked' || disabled;
  const isCompleted = state === 'completed';
  const isActiveLearning = state === 'active';

  const resolvedKey = state === 'locked'
    ? 'locked'
    : isCompleted
      ? 'completed'
      : isActiveLearning
        ? 'active'
        : (VARIANT_STYLES[variant] ? variant : 'primary');

  const preset = VARIANT_STYLES[resolvedKey] || VARIANT_STYLES.primary;

  const handleClick = (event) => {
    if (isLocked) return;
    if (playSoundOnClick) {
      GameSoundManager.click();
    }
    onClick?.(event);
  };

  return (
    <button
      type={type}
      disabled={isLocked}
      onClick={handleClick}
      data-game-btn-state={state}
      className={`dp-game-btn relative inline-flex select-none items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black tracking-wide ${preset.bg} ${
        !isLocked ? 'hover:scale-[1.025] active:translate-y-[3px]' : 'opacity-85'
      } ${className}`}
      style={{
        '--dp-btn-shadow': preset.shadow,
        '--dp-btn-active-shadow': preset.activeShadow,
        transition: `transform ${DEWSKILL_ANIMATION.BUTTON_MS}ms ${DEWSKILL_ANIMATION.EASE_SPRING}, box-shadow ${DEWSKILL_ANIMATION.BUTTON_MS}ms ease, filter ${DEWSKILL_ANIMATION.BUTTON_MS}ms ease`,
        ...style,
      }}
      {...rest}
    >
      {showStateIcon && isCompleted && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-white">
          <Check size={13} strokeWidth={3.2} aria-hidden="true" />
        </span>
      )}
      {showStateIcon && state === 'locked' && (
        <Lock size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

/**
 * Nút bật/tắt âm thanh hiệu ứng Game Hóa (mặc định tắt, lưu qua GameSoundManager).
 */
export function SoundToggleButton({ compact = false, className = '' }) {
  const [muted, setMuted] = useState(() => GameSoundManager.isMuted());

  useEffect(() => {
    const sync = () => setMuted(GameSoundManager.isMuted());
    window.addEventListener(SOUND_MUTE_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SOUND_MUTE_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const handleToggle = () => {
    const nextMuted = GameSoundManager.toggleMuted();
    setMuted(nextMuted);
    if (!nextMuted) {
      GameSoundManager.click();
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={muted ? 'Bật âm thanh hiệu ứng' : 'Tắt âm thanh hiệu ứng'}
      title={muted ? 'Âm thanh đang tắt · Bấm để bật âm thanh' : 'Âm thanh đang bật · Bấm để tắt âm thanh'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border transition !shadow-none ${
        muted
          ? 'border-slate-200 bg-slate-50/90 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700'
          : 'border-emerald-200 bg-emerald-50/90 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
      } ${compact ? 'h-10 w-10 p-0' : 'h-9 px-3 text-xs font-extrabold'} ${className}`}
    >
      {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      {!compact && <span>{muted ? 'Tắt tiếng' : 'Âm thanh'}</span>}
    </button>
  );
}

