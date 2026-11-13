import { useEffect, useMemo, useState } from 'react';
import { Award, Check, Crown, Flame, Gift, Sparkles, Star, Trophy } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import Mascot from './Mascot';
import AchievementPopup from './AchievementPopup';
import StreakCelebration from './StreakCelebration';
import './achievementPopup.css';

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

function StageShell({ children, button, onNext }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 px-2 py-6 text-center">
      {children}
      <button type="button" onClick={onNext} className="dp-3d-btn mt-2 w-full rounded-2xl bg-emerald-500 py-3.5 text-base font-black uppercase tracking-wide text-white shadow-[0_5px_0_#047857]">
        {button}
      </button>
    </div>
  );
}

function DoneStage({ summary, onNext, onReviewResults, onClose, onReplay }) {
  const isPerfect = Boolean(
    summary &&
    (summary.total || 0) >= 2 &&
    (summary.correctCount === summary.total || summary.maxCombo === summary.total)
  );
  const good = summary.stars >= 2;
  const headline = isPerfect ? 'Xuất sắc tuyệt đối!' : (good ? 'Đã luyện tập xong!' : 'Hoàn thành lượt luyện!');

  useEffect(() => {
    if (isPerfect) gameSounds.mascotVictory();
    else if (good) gameSounds.win();
    else gameSounds.sad();
  }, [good, isPerfect]);

  return (
    <div
      className="flex min-h-full items-center justify-center px-3 py-6"
      data-celebration-headline={headline}
    >
      <AchievementPopup
        summary={summary}
        eventKey={summary?.sessionId || summary?.id || ''}
        onContinue={onNext}
        onReviewResults={onReviewResults || onNext}
        onReplay={onReplay}
        onClose={onClose || onNext}
      />
    </div>
  );
}

function StreakStage({ summary, onNext }) {
  const streak = summary.stats?.streak || 1;
  useEffect(() => { gameSounds.correct(); }, []);
  return (
    <StageShell button="Tiếp tục" onNext={onNext}>
      {/* StreakCelebration hiển thị ngọn lửa phản ứng & lời chúc mừng ở các mốc 3, 7, 30 ngày liên tiếp */}
      <StreakCelebration
        streak={streak}
        streakIncreased={Boolean(summary.streakIncreased)}
        week={summary.week || []}
      />
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
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-md ${filled ? 'dp-bounce' : ''}`}>
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
            <Mascot mood="unlocked" size={112} />
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
            <Mascot mood="completed" size={104} />
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
export default function Celebration({ summary, onDone, onClose, onReviewResults, onReplay }) {
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
      {stage === 'done' && (
        <DoneStage
          summary={summary}
          onNext={next}
          onReviewResults={onReviewResults || onDone}
          onClose={onClose || onDone}
          onReplay={onReplay}
        />
      )}
      {stage === 'trophy' && <CourseTrophyStage summary={summary} onNext={next} />}
      {stage === 'streak' && <StreakStage summary={summary} onNext={next} />}
      {stage === 'quest' && <QuestStage onNext={next} />}
    </div>
  );
}
