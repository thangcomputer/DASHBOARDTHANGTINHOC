import React, { useEffect, useId, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { formatLmsTimestamp } from '../../utils/lmsLessonUi';
import { ensureYouTubeApi, extractYouTubeId } from '../../utils/youtubeDuration';
/**
 * Compact seekable YouTube preview for Support/staff answering LMS Q&A.
 */
export default function LmsQaVideoPreview({
  videoUrl = '',
  startAtSec = 0,
  durationHint = 0,
  lessonTitle = '',
}) {
  const reactId = useId().replace(/:/g, '');
  const hostId = `lms-qa-yt-${reactId}`;
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const tickRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const askAt = Math.max(0, Math.floor(Number(startAtSec) || 0));
  const [current, setCurrent] = useState(askAt);
  const [duration, setDuration] = useState(Math.max(0, Math.floor(Number(durationHint) || 0)));
  const ytId = extractYouTubeId(videoUrl);

  useEffect(() => {
    if (!ytId || !containerRef.current) {
      if (!ytId) setError('Không tìm thấy video của bài học này');
      setReady(false);
      return undefined;
    }

    let cancelled = false;
    setError('');
    setReady(false);
    setCurrent(askAt);

    const startTick = () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        try {
          const t = Number(playerRef.current?.getCurrentTime?.());
          const d = Number(playerRef.current?.getDuration?.());
          if (Number.isFinite(t) && t >= 0) setCurrent(Math.floor(t));
          if (Number.isFinite(d) && d > 0) setDuration((prev) => Math.max(prev, Math.floor(d)));
        } catch { /* ignore */ }
      }, 400);
    };

    try {
      playerRef.current?.destroy?.();
    } catch { /* ignore */ }
    playerRef.current = null;
    containerRef.current.innerHTML = '';
    const host = document.createElement('div');
    host.id = hostId;
    host.style.cssText = 'width:100%;height:100%';
    containerRef.current.appendChild(host);

    ensureYouTubeApi().then((YT) => {
      if (cancelled || !YT?.Player || !document.getElementById(hostId)) return;
      playerRef.current = new YT.Player(hostId, {
        videoId: ytId,
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0,
          disablekb: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          start: askAt,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            try {
              const d = Number(event.target.getDuration?.());
              if (Number.isFinite(d) && d > 0) setDuration(Math.floor(d));
              if (askAt > 0) event.target.seekTo(askAt, true);
              setCurrent(askAt);
            } catch { /* ignore */ }
            setReady(true);
            startTick();
          },
          onError: () => {
            if (!cancelled) setError('Không phát được video YouTube');
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (tickRef.current) clearInterval(tickRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [ytId, hostId, askAt]);

  const seekTo = (sec) => {
    const t = Math.max(0, Math.floor(Number(sec) || 0));
    setCurrent(t);
    try {
      playerRef.current?.seekTo?.(t, true);
      playerRef.current?.playVideo?.();
    } catch { /* ignore */ }
  };

  const maxDur = Math.max(duration, askAt, current, 1);

  if (!ytId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {error || 'Bài học chưa có video để xem trước.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Video bài học</p>
          {lessonTitle ? (
            <p className="text-xs font-bold text-slate-800 truncate">{lessonTitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => seekTo(askAt)}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
          title="Nhảy tới giây học viên hỏi"
        >
          <Play size={12} /> Tại {formatLmsTimestamp(askAt)}
        </button>
      </div>

      <div className="relative aspect-video bg-black overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70 bg-black/40 pointer-events-none z-10">
            Đang tải video...
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-200 bg-black/60 px-4 text-center z-10">
            {error}
          </div>
        ) : null}
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        <input
          type="range"
          min={0}
          max={maxDur}
          step={1}
          value={Math.min(current, maxDur)}
          onChange={(e) => seekTo(e.target.value)}
          className="w-full accent-emerald-600"
          disabled={!ready}
        />
        <div className="flex items-center justify-between text-[11px] tabular-nums text-slate-600">
          <span>{formatLmsTimestamp(current)}</span>
          <span className="text-emerald-700 font-semibold">Hỏi tại {formatLmsTimestamp(askAt)}</span>
          <span>{formatLmsTimestamp(duration || maxDur)}</span>
        </div>
      </div>
    </div>
  );
}
