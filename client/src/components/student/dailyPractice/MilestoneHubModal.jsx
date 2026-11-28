import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Download,
  ExternalLink,
  FileText,
  Gamepad2,
  Loader2,
  Lock,
  Paperclip,
  X,
} from 'lucide-react';
import { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { saveLastStudySession } from '../../../utils/resumeLearning';
import ShareAchievementModal, { ShareTriggerButton } from '../ShareAchievementModal';
import { buildMilestoneShareData } from '../../../../../shared/dailyPractice/shareAchievement.mjs';
import PathVideoModal from './PathVideoModal';

const DEFAULT_SECTION_ORDER = ['content', 'file', 'video', 'practice'];
const DIFFICULTY_STEP_MAP = { easy: 'learn', medium: 'practice', hard: 'challenge' };

function sectionActionLabel(secKey, { unlocked, done, videoInProgress }) {
  if (!unlocked) return 'Khóa';
  if (done) {
    if (secKey === 'file') return 'Đã tải';
    if (secKey === 'practice') return 'Đã xong';
    return 'Đã xem';
  }
  if (secKey === 'file') return 'Tải file';
  if (secKey === 'practice') return 'Vào luyện';
  if (secKey === 'video' && videoInProgress) return 'Tiếp tục';
  return 'Xem';
}

const DIFFICULTY_TABS = [
  { key: 'easy', label: 'Dễ', activeClass: 'bg-emerald-600 text-white shadow-sm', barClass: 'bg-emerald-500' },
  { key: 'medium', label: 'Vừa', activeClass: 'bg-amber-500 text-white shadow-sm', barClass: 'bg-amber-500' },
  { key: 'hard', label: 'Khó', activeClass: 'bg-emerald-600 text-white shadow-sm', barClass: 'bg-emerald-500' },
];

const SECTION_META = {
  content: {
    title: 'Nội dung bài học',
    defaultSub: 'Đọc và tìm hiểu kiến thức',
    icon: BookOpen,
    iconBg: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  file: {
    title: 'File tài liệu / bài tập',
    defaultSub: 'Xem, tải tài liệu',
    icon: Paperclip,
    iconBg: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  video: {
    title: 'Video bài giảng',
    defaultSub: 'Xem video bài giảng',
    icon: Clapperboard,
    iconBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  practice: {
    title: 'Luyện tập',
    defaultSub: 'Làm bài tập và kiểm tra',
    icon: Gamepad2,
    iconBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
};

function normalizeSectionLocks(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of DEFAULT_SECTION_ORDER) {
    const val = String(src[key] || '').trim();
    out[key] = ['auto', 'unlocked', 'locked'].includes(val) ? val : 'auto';
  }
  return out;
}

function normalizeConfig(node, diff) {
  const cfg = node?.levelConfigs?.[diff];
  if (cfg) {
    const order = (Array.isArray(cfg.sectionOrder) ? cfg.sectionOrder : DEFAULT_SECTION_ORDER)
      .filter((k) => DEFAULT_SECTION_ORDER.includes(k));
    for (const k of DEFAULT_SECTION_ORDER) {
      if (!order.includes(k)) order.push(k);
    }
    return {
      sectionOrder: order,
      hiddenSections: Array.isArray(cfg.hiddenSections) ? cfg.hiddenSections : [],
      sequentialSections: cfg.sequentialSections !== false,
      sectionLocks: normalizeSectionLocks(cfg.sectionLocks),
      content: cfg.content || { title: '', description: '', body: '' },
      files: Array.isArray(cfg.files) ? cfg.files : [],
      video: cfg.video || { title: '', url: '', antiSeek: true, checks: [] },
      practice: cfg.practice || { title: '', description: '', video: { title: '', url: '', antiSeek: true, checks: [] } },
    };
  }
  const legacy = diff === 'easy' ? node?.levels?.[0] : null;
  const legacyVid = legacy?.videos?.[0];
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sequentialSections: true,
    sectionLocks: normalizeSectionLocks(),
    content: { title: legacy?.title || '', description: '', body: legacy?.content || legacyVid?.content || '' },
    files: (legacy?.fileUrl || legacyVid?.fileUrl)
      ? [{
        id: 'legacy-file',
        title: legacy?.fileName || legacyVid?.fileName || 'Tài liệu đính kèm',
        url: legacy?.fileUrl || legacyVid?.fileUrl,
        name: legacy?.fileName || legacyVid?.fileName || 'Tài liệu đính kèm',
      }]
      : [],
    video: {
      id: legacyVid?.id || '',
      title: legacyVid?.title || '',
      url: legacyVid?.url || '',
      checks: legacyVid?.checks || [],
    },
    practice: { title: '', description: '' },
  };
}

export default function MilestoneHubModal({
  unit,
  node,
  milestoneIndex = 0,
  initialDifficulty = null,
  initialSection = null,
  color = { from: '#10B981', to: '#059669' },
  onClose,
  onOpenVideo,
  onStartPractice,
  onProgressChanged,
}) {
  const [completedList, setCompletedList] = useState(() => unit?.completedSections || []);
  const completedSet = useMemo(() => new Set(completedList), [completedList]);
  const isSectionDoneFor = (diff, secKey) => completedSet.has(`${node.key}:${diff}:${secKey}`);
  const getVisibleSectionsFor = (diff) => {
    const c = normalizeConfig(node, diff);
    const hidden = new Set(c.hiddenSections || []);
    return c.sectionOrder.filter((k) => !hidden.has(k) && c.sectionLocks?.[k] !== 'locked');
  };
  const isDiffDone = (diff) => {
    const secs = getVisibleSectionsFor(diff);
    if (!secs.length) return true;
    return secs.every((secKey) => isSectionDoneFor(diff, secKey));
  };
  const easyDone = isDiffDone('easy');
  const mediumDone = isDiffDone('medium');
  const hardDone = isDiffDone('hard');
  const defaultDiff = !easyDone ? 'easy' : !mediumDone ? 'medium' : !hardDone ? 'hard' : 'easy';
  const [activeDiff, setActiveDiff] = useState(() => {
    if (initialDifficulty && (initialDifficulty === 'easy' || unit?.testedOut || (initialDifficulty === 'medium' && easyDone) || (initialDifficulty === 'hard' && easyDone && mediumDone))) {
      return initialDifficulty;
    }
    return defaultDiff;
  });
  const [activeSection, setActiveSection] = useState(
    initialSection === 'content' || initialSection === 'file' ? initialSection : null,
  );
  const [selectedReviewSection, setSelectedReviewSection] = useState(null);
  const [savingSection, setSavingSection] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const cfg = useMemo(() => normalizeConfig(node, activeDiff), [node, activeDiff]);
  const [contentScrolledToEnd, setContentScrolledToEnd] = useState(false);
  const sectionScrollRef = useRef(null);
  const prevCompletedKeyRef = useRef((unit?.completedSections || []).join('|'));

  const checkScrollAtBottom = useCallback(() => {
    const el = sectionScrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setContentScrolledToEnd(true);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'content') {
      setContentScrolledToEnd(false);
      return undefined;
    }
    setContentScrolledToEnd(false);
    const raf = window.requestAnimationFrame(() => {
      checkScrollAtBottom();
    });
    window.addEventListener('resize', checkScrollAtBottom);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', checkScrollAtBottom);
    };
  }, [activeSection, activeDiff, node?.key, cfg.content?.body, checkScrollAtBottom]);

  useEffect(() => {
    setCompletedList(unit?.completedSections || []);
  }, [unit?.completedSections]);

  useEffect(() => {
    const doneSet = new Set(unit?.completedSections || []);
    const isDiffDoneNow = (diff) => {
      const c = normalizeConfig(node, diff);
      const hidden = new Set(c.hiddenSections || []);
      const secs = c.sectionOrder.filter((k) => !hidden.has(k) && c.sectionLocks?.[k] !== 'locked');
      return !secs.length || secs.every((secKey) => doneSet.has(`${node.key}:${diff}:${secKey}`));
    };
    const nextDiff = !isDiffDoneNow('easy') ? 'easy' : !isDiffDoneNow('medium') ? 'medium' : !isDiffDoneNow('hard') ? 'hard' : 'easy';
    const unlockedInit = initialDifficulty && (
      unit?.testedOut
      || initialDifficulty === 'easy'
      || (initialDifficulty === 'medium' && isDiffDoneNow('easy'))
      || (initialDifficulty === 'hard' && isDiffDoneNow('easy') && isDiffDoneNow('medium'))
    );
    const pickedDiff = unlockedInit ? initialDifficulty : nextDiff;
    setActiveDiff(pickedDiff);
    if (initialSection && (initialSection === 'content' || initialSection === 'file')) {
      const c = normalizeConfig(node, pickedDiff);
      const hidden = new Set(c.hiddenSections || []);
      const secList = c.sectionOrder.filter((k) => !hidden.has(k));
      const secIdx = secList.indexOf(initialSection);
      if (secIdx >= 0 && c.sectionLocks?.[initialSection] !== 'locked') {
        const prevRequired = secList.slice(0, secIdx).filter((k) => c.sectionLocks?.[k] !== 'locked');
        const unlocked = unit?.testedOut
          || c.sequentialSections === false
          || c.sectionLocks?.[initialSection] === 'unlocked'
          || !prevRequired.some((k) => !doneSet.has(`${node.key}:${pickedDiff}:${k}`));
        setActiveSection(unlocked ? initialSection : null);
      } else {
        setActiveSection(null);
      }
    } else {
      setActiveSection(null);
    }
    setSelectedReviewSection(null);
  }, [node?.key, initialDifficulty, initialSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection || initialDifficulty || !node) {
      prevCompletedKeyRef.current = (unit?.completedSections || []).join('|');
      return;
    }
    const nextKey = (unit?.completedSections || []).join('|');
    if (prevCompletedKeyRef.current === nextKey) return;
    prevCompletedKeyRef.current = nextKey;
    const doneSet = new Set(unit?.completedSections || []);
    const isDiffDoneNow = (diff) => {
      const c = normalizeConfig(node, diff);
      const hidden = new Set(c.hiddenSections || []);
      const secs = c.sectionOrder.filter((k) => !hidden.has(k) && c.sectionLocks?.[k] !== 'locked');
      return !secs.length || secs.every((secKey) => doneSet.has(`${node.key}:${diff}:${secKey}`));
    };
    const nextDiff = !isDiffDoneNow('easy') ? 'easy' : !isDiffDoneNow('medium') ? 'medium' : !isDiffDoneNow('hard') ? 'hard' : activeDiff;
    if (isDiffDoneNow(activeDiff) && nextDiff !== activeDiff) {
      setActiveDiff(nextDiff);
    }
  }, [activeSection, initialDifficulty, unit?.completedSections, node, activeDiff]);

  useEffect(() => {
    setSelectedReviewSection(null);
  }, [activeDiff]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (activeSection) setActiveSection(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [activeSection, onClose]);

  const visibleSections = useMemo(
    () => cfg.sectionOrder.filter((key) => !cfg.hiddenSections.includes(key)),
    [cfg],
  );

  const completedDiffCount = [easyDone, mediumDone, hardDone].filter(Boolean).length;
  const allThreeDone = completedDiffCount === 3;
  const isDiffUnlocked = (diff) => {
    if (unit?.testedOut) return true;
    if (diff === 'easy') return true;
    if (diff === 'medium') return easyDone;
    if (diff === 'hard') return easyDone && mediumDone;
    return false;
  };

  const activeDiffUnlocked = isDiffUnlocked(activeDiff);
  useEffect(() => {
    if (!activeDiffUnlocked) {
      setActiveDiff('easy');
    }
  }, [activeDiffUnlocked]);

  const isSectionDone = (secKey) => isSectionDoneFor(activeDiff, secKey);
  const getSectionLockState = (secKey, secIdx) => {
    const lockMode = cfg.sectionLocks?.[secKey] || 'auto';
    if (lockMode === 'locked') return { unlocked: false, reason: 'Admin đang khóa phần này' };
    if (lockMode === 'unlocked') return { unlocked: true, reason: '' };
    if (unit?.testedOut || cfg.sequentialSections === false) return { unlocked: true, reason: '' };
    const prevRequired = visibleSections.slice(0, secIdx).filter((k) => cfg.sectionLocks?.[k] !== 'locked');
    if (prevRequired.some((k) => !isSectionDone(k))) {
      return { unlocked: false, reason: 'Hoàn thành phần trước để mở khóa' };
    }
    return { unlocked: true, reason: '' };
  };
  const isSectionUnlocked = (secIdx) => getSectionLockState(visibleSections[secIdx], secIdx).unlocked;
  const requiredSections = visibleSections.filter((secKey) => cfg.sectionLocks?.[secKey] !== 'locked');
  const doneCount = requiredSections.filter((secKey) => isSectionDone(secKey)).length;
  const totalCount = requiredSections.length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const currentTabMeta = DIFFICULTY_TABS.find((t) => t.key === activeDiff) || DIFFICULTY_TABS[0];

  useEffect(() => {
    if (!unit?.id || !node?.key) return;
    saveLastStudySession({
      kind: 'daily_practice',
      unitId: String(unit.id),
      unitTitle: unit.title || '',
      lessonId: String(node.key),
      lessonTitle: node.label || unit.title || 'Bài học DewSkill',
      sectionId: `${activeDiff}:${activeSection || 'hub'}`,
      sectionLabel: `Chặng ${unit.index || 1} · ${currentTabMeta.label}`,
      progressPct,
      href: '/student/daily-practice',
    });
  }, [unit?.id, unit?.index, unit?.title, node?.key, node?.label, activeDiff, activeSection, currentTabMeta.label, progressPct]);

  const autoCompletedRef = useRef(new Set());

  const markSectionDoneAuto = useCallback(async (secKey) => {
    if (!unit?.id || !node?.key || !secKey) return;
    const fullKey = `${node.key}:${activeDiff}:${secKey}`;
    if (completedSet.has(fullKey) || autoCompletedRef.current.has(fullKey)) return;
    autoCompletedRef.current.add(fullKey);
    setCompletedList((prev) => (prev.includes(fullKey) ? prev : [...prev, fullKey]));
    setSavingSection(true);
    try {
      const res = await dailyPracticeApi.student.completeSection(unit.id, {
        nodeKey: node.key,
        difficulty: activeDiff,
        sectionKey: secKey,
        completed: true,
      });
      if (Array.isArray(res?.completedSections)) {
        setCompletedList(res.completedSections);
      }
      onProgressChanged?.();
    } catch {
      // keep optimistic completion in UI
    } finally {
      setSavingSection(false);
    }
  }, [unit?.id, node?.key, activeDiff, completedSet, onProgressChanged]);

  const handleEmbeddedVideoWatched = useCallback(async (videoId) => {
    if (!unit?.id || !videoId) return;
    await dailyPracticeApi.student.videoWatched(unit.id, videoId);
    onProgressChanged?.();
  }, [unit?.id, onProgressChanged]);

  useEffect(() => {
    if (!activeSection) return;
    if (activeSection === 'content' && contentScrolledToEnd) {
      markSectionDoneAuto('content');
    } else if (activeSection === 'file') {
      markSectionDoneAuto('file');
    } else if (activeSection === 'video' && !cfg.video?.url) {
      markSectionDoneAuto('video');
    }
  }, [activeSection, contentScrolledToEnd, cfg.video?.url, markSectionDoneAuto]);

  const openSection = (secKey) => {
    if (secKey === 'video' && cfg.video?.url) {
      const videoId = cfg.video.id || `${node.key}:level:${activeDiff}`;
      onOpenVideo?.(unit, videoId);
      return;
    }
    if (secKey === 'practice') {
      onClose();
      onStartPractice?.(DIFFICULTY_STEP_MAP[activeDiff]);
      return;
    }
    setActiveSection(secKey);
  };

  const handleContinueNextSection = () => {
    const curIdx = requiredSections.indexOf(activeSection);
    const nextSec = curIdx >= 0 ? requiredSections[curIdx + 1] : null;
    if (nextSec) {
      openSection(nextSec);
      return;
    }
    setActiveSection(null);
  };

  const handleQuickStart = () => {
    const firstPending = visibleSections.find((secKey, idx) => isSectionUnlocked(idx) && !isSectionDone(secKey))
      || visibleSections.find((secKey, idx) => isSectionUnlocked(idx))
      || visibleSections[0];
    if (firstPending) openSection(firstPending);
  };

  const sectionSubtitle = (secKey) => {
    if (secKey === 'content') {
      if (cfg.content?.description) return cfg.content.description;
      return cfg.content?.body ? SECTION_META.content.defaultSub : 'Chưa có nội dung ở mức này';
    }
    if (secKey === 'file') {
      return cfg.files?.length ? `${cfg.files.length} tài liệu đính kèm` : 'Chưa có tài liệu ở mức này';
    }
    if (secKey === 'video') {
      if (!cfg.video?.url) return 'Chưa có video ở mức này';
      const c = cfg.video?.checks?.length || 0;
      return c ? `Xem video bài giảng (${c} câu hỏi)` : 'Xem video bài giảng';
    }
    const qCount = unit?.counts?.[activeDiff] || 0;
    return qCount ? `${qCount} câu hỏi mức ${currentTabMeta.label}` : 'Làm bài tập và kiểm tra';
  };

  const bodyParagraphs = useMemo(
    () => String(cfg.content?.body || '').split(/\n+/).map((p) => p.trim()).filter(Boolean),
    [cfg.content?.body],
  );
  const activeSectionCompleted = Boolean(
    activeSection && (
      isSectionDone(activeSection)
      || savingSection
      || activeSection === 'file'
      || (activeSection === 'content' && contentScrolledToEnd)
      || (activeSection === 'video' && !cfg.video?.url)
    ),
  );

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      className="fixed inset-0 z-[9100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && activeSection !== 'video') onClose();
      }}
    >
      <div
        className={`flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 transition-[max-width] duration-200 ${
          (activeSection === 'content'
            || (activeSection === 'video' && Boolean(cfg.video?.url)))
            ? 'max-w-3xl lg:max-w-4xl'
            : 'max-w-lg'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={node.label}
      >
        {/* Header */}
        {(() => {
          const activeMeta = activeSection ? SECTION_META[activeSection] : null;
          const HeaderIcon = activeMeta?.icon || BookOpen;
          const headerIconTone = activeMeta?.iconBg || 'bg-emerald-50 text-emerald-700 ring-emerald-200/80';
          return (
            <div className="border-b border-slate-100 bg-gradient-to-b from-emerald-50/75 via-emerald-50/20 to-white px-4 pt-3.5 pb-4 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSection) setActiveSection(null);
                    else onClose();
                  }}
                  aria-label={activeSection ? 'Quay lại bài học' : 'Trở về lộ trình'}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/70 hover:text-emerald-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2 cursor-pointer !shadow-none"
                >
                  <ArrowLeft size={14} className="shrink-0" aria-hidden="true" />
                  <span>{activeSection ? 'Quay lại bài học' : 'Trở về lộ trình'}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {activeSection && activeSectionCompleted ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700"
                      aria-label="Đã hoàn thành"
                    >
                      {savingSection
                        ? <Loader2 size={13} className="animate-spin text-emerald-600" />
                        : <CheckCircle2 size={13} className="text-emerald-600" />}
                      <span>Đã hoàn thành</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-100/85 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-800">
                      {activeSection ? `Mức ${currentTabMeta.label}` : `Bài học ${String(milestoneIndex + 1).padStart(2, '0')}`}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng"
                    title="Đóng"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2 cursor-pointer !shadow-none"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-2xs ${headerIconTone}`}>
                  <HeaderIcon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  {activeSection ? (
                    <p className="truncate text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      {node.label}
                    </p>
                  ) : null}
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-snug line-clamp-2">
                    {activeSection ? activeMeta?.title : node.label}
                  </h3>
                  {!activeSection && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                          allThreeDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {allThreeDone ? <CheckCircle2 size={11} /> : null}
                        <span>{allThreeDone ? 'Hoàn thành 3/3 mức' : `${completedDiffCount}/3 mức`}</span>
                      </span>
                      <p className="text-xs font-medium text-slate-500">
                        {allThreeDone
                          ? 'Đã xong Dễ · Vừa · Khó'
                          : 'Hoàn thành lần lượt Dễ → Vừa → Khó'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Body */}
        {!activeSection ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {/* Segmented Level Tabs */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
              {DIFFICULTY_TABS.map((tab) => {
                const isSelected = activeDiff === tab.key;
                const unlocked = isDiffUnlocked(tab.key);
                const done = isDiffDone(tab.key);
                return (
                  <button
                    key={tab.key}
                    type="button"
                    disabled={!unlocked}
                    title={!unlocked ? (tab.key === 'medium' ? 'Hoàn thành mức Dễ để mở mức Vừa' : 'Hoàn thành mức Vừa để mở mức Khó') : undefined}
                    onClick={() => unlocked && setActiveDiff(tab.key)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition sm:text-sm !shadow-none ${
                      !unlocked
                        ? 'cursor-not-allowed text-slate-400 opacity-60'
                        : isSelected
                          ? tab.activeClass
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {!unlocked && <Lock size={13} className="shrink-0" />}
                    {unlocked && done && <CheckCircle2 size={13} className="shrink-0" />}
                    <span>{unlocked && done ? `${tab.label} · Ôn lại` : tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 4 Sections in Admin-configured order */}
            <div className="space-y-2.5">
              {visibleSections.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-400">
                  Mức độ này chưa có phần học nào được hiển thị.
                </p>
              ) : visibleSections.map((secKey, secIdx) => {
                const meta = SECTION_META[secKey];
                const Icon = meta.icon;
                const done = isSectionDone(secKey);
                const lockState = getSectionLockState(secKey, secIdx);
                const unlocked = lockState.unlocked;
                const videoInProgress = secKey === 'video' && !done && (() => {
                  try {
                    const vidId = cfg.video?.id || `${node.key}:level:${activeDiff}`;
                    const k = `dp-${unit.id}-${vidId}`;
                    return Number(sessionStorage.getItem(`student_lms_watched_${k}`) || 0) > 0
                      || Number(sessionStorage.getItem(`student_lms_pos_${k}`) || 0) > 0;
                  } catch {
                    return false;
                  }
                })();
                const isSelectedReview = doneCount === totalCount && totalCount > 0 && selectedReviewSection === secKey;
                const isReviewMode = doneCount === totalCount && totalCount > 0;
                const actionLabel = sectionActionLabel(secKey, { unlocked, done, videoInProgress });
                return (
                  <button
                    key={secKey}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      if (!unlocked) return;
                      if (isReviewMode) {
                        setSelectedReviewSection((prev) => (prev === secKey ? null : secKey));
                        return;
                      }
                      openSection(secKey);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition !shadow-none ${
                      !unlocked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50/80 opacity-60'
                        : isSelectedReview
                          ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/50'
                          : done
                            ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.iconBg}`}>
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-black text-slate-900">{meta.title}</p>
                        {done && <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />}
                      </div>
                      <p className="truncate text-xs font-medium text-slate-500">
                        {!unlocked ? lockState.reason : sectionSubtitle(secKey)}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${
                      !unlocked
                        ? 'border-slate-200 bg-slate-100 text-slate-500'
                        : done
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}>
                      {!unlocked && <Lock size={12} />}
                      {actionLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Sub-view chi tiết của từng phần học */
          <div
            ref={sectionScrollRef}
            onScroll={activeSection === 'content' ? checkScrollAtBottom : undefined}
            className={`min-h-0 flex-1 space-y-4 overflow-y-auto p-5 ${activeSection === 'content' ? 'sm:p-6 md:p-7' : ''}`}
          >
            {activeSection === 'content' && (
              <div className="space-y-3">
                {cfg.content?.title ? (
                  <h4 className="text-base sm:text-lg font-black text-slate-900">{cfg.content.title}</h4>
                ) : null}
                {cfg.content?.description ? (
                  <p className="rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-sky-900 ring-1 ring-sky-100">
                    {cfg.content.description}
                  </p>
                ) : null}
                {bodyParagraphs.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-6 text-[15px] sm:text-base leading-relaxed text-slate-800">
                    {bodyParagraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-400">
                    Mức độ {currentTabMeta.label} chưa có nội dung văn bản.
                  </div>
                )}
              </div>
            )}

            {activeSection === 'file' && (
              <div className="space-y-3">
                {cfg.files?.length ? (
                  <ul className="space-y-2.5">
                    {cfg.files.map((file, idx) => (
                      <li key={file.id || idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                            <FileText size={20} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-900">{file.title || file.name}</p>
                            <p className="text-[11px] font-semibold text-amber-800">Tài liệu học tập</p>
                          </div>
                        </div>
                        <div className="flex w-full sm:w-auto shrink-0 items-center gap-2">
                          <a
                            href={resolveMediaUrl(file.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-amber-300 bg-white px-3 py-2 sm:py-1.5 text-xs font-black text-amber-900 hover:bg-amber-100/60"
                          >
                            <ExternalLink size={13} /> Xem file
                          </a>
                          <a
                            href={buildMediaDownloadUrl(file.url, file.name)}
                            download={file.name}
                            className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-amber-600 px-3 py-2 sm:py-1.5 text-xs font-black text-white hover:bg-amber-700"
                          >
                            <Download size={13} /> Tải về
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-400">
                    Mức độ {currentTabMeta.label} chưa có file tài liệu đính kèm.
                  </div>
                )}
              </div>
            )}

            {activeSection === 'video' && (
              cfg.video?.url ? (
                <PathVideoModal
                  key={`${unit.id}:${cfg.video.id || `${node.key}:level:${activeDiff}`}`}
                  unit={unit}
                  initialVideoId={cfg.video.id || `${node.key}:level:${activeDiff}`}
                  singleVideoOnly
                  embedded
                  color={color}
                  onWatched={handleEmbeddedVideoWatched}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-400">
                  Mức độ {currentTabMeta.label} chưa có video bài giảng.
                </div>
              )
            )}
          </div>
        )}

        {/* Footer */}
        {!activeSection ? (
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
              <span>Tiến độ học tập ({currentTabMeta.label})</span>
              <div className="flex items-center gap-2">
                {doneCount === totalCount && totalCount > 0 ? (
                  <ShareTriggerButton
                    onClick={() => setShareOpen(true)}
                    label="SHARE"
                    size="sm"
                  />
                ) : null}
                <span>{doneCount}/{totalCount} phần</span>
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${currentTabMeta.barClass}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {visibleSections.length > 0 && (
              doneCount === totalCount && totalCount > 0 ? (
                selectedReviewSection ? (
                  <button
                    type="button"
                    onClick={() => openSection(selectedReviewSection)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[#047857] bg-[#10B981] py-3.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition hover:bg-[#059669] active:translate-y-[2px] active:border-b-2"
                  >
                    Ôn lại · {SECTION_META[selectedReviewSection]?.title} <ChevronRight size={17} />
                  </button>
                ) : (
                  <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 py-3 text-center text-xs font-bold text-slate-500">
                    Chọn một phần ở trên để hiện nút Ôn lại
                  </p>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleQuickStart}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[#047857] bg-[#10B981] py-3.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition hover:bg-[#059669] active:translate-y-[2px] active:border-b-2"
                >
                  {doneCount > 0 ? 'Tiếp tục học' : 'Bắt đầu học'} <ChevronRight size={17} />
                </button>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-row items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 sm:px-5 py-3">
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 !shadow-none"
            >
              <ArrowLeft size={14} /> Quay lại bài học
            </button>
            {(activeSection === 'content' || activeSection === 'file' || (activeSection === 'video' && !cfg.video?.url)) && (
              activeSection === 'content' && !isSectionDone('content') && !contentScrolledToEnd ? (
                <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
                  Cuộn đọc hết nội dung để hoàn thành
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleContinueNextSection}
                  className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 transition cursor-pointer !shadow-none"
                >
                  Tiếp tục <ChevronRight size={15} />
                </button>
              )
            )}
          </div>
        )}
        <ShareAchievementModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          data={buildMilestoneShareData({
            nodeTitle: node?.label || '',
            difficultyLabel: currentTabMeta.label,
            sectionsDone: doneCount,
            sectionsTotal: totalCount,
            allThreeDone,
          })}
        />
      </div>
    </div>,
    document.body,
  );
}

