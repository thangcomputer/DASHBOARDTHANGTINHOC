import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, X } from 'lucide-react';

/** Modal Admin xử lý tranh chấp điểm danh */
export default function AdminAttendanceDisputeModal({
  open,
  payload,
  busy = false,
  onApprove,
  onReject,
  onClose,
}) {
  const [submitting, setSubmitting] = useState(false);
  if (!open || !payload) return null;

  const sessionNo = payload.sessionNumber || '?';
  const run = async (fn) => {
    if (submitting || busy) return;
    setSubmitting(true);
    try {
      await fn?.();
    } finally {
      setSubmitting(false);
    }
  };

  const node = (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60" onClick={() => !submitting && onClose?.()} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="bg-amber-50 px-5 py-4 border-b border-amber-100 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={22} />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900">Tranh chấp điểm danh</h2>
            <p className="text-sm text-slate-600 mt-1">
              Buổi <span className="font-black text-amber-700">{sessionNo}</span>
              {payload.totalSessions ? `/${payload.totalSessions}` : ''}
              {' · '}{payload.course || 'khóa học'}
            </p>
          </div>
          <button type="button" onClick={() => onClose?.()} className="p-2 rounded-lg hover:bg-amber-100 text-slate-500" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm text-slate-700">
          <p><span className="font-semibold text-slate-500">HV:</span> {payload.studentName || '—'}</p>
          <p><span className="font-semibold text-slate-500">GV:</span> {payload.teacherName || '—'}</p>
          <p><span className="font-semibold text-slate-500">Ca:</span> {[payload.weekday, payload.dateLabel, payload.timeRange].filter(Boolean).join(' · ') || '—'}</p>
          <p className="text-xs text-slate-500 pt-2">
            Chấp thuận › tính buổi &amp; lương. Không chấp thuận › hủy buổi, không tính, báo GV + HV.
          </p>
        </div>
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => run(onApprove)}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
          >
            <Check size={16} /> Chấp thuận
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => run(onReject)}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold disabled:opacity-60"
          >
            <X size={16} /> Không chấp thuận
          </button>
        </div>
      </div>
    </div>
  );
  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
