import { Loader2, X } from 'lucide-react';

export default function CertPrepSubmitDialog({
  open,
  answeredCount,
  total,
  submitting,
  onCancel,
  onConfirm,
  exam = false,
}) {
  if (!open) return null;
  const unanswered = Math.max(0, total - answeredCount);

  if (exam) {
    return (
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70" role="presentation" data-exam-modal>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cert-prep-submit-title"
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121826] shadow-2xl text-white"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 id="cert-prep-submit-title" className="text-base font-bold">Bạn có chắc muốn nộp bài?</h3>
            <button type="button" onClick={onCancel} disabled={submitting} aria-label="Đóng" className="w-10 h-10 rounded-xl hover:bg-white/10">
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-4 text-sm text-slate-300 space-y-2">
            <p>Bạn đã trả lời {answeredCount}/{total} câu.</p>
            <p>Còn {unanswered} câu chưa trả lời.</p>
          </div>
          <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-300 hover:bg-white/5"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              Nộp bài
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cms-modal-shell" role="presentation" data-exam-modal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-prep-submit-title"
        className="cms-modal-panel max-w-md"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 id="cert-prep-submit-title" className="text-base font-bold text-slate-900">Bạn có chắc muốn nộp bài?</h3>
          <button type="button" onClick={onCancel} disabled={submitting} aria-label="Đóng" className="w-10 h-10 rounded-xl hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-600 space-y-2">
          <p>Bạn đã trả lời {answeredCount}/{total} câu.</p>
          <p>Còn {unanswered} câu chưa trả lời.</p>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-600"
          >
            Quay lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            Nộp bài
          </button>
        </div>
      </div>
    </div>
  );
}
