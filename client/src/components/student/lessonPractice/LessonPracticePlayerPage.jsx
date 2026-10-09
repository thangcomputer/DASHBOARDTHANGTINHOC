import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, Move, Play, Trophy } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import { playLessonCorrectSound, playLessonTick, playLessonWrongSound, unlockAudio } from '../../../utils/sound';

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

function QuestionCard({ item, index, busy, open = true, retry, expired = false, waiting = false, onRetryTime, onConfirm, onSkip }) {
  const [choiceId, setChoiceId] = useState(item.answer?.choiceId || '');
  const [choiceIds, setChoiceIds] = useState(item.answer?.choiceIds || []);
  const [matches, setMatches] = useState(() => Object.fromEntries((item.answer?.matches || []).map((row) => [row.leftId, row.rightId])));
  const [order, setOrder] = useState(item.options || []);
  const [text, setText] = useState(item.answer?.text || '');
  const [point, setPoint] = useState(item.answer?.x != null ? { x: item.answer.x, y: item.answer.y } : null);
  const [dragGhost, setDragGhost] = useState(null);
  const [dropId, setDropId] = useState('');
  const dragListeners = useRef(null);

  useEffect(() => {
    if (!retry?.n) return;
    setChoiceId('');
    setChoiceIds([]);
    setMatches({});
    setOrder(item.options || []);
    setText('');
    setPoint(null);
  }, [retry?.n]);

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
    <article id={`lesson-q-${item.id}`} className="rounded-2xl border border-slate-100 bg-white p-3 space-y-3">
      {(index > 0 || item.prompt) && (
        <h2 className="flex items-baseline gap-2 overflow-x-auto whitespace-nowrap text-base font-bold text-slate-900">
          {index > 0 && <span className="shrink-0 text-xs font-black uppercase tracking-widest text-red-600">Câu {index}.</span>}
          <span>{item.prompt}</span>
        </h2>
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
        <div className="space-y-1.5">
          {(item.options || []).map((opt) => {
            const selected = (done ? item.answer?.choiceId : choiceId) === opt.id;
            const isKey = done && item.correctOptionId === opt.id;
            return (
              <label key={opt.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${isKey ? 'border-emerald-300 bg-emerald-50' : selected ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                <input
                  type="radio"
                  name={`q-${item.id}`}
                  className="mt-1"
                  disabled={frozen}
                  checked={selected}
                  onChange={() => setChoiceId(opt.id)}
                />
                <span>{opt.text}</span>
              </label>
            );
          })}
        </div>
      )}
      {item.type === 'multi' && (
        <div className="space-y-1.5">
          {(item.options || []).map((opt) => {
            const picked = done ? (item.answer?.choiceIds || []) : choiceIds;
            const selected = picked.includes(opt.id);
            const isKey = done && (item.correctOptionIds || []).includes(opt.id);
            return (
              <label key={opt.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${isKey ? 'border-emerald-300 bg-emerald-50' : selected ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                <input
                  type="checkbox"
                  disabled={frozen}
                  checked={selected}
                  onChange={() => setChoiceIds((current) => (current.includes(opt.id) ? current.filter((id) => id !== opt.id) : [...current, opt.id]))}
                />
                <span>{opt.text}</span>
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
      {retry?.text && !done && !waiting && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">{retry.text}</p>
      )}
      <Explanation item={item} />
      </div>
      {expired && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-black text-red-800">Bạn đã hết thời gian</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetryTime}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
            >
              Làm lại
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
      {!frozen && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (item.type === 'mcq') onConfirm({ choiceId });
            else if (item.type === 'multi') onConfirm({ choiceIds });
            else if (item.type === 'match') onConfirm({ matches: (item.lefts || []).map((left) => ({ leftId: left.id, rightId: matches[left.id] || '' })) });
            else if (item.type === 'drag') onConfirm({ order: order.map((row) => row.id) });
            else if (item.type === 'hotspot') onConfirm(point || {});
            else onConfirm({ text });
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Xác nhận
        </button>
      )}
    </article>
  );
}

function ConfettiBurst() {
  const bits = Array.from({ length: 28 }, (_, i) => i);
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-40 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes lesson-confetti-fall {
          0% { transform: translateY(-8px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(150px) rotate(200deg); opacity: 0; }
        }
        .lesson-confetti { animation: lesson-confetti-fall 1.5s ease-in forwards; }
      `}</style>
      {bits.map((i) => (
        <span
          key={i}
          className="lesson-confetti absolute top-0 h-2 w-1.5 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 8) * 0.06}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function LessonPracticePlayerPage({ unitId: unitIdProp, embedded = false, onUnitStatus }) {
  const params = useParams();
  const unitId = unitIdProp || params.unitId;
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [unitStatus, setUnitStatus] = useState('');
  const [retries, setRetries] = useState({});
  const [resetting, setResetting] = useState(false);
  const [practiceRound, setPracticeRound] = useState(0);
  const [focusId, setFocusId] = useState('');
  const [skipped, setSkipped] = useState({});
  const [clockTry, setClockTry] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [expired, setExpired] = useState(false);
  const [started, setStarted] = useState(false);
  const [wrongAnswerCooldown, setWrongAnswerCooldown] = useState(0);

  const items = payload?.items || [];
  const quizzes = items.filter((item) => PRACTICE_TYPES.has(item.type));
  const others = items.filter((item) => !PRACTICE_TYPES.has(item.type));
  const answered = quizzes.filter((item) => item.confirmed).length;
  const allCorrect = quizzes.length > 0 && answered === quizzes.length;
  const firstOpen = quizzes.findIndex((item) => !item.confirmed && !skipped[item.id]);
  const lastIndex = Math.max(quizzes.length - 1, 0);
  const openLimit = firstOpen === -1 ? lastIndex : firstOpen;
  const focusIndex = quizzes.findIndex((item) => item.id === focusId);
  const visibleIndex = focusIndex >= 0 && focusIndex <= openLimit ? focusIndex : (firstOpen === -1 ? -1 : firstOpen);
  const visibleQuiz = visibleIndex >= 0 ? quizzes[visibleIndex] : null;
  const clockLimit = visibleQuiz && !visibleQuiz.confirmed
    ? Math.max(0, Math.round(Number(visibleQuiz.timeLimitSec) || payload?.unit?.timeLimitSec || 0))
    : 0;
  const timed = clockLimit > 0;
  const warnAt = warnAtFor(clockLimit);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    lessonPracticeApi.student.unit(unitId)
      .then((res) => {
        if (!alive) return;
        setWrongAnswerCooldown(0);
        setPayload(res.data);
        setStarted(false);
        setClockTry(0);
        setSkipped({});
        setRetries({});
        setFocusId('');
        const status = res.data?.unit?.status || '';
        setUnitStatus(status);
        if (status) onUnitStatus?.(status);
      })
      .catch((err) => { if (alive) setError(err.message || 'Không mở được buổi học'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [unitId]);

  useEffect(() => {
    setRemaining(timed ? clockLimit : 0);
    setExpired(false);
    if (!timed || !started) return undefined;
    let left = clockLimit;
    const timer = window.setInterval(() => {
      left -= 1;
      setRemaining(Math.max(0, left));
      if (left > 0 && left <= warnAt) playLessonTick(left % 2 === 0);
      if (left <= 0) {
        window.clearInterval(timer);
        setExpired(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timed, clockLimit, warnAt, clockTry, visibleQuiz?.id, practiceRound, started]);

  useEffect(() => {
    if (wrongAnswerCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setWrongAnswerCooldown((remainingSeconds) => Math.max(0, remainingSeconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [wrongAnswerCooldown > 0]);

  async function confirm(item, body) {
    unlockAudio();
    setBusyId(item.id);
    setError('');
    const usesWrongAnswerCooldown = COOLDOWN_QUESTION_TYPES.has(item.type);
    try {
      const res = await lessonPracticeApi.student.confirm(item.id, body);
      if (res.data.retry || res.data.item?.correct === false) playLessonWrongSound();
      else if (res.data.item?.correct === true) playLessonCorrectSound();
      if (res.data.retry) {
        setRetries((prev) => ({
          ...prev,
          [item.id]: { text: res.data.item?.feedback || 'Bạn sai rồi, vui lòng chọn lại đáp án', n: (prev[item.id]?.n || 0) + 1 },
        }));
        if (usesWrongAnswerCooldown) setWrongAnswerCooldown(10);
        return;
      }
      if (usesWrongAnswerCooldown && res.data.item?.correct === false) {
        setWrongAnswerCooldown(10);
      }
      setRetries((prev) => {
        if (!prev[item.id]) return prev;
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setPayload((prev) => ({
        ...prev,
        items: (prev?.items || []).map((row) => (row.id === item.id ? res.data.item : row)),
      }));
      if (res.data.item?.correct === true) setFocusId('');
      if (res.data.unitStatus) {
        setUnitStatus(res.data.unitStatus);
        onUnitStatus?.(res.data.unitStatus);
      }
    } catch (err) {
      setError(err.message || 'Không xác nhận được câu này');
    } finally {
      setBusyId('');
    }
  }

  async function resetPractice() {
    setResetting(true);
    setError('');
    try {
      const res = await lessonPracticeApi.student.resetPractice(unitId);
      setPayload(res.data);
      setRetries({});
      setFocusId('');
      setSkipped({});
      setClockTry(0);
      setStarted(true);
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
    <div className={embedded ? 'space-y-4' : 'max-w-3xl mx-auto space-y-4'}>
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
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{payload.subject?.name}</p>
              <h1 className="text-2xl font-black text-slate-900">{payload.unit.title}</h1>
            </div>
            )}
            {!embedded && unitStatus === 'completed' && (
              <p className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800">Bạn đã xong buổi này.</p>
            )}
            <div className="relative space-y-4">
              <style>{`
                @keyframes lesson-clock-blink {
                  0%, 49% { opacity: 1; }
                  50%, 100% { opacity: 0.28; }
                }
                .lesson-clock-blink { animation: lesson-clock-blink 0.5s step-end infinite; }
              `}</style>
              {allCorrect && <ConfettiBurst />}
              {quizzes.length > 0 && (
                <div className="sticky top-0 z-10 rounded-2xl border border-slate-100 bg-white/95 p-3 backdrop-blur">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-slate-500">{answered}/{quizzes.length} câu đúng</p>
                    {timed && (
                      <QuizClock remaining={remaining} warning={started && remaining > 0 && remaining <= warnAt} />
                    )}
                  </div>
                  {allCorrect && (
                    <p className="mb-2 flex items-center gap-2 text-sm font-black text-amber-800">
                      <Trophy size={18} className="shrink-0 text-amber-500" />
                      Chúc mừng! Bạn đã làm đúng tất cả câu hỏi.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {quizzes.map((item, index) => {
                        const reachable = started && index <= openLimit;
                        const current = started && index === visibleIndex;
                        return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!reachable}
                          onClick={() => { setFocusId(item.id); setClockTry(0); }}
                          className={`h-8 min-w-8 rounded-lg px-2 text-xs font-black ${item.confirmed ? 'bg-emerald-600 text-white' : current ? 'bg-red-600 text-white' : skipped[item.id] ? 'border border-amber-300 bg-amber-100 text-amber-900' : 'bg-white text-slate-700 border border-slate-200'} disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {index + 1}
                        </button>
                        );
                      })}
                    </div>
                    {!started && !allCorrect ? (
                      <button
                        type="button"
                        onClick={() => { unlockAudio(); setStarted(true); setClockTry(0); }}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-red-600 px-3 text-sm font-bold text-white"
                      >
                        <Play size={14} fill="currentColor" /> Bắt đầu
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={resetting}
                        onClick={resetPractice}
                        className="h-8 shrink-0 rounded-lg bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {resetting ? 'Đang làm lại...' : 'Luyện tập lại'}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {quizzes.length === 0 && others.map((item) => (
                <QuestionCard key={item.id} item={item} index={0} busy={busyId === item.id} waiting={wrongAnswerCooldown > 0} onConfirm={(answer) => confirm(item, answer)} />
              ))}
              {visibleQuiz && (
                <QuestionCard
                  key={`${visibleQuiz.id}-${practiceRound}-${clockTry}`}
                  item={visibleQuiz}
                  index={visibleIndex + 1}
                  busy={busyId === visibleQuiz.id}
                  open
                  waiting={!started || wrongAnswerCooldown > 0}
                  expired={timed && started && expired}
                  retry={retries[visibleQuiz.id]}
                  onRetryTime={() => setClockTry((tryCount) => tryCount + 1)}
                  onSkip={() => {
                    setSkipped((prev) => ({ ...prev, [visibleQuiz.id]: true }));
                    setFocusId('');
                    setClockTry(0);
                  }}
                  onConfirm={(answer) => confirm(visibleQuiz, answer)}
                />
              )}
              {!started && !allCorrect && quizzes.length > 0 && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-center">
                  <p className="mb-3 text-sm font-bold text-red-800">Bấm Bắt đầu khi sẵn sàng. Đồng hồ sẽ chạy từ lúc đó.</p>
                  <button
                    type="button"
                    onClick={() => { unlockAudio(); setStarted(true); setClockTry(0); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white"
                  >
                    <Play size={16} fill="currentColor" /> Bắt đầu
                  </button>
                </div>
              )}
              {items.length === 0 && <p className="text-sm text-slate-500">Buổi này chưa có bài luyện tập.</p>}
            </div>
          </>
        )}
        {wrongAnswerCooldown > 0 && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wrong-answer-cooldown-title"
            aria-describedby="wrong-answer-cooldown-description"
          >
            <div className="w-full max-w-sm rounded-3xl border border-red-100 bg-white p-7 text-center shadow-2xl">
              <div className="relative mx-auto mb-5 grid h-28 w-28 place-items-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="43" fill="none" stroke="#fee2e2" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="43"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 43}
                    strokeDashoffset={(2 * Math.PI * 43) * (1 - wrongAnswerCooldown / 10)}
                    className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
                <span className="text-4xl font-black tabular-nums text-red-700">{wrongAnswerCooldown}</span>
              </div>
              <h2 id="wrong-answer-cooldown-title" className="text-lg font-black text-slate-900">Hãy bình tĩnh suy nghĩ</h2>
              <p id="wrong-answer-cooldown-description" className="mt-2 text-sm leading-relaxed text-slate-600">
                Đáp án chưa chính xác. Vui lòng chờ hết đếm ngược rồi hãy chọn lại.
              </p>
            </div>
          </div>
        )}
    </div>
  );

  if (embedded) return body;
  return <div className="h-full overflow-y-auto p-4 sm:p-6">{body}</div>;
}
