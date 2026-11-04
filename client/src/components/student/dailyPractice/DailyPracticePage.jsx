import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Flame, Lightbulb, Loader2, LogOut, Play, PlayCircle, RotateCcw, Sparkles, Star, Trophy, XCircle, Zap,
} from 'lucide-react';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { gameSounds } from '../../../utils/sound';
import { LEARNING_GOAL_CHANGED_EVENT, lessonResumeUrl } from '../../../utils/learningGoal';
import {
  DIFFICULTIES, QUESTION_TYPES, difficultyMeta, randomComfort, randomPraise, resultMessage, topicColor, topicIcon,
} from '../../../utils/dailyPractice';
import Mascot from './Mascot';
import { FillQuestion, MatchQuestion, McqQuestion, OrderQuestion, SortQuestion, TrueFalseQuestion } from './Questions';

const CONFETTI_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#A855F7', '#F97316'];

function Confetti({ count = 22, spread = 160 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const distance = spread * (0.55 + Math.random() * 0.6);
    return {
      dx: `${Math.round(Math.cos(angle) * distance)}px`,
      dy: `${Math.round(Math.sin(angle) * distance - 40)}px`,
      rot: `${Math.round(Math.random() * 720 - 360)}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${Math.round(Math.random() * 120)}ms`,
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

function StatPill({ icon: Icon, value, label, tone }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-white">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: tone }}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-lg font-black leading-none text-slate-900 tabular-nums">{value}</span>
        <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      </span>
    </div>
  );
}

// ── Màn chọn chủ đề ──────────────────────────────────────────────────────────
function HomeScreen({ overview, loading, error, onStart, starting, initialTopicId = '' }) {
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const topics = useMemo(() => overview?.topics || [], [overview]);
  const stats = overview?.stats || {};
  const selected = topics.find((topic) => topic.id === topicId);

  useEffect(() => {
    if (topicId || !topics.length) return;
    const linked = initialTopicId && topics.find((topic) => topic.id === initialTopicId);
    setTopicId(linked ? linked.id : topics[0].id);
  }, [topicId, topics, initialTopicId]);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-red-50 via-white to-amber-50 p-5 ring-1 ring-red-100 sm:p-6">
        <span className="cms-goal-droplet left-6 top-5 h-6 w-6" aria-hidden="true" />
        <span className="cms-goal-droplet cms-goal-droplet--amber right-10 top-8 h-4 w-4 [animation-delay:1s]" aria-hidden="true" />
        <span className="cms-goal-droplet -right-4 bottom-2 h-14 w-14 [animation-delay:2s]" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <Mascot mood={stats.playedToday ? 'happy' : stats.streakState === 'lost' ? 'sad' : 'idle'} size={104} />
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-wider text-red-600">Luyện tập hằng ngày</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              {stats.playedToday
                ? 'Hôm nay bạn đã luyện tập — giỏi lắm!'
                : stats.streakState === 'lost'
                  ? `Lấy lại phong độ nào!${stats.lostStreak ? ` Bạn vừa lỡ chuỗi ${stats.lostStreak} ngày` : ''}`
                  : stats.streakState === 'at_risk'
                    ? `Giữ lửa chuỗi ${stats.streak} ngày — hôm nay chưa luyện!`
                    : 'Sẵn sàng thử thách hôm nay chưa?'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Chọn chủ đề và độ khó, trả lời 10 câu để nhận XP và giữ chuỗi ngày 🔥
              {!stats.playedToday && stats.todayPlayers > 0 && <span className="font-bold text-emerald-600"> · {stats.todayPlayers} bạn đã luyện hôm nay</span>}
            </p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <StatPill icon={Flame} value={stats.streak || 0} label="ngày liên tiếp" tone="linear-gradient(180deg,#FB923C,#EA580C)" />
          <StatPill icon={Zap} value={stats.todayXp || 0} label="XP hôm nay" tone="linear-gradient(180deg,#FBBF24,#D97706)" />
          <StatPill icon={Trophy} value={stats.xpTotal || 0} label="tổng XP" tone="linear-gradient(180deg,#F87171,#B91C1C)" />
        </div>
      </section>

      {error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p>}
      {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải chủ đề…</p>}
      {!loading && !topics.length && !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Mascot mood="thinking" size={80} className="mx-auto" />
          <p className="mt-3 font-bold text-slate-700">Trung tâm đang soạn câu hỏi luyện tập.</p>
          <p className="text-sm text-slate-500">Quay lại sau nhé!</p>
        </div>
      )}

      {topics.length > 0 && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-black text-slate-700">1. Chọn chủ đề</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {topics.map((topic) => {
                const Icon = topicIcon(topic.icon);
                const color = topicColor(topic.color);
                const active = topic.id === topicId;
                const total = topic.counts.easy + topic.counts.medium + topic.counts.hard;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => { gameSounds.tap(); setTopicId(topic.id); }}
                    className={`relative overflow-hidden rounded-2xl border-2 p-3.5 text-left transition hover:-translate-y-0.5 ${active ? 'dp-pop' : ''}`}
                    style={{ borderColor: active ? color.to : '#E2E8F0', background: active ? color.soft : '#FFFFFF' }}
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md"
                      style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}
                    >
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className="mt-2 block text-sm font-black text-slate-900">{topic.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{topic.description || `${total} câu hỏi`}</span>
                    {active && <CheckCircle2 size={18} className="absolute right-3 top-3" style={{ color: color.to }} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black text-slate-700">2. Chọn độ khó</h2>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((level) => {
                const active = level.id === difficulty;
                const count = selected?.counts?.[level.id] || 0;
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => { gameSounds.tap(); setDifficulty(level.id); }}
                    className="rounded-2xl border-2 px-2 py-3 text-center transition"
                    style={{ borderColor: active ? level.color : '#E2E8F0', background: active ? level.soft : '#FFFFFF' }}
                  >
                    <span className="flex justify-center gap-0.5">
                      {[1, 2, 3].map((n) => (
                        <Star key={n} size={16} fill={n <= level.stars ? level.color : 'none'} color={n <= level.stars ? level.color : '#CBD5E1'} />
                      ))}
                    </span>
                    <span className="mt-1 block text-base font-black" style={{ color: active ? level.color : '#0F172A' }}>{level.label}</span>
                    <span className="block text-[11px] font-semibold text-slate-400">{level.xp} XP/câu · {count} câu</span>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="button"
            disabled={!topicId || starting}
            onClick={() => onStart(topicId, difficulty)}
            className="cms-btn cms-btn-primary w-full !py-3.5 text-base"
          >
            {starting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            Bắt đầu luyện tập
          </button>
        </>
      )}
    </div>
  );
}

// ── Màn chơi ─────────────────────────────────────────────────────────────────
function QuitConfirm({ stats, answered, total, onStay, onQuit }) {
  const keptToday = Boolean(stats?.playedToday);
  const streak = stats?.streak || 0;
  const left = Math.max(0, total - answered);

  useEffect(() => { gameSounds.sad(); }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation">
      <div className="cms-goal-in w-full max-w-sm overflow-hidden rounded-[28px] bg-white text-center shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="dp-quit-title">
        <div className="bg-gradient-to-br from-sky-50 via-white to-slate-100 px-6 pb-5 pt-6">
          <Mascot mood="sad" size={96} className="mx-auto" />
          <h2 id="dp-quit-title" className="mt-2 text-xl font-black text-slate-900">
            {keptToday ? 'Thoát lượt chơi này?' : 'Bạn sẽ mất chuỗi hôm nay!'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            {keptToday
              ? 'Kết quả và XP của lượt này sẽ không được tính.'
              : streak > 0
                ? `Thoát bây giờ, chuỗi 🔥 ${streak} ngày của bạn sẽ về 0 lúc nửa đêm. Bạn có chắc muốn thoát không?`
                : 'Thoát bây giờ thì hôm nay bạn chưa có chuỗi 🔥 và không nhận được XP. Bạn có chắc muốn thoát không?'}
          </p>
          {left > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
              <Zap size={13} className="fill-amber-300 text-amber-500" aria-hidden="true" />
              Đã làm {answered}/{total} câu — chỉ còn {left} câu nữa thôi!
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 p-5">
          <button type="button" onClick={onStay} className="cms-btn cms-btn-primary w-full !py-3">
            <Play size={16} /> Ở lại luyện tiếp
          </button>
          <button type="button" onClick={onQuit} className="cms-btn cms-btn-outline w-full !py-2.5 !text-slate-500">
            Vẫn thoát
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PlayScreen({ session, stats, onQuit, onFinished }) {
  const [quitOpen, setQuitOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [hintText, setHintText] = useState('');
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [xpBump, setXpBump] = useState(0);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [error, setError] = useState('');
  const question = session.questions[index];
  const total = session.questions.length;
  const meta = QUESTION_TYPES[question.type];
  const level = difficultyMeta(question.difficulty);

  const submit = useCallback(async (answer) => {
    if (busy || result) return;
    setBusy(true);
    setError('');
    setChosen(answer.index ?? answer.value ?? null);
    try {
      const data = await dailyPracticeApi.student.answer(session.id, question.id, answer);
      setResult(data);
      setXp(data.sessionXp);
      if (data.correct) {
        setXpBump(data.xp);
        setFeedbackTitle(randomPraise());
        gameSounds.correct();
      } else {
        setFeedbackTitle(randomComfort());
        gameSounds.wrong();
      }
    } catch (err) {
      setError(err.message || 'Không gửi được câu trả lời');
    } finally {
      setBusy(false);
    }
  }, [busy, result, session.id, question.id]);

  const askHint = async () => {
    if (reveal || result || busy) return;
    setBusy(true);
    try {
      const data = await dailyPracticeApi.student.hint(session.id, question.id);
      gameSounds.hint();
      setReveal(data.reveal || {});
      setHintText(data.hint || '');
    } catch (err) {
      setError(err.message || 'Không lấy được gợi ý');
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (index + 1 < total) {
      setIndex(index + 1);
      setPending(null);
      setChosen(null);
      setResult(null);
      setReveal(null);
      setHintText('');
      setXpBump(0);
      return;
    }
    setBusy(true);
    try {
      onFinished(await dailyPracticeApi.student.finish(session.id));
    } catch (err) {
      setError(err.message || 'Không lưu được kết quả');
      setBusy(false);
    }
  };

  const props = { question, reveal, result, onChange: setPending };
  const progress = Math.round(((index + (result ? 1 : 0)) / total) * 100);
  const immediate = question.type === 'mcq' || question.type === 'truefalse';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setQuitOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} aria-hidden="true" /> Thoát
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>
        <span className="relative flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-700 ring-1 ring-amber-200">
          <Zap size={15} className="fill-amber-400 text-amber-500" /> {xp}
          {xpBump > 0 && <span key={`${index}-bump`} className="dp-xp-float absolute -top-5 right-1 text-sm font-black text-emerald-600">+{xpBump}</span>}
        </span>
      </div>

      <div className={`relative rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200 ${result && !result.correct ? 'dp-shake' : ''}`}>
        {result?.correct && <Confetti />}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-white">Câu {index + 1}/{total}</span>
          <span className="rounded-full px-2.5 py-1" style={{ background: level.soft, color: level.color }}>{meta.label} · {level.label}</span>
        </div>
        <div className="flex items-start gap-3">
          <Mascot mood={result ? (result.correct ? 'happy' : 'sad') : reveal ? 'thinking' : 'idle'} size={64} className="hidden shrink-0 sm:block" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black leading-snug text-slate-900">{question.prompt}</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">{meta.instruction}</p>
          </div>
        </div>
        {question.imageUrl && <img src={question.imageUrl} alt="" className="mt-3 max-h-56 w-full rounded-xl object-contain ring-1 ring-slate-100" />}

        {hintText && (
          <p className="dp-pop mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
            <Lightbulb size={16} className="mt-0.5 shrink-0 fill-amber-300 text-amber-500" /> {hintText}
          </p>
        )}

        <div className="mt-4" key={question.id}>
          {question.type === 'mcq' && <McqQuestion {...props} chosen={chosen} onSubmit={submit} />}
          {question.type === 'truefalse' && <TrueFalseQuestion {...props} chosen={chosen} onSubmit={submit} />}
          {question.type === 'order' && <OrderQuestion {...props} />}
          {question.type === 'match' && <MatchQuestion {...props} />}
          {question.type === 'fill' && <FillQuestion {...props} />}
          {question.type === 'sort' && <SortQuestion {...props} />}
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>

      {quitOpen && (
        <QuitConfirm
          stats={stats}
          answered={index + (result ? 1 : 0)}
          total={total}
          onStay={() => setQuitOpen(false)}
          onQuit={() => { setQuitOpen(false); onQuit(); }}
        />
      )}
      {!result ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={askHint}
            disabled={Boolean(reveal) || busy}
            className="cms-btn cms-btn-outline !px-4"
            title="Dùng gợi ý chỉ nhận một nửa XP"
          >
            <Lightbulb size={17} className={reveal ? '' : 'fill-amber-300 text-amber-500'} />
            {reveal ? 'Đã dùng gợi ý' : 'Gợi ý (½ XP)'}
          </button>
          {!immediate && (
            <button type="button" onClick={() => submit(pending)} disabled={!pending || busy} className="cms-btn cms-btn-primary flex-1 !py-3">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} Kiểm tra
            </button>
          )}
        </div>
      ) : (
        <div className={`dp-slide-up flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center ${result.correct ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-red-50 ring-1 ring-red-200'}`}>
          <div className="flex flex-1 items-start gap-3">
            <Mascot mood={result.correct ? 'happy' : 'sad'} size={56} className="shrink-0" />
            <div className="min-w-0">
              <p className={`flex items-center gap-1.5 text-lg font-black ${result.correct ? 'text-emerald-700' : 'text-red-600'}`}>
                {result.correct ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                {feedbackTitle}
                {result.correct && <span className="ml-1 text-sm text-amber-600">+{result.xp} XP</span>}
              </p>
              {!result.correct && <p className="mt-0.5 text-sm font-bold text-slate-700">Đáp án: {result.correctAnswer?.text}</p>}
              {result.explanation && <p className="mt-1 text-sm text-slate-600">{result.explanation}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={next}
            disabled={busy}
            className={`cms-btn shrink-0 !px-6 !py-3 text-white ${result.correct ? '!bg-emerald-600 hover:!bg-emerald-700' : '!bg-red-600 hover:!bg-red-700'}`}
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : null}
            {index + 1 < total ? 'Tiếp tục' : 'Xem kết quả'} <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Màn kết quả ──────────────────────────────────────────────────────────────
function RelatedLessonCard({ lesson }) {
  const navigate = useNavigate();
  return (
    <section className="dp-slide-up flex flex-col gap-3 rounded-[24px] bg-gradient-to-r from-red-50 to-amber-50 p-4 ring-1 ring-red-100 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm">
        <PlayCircle size={26} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-red-600">
          {lesson.completed ? 'Ôn lại video liên quan' : 'Học tiếp video liên quan'} · {lesson.subjectName}
        </p>
        <p className="truncate text-sm font-black text-slate-900">{lesson.unitTitle}</p>
        {lesson.itemTitle && <p className="truncate text-xs text-slate-500">{lesson.itemTitle}</p>}
      </div>
      <button
        type="button"
        onClick={() => navigate(lessonResumeUrl(lesson))}
        className="cms-btn cms-btn-primary shrink-0 !py-2.5"
      >
        <PlayCircle size={17} aria-hidden="true" /> Xem video liên quan
      </button>
    </section>
  );
}

function ResultScreen({ summary, onReplay, onHome }) {
  const message = resultMessage(summary.stars);
  const good = summary.stars >= 2;

  useEffect(() => {
    if (good) gameSounds.win();
    else gameSounds.sad();
  }, [good]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className={`relative overflow-hidden rounded-[28px] p-6 text-center ring-1 ${good ? 'bg-gradient-to-b from-amber-50 via-white to-white ring-amber-100' : 'bg-gradient-to-b from-sky-50 via-white to-white ring-sky-100'}`}>
        {good && <Confetti count={36} spread={220} />}
        <Mascot mood={good ? 'happy' : 'sad'} size={120} className="mx-auto" />
        <div className="mt-2 flex justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              size={44}
              className={n <= summary.stars ? 'dp-star-in' : ''}
              style={{ animationDelay: `${n * 180}ms` }}
              fill={n <= summary.stars ? '#FBBF24' : '#E2E8F0'}
              color={n <= summary.stars ? '#F59E0B' : '#CBD5E1'}
            />
          ))}
        </div>
        <h2 className="mt-3 text-2xl font-black text-slate-900">{message.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{message.text}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
            <p className="text-2xl font-black text-emerald-600 tabular-nums">{summary.correctCount}/{summary.total}</p>
            <p className="text-[11px] font-semibold text-slate-500">câu đúng</p>
          </div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
            <p className="text-2xl font-black text-amber-600 tabular-nums">+{summary.gainedXp}</p>
            <p className="text-[11px] font-semibold text-slate-500">XP{summary.bonusXp ? ` (thưởng +${summary.bonusXp})` : ''}</p>
          </div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
            <p className="flex items-center justify-center gap-1 text-2xl font-black text-orange-600 tabular-nums">
              <Flame size={22} className={summary.streakIncreased ? 'dp-pop fill-orange-400' : 'fill-orange-300'} /> {summary.stats.streak}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">{summary.streakIncreased ? 'chuỗi ngày tăng!' : 'ngày liên tiếp'}</p>
          </div>
        </div>
      </section>

      {summary.relatedLesson && <RelatedLessonCard lesson={summary.relatedLesson} />}

      {summary.review.length > 0 && (
        <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Sparkles size={16} className="text-amber-500" /> Xem lại câu chưa đúng</h3>
          <ul className="mt-3 space-y-2.5">
            {summary.review.map((item) => (
              <li key={item.id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-800">{item.prompt}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">✓ {item.correctAnswer?.text}</p>
                {item.explanation && <p className="mt-0.5 text-xs text-slate-500">{item.explanation}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onHome} className="cms-btn cms-btn-outline !py-3"><ArrowLeft size={17} /> Chủ đề khác</button>
        <button type="button" onClick={onReplay} className="cms-btn cms-btn-primary !py-3"><RotateCcw size={17} /> Chơi lại</button>
      </div>
    </div>
  );
}

/** Luyện tập hằng ngày kiểu trò chơi: chọn chủ đề + độ khó → 10 câu → kết quả. */
export default function DailyPracticePage() {
  const [searchParams] = useSearchParams();
  const linkedTopicId = searchParams.get('topicId') || '';
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lastPick, setLastPick] = useState(null);
  const [starting, setStarting] = useState(false);

  const loadOverview = useCallback(() => {
    setLoading(true);
    dailyPracticeApi.student.overview()
      .then((data) => { setOverview(data); setError(''); })
      .catch((err) => setError(err.message || 'Không tải được luyện tập hằng ngày'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const start = async (topicId, difficulty) => {
    setStarting(true);
    setError('');
    try {
      const data = await dailyPracticeApi.student.start(topicId, difficulty);
      setLastPick({ topicId, difficulty });
      setSummary(null);
      setSession(data);
    } catch (err) {
      setError(err.message || 'Không bắt đầu được lượt chơi');
    } finally {
      setStarting(false);
    }
  };

  const finished = (data) => {
    setSession(null);
    setSummary(data);
    setOverview((prev) => (prev ? { ...prev, stats: { ...prev.stats, ...data.stats, todayXp: (prev.stats.todayXp || 0) + data.gainedXp } } : prev));
    window.dispatchEvent(new CustomEvent(LEARNING_GOAL_CHANGED_EVENT));
  };

  return (
    <div className="cms-sd-page min-h-full pb-10">
      {session ? (
        <PlayScreen
          session={session}
          stats={overview?.stats}
          onQuit={() => setSession(null)}
          onFinished={finished}
        />
      ) : summary ? (
        <ResultScreen
          summary={summary}
          onReplay={() => lastPick && start(lastPick.topicId, lastPick.difficulty)}
          onHome={() => { setSummary(null); loadOverview(); }}
        />
      ) : (
        <HomeScreen
          key={linkedTopicId}
          overview={overview}
          loading={loading}
          error={error}
          onStart={start}
          starting={starting}
          initialTopicId={linkedTopicId}
        />
      )}
    </div>
  );
}
