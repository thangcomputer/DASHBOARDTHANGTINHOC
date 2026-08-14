import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CertPrepPlayerFooter({
  currentIndex,
  total,
  onPrevious,
  onNext,
  onSubmit,
  submitDisabled,
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-slate-200 bg-white">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentIndex <= 0}
        className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-700 border border-slate-200 disabled:opacity-40 inline-flex items-center gap-1"
      >
        <ChevronLeft size={16} aria-hidden="true" /> Câu trước
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled}
        className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-60"
      >
        Nộp bài
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex >= total - 1}
        className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-700 border border-slate-200 disabled:opacity-40 inline-flex items-center gap-1"
      >
        Câu tiếp <ChevronRight size={16} aria-hidden="true" />
      </button>
    </footer>
  );
}
