import { Calendar, Video } from 'lucide-react';
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
      <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center ${freePortalUi ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/70'}`}>
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${freePortalUi ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          <Video size={22} aria-hidden="true" />
        </div>
        <p className="mt-2 text-sm font-black text-slate-900">Học Meet cùng giảng viên</p>
        <p className="mt-1 max-w-sm text-xs font-medium text-slate-600">
          Mua gói Meet online để trung tâm xếp lịch và bạn vào lớp Google Meet học trực tiếp với giáo viên.
        </p>
        <DuoButton
          variant="primary"
          size="md"
          className={`mt-3 ${freePortalUi ? '!from-emerald-500 !to-emerald-700' : ''}`}
          icon={<Video size={16} color="#FFFFFF" aria-hidden="true" />}
          label="Mua gói Meet"
          onClick={onPurchaseMeet}
        />
      </div>
    );
  }

  if (mode === 'renew') {
    return (
      <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center ${freePortalUi ? 'border-amber-200 bg-amber-50/50' : 'border-orange-200 bg-orange-50/40'}`}>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Calendar size={22} aria-hidden="true" />
        </div>
        <p className="mt-2 text-sm font-black text-slate-900">Gói Meet đã hết hạn</p>
        <p className="mt-1 max-w-sm text-xs font-medium text-slate-600">
          Gia hạn để tiếp tục nhận lịch học Meet và vào lớp cùng giảng viên.
        </p>
        <DuoButton
          variant="primary"
          size="md"
          className="mt-3"
          icon={<Calendar size={16} color="#FFFFFF" aria-hidden="true" />}
          label="Gia hạn ngay"
          onClick={onRenewMeet}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Calendar size={20} aria-hidden="true" />
      </div>
      <p className="mt-2 text-sm font-bold text-slate-700">Hôm nay không có lịch</p>
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
      ) : (
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
