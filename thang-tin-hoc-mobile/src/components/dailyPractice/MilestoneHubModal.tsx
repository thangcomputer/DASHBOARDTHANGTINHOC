import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Gamepad2,
  Lock,
  Paperclip,
  PlayCircle,
} from 'lucide-react-native';
import { saveLastStudySession } from '../../utils/resumeLearning';
import { PathVideoModal } from './PathVideoModal';
import { ShareAchievementModal, ShareTriggerButton, type ShareAchievementData } from '../ShareAchievementModal';
import { buildMilestoneShareData } from '../../../../shared/dailyPractice/shareAchievement.mjs';
import type { GameSound } from './useGameSounds';
import {
  dailyPracticeApi,
  DpDifficulty,
  DpLevelFile,
  DpLevelSectionConfig,
  DpPathNode,
  DpPathStep,
  DpPathUnit,
  DpPathVideo,
  DpSectionKey,
  DpSectionLockMode,
  DpStepKey,
} from '../../services/dailyPracticeApi';
import { resolveMobilePublicUrl } from '../../services/apiClient';

const DEFAULT_SECTION_ORDER: DpSectionKey[] = ['content', 'file', 'video', 'practice'];
const DIFFICULTY_STEP_MAP: Record<DpDifficulty, DpStepKey> = {
  easy: 'learn',
  medium: 'practice',
  hard: 'challenge',
};

function buildMediaDownloadUrl(rawUrl: string, displayName?: string) {
  const base = resolveMobilePublicUrl(rawUrl);
  if (!base) return '';
  const params: string[] = [];
  if (base.includes('/uploads/')) params.push('download=1');
  const cleanName = String(displayName || '').trim();
  if (cleanName) params.push(`downloadAs=${encodeURIComponent(cleanName)}`);
  if (!params.length) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${params.join('&')}`;
}

function triggerFileDownload(file: DpLevelFile) {
  const dlUrl = buildMediaDownloadUrl(file.url, file.name);
  if (!dlUrl) return;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = dlUrl;
    a.setAttribute('download', file.name || file.title || 'tai-lieu');
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  void Linking.openURL(dlUrl);
}

function sectionActionLabel(
  secKey: DpSectionKey,
  { unlocked, done, videoInProgress }: { unlocked: boolean; done: boolean; videoInProgress: boolean },
) {
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

const DIFFICULTY_TABS: Array<{
  key: DpDifficulty;
  label: string;
  activeBg: string;
  barColor: string;
}> = [
  { key: 'easy', label: 'Dễ', activeBg: '#059669', barColor: '#10B981' },
  { key: 'medium', label: 'Vừa', activeBg: '#D97706', barColor: '#F59E0B' },
  { key: 'hard', label: 'Khó', activeBg: '#E11D48', barColor: '#F43F5E' },
];

const SECTION_META: Record<DpSectionKey, {
  title: string;
  defaultSub: string;
  iconBg: string;
  iconColor: string;
}> = {
  content: {
    title: 'Nội dung bài học',
    defaultSub: 'Đọc và tìm hiểu kiến thức',
    iconBg: '#E0F2FE',
    iconColor: '#0369A1',
  },
  file: {
    title: 'File tài liệu / bài tập',
    defaultSub: 'Xem, tải tài liệu',
    iconBg: '#FEF3C7',
    iconColor: '#B45309',
  },
  video: {
    title: 'Video bài giảng',
    defaultSub: 'Xem video bài giảng',
    iconBg: '#D1FAE5',
    iconColor: '#059669',
  },
  practice: {
    title: 'Luyện tập',
    defaultSub: 'Làm bài tập và kiểm tra',
    iconBg: '#D1FAE5',
    iconColor: '#047857',
  },
};

function renderSectionIcon(key: DpSectionKey, color: string) {
  if (key === 'content') return <BookOpen size={18} color={color} />;
  if (key === 'file') return <Paperclip size={18} color={color} />;
  if (key === 'video') return <PlayCircle size={18} color={color} />;
  return <Gamepad2 size={18} color={color} />;
}

function normalizeSectionLocks(raw?: Partial<Record<DpSectionKey, DpSectionLockMode>> | null): Record<DpSectionKey, DpSectionLockMode> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as Record<DpSectionKey, DpSectionLockMode>;
  for (const key of DEFAULT_SECTION_ORDER) {
    const val = String(src[key] || '').trim();
    out[key] = (val === 'auto' || val === 'unlocked' || val === 'locked') ? val : 'auto';
  }
  return out;
}

function normalizeConfig(node: DpPathNode, diff: DpDifficulty): DpLevelSectionConfig {
  const cfg = node.levelConfigs?.[diff];
  if (cfg) {
    const order = (Array.isArray(cfg.sectionOrder) ? cfg.sectionOrder : DEFAULT_SECTION_ORDER)
      .filter((k): k is DpSectionKey => DEFAULT_SECTION_ORDER.includes(k));
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
  const legacy = (diff === 'easy' ? node.levels?.[0] : null) as (DpPathStep & { fileUrl?: string; fileName?: string }) | null;
  const legacyVid = (legacy?.videos?.[0] ?? null) as (DpPathVideo & { fileUrl?: string; fileName?: string }) | null;
  const legacyFileUrl = legacy?.fileUrl || legacyVid?.fileUrl || '';
  const legacyFileName = legacy?.fileName || legacyVid?.fileName || 'Tài liệu đính kèm';
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sequentialSections: true,
    sectionLocks: normalizeSectionLocks(null),
    content: { title: legacy?.title || '', description: '', body: legacy?.content || legacyVid?.content || '' },
    files: legacyFileUrl
      ? [{ id: 'legacy-file', title: legacyFileName, url: legacyFileUrl, name: legacyFileName }]
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

type Props = {
  visible: boolean;
  suspended?: boolean;
  userId?: string;
  topicId?: string;
  courseTitle?: string;
  color?: { from: string; to: string };
  xpTotal?: number | null;
  play?: (s: GameSound) => void;
  onBuyXp?: () => void;
  initialDifficulty?: DpDifficulty | null;
  initialSection?: DpSectionKey | null;
  unit: DpPathUnit | null;
  node: DpPathNode | null;
  milestoneIndex: number;
  onClose: () => void;
  onOpenVideo: (unit: DpPathUnit, videoId: string) => void;
  onStartPractice: (stepKey: DpStepKey) => void;
  onProgressChanged?: () => void;
};

export default function MilestoneHubModal({
  visible,
  suspended = false,
  userId = '',
  topicId = '',
  courseTitle = '',
  color,
  xpTotal = null,
  play,
  onBuyXp,
  initialDifficulty = null,
  initialSection = null,
  unit,
  node,
  milestoneIndex,
  onClose,
  onOpenVideo,
  onStartPractice,
  onProgressChanged,
}: Props) {
  const [activeDiff, setActiveDiff] = useState<DpDifficulty>('easy');
  const [activeSection, setActiveSection] = useState<DpSectionKey | null>(null);
  const [selectedReviewSection, setSelectedReviewSection] = useState<DpSectionKey | null>(null);
  const [completedList, setCompletedList] = useState<string[]>([]);
  const [startedVideos, setStartedVideos] = useState<Record<string, boolean>>({});
  const [savingSection, setSavingSection] = useState(false);
  const [contentScrolledToEnd, setContentScrolledToEnd] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const autoCompletedRef = useRef<Set<string>>(new Set());
  const prevCompletedKeyRef = useRef('');
  const scrollOffsetYRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);

  const checkScrollAtBottom = useCallback((offsetY?: number, viewportH?: number, contentH?: number) => {
    const y = offsetY ?? scrollOffsetYRef.current;
    const vh = viewportH ?? scrollViewportHeightRef.current;
    const ch = contentH ?? scrollContentHeightRef.current;
    if (vh > 0 && ch > 0 && y + vh >= ch - 24) {
      setContentScrolledToEnd(true);
    }
  }, []);

  useEffect(() => {
    setCompletedList(unit?.completedSections || []);
  }, [unit?.completedSections, visible]);

  useEffect(() => {
    if (!visible || activeSection || initialDifficulty || !node) {
      prevCompletedKeyRef.current = (unit?.completedSections || []).join('|');
      return;
    }
    const nextKey = (unit?.completedSections || []).join('|');
    if (prevCompletedKeyRef.current === nextKey) return;
    prevCompletedKeyRef.current = nextKey;
    const doneSet = new Set(unit?.completedSections || []);
    const isDiffCompleted = (diff: DpDifficulty) => {
      const c = normalizeConfig(node, diff);
      const hidden = new Set(c.hiddenSections || []);
      const secs = c.sectionOrder.filter((k) => !hidden.has(k) && c.sectionLocks?.[k] !== 'locked');
      return !secs.length || secs.every((secKey) => doneSet.has(`${node.key}:${diff}:${secKey}`));
    };
    const nextDiff: DpDifficulty = !isDiffCompleted('easy')
      ? 'easy'
      : !isDiffCompleted('medium')
        ? 'medium'
        : !isDiffCompleted('hard')
          ? 'hard'
          : activeDiff;
    if (isDiffCompleted(activeDiff) && nextDiff !== activeDiff) {
      setActiveDiff(nextDiff);
    }
  }, [visible, activeSection, initialDifficulty, unit?.completedSections, node, activeDiff]);

  useEffect(() => {
    setSelectedReviewSection(null);
  }, [activeDiff]);

  useEffect(() => {
    if (!visible) {
      setActiveSection(null);
      setSelectedReviewSection(null);
      setContentScrolledToEnd(false);
      return;
    }
    if (!node) return;
    const doneSet = new Set(unit?.completedSections || []);
    const isDone = (diff: DpDifficulty) => {
      const c = normalizeConfig(node, diff);
      const hidden = new Set(c.hiddenSections || []);
      const secs = c.sectionOrder.filter((k) => !hidden.has(k) && c.sectionLocks?.[k] !== 'locked');
      return !secs.length || secs.every((secKey) => doneSet.has(`${node.key}:${diff}:${secKey}`));
    };
    const nextDiff: DpDifficulty = !isDone('easy') ? 'easy' : !isDone('medium') ? 'medium' : !isDone('hard') ? 'hard' : 'easy';
    const isUnlockedForInit = (diff: DpDifficulty) => {
      if (unit?.testedOut) return true;
      if (diff === 'easy') return true;
      if (diff === 'medium') return isDone('easy');
      if (diff === 'hard') return isDone('easy') && isDone('medium');
      return false;
    };
    const pickedDiff = initialDifficulty && isUnlockedForInit(initialDifficulty) ? initialDifficulty : nextDiff;
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
        return;
      }
    }
    setActiveSection(null);
  }, [visible, node?.key, initialDifficulty, initialSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = useMemo(
    () => (node ? normalizeConfig(node, activeDiff) : null),
    [node, activeDiff],
  );

  useEffect(() => {
    if (activeSection !== 'content') {
      setContentScrolledToEnd(false);
      return;
    }
    setContentScrolledToEnd(false);
    scrollOffsetYRef.current = 0;
    scrollViewportHeightRef.current = 0;
    scrollContentHeightRef.current = 0;
  }, [activeSection, activeDiff, node?.key, cfg?.content?.body]);

  const visibleSections = useMemo(() => {
    if (!cfg) return [];
    const hidden = new Set(cfg.hiddenSections || []);
    return cfg.sectionOrder.filter((key) => !hidden.has(key));
  }, [cfg]);

  const completedSet = useMemo(() => new Set(completedList), [completedList]);
  const isSectionDoneFor = (diff: DpDifficulty, secKey: DpSectionKey) => (
    node ? completedSet.has(`${node.key}:${diff}:${secKey}`) : false
  );
  const getVisibleSectionsFor = (diff: DpDifficulty): DpSectionKey[] => {
    if (!node) return [];
    const c = normalizeConfig(node, diff);
    const hidden = new Set(c.hiddenSections || []);
    return c.sectionOrder.filter((k) => !hidden.has(k) && c.sectionLocks?.[k] !== 'locked');
  };
  const isDiffDone = (diff: DpDifficulty) => {
    const secs = getVisibleSectionsFor(diff);
    if (!secs.length) return true;
    return secs.every((secKey) => isSectionDoneFor(diff, secKey));
  };
  const easyDone = isDiffDone('easy');
  const mediumDone = isDiffDone('medium');
  const hardDone = isDiffDone('hard');
  const completedDiffCount = [easyDone, mediumDone, hardDone].filter(Boolean).length;
  const allThreeDone = completedDiffCount === 3;
  const isDiffUnlocked = (diff: DpDifficulty) => {
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

  const isSectionDone = (secKey: DpSectionKey) => isSectionDoneFor(activeDiff, secKey);
  const getSectionLockState = (secKey: DpSectionKey, secIdx: number) => {
    const lockMode = cfg?.sectionLocks?.[secKey] || 'auto';
    if (lockMode === 'locked') return { unlocked: false, reason: 'Admin đang khóa phần này' };
    if (lockMode === 'unlocked') return { unlocked: true, reason: '' };
    if (unit?.testedOut || cfg?.sequentialSections === false) return { unlocked: true, reason: '' };
    const prevRequired = visibleSections.slice(0, secIdx).filter((k) => cfg?.sectionLocks?.[k] !== 'locked');
    if (prevRequired.some((k) => !isSectionDone(k))) {
      return { unlocked: false, reason: 'Hoàn thành phần trước để mở khóa' };
    }
    return { unlocked: true, reason: '' };
  };
  const isSectionUnlocked = (secIdx: number) => {
    const secKey = visibleSections[secIdx];
    return secKey ? getSectionLockState(secKey, secIdx).unlocked : false;
  };
  const requiredSections = visibleSections.filter((secKey) => cfg?.sectionLocks?.[secKey] !== 'locked');
  const doneCount = requiredSections.filter((secKey) => isSectionDone(secKey)).length;
  const totalCount = requiredSections.length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const currentTab = DIFFICULTY_TABS.find((t) => t.key === activeDiff) || DIFFICULTY_TABS[0];

  const markSectionDoneAuto = useCallback(async (secKey: DpSectionKey) => {
    if (!unit?.id || !node?.key || !secKey) return;
    const fullKey = `${node.key}:${activeDiff}:${secKey}`;
    if (completedSet.has(fullKey) || autoCompletedRef.current.has(fullKey)) return;
    autoCompletedRef.current.add(fullKey);
    setCompletedList((prev) => (prev.includes(fullKey) ? prev : [...prev, fullKey]));
    setSavingSection(true);
    try {
      const res = await dailyPracticeApi.completeSection(unit.id, {
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

  useEffect(() => {
    if (!visible || suspended || !unit?.id || !node?.key) return;
    void saveLastStudySession({
      kind: 'daily_practice',
      studentId: userId,
      topicId: topicId || '',
      nodeKey: node.key,
      courseTitle: courseTitle || '',
      unitId: String(unit.id),
      unitTitle: unit.title || '',
      lessonId: String(node.key),
      lessonTitle: node.label || unit.title || 'Bài học DewSkill',
      sectionId: `${activeDiff}:${activeSection || 'hub'}`,
      sectionLabel: `Chặng ${unit.index || 1} · ${currentTab.label}`,
      progressPct,
      href: '/student/daily-practice',
    });
  }, [visible, suspended, userId, topicId, courseTitle, unit?.id, unit?.index, unit?.title, node?.key, node?.label, activeDiff, activeSection, currentTab.label, progressPct]);

  useEffect(() => {
    if (!activeSection || !cfg) return;
    if (activeSection === 'content' && contentScrolledToEnd) {
      void markSectionDoneAuto('content');
    } else if (activeSection === 'file') {
      void markSectionDoneAuto('file');
    } else if (activeSection === 'video' && !cfg.video?.url) {
      void markSectionDoneAuto('video');
    }
  }, [activeSection, contentScrolledToEnd, cfg, markSectionDoneAuto]);

  const handleEmbeddedVideoWatched = useCallback(async (videoId: string) => {
    if (!unit?.id || !videoId) return;
    await dailyPracticeApi.videoWatched(unit.id, videoId);
    onProgressChanged?.();
  }, [unit?.id, onProgressChanged]);

  if (!unit || !node || !cfg) return null;

  const openSection = (secKey: DpSectionKey) => {
    if (secKey === 'video' && cfg.video?.url) {
      const vidId = cfg.video.id || `${node.key}:level:${activeDiff}`;
      setStartedVideos((prev) => ({ ...prev, [vidId]: true }));
      onOpenVideo(unit, vidId);
      return;
    }
    if (secKey === 'practice') {
      onClose();
      onStartPractice(DIFFICULTY_STEP_MAP[activeDiff]);
      return;
    }
    setActiveSection(secKey);
  };

  const handleContinueNextSection = () => {
    const curIdx = activeSection ? requiredSections.indexOf(activeSection) : -1;
    const nextSec = curIdx >= 0 ? requiredSections[curIdx + 1] : null;
    if (nextSec) {
      if ((nextSec === 'video' && cfg.video?.url) || nextSec === 'practice') {
        setActiveSection(null);
      }
      openSection(nextSec);
      return;
    }
    setActiveSection(null);
  };

  const handleQuickStart = () => {
    const firstPending = requiredSections.find((secKey) => {
      const idx = visibleSections.indexOf(secKey);
      return idx >= 0 && isSectionUnlocked(idx) && !isSectionDone(secKey);
    })
      || requiredSections.find((secKey) => {
        const idx = visibleSections.indexOf(secKey);
        return idx >= 0 && isSectionUnlocked(idx);
      })
      || requiredSections[0];
    if (firstPending) openSection(firstPending);
  };

  const sectionSubtitle = (secKey: DpSectionKey) => {
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
    return qCount ? `${qCount} câu hỏi mức ${currentTab.label}` : SECTION_META.practice.defaultSub;
  };

  const paragraphs = String(cfg.content?.body || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const activeSectionCompleted = Boolean(
    activeSection && (
      isSectionDone(activeSection)
      || savingSection
      || activeSection === 'file'
      || (activeSection === 'content' && contentScrolledToEnd)
      || (activeSection === 'video' && !cfg.video?.url)
    ),
  );

  return (
    <Modal visible={visible && !suspended} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
      if (activeSection) setActiveSection(null);
      else onClose();
    }}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerNavRow}>
            <Pressable
              onPress={() => {
                if (activeSection) setActiveSection(null);
                else onClose();
              }}
              style={({ pressed }) => [
                styles.backPillBtn,
                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null,
                pressed && styles.backPillBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={activeSection ? 'Quay lại bài học' : 'Trở về lộ trình'}
            >
              <ArrowLeft size={14} color="#334155" />
              <Text style={styles.backPillText}>
                {activeSection ? 'Quay lại bài học' : 'Trở về lộ trình'}
              </Text>
            </Pressable>

            <View style={styles.headerNavRight}>
              {activeSection && activeSectionCompleted ? (
                <View style={styles.headerDonePill} accessibilityLabel="Đã hoàn thành">
                  {savingSection ? (
                    <ActivityIndicator size="small" color="#059669" />
                  ) : (
                    <CheckCircle2 size={13} color="#059669" />
                  )}
                  <Text style={styles.headerDonePillText}>Đã hoàn thành</Text>
                </View>
              ) : (
                <View style={styles.headerLessonBadge}>
                  <Text style={styles.headerLessonBadgeText}>
                    {activeSection ? `Mức ${currentTab.label}` : `BÀI HỌC ${String(milestoneIndex + 1).padStart(2, '0')}`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.headerTitleRow}>
            <View
              style={[
                styles.headerIconTile,
                { backgroundColor: activeSection ? SECTION_META[activeSection].iconBg : '#D1FAE5' },
              ]}
            >
              {activeSection
                ? renderSectionIcon(activeSection, SECTION_META[activeSection].iconColor)
                : <BookOpen size={20} color="#059669" />}
            </View>
            <View style={styles.headerTextWrap}>
              {activeSection ? (
                <Text numberOfLines={1} style={styles.headerBreadcrumb}>{node.label}</Text>
              ) : null}
              <Text numberOfLines={2} style={styles.title}>
                {activeSection ? SECTION_META[activeSection].title : node.label}
              </Text>
              {!activeSection && (
                <View style={styles.subtitleRow}>
                  <View style={[styles.levelCountBadge, allThreeDone && styles.lessonDoneBadge]}>
                    {allThreeDone ? <CheckCircle2 size={11} color="#065F46" /> : null}
                    <Text style={[styles.levelCountBadgeText, allThreeDone && styles.lessonDoneBadgeText]}>
                      {allThreeDone ? 'Hoàn thành 3/3 mức' : `${completedDiffCount}/3 mức`}
                    </Text>
                  </View>
                  <Text style={styles.subtitle}>
                    {allThreeDone
                      ? 'Đã xong Dễ · Vừa · Khó'
                      : 'Hoàn thành lần lượt Dễ → Vừa → Khó'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Body */}
        {!activeSection ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Segmented Level Tabs */}
            <View style={styles.tabRow}>
              {DIFFICULTY_TABS.map((tab) => {
                const selected = activeDiff === tab.key;
                const unlocked = isDiffUnlocked(tab.key);
                const done = isDiffDone(tab.key);
                return (
                  <Pressable
                    key={tab.key}
                    disabled={!unlocked}
                    onPress={() => unlocked && setActiveDiff(tab.key)}
                    style={[
                      styles.tabBtn,
                      !unlocked && styles.tabBtnLocked,
                      unlocked && selected && { backgroundColor: tab.activeBg },
                    ]}
                  >
                    {!unlocked && <Lock size={13} color="#94A3B8" />}
                    {unlocked && done && <CheckCircle2 size={13} color={selected ? '#FFFFFF' : '#059669'} />}
                    <Text style={[styles.tabText, !unlocked && styles.tabTextLocked, unlocked && selected && styles.tabTextActive]}>
                      {unlocked && done ? `${tab.label} · Ôn lại` : tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 4 Sections */}
            <View style={styles.sectionList}>
              {visibleSections.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Mức độ này chưa có phần học nào được hiển thị.</Text>
                </View>
              ) : visibleSections.map((secKey, secIdx) => {
                const meta = SECTION_META[secKey];
                const done = isSectionDone(secKey);
                const lockState = getSectionLockState(secKey, secIdx);
                const unlocked = lockState.unlocked;
                const vidId = cfg.video?.id || `${node.key}:level:${activeDiff}`;
                const videoInProgress = secKey === 'video' && !done && (
                  Boolean(startedVideos[vidId])
                  || (Platform.OS === 'web' && typeof globalThis.sessionStorage !== 'undefined' && (() => {
                    try {
                      const keys = [
                        `dp-${userId || 'anon'}-${unit.id}-${vidId}`,
                        `dp-${unit.id}-${vidId}`,
                      ];
                      return keys.some((k) => (
                        Number(globalThis.sessionStorage.getItem(`student_lms_watched_${k}`) || 0) > 0
                        || Number(globalThis.sessionStorage.getItem(`student_lms_pos_${k}`) || 0) > 0
                      ));
                    } catch {
                      return false;
                    }
                  })())
                );
                const isReviewMode = doneCount === totalCount && totalCount > 0;
                const isSelectedReview = isReviewMode && selectedReviewSection === secKey;
                const actionLabel = sectionActionLabel(secKey, { unlocked, done, videoInProgress });
                return (
                  <Pressable
                    key={secKey}
                    disabled={!unlocked}
                    onPress={() => {
                      if (!unlocked) return;
                      if (isReviewMode) {
                        setSelectedReviewSection((prev) => (prev === secKey ? null : secKey));
                        return;
                      }
                      openSection(secKey);
                    }}
                    style={[
                      styles.sectionCard,
                      done && unlocked && styles.sectionCardDone,
                      isSelectedReview && { borderColor: '#10B981', borderWidth: 2, backgroundColor: '#ECFDF5' },
                      !unlocked && styles.sectionCardLocked,
                    ]}
                  >
                    <View style={[styles.sectionIconBox, { backgroundColor: meta.iconBg }]}>
                      {renderSectionIcon(secKey, meta.iconColor)}
                    </View>
                    <View style={styles.sectionBody}>
                      <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionTitle}>{meta.title}</Text>
                        {done && <CheckCircle2 size={15} color="#059669" />}
                      </View>
                      <Text numberOfLines={1} style={styles.sectionSub}>
                        {!unlocked ? lockState.reason : sectionSubtitle(secKey)}
                      </Text>
                    </View>
                    <View style={[styles.openPill, done && unlocked && styles.openPillDone, !unlocked && styles.openPillLocked]}>
                      {!unlocked && <Lock size={12} color="#64748B" />}
                      <Text style={[styles.openPillText, done && unlocked && styles.openPillTextDone, !unlocked && styles.openPillTextLocked]}>
                        {actionLabel}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            key={`sub-${activeSection}-${activeDiff}`}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            onLayout={(e: LayoutChangeEvent) => {
              const h = e.nativeEvent.layout.height;
              scrollViewportHeightRef.current = h;
              if (activeSection === 'content') checkScrollAtBottom(undefined, h, undefined);
            }}
            onContentSizeChange={(_w: number, h: number) => {
              scrollContentHeightRef.current = h;
              if (activeSection === 'content') checkScrollAtBottom(undefined, undefined, h);
            }}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const y = e.nativeEvent.contentOffset.y;
              const vh = e.nativeEvent.layoutMeasurement.height;
              const ch = e.nativeEvent.contentSize.height;
              scrollOffsetYRef.current = y;
              if (vh > 0) scrollViewportHeightRef.current = vh;
              if (ch > 0) scrollContentHeightRef.current = ch;
              if (activeSection === 'content') checkScrollAtBottom(y, vh, ch);
            }}
          >
            {activeSection === 'content' && (
              <View style={styles.detailWrap}>
                {cfg.content?.title ? <Text style={styles.detailTitle}>{cfg.content.title}</Text> : null}
                {cfg.content?.description ? (
                  <View style={styles.descBox}>
                    <Text style={styles.descText}>{cfg.content.description}</Text>
                  </View>
                ) : null}
                {paragraphs.length > 0 ? (
                  <View style={styles.paragraphBox}>
                    {paragraphs.map((p, idx) => (
                      <Text key={idx} style={styles.paragraphText}>{p}</Text>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Mức độ {currentTab.label} chưa có nội dung văn bản.</Text>
                  </View>
                )}
              </View>
            )}

            {activeSection === 'file' && (
              <View style={styles.detailWrap}>
                {cfg.files?.length ? cfg.files.map((file, idx) => (
                  <View key={file.id || idx} style={styles.fileCard}>
                    <View style={styles.fileTopRow}>
                      <View style={styles.fileIconWrap}>
                        <FileText size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.fileMeta}>
                        <Text numberOfLines={1} style={styles.fileName}>{file.title || file.name}</Text>
                        <Text style={styles.fileSub}>Tài liệu học tập</Text>
                      </View>
                    </View>
                    <View style={styles.fileActionsRow}>
                      <Pressable
                        onPress={() => {
                          const url = resolveMobilePublicUrl(file.url);
                          if (url) void Linking.openURL(url);
                        }}
                        style={styles.fileViewBtn}
                        accessibilityRole="button"
                      >
                        <ExternalLink size={14} color="#78350F" />
                        <Text style={styles.fileViewBtnText}>Xem file</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => triggerFileDownload(file)}
                        style={styles.fileBtn}
                        accessibilityRole="button"
                      >
                        <Download size={14} color="#FFFFFF" />
                        <Text style={styles.fileBtnText}>Tải về</Text>
                      </Pressable>
                    </View>
                  </View>
                )) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Mức độ {currentTab.label} chưa có file tài liệu đính kèm.</Text>
                  </View>
                )}
              </View>
            )}

            {activeSection === 'video' && (
              cfg.video?.url ? (
                <PathVideoModal
                  key={`${unit.id}:${cfg.video.id || `${node.key}:level:${activeDiff}`}`}
                  unit={unit}
                  initialVideoId={cfg.video.id || `${node.key}:level:${activeDiff}`}
                  nodeKey={node.key}
                  topicId={topicId}
                  courseTitle={courseTitle}
                  userId={userId}
                  xpTotal={xpTotal}
                  color={color}
                  play={play}
                  singleVideoOnly
                  inline
                  onWatched={handleEmbeddedVideoWatched}
                  onChecksChanged={onProgressChanged}
                  onBuyXp={onBuyXp ? () => {
                    onClose();
                    onBuyXp();
                  } : undefined}
                />
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Mức độ {currentTab.label} chưa có video bài giảng.</Text>
                </View>
              )
            )}
          </ScrollView>
        )}

        {/* Footer */}
        {!activeSection ? (
          <View style={styles.footer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Tiến độ học tập ({currentTab.label})</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {doneCount === totalCount && totalCount > 0 ? (
                  <ShareTriggerButton
                    onPress={() => {
                      play?.('tap');
                      setShareOpen(true);
                    }}
                    label="SHARE"
                    size="sm"
                  />
                ) : null}
                <Text style={styles.progressCount}>{doneCount}/{totalCount} phần</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: currentTab.barColor }]} />
            </View>
            {visibleSections.length > 0 && (
              doneCount === totalCount && totalCount > 0 ? (
                selectedReviewSection ? (
                  <Pressable
                    onPress={() => openSection(selectedReviewSection)}
                    style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
                  >
                    <Text style={styles.ctaText}>
                      Ôn lại · {SECTION_META[selectedReviewSection]?.title}
                    </Text>
                    <ChevronRight size={18} color="#FFFFFF" />
                  </Pressable>
                ) : (
                  <View style={{ marginTop: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>
                      Chọn một phần ở trên để hiện nút Ôn lại
                    </Text>
                  </View>
                )
              ) : (
                <Pressable
                  onPress={handleQuickStart}
                  style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
                >
                  <Text style={styles.ctaText}>
                    {doneCount > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}
                  </Text>
                  <ChevronRight size={18} color="#FFFFFF" />
                </Pressable>
              )
            )}
          </View>
        ) : (
          <View style={styles.subFooter}>
            <Pressable onPress={() => setActiveSection(null)} style={styles.subBackBtn} accessibilityRole="button">
              <ArrowLeft size={14} color="#334155" />
              <Text style={styles.subBackText}>Quay lại bài học</Text>
            </Pressable>
            {(activeSection === 'content' || activeSection === 'file' || (activeSection === 'video' && !cfg.video?.url)) && (
              activeSection === 'content' && !isSectionDone('content') && !contentScrolledToEnd ? (
                <View style={styles.scrollHintPill}>
                  <Text style={styles.scrollHintText}>Cuộn đọc hết nội dung để hoàn thành</Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleContinueNextSection}
                  style={({ pressed }) => [styles.continueNextBtn, pressed && { opacity: 0.9 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.continueNextText}>Tiếp tục</Text>
                  <ChevronRight size={15} color="#FFFFFF" />
                </Pressable>
              )
            )}
          </View>
        )}
        <ShareAchievementModal
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          data={buildMilestoneShareData({
            nodeTitle: node?.label || '',
            difficultyLabel: currentTab.label,
            sectionsDone: doneCount,
            sectionsTotal: totalCount,
            allThreeDone,
          }) as ShareAchievementData}
          inlineOverlay
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#F6FCF9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  backPillBtnPressed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  backPillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  headerNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerLessonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
  },
  headerLessonBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerDonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  headerDonePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerBreadcrumb: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A', lineHeight: 23 },
  subtitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  subtitle: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  levelCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  levelCountBadgeText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  lessonDoneBadge: {
    backgroundColor: '#D1FAE5',
  },
  lessonDoneBadgeText: { fontSize: 11, fontWeight: '800', color: '#065F46' },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, gap: 16 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 5,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnLocked: {
    opacity: 0.55,
  },
  tabText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  tabTextLocked: { color: '#94A3B8' },
  tabTextActive: { color: '#FFFFFF' },
  sectionList: { gap: 10 },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  sectionCardDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  sectionCardLocked: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBody: { flex: 1, minWidth: 0 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 12, fontWeight: '500', color: '#64748B', marginTop: 2 },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  openPillDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#D1FAE5',
  },
  openPillLocked: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  openPillText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  openPillTextDone: { color: '#047857' },
  openPillTextLocked: { color: '#64748B' },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  detailWrap: { gap: 12 },
  detailTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  descBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  descText: { fontSize: 13, fontWeight: '600', color: '#0C4A6E', lineHeight: 19 },
  paragraphBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paragraphText: { fontSize: 15, color: '#1E293B', lineHeight: 23 },
  fileCard: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  fileTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  fileSub: { fontSize: 11, fontWeight: '600', color: '#B45309', marginTop: 2 },
  fileViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  fileViewBtnText: { fontSize: 12, fontWeight: '800', color: '#78350F' },
  fileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  fileBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  videoLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 16,
  },
  videoLaunchText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  practiceCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  practiceEyebrow: { fontSize: 11, fontWeight: '800', color: '#047857' },
  practiceTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  practiceDesc: { fontSize: 13, color: '#475569', lineHeight: 19 },
  practiceCountText: { fontSize: 12, fontWeight: '800', color: '#065F46', marginTop: 4 },
  practiceVideoCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 10,
  },
  practiceVideoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  practiceVideoMeta: { flex: 1, minWidth: 0, gap: 2 },
  practiceVideoEyebrow: { fontSize: 10, fontWeight: '900', color: '#0369A1', letterSpacing: 0.4 },
  practiceVideoTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  practiceVideoBadge: {
    borderRadius: 999,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  practiceVideoBadgeText: { fontSize: 11, fontWeight: '800', color: '#075985' },
  practiceVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#0284C7',
    paddingVertical: 11,
    borderRadius: 12,
  },
  practiceVideoBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  practiceStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 16,
  },
  practiceStartText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  practiceFooterBtn: {
    flex: 1,
    minWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
  },
  practiceFooterBtnText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  practiceFooterBtnLocked: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  practiceFooterBtnTextLocked: { color: '#94A3B8' },
  footer: {
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
  progressCount: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  ctaBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderBottomWidth: 4,
    borderBottomColor: '#047857',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  subFooter: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  subBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  subBackText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  scrollHintPill: {
    flex: 1,
    minWidth: 170,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  scrollHintText: { fontSize: 12, fontWeight: '700', color: '#64748B', textAlign: 'center' },
  subRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  doneBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  doneBadgeText: { fontSize: 12, fontWeight: '800', color: '#047857' },
  continueNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#059669',
  },
  continueNextText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});
