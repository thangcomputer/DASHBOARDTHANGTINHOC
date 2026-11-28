import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Crown,
  Lock,
  Play,
  RotateCcw,
  Target,
  Zap,
} from 'lucide-react';
import { dewClass, getDewSkillThemeAttr } from '../../../utils/dewskillTheme';

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function resolvePopoverBorder(stage) {
  if (!stage) return { borderClass: 'border-emerald-400', arrowHex: '#34D399' };
  if (stage.status === 'locked') {
    return { borderClass: 'border-slate-200', arrowHex: '#E2E8F0' };
  }
  if (stage.type === 'milestone') {
    return { borderClass: 'border-amber-400', arrowHex: '#FBBF24' };
  }
  if ((Number(stage.progress) || 0) >= 100 || stage.status === 'completed') {
    return { borderClass: 'border-emerald-400', arrowHex: '#34D399' };
  }
  return { borderClass: 'border-blue-400', arrowHex: '#60A5FA' };
}

/**
 * Thẻ xem nhanh / hành động khi bấm vào từng giọt nước trên lộ trình.
 * Desktop: Floating Popover neo ngay dưới giọt nước có mũi tên chỉ tâm.
 * Mobile: Bottom Sheet trượt từ đáy lên có thanh kéo.
 */
export default function StageNodePopover({
  open,
  stage,
  stages = [],
  anchorRef,
  anchorKey = '',
  starting = false,
  canTestOut: _canTestOut = true,
  onClose,
  onSelectStage,
  onOpenLesson,
  onStartPractice,
  onStartMilestone,
  onUpgrade: _onUpgrade,
}) {
  const popRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  ));
  const [box, setBox] = useState({
    left: 12,
    top: 12,
    width: 360,
    arrowLeft: 180,
    preferAbove: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    if (!open || !stage || isMobile) return undefined;
    const place = () => {
      const el = anchorRef?.current;
      const pop = popRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pad = 12;
      const gap = 12;
      const width = Math.min(360, window.innerWidth - pad * 2);
      const anchorCenter = rect.left + rect.width / 2;
      let left = anchorCenter - width / 2;
      left = clamp(left, pad, window.innerWidth - width - pad);

      const h = pop?.offsetHeight || 260;
      const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
      const spaceAbove = rect.top - gap - pad;
      const preferAbove = spaceBelow < h && spaceAbove >= spaceBelow;

      let top = preferAbove ? rect.top - gap - h : rect.bottom + gap;
      top = clamp(top, pad, window.innerHeight - h - pad);

      const arrowLeft = clamp(anchorCenter - left, 28, width - 28);
      setBox({ left, top, width, arrowLeft, preferAbove });
    };

    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [open, stage, isMobile, anchorRef, anchorKey]);

  useEffect(() => {
    if (!open || !stage) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-path-popover]') || target.closest('[data-path-hub]')) return;
      onCloseRef.current?.();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, stage]);

  const stageIndex = useMemo(
    () => stages.findIndex((s) => String(s.id) === String(stage?.id) || (stage?.nodeKey && s.nodeKey === stage.nodeKey)),
    [stages, stage?.id, stage?.nodeKey],
  );

  const prevStage = stageIndex > 0 ? stages[stageIndex - 1] : null;
  const nextStage = stageIndex >= 0 && stageIndex < stages.length - 1 ? stages[stageIndex + 1] : null;

  const resolvedTiers = useMemo(() => {
    if (Array.isArray(stage?.tiers) && stage.tiers.length === 3) {
      return stage.tiers;
    }
    const rawTier = stage?.passedTier;
    const easyPassed = ['easy', 'medium', 'hard'].includes(rawTier);
    const mediumPassed = ['medium', 'hard'].includes(rawTier);
    const hardPassed = rawTier === 'hard';
    return [
      { key: 'easy', label: 'Dễ', stepKey: 'learn', passed: easyPassed, unlocked: true },
      { key: 'medium', label: 'Vừa', stepKey: 'practice', passed: mediumPassed, unlocked: easyPassed },
      { key: 'hard', label: 'Khó', stepKey: 'challenge', passed: hardPassed, unlocked: mediumPassed },
    ];
  }, [stage?.tiers, stage?.passedTier]);

  const resolvedPassedTier = useMemo(() => {
    if (['none', 'easy', 'medium', 'hard'].includes(stage?.passedTier)) {
      return stage.passedTier;
    }
    if (resolvedTiers[2]?.passed) return 'hard';
    if (resolvedTiers[1]?.passed) return 'medium';
    if (resolvedTiers[0]?.passed) return 'easy';
    return 'none';
  }, [stage?.passedTier, resolvedTiers]);

  const [selectedTierKey, setSelectedTierKey] = useState(null);

  useEffect(() => {
    setSelectedTierKey(null);
  }, [stage?.id, stage?.nodeKey, open]);

  const selectedTier = useMemo(
    () => (selectedTierKey
      ? resolvedTiers.find((t) => t.key === selectedTierKey && t.unlocked) || null
      : null),
    [resolvedTiers, selectedTierKey],
  );

  if (!open || !stage || typeof document === 'undefined') return null;

  const pct = clamp(Math.round(Number(stage.progress) || 0), 0, 100);
  const isLocked = stage.status === 'locked';
  const isMilestone = stage.type === 'milestone';
  const isLesson = stage.type === 'lesson';
  const { borderClass, arrowHex } = resolvePopoverBorder(stage);

  const prereqStages = stageIndex > 0 ? stages.slice(0, stageIndex) : stages.slice(0, Math.max(0, stages.length - 1));
  const prereqTotal = prereqStages.length || 4;
  const completedBeforeCount = prereqStages.filter(
    (s) => s.status === 'completed' || clamp(Math.round(Number(s.progress) || 0), 0, 100) >= 100,
  ).length;
  const firstPendingPrereq = prereqStages.find(
    (s) => s.status !== 'completed' && clamp(Math.round(Number(s.progress) || 0), 0, 100) < 100,
  ) || prevStage;

  let bodyContent = null;

  if (isMilestone) {
    // 4. Giọt 5 — Vượt chặng
    bodyContent = (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isLocked ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-600">
                <Lock size={12} aria-hidden="true" />
                Chưa mở khóa
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                Vòng {stage.id}
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-extrabold text-amber-800">
                <Crown size={12} className="text-amber-500" aria-hidden="true" />
                Bài kiểm tra vượt chặng
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
                <Award size={12} className="text-amber-500" aria-hidden="true" />
                Cúp &amp; Huy hiệu
              </span>
            </>
          )}
        </div>

        <div>
          <h4 className="text-base font-black leading-snug text-slate-900">
            Vòng {stage.id}: {stage.title}
          </h4>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
            {isLocked
              ? 'Hoàn thành đủ tất cả các phần trước trong chặng để mở khóa bài Vượt chặng.'
              : 'Hoàn thành bài tổng hợp để nhận huy hiệu và mở khóa Chặng tiếp theo.'}
          </p>
        </div>

        {!isLocked ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => onStartMilestone?.(stage)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F59E0B] via-[#10B981] to-[#059669] px-5 py-3 text-xs font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(245,158,11,0.48),inset_0_2px_2px_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 cursor-pointer disabled:opacity-60"
          >
            {stage.status === 'completed' || pct >= 100 ? (
              <>
                <RotateCcw size={14} aria-hidden="true" />
                <span>Ôn lại vượt chặng</span>
              </>
            ) : (
              <>
                <span>{pct > 0 ? 'Tiếp tục vượt chặng' : 'Bắt đầu vượt chặng'}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Hoàn thành {prereqTotal} vòng trước</span>
                <span className="tabular-nums font-black">{completedBeforeCount}/{prereqTotal}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className="h-full rounded-full bg-slate-400 transition-all duration-500"
                  style={{ width: `${prereqTotal > 0 ? Math.round((completedBeforeCount / prereqTotal) * 100) : 0}%` }}
                />
              </div>
            </div>

            {firstPendingPrereq ? (
              <button
                type="button"
                onClick={() => onSelectStage?.(firstPendingPrereq)}
                className="dew-btn-white w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-slate-700 cursor-pointer"
              >
                <span>Quay lại Vòng {firstPendingPrereq.id}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  } else if (isLocked) {
    // 3. Giọt bị khóa
    const targetPrev = prevStage || { id: Math.max(1, Number(stage.id || 2) - 1), title: 'Vòng trước' };
    bodyContent = (
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-600">
            <Lock size={12} aria-hidden="true" />
            Chưa mở khóa
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
            Vòng {stage.id}
          </span>
        </div>

        <div>
          <h4 className="text-base font-black leading-snug text-slate-900">
            Vòng {stage.id}: {stage.title}
          </h4>
          <p className="mt-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3 text-xs font-semibold leading-relaxed text-slate-600">
            Hoàn thành ít nhất <strong>80%</strong> ở{' '}
            <span className="text-slate-900">Vòng {targetPrev.id} ({targetPrev.title})</span> để mở khóa vòng này.
          </p>
        </div>

        <button
          type="button"
          onClick={() => prevStage && onSelectStage?.(prevStage)}
          className="dew-btn-white w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-slate-800 cursor-pointer"
        >
          <span>Quay lại Vòng {targetPrev.id}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    );
  } else if (isLesson) {
    // 1. Giọt 1 — Học bài
    const statusBadge = pct >= 100
      ? { text: 'Đã hoàn thành 100%', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
      : pct > 0
        ? { text: `Đang học ${pct}%`, cls: 'border-blue-200 bg-blue-50 text-blue-700' }
        : { text: 'Chưa học', cls: 'border-slate-200 bg-slate-100 text-slate-600' };

    const checklist = Array.isArray(stage.checklist) && stage.checklist.length > 0
      ? stage.checklist
      : [
          { label: 'Video bài giảng ngắn', done: pct >= 100 },
          { label: 'Tóm tắt thao tác thực hành', done: pct >= 100 },
          { label: 'Câu hỏi kiểm tra nhanh', done: pct >= 100 },
        ];

    bodyContent = (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold ${statusBadge.cls}`}>
            {statusBadge.text}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
            <Award size={12} className="text-amber-500" aria-hidden="true" />
            +20 XP
          </span>
        </div>

        <div>
          <h4 className="text-base font-black leading-snug text-slate-900">
            {stage.heading || `Vòng ${stage.id}: ${stage.lessonTitle || stage.title}`}
          </h4>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {stage.subtitle || 'Video ngắn 4 phút · Lý thuyết cô đọng'}
          </p>
        </div>

        <ul className="space-y-2">
          {checklist.slice(0, 4).map((item, idx) => (
            <li key={item.label || idx} className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
              {item.done ? (
                <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                  <Check size={11} strokeWidth={3} aria-hidden="true" />
                </span>
              ) : (
                <span className="h-4.5 w-4.5 shrink-0 rounded-full border-2 border-slate-300 bg-white" aria-hidden="true" />
              )}
              <span className={item.done ? 'text-slate-800' : 'text-slate-500'}>{item.label}</span>
            </li>
          ))}
        </ul>

        {pct === 0 ? (
          <button
            type="button"
            onClick={() => onOpenLesson?.(stage, { restart: false })}
            className="dew-btn-primary w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold cursor-pointer"
          >
            <Play size={13} fill="currentColor" aria-hidden="true" />
            <span>Bắt đầu học bài</span>
          </button>
        ) : pct < 100 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenLesson?.(stage, { restart: false })}
              className="dew-btn-primary flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold cursor-pointer"
            >
              <Play size={12} fill="currentColor" aria-hidden="true" />
              <span>Học tiếp ({pct}%)</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenLesson?.(stage, { restart: true })}
              className="dew-btn-white inline-flex items-center justify-center gap-1 px-3.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Xem từ đầu
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenLesson?.(stage, { restart: false })}
              className="dew-btn-white inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer shrink-0"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Xem lại bài giảng</span>
            </button>
            {nextStage ? (
              <button
                type="button"
                onClick={() => onSelectStage?.(nextStage)}
                className="dew-btn-primary flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-extrabold cursor-pointer min-w-0"
              >
                <span className="truncate">Sang Vòng {nextStage.id}: {nextStage.title}</span>
                <ArrowRight size={13} className="shrink-0" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  } else {
    // 2. Giọt 2, 3, 4 — Luyện tập / Thử thách
    const doneCount = Number(stage.doneCount) || 0;
    const totalCount = Math.max(doneCount, Number(stage.totalCount) || 10);
    const accuracy = clamp(Math.round(Number(stage.accuracy) || (pct >= 100 ? 100 : 0)), 0, 100);

    const tierBadgeMeta = {
      none: { text: 'Chưa có mức', cls: 'border-slate-200 bg-slate-100 text-slate-500' },
      easy: { text: 'Mức: Dễ', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
      medium: { text: 'Mức: Vừa', cls: 'border-orange-200 bg-orange-50 text-orange-700' },
      hard: { text: 'Mức: Khó', cls: 'border-red-200 bg-red-50 text-red-700' },
    };
    const currentTierBadge = tierBadgeMeta[resolvedPassedTier] || tierBadgeMeta.none;

    const tierStyleMap = {
      easy: {
        barDimmed: 'bg-emerald-400/45',
        barSelected: 'bg-emerald-500',
        pillDimmed: 'border border-emerald-200/85 bg-emerald-50/70 text-emerald-700/75 opacity-65 hover:opacity-90',
        pillSelected: 'border border-emerald-600 bg-emerald-500 text-white shadow-[0_6px_14px_-4px_rgba(16,185,129,0.5)] opacity-100',
        checkDimmed: 'text-emerald-600/75',
      },
      medium: {
        barDimmed: 'bg-orange-400/45',
        barSelected: 'bg-orange-500',
        pillDimmed: 'border border-orange-200/85 bg-orange-50/70 text-orange-700/75 opacity-65 hover:opacity-90',
        pillSelected: 'border border-orange-600 bg-orange-500 text-white shadow-[0_6px_14px_-4px_rgba(249,115,22,0.5)] opacity-100',
        checkDimmed: 'text-orange-600/75',
      },
      hard: {
        barDimmed: 'bg-red-400/45',
        barSelected: 'bg-red-500',
        pillDimmed: 'border border-red-200/85 bg-red-50/70 text-red-700/75 opacity-65 hover:opacity-90',
        pillSelected: 'border border-red-600 bg-red-500 text-white shadow-[0_6px_14px_-4px_rgba(239,68,68,0.5)] opacity-100',
        checkDimmed: 'text-red-600/75',
      },
    };

    const isInProgress = resolvedPassedTier !== 'none' || pct > 0 || doneCount > 0;
    const allTiersPassed = resolvedPassedTier === 'hard';

    bodyContent = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold ${currentTierBadge.cls}`}>
            {currentTierBadge.text}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
            <Zap size={12} className="fill-emerald-500 text-emerald-600" aria-hidden="true" />
            +5 XP/câu
          </span>
        </div>

        <div>
          <h4 className="text-base font-black leading-snug text-slate-900">
            Vòng {stage.id}: {stage.title}
          </h4>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Target size={13} className="shrink-0 text-blue-500" aria-hidden="true" />
            <span>
              Đã làm <strong className="text-slate-900 tabular-nums">{doneCount}/{totalCount}</strong> {stage.countUnit || 'câu'} · Độ chính xác <strong className="text-slate-900 tabular-nums">{accuracy}%</strong>
            </span>
          </p>
        </div>

        {(stage.hasStudyContent || stage.hasExercises) ? (
          <button
            type="button"
            onClick={() => onOpenLesson?.(stage, { restart: false })}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-sky-200/80 bg-sky-50/75 px-3 py-2 text-xs font-extrabold text-sky-900 transition hover:bg-sky-100/80 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} className="shrink-0 text-sky-600" aria-hidden="true" />
              <span>
                {stage.hasExercises
                  ? `Video, Nội dung & Đề bài tập (${stage.exercisesDoneCount || 0}/${stage.exercisesTotalCount || 0})`
                  : 'Xem Video, Nội dung & File'}
              </span>
            </span>
            <ArrowRight size={13} className="shrink-0 text-sky-600" aria-hidden="true" />
          </button>
        ) : null}

        <div className="my-3 grid grid-cols-3 gap-2">
          {resolvedTiers.map((tier) => {
            const style = tierStyleMap[tier.key] || tierStyleMap.easy;
            const isSelected = selectedTier?.key === tier.key;

            const barCls = !tier.unlocked
              ? 'border border-slate-200/80 bg-slate-200/80'
              : isSelected
                ? style.barSelected
                : style.barDimmed;

            const pillCls = !tier.unlocked
              ? 'border border-slate-200 bg-slate-100 text-slate-400 opacity-55 cursor-not-allowed'
              : isSelected
                ? `${style.pillSelected} cursor-pointer`
                : `${style.pillDimmed} cursor-pointer`;

            return (
              <div key={tier.key} className="flex flex-col">
                <div className={`h-1.5 w-full rounded-full transition-all ${barCls}`} />
                <button
                  type="button"
                  disabled={!tier.unlocked}
                  onClick={() => tier.unlocked && setSelectedTierKey((prev) => (prev === tier.key ? null : tier.key))}
                  className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-center text-xs font-bold transition focus:outline-none ${pillCls}`}
                >
                  {tier.passed ? (
                    <Check
                      size={12}
                      strokeWidth={3}
                      className={`shrink-0 ${isSelected ? 'text-white' : style.checkDimmed}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{tier.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!selectedTier || starting}
          onClick={() => selectedTier && onStartPractice?.(stage, {
            stepKey: selectedTier.stepKey || stage.nextLevelKey || 'learn',
            tier: selectedTier.key || 'easy',
            review: Boolean(selectedTier.passed),
          })}
          className={!selectedTier
            ? 'w-full inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-200/90 px-5 py-2.5 text-xs font-extrabold text-slate-400 cursor-not-allowed select-none !shadow-none'
            : dewClass(
              'dew-btn-primary w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold cursor-pointer disabled:opacity-60',
              'w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-60',
            )}
        >
          {!selectedTier ? (
            <span>
              {allTiersPassed
                ? 'Chọn mức để ôn lại'
                : isInProgress
                  ? 'Chọn mức để tiếp tục'
                  : 'Chọn mức để bắt đầu'}
            </span>
          ) : selectedTier.passed ? (
            <>
              <RotateCcw size={14} aria-hidden="true" />
              <span>Ôn lại ({selectedTier.label})</span>
            </>
          ) : (
            <>
              <span>
                {isInProgress
                  ? `Tiếp tục luyện tập (${selectedTier.label})`
                  : `Bắt đầu luyện tập (${selectedTier.label})`}
              </span>
              <ArrowRight size={14} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    );
  }

  if (isMobile) {
    return createPortal(
      <div data-theme={getDewSkillThemeAttr()} className="md:hidden">
        <div
          className="fixed inset-0 z-[9290] bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => onCloseRef.current?.()}
          aria-hidden="true"
        />
        <div
          ref={popRef}
          data-path-popover
          role="dialog"
          aria-modal="true"
          aria-label={stage.title}
          className={`dew-popover fixed inset-x-0 bottom-0 z-[9300] rounded-t-[28px] border-t-2 ${borderClass} bg-white/95 backdrop-blur-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-12px_rgba(15,23,42,0.28)]`}
        >
          <div className="mx-auto mb-3.5 h-1.5 w-11 rounded-full bg-slate-300/90" aria-hidden="true" />
          {bodyContent}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={popRef}
      data-theme={getDewSkillThemeAttr()}
      data-path-popover
      role="dialog"
      aria-label={stage.title}
      style={{
        position: 'fixed',
        left: box.left,
        top: box.top,
        width: box.width,
        zIndex: 9300,
      }}
      className="hidden md:block overflow-visible"
    >
      <div
        className={`dew-popover dp-pop relative rounded-[24px] border-2 ${borderClass} bg-white/95 p-5 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.25)] backdrop-blur-2xl`}
      >
        <span
          aria-hidden="true"
          style={{
            left: box.arrowLeft,
            borderColor: arrowHex,
          }}
          className={`pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-white/95 ${
            box.preferAbove ? '-bottom-[8px] border-b-2 border-r-2' : '-top-[8px] border-l-2 border-t-2'
          }`}
        />
        {bodyContent}
      </div>
    </div>,
    document.body,
  );
}
