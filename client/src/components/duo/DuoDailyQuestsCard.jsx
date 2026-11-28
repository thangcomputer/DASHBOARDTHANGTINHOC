import React, { useMemo } from 'react';
import { Check, Flame, Gift, Target, Video, Zap } from 'lucide-react';

function QuestIcon({ quest, isDone }) {
  if (isDone) return <Check size={16} color="#FFFFFF" strokeWidth={3} aria-hidden="true" />;
  if (quest.icon === 'lightning') return <Zap size={16} className="text-amber-600" fill="#F59E0B" aria-hidden="true" />;
  if (quest.icon === 'video') return <Video size={16} className="text-blue-600" aria-hidden="true" />;
  return <Flame size={16} className="text-orange-600" fill="#FB923C" aria-hidden="true" />;
}

export function DuoDailyQuestsCard({
  quests,
  todayAnswers = 0,
  todayVideos = 0,
  todayXp = 0,
  onOpenPractice,
  dewdropStyle,
}) {
  const isDewdrop = dewdropStyle ?? (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student'));
  const resolvedQuests = useMemo(() => quests || [
    {
      id: 'quiz',
      icon: 'lightning',
      title: 'Luyện 10 câu trắc nghiệm',
      current: todayAnswers,
      target: 10,
      unit: 'câu',
      rewardXp: 20,
    },
    {
      id: 'video',
      icon: 'video',
      title: 'Xem 1 video bài học',
      current: todayVideos,
      target: 1,
      unit: 'video',
      rewardXp: 15,
    },
    {
      id: 'xp',
      icon: 'flame',
      title: 'Kiếm 50 XP trong ngày',
      current: Math.min(50, todayXp),
      target: 50,
      unit: 'XP',
      rewardXp: 25,
    },
  ], [quests, todayAnswers, todayVideos, todayXp]);

  const completedCount = resolvedQuests.filter((q) => q.current >= q.target).length;

  if (isDewdrop) {
    return (
      <section className="dew-app-card dew-app-card--emerald flex min-w-0 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <h3 className="text-[15px] font-extrabold text-slate-900">Nhiệm vụ hôm nay</h3>
          </div>
          <span className="rounded-full bg-slate-100/90 border border-white px-3 py-1 text-xs font-extrabold text-slate-700 shadow-2xs">
            {completedCount}/{resolvedQuests.length} xong
          </span>
        </div>
        <ul className="space-y-2.5">
          {resolvedQuests.map((quest) => {
            const isDone = quest.current >= quest.target;
            const pct = Math.min(100, Math.round((quest.current / quest.target) * 100));
            return (
              <li key={quest.id}>
                <button
                  type="button"
                  onClick={onOpenPractice}
                  className={`w-full rounded-2xl backdrop-blur-md border px-4 py-2.5 flex items-center justify-between gap-3 text-left shadow-[0_4px_12px_-6px_rgba(15,23,42,0.08),inset_0_1px_0_#fff] transition hover:border-emerald-200 cursor-pointer ${
                    isDone ? 'bg-emerald-50/85 border-emerald-200/80' : 'bg-white/80 border-slate-100 hover:bg-white'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isDone ? 'bg-emerald-500 shadow-xs' : 'bg-slate-100/90 border border-white shadow-2xs'
                      }`}
                    >
                      <QuestIcon quest={quest} isDone={isDone} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] font-bold ${isDone ? 'text-emerald-800' : 'text-slate-800'}`}>
                        {quest.title}
                      </span>
                      {quest.current > 0 && !isDone ? (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80">
                            <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="shrink-0 text-[10px] font-extrabold text-slate-500 tabular-nums">
                            {Math.min(quest.current, quest.target)}/{quest.target}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {quest.rewardXp ? (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black border ${
                        isDone
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-gradient-to-b from-[#FEF08A] via-[#FBBF24] to-[#F59E0B] text-amber-950 border-amber-200/80 shadow-[0_4px_10px_-3px_rgba(217,119,6,0.35),inset_0_1.5px_1px_rgba(255,255,255,0.75)]'
                      }`}
                    >
                      <Gift size={12} aria-hidden="true" />
                      +{quest.rewardXp}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="duo-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-50">
            <Target size={18} className="text-emerald-600" aria-hidden="true" />
          </span>
          <h3 className="text-base font-black text-slate-900">Nhiệm vụ hôm nay</h3>
        </div>
        <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">
          {completedCount}/{resolvedQuests.length} xong
        </span>
      </div>
      <ul className="space-y-2.5">
        {resolvedQuests.map((quest) => {
          const isDone = quest.current >= quest.target;
          const pct = Math.min(100, Math.round((quest.current / quest.target) * 100));
          return (
            <li key={quest.id}>
              <button
                type="button"
                onClick={onOpenPractice}
                className={`duo-pressable flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-left transition hover:brightness-[0.99] ${
                  isDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isDone ? 'bg-emerald-500' : 'border border-slate-200 bg-white'
                  }`}
                >
                  <QuestIcon quest={quest} isDone={isDone} />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] font-bold ${isDone ? 'text-emerald-800' : 'text-slate-800'}`}>
                      {quest.title}
                    </span>
                    <span className="shrink-0 text-xs font-extrabold text-slate-500">
                      {Math.min(quest.current, quest.target)}/{quest.target}
                    </span>
                  </span>
                  <span className="block h-[7px] overflow-hidden rounded-full bg-slate-200">
                    <span
                      className={`block h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
                {quest.rewardXp ? (
                  <span
                    className={`inline-flex shrink-0 items-center gap-0.5 rounded-[10px] px-2 py-1 text-[11px] font-black ${
                      isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    <Gift size={13} aria-hidden="true" />
                    +{quest.rewardXp}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
