import { useMemo } from 'react';
import { CalendarCheck, Flame, Layers, Play, Sparkles, Star, Zap } from 'lucide-react';
import { pathTopicPrimaryCtaLabel } from '../../../../../shared/dailyPractice/lastPathTopic.mjs';
import Mascot from './Mascot';
import { SoundToggleButton } from './GameButton';
import { AnimatedXpCounter } from './XPRewardAnimation';
import StreakCelebration, { ReactiveStreakFlame } from './StreakCelebration';

function readStudentDisplayName() {
  try {
    const raw = localStorage.getItem('student_user') || localStorage.getItem('cms_student_user');
    const u = JSON.parse(raw || '{}');
    const name = (u.fullName || u.name || u.username || '').trim();
    return name || 'bạn';
  } catch {
    return 'bạn';
  }
}

/** Banner chào mừng DewSkill — mint gradient, thống kê thật, CTA giữ nguyên. */
export default function DailyPracticeHero({
  stats,
  mode,
  onPrimaryAction,
  primaryDisabled,
  primaryLabel,
  pathTopic = null,
  pathContinue = false,
  courseProgress = null,
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
  const displayName = useMemo(() => readStudentDisplayName(), []);

  const chapterDone = pathTopic?.totalUnits > 0
    && (pathTopic?.completedUnits || 0) >= pathTopic.totalUnits;
  const chapterCompleted = pathTopic?.completedUnits || 0;
  const chapterTotal = pathTopic?.totalUnits || 0;
  const chapterPct = chapterTotal
    ? Math.min(100, Math.round((chapterCompleted / chapterTotal) * 100))
    : 0;

  const courseCompleted = courseProgress?.completed ?? chapterCompleted;
  const courseTotal = courseProgress?.total ?? chapterTotal;
  const coursePct = courseProgress?.pct ?? (courseTotal
    ? Math.min(100, Math.round((courseCompleted / courseTotal) * 100))
    : chapterPct);
  const courseBar = Math.max(coursePct, courseCompleted > 0 ? 5 : 0);

  const tagline = pathMode
    ? 'Tiếp tục hành trình chinh phục Tin học nhé!'
    : 'Chọn chủ đề, hoàn thành lượt luyện và nhận XP mỗi ngày.';

  const ctaLabel = pathMode && pathContinue
    ? pathTopicPrimaryCtaLabel(pathTopic)
    : primaryLabel;

  const showStreakBadge = streak >= 3;

  return (
    <section className="dp-dew-welcome">
      <span className="dp-dew-welcome__deco -left-8 top-6 h-32 w-32 opacity-60" aria-hidden="true" />
      <span className="dp-dew-welcome__deco -right-6 bottom-0 h-40 w-40 opacity-40" aria-hidden="true" />

      <div className="relative flex flex-col gap-4 p-4 sm:p-5 md:gap-5 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
          <div className="dp-dew-welcome__mascot relative shrink-0">
            <div className="flex h-[76px] w-[76px] items-center justify-center sm:h-[88px] sm:w-[88px]">
              <Mascot mood={mood} size={80} />
            </div>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-emerald-900/80 sm:text-base">
              Chào bạn,{' '}
              <span className="font-black uppercase tracking-wide text-emerald-950">{displayName}</span>
              {' '}👋
            </p>
            <h1 className="mt-1 text-base font-black leading-snug text-emerald-950 sm:text-lg">
              {tagline}
            </h1>
            {showStreakBadge ? (
              <div className="mt-2">
                <StreakCelebration streak={streak} streakIncreased={playedToday} compact />
              </div>
            ) : null}
          </div>
        </div>

        <dl className="dp-dew-stat-grid grid grid-cols-3 gap-1.5 sm:gap-2.5 lg:max-w-md lg:shrink-0">
          <div className="dp-dew-stat-capsule flex min-w-0 flex-col gap-0.5 px-2 py-2 sm:gap-1 sm:px-3 sm:py-2.5">
            <dt className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Star size={12} className="text-amber-500 fill-amber-400" aria-hidden="true" />
              Tích lũy
            </dt>
            <dd className="text-sm font-black tabular-nums text-slate-900 sm:text-base">
              <AnimatedXpCounter value={stats?.xpTotal || 0} formatLocale />
              <span className="ml-0.5 text-[11px] font-extrabold text-emerald-600">XP</span>
            </dd>
          </div>
          <div className="dp-dew-stat-capsule flex min-w-0 flex-col gap-0.5 px-2 py-2 sm:gap-1 sm:px-3 sm:py-2.5">
            <dt className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Flame size={12} className="text-orange-500" aria-hidden="true" />
              Chuỗi học
            </dt>
            <dd className="flex items-center gap-1 text-sm font-black text-orange-600 sm:text-base">
              <ReactiveStreakFlame streak={streak} streakIncreased={playedToday} size={16} />
              {streak} ngày
            </dd>
          </div>
          <div className="dp-dew-stat-capsule flex min-w-0 flex-col gap-0.5 px-2 py-2 sm:gap-1 sm:px-3 sm:py-2.5">
            <dt className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Layers size={12} className="text-violet-500" aria-hidden="true" />
              Chương
            </dt>
            <dd className="text-sm font-black tabular-nums text-slate-900 sm:text-base">
              {pathMode ? `${chapterCompleted}/${chapterTotal || '—'}` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="relative border-t border-emerald-200/50 px-3 pb-3.5 pt-3 sm:px-5 sm:pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-900/70">
              <span className="inline-flex items-center gap-1">
                <CalendarCheck size={13} aria-hidden="true" />
                Tiến độ khóa học
              </span>
              <span className="font-black tabular-nums text-emerald-900">{coursePct}%</span>
            </div>
            <div className="dp-dew-progress-rail">
              <div className="dp-dew-progress-fill h-full" style={{ width: `${courseBar}%` }} />
            </div>
            {pathMode && chapterTotal > 0 ? (
              <p className="mt-1.5 text-[11px] font-semibold text-emerald-800/80">
                {chapterDone
                  ? 'Bạn đã hoàn thành toàn bộ chặng của chủ đề đang học.'
                  : `Đang học: ${pathTopic.topic.name} · ${chapterCompleted}/${chapterTotal} chặng`}
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] font-semibold text-emerald-800/80">
                Chọn chế độ Lộ trình hoặc Luyện tự do bên dưới để bắt đầu.
              </p>
            )}
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-[17rem]">
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={onPrimaryAction}
              className="cms-btn cms-btn-primary inline-flex w-full items-center justify-center gap-2 !rounded-2xl !px-5 !py-2.5 text-sm font-black"
            >
              {mode === 'free' ? <Sparkles size={16} aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
              {ctaLabel}
            </button>
            <div className="flex items-center justify-between gap-2">
              <SoundToggleButton compact className="shrink-0 sm:hidden" />
              <SoundToggleButton className="hidden shrink-0 sm:inline-flex" />
              {typeof stats?.todayXp === 'number' ? (
                <p className="min-w-0 flex-1 text-right text-[10px] font-bold text-emerald-800/70 sm:flex-none">
                  <Zap size={11} className="mr-0.5 inline text-amber-500" aria-hidden="true" />
                  Hôm nay: {stats.todayXp} XP
                </p>
              ) : (
                <span className="flex-1 sm:hidden" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
