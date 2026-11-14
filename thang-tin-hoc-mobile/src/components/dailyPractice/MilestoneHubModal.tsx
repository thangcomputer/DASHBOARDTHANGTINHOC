import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Gamepad2,
  Lock,
  Paperclip,
  Play,
  PlayCircle,
  X,
} from 'lucide-react-native';
import {
  dailyPracticeApi,
  DpDifficulty,
  DpLevelSectionConfig,
  DpPathNode,
  DpPathUnit,
  DpPathVideo,
  DpSectionKey,
  DpStepKey,
} from '../../services/dailyPracticeApi';
import { resolveMobilePublicUrl } from '../../services/apiClient';

const DEFAULT_SECTION_ORDER: DpSectionKey[] = ['content', 'file', 'video', 'practice'];
const DIFFICULTY_STEP_MAP: Record<DpDifficulty, DpStepKey> = {
  easy: 'learn',
  medium: 'practice',
  hard: 'challenge',
};

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
    iconBg: '#FEE2E2',
    iconColor: '#DC2626',
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
      content: cfg.content || { title: '', description: '', body: '' },
      files: Array.isArray(cfg.files) ? cfg.files : [],
      video: cfg.video || { title: '', url: '', antiSeek: true, checks: [] },
      practice: cfg.practice || { title: '', description: '' },
    };
  }
  const legacy = diff === 'easy' ? node.levels?.[0] : null;
  const legacyVid: DpPathVideo | null = legacy?.videos?.[0] ?? null;
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sequentialSections: true,
    content: { title: legacy?.title || '', description: '', body: legacy?.content || legacyVid?.content || '' },
    files: [],
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompletedList(unit?.completedSections || []);
  }, [unit?.completedSections, visible]);

  useEffect(() => {
    setSelectedReviewSection(null);
  }, [activeDiff]);

  useEffect(() => {
    if (!visible) {
      setActiveSection(null);
      setSelectedReviewSection(null);
      return;
    }
    if (!node) return;
    const doneSet = new Set(unit?.completedSections || []);
    const isDone = (diff: DpDifficulty) => {
      const c = normalizeConfig(node, diff);
      const hidden = new Set(c.hiddenSections || []);
      const secs = c.sectionOrder.filter((k) => !hidden.has(k));
      return !secs.length || secs.every((secKey) => doneSet.has(`${node.key}:${diff}:${secKey}`));
    };
    const nextDiff: DpDifficulty = !isDone('easy') ? 'easy' : !isDone('medium') ? 'medium' : !isDone('hard') ? 'hard' : 'easy';
    setActiveDiff(nextDiff);
    setActiveSection(null);
  }, [visible, node?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = useMemo(
    () => (node ? normalizeConfig(node, activeDiff) : null),
    [node, activeDiff],
  );

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
    return c.sectionOrder.filter((k) => !hidden.has(k));
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
  const isSectionUnlocked = (secIdx: number) => {
    if (unit?.testedOut) return true;
    if (cfg?.sequentialSections === false) return true;
    if (secIdx <= 0) return true;
    return isSectionDone(visibleSections[secIdx - 1]);
  };
  const doneCount = visibleSections.filter((secKey) => isSectionDone(secKey)).length;
  const totalCount = visibleSections.length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const currentTab = DIFFICULTY_TABS.find((t) => t.key === activeDiff) || DIFFICULTY_TABS[0];

  if (!unit || !node || !cfg) return null;

  const toggleSectionDone = async (secKey: DpSectionKey, nextDone: boolean) => {
    setSaving(true);
    try {
      const res = await dailyPracticeApi.completeSection(unit.id, {
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
      setSaving(false);
    }
  };

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

  const handleQuickStart = () => {
    const firstPending = visibleSections.find((secKey, idx) => isSectionUnlocked(idx) && !isSectionDone(secKey))
      || visibleSections.find((secKey, idx) => isSectionUnlocked(idx))
      || visibleSections[0];
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
    return SECTION_META.practice.defaultSub;
  };

  const paragraphs = String(cfg.content?.body || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
      if (activeSection) setActiveSection(null);
      else onClose();
    }}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconBox}>
            <BookOpen size={20} color="#0F172A" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>
              {activeSection
                ? `${node.label} · ${currentTab.label}`
                : `BÀI HỌC ${String(milestoneIndex + 1).padStart(2, '0')}`}
            </Text>
            <Text numberOfLines={1} style={styles.title}>
              {activeSection ? SECTION_META[activeSection].title : node.label}
            </Text>
            {!activeSection && (
              <View style={styles.subtitleRow}>
                <Text style={styles.subtitle}>
                  {allThreeDone
                    ? 'Đã hoàn thành cả 3 mức độ'
                    : `Hoàn thành lần lượt Dễ → Vừa → Khó (${completedDiffCount}/3 mức)`}
                </Text>
                {allThreeDone && (
                  <View style={styles.lessonDoneBadge}>
                    <CheckCircle2 size={11} color="#065F46" />
                    <Text style={styles.lessonDoneBadgeText}>Hoàn thành bài học</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Đóng">
            <X size={20} color="#64748B" />
          </Pressable>
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
                const unlocked = isSectionUnlocked(secIdx);
                const vidId = cfg.video?.id || `${node.key}:level:${activeDiff}`;
                const videoInProgress = secKey === 'video' && !done && Boolean(startedVideos[vidId]);
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
                        {!unlocked ? 'Hoàn thành phần trước để mở khóa' : sectionSubtitle(secKey)}
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
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
                    <View style={styles.fileIconWrap}>
                      <FileText size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.fileMeta}>
                      <Text numberOfLines={1} style={styles.fileName}>{file.title || file.name}</Text>
                      <Text style={styles.fileSub}>Tài liệu học tập</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        const url = resolveMobilePublicUrl(file.url);
                        if (url) Linking.openURL(url);
                      }}
                      style={styles.fileBtn}
                    >
                      <ExternalLink size={14} color="#FFFFFF" />
                      <Text style={styles.fileBtnText}>Mở file</Text>
                    </Pressable>
                  </View>
                )) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Mức độ {currentTab.label} chưa có file tài liệu đính kèm.</Text>
                  </View>
                )}
              </View>
            )}

            {activeSection === 'video' && (
              <View style={styles.emptyBox}>
                {cfg.video?.url ? (
                  <Pressable
                    onPress={() => onOpenVideo(unit, cfg.video.id || `${node.key}:level:${activeDiff}`)}
                    style={styles.videoLaunchBtn}
                  >
                    <Play size={16} color="#FFFFFF" />
                    <Text style={styles.videoLaunchText}>Mở trình phát video</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.emptyText}>Mức độ {currentTab.label} chưa có video bài giảng.</Text>
                )}
              </View>
            )}

            {activeSection === 'practice' && (
              <View style={styles.detailWrap}>
                <View style={styles.practiceCard}>
                  <Text style={styles.practiceEyebrow}>LUYỆN TẬP · MỨC {currentTab.label.toUpperCase()}</Text>
                  <Text style={styles.practiceTitle}>
                    {cfg.practice?.title || `Bài tập trắc nghiệm (${currentTab.label})`}
                  </Text>
                  <Text style={styles.practiceDesc}>
                    {cfg.practice?.description || 'Hoàn thành tối thiểu 60% số câu hỏi để đạt phần luyện tập này.'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    onClose();
                    onStartPractice(DIFFICULTY_STEP_MAP[activeDiff]);
                  }}
                  style={styles.practiceStartBtn}
                >
                  <Gamepad2 size={18} color="#FFFFFF" />
                  <Text style={styles.practiceStartText}>Bắt đầu làm bài luyện tập</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {/* Footer */}
        {!activeSection ? (
          <View style={styles.footer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Tiến độ học tập ({currentTab.label})</Text>
              <Text style={styles.progressCount}>{doneCount}/{totalCount} phần</Text>
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
            <Pressable onPress={() => setActiveSection(null)} style={styles.subBackBtn}>
              <ArrowLeft size={15} color="#334155" />
              <Text style={styles.subBackText}>Quay lại bài học</Text>
            </Pressable>
            {(activeSection === 'content' || activeSection === 'file') && (
              <Pressable
                disabled={saving}
                onPress={() => toggleSectionDone(activeSection, !isSectionDone(activeSection))}
                style={[styles.doneBtn, isSectionDone(activeSection) && styles.doneBtnActive]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={isSectionDone(activeSection) ? '#047857' : '#FFFFFF'} />
                ) : (
                  <CheckCircle2 size={15} color={isSectionDone(activeSection) ? '#047857' : '#FFFFFF'} />
                )}
                <Text style={[styles.doneBtnText, isSectionDone(activeSection) && styles.doneBtnTextActive]}>
                  {isSectionDone(activeSection) ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 1 },
  subtitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  subtitle: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  lessonDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  lessonDoneBadgeText: { fontSize: 11, fontWeight: '800', color: '#065F46' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
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
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  fileBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  videoLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  subBackText: { fontSize: 13, fontWeight: '800', color: '#334155' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#059669',
  },
  doneBtnActive: {
    backgroundColor: '#D1FAE5',
  },
  doneBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  doneBtnTextActive: { color: '#047857' },
});
