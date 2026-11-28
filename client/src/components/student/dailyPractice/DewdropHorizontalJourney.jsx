import { useEffect, useMemo, useState } from 'react';
import { pathNodeMapLabel } from '../../../../../shared/dailyPractice/pathNodeNudge.mjs';
import DewdropStageStepper from './DewdropStageStepper';
import { readVideoLessonProgress, VIDEO_LESSON_PROGRESS_EVENT } from './VideoLessonWorkspace';

/** Bản đồ lộ trình chặng hàng ngang thanh tiến trình động. */
export default function DewdropHorizontalJourney({
  unit,
  pathItems = [],
  nextIdx = -1,
  hubSelectedKey = '',
  locked = false,
  hubAnchorRef,
  onSelectNode,
}) {
  const [lessonProgressTick, setLessonProgressTick] = useState(0);
  useEffect(() => {
    const onLessonProgress = () => setLessonProgressTick((t) => t + 1);
    window.addEventListener(VIDEO_LESSON_PROGRESS_EVENT, onLessonProgress);
    return () => window.removeEventListener(VIDEO_LESSON_PROGRESS_EVENT, onLessonProgress);
  }, []);

  const count = pathItems.length;

  const crystalStages = useMemo(
    () => {
      void lessonProgressTick;
      const passedExercisesSet = new Set(Array.isArray(unit?.passedExercises) ? unit.passedExercises : []);
      return pathItems.map((item, index) => {
        const node = item.node || {};
        const isStudyOrExercise = index === 0 || node.kind === 'study' || node.icon === 'book' || node.icon === 'clipboard';
        const isLocked = locked || node.state === 'locked';
        const isDone = !isLocked && node.state === 'completed';
        const isCurrent = !isLocked && !isDone && (index === nextIdx || (nextIdx < 0 && node.state === 'active'));
        const isGoalTrophy = node.icon === 'crown' || (count >= 2 && index === count - 1);
        const rawLabel = pathNodeMapLabel(node);
        let displayLabel = isGoalTrophy && (!rawLabel || rawLabel === 'Hoàn thành')
          ? 'Vượt chặng'
          : (rawLabel || (index === 0 ? 'Học bài' : index === 1 ? 'Luyện tập' : index === 2 ? 'Thử thách' : 'Vượt chặng'));

        const levels = Array.isArray(node.levels) ? node.levels : [];
        const doneLevels = levels.filter((lv) => lv?.state === 'completed').length;
        const exercises = Array.isArray(node.exercises) ? node.exercises : [];
        const exercisesDone = exercises.filter((ex) => ex.passed || passedExercisesSet.has(`${node.key}:${ex.id}`)).length;
        const localLesson = isStudyOrExercise ? readVideoLessonProgress(unit?.id, node?.key) : null;
        const hasRealServerStudyCompletion = Boolean(
          unit?.testedOut
          || unit?.state === 'completed'
          || (unit?.completedSections?.length || 0) > 0
          || (unit?.watchedVideoIds?.length || 0) > 0
          || exercisesDone > 0
          || doneLevels > 0,
        );

        let progress = 0;
        if (!isLocked) {
          if (exercises.length > 0 && node.icon === 'clipboard' && !node.hasStudyContent) {
            progress = Math.round((exercisesDone / exercises.length) * 100);
          } else if (localLesson && typeof localLesson.pct === 'number') {
            progress = isDone && hasRealServerStudyCompletion ? Math.max(localLesson.pct, 100) : localLesson.pct;
          } else if (isDone) {
            progress = isStudyOrExercise && !hasRealServerStudyCompletion && levels.length === 0 && exercises.length === 0 ? 0 : 100;
          } else if (typeof node.progress === 'number' && Number.isFinite(node.progress)) {
            progress = Math.max(0, Math.min(100, Math.round(node.progress)));
          } else if (levels.length > 0 || exercises.length > 0) {
            const totalUnits = levels.length + exercises.length;
            const doneUnits = doneLevels + exercisesDone;
            progress = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;
          }
        }

        const effectiveDone = !isLocked && (progress >= 100 || (isDone && (!isStudyOrExercise || hasRealServerStudyCompletion || levels.length > 0 || exercises.length > 0)));
        if (isStudyOrExercise && !isGoalTrophy && !isLocked && !effectiveDone && displayLabel === 'Hoàn thành') {
          displayLabel = 'Học bài';
        }

        const status = isLocked
          ? 'locked'
          : effectiveDone
            ? 'completed'
            : isGoalTrophy
              ? 'milestone'
              : 'active';

        const icon = isLocked
          ? 'lock'
          : isGoalTrophy
            ? 'trophy'
            : node.icon === 'clipboard'
              ? 'clipboard'
              : index === 0
                ? 'user'
                : 'graduation';

        return {
          id: index + 1,
          nodeKey: node.key,
          nodeState: node.state,
          isCurrent,
          label: displayLabel,
          progress,
          status,
          icon,
          onClick: () => onSelectNode?.(node.key),
        };
      });
    },
    [pathItems, count, locked, nextIdx, onSelectNode, unit, lessonProgressTick],
  );

  if (!count) return null;

  return (
    <div className="w-full">
      <div className="relative rounded-[24px] border border-white/95 bg-gradient-to-r from-[#E0F2FE]/80 via-[#ECFEFF]/90 to-[#DCFCE7]/80 px-3 py-4 shadow-[inset_0_2px_0_rgba(255,255,255,0.95),0_10px_28px_-14px_rgba(16,185,129,0.16)] md:px-5 md:py-5">
        {/* Stepper Giọt Nước Pha Lê 3D */}
        <DewdropStageStepper
          stages={crystalStages}
          activeStageKey={hubSelectedKey}
          anchorRef={hubAnchorRef}
          className="!bg-transparent !py-4 !px-1 md:!px-3"
        />
      </div>
    </div>
  );
}
