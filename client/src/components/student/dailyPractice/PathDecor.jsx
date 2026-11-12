import { Cpu, Monitor } from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import Mascot from './Mascot';

/** Giọt nước Thắng Tin Học - mốc nối / trang trí. */
export function DropletMark({ size = 14, fill = '#EF4444', className = '', style }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 24 28" className={className} style={style} aria-hidden="true">
      <path
        d="M12 2 C12 2 4 13 4 18 a8 8 0 0 0 16 0 C20 13 12 2 12 2 Z"
        fill={fill}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.2"
      />
      <ellipse cx="9" cy="14" rx="2.5" ry="3.5" fill="rgba(255,255,255,0.6)" transform="rotate(-18 9 14)" />
    </svg>
  );
}

/** Số chặng trong giọt nước 3D. */
export function StageDropletBadge({ index, locked, accentTo, baseShadow }) {
  if (locked) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-400/90 ring-2 ring-white">
        <DropletMark size={26} fill="#475569" />
      </div>
    );
  }
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center"
      style={{ filter: `drop-shadow(0 4px 0 ${baseShadow})` }}
    >
      <DropletMark size={46} fill={accentTo} className="absolute inset-0 m-auto" />
      <span className="relative mt-1 text-sm font-black text-white drop-shadow-sm">{index}</span>
    </div>
  );
}

/**
 * Bản đồ Hành trình Học tập Việt Nam (Bắc - Trung - Nam + Quần đảo Hoàng Sa & Trường Sa):
 * - Khu vực đã mở khóa / hoàn thành chuyển màu xanh lá thương hiệu DewSkill (#10B981).
 * - Khu vực chưa hoàn thành sử dụng màu xám nhẹ (#CBD5E1).
 * - Hiển thị chìm tinh tế phía sau để nút bài học luôn nổi bật rõ ràng phía trên.
 */
export function VietnamLearningMap({ completedUnits = 0, totalUnits = 1, className = '' }) {
  const safeTotal = Math.max(1, Number(totalUnits) || 1);
  const ratio = Math.max(0, Math.min(1, (Number(completedUnits) || 0) / safeTotal));
  // Mở khóa lần lượt từ Bắc -> Trung -> Nam theo tiến độ thực tế
  const northUnlocked = true;
  const centralUnlocked = ratio >= 0.34 || completedUnits >= 1;
  const southUnlocked = ratio >= 0.68 || (totalUnits > 0 && completedUnits >= totalUnits);

  const unlockedFill = '#10B981';
  const unlockedStroke = '#059669';
  const lockedFill = '#CBD5E1';
  const lockedStroke = '#94A3B8';

  return (
    <svg
      viewBox="0 0 260 540"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
      data-vietnam-learning-map="true"
    >
      {/* Đường hành trình xuyên Việt nối 3 miền */}
      <path
        d="M112 68 C126 140, 148 210, 162 280 C174 340, 152 410, 118 468"
        fill="none"
        stroke={southUnlocked ? '#10B981' : centralUnlocked ? '#34D399' : '#CBD5E1'}
        strokeWidth="3"
        strokeDasharray="6 6"
        opacity="0.55"
      />

      {/* Miền Bắc */}
      <g data-vn-region="north" data-region-state={northUnlocked ? 'unlocked' : 'locked'}>
        <path
          d="M72 42 C96 28, 134 32, 152 52 C164 68, 158 96, 142 114 C130 128, 128 148, 136 164 L108 172 C96 150, 82 128, 68 104 C56 82, 58 54, 72 42 Z"
          fill={northUnlocked ? unlockedFill : lockedFill}
          stroke={northUnlocked ? unlockedStroke : lockedStroke}
          strokeWidth="2"
          opacity={northUnlocked ? '0.22' : '0.18'}
        />
        <circle cx="114" cy="84" r="5" fill={northUnlocked ? '#059669' : '#94A3B8'} opacity="0.45" />
      </g>

      {/* Miền Trung */}
      <g data-vn-region="central" data-region-state={centralUnlocked ? 'unlocked' : 'locked'}>
        <path
          d="M108 172 L136 164 C154 198, 176 238, 184 284 C190 318, 182 352, 166 376 L138 364 C152 336, 156 302, 148 268 C138 232, 122 202, 108 172 Z"
          fill={centralUnlocked ? unlockedFill : lockedFill}
          stroke={centralUnlocked ? unlockedStroke : lockedStroke}
          strokeWidth="2"
          opacity={centralUnlocked ? '0.22' : '0.18'}
        />
        <circle cx="158" cy="272" r="5" fill={centralUnlocked ? '#059669' : '#94A3B8'} opacity="0.45" />
      </g>

      {/* Miền Nam */}
      <g data-vn-region="south" data-region-state={southUnlocked ? 'unlocked' : 'locked'}>
        <path
          d="M138 364 L166 376 C158 412, 142 448, 118 482 C102 502, 82 496, 78 474 C74 446, 92 418, 112 396 C124 384, 132 374, 138 364 Z"
          fill={southUnlocked ? unlockedFill : lockedFill}
          stroke={southUnlocked ? unlockedStroke : lockedStroke}
          strokeWidth="2"
          opacity={southUnlocked ? '0.22' : '0.18'}
        />
        <circle cx="118" cy="442" r="5" fill={southUnlocked ? '#059669' : '#94A3B8'} opacity="0.45" />
      </g>

      {/* Quần đảo Hoàng Sa */}
      <g data-vn-archipelago="hoang-sa" opacity="0.38">
        <circle cx="216" cy="218" r="4" fill={centralUnlocked ? unlockedFill : lockedFill} />
        <circle cx="226" cy="224" r="3" fill={centralUnlocked ? unlockedFill : lockedFill} />
        <circle cx="210" cy="228" r="2.5" fill={centralUnlocked ? unlockedFill : lockedFill} />
        <text x="190" y="244" fontSize="8" fontWeight="800" fill={centralUnlocked ? '#047857' : '#64748B'}>
          Hoàng Sa
        </text>
      </g>

      {/* Quần đảo Trường Sa */}
      <g data-vn-archipelago="truong-sa" opacity="0.38">
        <circle cx="218" cy="406" r="4" fill={southUnlocked ? unlockedFill : lockedFill} />
        <circle cx="228" cy="414" r="3" fill={southUnlocked ? unlockedFill : lockedFill} />
        <circle cx="210" cy="418" r="2.8" fill={southUnlocked ? unlockedFill : lockedFill} />
        <text x="188" y="434" fontSize="8" fontWeight="800" fill={southUnlocked ? '#047857' : '#64748B'}>
          Trường Sa
        </text>
      </g>
    </svg>
  );
}

/** Nền lộ trình: bản đồ hành trình Việt Nam + giọt nước DewSkill + gợi tin học (màn hình, chip). */
export function PathITBackdrop({ accentSoft = '#ECFDF5', completedUnits = 0, totalUnits = 1 }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-90"
        style={{ background: `linear-gradient(165deg, ${accentSoft} 0%, #FFFFFF 45%, #F8FAFC 100%)` }}
      />
      {/* Bản đồ Việt Nam tinh tế phía sau hành trình học tập */}
      <VietnamLearningMap
        completedUnits={completedUnits}
        totalUnits={totalUnits}
        className="absolute left-1/2 top-6 h-[92%] w-auto max-w-[85%] -translate-x-1/2 opacity-80"
      />
      <span className="cms-goal-droplet left-[6%] top-10 h-7 w-7 opacity-90" />
      <span className="cms-goal-droplet cms-goal-droplet--amber right-[8%] top-24 h-4 w-4 [animation-delay:1.2s]" />
      <span className="cms-goal-droplet left-[12%] bottom-16 h-5 w-5 [animation-delay:2.4s]" />
      <span className="cms-goal-droplet cms-goal-droplet--amber -right-1 bottom-8 h-9 w-9 [animation-delay:0.6s]" />
      <Monitor className="absolute -right-2 top-[18%] h-[88px] w-[88px] text-emerald-300/30" strokeWidth={1.2} />
      <Cpu className="absolute -left-1 bottom-[12%] h-[72px] w-[72px] text-teal-200/35" strokeWidth={1.2} />
    </div>
  );
}

/** Linh vật đứng cạnh nút «Bắt đầu» - lệch về phía đối diện đường cong. */
export function PathMascotBuddy({ side = 'left', mood = 'idle', size = 62 }) {
  const pos = side === 'left' ? '-left-[5.25rem] sm:-left-[6rem]' : '-right-[5.25rem] sm:-right-[6rem]';
  return (
    <div className={`pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 scale-90 sm:scale-100 ${pos}`} aria-hidden="true">
      <Mascot mood={mood} size={size} />
    </div>
  );
}

/** Ảnh minh họa chặng (admin) hoặc linh vật cảm xúc - cạnh nút đang học. */
export function PathStageArt({ side = 'left', imageUrl = '', mood = 'determinedSoft', size = 72 }) {
  const pos = side === 'left' ? '-left-[5.5rem] sm:-left-[6.5rem]' : '-right-[5.5rem] sm:-right-[6.5rem]';
  if (imageUrl) {
    return (
      <div className={`pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 ${pos}`} aria-hidden="true">
        <img
          src={resolveMediaUrl(imageUrl) || imageUrl}
          alt=""
          width={size}
          height={size}
          className="dp-float object-contain drop-shadow-md"
          style={{ width: size, height: size }}
          draggable={false}
        />
      </div>
    );
  }
  return <PathMascotBuddy side={side} mood={mood} size={Math.min(size, 62)} />;
}
