import { AlertTriangle, Loader2, X } from 'lucide-react';

export default function CertPrepConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="cms-modal-shell" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-prep-confirm-title"
        className="cms-modal-panel max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 id="cert-prep-confirm-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" aria-hidden="true" />
            {title}
          </h3>
          <button type="button" onClick={onCancel} aria-label="Đóng" className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-600 leading-relaxed">{message}</div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
