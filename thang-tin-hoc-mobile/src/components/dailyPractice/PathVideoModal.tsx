import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, DeviceEventEmitter, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Bot, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clapperboard, Lock, Play, StickyNote } from 'lucide-react-native';
import { VideoPlayerFrame, type VideoPlayerApi, type VideoPlayerProgress } from '../../screens/VideoPlayerFrame';
import { PathLessonAiAssistantPanel, VideoTimelineNotesPanel } from './PathVideoPanels';
import { VideoCheckpointQuizCard } from './VideoCheckpointQuizCard';
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
import {
  findTriggeredVideoCheck,
  resolveVideoCheckResumeTarget,
  sortVideoChecksAsc,
} from '../../../../shared/dailyPractice/videoCheckpointPlayback.mjs';

const VIDEO_CHECK_ANSWER_XP = 5;
const VIDEO_CHECK_SKIP_XP = 15;

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
const DEFAULT_VIDEO_COLOR = { from: '#10B981', to: '#059669' };

export function PathVideoModal({
  unit,
  initialVideoId = '',
  initialAtSec = 0,
  topicId = '',
  nodeKey = '',
  color = DEFAULT_VIDEO_COLOR,
  userId,
  lessonTitle,
  courseTitle,
  xpTotal = null,
  singleVideoOnly = false,
  inline = false,
  hideStudyTools = false,
  frameless = false,
  review = false,
  play = () => { },
  onClose = () => { },
  onWatched,
  onChecksChanged,
  onBuyXp,
}: {
  unit: DpPathUnit;
  initialVideoId?: string;
  initialAtSec?: number;
  topicId?: string;
  nodeKey?: string;
  color?: { from: string; to: string };
  userId: string;
  lessonTitle?: string;
  courseTitle?: string;
  xpTotal?: number | null;
  singleVideoOnly?: boolean;
  inline?: boolean;
  hideStudyTools?: boolean;
  frameless?: boolean;
  review?: boolean;
  play?: (s: GameSound) => void;
  onClose?: () => void;
  onWatched: (videoId: string, meta?: { initialSync?: boolean; completedJustNow?: boolean }) => Promise<void> | void;
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
  const [fullscreen, setFullscreen] = useState(false);
  const { width, height } = useWindowDimensions();
  const isCompact = width < 480;
  const isLandscape = width > height;

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const playerApiRef = useRef<VideoPlayerApi | null>(null);
  const gateRef = useRef<VideoCheck | null>(null);
  const passedRef = useRef(passedKeys);
  const initializedVideoIdsRef = useRef<Set<string>>(new Set());
  const replayRequiredIdsRef = useRef<Set<string>>(new Set());
  const localPassedInRunRef = useRef<Set<string>>(new Set());
  const currentRef = useRef<PlaylistItem | null>(null);
  const eligibleRef = useRef(false);
  const syncedSectionRef = useRef<Set<string>>(new Set());
  const lastKnownTimeRef = useRef(0);
  const dataRef = useRef<DpUnitVideos | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishCheckRef = useRef<(id: string) => void>(() => { });

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
      .catch(() => { });
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
        const videos = res.videos || [];
        videos.forEach((video) => {
          if (!initializedVideoIdsRef.current.has(video.id)) {
            initializedVideoIdsRef.current.add(video.id);
            if (frameless || video.state === 'completed') {
              replayRequiredIdsRef.current.add(video.id);
            }
          }
        });
        setData(res);
        setWatchedIds(new Set(videos.filter((video) => video.state === 'completed').map((video) => video.id)));
        const nextPassed = new Set(
          (res.passedCheckIds || []).filter((id) => {
            const sId = String(id);
            for (const reqVidId of replayRequiredIdsRef.current) {
              if (sId.startsWith(`${reqVidId}:`)) return false;
            }
            return true;
          }),
        );
        localPassedInRunRef.current.forEach((key) => nextPassed.add(key));
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
  }, [unit.id, frameless]);

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
  const effectiveReview = Boolean(review || currentWatched);

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
    const check = findTriggeredVideoCheck(pendingOf(video), time);
    if (check) openGate(check as VideoCheck);
  }, [openGate, pendingOf]);

  useEffect(() => {
    eligibleRef.current = false;
    lastKnownTimeRef.current = 0;
    gateRef.current = null;
    setGate(null);
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, [current?.id]);

  useEffect(() => () => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

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
    const hadChecks = Boolean((current as DpPathVideo).checks?.length);
    void Promise.resolve(onWatched(current.id, { initialSync: !hadChecks, completedJustNow: frameless && hadChecks })).catch(() => { });
  }, [current, watchedIds, pendingOf, passedKeys, frameless, onWatched]);

  const markWatched = async () => {
    eligibleRef.current = true;
    const cur = currentRef.current;
    if (!cur || (cur.source !== 'unit' && cur.source !== 'step')) return true;
    const pendingList = sortVideoChecksAsc(pendingOf(cur)) as VideoCheck[];
    if (pendingList.length) {
      const dur = Number(playerApiRef.current?.getDuration?.()) || 0;
      const curTime = getVideoCurrentTime();
      const atEnd = dur > 0 && curTime >= Math.max(0, dur - 1);
      if ((!playable || atEnd) && pendingList[0]) {
        openGate(pendingList[0]);
      }
      return false;
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
      await onWatched(videoId, { completedJustNow: true });
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
    const completedAtSec = Number(gateRef.current?.atSec) || 0;
    const key = `${cur.id}:${id}`;
    localPassedInRunRef.current.add(key);
    const next = new Set(passedRef.current);
    next.add(key);
    passedRef.current = next;
    setPassedKeys(next);
    gateRef.current = null;
    setGate(null);
    setCheer(false);
    setMissed(false);
    onChecksChanged?.();
    const plan = resolveVideoCheckResumeTarget({
      checkAtSec: completedAtSec,
      currentTime: getVideoCurrentTime(),
      duration: Number(playerApiRef.current?.getDuration?.()) || 0,
      remainingPendingChecks: pendingOf(cur),
    });
    if (plan.action === 'open_check' && plan.check) {
      openGate(plan.check as VideoCheck);
      return;
    }
    if (typeof plan.seekToSec === 'number') {
      lastKnownTimeRef.current = plan.seekToSec;
      playerApiRef.current?.seekTo?.(plan.seekToSec, { allowAdvance: true });
    }
    playerApiRef.current?.play?.();
    if (eligibleRef.current) void markWatched();
  };
  finishCheckRef.current = finishCheck;

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
      if (typeof res?.profileXp === 'number') setWalletXp(res.profileXp);
      if (res.correct) {
        const key = `${current.id}:${id}`;
        localPassedInRunRef.current.add(key);
        const nextPassed = new Set(passedRef.current);
        nextPassed.add(key);
        passedRef.current = nextPassed;
        setPassedKeys(nextPassed);
        setMissed(false);
        play('win');
        setCheer(true);
        if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
        finishTimerRef.current = setTimeout(() => finishCheckRef.current(id), 700);
      } else if (res.needsReview) {
        setMissed(false);
        setCheckHint(res.hint || 'Chưa đủ ý. Hãy viết rõ hơn.');
      } else {
        setMissed(true);
        setPicked(null);
        setAnswerText('');
        setCheckHint(res.hint || 'Chưa đúng. Thử lại nhé!');
        const fallbackPenalty = effectiveReview ? 0 : VIDEO_CHECK_ANSWER_XP;
        const penaltyXp = Number((res as { cost?: number }).cost ?? fallbackPenalty);
        DeviceEventEmitter.emit(DAILY_PRACTICE_STATS_EVENT, {
          ...(typeof res?.profileXp === 'number' ? { xpTotal: res.profileXp } : {}),
          ...(penaltyXp > 0 ? { spendXp: penaltyXp } : {}),
        });
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
    if (!gate || !current || checkBusy || paidHint) return;
    setCheckBusy(true);
    setCheckError('');
    setXpShortage(false);
    try {
      const id = checkId(gate);
      const checks = (current.source === 'lesson' ? [] : ((current as DpPathVideo).checks || [])) as VideoCheck[];
      const checkIndex = Math.max(0, checks.findIndex((c) => checkId(c) === id));
      const cost = effectiveReview ? 0 : (Number(gate.hintCostXp) || 0);
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
      const spendXp = Number((res as { charged?: number; cost?: number; costXp?: number })?.charged ?? res?.cost ?? res?.costXp ?? 0);
      DeviceEventEmitter.emit(DAILY_PRACTICE_STATS_EVENT, {
        ...(typeof res?.profileXp === 'number' ? { xpTotal: res.profileXp } : {}),
        ...(typeof res?.purchasedXp === 'number' ? { purchasedXp: res.purchasedXp } : {}),
        ...(typeof res?.dailyXp === 'number' ? { dailyXp: res.dailyXp } : {}),
        ...(spendXp > 0 ? { spendXp } : {}),
      });
      setPaidHint(res.hint || '');
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 402) setXpShortage(true);
      setCheckError(err instanceof Error ? err.message : 'Chưa đổi được gợi ý');
    } finally {
      setCheckBusy(false);
    }
  };

  const skipCheck = async () => {
    if (!gate || !current || checkBusy || cheer) return;
    setCheckBusy(true);
    setCheckError('');
    setXpShortage(false);
    try {
      const id = checkId(gate);
      const checks = (current.source === 'lesson' ? [] : ((current as DpPathVideo).checks || [])) as VideoCheck[];
      const checkIndex = Math.max(0, checks.findIndex((c) => checkId(c) === id));
      const res = await dailyPracticeApi.skipVideoCheck(unit.id, current.id, checkIndex, id);
      if (typeof res?.profileXp === 'number') setWalletXp(res.profileXp);
      const spendXp = Number(res?.charged ?? res?.cost ?? 0);
      DeviceEventEmitter.emit(DAILY_PRACTICE_STATS_EVENT, {
        ...(typeof res?.profileXp === 'number' ? { xpTotal: res.profileXp } : {}),
        ...(typeof res?.purchasedXp === 'number' ? { purchasedXp: res.purchasedXp } : {}),
        ...(typeof res?.dailyXp === 'number' ? { dailyXp: res.dailyXp } : {}),
        ...(spendXp > 0 ? { spendXp } : {}),
      });
      play('tap');
      finishCheckRef.current(id);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 402) setXpShortage(true);
      setCheckError(err instanceof Error ? err.message : 'Chưa bỏ qua được câu hỏi');
    } finally {
      setCheckBusy(false);
    }
  };

  const select = (video: PlaylistItem) => {
    if (video.locked) return;
    play('tap');
    if (replayRequiredIdsRef.current.has(video.id)) {
      for (const k of [...localPassedInRunRef.current]) {
        if (k.startsWith(`${video.id}:`)) localPassedInRunRef.current.delete(k);
      }
      const next = new Set([...passedRef.current].filter((k) => !k.startsWith(`${video.id}:`)));
      passedRef.current = next;
      setPassedKeys(next);
      syncedSectionRef.current.delete(video.id);
    }
    setCurrentId(video.id);
  };

  const currentIdx = current ? playlist.findIndex((v) => v.id === current.id) : -1;
  const nextVideo = currentIdx >= 0
    ? playlist.slice(currentIdx + 1).find((v) => !v.locked) || null
    : null;
  const handleContinueAfterVideo = () => {
    if (!isSingleMode && nextVideo) {
      setCurrentId(nextVideo.id);
      return;
    }
    if (!inline) onClose();
  };

  const watchStatusControl = current && (current.source === 'unit' || current.source === 'step') ? (
    currentWatched ? (
      inline ? (
        <View style={styles.watchedPill}>
          <CheckCircle2 size={14} color="#047857" />
          <Text style={styles.watchedText}>Đã xem xong</Text>
        </View>
      ) : (
        <Pressable
          onPress={handleContinueAfterVideo}
          style={styles.markWatchedBtn}
          accessibilityRole="button"
        >
          <CheckCircle2 size={14} color="#FFFFFF" />
          <Text style={styles.markWatchedText}>
            {!isSingleMode && nextVideo ? 'Tiếp tục bài kế tiếp' : 'Tiếp tục'}
          </Text>
          <ChevronRight size={14} color="#FFFFFF" />
        </Pressable>
      )
    ) : (
      <View style={styles.watchLockedPill}>
        <Lock size={12} color="#92400E" />
        <Text style={styles.watchLockedText}>
          {markingWatched ? 'Đang lưu…' : (isCompact ? 'Xem ≥70% để mở khóa' : 'Xem đủ 70% để mở khóa')}
        </Text>
      </View>
    )
  ) : null;

  const currentChecksCount = current && current.source !== 'lesson' && Array.isArray((current as DpPathVideo).checks)
    ? (current as DpPathVideo).checks!.length
    : 0;

  const gateMissedText = gate && missed ? (() => {
    const penaltyNote = (!frameless && !effectiveReview) ? ` (−${VIDEO_CHECK_ANSWER_XP} XP)` : '';
    if (gate.kind === 'screen') return `AI chưa chấp nhận${penaltyNote}. Hãy gửi ảnh mới.`;
    if (gate.kind === 'text') return `Chưa đúng ý${penaltyNote}. Hãy nhập lại.`;
    return `Chưa đúng${penaltyNote}. Hãy chọn lại.`;
  })() : '';

  const gateFootNote = gate && !frameless
    ? (effectiveReview
      ? 'Đang ôn lại (không cộng/trừ XP) · Trả lời đúng để xem tiếp'
      : `Đúng lần đầu +${VIDEO_CHECK_ANSWER_XP} XP · Sai −${VIDEO_CHECK_ANSWER_XP} XP rồi ${gate.kind === 'screen' ? 'gửi lại' : gate.kind === 'text' ? 'nhập lại' : 'chọn lại'}`)
    : '';

  const checkpointQuizNode = (gate || cheer) ? (
    <VideoCheckpointQuizCard
      atSec={gate?.atSec || 0}
      prompt={gate?.prompt || ''}
      kind={gate?.kind}
      choices={gateChoices}
      picked={picked}
      onSelectChoice={setPicked}
      answerText={answerText}
      onChangeText={setAnswerText}
      onSubmitText={() => {
        if (!checkBusy && answerText.trim()) void submitCheck('');
      }}
      isReview={Boolean(frameless ? effectiveReview : effectiveReview)}
      xpReward={VIDEO_CHECK_ANSWER_XP}
      walletXp={!frameless ? walletXp : null}
      hintCostXp={!frameless ? Number(gate?.hintCostXp || 0) : (Number(gate?.hintCostXp) > 0 ? Number(gate?.hintCostXp) : 0)}
      missed={missed}
      missedText={gateMissedText}
      checkHint={checkHint}
      paidHint={paidHint}
      checkError={checkError}
      checkBusy={checkBusy}
      grading={grading}
      cheer={cheer}
      cheerTitle={!frameless && !effectiveReview ? `Chính xác! +${VIDEO_CHECK_ANSWER_XP} XP` : 'Chính xác!'}
      cheerSubtitle="Đang tiếp tục video…"
      onSubmit={() => { void submitCheck(''); }}
      onBuyHint={Number(gate?.hintCostXp) > 0 ? () => { void buyHint(); } : undefined}
      skipCostXp={effectiveReview ? 0 : VIDEO_CHECK_SKIP_XP}
      onSkip={gate ? () => { void skipCheck(); } : undefined}
      onPickScreenshot={gate?.kind === 'screen' ? () => { void pickScreenshot(); } : undefined}
      onDismiss={!frameless ? dismissGate : undefined}
      onBuyXp={onBuyXp}
      xpShortage={xpShortage}
      footNote={gateFootNote}
      compactOverlay={fullscreen}
    />
  ) : null;

  const innerContent = (
    <>
      <View style={[styles.frame, !inline && { maxHeight: isLandscape ? Math.round(height * 0.56) : Math.round(height * 0.62) }]}>
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
            chromeRightSlot={!frameless && !isCompact ? watchStatusControl : null}
            initialAtSec={!initialVideoId || current.id === initialVideoId ? initialAtSec : 0}
            pausedCheckpointSec={gate && !cheer ? (gate.atSec || 0) : null}
            onFullscreenChange={setFullscreen}
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

      {checkpointQuizNode && !fullscreen ? (
        <View style={[styles.checkpointSheetWrap, frameless && styles.checkpointSheetWrapFrameless]}>
          {checkpointQuizNode}
        </View>
      ) : null}

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
                style={[styles.item, active && styles.itemActive, video.locked && { opacity: 0.55 }]}
              >
                <View style={[styles.itemIndex, active ? styles.itemIndexActive : styles.itemIndexIdle]}>
                  {video.locked ? (
                    <Lock size={12} color="#64748B" />
                  ) : active ? (
                    <Play size={12} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Text style={styles.itemIndexText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={[styles.itemTitle, active && styles.itemTitleActive]}>{video.title}</Text>
                  <Text numberOfLines={1} style={styles.itemMeta}>
                    {video.source === 'lesson'
                      ? `Bài giảng · ${lesson?.title || ''}`
                      : (video as DpPathVideo).stepLabel
                        ? `${(video as DpPathVideo).stepLabel} · Video cấp`
                        : 'Video chặng'}
                  </Text>
                </View>
                {done ? <CheckCircle2 size={16} color="#059669" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!hideStudyTools && current ? (
        <View style={styles.accordionsWrap}>
          <View style={styles.studyToolsRow}>
            {([
              {
                key: 'notes',
                label: 'Ghi chú',
                open: notesOpen,
                Icon: StickyNote,
                onPress: () => {
                  setNotesOpen((prev) => !prev);
                  setAiOpen(false);
                },
              },
              {
                key: 'ai',
                label: 'Nội dung & AI',
                open: aiOpen,
                Icon: Bot,
                onPress: () => {
                  setAiOpen((prev) => !prev);
                  setNotesOpen(false);
                },
              },
            ] as const).map(({ key, label, open, Icon, onPress }) => (
              <Pressable
                key={key}
                onPress={onPress}
                style={[styles.studyToolPill, open && styles.studyToolPillActive]}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <View style={styles.accordionTitleRow}>
                  <Icon size={14} color="#34D399" />
                  <Text numberOfLines={1} style={styles.accordionTitle}>{label}</Text>
                </View>
                {open ? (
                  <ChevronUp size={15} color="#94A3B8" />
                ) : (
                  <ChevronDown size={15} color="#94A3B8" />
                )}
              </Pressable>
            ))}
          </View>

          {notesOpen ? (
            <View style={styles.accordionCard}>
              <VideoTimelineNotesPanel
                unitId={unit.id}
                unitTitle={unit.title}
                userId={userId}
                lessonId={current.id}
                lessonTitle={current.title || unit.title}
                getCurrentTime={getVideoCurrentTime}
                onSeekTo={playable ? seekVideoTo : undefined}
              />
            </View>
          ) : null}

          {aiOpen ? (
            <View style={styles.accordionCard}>
              <PathLessonAiAssistantPanel
                key={current.id}
                lessonTitle={current.title || lesson?.title || lessonTitle}
                unitTitle={unit.title}
                courseTitle={courseTitle || lesson?.title || unit.title || 'Tin học Văn phòng'}
                guide={current.source !== 'lesson' ? (current as DpPathVideo).guide : null}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  const gateOverlayNode = fullscreen && checkpointQuizNode ? (
    <View style={styles.gateOverlay}>
      <ScrollView
        style={styles.gateScroll}
        contentContainerStyle={styles.gateScrollInner}
        keyboardShouldPersistTaps="handled"
      >
        {checkpointQuizNode}
      </ScrollView>
    </View>
  ) : null;

  if (inline) {
    if (frameless) {
      return (
        <View style={styles.framelessCard}>
          {innerContent}
          {gateOverlayNode}
        </View>
      );
    }
    return (
      <View style={[styles.card, styles.embeddedCard]}>
        <View style={[styles.header, styles.headerCompact]}>
          <View style={styles.headerTitleWrap}>
            <Clapperboard size={15} color="#059669" />
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.embeddedEyebrow}>VIDEO HƯỚNG DẪN TƯƠNG TÁC</Text>
              <Text numberOfLines={1} style={[styles.headerVideoTitle, styles.headerVideoTitleCompact]}>
                {current?.title || 'Video hướng dẫn'}
              </Text>
            </View>
          </View>
          {currentChecksCount > 0 ? (
            <View style={styles.embeddedChecksPill}>
              <Text style={styles.embeddedChecksText}>{`${currentChecksCount} mốc trắc nghiệm`}</Text>
            </View>
          ) : null}
        </View>
        {innerContent}
        {(!playable || isCompact) && watchStatusControl ? (
          <View style={styles.footer}>{watchStatusControl}</View>
        ) : null}
        {gateOverlayNode}
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.backdrop}>
        <BlurView intensity={Platform.OS === 'android' ? 56 : 48} tint="light" pointerEvents="none" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.backdropTint} />
        <View style={[styles.card, { maxHeight: Math.round(height * 0.94) }]}>
          <View style={[styles.header, isCompact && styles.headerCompact]}>
            <View style={styles.headerTitleWrap}>
              <Clapperboard size={isCompact ? 14 : 16} color="#059669" />
              <Text numberOfLines={isCompact ? 1 : 2} style={[styles.headerVideoTitle, isCompact && styles.headerVideoTitleCompact]}>{current?.title || 'Video của chặng'}</Text>
            </View>
            <DuoButton variant="danger" size="sm" text="Đóng" onPress={onClose} accessibilityLabel="Đóng video" />
          </View>

          <ScrollView ref={scrollRef} style={styles.scroll} bounces={false} contentContainerStyle={styles.scrollContent}>
            {innerContent}
          </ScrollView>

          {(!playable || isCompact) && watchStatusControl ? (
            <View style={styles.footer}>
              {watchStatusControl}
            </View>
          ) : null}
          {gateOverlayNode}
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
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFBF2',
    borderWidth: 2,
    borderColor: '#6EE7B7',
    borderBottomWidth: 5,
    borderBottomColor: '#34D399',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 16,
  },
  embeddedCard: {
    maxHeight: undefined,
    borderRadius: 20,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  framelessCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFBF2',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 5,
    borderBottomColor: '#CBD5E1',
  },
  embeddedEyebrow: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  embeddedChecksPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  embeddedChecksText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '900',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
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
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  headerVideoTitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: { maxHeight: '100%', backgroundColor: '#FFFBF2' },
  scrollContent: { paddingBottom: spacing.md },
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: PATH_VIDEO_MODAL_LAYOUT.videoAreaBg,
    overflow: 'hidden',
    position: 'relative',
  },
  checkpointSheetWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  checkpointSheetWrapFrameless: {
    padding: spacing.sm,
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
  gateOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,6,23,0.76)',
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
  listBlock: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 8 },
  listTitle: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  itemActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderBottomColor: '#059669',
  },
  itemIndex: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemIndexActive: { backgroundColor: '#10B981' },
  itemIndexIdle: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  itemIndexText: { color: '#92400E', fontSize: 12, fontWeight: '900' },
  itemTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  itemTitleActive: { color: '#065F46', fontWeight: '900' },
  itemMeta: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  markWatchedBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
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
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  watchLockedText: { color: '#92400E', fontSize: 11, fontWeight: '800' },
  watchedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    backgroundColor: '#D1FAE5',
  },
  watchedText: { color: '#047857', fontSize: 12, fontWeight: '900' },
  accordionsWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  studyToolsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  studyToolPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    backgroundColor: 'rgba(15,23,42,0.88)',
  },
  studyToolPillActive: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(15,23,42,0.96)',
  },
  accordionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    backgroundColor: 'rgba(15,23,42,0.88)',
    overflow: 'hidden',
  },
  accordionTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  accordionTitle: {
    flexShrink: 1,
    color: '#34D399',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
