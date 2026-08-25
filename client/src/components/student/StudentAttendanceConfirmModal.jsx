import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';

/**
 * Modal chặn giữa màn hình — HV phải Đồng ý / Không đồng ý điểm danh.
 * Không đóng bằng nền; không có nút X.
 */
export default function StudentAttendanceConfirmModal({
  open,
  payload,
  busy = false,
  onAccept,
  onDispute,
}) {
  const [submitting, setSubmitting] = useState(false);
  if (!open || !payload) return null;

  const sessionNo = payload.sessionNumber || payload.sessionOrdinalPreview || '?';
  const total = payload.totalSessions || payload.sessionTotalPreview;
  const teacherName = payload.teacherName || 'Giảng viên';
  const weekday = payload.weekday || '';
  const timeRange = payload.timeRange
    || [payload.startTime, payload.endTime].filter(Boolean).join(' - ');
  const dateLabel = payload.dateLabel || '';
  const course = payload.course || '';

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
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-confirm-title"
    >
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_25px_80px_-12px_rgba(0,0,0,0.55)]">
        <div className="bg-gradient-to-br from-red-700 via-red-600 to-rose-700 px-6 pt-8 pb-8 text-center text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-100/90">
            Xác nhận điểm danh
          </p>
          <p id="attendance-confirm-title" className="mt-3 text-sm font-semibold text-red-50">
            Buổi học
          </p>
          <p className="mt-1 text-5xl sm:text-6xl font-black tabular-nums tracking-tight drop-shadow">
            {sessionNo}
            {total ? (
              <span className="text-2xl sm:text-3xl font-bold text-red-100/90">/{total}</span>
            ) : null}
          </p>
          {course ? (
            <p className="mt-2 text-sm font-medium text-red-50/95">{course}</p>
          ) : null}
        </div>

        <div className="px-6 py-6 space-y-4 text-center">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Giảng viên hướng dẫn</p>
            <p className="text-base font-bold text-slate-900">{teacherName}</p>
            <p className="text-sm text-slate-600">
              {[weekday, dateLabel].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-sm font-semibold text-slate-800">
              Ca {timeRange || '—'}
            </p>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed">
            Vui lòng xác nhận buổi học này. Bạn cần chọn một trong hai nút bên dưới để tiếp tục sử dụng hệ thống.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={submitting || busy}
              onClick={() => run(onAccept)}
              className="min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition"
            >
              <Check size={18} aria-hidden="true" />
              Đồng ý
            </button>
            <button
              type="button"
              disabled={submitting || busy}
              onClick={() => run(onDispute)}
              className="min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-slate-800/20 transition"
            >
              <X size={18} aria-hidden="true" />
              Không đồng ý
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
