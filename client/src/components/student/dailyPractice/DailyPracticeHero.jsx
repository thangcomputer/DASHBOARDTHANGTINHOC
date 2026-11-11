import { CheckCircle2, Flame, Play, Sparkles, Trophy, Zap } from 'lucide-react';
import {
  pathTopicPrimaryCtaLabel,
} from '../../../../../shared/dailyPractice/lastPathTopic.mjs';
import { topicColor, topicIcon } from '../../../utils/dailyPractice';
import Mascot from './Mascot';

/** Banner luyện tập hằng ngày — thiết kế chuẩn Duolingo, gọn gàng, đồng bộ và có chiều sâu. */
export default function DailyPracticeHero({
  stats,
  mode,
  onPrimaryAction,
  primaryDisabled,
  primaryLabel,
  pathTopic = null,
  pathContinue = false,
  _freeTopicName = '',
  _onBuyXp,
}) {
  const streak = stats?.streak || 0;
  const playedToday = Boolean(stats?.playedToday);
  let mood = 'determinedSoft';
  if (playedToday) mood = 'energy';
  else if (stats?.streakState === 'lost') mood = 'sad';
  else if (stats?.streakState === 'at_risk' && streak > 0) mood = 'determined';
  else if (!playedToday) mood = 'studying';

  const pathMode = Boolean(mode === 'path' && pathTopic?.topic?.name);
  const color = pathMode ? topicColor(pathTopic.topic.color || 'red') : null;
  const totalUnits = pathTopic?.totalUnits || 0;
  const completedUnits = pathTopic?.completedUnits || 0;
  const topicDone = pathMode && totalUnits > 0 && completedUnits >= totalUnits;
  const pct = totalUnits ? Math.min(100, Math.round((completedUnits / totalUnits) * 100)) : 0;
  const barWidth = Math.max(pct, completedUnits > 0 ? 6 : 0);

  let headline = 'Sẵn sàng thử thách hôm nay chưa?';
  if (pathMode) {
    if (topicDone) headline = 'Đã hoàn thành lộ trình chủ đề này';
    else if (playedToday) headline = 'Đã luyện hôm nay — học tiếp khi bạn sẵn sàng';
    else if (stats?.streakState === 'at_risk' && streak > 0) headline = `Giữ chuỗi ${streak} ngày với lộ trình đang học`;
    else if (pathContinue) headline = 'Bước học tiếp theo đang chờ bạn';
    else headline = 'Bắt đầu hoặc chọn chặng trong lộ trình';
  } else if (playedToday) headline = 'Hôm nay bạn đã luyện tập';
  else if (stats?.streakState === 'lost') headline = 'Quay lại luyện tập mỗi ngày';
  else if (stats?.streakState === 'at_risk' && streak > 0) headline = `Chuỗi ${streak} ngày — hôm nay chưa luyện`;

  const sub = !pathMode
    ? (mode === 'path' ? 'Đang tải lộ trình…' : 'Chọn chủ đề, độ khó và hoàn thành 10 câu để nhận XP.')
    : '';

  const ctaLabel = pathMode && pathContinue
    ? pathTopicPrimaryCtaLabel(pathTopic)
    : primaryLabel;

  const TopicIcon = pathMode ? topicIcon(pathTopic.topic.icon) : Sparkles;

  const metrics = [
    {
      label: 'Chuỗi',
      value: `${streak} ngày`,
      icon: Flame,
      cardClass: 'border-orange-200/70 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/60',
      iconWrap: 'bg-gradient-to-br from-orange-100 to-amber-100 ring-orange-200/80',
      iconClass: 'text-orange-600 fill-orange-400',
      valueClass: 'text-orange-950',
    },
    {
      label: 'XP hôm nay',
      value: `${(stats?.todayXp || 0).toLocaleString('vi-VN')}`,
      icon: Zap,
      cardClass: 'border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-white to-yellow-50/60',
      iconWrap: 'bg-gradient-to-br from-amber-100 to-yellow-100 ring-amber-200/80',
      iconClass: 'text-amber-600 fill-amber-400',
      valueClass: 'text-amber-950',
    },
    {
      label: 'Tổng XP luyện',
      value: `${(stats?.xpTotal || 0).toLocaleString('vi-VN')}`,
      icon: Trophy,
      cardClass: 'border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/60',
      iconWrap: 'bg-gradient-to-br from-violet-100 to-indigo-100 ring-violet-200/80',
      iconClass: 'text-violet-600',
      valueClass: 'text-slate-900',
    },
  ];

  const accentFrom = color?.from || '#10B981';
  const accentTo = color?.to || '#059669';
  const accentSoft = color?.soft || '#ECFDF5';
  const accentText = color?.text || '#047857';

  return (
    <section
      className="relative overflow-hidden rounded-[26px] border border-slate-200/90 bg-white shadow-[0_10px_32px_-12px_rgba(15,23,42,0.08)]"
      style={{
        backgroundImage: `radial-gradient(circle at 0% 0%, ${accentSoft}85 0%, transparent 48%), radial-gradient(circle at 100% 100%, #F8FAFC 0%, transparent 50%)`,
      }}
    >
      <div className="relative flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        {/* Khối trái + giữa: Linh vật, chủ đề, tiêu đề & thanh tiến độ */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          {/* Linh vật nổi bật */}
          <div className="relative shrink-0 self-start sm:self-center">
            <div
              className="flex h-[84px] w-[84px] items-center justify-center rounded-[24px] border-2 border-white bg-white shadow-md ring-1 ring-slate-200/70 sm:h-[92px] sm:w-[92px]"
              style={{
                background: `linear-gradient(145deg, #FFFFFF 0%, ${accentSoft}90 100%)`,
                boxShadow: `0 12px 24px -10px ${accentTo}40`,
              }}
            >
              <Mascot mood={mood} size={76} />
            </div>
            {topicDone ? (
              <span
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-white"
                title="Đã hoàn thành lộ trình"
              >
                <CheckCircle2 size={15} strokeWidth={2.6} aria-hidden="true" />
              </span>
            ) : playedToday ? (
              <span
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm ring-2 ring-white"
                title="Đã luyện tập hôm nay"
              >
                <Flame size={14} className="fill-white" aria-hidden="true" />
              </span>
            ) : null}
          </div>

          {/* Thông tin lộ trình & tiến độ */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Hàng badge chủ đề & trạng thái */}
            <div className="flex flex-wrap items-center gap-2">
              {pathMode ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold tracking-wide shadow-2xs"
                  style={{
                    backgroundColor: `${accentSoft}95`,
                    borderColor: `${accentTo}30`,
                    color: accentText,
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-white shadow-2xs"
                    style={{ background: `linear-gradient(145deg, ${accentFrom}, ${accentTo})` }}
                  >
                    <TopicIcon size={11} aria-hidden="true" />
                  </span>
                  <span className="uppercase opacity-80">Lộ trình:</span>
                  <span className="truncate font-black text-slate-900" title={pathTopic.topic.name}>
                    {pathTopic.topic.name}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  <Sparkles size={13} className="text-amber-500" aria-hidden="true" />
                  Luyện tự do · Chủ đề bạn chọn
                </span>
              )}

              {topicDone ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-200/90">
                  <CheckCircle2 size={13} className="text-emerald-600" aria-hidden="true" />
                  Hoàn tất {completedUnits}/{totalUnits} chặng
                </span>
              ) : pathMode && totalUnits > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  Chặng <strong className="font-black tabular-nums" style={{ color: accentText }}>{completedUnits}/{totalUnits}</strong>
                </span>
              ) : null}
            </div>

            {/* Tiêu đề chính & mô tả phụ */}
            <div>
              <h2 className="text-lg font-black leading-snug tracking-tight text-slate-900 sm:text-[21px]">
                {headline}
              </h2>
              {!pathMode && sub ? (
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">
                  {sub}
                </p>
              ) : null}
            </div>

            {/* Thanh tiến độ chặng kiểu Duolingo (3D glossy track) */}
            {pathMode && totalUnits > 0 ? (
              <div className="pt-1">
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Tiến độ lộ trình</span>
                  <span className="font-black tabular-nums" style={{ color: accentText }}>
                    {completedUnits}/{totalUnits} chặng · {pct}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200/70">
                  <div
                    className="relative h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
                    }}
                  >
                    <div className="absolute inset-x-1.5 top-0.5 h-[3px] rounded-full bg-white/35" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Khối phải: 3 thẻ chỉ số ngang gọn gàng + Nút hành động 3D */}
        <div className="flex flex-col gap-3.5 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between xl:shrink-0 xl:flex-col xl:items-end xl:justify-center xl:border-t-0 xl:pt-0">
          {/* 3 chỉ số gamification */}
          <dl className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2.5">
            {metrics.map(({ label, value, icon: Icon, cardClass, iconWrap, iconClass, valueClass }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2 shadow-2xs ${cardClass}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${iconWrap}`}>
                  <Icon size={17} className={iconClass} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dd className={`truncate text-sm font-black leading-tight tabular-nums ${valueClass}`}>
                    {value}
                  </dd>
                  <dt className="truncate text-[11px] font-semibold leading-tight text-slate-500">
                    {label}
                  </dt>
                </div>
              </div>
            ))}
          </dl>

          {/* Nút bấm chính (không bao giờ bị rớt dòng chữ) + chú thích XP */}
          <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end xl:w-full xl:flex-row xl:items-center xl:justify-end xl:gap-3">
            <p className="order-2 text-center text-[11px] font-semibold text-slate-400 sm:text-right xl:order-1">
              XP dùng cho lượt luyện & gợi ý
            </p>
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={onPrimaryAction}
              className="cms-btn cms-btn-primary order-1 w-full justify-center whitespace-nowrap !px-6 !py-3 text-sm font-black shadow-sm sm:w-auto sm:min-w-[190px] xl:order-2"
            >
              <Play size={16} fill="currentColor" className="shrink-0" aria-hidden="true" />
              <span>{ctaLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
