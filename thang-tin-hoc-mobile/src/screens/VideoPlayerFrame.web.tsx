import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { MobileLmsPlayerChrome, type VideoCheckpointPin } from '../components/dailyPractice/MobileLmsPlayerChrome';
import { typography } from '../theme/tokens';
import { noteStudyMediaProgress } from '../services/studyActivity';
import { createVideoWatchGuard } from './videoWatchGuard';
import { isDirectVideoUrl, vimeoIdFromUrl, youtubeIdFromUrl } from '../utils/videoSource';
import { readLmsMuted, readLmsVolume, writeLmsMuted, writeLmsVolume } from '../utils/lmsPlayerPrefs';
import { orderYouTubeQualities } from '../utils/youtubeQuality';
import type { VideoPlayerApi, VideoPlayerProgress } from './VideoPlayerFrame';
import {
  buildYtBrandedPlayerVars,
  disableYouTubeCaptions,
  YT_IFRAME_CROP,
} from '../../../shared/dailyPractice/lmsBrandedVideoPlayer.mjs';
import { canMediaSeekTo } from '../../../shared/dailyPractice/videoCheckpointPlayback.mjs';

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe: () => HTMLIFrameElement;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  setVolume?: (volume: number) => void;
  mute?: () => void;
  unMute?: () => void;
  getPlaybackQuality?: () => string;
  setPlaybackQuality?: (suggestedQuality: string) => void;
  setPlaybackQualityRange?: (min: string, max: string) => void;
  getAvailableQualityLevels?: () => string[];
  unloadModule?: (moduleName: string) => void;
  setOption?: (moduleName: string, option: string, value: unknown) => void;
  destroy: () => void;
};

type YouTubeNamespace = {
  Player: new (
    target: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onError: (event: { data?: number }) => void;
        onStateChange?: () => void;
        onPlaybackQualityChange?: (event: { data?: string }) => void;
        onApiChange?: () => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube không khởi tạo được trình phát.'));
    };
    let script = document.getElementById('mobile-youtube-iframe-api') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'mobile-youtube-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => reject(new Error('Không tải được trình phát YouTube.'));
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
}

export function VideoPlayerFrame({
  videoUrl,
  embeddedUrl,
  title,
  lessonId,
  antiSeekEnabled,
  done,
  onProgress,
  onWatched,
  playerApiRef,
  brandedChrome = true,
  chromeRightSlot = null,
  appearance = 'default',
  chromeBg = '#080D19',
  initialAtSec = 0,
  pausedCheckpointSec = null,
  onFullscreenChange,
  checkpoints = [],
  onSelectCheckpoint = null,
  maxCheckpointSec = null,
  checkpointGateModal = null,
}: {
  videoUrl: string;
  embeddedUrl: string;
  title: string;
  lessonId: string;
  antiSeekEnabled: boolean;
  done: boolean;
  onProgress: (progress: VideoPlayerProgress) => void;
  onWatched: () => Promise<boolean>;
  playerApiRef?: { current: VideoPlayerApi | null };
  /** Thanh điều khiển Thắng Tin Học, ẩn chrome YouTube (controls:0). */
  brandedChrome?: boolean;
  chromeRightSlot?: React.ReactNode;
  appearance?: 'default' | 'window';
  chromeBg?: string;
  initialAtSec?: number;
  pausedCheckpointSec?: number | null;
  onFullscreenChange?: (fullscreen: boolean) => void;
  checkpoints?: VideoCheckpointPin[];
  onSelectCheckpoint?: ((cp: VideoCheckpointPin) => void) | null;
  maxCheckpointSec?: number | null;
  checkpointGateModal?: React.ReactNode | ((state: { isFullscreen: boolean }) => React.ReactNode);
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const progressRef = useRef<VideoPlayerProgress>({
    currentTime: 0,
    duration: 0,
    watchedSeconds: 0,
    completed: done,
    playing: false,
  });
  const callbackRef = useRef(onProgress);
  const watchedCallbackRef = useRef(onWatched);
  const doneRef = useRef(done);
  const antiSeekRef = useRef(antiSeekEnabled);
  const maxCpRef = useRef<number | null>(maxCheckpointSec);
  maxCpRef.current = maxCheckpointSec;
  const guardRef = useRef<ReturnType<typeof createVideoWatchGuard> | null>(null);
  const pendingSeekRef = useRef<{ target: number; expiresAt: number } | null>(null);
  const watchStorageKeyRef = useRef(`student_lms_pos_${lessonId}`);
  watchStorageKeyRef.current = `student_lms_pos_${lessonId}`;
  const [playerError, setPlayerError] = useState('');
  const [showAntiSeekNotice, setShowAntiSeekNotice] = useState(false);
  const [volume, setVolume] = useState(50);
  const [muted, setMuted] = useState(false);
  const [liveQuality, setLiveQuality] = useState<string | null>(null);
  const [qualityOptions, setQualityOptions] = useState<string[]>(['default']);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [awaitingStart, setAwaitingStart] = useState(appearance === 'window');
  const volumeRef = useRef(50);
  const mutedRef = useRef(false);
  const [uiProgress, setUiProgress] = useState<VideoPlayerProgress>({
    currentTime: 0,
    duration: 0,
    watchedSeconds: 0,
    completed: done,
    playing: false,
  });
  const antiSeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncPlayerVolume = useCallback((vol: number, isMuted: boolean) => {
    const n = Math.max(0, Math.min(100, Math.round(vol)));
    const effectiveMuted = isMuted || n === 0;
    if (videoRef.current) {
      videoRef.current.volume = n / 100;
      videoRef.current.muted = effectiveMuted;
    }
    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.setVolume?.(n);
        if (effectiveMuted) youtubePlayerRef.current.mute?.();
        else youtubePlayerRef.current.unMute?.();
      } catch { /* ignore */ }
    }
  }, []);

  const applyVolume = useCallback((nextVol: number, nextMuted: boolean) => {
    const n = Math.max(0, Math.min(100, Math.round(nextVol)));
    setVolume(n);
    setMuted(nextMuted);
    volumeRef.current = n;
    mutedRef.current = nextMuted;
    syncPlayerVolume(n, nextMuted);
    void writeLmsVolume(n);
    void writeLmsMuted(nextMuted);
  }, [syncPlayerVolume]);

  const toggleMute = useCallback(() => {
    if (mutedRef.current || volumeRef.current === 0) {
      const nextVol = volumeRef.current > 0 ? volumeRef.current : 50;
      applyVolume(nextVol, false);
    } else {
      applyVolume(volumeRef.current, true);
    }
  }, [applyVolume]);

  useEffect(() => {
    let alive = true;
    void Promise.all([readLmsVolume(50), readLmsMuted(false)]).then(([v, m]) => {
      if (!alive) return;
      setVolume(v);
      setMuted(m);
      volumeRef.current = v;
      mutedRef.current = m;
      syncPlayerVolume(v, m);
    });
    return () => { alive = false; };
  }, [syncPlayerVolume]);

  useEffect(() => {
    const onFsChange = () => {
      const next = Boolean(document.fullscreenElement);
      setIsFullscreen(next);
      onFullscreenChange?.(next);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [onFullscreenChange]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => { });
    } else if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => { });
    }
  }, []);

  const triggerAntiSeekNotice = () => {
    setShowAntiSeekNotice(true);
    if (antiSeekTimerRef.current) clearTimeout(antiSeekTimerRef.current);
    antiSeekTimerRef.current = setTimeout(() => setShowAntiSeekNotice(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (antiSeekTimerRef.current) clearTimeout(antiSeekTimerRef.current);
    };
  }, []);
  callbackRef.current = onProgress;
  watchedCallbackRef.current = onWatched;
  doneRef.current = done;
  antiSeekRef.current = antiSeekEnabled;

  useEffect(() => {
    const currentPlayerApi: VideoPlayerApi = {
      getCurrentTime: () => progressRef.current.currentTime,
      getDuration: () => progressRef.current.duration,
      pause: () => {
        if (videoRef.current) videoRef.current.pause();
        else if (youtubePlayerRef.current) youtubePlayerRef.current.pauseVideo?.();
      },
      play: () => {
        if (videoRef.current) void videoRef.current.play();
        else if (youtubePlayerRef.current) youtubePlayerRef.current.playVideo?.();
      },
      seekTo: (position: number, options?: { allowAdvance?: boolean }) => {
        const requested = Math.max(0, Number(position) || 0);
        const allowAdvance = Boolean(options?.allowAdvance);
        const guard = guardRef.current;
        const duration = Number(progressRef.current.duration) || 0;
        const cpCap = typeof maxCpRef.current === 'number' && maxCpRef.current > 0
          ? Math.max(0, maxCpRef.current)
          : Number.POSITIVE_INFINITY;
        let target = Math.min(requested, cpCap);
        if (duration > 0) target = Math.min(target, duration);
        if (antiSeekRef.current && !doneRef.current && !allowAdvance && guard) {
          const cap = Math.max(progressRef.current.currentTime, guard.getMaxPosition());
          target = Math.min(target, cap);
        }
        if (allowAdvance && guard) {
          const maxPos = guard.allowPosition(target);
          try {
            window.sessionStorage.setItem(watchStorageKeyRef.current, String(maxPos));
          } catch { /* ignore */ }
        }
        pendingSeekRef.current = allowAdvance
          ? { target, expiresAt: Date.now() + 2000 }
          : null;
        if (target >= cpCap - 0.15) {
          if (videoRef.current) videoRef.current.pause();
          else if (youtubePlayerRef.current) youtubePlayerRef.current.pauseVideo?.();
        }
        if (videoRef.current) {
          const cur = Number(videoRef.current.currentTime) || 0;
          const appliedTarget = (target <= cur || canMediaSeekTo(videoRef.current, target)) ? target : cur;
          if (appliedTarget !== cur) {
            videoRef.current.currentTime = appliedTarget;
          } else {
            pendingSeekRef.current = null;
          }
          progressRef.current = { ...progressRef.current, currentTime: appliedTarget };
          setUiProgress((prev) => ({ ...prev, currentTime: appliedTarget }));
          if (appliedTarget >= cpCap - 0.15) {
            callbackRef.current({ ...progressRef.current, currentTime: appliedTarget, playing: false });
          }
          return;
        }
        if (youtubePlayerRef.current) youtubePlayerRef.current.seekTo(target, true);
        else if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ method: 'setCurrentTime', value: target }), 'https://player.vimeo.com');
        }
        progressRef.current = { ...progressRef.current, currentTime: target };
        setUiProgress((prev) => ({ ...prev, currentTime: target }));
        if (target >= cpCap - 0.15) {
          callbackRef.current({ ...progressRef.current, currentTime: target, playing: false });
        }
      },
    };
    if (playerApiRef) playerApiRef.current = currentPlayerApi;
    return () => {
      if (playerApiRef?.current === currentPlayerApi) playerApiRef.current = null;
    };
  }, [playerApiRef]);

  useEffect(() => {
    const directVideo = isDirectVideoUrl(videoUrl);
    const youtubeId = youtubeIdFromUrl(videoUrl);
    const vimeoId = vimeoIdFromUrl(videoUrl);
    const watchStorageKey = `student_lms_pos_${lessonId}`;
    const watchedStorageKey = `student_lms_watched_${lessonId}`;
    const readStoredNumber = (key: string) => {
      try {
        const value = Number(window.sessionStorage.getItem(key) || 0);
        return Number.isFinite(value) && value > 0 ? value : 0;
      } catch (error) {
        console.error('Không thể đọc tiến độ video đã lưu.', error);
        return 0;
      }
    };
    const initialResumeAt = Math.max(0, Math.floor(Number(initialAtSec) || 0));
    const initialMaxPosition = Math.max(doneRef.current ? 0 : readStoredNumber(watchStorageKey), initialResumeAt);
    const initialWatchedSeconds = doneRef.current ? 0 : readStoredNumber(watchedStorageKey);
    const guard = createVideoWatchGuard(youtubeId ? 1.25 : 2, initialWatchedSeconds, initialMaxPosition);
    guardRef.current = guard;
    pendingSeekRef.current = null;
    let youtubePlayer: YouTubePlayer | null = null;
    let pollTimer: number | null = null;
    let completionPending = false;
    let completionRetryAt = 0;
    let thresholdReached = false;
    let vimeoPlaying = false;
    let lastProgressSentAt = 0;
    let lastWatchStateSavedAt = 0;

    setPlayerError('');
    progressRef.current = {
      currentTime: 0,
      duration: 0,
      watchedSeconds: 0,
      completed: doneRef.current,
      playing: false,
    };

    const report = (
      currentTime: number,
      duration: number,
      playing: boolean,
      seekTo: (position: number) => void,
    ) => {
      const pendingSeek = pendingSeekRef.current;
      if (pendingSeek) {
        if (Date.now() < pendingSeek.expiresAt && currentTime < pendingSeek.target - 0.35) {
          return;
        }
        pendingSeekRef.current = null;
      }
      const cpCap = typeof maxCpRef.current === 'number' && maxCpRef.current > 0
        ? Math.max(0, maxCpRef.current)
        : Number.POSITIVE_INFINITY;
      const tick = guard.tick(currentTime, duration, playing, antiSeekRef.current, doneRef.current || thresholdReached);
      if (tick.seekTo !== null) {
        seekTo(tick.seekTo);
        triggerAntiSeekNotice();
        return;
      }
      if (currentTime >= cpCap - 0.15) {
        const clampedT = Math.min(currentTime, cpCap);
        if (playing) {
          if (videoRef.current) videoRef.current.pause();
          else if (youtubePlayerRef.current) youtubePlayerRef.current.pauseVideo?.();
          else if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), 'https://player.vimeo.com');
          }
        }
        if (currentTime > cpCap + 0.35) seekTo(cpCap);
        const cpSnap: VideoPlayerProgress = {
          currentTime: clampedT,
          duration,
          watchedSeconds: tick.watchedSeconds,
          completed: doneRef.current,
          playing: false,
        };
        progressRef.current = cpSnap;
        callbackRef.current(cpSnap);
        setUiProgress(cpSnap);
        noteStudyMediaProgress(false);
        return;
      }
      const now = Date.now();
      if (!doneRef.current && now - lastWatchStateSavedAt >= 1000) {
        lastWatchStateSavedAt = now;
        try {
          window.sessionStorage.setItem(watchStorageKey, String(tick.maxPosition));
          window.sessionStorage.setItem(watchedStorageKey, String(tick.watchedSeconds));
        } catch (error) {
          console.error('Không thể lưu tiến độ xem video trong phiên này.', error);
        }
      }
      const snapshot: VideoPlayerProgress = {
        currentTime,
        duration,
        watchedSeconds: tick.watchedSeconds,
        completed: doneRef.current,
        playing,
      };
      progressRef.current = snapshot;
      noteStudyMediaProgress(playing);
      if (now - lastProgressSentAt >= 350) {
        lastProgressSentAt = now;
        callbackRef.current(snapshot);
        setUiProgress(snapshot);
      }
      if (tick.eligible && !doneRef.current && !completionPending && now >= completionRetryAt) {
        thresholdReached = true;
        completionPending = true;
        void watchedCallbackRef.current()
          .then((saved) => {
            if (saved) {
              doneRef.current = true;
              progressRef.current = { ...progressRef.current, completed: true };
              callbackRef.current(progressRef.current);
            } else {
              completionRetryAt = Date.now() + 5000;
            }
          })
          .catch((error: unknown) => {
            console.error('Không thể lưu tiến độ video đã xem.', error);
            completionRetryAt = Date.now() + 5000;
          })
          .finally(() => { completionPending = false; });
      }
    };

    const stopPolling = () => {
      if (pollTimer !== null) window.clearInterval(pollTimer);
      pollTimer = null;
    };
    const startPolling = (readState: () => { time: number; duration: number; playing: boolean }, seek: (position: number) => void) => {
      stopPolling();
      pollTimer = window.setInterval(() => {
        const state = readState();
        report(state.time, state.duration, state.playing, seek);
      }, 500);
    };

    if (directVideo) {
      const video = videoRef.current;
      if (!video) return undefined;
      syncPlayerVolume(volumeRef.current, mutedRef.current);
      const onMetadata = () => {
        syncPlayerVolume(volumeRef.current, mutedRef.current);
        const startTarget = initialResumeAt > 0 ? Math.max(initialResumeAt, doneRef.current ? 0 : initialMaxPosition) : (doneRef.current ? 0 : initialMaxPosition);
        if (startTarget > 0 && video.currentTime < startTarget) {
          video.currentTime = Math.min(startTarget, Math.max(0, video.duration - 1));
          return;
        }
        report(video.currentTime, video.duration, !video.paused, (position) => { video.currentTime = position; });
      };
      const onSeeked = () => report(video.currentTime, video.duration, !video.paused, (position) => { video.currentTime = position; });
      const onSeeking = () => {
        report(video.currentTime, video.duration, !video.paused, (position) => { video.currentTime = position; });
      };
      startPolling(
        () => ({ time: video.currentTime, duration: video.duration, playing: !video.paused && !video.ended }),
        (position) => { video.currentTime = position; },
      );
      video.addEventListener('loadedmetadata', onMetadata);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('seeking', onSeeking);
      if (video.readyState >= 1) onMetadata();
      return () => {
        stopPolling();
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('seeking', onSeeking);
      };
    }

    if (youtubeId && mountRef.current) {
      let disposed = false;
      const mountStyle = document.createElement('style');
      mountStyle.textContent = [
        '.mobile-youtube-player { overflow: hidden !important; background: #080D19 !important; }',
        '.mobile-youtube-player iframe {',
        brandedChrome
          ? `  position: absolute !important; top: 50% !important; left: 50% !important; width: ${YT_IFRAME_CROP.webSizePercent}% !important; height: ${YT_IFRAME_CROP.webSizePercent}% !important; transform: translate(-50%, ${YT_IFRAME_CROP.webTranslateYPercent}%) !important; border: 0 !important; pointer-events: none !important;`
          : '  width: 100% !important; height: 100% !important; border: 0 !important;',
        '}',
      ].filter(Boolean).join('\n');
      mountRef.current.classList.add('mobile-youtube-player');
      document.head.appendChild(mountStyle);
      void loadYouTubeApi().then((youtube) => {
        if (disposed || !mountRef.current) return;
        const playerFrame = document.createElement('iframe');
        playerFrame.referrerPolicy = 'origin';
        playerFrame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        playerFrame.allowFullscreen = true;
        playerFrame.title = title;
        playerFrame.src = `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&controls=${brandedChrome ? 0 : 1}&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&cc_lang_pref=&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
        mountRef.current.replaceChildren(playerFrame);
        const baseVars = buildYtBrandedPlayerVars({
          origin: window.location.origin,
          start: Math.floor(Math.max(initialMaxPosition, initialResumeAt)),
        });
        youtubePlayer = new youtube.Player(playerFrame, {
          videoId: youtubeId,
          playerVars: {
            ...baseVars,
            autoplay: appearance === 'window' ? 0 : 1,
            controls: brandedChrome ? 0 : 1,
            disablekb: brandedChrome ? 1 : 0,
            fs: brandedChrome ? 0 : 1,
          },
          events: {
            onReady: () => {
              if (!youtubePlayer) return;
              youtubePlayerRef.current = youtubePlayer;
              const iframe = youtubePlayer.getIframe();
              iframe.referrerPolicy = 'origin';
              iframe.style.border = '0';
              if (brandedChrome) {
                iframe.style.position = 'absolute';
                iframe.style.top = '50%';
                iframe.style.left = '50%';
                iframe.style.width = `${YT_IFRAME_CROP.webSizePercent}%`;
                iframe.style.height = `${YT_IFRAME_CROP.webSizePercent}%`;
                iframe.style.transform = `translate(-50%, ${YT_IFRAME_CROP.webTranslateYPercent}%)`;
                iframe.style.pointerEvents = 'none';
              } else {
                iframe.style.width = '100%';
                iframe.style.height = '100%';
              }
              disableYouTubeCaptions(youtubePlayer);
              syncPlayerVolume(volumeRef.current, mutedRef.current);
              const rawLevels = youtubePlayer.getAvailableQualityLevels?.() || [];
              const ordered = orderYouTubeQualities(rawLevels);
              setQualityOptions(ordered);
              const best = ordered.find((q) => q !== 'default') || 'highres';
              try { youtubePlayer.setPlaybackQualityRange?.(best, best); } catch { /* ignore */ }
              try { youtubePlayer.setPlaybackQuality?.(best); } catch { /* ignore */ }
              const curQ = youtubePlayer.getPlaybackQuality?.();
              if (curQ && curQ !== 'unknown' && curQ !== 'default') setLiveQuality(curQ);
              const ytSeekTarget = initialResumeAt > 0 ? Math.max(initialResumeAt, doneRef.current ? 0 : initialMaxPosition) : (doneRef.current ? 0 : initialMaxPosition);
              if (ytSeekTarget > 0) {
                youtubePlayer.seekTo(ytSeekTarget, true);
              }
              if (appearance !== 'window') {
                youtubePlayer.playVideo?.();
              }
              startPolling(
                () => ({
                  time: youtubePlayer?.getCurrentTime() || 0,
                  duration: youtubePlayer?.getDuration() || 0,
                  playing: youtubePlayer?.getPlayerState() === 1,
                }),
                (position) => youtubePlayer?.seekTo(position, true),
              );
            },
            onError: (event: { data?: number }) => setPlayerError(
              event.data === 153
                ? 'YouTube không nhận được địa chỉ tham chiếu để phát video. Hãy mở video trên YouTube.'
                : 'Không thể phát video YouTube này.',
            ),
            onApiChange: () => {
              if (youtubePlayer) disableYouTubeCaptions(youtubePlayer);
            },
            onPlaybackQualityChange: (event: { data?: string }) => {
              const q = event?.data;
              if (q && q !== 'unknown' && q !== 'default') setLiveQuality(q);
            },
            onStateChange: () => {
              if (!youtubePlayer) return;
              const state = youtubePlayer.getPlayerState();
              const playing = state === 1;
              if (playing) {
                setAwaitingStart(false);
                disableYouTubeCaptions(youtubePlayer);
                const rawLevels = youtubePlayer.getAvailableQualityLevels?.() || [];
                const ordered = orderYouTubeQualities(rawLevels);
                if (rawLevels.length) setQualityOptions(ordered);
                const best = ordered.find((q) => q !== 'default') || 'highres';
                try { youtubePlayer.setPlaybackQualityRange?.(best, best); } catch { /* ignore */ }
                try { youtubePlayer.setPlaybackQuality?.(best); } catch { /* ignore */ }
                const curQ = youtubePlayer.getPlaybackQuality?.();
                if (curQ && curQ !== 'unknown' && curQ !== 'default') setLiveQuality(curQ);
              }
              if (state === 0 && !doneRef.current && !completionPending) {
                thresholdReached = true;
                completionPending = true;
                void watchedCallbackRef.current()
                  .then((saved) => {
                    if (saved) {
                      doneRef.current = true;
                      progressRef.current = { ...progressRef.current, completed: true };
                      callbackRef.current(progressRef.current);
                    }
                  })
                  .finally(() => { completionPending = false; });
              }
              setUiProgress((prev) => ({ ...prev, playing }));
            },
          },
        });
      }).catch((error: unknown) => {
        if (!disposed) setPlayerError(error instanceof Error ? error.message : 'Không tải được video YouTube.');
      });
      return () => {
        disposed = true;
        stopPolling();
        youtubePlayerRef.current = null;
        youtubePlayer?.destroy();
        mountRef.current?.classList.remove('mobile-youtube-player');
        mountStyle.remove();
      };
    }

    if (vimeoId && iframeRef.current) {
      const frame = iframeRef.current;
      const subscribe = () => {
        ['playProgress', 'play', 'pause'].forEach((event) => {
          frame.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: event }), 'https://player.vimeo.com');
        });
      };
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== 'https://player.vimeo.com' || event.source !== frame.contentWindow) return;
        let payload = event.data;
        if (typeof payload === 'string') {
          try { payload = JSON.parse(payload) as unknown; } catch { return; }
        }
        if (!payload || typeof payload !== 'object') return;
        const data = payload as { event?: string; data?: { seconds?: number; duration?: number } };
        if (data.event === 'ready') {
          subscribe();
          if (!doneRef.current && initialMaxPosition > 0) {
            frame.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: initialMaxPosition }), 'https://player.vimeo.com');
          }
        }
        if (data.event === 'play') vimeoPlaying = true;
        if (data.event === 'pause') vimeoPlaying = false;
        if (data.event === 'playProgress' && data.data) {
          const time = Number(data.data.seconds) || 0;
          const duration = Number(data.data.duration) || 0;
          report(time, duration, vimeoPlaying, (position) => {
            frame.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: position }), 'https://player.vimeo.com');
          });
        }
      };
      window.addEventListener('message', onMessage);
      frame.addEventListener('load', subscribe);
      return () => {
        window.removeEventListener('message', onMessage);
        frame.removeEventListener('load', subscribe);
      };
    }

    setPlayerError('Không nhận diện được liên kết video.');
    return undefined;
  }, [brandedChrome, embeddedUrl, lessonId, videoUrl, playerApiRef]);

  const togglePlay = () => {
    setAwaitingStart(false);
    if (uiProgress.playing) {
      playerApiRef?.current?.pause?.();
      return;
    }
    const cpCap = typeof maxCpRef.current === 'number' && maxCpRef.current > 0
      ? Math.max(0, maxCpRef.current)
      : Number.POSITIVE_INFINITY;
    if (progressRef.current.currentTime >= cpCap - 0.15) {
      playerApiRef?.current?.pause?.();
      callbackRef.current({ ...progressRef.current, playing: false });
      return;
    }
    playerApiRef?.current?.play?.();
  };

  const seekTo = (position: number) => {
    const cpCap = typeof maxCpRef.current === 'number' && maxCpRef.current > 0
      ? Math.max(0, maxCpRef.current)
      : Number.POSITIVE_INFINITY;
    const clamped = Math.min(position, cpCap);
    playerApiRef?.current?.seekTo?.(clamped);
    setUiProgress((prev) => ({ ...prev, currentTime: clamped }));
  };

  const refreshQualities = useCallback(() => {
    const p = youtubePlayerRef.current;
    if (!p) return;
    const rawLevels = p.getAvailableQualityLevels?.() || [];
    if (rawLevels.length) setQualityOptions(orderYouTubeQualities(rawLevels));
    const curQ = p.getPlaybackQuality?.();
    if (curQ && curQ !== 'unknown' && curQ !== 'default') setLiveQuality(curQ);
  }, []);

  const selectQuality = useCallback((level: string) => {
    const p = youtubePlayerRef.current;
    if (!p) return;
    try {
      if (level === 'default') {
        p.setPlaybackQualityRange?.('tiny', 'highres');
      } else {
        p.setPlaybackQualityRange?.(level, level);
        p.setPlaybackQuality?.(level);
        setLiveQuality(level);
      }
    } catch { /* ignore */ }
  }, []);

  const directVideo = isDirectVideoUrl(videoUrl);
  const youtubeId = youtubeIdFromUrl(videoUrl);
  const vimeoId = vimeoIdFromUrl(videoUrl);
  const vimeoSrc = vimeoId
    ? `${embeddedUrl}${embeddedUrl.includes('?') ? '&' : '?'}api=1&player_id=mobile-course-video`
    : '';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: chromeBg,
        overflow: 'hidden',
      }}
    >
      {directVideo ? (
        React.createElement('video', {
          ref: videoRef,
          src: videoUrl,
          controls: !brandedChrome,
          autoPlay: appearance !== 'window',
          playsInline: true,
          controlsList: 'nodownload noplaybackrate',
          'aria-label': title,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: chromeBg },
        })
      ) : vimeoSrc ? (
        React.createElement('iframe', {
          ref: iframeRef,
          src: vimeoSrc,
          title,
          allow: 'autoplay; fullscreen; picture-in-picture',
          allowFullScreen: true,
          referrerPolicy: 'strict-origin-when-cross-origin',
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
        })
      ) : (
        <div ref={mountRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }} />
      )}
      {brandedChrome && !playerError ? (
        <MobileLmsPlayerChrome
          overlayVariant={appearance === 'window' ? 'window' : 'default'}
          startOverlayVisible={appearance === 'window' && awaitingStart && !uiProgress.playing}
          pausedCheckpointSec={pausedCheckpointSec}
          checkpoints={checkpoints}
          onSelectCheckpoint={onSelectCheckpoint}
          isPlaying={uiProgress.playing}
          currentTime={uiProgress.currentTime}
          duration={uiProgress.duration}
          onPlay={togglePlay}
          onPause={togglePlay}
          onSeek={antiSeekEnabled && !done ? undefined : seekTo}
          lockSeek={antiSeekEnabled && !done}
          onBlockedSeek={triggerAntiSeekNotice}
          showAntiSeekNotice={showAntiSeekNotice}
          volume={volume}
          muted={muted}
          onVolumeChange={(v) => applyVolume(v, v === 0)}
          onToggleMute={toggleMute}
          liveQuality={liveQuality}
          qualityOptions={qualityOptions}
          onSelectQuality={selectQuality}
          onOpenQualityMenu={refreshQualities}
          showQuality={false}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          rightSlot={chromeRightSlot}
        />
      ) : null}
      {typeof checkpointGateModal === 'function'
        ? checkpointGateModal({ isFullscreen })
        : checkpointGateModal}
      {playerError ? (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(8,13,25,0.82)' }}>
          <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700', textAlign: 'center' }}>{playerError}</Text>
        </View>
      ) : null}
    </div>
  );
}
