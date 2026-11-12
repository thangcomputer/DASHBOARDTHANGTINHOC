import { Award, Check, Flame, Sparkles } from 'lucide-react';
import MascotEmotion from './MascotEmotion';
import { getStreakMilestone, STREAK_MILESTONES, useAnimatedNumber } from './animationConstants';

/**
 * Biểu tượng ngọn lửa phản ứng khi chuỗi ngày học tăng hoặc đạt mốc.
 */
export function ReactiveStreakFlame({
  streak = 0,
  streakIncreased = false,
  size = 20,
  className = '',
}) {
  const active = Number(streak) > 0;
  return (
    <span
      data-streak-reactive={streakIncreased ? 'increased' : active ? 'active' : 'idle'}
      className={`relative inline-flex items-center justify-center ${
        streakIncreased ? 'dp-flame-burst' : active ? 'dp-flame' : ''
      } ${className}`}
    >
      <Flame
        size={size}
        className={
          active
            ? 'fill-orange-400 text-orange-500 drop-shadow-[0_2px_6px_rgba(249,115,22,0.35)]'
            : 'fill-slate-200 text-slate-400'
        }
        aria-hidden="true"
      />
      {streakIncreased && (
        <Sparkles
          size={Math.max(10, Math.round(size * 0.55))}
          className="dp-twinkle absolute -right-1 -top-1 fill-amber-300 text-amber-500"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

/**
 * StreakCelebration - Hiển thị ngọn lửa phản ứng và lời chúc mừng ở các mốc 3, 7, 30 ngày:
 * - Chỉ đọc dữ liệu streak thực tế từ backend (không tự tăng streak khi mở trang).
 * - Hiển thị huy hiệu mốc 3, 7, 30 ngày rõ ràng.
 */
export default function StreakCelebration({
  streak = 0,
  streakIncreased = false,
  week = [],
  compact = false,
  className = '',
}) {
  const days = Math.max(0, Number(streak) || 0);
  const animatedDays = useAnimatedNumber(days, 700, true);
  const milestone = getStreakMilestone(days);

  if (compact) {
    if (!milestone) return null;
    return (
      <div
        data-streak-milestone={milestone.days}
        className={`inline-flex items-center gap-2 rounded-full border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 px-3 py-1 text-xs font-extrabold text-orange-900 shadow-2xs ${className}`}
      >
        <ReactiveStreakFlame streak={days} streakIncreased={streakIncreased} size={15} />
        <span>{milestone.title}</span>
        <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
          {milestone.badge}
        </span>
      </div>
    );
  }

  return (
    <div
      data-streak-celebration={days}
      className={`flex flex-col items-center gap-4 text-center ${className}`}
    >
      {/* Khung lời chúc linh vật */}
      <div className="dp-card-in flex items-center gap-3 rounded-2xl border-2 border-orange-200/90 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/80 px-4 py-3 text-left shadow-xs">
        <MascotEmotion emotion="streak" size={56} className="shrink-0" />
        <div className="min-w-0 flex-1">
          {milestone ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-800">
                <Award size={12} className="text-orange-600" aria-hidden="true" />
                {milestone.badge} · Mốc {milestone.days} ngày
              </span>
              <p className="mt-1 text-sm font-black text-slate-900">{milestone.title}</p>
              <p className="text-xs font-semibold text-slate-600">{milestone.message}</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-700">
              {days > 1
                ? `Chuỗi ${days} ngày rồi! Giữ lửa mỗi ngày để đạt các mốc 3, 7 và 30 ngày nhé.`
                : 'Chuỗi tỏa sáng! Hãy luyện tập mỗi ngày để tạo thói quen học tập nhé.'}
            </p>
          )}
        </div>
      </div>

      {/* Ngọn lửa lớn phản ứng */}
      <div className="dp-flame relative flex h-36 w-36 items-center justify-center">
        <Flame size={140} className="fill-orange-400 text-orange-500 drop-shadow-md" aria-hidden="true" />
        <Flame size={70} className="absolute bottom-3 fill-amber-300 text-amber-300" aria-hidden="true" />
      </div>

      <div>
        <p className="text-7xl font-black leading-none text-orange-500 tabular-nums">{animatedDays}</p>
        <p className="mt-1 text-2xl font-black text-orange-500">ngày liên tiếp</p>
      </div>

      {/* Tiến trình các mốc 3 · 7 · 30 ngày */}
      <div className="grid w-full grid-cols-3 gap-2">
        {STREAK_MILESTONES.map((item) => {
          const reached = days >= item.days;
          return (
            <div
              key={item.days}
              className={`rounded-2xl border px-2.5 py-2 text-center transition ${
                reached
                  ? 'border-orange-300 bg-gradient-to-b from-orange-50 to-amber-50/70 text-orange-900 shadow-2xs'
                  : 'border-slate-200 bg-slate-50/70 text-slate-400'
              }`}
            >
              <p className="flex items-center justify-center gap-1 text-xs font-black">
                <Flame
                  size={13}
                  className={reached ? 'fill-orange-400 text-orange-500' : 'text-slate-300'}
                  aria-hidden="true"
                />
                <span>Mốc {item.days} ngày</span>
              </p>
              <p className="mt-0.5 truncate text-[10px] font-bold">
                {reached ? `✓ ${item.badge}` : item.badge}
              </p>
            </div>
          );
        })}
      </div>

      {/* Lịch tuần lễ */}
      {week?.length > 0 && (
        <div className="grid w-full grid-cols-7 gap-1.5">
          {week.map((day, index) => (
            <div key={day.day} className="flex flex-col items-center gap-1.5">
              <span className={`text-xs font-black ${day.today ? 'text-orange-500' : 'text-slate-400'}`}>
                {day.label}
              </span>
              <span
                className={`dp-card-in flex h-9 w-9 items-center justify-center rounded-full ${
                  day.played ? 'bg-orange-500 text-white shadow-xs' : 'bg-slate-200'
                }`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                {day.played && <Check size={18} strokeWidth={3.5} aria-hidden="true" />}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

