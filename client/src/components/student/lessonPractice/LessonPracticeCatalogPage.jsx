import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock,
  Gamepad2,
  Hourglass,
  Loader2,
  Lock,
  NotebookPen,
  Play,
  PlayCircle,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT, emitDailyPracticeStats } from '../../../services/dailyPracticeApi';
import { GameSoundManager } from '../../../utils/sound';
import { resolveMediaUrl } from '../../../services/api';
import { useData } from '../../../context/DataContext';
import { resolveRichHtmlMedia, sanitizeRichHtml } from '../../../utils/htmlContent';
import { DEFAULT_LEARNING_GUIDE_HTML, getLearningGuideVideoEmbedUrl } from '../../../utils/learningGuide';
import DailyPracticeSubjectBar from '../dailyPractice/DailyPracticeSubjectBar';
import Mascot from '../dailyPractice/Mascot';
import { VideoPane, NotePane } from './LessonPracticeContentPanes';
import '../dailyPractice/dailyPracticeDew.css';

const QUESTION_TYPES = new Set(['hotspot', 'mcq', 'multi', 'match', 'drag', 'written']);

function formatClock(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function unitMetaLabel(unit) {
  const parts = [];
  const v = unit?.videos?.length || 0;
  const q = Number(unit?.questionCount) || 0;
  const c = unit?.contents?.length || 0;
  if (v) parts.push(`${v} video`);
  if (q) parts.push(`${q} câu hỏi`);
  if (c) parts.push(`${c} nội dung`);
  return parts.length ? parts.join(' · ') : 'Đang cập nhật';
}

function StatusPill({ status }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 size={14} /> Hoàn thành
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 ring-1 ring-amber-200">
        <Hourglass size={14} /> Đang học
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200">
      <Hourglass size={14} /> Chưa hoàn thành
    </span>
  );
}

function UnitList({ subject, units, loading, onOpen }) {
  const completed = units.filter((u) => u.status === 'completed').length;
  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:px-5">
        <h2 className="text-lg font-black text-slate-900 sm:text-xl">{subject.name}</h2>
        {units.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
            {completed}/{units.length} bài hoàn thành
          </span>
        )}
      </header>
      {loading && !units.length ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
          <Loader2 className="animate-spin" size={16} /> Đang tải bài học môn {subject.name}...
        </div>
      ) : !units.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          Môn {subject.name} chưa có bài học nào.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {units.map((unit, idx) => {
            const done = unit.status === 'completed';
            const inProgress = unit.status === 'in_progress';
            return (
              <li key={unit.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(unit.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(unit.id); } }}
                  className="group flex cursor-pointer flex-col gap-2 px-4 py-3.5 transition hover:bg-emerald-50/50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900 group-hover:text-emerald-800 sm:text-base">
                      Bài {idx + 1}: {unit.title}
                    </p>
                    <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {unitMetaLabel(unit)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={unit.status} />
                    {done ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpen(unit.id); }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700"
                      >
                        <RotateCcw size={13} /> Xem lại
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpen(unit.id); }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
                      >
                        <PlayCircle size={14} /> {inProgress ? 'Học tiếp' : 'Học ngay'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function InlineNonMcqInput({ question, busy, onSubmit, retryMode = false, retryWaitSec = 0, wrongAttemptSeq = 0 }) {
  const [choiceIds, setChoiceIds] = useState([]);
  const [text, setText] = useState('');
  const [dragOrder, setDragOrder] = useState(() => (question.options || []).map((o) => o.id));
  const [matches, setMatches] = useState(() => (question.lefts || []).map((l) => ({ leftId: l.id, rightId: '' })));
  const [point, setPoint] = useState(null);
  const [dirtySinceWrong, setDirtySinceWrong] = useState(false);

  useEffect(() => {
    setChoiceIds([]);
    setText('');
    setDragOrder((question.options || []).map((o) => o.id));
    setMatches((question.lefts || []).map((l) => ({ leftId: l.id, rightId: '' })));
    setPoint(null);
    setDirtySinceWrong(false);
  }, [question]);

  useEffect(() => {
    if (wrongAttemptSeq > 0) setDirtySinceWrong(false);
  }, [wrongAttemptSeq]);

  const confirmed = question.confirmed === true;
  const waiting = retryMode && retryWaitSec > 0;
  const actionDisabledBase = busy || waiting || (retryMode && !dirtySinceWrong);
  const submitBtnClass = `inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition ${actionDisabledBase ? 'cursor-not-allowed opacity-45' : 'hover:bg-emerald-700'}`;
  const submitBtnLabel = busy
    ? 'Đang kiểm tra...'
    : retryMode
      ? (waiting ? `Thử lại (${retryWaitSec}s)` : 'Thử lại')
      : 'Kiểm tra đáp án';

  if (question.type === 'multi') {
    const pickedSet = new Set(confirmed ? (question.correctOptionIds || []) : choiceIds);
    return (
      <div className="space-y-2.5">
        <div className={`space-y-2 ${waiting ? 'opacity-50' : ''}`}>
          {(question.options || []).map((opt, idx) => {
            const checked = pickedSet.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={confirmed || busy || waiting}
                onClick={() => {
                  setDirtySinceWrong(true);
                  setChoiceIds((cur) => (cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]));
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm font-bold transition !shadow-none ${checked
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-200'}`}
              >
                <span className="shrink-0 font-black text-slate-600">{String.fromCharCode(65 + idx)}.</span>
                <span className="min-w-0 flex-1">{opt.text}</span>
                {checked && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!confirmed && (
          <button
            type="button"
            disabled={actionDisabledBase || !choiceIds.length}
            onClick={() => onSubmit({ choiceIds })}
            className={`${submitBtnClass} ${!choiceIds.length ? 'opacity-45 cursor-not-allowed' : ''}`}
          >
            {retryMode && <RotateCcw size={15} />}
            <span>{submitBtnLabel}</span>
          </button>
        )}
      </div>
    );
  }

  if (question.type === 'written') {
    const shown = confirmed ? (question.answer?.text || '') : text;
    return (
      <div className="space-y-2.5">
        <textarea
          rows={3}
          disabled={confirmed || busy || waiting}
          value={shown}
          onChange={(e) => {
            setDirtySinceWrong(true);
            setText(e.target.value);
          }}
          placeholder="Nhập câu trả lời của bạn..."
          className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${waiting ? 'opacity-50' : ''}`}
        />
        {!confirmed && (
          <button
            type="button"
            disabled={actionDisabledBase || !text.trim()}
            onClick={() => onSubmit({ text })}
            className={`${submitBtnClass} ${!text.trim() ? 'opacity-45 cursor-not-allowed' : ''}`}
          >
            {retryMode && <RotateCcw size={15} />}
            <span>{busy ? 'Đang chấm...' : submitBtnLabel}</span>
          </button>
        )}
      </div>
    );
  }

  if (question.type === 'drag') {
    const mapById = new Map((question.options || []).map((o) => [o.id, o]));
    const orderedIds = confirmed ? (question.options || []).map((o) => o.id) : dragOrder;
    return (
      <div className="space-y-2.5">
        <div className={`space-y-1.5 ${waiting ? 'opacity-50' : ''}`}>
          {orderedIds.map((oid, idx) => (
            <div key={oid} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">{idx + 1}</span>
              <span className="min-w-0 flex-1">{mapById.get(oid)?.text || ''}</span>
              {!confirmed && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={idx === 0 || waiting || busy}
                    onClick={() => {
                      setDirtySinceWrong(true);
                      setDragOrder((cur) => { const n = [...cur]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; });
                    }}
                    className="rounded-lg p-1 text-slate-500 hover:bg-white disabled:opacity-30 !shadow-none"
                  ><ArrowUp size={14} /></button>
                  <button
                    type="button"
                    disabled={idx === orderedIds.length - 1 || waiting || busy}
                    onClick={() => {
                      setDirtySinceWrong(true);
                      setDragOrder((cur) => { const n = [...cur]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; return n; });
                    }}
                    className="rounded-lg p-1 text-slate-500 hover:bg-white disabled:opacity-30 !shadow-none"
                  ><ArrowDown size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!confirmed && (
          <button
            type="button"
            disabled={actionDisabledBase}
            onClick={() => onSubmit({ order: dragOrder })}
            className={submitBtnClass}
          >
            {retryMode && <RotateCcw size={15} />}
            <span>{submitBtnLabel}</span>
          </button>
        )}
      </div>
    );
  }

  if (question.type === 'match') {
    const rights = question.rights || [];
    const shownPairs = confirmed ? (question.pairs || []) : [];
    return (
      <div className="space-y-2.5">
        {confirmed ? (
          <div className="space-y-1.5">
            {shownPairs.map((pair) => (
              <div key={pair.id} className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950">
                <span>{pair.left}</span>
                <span>→ {pair.right}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={`space-y-2 ${waiting ? 'opacity-50' : ''}`}>
            {(question.lefts || []).map((left) => {
              const current = matches.find((m) => m.leftId === left.id)?.rightId || '';
              return (
                <div key={left.id} className="grid items-center gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800">{left.text}</div>
                  <select
                    disabled={waiting || busy}
                    value={current}
                    onChange={(e) => {
                      setDirtySinceWrong(true);
                      setMatches((cur) => cur.map((m) => (m.leftId === left.id ? { ...m, rightId: e.target.value } : m)));
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-400"
                  >
                    <option value="">Chọn đáp án ghép...</option>
                    {rights.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
                  </select>
                </div>
              );
            })}
            <button
              type="button"
              disabled={actionDisabledBase || matches.some((m) => !m.rightId)}
              onClick={() => onSubmit({ matches })}
              className={`${submitBtnClass} ${matches.some((m) => !m.rightId) ? 'opacity-45 cursor-not-allowed' : ''}`}
            >
              {retryMode && <RotateCcw size={15} />}
              <span>{submitBtnLabel}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'hotspot') {
    const shownPoint = confirmed && question.region
      ? { x: question.region.x + question.region.w / 2, y: question.region.y + question.region.h / 2 }
      : point;
    return (
      <div className="space-y-2.5">
        {question.imageUrl && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if (confirmed || busy || waiting) return;
              const box = e.currentTarget.getBoundingClientRect();
              const x = Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100));
              const y = Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100));
              setDirtySinceWrong(true);
              setPoint({ x, y });
            }}
            onKeyDown={() => {}}
            className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${waiting ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'}`}
          >
            <img src={resolveMediaUrl(question.imageUrl)} alt="" className="block max-h-64 w-full object-contain" />
            {confirmed && question.region && (
              <span
                className="pointer-events-none absolute border-2 border-emerald-500 bg-emerald-400/20"
                style={{ left: `${question.region.x}%`, top: `${question.region.y}%`, width: `${question.region.w}%`, height: `${question.region.h}%` }}
              />
            )}
            {shownPoint && (
              <span
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow"
                style={{ left: `${shownPoint.x}%`, top: `${shownPoint.y}%` }}
              />
            )}
          </div>
        )}
        {!confirmed && (
          <button
            type="button"
            disabled={actionDisabledBase || !point}
            onClick={() => point && onSubmit(point)}
            className={`${submitBtnClass} ${!point ? 'opacity-45 cursor-not-allowed' : ''}`}
          >
            {retryMode && <RotateCcw size={15} />}
            <span>{busy ? 'Đang kiểm tra...' : retryMode ? submitBtnLabel : 'Kiểm tra vị trí đã chọn'}</span>
          </button>
        )}
      </div>
    );
  }

  return null;
}

function resolveQuestionVideoKey(item, videos = []) {
  const list = Array.isArray(videos) ? videos : [];
  const raw = String(item?.videoId || '').trim();
  if (!list.length || raw === 'none') return 'none';
  if (raw && list.some((v) => String(v.id) === raw)) return raw;
  return String(list[0].id);
}

function LessonView({
  subject, unit, unitIndex, units, user, onBack, onOpenUnit, markSection, onUnitUpdated,
}) {
  const videos = unit.videos || [];
  const contents = unit.contents || [];
  const [videoId, setVideoId] = useState(videos[0]?.id || '');
  const [contentId, setContentId] = useState(contents[0]?.id || '');
  const [videoTab, setVideoTab] = useState('overview');

  const [detailUnit, setDetailUnit] = useState(unit);
  const [unitItems, setUnitItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [videoDuration, setVideoDuration] = useState(Number(unit.videoDurationSeconds) || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxWatchedSec, setMaxWatchedSec] = useState(0);
  const [gatedQuestionId, setGatedQuestionId] = useState('');
  const [justAnsweredId, setJustAnsweredId] = useState('');
  const playerControlRef = useRef(null);
  const autoMarkedNotesRef = useRef(new Set());
  const autoMarkedVideosRef = useRef(new Set());
  const resumeTimerRef = useRef(null);

  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [submittingId, setSubmittingId] = useState('');
  const [wrongState, setWrongState] = useState(null); // { itemId, wrongChoiceId, feedback }
  const [retryWaitSec, setRetryWaitSec] = useState(0);
  const [retryDraftChoiceId, setRetryDraftChoiceId] = useState('');
  const [wrongAttemptSeq, setWrongAttemptSeq] = useState(0);
  const [walletXp, setWalletXp] = useState(null);
  const [lastXpDelta, setLastXpDelta] = useState(0);
  const [outOfXpModalOpen, setOutOfXpModalOpen] = useState(false);

  const activeUnitData = detailUnit?.id === unit.id ? detailUnit : unit;
  const selectedVideo = videos.find((v) => v.id === videoId) || videos[0] || null;
  const selectedContent = contents.find((c) => c.id === contentId) || contents[0] || null;
  const isReviewUnit = activeUnitData.status === 'completed';
  const anyVideoHasUrl = useMemo(
    () => videos.some((v) => Boolean(String(v?.url || '').trim())),
    [videos],
  );
  const selectedVideoHasUrl = Boolean(String(selectedVideo?.url || '').trim());

  useEffect(() => {
    let alive = true;
    dailyPracticeApi.student.overview()
      .then((res) => {
        if (alive && typeof res?.stats?.xpTotal === 'number') {
          setWalletXp(res.stats.xpTotal);
        }
      })
      .catch(() => {});
    const onStats = (event) => {
      if (typeof event?.detail?.xpTotal === 'number') {
        setWalletXp(event.detail.xpTotal);
      }
    };
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    return () => {
      alive = false;
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    };
  }, []);

  useEffect(() => () => {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
  }, []);

  useEffect(() => {
    if (retryWaitSec <= 0) return undefined;
    const t = window.setTimeout(() => setRetryWaitSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [retryWaitSec]);

  useEffect(() => {
    let alive = true;
    setLoadingItems(true);
    setUnitItems([]);
    setActiveQuestionId('');
    setWrongState(null);
    setRetryWaitSec(0);
    setRetryDraftChoiceId('');
    setMaxWatchedSec(0);
    setCurrentTime(0);
    setGatedQuestionId('');
    setJustAnsweredId('');
    lessonPracticeApi.student.unit(unit.id)
      .then((res) => {
        if (!alive) return;
        const payload = res?.data || {};
        if (payload.unit) setDetailUnit(payload.unit);
        setUnitItems((payload.items || []).filter((item) => QUESTION_TYPES.has(item.type)));
      })
      .catch(() => { if (alive) setUnitItems([]); })
      .finally(() => { if (alive) setLoadingItems(false); });
    return () => { alive = false; };
  }, [unit.id]);

  // Reset playback checkpoint tracking when switching between multiple videos in the same unit.
  useEffect(() => {
    setMaxWatchedSec(0);
    setCurrentTime(0);
    setVideoDuration(Number(activeUnitData?.videoDurationSeconds) || 0);
    setGatedQuestionId('');
    setJustAnsweredId('');
    setWrongState(null);
    setRetryWaitSec(0);
    setRetryDraftChoiceId('');
  }, [selectedVideo?.id, activeUnitData?.videoDurationSeconds]);

  // Auto-mark opened summary note as read so students don't need extra clicks.
  useEffect(() => {
    if (!selectedContent?.id) return;
    if (activeUnitData.noteDoneIds?.includes(selectedContent.id)) return;
    const key = `${unit.id}:${selectedContent.id}`;
    if (autoMarkedNotesRef.current.has(key)) return;
    autoMarkedNotesRef.current.add(key);
    markSection(unit.id, 'note', selectedContent.id).catch(() => {});
  }, [unit.id, selectedContent?.id, activeUnitData.noteDoneIds, markSection]);

  const rawQuestions = useMemo(() => {
    if (!anyVideoHasUrl || videos.length <= 1 || !selectedVideo?.id) return unitItems;
    const firstId = videos[0]?.id;
    return unitItems.filter((item) => {
      const key = resolveQuestionVideoKey(item, videos);
      if (key === 'none') return selectedVideo.id === firstId;
      return key === selectedVideo.id;
    });
  }, [unitItems, anyVideoHasUrl, videos, selectedVideo?.id]);

  const questionsWithCheckpoints = useMemo(() => {
    const sorted = [...rawQuestions].sort((a, b) => {
      const isNoneA = !selectedVideoHasUrl || resolveQuestionVideoKey(a, videos) === 'none';
      const isNoneB = !selectedVideoHasUrl || resolveQuestionVideoKey(b, videos) === 'none';
      if (isNoneA !== isNoneB) return isNoneA ? 1 : -1;
      const ca = Number(a.checkpointSec) || 0;
      const cb = Number(b.checkpointSec) || 0;
      if (ca > 0 && cb > 0 && ca !== cb) return ca - cb;
      if (ca > 0 && cb <= 0) return -1;
      if (cb > 0 && ca <= 0) return 1;
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    });
    const timed = sorted.filter(
      (q) => selectedVideoHasUrl && resolveQuestionVideoKey(q, videos) !== 'none',
    );
    const totalTimed = timed.length;
    const dur = Number(videoDuration) || 0;
    let timedIdx = 0;
    return sorted.map((q) => {
      const qVideoKey = resolveQuestionVideoKey(q, videos);
      const immediate = !selectedVideoHasUrl || qVideoKey === 'none';
      let atSec = 0;
      if (!immediate) {
        if (Number(q.checkpointSec) > 0) {
          atSec = Number(q.checkpointSec);
        } else if (dur > 0) {
          const usable = Math.min(dur, Math.max(12, dur - 2));
          atSec = Math.max(3, Math.floor(((timedIdx + 1) / (totalTimed + 1)) * usable));
        } else {
          atSec = (timedIdx + 1) * 10;
        }
        timedIdx += 1;
      }
      return { ...q, atSec, immediate };
    });
  }, [rawQuestions, selectedVideoHasUrl, videos, videoDuration]);

  const firstUnanswered = useMemo(
    () => questionsWithCheckpoints.find((q) => !q.confirmed && !q.immediate && q.atSec > 0) || null,
    [questionsWithCheckpoints],
  );
  const firstUnconfirmedAny = useMemo(
    () => questionsWithCheckpoints.find((q) => !q.confirmed) || null,
    [questionsWithCheckpoints],
  );

  const videoAlreadyDone = Boolean(
    activeUnitData.status === 'completed'
    || (selectedVideo?.id && activeUnitData.videoDoneIds?.includes(selectedVideo.id)),
  );

  // Câu nào đã pass hoặc đã mở khóa tuần tự mới bấm được; chưa pass câu trước thì khóa bằng ổ khóa.
  const isQuestionUnlocked = useCallback((q, idx = -1) => {
    if (!q) return false;
    if (q.confirmed === true) return true;
    const index = idx >= 0 ? idx : questionsWithCheckpoints.findIndex((row) => row.id === q.id);
    if (index > 0 && questionsWithCheckpoints.slice(0, index).some((prev) => prev.confirmed !== true)) {
      return false;
    }
    if (q.immediate) return true;
    return maxWatchedSec >= q.atSec - 0.15 || gatedQuestionId === q.id;
  }, [questionsWithCheckpoints, maxWatchedSec, gatedQuestionId]);

  useEffect(() => {
    if (!questionsWithCheckpoints.length) {
      setActiveQuestionId('');
      return;
    }
    setActiveQuestionId((cur) => {
      const curIdx = cur ? questionsWithCheckpoints.findIndex((q) => q.id === cur) : -1;
      if (curIdx >= 0 && isQuestionUnlocked(questionsWithCheckpoints[curIdx], curIdx)) return cur;
      return firstUnconfirmedAny?.id || questionsWithCheckpoints[0].id;
    });
  }, [questionsWithCheckpoints, firstUnconfirmedAny?.id, isQuestionUnlocked]);

  // Auto-mark video completed once all checkpoint questions for this video have been confirmed.
  useEffect(() => {
    if (!selectedVideoHasUrl || !selectedVideo?.id || !questionsWithCheckpoints.length) return;
    if (videoAlreadyDone) return;
    const allConfirmed = questionsWithCheckpoints.every((q) => q.confirmed === true);
    if (!allConfirmed) return;
    const key = `${unit.id}:${selectedVideo.id}`;
    if (autoMarkedVideosRef.current.has(key)) return;
    autoMarkedVideosRef.current.add(key);
    markSection(unit.id, 'video', selectedVideo.id).catch(() => {});
  }, [unit.id, selectedVideoHasUrl, selectedVideo?.id, questionsWithCheckpoints, videoAlreadyDone, markSection]);

  const activeQuestionIndex = Math.max(
    0,
    questionsWithCheckpoints.findIndex((q) => q.id === activeQuestionId),
  );
  const activeQuestion = questionsWithCheckpoints[activeQuestionIndex] || null;
  const activeUnlocked = isQuestionUnlocked(activeQuestion, activeQuestionIndex);

  const firstUnansweredRef = useRef(null);
  firstUnansweredRef.current = firstUnanswered;

  const handlePlaybackUpdate = useCallback(({ currentTime: t, duration: d, maxReachedTime }) => {
    const nextDur = Number(d) || 0;
    const curT = Number(t) || 0;
    const gate = firstUnansweredRef.current;
    const maxCap = gate ? gate.atSec : Number.POSITIVE_INFINITY;
    const clampedMax = Math.min(Math.max(curT, Number(maxReachedTime) || 0), maxCap);
    if (nextDur > 0) setVideoDuration((prev) => (prev === nextDur ? prev : nextDur));
    if (curT >= 0) setCurrentTime(Math.min(curT, maxCap));
    setMaxWatchedSec((prev) => (clampedMax > prev ? clampedMax : prev));

    // Dừng video tại mốc trắc nghiệm chưa trả lời để học viên trả lời trước khi xem tiếp.
    if (gate && gate.atSec > 0 && curT >= gate.atSec - 0.15) {
      playerControlRef.current?.pause?.();
      if (curT > gate.atSec + 0.6) {
        playerControlRef.current?.seekTo?.(gate.atSec, { allowAdvance: true });
      }
      setGatedQuestionId((cur) => (cur === gate.id ? cur : gate.id));
      setActiveQuestionId(gate.id);
    }
  }, []);

  const handleSelectCheckpoint = (cp) => {
    setActiveQuestionId(cp.id);
    setWrongState(null);
    setRetryWaitSec(0);
    setRetryDraftChoiceId('');
    if (cp.unlocked && (!firstUnanswered || cp.atSec <= firstUnanswered.atSec)) {
      playerControlRef.current?.seekTo?.(cp.atSec, { allowAdvance: !firstUnanswered });
    }
  };

  const checkpointPins = useMemo(() => questionsWithCheckpoints
    .filter((q) => !q.immediate && q.atSec > 0)
    .map((q, idx) => ({
      id: q.id,
      atSec: q.atSec,
      label: String(idx + 1),
      unlocked: isQuestionUnlocked(q),
      completed: q.confirmed === true,
      active: activeQuestion?.id === q.id || gatedQuestionId === q.id,
    })), [questionsWithCheckpoints, isQuestionUnlocked, activeQuestion?.id, gatedQuestionId]);

  const submitAnswer = async (itemId, body, clickedChoiceId = '') => {
    if (!itemId || submittingId) return;
    if (wrongState?.itemId === itemId && retryWaitSec > 0) return;
    const targetQ = questionsRefLive.current.find((row) => row.id === itemId);
    if (!isReviewUnit && !targetQ?.confirmed && typeof walletXp === 'number' && walletXp <= 0) {
      setOutOfXpModalOpen(true);
      return;
    }
    setSubmittingId(itemId);
    try {
      const res = await lessonPracticeApi.student.confirm(itemId, body);
      const data = res?.data || {};
      if (
        typeof data.xpTotal === 'number'
        || typeof data.streak === 'number'
        || data.playedToday
      ) {
        if (typeof data.xpTotal === 'number') setWalletXp(data.xpTotal);
        emitDailyPracticeStats({
          ...(typeof data.xpTotal === 'number' ? { xpTotal: data.xpTotal } : {}),
          ...(data.xpDelta < 0 ? { spendXp: Math.abs(data.xpDelta) } : {}),
          ...(typeof data.streak === 'number' ? { streak: data.streak } : {}),
          ...(typeof data.bestStreak === 'number' ? { bestStreak: data.bestStreak } : {}),
          ...(data.playedToday ? { playedToday: true } : {}),
        });
      }
      if (typeof data.xpDelta === 'number' && data.xpDelta !== 0) {
        setLastXpDelta(data.xpDelta);
      }
      if (data.streakHonor) {
        window.dispatchEvent(new CustomEvent('cms:streak-honor', { detail: data.streakHonor }));
      }
      if (data.xpExhausted) {
        setOutOfXpModalOpen(true);
        if (!data.retry) return;
      }
      if (data.retry) {
        GameSoundManager.wrong();
        setWrongState({
          itemId,
          wrongChoiceId: clickedChoiceId,
          feedback: data.item?.feedback || 'Chưa chính xác. Bạn thử chọn đáp án khác nhé!',
        });
        setRetryDraftChoiceId('');
        setWrongAttemptSeq((n) => n + 1);
        setRetryWaitSec(5);
        return;
      }
      setWrongState(null);
      setRetryDraftChoiceId('');
      setRetryWaitSec(0);
      GameSoundManager.correct();
      if (data.item) {
        setUnitItems((prev) => prev.map((row) => (row.id === itemId ? { ...row, ...data.item } : row)));
      }
      if (data.unitStatus === 'completed') {
        onUnitUpdated?.();
      }
      // Trả lời đúng mốc hiện tại → hiển thị chúc mừng ngắn rồi tự ẩn popup và tiếp tục phát video.
      const wasGated = gatedQuestionId === itemId || firstUnanswered?.id === itemId;
      if (wasGated && selectedVideoHasUrl && !data.xpExhausted) {
        setJustAnsweredId(itemId);
        if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = window.setTimeout(() => {
          setGatedQuestionId('');
          setJustAnsweredId('');
          const curIdx = questionsRefLive.current.findIndex((q) => q.id === itemId);
          const nextQ = curIdx >= 0 ? questionsRefLive.current[curIdx + 1] : null;
          if (nextQ) setActiveQuestionId(nextQ.id);
          playerControlRef.current?.play?.();
        }, 650);
      } else {
        setGatedQuestionId('');
      }
    } catch (err) {
      setWrongState({
        itemId,
        wrongChoiceId: clickedChoiceId,
        feedback: err?.message || 'Chưa kiểm tra được đáp án, vui lòng thử lại.',
      });
    } finally {
      setSubmittingId('');
    }
  };

  const questionsRefLive = useRef([]);
  questionsRefLive.current = questionsWithCheckpoints;

  const popupQuestionId = justAnsweredId || gatedQuestionId;
  const popupQuestion = popupQuestionId
    ? questionsWithCheckpoints.find((q) => q.id === popupQuestionId) || null
    : null;

  const outOfXpCard = (
    <div
      className="my-auto w-full max-w-md space-y-4 rounded-[24px] border border-amber-200 bg-white p-5 text-center text-slate-900 shadow-2xl"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-center">
        <Mascot mood="sad" size={68} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-black text-slate-900 sm:text-lg">Đã dùng hết XP hôm nay</h3>
        <p className="text-sm font-semibold leading-relaxed text-slate-600">
          Hôm nay bạn đã sử dụng hết XP, bạn có thể ôn bài cũ hoặc đợi ngày mai.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setOutOfXpModalOpen(false);
            if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});
            onBack();
          }}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
        >
          <RotateCcw size={15} /> Ôn bài cũ
        </button>
        <button
          type="button"
          onClick={() => setOutOfXpModalOpen(false)}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
        >
          Đóng
        </button>
      </div>
    </div>
  );

  const renderFullscreenQuizPopup = ({ isFullscreen }) => {
    if (!isFullscreen) return null;
    if (outOfXpModalOpen) {
      return (
        <div
          className="absolute inset-0 z-[45] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {outOfXpCard}
        </div>
      );
    }
    if (!popupQuestion) return null;
    const popupIdx = Math.max(0, questionsWithCheckpoints.findIndex((q) => q.id === popupQuestion.id));
    return (
      <div
        className="absolute inset-0 z-[35] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="my-auto w-full max-w-lg space-y-3.5 rounded-[24px] border border-emerald-200 bg-white p-4 text-slate-900 shadow-2xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-black text-slate-900">
              <Gamepad2 size={17} className="text-emerald-600" />
              Câu {popupIdx + 1}/{questionsWithCheckpoints.length} · Kiểm tra nhanh
            </span>
            <div className="flex items-center gap-1.5">
              {typeof walletXp === 'number' && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${walletXp > 0 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>
                  <Zap size={11} className="fill-current" /> {walletXp} XP
                </span>
              )}
            </div>
          </div>

          <p className="text-[15px] font-bold leading-relaxed text-slate-900">
            {popupQuestion.prompt}
          </p>

          {popupQuestion.imageUrl && popupQuestion.type !== 'hotspot' && (
            <img
              src={resolveMediaUrl(popupQuestion.imageUrl)}
              alt=""
              className="max-h-48 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
            />
          )}

          {popupQuestion.type === 'mcq' ? (
            <div className="space-y-2">
              {(() => {
                const inWrongMode = wrongState?.itemId === popupQuestion.id && !popupQuestion.confirmed;
                const isWaiting = inWrongMode && retryWaitSec > 0;
                const busy = submittingId === popupQuestion.id;
                const canRetryMcq = inWrongMode && !isWaiting && Boolean(retryDraftChoiceId) && String(retryDraftChoiceId) !== String(wrongState?.wrongChoiceId || '');
                return (
                  <>
                    <div className={`space-y-2 ${isWaiting ? 'opacity-50' : ''}`}>
                      {(popupQuestion.options || []).map((opt, idx) => {
                        const isCorrectOption = popupQuestion.confirmed && String(popupQuestion.correctOptionId) === String(opt.id);
                        const isWrongClicked = inWrongMode && String(wrongState?.wrongChoiceId) === String(opt.id) && String(retryDraftChoiceId) !== String(opt.id);
                        const isDraftPicked = inWrongMode && !isWaiting && String(retryDraftChoiceId) === String(opt.id);
                        const optDisabled = popupQuestion.confirmed || busy || isWaiting || (inWrongMode && String(wrongState?.wrongChoiceId) === String(opt.id));
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={optDisabled}
                            onClick={() => {
                              if (inWrongMode) {
                                if (!isWaiting && String(wrongState?.wrongChoiceId) !== String(opt.id)) {
                                  setRetryDraftChoiceId(opt.id);
                                }
                                return;
                              }
                              submitAnswer(popupQuestion.id, { choiceId: opt.id }, opt.id);
                            }}
                            className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm font-bold transition !shadow-none ${isCorrectOption || isDraftPicked
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm'
                              : isWrongClicked
                                ? 'border-rose-400 bg-rose-50 text-rose-900'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40'}`}
                          >
                            <span className={`shrink-0 font-black ${isCorrectOption || isDraftPicked ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <span className="min-w-0 flex-1 leading-snug">{opt.text}</span>
                            {isCorrectOption && (
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <Check size={14} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {inWrongMode && (
                      <button
                        type="button"
                        disabled={!canRetryMcq || busy}
                        onClick={() => canRetryMcq && submitAnswer(popupQuestion.id, { choiceId: retryDraftChoiceId }, retryDraftChoiceId)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition ${(!canRetryMcq || busy) ? 'cursor-not-allowed opacity-45' : 'hover:bg-emerald-700'}`}
                      >
                        <RotateCcw size={15} />
                        <span>{busy ? 'Đang kiểm tra...' : isWaiting ? `Thử lại (${retryWaitSec}s)` : 'Thử lại'}</span>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <InlineNonMcqInput
              question={popupQuestion}
              busy={submittingId === popupQuestion.id}
              retryMode={wrongState?.itemId === popupQuestion.id && !popupQuestion.confirmed}
              retryWaitSec={retryWaitSec}
              wrongAttemptSeq={wrongAttemptSeq}
              onSubmit={(payload) => submitAnswer(popupQuestion.id, payload)}
            />
          )}

          {popupQuestion.confirmed && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5">
              <Mascot mood="happy" size={40} className="shrink-0" />
              <p className="text-xs font-bold leading-relaxed text-emerald-950">
                {popupQuestion.explanation || 'Chính xác! Đang tiếp tục phát video...'}
              </p>
            </div>
          )}

          {wrongState?.itemId === popupQuestion.id && !popupQuestion.confirmed && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
              <Mascot mood="thinking" size={38} className="shrink-0" />
              <p className="text-xs font-bold text-rose-800">
                {retryWaitSec > 0 ? `${wrongState.feedback} (Đợi ${retryWaitSec}s để chọn lại)` : wrongState.feedback}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalUnitQuestions = unitItems.length;
  const totalUnitConfirmed = unitItems.filter((q) => q.confirmed === true).length;
  const confirmedCount = questionsWithCheckpoints.filter((q) => q.confirmed === true).length;
  const totalCount = questionsWithCheckpoints.length;
  const progressPct = totalUnitQuestions ? Math.round((totalUnitConfirmed / totalUnitQuestions) * 100) : 0;
  const prevUnit = unitIndex > 0 ? units[unitIndex - 1] : null;
  const nextUnit = unitIndex < units.length - 1 ? units[unitIndex + 1] : null;
  const hasLeft = anyVideoHasUrl || Boolean(selectedContent);
  const nextUnlockedUnconfirmed = questionsWithCheckpoints.find(
    (q, i) => q.id !== activeQuestion?.id && !q.confirmed && isQuestionUnlocked(q, i),
  );
  const allConfirmedCurrent = totalCount > 0 && confirmedCount === totalCount;
  const nextVideoWithWork = videos.length > 1 && anyVideoHasUrl
    ? videos.find((v) => v.id !== selectedVideo?.id && (
      unitItems.some((item) => resolveQuestionVideoKey(item, videos) === v.id && !item.confirmed)
    )) || null
    : null;

  const handleContinueAction = () => {
    if (nextUnlockedUnconfirmed) {
      setActiveQuestionId(nextUnlockedUnconfirmed.id);
      setWrongState(null);
      setRetryWaitSec(0);
      setRetryDraftChoiceId('');
      return;
    }
    if (selectedVideoHasUrl && !allConfirmedCurrent && (!activeUnlocked || activeQuestion?.confirmed)) {
      playerControlRef.current?.play?.();
      return;
    }
    if (allConfirmedCurrent && nextVideoWithWork) {
      setVideoId(nextVideoWithWork.id);
      return;
    }
    if (nextUnit) onOpenUnit(nextUnit.id);
    else onBack();
  };

  let continueLabel = nextUnit ? 'Tiếp tục bài học' : 'Về danh sách bài';
  if (nextUnlockedUnconfirmed) {
    continueLabel = 'Câu hỏi tiếp theo';
  } else if (selectedVideoHasUrl && !allConfirmedCurrent && (!activeUnlocked || activeQuestion?.confirmed)) {
    continueLabel = 'Tiếp tục xem video';
  } else if (allConfirmedCurrent && nextVideoWithWork) {
    continueLabel = `Chuyển sang ${nextVideoWithWork.title || 'video tiếp theo'}`;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại danh sách bài"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-emerald-700">{subject.name}</p>
          <h2 className="truncate text-sm font-black text-slate-900 sm:text-base">
            Bài {unitIndex + 1}: {unit.title}
          </h2>
        </div>
        {totalUnitQuestions > 0 && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 sm:w-44">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(progressPct, totalUnitConfirmed ? 8 : 0)}%` }} />
            </div>
            <span className="shrink-0 text-xs font-black tabular-nums text-slate-600">{totalUnitConfirmed}/{totalUnitQuestions} câu hỏi</span>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {lastXpDelta !== 0 && !isReviewUnit && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${lastXpDelta > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {lastXpDelta > 0 ? `+${lastXpDelta} XP` : `${lastXpDelta} XP`}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black text-white ${isReviewUnit ? 'bg-sky-600' : (typeof walletXp === 'number' && walletXp <= 0) ? 'bg-rose-600' : 'bg-emerald-600'}`}>
            <Zap size={12} className="fill-current" />
            {isReviewUnit ? 'Ôn lại · 0 XP' : `${walletXp ?? '—'} XP`}
          </span>
        </div>
      </header>

      <div className={`grid gap-4 ${hasLeft ? 'lg:grid-cols-12' : ''}`}>
        {hasLeft && (
          <div className="min-w-0 space-y-4 lg:col-span-7">
            {videos.length > 1 && anyVideoHasUrl && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                {videos.map((v, vIdx) => {
                  const isSel = v.id === selectedVideo?.id;
                  const firstId = videos[0]?.id;
                  const vQuestions = unitItems.filter((item) => {
                    const key = resolveQuestionVideoKey(item, videos);
                    return key === 'none' ? v.id === firstId : key === v.id;
                  });
                  const vDone = vQuestions.filter((q) => q.confirmed).length;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVideoId(v.id)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${isSel
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}`}
                    >
                      <span>{v.title || `Video ${vIdx + 1}`}</span>
                      {vQuestions.length > 0 && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${isSel ? 'bg-white/20 text-white' : 'bg-white text-emerald-700'}`}>
                          {vDone}/{vQuestions.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedVideo && selectedVideoHasUrl ? (
              <VideoPane
                compact
                unit={{ ...activeUnitData, antiSeek: selectedVideo.antiSeek === true }}
                videos={videos}
                selectedVideo={selectedVideo}
                selectedVideoIndex={videos.findIndex((v) => v.id === selectedVideo.id)}
                onSelectVideo={setVideoId}
                onWatched={(vid) => markSection(unit.id, 'video', vid)}
                onXpWatched={(vid, ratio) => markSection(unit.id, 'video', vid, { watchRatio: ratio })}
                subject={subject}
                units={units}
                videoTab={videoTab}
                setVideoTab={setVideoTab}
                user={user}
                courseId={subject.id}
                checkpoints={checkpointPins}
                onSelectCheckpoint={handleSelectCheckpoint}
                onPlaybackUpdate={handlePlaybackUpdate}
                playerControlRef={playerControlRef}
                checkpointGateModal={renderFullscreenQuizPopup}
                maxCheckpointSec={firstUnanswered ? firstUnanswered.atSec : null}
              />
            ) : videos.length > 0 && anyVideoHasUrl ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-sm font-semibold text-emerald-900">
                Video này chưa gắn link — toàn bộ câu hỏi trắc nghiệm bên phải đã được mở để bạn làm ngay.
              </div>
            ) : null}

            {selectedContent && (
              <section className="space-y-3 rounded-[20px] border border-emerald-100 bg-white p-3.5 shadow-sm sm:p-4">
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
                  <NotebookPen size={17} className="text-emerald-600" />
                  {selectedVideoHasUrl ? 'Tóm tắt thao tác nhanh' : 'Nội dung bài học'}
                </h3>
                {contents.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {contents.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setContentId(c.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold ${selectedContent.id === c.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                      >
                        <span>{c.title || `Nội dung ${idx + 1}`}</span>
                        {activeUnitData.noteDoneIds?.includes(c.id) && <CheckCircle2 size={13} />}
                      </button>
                    ))}
                  </div>
                )}
                <NotePane
                  unit={activeUnitData}
                  content={selectedContent}
                  done={activeUnitData.noteDoneIds?.includes(selectedContent.id)}
                  onMarkRead={(cid) => markSection(unit.id, 'note', cid)}
                />
              </section>
            )}
          </div>
        )}

        <aside className={`min-w-0 ${hasLeft ? 'lg:col-span-5' : ''}`}>
          <section className="flex flex-col gap-3.5 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <Gamepad2 size={18} className="text-emerald-600" /> Câu hỏi kiểm tra nhanh
              </h3>
            </div>

            {questionsWithCheckpoints.length > 1 && (
              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
                {questionsWithCheckpoints.map((q, idx) => {
                  const unlocked = isQuestionUnlocked(q, idx);
                  const selected = activeQuestion?.id === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        if (!unlocked) return;
                        setActiveQuestionId(q.id);
                        setWrongState(null);
                        setRetryWaitSec(0);
                        setRetryDraftChoiceId('');
                      }}
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-extrabold transition ${selected
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : q.confirmed
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300'
                          : unlocked
                            ? 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
                            : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-75'}`}
                    >
                      {q.confirmed ? <CheckCircle2 size={12} /> : !unlocked ? <Lock size={11} /> : null}
                      <span>Câu {idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {loadingItems ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={16} /> Đang tải câu hỏi...
              </div>
            ) : !activeQuestion ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Bài này chưa có câu hỏi kiểm tra nhanh.
              </div>
            ) : !activeUnlocked ? (
              <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200">
                  <Lock size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900">
                    Xem video đến mốc {formatClock(activeQuestion.atSec)} để mở Câu {activeQuestionIndex + 1}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    Đã xem {formatClock(Math.max(maxWatchedSec, currentTime))} / {formatClock(activeQuestion.atSec)} — xem tới đâu câu trắc nghiệm mở tới đó.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => playerControlRef.current?.play?.()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
                >
                  <Play size={16} fill="currentColor" /> Tiếp tục xem video
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <p className="text-[15px] font-bold leading-relaxed text-slate-900">
                  {activeQuestion.prompt}
                </p>

                {activeQuestion.imageUrl && activeQuestion.type !== 'hotspot' && (
                  <img
                    src={resolveMediaUrl(activeQuestion.imageUrl)}
                    alt=""
                    className="max-h-56 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                  />
                )}

                {activeQuestion.type === 'mcq' ? (
                  <div className="space-y-2">
                    {(() => {
                      const inWrongMode = wrongState?.itemId === activeQuestion.id && !activeQuestion.confirmed;
                      const isWaiting = inWrongMode && retryWaitSec > 0;
                      const busy = submittingId === activeQuestion.id;
                      return (
                        <div className={`space-y-2 ${isWaiting ? 'opacity-50' : ''}`}>
                          {(activeQuestion.options || []).map((opt, idx) => {
                            const isCorrectOption = activeQuestion.confirmed && String(activeQuestion.correctOptionId) === String(opt.id);
                            const isWrongClicked = inWrongMode && String(wrongState?.wrongChoiceId) === String(opt.id) && String(retryDraftChoiceId) !== String(opt.id);
                            const isDraftPicked = inWrongMode && !isWaiting && String(retryDraftChoiceId) === String(opt.id);
                            const optDisabled = activeQuestion.confirmed || busy || isWaiting || (inWrongMode && String(wrongState?.wrongChoiceId) === String(opt.id));
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={optDisabled}
                                onClick={() => {
                                  if (inWrongMode) {
                                    if (!isWaiting && String(wrongState?.wrongChoiceId) !== String(opt.id)) {
                                      setRetryDraftChoiceId(opt.id);
                                    }
                                    return;
                                  }
                                  submitAnswer(activeQuestion.id, { choiceId: opt.id }, opt.id);
                                }}
                                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm font-bold transition !shadow-none ${isCorrectOption || isDraftPicked
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm'
                                  : isWrongClicked
                                    ? 'border-rose-400 bg-rose-50 text-rose-900'
                                    : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40'}`}
                              >
                                <span className={`shrink-0 font-black ${isCorrectOption || isDraftPicked ? 'text-emerald-700' : 'text-slate-700'}`}>
                                  {String.fromCharCode(65 + idx)}.
                                </span>
                                <span className="min-w-0 flex-1 leading-snug">{opt.text}</span>
                                {isCorrectOption && (
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <Check size={14} strokeWidth={3} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <InlineNonMcqInput
                    question={activeQuestion}
                    busy={submittingId === activeQuestion.id}
                    retryMode={wrongState?.itemId === activeQuestion.id && !activeQuestion.confirmed}
                    retryWaitSec={retryWaitSec}
                    wrongAttemptSeq={wrongAttemptSeq}
                    onSubmit={(payload) => submitAnswer(activeQuestion.id, payload)}
                  />
                )}

                {activeQuestion.confirmed && (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-3">
                    <Mascot mood="happy" size={44} className="shrink-0" />
                    <p className="text-xs font-bold leading-relaxed text-emerald-950 sm:text-[13px]">
                      {activeQuestion.explanation || 'Chính xác! Bạn đã trả lời đúng câu hỏi ở mốc này.'}
                    </p>
                  </div>
                )}

                {wrongState?.itemId === activeQuestion.id && !activeQuestion.confirmed && (
                  <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                    <Mascot mood="thinking" size={40} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-rose-800">
                        {retryWaitSec > 0 ? `${wrongState.feedback} (Đợi ${retryWaitSec}s để chọn lại)` : wrongState.feedback}
                      </p>
                      {activeQuestion.hint && (
                        <p className="mt-0.5 text-[11px] font-semibold text-amber-800">Gợi ý: {activeQuestion.hint}</p>
                      )}
                    </div>
                  </div>
                )}

                {!activeQuestion.confirmed && wrongState?.itemId !== activeQuestion.id && activeQuestion.hint && (
                  <p className="rounded-xl bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-800">
                    Gợi ý: {activeQuestion.hint}
                  </p>
                )}

                {wrongState?.itemId === activeQuestion.id && !activeQuestion.confirmed ? (
                  activeQuestion.type === 'mcq' ? (() => {
                    const isWaiting = retryWaitSec > 0;
                    const busy = submittingId === activeQuestion.id;
                    const canRetryMcq = !isWaiting && Boolean(retryDraftChoiceId) && String(retryDraftChoiceId) !== String(wrongState?.wrongChoiceId || '');
                    return (
                      <button
                        type="button"
                        disabled={!canRetryMcq || busy}
                        onClick={() => canRetryMcq && submitAnswer(activeQuestion.id, { choiceId: retryDraftChoiceId }, retryDraftChoiceId)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition ${(!canRetryMcq || busy) ? 'cursor-not-allowed opacity-45' : 'hover:bg-emerald-700'}`}
                      >
                        <RotateCcw size={16} />
                        <span>{busy ? 'Đang kiểm tra...' : isWaiting ? `Thử lại (${retryWaitSec}s)` : 'Thử lại'}</span>
                      </button>
                    );
                  })() : null
                ) : (
                  <button
                    type="button"
                    onClick={handleContinueAction}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <span>{continueLabel}</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={!prevUnit}
          onClick={() => prevUnit && onOpenUnit(prevUnit.id)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={16} /> Bài trước
        </button>
        <button
          type="button"
          onClick={() => (nextUnit ? onOpenUnit(nextUnit.id) : onBack())}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
        >
          {nextUnit ? 'Tiếp tục bài học' : 'Về danh sách bài'} <ArrowRight size={16} />
        </button>
      </footer>

      {outOfXpModalOpen && !document.fullscreenElement && (
        <div
          className="fixed inset-0 z-[9400] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onClick={() => setOutOfXpModalOpen(false)}
        >
          {outOfXpCard}
        </div>
      )}
    </div>
  );
}

export default function LessonPracticeCatalogPage({ embedded = false, onSummaryChange = null } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { studentTrainingData } = useData();
  const requestedSubjectId = searchParams.get('subjectId') || '';
  const lessonUnitId = searchParams.get('lesson') || searchParams.get('unitId') || '';

  const [subjects, setSubjects] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [units, setUnits] = useState([]);
  const [unitsSubjectId, setUnitsSubjectId] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [error, setError] = useState('');
  const [studentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('student_user') || '{}') || {}; }
    catch { return {}; }
  });

  const refreshSubjects = useCallback(async () => {
    const res = await lessonPracticeApi.student.subjects();
    const list = res.data?.subjects || [];
    setSubjects(list);
    setActiveSubjectId((current) => {
      if (requestedSubjectId && list.some((s) => s.id === requestedSubjectId)) return requestedSubjectId;
      if (current && list.some((s) => s.id === current)) return current;
      return list[0]?.id || '';
    });
    return list;
  }, [requestedSubjectId]);

  useEffect(() => {
    let alive = true;
    setLoadingSubjects(true);
    refreshSubjects()
      .catch((err) => { if (alive) setError(err.message || 'Không tải được danh sách môn học'); })
      .finally(() => { if (alive) setLoadingSubjects(false); });
    return () => { alive = false; };
  }, [refreshSubjects]);

  const loadUnits = useCallback(async (subjectId) => {
    if (!subjectId) {
      setUnits([]);
      setUnitsSubjectId('');
      return [];
    }
    setLoadingUnits(true);
    try {
      const res = await lessonPracticeApi.student.units(subjectId);
      const list = res.data?.units || [];
      setUnits(list);
      setUnitsSubjectId(subjectId);
      return list;
    } finally {
      setLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    if (!activeSubjectId) {
      setUnits([]);
      setUnitsSubjectId('');
      return;
    }
    loadUnits(activeSubjectId).catch((err) => setError(err.message || 'Không tải được bài học'));
  }, [activeSubjectId, loadUnits]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === activeSubjectId) || null,
    [subjects, activeSubjectId],
  );
  const visibleUnits = unitsSubjectId === activeSubjectId ? units : [];
  const lessonIndex = lessonUnitId ? visibleUnits.findIndex((u) => u.id === lessonUnitId) : -1;
  const lessonUnit = lessonIndex >= 0 ? visibleUnits[lessonIndex] : null;

  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      activeSubjectName: activeSubject?.name || '',
      totalSubjects: subjects.length,
      completedUnits: visibleUnits.filter((u) => u.status === 'completed').length,
      totalUnits: visibleUnits.length,
    });
  }, [onSummaryChange, activeSubject?.name, subjects.length, visibleUnits]);

  const subjectsForBar = useMemo(() => subjects.map((s) => {
    const live = s.id === unitsSubjectId && units.length
      ? { completed: units.filter((u) => u.status === 'completed').length, total: units.length }
      : { completed: Number(s.completedUnitCount) || 0, total: Number(s.totalUnitCount) || 0 };
    return { ...s, completedUnitCount: live.completed, totalUnitCount: live.total };
  }), [subjects, unitsSubjectId, units]);

  const updateParams = (mutate) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: false });
  };

  const handleSelectSubject = (id) => {
    setActiveSubjectId(id);
    updateParams((next) => {
      next.set('subjectId', id);
      next.delete('unitId');
      next.delete('lesson');
    });
  };

  const openLesson = (unitId) => {
    updateParams((next) => {
      if (activeSubjectId) next.set('subjectId', activeSubjectId);
      next.delete('unitId');
      next.set('lesson', unitId);
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const closeLesson = () => {
    updateParams((next) => {
      next.delete('unitId');
      next.delete('lesson');
    });
  };

  const markSection = useCallback(async (unitId, part, itemId = '', extra = {}) => {
    if (!unitId) return false;
    try {
      const res = await lessonPracticeApi.student.markSection(unitId, part, itemId, extra);
      setUnits((prev) => prev.map((u) => (u.id === unitId ? {
        ...u,
        status: res.data.status,
        videoDone: res.data.videoDone,
        noteDone: res.data.noteDone,
        videoDoneIds: res.data.videoDoneIds || u.videoDoneIds || [],
        noteDoneIds: res.data.noteDoneIds || u.noteDoneIds || [],
        practiceDone: res.data.practiceDone,
      } : u)));
      return true;
    } catch {
      return false;
    }
  }, []);

  const guideSection = guideOpen && (
    <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-black text-slate-900">Hướng dẫn học</h2>
        <button type="button" onClick={() => setGuideOpen(false)} aria-label="Đóng hướng dẫn" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>
      {getLearningGuideVideoEmbedUrl(studentTrainingData?.learningGuideVideoUrl) && (
        <div className="mb-4 aspect-video max-w-3xl overflow-hidden rounded-xl bg-slate-950">
          <iframe
            title="Video hướng dẫn học"
            src={getLearningGuideVideoEmbedUrl(studentTrainingData.learningGuideVideoUrl)}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
      <div
        className="prose prose-sm max-w-none text-slate-700 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl"
        dangerouslySetInnerHTML={{
          __html: resolveRichHtmlMedia(
            sanitizeRichHtml(
              typeof studentTrainingData?.learningGuideHtml === 'string'
                ? studentTrainingData.learningGuideHtml
                : DEFAULT_LEARNING_GUIDE_HTML,
            ),
            resolveMediaUrl,
          ),
        }}
      />
    </section>
  );

  // ── Màn hình học một bài (video gắn mốc trắc nghiệm) ──
  if (lessonUnitId && activeSubject) {
    return (
      <div className={embedded ? 'w-full' : 'dp-dew-page min-h-full w-full px-2 pb-10 pt-3 sm:px-4'}>
        <div className={embedded ? '' : 'dp-shell mx-auto w-full max-w-6xl xl:max-w-7xl'}>
          {lessonUnit ? (
            <LessonView
              key={lessonUnit.id}
              subject={activeSubject}
              unit={lessonUnit}
              unitIndex={lessonIndex}
              units={visibleUnits}
              user={studentUser}
              onBack={closeLesson}
              onOpenUnit={openLesson}
              markSection={markSection}
              onUnitUpdated={() => { loadUnits(activeSubject.id).catch(() => {}); }}
            />
          ) : loadingUnits || loadingSubjects || unitsSubjectId !== activeSubjectId ? (
            <div className="flex items-center gap-2 rounded-2xl bg-white px-5 py-10 text-sm text-slate-500">
              <Loader2 className="animate-spin" size={18} /> Đang mở bài học...
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-bold text-slate-700">Không tìm thấy bài học này.</p>
              <button type="button" onClick={closeLesson} className="cms-btn cms-btn-primary">Về danh sách bài</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Danh sách môn + bài ──
  return (
    <div className={embedded ? 'w-full' : 'dp-dew-page min-h-full w-full px-2 pb-10 pt-3 sm:px-4'}>
      <div className={embedded ? 'space-y-3' : 'dp-shell mx-auto w-full max-w-6xl space-y-4 xl:max-w-7xl'}>
        {embedded ? (
          <div>
            <button
              type="button"
              onClick={() => setGuideOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <CircleHelp size={14} /> {guideOpen ? 'Ẩn hướng dẫn' : 'Hướng dẫn học'}
            </button>
          </div>
        ) : (
          <header className="dp-dew-welcome flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <BookOpen size={22} />
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-slate-900 sm:text-xl">Luyện tập theo môn</h1>
                <p className="text-xs font-semibold text-emerald-800 sm:text-sm">
                  Chọn môn học để xem video, làm trắc nghiệm theo mốc và nhận XP mỗi ngày (đúng +5 XP · sai −5 XP).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGuideOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white/95 px-3.5 py-2 text-xs font-extrabold text-emerald-700 shadow-sm transition hover:bg-white"
            >
              <CircleHelp size={15} /> {guideOpen ? 'Ẩn hướng dẫn' : 'Hướng dẫn học'}
            </button>
          </header>
        )}

        {guideSection}

        <section className={embedded ? 'space-y-4' : 'dp-dew-main-panel space-y-4'}>
          {loadingSubjects ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="animate-spin" size={18} /> Đang tải danh sách môn học...
            </div>
          ) : error ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p>
          ) : !subjects.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-bold text-slate-700">Chưa có môn học nào thuộc khóa bạn đăng ký.</p>
              <p className="mt-1 text-sm text-slate-500">Các môn luyện tập tự do sẽ tự động hiển thị theo đúng môn trong khóa học trung tâm bạn đã đăng ký.</p>
            </div>
          ) : (
            <>
              <DailyPracticeSubjectBar
                className="dp-dew-subject-carousel--responsive"
                topics={subjectsForBar}
                variant="center-free"
                activeTopicId={activeSubjectId}
                onSelect={handleSelectSubject}
              />
              {activeSubject && (
                <UnitList
                  subject={activeSubject}
                  units={visibleUnits}
                  loading={loadingUnits}
                  onOpen={openLesson}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
