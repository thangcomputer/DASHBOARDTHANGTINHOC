import { Award, CalendarCheck, Flame, Layers, Play, Sparkles, Star, Zap } from 'lucide-react';
import { pathTopicPrimaryCtaLabel } from '../../../../../shared/dailyPractice/lastPathTopic.mjs';
import { buildHeroStreakTagline } from '../../../../../shared/dailyPractice/heroTagline.mjs';
import useAIQuota from '../../../hooks/useAIQuota';
import { deriveSidebarAiPlan } from '../../../utils/sidebarAiPlan';
import Mascot from './Mascot';
import { SoundToggleButton } from './GameButton';
import { AnimatedXpCounter } from './XPRewardAnimation';
import StreakCelebration, { ReactiveStreakFlame } from './StreakCelebration';

/** Banner chào mừng DewSkill — mint gradient, thống kê thật, CTA giữ nguyên. */
export default function DailyPracticeHero({
  stats,
  mode,
  onPrimaryAction,
  primaryDisabled,
  primaryLabel,
  pathTopic = null,
  pathContinue: _pathContinue = false,
  courseProgress = null,
  _freeTopicName = '',
  onBuyXp = null,
  onOpenCertificate = null,
}) {
  const streak = stats?.streak || 0;
  const playedToday = Boolean(stats?.playedToday);
  let mood = 'determinedSoft';
  if (playedToday) mood = 'energy';
  else if (stats?.streakState === 'lost') mood = 'sad';
  else if (stats?.streakState === 'at_risk' && streak > 0) mood = 'determined';
  else if (!playedToday) mood = 'studying';

  const pathMode = Boolean(mode === 'path' && pathTopic?.topic?.name);

  const chapterDone = pathTopic?.totalUnits > 0
    && (pathTopic?.completedUnits || 0) >= pathTopic.totalUnits;
  const chapterCompleted = pathTopic?.completedUnits || 0;
  const chapterTotal = pathTopic?.totalUnits || 0;
  const activeUnit = (pathTopic?.units || []).find((u) => u.state === 'active') || null;
  const activeSteps = Array.isArray(activeUnit?.steps) ? activeUnit.steps : [];
  const activeFraction = activeSteps.length
    ? activeSteps.filter((s) => s.state === 'completed').length / activeSteps.length
    : 0;
  const chapterPct = chapterTotal
    ? Math.min(100, Math.round(((chapterCompleted + activeFraction) / chapterTotal) * 100))
    : 0;

  const courseCompleted = courseProgress?.completed ?? chapterCompleted;
  const courseTotal = courseProgress?.total ?? chapterTotal;
  const coursePct = courseProgress?.pct ?? (courseTotal
    ? Math.min(100, Math.round((courseCompleted / courseTotal) * 100))
    : chapterPct);
  const courseBar = Math.max(coursePct, courseCompleted > 0 ? 5 : 0);

  const tagline = buildHeroStreakTagline(stats, { mode: pathMode ? 'path' : mode });

  const ctaLabel = pathMode && !chapterDone
    ? pathTopicPrimaryCtaLabel(pathTopic)
    : primaryLabel;

  const aiQuota = useAIQuota({ autoFetch: true });
  const aiPlanInfo = deriveSidebarAiPlan({
    aiQuotaPercent: aiQuota.aiQuotaPercent,
    aiPlan: aiQuota.aiPlan,
    isPaidUnlimited: aiQuota.isPaidUnlimited,
  });
  const showStreakBadge = streak >= 3;
  const studyXp = Math.max(0, Number(stats?.studyXpTotal ?? 0) || 0);
  const todayStudyXp = Math.max(0, Number(stats?.todayXp) || 0);
  const handleOpenAiPackages = () => {
    if (typeof onBuyXp === 'function') onBuyXp();
    else aiQuota.openPackagesModal();
  };
  const aiStatTone = aiPlanInfo.isSubscribed
    ? {
      card: 'bg-gradient-to-b from-amber-50/95 to-amber-100/80 shadow-[0_6px_16px_-6px_rgba(217,119,6,0.24),inset_0_1.5px_0_#fff]',
      label: 'text-amber-800',
      icon: 'text-amber-500',
      value: 'text-amber-700',
      title: 'Không giới hạn · Bấm để xem hoặc gia hạn gói Hỗ trợ AI',
    }
    : aiPlanInfo.quotaPercent <= 0
      ? {
        card: 'bg-gradient-to-b from-rose-50/95 to-red-100/80 shadow-[0_6px_16px_-6px_rgba(225,29,72,0.22),inset_0_1.5px_0_#fff]',
        label: 'text-rose-800',
        icon: 'text-rose-500',
        value: 'text-rose-600',
        title: 'Đã hết dung lượng Hỗ trợ AI hôm nay — Bấm để nâng cấp gói Hỗ trợ AI',
      }
      : aiPlanInfo.quotaPercent <= 20
        ? {
          card: 'bg-gradient-to-b from-orange-50/95 to-amber-100/80 shadow-[0_6px_16px_-6px_rgba(234,88,12,0.2),inset_0_1.5px_0_#fff]',
          label: 'text-orange-800',
          icon: 'text-orange-500',
          value: 'text-orange-600',
          title: 'Dung lượng Hỗ trợ AI sắp hết — Bấm để nâng cấp gói Hỗ trợ AI',
        }
        : {
          card: 'bg-gradient-to-b from-emerald-50/95 to-teal-100/80 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.2),inset_0_1.5px_0_#fff]',
          label: 'text-emerald-800',
          icon: 'text-emerald-600',
          value: 'text-emerald-700',
          title: 'Dung lượng Hỗ trợ AI hôm nay — Bấm để nâng cấp gói Hỗ trợ AI',
        };
  const capsuleClass = (gradientCls, fallbackCls = 'dp-dew-stat-capsule flex min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center sm:gap-1 sm:px-3 sm:py-2.5') => (
    pathMode
      ? `flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white ${gradientCls} px-2 py-2 text-center sm:gap-1 sm:px-3 sm:py-2.5`
      : fallbackCls
  );

  return (
    <section className="dp-dew-welcome">
      <span className="dp-dew-welcome__deco -left-8 top-6 h-32 w-32 opacity-60" aria-hidden="true" />
      <span className="dp-dew-welcome__deco -right-6 bottom-0 h-40 w-40 opacity-40" aria-hidden="true" />

      <div className="relative flex flex-col gap-4 p-4 sm:p-5 md:gap-5 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="dp-dew-welcome__mascot relative shrink-0">
            <div className="flex h-[76px] w-[76px] items-center justify-center sm:h-[88px] sm:w-[88px]">
              <Mascot mood={mood} size={80} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black leading-snug text-emerald-950 sm:text-lg">
              {tagline}
            </h1>
            {showStreakBadge ? (
              <div className="mt-2">
                <StreakCelebration streak={streak} streakIncreased={playedToday} compact />
              </div>
            ) : null}
          </div>
        </div>

        <dl className="dp-dew-stat-grid grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:w-auto lg:max-w-xl lg:shrink-0">
          <button
            type="button"
            onClick={handleOpenAiPackages}
            title={aiStatTone.title}
            className={`${capsuleClass(aiStatTone.card)} cursor-pointer transition hover:brightness-105`}
          >
            <dt className={`flex items-center justify-center gap-1 text-[10px] font-bold ${aiStatTone.label}`}>
              <Sparkles size={12} className={aiStatTone.icon} aria-hidden="true" />
              Hỗ trợ AI
            </dt>
            <dd className={`flex items-baseline justify-center text-sm font-black tabular-nums sm:text-base ${aiStatTone.value}`}>
              {aiPlanInfo.isSubscribed ? 'Unlimited' : `${aiPlanInfo.quotaPercent}%`}
            </dd>
          </button>

          <div
            title="XP học tập & chuỗi tích lũy — chỉ tăng khi học, không bị trừ khi hỏi AI hay làm sai"
            className={capsuleClass('bg-gradient-to-b from-sky-50/95 to-blue-100/80 shadow-[0_6px_16px_-6px_rgba(14,165,233,0.18),inset_0_1.5px_0_#fff]')}
          >
            <dt className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
              <Star size={12} className="text-amber-500 fill-amber-400" aria-hidden="true" />
              XP Học tập
            </dt>
            <dd className="flex items-baseline justify-center text-sm font-black tabular-nums text-slate-900 sm:text-base">
              <AnimatedXpCounter value={studyXp} formatLocale />
              <span className="ml-0.5 text-[11px] font-extrabold text-sky-600">XP</span>
            </dd>
          </div>

          <div className={capsuleClass('bg-gradient-to-b from-amber-50/95 to-orange-100/80 shadow-[0_6px_16px_-6px_rgba(245,158,11,0.18),inset_0_1.5px_0_#fff]')}>
            <dt className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
              <Flame size={12} className="text-orange-500" aria-hidden="true" />
              Chuỗi học
            </dt>
            <dd className="flex items-center justify-center gap-1 text-sm font-black text-orange-600 sm:text-base">
              <ReactiveStreakFlame streak={streak} streakIncreased={playedToday} size={16} />
              {streak} ngày
            </dd>
          </div>

          <div className={capsuleClass('bg-gradient-to-b from-violet-50/95 to-purple-100/80 shadow-[0_6px_16px_-6px_rgba(139,92,246,0.18),inset_0_1.5px_0_#fff]')}>
            <dt className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
              <Layers size={12} className="text-violet-500" aria-hidden="true" />
              Chương
            </dt>
            <dd className="flex items-center justify-center text-sm font-black tabular-nums text-slate-900 sm:text-base">
              {(pathMode || courseTotal > 0) ? `${courseCompleted}/${courseTotal || '—'}` : '—'}
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
            ) : mode === 'free' && courseProgress?.subjectName ? (
              <p className="mt-1.5 text-[11px] font-semibold text-emerald-800/80">
                Đang học: {courseProgress.subjectName} · {courseCompleted}/{courseTotal} bài (trả lời đúng +5 XP · sai −5 XP)
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] font-semibold text-emerald-800/80">
                {mode === 'free'
                  ? 'Chọn môn học bên dưới để xem video, làm trắc nghiệm theo mốc và nhận XP mỗi ngày.'
                  : 'Chọn chủ đề bên dưới để bắt đầu hành trình học theo lộ trình.'}
              </p>
            )}
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-[20rem]">
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={onPrimaryAction}
              className={mode === 'path'
                ? 'dew-btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm font-extrabold cursor-pointer'
                : 'cms-btn cms-btn-primary inline-flex w-full items-center justify-center gap-2 !rounded-2xl !px-5 !py-2.5 text-sm font-black'}
            >
              {mode === 'free' ? <Sparkles size={16} aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
              {ctaLabel}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <SoundToggleButton compact className="shrink-0 sm:hidden" />
                <SoundToggleButton className="hidden shrink-0 sm:inline-flex" />
                {onOpenCertificate ? (
                  <button
                    type="button"
                    onClick={onOpenCertificate}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/80 bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 shadow-2xs transition hover:border-emerald-400 hover:bg-white cursor-pointer"
                  >
                    <Award size={12} className="text-emerald-600" aria-hidden="true" />
                    <span>Chứng nhận QR</span>
                  </button>
                ) : null}
              </div>
              {typeof stats?.todayXp === 'number' ? (
                <p className="min-w-0 flex-1 text-right text-[10px] font-bold text-emerald-800/70 sm:flex-none">
                  <Zap size={11} className="mr-0.5 inline text-amber-500" aria-hidden="true" />
                  Học hôm nay: +{todayStudyXp} XP
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
