import { Loader2, X } from 'lucide-react';
import { localeLabel } from './certPrepStudentLabels';

export default function CertPrepStartDialog({
  open,
  test,
  courseName,
  levelTitle,
  starting,
  feedbackMode = 'immediate',
  onFeedbackModeChange,
  onCancel,
  onConfirm,
}) {
  if (!open || !test) return null;
  const immediate = feedbackMode !== 'after_submit';
  return (
    <div className="cms-modal-shell" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-prep-start-title"
        className="cms-modal-panel max-w-md"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 id="cert-prep-start-title" className="text-base font-bold text-slate-900">Bạn chuẩn bị bắt đầu</h3>
          <button type="button" onClick={onCancel} aria-label="Đóng" className="w-10 h-10 rounded-xl hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-600 space-y-3">
          <p className="font-bold text-slate-900">
            {[courseName, levelTitle].filter(Boolean).join(' — ')}
          </p>
          <p>{test.name} · {localeLabel(test.locale)}</p>
          <p>{test.questionCount} câu · {test.timeLimitMinutes} phút · Điểm đạt: {test.passingScore}</p>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Hiện đáp án đúng / sai khi làm bài</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {immediate
                    ? 'Nút «Hiển thị đáp án» → xem đúng/sai, rồi đổi thành «Câu tiếp theo» để sang câu khác.'
                    : 'Nút luôn là «Câu tiếp theo». Chỉ xem đúng/sai sau khi nộp bài.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={immediate}
                aria-label="Hiện đáp án đúng sai khi làm bài"
                disabled={starting}
                onClick={() => onFeedbackModeChange?.(immediate ? 'after_submit' : 'immediate')}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                  immediate ? 'bg-red-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    immediate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <p className="text-amber-700 font-semibold">Sau khi bắt đầu, thời gian sẽ được tính.</p>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={starting} className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-600">
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={starting}
            className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-60 inline-flex items-center gap-2"
          >
            {starting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            Bắt đầu
          </button>
        </div>
      </div>
    </div>
  );
}
