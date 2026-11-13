import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import { reviewItemFollowUpLine } from '../../../../../shared/dailyPractice/reviewDisplay.mjs';

export default function PracticeReviewModal({ review = [], onClose }) {
  if (!review.length) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9600] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-4" role="presentation">
      <div
        className="dp-achievement-shell max-h-[min(78vh,520px)] w-full max-w-lg overflow-hidden rounded-[22px] bg-white shadow-2xl ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-review-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p id="dp-review-title" className="flex items-center gap-2 text-sm font-black text-slate-800">
            <Sparkles size={16} className="text-amber-500" aria-hidden="true" />
            Xem lại kết quả
            <span className="text-xs font-bold text-slate-400">({review.length})</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Đóng"
          >
            <X size={17} />
          </button>
        </div>
        <ul className="max-h-[calc(min(78vh,520px)-56px)] space-y-2.5 overflow-y-auto p-4">
          {review.map((item) => {
            const answerText = String(item.correctAnswer?.text || '').trim();
            const followUp = reviewItemFollowUpLine(item);
            return (
              <li key={item.id} className="rounded-xl bg-slate-50 p-3 text-left ring-1 ring-slate-100">
                <p className="text-sm font-bold text-slate-800">{item.prompt}</p>
                {answerText ? (
                  <p className="mt-1 text-sm font-semibold leading-snug text-emerald-700">✓ {answerText}</p>
                ) : followUp ? (
                  <p className="mt-1 text-sm font-medium leading-snug text-slate-600">{followUp}</p>
                ) : null}
                {answerText && followUp ? (
                  <p className="mt-1 text-xs leading-snug text-slate-500">{followUp}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
