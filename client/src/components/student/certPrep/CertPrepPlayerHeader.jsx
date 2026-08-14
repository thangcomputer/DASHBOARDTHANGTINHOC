import { localeLabel } from './certPrepStudentLabels';
import CertPrepTimer from './CertPrepTimer';

export default function CertPrepPlayerHeader({ session, currentIndex, total, remainingSeconds }) {
  const name = session?.configSnapshot?.name || 'Bài kiểm tra';
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{name}</h1>
        <p className="text-xs font-semibold text-slate-500">
          {localeLabel(session?.locale)}
          {total > 0 ? ` · Câu ${currentIndex + 1} / ${total}` : ''}
        </p>
      </div>
      <CertPrepTimer remainingSeconds={remainingSeconds} />
    </header>
  );
}
