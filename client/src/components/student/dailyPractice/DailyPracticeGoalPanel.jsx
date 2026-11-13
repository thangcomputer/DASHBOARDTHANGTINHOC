import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Check, Circle, Flame, Gamepad2, Gift, Info, PlayCircle, Target,
} from 'lucide-react';
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

/** Cột phải: mục tiêu + nhiệm vụ + chuỗi (dữ liệu API thật). */
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
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short' }).format(new Date());
      const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
      if (typeof map[parts] === 'number') return map[parts];
    } catch {
      // fallback
    }
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  const openVideo = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('watch', 'stage');
      navigate(`/student/daily-practice?${params.toString()}`);
    } catch {
      navigate('/student/daily-practice?watch=stage');
    }
  };

  const openPractice = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('practice', 'stage');
      navigate(`/student/daily-practice?${params.toString()}`);
    } catch {
      navigate('/student/daily-practice?practice=stage');
    }
  };

  const { goal, progress = {} } = data || {};
  const playedToday = Boolean(practiceStats?.playedToday);
  const streak = practiceStats?.streak || 0;

  const learnDone = (progress.todayVideos || 0) >= MISSION_VIDEOS;
  const practiceDone = (progress.todayQuestions || 0) >= MISSION_QUESTIONS || playedToday;
  const activityDone = [learnDone, practiceDone].filter(Boolean).length;
  const activityTarget = 2;

  return (
    <div className="flex flex-col gap-4">
      <section className="dp-dew-side-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
              <Target size={16} className="text-emerald-600" aria-hidden="true" />
            </span>
            Mục tiêu hôm nay
          </h3>
          <CalendarCheck size={18} className="shrink-0 text-emerald-500" aria-hidden="true" />
        </div>
        {!goal ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600">Chưa đặt mục tiêu giờ học. Vẫn theo dõi XP và chuỗi luyện tập bên dưới.</p>
            <button type="button" onClick={openLearningGoal} className="cms-btn cms-btn-outline !py-2 text-xs">Đặt mục tiêu học</button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs font-bold text-slate-700">
              Hoàn thành {activityTarget} hoạt động học tập
              {goal.hoursPerDay ? ` · mục tiêu ${goal.hoursPerDay} giờ/ngày` : ''}.
            </p>
            <div className="flex items-center gap-2">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.round((activityDone / activityTarget) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-black tabular-nums text-slate-900">{activityDone} / {activityTarget}</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <MissionRow
                icon={Gamepad2}
                title="Luyện tập"
                done={practiceDone}
                detail={`${Math.min(progress.todayQuestions || 0, MISSION_QUESTIONS)}/${MISSION_QUESTIONS} câu`}
                onClick={openPractice}
              />
              <MissionRow
                icon={PlayCircle}
                title="Xem video"
                done={learnDone}
                detail={`${Math.min(progress.todayVideos || 0, MISSION_VIDEOS)}/${MISSION_VIDEOS} video`}
                onClick={openVideo}
              />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <div className="flex justify-between gap-2 text-[11px] font-bold text-slate-600">
                <span>Giờ học hôm nay</span>
                <span>{formatStudyMinutes(progress.todayMinutes)} / {goal.hoursPerDay} giờ</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct(progress.todayMinutes, progress.dailyTargetMinutes) >= 100 ? 'bg-emerald-500' : 'bg-orange-400'}`}
                  style={{ width: `${pct(progress.todayMinutes, progress.dailyTargetMinutes)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="min-w-0 text-[10px] font-semibold leading-snug text-slate-500">
                  {periodLabel(goal.period)}
                  {!goal.expired ? ` · còn ${progress.daysLeft} ngày` : ' · đã hết hạn'}
                </p>
                <button
                  type="button"
                  onClick={openLearningGoal}
                  className="shrink-0 cursor-pointer rounded-[10px] border-[1.5px] border-[#A7F3D0] border-b-[3.5px] border-b-[#34D399] bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#059669] transition-all hover:bg-[#ECFDF5] active:translate-y-[2px] active:border-b-[1.5px] !shadow-none"
                >
                  {goal.expired ? 'Đặt mục tiêu mới' : 'Đổi mục tiêu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="dp-dew-side-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Flame size={18} className="text-orange-500" aria-hidden="true" />
            Chuỗi học tập
          </h3>
          <span className="text-lg" aria-hidden="true">📅</span>
        </div>
        <p className="mt-2 text-2xl font-black tabular-nums text-orange-600">{streak} ngày</p>
        <p className="text-xs font-medium text-slate-600">
          Học đều mỗi ngày để duy trì chuỗi và nhận thưởng lớn hơn!
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {playedToday ? 'Hôm nay bạn đã hoàn thành ít nhất một lượt luyện tập.' : 'Hôm nay chưa có lượt luyện tập. Hoàn thành 10 câu để giữ chuỗi.'}
        </p>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEK_LABELS.map((label, index) => {
            const isToday = index === todayIndex;
            const active = (isToday && playedToday)
              || (index < todayIndex && streak >= (todayIndex - index + (playedToday ? 1 : 0)));
            return (
              <div key={label} className="flex min-w-0 flex-col items-center gap-1">
                <span
                  title={active ? `${label}: Đã hoàn thành (Chuỗi ${streak} ngày)` : isToday ? `${label}: Hôm nay (Chưa hoàn thành lượt luyện)` : label}
                  className={`flex h-9 w-full max-w-9 items-center justify-center rounded-full text-[10px] font-black transition-all ${
                    active
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                      : isToday
                        ? 'border-2 border-dashed border-orange-400 bg-orange-50 text-orange-700'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {active ? <Flame size={14} className="fill-amber-200" aria-hidden="true" /> : label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="dp-dew-streak-gift mt-3 flex items-start gap-1.5 px-3 py-2">
          <Gift size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
          Học liên tục 7 ngày để nhận thưởng đặc biệt!
        </p>
        <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-slate-400">
          <Info size={11} className="mt-px shrink-0" aria-hidden="true" />
          Lịch tuần hiển thị các ngày đạt chuỗi; hoàn thành ít nhất một lượt luyện tập mỗi ngày để giữ lửa.
        </p>
        <button type="button" onClick={() => navigate('/student')} className="mt-3 text-xs font-bold text-emerald-700 hover:underline">
          Xem tiến độ học tập
        </button>
      </section>
    </div>
  );
}

function MissionRow({ icon: Icon, title, done, detail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition !shadow-none ${done ? 'border-emerald-200 bg-emerald-50/90' : 'border-slate-100 bg-slate-50/60 hover:border-emerald-200'}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
        {done ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-slate-900">{title}</span>
        <span className={`text-[11px] font-bold ${done ? 'text-emerald-700' : 'text-slate-500'}`}>{detail}</span>
      </span>
      <span className="shrink-0" aria-hidden="true">
        {done ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check size={14} strokeWidth={3} />
          </span>
        ) : (
          <Circle size={22} className="text-slate-300" />
        )}
      </span>
    </button>
  );
}
