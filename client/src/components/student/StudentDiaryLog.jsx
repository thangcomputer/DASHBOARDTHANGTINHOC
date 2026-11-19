import React, { useMemo, useState } from 'react';
import { BookText, Video } from 'lucide-react';
import {
  formatLocalDateKey,
  normalizeScheduleDate,
} from '../../utils/scheduleTime';
import { startOfWeekMonday, addDays } from '../../utils/weeklySlotGrid';

function getStudentDiaryStatus(sch, now = Date.now()) {
  const status = String(sch?.status || '').toLowerCase();
  if (status === 'completed') {
    return { label: 'Đã học', tone: 'completed' };
  }
  if (status === 'cancelled') {
    return { label: 'Đã hủy', tone: 'cancelled' };
  }
  const confirmStatus = String(sch?.studentConfirmStatus || '').toLowerCase();
  if (status === 'scheduled' && (confirmStatus === 'pending' || confirmStatus === 'confirm_expired')) {
    return { label: 'Chờ xác nhận điểm danh', tone: 'awaiting_confirm' };
  }
  if (status === 'scheduled' && confirmStatus === 'disputed') {
    return { label: 'Chờ Admin xử lý', tone: 'disputed' };
  }

  const schDateStr = normalizeScheduleDate(sch?.date);
  if (!schDateStr) return { label: 'Sắp tới', tone: 'upcoming' };

  const startStr = String(sch?.startTime || '00:00');
  const endStr = String(sch?.endTime || '23:59');

  const [sh, sm] = startStr.split(':').map((v) => parseInt(v, 10) || 0);
  const [eh, em] = endStr.split(':').map((v) => parseInt(v, 10) || 0);

  const [yr, mo, da] = schDateStr.split('-').map((v) => parseInt(v, 10));
  const startTimeMs = new Date(yr, mo - 1, da, sh, sm, 0).getTime();
  const endTimeMs = new Date(yr, mo - 1, da, eh, em, 0).getTime();

  if (now >= startTimeMs && now <= endTimeMs) {
    return { label: 'Đang diễn ra', tone: 'ongoing' };
  }
  if (now > endTimeMs) {
    // Quá 60 phút sau khi kết thúc ca học thì hiển thị Quá hạn điểm danh
    const graceMs = 60 * 60 * 1000;
    if (now > endTimeMs + graceMs) {
      return { label: 'Quá hạn điểm danh', tone: 'overdue' };
    }
    return { label: 'Chưa điểm danh', tone: 'pending' };
  }
  return { label: 'Sắp tới', tone: 'upcoming' };
}

function formatScheduleDateVi(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) {
    const raw = String(dateVal).split('T')[0];
    const parts = raw.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return raw;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function StudentDiaryLog({
  schedules = [],
  student,
  isFree: _isFree = false,
  onOpenSession,
}) {
  const [filter, setFilter] = useState('Ngày');
  const todayKey = formatLocalDateKey(new Date());
  const now = new Date();
  const weekStart = startOfWeekMonday(now);
  const weekEnd = addDays(weekStart, 6);
  const weekStartKey = formatLocalDateKey(weekStart);
  const weekEndKey = formatLocalDateKey(weekEnd);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filters = [
    { value: 'Ngày', label: 'Ngày' },
    { value: 'Tuần', label: 'Tuần' },
    { value: 'Tháng', label: 'Tháng' },
    { value: 'Hủy', label: 'Hủy' },
    { value: 'Chưa điểm danh', label: 'Chưa điểm danh' },
  ];

  const filteredList = useMemo(() => {
    const all = schedules || [];
    return all.filter((item) => {
      const dayKey = normalizeScheduleDate(item.date);
      const diaryStatus = getStudentDiaryStatus(item);

      if (filter === 'Ngày') {
        return dayKey === todayKey;
      }
      if (filter === 'Tuần') {
        return dayKey >= weekStartKey && dayKey <= weekEndKey;
      }
      if (filter === 'Tháng') {
        return dayKey.startsWith(monthPrefix);
      }
      if (filter === 'Chưa điểm danh') {
        return diaryStatus.tone === 'pending' || diaryStatus.tone === 'overdue' || diaryStatus.tone === 'awaiting_confirm';
      }
      if (filter === 'Hủy') {
        return String(item.status) === 'cancelled';
      }
      return true;
    }).sort((a, b) => {
      const da = `${normalizeScheduleDate(a.date)} ${a.startTime || ''}`;
      const db = `${normalizeScheduleDate(b.date)} ${b.startTime || ''}`;
      return db.localeCompare(da);
    });
  }, [schedules, filter, todayKey, weekStartKey, weekEndKey, monthPrefix]);

  const emptyText = useMemo(() => {
    switch (filter) {
      case 'Ngày': return 'Không có ca học trong ngày hôm nay.';
      case 'Tuần': return 'Không có ca học trong tuần này.';
      case 'Tháng': return 'Không có ca học trong tháng này.';
      case 'Chưa điểm danh': return 'Không có ca chưa điểm danh.';
      case 'Hủy': return 'Không có lịch hủy.';
      default: return 'Chưa có ca học.';
    }
  }, [filter]);

  return (
    <section className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm overflow-hidden" aria-label="Nhật ký học tập">
      <div className="p-4 sm:p-5 space-y-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-50 text-emerald-600 border-emerald-100">
            <BookText size={18} />
          </div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">
            Nhật ký học tập
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`min-h-[38px] whitespace-nowrap rounded-[14px] px-4 text-xs font-black transition-all active:scale-95 ${
                  active
                    ? 'bg-emerald-600 text-white border border-emerald-600'
                    : 'bg-white text-emerald-600 border border-emerald-500 hover:bg-emerald-50/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {filteredList.length === 0 ? (
          <p className="text-sm font-semibold text-slate-400 py-8 text-center">
            {emptyText}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredList.map((item) => {
              const diaryStatus = getStudentDiaryStatus(item);
              const meetingUrl = String(
                item.meetingUrl
                || item.linkHoc
                || student?.linkHoc
                || student?.joinClassUrl
                || student?.online_meeting_url
                || '',
              ).trim();
              const isOngoing = diaryStatus.tone === 'ongoing';
              const isUpcoming = diaryStatus.tone === 'upcoming';
              const canJoin = Boolean(meetingUrl && isOngoing);
              const title = item.course || item.courseName || item.title || item.subject || 'Buổi học';
              const teacher = item.teacherName || item.teacher || 'Giảng viên';
              const dateText = formatScheduleDateVi(item.date);
              const timeText = item.startTime && item.endTime ? `${item.startTime} – ${item.endTime}` : (item.startTime || '');

              const statusColor = diaryStatus.tone === 'completed'
                ? 'text-emerald-600 font-bold'
                : diaryStatus.tone === 'ongoing'
                  ? 'text-emerald-600 font-black'
                  : diaryStatus.tone === 'awaiting_confirm'
                    ? 'text-emerald-700 font-black'
                    : diaryStatus.tone === 'disputed'
                      ? 'text-amber-600 font-black'
                      : diaryStatus.tone === 'cancelled'
                        ? 'text-rose-600 font-bold'
                        : diaryStatus.tone === 'overdue'
                          ? 'text-red-600 font-black'
                          : diaryStatus.tone === 'pending'
                            ? 'text-[#D97706] font-black'
                            : 'text-slate-600 font-bold';

              return (
                <div
                  key={item._id || item.id || `${item.date}-${item.startTime}`}
                  className="rounded-[20px] border border-slate-100 bg-[#F8FAFC] p-3.5 sm:p-4 space-y-2 transition hover:border-emerald-200 hover:bg-white shadow-xs"
                >
                  <div>
                    <h4 className="text-sm font-black text-slate-900 leading-snug">
                      {title}
                    </h4>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {teacher} · {dateText} · {timeText}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <span className={`text-xs ${statusColor}`}>
                      {diaryStatus.label}
                    </span>

                    <div className="flex items-center gap-2">
                      {diaryStatus.tone === 'awaiting_confirm' ? (
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('cms:open-student-attendance-confirm', {
                              detail: { scheduleId: String(item._id || item.id) },
                            }));
                          }}
                          className="inline-flex min-h-[34px] items-center justify-center rounded-xl active:scale-95 px-4 py-1.5 text-xs font-black text-white transition bg-emerald-600 hover:bg-emerald-700"
                        >
                          Xác nhận điểm danh
                        </button>
                      ) : null}
                      {canJoin ? (
                        <a
                          href={meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[34px] items-center justify-center rounded-xl active:scale-95 px-4 py-1.5 text-xs font-black text-white transition bg-red-500 hover:bg-red-600"
                        >
                          Vào học
                        </a>
                      ) : isUpcoming ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex min-h-[34px] items-center justify-center rounded-xl px-4 py-1.5 text-xs font-black bg-slate-200 text-slate-400 cursor-not-allowed"
                        >
                          Vào học
                        </button>
                      ) : null}

                      {typeof onOpenSession === 'function' ? (
                        <button
                          type="button"
                          onClick={() => onOpenSession(item)}
                          className="inline-flex min-h-[34px] items-center justify-center rounded-xl border bg-white active:scale-95 px-4 py-1.5 text-xs font-black transition border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                        >
                          Ghi chú / Đổi lịch
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {item.note ? (
                    <div className="rounded-xl bg-white p-2.5 text-xs text-slate-600 border border-slate-100">
                      <span className="font-bold text-slate-700">Ghi chú từ giảng viên:</span> {item.note}
                    </div>
                  ) : null}
                  {item.studentNote ? (
                    <div className="rounded-xl bg-emerald-50/60 p-2.5 text-xs text-emerald-700 border border-emerald-100">
                      <span className="font-bold text-emerald-800">Ghi chú của bạn:</span> {item.studentNote}
                    </div>
                  ) : null}
                  {item.grade != null && (
                    <p className="text-xs font-bold text-slate-600">
                      Điểm: <span className="font-black text-slate-900">{item.grade}</span>/10
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
