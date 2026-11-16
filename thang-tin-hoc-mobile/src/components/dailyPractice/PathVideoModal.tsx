import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, DeviceEventEmitter, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Bot, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clapperboard, Clock, Lightbulb, Lock, Play, Send, StickyNote, X, Zap } from 'lucide-react-native';
import { VideoPlayerFrame, type VideoPlayerApi, type VideoPlayerProgress } from '../../screens/VideoPlayerFrame';
import { PathLessonAiAssistantPanel, VideoTimelineNotesPanel } from './PathVideoPanels';
import { resolveMobilePublicUrl } from '../../services/apiClient';
import { embeddedVideoUrl, isDirectVideoUrl, playableVideoUrl } from '../../utils/videoSource';
import {
  DAILY_PRACTICE_STATS_EVENT,
  dailyPracticeApi,
  type DpNodeState,
  type DpPathUnit,
  type DpPathVideo,
  type DpUnitVideos,
} from '../../services/dailyPracticeApi';
import { noteStudyMediaProgress } from '../../services/studyActivity';
import { saveLastStudySession } from '../../utils/resumeLearning';
import type { GameSound } from './useGameSounds';
import { DuoButton } from '../duo/DuoButton';
import { spacing } from '../../theme/tokens';
import { PATH_VIDEO_MODAL_LAYOUT } from '../../../../shared/dailyPractice/lmsBrandedVideoPlayer.mjs';

const VIDEO_CHECK_ANSWER_XP = 5;

type VideoCheck = {
  id?: string;
  _id?: string;
  atSec?: number;
  prompt?: string;
  kind?: string;
  choices?: string[];
  options?: string[];
  hintCostXp?: number;
  reviewHint?: string;
  reviewAnswer?: string;
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
  initialAtSec = 0,
  topicId = '',
  nodeKey = '',
  color,
  userId,
  lessonTitle,
  courseTitle,
  xpTotal = null,
  singleVideoOnly = false,
  play,
  onClose,
  onWatched,
  onChecksChanged,
  onBuyXp,
}: {
  unit: DpPathUnit;
  initialVideoId?: string;
  initialAtSec?: number;
  topicId?: string;
  nodeKey?: string;
  color: { from: string; to: string };
  userId: string;
  lessonTitle?: string;
  courseTitle?: string;
  xpTotal?: number | null;
  singleVideoOnly?: boolean;
  play: (s: GameSound) => void;
  onClose: () => void;
  onWatched: (videoId: string) => Promise<void>;
  onChecksChanged?: () => void;
  onBuyXp?: () => void;
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
  const [xpShortage, setXpShortage] = useState(false);
  const [walletXp, setWalletXp] = useState<number | null>(typeof xpTotal === 'number' ? xpTotal : null);
  const [missed, setMissed] = useState(false);
  const [cheer, setCheer] = useState(false);
  const [grading, setGrading] = useState(false);
  const [markingWatched, setMarkingWatched] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const isCompact = width < 480;
  const isLandscape = width > height;

  const playerApiRef = useRef<VideoPlayerApi | null>(null);
  const gateRef = useRef<VideoCheck | null>(null);
  const passedRef = useRef(passedKeys);
  const currentRef = useRef<PlaylistItem | null>(null);
  const eligibleRef = useRef(false);
  const syncedSectionRef = useRef<Set<string>>(new Set());
  const lastKnownTimeRef = useRef(0);
  const dataRef = useRef<DpUnitVideos | null>(null);

  useEffect(() => { passedRef.current = passedKeys; }, [passedKeys]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { setCurrentId(initialVideoId); }, [initialVideoId, unit.id]);
  useEffect(() => {
    if (typeof xpTotal === 'number') setWalletXp(xpTotal);
  }, [xpTotal]);
  useEffect(() => {
    let alive = true;
    void dailyPracticeApi.overview()
      .then((res) => {
        if (alive && typeof res?.stats?.xpTotal === 'number') {
          setWalletXp(res.stats.xpTotal);
        }
      })
      .catch(() => {});
    const sub = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, (detail?: { xpTotal?: number | null }) => {
      if (typeof detail?.xpTotal === 'number') {
        setWalletXp(detail.xpTotal);
      }
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const syncUnitVideos = useCallback((silent = false) => {
    let active = true;
    void dailyPracticeApi.unitVideos(unit.id)
      .then((res) => {
        if (!active) return;
        setData(res);
        setWatchedIds(new Set(res.videos.filter((video) => video.state === 'completed').map((video) => video.id)));
        const nextPassed = new Set(res.passedCheckIds || []);
        passedRef.current = nextPassed;
        setPassedKeys(nextPassed);
        setError('');
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (!silent || !dataRef.current) {
          setError(err instanceof Error ? err.message : 'Không tải được video của chặng');
        }
      });
    return () => { active = false; };
  }, [unit.id]);

  useEffect(() => {
    const cancel = syncUnitVideos(false);
    const appSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncUnitVideos(true);
      }
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const onForeground = () => {
        if (document.visibilityState !== 'hidden') {
          syncUnitVideos(true);
        }
      };
      window.addEventListener('focus', onForeground);
      document.addEventListener('visibilitychange', onForeground);
      return () => {
        cancel();
        appSub.remove();
        window.removeEventListener('focus', onForeground);
        document.removeEventListener('visibilitychange', onForeground);
      };
    }
    return () => {
      cancel();
      appSub.remove();
    };
  }, [syncUnitVideos]);

  const isSingleMode = Boolean(singleVideoOnly || /:(level|practice):(easy|medium|hard)$/.test(String(initialVideoId || '')));

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
    ? ((current.source === 'unit' || current.source === 'step') && (watchedIds.has(current.id) || current.state === 'completed'))
    : false;

  const rawUrl = current?.url || '';
  const url = playableVideoUrl(rawUrl) || (rawUrl.startsWith('/uploads/') ? rawUrl : '');
  const embedded = embeddedVideoUrl(url);
  const playable = Boolean(embedded || isDirectVideoUrl(url) || url.startsWith('/uploads/'));

  const pendingOf = useCallback((video: PlaylistItem | null) => {
    if (!video || video.source === 'lesson') return [] as VideoCheck[];
    const checks = ((video as DpPathVideo).checks || []) as VideoCheck[];
    return checks.filter((check) => {
      const key = `${video.id}:${checkId(check)}`;
      return !passedRef.current.has(key) && !passedKeys.has(key);
    });
  }, [passedKeys]);

  const getVideoCurrentTime = useCallback(() => {
    const apiTime = Number(playerApiRef.current?.getCurrentTime?.() ?? NaN);
    if (Number.isFinite(apiTime) && apiTime >= 0) return apiTime;
    return lastKnownTimeRef.current || 0;
  }, []);

  const seekVideoTo = useCallback((sec: number) => {
    const target = Math.max(0, Math.floor(Number(sec) || 0));
    lastKnownTimeRef.current = target;
    playerApiRef.current?.seekTo?.(target);
    playerApiRef.current?.play?.();
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
    setXpShortage(false);
    setMissed(false);
    setCheer(false);
    setHintStep(false);
  }, []);

  const dismissGate = useCallback(() => {
    gateRef.current = null;
    setGate(null);
    setXpShortage(false);
    playerApiRef.current?.play?.();
  }, []);

  const onMediaTick = useCallback((time: number) => {
    lastKnownTimeRef.current = Number(time) || 0;
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
    lastKnownTimeRef.current = 0;
    gateRef.current = null;
    setGate(null);
  }, [current?.id]);

  useEffect(() => {
    if (!unit?.id || !current?.id) return undefined;
    const persistResume = () => {
      void saveLastStudySession({
        kind: 'daily_practice',
        studentId: userId,
        topicId: topicId || '',
        nodeKey: nodeKey || '',
        courseTitle: courseTitle || '',
        unitId: String(unit.id),
        unitTitle: unit.title || '',
        lessonId: String(current.id),
        lessonTitle: current.title || unit.title || 'Video chặng DewSkill',
        sectionId: 'video',
        sectionLabel: `Chặng ${unit.index || 1} · Video bài học`,
        atSec: Math.floor(getVideoCurrentTime()),
        progressPct: null,
        href: '/student/daily-practice?watch=stage',
      });
    };
    persistResume();
    const timer = setInterval(persistResume, 5000);
    return () => {
      persistResume();
      clearInterval(timer);
    };
  }, [unit?.id, unit?.index, unit?.title, current?.id, current?.title, userId, topicId, nodeKey, courseTitle, getVideoCurrentTime]);

  useEffect(() => {
    if (!current || !watchedIds.has(current.id)) return;
    if (current.source !== 'unit' && current.source !== 'step') return;
    if (syncedSectionRef.current.has(current.id)) return;
    if (pendingOf(current).length > 0) return;
    syncedSectionRef.current.add(current.id);
    void Promise.resolve(onWatched(current.id)).catch(() => {});
  }, [current, watchedIds, pendingOf, onWatched]);

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
      if ((cur.source === 'unit' || cur.source === 'step') && !syncedSectionRef.current.has(videoId)) {
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
    onChecksChanged?.();
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
        const key = `${current.id}:${id}`;
        const nextPassed = new Set(passedRef.current);
        nextPassed.add(key);
        passedRef.current = nextPassed;
        setPassedKeys(nextPassed);
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
      const status = (err as { status?: number })?.status;
      if (status === 402) {
        setXpShortage(true);
        setCheckError(err instanceof Error ? err.message : 'Bạn không đủ XP. Hãy nạp thêm XP để tiếp tục.');
      } else {
        setCheckError(err instanceof Error ? err.message : 'Chưa gửi được câu trả lời');
      }
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
    setXpShortage(false);
    try {
      const id = checkId(gate);
      const checks = (current.source === 'lesson' ? [] : ((current as DpPathVideo).checks || [])) as VideoCheck[];
      const checkIndex = Math.max(0, checks.findIndex((c) => checkId(c) === id));
      const cost = Number(gate.hintCostXp) || 0;
      if (cost > 0) {
        try {
          const ov = await dailyPracticeApi.overview();
          const xp = Number(ov?.stats?.xpTotal ?? walletXp ?? 0);
          if (typeof ov?.stats?.xpTotal === 'number') setWalletXp(ov.stats.xpTotal);
          if (xp < cost) {
            setXpShortage(true);
            setCheckError(`Cần ${cost} XP để xem gợi ý. Bạn hiện có ${xp} XP.`);
            return;
          }
        } catch {
          // Server still guards XP balance cleanly.
        }
      }
      const res = await dailyPracticeApi.buyVideoHint(unit.id, current.id, checkIndex, id);
      if (typeof res?.profileXp === 'number') setWalletXp(res.profileXp);
      setPaidHint(res.hint || '');
      setHintStep(true);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 402) setXpShortage(true);
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

  const currentIdx = current ? playlist.findIndex((v) => v.id === current.id) : -1;
  const nextVideo = currentIdx >= 0
    ? playlist.slice(currentIdx + 1).find((v) => !v.locked) || null
    : null;
  const handleContinueAfterVideo = () => {
    if (!isSingleMode && nextVideo) {
      setCurrentId(nextVideo.id);
      return;
    }
    onClose();
  };

  const watchStatusControl = current && (current.source === 'unit' || current.source === 'step') ? (
    currentWatched ? (
      <Pressable
        onPress={handleContinueAfterVideo}
        style={styles.markWatchedBtn}
        accessibilityRole="button"
      >
        <CheckCircle2 size={13} color="#FFFFFF" />
        <Text style={styles.markWatchedText}>
          {!isSingleMode && nextVideo ? 'Tiếp tục bài kế tiếp' : 'Tiếp tục'}
        </Text>
        <ChevronRight size={13} color="#FFFFFF" />
      </Pressable>
    ) : (
      <View style={styles.watchLockedPill}>
        <Lock size={12} color="rgba(255,255,255,0.8)" />
        <Text style={styles.watchLockedText}>
          {markingWatched ? 'Đang lưu…' : (isCompact ? 'Xem ≥70% để mở khóa' : 'Xem đủ 70% để mở khóa')}
        </Text>
      </View>
    )
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
                  chromeRightSlot={!isCompact ? watchStatusControl : null}
                  initialAtSec={!initialVideoId || current.id === initialVideoId ? initialAtSec : 0}
                  playerApiRef={playerApiRef}
                  onProgress={(progress: VideoPlayerProgress) => {
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
            </View>

            {!isSingleMode && playlist.length > 0 ? (
              <View style={styles.listBlock}>
                <Text style={styles.listTitle}>{`DANH SÁCH VIDEO (${playlist.length})`}</Text>
                {playlist.map((video, index) => {
                      const active = current?.id === video.id;
                      const done = (video.source === 'unit' || video.source === 'step') && (watchedIds.has(video.id) || video.state === 'completed');
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

            {current ? (
              <View style={styles.accordionsWrap}>
                <View style={styles.accordionCard}>
                  <Pressable
                    onPress={() => setNotesOpen((prev) => {
                      const next = !prev;
                      if (next) setAiOpen(false);
                      return next;
                    })}
                    style={styles.accordionHeader}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: notesOpen }}
                  >
                    <View style={styles.accordionTitleRow}>
                      <StickyNote size={15} color="#34D399" />
                      <Text style={styles.accordionTitle}>Ghi chú theo mốc thời gian video</Text>
                    </View>
                    {notesOpen ? (
                      <ChevronUp size={16} color="#94A3B8" />
                    ) : (
                      <ChevronDown size={16} color="#94A3B8" />
                    )}
                  </Pressable>
                  {notesOpen ? (
                    <VideoTimelineNotesPanel
                      unitId={unit.id}
                      unitTitle={unit.title}
                      userId={userId}
                      lessonId={current.id}
                      lessonTitle={current.title || unit.title}
                      getCurrentTime={getVideoCurrentTime}
                      onSeekTo={playable ? seekVideoTo : undefined}
                    />
                  ) : null}
                </View>

                <View style={styles.accordionCard}>
                  <Pressable
                    onPress={() => setAiOpen((prev) => {
                      const next = !prev;
                      if (next) setNotesOpen(false);
                      return next;
                    })}
                    style={styles.accordionHeader}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: aiOpen }}
                  >
                    <View style={styles.accordionTitleRow}>
                      <Bot size={15} color="#34D399" />
                      <Text style={styles.accordionTitle}>Trợ lý AI trong bài học · Công thức Excel & Hỏi đáp</Text>
                    </View>
                    {aiOpen ? (
                      <ChevronUp size={16} color="#94A3B8" />
                    ) : (
                      <ChevronDown size={16} color="#94A3B8" />
                    )}
                  </Pressable>
                  {aiOpen ? (
                    <PathLessonAiAssistantPanel
                      key={current.id}
                      lessonTitle={current.title || lesson?.title || lessonTitle}
                      unitTitle={unit.title}
                      courseTitle={courseTitle || lesson?.title || unit.title || 'Tin học Văn phòng'}
                      guide={current.source !== 'lesson' ? (current as DpPathVideo).guide : null}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {(!playable || isCompact) && watchStatusControl ? (
            <View style={styles.footer}>
              {watchStatusControl}
            </View>
          ) : null}

          {cheer ? (
            <View style={styles.cheerHud} pointerEvents="none">
              <Text style={styles.cheerText}>Chính xác!</Text>
            </View>
          ) : null}

          {gate && !cheer ? (
            <View style={styles.gateOverlay}>
              <ScrollView
                style={styles.gateScroll}
                contentContainerStyle={styles.gateScrollInner}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.gateCard}>
                  <View style={styles.gateHeaderRow}>
                    <View style={styles.gateBadgeRow}>
                      <View style={styles.gateClockPill}>
                        <Clock size={11} color="#92400E" />
                        <Text style={styles.gateClockText}>{`Giây ${gate.atSec || 0}`}</Text>
                      </View>
                      {currentWatched ? (
                        <View style={styles.gateReviewPill}>
                          <Text style={styles.gateReviewPillText}>Ôn lại · Miễn phí XP</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.gateXpPill}>
                            <Zap size={10} color="#047857" fill="#10B981" />
                            <Text style={styles.gateXpPillText}>{`+${VIDEO_CHECK_ANSWER_XP} XP`}</Text>
                          </View>
                          {typeof walletXp === 'number' ? (
                            <View style={styles.gateWalletPill}>
                              <Text style={styles.gateWalletText}>{`Ví: ${walletXp} XP`}</Text>
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                    <Pressable onPress={dismissGate} style={styles.gateCloseBtn} accessibilityRole="button" accessibilityLabel="Đóng câu hỏi">
                      <X size={16} color="#64748B" />
                    </Pressable>
                  </View>

                  {!currentWatched && missed ? (
                    <Text style={styles.gateMissed}>
                      {gate.kind === 'screen'
                        ? `AI chưa chấp nhận (−${VIDEO_CHECK_ANSWER_XP} XP). Hãy gửi ảnh mới.`
                        : gate.kind === 'text'
                          ? `Chưa đúng ý (−${VIDEO_CHECK_ANSWER_XP} XP). Hãy nhập lại.`
                          : `Chưa đúng (−${VIDEO_CHECK_ANSWER_XP} XP). Hãy chọn lại.`}
                    </Text>
                  ) : null}
                  <Text style={styles.gatePrompt}>{gate.prompt}</Text>

                  {currentWatched ? (
                    <>
                      <View style={styles.gateReviewCard}>
                        <View style={styles.gateReviewRow}>
                          <Lightbulb size={16} color="#0284C7" style={{ marginTop: 2 }} />
                          <Text style={styles.gateReviewBody}>
                            {gate.reviewHint || gate.reviewAnswer || 'Video này bạn đã hoàn thành. Hãy xem lại đoạn hướng dẫn rồi tiếp tục nhé.'}
                          </Text>
                        </View>
                        {gate.reviewHint && gate.reviewAnswer && gate.reviewAnswer !== gate.reviewHint ? (
                          <Text style={styles.gateReviewAnswer}>{`Đáp án gợi ý: ${gate.reviewAnswer}`}</Text>
                        ) : null}
                      </View>
                      <DuoButton
                        variant="primary"
                        size="sm"
                        fullWidth
                        text="Tiếp tục xem video"
                        onPress={() => finishCheck(checkId(gate))}
                      />
                    </>
                  ) : hintStep && paidHint ? (
                    <>
                      <Text style={styles.gateHintPaid}>{paidHint}</Text>
                      <DuoButton variant="primary" size="sm" fullWidth text="Tiếp tục xem video" onPress={() => finishCheck(checkId(gate))} />
                    </>
                  ) : (
                    <>
                      {(gate.kind === 'choice' || (!gate.kind && gateChoices.length > 0)) && gateChoices.length > 0 ? (
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
                          onSubmitEditing={() => {
                            if (!checkBusy && answerText.trim()) void submitCheck('');
                          }}
                          placeholder="Nhập câu trả lời của bạn…"
                          placeholderTextColor="#94A3B8"
                          style={styles.gateInput}
                        />
                      ) : null}
                      {gate.kind === 'screen' ? (
                        <DuoButton
                          variant="accent"
                          size="sm"
                          fullWidth
                          text={grading ? 'Đang chấm…' : missed ? 'Chọn ảnh bài làm mới' : 'Tải ảnh chụp bài làm'}
                          onPress={pickScreenshot}
                          disabled={grading || checkBusy}
                        />
                      ) : null}
                      {checkHint ? <Text style={styles.gateHint}>{checkHint}</Text> : null}
                      {checkError ? <Text style={styles.gateError}>{checkError}</Text> : null}
                      {xpShortage && onBuyXp ? (
                        <DuoButton variant="gold" size="sm" fullWidth text="Mua thêm XP" onPress={onBuyXp} />
                      ) : null}
                      <View style={styles.gateActions}>
                        {gate.kind !== 'screen' ? (
                          <DuoButton
                            variant="primary"
                            size="sm"
                            icon={<Send size={13} color="#FFFFFF" />}
                            text={checkBusy ? 'Đang chấm…' : 'Trả lời'}
                            disabled={checkBusy || (gateChoices.length > 0 ? picked === null : !answerText.trim())}
                            onPress={() => submitCheck('')}
                          />
                        ) : null}
                        <DuoButton variant="secondary" size="sm" text="Thôi" onPress={dismissGate} />
                        {Number(gate.hintCostXp) > 0 ? (
                          <DuoButton variant="accent" size="sm" text={`Gợi ý · ${gate.hintCostXp} XP`} onPress={buyHint} disabled={checkBusy} />
                        ) : null}
                      </View>
                      <Text style={styles.gateFootNote}>
                        {`Đúng lần đầu +${VIDEO_CHECK_ANSWER_XP} XP · Sai −${VIDEO_CHECK_ANSWER_XP} XP rồi ${gate.kind === 'screen' ? 'gửi lại' : gate.kind === 'text' ? 'nhập lại' : 'chọn lại'}`}
                      </Text>
                    </>
                  )}
                </View>
              </ScrollView>
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
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    backgroundColor: 'rgba(2,6,23,0.68)',
    zIndex: 60,
  },
  gateScroll: {
    flex: 1,
  },
  gateScrollInner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  gateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md,
    gap: 10,
  },
  gateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gateBadgeRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  gateClockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
  },
  gateClockText: { fontSize: 11, fontWeight: '900', color: '#92400E' },
  gateReviewPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  gateReviewPillText: { fontSize: 11, fontWeight: '800', color: '#0369A1' },
  gateXpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  gateXpPillText: { fontSize: 11, fontWeight: '800', color: '#047857' },
  gateWalletPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  gateWalletText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  gateCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  gateReviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    padding: 12,
    gap: 6,
  },
  gateReviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  gateReviewBody: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0C4A6E', lineHeight: 19 },
  gateReviewAnswer: { fontSize: 12, fontWeight: '800', color: '#047857', paddingLeft: 24 },
  gateFootNote: { fontSize: 11, fontWeight: '500', color: '#94A3B8', textAlign: 'center', marginTop: 2 },
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
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  markWatchedText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  watchLockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  watchLockedText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },
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
  accordionsWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  accordionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    backgroundColor: 'rgba(15,23,42,0.88)',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  accordionTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  accordionTitle: {
    flex: 1,
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
});
