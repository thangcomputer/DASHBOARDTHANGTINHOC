import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clapperboard, Clock, FastForward, Lightbulb, Loader2, Lock, Play, Send, StickyNote, X, Zap,
} from 'lucide-react';
import StudentVideoPlayer from '../../lms/StudentVideoPlayer';
import { NotesPanel } from '../../lms/LmsPlayerTabs';
import LessonAiAssistantPanel from '../../lms/LessonAiAssistantPanel';
import { lmsStoreKey } from '../../../hooks/useLmsLocalStore';
import { resolveCurrentStudentId, saveLastStudySession } from '../../../utils/resumeLearning';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT, emitDailyPracticeStats } from '../../../services/dailyPracticeApi';
import BuyXpModal from './BuyXpModal';
import { extractYouTubeId } from '../../../utils/youtubeDuration';
import { setStudyMediaPlaying } from '../../../utils/learningGoal';
import { gameSounds } from '../../../utils/sound';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import { VIDEO_CHECK_ANSWER_XP, VIDEO_CHECK_SKIP_XP } from '../../../utils/dailyPractice';
import { AnswerCheer, CRY_MASCOT, readScreenshot, UploadProgress } from './VideoAnswerFx';
import {
  canMediaSeekTo,
  findTriggeredVideoCheck,
  resolveVideoCheckResumeTarget,
  sortVideoChecksAsc,
} from '../../../../../shared/dailyPractice/videoCheckpointPlayback.mjs';

const WATCH_REQUIRED_RATIO = 0.7;

function vimeoId(url) {
  const match = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match ? match[1] : '';
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg|m3u8)(\?|#|$)/i.test(String(url || '')) || /^\/uploads\//.test(String(url || ''));
}

/** Video không phải YouTube: file trực tiếp (theo dõi 2/3 thời lượng) hoặc Vimeo (đánh dấu sau khi mở đủ lâu). */
/** Màn chờ kiểu cửa sổ video: nền xám đậm, nút phát xanh lá tròn lớn ở giữa. */
function BigPlayOverlay({ onPlay }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(16,185,129,0.12) 0%, #23262E 55%, #1C1F26 100%)' }}>
      <button
        type="button"
        onClick={onPlay}
        aria-label="Phát video"
        className="flex h-20 w-20 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 sm:h-28 sm:w-28 !shadow-none"
        style={{ background: '#10B981', boxShadow: '0 0 32px rgba(16,185,129,0.45), 0 8px 24px rgba(0,0,0,0.35)' }}
      >
        <Play size={40} className="ml-1.5 text-white" fill="white" />
      </button>
    </div>
  );
}

function FallbackPlayer({ url, onWatched, onTick, mediaRef = null }) {
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const doneRef = useRef(false);
  const onWatchedRef = useRef(onWatched);
  const onTickRef = useRef(onTick);
  useEffect(() => { onWatchedRef.current = onWatched; }, [onWatched]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);
  const vimeo = vimeoId(url);
  useEffect(() => {
    const key = `dp-fallback:${url}`;
    setStudyMediaPlaying(key, Boolean(started && !ended && (vimeo || isDirectVideo(url))));
    return () => setStudyMediaPlaying(key, false);
  }, [started, ended, url, vimeo]);
  const markOnce = (meta) => {
    if (doneRef.current && !meta?.fromEnded) return;
    doneRef.current = true;
    onWatchedRef.current(meta);
  };
  useEffect(() => {
    if (!vimeo || !started) return undefined;
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onWatchedRef.current();
    }, 45000);
    return () => window.clearTimeout(timer);
  }, [vimeo, started]);
  if ((vimeo || isDirectVideo(url)) && !started) {
    return <BigPlayOverlay onPlay={() => setStarted(true)} />;
  }
  if (vimeo) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeo}?autoplay=1`}
        title="Video bài học"
        className="h-full w-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (isDirectVideo(url)) {
    return (
      <video
        ref={mediaRef}
        src={url}
        className="h-full w-full bg-black object-contain accent-emerald-500"
        controls
        autoPlay
        playsInline
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onPlay={(e) => {
          setEnded(false);
          if (mediaRef) mediaRef.current = e.currentTarget;
        }}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget;
          onTickRef.current?.(currentTime, e.currentTarget);
          if (duration > 0 && currentTime / duration >= WATCH_REQUIRED_RATIO) markOnce();
        }}
        onEnded={() => { setEnded(true); markOnce({ fromEnded: true }); }}
      />
    );
  }
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-white/80">
      Liên kết video chưa đúng định dạng. Trung tâm sẽ cập nhật sớm.
    </div>
  );
}

/** Popup video của chặng lộ trình - giao diện trình phát Thắng Tin Học. */
/**
 * Popup video của chặng - mở ngay trên trang lộ trình, đóng lại là về đúng chỗ đang xem.
 * Danh sách phát: video riêng của chặng + video buổi bài giảng đã gắn.
 */
export default function PathVideoModal({
  unit,
  initialVideoId = '',
  singleVideoOnly = false,
  embedded = false,
  hideStudyTools = false,
  frameless = false,
  review = false,
  onClose = () => { },
  onWatched,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState(initialVideoId);
  const [watchedIds, setWatchedIds] = useState(() => new Set());
  const [passedKeys, setPassedKeys] = useState(() => new Set());
  const [rememberedAnswers, setRememberedAnswers] = useState({});
  const [gate, setGate] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [picked, setPicked] = useState(null);
  const [checkHint, setCheckHint] = useState('');
  const [paidHint, setPaidHint] = useState('');
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [xpPacks, setXpPacks] = useState([]);
  const [walletXp, setWalletXp] = useState(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [missed, setMissed] = useState(false);
  const [cheer, setCheer] = useState(false);
  const [uploadPct, setUploadPct] = useState(null);
  const [grading, setGrading] = useState(false);
  const [markingWatched, setMarkingWatched] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const playerApiRef = useRef(null);
  const mediaElRef = useRef(null);
  const passedRef = useRef(passedKeys);
  const localPassedInRunRef = useRef(new Set());
  const gateRef = useRef(null);
  const currentRef = useRef(null);
  const eligibleRef = useRef(false);
  const endedRef = useRef(false);
  const syncedSectionRef = useRef(new Set());
  useEffect(() => { passedRef.current = passedKeys; }, [passedKeys]);

  const getVideoCurrentTime = () => {
    try {
      if (playerApiRef.current?.getCurrentTime) return Number(playerApiRef.current.getCurrentTime()) || 0;
      if (mediaElRef.current) return Number(mediaElRef.current.currentTime) || 0;
    } catch {
      /* ignore player time error */
    }
    return 0;
  };

  const getVideoDuration = () => {
    try {
      if (playerApiRef.current?.getDuration) return Number(playerApiRef.current.getDuration()) || 0;
      if (mediaElRef.current) return Number(mediaElRef.current.duration) || 0;
    } catch {
      /* ignore player duration error */
    }
    return 0;
  };

  const seekVideoTo = (sec, options = {}) => {
    const targetSec = Math.max(0, Number(sec) || 0);
    if (playerApiRef.current?.seekTo) {
      playerApiRef.current.seekTo(targetSec, options);
      return;
    }
    if (mediaElRef.current) {
      mediaElRef.current.currentTime = targetSec;
      mediaElRef.current.play?.()?.catch?.(() => { });
    }
  };

  const resumeMediaAt = (sec) => {
    const targetSec = Math.max(0, Number(sec) || 0);
    if (playerApiRef.current) {
      playerApiRef.current.seekTo?.(targetSec, { allowAdvance: true });
      playerApiRef.current.play?.();
      return;
    }
    if (mediaElRef.current) {
      const cur = Number(mediaElRef.current.currentTime) || 0;
      if (targetSec <= cur || canMediaSeekTo(mediaElRef.current, targetSec)) {
        mediaElRef.current.currentTime = targetSec;
      }
      mediaElRef.current.play?.()?.catch?.(() => { });
    }
  };

  useEffect(() => {
    let alive = true;
    dailyPracticeApi.student.overview()
      .then((res) => {
        if (alive && typeof res?.stats?.xpTotal === 'number') setWalletXp(res.stats.xpTotal);
      })
      .catch(() => { });
    const onStats = (event) => {
      if (typeof event?.detail?.xpTotal === 'number') setWalletXp(event.detail.xpTotal);
    };
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    return () => {
      alive = false;
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    };
  }, []);

  const syncXpStats = (res, spendXp = 0) => {
    const patch = {
      ...(typeof res?.profileXp === 'number' ? { xpTotal: res.profileXp } : {}),
      ...(typeof res?.studyXpTotal === 'number' ? { studyXpTotal: res.studyXpTotal } : {}),
      ...(typeof res?.purchasedXp === 'number' ? { purchasedXp: res.purchasedXp } : {}),
      ...(typeof res?.dailyXp === 'number' ? { dailyXp: res.dailyXp } : {}),
      ...(spendXp > 0 ? { spendXp } : {}),
    };
    if (typeof patch.xpTotal === 'number') setWalletXp(patch.xpTotal);
    if (Object.keys(patch).length > 0) emitDailyPracticeStats(patch);
  };

  useEffect(() => {
    let alive = true;
    const syncUnitVideos = () => {
      dailyPracticeApi.student.unitVideos(unit.id)
        .then((res) => {
          if (!alive) return;
          const videos = res.videos || [];
          const nextWatched = new Set(videos.filter((video) => video.state === 'completed').map((video) => video.id));
          const nextPassed = new Set(res.passedCheckIds || []);
          const nextRemembered = {};
          videos.forEach((video) => {
            const vidDone = video.state === 'completed';
            (video.checks || []).forEach((check) => {
              const cid = String(check.id || check._id || '');
              if (!cid) return;
              const fullKey = `${video.id}:${cid}`;
              if (vidDone || check.passed || nextPassed.has(fullKey) || nextPassed.has(cid)) {
                nextPassed.add(fullKey);
                if (check.reviewAnswer || check.reviewHint) {
                  nextRemembered[fullKey] = {
                    reviewAnswer: check.reviewAnswer || '',
                    reviewHint: check.reviewHint || '',
                  };
                }
              }
            });
          });
          localPassedInRunRef.current.forEach((key) => nextPassed.add(key));
          passedRef.current = nextPassed;
          setData(res);
          setWatchedIds(nextWatched);
          setPassedKeys(nextPassed);
          if (Object.keys(nextRemembered).length > 0) {
            setRememberedAnswers((prev) => ({ ...nextRemembered, ...prev }));
          }
        })
        .catch((err) => { if (alive) setError(err.message || 'Không tải được video của chặng'); });
    };
    syncUnitVideos();
    const onFocus = () => syncUnitVideos();
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncUnitVideos();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [unit.id]);

  useEffect(() => {
    if (embedded) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [embedded]);

  const isSingleMode = Boolean(singleVideoOnly || /:(level|practice):(easy|medium|hard)$/.test(String(initialVideoId || '')));
  const allPlaylist = useMemo(() => [
    ...(data?.videos || []).map((video) => ({ ...video, source: video.source || 'unit' })),
    ...(data?.lesson?.videos || []).map((video) => ({ ...video, source: 'lesson', state: 'active' })),
  ], [data]);
  const playlist = useMemo(() => {
    if (!isSingleMode || !initialVideoId) return allPlaylist;
    const matched = allPlaylist.find((v) => v.id === initialVideoId);
    return matched ? [matched] : allPlaylist;
  }, [allPlaylist, isSingleMode, initialVideoId]);
  const playable = playlist.filter((video) => video.state !== 'locked');
  const current = playable.find((video) => video.id === currentId) || playable[0] || null;
  const currentWatched = current
    ? ((current.source === 'unit' || current.source === 'step')
      ? (watchedIds.has(current.id) || current.state === 'completed')
      : false)
    : false;
  const effectiveReview = Boolean(review || currentWatched);
  const lesson = data?.lesson || null;
  currentRef.current = current;

  const pendingOf = (video) => (video?.checks || []).filter((check) => {
    const cid = String(check.id || check._id || '');
    const key = `${video.id}:${cid}`;
    return !check.passed && !passedRef.current.has(key) && !passedKeys.has(key);
  });

  const openGate = (check, media) => {
    if (!check || gateRef.current) return;
    if (media) {
      media.pause?.();
      if (media.currentTime > Number(check.atSec) + 1.2) media.currentTime = Number(check.atSec) || 0;
    } else {
      playerApiRef.current?.pause?.();
      const now = playerApiRef.current?.getCurrentTime?.() || 0;
      if (now > Number(check.atSec) + 1.2) playerApiRef.current?.seekTo?.(Number(check.atSec) || 0);
    }
    gateRef.current = check;
    setGate(check);
    setAnswerText('');
    setPicked(null);
    setCheckHint('');
    setPaidHint('');
    setCheckError('');
    setConfirmingSkip(false);
    setUploadPct(null);
    setGrading(false);
  };

  const onMediaTick = (time, media) => {
    if (media) mediaElRef.current = media;
    const video = currentRef.current;
    if (!video || video.source === 'lesson') return;
    if (gateRef.current) {
      const at = Number(gateRef.current.atSec) || 0;
      if (media) {
        media.pause?.();
        if (media.currentTime > at + 1.2) media.currentTime = at;
      } else {
        playerApiRef.current?.pause?.();
        if (time > at + 1.2) playerApiRef.current?.seekTo?.(at);
      }
      return;
    }
    const check = findTriggeredVideoCheck(pendingOf(video), time);
    if (check) openGate(check, media);
  };

  useEffect(() => {
    eligibleRef.current = false;
    endedRef.current = false;
    gateRef.current = null;
    mediaElRef.current = null;
    setGate(null);
  }, [current?.id]);

  useEffect(() => {
    if (!unit?.id || !current?.id) return undefined;
    const persistResume = () => {
      saveLastStudySession({
        kind: 'daily_practice',
        unitId: String(unit.id),
        unitTitle: unit.title || '',
        lessonId: String(current.id),
        lessonTitle: current.title || unit.title || 'Video chặng DewSkill',
        sectionLabel: `Chặng ${unit.index || 1} · Video bài học`,
        atSec: Math.floor(getVideoCurrentTime()),
        href: '/student/daily-practice?watch=stage',
      });
    };
    persistResume();
    const timer = window.setInterval(persistResume, 5000);
    return () => {
      persistResume();
      window.clearInterval(timer);
    };
  }, [unit?.id, unit?.index, unit?.title, current?.id, current?.title]);

  // Video đã hoàn thành trước đó (hoặc hết câu hỏi mốc): mở khóa qua bước tiếp theo ngay, không bắt trả lời lại.
  useEffect(() => {
    if (!current || !watchedIds.has(current.id)) return;
    if (current.source !== 'unit' && current.source !== 'step') return;
    if (!frameless) return;
    if (syncedSectionRef.current.has(current.id)) return;
    if (pendingOf(current).length > 0) return;
    syncedSectionRef.current.add(current.id);
    Promise.resolve(onWatched(current.id, { initialSync: true, completedJustNow: false })).catch(() => { });
  }, [current, watchedIds, passedKeys, frameless, onWatched]);

  useEffect(() => {
    if (!current || !extractYouTubeId(current.url) || current.source === 'lesson') return undefined;
    const timer = window.setInterval(() => {
      const time = playerApiRef.current?.getCurrentTime?.();
      if (typeof time === 'number') onMediaTick(time, null);
    }, 400);
    return () => window.clearInterval(timer);
  }, [current?.id, current?.url]);

  const markWatched = async (meta) => {
    const endedNow = Boolean(meta?.fromEnded);
    if (endedNow) endedRef.current = true;
    eligibleRef.current = true;
    const target = currentRef.current || current;
    if (!target || (target.source !== 'unit' && target.source !== 'step')) return true;
    const pendingList = sortVideoChecksAsc(pendingOf(target));
    if (pendingList.length) {
      if (endedNow || (!extractYouTubeId(target.url) && !isDirectVideo(target.url))) {
        openGate(pendingList[0], mediaElRef.current);
      }
      return false;
    }
    const videoId = target.id;
    const alreadyWatched = watchedIds.has(videoId);
    if (alreadyWatched) {
      if (!syncedSectionRef.current.has(videoId)) {
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
      gameSounds.correct();
    } catch (err) {
      syncedSectionRef.current.delete(videoId);
      setCheckError(err?.message || 'Chưa lưu được tiến độ xem video');
      return false;
    } finally {
      setMarkingWatched(false);
    }
    const nextVideo = playable.find((video) => (
      video.id !== videoId
      && video.state !== 'locked'
      && !watchedIds.has(video.id)
      && (video.source === 'unit' || video.source === 'step')
    ));
    if (nextVideo) setCurrentId(nextVideo.id);
    return true;
  };

  const finishCheck = (checkId) => {
    const cur = currentRef.current || current;
    if (!cur) return;
    const completedAtSec = Number(gateRef.current?.atSec) || 0;
    const key = `${cur.id}:${checkId}`;
    localPassedInRunRef.current.add(key);
    const next = new Set(passedRef.current);
    next.add(key);
    passedRef.current = next;
    setPassedKeys(next);
    gateRef.current = null;
    setGate(null);
    setCheer(false);
    setMissed(false);
    const plan = resolveVideoCheckResumeTarget({
      checkAtSec: completedAtSec,
      currentTime: getVideoCurrentTime(),
      duration: getVideoDuration(),
      remainingPendingChecks: pendingOf(cur),
    });
    if (plan.action === 'open_check' && plan.check) {
      openGate(plan.check, mediaElRef.current);
      return;
    }
    if (typeof plan.seekToSec === 'number') {
      resumeMediaAt(plan.seekToSec);
    } else {
      playerApiRef.current?.play?.();
      mediaElRef.current?.play?.()?.catch?.(() => { });
    }
    if (eligibleRef.current || endedRef.current) markWatched({ fromEnded: endedRef.current });
  };

  const submitCheck = async (imageDataUrl) => {
    if (!gate || !current || checkBusy || cheer) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const res = await dailyPracticeApi.student.answerVideoCheck(unit.id, current.id, gate.id, {
        choiceIndex: picked,
        text: answerText,
        imageDataUrl: imageDataUrl || '',
      });
      const fallbackPenalty = effectiveReview ? 0 : VIDEO_CHECK_ANSWER_XP;
      syncXpStats(res, !res.correct && !res.needsReview ? Number(res.cost ?? fallbackPenalty) : 0);
      if (res.correct) {
        const passedKey = `${current.id}:${gate.id}`;
        localPassedInRunRef.current.add(passedKey);
        if (res.reviewAnswer || res.reviewHint) {
          setRememberedAnswers((prev) => ({
            ...prev,
            [passedKey]: {
              reviewAnswer: res.reviewAnswer || '',
              reviewHint: res.reviewHint || '',
            },
          }));
        }
        setMissed(false);
        gameSounds.win();
        setCheer(true);
      } else if (res.needsReview) {
        setMissed(false);
        setCheckHint(res.hint || 'Chưa đủ ý để kết luận. Hãy viết rõ hơn, lần này không mất XP.');
      } else {
        setMissed(true);
        setPicked(null);
        setAnswerText('');
        setCheckHint(res.hint || 'Bài này chưa được.');
        gameSounds.wrong();
      }
    } catch (err) {
      setMissed(false);
      if (err.status === 402) openBuyXp(err);
      else setCheckError(err.message || 'Chưa gửi được câu trả lời');
    } finally {
      setCheckBusy(false);
    }
  };

  const sendScreenshot = async (file) => {
    if (!file || checkBusy || uploadPct != null) return;
    setMissed(false);
    setCheckError('');
    setUploadPct(4);
    setGrading(false);
    try {
      const dataUrl = await readScreenshot(file, setUploadPct);
      setGrading(true);
      await submitCheck(dataUrl);
    } catch (err) {
      setCheckError(err.message || 'Không tải được ảnh');
    } finally {
      setUploadPct(null);
      setGrading(false);
    }
  };

  const openBuyXp = (err = null) => {
    if (err?.suggestedAction === 'upgrade_plan' || err?.isFreeTier) {
      window.dispatchEvent(new CustomEvent('cms:open-upgrade-plan'));
      return;
    }
    setBuyXpOpen(true);
    dailyPracticeApi.student.overview()
      .then((data) => setXpPacks(data?.stats?.xpPacks || []))
      .catch(() => { });
  };

  const buyHint = async () => {
    if (!gate || !current || checkBusy || paidHint) return;
    setCheckBusy(true);
    setCheckError('');
    const cost = effectiveReview ? 0 : (Number(gate.hintCostXp) || 0);
    if (cost > 0) {
      try {
        const data = await dailyPracticeApi.student.overview();
        const xp = Number(data?.stats?.xpTotal) || 0;
        if (xp < cost) {
          if (data?.stats?.suggestedAction === 'upgrade_plan' || data?.stats?.isFreeTier) {
            window.dispatchEvent(new CustomEvent('cms:open-upgrade-plan'));
          } else {
            setXpPacks(data?.stats?.xpPacks || []);
            setBuyXpOpen(true);
          }
          setCheckBusy(false);
          return;
        }
      } catch { /* server vẫn chặn nếu không đủ */ }
    }
    try {
      const res = await dailyPracticeApi.student.buyVideoHint(unit.id, current.id, gate.id);
      syncXpStats(res, Number(res?.charged ?? res?.cost ?? 0));
      setPaidHint(res.hint || '');
    } catch (err) {
      if (err.status === 402) openBuyXp(err);
      else setCheckError(err.message || 'Chưa đổi được gợi ý');
    } finally {
      setCheckBusy(false);
    }
  };

  const skipCheck = async () => {
    if (!gate || !current || checkBusy || cheer) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const res = await dailyPracticeApi.student.skipVideoCheck(unit.id, current.id, gate.id);
      syncXpStats(res, Number(res?.charged ?? res?.cost ?? 0));
      if (res?.reviewAnswer || res?.reviewHint) {
        setRememberedAnswers((prev) => ({
          ...prev,
          [`${current.id}:${gate.id}`]: {
            reviewAnswer: res.reviewAnswer || '',
            reviewHint: res.reviewHint || '',
          },
        }));
      }
      gameSounds.tap();
      setConfirmingSkip(false);
      finishCheck(gate.id);
    } catch (err) {
      if (err.status === 402) openBuyXp(err);
      else setCheckError(err.message || 'Chưa bỏ qua được câu hỏi');
    } finally {
      setCheckBusy(false);
    }
  };

  const isCurrentYouTube = Boolean(current && extractYouTubeId(current.url));
  const currentIdx = current ? playable.findIndex((v) => v.id === current.id) : -1;
  const nextVideo = currentIdx >= 0 ? playable[currentIdx + 1] : null;
  const handleContinueAfterVideo = () => {
    if (nextVideo) {
      setCurrentId(nextVideo.id);
      return;
    }
    if (!embedded) onClose();
  };
  const watchStatusControl = (current?.source === 'unit' || current?.source === 'step') ? (
    currentWatched ? (
      embedded ? (
        <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-400/30 whitespace-nowrap">
          <CheckCircle2 size={13} /> Đã xem xong
        </span>
      ) : (
        <button
          type="button"
          onClick={handleContinueAfterVideo}
          className="ml-auto inline-flex h-8 sm:h-9 shrink-0 items-center gap-1 rounded-full bg-emerald-500 hover:bg-emerald-400 px-3 sm:px-3.5 text-[10px] sm:text-[11px] font-black text-white transition cursor-pointer whitespace-nowrap !shadow-none"
        >
          <CheckCircle2 size={13} /> Tiếp tục bài kế tiếp <ChevronRight size={13} />
        </button>
      )
    ) : (
      <span className="inline-flex h-8 sm:h-9 shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-bold text-white/80 border border-white/15 whitespace-nowrap">
        <Lock size={12} /> {markingWatched ? 'Đang lưu…' : 'Xem đủ 70% để mở khóa'}
      </span>
    )
  ) : null;
  const showFooterBar = Boolean(!embedded && !isCurrentYouTube && watchStatusControl);

  const playerBody = (
    <div className={embedded ? 'w-full' : 'min-h-0 flex-1 overflow-y-auto'}>
      <div
        className={`relative w-full overflow-hidden bg-[#23262E] ${gate && !cheer
          ? 'min-h-[460px] sm:min-h-[490px]'
          : `aspect-video ${embedded ? '' : 'max-h-[58dvh] sm:max-h-[68dvh]'}`
          }`}
      >
        {!data && !error && (
          <p className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-white/70"><Loader2 size={18} className="animate-spin" /> Đang tải video…</p>
        )}
        {error && <p className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-amber-300">{error}</p>}
        {data && !current && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm font-semibold text-white/75">
            <Lock size={22} />
            {lesson?.locked ? lesson.message : 'Chặng này chưa có video.'}
          </div>
        )}
        {current && (isCurrentYouTube ? (
          <StudentVideoPlayer
            key={`${unit.id}-${current.id}`}
            videoId={current.url}
            lessonId={`dp-${unit.id}-${current.id}`}
            courseId="daily-practice"
            antiSeekEnabled={!currentWatched && current.antiSeek !== false}
            lessonCompleted={currentWatched}
            requiredRatio={WATCH_REQUIRED_RATIO}
            onEligibilityReached={markWatched}
            onVideoEnded={() => markWatched({ fromEnded: true })}
            playerApiRef={playerApiRef}
            appearance="window"
            chromeRightSlot={frameless ? null : watchStatusControl}
          />
        ) : (
          <FallbackPlayer key={`${unit.id}-${current.id}`} url={current.url} onWatched={markWatched} onTick={onMediaTick} mediaRef={mediaElRef} />
        ))}
        {cheer && gate && <AnswerCheer onDone={() => finishCheck(gate.id)} />}
        {gate && !cheer && (
          <div className="absolute inset-0 z-40 flex items-start sm:items-center justify-center overflow-y-auto bg-slate-950/65 p-2.5 backdrop-blur-[2px] sm:p-4">
            <div className="my-auto w-full max-w-md overflow-hidden rounded-[22px] border border-slate-200/80 bg-white text-slate-900 shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
                    <Clock size={11} aria-hidden="true" />
                    Giây {gate.atSec}
                  </span>
                  {!frameless && (
                    <>
                      {effectiveReview ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-extrabold text-sky-700 ring-1 ring-sky-200/80">
                          Ôn lại · Miễn phí XP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-200/80">
                          <Zap size={10} className="fill-emerald-500 text-emerald-600" aria-hidden="true" />
                          +{VIDEO_CHECK_ANSWER_XP} XP
                        </span>
                      )}
                      {typeof walletXp === 'number' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-slate-700">
                          Ví: {walletXp} XP
                        </span>
                      )}
                    </>
                  )}
                  {frameless && effectiveReview && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-extrabold text-sky-700 ring-1 ring-sky-200/80">
                      Ôn lại
                    </span>
                  )}
                </div>
                {!embedded && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng video"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 !shadow-none"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="space-y-3.5 p-4 sm:p-5">
                {missed && (
                  <div className="flex items-center gap-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2">
                    <img src={CRY_MASCOT} alt="" className="h-12 w-12 shrink-0 object-contain" />
                    <p className="text-xs font-bold leading-snug text-rose-700">
                      {(() => {
                        const penaltyNote = (!frameless && !effectiveReview) ? ` (−${VIDEO_CHECK_ANSWER_XP} XP)` : '';
                        if (gate.kind === 'screen') return `AI chưa chấp nhận${penaltyNote}. Hãy gửi ảnh mới.`;
                        if (gate.kind === 'text') return `Chưa đúng ý${penaltyNote}. Hãy nhập lại.`;
                        return `Chưa đúng${penaltyNote}. Hãy chọn lại.`;
                      })()}
                    </p>
                  </div>
                )}

                <p className="text-[15px] font-black leading-snug text-slate-900 sm:text-base">
                  {gate.prompt}
                </p>

                {gate.kind === 'choice' && (
                  <div className="space-y-2">
                    {(gate.choices || []).map((choice, index) => {
                      const active = picked === index;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setPicked(index)}
                          className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold transition !shadow-none ${
                            active
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                              : 'border-slate-200 bg-slate-50/60 text-slate-800 hover:border-slate-300 hover:bg-slate-100/70'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                              active ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                            }`}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="min-w-0 flex-1">{choice}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {gate.kind === 'text' && (
                  <input
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    value={answerText}
                    placeholder="Nhập câu trả lời của bạn…"
                    onChange={(e) => setAnswerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !checkBusy && answerText.trim()) {
                        e.preventDefault();
                        submitCheck('');
                      }
                    }}
                  />
                )}

                {gate.kind === 'screen' && (uploadPct != null ? (
                  <UploadProgress percent={uploadPct} grading={grading} />
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50/40">
                    <span>{missed ? 'Chọn ảnh bài làm mới' : 'Tải ảnh chụp bài làm'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => { sendScreenshot(e.target.files?.[0]); e.target.value = ''; }}
                    />
                  </label>
                ))}

                {checkHint && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span>{checkHint}</span>
                  </div>
                )}
                {paidHint && (
                  <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
                    <span>{paidHint}</span>
                  </div>
                )}
                {checkError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                    {checkError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {gate.kind !== 'screen' && (
                    <button
                      type="button"
                      disabled={checkBusy || (gate.kind === 'choice' ? picked == null : !answerText.trim())}
                      onClick={() => submitCheck('')}
                      className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 !shadow-none"
                    >
                      {checkBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} aria-hidden="true" />}
                      <span>{checkBusy ? 'Đang chấm…' : 'Trả lời'}</span>
                    </button>
                  )}
                  {Number(gate.hintCostXp) > 0 && (
                    <button
                      type="button"
                      disabled={checkBusy || Boolean(paidHint)}
                      onClick={buyHint}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 !shadow-none"
                    >
                      <Lightbulb size={14} className="text-amber-600" aria-hidden="true" />
                      <span>
                        {paidHint
                          ? 'Đã gợi ý'
                          : checkBusy
                            ? 'Đang lấy…'
                            : frameless
                              ? 'Gợi ý'
                              : effectiveReview
                                ? 'Gợi ý · Miễn phí'
                                : `Gợi ý · ${gate.hintCostXp} XP`}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={checkBusy || uploadPct != null || confirmingSkip}
                    onClick={() => setConfirmingSkip(true)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 !shadow-none"
                  >
                    <FastForward size={14} className="text-rose-600" aria-hidden="true" />
                    <span>Khó quá bỏ qua</span>
                  </button>
                </div>

                {confirmingSkip && (
                  <div role="alert" className="space-y-2.5 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-800">
                      <AlertTriangle size={15} className="shrink-0 text-rose-600" aria-hidden="true" />
                      <span>{effectiveReview ? 'Xác nhận bỏ qua' : `Cảnh báo mất ${VIDEO_CHECK_SKIP_XP} XP`}</span>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed text-rose-700">
                      {effectiveReview
                        ? 'Đang ở chế độ ôn lại (không mất XP). Bạn muốn bỏ qua câu hỏi này để xem tiếp video?'
                        : `Bỏ qua câu hỏi mốc video này sẽ bị trừ ${VIDEO_CHECK_SKIP_XP} XP để tiếp tục xem. Bạn có chắc muốn bỏ qua?`}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={checkBusy}
                        onClick={() => setConfirmingSkip(false)}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 !shadow-none"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={checkBusy}
                        onClick={skipCheck}
                        className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white hover:bg-red-600 disabled:opacity-60 !shadow-none"
                      >
                        {effectiveReview ? 'Đồng ý bỏ qua' : `Bỏ qua (−${VIDEO_CHECK_SKIP_XP} XP)`}
                      </button>
                    </div>
                  </div>
                )}

                {!frameless && (
                  <p className="text-center text-[11px] font-medium text-slate-400">
                    {effectiveReview
                      ? 'Đang ôn lại (không cộng/trừ XP) · Trả lời đúng để xem tiếp'
                      : `Đúng lần đầu +${VIDEO_CHECK_ANSWER_XP} XP · Sai −${VIDEO_CHECK_ANSWER_XP} XP rồi ${gate.kind === 'screen' ? 'gửi lại' : gate.kind === 'text' ? 'nhập lại' : 'chọn lại'}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {(() => {
        if (!current || current.source === 'lesson') return null;
        const checksList = Array.isArray(current.checks) ? current.checks : [];
        const passedList = checksList.filter((c) => {
          const cid = String(c.id || c._id || '');
          const key = `${current.id}:${cid}`;
          return currentWatched || c.passed || passedKeys.has(key);
        });
        if (!passedList.length) return null;
        return (
          <div className="mx-3 mt-3 sm:mx-4 rounded-2xl border border-emerald-400/25 bg-[#16181E] p-3 sm:p-3.5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" aria-hidden="true" />
                <span>Câu hỏi đã qua · Đáp án đã ghi nhớ ({passedList.length}/{checksList.length})</span>
              </p>
              {pendingOf(current).length === 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/30">
                  Đã đạt điều kiện
                </span>
              )}
            </div>
            <div className="mt-2.5 space-y-2">
              {passedList.map((c, idx) => {
                const cid = String(c.id || c._id || idx);
                const fullKey = `${current.id}:${cid}`;
                const mem = rememberedAnswers[fullKey] || {};
                const remembered = mem.reviewAnswer || c.reviewAnswer || '';
                const hint = mem.reviewHint || c.reviewHint || '';
                return (
                  <div key={cid} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => seekVideoTo(Number(c.atSec) || 0, { allowAdvance: true })}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300 hover:bg-amber-400/25 cursor-pointer !shadow-none"
                        title="Tua tới mốc câu hỏi này"
                      >
                        <Clock size={10} aria-hidden="true" /> Giây {Math.max(0, Math.floor(Number(c.atSec) || 0))}
                      </button>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                        <CheckCircle2 size={10} aria-hidden="true" /> Đã qua
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-bold text-white/95">{c.prompt}</p>
                    <p className="mt-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/20">
                      <span className="font-black text-emerald-300">Đáp án: </span>
                      {remembered || 'Đã hoàn thành'}
                    </p>
                    {hint ? (
                      <p className="mt-1 text-[11px] font-medium text-white/60">Ghi chú: {hint}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {!isSingleMode && playlist.length > 0 && (
        <div className="space-y-1.5 px-4 pt-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-white/50">Danh sách video ({playlist.length})</p>
          {playlist.map((video, index) => {
            const active = current?.id === video.id;
            const locked = video.state === 'locked';
            const done = video.source === 'unit' && watchedIds.has(video.id);
            return (
              <button
                key={video.id}
                type="button"
                disabled={locked}
                onClick={() => {
                  gameSounds.tap();
                  setCurrentId(video.id);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition !shadow-none ${active ? 'bg-white/15 ring-1 ring-white/25' : 'hover:bg-white/10'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: active ? '#EF3B36' : 'rgba(255,255,255,0.12)' }}>
                  {locked ? <Lock size={12} /> : active ? <Play size={12} fill="white" className="text-white" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{video.title}</span>
                  <span className="block text-[11px] font-semibold text-white/50">
                    {video.source === 'lesson' ? `Bài giảng · ${lesson?.title || ''}` : video.stepLabel ? `${video.stepLabel} · Video cấp` : 'Video chặng'}
                  </span>
                </span>
                {done && <CheckCircle2 size={16} className="shrink-0 text-emerald-400" aria-label="Đã xem" />}
              </button>
            );
          })}
        </div>
      )
      }

      {
        !hideStudyTools && current && (
          <div className="mx-3 my-3 sm:mx-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  key: 'notes',
                  label: 'Ghi chú',
                  open: notesOpen,
                  Icon: StickyNote,
                  toneClass: 'text-emerald-400',
                  borderClass: notesOpen ? 'border-emerald-400/60' : 'border-white/10',
                  onClick: () => {
                    setNotesOpen((open) => !open);
                    setAiOpen(false);
                  },
                },
                {
                  key: 'ai',
                  label: 'Nội dung & AI',
                  open: aiOpen,
                  Icon: Bot,
                  toneClass: 'text-emerald-300',
                  borderClass: aiOpen ? 'border-emerald-400/60' : 'border-emerald-400/20',
                  onClick: () => {
                    setAiOpen((open) => !open);
                    setNotesOpen(false);
                  },
                },
              ].map(({ key, label, open, Icon, toneClass, borderClass, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  aria-expanded={open}
                  className={`flex w-full items-center justify-between gap-2 rounded-2xl border ${borderClass} bg-[#16181E] px-3 sm:px-4 py-2.5 text-left hover:bg-white/[0.04] transition cursor-pointer !shadow-none`}
                >
                  <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-black truncate ${toneClass}`}>
                    <Icon size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </span>
                  {open
                    ? <ChevronUp size={15} className="shrink-0 text-white/50" />
                    : <ChevronDown size={15} className="shrink-0 text-white/50" />}
                </button>
              ))}
            </div>

            {notesOpen && (
              <div className="rounded-2xl border border-white/10 bg-[#16181E] overflow-hidden p-3 sm:p-4">
                <NotesPanel
                  storageKey={lmsStoreKey('notes', resolveCurrentStudentId(), `dp_${unit.id}`)}
                  lessonId={current.id}
                  lessonTitle={current.title || unit.title}
                  courseTitle={unit.title || 'Luyện tập DewSkill'}
                  getCurrentTime={getVideoCurrentTime}
                  onSeekTo={seekVideoTo}
                />
              </div>
            )}

            {aiOpen && (
              <div className="rounded-2xl border border-emerald-400/20 bg-[#16181E] overflow-hidden p-3 sm:p-4">
                <LessonAiAssistantPanel
                  key={current.id}
                  lessonTitle={current.title}
                  unitTitle={unit.title}
                  courseTitle={lesson?.title || unit.title || 'Tin học Văn phòng'}
                  guide={current.guide || null}
                />
              </div>
            )}
          </div>
        )
      }
    </div >
  );

  if (embedded) {
    if (frameless) {
      return (
        <>
          <div className="w-full overflow-hidden rounded-2xl bg-[#23262E]">
            {playerBody}
          </div>
          {buyXpOpen && (
            <BuyXpModal packs={xpPacks} onClose={() => setBuyXpOpen(false)} onPaid={() => setBuyXpOpen(false)} />
          )}
        </>
      );
    }
    return (
      <>
        <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-[#1C1F26] shadow-md ring-1 ring-slate-900/15">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-[#16181E] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Clapperboard size={15} className="shrink-0 text-emerald-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Video hướng dẫn tương tác
                </p>
                <p className="truncate text-xs sm:text-sm font-black text-white" title={current?.title || ''}>
                  {current?.title || 'Video hướng dẫn'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {!isCurrentYouTube && watchStatusControl}
              {current?.checks?.length ? (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-amber-300 ring-1 ring-white/15 whitespace-nowrap">
                  {current.checks.length} mốc trắc nghiệm
                </span>
              ) : null}
            </div>
          </div>
          {playerBody}
        </div>
        {buyXpOpen && (
          <BuyXpModal packs={xpPacks} onClose={() => setBuyXpOpen(false)} onPaid={() => setBuyXpOpen(false)} />
        )}
      </>
    );
  }

  return createPortal(
    <div data-theme={getDewSkillThemeAttr()} className="dp-video-backdrop fixed inset-0 z-[9600] flex items-center justify-center p-2 sm:p-4 md:p-6" role="presentation">
      <div
        className="dp-pop flex max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-[22px] bg-[#1C1F26] shadow-[0_30px_80px_rgba(69,10,10,0.55)] ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-label={`Video chặng ${unit.index}`}
      >
        <div className="flex items-center gap-2 sm:gap-3 border-b border-white/5 bg-[#16181E] px-3 py-2.5 sm:px-4 sm:py-3">
          <h2 className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-left text-xs sm:text-base font-black text-white" title={current?.title || ''}>
            <Clapperboard size={15} className="shrink-0 text-emerald-400" aria-hidden="true" />
            <span className="line-clamp-1 sm:line-clamp-2 break-words">{current?.title || 'Video của chặng'}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="cms-btn cms-btn-primary cms-btn-brand shrink-0 !min-h-0 !h-auto !rounded-lg !py-1 !px-2.5 sm:!py-1.5 sm:!px-3 text-[11px] sm:text-xs font-black">
            Đóng
          </button>
        </div>

        {playerBody}

        {showFooterBar && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 bg-[#16181E] px-3 py-2.5 sm:px-4 sm:py-3">
            {watchStatusControl}
          </div>
        )}
      </div>
      {buyXpOpen && (
        <BuyXpModal packs={xpPacks} onClose={() => setBuyXpOpen(false)} onPaid={() => setBuyXpOpen(false)} />
      )}
    </div>,
    document.body,
  );
}
