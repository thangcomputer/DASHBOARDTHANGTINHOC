import { BookOpen, Calendar } from 'lucide-react';
import { DuoButton } from '../duo';
import { meetLessonName } from '../../utils/meetJoin';

/**
 * Empty "Lịch học hôm nay" cho HV cổng miễn phí / gói Meet.
 * @param {'default'|'purchase'|'renew'} mode
 */
export default function MeetScheduleEmptyState({
  mode = 'default',
  freePortalUi = false,
  nextSchedule = null,
  sessionRange = '',
  formatDayLabel = (d) => d,
  nextMeet = null,
  onViewSchedule,
  onPurchaseMeet,
  onRenewMeet,
}) {
  if (mode === 'purchase') {
    return (
      <div className={`flex flex-col items-center justify-center p-4 text-center ${freePortalUi ? 'rounded-2xl bg-slate-50/75 border border-white py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]' : 'rounded-xl border border-dashed border-emerald-200/80 bg-emerald-50/30'}`}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100/90 text-emerald-600 shadow-2xs">
          <BookOpen size={22} aria-hidden="true" />
        </div>
        <p className="mt-2.5 text-sm font-extrabold text-slate-900">Đăng ký khóa học</p>
        <p className="mt-1 max-w-sm text-xs font-medium text-slate-600">
          Khám phá danh mục khóa học DewSkill để chọn lộ trình phù hợp, học thực hành và chấm điểm trực tiếp.
        </p>
        {freePortalUi ? (
          <button
            type="button"
            onClick={onPurchaseMeet}
            className="dew-btn-primary mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
          >
            <BookOpen size={15} color="#FFFFFF" aria-hidden="true" /> Đăng ký khóa học
          </button>
        ) : (
          <DuoButton
            variant="primary"
            size="md"
            className="mt-3 !from-emerald-500 !to-emerald-700"
            icon={<BookOpen size={16} color="#FFFFFF" aria-hidden="true" />}
            label="Đăng ký khóa học"
            onClick={onPurchaseMeet}
          />
        )}
      </div>
    );
  }

  if (mode === 'renew') {
    return (
      <div className={`flex flex-col items-center justify-center p-4 text-center ${freePortalUi ? 'rounded-2xl bg-slate-50/75 border border-white py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]' : 'rounded-xl border border-dashed border-orange-200 bg-orange-50/40'}`}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-2xs">
          <Calendar size={22} aria-hidden="true" />
        </div>
        <p className="mt-2.5 text-sm font-extrabold text-slate-900">Gói Meet đã hết hạn</p>
        <p className="mt-1 max-w-sm text-xs font-medium text-slate-600">
          Gia hạn để tiếp tục nhận lịch học Meet và vào lớp cùng giảng viên.
        </p>
        {freePortalUi ? (
          <button
            type="button"
            onClick={onRenewMeet}
            className="dew-btn-primary mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
          >
            <Calendar size={15} color="#FFFFFF" aria-hidden="true" /> Gia hạn ngay
          </button>
        ) : (
          <DuoButton
            variant="primary"
            size="md"
            className="mt-3"
            icon={<Calendar size={16} color="#FFFFFF" aria-hidden="true" />}
            label="Gia hạn ngay"
            onClick={onRenewMeet}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center ${freePortalUi ? 'rounded-2xl bg-slate-50/70 border border-white py-8 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]' : 'rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4'}`}>
      <div className={`flex items-center justify-center text-slate-400 ${freePortalUi ? 'h-11 w-11 rounded-2xl bg-slate-200/70 text-slate-500' : 'h-10 w-10 rounded-full bg-slate-100'}`}>
        <Calendar size={20} aria-hidden="true" />
      </div>
      <p className="mt-2.5 text-sm font-bold text-slate-700">
        {freePortalUi ? 'Hôm nay chưa có lịch Meet' : 'Hôm nay không có lịch'}
      </p>
      {nextSchedule ? (
        <p className="mt-1 text-xs font-medium text-slate-500">
          Lịch tới: <strong className="text-slate-800">{nextSchedule.title || nextSchedule.subject || 'Buổi học'}</strong>
          {' · '}
          {sessionRange} ({formatDayLabel(nextSchedule.date)})
        </p>
      ) : nextMeet ? (
        <p className="mt-1 text-xs font-medium text-slate-500">
          Lịch Meet tới: <strong className="text-slate-800">{meetLessonName(nextMeet)}</strong>
          {' · '}
          {nextMeet.startTime}–{nextMeet.endTime} ({formatDayLabel(nextMeet.day)})
        </p>
      ) : freePortalUi ? null : (
        <p className="mt-1 text-xs text-slate-400">Bạn có thể tự ôn luyện hoặc làm bài tập hôm nay nhé!</p>
      )}
      {onViewSchedule ? (
        <DuoButton
          variant="secondary"
          size="sm"
          className="mt-3"
          icon={<Calendar size={14} className="text-slate-600" aria-hidden="true" />}
          label="Xem lịch học"
          onClick={onViewSchedule}
        />
      ) : null}
    </div>
  );
}
