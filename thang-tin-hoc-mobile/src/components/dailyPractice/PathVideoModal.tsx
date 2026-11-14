import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { CheckCircle2, Clapperboard, ExternalLink, Lock, Play } from 'lucide-react-native';
import { VideoPlayerFrame, type VideoPlayerApi } from '../../screens/VideoPlayerFrame';
import { resolveMobilePublicUrl } from '../../services/apiClient';
import { embeddedVideoUrl, isDirectVideoUrl, playableVideoUrl } from '../../utils/videoSource';
import {
  dailyPracticeApi,
  type DpNodeState,
  type DpPathUnit,
  type DpPathVideo,
  type DpUnitVideos,
} from '../../services/dailyPracticeApi';
import { noteStudyMediaProgress } from '../../services/studyActivity';
import type { GameSound } from './useGameSounds';
import { DuoButton } from '../duo/DuoButton';
import { spacing } from '../../theme/tokens';
import { PATH_VIDEO_MODAL_LAYOUT } from '../../../../shared/dailyPractice/lmsBrandedVideoPlayer.mjs';

type VideoCheck = {
  id?: string;
  _id?: string;
  atSec?: number;
  prompt?: string;
  kind?: string;
  choices?: string[];
  options?: string[];
  hintCostXp?: number;
};

type PlaylistItem =
  | (DpPathVideo & { source: 'unit' | 'step'; locked: boolean })
  | { id: string; title: string; url: string; antiSeek?: boolean; source: 'lesson'; locked: boolean; state: DpNodeState };

function checkId(check: VideoCheck) {
  return String(check._id || check.id || '');
}

/**
 * Popup video chặng — đồng bộ web PathVideoModal (header, trình phát, danh sách, câu hỏi giữa video).
 */
export function PathVideoModal({
  unit,
  initialVideoId = '',
  color,
  userId,
  singleVideoOnly = false,
  play,
  onClose,
  onWatched,
  onOpenLesson,
}: {
  unit: DpPathUnit;
  initialVideoId?: string;
  color: { from: string; to: string };
  userId: string;
  singleVideoOnly?: boolean;
  play: (s: GameSound) => void;
  onClose: () => void;
  onWatched: (videoId: string) => Promise<void>;
  onOpenLesson: (lesson: { subjectId: string; unitId: string }) => void;
}) {
  const [data, setData] = useState<DpUnitVideos | null>(null);
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState(initialVideoId);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => new Set());
  const [passedKeys, setPassedKeys] = useState<Set<string>>(() => new Set());
  const [gate, setGate] = useState<VideoCheck | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [checkHint, setCheckHint] = useState('');
  const [paidHint, setPaidHint] = useState('');
  const [hintStep, setHintStep] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [missed, setMissed] = useState(false);
  const [cheer, setCheer] = useState(false);
  const [grading, setGrading] = useState(false);
  const [markingWatched, setMarkingWatched] = useState(false);
  const { width, height } = useWindowDimensions();
  const isCompact = width < 480;
  const isLandscape = width > height;

  const playerApiRef = useRef<VideoPlayerApi | null>(null);
  const gateRef = useRef<VideoCheck | null>(null);
  const passedRef = useRef(passedKeys);
  const currentRef = useRef<PlaylistItem | null>(null);
  const eligibleRef = useRef(false);
  const syncedSectionRef = useRef<Set<string>>(new Set());

  useEffect(() => { passedRef.current = passedKeys; }, [passedKeys]);

  useEffect(() => {
    let alive = true;
    dailyPracticeApi.unitVideos(unit.id)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setWatchedIds(new Set(res.videos.filter((video) => video.state === 'completed').map((video) => video.id)));
        setPassedKeys(new Set(res.passedCheckIds || []));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Không tải được video của chặng');
      });
    return () => { alive = false; };
  }, [unit.id]);

  const isSingleMode = Boolean(singleVideoOnly || /:level:(easy|medium|hard)$/.test(String(initialVideoId || '')));

  const playlist = useMemo<PlaylistItem[]>(() => {
    const all: PlaylistItem[] = [
      ...(data?.videos || []).map((video) => ({
        ...video,
        source: (video.source === 'step' ? 'step' : 'unit') as 'unit' | 'step',
        locked: video.state === 'locked',
      })),
      ...(data?.lesson?.videos || []).map((video) => ({
        id: video.id,
        title: video.title,
        url: video.url,
        state: 'active' as const,
        source: 'lesson' as const,
        locked: false,
      })),
    ];
    if (isSingleMode && initialVideoId) {
      const matched = all.find((item) => item.id === initialVideoId);
      if (matched) return [matched];
    }
    return all;
  }, [data, isSingleMode, initialVideoId]);

  const current = playlist.find((video) => video.id === currentId && !video.locked)
    || playlist.find((video) => !video.locked)
    || null;
  const lesson = data?.lesson || null;
  currentRef.current = current;

  const currentWatched = current
    ? ((current.source === 'unit' || current.source === 'step') && watchedIds.has(current.id))
  : false;

  const rawUrl = current?.url || '';
  const url = playableVideoUrl(rawUrl) || (rawUrl.startsWith('/uploads/') ? rawUrl : '');
  const embedded = embeddedVideoUrl(url);
  const playable = Boolean(embedded || isDirectVideoUrl(url) || url.startsWith('/uploads/'));

  const pendingOf = useCallback((video: PlaylistItem | null) => {
    if (!video || video.source === 'lesson') return [] as VideoCheck[];
    const checks = ((video as DpPathVideo).checks || []) as VideoCheck[];
    return checks.filter((check) => !passedRef.current.has(`${video.id}:${checkId(check)}`));
  }, []);

  const openGate = useCallback((check: VideoCheck) => {
    if (!check || gateRef.current) return;
    playerApiRef.current?.pause?.();
    const at = Number(check.atSec) || 0;
    const now = playerApiRef.current?.getCurrentTime?.() || 0;
    if (now > at + 1.2) playerApiRef.current?.seekTo?.(at);
    gateRef.current = check;
    setGate(check);
    setAnswerText('');
    setPicked(null);
    setCheckHint('');
    setPaidHint('');
    setCheckError('');
    setMissed(false);
    setCheer(false);
    setHintStep(false);
  }, []);

  const onMediaTick = useCallback((time: number) => {
    const video = currentRef.current;
    if (!video || video.source === 'lesson') return;
    if (gateRef.current) {
      const at = Number(gateRef.current.atSec) || 0;
      playerApiRef.current?.pause?.();
      if (time > at + 1.2) playerApiRef.current?.seekTo?.(at);
      return;
    }
    const check = pendingOf(video)
      .sort((a, b) => (Number(a.atSec) || 0) - (Number(b.atSec) || 0))
      .find((item) => time + 0.3 >= Number(item.atSec));
    if (check) openGate(check);
  }, [openGate, pendingOf]);

  useEffect(() => {
    eligibleRef.current = false;
    gateRef.current = null;
    setGate(null);
  }, [current?.id]);

  useEffect(() => {
    if (!current || !watchedIds.has(current.id)) return;
    if (!/:level:(easy|medium|hard)$/.test(current.id)) return;
    if (syncedSectionRef.current.has(current.id)) return;
    if (pendingOf(current).length > 0) return;
    syncedSectionRef.current.add(current.id);
    void Promise.resolve(onWatched(current.id)).catch(() => {});
  }, [current, watchedIds, onWatched]);

  const markWatched = async () => {
    eligibleRef.current = true;
    const cur = currentRef.current;
    if (!cur || (cur.source !== 'unit' && cur.source !== 'step')) return true;
    if (pendingOf(cur).length) {
      const pending = pendingOf(cur).slice().sort((a, b) => (Number(a.atSec) || 0) - (Number(b.atSec) || 0));
      if (pending[0]) {
        openGate(pending[0]);
        return false;
      }
    }
    const videoId = cur.id;
    if (watchedIds.has(videoId)) {
      if (/:level:(easy|medium|hard)$/.test(videoId) && !syncedSectionRef.current.has(videoId)) {
        syncedSectionRef.current.add(videoId);
        try {
          await onWatched(videoId);
        } catch { /* ignore */ }
      }
      return true;
    }
    syncedSectionRef.current.add(videoId);
    setMarkingWatched(true);
    try {
      await onWatched(videoId);
      setWatchedIds((prev) => new Set(prev).add(videoId));
      play('correct');
    } catch (err: unknown) {
      syncedSectionRef.current.delete(videoId);
      setCheckError(err instanceof Error ? err.message : 'Chưa lưu được tiến độ xem video');
      return false;
    } finally {
      setMarkingWatched(false);
    }
    const next = playlist.find((video) => (
      video.id !== videoId
      && !video.locked
      && !watchedIds.has(video.id)
      && (video.source === 'unit' || video.source === 'step')
    ));
    if (next) setCurrentId(next.id);
    return true;
  };

  const finishCheck = (id: string) => {
    const cur = currentRef.current;
    if (!cur) return;
    const key = `${cur.id}:${id}`;
    const next = new Set(passedRef.current);
    next.add(key);
    passedRef.current = next;
    setPassedKeys(next);
    gateRef.current = null;
    setGate(null);
    setCheer(false);
    setMissed(false);
    playerApiRef.current?.play?.();
    if (eligibleRef.current) void markWatched();
  };

  const gateChoices = gate
    ? (Array.isArray(gate.choices) ? gate.choices : Array.isArray(gate.options) ? gate.options : [])
    : [];

  const submitCheck = async (imageDataUrl = '') => {
    if (!gate || !current || checkBusy || cheer) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const id = checkId(gate);
      const checks = (current.source === 'lesson' ? [] : ((current as DpPathVideo).checks || [])) as VideoCheck[];
      const checkIndex = Math.max(0, checks.findIndex((c) => checkId(c) === id));
      const res = await dailyPracticeApi.answerVideoCheck(
        unit.id,
        current.id,
        checkIndex,
        picked ?? 0,
        { text: answerText, checkId: id, imageDataUrl },
      );
      if (res.correct) {
        setMissed(false);
        play('win');
        setCheer(true);
        setTimeout(() => finishCheck(id), 700);
      } else if (res.needsReview) {
        setMissed(false);
        setCheckHint(res.hint || 'Chưa đủ ý. Hãy viết rõ hơn.');
      } else {
        setMissed(true);
        setPicked(null);
        setAnswerText('');
        setCheckHint(res.hint || 'Chưa đúng. Thử lại nhé!');
        play('wrong');
      }
    } catch (err: unknown) {
      setMissed(false);
      setCheckError(err instanceof Error ? err.message : 'Chưa gửi được câu trả lời');
    } finally {
      setCheckBusy(false);
    }
  };

  const pickScreenshot = async () => {
    if (!gate || checkBusy || grading) return;
    setMissed(false);
    setCheckError('');
    setGrading(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setCheckError('Cần quyền thư viện ảnh để gửi ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.72,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      const mime = result.assets[0].mimeType || 'image/jpeg';
      await submitCheck(`data:${mime};base64,${result.assets[0].base64}`);
    } catch (err: unknown) {
      setCheckError(err instanceof Error ? err.message : 'Không tải được ảnh');
    } finally {
      setGrading(false);
    }
  };

  const buyHint = async () => {
    if (!gate || !current || checkBusy) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const id = checkId(gate);
      const checks = (current.source === 'lesson' ? [] : ((current as DpPathVideo).checks || [])) as VideoCheck[];
      const checkIndex = Math.max(0, checks.findIndex((c) => checkId(c) === id));
      const res = await dailyPracticeApi.buyVideoHint(unit.id, current.id, checkIndex);
      setPaidHint(res.hint || '');
      setHintStep(true);
    } catch (err: unknown) {
      setCheckError(err instanceof Error ? err.message : 'Chưa đổi được gợi ý');
    } finally {
      setCheckBusy(false);
    }
  };

  const select = (video: PlaylistItem) => {
    if (video.locked) return;
    play('tap');
    setCurrentId(video.id);
  };

  const unitChipLabel = `Chặng ${unit.index} · ${unit.title}`;

  const watchStatusControl = current && (current.source === 'unit' || current.source === 'step') ? (
    isSingleMode && currentWatched ? (
      <View style={styles.watchedPill}>
        <CheckCircle2 size={13} color="#6EE7B7" />
        <Text style={styles.watchedText}>Đã xem</Text>
      </View>
    ) : !currentWatched && pendingOf(current).length === 0 ? (
      <Pressable
        onPress={() => { void markWatched(); }}
        disabled={markingWatched}
        style={[styles.markWatchedBtn, markingWatched && { opacity: 0.6 }]}
      >
        <CheckCircle2 size={13} color="#FFFFFF" />
        <Text style={styles.markWatchedText}>{markingWatched ? 'Đang lưu…' : 'Đánh dấu đã xem'}</Text>
      </Pressable>
    ) : null
  ) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.backdrop}>
        <BlurView intensity={Platform.OS === 'android' ? 56 : 48} tint="light" pointerEvents="none" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.backdropTint} />
        <View style={[styles.card, { maxHeight: Math.round(height * 0.94) }]}>
          <View style={[styles.header, isCompact && styles.headerCompact]}>
            <View style={[styles.unitChipWrap, isCompact && styles.unitChipWrapCompact, { backgroundColor: color.from }]}>
              <View style={[styles.unitChipGradient, { backgroundColor: color.to, opacity: 0.55 }]} />
              <Text numberOfLines={1} style={[styles.unitChip, isCompact && styles.unitChipCompact]}>
                {unitChipLabel}
              </Text>
            </View>
            <View style={styles.headerTitleWrap}>
              <Clapperboard size={isCompact ? 14 : 16} color="#34D399" />
              <Text numberOfLines={isCompact ? 1 : 2} style={[styles.headerVideoTitle, isCompact && styles.headerVideoTitleCompact]}>{current?.title || 'Video của chặng'}</Text>
            </View>
            <DuoButton variant="danger" size="sm" text="Đóng" onPress={onClose} accessibilityLabel="Đóng video" />
          </View>

          <ScrollView style={styles.scroll} bounces={false} contentContainerStyle={styles.scrollContent}>
            <View style={[styles.frame, { maxHeight: isLandscape ? Math.round(height * 0.56) : Math.round(height * 0.62) }]}>
              {!data && !error ? (
                <View style={styles.startOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.startLabel}>Đang tải video…</Text>
                </View>
              ) : error ? (
                <View style={styles.startOverlay}><Text style={[styles.startLabel, { color: '#FCD34D' }]}>{error}</Text></View>
              ) : !current ? (
                <View style={styles.startOverlay}>
                  <Lock size={22} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.startLabel}>{lesson?.locked ? lesson.message : 'Chặng này chưa có video.'}</Text>
                </View>
              ) : playable ? (
                <VideoPlayerFrame
                  key={`${unit.id}-${current.id}`}
                  videoUrl={resolveMobilePublicUrl(url)}
                  embeddedUrl={embedded}
                  title={current.title}
                  lessonId={`dp-${userId || 'anon'}-${unit.id}-${current.id}`}
                  antiSeekEnabled={!currentWatched && current.antiSeek !== false && (current.source === 'unit' || current.source === 'step')}
                  done={currentWatched}
                  brandedChrome
                  appearance="window"
                  chromeBg={PATH_VIDEO_MODAL_LAYOUT.videoAreaBg}
                  chromeRightSlot={watchStatusControl}
                  playerApiRef={playerApiRef}
                  onProgress={(progress) => {
                    noteStudyMediaProgress(progress.playing);
                    onMediaTick(progress.currentTime);
                  }}
                  onWatched={markWatched}
                />
              ) : (
                <View style={styles.startOverlay}>
                  <Text style={styles.startLabel}>Liên kết video chưa đúng định dạng. Trung tâm sẽ cập nhật sớm.</Text>
                </View>
              )}

              {cheer ? (
                <View style={styles.cheerHud} pointerEvents="none">
                  <Text style={styles.cheerText}>Chính xác!</Text>
                </View>
              ) : null}

              {gate && !cheer ? (
                <View style={styles.gateOverlay}>
                  <View style={styles.gateCard}>
                    <Text style={styles.gateEyebrow}>{`DỪNG Ở GIÂY ${gate.atSec || 0}`}</Text>
                    {missed ? (
                      <Text style={styles.gateMissed}>
                        {gate.kind === 'screen'
                          ? 'AI chưa chấp nhận. Mất 5 XP. Hãy tải đáp án mới.'
                          : 'Chưa đúng. Mất 5 XP. Hãy thử lại.'}
                      </Text>
                    ) : null}
                    <Text style={styles.gatePrompt}>{gate.prompt}</Text>

                    {hintStep && paidHint ? (
                      <>
                        <Text style={styles.gateHintPaid}>{paidHint}</Text>
                        <DuoButton variant="primary" size="sm" text="Tiếp tục xem" onPress={() => finishCheck(checkId(gate))} />
                      </>
                    ) : (
                      <>
                        {gate.kind === 'choice' || gateChoices.length > 0 ? (
                          <View style={styles.gateChoices}>
                            {gateChoices.map((choice, index) => (
                              <Pressable
                                key={`${choice}-${index}`}
                                onPress={() => setPicked(index)}
                                style={[styles.choiceBtn, picked === index && styles.choiceBtnActive]}
                              >
                                <Text style={[styles.choiceText, picked === index && styles.choiceTextActive]}>{choice}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                        {gate.kind === 'text' ? (
                          <TextInput
                            value={answerText}
                            onChangeText={setAnswerText}
                            placeholder="Nhập đáp án"
                            placeholderTextColor="#94A3B8"
                            style={styles.gateInput}
                          />
                        ) : null}
                        {gate.kind === 'screen' ? (
                          <DuoButton
                            variant="accent"
                            size="sm"
                            fullWidth
                            text={grading ? 'Đang chấm…' : missed ? 'Tải đáp án mới' : 'Gửi ảnh'}
                            onPress={pickScreenshot}
                            disabled={grading || checkBusy}
                          />
                        ) : null}
                        {checkHint ? <Text style={styles.gateHint}>{checkHint}</Text> : null}
                        {checkError ? <Text style={styles.gateError}>{checkError}</Text> : null}
                        <View style={styles.gateActions}>
                          {gate.kind !== 'screen' ? (
                            <DuoButton
                              variant="primary"
                              size="sm"
                              text={checkBusy ? 'Đang chấm…' : 'Trả lời'}
                              disabled={checkBusy || (gateChoices.length > 0 ? picked === null : !answerText.trim())}
                              onPress={() => submitCheck('')}
                            />
                          ) : null}
                          <DuoButton variant="secondary" size="sm" text="Thôi" onPress={() => { gateRef.current = null; setGate(null); playerApiRef.current?.play?.(); }} />
                          {Number(gate.hintCostXp) > 0 ? (
                            <DuoButton variant="accent" size="sm" text={`Gợi ý · ${gate.hintCostXp} XP`} onPress={buyHint} disabled={checkBusy} />
                          ) : null}
                        </View>
                      </>
                    )}
                  </View>
                </View>
              ) : null}
            </View>

            {!isSingleMode && playlist.length > 0 ? (
              <View style={styles.listBlock}>
                <Text style={styles.listTitle}>{`DANH SÁCH VIDEO (${playlist.length})`}</Text>
                {playlist.map((video, index) => {
                  const active = current?.id === video.id;
                  const done = (video.source === 'unit' || video.source === 'step') && watchedIds.has(video.id);
                  return (
                    <Pressable
                      key={video.id}
                      onPress={() => select(video)}
                      disabled={video.locked}
                      style={[styles.item, active && styles.itemActive, video.locked && { opacity: 0.5 }]}
                    >
                      <View style={[styles.itemIndex, { backgroundColor: active ? '#EF3B36' : 'rgba(255,255,255,0.12)' }]}>
                        {video.locked ? (
                          <Lock size={12} color="#FFFFFF" />
                        ) : active ? (
                          <Play size={12} color="#FFFFFF" fill="#FFFFFF" />
                        ) : (
                          <Text style={styles.itemIndexText}>{index + 1}</Text>
                        )}
                      </View>
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={styles.itemTitle}>{video.title}</Text>
                        <Text numberOfLines={1} style={styles.itemMeta}>
                          {video.source === 'lesson'
                            ? `Bài giảng · ${lesson?.title || ''}`
                            : (video as DpPathVideo).stepLabel
                              ? `${(video as DpPathVideo).stepLabel} · Video cấp`
                              : 'Video chặng'}
                        </Text>
                      </View>
                      {done ? <CheckCircle2 size={16} color="#34D399" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          {lesson || (!playable && watchStatusControl) ? (
            <View style={styles.footer}>
              {!playable ? (watchStatusControl || <View style={styles.flex} />) : <View style={styles.flex} />}
              {lesson ? (
                <Pressable
                  onPress={() => { onClose(); onOpenLesson({ subjectId: lesson.subjectId, unitId: lesson.unitId }); }}
                  style={styles.lessonButton}
                >
                  <ExternalLink size={15} color="#FFFFFF" />
                  <Text style={styles.lessonButtonText}>Mở trang bài giảng</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.sm },
  backdropTint: { ...StyleSheet.absoluteFill, backgroundColor: PATH_VIDEO_MODAL_LAYOUT.backdrop },
  card: {
    width: '100%',
    maxWidth: 896,
    alignSelf: 'center',
    maxHeight: '94%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: PATH_VIDEO_MODAL_LAYOUT.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#450A0A',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: PATH_VIDEO_MODAL_LAYOUT.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: PATH_VIDEO_MODAL_LAYOUT.headerBorder,
  },
  headerCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    gap: 6,
  },
  unitChipWrap: {
    maxWidth: '42%',
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'relative',
  },
  unitChipWrapCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unitChipGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  unitChip: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  unitChipCompact: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerVideoTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  headerVideoTitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: { maxHeight: '100%' },
  scrollContent: { paddingBottom: 4 },
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: PATH_VIDEO_MODAL_LAYOUT.videoAreaBg,
    overflow: 'hidden',
    position: 'relative',
  },
  startOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#23262E',
    paddingHorizontal: spacing.lg,
  },
  startLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cheerHud: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cheerText: { color: '#6EE7B7', fontSize: 28, fontWeight: '900' },
  gateOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: spacing.md,
  },
  gateCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    gap: 10,
  },
  gateEyebrow: { fontSize: 11, fontWeight: '900', color: '#B45309', letterSpacing: 0.4 },
  gateMissed: { fontSize: 13, fontWeight: '800', color: '#BE123C' },
  gatePrompt: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  gateChoices: { gap: 6 },
  choiceBtn: { borderRadius: 12, backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 10 },
  choiceBtnActive: { backgroundColor: '#0284C7' },
  choiceText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  choiceTextActive: { color: '#FFFFFF' },
  gateInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  gateHint: { fontSize: 13, fontWeight: '600', color: '#B45309', backgroundColor: '#FFFBEB', padding: 10, borderRadius: 12 },
  gateHintPaid: { fontSize: 14, fontWeight: '600', color: '#0C4A6E', backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12 },
  gateError: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  gateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  listBlock: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 4 },
  listTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  itemActive: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  itemIndex: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemIndexText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  itemTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  itemMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#16181E',
  },
  markWatchedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#059669',
  },
  markWatchedText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  watchedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  watchedText: { color: '#6EE7B7', fontSize: 12, fontWeight: '900' },
  lessonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  lessonButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
