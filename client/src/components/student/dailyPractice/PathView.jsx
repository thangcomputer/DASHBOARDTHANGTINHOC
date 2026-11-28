import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Award, BookOpen, Check, Crown, Dumbbell, FastForward, FileText, Flame, Gamepad2, Loader2, Lock, Paperclip, Play, PlayCircle, Route, Sparkles, Star, Trophy, X,
} from 'lucide-react';
import {
  pickActivePathTopic as pickActivePathTopicShared,
} from '../../../../../shared/dailyPractice/lastPathTopic.mjs';
import { pathNodeMapLabel, pathNodeStartBubbleLabel } from '../../../../../shared/dailyPractice/pathNodeNudge.mjs';
import {
  PATH_HUB_PROGRESS_RING,
  pathHubLevelStates,
} from '../../../../../shared/dailyPractice/pathHubProgressRing.mjs';
import { pathNodeColor } from '../../../../../shared/dailyPractice/pathNodeColors.mjs';
import { pathPlainStageMinHeightPx } from '../../../../../shared/dailyPractice/pathPlainJourney.mjs';
import { PATH_HUB_DUO } from '../../../../../shared/dailyPractice/pathHubDuoVisual.mjs';
import VietnamJourneyStage from './VietnamJourneyStage';
import DewdropHorizontalJourney from './DewdropHorizontalJourney';
import StageNodePopover from './StageNodePopover';
import {
  persistLastPathTopicId,
  readStudentUserId,
  resolveSavedPathTopicId,
  syncLastPathTopicFromServer,
} from '../../../utils/lastPathTopic';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import PathLessonModal from './PathLessonModal';
import VideoLessonWorkspace, { readVideoLessonProgress } from './VideoLessonWorkspace';
import WelcomeBackModal, { takeWelcomeBackTurn } from './WelcomeBackModal';
import PathVideoModal from './PathVideoModal';
import PathUnitRoadmapModal from './PathUnitRoadmapModal';
import { gameSounds } from '../../../utils/sound';
import { QUESTION_STAKE_XP, SESSION_STAKE_XP, TEST_OUT_XP, topicColor, topicIcon, unitColor } from '../../../utils/dailyPractice';
import Mascot from './Mascot';
import { DropletMark, PathITBackdrop } from './PathDecor';
import CourseEnrollmentModal from '../courses/CourseEnrollmentModal';
import { useActiveCourse } from '../../../context/ActiveCourseContext';
import { collectNodeVideos, collectUnitVideos, UnitStageHeader } from './PathUnitStageHeader';
import { UnitStageChest } from './UnitStageChest';
import LevelUnlockEffect, { useNewlyUnlockedUnit } from './LevelUnlockEffect';

export { collectUnitVideos, UnitStageHeader };

const STEP_ICONS = { learn: BookOpen, practice: Dumbbell, challenge: Flame };
const STEP_LABELS = { learn: 'Dễ', practice: 'Vừa', challenge: 'Khó' };

function buildUnitStages(unit, unitLocked = false, practiceStats = null) {
  const nodes = unit?.pathNodes || [];
  const unitTotalQuestions = Number(unit?.counts?.total) || 0;
  return nodes.map((node, index) => {
    const isMilestone = node.icon === 'crown' || (nodes.length >= 2 && index === nodes.length - 1);
    const isLesson = !isMilestone && (node.kind === 'study' || node.icon === 'book' || node.icon === 'clipboard');
    const isLocked = Boolean(unitLocked || node.state === 'locked');
    const levels = Array.isArray(node.levels) ? node.levels : [];
    const doneLevels = levels.filter((lv) => lv?.state === 'completed').length;
    const exercises = Array.isArray(node.exercises) ? node.exercises : [];
    const passedExSet = new Set(Array.isArray(unit?.passedExercises) ? unit.passedExercises : []);
    const exercisesTotalCount = exercises.length;
    const exercisesDoneCount = exercises.filter((ex) => ex.passed || passedExSet.has(`${node.key}:${ex.id}`)).length;
    const easyDone = !isLocked && (node.state === 'completed' || levels[0]?.state === 'completed');
    const mediumDone = !isLocked && (node.state === 'completed' || (easyDone && levels[1]?.state === 'completed'));
    const hardDone = !isLocked && (node.state === 'completed' || (mediumDone && levels[2]?.state === 'completed'));
    const passedTier = hardDone ? 'hard' : mediumDone ? 'medium' : easyDone ? 'easy' : 'none';
    const tiers = [
      {
        key: 'easy',
        label: 'Dễ',
        stepKey: levels[0]?.key || 'learn',
        passed: easyDone,
        unlocked: !isLocked,
      },
      {
        key: 'medium',
        label: 'Vừa',
        stepKey: levels[1]?.key || 'practice',
        passed: mediumDone,
        unlocked: !isLocked && (easyDone || levels[1]?.state === 'active' || levels[1]?.state === 'completed'),
      },
      {
        key: 'hard',
        label: 'Khó',
        stepKey: levels[2]?.key || 'challenge',
        passed: hardDone,
        unlocked: !isLocked && (mediumDone || levels[2]?.state === 'active' || levels[2]?.state === 'completed'),
      },
    ];

    let progress = 0;
    const localLesson = isLesson ? readVideoLessonProgress(unit?.id, node?.key) : null;
    if (!isLocked && exercisesTotalCount > 0 && node.icon === 'clipboard' && !node.hasStudyContent) {
      progress = Math.round((exercisesDoneCount / exercisesTotalCount) * 100);
    } else if (localLesson && typeof localLesson.pct === 'number' && !isLocked) {
      progress = localLesson.pct;
    } else if (node.state === 'completed') {
      progress = 100;
    } else if (!isLocked) {
      if (typeof node.progress === 'number' && Number.isFinite(node.progress)) {
        progress = Math.max(0, Math.min(100, Math.round(node.progress)));
      } else if (levels.length > 0) {
        progress = Math.round((doneLevels / levels.length) * 100);
      }
    }

    const status = isLocked
      ? 'locked'
      : (progress >= 100 || node.state === 'completed')
        ? 'completed'
        : progress > 0
          ? 'in_progress'
          : 'ready';

    const rawLabel = pathNodeMapLabel(node);
    const title = isMilestone && (!rawLabel || rawLabel === 'Hoàn thành')
      ? 'Vượt chặng'
      : (rawLabel || (index === 0 ? 'Học bài' : index === 1 ? 'Luyện tập' : index === 2 ? 'Thử thách' : 'Vượt chặng'));

    const nextUnlockedLevel = levels.find((lv) => lv?.state !== 'completed' && lv?.state !== 'locked') || levels[0];
    const nextLevelKey = nextUnlockedLevel?.key || (isMilestone ? 'challenge' : 'learn');

    const firstLesson = levels[0] || null;
    const hasVideo = levels.some((lv) => Boolean(lv?.videos?.[0]?.url || lv?.url))
      || ['easy', 'medium', 'hard'].some((d) => Boolean(node?.levelConfigs?.[d]?.video?.url));
    const hasTheory = levels.some((lv) => Boolean(lv?.content || lv?.fileUrl || lv?.videos?.[0]?.fileUrl))
      || ['easy', 'medium', 'hard'].some((d) => Boolean(node?.levelConfigs?.[d]?.content?.body || node?.levelConfigs?.[d]?.files?.length));
    const hasStudyContent = Boolean(node.hasStudyContent || hasVideo || hasTheory);
    const checks = levels.flatMap((lv) => lv?.videos?.[0]?.checks || lv?.checks || []);
    const doneChecks = checks.filter((c) => c?.completed).length;

    const totalCount = isLesson ? (levels.length || exercisesTotalCount) : (unitTotalQuestions > 0 ? unitTotalQuestions : (levels.length || 3));
    const doneCount = isLesson
      ? (levels.length ? doneLevels : exercisesDoneCount)
      : (unitTotalQuestions > 0 ? Math.round((progress / 100) * unitTotalQuestions) : doneLevels);
    const accuracy = Number.isFinite(Number(practiceStats?.accuracy))
      ? Math.round(Number(practiceStats.accuracy))
      : (progress >= 100 ? 100 : 0);

    return {
      id: index + 1,
      nodeKey: node.key,
      title,
      icon: node.icon,
      type: isMilestone ? 'milestone' : isLesson ? 'lesson' : 'practice',
      progress,
      status,
      nextLevelKey,
      hasStudyContent,
      hasExercises: exercisesTotalCount > 0,
      exercisesDoneCount,
      exercisesTotalCount,
      heading: isLesson ? `Vòng ${index + 1}: ${firstLesson?.title || unit?.title || title}` : `Vòng ${index + 1}: ${title}`,
      subtitle: isLesson
        ? ([hasVideo ? 'Video bài giảng' : null, hasTheory ? 'Lý thuyết & File' : null, exercisesTotalCount > 0 ? `${exercisesTotalCount} đề bài tập` : null].filter(Boolean).join(' · ') || 'Bài giảng trọng tâm của chặng')
        : '',
      checklist: isLesson
        ? [
            ...(hasVideo || !exercisesTotalCount ? [{ label: 'Video bài giảng ngắn', done: progress >= 100 || Boolean(firstLesson?.state === 'completed' || firstLesson?.videos?.[0]?.watched) }] : []),
            ...(hasTheory || !exercisesTotalCount ? [{ label: 'Tóm tắt thao tác thực hành', done: progress >= 100 || Boolean(hasTheory && (firstLesson?.state === 'completed' || doneLevels > 0)) }] : []),
            ...(exercisesTotalCount > 0 ? [{ label: `Đề bài tập tự nhập (${exercisesDoneCount}/${exercisesTotalCount} bài)`, done: exercisesDoneCount >= exercisesTotalCount }] : []),
            ...(checks.length > 0 || !exercisesTotalCount ? [{
              label: checks.length > 0 ? `Câu hỏi kiểm tra nhanh (${doneChecks}/${checks.length} câu)` : 'Câu hỏi kiểm tra nhanh',
              done: progress >= 100 || (checks.length > 0 && doneChecks >= checks.length),
            }] : []),
          ]
        : [],
      doneCount,
      totalCount,
      countUnit: unitTotalQuestions > 0 ? 'câu' : 'nấc',
      accuracy,
      passedTier,
      tiers,
    };
  });
}


/** Nút học trên snake - không xen video (video nằm panel bên cạnh). */
function buildUnitPathItems(unit) {
  return (unit.pathNodes || []).map((node) => ({
    kind: 'hub',
    key: `hub-${node.key}`,
    node,
    state: node.state,
  }));
}

const NODE_ICONS = { book: BookOpen, dumbbell: Dumbbell, flame: Flame, crown: Crown };

function ProgressRing({ size, progress = 0, progressColor, segments, dimmed = false }) {
  const stroke = PATH_HUB_PROGRESS_RING.stroke;
  const half = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  if (Array.isArray(segments) && segments.length > 0) {
    const angles = PATH_HUB_PROGRESS_RING.segmentAngles;
    const arcLen = circumference * (PATH_HUB_PROGRESS_RING.segmentSweepDeg / 360);
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={`dp-path-progress-ring pointer-events-none absolute inset-0 h-full w-full ${dimmed ? 'opacity-55' : ''}`}
        aria-hidden="true"
      >
        {angles.map((startDeg, idx) => {
          const done = Boolean(segments[idx]);
          return (
            <circle
              key={idx}
              cx={half}
              cy={half}
              r={radius}
              fill="none"
              stroke={done ? progressColor : PATH_HUB_PROGRESS_RING.track}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arcLen} ${circumference}`}
              className="transition-[stroke] duration-500"
              transform={`rotate(${startDeg} ${half} ${half})`}
            />
          );
        })}
      </svg>
    );
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const visibleArc = clamped > 0 && clamped < 1 ? Math.max(clamped, 0.06) : clamped;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`dp-path-progress-ring pointer-events-none absolute inset-0 h-full w-full ${dimmed ? 'opacity-55' : ''}`}
      aria-hidden="true"
    >
      <circle
        cx={half}
        cy={half}
        r={radius}
        fill="none"
        stroke={PATH_HUB_PROGRESS_RING.track}
        strokeWidth={stroke}
      />
      <circle
        cx={half}
        cy={half}
        r={radius}
        fill="none"
        stroke={progressColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - visibleArc)}
        className="transition-[stroke-dashoffset] duration-700"
        transform={`rotate(-90 ${half} ${half})`}
      />
    </svg>
  );
}

/** Một nút trên lộ trình - nút tròn 3D vàng kim + đường vòng 3 nấc + bubble Bắt đầu / Tiếp tục. */
function PracticeHubNode({ node, color: _color, isNext, isNewlyUnlocked = false, selected, onClick, nodeIndex = 0, completedSections = [] }) {
  const locked = node.state === 'locked';
  const size = PATH_HUB_DUO.buttonSize.web;
  const levelStates = pathHubLevelStates(node, completedSections);
  const doneLevels = levelStates.filter(Boolean).length;
  const ringColor = doneLevels >= 3 ? PATH_HUB_PROGRESS_RING.progressDone : PATH_HUB_PROGRESS_RING.progressActive;
  const HubIcon = NODE_ICONS[node.icon] || Dumbbell;
  const face = locked
    ? 'linear-gradient(180deg, #E8EDF2 0%, #D8DEE6 100%)'
    : 'linear-gradient(180deg, #FFDE59 0%, #FBBF24 50%, #F59E0B 100%)';
  const base = locked ? '#C4C9D1' : '#D97706';
  const showRing = PATH_HUB_DUO.showProgressRing && !locked && (isNext || doneLevels > 0);
  const ring = size + PATH_HUB_PROGRESS_RING.pad;
  const startBubble = pathNodeStartBubbleLabel(node, completedSections);
  const isContinueBubble = startBubble === 'TIẾP TỤC';
  const badgeCorner = nodeIndex % 2 === 0 ? 'top-right' : 'top-left';
  return (
    <div
      className={`dp-path-hub-root dp-path-hub-root--column relative ${isNewlyUnlocked ? 'dp-node-unlock-pop' : ''}`}
      data-path-hub=""
      data-node-state={node.state}
    >
      {isNext && !selected ? (
        <button
          type="button"
          disabled={locked}
          onClick={onClick}
          className="dp-path-start-bubble cursor-pointer border-0"
          style={{ color: isContinueBubble ? '#D97706' : '#059669' }}
        >
          {startBubble}
        </button>
      ) : null}
      <div className="dp-path-hub-ring relative" style={{ width: ring, height: ring }}>
        {showRing ? (
          <ProgressRing size={ring} segments={levelStates} progressColor={ringColor} />
        ) : null}
        <button
          type="button"
          disabled={locked}
          onClick={onClick}
          aria-label={node.kind === 'study' || node.icon === 'book' ? `${node.label}. Bài 1, Bài 2…` : `${node.label}. 3 cấp Dễ, Vừa, Khó`}
          aria-expanded={selected}
          className={`dp-node absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full disabled:cursor-not-allowed ${
            isNext ? 'dp-node-active-glow' : ''
          }`}
          style={{
            width: size,
            height: size,
            background: face,
            '--dp-node-base': base,
            color: locked ? '#9CA3AF' : '#FFFFFF',
          }}
        >
          <HubIcon size={28} strokeWidth={PATH_HUB_DUO.iconStroke} aria-hidden="true" className="drop-shadow-sm text-white" />
          {/* Ngôi sao vàng nhỏ đính góc trên phải nút */}
          {!locked && (
            <span
              className="pointer-events-none absolute -right-0.5 -top-1 z-10 select-none drop-shadow-sm"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
          )}
          {/* Nút khóa hiển thị biểu tượng ổ khóa xám */}
          {locked && (
            <span
              className={`absolute -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-slate-600 ring-2 ring-white ${
                badgeCorner === 'top-left' ? '-left-0.5' : '-right-0.5'
              }`}
              aria-hidden="true"
            >
              <Lock size={11} strokeWidth={2.8} />
            </span>
          )}
        </button>
      </div>
      <span
        className={`dp-path-node-label dp-path-node-label--below ${
          locked ? 'dp-path-node-label--locked' : ''
        } ${isNext && !selected ? 'dp-path-node-label--current' : ''}`}
        style={{
          color: locked ? PATH_HUB_DUO.labelLockedColor : '#334155',
        }}
      >
        {pathNodeMapLabel(node)}
      </span>
    </div>
  );
}

/** Popover cố định theo nút - vừa viewport, không cuộn, không bị che. */
function PathHubPopoverPortal({ anchorRef, anchorKey = '', children }) {
  const popRef = useRef(null);
  const [box, setBox] = useState({
    position: 'fixed',
    left: 8,
    top: 8,
    width: 280,
    zIndex: 9200,
    preferAbove: false,
  });

  useLayoutEffect(() => {
    const place = () => {
      const el = anchorRef.current;
      const pop = popRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 8;
      const gap = 8;
      const width = Math.min(window.innerWidth - pad * 2, 300);
      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

      // Chiều cao thật - không maxHeight / overflow để tránh thanh cuộn và cắt nấc.
      const h = pop?.offsetHeight || 240;
      const spaceBelow = window.innerHeight - r.bottom - gap - pad;
      const spaceAbove = r.top - gap - pad;
      const preferAbove = spaceBelow < h && spaceAbove >= spaceBelow;

      let top = preferAbove ? r.top - gap - h : r.bottom + gap;
      top = Math.max(pad, Math.min(top, window.innerHeight - h - pad));

      setBox({
        position: 'fixed',
        left,
        top,
        width,
        zIndex: 9200,
        preferAbove,
      });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, anchorKey]);

  if (typeof document === 'undefined') return null;
  const { preferAbove, ...style } = box;
  return createPortal(
    <div
      ref={popRef}
      data-path-popover
      className="overflow-visible"
      style={style}
      role="dialog"
    >
      <div className={preferAbove ? '[&_[data-pop-arrow]]:!top-auto [&_[data-pop-arrow]]:!-bottom-1.5' : ''}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Popover nút Học bài - Bài 1, Bài 2… (nội dung / file / video / luyện tập). */
function StudyHubPopover({ node, unit, color, onClose, onOpenLesson, onStartPractice }) {
  const lessons = node.levels || [];
  const single = lessons.length === 1 ? lessons[0] : null;

  return (
    <div className="dp-pop relative w-full rounded-2xl p-3.5 text-left text-white shadow-2xl sm:p-4" style={{ background: `linear-gradient(160deg, ${color.from}, ${color.to})` }}>
      <span data-pop-arrow className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45" style={{ background: color.from }} />
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-2 top-2 rounded-full p-1 text-white/80 hover:bg-white/15 !shadow-none"><X size={15} /></button>

      <div className="flex items-center gap-2 pr-6">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20">
          <BookOpen size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black leading-tight sm:text-[17px]">{node.label}</p>
          <p className="text-[10px] font-semibold text-white/85">Bài học chặng</p>
        </div>
      </div>

      {!lessons.length ? (
        <p className="mt-2.5 rounded-xl border border-white/20 bg-black/10 px-2.5 py-2 text-[11px] font-semibold text-white/90">
          Chặng này chưa gắn bài học. Bạn có thể sang nút Luyện tập.
        </p>
      ) : single ? (
        <div className="mt-2.5 space-y-2">
          {single.content ? (
            <p className="line-clamp-3 rounded-xl bg-black/20 p-2.5 text-xs font-medium leading-relaxed text-white/95">
              {single.content}
            </p>
          ) : null}

          <div className="space-y-1">
            {Boolean(single.fileUrl || single.videos?.[0]?.fileUrl) && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1.5 text-xs font-bold text-white">
                <Paperclip size={13} className="shrink-0 text-amber-300" />
                <span className="truncate">{single.fileName || single.videos?.[0]?.fileName || 'Tài liệu đính kèm'}</span>
              </div>
            )}
            {Boolean(single.videos?.[0]?.url) && (
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-white/90">
                <PlayCircle size={13} className="shrink-0 text-emerald-200" />
                <span>Video bài giảng{single.videos?.[0]?.checks?.length ? ` (${single.videos[0].checks.length} câu hỏi video)` : ''}</span>
              </div>
            )}
            {unit?.counts?.total > 0 && (
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-white/85">
                <Gamepad2 size={13} className="shrink-0 text-emerald-200" />
                <span>{unit.counts.easy} câu Dễ · {unit.counts.medium} Vừa · {unit.counts.hard} Khó</span>
              </div>
            )}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => onOpenLesson(single)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-black uppercase text-slate-900 shadow-md hover:bg-slate-50 !shadow-none"
            >
              <BookOpen size={14} /> {single.state === 'completed' ? 'Xem lại bài học' : 'Vào học ngay'}
            </button>
            {unit?.counts?.total > 0 && onStartPractice && (
              <button
                type="button"
                onClick={() => onStartPractice()}
                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-black/20 py-1.5 text-[11px] font-black uppercase text-white hover:bg-black/30 !shadow-none"
              >
                <Gamepad2 size={13} /> Luyện tập ({unit.counts.total} câu)
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {lessons.map((lesson, index) => {
            const locked = lesson.state === 'locked';
            const done = lesson.state === 'completed';
            const hasVideo = Boolean(lesson.videos?.[0]?.url);
            const hasFile = Boolean(lesson.fileUrl || lesson.videos?.[0]?.fileUrl);
            const hasContent = Boolean(lesson.content || lesson.videos?.[0]?.content);
            const displayTitle = lesson.title && lesson.title !== node.label ? lesson.title : (lesson.label || `Bài ${index + 1}`);
            return (
              <li key={lesson.key} className={`rounded-xl border px-2.5 py-2 ${locked ? 'border-white/10 bg-black/10 opacity-60' : 'border-white/25 bg-white/10'}`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-black">
                    {done ? <Check size={14} /> : locked ? <Lock size={12} /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black sm:text-[13px]">{displayTitle}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/80">
                      {done ? <span className="font-bold text-emerald-200">Đã học</span> : null}
                      {hasContent ? <span>Lý thuyết</span> : null}
                      {hasFile ? <span className="flex items-center gap-0.5 text-amber-200"><Paperclip size={10} /> File</span> : null}
                      {hasVideo ? <span className="flex items-center gap-0.5 text-emerald-200"><PlayCircle size={10} /> Video</span> : null}
                    </div>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => onOpenLesson(lesson)}
                      className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-800 !shadow-none sm:text-[11px]"
                    >
                      {done ? 'Xem lại' : 'Học'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Popover 3 nấc Dễ / Vừa / Khó trong nút Luyện / Thử thách / Hoàn thành. */
function LevelHubPopover({ node, color, starting, onClose, onStartStep }) {
  return (
    <div className="dp-pop relative w-full rounded-2xl p-3 text-left text-white shadow-xl sm:p-3.5" style={{ background: `linear-gradient(160deg, ${color.from}, ${color.to})` }}>
      <span data-pop-arrow className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45" style={{ background: color.from }} />
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-1.5 top-1.5 rounded-full p-1 text-white/80 hover:bg-white/15 !shadow-none"><X size={14} /></button>
      <p className="pr-6 text-base font-black leading-tight sm:text-[17px]">{node.label}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-snug text-white/85 sm:text-[11px]">
        3 nấc Dễ, Vừa, Khó. Xong nấc trước mới mở nấc sau
      </p>
      <ul className="mt-2 space-y-1.5">
        {(node.levels || []).map((step, index) => {
          const locked = step.state === 'locked';
          const done = step.state === 'completed';
          const Icon = STEP_ICONS[step.key] || Dumbbell;
          return (
            <li key={step.key} className={`rounded-xl border px-2.5 py-2 ${locked ? 'border-white/10 bg-black/10 opacity-60' : 'border-white/25 bg-white/10'}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15">
                  {done ? <Check size={14} /> : locked ? <Lock size={12} /> : <Icon size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black leading-tight sm:text-[13px]">Nấc {index + 1} · {STEP_LABELS[step.key] || step.label}</p>
                  <p className="text-[10px] font-bold leading-tight text-white/75">
                    {done
                      ? `Đã xong · Ôn lại (0 XP) · cần đúng ${step.passPercent}%`
                      : `Cần đúng ${step.passPercent}% · ${QUESTION_STAKE_XP} XP/câu`}
                  </p>
                </div>
                {!locked && (
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => onStartStep(step.key, { review: done })}
                    className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase text-slate-800 !shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[11px]"
                  >
                    {starting ? '…' : done ? 'Ôn lại' : 'Làm'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bảng bắt đầu kiểm tra vượt chặng. */
function StepPopover({ unit, step, testOut, canTestOut, color, starting, onClose, onStart, onUpgrade }) {
  const order = unit.steps.findIndex((item) => item.key === step.key) + 1;
  return (
    <div className="dp-pop relative w-full max-w-xs rounded-2xl p-4 text-left text-white shadow-lg" style={{ background: `linear-gradient(160deg, ${color.from}, ${color.to})` }}>
      <span data-pop-arrow className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45" style={{ background: color.from }} />
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-2 top-2 rounded-full p-1 text-white/80 hover:bg-white/15 !shadow-none"><X size={16} /></button>
      <p className="text-lg font-black">{testOut ? 'Kiểm tra vượt chặng' : step.label}</p>
      <p className="text-xs font-semibold text-white/85">
        {testOut ? `Chặng ${unit.index} · Đạt ${step.passPercent}% để vượt chặng` : `Bước ${order}/${unit.steps.length} · Cần đúng ${step.passPercent}%`}
      </p>
      <p className="mt-1 text-xs text-white/80">
        {testOut
          ? (!canTestOut
            ? 'Đặc quyền chỉ dành cho học viên đã đăng ký khóa học. Học viên miễn phí chưa thể thi vượt chặng.'
            : `Đạt thì được ${TEST_OUT_XP} XP và vượt chặng. Không đạt hoặc thoát thì mất ${TEST_OUT_XP} XP.`)
          : step.state === 'completed'
            ? 'Ôn lại miễn phí: làm sai không trừ XP, thoát giữa chừng không mất XP.'
            : `${QUESTION_STAKE_XP} XP/câu · Đạt % yêu cầu nhận +${QUESTION_STAKE_XP} XP/câu đúng (ôn lại không mất XP).`}
      </p>
      {testOut && !canTestOut ? (
        <button
          type="button"
          onClick={onUpgrade}
          className="dp-3d-btn mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-black uppercase tracking-wide text-amber-950 shadow-md hover:bg-amber-300"
        >
          <Crown size={15} /> Nâng cấp gói để vượt
        </button>
      ) : (
        <button
          type="button"
          disabled={starting}
          onClick={onStart}
          className="dp-3d-btn dp-3d-btn--light mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-black uppercase tracking-wide"
          style={{ color: color.to }}
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {step.state === 'completed' && !testOut
            ? 'Ôn lại · Miễn phí XP'
            : `${'Bắt đầu'} · ${testOut ? TEST_OUT_XP : `${QUESTION_STAKE_XP}/câu`}`}
        </button>
      )}
    </div>
  );
}

const FINALE_CONFETTI = ['#F59E0B', '#EF4444', '#10B981', '#0EA5E9', '#A855F7', '#F97316', '#FACC15'];

function PathConfettiBurst({ count = 36, spread = 220 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 4) * 0.14;
    const distance = spread * (0.48 + ((i * 7) % 11) / 17);
    return {
      dx: `${Math.round(Math.cos(angle) * distance)}px`,
      dy: `${Math.round(Math.sin(angle) * distance - 44)}px`,
      rot: `${(i * 73) % 720 - 360}deg`,
      color: FINALE_CONFETTI[i % FINALE_CONFETTI.length],
      delay: `${(i * 38) % 300}ms`,
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

/** Popup hiệu ứng vinh danh & chúc mừng hoàn thành khóa học (Cúp vàng + Linh vật + Pháo giấy). */
function CourseTrophyCeremonyModal({ topicName, completedUnits, totalUnits, isCompleted, onClose }) {
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    gameSounds.win();
  }, [burstKey]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Chúc mừng hoàn thành khóa học"
      onClick={onClose}
    >
      <div
        className="dp-pop relative w-full max-w-lg overflow-hidden rounded-[32px] border-2 border-amber-300 bg-gradient-to-b from-amber-50 via-white to-amber-50/60 p-6 text-center shadow-[0_28px_70px_-12px_rgba(245,158,11,0.45)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div key={burstKey}>
          <PathConfettiBurst count={48} spread={250} />
        </div>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-300/35 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-800 !shadow-none"
        >
          <X size={18} />
        </button>

        <div className="relative inline-flex items-center gap-1.5 rounded-full bg-[#D97706] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Award size={14} className="fill-[#FEF08A] text-[#FEF08A]" aria-hidden="true" />
          <span>CHỨNG NHẬN CHINH PHỤC LỘ TRÌNH</span>
        </div>

        <div className="relative mt-6 flex items-end justify-center gap-4 sm:gap-7">
          <div className="shrink-0">
            <Mascot mood="graduate" size={88} />
          </div>
          <div className="relative flex flex-col items-center">
            <div className="relative -mb-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#EA580C] shadow-sm">
              <Crown size={18} className="fill-[#FEF08A] text-white" aria-hidden="true" />
            </div>
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#FEF3C7] bg-[#F59E0B] text-white shadow-[0_12px_28px_rgba(217,119,6,0.36)]">
              <Trophy size={54} strokeWidth={2} className="drop-shadow-sm text-white" aria-hidden="true" />
            </div>
            <div className="relative -mt-3 z-10 inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-white px-3.5 py-1 shadow-xs">
              {[1, 2, 3].map((n) => (
                <Star key={n} size={15} className="fill-[#FBBF24] text-[#F59E0B]" />
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <Mascot mood="celebrate" size={88} />
          </div>
        </div>

        <h3 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {`Cúp Vàng Danh Dự - ${topicName}`}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm font-normal leading-relaxed text-[#475569]">
          {isCompleted
            ? 'Chứng nhận bạn đã hoàn thành xuất sắc tất cả chặng thử thách của lộ trình. Hãy tự hào về hành trình kiên trì mỗi ngày của bạn!'
            : `Bạn đang trên chặng đường rước Cúp (${completedUnits}/${totalUnits} chặng đã xong). Cố gắng hoàn thành nốt các chặng còn lại nhé!`}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-amber-200 bg-white/90 p-3 shadow-sm">
            <p className="text-lg font-bold text-slate-900 tabular-nums">{completedUnits}/{totalUnits}</p>
            <p className="text-[11px] font-medium text-slate-500">Chặng đạt</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/90 p-3 shadow-sm">
            <p className="text-lg font-bold text-emerald-600">Cúp Vàng</p>
            <p className="text-[11px] font-medium text-slate-500">Danh hiệu</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white/90 p-3 shadow-sm">
            <p className="text-lg font-bold text-amber-600">{isCompleted ? '100%' : `${Math.round((completedUnits / (totalUnits || 1)) * 100)}%`}</p>
            <p className="text-[11px] font-medium text-slate-500">Khóa học</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setBurstKey((k) => k + 1)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-amber-300 bg-amber-50 py-3 text-xs font-black uppercase tracking-wide text-amber-900 transition hover:bg-amber-100 !shadow-none"
          >
            <Sparkles size={16} className="text-amber-600" /> Bắn pháo hoa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="dp-3d-btn flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-xs font-black uppercase tracking-wide text-white shadow-md hover:from-amber-600 hover:to-orange-600"
          >
            <Trophy size={16} /> Tuyệt vời!
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Hình cúp đồ họa. Chưa xong thì xám mờ, hoàn thành thì vàng. */
function CupArtwork({ dim = false }) {
  const rawId = useId();
  const gid = `cup${rawId.replace(/:/g, '')}`;
  const tone = dim
    ? {
      hi: '#F8FAFC', mid: '#CBD5E1', deep: '#64748B', ink: '#0F172A',
      handle: '#334155', handleEdge: '#1E293B', handleLite: '#94A3B8', handleLiteEdge: '#64748B',
      stem: '#475569', baseTop: '#334155',
    }
    : {
      hi: '#FFFBEB', mid: '#FDE68A', deep: '#F59E0B', ink: '#B45309',
      handle: '#D97706', handleEdge: '#92400E', handleLite: '#FBBF24', handleLiteEdge: '#F59E0B',
      stem: '#D97706', baseTop: '#B45309',
    };
  return (
    <svg
      width={dim ? 168 : 214}
      height={dim ? 192 : 244}
      viewBox="0 0 220 250"
      className={dim ? 'opacity-30' : 'dp-cup-zoom'}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${gid}-body`} x1="28%" y1="0%" x2="78%" y2="100%">
          <stop offset="0%" stopColor={tone.hi} />
          <stop offset="30%" stopColor={tone.mid} />
          <stop offset="64%" stopColor={tone.deep} />
          <stop offset="100%" stopColor={tone.ink} />
        </linearGradient>
        <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.hi} />
          <stop offset="100%" stopColor={tone.ink} />
        </linearGradient>
        <linearGradient id={`${gid}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.mid} />
          <stop offset="100%" stopColor={tone.ink} />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="232" rx="64" ry="9" fill={tone.ink} opacity="0.18" />
      <path d="M58 78c-28 2-34 48-6 62 6-16 4-40 14-52-2-4-4-8-8-10z" fill={tone.handle} />
      <path d="M162 78c28 2 34 48 6 62-6-16-4-40-14-52 2-4 4-8 8-10z" fill={tone.handleEdge} />
      <path d="M66 64c-22 6-24 46 2 58 2-14 6-36 16-46-4-6-10-10-18-12z" fill={tone.handleLite} />
      <path d="M154 64c22 6 24 46-2 58-2-14-6-36-16-46 4-6 10-10 18-12z" fill={tone.handleLiteEdge} />
      <path d="M74 58c-2 0-8 78 16 108h40c24-30 18-108 16-108-8 10-20 16-36 16s-28-6-36-16z" fill={`url(#${gid}-body)`} />
      <ellipse cx="110" cy="58" rx="48" ry="16" fill={`url(#${gid}-rim)`} />
      <ellipse cx="110" cy="56" rx="34" ry="8" fill={tone.ink} opacity="0.42" />
      <ellipse cx="90" cy="98" rx="14" ry="28" fill="#FFFFFF" opacity="0.62" />
      <path d="M110 86l6.2 12.6 13.8 2-10 9.8 2.4 13.6L110 117.4 97.6 124l2.4-13.6-10-9.8 13.8-2z" fill={tone.hi} />
      <path d="M110 92l3.4 7 7.6 1.1-5.5 5.4 1.3 7.5L110 109.2 103.2 113l1.3-7.5-5.5-5.4 7.6-1.1z" fill={tone.ink} />
      <path d="M96 166h28l10 24H86z" fill={tone.stem} />
      <ellipse cx="110" cy="196" rx="46" ry="12" fill={tone.ink} />
      <ellipse cx="110" cy="190" rx="40" ry="9" fill={`url(#${gid}-base)`} />
      <ellipse cx="110" cy="214" rx="58" ry="13" fill={tone.ink} />
      <ellipse cx="110" cy="208" rx="50" ry="10" fill={tone.baseTop} />
      <ellipse cx="92" cy="204" rx="16" ry="4" fill="#FFFFFF" opacity="0.45" />
    </svg>
  );
}

const CUP_SPARKS = ['#FACC15', '#F97316', '#EF4444', '#22C55E', '#38BDF8', '#A855F7', '#F472B6', '#FDE68A'];

/** Cúp đồ họa mờ dưới rương chặng cuối. Hoàn thành thì phóng to và bắn pháo. */
function CourseFinaleCup({ courseDone, onCelebrate }) {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!courseDone) return undefined;
    const timer = setInterval(() => setBurst((n) => n + 1), 2600);
    return () => clearInterval(timer);
  }, [courseDone]);
  return (
    <button
      type="button"
      onClick={onCelebrate}
      className="relative mx-auto -mt-1 mb-1 flex h-[250px] w-full max-w-[380px] items-end justify-center overflow-visible border-0 bg-transparent p-0"
      aria-label="Cúp Vàng Vinh Danh cuối khóa"
    >
      {courseDone ? (
        <span key={burst} className="pointer-events-none absolute inset-0">
          <PathConfettiBurst count={26} spread={150} />
          {CUP_SPARKS.map((color, index) => {
            const angle = (index / CUP_SPARKS.length) * Math.PI * 2;
            return (
              <span
                key={color}
                className="dp-firework"
                style={{
                  color,
                  background: color,
                  left: '50%',
                  top: '42%',
                  '--dx': `${Math.round(Math.cos(angle) * 118)}px`,
                  '--dy': `${Math.round(Math.sin(angle) * 78 - 18)}px`,
                  animationDelay: `${index * 45}ms`,
                }}
              />
            );
          })}
        </span>
      ) : null}
      <CupArtwork dim={!courseDone} />
    </button>
  );
}
/** Bài đang mở của chặng: bài học thì vào bài, câu hỏi thì vào đúng nấc. */
export function continuePracticeTarget(topic) {
  const next = topic?.next;
  if (!next?.unitId) return null;
  const unit = (topic.units || []).find((item) => item.id === next.unitId);
  if (!unit || unit.state === 'locked') return null;
  const node = (unit.pathNodes || []).find((item) => item.key === next.nodeKey);
  const level = (node?.levels || []).find((item) => item.key === next.step)
    || (node?.levels || []).find((item) => item.state === 'active');
  if (level?.state === 'locked') return null;
  return {
    topicId: topic.topic?.id || '',
    unit,
    level,
    kind: level?.kind || next.kind || 'quiz',
    nodeKey: node?.key || next.nodeKey || 'study',
    step: level?.key || next.step || 'learn',
  };
}

/**
 * Video tiếp theo chuẩn theo tiến độ học viên:
 * "Luyện tập tới đâu xem video tới đó"
 * 1. Xác định chặng (Unit) đang học dở (next.unitId hoặc state === 'active' hoặc chặng mở cuối cùng).
 * 2. Trong chặng đó:
 *    - Nếu có node đang luyện (next.nodeKey): ưu tiên video của node đó.
 *    - Tìm video chưa xem trong chặng.
 *    - Nếu đã xem hết video chặng này: phát video chính của chặng đang luyện để ôn bài (không nhảy về chặng 1).
 * 3. Nếu chặng hiện tại không có video: lùi về các chặng trước đã mở có video gần nhất (tuyệt đối không nhảy tới chặng bị khóa).
 */
export function continueStageTarget(topic) {
  const units = topic?.units || [];
  if (!units.length) return null;
  const nextId = topic?.next?.unitId || '';
  const nextNodeKey = topic?.next?.nodeKey || '';

  let targetUnitIndex = -1;
  if (nextId) {
    targetUnitIndex = units.findIndex((u) => u.id === nextId);
  }
  if (targetUnitIndex < 0) {
    targetUnitIndex = units.findIndex((u) => u.state === 'active');
  }
  if (targetUnitIndex < 0) {
    for (let i = units.length - 1; i >= 0; i--) {
      if (units[i].state !== 'locked') {
        targetUnitIndex = i;
        break;
      }
    }
  }
  if (targetUnitIndex < 0) targetUnitIndex = 0;

  const resolveUnitVideo = (unit, preferNodeKey = '') => {
    if (!unit || unit.state === 'locked') return null;

    if (Array.isArray(unit.pathNodes)) {
      const activeNode = (preferNodeKey && unit.pathNodes.find((n) => n.key === preferNodeKey))
        || unit.pathNodes.find((n) => n.state === 'active');
      if (activeNode) {
        const nodeVideos = collectNodeVideos(unit, activeNode);
        const pendingInNode = nodeVideos.find((v) => v.state !== 'completed' && v.state !== 'locked');
        if (pendingInNode) return { unit, videoId: pendingInNode.id };
        const unlockedInNode = nodeVideos.find((v) => v.state !== 'locked');
        if (unlockedInNode) return { unit, videoId: unlockedInNode.id };
      }
    }

    const videos = collectUnitVideos(unit);
    const pending = videos.find((v) => v.state !== 'completed' && v.state !== 'locked');
    if (pending) return { unit, videoId: pending.id };
    if (unit.lesson) return { unit, videoId: '' };
    const firstUnlocked = videos.find((v) => v.state !== 'locked');
    if (firstUnlocked) return { unit, videoId: firstUnlocked.id };
    return null;
  };

  const activeUnit = units[targetUnitIndex];
  const directMatch = resolveUnitVideo(activeUnit, nextNodeKey);
  if (directMatch) {
    return { topicId: topic?.topic?.id || '', unit: directMatch.unit, videoId: directMatch.videoId };
  }

  for (let i = targetUnitIndex - 1; i >= 0; i--) {
    const prevMatch = resolveUnitVideo(units[i]);
    if (prevMatch) {
      return { topicId: topic?.topic?.id || '', unit: prevMatch.unit, videoId: prevMatch.videoId };
    }
  }

  for (let i = targetUnitIndex + 1; i < units.length; i++) {
    if (units[i].state === 'locked') break;
    const nextMatch = resolveUnitVideo(units[i]);
    if (nextMatch) {
      return { topicId: topic?.topic?.id || '', unit: nextMatch.unit, videoId: nextMatch.videoId };
    }
  }

  return null;
}

/** Cuộn đúng nút bài đang học ra giữa màn hình. */
export function focusCurrentPathLesson() {
  window.dispatchEvent(new CustomEvent('dp-focus-current-lesson'));
}

/** Chủ đề lộ trình ưu tiên (URL → đã lưu server/máy → đang học dở → còn bước → đầu danh sách). */
export function pickActivePathTopic(path, initialTopicId = '', savedTopicId = '') {
  const saved = savedTopicId || resolveSavedPathTopicId(readStudentUserId(), path?.activeTopicId);
  return pickActivePathTopicShared(path, initialTopicId, saved);
}

/** Chọn khóa học DewSkill phù hợp với chủ đề đang mở để bật modal kích hoạt. */
export function resolveUpgradeCourse(allVisibleClasses = [], activeCourse = null, currentTopicId = '') {
  const classes = Array.isArray(allVisibleClasses) ? allVisibleClasses : [];
  const tid = String(currentTopicId || '').trim();
  if (tid) {
    const matching = classes.filter((cls) => (cls?.dailyPracticeTopicIds || []).some(
      (item) => String(item?._id || item?.id || item || '').trim() === tid,
    ));
    if (matching.length) {
      return matching.find((cls) => cls?.accessLevel !== 'full') || matching[0];
    }
  }
  const activeId = String(activeCourse?.id || activeCourse?._id || '').trim();
  const activeRaw = activeCourse?.rawClass
    || (activeId ? classes.find((cls) => String(cls?._id || cls?.id || '').trim() === activeId) : null)
    || (activeCourse?._id ? activeCourse : null);
  if (activeRaw && activeRaw.accessLevel !== 'full') return activeRaw;
  return classes.find((cls) => cls?.accessLevel !== 'full') || activeRaw || classes[0] || null;
}

/** Lộ trình luyện tập: chủ đề → chặng → Học / Luyện / Thử thách / Kiểm tra chặng (mở khóa tuần tự). */
export default function PathView({
  path, practiceStats, loading, error, starting, initialTopicId = '', activeTopicId = '',
  onTopicChange, onStartStep, onPathChanged, layout = 'default', showSubjectBar = true,
  continueVideo = false, onContinueVideoOpened, requestedLesson = null, onRequestedLessonOpened,
}) {
  const { activeCourse, allVisibleClasses, loading: coursesLoading, refreshCourses } = useActiveCourse();
  const topics = useMemo(() => path?.topics || [], [path]);
  const [topicId, setTopicId] = useState('');
  const onTopicChangeRef = useRef(onTopicChange);
  const lastNotifiedTopicRef = useRef('');
  const lastSyncedPropTopicRef = useRef(activeTopicId);
  onTopicChangeRef.current = onTopicChange;

  useEffect(() => {
    if (!topicId) return;
    lastNotifiedTopicRef.current = topicId;
    onTopicChangeRef.current?.(topicId);
    persistLastPathTopicId(topicId);
  }, [topicId]);

  useEffect(() => {
    syncLastPathTopicFromServer(path?.activeTopicId);
  }, [path?.activeTopicId]);
  const [popover, setPopover] = useState(null);
  const [videoOpen, setVideoOpen] = useState(null);
  const [roadmapOpen, setRoadmapOpen] = useState(null);
  const [lessonOpen, setLessonOpen] = useState(null);
  const [milestoneOpen, setMilestoneOpen] = useState(null);
  const [welcomeLesson, setWelcomeLesson] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const openUpgradeModal = useCallback(() => {
    setPopover(null);
    setUpgradeOpen(true);
    if (!allVisibleClasses.length) {
      refreshCourses?.();
    }
  }, [allVisibleClasses.length, refreshCourses]);
  const [trophyModalOpen, setTrophyModalOpen] = useState(false);
  const hubAnchorRef = useRef(null);
  const testOutAnchorRef = useRef(null);
  const continueOpenedRef = useRef(false);
  const onContinueOpenedRef = useRef(onContinueVideoOpened);
  const onRequestedLessonOpenedRef = useRef(onRequestedLessonOpened);
  onContinueOpenedRef.current = onContinueVideoOpened;
  onRequestedLessonOpenedRef.current = onRequestedLessonOpened;
  const closePopover = useCallback(() => setPopover(null), []);
  const closeVideo = useCallback(() => {
    setVideoOpen(null);
    onPathChanged?.();
  }, [onPathChanged]);
  const closeLesson = useCallback(() => {
    setLessonOpen(null);
    onPathChanged?.();
  }, [onPathChanged]);

  const [startedUnitIds, setStartedUnitIds] = useState(() => {
    try {
      const raw = localStorage.getItem('cms_started_path_units');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const markUnitStarted = useCallback((unitId) => {
    if (!unitId) return;
    setStartedUnitIds((prev) => {
      if (prev.includes(unitId)) return prev;
      const next = [...prev, unitId];
      try {
        localStorage.setItem('cms_started_path_units', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (topicId && topics.some((item) => item.topic.id === topicId)) return;
    if (!topics.length) return;
    const picked = pickActivePathTopicShared(
      { topics },
      initialTopicId,
      resolveSavedPathTopicId(readStudentUserId(), path?.activeTopicId),
    );
    if (picked?.topic?.id) setTopicId(picked.topic.id);
  }, [topicId, topics, initialTopicId, path?.activeTopicId]);

  useEffect(() => {
    if (!activeTopicId) {
      lastSyncedPropTopicRef.current = '';
      return;
    }
    if (!topics.some((item) => item.topic.id === activeTopicId)) return;
    if (activeTopicId === lastSyncedPropTopicRef.current) return;
    lastSyncedPropTopicRef.current = activeTopicId;
    if (activeTopicId === lastNotifiedTopicRef.current) return;
    setTopicId((prev) => (prev === activeTopicId ? prev : activeTopicId));
    setPopover(null);
  }, [activeTopicId, topics]);

  useEffect(() => {
    if (error) setPopover(null);
  }, [error]);

  useEffect(() => {
    if (!requestedLesson?.unit) return;
    const desiredTopicId = requestedLesson.topicId
      || topics.find((item) => item.units?.some((u) => u.id === requestedLesson.unit.id))?.topic?.id;
    if (desiredTopicId && topicId !== desiredTopicId) {
      setTopicId(desiredTopicId);
      return;
    }
    const targetNodeKey = requestedLesson.nodeKey || '';
    const targetUnit = (topics.find((item) => item.topic.id === (desiredTopicId || topicId))?.units || [])
      .find((u) => u.id === requestedLesson.unit.id) || requestedLesson.unit;
    const targetNode = targetNodeKey ? (targetUnit?.pathNodes || []).find((n) => n.key === targetNodeKey) : null;
    if (requestedLesson.openMilestone || (targetNode && (targetNode.kind === 'study' || targetNode.icon === 'book'))) {
      markUnitStarted(requestedLesson.unit.id);
      setPopover(null);
      setMilestoneOpen({
        unitId: requestedLesson.unit.id,
        nodeKey: targetNodeKey || 'study',
        initialDifficulty: requestedLesson.initialDifficulty ?? null,
        initialSection: requestedLesson.initialSection ?? null,
      });
      onRequestedLessonOpenedRef.current?.();
      return;
    }
    if (!requestedLesson?.level) return;
    setLessonOpen({
      unit: requestedLesson.unit,
      lesson: requestedLesson.level,
      color: unitColor(requestedLesson.unit.index),
    });
    onRequestedLessonOpenedRef.current?.();
  }, [requestedLesson, markUnitStarted, topics, topicId]);

  useEffect(() => {
    if (!continueVideo) {
      continueOpenedRef.current = false;
      return;
    }
    if (continueOpenedRef.current || !topics.length) return;
    const currentTopic = topics.find((item) => item.topic.id === topicId);
    const currentTarget = currentTopic ? continueStageTarget(currentTopic) : null;
    const preferred = currentTarget
      ? currentTopic
      : (topics.find((item) => item.next && continueStageTarget(item))
         || topics.find((item) => continueStageTarget(item))
         || topics[0]);
    const target = currentTarget || (preferred ? continueStageTarget(preferred) : null);
    if (!preferred || !target) {
      onContinueOpenedRef.current?.();
      return;
    }
    if (topicId !== preferred.topic.id) {
      setTopicId(preferred.topic.id);
      return;
    }
    continueOpenedRef.current = true;
    const firstStudyKey = target.unit?.pathNodes?.[0]?.key || 'study';
    setPopover(null);
    setMilestoneOpen({ unitId: target.unit.id, nodeKey: firstStudyKey });
    onContinueOpenedRef.current?.();
  }, [continueVideo, topics, topicId]);

  useEffect(() => {
    if (!popover || videoOpen || lessonOpen) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-path-popover]') || target.closest('[data-path-hub]')) return;
      setPopover(null);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPopover(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popover, videoOpen, lessonOpen]);

  const current = topics.find((item) => item.topic.id === topicId) || null;
  const upgradeCourse = useMemo(
    () => resolveUpgradeCourse(allVisibleClasses, activeCourse, current?.topic?.id || topicId),
    [allVisibleClasses, activeCourse, current?.topic?.id, topicId],
  );
  useEffect(() => {
    if (upgradeOpen && !coursesLoading && !upgradeCourse) {
      setUpgradeOpen(false);
    }
  }, [upgradeOpen, coursesLoading, upgradeCourse]);
  const newlyUnlockedUnitId = useNewlyUnlockedUnit(current?.units || []);
  const newlyUnlockedUnit = useMemo(
    () => (newlyUnlockedUnitId ? current?.units?.find((u) => u.id === newlyUnlockedUnitId) || null : null),
    [current, newlyUnlockedUnitId],
  );
  const topicsRef = useRef(topics);
  const currentRef = useRef(current);
  topicsRef.current = topics;
  currentRef.current = current;

  useEffect(() => {
    const onFocus = () => {
      const list = topicsRef.current || [];
      const topic = (currentRef.current?.next ? currentRef.current : list.find((item) => item.next)) || currentRef.current;
      const next = topic?.next;
      if (!topic || !next) return;
      if (next.unitId) markUnitStarted(next.unitId);
      if (topic.topic.id !== currentRef.current?.topic?.id) setTopicId(topic.topic.id);
      const targetKey = next.nodeKey || 'study';
      const targetUnit = (topic.units || []).find((u) => u.id === next.unitId);
      const targetNode = (targetUnit?.pathNodes || []).find((n) => n.key === targetKey);
      if (targetNode && (targetNode.kind === 'study' || targetNode.icon === 'book')) {
        setPopover(null);
        setMilestoneOpen({ unitId: next.unitId, nodeKey: targetKey });
      } else {
        setPopover({ unitId: next.unitId, nodeKey: targetKey, testOut: false });
      }
      window.setTimeout(() => {
        document.querySelector('[data-path-current]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }, 160);
    };
    window.addEventListener('dp-focus-current-lesson', onFocus);
    return () => window.removeEventListener('dp-focus-current-lesson', onFocus);
  }, [markUnitStarted]);
  const openHub = useMemo(() => {
    if (!popover || popover.testOut || !current) return null;
    const unit = current.units.find((item) => item.id === popover.unitId);
    if (!unit) return null;
    const node = (unit.pathNodes || []).find((item) => item.key === popover.nodeKey);
    if (!node) return null;
    const stages = buildUnitStages(unit, unit.state === 'locked', practiceStats);
    const activeStage = stages.find((s) => s.nodeKey === node.key) || stages[0] || null;
    return { unit, node, stages, activeStage, tone: unitColor(unit.index) };
  }, [popover, current, practiceStats]);
  const openTestOut = useMemo(() => {
    if (!popover?.testOut || !current) return null;
    const unit = current.units.find((item) => item.id === popover.unitId);
    if (!unit) return null;
    const step = unit.pathNodes?.flatMap((n) => n.levels || []).find((level) => level.key === 'challenge')
      || unit.steps.find((s) => s.key === 'challenge');
    if (!step) return null;
    return { unit, step };
  }, [popover, current]);
  const errorBanner = error ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p> : null;

  if (loading && !path) {
    return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải lộ trình…</p>;
  }
  if (error && !topics.length) return errorBanner;
  if (!topics.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Mascot mood="thinking" size={80} className="mx-auto" />
        <p className="mt-3 font-bold text-slate-700">Trung tâm đang soạn lộ trình luyện tập.</p>
        <p className="text-sm text-slate-500">Bạn có thể dùng chế độ Luyện tự do trong lúc chờ nhé!</p>
      </div>
    );
  }

  const toggle = (unit, stepKey, testOut = false) => {
    gameSounds.tap();
    if (unit?.id) markUnitStarted(unit.id);
    setPopover((prev) => (prev && prev.unitId === unit.id && prev.stepKey === stepKey && prev.testOut === testOut
      ? null
      : { unitId: unit.id, stepKey, testOut }));
  };
  const isStudyFirstNode = (unit, nodeKey) => {
    const nodes = unit?.pathNodes || [];
    const idx = nodes.findIndex((n) => n.key === nodeKey);
    const node = idx >= 0 ? nodes[idx] : null;
    return Boolean(node && (idx === 0 || node.kind === 'study' || node.icon === 'book' || node.icon === 'clipboard'));
  };
  const toggleHub = (unit, nodeKey) => {
    gameSounds.tap();
    if (unit?.id) markUnitStarted(unit.id);
    if (unit?.state === 'locked' && unit?.requiresSubscription) {
      openUpgradeModal();
      return;
    }
    const node = (unit?.pathNodes || []).find((n) => n.key === nodeKey);
    if (unit?.state !== 'locked' && node && node.state !== 'locked' && isStudyFirstNode(unit, nodeKey)) {
      setPopover(null);
      setMilestoneOpen({ unitId: unit.id, nodeKey });
      return;
    }
    setPopover((prev) => (prev && prev.unitId === unit.id && prev.nodeKey === nodeKey && !prev.testOut
      ? null
      : { unitId: unit.id, nodeKey, testOut: false }));
  };
  const openUnitStageAction = (unit, isNextUnit) => {
    gameSounds.tap();
    markUnitStarted(unit.id);
    let nodeKey = 'study';
    if (unit.state === 'completed') {
      nodeKey = unit.pathNodes?.[0]?.key || 'study';
    } else if (isNextUnit && current?.next?.unitId === unit.id && current.next.nodeKey) {
      nodeKey = current.next.nodeKey;
    } else {
      const active = unit.pathNodes?.find((n) => n.state === 'active');
      nodeKey = active?.key || unit.pathNodes?.[0]?.key || 'study';
    }
    const node = (unit.pathNodes || []).find((n) => n.key === nodeKey);
    if (node && (node.kind === 'study' || node.icon === 'book')) {
      setPopover(null);
      setMilestoneOpen({ unitId: unit.id, nodeKey });
      return;
    }
    setPopover({ unitId: unit.id, nodeKey, testOut: false });
  };
  const wide = layout === 'wide';
  const laneWidthPx = wide ? 520 : 420;

  return (
    <div className="space-y-4">
      {errorBanner}
      {showSubjectBar ? (
        <div className="dp-dew-subject-strip">
          {topics.map((item) => {
            const Icon = topicIcon(item.topic.icon);
            const tone = topicColor(item.topic.color);
            const active = item.topic.id === topicId;
            return (
              <button
                key={item.topic.id}
                type="button"
                onClick={() => { gameSounds.tap(); setTopicId(item.topic.id); setPopover(null); }}
                className={`dp-dew-subject-chip flex shrink-0 items-center gap-2.5 px-3.5 py-3 text-left !shadow-none sm:min-w-[168px] ${active ? 'dp-dew-subject-chip--active' : ''}`}
                style={{ borderColor: active ? tone.to : '#E2E8F0', background: active ? tone.soft : '#FFFFFF' }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: `linear-gradient(180deg, ${tone.from}, ${tone.to})` }}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-900">{item.topic.name}</span>
                  <span className="block text-[11px] font-bold text-emerald-600">
                    {item.totalUnits > 0 ? 'Đã sẵn sàng' : 'Đang soạn'}
                    <span className="ml-1 font-semibold text-slate-400">· {item.completedUnits}/{item.totalUnits}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {current && (
        <>
          {newlyUnlockedUnit && (
            <LevelUnlockEffect unlockedUnit={newlyUnlockedUnit} active />
          )}

          <div className="dp-dew-path-lane relative space-y-5 overflow-visible">
            {current.units.map((unit, unitIndex) => {
              const tone = unitColor(unit.index);
              const locked = unit.state === 'locked';
              const testOutOpen = popover?.unitId === unit.id && popover.testOut;
              const isNextUnit = current.next?.unitId === unit.id;
              const pathItems = buildUnitPathItems(unit);
              const unitVideos = collectUnitVideos(unit);
              const hasVideo = Boolean(unit.lesson) || unitVideos.length > 0;
              const nextIdx = pathItems.findIndex((item) => (
                current.next?.unitId === unit.id
                && (current.next.nodeKey ? current.next.nodeKey === item.node?.key : item.node?.key === 'study')
              ));
              const isLast = unitIndex === current.units.length - 1;
              const courseDone = !current.next && current.totalUnits > 0 && current.completedUnits >= current.totalUnits;
              return (
                <article key={unit.id} className="dp-path-unit-stage relative z-[2] w-full">
                  <div className="space-y-3">
                    <div className="relative z-20">
                      <UnitStageHeader
                        unit={unit}
                        color={tone}
                        highlight={isNextUnit}
                        hasVideo={hasVideo}
                        isStarted={startedUnitIds.includes(unit.id)}
                        onStartUnit={() => openUnitStageAction(unit, isNextUnit)}
                        onStageAction={() => openUnitStageAction(unit, isNextUnit)}
                        onTestOut={() => toggle(unit, 'challenge', true)}
                        onUpgrade={() => {
                          gameSounds.tap();
                          openUpgradeModal();
                        }}
                        onRoadmap={() => {
                          gameSounds.tap();
                          if (unit.requiresSubscription) {
                            openUpgradeModal();
                            return;
                          }
                          setPopover(null);
                          setRoadmapOpen({ unit });
                        }}
                        testOutButtonRef={testOutOpen ? testOutAnchorRef : undefined}
                      />
                    </div>

                    <div className="dp-path-unit-stage__journey relative z-30 w-full">
                      <DewdropHorizontalJourney
                        unit={unit}
                        topicName={current.topic?.name || ''}
                        pathItems={pathItems}
                        nextIdx={nextIdx}
                        hubSelectedKey={popover && !popover.testOut && popover.unitId === unit.id ? popover.nodeKey : ''}
                        locked={locked}
                        hubAnchorRef={hubAnchorRef}
                        onSelectNode={(nodeKey) => toggleHub(unit, nodeKey)}
                        onOpenLessonPill={(pill) => {
                          gameSounds.tap();
                          if (locked) {
                            if (unit.requiresSubscription) openUpgradeModal();
                            return;
                          }
                          const firstNodeKey = unit.pathNodes?.[0]?.key || 'study';
                          if (pill?.nodeKey === firstNodeKey && isStudyFirstNode(unit, firstNodeKey)) {
                            setPopover(null);
                            setMilestoneOpen({ unitId: unit.id, nodeKey: firstNodeKey });
                            return;
                          }
                          if (pill?.lesson && pill.lesson.state !== 'locked') {
                            setPopover(null);
                            setMilestoneOpen({ unitId: unit.id, nodeKey: pill?.nodeKey || firstNodeKey });
                            return;
                          }
                          if (pill?.action === 'roadmap') {
                            setPopover(null);
                            setRoadmapOpen({ unit });
                            return;
                          }
                          toggleHub(unit, pill?.nodeKey || firstNodeKey);
                        }}
                      />

                      {unit.state === 'completed' ? (
                        <div className="dp-path-unit-footer relative z-[2] mt-3 flex w-full justify-center px-1">
                          <UnitStageChest
                            unit={unit}
                            variant="chip"
                            onClaimed={() => onPathChanged?.()}
                          />
                        </div>
                      ) : null}

                      {isLast && courseDone ? (
                        <div className="relative z-[2] mt-2 flex w-full flex-col items-center pb-2">
                          <CourseFinaleCup
                            courseDone
                            onCelebrate={() => setTrophyModalOpen(true)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      {trophyModalOpen && current && (
        <CourseTrophyCeremonyModal
          topicName={current.topic.name}
          completedUnits={current.completedUnits}
          totalUnits={current.totalUnits}
          isCompleted={current.totalUnits > 0 && current.completedUnits >= current.totalUnits}
          onClose={() => setTrophyModalOpen(false)}
        />
      )}
      {openTestOut && (
        <PathHubPopoverPortal
          anchorRef={testOutAnchorRef}
          anchorKey={`testout:${openTestOut.unit.id}`}
        >
          <StepPopover
            unit={openTestOut.unit}
            step={openTestOut.step}
            testOut
            canTestOut={Boolean(current?.canTestOut ?? path?.canTestOut)}
            color={{ from: '#64748B', to: '#334155' }}
            starting={starting}
            onClose={closePopover}
            onUpgrade={openUpgradeModal}
            onStart={() => {
              setPopover(null);
              onStartStep(openTestOut.unit.id, 'study', 'challenge', true);
            }}
          />
        </PathHubPopoverPortal>
      )}
      {openHub && openHub.activeStage && (
        <StageNodePopover
          open
          stage={openHub.activeStage}
          stages={openHub.stages}
          anchorRef={hubAnchorRef}
          anchorKey={`${openHub.unit.id}:${openHub.node.key}`}
          starting={starting}
          canTestOut={Boolean(current?.canTestOut ?? path?.canTestOut)}
          onClose={closePopover}
          onSelectStage={(targetStage) => {
            if (!targetStage?.nodeKey) return;
            gameSounds.tap();
            setPopover({ unitId: openHub.unit.id, nodeKey: targetStage.nodeKey, testOut: false });
          }}
          onOpenLesson={(stage, opts) => {
            setPopover(null);
            setMilestoneOpen({
              unitId: openHub.unit.id,
              nodeKey: stage.nodeKey,
              initialSection: opts?.restart ? 'video' : null,
            });
          }}
          onStartPractice={(stage, opts) => {
            setPopover(null);
            onStartStep(
              openHub.unit.id,
              stage.nodeKey,
              opts?.stepKey || stage.nextLevelKey || 'learn',
              false,
              { review: typeof opts?.review === 'boolean' ? opts.review : stage.status === 'completed' },
            );
          }}
          onStartMilestone={(stage) => {
            setPopover(null);
            onStartStep(
              openHub.unit.id,
              stage.nodeKey,
              stage.nextLevelKey || 'challenge',
              false,
              { review: stage.status === 'completed' },
            );
          }}
          onUpgrade={openUpgradeModal}
        />
      )}
      {videoOpen && (
        <PathVideoModal
          unit={videoOpen.unit}
          initialVideoId={videoOpen.videoId}
          singleVideoOnly={Boolean(videoOpen.singleVideoOnly)}
          color={unitColor(videoOpen.unit.index)}
          onClose={closeVideo}
          onWatched={async (videoId) => {
            await dailyPracticeApi.student.videoWatched(videoOpen.unit.id, videoId);
            onPathChanged?.();
          }}
        />
      )}
      {roadmapOpen ? (
        <PathUnitRoadmapModal
          unit={roadmapOpen.unit}
          color={unitColor(roadmapOpen.unit.index)}
          onClose={() => setRoadmapOpen(null)}
          onPickNode={(nodeKey) => {
            const pickedUnit = roadmapOpen.unit;
            const pickedNode = (pickedUnit?.pathNodes || []).find((n) => n.key === nodeKey);
            setRoadmapOpen(null);
            if (pickedNode && (pickedNode.kind === 'study' || pickedNode.icon === 'book')) {
              setMilestoneOpen({ unitId: pickedUnit.id, nodeKey });
            } else {
              setPopover({ unitId: pickedUnit.id, nodeKey, testOut: false });
            }
          }}
          onOpenVideo={() => {
            const unit = roadmapOpen.unit;
            const vids = collectUnitVideos(unit);
            const preferred = vids.find((v) => v.state !== 'completed' && v.state !== 'locked')?.id || vids[0]?.id || '';
            setRoadmapOpen(null);
            setVideoOpen({ unit, videoId: preferred });
          }}
        />
      ) : null}
      {welcomeLesson && (
        <WelcomeBackModal
          unitIndex={welcomeLesson.unit?.index}
          unitTitle={welcomeLesson.unit?.title}
          lessonLabel={welcomeLesson.lesson?.title || welcomeLesson.lesson?.label || ''}
          onEnter={() => {
            setLessonOpen(welcomeLesson);
            setWelcomeLesson(null);
          }}
        />
      )}
      {milestoneOpen && (() => {
        const mUnit = (current?.units || []).find((u) => u.id === milestoneOpen.unitId);
        const mNodes = mUnit?.pathNodes || [];
        const mIdx = mNodes.findIndex((n) => n.key === milestoneOpen.nodeKey);
        const mNode = mIdx >= 0 ? mNodes[mIdx] : null;
        if (!mUnit || !mNode) return null;
        const nextStageNode = mNodes.find((n, idx) => idx > mIdx && n.state !== 'locked')
          || mNodes.find((n) => n.kind !== 'study' && n.icon !== 'book');
        return (
          <VideoLessonWorkspace
            topicName={current?.topic?.name || ''}
            unit={mUnit}
            node={mNode}
            initialDifficulty={milestoneOpen.initialDifficulty ?? null}
            onClose={() => setMilestoneOpen(null)}
            onProgressChanged={onPathChanged}
            onStartNextStage={nextStageNode ? () => {
              setMilestoneOpen(null);
              onStartStep(mUnit.id, nextStageNode.key, 'learn', false);
            } : undefined}
          />
        );
      })()}
      {lessonOpen && (
        <PathLessonModal
          lesson={lessonOpen.lesson}
          unit={lessonOpen.unit}
          unitId={lessonOpen.unit.id}
          color={lessonOpen.color}
          onClose={closeLesson}
          onComplete={async (videoId) => {
            await dailyPracticeApi.student.videoWatched(lessonOpen.unit.id, videoId);
            onPathChanged?.();
          }}
          onStartPractice={() => {
            const targetNode = lessonOpen.unit.pathNodes?.find((n) => n.kind !== 'study' && n.icon !== 'book');
            const nodeKey = targetNode?.key || 'practice';
            closeLesson();
            onStartStep(lessonOpen.unit.id, nodeKey, 'learn', false);
          }}
        />
      )}
      <CourseEnrollmentModal
        open={upgradeOpen && Boolean(upgradeCourse)}
        course={upgradeCourse}
        onClose={() => setUpgradeOpen(false)}
        onActivated={async () => {
          await refreshCourses?.();
          await onPathChanged?.();
        }}
      />
    </div>
  );
}

/** Kết quả bước lộ trình trên màn tổng kết. */
export function PathResultCard({ result }) {
  const passed = result.passed;
  const isGrandSuccess = Boolean(passed && (result.topicCompleted || result.unitCompleted || result.testOut));
  let title;
  let text;
  if (!passed) {
    title = `Chưa qua ${result.testOut ? 'bài kiểm tra vượt chặng' : `bước ${result.stepLabel}`}`;
    text = result.testOut
      ? `Bạn đạt ${result.scorePercent}% (cần ${result.passPercent}%). Mất ${TEST_OUT_XP} XP. Ôn lại rồi thử lại nhé!`
      : `Bạn đạt ${result.scorePercent}%, cần từ ${result.passPercent}%. Sai −${QUESTION_STAKE_XP}/câu và không nhận XP câu đúng. Thử lại nhé!`;
  } else if (result.topicCompleted && (result.unitCompleted || result.testOut)) {
    title = 'Hoàn thành toàn bộ lộ trình!';
    text = 'Bạn đã chinh phục mọi chặng của chủ đề này và giành Cúp Vàng Vinh Danh. Tuyệt vời!';
  } else if (result.testOut) {
    title = 'Vượt chặng thành công!';
    text = `Đã hoàn thành đến chặng “${result.unitTitle}”. Bạn được +${TEST_OUT_XP} XP.`;
  } else if (result.unitCompleted && (result.step === 'challenge' || result.step === 'checkpoint')) {
    title = `Hoàn thành chặng “${result.unitTitle}”!`;
    text = result.unlockedUnit ? `Đã mở khóa Chặng ${result.unlockedUnit.index}: ${result.unlockedUnit.title}` : 'Tiếp tục giữ phong độ nhé!';
  } else {
    title = `Qua bước ${result.stepLabel} (${result.scorePercent}%)`;
    text = result.next ? `Bước tiếp theo: ${result.next.stepLabel} · ${result.next.unitTitle}` : 'Tiếp tục giữ phong độ nhé!';
  }

  if (isGrandSuccess) {
    return (
      <section className="dp-slide-up relative flex items-center gap-4 overflow-hidden rounded-[24px] border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50/70 to-amber-50 p-4 shadow-sm sm:p-5">
        <PathConfettiBurst count={24} spread={160} />
        <div className="dp-bounce relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-white shadow-[0_5px_0_#B45309] ring-2 ring-amber-200">
          <Trophy size={28} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
            <Award size={12} /> {result.topicCompleted ? 'Cúp Vàng Khóa Học' : 'Cúp Vượt Chặng'}
          </span>
          <p className="mt-1 text-base font-black text-slate-900">{title}</p>
          <p className="text-xs font-semibold text-slate-600">{text}</p>
        </div>
        <Mascot mood="graduate" size={64} className="hidden shrink-0 sm:block" />
      </section>
    );
  }

  return (
    <section className={`dp-slide-up flex items-center gap-3 rounded-[24px] p-4 ring-1 ${passed ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${passed ? 'bg-emerald-600' : 'bg-amber-500'}`}>
        {passed ? <Route size={24} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-black ${passed ? 'text-emerald-800' : 'text-amber-800'}`}>{title}</p>
        <p className="text-xs font-semibold text-slate-600">{text}</p>
      </div>
    </section>
  );
}
