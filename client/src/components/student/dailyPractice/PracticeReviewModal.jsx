import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import { reviewItemFollowUpLine } from '../../../../../shared/dailyPractice/reviewDisplay.mjs';

export default function PracticeReviewModal({ review = [], onClose }) {
  const items = Array.isArray(review) ? review : [];
  if (!items.length) {
    return createPortal(
      <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
        <div className="w-full max-w-sm rounded-[22px] bg-white p-6 text-center shadow-2xl ring-1 ring-slate-200" role="dialog" aria-modal="true">
          <p className="text-sm font-bold text-slate-700">Chưa có dữ liệu xem lại cho lượt này.</p>
          <button type="button" onClick={onClose} className="cms-btn cms-btn-primary mt-4 w-full !py-2.5 text-sm">
            Đóng
          </button>
        </div>
      </div>,
      document.body,
    );
  }

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
            <span className="text-xs font-bold text-slate-400">({items.length})</span>
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
          {items.map((item) => {
            const answerText = String(item.correctAnswer?.text || '').trim();
            const followUp = reviewItemFollowUpLine(item);
            const wrong = item.correct === false;
            return (
              <li key={item.id} className={`rounded-xl p-3 text-left ring-1 ${wrong ? 'bg-rose-50/80 ring-rose-100' : 'bg-slate-50 ring-slate-100'}`}>
                {wrong ? <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-rose-600">Chưa đúng</p> : null}
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
