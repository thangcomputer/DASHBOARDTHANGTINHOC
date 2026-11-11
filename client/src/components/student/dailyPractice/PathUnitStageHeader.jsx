import { BookOpen, FastForward } from 'lucide-react';

function darken(hex, amount = 0.28) {
  const value = String(hex || '#B91C1C').replace('#', '');
  const channel = (start) => Math.max(0, Math.round(parseInt(value.slice(start, start + 2), 16) * (1 - amount)));
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

/** Danh sách video của chặng (unit + từng cấp). */
export function collectUnitVideos(unit) {
  const items = [];
  const seen = new Set();
  const push = (video) => {
    if (!video?.id || seen.has(video.id)) return;
    seen.add(video.id);
    items.push(video);
  };
  for (const video of unit?.videos || []) push(video);
  for (const node of unit?.pathNodes || []) {
    for (const level of node.levels || []) {
      for (const video of level.videos || []) {
        push({ ...video, stepLabel: video.stepLabel || level.label || '' });
      }
    }
  }
  return items;
}

export function UnitStageHeader({
  unit,
  color,
  onTestOut,
  onWatch,
  _highlight,
  hasVideo,
  testOutButtonRef,
  isStarted = false,
  onStartUnit,
}) {
  const locked = unit.state === 'locked';
  const done = unit.state === 'completed';
  const steps = Array.isArray(unit.steps) ? unit.steps : [];
  const doneSteps = steps.filter((step) => step.state === 'completed').length;
  const totalSteps = steps.length;
  const progress = totalSteps ? doneSteps / totalSteps : 0;

  // Lên màu khi:
  // 1. Chặng đã xong (done / đã vượt): xong chặng này rồi đến chặng khác thì mới lên màu
  // 2. Chặng đang học và đã bấm bắt đầu (doneSteps > 0 hoặc isStarted): khi bấm bắt đầu thì mới lên màu
  // Bình thường (chưa bắt đầu hoặc locked): màu xám
  const activeAndStarted = !locked && (doneSteps > 0 || isStarted);
  const isColored = done || activeAndStarted;

  const barBg = isColored ? color.to : '#94A3B8';
  const barDeep = isColored ? darken(color.to, 0.18) : '#64748B';
  let statusLabel = '';
  if (done) statusLabel = 'Đã vượt';
  else if (activeAndStarted) statusLabel = 'Đang học';
  else if (locked) statusLabel = 'Chưa mở';
  else statusLabel = 'Chưa bắt đầu';

  return (
    <div className="w-full">
      <div
        className={`duo-stage-banner relative flex items-stretch overflow-hidden rounded-2xl text-white shadow-[0_3px_0_rgba(15,23,42,0.12)] ${!locked && !isColored ? 'cursor-pointer hover:brightness-105 transition-all' : ''}`}
        style={{ background: `linear-gradient(180deg, ${barBg} 0%, ${barDeep} 100%)` }}
        onClick={!locked && !isColored && onStartUnit ? onStartUnit : undefined}
      >
        <div className="min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/85">
            Chặng {unit.index}
            {statusLabel ? ` · ${statusLabel}` : ''}
          </p>
          <h3 className="mt-0.5 truncate text-lg font-black leading-tight sm:text-xl">{unit.title}</h3>
          {unit.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs font-medium text-white/80 sm:line-clamp-1">{unit.description}</p>
          ) : null}
          <div className="mt-2 flex max-w-[220px] items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-black tabular-nums text-white/90">{doneSteps}/{totalSteps}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center border-l border-white/25 px-3 sm:px-4">
          <button
            type="button"
            onClick={hasVideo ? onWatch : undefined}
            disabled={!hasVideo}
            title={hasVideo ? 'Xem video của chặng' : 'Chặng chưa có video'}
            aria-label={hasVideo ? 'Xem video của chặng' : 'Chặng chưa có video'}
            className="duo-stage-icon-btn flex h-11 w-11 items-center justify-center rounded-xl text-emerald-700 disabled:cursor-default disabled:opacity-45"
          >
            <BookOpen size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>
      {locked && unit.canTestOut ? (
        <div className="mt-2 flex justify-center">
          <button
            ref={testOutButtonRef}
            type="button"
            onClick={onTestOut}
            className="duo-btn duo-btn--dark duo-btn--sm"
          >
            <FastForward size={13} aria-hidden="true" />
            <span className="duo-btn__label">Kiểm tra vượt</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
