import { ArrowLeft, Clock, Send } from 'lucide-react';
import { localeLabel } from './certPrepStudentLabels';
import CertPrepTimer from './CertPrepTimer';

export default function CertPrepPlayerHeader({
  session,
  currentIndex,
  total,
  remainingSeconds,
  answeredCount = 0,
  exam = false,
  onExit,
  onSubmit,
  submitDisabled = false,
}) {
  const name = session?.configSnapshot?.name || 'Bài kiểm tra';
  const immediate = session?.configSnapshot?.feedbackMode === 'immediate';
  const limitMin = Number(session?.configSnapshot?.timeLimitMinutes) || 0;
  const hasTimer = limitMin > 0;
  const left = Math.max(0, Number(remainingSeconds) || 0);
  const warning = hasTimer && left > 0 && left <= 5 * 60;
  const critical = hasTimer && left > 0 && left <= 60;
  const done = Math.min(total, Math.max(0, Number(answeredCount) || 0));

  if (exam) {
    return (
      <header className="h-14 bg-[#0e1420] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {typeof onExit === 'function' ? (
            <button
              type="button"
              onClick={onExit}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
              aria-label="Thoát phòng thi"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
          ) : null}
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base text-slate-100 truncate">{name}</h1>
            <p className="text-[11px] text-slate-400 truncate">
              {localeLabel(session?.locale)}
              {immediate ? ' · Hiển thị đáp án khi làm' : ' · Xem đáp án sau nộp'}
              {total > 0 ? ` · ${done}/${total} đã làm` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasTimer ? (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-sm tabular-nums border ${
                critical
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : warning
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}
            >
              <Clock size={16} className={critical ? 'text-red-400 animate-pulse' : 'text-amber-400 animate-pulse'} aria-hidden="true" />
              <CertPrepTimer remainingSeconds={remainingSeconds} light />
            </div>
          ) : null}
          {typeof onSubmit === 'function' ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitDisabled}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition shadow-md shadow-red-900/30 flex items-center gap-1.5"
            >
              <Send size={14} aria-hidden="true" /> Nộp bài
            </button>
          ) : null}
        </div>
      </header>
    );
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            {immediate ? (
              <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                Hiển thị đáp án khi làm
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                Chỉ xem đáp án sau nộp
              </span>
            )}
          </div>
          <h1 className="text-base sm:text-lg font-black truncate tracking-tight text-slate-900">{name}</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {localeLabel(session?.locale)}
            {total > 0 ? ` · Câu ${currentIndex + 1} / ${total}` : ''}
          </p>
        </div>
        {hasTimer ? (
          <div
            className={`shrink-0 rounded-2xl border px-3.5 py-1.5 text-right ${
              critical
                ? 'bg-red-50 border-red-200'
                : warning
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Thời gian</p>
            <CertPrepTimer remainingSeconds={remainingSeconds} />
          </div>
        ) : null}
      </div>
      {total > 0 ? (
        <div
          className="max-w-6xl mx-auto px-4 sm:px-6 pb-2.5"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
