import { Loader2, X } from 'lucide-react';
import { localeLabel } from './certPrepStudentLabels';

export default function CertPrepStartDialog({
  open,
  test,
  courseName,
  levelTitle,
  starting,
  onCancel,
  onConfirm,
}) {
  if (!open || !test) return null;
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
        <div className="px-5 py-4 text-sm text-slate-600 space-y-2">
          <p className="font-bold text-slate-900">
            {[courseName, levelTitle].filter(Boolean).join(' — ')}
          </p>
          <p>{test.name} · {localeLabel(test.locale)}</p>
          <p>{test.questionCount} câu</p>
          <p>{test.timeLimitMinutes} phút</p>
          <p>Điểm đạt: {test.passingScore}</p>
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
