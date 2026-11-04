import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Flame, Info, ListChecks, PlayCircle, Target } from 'lucide-react';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  STUDY_MINUTE_EVENT,
  formatStudyMinutes,
  openLearningGoal,
  periodLabel,
} from '../../utils/learningGoal';

function percent(value, target) {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function ProgressBar({ value, tone }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

/** Thẻ tiến độ mục tiêu học trên Tổng quan học viên. */
export default function LearningGoalCard() {
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    lessonPracticeApi.student.learningGoal().then((res) => setData(res?.data || null)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const onChanged = (event) => { if (event.detail) setData(event.detail); else load(); };
    const onMinute = (event) => {
      const todayMinutes = event.detail?.todayMinutes;
      if (typeof todayMinutes !== 'number') return;
      setData((prev) => {
        if (!prev?.progress) return prev;
        const delta = Math.max(0, todayMinutes - (prev.progress.todayMinutes || 0));
        return {
          ...prev,
          progress: {
            ...prev.progress,
            todayMinutes,
            periodMinutes: (prev.progress.periodMinutes || 0) + delta,
          },
        };
      });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener(LEARNING_GOAL_CHANGED_EVENT, onChanged);
    window.addEventListener(STUDY_MINUTE_EVENT, onMinute);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, onChanged);
      window.removeEventListener(STUDY_MINUTE_EVENT, onMinute);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (!data) return null;
  const { goal, progress = {} } = data;

  if (!goal) {
    return (
      <section className="flex h-full flex-col justify-center gap-3 rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 to-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><Target size={22} /></span>
          <div>
            <p className="text-sm font-black text-slate-900">Bạn chưa đặt mục tiêu học</p>
            <p className="text-xs text-slate-500">Đặt mục tiêu để theo dõi số giờ học mỗi ngày.</p>
          </div>
        </div>
        <button type="button" onClick={openLearningGoal} className="cms-btn cms-btn-primary self-start">Đặt mục tiêu</button>
      </section>
    );
  }

  const todayPct = percent(progress.todayMinutes, progress.dailyTargetMinutes);
  const periodPct = percent(progress.periodMinutes, progress.periodTargetMinutes);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><Target size={22} /></span>
          <div>
            <p className="text-sm font-black text-slate-900">
              Mục tiêu: {goal.hoursPerDay} giờ/ngày · {periodLabel(goal.period)}
            </p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <CalendarDays size={12} />
              {goal.expired ? 'Mục tiêu đã kết thúc' : `Còn ${progress.daysLeft} ngày · ngày ${progress.daysElapsed}/${progress.totalDays}`}
            </p>
          </div>
        </div>
        <button type="button" onClick={openLearningGoal} className="cms-btn cms-btn-outline shrink-0 !px-3 !py-1.5 text-xs">
          {goal.expired ? 'Đặt mục tiêu mới' : 'Đổi mục tiêu'}
        </button>
      </div>

      <div className="mt-4 grid flex-1 content-start gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-bold text-slate-600"><Flame size={13} className="text-orange-500" /> Hôm nay</span>
            <span className="font-bold text-slate-900">{formatStudyMinutes(progress.todayMinutes)} / {goal.hoursPerDay} giờ</span>
          </div>
          <ProgressBar value={todayPct} tone={todayPct >= 100 ? 'bg-emerald-500' : 'bg-orange-500'} />
          {todayPct >= 100 && <p className="text-[11px] font-bold text-emerald-600">Đã đạt mục tiêu hôm nay!</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600">Cả {periodLabel(goal.period)}</span>
            <span className="font-bold text-slate-900">{formatStudyMinutes(progress.periodMinutes)} · {periodPct}%</span>
          </div>
          <ProgressBar value={periodPct} tone="bg-red-500" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
        <span className="font-bold text-slate-500">Hôm nay đã học:</span>
        <EvidenceChip icon={ListChecks} tone="text-sky-700 bg-sky-50" value={progress.todayQuestions} unit="câu đã làm" />
        <EvidenceChip icon={PlayCircle} tone="text-violet-700 bg-violet-50" value={progress.todayVideos} unit="video đã xem" />
        <span className="ml-auto text-[11px] text-slate-400">
          Cả {periodLabel(goal.period)}: {progress.periodQuestions || 0} câu · {progress.periodVideos || 0} video
        </span>
      </div>
      <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-slate-400">
        <Info size={12} className="mt-px shrink-0" />
        Chỉ tính giờ khi bạn đang học ở trang bài học, ôn thi, tài liệu hoặc video — xem video đang phát, hoặc có thao tác trong 3 phút gần nhất.
      </p>
    </section>
  );
}

function EvidenceChip({ icon: Icon, tone, value, unit }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {value || 0} {unit}
    </span>
  );
}
