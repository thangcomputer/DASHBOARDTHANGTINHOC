import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Play,
  X,
} from 'lucide-react';
import { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';

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
    iconBg: 'bg-red-50 text-red-700 ring-red-200',
  },
  practice: {
    title: 'Luyện tập',
    defaultSub: 'Làm bài tập và kiểm tra',
    icon: Gamepad2,
    iconBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
};

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
      content: cfg.content || { title: '', description: '', body: '' },
      files: Array.isArray(cfg.files) ? cfg.files : [],
      video: cfg.video || { title: '', url: '', antiSeek: true, checks: [] },
      practice: cfg.practice || { title: '', description: '' },
    };
  }
  const legacy = diff === 'easy' ? node?.levels?.[0] : null;
  const legacyVid = legacy?.videos?.[0];
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sequentialSections: true,
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
    return c.sectionOrder.filter((k) => !hidden.has(k));
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
  const [activeDiff, setActiveDiff] = useState(defaultDiff);
  const [activeSection, setActiveSection] = useState(null);
  const [selectedReviewSection, setSelectedReviewSection] = useState(null);
  const [savingSection, setSavingSection] = useState(false);

  useEffect(() => {
    setCompletedList(unit?.completedSections || []);
  }, [unit?.completedSections]);

  useEffect(() => {
    setActiveDiff(defaultDiff);
    setActiveSection(null);
    setSelectedReviewSection(null);
  }, [node?.key]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const cfg = useMemo(() => normalizeConfig(node, activeDiff), [node, activeDiff]);
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
  const isSectionUnlocked = (secIdx) => {
    if (unit?.testedOut) return true;
    if (cfg.sequentialSections === false) return true;
    if (secIdx <= 0) return true;
    return isSectionDone(visibleSections[secIdx - 1]);
  };
  const doneCount = visibleSections.filter((secKey) => isSectionDone(secKey)).length;
  const totalCount = visibleSections.length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const currentTabMeta = DIFFICULTY_TABS.find((t) => t.key === activeDiff) || DIFFICULTY_TABS[0];

  const toggleSectionDone = async (secKey, nextDone) => {
    setSavingSection(true);
    try {
      const res = await dailyPracticeApi.student.completeSection(unit.id, {
        nodeKey: node.key,
        difficulty: activeDiff,
        sectionKey: secKey,
        completed: nextDone,
      });
      if (Array.isArray(res?.completedSections)) {
        setCompletedList(res.completedSections);
      } else {
        const key = `${node.key}:${activeDiff}:${secKey}`;
        setCompletedList((prev) => (nextDone ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)));
      }
      onProgressChanged?.();
    } catch {
      // ignore
    } finally {
      setSavingSection(false);
    }
  };

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

  return createPortal(
    <div
      className="fixed inset-0 z-[9100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-label={node.label}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
            <BookOpen size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {activeSection ? `${node.label} · ${currentTabMeta.label}` : `Bài học ${String(milestoneIndex + 1).padStart(2, '0')}`}
            </p>
            <h3 className="truncate text-lg font-black text-slate-900 sm:text-xl">
              {activeSection ? SECTION_META[activeSection]?.title : node.label}
            </h3>
            {!activeSection && (
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-slate-500">
                  {allThreeDone
                    ? 'Đã hoàn thành cả 3 mức độ'
                    : `Hoàn thành lần lượt Dễ → Vừa → Khó (${completedDiffCount}/3 mức)`}
                </p>
                {allThreeDone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800">
                    <CheckCircle2 size={12} /> Hoàn thành bài học
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 !shadow-none"
          >
            <X size={20} />
          </button>
        </div>

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
                const unlocked = isSectionUnlocked(secIdx);
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
                        {!unlocked ? 'Hoàn thành phần trước để mở khóa' : sectionSubtitle(secKey)}
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
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {activeSection === 'content' && (
              <div className="space-y-3">
                {cfg.content?.title ? (
                  <h4 className="text-base font-black text-slate-900">{cfg.content.title}</h4>
                ) : null}
                {cfg.content?.description ? (
                  <p className="rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs font-semibold text-sky-900 ring-1 ring-sky-100">
                    {cfg.content.description}
                  </p>
                ) : null}
                {bodyParagraphs.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-[15px] leading-relaxed text-slate-800">
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
                      <li key={file.id || idx} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                            <FileText size={20} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-900">{file.title || file.name}</p>
                            <p className="text-[11px] font-semibold text-amber-800">Tài liệu học tập</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={resolveMediaUrl(file.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-100/60"
                          >
                            <ExternalLink size={13} /> Xem file
                          </a>
                          <a
                            href={buildMediaDownloadUrl(file.url, file.name)}
                            download={file.name}
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-700"
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
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-400">
                {cfg.video?.url ? (
                  <button
                    type="button"
                    onClick={() => onOpenVideo?.(unit, cfg.video.id || `${node.key}:level:${activeDiff}`)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 !shadow-none"
                  >
                    <Play size={16} fill="currentColor" /> Mở trình phát video
                  </button>
                ) : (
                  `Mức độ ${currentTabMeta.label} chưa có video bài giảng.`
                )}
              </div>
            )}

            {activeSection === 'practice' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Luyện tập · Mức {currentTabMeta.label}</p>
                  <h4 className="mt-1 text-base font-black text-slate-900">
                    {cfg.practice?.title || `Bài tập trắc nghiệm (${currentTabMeta.label})`}
                  </h4>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {cfg.practice?.description || 'Hoàn thành tối thiểu 60% số câu hỏi để đạt phần luyện tập này.'}
                  </p>
                  <p className="mt-2 text-xs font-bold text-emerald-800">
                    Ngân hàng câu hỏi: {unit?.counts?.[activeDiff] || 0} câu {currentTabMeta.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartPractice?.(DIFFICULTY_STEP_MAP[activeDiff]);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 !shadow-none"
                >
                  <Gamepad2 size={18} /> Bắt đầu làm bài luyện tập
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!activeSection ? (
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Tiến độ học tập ({currentTabMeta.label})</span>
              <span>{doneCount}/{totalCount} phần</span>
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
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 !shadow-none"
            >
              <ArrowLeft size={14} /> Quay lại bài học
            </button>
            {(activeSection === 'content' || activeSection === 'file') && (
              <button
                type="button"
                disabled={savingSection}
                onClick={() => toggleSectionDone(activeSection, !isSectionDone(activeSection))}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition !shadow-none ${
                  isSectionDone(activeSection)
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {savingSection ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isSectionDone(activeSection) ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

