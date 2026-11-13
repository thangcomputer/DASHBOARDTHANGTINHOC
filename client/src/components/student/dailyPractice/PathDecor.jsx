import { useId } from 'react';
import { Cpu, Monitor } from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import Mascot from './Mascot';
import {
  VIETNAM_JOURNEY_SPINE,
  VIETNAM_MAINLAND_PATH,
  VIETNAM_MAP_VIEWBOX,
} from '../../../../../shared/dailyPractice/vietnamMapGeo.mjs';
import { VN_MAP_COLORS, bandPaint, vietnamMapBandStates } from '../../../../../shared/dailyPractice/vietnamMapModel.mjs';
import './pathDecorMap.css';

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

/** Đường hành trình học (tách khỏi ranh giới đất liền). */
export function LearningJourneyPath({ journeyLit = 0, className = '' }) {
  const lit = Math.max(0, Math.min(1, Number(journeyLit) || 0));
  const stroke = lit >= 0.68 ? VN_MAP_COLORS.journeyDone : lit > 0 ? VN_MAP_COLORS.journeyActive : VN_MAP_COLORS.journeyLocked;
  if (!VIETNAM_JOURNEY_SPINE) return null;
  return (
    <path
      d={VIETNAM_JOURNEY_SPINE}
      fill="none"
      className={`vn-journey-spine ${className}`}
      stroke={stroke}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="7 6"
      opacity={0.55}
    />
  );
}

/** Bản đồ Việt Nam đất liền (Natural Earth 110m) — nền mờ theo tiến độ Bắc→Nam. */
export function VietnamMapBackground({
  topicCompletedUnits = 0,
  topicTotalUnits = 1,
  unitIndex = 0,
  unitTotal = 1,
  unitState = 'locked',
  className = '',
  showSpine = true,
}) {
  const uid = useId().replace(/:/g, '');
  const model = vietnamMapBandStates({
    topicCompletedUnits,
    topicTotalUnits,
    unitIndex,
    unitTotal,
    unitState,
  });

  const bandDefs = [
    ['north', model.bands.north],
    ['central', model.bands.central],
    ['south', model.bands.south],
  ];

  return (
    <svg
      viewBox={VIETNAM_MAP_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={`vn-map-bg pointer-events-none select-none ${className}`}
      aria-hidden="true"
      data-vietnam-learning-map="true"
    >
      <defs>
        <linearGradient id={`vn-base-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#D1FAE5" />
          <stop offset="48%" stopColor="#A7F3D0" />
          <stop offset="100%" stopColor="#BAE6FD" />
        </linearGradient>
        <filter id={`vn-glow-${uid}`} x="-8%" y="-4%" width="116%" height="108%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {bandDefs.map(([key, box]) => (
          <clipPath key={key} id={`vn-clip-${uid}-${key}`}>
            <rect x="0" y={box.y0} width="220" height={box.y1 - box.y0} />
          </clipPath>
        ))}
      </defs>

      <path
        d={VIETNAM_MAINLAND_PATH}
        fill={`url(#vn-base-${uid})`}
        fillOpacity={0.55}
        stroke="#99F6E4"
        strokeOpacity={0.35}
        strokeWidth="0.8"
        filter={`url(#vn-glow-${uid})`}
      />

      {bandDefs.map(([key]) => {
        const paint = bandPaint(model[key]);
        return (
          <g key={key} clipPath={`url(#vn-clip-${uid}-${key})`} data-vn-region={key} data-region-state={model[key]}>
            <path
              d={VIETNAM_MAINLAND_PATH}
              fill={paint.fill}
              fillOpacity={paint.fillOpacity}
              stroke={paint.stroke}
              strokeOpacity={paint.strokeOpacity}
              strokeWidth="1.2"
            />
          </g>
        );
      })}

      {showSpine ? <LearningJourneyPath journeyLit={model.journeyLit} className="vn-journey-spine--soft" /> : null}
    </svg>
  );
}

/** @deprecated alias — dùng VietnamMapBackground */
export function VietnamLearningMap({ completedUnits = 0, totalUnits = 1, className = '' }) {
  return (
    <VietnamMapBackground
      topicCompletedUnits={completedUnits}
      topicTotalUnits={totalUnits}
      className={className}
    />
  );
}

/** Nền mỗi chặng: gradient mint + bản đồ + giọt nước trang trí. */
export function PathITBackdrop({
  accentSoft = '#ECFDF5',
  topicCompletedUnits = 0,
  topicTotalUnits = 1,
  unitIndex = 0,
  unitTotal = 1,
  unitState = 'locked',
  completedUnits,
  totalUnits,
  hideMap = false,
  fullBleed = false,
}) {
  const done = topicCompletedUnits ?? completedUnits ?? 0;
  const total = topicTotalUnits ?? totalUnits ?? 1;
  const plain = fullBleed || hideMap;
  const wash = plain
    ? '#F0F7FF'
    : `linear-gradient(168deg, ${accentSoft} 0%, #FFFFFF 52%, #F1F5F9 100%)`;
  return (
    <div
      className={`vn-stage-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden ${
        plain ? 'vn-stage-backdrop--full vn-stage-backdrop--plain' : 'rounded-[20px]'
      }`}
      aria-hidden="true"
    >
      <div className="vn-stage-backdrop__wash absolute inset-0" style={{ background: wash }} />
      {hideMap ? null : (
        <div className="vn-map-stage-frame">
          <VietnamMapBackground
            topicCompletedUnits={done}
            topicTotalUnits={total}
            unitIndex={unitIndex}
            unitTotal={unitTotal}
            unitState={unitState}
            className="vn-map-bg--stage"
          />
        </div>
      )}
      {plain ? null : (
        <>
          <span className="cms-goal-droplet vn-deco-droop left-[4%] top-[18%] h-5 w-5 opacity-70" />
          <span className="cms-goal-droplet cms-goal-droplet--amber vn-deco-droop right-[5%] top-[32%] h-4 w-4 opacity-65 [animation-delay:1.2s]" />
        </>
      )}
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
