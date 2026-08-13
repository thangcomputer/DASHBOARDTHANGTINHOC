import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

function formatClock(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Custom Thắng Tin Học player chrome (blue) — hides YouTube native controls UX.
 * Parent must set YT playerVars.controls = 0 and keep iframe pointer-events: none.
 */
export default function LmsBrandedPlayerChrome({
  visible = true,
  overlayVisible = false,
  hasEnded = false,
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  maxSeekable = 0,
  antiSeekEnabled = true,
  onPlay,
  onPause,
  onSeek,
  brandLabel = 'THẮNG TIN HỌC',
}) {
  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState(0);
  const barRef = useRef(null);

  const safeDur = duration > 0 ? duration : 0;
  const displayTime = dragging ? dragRatio * safeDur : currentTime;
  const progressPct = safeDur > 0 ? Math.min(100, (displayTime / safeDur) * 100) : 0;
  const maxPct = safeDur > 0
    ? Math.min(100, ((antiSeekEnabled ? maxSeekable : safeDur) / safeDur) * 100)
    : 0;

  const ratioFromEvent = useCallback((clientX) => {
    const el = barRef.current;
    if (!el || safeDur <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return rect.width > 0 ? x / rect.width : 0;
  }, [safeDur]);

  const commitSeek = useCallback((ratio) => {
    if (!onSeek || safeDur <= 0) return;
    let t = ratio * safeDur;
    if (antiSeekEnabled) {
      t = Math.min(t, Math.max(0, maxSeekable));
    }
    t = Math.max(0, Math.min(safeDur, t));
    onSeek(t);
  }, [onSeek, safeDur, antiSeekEnabled, maxSeekable]);

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const ratio = ratioFromEvent(clientX);
      const capped = antiSeekEnabled
        ? Math.min(ratio, maxPct / 100)
        : ratio;
      setDragRatio(capped);
    };
    const onUp = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const ratio = ratioFromEvent(clientX);
      const capped = antiSeekEnabled
        ? Math.min(ratio, maxPct / 100)
        : ratio;
      commitSeek(capped);
      setDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, ratioFromEvent, commitSeek, antiSeekEnabled, maxPct]);

  if (!visible) return null;

  return (
    <>
      {/* Start / replay overlay */}
      {overlayVisible && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4"
          style={{ background: 'linear-gradient(135deg, rgba(10,14,24,0.88) 0%, rgba(15,25,50,0.78) 100%)' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
            <div className="bg-sky-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md tracking-widest uppercase shadow-lg">
              {brandLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onPlay?.()}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              boxShadow: '0 0 32px rgba(14,165,233,0.45), 0 8px 24px rgba(0,0,0,0.35)',
            }}
            aria-label="Phát video"
          >
            <Play size={28} className="text-white ml-1 drop-shadow-lg" fill="white" />
          </button>
          <p className="mt-4 text-white/75 text-sm font-semibold tracking-wide text-center">
            {hasEnded ? 'Xem lại bài học' : 'Nhấn để bắt đầu học'}
          </p>
        </div>
      )}

      {/* Tap center to toggle play/pause (no YouTube hit-target) */}
      {!overlayVisible && (
        <button
          type="button"
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          className="absolute inset-0 z-[16] bg-transparent border-0 p-0 cursor-pointer"
          onClick={() => (isPlaying ? onPause?.() : onPlay?.())}
        />
      )}

      {/* Bottom control bar */}
      {!overlayVisible && (
        <div
          className="absolute inset-x-0 bottom-0 z-[18] px-3 sm:px-4 pt-10 pb-3 sm:pb-3.5 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(8,15,28,0.92) 0%, rgba(8,15,28,0.55) 55%, transparent 100%)' }}
        >
          <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                isPlaying ? onPause?.() : onPlay?.();
              }}
              className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white transition hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #38bdf8 0%, #0369a1 100%)',
                boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
              }}
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying
                ? <Pause size={16} fill="white" className="text-white" />
                : <Play size={16} fill="white" className="text-white ml-0.5" />}
            </button>

            <div className="flex-1 min-w-0">
              <div
                ref={barRef}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={Math.floor(safeDur)}
                aria-valuenow={Math.floor(displayTime)}
                aria-label="Tiến độ video"
                tabIndex={0}
                className="relative h-2.5 sm:h-3 rounded-full cursor-pointer touch-none select-none bg-white/15"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const ratio = ratioFromEvent(e.clientX);
                  const capped = antiSeekEnabled ? Math.min(ratio, maxPct / 100) : ratio;
                  setDragRatio(capped);
                  setDragging(true);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  const ratio = ratioFromEvent(e.touches[0].clientX);
                  const capped = antiSeekEnabled ? Math.min(ratio, maxPct / 100) : ratio;
                  setDragRatio(capped);
                  setDragging(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') commitSeek((currentTime + 5) / safeDur);
                  if (e.key === 'ArrowLeft') commitSeek((currentTime - 5) / safeDur);
                }}
              >
                {/* Watched / allowed region hint when anti-seek */}
                {antiSeekEnabled && maxPct > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-sky-400/25"
                    style={{ width: `${maxPct}%` }}
                  />
                )}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #7dd3fc 0%, #0ea5e9 55%, #0284c7 100%)',
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white border-2 border-sky-500 shadow"
                  style={{ left: `calc(${progressPct}% - 7px)` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] font-bold tabular-nums tracking-wide">
                <span className="text-sky-200">{formatClock(displayTime)}</span>
                <span className="text-slate-400">{formatClock(safeDur)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
