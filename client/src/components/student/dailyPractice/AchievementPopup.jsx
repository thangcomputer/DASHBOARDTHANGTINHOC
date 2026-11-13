import { useEffect } from 'react';
import {
  Award, CheckCircle2, Eye, GraduationCap, Play, PlayCircle, RotateCcw, Star, Target, Timer, Trophy, X, Zap,
} from 'lucide-react';
import { practiceFinishXpDisplay } from '../../../utils/dailyPractice';
import { GameSoundManager } from '../../../utils/sound';
import Mascot from './Mascot';
import GameButton from './GameButton';
import { DEWSKILL_ANIMATION, useAnimatedNumber, useReducedMotion } from './animationConstants';
import './achievementPopup.css';

const CELEBRATED_MEMORY = new Set();

export function hasCelebratedSession(eventKey) {
  if (!eventKey) return false;
  if (CELEBRATED_MEMORY.has(eventKey)) return true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(`dp_achievement_celebrated:${eventKey}`) === '1';
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function markCelebratedSession(eventKey) {
  if (!eventKey) return;
  CELEBRATED_MEMORY.add(eventKey);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`dp_achievement_celebrated:${eventKey}`, '1');
    }
  } catch {
    /* ignore */
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function LaurelIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 32 40" width="22" height="28" fill="none" aria-hidden="true">
      <path d="M6 36C6 26 10 18 16 12C13 22 12 30 8 36H6Z" fill="#86EFAC" stroke="#22C55E" strokeWidth="1" />
      <path d="M9 33C13 27 14 20 18 14C16 22 15 28 11 33H9Z" fill="#4ADE80" />
    </svg>
  );
}

function StatTile({ label, tone, icon: Icon, value, bodyClass, delay, onClick, disabled }) {
  const Tag = onClick && !disabled ? 'button' : 'div';
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick && !disabled ? onClick : undefined}
      disabled={disabled}
      className={`dp-card-in overflow-hidden rounded-2xl border border-slate-100 bg-white text-center shadow-sm${onClick && !disabled ? ' cursor-pointer transition hover:ring-2 hover:ring-emerald-200/80' : ''}${disabled ? ' opacity-70' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p
        className="flex items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-white sm:text-[11px]"
        style={{ backgroundColor: tone }}
      >
        <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
        {label}
      </p>
      <p className={`flex min-h-[52px] items-center justify-center gap-1 px-2 py-2.5 text-base font-black tabular-nums sm:text-lg ${bodyClass}`} style={{ color: tone }}>
        {value}
      </p>
    </Tag>
  );
}

/**
 * Popup hoàn thành lượt luyện — một màn duy nhất theo mockup DewSkill.
 */
export default function AchievementPopup({
  summary,
  eventKey = '',
  onContinue,
  onReviewResults,
  onReplay,
  onDismiss,
  onRelatedVideo,
}) {
  const reducedMotion = useReducedMotion();
  const total = Math.max(1, Number(summary?.total) || 1);
  const correctCount = Math.max(0, Number(summary?.correctCount) || 0);
  const accuracy = typeof summary?.path?.scorePercent === 'number'
    ? summary.path.scorePercent
    : Math.round((correctCount / total) * 100);
  const xpDisplay = practiceFinishXpDisplay(summary || {});
  const animatedXp = useAnimatedNumber(xpDisplay.amount, DEWSKILL_ANIMATION.XP_FLOAT_MS, true);
  const animatedAccuracy = useAnimatedNumber(accuracy, DEWSKILL_ANIMATION.XP_FLOAT_MS, true);
  const stars = Number(summary?.stars) || (accuracy >= 90 ? 3 : accuracy >= 60 ? 2 : 1);
  const good = stars >= 2;
  const isPerfect = Boolean(
    summary && (summary.total || 0) >= 2 && (summary.correctCount === summary.total || summary.maxCombo === summary.total),
  );
  const mascotMood = good ? 'completed' : (summary?.passed ? 'graduate' : 'sad');
  const maxCombo = Math.max(0, Number(summary?.maxCombo) || 0);
  const durationLabel = formatDuration(summary?.durationSeconds);
  const hasRelatedVideo = Boolean(summary?.relatedLesson);

  useEffect(() => {
    const key = eventKey || summary?.sessionId || summary?.id || '';
    if (key && hasCelebratedSession(key)) return;
    if (key) markCelebratedSession(key);
    if (good) GameSoundManager.complete();
  }, [eventKey, summary, good]);

  const xpValueText = xpDisplay.prefix ? `${xpDisplay.prefix}${animatedXp}` : `${animatedXp}`;

  return (
    <div
      data-achievement-popup="true"
      className="dp-achievement-shell relative mx-auto w-full max-w-[480px] overflow-hidden rounded-[24px] bg-white text-center shadow-[0_24px_48px_-12px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
    >
      {onDismiss && (
        <button
          type="button"
          onClick={() => {
            GameSoundManager.click();
            onDismiss();
          }}
          aria-label="Đóng"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 !shadow-none"
        >
          <X size={17} />
        </button>
      )}

      <div className="dp-achievement-header px-4 pb-6 pt-5 sm:px-5 sm:pt-6">
        <div className="dp-achievement-header__rays" aria-hidden="true" />
        <div className="dp-achievement-header__wave" aria-hidden="true" />

        <div className="relative mb-3 flex items-center justify-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              size={n === 2 ? 22 : 17}
              className={n <= stars ? 'dp-star-in fill-amber-400 text-amber-500' : 'fill-slate-200 text-slate-300'}
              style={{ animationDelay: reducedMotion ? '0ms' : `${n * 120}ms` }}
            />
          ))}
        </div>

        <div className="relative flex items-end justify-center gap-2 sm:gap-4">
          <MotionMascot mood={mascotMood} reducedMotion={reducedMotion} />
          {isPerfect ? (
            <div
              data-achievement-medal="true"
              className="dp-achievement-perfect-badge relative mb-1 flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-[22px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-white shadow-[0_6px_0_#B45309,0_14px_24px_rgba(245,158,11,0.35)] ring-[3px] ring-amber-100 sm:h-[96px] sm:w-[96px]"
            >
              <Trophy size={36} strokeWidth={2.2} className="drop-shadow-sm" aria-hidden="true" />
              <span className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-amber-950 sm:text-[10px]">
                HOÀN HẢO
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <LaurelIcon className="shrink-0 scale-x-[-1] opacity-90" />
          <div className="min-w-0">
            {isPerfect ? (
              <>
                <h2 className="text-lg font-black leading-tight text-emerald-800 sm:text-xl">Xuất sắc tuyệt đối!</h2>
                <p className="text-lg font-black leading-tight text-emerald-800 sm:text-xl">Đã luyện tập xong!</p>
              </>
            ) : (
              <h2 className="text-lg font-black leading-snug text-emerald-800 sm:text-xl">
                {good ? 'Đã luyện tập xong!' : 'Hoàn thành lượt luyện!'}
              </h2>
            )}
          </div>
          <LaurelIcon className="shrink-0 opacity-90" />
        </div>

        {xpDisplay.caption ? (
          <p className="mx-auto mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100/80 sm:text-xs">
            {xpDisplay.caption}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile label="Chính xác" tone="#22C55E" icon={CheckCircle2} value={`${animatedAccuracy}%`} bodyClass="dp-achievement-stat-body--green" delay={80} />
          <StatTile label="Điểm số" tone="#3B82F6" icon={Award} value={`${correctCount}/${total}`} bodyClass="dp-achievement-stat-body--blue" delay={160} />
          <StatTile label="Nhận về" tone="#F59E0B" icon={Zap} value={xpValueText} bodyClass="dp-achievement-stat-body--amber" delay={240} />
        </div>

        <div className="dp-achievement-actions mt-4">
          {onReplay ? (
            <GameButton variant="outline" onClick={onReplay} className="!py-2.5 text-[11px] sm:text-xs">
              <RotateCcw size={14} />
              <span>Làm lại</span>
            </GameButton>
          ) : null}
          {onReviewResults ? (
            <GameButton variant="outline" onClick={onReviewResults} className="!py-2.5 text-[11px] sm:text-xs">
              <Eye size={14} />
              <span className="truncate">Xem lại kết quả</span>
            </GameButton>
          ) : null}
          <GameButton variant="primary" onClick={onContinue} className="!py-2.5 text-[11px] font-black uppercase sm:text-xs">
            <Play size={14} fill="currentColor" />
            <span className="truncate">Tiếp tục học</span>
          </GameButton>
        </div>

        <div className="dp-achievement-divider mt-4" aria-hidden="true">
          <span className="dp-achievement-divider__line" />
          <GraduationCap size={16} className="text-emerald-600" />
          <span className="dp-achievement-divider__line" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatTile
            label="Video liên quan"
            tone="#F59E0B"
            icon={PlayCircle}
            value={hasRelatedVideo ? <PlayCircle size={22} className="text-amber-500" /> : '—'}
            bodyClass="dp-achievement-stat-body--amber"
            delay={300}
            onClick={hasRelatedVideo ? onRelatedVideo : undefined}
            disabled={!hasRelatedVideo}
          />
          <StatTile
            label="Combo"
            tone="#3B82F6"
            icon={Target}
            value={`×${maxCombo}`}
            bodyClass="dp-achievement-stat-body--blue"
            delay={380}
          />
          <StatTile
            label="Thời gian"
            tone="#22C55E"
            icon={Timer}
            value={durationLabel}
            bodyClass="dp-achievement-stat-body--green"
            delay={460}
          />
        </div>
      </div>
    </div>
  );
}

function MotionMascot({ mood, reducedMotion }) {
  return (
    <div className={reducedMotion ? '' : 'dp-bounce'} style={{ maxWidth: 118 }}>
      <Mascot mood={mood} size={100} className="mx-auto" />
    </div>
  );
}
