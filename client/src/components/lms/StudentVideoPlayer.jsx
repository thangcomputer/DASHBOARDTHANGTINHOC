import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import LmsBrandedPlayerChrome, { preferMaxYouTubeQuality } from './LmsBrandedPlayerChrome';
import {
  applyLmsVolumeToPlayer,
  readLmsMuted,
  readLmsVolume,
  writeLmsMuted,
  writeLmsVolume,
} from '../../utils/lmsPlayerPrefs';
import { getPlayerCompletionBadgeText, LMS_PLAYER_PROGRESS_BADGE_CLASS } from '../../utils/lmsLessonUi';
import { resolveEffectiveDuration } from '../../utils/antiSeekPolicy';
import {
  readYouTubeDuration,
  resolveYouTubeDisplayDuration,
  syncYouTubePlaybackState,
} from '../../utils/youtubeDuration';
// ─── Helper: Extract YouTube ID ──────────────────────────────────────────────
export const extractYouTubeId = (url = '') => {
  if (!url) return '';
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url.trim();
};

/** Clamp resume/seek vào [0, duration-1] — tránh start vượt độ dài thật làm YT không phát. */
export const clampYtTime = (t, duration) => {
  const n = Math.max(0, Math.floor(Number(t) || 0));
  const d = Math.max(0, Math.floor(Number(duration) || 0));
  if (d <= 1) return 0;
  return Math.min(n, d - 1);
};

export const StudentVideoPlayer = ({
  requiredRatio = 2 / 3,
  videoId,
  lessonId,
  courseId,
  initialWatchedSeconds = 0,
  adminDurationSeconds = 0,
  antiSeekEnabled = true,
  lessonCompleted = false,
  onSaveProgress,
  onVideoEnded,
  onEligibilityReached,
  onWatchProgress = null,
  playerApiRef = null,
}) => {
  const requiredSecs = (d) => {
    const n = Number(d) || 0;
    return n > 0 ? Math.ceil(n * requiredRatio) : 0;
  };
  const yId = extractYouTubeId(videoId);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [hasEnded, setHasEnded] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [displayWatched, setDisplayWatched] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isTabActive, setIsTabActive] = useState(true);
  const [maxSeekableUi, setMaxSeekableUi] = useState(0);
  const [volume, setVolume] = useState(() => readLmsVolume(50));
  const [muted, setMuted] = useState(() => readLmsMuted(false));
  const [playerError, setPlayerError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ytPlaybackQuality, setYtPlaybackQuality] = useState('default');

  // Restore watched seconds: lấy max(session, server) — không để session thấp ghi đè SoT
  const bestInitial = useMemo(() => {
    if (lessonCompleted) return 0; // If already completed, restart from 0 when revisiting
    const sessionWatched = Number(sessionStorage.getItem(`student_lms_watched_${lessonId}`) || 0);
    const serverWatched = Number(initialWatchedSeconds) || 0;
    return Math.max(sessionWatched, serverWatched);
  }, [lessonId, initialWatchedSeconds, lessonCompleted]);

  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const pauseTimeoutRef = useRef(null);
  const maxPosRef = useRef(0);
  const seekGuardRef = useRef(false);
  const eligibilitySentRef = useRef(false);
  const uiTickRef = useRef(null);
  const seekUnlockedRef = useRef(false);
  const lessonCompletedRef = useRef(lessonCompleted);
  const antiSeekEnabledRef = useRef(antiSeekEnabled);
  const watchPctSentRef = useRef(-1);
  const bestInitialRef = useRef(bestInitial);
  const handleStateChangeRef = useRef(null);
  const isReadyRef = useRef(false);
  const actualWatchedRef = useRef(bestInitial);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const uiTimeRef = useRef(0);
  volumeRef.current = volume;
  mutedRef.current = muted;

  lessonCompletedRef.current = lessonCompleted;
  antiSeekEnabledRef.current = antiSeekEnabled;
  bestInitialRef.current = bestInitial;

  const effectiveDuration = resolveEffectiveDuration(adminDurationSeconds, totalDuration);
  // Server completed / đủ threshold → tua tự do (không phụ thuộc session watch thấp)
  const seekUnlocked = !antiSeekEnabled
    || lessonCompleted
    || (effectiveDuration > 0 && displayWatched >= requiredSecs(effectiveDuration) && displayWatched > 0);
  seekUnlockedRef.current = seekUnlocked;

  // Chỉ reset overlay khi đổi bài — không bật lại nút Play khi parent cập nhật tiến độ
  useEffect(() => {
    const sessionWatched = Number(sessionStorage.getItem(`student_lms_watched_${lessonId}`) || 0);
    const serverWatched = Number(initialWatchedSeconds) || 0;
    const initial = Math.max(sessionWatched, serverWatched);
    actualWatchedRef.current = initial;
    setDisplayWatched(initial);
    setHasEnded(false);
    setOverlayVisible(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setPlayerError('');
    setIsReady(false);
    isReadyRef.current = false;
    eligibilitySentRef.current = !!lessonCompleted;
    watchPctSentRef.current = -1;
    const posKey = `student_lms_pos_${lessonId}`;
    const savedPos = Number(sessionStorage.getItem(posKey) || 0);
    // Completed / antiSeek off: cho tua full. Anti-seek đang học: chỉ maxPos đã xem.
    if (!antiSeekEnabled || lessonCompleted) {
      maxPosRef.current = Math.max(0, savedPos, initial, Number(totalDuration) || 0);
    } else {
      maxPosRef.current = Math.max(0, savedPos);
    }
    setMaxSeekableUi(maxPosRef.current);
    seekGuardRef.current = false;
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps -- lesson switch only

  // Khi vừa complete trên server hoặc duration YT load xong → mở seek full
  useEffect(() => {
    if (!lessonCompleted && antiSeekEnabled) return;
    const full = Number(totalDuration) || Number(effectiveDuration) || 0;
    if (full > maxPosRef.current) {
      maxPosRef.current = full;
      setMaxSeekableUi(full);
    }
  }, [lessonCompleted, antiSeekEnabled, totalDuration, effectiveDuration]);

  useEffect(() => {
    if (bestInitial > actualWatchedRef.current) {
      actualWatchedRef.current = bestInitial;
      setDisplayWatched(bestInitial);
    }
  }, [bestInitial]);

  // ── Complete khi đủ threshold 2/3 (COMPLETION ≠ SEEK) — chờ player ready ──
  useEffect(() => {
    if (!isReady || !effectiveDuration || !onEligibilityReached) return;
    if (eligibilitySentRef.current) return;
    const completion = {
      completionEligible: effectiveDuration > 0 && displayWatched >= requiredSecs(effectiveDuration),
    };
    if (completion.completionEligible && displayWatched > 0) {
      eligibilitySentRef.current = true;
      Promise.resolve(onEligibilityReached(displayWatched, totalDuration || effectiveDuration)).then(success => {
        if (success === false) {
          eligibilitySentRef.current = false; // Reset to allow retry
        }
      }).catch(() => {
        eligibilitySentRef.current = false;
      });
    }
  }, [isReady, displayWatched, effectiveDuration, totalDuration, onEligibilityReached]);

  // ── Giám sát tab ẩn (không dùng window.blur — iframe YouTube fire blur khi rê/click) ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabActive(false);
        if (playerRef.current?.pauseVideo) {
          try { playerRef.current.pauseVideo(); } catch (e) { void 0; }
        }
      } else {
        setIsTabActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ── Khởi tạo YouTube Iframe API — chỉ remount khi đổi bài/video (không vì completed) ──
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    setPlayerError('');
    setIsReady(false);
    isReadyRef.current = false;

    const resolveResumeAt = (durationSec) => {
      const completed = lessonCompletedRef.current;
      const antiOn = antiSeekEnabledRef.current;
      // Rewatch bài đã hoàn thành: luôn từ đầu (tránh start > duration làm YT chết)
      if (completed) return 0;
      const raw = antiOn ? (maxPosRef.current || 0) : (bestInitialRef.current || 0);
      return clampYtTime(raw, durationSec);
    };

    const initPlayer = () => {
      if (cancelled) return;
      const elId = `student-yt-player-${lessonId}`;
      const host = document.getElementById(elId);
      if (!host) return;

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }

      const ytId = extractYouTubeId(videoId);
      if (!ytId) {
        setPlayerError('Link video không hợp lệ');
        return;
      }

      const approxDur = Math.max(
        Number(adminDurationSeconds) || 0,
        Number(totalDuration) || 0,
      );
      const startAt = resolveResumeAt(approxDur);

      playerRef.current = new window.YT.Player(elId, {
        videoId: ytId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          start: startAt,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setIsReady(true);
            isReadyRef.current = true;
            setPlayerError('');
            const dur = readYouTubeDuration(event.target);
            if (dur > 0) {
              setTotalDuration((prev) => Math.max(prev, dur));
              // Sync sidebar % to real YouTube duration (fixes Admin 0s mismatch)
              onWatchProgress?.(lessonId, actualWatchedRef.current, dur);
            }
            preferMaxYouTubeQuality(event.target);
            applyLmsVolumeToPlayer(event.target, volumeRef.current, mutedRef.current);
            const resumeAt = resolveResumeAt(dur || approxDur);
            if (resumeAt > 0) {
              try {
                event.target.seekTo(resumeAt, true);
                setCurrentTime(resumeAt);
              } catch { /* ignore */ }
            }
          },
          onStateChange: (event) => {
            handleStateChangeRef.current?.(event);
          },
          onPlaybackQualityChange: (event) => {
            if (cancelled) return;
            if (event?.data) setYtPlaybackQuality(String(event.data));
          },
          onError: () => {
            setPlayerError('Không phát được video. Kiểm tra link YouTube hoặc quyền nhúng.');
            setIsReady(false);
            isReadyRef.current = false;
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { if (typeof prev === 'function') prev(); } catch { /* ignore */ }
        initPlayer();
      };
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
      clearInterval(autoSaveTimerRef.current);
      clearInterval(uiTickRef.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      isReadyRef.current = false;
    };
  // eslint-disable-line react-hooks/exhaustive-deps -- remount only on video/lesson change
  }, [videoId, lessonId]);

  // ── Đếm giây thực tế khi PLAYING + snap seek vượt maxPos ───────────────
  const startCounting = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      try {
        const player = playerRef.current;
        const { duration: syncDur, currentTime: syncTime, rawTime: t } = syncYouTubePlaybackState(
          player,
          Math.max(Number(adminDurationSeconds) || 0, totalDuration),
        );
        if (syncDur > 0) setTotalDuration((prev) => Math.max(prev, syncDur));
        setCurrentTime(syncTime);
        uiTimeRef.current = Number(syncTime) || 0;
        const unlocked = seekUnlockedRef.current;
        if (antiSeekEnabled && !unlocked && !seekGuardRef.current) {
          if (t > maxPosRef.current + 1.25) {
            seekGuardRef.current = true;
            playerRef.current?.seekTo?.(maxPosRef.current, true);
            setTimeout(() => { seekGuardRef.current = false; }, 450);
            return;
          }
          if (t >= maxPosRef.current - 0.35) {
            maxPosRef.current = Math.max(maxPosRef.current, t);
            setMaxSeekableUi(maxPosRef.current);
            sessionStorage.setItem(`student_lms_pos_${lessonId}`, String(maxPosRef.current));
          }
        } else if (t > maxPosRef.current) {
          maxPosRef.current = t;
          setMaxSeekableUi(t);
          if (antiSeekEnabled) {
            sessionStorage.setItem(`student_lms_pos_${lessonId}`, String(t));
          }
        }
      } catch { /* ignore */ }

      if (seekGuardRef.current) return;
      actualWatchedRef.current += 1;
      setDisplayWatched(actualWatchedRef.current);
      sessionStorage.setItem(`student_lms_watched_${lessonId}`, actualWatchedRef.current);
      try {
        const player = playerRef.current;
        const dur = resolveYouTubeDisplayDuration(
          Math.max(Number(adminDurationSeconds) || 0, totalDuration),
          player,
        );
        const req = requiredSecs(resolveEffectiveDuration(adminDurationSeconds, dur)) || 1;
        // % theo full video — tránh kẹt cập nhật sau cửa ≥67% (req)
        const base = dur > 0 ? dur : Math.max(1, Math.round(req * 1.5));
        const pct = Math.min(100, Math.round((actualWatchedRef.current / base) * 100));
        if (pct !== watchPctSentRef.current) {
          watchPctSentRef.current = pct;
          onWatchProgress?.(lessonId, actualWatchedRef.current, dur);
        }
      } catch { /* ignore */ }
    }, 1000);
  }, [lessonId, antiSeekEnabled, onWatchProgress, totalDuration, adminDurationSeconds]);

  const stopCounting = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  // ── Auto-save mỗi 30 giây ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !lessonId || !courseId) return;
    autoSaveTimerRef.current = setInterval(() => {
      if (actualWatchedRef.current > 0 && onSaveProgress) {
        onSaveProgress(lessonId, actualWatchedRef.current);
      }
    }, 30000);
    return () => clearInterval(autoSaveTimerRef.current);
  }, [isReady, lessonId, courseId, onSaveProgress]);

  useEffect(() => {
    if (!playerApiRef) return undefined;
    playerApiRef.current = {
      getCurrentTime: () => {
        try {
          const live = syncYouTubePlaybackState(playerRef.current, totalDuration).currentTime;
          return Math.max(Number(live) || 0, Number(uiTimeRef.current) || 0);
        } catch {
          return Number(uiTimeRef.current) || 0;
        }
      },
      getDuration: () => {
        try {
          return syncYouTubePlaybackState(playerRef.current, totalDuration).duration;
        } catch {
          return Number(totalDuration) || 0;
        }
      },
    };
    return () => {
      playerApiRef.current = null;
    };
  }, [playerApiRef, isReady, lessonId, totalDuration]);

  const handleStateChange = useCallback((event) => {
    const state = event.data;
    if (state === window.YT.PlayerState.PLAYING) {
      setOverlayVisible(false);
      setIsPaused(false);
      setIsPlaying(true);
      setHasEnded(false);
      setPlayerError('');
      // Không gọi preferMaxYouTubeQuality ở đây — pause/seek mỗi PLAYING gây giật
      startCounting();
      if (!totalDuration || totalDuration === 0) {
        const dur = readYouTubeDuration(event.target);
        if (dur > 0) setTotalDuration((prev) => Math.max(prev, dur));
      }
    }
    if (state === window.YT.PlayerState.PAUSED) {
      stopCounting();
      setIsPlaying(false);
      setIsPaused(true);
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1200);
    }
    if (state === window.YT.PlayerState.ENDED) {
      stopCounting();
      setIsPlaying(false);
      setHasEnded(true);
      setOverlayVisible(true);
      const { duration: finalDur, currentTime: finalTime } = syncYouTubePlaybackState(
        event.target,
        Math.max(Number(adminDurationSeconds) || 0, totalDuration),
      );
      if (finalDur > 0) setTotalDuration(finalDur);
      setCurrentTime(finalTime);
      // Đảm bảo sidebar nhận đủ 100% khi hết video
      if (finalDur > 0 && actualWatchedRef.current < finalDur) {
        actualWatchedRef.current = finalDur;
        setDisplayWatched(finalDur);
        sessionStorage.setItem(`student_lms_watched_${lessonId}`, String(finalDur));
        onWatchProgress?.(lessonId, finalDur, finalDur);
      }
      // Flush server ngay (kể cả khi bài đã completed ở cửa 67%)
      onSaveProgress?.(lessonId, actualWatchedRef.current);
      if (onVideoEnded) {
        onVideoEnded(actualWatchedRef.current, finalDur);
      }
    }
  }, [onVideoEnded, onWatchProgress, onSaveProgress, lessonId, startCounting, stopCounting, totalDuration, adminDurationSeconds]);
  handleStateChangeRef.current = handleStateChange;

  const handlePlayClick = useCallback(() => {
    if (!isReadyRef.current || !playerRef.current?.playVideo) {
      setPlayerError((prev) => prev || 'Đang tải video, thử lại sau 1–2 giây…');
      return;
    }
    try {
      playerRef.current.playVideo();
      setOverlayVisible(false);
      setPlayerError('');
    } catch {
      setPlayerError('Không phát được video. Thử tải lại trang.');
    }
  }, []);

  // Smoother progress UI while playing
  useEffect(() => {
    clearInterval(uiTickRef.current);
    if (!isPlaying) return undefined;
    uiTickRef.current = setInterval(() => {
      try {
        const player = playerRef.current;
        const { duration: syncDur, currentTime: syncTime, rawTime: t } = syncYouTubePlaybackState(
          player,
          Math.max(Number(adminDurationSeconds) || 0, totalDuration),
        );
        if (syncDur > 0) setTotalDuration((prev) => Math.max(prev, syncDur));
        setCurrentTime(syncTime);
        uiTimeRef.current = Number(syncTime) || 0;
        const unlocked = seekUnlockedRef.current;
        if (antiSeekEnabled && !unlocked && t > maxPosRef.current) {
          maxPosRef.current = t;
          setMaxSeekableUi(t);
          sessionStorage.setItem(`student_lms_pos_${lessonId}`, String(t));
        } else if ((!antiSeekEnabled || unlocked) && t > maxPosRef.current) {
          maxPosRef.current = t;
          setMaxSeekableUi(t);
        }
      } catch { /* ignore */ }
    }, 250);
    return () => clearInterval(uiTickRef.current);
  }, [isPlaying, antiSeekEnabled, lessonId, adminDurationSeconds, totalDuration]);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch { /* ignore */ }
  }, []);

  if (!yId) {
    return (
      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center rounded-2xl relative overflow-hidden group">
        <AlertCircle size={40} className="text-slate-600 mb-4" />
        <p className="text-slate-400 font-bold">Chưa có link video</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div
        ref={containerRef}
        className={`relative w-full h-full min-h-0 overflow-hidden bg-black shadow-lg group ${isFullscreen ? 'rounded-none' : 'lg:rounded-2xl'}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          id={`student-yt-player-${lessonId}`}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        <LmsBrandedPlayerChrome
          overlayVisible={overlayVisible}
          hasEnded={hasEnded}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={totalDuration}
          maxSeekable={maxSeekableUi}
          antiSeekEnabled={antiSeekEnabled}
          seekUnlocked={seekUnlocked}
          volume={volume}
          muted={muted}
          onPlay={handlePlayClick}
          onPause={() => playerRef.current?.pauseVideo?.()}
          onSeek={(t) => {
            try {
              const unlocked = seekUnlockedRef.current;
              const cap = (antiSeekEnabled && !unlocked)
                ? Math.max(maxPosRef.current, currentTime)
                : Number.POSITIVE_INFINITY;
              const capped = (antiSeekEnabled && !unlocked) ? Math.min(t, cap) : t;
              seekGuardRef.current = true;
              playerRef.current?.seekTo?.(capped, true);
              setCurrentTime(capped);
              setTimeout(() => { seekGuardRef.current = false; }, 500);
            } catch { /* ignore */ }
          }}
          onVolumeChange={(v) => {
            setVolume(v);
            setMuted(v === 0);
            writeLmsVolume(v);
            writeLmsMuted(v === 0);
            try {
              playerRef.current?.setVolume?.(v);
              if (v > 0) playerRef.current?.unMute?.();
              else playerRef.current?.mute?.();
            } catch { /* ignore */ }
          }}
          onToggleMute={() => {
            try {
              if (muted) {
                playerRef.current?.unMute?.();
                const nextVol = volume || 50;
                playerRef.current?.setVolume?.(nextVol);
                setMuted(false);
                writeLmsMuted(false);
                if (volume === 0) {
                  setVolume(50);
                  writeLmsVolume(50);
                }
              } else {
                playerRef.current?.mute?.();
                setMuted(true);
                writeLmsMuted(true);
              }
            } catch { /* ignore */ }
          }}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          getPlayer={() => playerRef.current}
          actualPlaybackQuality={ytPlaybackQuality}
        />

        {/* INACTIVE TAB OVERLAY */}
        {!isTabActive && !overlayVisible && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center bg-slate-950/95"
            onContextMenu={e => e.preventDefault()}
          >
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-4">
              <Lock size={28} />
            </div>
            <h3 className="text-red-400 font-black text-sm uppercase tracking-wider">Video Đã Tạm Dừng</h3>
            <p className="text-slate-400 text-xs mt-2 max-w-[240px] leading-relaxed">
              Bạn đã chuyển tab hoặc rời khỏi trang học. Vui lòng quay lại tab này để tiếp tục học.
            </p>
          </div>
        )}
        {playerError ? (
          <div className="absolute bottom-16 left-3 right-3 z-40 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-200 font-semibold text-center">
            {playerError}
          </div>
        ) : null}
        {!isReady && !playerError && overlayVisible ? (
          <div className="absolute top-3 right-3 z-40 text-[10px] font-bold uppercase tracking-wider text-white/90 bg-black/50 px-2 py-1 rounded-md border border-white/15">
            Đang tải…
          </div>
        ) : null}
        {!overlayVisible && !hasEnded && effectiveDuration > 0 ? (
          <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap gap-1.5 justify-between pointer-events-none">
            <span className={`text-[10px] px-2 py-1 rounded-md border backdrop-blur-md font-bold ${
              antiSeekEnabled
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
            }`}>
              {antiSeekEnabled ? 'Chống tua đang bật' : 'Tua tự do'}
            </span>
            <span className={`text-[10px] px-2 py-1 rounded-md border backdrop-blur-md font-bold ${
              lessonCompleted || seekUnlocked
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                : LMS_PLAYER_PROGRESS_BADGE_CLASS
            }`}>
              {getPlayerCompletionBadgeText({
                lessonCompleted,
                displayWatched,
                effectiveDuration,
                requiredWatchSecondsFn: requiredSecs,
              })}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StudentVideoPlayer;
