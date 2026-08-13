import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1 } from 'lucide-react';

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
 * Custom Thắng Tin Học player chrome (brand red).
 * Parent: YT controls:0 + iframe pointer-events:none.
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
  /** true khi đã đủ 2/3 giây xem → cho tua tự do toàn video */
  seekUnlocked = false,
  volume = 100,
  muted = false,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  brandLabel = 'THẮNG TIN HỌC',
}) {
  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState(0);
  const [showVol, setShowVol] = useState(false);
  const barRef = useRef(null);

  const rawDur = Math.max(0, Number(duration) || 0);
  const rawTime = Math.max(0, Number(dragging ? dragRatio * rawDur : currentTime) || 0);
  // Nếu YT báo current > duration: mở rộng hiển thị tổng để không lệch (vd 1:38:38 / 1:38:35)
  const safeDur = rawDur > 0 ? Math.max(rawDur, Math.ceil(rawTime)) : rawDur;
  const displayTime = safeDur > 0 ? Math.min(rawTime, safeDur) : rawTime;
  const lockSeek = antiSeekEnabled && !seekUnlocked;
  // Chưa đủ điều kiện: chỉ tua trong vùng đã xem. Đã đủ: tua full.
  const seekCap = lockSeek
    ? Math.max(Number(maxSeekable) || 0, Number(displayTime) || 0)
    : safeDur;
  const progressPct = safeDur > 0 ? Math.min(100, (displayTime / safeDur) * 100) : 0;
  const maxPct = safeDur > 0 ? Math.min(100, (seekCap / safeDur) * 100) : 0;

  const ratioFromEvent = useCallback((clientX) => {
    const el = barRef.current;
    if (!el || safeDur <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return rect.width > 0 ? x / rect.width : 0;
  }, [safeDur]);

  const clampRatio = useCallback((ratio) => {
    const r = Math.min(1, Math.max(0, ratio));
    if (!lockSeek || safeDur <= 0) return r;
    return Math.min(r, seekCap / safeDur);
  }, [lockSeek, safeDur, seekCap]);

  const commitSeek = useCallback((ratio) => {
    if (!onSeek || safeDur <= 0) return;
    const t = clampRatio(ratio) * safeDur;
    onSeek(t);
  }, [onSeek, safeDur, clampRatio]);

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => {
      e.preventDefault?.();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setDragRatio(clampRatio(ratioFromEvent(clientX)));
    };
    const onUp = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      if (clientX != null) commitSeek(ratioFromEvent(clientX));
      setDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, ratioFromEvent, commitSeek, clampRatio]);

  if (!visible) return null;

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <>
      {overlayVisible && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4"
          style={{ background: 'linear-gradient(135deg, rgba(10,14,24,0.88) 0%, rgba(15,25,50,0.78) 100%)' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
            <div className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md tracking-widest uppercase shadow-lg">
              {brandLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onPlay?.()}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
              boxShadow: '0 0 32px rgba(220,38,38,0.45), 0 8px 24px rgba(0,0,0,0.35)',
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

      {/* Chỉ vùng trên thanh điều khiển — không che scrubber/volume */}
      {!overlayVisible && (
        <button
          type="button"
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          className="absolute inset-x-0 top-0 z-[16] bg-transparent border-0 p-0 cursor-pointer"
          style={{ bottom: 72 }}
          onClick={() => (isPlaying ? onPause?.() : onPlay?.())}
        />
      )}

      {!overlayVisible && (
        <div
          className="absolute inset-x-0 bottom-0 z-[30] px-3 sm:px-4 pt-8 pb-3"
          style={{ background: 'linear-gradient(to top, rgba(8,15,28,0.95) 0%, rgba(8,15,28,0.65) 60%, transparent 100%)' }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Seek track — hit area cao để kéo dễ */}
          <div
            ref={barRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={Math.floor(safeDur)}
            aria-valuenow={Math.floor(displayTime)}
            aria-label="Tiến độ video"
            tabIndex={0}
            className="relative h-8 flex items-center cursor-pointer touch-none select-none mb-2"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const ratio = clampRatio(ratioFromEvent(e.clientX));
              setDragRatio(ratio);
              setDragging(true);
              commitSeek(ratio);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const ratio = clampRatio(ratioFromEvent(e.touches[0].clientX));
              setDragRatio(ratio);
              setDragging(true);
              commitSeek(ratio);
            }}
            onKeyDown={(e) => {
              if (!safeDur) return;
              if (e.key === 'ArrowRight') commitSeek((displayTime + 5) / safeDur);
              if (e.key === 'ArrowLeft') commitSeek((displayTime - 5) / safeDur);
            }}
          >
            <div className="absolute inset-x-0 h-2.5 rounded-full bg-white/20">
              {lockSeek && maxPct > 0 && maxPct < 100 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/25"
                  style={{ width: `${maxPct}%` }}
                />
              )}
              <div
                className="absolute inset-y-0 left-0 rounded-full border border-white/30"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #fecaca 0%, #ef4444 55%, #dc2626 100%)',
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-red-500 shadow-md"
                style={{ left: `calc(${progressPct}% - 8px)` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                isPlaying ? onPause?.() : onPlay?.();
              }}
              className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white transition hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #f87171 0%, #b91c1c 100%)',
                boxShadow: '0 4px 14px rgba(220,38,38,0.35)',
              }}
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying
                ? <Pause size={16} fill="white" className="text-white" />
                : <Play size={16} fill="white" className="text-white ml-0.5" />}
            </button>

            <span className="text-[11px] sm:text-xs font-bold tabular-nums text-white shrink-0 min-w-[2.5rem]">
              {formatClock(displayTime)}
            </span>
            <span className="text-[11px] sm:text-xs font-bold tabular-nums text-slate-400 shrink-0">
              / {formatClock(safeDur)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <div
              className="relative flex items-center gap-1.5"
              onMouseEnter={() => setShowVol(true)}
              onMouseLeave={() => setShowVol(false)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute?.();
                }}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
                aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
              >
                <VolIcon size={16} />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${showVol ? 'w-20 sm:w-24 opacity-100' : 'w-0 opacity-0 sm:w-20 sm:opacity-100'}`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onVolumeChange?.(v);
                  }}
                  className="w-full h-1.5 accent-red-400 cursor-pointer"
                  aria-label="Âm lượng"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Prefer highest available YouTube quality (best-effort; YT may ignore). */
export function preferMaxYouTubeQuality(player) {
  if (!player) return;
  try {
    const levels = typeof player.getAvailableQualityLevels === 'function'
      ? (player.getAvailableQualityLevels() || [])
      : [];
    const order = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small'];
    const best = order.find((q) => levels.includes(q)) || levels[0];
    if (best && typeof player.setPlaybackQuality === 'function') {
      player.setPlaybackQuality(best);
    }
    if (typeof player.setPlaybackQualityRange === 'function' && best) {
      try {
        player.setPlaybackQualityRange(best, best);
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
