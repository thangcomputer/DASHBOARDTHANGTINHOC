import { Loader2, X } from 'lucide-react';

export default function CertPrepExitDialog({
  open,
  exam = false,
  leaving = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  if (exam) {
    return (
      <div className="fixed inset-0 z-[100080] flex items-center justify-center p-4 bg-black/70" role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cert-prep-exit-title"
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121826] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 id="cert-prep-exit-title" className="text-base font-bold text-white">Thoát khỏi bài thi?</h3>
            <button
              type="button"
              onClick={onCancel}
              disabled={leaving}
              aria-label="Đóng"
              className="w-10 h-10 rounded-xl hover:bg-white/5 text-slate-400"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-4 text-sm text-slate-300 leading-relaxed">
            Bạn có muốn thoát khỏi bài thi? Đồng hồ sẽ tạm dừng; tiến độ được giữ để bấm <strong className="text-white">Tiếp tục</strong> sau.
          </div>
          <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={leaving}
              className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-300 hover:bg-white/5"
            >
              Ở lại
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={leaving}
              className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {leaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              Thoát
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cms-modal-shell" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="cert-prep-exit-title" className="cms-modal-panel max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 id="cert-prep-exit-title" className="text-base font-bold text-slate-900">Thoát khỏi bài thi?</h3>
          <button type="button" onClick={onCancel} aria-label="Đóng" className="w-10 h-10 rounded-xl hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-600 leading-relaxed">
          Bạn có muốn thoát khỏi bài thi? Đồng hồ sẽ tạm dừng; tiến độ được giữ để bấm Tiếp tục sau.
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-600">
            Ở lại
          </button>
          <button type="button" onClick={onConfirm} className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white">
            Thoát
          </button>
        </div>
      </div>
    </div>
  );
}
