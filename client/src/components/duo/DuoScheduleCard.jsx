import React, { useMemo } from 'react';
import { Calendar, Clock, Video } from 'lucide-react';
import { DuoButton } from './DuoButton';

function buildScheduleList({ schedules, todayClasses, meetCards }) {
  if (schedules?.length) return schedules;
  const list = [];
  (meetCards || []).forEach((m) => {
    list.push({
      id: m._id || m.id || m.slotKey || `meet-${m.slotLabel}-${m.startTime}`,
      title: m.slotLabel || 'Ca học Meet',
      time: `${m.startTime || ''} – ${m.endTime || ''}`,
      dateLabel: m.dayLabel || 'Hôm nay',
      meetLink: m.linkHoc,
      live: m.live,
    });
  });
  (todayClasses || []).forEach((c) => {
    list.push({
      id: c.id,
      title: c.title,
      time: c.time,
      dateLabel: c.dateLabel,
      meetLink: c.meetLink,
      live: c.live,
      teacher: c.teacher,
    });
  });
  return list;
}

export function DuoScheduleCard({
  schedules,
  todayClasses = [],
  meetCards = [],
  firstSchedule = null,
  nextMeet = null,
  onPressAllSchedule,
  onOpenSchedule,
}) {
  const onAll = onOpenSchedule || onPressAllSchedule;
  const resolvedList = useMemo(
    () => buildScheduleList({ schedules, todayClasses, meetCards }),
    [schedules, todayClasses, meetCards],
  );

  if (!resolvedList.length) {
    const upcomingText = firstSchedule
      ? `Lịch tới: ${firstSchedule.title || 'Buổi học'} · ${firstSchedule.time} (${firstSchedule.dateLabel})`
      : nextMeet
        ? `Lớp tới: ${nextMeet.slotLabel || 'Ca học'} · ${nextMeet.startTime}–${nextMeet.endTime} (${nextMeet.dayLabel})`
        : 'Thoải mái tự luyện tập và nâng cao chuỗi ngày 🔥';

    return (
      <section className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-emerald-200 bg-emerald-50 p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <Calendar size={18} className="text-emerald-600" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-emerald-900">Hôm nay không có lịch học Meet</p>
          <p className="mt-0.5 text-xs font-medium text-emerald-700">{upcomingText}</p>
        </div>
        {onAll ? (
          <button
            type="button"
            onClick={onAll}
            className="shrink-0 rounded-xl border-[1.5px] border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-600"
          >
            Xem lịch
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="duo-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue-50">
            <Calendar size={18} className="text-blue-600" aria-hidden="true" />
          </span>
          <h3 className="text-base font-black text-slate-900">Lịch học Meet</h3>
        </div>
        {onAll ? (
          <button
            type="button"
            onClick={onAll}
            className="rounded-xl border-[1.5px] border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-600"
          >
            Xem lịch
          </button>
        ) : null}
      </div>
      <ul className="space-y-2.5">
        {resolvedList.map((item) => (
          <li
            key={item.id}
            className={`flex flex-col gap-3 rounded-2xl border-[1.5px] p-3 sm:flex-row sm:items-center sm:justify-between ${
              item.live ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {item.live ? (
                  <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white">
                    ĐANG DIỄN RA
                  </span>
                ) : null}
                <p className="truncate text-sm font-extrabold text-slate-800">{item.title}</p>
              </div>
              <p className="flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                <Clock size={13} aria-hidden="true" />
                <span>{item.time}</span>
                <span>·</span>
                <span>{item.dateLabel}</span>
                {item.teacher ? (
                  <>
                    <span>·</span>
                    <span className="font-bold text-emerald-700">GV: {item.teacher}</span>
                  </>
                ) : null}
              </p>
            </div>
            {item.meetLink ? (
              <DuoButton
                variant={item.live ? 'primary' : 'blue'}
                size="sm"
                className="shrink-0 self-start sm:self-center"
                icon={<Video size={14} color="#FFFFFF" aria-hidden="true" />}
                label="Vào Meet"
                onClick={() => {
                  window.open(item.meetLink, '_blank', 'noopener,noreferrer');
                }}
              />
            ) : (
              <span className="shrink-0 rounded-[10px] bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-400">
                Chưa có link
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
