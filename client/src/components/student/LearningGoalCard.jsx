import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, Flame, Gamepad2, Info, PlayCircle, Target } from 'lucide-react';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  STUDY_MINUTE_EVENT,
  formatStudyMinutes,
  lessonResumeUrl,
  openLearningGoal,
  periodLabel,
} from '../../utils/learningGoal';

/** Nhiệm vụ mỗi ngày: một lượt luyện tập (10 câu) và ít nhất một video. */
const MISSION_QUESTIONS = 10;
const MISSION_VIDEOS = 1;

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
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const openVideoMission = () => {
    lessonPracticeApi.student.resumePoint()
      .then((res) => navigate(res?.data?.unitId ? lessonResumeUrl(res.data) : '/student/lesson-practice'))
      .catch(() => navigate('/student/lesson-practice'));
  };

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
      <section className="flex h-full min-w-0 flex-col justify-center gap-3 overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 to-white p-4">
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
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

      <div className="mt-4 flex min-w-0 flex-1 flex-col gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex shrink-0 items-center gap-1 font-bold text-slate-600"><Flame size={13} className="text-orange-500" /> Hôm nay</span>
            <span className="text-right font-bold text-slate-900">{formatStudyMinutes(progress.todayMinutes)} / {goal.hoursPerDay} giờ</span>
          </div>
          <ProgressBar value={todayPct} tone={todayPct >= 100 ? 'bg-emerald-500' : 'bg-orange-500'} />
          {todayPct >= 100 && <p className="text-[11px] font-bold text-emerald-600">Đã đạt mục tiêu hôm nay!</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="shrink-0 font-bold text-slate-600">Cả {periodLabel(goal.period)}</span>
            <span className="text-right font-bold text-slate-900">{formatStudyMinutes(progress.periodMinutes)} · {periodPct}%</span>
          </div>
          <ProgressBar value={periodPct} tone="bg-red-500" />
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-black text-slate-700">Nhiệm vụ hôm nay</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-600">
            {[(progress.todayQuestions || 0) >= MISSION_QUESTIONS, (progress.todayVideos || 0) >= MISSION_VIDEOS].filter(Boolean).length}/2 hoàn thành
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MissionTile
            icon={Gamepad2}
            title="Luyện tập"
            value={progress.todayQuestions || 0}
            target={MISSION_QUESTIONS}
            unit="câu"
            gradient="from-sky-400 to-blue-600"
            bar="bg-sky-500"
            onClick={() => navigate('/student/daily-practice')}
          />
          <MissionTile
            icon={PlayCircle}
            title="Xem video"
            value={progress.todayVideos || 0}
            target={MISSION_VIDEOS}
            unit="video"
            gradient="from-violet-400 to-purple-600"
            bar="bg-violet-500"
            onClick={openVideoMission}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Cả {periodLabel(goal.period)}: {progress.periodQuestions || 0} câu · {progress.periodVideos || 0} video
        </p>
      </div>
      <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-slate-400">
        <Info size={12} className="mt-px shrink-0" />
        Chỉ tính giờ khi bạn đang học ở trang bài học, ôn thi, tài liệu hoặc video, xem video đang phát, hoặc có thao tác trong 3 phút gần nhất.
      </p>
    </section>
  );
}

function MissionTile({ icon: Icon, title, value, target, unit, gradient, bar, onClick }) {
  const done = value >= target;
  const pct = percent(value, target);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-2xl border p-2.5 text-left transition !shadow-none ${done ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30'}`}
    >
      <span className="relative shrink-0">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[inset_0_2px_3px_rgba(255,255,255,0.35),0_6px_14px_rgba(15,23,42,0.15)] ${done ? 'from-emerald-400 to-emerald-600' : gradient}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
        {done && (
          <span className="cms-goal-pop absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 ring-2 ring-emerald-500">
            <Check size={12} strokeWidth={3.5} aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1">
          <span className="truncate text-sm font-black text-slate-900">{title}</span>
          {!done && <ChevronRight size={14} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
        </span>
        <span className={`block text-[11px] font-bold ${done ? 'text-emerald-600' : 'text-slate-500'}`}>
          {done ? `Hoàn thành · ${value} ${unit}` : `${value}/${target} ${unit}`}
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span className={`block h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : bar}`} style={{ width: `${pct}%` }} />
        </span>
      </span>
    </button>
  );
}
