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

/** Nền lộ trình: giọt nước + gợi tin học (màn hình, chip). */
export function PathITBackdrop({ accentSoft = '#EFF6FF' }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-90"
        style={{ background: `linear-gradient(165deg, ${accentSoft} 0%, #FFFFFF 45%, #F8FAFC 100%)` }}
      />
      <span className="cms-goal-droplet left-[6%] top-10 h-7 w-7 opacity-90" />
      <span className="cms-goal-droplet cms-goal-droplet--amber right-[8%] top-24 h-4 w-4 [animation-delay:1.2s]" />
      <span className="cms-goal-droplet left-[12%] bottom-16 h-5 w-5 [animation-delay:2.4s]" />
      <span className="cms-goal-droplet cms-goal-droplet--amber -right-1 bottom-8 h-9 w-9 [animation-delay:0.6s]" />
      <Monitor className="absolute -right-2 top-[18%] h-[88px] w-[88px] text-sky-300/35" strokeWidth={1.2} />
      <Cpu className="absolute -left-1 bottom-[12%] h-[72px] w-[72px] text-red-200/40" strokeWidth={1.2} />
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
