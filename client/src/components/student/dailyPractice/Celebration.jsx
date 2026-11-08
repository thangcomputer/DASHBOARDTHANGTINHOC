import { useEffect, useMemo, useState } from 'react';
import { Check, Flame, Gift, Target, Timer, Zap } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { practiceFinishXpDisplay } from '../../../utils/dailyPractice';
import Mascot from './Mascot';

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (!end) return undefined;
    let frame = 0;
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      setValue(Math.round(end * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function StatCard({ label, tone, icon: Icon, value, delay }) {
  return (
    <div className="dp-card-in overflow-hidden rounded-2xl border-2 bg-white" style={{ borderColor: tone, animationDelay: `${delay}ms` }}>
      <p className="px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider text-white" style={{ background: tone }}>{label}</p>
      <p className="flex items-center justify-center gap-1.5 px-2 py-3 text-xl font-black tabular-nums" style={{ color: tone }}>
        <Icon size={20} aria-hidden="true" /> {value}
      </p>
    </div>
  );
}

function StageShell({ children, button, onNext }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 px-2 py-6 text-center">
      {children}
      <button type="button" onClick={onNext} className="dp-3d-btn mt-2 w-full rounded-2xl bg-sky-500 py-3.5 text-base font-black uppercase tracking-wide text-white">
        {button}
      </button>
    </div>
  );
}

function DoneStage({ summary, onNext }) {
  const xpDisplay = practiceFinishXpDisplay(summary);
  const xp = useCountUp(xpDisplay.amount);
  const good = summary.stars >= 2;
  useEffect(() => {
    if (good) gameSounds.win();
    else gameSounds.sad();
  }, [good]);
  return (
    <StageShell button="Nhận XP" onNext={onNext}>
      <div className="dp-fly-in"><Mascot mood={good ? 'celebrate' : 'sad'} size={150} /></div>
      <h2 className="text-3xl font-black text-sky-600">{good ? 'Đã luyện tập xong!' : 'Hoàn thành lượt luyện!'}</h2>
      <p className="max-w-xs text-xs font-semibold text-slate-500">{xpDisplay.caption}</p>
      <div className="grid w-full grid-cols-3 gap-2.5">
        <StatCard label="Nhận về" tone="#F59E0B" icon={Zap} value={xpDisplay.prefix ? `${xpDisplay.prefix}${xp}` : xp} delay={150} />
        <StatCard label="Combo" tone="#0EA5E9" icon={Target} value={`x${summary.maxCombo || 0}`} delay={300} />
        <StatCard label="Thời gian" tone="#10B981" icon={Timer} value={formatDuration(summary.durationSeconds)} delay={450} />
      </div>
    </StageShell>
  );
}

function StreakStage({ summary, onNext }) {
  const streak = summary.stats?.streak || 1;
  const count = useCountUp(streak, 700);
  useEffect(() => { gameSounds.correct(); }, []);
  return (
    <StageShell button="Tiếp tục" onNext={onNext}>
      <p className="dp-card-in relative rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
        {streak > 1 ? `Chuỗi ${streak} ngày rồi! Giữ lửa mỗi ngày để kiến thức nhớ thật lâu nhé.` : 'Chuỗi tỏa sáng! Hãy luyện tập mỗi ngày để tạo thói quen học tập nhé.'}
      </p>
      <div className="dp-flame relative flex h-36 w-36 items-center justify-center">
        <Flame size={140} className="fill-orange-400 text-orange-500" aria-hidden="true" />
        <Flame size={70} className="absolute bottom-3 fill-amber-300 text-amber-300" aria-hidden="true" />
      </div>
      <div>
        <p className="text-7xl font-black leading-none text-orange-500 tabular-nums">{count}</p>
        <p className="mt-1 text-2xl font-black text-orange-500">ngày liên tiếp</p>
      </div>
      {summary.week?.length > 0 && (
        <div className="grid w-full grid-cols-7 gap-1.5">
          {summary.week.map((day, index) => (
            <div key={day.day} className="flex flex-col items-center gap-1.5">
              <span className={`text-xs font-black ${day.today ? 'text-orange-500' : 'text-slate-400'}`}>{day.label}</span>
              <span
                className={`dp-card-in flex h-9 w-9 items-center justify-center rounded-full ${day.played ? 'bg-orange-500 text-white' : 'bg-slate-200'}`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                {day.played && <Check size={18} strokeWidth={3.5} aria-hidden="true" />}
              </span>
            </div>
          ))}
        </div>
      )}
    </StageShell>
  );
}

function QuestStage({ onNext }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => { setFilled(true); gameSounds.win(); }, 250);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <StageShell button="Tiếp tục" onNext={onNext}>
      <h2 className="text-3xl font-black text-amber-500">Hoàn thành nhiệm vụ hằng ngày!</h2>
      <div className="dp-card-in w-full rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-left shadow-[0_0_0_6px_rgba(251,191,36,0.15)]">
        <p className="text-lg font-black text-amber-800">Luyện tập 1 lượt hôm nay</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-amber-200/60">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-700 ease-out" style={{ width: filled ? '100%' : '0%' }} />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow">1 / 1</span>
          </div>
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-md ${filled ? 'dp-bounce' : ''}`}>
            <Gift size={26} aria-hidden="true" />
          </span>
        </div>
      </div>
    </StageShell>
  );
}

/**
 * Chuỗi màn ăn mừng sau lượt chơi (kiểu Duolingo):
 * Đã luyện tập xong → chuỗi ngày (khi tăng) → nhiệm vụ hằng ngày (lượt đầu trong ngày) → kết quả chi tiết.
 */
export default function Celebration({ summary, onDone }) {
  const stages = useMemo(() => [
    'done',
    ...(summary.streakIncreased ? ['streak'] : []),
    ...(summary.firstToday ? ['quest'] : []),
  ], [summary]);
  const [index, setIndex] = useState(0);
  const next = () => {
    gameSounds.tap();
    if (index + 1 < stages.length) setIndex(index + 1);
    else onDone();
  };
  const stage = stages[index];
  return (
    <div key={stage}>
      {stage === 'done' && <DoneStage summary={summary} onNext={next} />}
      {stage === 'streak' && <StreakStage summary={summary} onNext={next} />}
      {stage === 'quest' && <QuestStage onNext={next} />}
    </div>
  );
}
