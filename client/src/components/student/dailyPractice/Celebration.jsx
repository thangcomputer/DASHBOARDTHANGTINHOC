import { useEffect, useMemo, useState } from 'react';
import { Award, Check, Crown, Flame, Gift, Sparkles, Star, Target, Timer, Trophy, Zap } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { practiceFinishXpDisplay } from '../../../utils/dailyPractice';
import Mascot from './Mascot';

const CONFETTI_COLORS = ['#F59E0B', '#EF4444', '#10B981', '#0EA5E9', '#A855F7', '#F97316', '#FACC15'];

function TrophyConfetti({ count = 36, spread = 220 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.15;
    const distance = spread * (0.5 + ((i * 7) % 10) / 16);
    return {
      dx: `${Math.round(Math.cos(angle) * distance)}px`,
      dy: `${Math.round(Math.sin(angle) * distance - 50)}px`,
      rot: `${(i * 67) % 720 - 360}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${(i * 35) % 280}ms`,
    };
  }), [count, spread]);
  return pieces.map((piece, index) => (
    <span
      key={index}
      className="cms-goal-confetti"
      style={{ background: piece.color, '--dx': piece.dx, '--dy': piece.dy, '--rot': piece.rot, animationDelay: piece.delay }}
      aria-hidden="true"
    />
  ));
}

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
  const isPerfect = Boolean(
    summary &&
    (summary.total || 0) >= 2 &&
    (summary.correctCount === summary.total || summary.maxCombo === summary.total)
  );
  const good = summary.stars >= 2;
  useEffect(() => {
    if (isPerfect) gameSounds.mascotVictory();
    else if (good) gameSounds.win();
    else gameSounds.sad();
  }, [good, isPerfect]);
  return (
    <StageShell button="Nhận XP" onNext={onNext}>
      <div className="dp-fly-in"><Mascot mood={good ? 'celebrate' : 'sad'} size={150} /></div>
      {isPerfect && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-900 shadow-sm animate-pulse">
          <Crown size={14} className="fill-amber-500 text-amber-600" />
          <span>Bách phát bách trúng 100%</span>
          <Crown size={14} className="fill-amber-500 text-amber-600" />
        </div>
      )}
      <h2 className="text-3xl font-black text-sky-600">{isPerfect ? 'Xuất sắc tuyệt đối!' : (good ? 'Đã luyện tập xong!' : 'Hoàn thành lượt luyện!')}</h2>
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

function CourseTrophyStage({ summary, onNext }) {
  const pathResult = summary.path || {};
  const isFullCourse = Boolean(pathResult.topicCompleted);
  useEffect(() => {
    gameSounds.win();
  }, []);
  return (
    <div className="mx-auto flex min-h-[74vh] max-w-xl flex-col items-center justify-center px-3 py-8 text-center">
      <div className="dp-card-in relative w-full overflow-hidden rounded-[32px] border-2 border-amber-300/90 bg-gradient-to-b from-amber-50 via-white to-amber-50/40 p-6 shadow-[0_24px_60px_-15px_rgba(245,158,11,0.28)] sm:p-8">
        <TrophyConfetti count={44} spread={250} />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-300/25 blur-3xl" />

        <div className="relative inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-amber-900 shadow-sm">
          <Crown size={14} className="fill-amber-400 text-amber-600" aria-hidden="true" />
          {isFullCourse ? 'Vinh danh hoàn thành khóa học' : `Hoàn thành chặng · ${pathResult.unitTitle || ''}`}
        </div>

        <div className="relative mt-5 flex items-center justify-center gap-3 sm:gap-6">
          <div className="dp-fly-in">
            <Mascot mood="graduate" size={112} />
          </div>
          <div className="relative flex flex-col items-center">
            <div className="mb-1.5 flex items-center gap-1">
              {[1, 2, 3].map((n) => (
                <Star
                  key={n}
                  size={n === 2 ? 24 : 18}
                  className="dp-star-in fill-amber-400 text-amber-500 drop-shadow-sm"
                  style={{ animationDelay: `${n * 140}ms` }}
                />
              ))}
            </div>
            <div className="dp-bounce relative flex h-28 w-28 items-center justify-center rounded-[28px] bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-white shadow-[0_10px_0_#B45309,0_18px_34px_rgba(245,158,11,0.45)] ring-4 ring-amber-200">
              <Trophy size={58} strokeWidth={2.2} className="drop-shadow-md" aria-hidden="true" />
              <Sparkles size={20} className="absolute -right-2 -top-2 fill-yellow-200 text-amber-500" aria-hidden="true" />
            </div>
            <span className="mt-3 rounded-lg bg-amber-900 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-100 shadow-sm">
              {isFullCourse ? 'Cúp Vàng Toàn Khóa' : 'Cúp Chinh Phục Chặng'}
            </span>
          </div>
          <div className="dp-fly-in hidden sm:block">
            <Mascot mood="celebrate" size={104} />
          </div>
        </div>

        <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          {isFullCourse ? 'Chúc mừng bạn đã hoàn thành khóa học!' : `Chinh phục thành công ${pathResult.unitTitle || 'chặng học'}!`}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-600">
          {isFullCourse
            ? 'Tuyệt vời! Bạn đã vượt qua toàn bộ các chặng thử thách và rước Cúp Vàng Vinh Danh. Hãy tiếp tục ôn luyện để giữ vững phong độ đỉnh cao nhé!'
            : (pathResult.unlockedUnit
              ? `Xuất sắc! Bạn đã mở khóa Chặng ${pathResult.unlockedUnit.index}: ${pathResult.unlockedUnit.title}.`
              : 'Phong độ rất ấn tượng! Hãy tiếp tục tiến bước trên lộ trình chinh phục khóa học.')}
        </p>

        <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-amber-50/90 px-4 py-2.5 text-xs font-extrabold text-amber-900 ring-1 ring-amber-200">
          <Award size={16} className="text-amber-600" aria-hidden="true" />
          <span>Đạt {pathResult.scorePercent || 100}% chính xác</span>
          <span>·</span>
          <span>Danh hiệu Học Viên Xuất Sắc</span>
        </div>

        <button
          type="button"
          onClick={onNext}
          className="dp-3d-btn mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-base font-black uppercase tracking-wide text-white shadow-lg hover:from-amber-600 hover:to-orange-600"
        >
          <Trophy size={18} aria-hidden="true" /> Nhận Cúp Vinh Danh
        </button>
      </div>
    </div>
  );
}

/**
 * Chuỗi màn ăn mừng sau lượt chơi (kiểu Duolingo):
 * Đã luyện tập xong → Cúp hoàn thành chặng/khóa học (nếu có) → chuỗi ngày (khi tăng) → nhiệm vụ hằng ngày (lượt đầu trong ngày) → kết quả chi tiết.
 */
export default function Celebration({ summary, onDone }) {
  const hasTrophyStage = Boolean(summary.path?.passed && (summary.path?.topicCompleted || summary.path?.unitCompleted || summary.path?.testOut));
  const stages = useMemo(() => [
    'done',
    ...(hasTrophyStage ? ['trophy'] : []),
    ...(summary.streakIncreased ? ['streak'] : []),
    ...(summary.firstToday ? ['quest'] : []),
  ], [summary, hasTrophyStage]);
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
      {stage === 'trophy' && <CourseTrophyStage summary={summary} onNext={next} />}
      {stage === 'streak' && <StreakStage summary={summary} onNext={next} />}
      {stage === 'quest' && <QuestStage onNext={next} />}
    </div>
  );
}
