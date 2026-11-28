import { useId } from 'react';
import {
  BookOpen,
  Check,
  ClipboardCheck,
  Clock,
  Gift,
  GraduationCap,
  Lock,
  Trophy,
  User,
} from 'lucide-react';

export const DEFAULT_DEWDROP_STAGES = [
  { id: 1, label: 'Hoàn thành', progress: 100, status: 'completed', icon: 'user' },
  { id: 2, label: 'Đang học', progress: 70, status: 'active', icon: 'graduation' },
  { id: 3, label: 'Chưa mở', progress: 0, status: 'locked', icon: 'lock' },
  { id: 4, label: 'Vượt chặng', progress: 0, status: 'milestone', icon: 'trophy' },
];

const STAGE_THEMES = {
  completed: {
    baseStart: '#DCFCE7',
    baseEnd: '#86EFAC',
    liquidStart: '#22C55E',
    liquidEnd: '#059669',
    waveCrest: 'rgba(187, 247, 208, 0.85)',
    ringStroke: '#10B981',
    ringGlow: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.65))',
    ringHoverGlow: 'drop-shadow(0 0 14px rgba(16, 185, 129, 0.85))',
    dropShadow: 'drop-shadow(0 12px 20px rgba(16, 185, 129, 0.36))',
    badgeClass: 'bg-gradient-to-r from-[#22C55E] to-[#059669] shadow-[0_6px_14px_-3px_rgba(16,185,129,0.55)]',
    pillTextClass: 'text-emerald-900',
    pillAfterGlow: 'after:bg-emerald-400/70',
    pillActiveRing: 'ring-2 ring-emerald-400/80',
  },
  active: {
    baseStart: '#E0F2FE',
    baseEnd: '#7DD3FC',
    liquidStart: '#38BDF8',
    liquidEnd: '#2563EB',
    waveCrest: 'rgba(186, 230, 253, 0.9)',
    ringStroke: '#2563EB',
    ringGlow: 'drop-shadow(0 0 9px rgba(37, 99, 235, 0.65))',
    ringHoverGlow: 'drop-shadow(0 0 15px rgba(37, 99, 235, 0.85))',
    dropShadow: 'drop-shadow(0 12px 22px rgba(37, 99, 235, 0.36))',
    badgeClass: 'bg-gradient-to-r from-[#38BDF8] to-[#2563EB] shadow-[0_6px_14px_-3px_rgba(37,99,235,0.55)]',
    pillTextClass: 'text-blue-950',
    pillAfterGlow: 'after:bg-blue-500/65',
    pillActiveRing: 'ring-2 ring-blue-400/80',
  },
  locked: {
    baseStart: '#F1F5F9',
    baseEnd: '#94A3B8',
    liquidStart: '#CBD5E1',
    liquidEnd: '#64748B',
    waveCrest: 'rgba(241, 245, 249, 0.75)',
    ringStroke: 'rgba(148, 163, 184, 0.5)',
    ringGlow: 'none',
    ringHoverGlow: 'none',
    dropShadow: 'drop-shadow(0 10px 16px rgba(100, 116, 139, 0.24))',
    badgeClass: 'bg-gradient-to-r from-[#94A3B8] to-[#64748B] shadow-[0_6px_12px_-3px_rgba(100,116,139,0.45)]',
    pillTextClass: 'text-slate-600',
    pillAfterGlow: 'after:bg-slate-400/45',
    pillActiveRing: 'ring-2 ring-slate-300',
  },
  milestone: {
    baseStart: '#FDE68A',
    baseEnd: '#D97706',
    liquidStart: '#FBBF24',
    liquidEnd: '#B45309',
    waveCrest: 'rgba(254, 243, 199, 0.9)',
    ringStroke: '#F59E0B',
    ringGlow: 'drop-shadow(0 0 9px rgba(245, 158, 11, 0.62))',
    ringHoverGlow: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.85))',
    dropShadow: 'drop-shadow(0 12px 22px rgba(217, 119, 6, 0.38))',
    badgeClass: 'bg-gradient-to-r from-[#FBBF24] to-[#D97706] shadow-[0_6px_14px_-3px_rgba(217,119,6,0.55)]',
    pillTextClass: 'text-amber-950',
    pillAfterGlow: 'after:bg-amber-400/70',
    pillActiveRing: 'ring-2 ring-amber-400/80',
  },
};

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function MilestoneLaurelSVG() {
  return (
    <svg
      viewBox="0 0 144 96"
      className="pointer-events-none absolute -bottom-1.5 left-1/2 z-0 h-[92px] w-[142px] -translate-x-1/2 opacity-90"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dew-laurel-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <g fill="url(#dew-laurel-gold)">
        <ellipse cx="18" cy="48" rx="7" ry="2.8" transform="rotate(-38 18 48)" />
        <ellipse cx="22" cy="59" rx="7" ry="2.8" transform="rotate(-26 22 59)" />
        <ellipse cx="29" cy="69" rx="7" ry="2.8" transform="rotate(-14 29 69)" />
        <ellipse cx="38" cy="77" rx="7" ry="2.8" transform="rotate(-2 38 77)" />
        <ellipse cx="126" cy="48" rx="7" ry="2.8" transform="rotate(38 126 48)" />
        <ellipse cx="122" cy="59" rx="7" ry="2.8" transform="rotate(26 122 59)" />
        <ellipse cx="115" cy="69" rx="7" ry="2.8" transform="rotate(14 115 69)" />
        <ellipse cx="106" cy="77" rx="7" ry="2.8" transform="rotate(2 106 77)" />
      </g>
    </svg>
  );
}

function CenterDropIcon({ icon, status, compact = false }) {
  const resolvedIcon = icon || (
    status === 'completed'
      ? 'user'
      : status === 'milestone'
        ? 'trophy'
        : status === 'locked'
          ? 'lock'
          : 'graduation'
  );
  const cls = compact
    ? 'h-4 w-4 text-white drop-shadow-[0_1px_3px_rgba(15,23,42,0.35)]'
    : 'h-5 w-5 text-white drop-shadow-[0_1px_3px_rgba(15,23,42,0.35)]';
  if (resolvedIcon === 'user') return <User className={cls} strokeWidth={2.2} aria-hidden="true" />;
  if (resolvedIcon === 'trophy') return <Trophy className={cls} strokeWidth={2.2} aria-hidden="true" />;
  if (resolvedIcon === 'lock') return <Lock className={cls} strokeWidth={2.3} aria-hidden="true" />;
  if (resolvedIcon === 'clipboard') return <ClipboardCheck className={cls} strokeWidth={2.2} aria-hidden="true" />;
  return <GraduationCap className={cls} strokeWidth={2.2} aria-hidden="true" />;
}

function StatusPillIcon({ status }) {
  if (status === 'completed') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#22C55E] to-[#059669] text-white shadow-xs">
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (status === 'active') {
    return <BookOpen size={16} className="shrink-0 text-blue-600" strokeWidth={2.3} aria-hidden="true" />;
  }
  if (status === 'milestone') {
    return <Gift size={16} className="shrink-0 text-amber-600" strokeWidth={2.3} aria-hidden="true" />;
  }
  return <Clock size={16} className="shrink-0 text-slate-500" strokeWidth={2.2} aria-hidden="true" />;
}

const TEARDROP_PATH = 'M 64 14 C 64 14 102 50 102 75 C 102 96.5 85 112 64 112 C 43 112 26 96.5 26 75 C 26 50 64 14 64 14 Z';

function buildPeriodicWavePath(y, amp = 4.2, closeBottom = true) {
  const period = 64;
  const half = period / 2;
  const startX = -64;
  let d = `M ${startX} ${y.toFixed(1)}`;
  for (let i = 0; i < 4; i += 1) {
    const x0 = startX + i * period;
    const xMid = x0 + half;
    const xEnd = x0 + period;
    d += ` Q ${(x0 + half / 2).toFixed(1)} ${(y - amp).toFixed(1)}, ${xMid} ${y.toFixed(1)}`;
    d += ` Q ${(xMid + half / 2).toFixed(1)} ${(y + amp).toFixed(1)}, ${xEnd} ${y.toFixed(1)}`;
  }
  if (closeBottom) {
    d += ` L ${startX + 4 * period} 124 L ${startX} 124 Z`;
  }
  return d;
}

/** Nút Giọt Nước Pha Lê 3D có vòng tiến độ SVG, chất lỏng dâng theo % và pill phát sáng. */
export function DewdropNode({
  stage,
  isSelected = false,
  compact = false,
  anchorRef,
}) {
  const uid = useId().replace(/:/g, '');
  const status = stage?.status || 'locked';
  const theme = STAGE_THEMES[status] || STAGE_THEMES.locked;
  const pct = clampPercent(stage?.progress);
  const isLocked = status === 'locked';
  const isMilestone = status === 'milestone';

  const clipId = `teardropShape-${uid}`;
  const baseGradId = `dew-crystal-base-${uid}`;
  const liquidGradId = `dew-crystal-liquid-${uid}`;
  const glossGradId = `dew-crystal-gloss-${uid}`;
  const sheenGradId = `dew-crystal-sheen-${uid}`;

  const ringRadius = 56;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringFillPct = isMilestone && pct === 0 ? 100 : pct;
  const ringOffset = ringCircumference * (1 - ringFillPct / 100);

  // Mực chất lỏng dâng từ đáy lên đỉnh kèm sóng nước chuyển động
  const visualPct = isLocked
    ? 0
    : pct >= 100
      ? 100
      : pct > 0
        ? Math.max(12, Math.min(94, pct))
        : isMilestone
          ? 24
          : 16;

  const waveY = visualPct >= 100 ? 21 : Number((110 - (visualPct / 100) * 88).toFixed(1));
  const frontAmp = visualPct >= 100 ? 2.6 : 4.2;
  const backAmp = visualPct >= 100 ? 2.2 : 3.6;
  const backWavePath = buildPeriodicWavePath(waveY - 1.5, backAmp, true);
  const frontWavePath = buildPeriodicWavePath(waveY, frontAmp, true);
  const frontCrestPath = buildPeriodicWavePath(waveY, frontAmp, false);
  const bubbleStartY = Math.min(109, Math.max(waveY + 12, 92));
  const bubbleEndY = Math.max(26, waveY + 4);

  const handleActivate = () => {
    stage?.onClick?.(stage);
  };

  return (
    <div
      ref={isSelected ? anchorRef : undefined}
      data-path-hub=""
      data-node-state={stage?.nodeState || status}
      data-path-current={stage?.isCurrent ? '1' : undefined}
      className="relative z-10 flex w-full min-w-0 flex-col items-center"
    >
      <button
        type="button"
        onClick={handleActivate}
        aria-label={`${stage?.id} · ${stage?.label} · ${pct}%`}
        aria-expanded={isSelected}
        className={`group relative flex w-full min-w-0 flex-col items-center focus:outline-none ${
          isLocked
            ? 'cursor-not-allowed'
            : 'cursor-pointer transition-all duration-300 hover:-translate-y-1'
        }`}
      >
        {/* 1. Vòng tròn tiến độ SVG bao ngoài */}
        <div className={`relative flex items-center justify-center ${compact ? 'h-24 w-24 lg:h-28 lg:w-28' : 'h-28 w-28 md:h-32 md:w-32'}`}>
          {isMilestone ? <MilestoneLaurelSVG /> : null}

          <svg
            viewBox="0 0 128 128"
            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 transition-all duration-300"
            style={{ filter: theme.ringGlow }}
            aria-hidden="true"
          >
            <circle
              cx="64"
              cy="64"
              r={ringRadius}
              fill="rgba(255, 255, 255, 0.22)"
              stroke="rgba(255, 255, 255, 0.75)"
              strokeWidth="5"
            />
            {ringFillPct > 0 ? (
              <circle
                cx="64"
                cy="64"
                r={ringRadius}
                fill="none"
                stroke={theme.ringStroke}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            ) : null}
          </svg>

          {/* 2. Giọt Nước Pha Lê 3D ở tâm */}
          <svg
            viewBox="0 0 128 128"
            className={`pointer-events-none relative z-[1] transition-all duration-300 group-hover:brightness-105 ${compact ? 'h-20 w-20 lg:h-24 lg:w-24' : 'h-24 w-24 md:h-[106px] md:w-[106px]'}`}
            style={{ filter: theme.dropShadow }}
            aria-hidden="true"
          >
            <defs>
              <clipPath id={clipId}>
                <path d={TEARDROP_PATH} />
              </clipPath>
              <linearGradient id={baseGradId} x1="20%" y1="5%" x2="85%" y2="95%">
                <stop offset="0%" stopColor={theme.baseStart} stopOpacity={isMilestone ? 0.96 : 0.86} />
                <stop offset="100%" stopColor={theme.baseEnd} stopOpacity={isMilestone ? 0.98 : 0.78} />
              </linearGradient>
              <linearGradient id={liquidGradId} x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%" stopColor={theme.liquidStart} />
                <stop offset="100%" stopColor={theme.liquidEnd} />
              </linearGradient>
              <linearGradient id={glossGradId} x1="15%" y1="0%" x2="70%" y2="85%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
                <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={sheenGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.78" />
                <stop offset="56%" stopColor="#FFFFFF" stopOpacity="0.92" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g clipPath={`url(#${clipId})`}>
              {/* Nền kính pha lê mờ */}
              <rect x="20" y="10" width="88" height="106" fill={`url(#${baseGradId})`} />

              {/* Mặt cắt kim cương tinh tế & vệt lóe sáng chỉ xuất hiện khi rê chuột vào bước chưa mở */}
              {isLocked ? (
                <>
                  <path
                    d="M 64 14 L 46 62 L 64 112 M 64 14 L 82 62 L 64 112 M 26 75 L 46 62 L 82 62 L 102 75"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.26)"
                    strokeWidth="1.2"
                    className="transition-opacity duration-300 group-hover:opacity-90"
                  />
                  <polygon
                    points="10,-8 36,-8 8,124 -18,124"
                    fill={`url(#${sheenGradId})`}
                    className="dew-diamond-sheen"
                  />
                </>
              ) : null}

              {/* Lớp chất lỏng dâng & sóng nước chuyển động liên tục */}
              {!isLocked && visualPct > 0 ? (
                <>
                  {/* Sóng nền phía sau trôi sang trái */}
                  <g opacity="0.52">
                    <path d={backWavePath} fill={theme.liquidStart} />
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      from="0 0"
                      to="-64 0"
                      dur="3.8s"
                      repeatCount="indefinite"
                    />
                  </g>

                  {/* Sóng chính phía trước trôi sang phải + vệt sáng mặt nước */}
                  <g opacity="0.96">
                    <path d={frontWavePath} fill={`url(#${liquidGradId})`} />
                    <path d={frontCrestPath} fill="none" stroke={theme.waveCrest} strokeWidth="2.2" />
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      from="0 0"
                      to="64 0"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </g>

                  {/* 3 bọt khí li ti nổi nhẹ từ đáy lên mặt nước */}
                  {[
                    { cx: 48, r: 2.3, dur: '2.4s', begin: '0s' },
                    { cx: 66, r: 1.8, dur: '3.1s', begin: '0.8s' },
                    { cx: 78, r: 2.1, dur: '2.8s', begin: '1.5s' },
                  ].map((b) => (
                    <circle key={b.cx} cx={b.cx} cy={bubbleStartY} r={b.r} fill="#FFFFFF" opacity="0">
                      <animate
                        attributeName="cy"
                        values={`${bubbleStartY};${bubbleEndY}`}
                        dur={b.dur}
                        begin={b.begin}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;0.65;0"
                        dur={b.dur}
                        begin={b.begin}
                        repeatCount="indefinite"
                      />
                    </circle>
                  ))}
                </>
              ) : null}

              {/* Ánh sáng pha lê phản chiếu góc trên trái */}
              <ellipse cx="47" cy="46" rx="17" ry="26" transform="rotate(-18 47 46)" fill={`url(#${glossGradId})`} />
              <path
                d="M 40 94 Q 64 106 88 94"
                fill="none"
                stroke="rgba(255, 255, 255, 0.35)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>

            <path
              d={TEARDROP_PATH}
              fill="none"
              stroke="rgba(255, 255, 255, 0.88)"
              strokeWidth="2"
            />

            {/* Tia sao lóe sáng 4 cánh kiểu kim cương khi rê chuột vào bước chưa mở */}
            {isLocked ? (
              <path
                d="M 46 31 L 48.2 37.8 L 55 40 L 48.2 42.2 L 46 49 L 43.8 42.2 L 37 40 L 43.8 37.8 Z"
                fill="#FFFFFF"
                className="dew-diamond-spark"
              />
            ) : null}
          </svg>

          {/* Icon trắng & Số thứ tự đậm ở tâm giọt nước */}
          <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center pt-3 text-white">
            <CenterDropIcon icon={stage?.icon} status={status} compact={compact} />
            <span className={`mt-0.5 font-black leading-none tracking-tight tabular-nums drop-shadow-[0_2px_4px_rgba(15,23,42,0.35)] ${compact ? 'text-xl lg:text-2xl' : 'text-2xl md:text-[26px]'}`}>
              {stage?.id}
            </span>
          </div>

          {/* 3. Badge % nổi góc trên phải */}
          <span
            className={`pointer-events-none absolute -top-1 -right-2 z-20 rounded-full border border-white/90 font-extrabold leading-none text-white shadow-md tabular-nums ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'} ${theme.badgeClass}`}
          >
            {pct}%
          </span>
        </div>

        {/* 4. Pill nhãn trạng thái phát sáng bên dưới */}
        <div
          className={`relative mt-4 inline-flex max-w-full items-center gap-1 rounded-full border border-white bg-white/90 font-bold shadow-lg backdrop-blur-md transition after:pointer-events-none after:absolute after:-bottom-1.5 after:left-4 after:right-4 after:h-2.5 after:rounded-full after:blur-md after:content-[''] ${compact ? 'px-2.5 py-1.5 text-[11px] lg:px-3 lg:text-xs' : 'px-3 py-1.5 text-xs lg:px-3.5 lg:text-[12.5px]'} ${theme.pillTextClass} ${theme.pillAfterGlow} ${isSelected ? theme.pillActiveRing : ''}`}
        >
          <span className="shrink-0">
            <StatusPillIcon status={status} />
          </span>
          <span className="truncate" title={stage?.label}>{stage?.label}</span>
        </div>
      </button>
    </div>
  );
}

/**
 * Stepper 1–6 nút Giọt Nước Pha Lê 3D phát sáng cho trang Luyện tập DewSkill.
 */
export default function DewdropStageStepper({
  stages = DEFAULT_DEWDROP_STAGES,
  staggered = false,
  activeStageKey = '',
  anchorRef,
  className = '',
}) {
  if (!Array.isArray(stages) || stages.length === 0) return null;

  const compact = stages.length >= 6;
  const gridColsClass = stages.length === 1
    ? 'md:grid-cols-1'
    : stages.length === 2
      ? 'md:grid-cols-2'
      : stages.length === 3
        ? 'md:grid-cols-3'
        : stages.length === 4
          ? 'md:grid-cols-4'
          : stages.length === 5
            ? 'md:grid-cols-5'
            : 'md:grid-cols-6';

  return (
    <div className={`relative w-full rounded-[24px] bg-gradient-to-r from-[#E0F2FE]/65 via-[#F0FDFA]/80 to-[#DCFCE7]/65 py-8 ${compact ? 'px-3 md:px-4' : 'px-4 md:px-8'} ${className}`}>
      <div
        className={`relative grid grid-cols-1 ${gridColsClass} items-center ${compact ? 'gap-6 md:gap-3' : 'gap-8 md:gap-5'}`}
      >
        {stages.map((stage, index) => {
          const pct = clampPercent(stage.progress);
          const isCompletedSegment = stage.status === 'completed' || pct >= 100;
          const isSelected = Boolean(
            activeStageKey
            && (
              (stage.nodeKey && stage.nodeKey === activeStageKey)
              || String(stage.id) === String(activeStageKey)
            ),
          );
          const staggerClass = staggered ? (index % 2 === 1 ? 'md:mt-10' : 'md:mt-0') : '';

          return (
            <div key={stage.nodeKey || stage.id || index} className={`relative flex min-w-0 flex-col items-center ${staggerClass}`}>
              {/* Thanh nối dọc trên Mobile */}
              {index > 0 ? (
                <div
                  aria-hidden="true"
                  className={`mb-4 h-7 w-2 rounded-full md:hidden ${
                    stages[index - 1]?.status === 'completed' || clampPercent(stages[index - 1]?.progress) >= 100
                      ? 'bg-gradient-to-b from-[#10B981] to-[#06B6D4] shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'bg-slate-300/75'
                  }`}
                />
              ) : null}

              <DewdropNode
                stage={stage}
                isSelected={isSelected}
                compact={compact}
                anchorRef={anchorRef}
              />

              {/* Thanh nối ngang phát sáng giữa tâm các vòng tròn (Desktop) */}
              {index < stages.length - 1 ? (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none hidden md:block absolute ${compact ? 'top-12 lg:top-14 left-[calc(50%+54px)] w-[calc(100%+0.75rem-108px)]' : 'top-14 lg:top-16 left-[calc(50%+68px)] w-[calc(100%+1.25rem-136px)]'} z-0 h-2 min-w-[10px] -translate-y-1/2 rounded-full ${
                    staggered ? (index % 2 === 0 ? 'translate-y-4 rotate-[8deg]' : '-translate-y-4 -rotate-[8deg]') : ''
                  } ${
                    isCompletedSegment
                      ? 'bg-gradient-to-r from-[#10B981] to-[#06B6D4] shadow-[0_0_14px_rgba(16,185,129,0.55)]'
                      : 'bg-slate-300/75'
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
