import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';

function formatConfirmedAt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Popup GV: học viên đã xác nhận điểm danh (chỉ xem thông tin).
 */
export default function TeacherAttendanceConfirmedModal({ open, payload, onClose }) {
  if (!open || !payload) return null;

  const sessionNo = payload.sessionNumber || payload.sessionOrdinalPreview || '?';
  const total = payload.totalSessions || payload.sessionTotalPreview;
  const studentName = payload.studentName || 'Học viên';
  const weekday = payload.weekday || '';
  const dateLabel = payload.dateLabel || '';
  const timeRange = payload.timeRange
    || [payload.startTime, payload.endTime].filter(Boolean).join(' - ');
  const course = payload.course || '';
  const confirmedAt = payload.confirmedAt || payload.studentConfirmedAt;

  const node = (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-attendance-confirmed-title"
    >
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_25px_80px_-12px_rgba(0,0,0,0.55)]">
        <div className="relative px-6 pt-8 pb-8 text-center text-white bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
            aria-label="Đóng"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-100/90">
            Học viên đã xác nhận
          </p>
          <p id="teacher-attendance-confirmed-title" className="mt-3 text-sm font-semibold text-emerald-50">
            Buổi học
          </p>
          <p className="mt-1 text-5xl sm:text-6xl font-black tabular-nums tracking-tight drop-shadow">
            {sessionNo}
            {total ? (
              <span className="text-2xl sm:text-3xl font-bold text-emerald-100/90">/{total}</span>
            ) : null}
          </p>
          {course ? (
            <p className="mt-2 text-sm font-medium text-emerald-50/95">{course}</p>
          ) : null}
        </div>

        <div className="px-6 py-6 space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left space-y-2.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Học viên</p>
              <p className="text-base font-bold text-slate-900">{studentName}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ca</p>
              <p className="text-sm font-semibold text-slate-800">
                {timeRange || '—'}
              </p>
              <p className="text-sm text-slate-600">
                {[weekday, dateLabel].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Xác nhận lúc</p>
              <p className="text-sm font-semibold text-slate-800">{formatConfirmedAt(confirmedAt)}</p>
            </div>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed text-center">
            Học viên đã đồng ý điểm danh — buổi này đã được tính vào tiến độ.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-800/20 transition"
          >
            <Check size={18} aria-hidden="true" />
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
