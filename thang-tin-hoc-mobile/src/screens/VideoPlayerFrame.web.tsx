import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { typography } from '../theme/tokens';
import { noteStudyMediaProgress } from '../services/studyActivity';
import { createVideoWatchGuard } from './videoWatchGuard';
import { isDirectVideoUrl, vimeoIdFromUrl, youtubeIdFromUrl } from '../utils/videoSource';
import type { VideoPlayerApi, VideoPlayerProgress } from './VideoPlayerFrame';

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe: () => HTMLIFrameElement;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo?: () => void;
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
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
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
  const [playerError, setPlayerError] = useState('');
  callbackRef.current = onProgress;
  watchedCallbackRef.current = onWatched;
  doneRef.current = done;
  antiSeekRef.current = antiSeekEnabled;

  useEffect(() => {
    const currentPlayerApi: VideoPlayerApi = {
      getCurrentTime: () => progressRef.current.currentTime,
      getDuration: () => progressRef.current.duration,
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
    const initialMaxPosition = doneRef.current ? 0 : readStoredNumber(watchStorageKey);
    const initialWatchedSeconds = doneRef.current ? 0 : readStoredNumber(watchedStorageKey);
    const guard = createVideoWatchGuard(youtubeId ? 1.25 : 2, initialWatchedSeconds, initialMaxPosition);
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
      const tick = guard.tick(currentTime, duration, playing, antiSeekRef.current, doneRef.current || thresholdReached);
      if (tick.seekTo !== null) {
        seekTo(tick.seekTo);
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
      if (now - lastProgressSentAt >= 500) {
        lastProgressSentAt = now;
        callbackRef.current(snapshot);
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
      const onMetadata = () => {
        if (!doneRef.current && initialMaxPosition > 0 && video.currentTime < initialMaxPosition) {
          video.currentTime = Math.min(initialMaxPosition, Math.max(0, video.duration - 1));
          return;
        }
        report(video.currentTime, video.duration, !video.paused, (position) => { video.currentTime = position; });
      };
      const onSeeked = () => report(video.currentTime, video.duration, !video.paused, (position) => { video.currentTime = position; });
      startPolling(
        () => ({ time: video.currentTime, duration: video.duration, playing: !video.paused && !video.ended }),
        (position) => { video.currentTime = position; },
      );
      video.addEventListener('loadedmetadata', onMetadata);
      video.addEventListener('seeked', onSeeked);
      if (video.readyState >= 1) onMetadata();
      return () => {
        stopPolling();
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('seeked', onSeeked);
      };
    }

    if (youtubeId && mountRef.current) {
      let disposed = false;
      const mountStyle = document.createElement('style');
      mountStyle.textContent = '.mobile-youtube-player iframe { width: 100% !important; height: 100% !important; border: 0 !important; }';
      mountRef.current.classList.add('mobile-youtube-player');
      document.head.appendChild(mountStyle);
      void loadYouTubeApi().then((youtube) => {
        if (disposed || !mountRef.current) return;
        const playerFrame = document.createElement('iframe');
        playerFrame.referrerPolicy = 'origin';
        playerFrame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        playerFrame.allowFullscreen = true;
        playerFrame.title = title;
        playerFrame.src = `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&controls=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
        mountRef.current.replaceChildren(playerFrame);
        youtubePlayer = new youtube.Player(playerFrame, {
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 0,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            start: Math.floor(initialMaxPosition),
          },
          events: {
            onReady: () => {
              if (!youtubePlayer) return;
              const iframe = youtubePlayer.getIframe();
              iframe.referrerPolicy = 'origin';
              iframe.style.width = '100%';
              iframe.style.height = '100%';
              iframe.style.border = '0';
              if (!doneRef.current && initialMaxPosition > 0) {
                youtubePlayer.seekTo(initialMaxPosition, true);
              }
              youtubePlayer.playVideo?.();
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
          },
        });
      }).catch((error: unknown) => {
        if (!disposed) setPlayerError(error instanceof Error ? error.message : 'Không tải được video YouTube.');
      });
      return () => {
        disposed = true;
        stopPolling();
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
  }, [embeddedUrl, lessonId, videoUrl, playerApiRef]);

  const directVideo = isDirectVideoUrl(videoUrl);
  const vimeoId = vimeoIdFromUrl(videoUrl);
  const vimeoSrc = vimeoId
    ? `${embeddedUrl}${embeddedUrl.includes('?') ? '&' : '?'}api=1&player_id=mobile-course-video`
    : '';

  return (
    <View style={{ flex: 1, position: 'relative', backgroundColor: '#080D19' }}>
      {directVideo ? (
        React.createElement('video', {
          ref: videoRef,
          src: videoUrl,
          controls: true,
          autoPlay: true,
          playsInline: true,
          controlsList: 'nodownload noplaybackrate',
          'aria-label': title,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: '#080D19' },
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
        <div ref={mountRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      )}
      {playerError ? (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(8,13,25,0.82)' }}>
          <Text style={{ color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700', textAlign: 'center' }}>{playerError}</Text>
        </View>
      ) : null}
    </View>
  );
}
