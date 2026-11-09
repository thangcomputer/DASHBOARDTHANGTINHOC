import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, Gamepad2, Info, PlayCircle, Target } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import {
  LEARNING_GOAL_CHANGED_EVENT, STUDY_MINUTE_EVENT, formatStudyMinutes, openLearningGoal, periodLabel,
} from '../../../utils/learningGoal';

const MISSION_QUESTIONS = 10;
const MISSION_VIDEOS = 1;
const WEEK_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function pct(value, target) {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

/** Cột phải: mục tiêu học + nhiệm vụ + chuỗi luyện tập (API thật). */
export default function DailyPracticeGoalPanel({ practiceStats }) {
  const navigate = useNavigate();
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
    window.addEventListener(LEARNING_GOAL_CHANGED_EVENT, onChanged);
    window.addEventListener(STUDY_MINUTE_EVENT, onMinute);
    return () => {
      window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, onChanged);
      window.removeEventListener(STUDY_MINUTE_EVENT, onMinute);
    };
  }, [load]);

  const todayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  const openVideo = () => {
    navigate('/student/daily-practice?watch=stage');
  };

  const { goal, progress = {} } = data || {};
  const playedToday = Boolean(practiceStats?.playedToday);
  const streak = practiceStats?.streak || 0;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Target size={16} className="text-red-600" aria-hidden="true" />
          Mục tiêu hôm nay
        </h3>
        {!goal ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">Chưa đặt mục tiêu giờ học. Vẫn theo dõi XP và chuỗi luyện tập bên dưới.</p>
            <button type="button" onClick={openLearningGoal} className="cms-btn cms-btn-outline !py-2 text-xs">Đặt mục tiêu học</button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-600">
                {goal.hoursPerDay} giờ/ngày · {periodLabel(goal.period)}
                {!goal.expired ? (
                  <span className="ml-1 font-semibold text-slate-400">· còn {progress.daysLeft} ngày</span>
                ) : (
                  <span className="ml-1 font-semibold text-amber-600">· đã hết hạn</span>
                )}
              </p>
              <button
                type="button"
                onClick={openLearningGoal}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
              >
                {goal.expired ? 'Đặt mới' : 'Đổi mục tiêu'}
              </button>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-600">
                <span>Giờ học hôm nay</span>
                <span>{formatStudyMinutes(progress.todayMinutes)} / {goal.hoursPerDay} giờ</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${pct(progress.todayMinutes, progress.dailyTargetMinutes) >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                  style={{ width: `${pct(progress.todayMinutes, progress.dailyTargetMinutes)}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-100">
              Mẹo: Hoàn thành một lượt luyện tập (10 câu) giúp giữ chuỗi 🔥 và cộng vào nhiệm vụ câu hỏi.
            </div>
          </div>
        )}
      </section>

      {goal && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-800">Nhiệm vụ hôm nay</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <MissionRow
              icon={Gamepad2}
              title="Luyện tập"
              done={(progress.todayQuestions || 0) >= MISSION_QUESTIONS}
              text={`${Math.min(progress.todayQuestions || 0, MISSION_QUESTIONS)}/${MISSION_QUESTIONS} câu`}
              onClick={() => navigate('/student/daily-practice?practice=stage')}
            />
            <MissionRow
              icon={PlayCircle}
              title="Xem video"
              done={(progress.todayVideos || 0) >= MISSION_VIDEOS}
              text={`${Math.min(progress.todayVideos || 0, MISSION_VIDEOS)}/${MISSION_VIDEOS} video`}
              onClick={openVideo}
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Flame size={16} className="text-orange-500" aria-hidden="true" />
          Chuỗi luyện tập
        </h3>
        <p className="mt-1 text-2xl font-black tabular-nums text-orange-600">{streak} ngày</p>
        <p className="text-xs text-slate-500">
          {playedToday ? 'Hôm nay bạn đã hoàn thành ít nhất một lượt luyện tập.' : 'Hôm nay chưa có lượt luyện tập. Hoàn thành 10 câu để giữ chuỗi.'}
        </p>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEK_LABELS.map((label, index) => {
            const isToday = index === todayIndex;
            const active = isToday && playedToday;
            return (
              <div key={label} className="flex min-w-0 flex-col items-center gap-1">
                <span className={`flex h-8 w-full max-w-8 items-center justify-center rounded-full text-[10px] font-black ${active ? 'bg-orange-500 text-white' : isToday ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-300' : 'bg-slate-100 text-slate-400'}`}>
                  {active ? <Flame size={14} className="fill-amber-200" aria-hidden="true" /> : label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-slate-400">
          <Info size={11} className="mt-px shrink-0" aria-hidden="true" />
          Lịch tuần hiển thị trạng thái hôm nay; chuỗi ngày tính theo lượt luyện tập hoàn thành mỗi ngày.
        </p>
        <button type="button" onClick={() => navigate('/student')} className="mt-3 text-xs font-bold text-red-600 hover:underline">
          Xem tiến độ học tập
        </button>
      </section>
    </div>
  );
}

function MissionRow({ icon: Icon, title, done, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition !shadow-none ${done ? 'border-emerald-200 bg-emerald-50/80' : 'border-slate-200 bg-slate-50/50 hover:border-red-200'}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
        {done ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-slate-900">{title}</span>
        <span className={`text-[11px] font-bold ${done ? 'text-emerald-700' : 'text-slate-500'}`}>{text}</span>
      </span>
    </button>
  );
}
