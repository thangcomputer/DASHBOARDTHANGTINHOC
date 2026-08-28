import { localeLabel } from './certPrepStudentLabels';
import CertPrepTimer from './CertPrepTimer';

export default function CertPrepPlayerHeader({
  session,
  currentIndex,
  total,
  remainingSeconds,
  answeredCount = 0,
}) {
  const name = session?.configSnapshot?.name || 'Bài kiểm tra';
  const immediate = session?.configSnapshot?.feedbackMode === 'immediate';
  const limitMin = Number(session?.configSnapshot?.timeLimitMinutes) || 0;
  const hasTimer = limitMin > 0;
  const left = Math.max(0, Number(remainingSeconds) || 0);
  const warning = hasTimer && left > 0 && left <= 5 * 60;
  const critical = hasTimer && left > 0 && left <= 60;
  const done = Math.min(total, Math.max(0, Number(answeredCount) || 0));
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
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Số câu đã trả lời"
        >
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <span>Đã trả lời {done}/{total}</span>
            <span>{pct}%</span>
          </div>
        </div>
      ) : null}
    </header>
  );
}
