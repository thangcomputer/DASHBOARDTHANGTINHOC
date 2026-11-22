import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Brain, CheckCircle2, ChevronDown, ChevronRight, Crown, Flame, Lightbulb, Loader2, Lock, LogOut, Maximize2, Minimize2, Play, PlayCircle, RotateCcw, Route, Shuffle, Sparkles, Star, Target, Trophy, Zap,
} from 'lucide-react';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT, emitDailyPracticeStats } from '../../../services/dailyPracticeApi';
import { gameSounds } from '../../../utils/sound';
import { useFocusMode } from '../../../utils/focusMode';
import { setPracticeSessionActive } from '../../../utils/practiceSessionMode';
import { readReloadAbandonNotice, writeReloadAbandonNotice } from '../../../utils/dailyPracticeReloadNotice';
import { LEARNING_GOAL_CHANGED_EVENT, lessonResumeUrl } from '../../../utils/learningGoal';
import {
  DIFFICULTIES, QUESTION_TYPES, QUESTION_STAKE_XP, SESSION_STAKE_XP, TEST_OUT_XP, difficultyMeta, inPlayWalletXp, playQuestionHeaderChips, practiceFinishXpDisplay, randomComfort, randomPraise, resultMessage,
} from '../../../utils/dailyPractice';
import DailyPracticeHero from './DailyPracticeHero';
import DailyPracticeSubjectBar from './DailyPracticeSubjectBar';
import DailyPracticeGoalPanel from './DailyPracticeGoalPanel';
import Mascot from './Mascot';
import AnimatedProgressBar from './AnimatedProgressBar';
import AnswerFeedback from './AnswerFeedback';
import { SoundToggleButton } from './GameButton';
import { AnimatedXpCounter } from './XPRewardAnimation';
import { pathTopicPrimaryCtaLabel } from '../../../../../shared/dailyPractice/lastPathTopic.mjs';
import { reviewItemFollowUpLine } from '../../../../../shared/dailyPractice/reviewDisplay.mjs';
import PathView, { PathResultCard, continuePracticeTarget, focusCurrentPathLesson, pickActivePathTopic } from './PathView';
import PathVideoModal from './PathVideoModal';
import PracticeFinishOverlay from './PracticeFinishOverlay';
import ShareAchievementModal, { ShareTriggerButton } from '../ShareAchievementModal';
import { buildPracticeShareData } from '../../../../../shared/dailyPractice/shareAchievement.mjs';
import ComboCelebrationOverlay from './ComboCelebrationOverlay';
import { shouldShowComboCelebration } from './quizFeedbackOrchestration';
import BuyXpModal from './BuyXpModal';
import DigitalCertificateModal from '../DigitalCertificateModal';
import PlacementTestModal, { readPlacementResult } from './PlacementTestModal';
import WelcomeBackModal, { takeWelcomeBackTurn } from './WelcomeBackModal';
import FreeMeetPlanModal, { isFreePortalAccount } from './FreeMeetPlanModal';
import subscriptionApi from '../../../services/subscriptionApi';
import { FillQuestion, MatchQuestion, McqQuestion, OrderQuestion, SortQuestion, TrueFalseQuestion } from './Questions';
import './dailyPracticeDew.css';
import './playQuestionChrome.css';
import { PLAY_QUESTION_CHROME } from '../../../../../shared/dailyPractice/playQuestionChrome.mjs';

const MODE_STORAGE_KEY = 'cms_daily_practice_mode';
const MODES = [
  { id: 'path', label: 'Theo lộ trình', icon: Route },
  { id: 'free', label: 'Luyện tự do', icon: Shuffle },
];
const CONFETTI_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#A855F7', '#F97316'];

function shuffleList(list) {
  if (!Array.isArray(list)) return [];
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

function readStudentCertificateMeta() {
  try {
    const raw = localStorage.getItem('student_user') || localStorage.getItem('cms_student_user');
    const u = JSON.parse(raw || '{}');
    return {
      studentId: String(u.id || u._id || '').trim(),
      studentName: String(u.fullName || u.name || u.username || '').trim() || 'Học viên Thắng Tin Học',
      studentCode: String(u.studentCode || u.code || '').trim(),
    };
  } catch {
    return { studentId: '', studentName: 'Học viên Thắng Tin Học', studentCode: '' };
  }
}

function HomeScreen({
  overview, loading, error, onStart, onStartSpacedReview, starting, initialTopicId = '',
  mode, onModeChange, path, pathLoading, pathError, onStartStep, onPathChanged, onBuyXpPaid,
  continueVideo = false, onContinueVideoOpened, requestedLesson = null, onRequestedLessonOpened,
}) {
  const [topicId, setTopicId] = useState('');
  const [activePathTopicId, setActivePathTopicId] = useState(initialTopicId);
  const [difficulty, setDifficulty] = useState('easy');
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const certStudent = useMemo(() => readStudentCertificateMeta(), []);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementResult, setPlacementResult] = useState(() => readPlacementResult(certStudent.studentId));
  const topics = useMemo(() => overview?.topics || [], [overview]);
  const stats = overview?.stats || {};
  const xpEmpty = Boolean(stats.xpEmpty || (stats.xpTotal || 0) <= 0);
  const xpPacks = stats.xpPacks || [];
  const selected = topics.find((topic) => topic.id === topicId);
  const pathTopic = useMemo(() => {
    if (activePathTopicId) {
      const found = (path?.topics || []).find((item) => item.topic.id === activePathTopicId);
      if (found) return found;
    }
    return pickActivePathTopic(path, initialTopicId);
  }, [path, activePathTopicId, initialTopicId]);

  useEffect(() => {
    const serverId = String(path?.activeTopicId || '').trim();
    if (serverId) setActivePathTopicId(serverId);
  }, [path?.activeTopicId]);

  useEffect(() => {
    if (topicId || !topics.length) return;
    const linked = initialTopicId && topics.find((topic) => topic.id === initialTopicId);
    setTopicId(linked ? linked.id : topics[0].id);
  }, [topicId, topics, initialTopicId]);

  const hasCompletedFirstNode = useMemo(() => (path?.topics || []).some((t) => {
    const firstUnit = t?.units?.[0];
    const firstNode = firstUnit?.pathNodes?.[0];
    if (firstNode) return firstNode.state === 'completed';
    return firstUnit?.state === 'completed';
  }), [path]);

  const pathContinue = pathTopic?.next
    ? {
      unitId: pathTopic.next.unitId,
      nodeKey: pathTopic.next.nodeKey || 'study',
      step: pathTopic.next.step,
    }
    : null;

  const topicPathDone = Boolean(
    pathTopic?.totalUnits && (pathTopic.completedUnits || 0) >= pathTopic.totalUnits,
  );

  const heroAction = () => {
    gameSounds.tap();
    if (mode === 'path') {
      if (pathContinue) focusCurrentPathLesson();
      else document.getElementById('dp-path-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (topicId) onStart(topicId, difficulty);
  };

  const heroLabel = mode === 'path'
    ? (topicPathDone
      ? 'Ôn lại lộ trình'
      : (pathTopic ? pathTopicPrimaryCtaLabel(pathTopic) : 'Xem chi tiết lộ trình'))
    : 'Bắt đầu luyện tập';
  const heroDisabled = mode === 'free' ? (!topicId || starting) : starting;
  const freePortal = isFreePortalAccount();
  const pathTopicRows = path?.topics || [];
  const subjectBarTopics = pathTopicRows.length ? pathTopicRows : topics;
  const subjectBarVariant = pathTopicRows.length ? 'path' : 'free';
  const subjectBarActiveId = mode === 'path'
    ? (activePathTopicId || topicId)
    : (topicId || activePathTopicId);

  const pickSubject = (id) => {
    setActivePathTopicId(id);
    setTopicId(id);
  };

  return (
    <div className="dp-shell mx-auto w-full max-w-6xl space-y-5 xl:max-w-7xl" data-lms-ui>

      <DailyPracticeHero
        stats={stats}
        mode={mode}
        onPrimaryAction={heroAction}
        primaryDisabled={heroDisabled}
        primaryLabel={heroLabel}
        pathTopic={mode === 'path' ? pathTopic : null}
        pathContinue={Boolean(pathContinue)}
        freeTopicName={selected?.name || topics[0]?.name || ''}
        onBuyXp={() => setBuyXpOpen(true)}
        onOpenCertificate={freePortal && topicPathDone ? () => setCertOpen(true) : undefined}
      />

      {xpEmpty && (
        <section className="flex flex-col gap-3 rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4 py-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-amber-950">Hết XP để luyện</p>
            <p className="mt-0.5 text-xs font-semibold text-amber-800">
              Mua thêm để luyện tiếp trong hôm nay. Ngày mai bạn được lại {stats.dailyAllowanceXp || stats.dailyRefillXp || 200} XP, XP đã mua vẫn được giữ.
            </p>
          </div>
          <button type="button" onClick={() => setBuyXpOpen(true)} className="cms-btn cms-btn-primary shrink-0 !py-2.5">
            <Zap size={16} className="fill-amber-300 text-white" /> Mua XP
          </button>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="min-w-0 lg:col-span-8">
          <section className="dp-dew-main-panel flex flex-col gap-3 sm:gap-4">
            {subjectBarTopics.length > 0 ? (
              <DailyPracticeSubjectBar
                className="dp-dew-subject-carousel--responsive"
                topics={subjectBarTopics}
                variant={subjectBarVariant}
                activeTopicId={subjectBarActiveId}
                onSelect={pickSubject}
              />
            ) : null}

            <div
              className={`grid grid-cols-2 gap-1 rounded-[16px] p-1 ${freePortal ? 'border border-[#D5E7DF] bg-[#E8F3EE]' : 'bg-slate-100'
                }`}
              role="tablist"
              aria-label="Chế độ luyện tập"
            >
              {MODES.map((item) => {
                const Icon = item.icon;
                const active = mode === item.id;
                const displayLabel = freePortal && item.id === 'path' ? 'Lộ trình' : item.label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { gameSounds.tap(); onModeChange(item.id); }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-black transition !shadow-none ${active
                      ? 'bg-white text-[#059669] shadow-sm ring-1 ring-emerald-200/60'
                      : 'text-[#64748B] hover:text-slate-700'
                      }`}
                  >
                    <Icon size={15} aria-hidden="true" /> {displayLabel}
                  </button>
                );
              })}
            </div>

            {mode === 'path' && (
              <div id="dp-path-panel" className="scroll-mt-4">
                <PathView
                  path={path}
                  practiceStats={stats}
                  loading={pathLoading}
                  error={pathError}
                  starting={starting}
                  initialTopicId={initialTopicId}
                  activeTopicId={activePathTopicId}
                  onTopicChange={setActivePathTopicId}
                  onStartStep={onStartStep}
                  onPathChanged={onPathChanged}
                  layout="wide"
                  showSubjectBar={false}
                  continueVideo={continueVideo}
                  onContinueVideoOpened={onContinueVideoOpened}
                  requestedLesson={requestedLesson}
                  onRequestedLessonOpened={onRequestedLessonOpened}
                />
              </div>
            )}

            {mode === 'free' && error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p>}
            {mode === 'free' && loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải chủ đề…</p>}
            {mode === 'free' && !loading && !topics.length && !error && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <Mascot mood="thinking" size={80} className="mx-auto" />
                <p className="mt-3 font-bold text-slate-700">Chưa có câu Luyện tự do.</p>
                <p className="text-sm text-slate-500">Trung tâm cần soạn ngân hàng riêng (không dùng câu lộ trình). Quay lại sau nhé!</p>
              </div>
            )}

            {mode === 'free' && topics.length > 0 && (
              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                  Luyện tự do chỉ <span className="font-black">trắc nghiệm ôn</span>, không tính XP, không video, không dùng câu đã gắn chặng.
                </p>

                <section>
                  <h2 className="mb-2 text-sm font-black text-slate-800">Chọn độ khó</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {DIFFICULTIES.map((level) => {
                      const active = level.id === difficulty;
                      const count = selected?.counts?.[level.id] || 0;
                      return (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() => { gameSounds.tap(); setDifficulty(level.id); }}
                          className="rounded-2xl border-2 px-2 py-3 text-center transition !shadow-none"
                          style={{ borderColor: active ? level.color : '#E2E8F0', background: active ? level.soft : '#FFFFFF' }}
                        >
                          <span className="flex justify-center gap-0.5">
                            {[1, 2, 3].map((n) => (
                              <Star key={n} size={16} fill={n <= level.stars ? level.color : 'none'} color={n <= level.stars ? level.color : '#CBD5E1'} />
                            ))}
                          </span>
                          <span className="mt-1 block text-base font-black" style={{ color: active ? level.color : '#0F172A' }}>{level.label}</span>
                          <span className="block text-[11px] font-semibold text-slate-400">{count} câu · không tính XP</span>
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
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-4 lg:col-span-4">
          <DailyPracticeGoalPanel practiceStats={stats} canSetGoal={hasCompletedFirstNode} />
          {(() => {
            const spaced = overview?.spacedRepetition || stats?.spacedRepetition || { dueCount: 0, totalQueued: 0, rewardXp: 15, nextDueDay: '' };
            const dueCount = Number(spaced.dueCount) || 0;
            const totalQueued = Number(spaced.totalQueued) || 0;
            const rewardXp = Number(spaced.rewardXp) || 15;
            return (
              <section className="rounded-[24px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/60 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                      <Brain size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>Ôn tập ngắt quãng</span>
                    </h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                      Chu kỳ 1–3–7 ngày · Đạt ≥ 70% nhận +{rewardXp} XP
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ${dueCount > 0
                      ? 'bg-emerald-600 text-white'
                      : totalQueued > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-500'
                      }`}
                  >
                    {dueCount > 0
                      ? `${dueCount} câu đến hạn`
                      : totalQueued > 0
                        ? `${totalQueued} câu chờ lịch`
                        : 'Sạch lỗi'}
                  </span>
                </div>
                <p className="mt-2.5 text-xs font-medium leading-relaxed text-slate-600">
                  {totalQueued > 0
                    ? dueCount > 0
                      ? `Bạn có ${dueCount} câu từng làm sai đã tới lịch nhắc lại hôm nay (tổng ${totalQueued} câu đang theo dõi).`
                      : `Chưa có câu đến hạn hôm nay (${totalQueued} câu sẽ nhắc lại${spaced.nextDueDay ? ` từ ${spaced.nextDueDay}` : ''}). Bạn vẫn có thể ôn sớm ngay!`
                    : 'Các câu bạn làm sai trong quá trình luyện tập sẽ tự động vào đây để nhắc ôn sau 1, 3 và 7 ngày.'}
                </p>
                <button
                  type="button"
                  disabled={starting || totalQueued === 0}
                  onClick={() => {
                    gameSounds.tap();
                    onStartSpacedReview?.();
                  }}
                  className="cms-btn cms-btn-primary mt-3 w-full !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  {dueCount > 0 ? `Ôn tập ngay (${Math.min(10, totalQueued)} câu)` : totalQueued > 0 ? 'Ôn sớm hàng đợi' : 'Chưa có câu cần ôn'}
                </button>
              </section>
            );
          })()}
          <section className="rounded-[24px] border border-sky-200/80 bg-gradient-to-br from-sky-50/70 via-white to-indigo-50/60 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                  <Target size={15} className="shrink-0 text-sky-600" aria-hidden="true" />
                  <span>Lộ trình dành riêng cho bạn</span>
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {placementResult
                    ? `Đạt ${placementResult.score}/${placementResult.total} · ${placementResult.recommendedLevel}`
                    : 'Trả lời nhanh 10 câu để chọn đúng môn học phù hợp nhất'}
                </p>
              </div>
              {placementResult && (
                <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">
                  Đã đánh giá
                </span>
              )}
            </div>
            {placementResult && (
              <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 border border-sky-100">
                Gợi ý ưu tiên: <strong className="text-emerald-700">{placementResult.matchedTopicName}</strong>
              </p>
            )}
            <button
              type="button"
              onClick={() => { gameSounds.tap(); setPlacementOpen(true); }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-sky-200 bg-white px-3 py-2.5 text-xs font-black text-sky-700 transition hover:bg-sky-50 !shadow-none"
            >
              <Sparkles size={15} aria-hidden="true" />
              {placementResult ? 'Xem đánh giá & Làm lại' : 'Đánh giá năng lực (10 câu)'}
            </button>
          </section>
        </aside>
      </div>

      {buyXpOpen && (
        <BuyXpModal
          packs={xpPacks}
          onClose={() => setBuyXpOpen(false)}
          onPaid={(status) => {
            onBuyXpPaid?.(status);
          }}
        />
      )}
      {certOpen && (
        <DigitalCertificateModal
          open={certOpen}
          onClose={() => setCertOpen(false)}
          studentName={certStudent.studentName}
          studentCode={certStudent.studentCode}
          studentId={certStudent.studentId}
          courseId={mode === 'path' ? (pathTopic?.topic?.id || topicId || 'dewskill') : (topicId || pathTopic?.topic?.id || 'dewskill')}
          courseTitle={mode === 'path'
            ? (pathTopic?.topic?.name || selected?.name || topics[0]?.name || 'Lộ trình Tin học DewSkill')
            : (selected?.name || pathTopic?.topic?.name || 'Luyện tập Tin học DewSkill')}
          instructorName="Trung tâm Thắng Tin Học"
          certificateScope="subject"
          completionRate={pathTopic?.totalUnits
            ? Math.min(100, Math.round(((pathTopic.completedUnits || 0) / pathTopic.totalUnits) * 100))
            : 0}
        />
      )}
      {placementOpen && (
        <PlacementTestModal
          open={placementOpen}
          intro={!placementResult}
          onClose={() => setPlacementOpen(false)}
          studentId={certStudent.studentId}
          topics={(path?.topics || []).map((t) => t.topic).filter(Boolean).length
            ? (path?.topics || []).map((t) => t.topic).filter(Boolean)
            : topics}
          onApplied={(res) => {
            setPlacementResult(res);
            if (res?.matchedTopicId) {
              pickSubject(res.matchedTopicId);
            } else if (res?.matchedTopicName) {
              const kw = String(res.matchedTopicName).toLowerCase();
              const found = topics.find((t) => {
                const n = String(t.name || '').toLowerCase();
                return n.includes(kw) || kw.includes(n);
              });
              if (found?.id) pickSubject(found.id);
            }
          }}
        />
      )}
    </div>
  );
}

// ── Màn chơi ─────────────────────────────────────────────────────────────────
function QuitConfirm({ answered, total, stakeXp = 0, quitLossXp = 0, mandatory = false, quitting, mode = 'quit', onStay, onQuit }) {
  const left = Math.max(0, total - answered);
  const lossOnQuit = Math.max(stakeXp, quitLossXp);
  const loseXp = lossOnQuit > 0;
  const isReload = mode === 'reload';

  useEffect(() => { gameSounds.sad(); }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation">
      <div className="cms-goal-in w-full max-w-sm overflow-hidden rounded-[28px] bg-white text-center shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="dp-quit-title">
        <div className={`px-6 pb-5 pt-6 ${loseXp ? 'bg-gradient-to-br from-red-50 via-white to-amber-50' : 'bg-gradient-to-br from-sky-50 via-white to-slate-100'}`}>
          <Mascot mood="quit" size={96} className="mx-auto" />
          <h2 id="dp-quit-title" className="mt-2 text-xl font-black text-slate-900">
            {isReload
              ? (loseXp ? 'Tải lại trang sẽ mất XP!' : 'Tải lại trang lúc này?')
              : (loseXp ? 'Bạn sẽ mất chuỗi hôm nay!' : 'Thoát lượt này?')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            {isReload
              ? (loseXp
                ? (mandatory
                  ? `Đây là lượt bắt buộc. Tải lại trang lúc này sẽ hủy lượt luyện tập và mất thêm XP còn lại (tối đa −${lossOnQuit} XP cho các câu chưa làm).`
                  : `Tải lại trang lúc này sẽ hủy lượt luyện tập và mất thêm XP (tối đa −${lossOnQuit} XP).`)
                : 'Tải lại trang lúc này sẽ hủy tiến độ lượt luyện tập hiện tại. Lượt phục hồi này không mất XP nhưng bạn nên hoàn thành để nhận XP.')
              : (loseXp
                ? (mandatory
                  ? `Đây là lượt bắt buộc. Thoát bây giờ bạn mất thêm XP còn lại (tối đa −${lossOnQuit} XP cho các câu chưa làm).`
                  : `Thoát bây giờ bạn mất thêm XP (tối đa −${lossOnQuit} XP).`)
                : 'Lượt phục hồi này không mất XP nếu thoát. Bạn vẫn nên hoàn thành để nhận XP.')}
          </p>
          {loseXp && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 ring-1 ring-red-200">
              <Zap size={13} className="fill-amber-300 text-amber-500" aria-hidden="true" />
              {isReload ? `Mất tối đa −${lossOnQuit} XP nếu tải lại` : `Mất tối đa −${lossOnQuit} XP nếu thoát`}
            </p>
          )}
          {left > 0 && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Đã làm {answered}/{total} câu, còn {left} câu nữa thôi!
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 p-5">
          <button type="button" onClick={onStay} disabled={quitting} className="cms-btn cms-btn-primary w-full !py-3">
            <Play size={16} /> Ở lại luyện tiếp
          </button>
          <button type="button" onClick={onQuit} disabled={quitting} className="cms-btn cms-btn-outline w-full !py-2.5 !text-emerald-600">
            {quitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {isReload
              ? (loseXp ? `Tải lại trang và mất tối đa ${lossOnQuit} XP` : 'Vẫn tải lại trang')
              : (loseXp ? `Thoát và mất tối đa ${lossOnQuit} XP` : 'Vẫn thoát')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReloadAbandonNoticeModal({ lostXp, onClose }) {
  useEffect(() => { gameSounds.sad(); }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9800] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation">
      <div
        className="cms-goal-in w-full max-w-sm overflow-hidden rounded-[28px] bg-white text-center shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dp-reload-notice-title"
      >
        <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50 px-6 pb-5 pt-6">
          <Mascot mood="thinking" size={92} className="mx-auto" />
          <h2 id="dp-reload-notice-title" className="mt-2 text-xl font-black text-slate-900">
            Lượt luyện tập trước đã hủy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {lostXp > 0
              ? `Bạn vừa tải lại hoặc rời trang khi đang luyện. Lượt đó đã bị hủy (có thể mất tối đa −${lostXp} XP). Lần sau bấm Thoát hoặc F5 để xác nhận trước khi rời.`
              : 'Bạn vừa tải lại hoặc rời trang khi đang luyện. Lượt trước đã bị hủy — hãy bắt đầu lượt mới khi sẵn sàng.'}
          </p>
        </div>
        <div className="p-5">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-primary w-full !py-3">
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PlayScreen({ session, stats, onQuit, onFinished }) {
  const [quitOpen, setQuitOpen] = useState(false);
  const [quitMode, setQuitMode] = useState('quit');
  const [quitting, setQuitting] = useState(false);
  const allowUnloadRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [hintText, setHintText] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileXp, setProfileXp] = useState(() => session.profileXp ?? stats?.xpTotal ?? 0);
  useEffect(() => {
    const onStatsChanged = (event) => {
      if (typeof event?.detail?.xpTotal === 'number') {
        setProfileXp(event.detail.xpTotal);
      }
      const spendXp = Number(event?.detail?.spendXp || 0);
      if (spendXp > 0) {
        setHintChargedXp(0);
        window.requestAnimationFrame(() => setHintChargedXp(spendXp));
      }
    };
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onStatsChanged);
    return () => window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStatsChanged);
  }, []);
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const [comboCelebration, setComboCelebration] = useState(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [hintChargedXp, setHintChargedXp] = useState(0);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [error, setError] = useState('');
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [videoDoneIds, setVideoDoneIds] = useState(() => {
    const init = {};
    for (const q of session?.questions || []) {
      if (q?.type === 'video' && q.watched) init[q.id] = true;
    }
    return init;
  });
  const question = session.questions[index];
  const total = session.questions.length;
  const meta = QUESTION_TYPES[question.type] || QUESTION_TYPES.mcq;
  const level = difficultyMeta(question.difficulty);
  const isVideoQuestion = question.type === 'video';
  const videoCompleted = isVideoQuestion && Boolean(videoDoneIds[question.id]);
  const isPathSession = session.mode === 'path' || Boolean(session.path);
  const xpDisabled = Boolean(session.xpDisabled || (!isPathSession && session.mode === 'free') || session.review || session.path?.review);
  const stakeXp = xpDisabled ? 0 : (session.stakeXp ?? 0);
  const perQuestionStake = session.perQuestionStakeXp || QUESTION_STAKE_XP;
  const isTestOutStake = Boolean(session.path?.testOut) && stakeXp > 0;
  const isPerQuestion = !xpDisabled && !session.recovery && !isTestOutStake && isPathSession;
  const stakeLabel = xpDisabled ? 0 : (session.sessionStakeXp || total * perQuestionStake || SESSION_STAKE_XP);
  const mandatory = !xpDisabled && Boolean(session.mandatory ?? (stakeXp > 0 || isPerQuestion));
  const walletXp = inPlayWalletXp(profileXp, isTestOutStake ? stakeXp : 0);
  const hintShareXp = !xpDisabled
    ? (isPerQuestion ? Math.floor(perQuestionStake / 2) : (stakeXp > 0 && total > 0 ? Math.floor(stakeXp / (2 * total)) : 0))
    : 0;
  const headerChips = useMemo(
    () => playQuestionHeaderChips({ path: session.path, typeLabel: meta.label, levelMeta: level }),
    [session.path, meta.label, level],
  );

  useEffect(() => {
    setExplainOpen(false);
    setHintChargedXp(0);
  }, [question.id]);

  const submit = useCallback(async (answer) => {
    if (!answer || busy || result) return;
    setBusy(true);
    setError('');
    setChosen(answer.index ?? answer.value ?? null);
    try {
      const data = await dailyPracticeApi.student.answer(session.id, question.id, answer);
      setResult(data);
      if (typeof data.profileXp === 'number') setProfileXp(data.profileXp);
      if (data.correct) {
        const nextVal = comboRef.current + 1;
        comboRef.current = nextVal;
        setCombo(nextVal);
        if (shouldShowComboCelebration(nextVal)) {
          setComboCelebration(nextVal);
        }
        setFeedbackTitle(randomPraise());
        gameSounds.correct();
      } else {
        comboRef.current = 0;
        setCombo(0);
        setFeedbackTitle(randomComfort());
        gameSounds.wrong();
      }
    } catch (err) {
      if (err.status === 402) setBuyXpOpen(true);
      else setError(err.message || 'Không gửi được câu trả lời');
    } finally {
      setBusy(false);
    }
  }, [busy, result, session.id, question.id]);

  const askHint = async () => {
    if (reveal || result || busy) return;
    if (!xpDisabled && hintShareXp > 0 && profileXp < hintShareXp) {
      setBuyXpOpen(true);
      return;
    }
    setBusy(true);
    try {
      const data = await dailyPracticeApi.student.hint(session.id, question.id);
      gameSounds.hint();
      const charged = Math.max(0, Number(data.charged) || 0);
      if (typeof data.profileXp === 'number') {
        setProfileXp(data.profileXp);
        emitDailyPracticeStats({
          xpTotal: data.profileXp,
          ...(typeof data.purchasedXp === 'number' ? { purchasedXp: data.purchasedXp } : {}),
          ...(typeof data.dailyXp === 'number' ? { dailyXp: data.dailyXp } : {}),
        });
      }
      if (charged > 0) setHintChargedXp(charged);
      setReveal(data.reveal || {});
      setHintText(data.hint || '');
    } catch (err) {
      if (err.status === 402) setBuyXpOpen(true);
      else setError(err.message || 'Không lấy được gợi ý');
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
      return;
    }
    setBusy(true);
    allowUnloadRef.current = true;
    try {
      onFinished(await dailyPracticeApi.student.finish(session.id));
    } catch (err) {
      allowUnloadRef.current = false;
      setError(err.message || 'Không lưu được kết quả');
      setBusy(false);
    }
  };

  const confirmQuit = async () => {
    if (quitting) return;
    setQuitting(true);
    try {
      const data = await dailyPracticeApi.student.abandon(session.id);
      allowUnloadRef.current = true;
      if (quitMode === 'reload') {
        writeReloadAbandonNotice(quitLossXp);
        setQuitOpen(false);
        window.location.reload();
        return;
      }
      onQuit(data);
    } catch {
      allowUnloadRef.current = true;
      if (quitMode === 'reload') {
        writeReloadAbandonNotice(quitLossXp);
        setQuitOpen(false);
        window.location.reload();
        return;
      }
      onQuit(null);
    } finally {
      setQuitting(false);
      setQuitOpen(false);
    }
  };

  const props = { question, reveal, result, onChange: setPending };
  const stepDone = isVideoQuestion ? videoCompleted : Boolean(result);
  const progress = Math.round(((index + (stepDone ? 1 : 0)) / total) * 100);
  const immediate = question.type === 'mcq' || question.type === 'truefalse';
  const contextLabel = headerChips[0]?.text || level.label;
  const answeredCount = index + (stepDone ? 1 : 0);
  const quitLossXp = isPerQuestion ? Math.max(0, total - answeredCount) * perQuestionStake : stakeXp;
  const lossOnQuit = Math.max(stakeXp, quitLossXp);
  const confirmedQuestionXp = result?.correct
    ? (typeof result.xpDelta === 'number' && result.xpDelta > 0
      ? result.xpDelta
      : (typeof result.xp === 'number' && result.xp > 0
        ? result.xp
        : (isPerQuestion ? perQuestionStake : 0)))
    : 0;

  const leaveGuardRef = useRef({ sessionId: session.id, lossOnQuit: 0 });
  leaveGuardRef.current = { sessionId: session.id, lossOnQuit };

  const { setFocusMode } = useFocusMode();
  useEffect(() => () => setFocusMode(false), [setFocusMode]);
  useEffect(() => {
    setPracticeSessionActive(true);
    return () => setPracticeSessionActive(false);
  }, []);

  useEffect(() => {
    const handleReloadShortcut = (event) => {
      if (allowUnloadRef.current) return;
      const key = String(event.key || '');
      const isReloadKey = key === 'F5' || ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'r');
      if (!isReloadKey) return;
      event.preventDefault();
      event.stopPropagation();
      setQuitMode('reload');
      setQuitOpen(true);
    };

    const handlePageHide = () => {
      if (allowUnloadRef.current) return;
      allowUnloadRef.current = true;
      const { sessionId, lossOnQuit: loss } = leaveGuardRef.current;
      if (sessionId) {
        dailyPracticeApi.student.abandonBeacon(sessionId);
      }
      writeReloadAbandonNotice(loss);
    };

    const handleNavigate = (event) => {
      if (allowUnloadRef.current) return;
      if (event?.navigationType !== 'reload') return;
      if (typeof event.preventDefault === 'function') event.preventDefault();
      setQuitMode('reload');
      setQuitOpen(true);
    };

    window.addEventListener('keydown', handleReloadShortcut, true);
    window.addEventListener('pagehide', handlePageHide);
    const nav = window.navigation;
    if (nav?.addEventListener) nav.addEventListener('navigate', handleNavigate);
    return () => {
      window.removeEventListener('keydown', handleReloadShortcut, true);
      window.removeEventListener('pagehide', handlePageHide);
      if (nav?.removeEventListener) nav.removeEventListener('navigate', handleNavigate);
    };
  }, []);

  const keyActionsRef = useRef({});
  keyActionsRef.current = {
    blocked: quitOpen || buyXpOpen || Boolean(comboCelebration),
    busy,
    question,
    isVideoQuestion,
    videoCompleted,
    result,
    reveal,
    pending,
    immediate,
    submit,
    askHint,
    next,
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      const s = keyActionsRef.current;
      if (s.blocked || s.busy || !s.question) return;
      const key = String(event.key || '');
      const lower = key.toLowerCase();

      if (s.isVideoQuestion) {
        if (s.videoCompleted && (key === 'Enter' || key === 'ArrowRight')) {
          event.preventDefault();
          gameSounds.tap();
          s.next();
        }
        return;
      }

      if (s.result) {
        if (key === 'Enter' || key === 'ArrowRight') {
          event.preventDefault();
          gameSounds.tap();
          s.next();
        }
        return;
      }

      if (lower === 'h' && !s.reveal) {
        event.preventDefault();
        s.askHint();
        return;
      }

      if (s.question.type === 'mcq') {
        const map = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
        if (Object.prototype.hasOwnProperty.call(map, lower)) {
          const idx = map[lower];
          const eliminated = new Set(s.reveal?.eliminate || []);
          if (Array.isArray(s.question.options) && idx < s.question.options.length && !eliminated.has(idx)) {
            event.preventDefault();
            gameSounds.tap();
            s.submit({ index: idx });
          }
        }
        return;
      }

      if (s.question.type === 'truefalse') {
        if (lower === '1' || lower === 'a' || lower === 'd') {
          event.preventDefault();
          gameSounds.tap();
          s.submit({ value: true });
        } else if (lower === '2' || lower === 'b' || lower === 's') {
          event.preventDefault();
          gameSounds.tap();
          s.submit({ value: false });
        }
        return;
      }

      if (!s.immediate && s.pending && key === 'Enter') {
        event.preventDefault();
        s.submit(s.pending);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 pb-10 sm:px-6 ${isVideoQuestion ? 'pt-4 sm:gap-4 sm:pt-5' : 'gap-5 pt-6 sm:gap-6 sm:pt-10 sm:pb-12'}`}>
      <div className="flex items-center justify-start">
        <button
          type="button"
          onClick={() => { setQuitMode('quit'); setQuitOpen(true); }}
          aria-label="Thoát"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 !shadow-none"
        >
          <LogOut size={16} aria-hidden="true" /> Thoát
        </button>
      </div>
      {/* Thanh trên: tiến độ · XP */}
      <header className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/80 sm:gap-4 sm:px-5 sm:py-3.5">
        <AnimatedProgressBar
          progress={progress}
          currentStep={index + 1}
          totalSteps={total}
          label={contextLabel}
          confirmedXp={confirmedQuestionXp}
        />
        <div className="relative flex shrink-0 items-center gap-2">
          {combo >= 2 && (
            <span className="dp-combo absolute -top-3 right-12 z-[1] flex h-5 min-w-5 items-center justify-center whitespace-nowrap rounded-full bg-orange-500 px-2 text-[10px] font-black leading-none text-white shadow-sm">
              Combo x{combo}
            </span>
          )}
          <span
            className="relative flex h-10 items-center gap-2 rounded-xl bg-amber-50/90 px-3.5 text-sm font-black tabular-nums text-amber-900 ring-1 ring-amber-200/90"
            title={isTestOutStake
              ? `Tổng ${walletXp} XP · ${stakeXp} XP đang cược (ví tạm ${profileXp}). Đạt sẽ hoàn cược.`
              : (isPerQuestion
                ? `Ví ${profileXp} XP · ${perQuestionStake} XP/câu, sai trừ ngay · đạt nhận +${perQuestionStake}/câu đúng`
                : `Phục hồi · đạt nhận tối đa ${stakeLabel} XP`)}
          >
            <span className="flex items-center gap-1 leading-none">
              <Zap size={16} className="fill-amber-400 text-amber-500" aria-hidden="true" />
              <AnimatedXpCounter value={walletXp} />
            </span>
            {isTestOutStake ? (
              <span className="rounded-md bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-amber-900">−{stakeXp} cược</span>
            ) : (isPerQuestion ? (
              <span className="rounded-md bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-amber-900">{perQuestionStake} XP/câu</span>
            ) : null)}
            {hintChargedXp > 0 ? (
              <span className="dp-xp-hint-spend" aria-live="polite">−{hintChargedXp} XP</span>
            ) : null}
          </span>
        </div>
      </header>

      {/* Thẻ câu */}
      <section className={`relative rounded-[28px] bg-white p-5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/90 sm:p-8 ${result && !result.correct ? 'dp-shake' : ''}`}>
        {result?.correct && <Confetti />}
        {!result && !isVideoQuestion ? (
          <button
            type="button"
            onClick={askHint}
            disabled={Boolean(reveal) || busy}
            aria-label={reveal ? 'Đã dùng gợi ý' : (xpDisabled ? 'Gợi ý' : `Gợi ý, trừ ngay ${hintShareXp} XP`)}
            title={xpDisabled ? 'Gợi ý (không ảnh hưởng XP)' : `Gợi ý, trừ ngay −${hintShareXp} XP`}
            className="absolute right-4 top-4 z-20 dp-play-hint-corner sm:right-6 sm:top-6 disabled:opacity-50"
          >
            <Lightbulb size={PLAY_QUESTION_CHROME.icon.hintSize} strokeWidth={PLAY_QUESTION_CHROME.icon.strokeWidth} className={reveal ? 'text-slate-400' : 'text-slate-500'} />
            <span>{reveal ? 'Đã gợi ý' : 'Gợi ý'}</span>
            {!xpDisabled && !reveal && hintShareXp > 0 ? (
              <span className="dp-play-hint-xp">−{hintShareXp}</span>
            ) : null}
          </button>
        ) : null}
        <div className={`flex items-start gap-3.5 border-b border-slate-100 pb-5 sm:gap-5 sm:pb-6 ${!result && !isVideoQuestion ? 'pr-20 sm:pr-24' : ''}`}>
          <div className="dp-play-mascot-wrap">
            <Mascot
              mood={isVideoQuestion ? (videoCompleted ? 'correct' : 'learning') : (result ? (result.correct ? 'correct' : 'incorrect') : busy ? 'loading' : reveal ? 'idea' : 'learning')}
              size={PLAY_QUESTION_CHROME.mascotSize.web}
              className="shrink-0"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="dp-play-meta-row">
              <span className="dp-play-eyebrow">{PLAY_QUESTION_CHROME.label}</span>
              <span className="dp-play-meta-sep" aria-hidden="true">·</span>
              <span className="dp-play-type-chip">{meta.label}</span>
            </div>
            <p className="dp-play-prompt">{question.prompt}</p>
          </div>
        </div>

        {isVideoQuestion ? (
          <div className="mt-4 space-y-3.5">
            <div className="w-full">
              <PathVideoModal
                key={`${session.id}:${question.id}`}
                unit={{ id: session.path?.unitId || session.unitId, topicId: session.topic?.id }}
                videos={question.video ? [{ ...question.video, source: 'step' }] : []}
                initialVideoId={question.video?.id || ''}
                singleVideoOnly
                embedded
                hideStudyTools
                frameless
                review={xpDisabled}
                onWatched={async (videoId, metaInfo) => {
                  const targetUnitId = session.path?.unitId || session.unitId;
                  if (targetUnitId && videoId && !metaInfo?.initialSync) {
                    await dailyPracticeApi.student.videoWatched(targetUnitId, videoId);
                  }
                  setVideoDoneIds((prev) => ({ ...prev, [question.id]: true }));
                  if (metaInfo?.completedJustNow) {
                    setHintChargedXp(0);
                    gameSounds.correct();
                    setError('');
                  }
                }}
              />
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 sm:px-4 ${videoCompleted
              ? 'border-emerald-200 bg-emerald-50/75'
              : 'border-slate-200 bg-slate-50/80'
              }`}>
              <div className="min-w-0 flex-1">
                {videoCompleted ? (
                  <p className="dp-play-video-status-text font-semibold text-emerald-800">
                    {question.watched
                      ? 'Video này bạn đã hoàn thành trước đó — đáp án đã được ghi nhớ ở trên, bạn có thể bấm tiếp tục ngay.'
                      : 'Đã xem video và trả lời đúng hết câu hỏi tương tác — bạn có thể chuyển sang câu tiếp theo.'}
                  </p>
                ) : (
                  <p className="dp-play-video-status-text font-medium text-slate-600">
                    Xem video và trả lời đúng tất cả mốc trắc nghiệm trong video để mở khóa câu tiếp theo.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!videoCompleted || busy}
                onClick={() => {
                  if (!videoCompleted || busy) return;
                  gameSounds.tap();
                  next();
                }}
                className={`dp-play-video-next-btn flex w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-4 py-2 font-black transition ${videoCompleted && !busy
                  ? 'border-b-4 border-[#047857] bg-[#10B981] text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] hover:bg-[#059669] active:translate-y-[2px] active:border-b-2 cursor-pointer'
                  : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed !shadow-none'
                  }`}
              >
                {videoCompleted ? <ChevronRight size={17} /> : <Lock size={15} />}
                {videoCompleted
                  ? (index + 1 >= total ? 'Hoàn thành' : 'Tiếp tục')
                  : 'Hoàn thành video để tiếp tục'}
              </button>
            </div>
          </div>
        ) : (
          <>

            {question.imageUrl && (
              <img src={question.imageUrl} alt="" className="mt-5 max-h-60 w-full rounded-2xl bg-slate-50 object-contain p-2 ring-1 ring-slate-200/70" />
            )}

            {hintText ? (
              <div className="mt-5 space-y-1.5">
                <p className="dp-play-hint-reveal !mt-0">
                  <Lightbulb size={PLAY_QUESTION_CHROME.icon.hintSize} strokeWidth={PLAY_QUESTION_CHROME.icon.strokeWidth} className="mt-0.5 shrink-0 text-slate-500" />
                  <span>{hintText}</span>
                </p>
                {hintChargedXp > 0 ? (
                  <p className="dp-play-hint-charge">Đã trừ <strong>−{hintChargedXp} XP</strong> từ ví của bạn.</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6" key={question.id}>
              {question.type === 'mcq' && (
                <McqQuestion
                  {...props}
                  chosen={chosen}
                  onSubmit={submit}
                />
              )}
              {question.type === 'truefalse' && (
                <TrueFalseQuestion
                  {...props}
                  chosen={chosen}
                  onSubmit={submit}
                />
              )}
              {question.type === 'order' && <OrderQuestion {...props} />}
              {question.type === 'match' && <MatchQuestion {...props} />}
              {question.type === 'fill' && <FillQuestion {...props} />}
              {question.type === 'sort' && <SortQuestion {...props} />}
            </div>
            {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

            {result && (
              <AnswerFeedback
                question={question}
                result={result}
                feedbackTitle={feedbackTitle}
                confirmedXp={confirmedQuestionXp}
                rewardKey={`${session.id}:${question.id}`}
                isLastQuestion={index + 1 >= total}
                busy={busy}
                onNext={next}
                xpDisabled={xpDisabled}
                explainOpen={explainOpen}
                onExplainOpenChange={setExplainOpen}
              />
            )}

            {!result && (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-5">
                {!immediate ? (
                  <button type="button" onClick={() => submit(pending)} disabled={!pending || busy} className="cms-btn cms-btn-primary min-w-[160px] !py-3">
                    {busy ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                    {' '}
                    Kiểm tra
                  </button>
                ) : (
                  <p className="text-xs font-semibold text-slate-400">Chọn một đáp án phía trên để trả lời</p>
                )}
              </div>
            )}

            <p className="mt-4 hidden items-center justify-center gap-2 text-[11px] font-medium text-slate-400 sm:flex">
              <span>Phím tắt:</span>
              {result ? (
                <span>
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Enter</kbd>
                  {' hoặc '}
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">→</kbd>
                  {' sang câu tiếp'}
                </span>
              ) : (
                <span>
                  {question.type === 'mcq' || question.type === 'truefalse' ? '1–4 / A–D chọn đáp án · ' : ''}
                  {!reveal ? 'H gợi ý · ' : ''}
                  {!immediate ? 'Enter kiểm tra' : 'Chọn đáp án ở trên'}
                </span>
              )}
            </p>
          </>
        )}
      </section>

      {quitOpen && (
        <QuitConfirm
          answered={index + (result ? 1 : 0)}
          total={total}
          stakeXp={stakeXp}
          quitLossXp={quitLossXp}
          mandatory={mandatory}
          quitting={quitting}
          mode={quitMode}
          onStay={() => setQuitOpen(false)}
          onQuit={confirmQuit}
        />
      )}

      {buyXpOpen && (
        <BuyXpModal
          packs={stats?.xpPacks || session.xpPacks || []}
          onClose={() => setBuyXpOpen(false)}
          onPaid={(status) => {
            if (typeof status?.profileXp === 'number') setProfileXp(status.profileXp);
          }}
        />
      )}

      {comboCelebration ? (
        <ComboCelebrationOverlay
          combo={comboCelebration}
          onDone={() => setComboCelebration(null)}
        />
      ) : null}
    </div>
  );
}

// ── Màn kết quả ──────────────────────────────────────────────────────────────
function RelatedLessonCard({ lesson }) {
  const navigate = useNavigate();
  const _isFree = (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student')) || isFreePortalAccount();
  return (
    <section className="dp-slide-up flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center bg-gradient-to-r from-emerald-50 to-teal-50 ring-1 ring-emerald-100">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm bg-emerald-600">
        <PlayCircle size={26} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-emerald-700">
          {lesson.completed ? 'Ôn lại video liên quan' : 'Học tiếp video liên quan'} · {lesson.subjectName}
        </p>
        <p className="truncate text-sm font-black text-slate-900">{lesson.unitTitle}</p>
        {lesson.itemTitle && <p className="truncate text-xs text-slate-500">{lesson.itemTitle}</p>}
      </div>
      <button
        type="button"
        onClick={() => navigate(lessonResumeUrl(lesson))}
        className="cms-btn !bg-emerald-600 hover:!bg-emerald-700 !border-b-[#059669] shrink-0 !py-2.5 text-white"
      >
        <PlayCircle size={17} aria-hidden="true" /> Xem video liên quan
      </button>
    </section>
  );
}

function FireworkBurst() {
  const sparks = useMemo(() => {
    const colors = ['#F97316', '#FBBF24', '#EF4444', '#22C55E', '#38BDF8', '#F472B6'];
    const bursts = [
      { ox: '50%', oy: '34%' },
      { ox: '28%', oy: '42%' },
      { ox: '74%', oy: '40%' },
    ];
    return bursts.flatMap((burst, burstIndex) => Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2;
      const distance = 70 + (i % 4) * 18;
      return {
        dx: `${Math.round(Math.cos(angle) * distance)}px`,
        dy: `${Math.round(Math.sin(angle) * distance)}px`,
        color: colors[(i + burstIndex) % colors.length],
        delay: `${burstIndex * 140}ms`,
        ox: burst.ox,
        oy: burst.oy,
      };
    }));
  }, []);
  return sparks.map((spark, index) => (
    <span
      key={index}
      className="dp-firework"
      style={{
        background: spark.color,
        color: spark.color,
        '--dx': spark.dx,
        '--dy': spark.dy,
        '--ox': spark.ox,
        '--oy': spark.oy,
        animationDelay: spark.delay,
      }}
      aria-hidden="true"
    />
  ));
}

/** Xác nhận cược XP - lần đầu bấm Làm / Bắt đầu hoặc Làm lại sau kết quả. */
function StakeSessionConfirm({
  variant = 'rematch',
  stakeXp,
  xpTotal,
  starting,
  testOut = false,
  testOutLocked = false,
  review = false,
  onStay,
  onGo,
  onOpenMeet,
}) {
  const isStart = variant === 'start';
  const notEnoughXp = typeof xpTotal === 'number' && xpTotal < stakeXp;
  const isBlockedFreeTestOut = testOut && testOutLocked;
  const canAutoStart = !isBlockedFreeTestOut && !notEnoughXp;
  const COUNTDOWN_MS = 3000;
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS);
  const onGoRef = useRef(onGo);
  onGoRef.current = onGo;
  const triggeredRef = useRef(false);
  const titleId = isStart ? 'dp-stake-start-title' : 'dp-rematch-title';
  useEffect(() => { gameSounds.pick(); }, []);
  useEffect(() => {
    if (!canAutoStart || starting) return undefined;
    triggeredRef.current = false;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(0, COUNTDOWN_MS - elapsed);
      setRemainingMs(left);
      if (left <= 0 && !triggeredRef.current) {
        triggeredRef.current = true;
        window.clearInterval(timer);
        gameSounds.win();
        onGoRef.current?.();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [canAutoStart, starting]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !starting) onStay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay, starting]);

  let title = 'Bắt đầu lượt luyện?';
  let body = '';
  if (isBlockedFreeTestOut) {
    title = 'Đặc quyền học viên gói Meet';
    body = 'Kiểm tra vượt chặng là tính năng chỉ dành riêng cho học viên đã mua khóa / gói Google Meet. Vui lòng nâng cấp gói để mở khóa đặc quyền này và nhận thêm XP theo gói!';
  } else if (review || stakeXp === 0) {
    title = 'Chuẩn bị ôn lại';
    body = 'Ôn lại bài đã qua hoàn toàn miễn phí, không trừ XP.';
  } else if (notEnoughXp) {
    title = 'Không đủ XP để làm bài';
    body = `Bài tập này yêu cầu ${stakeXp} XP (cần ≥ ${stakeXp} XP để bắt đầu). Hiện bạn chỉ có ${xpTotal} XP trong ví. Vui lòng nâng cấp gói Meet hoặc mua thêm XP để tiếp tục!`;
  } else if (isStart) {
    title = testOut ? 'Cược để vượt chặng?' : 'Chuẩn bị vào luyện tập';
    body = testOut
      ? `Đặt ${stakeXp} XP. Đạt đủ điểm thì vượt chặng và nhận lại XP. Không đạt hoặc thoát giữa chừng thì mất trắng.`
      : `Mỗi câu ${QUESTION_STAKE_XP} XP: sai trừ ngay, đạt % yêu cầu sẽ nhận +${QUESTION_STAKE_XP} XP/câu đúng.`;
  } else {
    title = 'Làm lại lượt luyện tập?';
    body = `Mỗi câu ${QUESTION_STAKE_XP} XP: sai trừ ngay, đạt % yêu cầu sẽ nhận +${QUESTION_STAKE_XP} XP/câu đúng.`;
  }

  const pct = Math.max(0, Math.min(100, (remainingMs / COUNTDOWN_MS) * 100));
  const secLeft = Math.max(1, Math.ceil(remainingMs / 1000));
  const showXpPill = !(review || stakeXp === 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center overflow-hidden bg-slate-950/60 p-4 backdrop-blur-[3px]"
      role="presentation"
      onPointerDown={(event) => { if (event.target === event.currentTarget && !starting) onStay(); }}
    >
      <div className="cms-goal-in relative w-full max-w-[380px] overflow-hidden rounded-[28px] border border-emerald-100 bg-white text-center shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="relative bg-gradient-to-b from-emerald-50/90 via-white to-white px-6 pb-4 pt-6">
          <span className="dp-twinkle absolute left-7 top-7 text-base text-emerald-500" aria-hidden="true">✦</span>
          <span className="dp-flame absolute right-7 top-6 text-amber-500" aria-hidden="true"><Flame size={20} className="fill-amber-400" /></span>
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-emerald-100">
            <Mascot mood={isBlockedFreeTestOut || notEnoughXp ? 'thinking' : 'determined'} size={104} className="relative" />
          </div>
          <h2 id={titleId} className="mt-3 text-xl font-black tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{body}</p>
          {showXpPill && (
            <div className="mt-3 inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold text-amber-800 ring-1 ring-amber-200/80">
              <Zap size={13} className="shrink-0 fill-amber-400 text-amber-500" aria-hidden="true" />
              <span>{testOut ? `Cược ${stakeXp} XP` : `${QUESTION_STAKE_XP} XP/câu · tối đa ${stakeXp} XP`}</span>
              {typeof xpTotal === 'number' && <span className="text-amber-600">· đang có {xpTotal}</span>}
            </div>
          )}
        </div>

        {canAutoStart && (
          <div className="mx-5 mb-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-left">
            <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
              <span className="flex items-center gap-1.5 text-emerald-800">
                {starting || remainingMs <= 0 ? <Loader2 size={13} className="animate-spin text-emerald-600" /> : <Play size={12} className="fill-emerald-600 text-emerald-600" />}
                {starting || remainingMs <= 0 ? 'Đang vào bài luyện…' : 'Tự động vào luyện sau'}
              </span>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black tabular-nums text-white">
                {remainingMs <= 0 ? '0s' : `${secLeft}s`}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-75 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className={`px-5 pb-5 pt-2 ${isBlockedFreeTestOut || notEnoughXp ? 'grid grid-cols-2 gap-2.5' : ''}`}>
          <button
            type="button"
            onClick={onStay}
            disabled={starting}
            className="cms-btn cms-btn-outline w-full !rounded-2xl !py-3 text-sm font-extrabold"
          >
            Để sau
          </button>
          {(isBlockedFreeTestOut || notEnoughXp) && (
            <button
              type="button"
              onClick={() => {
                onStay();
                onOpenMeet?.();
              }}
              className="cms-btn cms-btn-primary w-full !rounded-2xl !py-3 text-sm font-extrabold"
            >
              <Crown size={16} className="text-amber-300" />
              Nâng cấp gói
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function clientStakeMeta(pick) {
  if (pick?.mode !== 'path') return null;
  if (pick.review) return { stakeXp: 0, recovery: false, testOut: false, review: true };
  if (pick.testOut) return { stakeXp: TEST_OUT_XP, recovery: false, testOut: true };
  // Luôn yêu cầu đủ SESSION_STAKE_XP (50 XP), không có recovery 0đ
  return { stakeXp: SESSION_STAKE_XP, recovery: false, testOut: false };
}

function ResultScreen({ summary, liveXpTotal, onReplay, onHome, onNextStep, onOpenBuyXp, starting }) {
  const [rematchOpen, setRematchOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const pathResult = summary.path;
  const message = resultMessage(summary.stars);
  const good = summary.stars >= 2;
  const xpDisplay = practiceFinishXpDisplay(summary);
  const rematchStakeXp = summary.xpDisabled ? 0 : (
    summary.path?.testOut ? TEST_OUT_XP
      : (summary.recovery ? 0 : ((summary.total || 10) * QUESTION_STAKE_XP))
  );
  const currentXpTotal = typeof liveXpTotal === 'number' ? liveXpTotal : summary.stats?.xpTotal;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className={`relative overflow-hidden rounded-[28px] p-6 text-center ring-1 ${good ? 'bg-gradient-to-b from-amber-50 via-white to-white ring-amber-100' : 'bg-gradient-to-b from-sky-50 via-white to-white ring-sky-100'}`}>
        {good && <Confetti count={36} spread={220} />}
        <Mascot mood={good ? 'graduate' : 'sad'} size={120} className="mx-auto" />
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
            <p className={`text-2xl font-black tabular-nums ${!xpDisplay.positive ? 'text-red-600' : 'text-amber-600'}`}>
              {xpDisplay.prefix}{xpDisplay.amount}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">{xpDisplay.caption}</p>
          </div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
            <p className="flex items-center justify-center gap-1 text-2xl font-black text-orange-600 tabular-nums">
              <Flame size={22} className={summary.streakIncreased ? 'dp-pop fill-orange-400' : 'fill-orange-300'} /> {summary.stats.streak}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">{summary.streakIncreased ? 'chuỗi ngày tăng!' : 'ngày liên tiếp'}</p>
          </div>
        </div>
      </section>

      {pathResult && <PathResultCard result={pathResult} />}
      {summary.relatedLesson && <RelatedLessonCard lesson={summary.relatedLesson} />}

      {summary.review.length > 0 && (
        <section className="rounded-[24px] bg-white ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setReviewOpen((open) => !open)}
            aria-expanded={reviewOpen}
            className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
          >
            <Sparkles size={16} className="text-amber-500" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-black text-slate-800">
              Xem lại câu chưa đúng
              <span className="ml-1.5 text-xs font-bold text-slate-400">{summary.review.length}</span>
            </span>
            <ChevronDown size={18} className={`text-slate-400 transition-transform ${reviewOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {reviewOpen && (
            <ul className="space-y-2.5 px-4 pb-4">
              {summary.review.map((item) => {
                const answerText = String(item.correctAnswer?.text || '').trim();
                const followUp = reviewItemFollowUpLine(item);
                return (
                  <li key={item.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-bold text-slate-800">{item.prompt}</p>
                    {answerText ? (
                      <p className="mt-1 text-sm font-semibold leading-snug text-emerald-700">✓ {answerText}</p>
                    ) : followUp ? (
                      <p className="mt-1 text-sm font-medium leading-snug text-slate-600">{followUp}</p>
                    ) : null}
                    {answerText && followUp ? (
                      <p className="mt-1 text-xs leading-snug text-slate-500">{followUp}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <button type="button" onClick={onHome} className="cms-btn cms-btn-outline !py-3">
          <ArrowLeft size={17} /> {pathResult ? 'Về lộ trình' : 'Chủ đề khác'}
        </button>
        <ShareTriggerButton
          onClick={() => setShareOpen(true)}
          label="SHARE THÀNH TÍCH"
          className="col-span-2 sm:col-span-1 !rounded-xl !px-4 !py-3 order-first sm:order-none"
        />
        {pathResult?.passed && pathResult.next ? (
          <button type="button" disabled={starting} onClick={() => onNextStep(pathResult.next)} className="cms-btn cms-btn-primary !py-3">
            {starting ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />} Tiếp: {pathResult.next.stepLabel}
          </button>
        ) : (
          <button
            type="button"
            disabled={starting}
            onClick={() => {
              if (pathResult && !pathResult.passed) {
                if (typeof currentXpTotal === 'number' && currentXpTotal < rematchStakeXp) {
                  onOpenBuyXp?.();
                } else {
                  setRematchOpen(true);
                }
              } else {
                onReplay();
              }
            }}
            className="cms-btn cms-btn-primary !py-3"
          >
            {starting ? <Loader2 size={17} className="animate-spin" /> : <RotateCcw size={17} />}
            {pathResult && !pathResult.passed ? 'Làm lại' : 'Chơi lại'}
          </button>
        )}
      </div>
      <ShareAchievementModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        data={buildPracticeShareData(summary)}
      />
      {rematchOpen && (
        <StakeSessionConfirm
          stakeXp={rematchStakeXp}
          xpTotal={currentXpTotal}
          starting={starting}
          onStay={() => setRematchOpen(false)}
          onOpenMeet={() => {
            setRematchOpen(false);
            onOpenBuyXp?.();
          }}
          onGo={onReplay}
        />
      )}
    </div>
  );
}

/** Luyện tập hằng ngày kiểu trò chơi: chọn chủ đề + độ khó → 10 câu → kết quả. */
export default function DailyPracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedTopicId = searchParams.get('topicId') || '';
  const watchStage = searchParams.get('watch') === 'stage';
  const practiceStage = searchParams.get('practice') === 'stage';
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [finishRematchOpen, setFinishRematchOpen] = useState(false);
  const [lastPick, setLastPick] = useState(null);
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('watch') === 'stage' || params.get('practice') === 'stage') return 'path';
    try { return localStorage.getItem(MODE_STORAGE_KEY) === 'free' ? 'free' : 'path'; } catch { return 'path'; }
  });
  const [path, setPath] = useState(null);
  const [pathLoading, setPathLoading] = useState(true);
  const [pathError, setPathError] = useState('');
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [meetOfferOpen, setMeetOfferOpen] = useState(false);
  const [meetNotice, setMeetNotice] = useState('');
  const [requestedLesson, setRequestedLesson] = useState(null);
  const [welcomeTarget, setWelcomeTarget] = useState(null);
  const [stakeConfirm, setStakeConfirm] = useState(null);
  const [reloadNotice, setReloadNotice] = useState(null);
  const [reloadNoticeOpen, setReloadNoticeOpen] = useState(false);

  useEffect(() => {
    const notice = readReloadAbandonNotice();
    if (!notice) return;
    setReloadNotice(notice);
    setReloadNoticeOpen(true);
  }, []);
  const practiceLockRef = useRef(false);

  useEffect(() => {
    if (!isFreePortalAccount() || session) return undefined;
    let cancelled = false;
    let timer = null;
    const studentId = (() => {
      try {
        const user = JSON.parse(localStorage.getItem('student_user') || '{}');
        return user.id || user._id || 'student';
      } catch {
        return 'student';
      }
    })();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    subscriptionApi.student.overview()
      .then((data) => {
        if (cancelled) return;
        const sub = data?.subscription;
        if (sub?.meetLifetime || sub?.state === 'active') return;
        let storageKey = `cms_meet_offer:${studentId}:${today}`;
        let notice = '';
        if (sub?.state === 'expiring') {
          const days = Math.max(1, Number(sub.daysLeft) || 1);
          const milestone = days <= 1 ? 1 : 7;
          storageKey = `cms_meet_remind:${studentId}:${sub.expiresAt}:${milestone}`;
          notice = `Gói của bạn còn ${days <= 1 ? 1 : days} ngày nữa là hết`;
        }
        try {
          if (localStorage.getItem(storageKey) === '1') return;
        } catch { /* vẫn cho hiện */ }
        const scheduleMeetOffer = (delayMs) => {
          timer = window.setTimeout(() => {
            if (cancelled) return;
            // Avoid stacking the onboarding Meet modal over another active dialog (goal/placement/survey).
            if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"]')) {
              scheduleMeetOffer(2500);
              return;
            }
            try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
            setMeetNotice(notice);
            setMeetOfferOpen(true);
          }, delayMs);
        };
        scheduleMeetOffer(5000);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [session]);

  useEffect(() => {
    if (Number(overview?.stats?.dailyAllowanceXp) === 300) {
      window.dispatchEvent(new CustomEvent('free-portal-unlocked'));
    }
  }, [overview]);

  const loadOverview = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    dailyPracticeApi.student.overview()
      .then((data) => { setOverview(data); setError(''); })
      .catch((err) => { if (!silent) setError(err.message || 'Không tải được luyện tập hằng ngày'); })
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  const applyStats = useCallback((statsPatch) => {
    if (!statsPatch) return;
    setOverview((prev) => {
      if (!prev) return prev;
      const stats = { ...prev.stats, ...statsPatch };
      if (typeof stats.xpTotal === 'number') {
        stats.xpEmpty = stats.xpTotal < SESSION_STAKE_XP;
        if (stats.xpTotal >= SESSION_STAKE_XP) stats.xpRefillsTomorrow = false;
      }
      return { ...prev, stats };
    });
  }, []);

  const loadPath = useCallback((silent = false) => {
    if (!silent) setPathLoading(true);
    dailyPracticeApi.student.path()
      .then((data) => { setPath(data); setPathError(''); })
      .catch((err) => { if (!silent) setPathError(err.message || 'Không tải được lộ trình luyện tập'); })
      .finally(() => { if (!silent) setPathLoading(false); });
  }, []);

  const refreshPathAndOverview = useCallback(() => {
    loadPath();
    loadOverview(true);
  }, [loadPath, loadOverview]);

  useEffect(() => { loadOverview(); loadPath(); }, [loadOverview, loadPath]);

  useEffect(() => {
    const onStatsChanged = (event) => {
      if (event?.detail) applyStats(event.detail);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadOverview(true);
        loadPath(true);
      }
    };
    const onFocus = () => {
      loadOverview(true);
      loadPath(true);
    };
    const onSubOrUnlock = () => {
      loadOverview(true);
      loadPath(true);
    };
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onStatsChanged);
    window.addEventListener('free-portal-unlocked', onSubOrUnlock);
    window.addEventListener('free-portal-locked', onSubOrUnlock);
    window.addEventListener('cms:subscription-updated', onSubOrUnlock);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStatsChanged);
      window.removeEventListener('free-portal-unlocked', onSubOrUnlock);
      window.removeEventListener('free-portal-locked', onSubOrUnlock);
      window.removeEventListener('cms:subscription-updated', onSubOrUnlock);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [applyStats, loadOverview, loadPath]);

  const changeMode = (next) => {
    setMode(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* ignore */ }
  };

  const begin = async (pick) => {
    setStarting(true);
    setError('');
    setPathError('');
    try {
      const data = pick.mode === 'path'
        ? await dailyPracticeApi.student.startPath(pick.unitId, pick.step, pick.testOut, pick.nodeKey || '')
        : pick.mode === 'spaced'
          ? await dailyPracticeApi.student.startSpacedReview()
          : await dailyPracticeApi.student.start(pick.topicId, pick.difficulty);
      setLastPick(pick);
      setSummary(null);
      setSession({
        ...data,
        questions: data.preserveOrder ? (data.questions || []) : shuffleList(data.questions),
      });
      if (typeof data.profileXp === 'number') applyStats({ xpTotal: data.profileXp });
      loadOverview(true);
    } catch (err) {
      const message = err.message || 'Không bắt đầu được lượt chơi';
      if (err.status === 402 || /hết xp|không đủ xp/i.test(message)) {
        loadOverview(true);
        setBuyXpOpen(true);
      }
      if (pick.mode === 'path') {
        if (err.status !== 402) setPathError(message);
        setSummary(null);
        loadPath();
      } else if (err.status !== 402) {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  };
  function isPathPickCompleted(path, pick) {
    if (!pick || pick.mode !== 'path' || pick.testOut) return false;
    for (const t of path?.topics || []) {
      const unit = (t?.units || []).find((u) => String(u.id) === String(pick.unitId));
      if (!unit) continue;
      const node = pick.nodeKey
        ? (unit.pathNodes || []).find((n) => String(n.key) === String(pick.nodeKey))
        : null;
      if (node) {
        if (pick.step) {
          const lvl = (node.levels || []).find((l) => String(l.key) === String(pick.step));
          if (lvl) return lvl.state === 'completed';
        }
        if (node.state === 'completed') return true;
      }
      const step = pick.step
        ? (unit.steps || []).find((s) => String(s.key) === String(pick.step))
        : null;
      if (step?.state === 'completed') return true;
    }
    return false;
  }

  const queueBegin = (pick) => {
    const resolvedPick = pick?.mode === 'path' && !pick.testOut
      ? { ...pick, review: Boolean(pick.review || isPathPickCompleted(path, pick)) }
      : pick;
    const meta = clientStakeMeta(resolvedPick, overview?.stats);
    if (!meta) {
      begin(resolvedPick);
      return;
    }
    const xpTotal = overview?.stats?.xpTotal;
    const isBlockedFreeTestOut = meta.testOut && path?.canTestOut !== true;
    if (!isBlockedFreeTestOut && typeof xpTotal === 'number' && xpTotal < meta.stakeXp) {
      setBuyXpOpen(true);
      return;
    }
    setStakeConfirm({
      pick: resolvedPick,
      ...meta,
      xpTotal,
    });
  };
  const start = (topicId, difficulty) => begin({ mode: 'free', topicId, difficulty });
  const startSpacedReview = () => begin({ mode: 'spaced' });
  const startStep = (unitId, nodeKey, step, testOut = false, opts = {}) => queueBegin({
    mode: 'path', unitId, nodeKey, step, testOut, review: opts.review === true,
  });

  const clearPracticeParam = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!next.has('practice')) return prev;
      next.delete('practice');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if ((watchStage || practiceStage) && mode !== 'path') setMode('path');
  }, [watchStage, practiceStage, mode]);

  useEffect(() => {
    if (!practiceStage || session || summary || pathLoading || !path) return undefined;
    if (practiceLockRef.current) return undefined;
    const preferredTopic = pickActivePathTopic(path, linkedTopicId);
    const topic = (preferredTopic && continuePracticeTarget(preferredTopic))
      ? preferredTopic
      : (path.topics || []).find((item) => continuePracticeTarget(item));
    const target = topic ? continuePracticeTarget(topic) : null;
    practiceLockRef.current = true;
    if (!target) {
      clearPracticeParam();
      practiceLockRef.current = false;
      return undefined;
    }
    clearPracticeParam();
    if (takeWelcomeBackTurn()) {
      setWelcomeTarget(target);
      return undefined;
    }
    if (target.kind === 'lesson' && target.level) {
      setRequestedLesson(target);
      practiceLockRef.current = false;
      return undefined;
    }
    Promise.resolve(queueBegin({ mode: 'path', unitId: target.unit.id, nodeKey: target.nodeKey, step: target.step, testOut: false })).finally(() => {
      practiceLockRef.current = false;
    });
    return undefined;
  }, [practiceStage, session, summary, pathLoading, path, linkedTopicId, clearPracticeParam]);

  const enterWelcome = () => {
    const target = welcomeTarget;
    if (!target) return;
    setWelcomeTarget(null);
    if (target.kind === 'lesson' && target.level) {
      setRequestedLesson(target);
      practiceLockRef.current = false;
      return;
    }
    practiceLockRef.current = true;
    Promise.resolve(queueBegin({ mode: 'path', unitId: target.unit.id, nodeKey: target.nodeKey, step: target.step, testOut: false })).finally(() => {
      practiceLockRef.current = false;
    });
  };
  const goHome = () => {
    setSummary(null);
    setPathError('');
    loadOverview();
    loadPath();
  };

  const finished = (data) => {
    setSession(null);
    setSummary(data);
    setCelebrating(true);
    applyStats(data.stats);
    loadOverview(true);
    loadPath(true);
    window.dispatchEvent(new CustomEvent(LEARNING_GOAL_CHANGED_EVENT));
  };

  const navigate = useNavigate();

  const resumeMilestoneAfterPractice = (preferNext, activeSession = null) => {
    const pathPick = lastPick?.mode === 'path' ? lastPick : null;
    const unitId = summary?.path?.unitId || activeSession?.path?.unitId || pathPick?.unitId || '';
    const nodeKey = summary?.path?.pathNodeKey || activeSession?.path?.pathNodeKey || pathPick?.nodeKey || 'study';
    const step = summary?.path?.step || activeSession?.path?.step || pathPick?.step || 'learn';
    const isTestOut = Boolean(summary?.path?.testOut ?? activeSession?.path?.testOut ?? pathPick?.testOut);
    const topicsList = path?.topics || [];

    if (!isTestOut && unitId) {
      const matchedTopic = topicsList.find((t) => (t.units || []).some((u) => u.id === unitId));
      const matchedUnit = matchedTopic?.units?.find((u) => u.id === unitId);
      const matchedNode = matchedUnit?.pathNodes?.find((n) => n.key === nodeKey);
      const currDiff = step === 'challenge' ? 'hard' : step === 'practice' ? 'medium' : 'easy';
      const resumeTopicId = matchedTopic?.topic?.id;

      if (matchedNode && (matchedNode.kind === 'study' || matchedNode.icon === 'book')) {
        setCelebrating(false);
        setSummary(null);
        setPathError('');
        loadOverview(true);
        loadPath(true);

        if (preferNext && (summary?.path?.passed || summary?.xpDisabled)) {
          const doneSet = new Set(matchedUnit?.completedSections || []);
          doneSet.add(`${matchedNode.key}:${currDiff}:practice`);
          const levelCfg = matchedNode.levelConfigs?.[currDiff];
          const hiddenCurr = new Set(levelCfg?.hiddenSections || []);
          const secOrder = (Array.isArray(levelCfg?.sectionOrder) && levelCfg.sectionOrder.length
            ? levelCfg.sectionOrder
            : ['content', 'file', 'video', 'practice'])
            .filter((k) => !hiddenCurr.has(k) && levelCfg?.sectionLocks?.[k] !== 'locked');
          const pIdx = secOrder.indexOf('practice');
          const nextInCurrDiff = pIdx >= 0
            ? secOrder.slice(pIdx + 1).find((k) => !doneSet.has(`${matchedNode.key}:${currDiff}:${k}`))
            : null;

          if (nextInCurrDiff) {
            setRequestedLesson({
              unit: matchedUnit,
              nodeKey,
              topicId: resumeTopicId,
              openMilestone: true,
              initialDifficulty: currDiff,
              initialSection: nextInCurrDiff,
            });
            return;
          }

          const isNodeDiffDone = (diff) => {
            const c = matchedNode.levelConfigs?.[diff];
            if (!c) return diff !== 'easy';
            const hidden = new Set(c.hiddenSections || []);
            const secs = (Array.isArray(c.sectionOrder) && c.sectionOrder.length
              ? c.sectionOrder
              : ['content', 'file', 'video', 'practice'])
              .filter((k) => !hidden.has(k) && c.sectionLocks?.[k] !== 'locked');
            return !secs.length || secs.every((k) => doneSet.has(`${matchedNode.key}:${diff}:${k}`));
          };

          const allNodeDone = isNodeDiffDone('easy') && isNodeDiffDone('medium') && isNodeDiffDone('hard');
          const nextStep = summary?.path?.next;
          if (allNodeDone && nextStep && (nextStep.unitId !== unitId || nextStep.nodeKey !== nodeKey)) {
            const nextTopic = topicsList.find((t) => (t.units || []).some((u) => u.id === nextStep.unitId));
            const nextUnit = nextTopic?.units?.find((u) => u.id === nextStep.unitId);
            const nextNode = nextUnit?.pathNodes?.find((n) => n.key === nextStep.nodeKey);
            if (nextUnit && nextNode && (nextNode.kind === 'study' || nextNode.icon === 'book')) {
              setRequestedLesson({
                unit: nextUnit,
                nodeKey: nextStep.nodeKey,
                topicId: nextTopic?.topic?.id || resumeTopicId,
                openMilestone: true,
              });
              return;
            }
            startStep(nextStep.unitId, nextStep.nodeKey || 'study', nextStep.step);
            return;
          }

          setRequestedLesson({
            unit: matchedUnit,
            nodeKey,
            topicId: resumeTopicId,
            openMilestone: true,
          });
          return;
        }

        setRequestedLesson({
          unit: matchedUnit,
          nodeKey,
          topicId: resumeTopicId,
          openMilestone: true,
          initialDifficulty: currDiff,
        });
        return;
      }
    }

    if (preferNext && summary?.path?.passed && summary.path.next) {
      setCelebrating(false);
      setSummary(null);
      startStep(summary.path.next.unitId, summary.path.next.nodeKey || 'study', summary.path.next.step);
      return;
    }

    setCelebrating(false);
    goHome();
  };

  const closeFinishPopup = () => {
    resumeMilestoneAfterPractice(false);
  };

  useEffect(() => {
    if (session || celebrating) return;
    const doneFirstNode = (path?.topics || []).some((t) => {
      const firstUnit = t?.units?.[0];
      const firstNode = firstUnit?.pathNodes?.[0];
      if (firstNode) return firstNode.state === 'completed';
      return firstUnit?.state === 'completed';
    });
    if (doneFirstNode) {
      window.dispatchEvent(new CustomEvent('cms:part-completed'));
    }
  }, [path, session, celebrating]);

  const finishRematchStakeXp = summary?.xpDisabled ? 0 : (
    summary?.path?.testOut ? TEST_OUT_XP
      : (summary?.recovery ? 0 : ((summary?.total || 10) * QUESTION_STAKE_XP))
  );

  const handleFinishContinue = () => {
    resumeMilestoneAfterPractice(true);
  };

  const handleFinishReplay = () => {
    const pathResult = summary?.path;
    const currentXpTotal = overview?.stats?.xpTotal;
    if (pathResult && !pathResult.passed) {
      if (typeof currentXpTotal === 'number' && currentXpTotal < finishRematchStakeXp) {
        setBuyXpOpen(true);
        return;
      }
      setFinishRematchOpen(true);
      return;
    }
    if (lastPick) {
      setCelebrating(false);
      setSummary(null);
      queueBegin(pathResult?.passed ? { ...lastPick, review: true } : lastPick);
    }
  };

  const handleFinishRelatedVideo = () => {
    if (summary?.relatedLesson) {
      navigate(lessonResumeUrl(summary.relatedLesson));
    }
  };

  return (
    <div className="dp-dew-page cms-sd-page min-h-full bg-slate-50/80 pb-10">
      {session ? (
        <PlayScreen
          session={session}
          stats={overview?.stats}
          onQuit={(info) => {
            const prevSession = session;
            setSession(null);
            if (info?.stats) applyStats(info.stats);
            else if (typeof info?.profileXp === 'number') applyStats({ xpTotal: info.profileXp });
            resumeMilestoneAfterPractice(false, prevSession);
          }}
          onFinished={finished}
        />
      ) : (
        <HomeScreen
          key={linkedTopicId}
          overview={overview}
          loading={loading}
          error={error}
          onStart={start}
          onStartSpacedReview={startSpacedReview}
          starting={starting}
          initialTopicId={linkedTopicId}
          mode={mode}
          onModeChange={changeMode}
          path={path}
          pathLoading={pathLoading}
          pathError={pathError}
          onStartStep={startStep}
          onPathChanged={refreshPathAndOverview}
          onBuyXpPaid={() => { loadOverview(); loadPath(); }}
          continueVideo={watchStage && mode === 'path'}
          requestedLesson={requestedLesson}
          onRequestedLessonOpened={() => setRequestedLesson(null)}
          onContinueVideoOpened={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('watch');
            setSearchParams(next, { replace: true });
          }}
        />
      )}
      {summary && celebrating ? (
        <PracticeFinishOverlay
          summary={summary}
          onDismiss={closeFinishPopup}
          onContinue={handleFinishContinue}
          onReplay={lastPick || (summary.path && !summary.path.passed) ? handleFinishReplay : undefined}
          onRelatedVideo={handleFinishRelatedVideo}
        />
      ) : null}
      {welcomeTarget && !session && (
        <WelcomeBackModal
          unitIndex={welcomeTarget.unit?.index}
          unitTitle={welcomeTarget.unit?.title}
          lessonLabel={welcomeTarget.level?.title || welcomeTarget.level?.label || ''}
          onEnter={enterWelcome}
        />
      )}
      {stakeConfirm && !session && (
        <StakeSessionConfirm
          variant="start"
          stakeXp={stakeConfirm.stakeXp}
          xpTotal={overview?.stats?.xpTotal ?? stakeConfirm.xpTotal}
          recovery={stakeConfirm.recovery}
          review={Boolean(stakeConfirm.pick?.review)}
          testOut={stakeConfirm.testOut}
          testOutLocked={stakeConfirm.testOut && path?.canTestOut !== true}
          starting={starting}
          onStay={() => setStakeConfirm(null)}
          onOpenMeet={() => {
            const lockedTestOut = stakeConfirm.testOut && path?.canTestOut !== true;
            setStakeConfirm(null);
            if (lockedTestOut) setMeetOfferOpen(true);
            else setBuyXpOpen(true);
          }}
          onGo={() => {
            const pick = stakeConfirm.pick;
            setStakeConfirm(null);
            begin(pick);
          }}
        />
      )}
      {buyXpOpen && (
        <BuyXpModal
          packs={overview?.stats?.xpPacks || []}
          onClose={() => setBuyXpOpen(false)}
          onPaid={() => {
            loadOverview();
            loadPath();
          }}
        />
      )}
      <FreeMeetPlanModal
        open={meetOfferOpen && !session}
        notice={meetNotice}
        onClose={() => setMeetOfferOpen(false)}
        onPaid={() => { loadOverview(); loadPath(); }}
      />
      {finishRematchOpen && summary ? (
        <StakeSessionConfirm
          stakeXp={finishRematchStakeXp}
          xpTotal={overview?.stats?.xpTotal}
          starting={starting}
          onStay={() => setFinishRematchOpen(false)}
          onOpenMeet={() => {
            setFinishRematchOpen(false);
            setBuyXpOpen(true);
          }}
          onGo={() => {
            setFinishRematchOpen(false);
            setCelebrating(false);
            setSummary(null);
            if (lastPick) queueBegin(lastPick);
          }}
        />
      ) : null}
      {reloadNoticeOpen && reloadNotice ? (
        <ReloadAbandonNoticeModal
          lostXp={reloadNotice.lostXp}
          onClose={() => {
            setReloadNoticeOpen(false);
            setReloadNotice(null);
          }}
        />
      ) : null}
    </div>
  );
}
