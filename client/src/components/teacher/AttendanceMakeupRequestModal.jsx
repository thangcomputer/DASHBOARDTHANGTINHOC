import React, { useCallback, useMemo, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { messagesAPI } from '../../services/api';
import { useToast } from '../../utils/toast';
import {
  buildAttendanceMakeupDraft,
  getMakeupSessionSummary,
  pickAdminContactForMakeup,
} from '../../utils/attendanceMakeupRequest';
import {
  getMakeupPending,
  makeupPendingKey,
  markMakeupPending,
} from '../../utils/attendanceMakeupPendingStore';

/**
 * Popup yêu cầu điểm danh bù (GV → Admin).
 * Dùng từ Nhật ký giảng dạy; không thay thế nút trên thẻ HV.
 */
export default function AttendanceMakeupRequestModal({
  open,
  onClose,
  student,
  schedule,
  teacherName = 'Giảng viên',
  teacherId = '',
}) {
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const summary = useMemo(
    () => getMakeupSessionSummary({ student, schedule }),
    [student, schedule],
  );

  const pendingKey = useMemo(() => makeupPendingKey({
    scheduleId: schedule?._id || schedule?.id,
    studentId: student?._id || student?.id,
    date: schedule?.date,
    course: student?.course || schedule?.course,
  }), [schedule, student]);

  const alreadyPending = Boolean(pendingKey && getMakeupPending(pendingKey));

  const handleSend = useCallback(async () => {
    if (alreadyPending || sending) return;
    setSending(true);
    try {
      const draft = buildAttendanceMakeupDraft({
        student,
        schedule,
        teacherName,
      });
      let peer = { id: 'admin', name: 'Admin', role: 'admin', adminRole: 'SUPER_ADMIN' };
      try {
        const res = await messagesAPI.getContacts();
        if (res?.success) {
          peer = pickAdminContactForMakeup(res.data || []);
        }
      } catch {
        /* fallback admin mailbox */
      }
      await messagesAPI.send({
        senderId: teacherId || 'teacher',
        senderName: teacherName,
        senderRole: 'teacher',
        receiverId: String(peer.id),
        receiverName: peer.name || 'Admin',
        receiverRole: peer.role || 'admin',
        content: draft,
        messageType: 'text',
      });
      if (pendingKey) {
        markMakeupPending(pendingKey, {
          scheduleId: String(schedule?._id || schedule?.id || ''),
          studentId: String(student?._id || student?.id || ''),
        });
      }
      onClose?.();
      toast.success('Đã gửi yêu cầu điểm danh bù tới Admin.');
    } catch (err) {
      toast.error(err?.message || 'Không gửi được yêu cầu. Thử lại sau.');
    } finally {
      setSending(false);
    }
  }, [
    alreadyPending,
    sending,
    student,
    schedule,
    teacherName,
    teacherId,
    pendingKey,
    onClose,
    toast,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-4 animate-in fade-in duration-300"
      role="presentation"
      onClick={() => !sending && onClose?.()}
    >
      <div
        className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white flex justify-between items-start gap-3">
          <div>
            <h3 className="font-black text-lg uppercase tracking-tight">Điểm danh bù</h3>
            <p className="text-amber-50 text-xs font-bold mt-1">Quá hạn cửa sổ điểm danh 1 giờ</p>
          </div>
          <button
            type="button"
            onClick={() => !sending && onClose?.()}
            className="hover:bg-white/10 p-2 rounded-2xl transition-all shrink-0"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Thông tin buổi học</p>
            <p className="font-bold text-slate-800">HV: {summary.name}</p>
            {summary.course ? (
              <p className="text-slate-600">
                Khóa: <span className="font-semibold text-blue-700">{summary.course}</span>
              </p>
            ) : null}
            {summary.total > 0 ? (
              <p className="text-slate-600">
                Buổi: <span className="font-black">{summary.sessionNo}/{summary.total}</span>
              </p>
            ) : null}
            <p className="text-slate-600">
              Lịch: <span className="font-semibold">{summary.dateLabel}</span>
            </p>
            <p className="text-slate-600">
              Giờ: <span className="font-semibold">{summary.timeRange}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-slate-700 leading-relaxed">
            <p className="font-bold text-slate-900">Giảng viên lưu ý:</p>
            <p>Bạn chịu trách nhiệm về buổi học này.</p>
            <p>
              Admin sẽ liên hệ học viên để xác nhận học viên đã học buổi này chưa.
              Chỉ khi học viên đồng ý đã học, buổi này mới được tính cho giảng viên.
            </p>
          </div>
          {alreadyPending ? (
            <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Đã gửi yêu cầu — chờ Admin xét duyệt điểm danh bù.
            </p>
          ) : null}
        </div>
        <div className="bg-slate-50 px-6 py-5 flex gap-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={sending}
            className="flex-1 py-3.5 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || alreadyPending}
            className="flex-[1.4] py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-black shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
