import { Flame, Play, Zap } from 'lucide-react';
import Mascot from './Mascot';

/** Banner chính: chuỗi ngày + l lời kêu gọi + CTA (dữ liệu từ overview.stats). */
export default function DailyPracticeHero({ stats, mode, onPrimaryAction, primaryDisabled, primaryLabel }) {
  const streak = stats?.streak || 0;
  const playedToday = Boolean(stats?.playedToday);
  let mood = 'determinedSoft';
  if (playedToday) mood = 'energy';
  else if (stats?.streakState === 'lost') mood = 'sad';
  else if (stats?.streakState === 'at_risk' && streak > 0) mood = 'determined';
  else if (!playedToday) mood = 'studying';

  let headline = 'Sẵn sàng thử thách hôm nay chưa?';
  if (playedToday) headline = 'Hôm nay bạn đã luyện tập. Giữ phong độ nhé!';
  else if (stats?.streakState === 'lost') headline = `Lấy lại phong độ nào!${stats?.lostStreak ? ` Bạn vừa lỡ chuỗi ${stats.lostStreak} ngày` : ''}`;
  else if (stats?.streakState === 'at_risk' && streak > 0) headline = `Giữ lửa chuỗi ${streak} ngày. Hôm nay chưa luyện!`;

  const sub = mode === 'path'
    ? 'Theo lộ trình từng chặng: học video, luyện 3 nấc và mở khóa bước tiếp theo.'
    : 'Chọn chủ đề và độ khó, hoàn thành 10 câu để nhận XP và giữ chuỗi ngày.';

  return (
    <section className="dp-hero relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-red-900 p-5 text-white shadow-lg ring-1 ring-slate-900/10 sm:p-6 lg:flex lg:items-center lg:gap-8 lg:p-8">
      <span className="cms-goal-droplet left-8 top-6 h-5 w-5 opacity-80" aria-hidden="true" />
      <span className="cms-goal-droplet cms-goal-droplet--amber right-16 top-10 h-3 w-3 [animation-delay:1s]" aria-hidden="true" />
      <div className="relative flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
        <Mascot mood={mood} size={96} className="mx-auto shrink-0 sm:mx-0 lg:size-[108px]" />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          {streak > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-200 ring-1 ring-white/15">
              <Flame size={14} className="fill-amber-300 text-amber-400" aria-hidden="true" />
              Chuỗi luyện tập · {streak} ngày
            </p>
          )}
          <h2 className="mt-2 text-xl font-black leading-snug sm:text-2xl lg:text-[1.65rem]">{headline}</h2>
          <p className="mt-1.5 max-w-xl text-sm text-slate-300">{sub}</p>
          {!playedToday && stats?.todayPlayers > 0 && (
            <p className="mt-1 text-xs font-semibold text-emerald-300">{stats.todayPlayers} bạn đã luyện hôm nay</p>
          )}
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={onPrimaryAction}
            className="cms-btn mt-4 w-full !border-0 !bg-white !py-3 text-base !font-black !text-red-700 shadow-md hover:!bg-red-50 sm:w-auto sm:!px-8"
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
            {primaryLabel}
          </button>
        </div>
      </div>
      <div className="relative mt-5 lg:mt-0 lg:w-[min(100%,320px)] lg:shrink-0">
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Flame, value: streak, label: 'Ngày liên tiếp' },
            { icon: Zap, value: stats?.todayXp || 0, label: 'XP luyện hôm nay' },
            { icon: Zap, value: stats?.xpTotal || 0, label: 'XP luyện' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl bg-white/10 px-2 py-3 text-center ring-1 ring-white/10 backdrop-blur-sm">
              <Icon size={18} className="mx-auto text-amber-300" aria-hidden="true" />
              <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
              <p className="text-[10px] font-semibold text-slate-300">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold leading-relaxed text-slate-300 lg:text-right">
          XP luyện để chơi và mở gợi ý. Trong đó XP đã mua: {stats?.purchasedXp || 0}. XP học bài nằm ở thẻ Học bài.
        </p>
      </div>
    </section>
  );
}
