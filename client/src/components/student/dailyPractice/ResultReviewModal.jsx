import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { dewClass, getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import { reviewItemFollowUpLine } from '../../../../../shared/dailyPractice/reviewDisplay.mjs';

/**
 * Modal "Xem lại kết quả" theo phong cách Giọt Nước 3D (Hình 5).
 */
export default function ResultReviewModal({ review = [], onClose }) {
  const items = useMemo(() => (Array.isArray(review) ? review : []), [review]);
  const [filter, setFilter] = useState('all'); // 'all' | 'wrong' | 'correct'

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const wrongItems = useMemo(() => items.filter((item) => item.correct === false), [items]);
  const correctItems = useMemo(() => items.filter((item) => item.correct !== false), [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'wrong') return wrongItems;
    if (filter === 'correct') return correctItems;
    return items;
  }, [filter, items, wrongItems, correctItems]);

  if (!items.length) {
    return createPortal(
      <div
        data-theme={getDewSkillThemeAttr()}
        className="fixed inset-0 z-[9700] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div
          className="dew-modal dew-student-theme relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white bg-white/95 p-6 text-center shadow-2xl backdrop-blur-2xl"
          role="dialog"
          aria-modal="true"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#06B6D4]" />
          <p className="text-sm font-bold text-slate-700">Chưa có dữ liệu xem lại cho lượt này.</p>
          <button
            type="button"
            onClick={onClose}
            className={dewClass(
              'dew-btn-primary mt-4 w-full py-2.5 text-sm font-extrabold cursor-pointer',
              'mt-4 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-extrabold cursor-pointer',
            )}
          >
            Đóng
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      className="fixed inset-0 z-[9700] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="dew-modal dew-student-theme relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[30px] border border-white bg-white/95 shadow-2xl backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-review-title"
      >
        {/* Thanh nhấn 4px xanh ngọc trên cùng */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#06B6D4]" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 id="dp-review-title" className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Xem lại kết quả
            </h3>
            <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-0.5 text-xs font-extrabold text-emerald-700 tabular-nums">
              {correctItems.length}/{items.length} đúng
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white bg-slate-100/90 text-slate-500 shadow-xs transition hover:bg-slate-200/80 hover:text-slate-800 cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Thanh lọc 3 pill */}
        <div className="flex flex-wrap items-center gap-2 px-6 pb-3.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition cursor-pointer ${
              filter === 'all'
                ? dewClass('dew-btn-primary text-white', 'bg-emerald-600 text-white shadow-sm')
                : 'border border-slate-200 bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Tất cả ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('wrong')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition cursor-pointer ${
              filter === 'wrong'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'border border-rose-200 bg-rose-100/80 text-rose-700 hover:bg-rose-200/75'
            }`}
          >
            Chưa đúng ({wrongItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('correct')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition cursor-pointer ${
              filter === 'correct'
                ? dewClass('dew-btn-primary text-white', 'bg-emerald-600 text-white shadow-sm')
                : 'border border-emerald-200 bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200/75'
            }`}
          >
            Đúng ({correctItems.length})
          </button>
        </div>

        {/* Danh sách cuộn mượt */}
        <ul className="flex-1 space-y-3 overflow-y-auto px-6 pb-6">
          {filteredItems.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs font-semibold text-slate-500">
              Không có câu hỏi nào trong mục này.
            </li>
          ) : filteredItems.map((item) => {
            const answerText = String(item.correctAnswer?.text || '').trim();
            const followUp = reviewItemFollowUpLine(item);
            const wrong = item.correct === false;

            if (wrong) {
              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-rose-200 bg-rose-50/85 p-4 text-left shadow-[0_6px_16px_-10px_rgba(244,63,94,0.2)]"
                >
                  <span className="inline-flex items-center rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                    CHƯA ĐÚNG
                  </span>
                  <p className="mt-2 text-sm font-extrabold leading-snug text-slate-900">
                    {item.prompt}
                  </p>
                  {answerText ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-sm font-bold leading-snug text-emerald-700">
                      <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{answerText}</span>
                    </p>
                  ) : null}
                  {followUp ? (
                    <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-600">
                      {followUp}
                    </p>
                  ) : null}
                </li>
              );
            }

            return (
              <li
                key={item.id}
                className="rounded-2xl border border-emerald-200 bg-emerald-50/75 p-4 text-left shadow-[0_6px_16px_-10px_rgba(16,185,129,0.2)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                    <span>ĐÚNG</span>
                    <Check size={11} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-extrabold leading-snug text-slate-900">
                    {item.prompt}
                  </p>
                </div>
                {answerText ? (
                  <p className="mt-2 text-sm font-semibold leading-snug text-slate-800">
                    {answerText}
                  </p>
                ) : null}
                {followUp ? (
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-600">
                    {followUp}
                  </p>
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
