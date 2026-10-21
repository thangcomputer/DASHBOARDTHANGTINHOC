import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Lightbulb, Loader2, Move, Play, Sparkles, Trophy, Volume2, VolumeX } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import { isSoundMuted, playLessonCorrectSound, playLessonTick, playLessonWrongSound, unlockAudio } from '../../../utils/sound';
import { remainingPracticeSeconds, resolvePracticeClock, resolvePracticeGroupTimeLimit, restorePracticeClockSession } from '../../../utils/lessonPracticeClock';
import {
  advancePracticeAttemptStats,
  claimPracticeSubmission,
  createPracticeAttemptStats,
  getPracticeEncouragement,
  getPracticePraise,
  isPracticeAttemptComplete,
  isPerfectTenPracticeResult,
  normalizePracticeAttemptStats,
  summarizePracticeAttempt,
} from '../../../utils/lessonPracticeQuizFeedback';
import './LessonPracticeQuizFeedback.css';

function eventPercent(event, node) {
  const box = node.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  return {
    x: Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)),
    y: Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)),
  };
}

function LessonFigure({ imageUrl, caption, region, point, onPick, compact = false }) {
  const ref = useRef(null);
  if (!imageUrl) return null;
  return (
    <div className="space-y-2">
      <div
        ref={ref}
        className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${onPick ? 'cursor-crosshair' : ''}`}
        onClick={(event) => {
          if (!onPick || !ref.current) return;
          const next = eventPercent(event, ref.current);
          if (next) onPick(next);
        }}
      >
        <img src={resolveMediaUrl(imageUrl)} alt="" className={`mx-auto block w-full object-contain pointer-events-none ${compact ? 'max-h-[293px]' : 'max-h-[440px]'}`} />
        {region && (
          <span
            className="absolute border-2 border-emerald-500 bg-emerald-400/25 pointer-events-none"
            style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }}
          />
        )}
        {point && (
          <span
            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 pointer-events-none"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        )}
      </div>
      {caption && <p className="text-sm text-slate-500">{caption}</p>}
    </div>
  );
}

function Explanation({ item }) {
  if (!item.confirmed) return null;
  const tone = item.correct === true
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : item.correct === false
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-sky-200 bg-sky-50 text-sky-950';
  const label = item.correct === true ? 'Chúc mừng' : item.correct === false ? 'Chưa đúng' : 'Giải thích';
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-black uppercase tracking-wide text-xs">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">{item.explanation || 'Đã ghi nhận câu trả lời.'}</p>
    </div>
  );
}

const PRACTICE_TYPES = new Set(['mcq', 'multi', 'match', 'drag', 'hotspot', 'written']);
const COOLDOWN_QUESTION_TYPES = new Set(['mcq', 'multi', 'match', 'drag', 'hotspot']);

function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function warnAtFor(limit) {
  if (limit <= 10) return Math.max(3, Math.ceil(limit / 2));
  return 10;
}

function readSavedPracticeSeconds(key, limitSec) {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved === null) return null;
    const seconds = Number(saved);
    if (!Number.isFinite(seconds)) return null;
    return Math.min(Math.max(0, Math.round(limitSec)), Math.max(0, Math.round(seconds)));
  } catch (err) {
    console.warn('Không đọc được thời gian luyện tập đã lưu', err);
    return null;
  }
}

function savePracticeValue(key, value) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch (err) {
    console.warn('Không lưu được trạng thái luyện tập', err);
  }
}

function clearPracticeStorage(prefix) {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch (err) {
    console.warn('Không xóa được trạng thái luyện tập đã lưu', err);
  }
}

function readPracticeAttemptStats(key) {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? normalizePracticeAttemptStats(JSON.parse(saved)) : createPracticeAttemptStats();
  } catch (err) {
    console.warn('Không đọc được thống kê lượt luyện tập đã lưu', err);
    return createPracticeAttemptStats();
  }
}

function savePracticeAttemptStats(key, stats) {
  try {
    sessionStorage.setItem(key, JSON.stringify(stats));
  } catch (err) {
    console.warn('Không lưu được thống kê lượt luyện tập', err);
  }
}

function QuizClock({ remaining, warning }) {
  const hand = (remaining % 60) * 6;
  return (
    <div className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 ${warning ? 'lesson-clock-blink border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      <span className="relative h-8 w-8" aria-hidden>
        <Clock size={32} />
        <span
          className="absolute bottom-1/2 left-1/2 h-2.5 w-0.5 origin-bottom rounded-full bg-red-600"
          style={{ transform: `translateX(-50%) rotate(${hand}deg)` }}
        />
      </span>
      <span className="min-w-12 text-sm font-black tabular-nums">{formatClock(remaining)}</span>
    </div>
  );
}

function PracticeModalIcon({ timeout = false }) {
  const Icon = timeout ? Clock : Play;
  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto mb-4 grid h-[76px] w-[76px] place-items-center rounded-[26px] bg-gradient-to-br ${
        timeout ? 'from-orange-500 to-red-600 shadow-orange-200' : 'from-red-500 to-rose-600 shadow-red-200'
      } text-white shadow-lg`}
    >
      <span className="absolute inset-[5px] rounded-[22px] border border-white/35" />
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm">
        <Icon size={timeout ? 27 : 25} strokeWidth={2.5} fill={timeout ? 'none' : 'currentColor'} />
      </span>
      <Sparkles className="absolute -right-1 -top-1 text-amber-300 drop-shadow-sm" size={19} strokeWidth={2.5} />
      <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full border-2 border-white bg-amber-300" />
    </div>
  );
}

function PracticeFeedbackBanner({ feedback, exiting }) {
  if (!feedback) return null;
  return (
    <div
      key={`${feedback.itemId}-${feedback.text}`}
      className={`quiz-feedback quiz-feedback--correct${exiting ? ' quiz-feedback--leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="quiz-feedback__icon" aria-hidden="true">{feedback.icon}</span>
      <div>
        <strong>{feedback.text}</strong>
        <p>{feedback.streak >= 3 ? `Tuyệt vời! Bạn đã đúng ${feedback.streak} câu liên tiếp!` : 'Tiếp tục phát huy nhé!'}</p>
      </div>
    </div>
  );
}

function PracticeResult({ result, celebrate }) {
  const perfect = isPerfectTenPracticeResult(result);
  const particles = Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 28) * Math.PI * 2;
    const distance = 90 + (index % 5) * 24;
    return {
      id: index,
      x: `${Math.cos(angle) * distance}px`,
      y: `${Math.sin(angle) * distance - 24}px`,
      rotation: `${(index * 47) % 360}deg`,
      delay: `${(index % 7) * 45}ms`,
      color: ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7'][index % 5],
    };
  });
  return (
    <section className="quiz-result-card" aria-labelledby="practice-result-title">
      {perfect && celebrate && (
        <div className="quiz-confetti" aria-hidden="true">
          {particles.map((particle) => (
            <i
              key={particle.id}
              className="quiz-confetti__piece"
              style={{
                '--quiz-confetti-x': particle.x,
                '--quiz-confetti-y': particle.y,
                '--quiz-confetti-rotation': particle.rotation,
                '--quiz-confetti-delay': particle.delay,
                '--quiz-confetti-color': particle.color,
              }}
            />
          ))}
        </div>
      )}
      <div className={`quiz-result-card__icon ${perfect ? 'quiz-result-card__icon--perfect' : ''}`} aria-hidden="true">
        <Trophy size={42} strokeWidth={2.2} />
      </div>
      <p className="quiz-result-card__eyebrow">ĐÃ HOÀN THÀNH BÀI LUYỆN TẬP</p>
      <h2 id="practice-result-title" className="quiz-result-card__title">
        {perfect ? 'HOÀN HẢO! Bạn là nhà vô địch!' : 'Bạn đã hoàn thành rất tốt!'}
      </h2>
      <p className="quiz-result-card__summary">Bạn đã hoàn thành {result.total} câu hỏi.</p>
      <div className="quiz-result-card__stats">
        <div><strong>{result.correct}/{result.total}</strong><span>Câu đúng</span></div>
        <div><strong>{result.wrong}</strong><span>Lượt trả lời sai</span></div>
        <div><strong>{result.percentage}%</strong><span>Độ chính xác</span></div>
        <div><strong>{result.bestStreak}</strong><span>Chuỗi đúng dài nhất</span></div>
      </div>
    </section>
  );
}

function QuestionCard({ item, index, busy, open = true, attemptFeedback, feedbackExiting = false, expired = false, waiting = false, cooldownSeconds = 0, onConfirm }) {
  const [showHint, setShowHint] = useState(false);
  const [choiceId, setChoiceId] = useState(item.answer?.choiceId || '');
  const [choiceIds, setChoiceIds] = useState(item.answer?.choiceIds || []);
  const [matches, setMatches] = useState(() => Object.fromEntries((item.answer?.matches || []).map((row) => [row.leftId, row.rightId])));
  const [order, setOrder] = useState(item.options || []);
  const [text, setText] = useState(item.answer?.text || '');
  const [point, setPoint] = useState(item.answer?.x != null ? { x: item.answer.x, y: item.answer.y } : null);
  const [hasReordered, setHasReordered] = useState(false);
  const [dragGhost, setDragGhost] = useState(null);
  const [dropId, setDropId] = useState('');
  const dragListeners = useRef(null);

  useEffect(() => () => {
    if (!dragListeners.current) return;
    window.removeEventListener('pointermove', dragListeners.current.move);
    window.removeEventListener('pointerup', dragListeners.current.up);
  }, []);

  if (item.type === 'image_view') {
    return (
      <article className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <LessonFigure imageUrl={item.imageUrl} caption={item.caption || item.prompt} />
      </article>
    );
  }

  const done = !!item.confirmed;
  const frozen = done || waiting || expired;
  const canConfirm = item.type === 'mcq'
    ? !!choiceId
    : item.type === 'multi'
      ? choiceIds.length > 0
      : item.type === 'match'
        ? (item.lefts || []).length > 0 && item.lefts.every((left) => !!matches[left.id])
        : item.type === 'drag'
          ? hasReordered
          : item.type === 'hotspot'
            ? !!point
            : item.type === 'written'
              ? !!text.trim()
              : false;

  function beginDrag(event, opt, step) {
    if (frozen || event.button !== 0) return;
    event.preventDefault();
    const fromId = opt.id;
    const place = (e) => {
      setDragGhost({ id: fromId, text: opt.text, step, x: e.clientX, y: e.clientY });
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-drag-id]');
      setDropId(row?.getAttribute('data-drag-id') || '');
    };
    const finish = (e) => {
      window.removeEventListener('pointermove', place);
      window.removeEventListener('pointerup', finish);
      dragListeners.current = null;
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-drag-id]');
      const toId = row?.getAttribute('data-drag-id') || '';
      const fromIndex = order.findIndex((rowItem) => rowItem.id === fromId);
      const toIndex = order.findIndex((rowItem) => rowItem.id === toId);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) setHasReordered(true);
      setOrder((current) => {
        const from = current.findIndex((rowItem) => rowItem.id === fromId);
        const to = current.findIndex((rowItem) => rowItem.id === toId);
        if (from < 0 || to < 0 || from === to) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      setDragGhost(null);
      setDropId('');
    };
    if (dragListeners.current) {
      window.removeEventListener('pointermove', dragListeners.current.move);
      window.removeEventListener('pointerup', dragListeners.current.up);
    }
    dragListeners.current = { move: place, up: finish };
    place(event);
    window.addEventListener('pointermove', place);
    window.addEventListener('pointerup', finish);
  }
  if (item.type === 'mcq' && !open && !done) {
    return (
      <article id={`lesson-q-${item.id}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
        <h2 className="flex items-baseline gap-2 overflow-x-auto whitespace-nowrap text-base font-bold text-slate-400">
          <span className="shrink-0 text-xs font-black uppercase tracking-widest">Câu {index}.</span>
          <span>{item.prompt}</span>
        </h2>
        <p className="mt-2 text-sm text-slate-500">Chọn đúng câu trước để làm câu này.</p>
      </article>
    );
  }
  return (
    <article id={`lesson-q-${item.id}`} className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.06)] space-y-4 sm:p-5">
      {(index > 0 || item.prompt) && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-600">
            {index > 0 ? `Câu ${index}` : 'Câu'}
          </p>
          <h2 className="text-xl sm:text-2xl font-black leading-snug text-slate-900">
            {item.prompt}
          </h2>
        </div>
      )}
      <div className={frozen && !done ? 'pointer-events-none select-none' : ''}>
      {item.type === 'hotspot' && (
        <LessonFigure
          imageUrl={item.imageUrl}
          caption={done || waiting ? '' : 'Bấm đúng vùng trên ảnh, rồi xác nhận.'}
          region={done ? item.region : null}
          point={point}
          onPick={frozen ? null : setPoint}
        />
      )}
      {item.type !== 'hotspot' && item.imageUrl && (
        <LessonFigure imageUrl={item.imageUrl} caption={item.caption} compact={item.type === 'mcq'} />
      )}
      {item.type === 'mcq' && (
        <div className="space-y-2.5">
          {(item.options || []).map((opt, optIndex) => {
            const selected = (done ? item.answer?.choiceId : choiceId) === opt.id;
            const isKey = done && item.correctOptionId === opt.id;
            return (
              <label key={opt.id}                   className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-red-200 ${isKey ? 'border-emerald-300 bg-emerald-50' : selected ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name={`q-${item.id}`}
                  className="sr-only"
                  disabled={frozen}
                  checked={selected}
                  onChange={() => setChoiceId(opt.id)}
                />
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-black ${isKey ? 'border-emerald-600 bg-emerald-600 text-white' : selected ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 bg-white text-slate-500'}`}>
                  {isKey ? '✓' : optIndex + 1}
                </span>
                <span className="leading-relaxed text-slate-800">{opt.text}</span>
              </label>
            );
          })}
        </div>
      )}
      {item.type === 'multi' && (
        <div className="space-y-2.5">
          {(item.options || []).map((opt, optIndex) => {
            const picked = done ? (item.answer?.choiceIds || []) : choiceIds;
            const selected = picked.includes(opt.id);
            const isKey = done && (item.correctOptionIds || []).includes(opt.id);
            return (
              <label key={opt.id}               className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-red-200 ${isKey ? 'border-emerald-300 bg-emerald-50' : selected ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                <input
                  type="checkbox"
                  disabled={frozen}
                  className="sr-only"
                  checked={selected}
                  onChange={() => setChoiceIds((current) => (current.includes(opt.id) ? current.filter((id) => id !== opt.id) : [...current, opt.id]))}
                />
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-black ${isKey ? 'border-emerald-600 bg-emerald-600 text-white' : selected ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 bg-white text-slate-500'}`}>
                  {isKey ? '✓' : selected ? '✓' : String(optIndex + 1)}
                </span>
                <span className="leading-relaxed text-slate-800">{opt.text}</span>
              </label>
            );
          })}
        </div>
      )}
      {item.type === 'match' && (
        <div className="space-y-2">
          {(item.lefts || []).map((left) => (
            <div key={left.id} className="grid items-center gap-2 sm:grid-cols-2">
              <p className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">{left.text}</p>
              <select
                disabled={frozen}
                value={done ? (item.answer?.matches || []).find((row) => row.leftId === left.id)?.rightId || '' : (matches[left.id] || '')}
                onChange={(e) => setMatches((current) => ({ ...current, [left.id]: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Chọn đáp án</option>
                {(item.rights || []).map((right) => (
                  <option key={right.id} value={right.id}>{right.text}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      {item.type === 'drag' && (
        <div className="space-y-1.5">
          {(done ? (item.options || []) : order).map((opt, optIndex) => (
            <div
              key={opt.id}
              role={frozen ? undefined : 'button'}
              aria-label={frozen ? undefined : `Kéo bước ${optIndex + 1} ${opt.text}`}
              data-drag-id={frozen ? undefined : opt.id}
              onPointerDown={frozen ? undefined : (event) => beginDrag(event, opt, optIndex + 1)}
              className={`group flex select-none items-center gap-2 rounded-xl border px-2 py-1.5 text-sm ${dropId === opt.id && dragGhost ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} ${dragGhost?.id === opt.id ? 'opacity-50' : ''} ${frozen ? '' : 'cursor-grab touch-none'}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${frozen ? 'border-transparent text-transparent' : 'border-slate-200 bg-white text-slate-500 group-hover:border-red-600 group-hover:bg-red-600 group-hover:text-white'}`}>
                <Move size={16} />
              </span>
              <span className="shrink-0 text-xs font-black uppercase tracking-wide text-slate-500">Bước {optIndex + 1}:</span>
              <span className="ml-[calc(1cm-0.5rem)] font-bold text-slate-800">{opt.text}</span>
            </div>
          ))}
          {dragGhost && (
            <div
              className="pointer-events-none fixed z-[80] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border border-red-700 bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-xl"
              style={{ left: dragGhost.x, top: dragGhost.y }}
            >
              <Move size={16} />
              <span>Bước {dragGhost.step}</span>
              <span>{dragGhost.text}</span>
            </div>
          )}
        </div>
      )}
      {item.type === 'written' && (
        <textarea
          value={done ? (item.answer?.text || '') : text}
          disabled={frozen}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Ghi câu trả lời của bạn"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 disabled:bg-slate-50"
        />
      )}
      {attemptFeedback && !attemptFeedback.correct && !done && (
        <div className={`quiz-feedback quiz-feedback--encouragement${feedbackExiting ? ' quiz-feedback--leaving' : ''}`} role="status" aria-live="polite">
          <span className="quiz-feedback__icon" aria-hidden="true">{attemptFeedback.icon}</span>
          <div className="min-w-0 flex-1">
            <strong>{attemptFeedback.text}</strong>
            <p>{attemptFeedback.detail || 'Mình cùng xem lại câu hỏi rồi thử tiếp nhé.'}</p>
          </div>
        </div>
      )}
      {!done && cooldownSeconds > 0 && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm font-bold text-amber-900" role="status" aria-live="polite">
          <Clock size={16} aria-hidden="true" />
          <span>Thử lại sau {cooldownSeconds} giây</span>
        </div>
      )}
      <Explanation item={item} />
      </div>
      {!frozen && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !canConfirm}
            onClick={() => {
              if (item.type === 'mcq') onConfirm({ choiceId });
              else if (item.type === 'multi') onConfirm({ choiceIds });
              else if (item.type === 'match') onConfirm({ matches: (item.lefts || []).map((left) => ({ leftId: left.id, rightId: matches[left.id] || '' })) });
              else if (item.type === 'drag') onConfirm({ order: order.map((row) => row.id) });
              else if (item.type === 'hotspot') onConfirm(point || {});
              else onConfirm({ text });
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 px-4 py-2.5 text-sm font-black text-white shadow-[0_16px_24px_rgba(239,68,68,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Xác nhận
          </button>
          <button
            type="button"
            aria-expanded={showHint}
            onClick={() => setShowHint((visible) => !visible)}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800 transition hover:bg-amber-100"
          >
            <Lightbulb size={15} />
            {showHint ? 'Ẩn gợi ý' : 'Gợi ý'}
          </button>
        </div>
      )}
      {showHint && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-black">Gợi ý</p>
          <p className="mt-1 whitespace-pre-wrap">{item.hint || 'Giáo viên chưa thêm gợi ý cho câu này.'}</p>
        </div>
      )}
    </article>
  );
}

export default function LessonPracticePlayerPage({ unitId: unitIdProp, practiceGroupId = '', embedded = false, onUnitStatus }) {
  const params = useParams();
  const unitId = unitIdProp || params.unitId;
  const navigate = useNavigate();
  const attemptStatsStorageKey = `lesson-practice-quiz-stats:${unitId}:${practiceGroupId || 'all'}`;
  const [payload, setPayload] = useState(null);
  const [loadedUnitId, setLoadedUnitId] = useState('');
  const loading = loadedUnitId !== String(unitId || '');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [unitStatus, setUnitStatus] = useState('');
  const [retries, setRetries] = useState({});
  const [resetting, setResetting] = useState(false);
  const [practiceRound, setPracticeRound] = useState(0);
  const [focusId, setFocusId] = useState('');
  const [clockTry, setClockTry] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [expired, setExpired] = useState(false);
  const [started, setStarted] = useState(false);
  const [wrongAnswerCooldown, setWrongAnswerCooldown] = useState(0);
  const [celebratingQuestionId, setCelebratingQuestionId] = useState('');
  const [attemptStats, setAttemptStats] = useState(() => readPracticeAttemptStats(attemptStatsStorageKey));
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [feedbackExiting, setFeedbackExiting] = useState(false);
  const [completionCelebration, setCompletionCelebration] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const clockSessionRef = useRef(null);
  const clockPersistenceDisabledRef = useRef(false);
  const attemptStatsRef = useRef(attemptStats);
  const submittingItemsRef = useRef(new Set());
  const completionCelebratedRef = useRef(false);

  const items = (payload?.items || []).filter((item) => (
    !practiceGroupId || String(item.practiceGroupId || unitId) === practiceGroupId
  ));
  const quizzes = items.filter((item) => PRACTICE_TYPES.has(item.type));
  const others = items.filter((item) => !PRACTICE_TYPES.has(item.type));
  const answered = quizzes.filter((item) => item.confirmed).length;
  const progressPercent = quizzes.length ? Math.round((answered / quizzes.length) * 100) : 0;
  const allCorrect = isPracticeAttemptComplete(quizzes);
  const result = allCorrect ? summarizePracticeAttempt(quizzes, attemptStats) : null;
  const firstOpen = quizzes.findIndex((item) => !item.confirmed);
  const lastIndex = Math.max(quizzes.length - 1, 0);
  const openLimit = firstOpen === -1 ? lastIndex : firstOpen;
  const focusIndex = quizzes.findIndex((item) => item.id === focusId);
  const visibleIndex = focusIndex >= 0 && focusIndex <= openLimit ? focusIndex : (firstOpen === -1 ? -1 : firstOpen);
  const visibleQuiz = visibleIndex >= 0 ? quizzes[visibleIndex] : null;
  const groupTimeLimitSec = resolvePracticeGroupTimeLimit(
    payload?.unit?.practiceTimeLimits,
    practiceGroupId,
    payload?.unit?.timeLimitSec,
  );
  const clock = resolvePracticeClock(groupTimeLimitSec, visibleQuiz?.timeLimitSec);
  const clockLimit = visibleQuiz && !visibleQuiz.confirmed ? clock.limitSec : 0;
  const timed = clockLimit > 0;
  const warnAt = warnAtFor(clockLimit);
  const clockSessionKey = `${unitId}:${practiceGroupId || 'all'}:${practiceRound}:${clockTry}:${clock.shared ? 'shared' : visibleQuiz?.id || ''}`;
  const clockStoragePrefix = `lesson-practice-clock:${unitId}:${practiceGroupId || 'all'}:`;
  const clockStorageKey = `${clockStoragePrefix}${clock.shared ? 'shared' : visibleQuiz?.id || ''}`;
  const startedStorageKey = `lesson-practice-started:${unitId}:${practiceGroupId || 'all'}`;
  const savedClockSeconds = timed ? readSavedPracticeSeconds(clockStorageKey, clockLimit) : null;
  const hasResumableAttempt = answered > 0
    || savedClockSeconds !== null
    || (() => {
      try { return sessionStorage.getItem(startedStorageKey) === '1'; }
      catch (err) {
        console.warn('Không đọc được trạng thái bắt đầu luyện tập', err);
        return false;
      }
    })();

  useEffect(() => {
    let alive = true;
    lessonPracticeApi.student.unit(unitId)
      .then((res) => {
        if (!alive) return;
        setError('');
        setWrongAnswerCooldown(0);
        setPayload(res.data);
        setStarted(false);
        setClockTry(0);
        setRetries({});
        setFocusId('');
        const savedStats = readPracticeAttemptStats(attemptStatsStorageKey);
        attemptStatsRef.current = savedStats;
        setAttemptStats(savedStats);
        setAttemptFeedback(null);
        setFeedbackExiting(false);
        setCompletionCelebration(false);
        completionCelebratedRef.current = false;
        const status = res.data?.unit?.status || '';
        setUnitStatus(status);
        if (status) onUnitStatus?.(status);
      })
      .catch((err) => { if (alive) setError(err.message || 'Không mở được buổi học'); })
      .finally(() => { if (alive) setLoadedUnitId(String(unitId || '')); });
    return () => { alive = false; };
  }, [unitId, practiceGroupId, attemptStatsStorageKey]);

  useEffect(() => {
    if (!timed || !started) return undefined;
    clockPersistenceDisabledRef.current = false;
    const restoredSeconds = readSavedPracticeSeconds(clockStorageKey, clockLimit);
    clockSessionRef.current = restorePracticeClockSession(
      clockSessionRef.current,
      clockSessionKey,
      clockLimit,
      restoredSeconds,
    );
    const initialRemaining = remainingPracticeSeconds(clockSessionRef.current);
    setRemaining(initialRemaining);
    setExpired(initialRemaining <= 0);
    savePracticeValue(clockStorageKey, initialRemaining);
    const timer = window.setInterval(() => {
      const left = remainingPracticeSeconds(clockSessionRef.current);
      setRemaining(Math.max(0, left));
      if (!clockPersistenceDisabledRef.current) savePracticeValue(clockStorageKey, left);
      if (left > 0 && left <= warnAt && soundEnabled && !isSoundMuted()) playLessonTick(left % 2 === 0);
      if (left <= 0) {
        window.clearInterval(timer);
        setExpired(true);
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      if (!clockPersistenceDisabledRef.current && clockSessionRef.current?.key === clockSessionKey) {
        savePracticeValue(clockStorageKey, remainingPracticeSeconds(clockSessionRef.current));
      }
    };
  }, [timed, clockLimit, warnAt, clockSessionKey, clockStorageKey, started, soundEnabled]);

  useEffect(() => {
    if (!allCorrect) return;
    clockPersistenceDisabledRef.current = true;
    clearPracticeStorage(clockStoragePrefix);
    clearPracticeStorage(startedStorageKey);
  }, [allCorrect, clockStoragePrefix, startedStorageKey]);

  useEffect(() => {
    if (wrongAnswerCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setWrongAnswerCooldown((remainingSeconds) => Math.max(0, remainingSeconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [wrongAnswerCooldown > 0]);

  useEffect(() => {
    if (!celebratingQuestionId) return undefined;
    const timeout = window.setTimeout(() => setCelebratingQuestionId(''), 2000);
    return () => window.clearTimeout(timeout);
  }, [celebratingQuestionId]);

  useEffect(() => {
    if (!attemptFeedback) return undefined;
    const exitTimeout = window.setTimeout(() => setFeedbackExiting(true), 2500);
    const clearTimeoutId = window.setTimeout(() => setAttemptFeedback(null), 2900);
    return () => {
      window.clearTimeout(exitTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [attemptFeedback]);

  async function confirm(item, body) {
    if (!claimPracticeSubmission(submittingItemsRef.current, item.id, item.confirmed)) return;
    unlockAudio();
    setBusyId(item.id);
    setError('');
    const usesWrongAnswerCooldown = COOLDOWN_QUESTION_TYPES.has(item.type);
    try {
      const res = await lessonPracticeApi.student.confirm(item.id, body);
      const answeredItem = res.data?.item;
      if (!answeredItem) throw new Error('Không nhận được kết quả chấm câu trả lời');
      if (res.data.retry || answeredItem.correct === false) {
        const nextStats = advancePracticeAttemptStats(attemptStatsRef.current, false);
        attemptStatsRef.current = nextStats;
        setAttemptStats(nextStats);
        savePracticeAttemptStats(attemptStatsStorageKey, nextStats);
        const detail = String(answeredItem.feedback || '').trim();
        setFeedbackExiting(false);
        setAttemptFeedback({
          itemId: item.id,
          correct: false,
          text: getPracticeEncouragement(nextStats.wrongAttempts),
          icon: '🌱',
          detail: detail === 'Bạn sai rồi, vui lòng chọn lại đáp án' ? '' : detail,
        });
        setRetries((prev) => ({
          ...prev,
          [item.id]: { n: (prev[item.id]?.n || 0) + 1 },
        }));
        if (soundEnabled) playLessonWrongSound();
        if (usesWrongAnswerCooldown) setWrongAnswerCooldown(10);
        return;
      }
      setRetries((prev) => {
        if (!prev[item.id]) return prev;
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      const nextItems = (payload?.items || []).map((row) => (row.id === item.id ? answeredItem : row));
      const nextQuizzes = nextItems.filter((row) => (
        PRACTICE_TYPES.has(row.type)
        && (!practiceGroupId || String(row.practiceGroupId || unitId) === practiceGroupId)
      ));
      const completedBeforeAnswer = isPracticeAttemptComplete(quizzes);
      const completedAfterAnswer = isPracticeAttemptComplete(nextQuizzes);
      setPayload((prev) => ({ ...prev, items: nextItems }));
      if (answeredItem.correct === true && answeredItem.confirmed === true && !res.data.alreadyConfirmed) {
        const nextStats = advancePracticeAttemptStats(attemptStatsRef.current, true);
        attemptStatsRef.current = nextStats;
        setAttemptStats(nextStats);
        savePracticeAttemptStats(attemptStatsStorageKey, nextStats);
        const correctCount = nextQuizzes.filter((row) => row.confirmed === true && row.correct === true).length;
        setFeedbackExiting(false);
        setAttemptFeedback({
          itemId: item.id,
          correct: true,
          text: getPracticePraise(correctCount).text,
          icon: getPracticePraise(correctCount).icon,
          streak: nextStats.streak,
        });
        if (soundEnabled) playLessonCorrectSound();
        setFocusId('');
        setCelebratingQuestionId(item.id);
        if (completedAfterAnswer && !completedBeforeAnswer && !completionCelebratedRef.current) {
          completionCelebratedRef.current = true;
          setCompletionCelebration(true);
        }
      }
      if (answeredItem.confirmed) savePracticeValue(startedStorageKey, '1');
      if (res.data.unitStatus) {
        setUnitStatus(res.data.unitStatus);
        onUnitStatus?.(res.data.unitStatus);
      }
    } catch (err) {
      setError(err.message || 'Không xác nhận được câu này');
    } finally {
      submittingItemsRef.current.delete(item.id);
      setBusyId('');
    }
  }

  function toggleSound() {
    setSoundEnabled((enabled) => !enabled);
  }

  async function resetPractice({ startImmediately = false } = {}) {
    setResetting(true);
    setError('');
    try {
      const res = await lessonPracticeApi.student.resetPractice(unitId, practiceGroupId);
      clockPersistenceDisabledRef.current = true;
      clearPracticeStorage(clockStoragePrefix);
      clearPracticeStorage(startedStorageKey);
      clockSessionRef.current = null;
      setPayload(res.data);
      setRetries({});
      setFocusId('');
      setExpired(false);
      setClockTry(0);
      const emptyStats = createPracticeAttemptStats();
      attemptStatsRef.current = emptyStats;
      setAttemptStats(emptyStats);
      savePracticeAttemptStats(attemptStatsStorageKey, emptyStats);
      setAttemptFeedback(null);
      setFeedbackExiting(false);
      setCompletionCelebration(false);
      completionCelebratedRef.current = false;
      if (startImmediately) savePracticeValue(startedStorageKey, '1');
      setStarted(startImmediately);
      setPracticeRound((round) => round + 1);
      const status = res.data?.unit?.status || '';
      if (status) {
        setUnitStatus(status);
        if (status === 'completed') onUnitStatus?.(status);
      }
    } catch (err) {
      setError(err.message || 'Không luyện tập lại được');
    } finally {
      setResetting(false);
    }
  }

  const subjectId = payload?.subject?.id;

  const body = (
    <div className={embedded ? 'flex min-h-full flex-col gap-4' : 'max-w-3xl mx-auto space-y-4'}>
        {!embedded && (
        <button
          type="button"
          onClick={() => navigate(subjectId ? `/student/lesson-practice/subjects/${subjectId}` : '/student/lesson-practice')}
          className="inline-flex items-center gap-1 text-sm font-bold text-red-600"
        >
          <ArrowLeft size={16} /> Danh sách buổi
        </button>
        )}
        {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang mở buổi học...</div>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {payload?.unit && (
          <>
            {!embedded && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{payload.subject?.name || 'Khóa học'}</p>
                    <h1 className="mt-1 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{payload.unit.title}</h1>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <span className={`inline-block h-2 w-2 rounded-full ${unitStatus === 'completed' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                    {unitStatus === 'completed' ? 'Hoàn thành' : 'Đang luyện tập'}
                  </div>
                </div>
              </div>
            )}
            <div className={embedded ? 'relative flex min-h-0 flex-1 flex-col gap-4' : 'relative space-y-4'}>
              <style>{`
                @keyframes lesson-clock-blink {
                  0%, 49% { opacity: 1; }
                  50%, 100% { opacity: 0.28; }
                }
                .lesson-clock-blink { animation: lesson-clock-blink 0.5s step-end infinite; }
                .lesson-progress-marker {
                  position: relative;
                  overflow: visible;
                }
                .lesson-progress-confetti {
                  position: absolute;
                  left: 50%;
                  top: 50%;
                  z-index: 20;
                  width: 5px;
                  height: 8px;
                  border-radius: 1px;
                  pointer-events: none;
                  animation: lesson-progress-burst 2s cubic-bezier(.15,.65,.3,1) both;
                }
                @keyframes lesson-progress-burst {
                  0% { opacity: 1; transform: translate(-50%, -50%) scale(.5) rotate(0deg); }
                  100% { opacity: 0; transform: translate(var(--burst-x), var(--burst-y)) scale(.85) rotate(var(--burst-rotate)); }
                }
                @media (prefers-reduced-motion: reduce) {
                  .lesson-progress-confetti {
                    animation: none;
                    opacity: 0;
                  }
                }
              `}</style>
              {quizzes.length > 0 && (
                <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">
                      Tiến độ <span className="ml-1 font-bold text-slate-900">{answered}/{quizzes.length}</span>
                    </p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-sm font-bold text-amber-900" aria-label={`Chuỗi đúng hiện tại ${attemptStats.streak}`}>
                        <Sparkles size={16} className="text-amber-600" aria-hidden="true" />
                        <span>Chuỗi đúng: {attemptStats.streak}</span>
                      </span>
                      <button
                        type="button"
                        onClick={toggleSound}
                        aria-label={soundEnabled ? 'Tắt âm thanh luyện tập' : 'Bật âm thanh luyện tập'}
                        aria-pressed={soundEnabled}
                        title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                      >
                        {soundEnabled ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
                      </button>
                      {timed && (
                        <QuizClock
                          remaining={started ? remaining : (savedClockSeconds ?? clockLimit)}
                          warning={started && remaining > 0 && remaining <= warnAt}
                        />
                      )}
                    </div>
                  </div>
                  <nav
                    aria-label={`Tiến trình câu hỏi, ${answered} trên ${quizzes.length} câu`}
                    className="overflow-x-auto pb-1"
                  >
                    <div
                      className="relative flex min-h-10 items-start justify-between"
                      style={{ minWidth: `${Math.max(100, quizzes.length * 36)}px` }}
                    >
                      <div aria-hidden="true" className="absolute left-3 right-3 top-[7px] h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      {quizzes.map((item, index) => {
                        const reachable = started && index <= openLimit;
                        const current = started && index === visibleIndex;
                        const needsRetry = Boolean(retries[item.id]?.n) || (item.confirmed && item.correct === false);
                        const tone = item.confirmed && item.correct === true
                          ? 'bg-emerald-500 text-white'
                          : needsRetry
                            ? 'bg-amber-400 text-amber-950'
                            : current
                              ? 'border-2 border-red-600 bg-white text-red-700'
                              : 'border border-slate-300 bg-white text-slate-500';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={!reachable}
                            onClick={() => setFocusId(item.id)}
                            aria-current={current ? 'step' : undefined}
                            aria-label={`Câu ${index + 1}${needsRetry ? ', đang luyện tập lại' : item.confirmed ? ', trả lời đúng' : ', chưa làm'}${current ? ', đang xem' : ''}`}
                            className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1 text-[10px] font-semibold text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className={`lesson-progress-marker grid h-4 w-4 place-items-center rounded-full text-[9px] leading-none ${tone}`}>
                              {item.confirmed && item.correct === true ? '✓' : needsRetry ? '↻' : ''}
                              {celebratingQuestionId === item.id && item.confirmed && item.correct === true && (
                                <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                                  {[
                                    [-21, -19, '#f43f5e', -55],
                                    [-12, -28, '#f59e0b', 35],
                                    [1, -31, '#10b981', -25],
                                    [14, -25, '#3b82f6', 60],
                                    [22, -13, '#a855f7', -40],
                                    [22, 2, '#f97316', 75],
                                    [12, 17, '#06b6d4', 45],
                                    [-5, 20, '#eab308', -65],
                                    [-19, 12, '#ec4899', 30],
                                    [-26, -2, '#22c55e', -35],
                                  ].map(([x, y, color, rotation], particleIndex) => (
                                    <i
                                      key={particleIndex}
                                      className="lesson-progress-confetti"
                                      style={{
                                        backgroundColor: color,
                                        '--burst-x': `${x}px`,
                                        '--burst-y': `${y}px`,
                                        '--burst-rotate': `${rotation}deg`,
                                      }}
                                    />
                                  ))}
                                </span>
                              )}
                            </span>
                            <span>{index + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  </nav>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-medium text-slate-500">
                      <span className="text-emerald-700">Đúng</span>
                      <span className="px-1">·</span>
                      <span className="text-amber-700">Thử lại</span>
                    </p>
                    {(started || allCorrect) && (
                      <button
                        type="button"
                        disabled={resetting}
                        onClick={() => resetPractice()}
                        className="h-8 shrink-0 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                      >
                        {resetting ? 'Đang làm lại...' : 'Luyện tập lại'}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className={embedded ? 'relative min-h-[15rem] flex-1' : 'relative min-h-[15rem]'}>
                <PracticeFeedbackBanner
                  feedback={!allCorrect && attemptFeedback?.correct ? attemptFeedback : null}
                  exiting={feedbackExiting}
                />
                {allCorrect && result && (
                  <PracticeResult result={result} celebrate={completionCelebration} />
                )}
                {quizzes.length === 0 && others.map((item) => (
                  <QuestionCard key={item.id} item={item} index={0} busy={busyId === item.id} waiting={wrongAnswerCooldown > 0} cooldownSeconds={wrongAnswerCooldown} onConfirm={(answer) => confirm(item, answer)} />
                ))}
                {started && visibleQuiz && !allCorrect && (
                  <QuestionCard
                    key={`${visibleQuiz.id}-${practiceRound}-${clockTry}-${retries[visibleQuiz.id]?.n || 0}`}
                    item={visibleQuiz}
                    index={visibleIndex + 1}
                    busy={busyId === visibleQuiz.id}
                    open
                    waiting={!started || wrongAnswerCooldown > 0}
                    cooldownSeconds={wrongAnswerCooldown}
                    expired={timed && started && expired}
                    attemptFeedback={attemptFeedback?.itemId === visibleQuiz.id && !attemptFeedback.correct ? attemptFeedback : null}
                    feedbackExiting={feedbackExiting}
                    onConfirm={(answer) => confirm(visibleQuiz, answer)}
                  />
                )}
                {items.length === 0 && <p className="text-sm text-slate-500">Buổi này chưa có bài luyện tập.</p>}
                {started && visibleQuiz && timed && expired && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[28px] bg-slate-900/50 p-4" role="presentation">
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="practice-timeout-title"
                      className="w-full max-w-sm translate-y-8 overflow-hidden rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl"
                    >
                      <PracticeModalIcon timeout />
                      <h2 id="practice-timeout-title" className="text-xl font-black text-slate-900">
                        Bạn đã hết thời gian
                      </h2>
                      <button
                        type="button"
                        disabled={resetting}
                        onClick={() => resetPractice({ startImmediately: true })}
                        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {resetting ? 'Đang làm lại...' : 'Làm lại'}
                      </button>
                    </section>
                  </div>
                )}
                {quizzes.length > 0 && !started && !allCorrect && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-slate-900/20 p-4" role="presentation">
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="practice-start-title"
                      className="w-full max-w-md translate-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                    >
                      <PracticeModalIcon />
                      <h2 id="practice-start-title" className="text-center text-xl font-black text-slate-900">
                        {hasResumableAttempt ? 'Tiếp tục luyện tập?' : 'Sẵn sàng luyện tập?'}
                      </h2>
                      <p className="mt-2 text-center text-sm leading-6 text-slate-600">
                        Có {quizzes.length} câu hỏi. {hasResumableAttempt
                          ? 'Tiếp tục từ tiến độ và thời gian còn lại trước đó.'
                          : 'Câu hỏi sẽ hiện và đồng hồ bắt đầu tính sau khi bạn bấm nút bên dưới.'}
                      </p>
                      {clockLimit > 0 && (
                        <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
                          <Clock size={16} className="text-red-600" />
                          {hasResumableAttempt ? 'Còn lại:' : 'Thời gian:'} {formatClock(savedClockSeconds ?? clockLimit)}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          unlockAudio();
                          clockPersistenceDisabledRef.current = false;
                          savePracticeValue(startedStorageKey, '1');
                          setExpired(false);
                          setStarted(true);
                          setClockTry(0);
                        }}
                        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white transition-colors hover:bg-red-700"
                      >
                        <Play size={16} fill="currentColor" /> {hasResumableAttempt ? 'Tiếp tục làm' : 'Bắt đầu luyện tập'}
                      </button>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
    </div>
  );

  if (embedded) return body;
  return <div className="h-full overflow-y-auto p-4 sm:p-6">{body}</div>;
}
