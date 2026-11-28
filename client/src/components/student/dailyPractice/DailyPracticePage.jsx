import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Brain, Check, ChevronDown, ChevronRight, Crown, Flame, Lightbulb, Loader2, Lock, Maximize2, Minimize2, Play, PlayCircle, Plus, RotateCcw, Route, Shuffle, Sparkles, Star, Target, Trophy, Zap,
} from 'lucide-react';
import { useActiveCourse } from '../../../context/ActiveCourseContext';
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
import LessonPracticeCatalogPage from '../lessonPractice/LessonPracticeCatalogPage';
import Mascot from './Mascot';
import PracticeTopBar from './PracticeTopBar';
import AnswerFeedback from './AnswerFeedback';
import { SoundToggleButton } from './GameButton';
import { pathTopicPrimaryCtaLabel } from '../../../../../shared/dailyPractice/lastPathTopic.mjs';
import { reviewItemFollowUpLine } from '../../../../../shared/dailyPractice/reviewDisplay.mjs';
import PathView, { PathResultCard, continuePracticeTarget, focusCurrentPathLesson, pickActivePathTopic, resolveUpgradeCourse } from './PathView';
import PathVideoModal from './PathVideoModal';
import PracticeFinishOverlay from './PracticeFinishOverlay';
import PracticeReadyModal from './PracticeReadyModal';
import ExitPracticeWarningModal from './ExitPracticeWarningModal';
import ShareAchievementModal, { ShareTriggerButton } from '../ShareAchievementModal';
import { buildPracticeShareData } from '../../../../../shared/dailyPractice/shareAchievement.mjs';
import ComboCelebrationOverlay from './ComboCelebrationOverlay';
import { shouldShowComboCelebration } from './quizFeedbackOrchestration';
import BuyXpModal from './BuyXpModal';
import DigitalCertificateModal from '../DigitalCertificateModal';
import PlacementTestModal, { readPlacementResult } from './PlacementTestModal';
import WelcomeBackModal, { takeWelcomeBackTurn } from './WelcomeBackModal';
import { isFreePortalAccount } from './FreeMeetPlanModal';
import useAIQuota, { dispatchOpenAiPackagesModal } from '../../../hooks/useAIQuota';
import CourseEnrollmentModal from '../courses/CourseEnrollmentModal';
import { dewClass } from '../../../utils/dewskillTheme';
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
  overview, loading: _loading, error: _error, onStart: _onStart, onStartSpacedReview, starting, initialTopicId = '',
  mode, onModeChange: _onModeChange, path, pathLoading, pathError, onStartStep, onPathChanged, onBuyXpPaid,
  continueVideo = false, onContinueVideoOpened, requestedLesson = null, onRequestedLessonOpened,
}) {
  const [topicId, setTopicId] = useState('');
  const [activePathTopicId, setActivePathTopicId] = useState(initialTopicId);
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const certStudent = useMemo(() => readStudentCertificateMeta(), []);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementResult, setPlacementResult] = useState(() => readPlacementResult(certStudent.studentId));
  const [centerSummary, setCenterSummary] = useState({
    activeSubjectName: '',
    totalSubjects: 0,
    completedUnits: 0,
    totalUnits: 0,
  });
  const [centerSearchParams] = useSearchParams();
  const centerLessonOpen = Boolean(centerSearchParams.get('lesson') || centerSearchParams.get('unitId'));
  const topics = useMemo(() => overview?.topics || [], [overview]);
  const stats = overview?.stats || {};
  const aiQuota = useAIQuota({ autoFetch: true });
  const showLowAiBanner = Boolean(aiQuota.applies && !aiQuota.isUnlimited && aiQuota.aiQuotaPercent <= 20);
  const xpPacks = stats.xpPacks || [];
  const openHomeXpOrUpgrade = () => {
    aiQuota.openPackagesModal();
  };
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

  const freePortal = isFreePortalAccount();
  const effectiveMode = freePortal ? 'path' : 'free';
  const { enrolledCourses, activeCourse, activeCourseId, setActiveCourseId, openAddCourse } = useActiveCourse();

  const scopedPathTopics = useMemo(() => {
    const allTopics = path?.topics || [];
    if (!freePortal || !activeCourse?.topicIds?.length || !allTopics.length) return allTopics;
    const topicSet = new Set(activeCourse.topicIds);
    const matched = allTopics.filter((t) => topicSet.has(String(t?.topic?.id || '')));
    return matched.length > 0 ? matched : allTopics;
  }, [freePortal, activeCourse?.topicIds, path?.topics]);

  const scopedPath = useMemo(
    () => (path ? { ...path, topics: scopedPathTopics } : path),
    [path, scopedPathTopics],
  );

  const scopedPathTopic = useMemo(() => {
    if (activePathTopicId) {
      const found = scopedPathTopics.find((item) => item.topic.id === activePathTopicId);
      if (found) return found;
    }
    return pickActivePathTopic(scopedPath, initialTopicId);
  }, [scopedPath, scopedPathTopics, activePathTopicId, initialTopicId]);

  const activeTopicForHome = freePortal ? scopedPathTopic : pathTopic;

  const lastCourseSyncRef = useRef('');
  useEffect(() => {
    if (!freePortal || !activeCourseId) return;
    if (lastCourseSyncRef.current === activeCourseId) return;
    lastCourseSyncRef.current = activeCourseId;
    if (scopedPathTopics.length > 0) {
      const existsInScope = scopedPathTopics.some((t) => t.topic.id === activePathTopicId);
      if (!existsInScope) {
        setActivePathTopicId(scopedPathTopics[0].topic.id);
        setTopicId(scopedPathTopics[0].topic.id);
      }
    }
  }, [freePortal, activeCourseId, scopedPathTopics, activePathTopicId]);

  const effectivePathContinue = activeTopicForHome?.next
    ? {
      unitId: activeTopicForHome.next.unitId,
      nodeKey: activeTopicForHome.next.nodeKey || 'study',
      step: activeTopicForHome.next.step,
    }
    : pathContinue;
  const effectiveTopicPathDone = Boolean(
    activeTopicForHome?.totalUnits && (activeTopicForHome.completedUnits || 0) >= activeTopicForHome.totalUnits,
  );

  const heroAction = () => {
    gameSounds.tap();
    if (effectiveMode === 'path') {
      if (effectivePathContinue) focusCurrentPathLesson();
      else document.getElementById('dp-path-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    document.getElementById('center-free-practice-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const heroLabel = effectiveMode === 'path'
    ? (effectiveTopicPathDone
      ? 'Ôn lại lộ trình'
      : (activeTopicForHome ? pathTopicPrimaryCtaLabel(activeTopicForHome) : 'Xem chi tiết lộ trình'))
    : 'Vào học ngay';
  const heroDisabled = effectiveMode === 'path' ? starting : false;
  const pathTopicRows = freePortal ? scopedPathTopics : [];
  const subjectBarTopics = freePortal ? pathTopicRows : topics;
  const subjectBarVariant = freePortal ? 'path' : 'free';
  const subjectBarActiveId = effectiveMode === 'path'
    ? (activeTopicForHome?.topic?.id || activePathTopicId || topicId)
    : (topicId || activePathTopicId);

  const pickSubject = (id) => {
    setActivePathTopicId(id);
    setTopicId(id);
  };

  // Học viên Trung tâm mở một bài → hiển thị toàn chiều rộng (video + câu hỏi), ẩn banner & cột phải.
  if (!freePortal && centerLessonOpen) {
    return (
      <div className="dp-shell mx-auto w-full max-w-6xl xl:max-w-7xl" data-lms-ui>
        <LessonPracticeCatalogPage embedded onSummaryChange={setCenterSummary} />
      </div>
    );
  }

  return (
    <div className="dp-shell mx-auto w-full max-w-6xl space-y-5 xl:max-w-7xl" data-lms-ui>
      {freePortal && (
        <div className="dew-app-card flex flex-wrap items-center gap-2 rounded-full px-4 py-2">
          <span className="mr-1 text-xs font-extrabold text-slate-600">Đang học:</span>
          {enrolledCourses.map((course) => {
            const isSelected = course.id === activeCourseId;
            return (
              <button
                key={course.id}
                type="button"
                onClick={() => {
                  gameSounds.tap();
                  setActiveCourseId(course.id);
                  if (course.topicIds?.[0]) {
                    setActivePathTopicId(course.topicIds[0]);
                    setTopicId(course.topicIds[0]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                  isSelected ? 'dew-btn-primary text-white' : 'dew-btn-white text-slate-700'
                }`}
              >
                <span>{course.shortTitle}</span>
                <span className={isSelected ? 'font-extrabold text-emerald-100' : 'font-bold text-slate-400'}>
                  ({course.progress > 0 ? `${course.progress}%` : 'Mới'})
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => openAddCourse()}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-400 bg-emerald-50/75 px-3.5 py-1.5 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100/80 cursor-pointer"
          >
            <Plus size={13} aria-hidden="true" />
            <span>Đăng ký thêm khóa</span>
          </button>
        </div>
      )}

      <DailyPracticeHero
        stats={stats}
        mode={effectiveMode}
        onPrimaryAction={heroAction}
        primaryDisabled={heroDisabled}
        primaryLabel={heroLabel}
        pathTopic={effectiveMode === 'path' ? activeTopicForHome : null}
        pathContinue={Boolean(effectivePathContinue)}
        courseProgress={effectiveMode === 'free' ? {
          completed: centerSummary.completedUnits,
          total: centerSummary.totalUnits,
          subjectName: centerSummary.activeSubjectName,
        } : undefined}
        freeTopicName={effectiveMode === 'free' ? centerSummary.activeSubjectName : (selected?.name || topics[0]?.name || '')}
        onBuyXp={freePortal ? openHomeXpOrUpgrade : undefined}
        onOpenCertificate={freePortal && effectiveTopicPathDone ? () => setCertOpen(true) : undefined}
      />

      {freePortal && showLowAiBanner && (
        <section className="flex flex-col gap-3 rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4 py-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-amber-950">
              {aiQuota.aiQuotaPercent <= 0 ? 'Đã hết dung lượng Hỗ trợ AI hôm nay' : 'Dung lượng Hỗ trợ AI sắp hết'}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-amber-800">
              {aiQuota.aiQuotaPercent <= 0
                ? 'Dung lượng Hỗ trợ AI hôm nay đã còn 0% (XP Học tập tích lũy vẫn giữ nguyên). Nâng cấp gói Hỗ trợ AI Không Giới Hạn để tiếp tục hỏi AI không giới hạn!'
                : `Dung lượng Hỗ trợ AI hôm nay chỉ còn ${aiQuota.aiQuotaPercent}% (XP Học tập tích lũy vẫn giữ nguyên). Nâng cấp gói Hỗ trợ AI Không Giới Hạn ngay!`}
            </p>
          </div>
          <button type="button" onClick={openHomeXpOrUpgrade} className="cms-btn cms-btn-primary shrink-0 !py-2.5">
            <Sparkles size={16} className="text-amber-200" /> Nâng cấp gói AI
          </button>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="min-w-0 lg:col-span-8">
          <section className={freePortal
            ? 'dew-app-card flex flex-col gap-4 rounded-[28px] p-4 sm:p-5'
            : 'dp-dew-main-panel flex flex-col gap-3 sm:gap-4'}
          >
            {freePortal && subjectBarTopics.length > 0 ? (
              <DailyPracticeSubjectBar
                className="dp-dew-subject-carousel--responsive"
                topics={subjectBarTopics}
                variant={subjectBarVariant}
                activeTopicId={subjectBarActiveId}
                onSelect={pickSubject}
              />
            ) : null}

            {effectiveMode === 'path' && (
              <div id="dp-path-panel" className="scroll-mt-4">
                <PathView
                  path={scopedPath}
                  practiceStats={stats}
                  loading={pathLoading}
                  error={pathError}
                  starting={starting}
                  initialTopicId={initialTopicId}
                  activeTopicId={subjectBarActiveId}
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

            {effectiveMode === 'free' && (
              <div id="center-free-practice-panel" className="scroll-mt-4">
                <LessonPracticeCatalogPage embedded onSummaryChange={setCenterSummary} />
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-4 lg:col-span-4">
          <DailyPracticeGoalPanel practiceStats={stats} canSetGoal={!freePortal || hasCompletedFirstNode} dewdropStyle={freePortal} />
          {(() => {
            const spaced = overview?.spacedRepetition || stats?.spacedRepetition || { dueCount: 0, totalQueued: 0, rewardXp: 15, nextDueDay: '' };
            const dueCount = Number(spaced.dueCount) || 0;
            const totalQueued = Number(spaced.totalQueued) || 0;
            const rewardXp = Number(spaced.rewardXp) || 15;
            return (
              <section className={freePortal
                ? 'dew-app-card dew-app-card--emerald p-5'
                : 'rounded-[24px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/60 p-4 shadow-sm'}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                      <Brain size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>Ôn tập ngắt quãng</span>
                    </h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                      Chu kỳ 1–3–7 ngày · +{rewardXp} XP
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ${dueCount > 0
                      ? 'bg-emerald-600 text-white'
                      : totalQueued > 0
                        ? 'bg-amber-100 text-amber-800'
                        : freePortal
                          ? 'bg-emerald-50/90 border border-emerald-200/70 text-emerald-800'
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
                {(!freePortal || totalQueued > 0) ? (
                  <p className="mt-2.5 text-xs font-medium leading-relaxed text-slate-600">
                    {totalQueued > 0
                      ? dueCount > 0
                        ? `Bạn có ${dueCount} câu từng làm sai đã tới lịch nhắc lại hôm nay (tổng ${totalQueued} câu đang theo dõi).`
                        : `Chưa có câu đến hạn hôm nay (${totalQueued} câu sẽ nhắc lại${spaced.nextDueDay ? ` từ ${spaced.nextDueDay}` : ''}). Bạn vẫn có thể ôn sớm ngay!`
                      : 'Các câu bạn làm sai trong quá trình luyện tập sẽ tự động vào đây để nhắc ôn sau 1, 3 và 7 ngày.'}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={starting || totalQueued === 0}
                  onClick={() => {
                    gameSounds.tap();
                    onStartSpacedReview?.();
                  }}
                  className={freePortal
                    ? totalQueued === 0
                      ? 'mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-100/90 py-2.5 text-xs font-bold text-slate-400 cursor-not-allowed'
                      : 'dew-btn-primary mt-3 inline-flex w-full items-center justify-center gap-1.5 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-50'
                    : 'cms-btn cms-btn-primary mt-3 w-full !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50'}
                >
                  {starting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={15} />}
                  {dueCount > 0 ? `Ôn tập ngay (${Math.min(10, totalQueued)} câu)` : totalQueued > 0 ? 'Ôn sớm hàng đợi' : 'Chưa có câu cần ôn'}
                </button>
              </section>
            );
          })()}
          {freePortal && (
            <section className="dew-app-card dew-app-card--emerald p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                    <BookOpen size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>Lộ trình dành riêng cho bạn</span>
                  </h3>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                    {placementResult
                      ? `Đạt ${placementResult.score}/${placementResult.total} · ${placementResult.recommendedLevel}`
                      : 'Trả lời nhanh 10 câu để chọn đúng môn học phù hợp nhất'}
                  </p>
                </div>
                {placementResult && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                    Đã đánh giá
                  </span>
                )}
              </div>
              {placementResult && (
                <p className="mt-2 rounded-2xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 border border-emerald-100">
                  Gợi ý ưu tiên: <strong className="text-emerald-700">{placementResult.matchedTopicName}</strong>
                </p>
              )}
              <button
                type="button"
                onClick={() => { gameSounds.tap(); setPlacementOpen(true); }}
                className="dew-btn-primary mt-3 flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold cursor-pointer"
              >
                <Sparkles size={14} aria-hidden="true" />
                {placementResult ? 'Xem đánh giá & Làm lại' : 'Đánh giá năng lực (10 câu)'}
              </button>
            </section>
          )}
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
      {freePortal && placementOpen && (
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
      if (typeof data.profileXp === 'number') {
        setProfileXp(data.profileXp);
        emitDailyPracticeStats({
          xpTotal: data.profileXp,
          ...(typeof data.studyXpTotal === 'number' ? { studyXpTotal: data.studyXpTotal } : {}),
          ...(typeof data.purchasedXp === 'number' ? { purchasedXp: data.purchasedXp } : {}),
          ...(typeof data.dailyXp === 'number' ? { dailyXp: data.dailyXp } : {}),
        });
      }
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
      if (err.status === 402) {
        dispatchOpenAiPackagesModal();
      } else setError(err.message || 'Không gửi được câu trả lời');
    } finally {
      setBusy(false);
    }
  }, [busy, result, session.id, question.id]);

  const askHint = async () => {
    if (reveal || result || busy) return;
    if (!xpDisabled && hintShareXp > 0 && profileXp < hintShareXp) {
      dispatchOpenAiPackagesModal();
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
          ...(typeof data.studyXpTotal === 'number' ? { studyXpTotal: data.studyXpTotal } : {}),
          ...(typeof data.purchasedXp === 'number' ? { purchasedXp: data.purchasedXp } : {}),
          ...(typeof data.dailyXp === 'number' ? { dailyXp: data.dailyXp } : {}),
        });
      }
      if (charged > 0) setHintChargedXp(charged);
      setReveal(data.reveal || {});
      setHintText(data.hint || '');
    } catch (err) {
      if (err.status === 402) {
        dispatchOpenAiPackagesModal();
      } else setError(err.message || 'Không lấy được gợi ý');
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
    <div className="dew-student-theme relative min-h-[calc(100dvh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-[#E0F2FE] via-[#ECFEFF] to-[#ECFDF5] px-3 py-5 sm:px-6 sm:py-8">
      {/* 4 hạt giọt nước 3D mờ ở các góc */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="dew-water-orb -left-4 top-24 h-16 w-16 opacity-65" />
        <div className="dew-water-orb right-8 top-6 h-12 w-12 opacity-60" />
        <div className="dew-water-orb bottom-10 left-8 h-14 w-14 opacity-55" />
        <div className="dew-water-orb bottom-16 right-6 h-20 w-20 opacity-50" />
      </div>

      <PracticeTopBar
        contextLabel={contextLabel}
        currentIndex={index + 1}
        total={total}
        progress={progress}
        confirmedXp={confirmedQuestionXp}
        userXP={walletXp}
        perQuestionXp={isPerQuestion ? perQuestionStake : 0}
        stakeXp={isTestOutStake ? stakeXp : 0}
        xpDisabled={xpDisabled}
        combo={combo}
        hintChargedXp={hintChargedXp}
        onQuit={() => { setQuitMode('quit'); setQuitOpen(true); }}
      />

      {/* Thẻ câu hỏi chính */}
      <section
        className={`${dewClass(
          'dew-app-card relative z-10 mx-auto w-full max-w-4xl overflow-hidden rounded-[30px] p-6 md:p-8',
          'relative z-10 mx-auto w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-md md:p-8',
        )} ${
          result && !result.correct ? 'dp-shake' : ''
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#0EA5E9]" />
        {result?.correct && <Confetti />}

        <div className="flex items-start justify-between gap-4 border-b border-slate-100/90 pb-5 sm:pb-6">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-b from-[#ECFDF5] to-[#E0F2FE]/80 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.25),inset_0_2px_4px_#fff] sm:h-16 sm:w-16">
              <Mascot
                mood={isVideoQuestion ? (videoCompleted ? 'correct' : 'learning') : (result ? (result.correct ? 'correct' : 'incorrect') : busy ? 'loading' : reveal ? 'idea' : 'learning')}
                size={48}
                className="shrink-0"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 sm:text-[13px]">
                {PLAY_QUESTION_CHROME.label} · {meta.label}
              </p>
              <h2 className="mt-0.5 text-lg font-extrabold leading-snug text-slate-900 sm:text-xl md:text-[22px]">
                {question.prompt}
              </h2>
            </div>
          </div>

          {!result && !isVideoQuestion ? (
            <button
              type="button"
              onClick={askHint}
              disabled={Boolean(reveal) || busy}
              aria-label={reveal ? 'Đã dùng gợi ý' : (xpDisabled ? 'Gợi ý' : `Gợi ý, trừ ngay ${hintShareXp} XP`)}
              title={xpDisabled ? 'Gợi ý (không ảnh hưởng XP)' : `Gợi ý, trừ ngay −${hintShareXp} XP`}
              className={dewClass(
                'dew-btn-white inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50',
                'inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50',
              )}
            >
              <Lightbulb size={14} className={reveal ? 'text-slate-400' : 'text-amber-500'} aria-hidden="true" />
              <span>{reveal ? 'Đã gợi ý' : 'Gợi ý'}</span>
              {!xpDisabled && !reveal && hintShareXp > 0 ? (
                <span className="rounded-full bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                  −{hintShareXp}
                </span>
              ) : null}
            </button>
          ) : null}
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

            {!result ? (
              !immediate ? (
                <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => submit(pending)}
                    disabled={!pending || busy}
                    className={dewClass(
                      'dew-btn-primary inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-extrabold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                      'inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-3 text-sm font-extrabold shadow-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} strokeWidth={2.8} aria-hidden="true" />}
                    <span>Kiểm tra</span>
                  </button>
                </div>
              ) : (
                <p className="mt-5 text-center text-xs font-medium italic text-slate-500">
                  Chọn một đáp án phía trên để trả lời
                </p>
              )
            ) : null}

            <p className="mt-4 hidden items-center justify-center gap-2 text-xs font-medium text-slate-500 sm:flex">
              <span>Phím tắt:</span>
              {result ? (
                <span>
                  <kbd className="rounded-md border border-white bg-white/80 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 shadow-2xs">Enter</kbd>
                  {' hoặc '}
                  <kbd className="rounded-md border border-white bg-white/80 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 shadow-2xs">→</kbd>
                  {' sang câu tiếp'}
                </span>
              ) : (
                <span>
                  {question.type === 'mcq' || question.type === 'truefalse' ? '1–4 / A–D chọn đáp án · ' : ''}
                  {!reveal ? 'H gợi ý' : ''}
                  {!reveal && !immediate ? ' · ' : ''}
                  {!immediate ? 'Enter kiểm tra' : ''}
                </span>
              )}
            </p>
          </>
        )}
      </section>

      {quitOpen && (
        <ExitPracticeWarningModal
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
        <PracticeReadyModal
          stakeXp={rematchStakeXp}
          xpTotal={currentXpTotal}
          isFreeTier={Boolean(summary.stats?.isFreeTier || summary.stats?.suggestedAction === 'upgrade_plan')}
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
  const { activeCourse, allVisibleClasses, loading: coursesLoading, refreshCourses } = useActiveCourse();
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
  const [lastPick, setLastPick] = useState(null);
  const [starting, setStarting] = useState(false);
  const isDewskillStudent = isFreePortalAccount();
  const [mode, setMode] = useState(() => (isDewskillStudent ? 'path' : 'free'));
  const [path, setPath] = useState(null);
  const [pathLoading, setPathLoading] = useState(true);
  const [pathError, setPathError] = useState('');
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [meetOfferOpen, setMeetOfferOpen] = useState(false);
  const [upgradeTopicId, setUpgradeTopicId] = useState('');
  const [requestedLesson, setRequestedLesson] = useState(null);
  const [welcomeTarget, setWelcomeTarget] = useState(null);
  const [stakeConfirm, setStakeConfirm] = useState(null);
  const [reloadNotice, setReloadNotice] = useState(null);
  const [reloadNoticeOpen, setReloadNoticeOpen] = useState(false);

  const upgradeCourse = useMemo(
    () => resolveUpgradeCourse(
      allVisibleClasses,
      activeCourse,
      upgradeTopicId || linkedTopicId || path?.activeTopicId || path?.topics?.[0]?.topic?.id || '',
    ),
    [allVisibleClasses, activeCourse, upgradeTopicId, linkedTopicId, path?.activeTopicId, path?.topics],
  );

  useEffect(() => {
    if (meetOfferOpen && !coursesLoading && !upgradeCourse) {
      setMeetOfferOpen(false);
    }
  }, [meetOfferOpen, coursesLoading, upgradeCourse]);

  useEffect(() => {
    const notice = readReloadAbandonNotice();
    if (!notice) return;
    setReloadNotice(notice);
    setReloadNoticeOpen(true);
  }, []);
  const practiceLockRef = useRef(false);

  const resolveTopicForUnit = useCallback((pathObj, targetUnitId) => {
    const uid = String(targetUnitId || '');
    if (!uid) return null;
    return (pathObj?.topics || []).find((t) => (t?.units || []).some((u) => String(u.id) === uid)) || null;
  }, []);

  const isTestOutUnlocked = useCallback((pathObj, targetUnitId) => {
    const topic = resolveTopicForUnit(pathObj, targetUnitId);
    if (topic && typeof topic.canTestOut === 'boolean') return topic.canTestOut;
    return pathObj?.canTestOut === true;
  }, [resolveTopicForUnit]);

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
    if (!isFreePortalAccount()) {
      setPath(null);
      setPathError('');
      setPathLoading(false);
      return;
    }
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

  const changeMode = () => {
    const lockedMode = isFreePortalAccount() ? 'path' : 'free';
    setMode(lockedMode);
    try { localStorage.setItem(MODE_STORAGE_KEY, lockedMode); } catch { /* ignore */ }
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
        dispatchOpenAiPackagesModal();
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

  const queueBegin = (pick, options = {}) => {
    const resolvedPick = pick?.mode === 'path' && !pick.testOut
      ? { ...pick, review: Boolean(pick.review || isPathPickCompleted(path, pick)) }
      : pick;
    const meta = clientStakeMeta(resolvedPick, overview?.stats);
    if (!meta) {
      begin(resolvedPick);
      return;
    }
    const effectiveStakeXp = typeof options.stakeXpOverride === 'number'
      ? options.stakeXpOverride
      : meta.stakeXp;
    const xpTotal = overview?.stats?.xpTotal;
    const isBlockedFreeTestOut = meta.testOut && !isTestOutUnlocked(path, resolvedPick.unitId);
    if (!isBlockedFreeTestOut && typeof xpTotal === 'number' && xpTotal < effectiveStakeXp) {
      dispatchOpenAiPackagesModal();
      return;
    }
    setStakeConfirm({
      pick: resolvedPick,
      ...meta,
      stakeXp: effectiveStakeXp,
      variant: options.variant || 'start',
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
    if (!isFreePortalAccount()) return;
    if ((watchStage || practiceStage) && mode !== 'path') setMode('path');
  }, [watchStage, practiceStage, mode]);

  useEffect(() => {
    if (!isFreePortalAccount()) return undefined;
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

  const handleFinishContinue = () => {
    resumeMilestoneAfterPractice(true);
  };

  const handleFinishReplay = () => {
    const pathResult = summary?.path;
    const currentXpTotal = overview?.stats?.xpTotal;
    const fallbackPick = pathResult
      ? {
        mode: 'path',
        unitId: pathResult.unitId,
        nodeKey: pathResult.pathNodeKey || 'study',
        step: pathResult.step || 'learn',
        testOut: Boolean(pathResult.testOut),
      }
      : null;
    const basePick = lastPick || fallbackPick;
    if (!basePick) return;

    const isReviewReplay = Boolean(pathResult?.passed || summary?.xpDisabled);
    const replayPick = isReviewReplay ? { ...basePick, review: true } : basePick;

    if (replayPick.mode === 'path' && !isReviewReplay && !isPathPickCompleted(path, replayPick)) {
      const neededXp = replayPick.testOut
        ? TEST_OUT_XP
        : (summary?.recovery ? 0 : ((summary?.total || 10) * QUESTION_STAKE_XP));
      if (typeof currentXpTotal === 'number' && currentXpTotal < neededXp) {
        dispatchOpenAiPackagesModal();
        return;
      }
      setCelebrating(false);
      setSummary(null);
      queueBegin(replayPick, { variant: 'rematch', stakeXpOverride: neededXp });
      return;
    }

    setCelebrating(false);
    setSummary(null);
    queueBegin(replayPick, { variant: 'rematch' });
  };

  const handleFinishRelatedVideo = () => {
    if (summary?.relatedLesson) {
      navigate(lessonResumeUrl(summary.relatedLesson));
    }
  };

  return (
    <div className={`dp-dew-page cms-sd-page min-h-full pb-10 ${isFreePortalAccount() ? 'bg-transparent' : 'bg-slate-50/80'}`}>
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
        <PracticeReadyModal
          variant={stakeConfirm.variant || 'start'}
          stakeXp={stakeConfirm.stakeXp}
          xpTotal={overview?.stats?.xpTotal ?? stakeConfirm.xpTotal}
          recovery={stakeConfirm.recovery}
          review={Boolean(stakeConfirm.pick?.review)}
          isFreeTier={Boolean(overview?.stats?.isFreeTier || overview?.stats?.suggestedAction === 'upgrade_plan')}
          testOut={stakeConfirm.testOut}
          testOutLocked={stakeConfirm.testOut && !isTestOutUnlocked(path, stakeConfirm.pick?.unitId)}
          starting={starting}
          onStay={() => setStakeConfirm(null)}
          onOpenMeet={() => {
            const lockedTestOut = stakeConfirm.testOut && !isTestOutUnlocked(path, stakeConfirm.pick?.unitId);
            if (lockedTestOut) {
              const unitTopicId = resolveTopicForUnit(path, stakeConfirm.pick?.unitId)?.topic?.id || '';
              setUpgradeTopicId(unitTopicId);
            }
            setStakeConfirm(null);
            if (lockedTestOut) {
              setMeetOfferOpen(true);
              if (!allVisibleClasses.length) refreshCourses?.();
            } else {
              dispatchOpenAiPackagesModal();
            }
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
      <CourseEnrollmentModal
        open={meetOfferOpen && !session && Boolean(upgradeCourse)}
        course={upgradeCourse}
        onClose={() => {
          setMeetOfferOpen(false);
          setUpgradeTopicId('');
        }}
        onActivated={async () => {
          await refreshCourses?.();
          loadOverview();
          loadPath();
        }}
      />
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
