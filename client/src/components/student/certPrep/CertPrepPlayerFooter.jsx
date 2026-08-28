import { ChevronLeft, ChevronRight, Send } from 'lucide-react';

export default function CertPrepPlayerFooter({
  currentIndex,
  total,
  onPrevious,
  onNext,
  onSubmit,
  submitDisabled,
  nextLabel = 'Câu tiếp theo',
  nextDisabled = false,
  nextPrimary = false,
}) {
  return (
    <footer className="sticky bottom-0 z-20 border-t border-slate-200/80 bg-white/95 backdrop-blur shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.18)]">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentIndex <= 0}
          className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-700 border border-slate-200 bg-white disabled:opacity-40 inline-flex items-center gap-1"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Câu trước
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="min-h-11 px-5 rounded-xl font-black text-sm bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/20 disabled:opacity-60 inline-flex items-center gap-2"
        >
          <Send size={15} aria-hidden="true" /> Nộp bài
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={`min-h-11 px-4 rounded-xl font-bold text-sm inline-flex items-center gap-1 disabled:opacity-40 ${
            nextPrimary
              ? 'bg-slate-900 text-white'
              : 'text-slate-700 border border-slate-200 bg-white'
          }`}
        >
          {nextLabel} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
