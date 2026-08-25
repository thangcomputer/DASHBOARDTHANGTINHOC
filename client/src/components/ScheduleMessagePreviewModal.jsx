import { createPortal } from 'react-dom';
import { Calendar, Clock, BookOpen, X } from 'lucide-react';

/**
 * Modal xem nhanh lịch từ tin nhắn hệ thống «Đã xếp lịch…».
 */
export default function ScheduleMessagePreviewModal({ open, data, onClose }) {
  if (!open || !data) return null;

  const node = (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-msg-preview-title"
    >
      <div className="absolute inset-0 bg-slate-950/55" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-violet-50">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="schedule-msg-preview-title" className="font-bold text-slate-900 text-sm">
              Lịch học đã xếp
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Chi tiết ca giảng viên đã sắp</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-violet-100 text-slate-500"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-slate-700">
          <div className="flex items-start gap-2.5">
            <Calendar size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Thứ · Ngày</p>
              <p className="font-semibold text-slate-900">
                {[data.weekday, data.dateLabel].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Giờ học</p>
              <p className="font-semibold text-slate-900">
                {data.startTime && data.endTime
                  ? `${data.startTime} – ${data.endTime}`
                  : (data.timeRange || '—')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <BookOpen size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Buổi học / Khóa</p>
              <p className="font-semibold text-slate-900">{data.course || '—'}</p>
            </div>
          </div>
          {(data.studentName || data.teacherName) ? (
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600 space-y-1">
              {data.studentName ? (
                <p><span className="font-semibold text-slate-500">HV:</span> {data.studentName}</p>
              ) : null}
              {data.teacherName ? (
                <p><span className="font-semibold text-slate-500">GV:</span> {data.teacherName}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-10 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

/** Parse tin cũ không có payload. */
export function parseScheduleSystemContent(content) {
  const raw = String(content || '');
  if (!/đã xếp lịch/i.test(raw) && !/xếp lịch học thành công/i.test(raw)) {
    return null;
  }
  const m = raw.match(
    /ngày\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+từ\s+(\d{1,2}:\d{2})\s+đến\s+(\d{1,2}:\d{2})/i,
  );
  if (!m) return null;
  const dateLabel = m[1];
  const startTime = m[2];
  const endTime = m[3];
  let weekday = '';
  try {
    const [dd, mm, yyyy] = dateLabel.split('/').map((x) => parseInt(x, 10));
    if (dd && mm && yyyy) {
      const d = new Date(yyyy, mm - 1, dd);
      weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    }
  } catch { /* ignore */ }
  return {
    kind: 'schedule_created',
    dateLabel,
    weekday,
    startTime,
    endTime,
    timeRange: `${startTime} – ${endTime}`,
    course: '',
  };
}

export function resolveScheduleMessagePayload(msg) {
  const p = msg?.payload;
  if (p && typeof p === 'object' && (p.kind === 'schedule_created' || p.scheduleId || p.dateLabel || p.date)) {
    const dateLabel = p.dateLabel
      || (p.date
        ? (() => {
          try {
            const d = new Date(p.date);
            if (!Number.isNaN(d.getTime())) {
              return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            }
          } catch { /* ignore */ }
          const s = String(p.date);
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const [y, m, d] = s.slice(0, 10).split('-');
            return `${d}/${m}/${y}`;
          }
          return s;
        })()
        : '');
    let weekday = p.weekday || '';
    if (!weekday && dateLabel) {
      try {
        const [dd, mm, yyyy] = dateLabel.split('/').map((x) => parseInt(x, 10));
        if (dd && mm && yyyy) {
          weekday = new Date(yyyy, mm - 1, dd).toLocaleDateString('vi-VN', { weekday: 'long' });
        }
      } catch { /* ignore */ }
    }
    return {
      kind: 'schedule_created',
      scheduleId: p.scheduleId || null,
      dateLabel,
      weekday,
      startTime: p.startTime || '',
      endTime: p.endTime || '',
      timeRange: p.timeRange || ([p.startTime, p.endTime].filter(Boolean).join(' – ')),
      course: p.course || '',
      studentName: p.studentName || '',
      teacherName: p.teacherName || '',
    };
  }
  return parseScheduleSystemContent(msg?.content);
}
