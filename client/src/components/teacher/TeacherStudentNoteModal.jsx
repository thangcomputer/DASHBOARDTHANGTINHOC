import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function formatDateLabel(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function formatTimeRange(payload) {
  const range = String(payload?.timeRange || '').trim();
  if (range) return range;
  const start = payload?.startTime || '';
  const end = payload?.endTime || '';
  if (start && end) return `${start} – ${end}`;
  return start || '—';
}

export function isStudentScheduleNoteNotif(n) {
  if (String(n?.payload?.kind || '') === 'student_schedule_note') return true;
  return String(n?.title || '').includes('Ghi chú mới từ học viên');
}

/** Thông báo ghi chú bị thu hồi khi HV xóa ghi chú. */
export function isRetractedStudentScheduleNote(n, data) {
  if (!n || !data) return false;
  const ids = new Set((data.ids || []).map(String));
  const nid = String(n.id || n._id || '');
  if (nid && ids.has(nid)) return true;
  const scheduleId = String(data.scheduleId || '');
  const payload = n.payload || {};
  const payloadSid = String(payload.scheduleId || '');
  const isNoteTitle = String(n.title || '').includes('Ghi chú mới từ học viên')
    || String(payload.kind || '') === 'student_schedule_note';
  if (scheduleId && payloadSid && payloadSid === scheduleId && isNoteTitle) return true;
  if (isNoteTitle && !payloadSid) {
    const name = String(data.studentName || '').trim();
    const text = `${n.message || ''} ${n.content || ''}`;
    if (name && text.includes(name)) return true;
  }
  return false;
}

export default function TeacherStudentNoteModal({ open, payload, onClose }) {
  if (!open || !payload) return null;

  const studentName = payload.studentName || 'Học viên';
  const dateLabel = payload.dateLabel || formatDateLabel(payload.date);
  const timeRange = formatTimeRange(payload);
  const course = payload.course || '';
  const note = String(payload.studentNote || payload.note || '').trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-student-note-title"
    >
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_25px_80px_-12px_rgba(0,0,0,0.55)]">
        <div className="relative px-6 pt-6 pb-5 text-white bg-gradient-to-br from-red-700 via-red-600 to-red-500">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
            aria-label="Đóng"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-100/90">
            Ghi chú học viên
          </p>
          <p id="teacher-student-note-title" className="mt-2 text-lg font-black">
            {studentName}
          </p>
          {course ? (
            <p className="mt-1 text-sm font-medium text-red-50/95">{course}</p>
          ) : null}
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ngày</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{dateLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Giờ</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{timeRange}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-400">Nội dung ghi chú</p>
            {payload.deleted ? (
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed font-semibold">
                Học viên đã xóa ghi chú này. Không còn hoạt động trên lịch.
              </p>
            ) : (
              <p className="text-sm text-slate-800 mt-1.5 leading-relaxed whitespace-pre-wrap">
                {note || 'Không có nội dung ghi chú.'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
