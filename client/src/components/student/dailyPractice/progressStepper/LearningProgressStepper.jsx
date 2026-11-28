import { Fragment, useId } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Gift,
  GraduationCap,
  Lock,
  Trophy,
} from 'lucide-react';
import { SAMPLE_PROGRESS_STEPS } from './sampleSteps';
import { clampProgress, getConnectorProgress, getProgressColor } from './progressColor';

function TeardropMainIcon({ themeKey }) {
  const iconCls = 'relative z-10 h-5 w-5 drop-shadow-[0_1px_2px_rgba(15,23,42,0.28)]';
  if (themeKey === 'reward') return <Trophy className={iconCls} strokeWidth={2.2} aria-hidden="true" />;
  if (themeKey === 'locked') return <Lock className={iconCls} strokeWidth={2.2} aria-hidden="true" />;
  if (themeKey === 'completed') return <Check className={iconCls} strokeWidth={3} aria-hidden="true" />;
  return <GraduationCap className={iconCls} strokeWidth={2.2} aria-hidden="true" />;
}

function PillStatusIcon({ themeKey, iconClass }) {
  const cls = `h-4 w-4 shrink-0 ${iconClass}`;
  if (themeKey === 'reward') return <Gift className={cls} strokeWidth={2.2} aria-hidden="true" />;
  if (themeKey === 'completed') return <CheckCircle2 className={cls} strokeWidth={2.4} aria-hidden="true" />;
  if (themeKey === 'in_progress' || themeKey === 'early' || themeKey === 'active_zero') {
    return <BookOpen className={cls} strokeWidth={2.2} aria-hidden="true" />;
  }
  return <Clock className={cls} strokeWidth={2.2} aria-hidden="true" />;
}

function LaurelWings() {
  return (
    <svg
      viewBox="0 0 112 72"
      className="pointer-events-none absolute -bottom-1 left-1/2 h-[74px] w-[114px] -translate-x-1/2 z-0 opacity-85"
      aria-hidden="true"
    >
      <g fill="#F59E0B" opacity="0.88">
        <ellipse cx="16" cy="40" rx="6" ry="2.6" transform="rotate(-35 16 40)" />
        <ellipse cx="19" cy="49" rx="6" ry="2.6" transform="rotate(-22 19 49)" />
        <ellipse cx="25" cy="57" rx="6" ry="2.6" transform="rotate(-10 25 57)" />
        <ellipse cx="33" cy="63" rx="6" ry="2.6" transform="rotate(4 33 63)" />
        <ellipse cx="96" cy="40" rx="6" ry="2.6" transform="rotate(35 96 40)" />
        <ellipse cx="93" cy="49" rx="6" ry="2.6" transform="rotate(22 93 49)" />
        <ellipse cx="87" cy="57" rx="6" ry="2.6" transform="rotate(10 87 57)" />
        <ellipse cx="79" cy="63" rx="6" ry="2.6" transform="rotate(-4 79 63)" />
      </g>
    </svg>
  );
}

/**
 * Thanh tiến trình học tập 4 chặng đáp ứng (Desktop ngang / Mobile dọc).
 * Màu sắc vòng tiến độ, badge % và thanh nối tự động thay đổi theo progress & status.
 */
export default function LearningProgressStepper({
  steps = SAMPLE_PROGRESS_STEPS,
  onStepClick,
  activeStepKey = '',
  anchorRef,
  allowLockedClick = true,
  className = '',
}) {
  const uid = useId().replace(/:/g, '');
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col items-center md:flex-row md:items-start md:justify-between">
        {steps.map((step, index) => {
          const pct = clampProgress(step.progress);
          const theme = getProgressColor(step);
          const isLocked = theme.key === 'locked';
          const canClick = Boolean(onStepClick) && (!isLocked || allowLockedClick);
          const isHighlighted = !isLocked && (step.isCurrent || theme.key === 'in_progress' || theme.key === 'early' || theme.key === 'active_zero');
          const displayNum = step.stepNumber ?? step.id ?? index + 1;
          const stepKey = step.key || step.nodeKey || String(displayNum);
          const isAnchor = Boolean(activeStepKey && step.nodeKey && activeStepKey === step.nodeKey);

          const activeRingClass = isAnchor
            ? theme.key === 'reward'
              ? 'ring-2 ring-amber-400/75'
              : theme.key === 'completed'
                ? 'ring-2 ring-emerald-400/75'
                : theme.key === 'locked'
                  ? 'ring-2 ring-slate-300'
                  : 'ring-2 ring-blue-400/75'
            : '';

          const visualRingPct = theme.key === 'reward' && pct === 0 ? 100 : pct;
          const dashOffset = ringCircumference * (1 - visualRingPct / 100);
          const dropGradId = `step-drop-${uid}-${index}`;

          const nextStep = index < steps.length - 1 ? steps[index + 1] : null;
          const connector = nextStep ? getConnectorProgress(step, nextStep) : null;

          return (
            <Fragment key={stepKey}>
              <div
                ref={isAnchor ? anchorRef : undefined}
                data-path-hub=""
                data-node-state={step.nodeState || theme.key}
                data-path-current={step.isCurrent ? '1' : undefined}
                className="flex w-full max-w-[200px] shrink-0 flex-col items-center md:w-auto md:max-w-[168px]"
              >
                <div className="relative flex h-[104px] w-[104px] items-center justify-center">
                  {theme.key === 'reward' ? <LaurelWings /> : null}

                  {isHighlighted ? (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-2 rounded-full ${theme.glowClass} animate-pulse`}
                    />
                  ) : null}

                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => canClick && onStepClick?.(step, index)}
                    aria-label={`${displayNum} · ${step.title} · ${pct}%`}
                    className={`group relative flex h-[96px] w-[96px] items-center justify-center rounded-full transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      !canClick
                        ? 'cursor-not-allowed opacity-90'
                        : isLocked
                          ? 'cursor-pointer opacity-90 hover:-translate-y-0.5 active:scale-[0.98]'
                          : 'cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]'
                    }`}
                  >
                    {/* Vòng tiến độ bên ngoài đồng bộ với progress */}
                    <svg
                      viewBox="0 0 96 96"
                      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                      aria-hidden="true"
                    >
                      <circle
                        cx="48"
                        cy="48"
                        r={ringRadius}
                        fill="rgba(255,255,255,0.72)"
                        stroke={theme.ringTrack}
                        strokeWidth="4.5"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r={ringRadius}
                        fill="none"
                        stroke={theme.ringStroke}
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={dashOffset}
                        className="transition-[stroke-dashoffset,stroke] duration-700 ease-out"
                      />
                    </svg>

                    {/* Giọt nước tinh tế ở tâm nút */}
                    <svg
                      viewBox="0 0 96 96"
                      className="pointer-events-none relative z-[1] h-[82px] w-[82px] drop-shadow-[0_8px_16px_rgba(15,23,42,0.14)]"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id={dropGradId} x1="25%" y1="5%" x2="80%" y2="95%">
                          <stop offset="0%" stopColor={theme.dropStart} />
                          <stop offset="52%" stopColor={theme.dropMid} />
                          <stop offset="100%" stopColor={theme.dropEnd} />
                        </linearGradient>
                      </defs>
                      <path
                        d="M48 8 C48 8 78 38 78 58 C78 75 64.5 88 48 88 C31.5 88 18 75 18 58 C18 38 48 8 48 8 Z"
                        fill={`url(#${dropGradId})`}
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="2"
                      />
                      <path
                        d="M36 33 C31 41 28 50 30 58"
                        fill="none"
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Icon trạng thái + số thứ tự bên trong giọt nước */}
                    <div className={`pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center pt-2 ${theme.textOnDrop}`}>
                      <TeardropMainIcon themeKey={theme.key} />
                      <span className="mt-0.5 text-xl font-black leading-none tracking-tight tabular-nums drop-shadow-[0_1px_2px_rgba(15,23,42,0.22)]">
                        {displayNum}
                      </span>
                    </div>
                  </button>

                  {/* Badge % thực tế góc trên phải */}
                  <span
                    className={`pointer-events-none absolute -right-1 top-1 z-20 rounded-full border border-white/85 px-2.5 py-0.5 text-[11px] font-black leading-tight tabular-nums ${theme.badgeClass}`}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Pill tên trạng thái bên dưới mỗi chặng */}
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => canClick && onStepClick?.(step, index)}
                  style={{ boxShadow: theme.pillShadowStyle }}
                  className={`mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full border bg-white/95 px-3.5 py-2 text-xs font-extrabold transition ${theme.pillBorderClass} ${activeRingClass} ${
                    !canClick
                      ? 'cursor-not-allowed text-slate-500'
                      : isLocked
                        ? 'cursor-pointer text-slate-500 hover:-translate-y-0.5'
                        : 'cursor-pointer text-slate-800 hover:-translate-y-0.5'
                  }`}
                >
                  <PillStatusIcon themeKey={theme.key} iconClass={theme.pillIconClass} />
                  <span className="truncate">{step.title}</span>
                </button>
              </div>

              {/* Thanh nối tiến trình giữa 2 chặng */}
              {connector ? (
                <>
                  {/* Thanh ngang Desktop & Tablet */}
                  <div
                    className="hidden md:flex flex-1 items-center px-2 pt-[48px]"
                    aria-hidden="true"
                  >
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${connector.fillPercent}%`,
                          background: `linear-gradient(90deg, ${connector.fromHex}, ${connector.toHex})`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Thanh dọc Mobile */}
                  <div
                    className="my-2 flex h-7 w-1.5 overflow-hidden rounded-full bg-slate-200/80 md:hidden"
                    aria-hidden="true"
                  >
                    <div
                      className="w-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        height: `${connector.fillPercent}%`,
                        background: `linear-gradient(180deg, ${connector.fromHex}, ${connector.toHex})`,
                      }}
                    />
                  </div>
                </>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
