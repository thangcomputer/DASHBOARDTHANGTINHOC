import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, Gamepad2, PlayCircle, Target } from 'lucide-react';
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

/** Thẻ tiến độ mục tiêu học trên Tổng quan học viên - Thiết kế tinh gọn, hiện đại. */
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
            <Target size={20} />
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">Bạn chưa đặt mục tiêu học</p>
            <p className="text-xs text-slate-500">Đặt mục tiêu để theo dõi số giờ học mỗi ngày.</p>
          </div>
        </div>
        <button type="button" onClick={openLearningGoal} className="cms-btn cms-btn-primary self-start !py-1.5 !px-3 text-xs">
          Đặt mục tiêu
        </button>
      </section>
    );
  }

  const todayPct = percent(progress.todayMinutes, progress.dailyTargetMinutes);
  const periodPct = percent(progress.periodMinutes, progress.periodTargetMinutes);
  const todayDone = todayPct >= 100;
  const questionsDone = (progress.todayQuestions || 0) >= MISSION_QUESTIONS;
  const videosDone = (progress.todayVideos || 0) >= MISSION_VIDEOS;
  const completedMissions = [questionsDone, videosDone].filter(Boolean).length;

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* 1. Tiêu đề + Nút Đổi */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Target size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 truncate">
              Mục tiêu: {goal.hoursPerDay} giờ/ngày
            </p>
            <p className="text-xs font-semibold text-slate-500 truncate">
              {goal.expired ? 'Đã kết thúc' : `${periodLabel(goal.period)} · Còn ${progress.daysLeft} ngày`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openLearningGoal}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
        >
          {goal.expired ? 'Đặt mới' : 'Đổi'}
        </button>
      </div>

      {/* 2. Tiến độ hôm nay (Thanh chính gọn gàng) */}
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <Flame size={14} className={todayDone ? 'text-emerald-500' : 'text-orange-500'} />
            <span>Hôm nay</span>
          </span>
          <span className="font-extrabold text-slate-900">
            {formatStudyMinutes(progress.todayMinutes)} / {goal.hoursPerDay} giờ
            <span className={`ml-1 font-bold ${todayDone ? 'text-emerald-600' : 'text-slate-400'}`}>
              ({todayPct}%)
            </span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              todayDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-red-500'
            }`}
            style={{ width: `${todayPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>Chu kỳ: {formatStudyMinutes(progress.periodMinutes)} ({periodPct}%)</span>
          {todayDone && <span className="font-bold text-emerald-600">✓ Đã đạt hôm nay</span>}
        </div>
      </div>

      {/* 3. Nhiệm vụ hôm nay (2 thẻ mini dạng pill) */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-black text-slate-800">Nhiệm vụ hôm nay</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {completedMissions}/2 hoàn thành
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Luyện tập */}
          <button
            type="button"
            onClick={() => navigate('/student/daily-practice')}
            className={`flex items-center gap-2 rounded-xl border p-2 text-left transition active:scale-98 ${
              questionsDone
                ? 'border-emerald-200 bg-emerald-50/60'
                : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
            }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              questionsDone ? 'bg-emerald-500 text-white' : 'bg-sky-100 text-sky-600'
            }`}>
              {questionsDone ? <Check size={14} strokeWidth={3} /> : <Gamepad2 size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-900 truncate">Luyện tập</p>
              <p className={`text-[11px] font-bold truncate ${
                questionsDone ? 'text-emerald-700' : 'text-slate-500'
              }`}>
                {progress.todayQuestions || 0}/{MISSION_QUESTIONS} câu
              </p>
            </div>
          </button>

          {/* Xem video */}
          <button
            type="button"
            onClick={openVideoMission}
            className={`flex items-center gap-2 rounded-xl border p-2 text-left transition active:scale-98 ${
              videosDone
                ? 'border-emerald-200 bg-emerald-50/60'
                : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
            }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              videosDone ? 'bg-emerald-500 text-white' : 'bg-purple-100 text-purple-600'
            }`}>
              {videosDone ? <Check size={14} strokeWidth={3} /> : <PlayCircle size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-900 truncate">Xem video</p>
              <p className={`text-[11px] font-bold truncate ${
                videosDone ? 'text-emerald-700' : 'text-slate-500'
              }`}>
                {progress.todayVideos || 0}/{MISSION_VIDEOS} video
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Ghi chú siêu gọn nhẹ */}
      <p className="mt-2.5 text-[11px] text-slate-400 font-medium leading-tight">
        * Giờ học tính khi bạn làm bài, ôn thi hoặc xem video.
      </p>
    </section>
  );
}
