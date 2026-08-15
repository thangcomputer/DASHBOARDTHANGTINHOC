import { localeLabel } from './certPrepStudentLabels';
import CertPrepTimer from './CertPrepTimer';

export default function CertPrepPlayerHeader({ session, currentIndex, total, remainingSeconds }) {
  const name = session?.configSnapshot?.name || 'Bài kiểm tra';
  const immediate = session?.configSnapshot?.feedbackMode === 'immediate';
  const limitMin = Number(session?.configSnapshot?.timeLimitMinutes) || 0;
  const limitSec = Math.max(0, limitMin * 60);
  const left = Math.max(0, Number(remainingSeconds) || 0);
  const elapsedRatio = limitSec > 0 ? Math.min(1, Math.max(0, (limitSec - left) / limitSec)) : 0;
  const remainRatio = 1 - elapsedRatio;
  const warning = left > 0 && left <= 5 * 60;
  const critical = left > 0 && left <= 60;

  let barClass = 'bg-emerald-400';
  if (critical) barClass = 'bg-red-500';
  else if (warning) barClass = 'bg-amber-400';

  return (
    <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_rgba(248,113,113,0.35),_transparent_55%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {immediate ? (
              <span className="inline-flex rounded-full bg-emerald-400/15 border border-emerald-300/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-200">
                Hiển thị đáp án khi làm
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-200">
                Chỉ xem đáp án sau nộp
              </span>
            )}
          </div>
          <h1 className="text-base sm:text-lg font-black truncate tracking-tight">{name}</h1>
          <p className="text-xs font-semibold text-slate-300 mt-0.5">
            {localeLabel(session?.locale)}
            {total > 0 ? ` · Câu ${currentIndex + 1} / ${total}` : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-black/25 border border-white/10 px-4 py-2 backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Thời gian</p>
          <CertPrepTimer remainingSeconds={remainingSeconds} light />
        </div>
      </div>
      {limitSec > 0 ? (
        <div className="relative px-4 sm:px-6 pb-3" role="progressbar" aria-valuemin={0} aria-valuemax={limitSec} aria-valuenow={left} aria-label="Thời gian còn lại">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${barClass}`}
              style={{ width: `${Math.max(0, remainRatio * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <span>Đã làm {Math.round(elapsedRatio * 100)}%</span>
            <span className={critical ? 'text-red-300' : warning ? 'text-amber-200' : 'text-slate-300'}>
              Còn {Math.round(remainRatio * 100)}%
            </span>
          </div>
        </div>
      ) : null}
    </header>
  );
}
