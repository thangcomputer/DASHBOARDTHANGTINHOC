import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import {
  Maximize2, Minimize2, Pause, Play, Volume1, Volume2, VolumeX,
} from 'lucide-react-native';

type TrackPressEvent = {
  nativeEvent?: {
    locationX?: number;
    offsetX?: number;
    pageX?: number;
    clientX?: number;
    touches?: Array<{ pageX?: number; clientX?: number }>;
  };
  clientX?: number;
};

function resolveTrackPosition(
  e: TrackPressEvent,
  trackRef: React.RefObject<React.ComponentRef<typeof Pressable> | null>,
  fallbackWidth: number,
): { x: number; width: number } | null {
  const node = trackRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
  const rect = Platform.OS === 'web' ? node?.getBoundingClientRect?.() : undefined;
  const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : fallbackWidth;
  if (!Number.isFinite(width) || width <= 0) return null;
  const ev = e?.nativeEvent;
  if (typeof ev?.locationX === 'number' && Number.isFinite(ev.locationX)) {
    return { x: ev.locationX, width };
  }
  if (typeof ev?.offsetX === 'number' && Number.isFinite(ev.offsetX)) {
    return { x: ev.offsetX, width };
  }
  const clientX = ev?.touches?.[0]?.clientX ?? ev?.clientX ?? ev?.touches?.[0]?.pageX ?? ev?.pageX ?? e?.clientX;
  if (typeof clientX === 'number' && Number.isFinite(clientX) && rect) {
    return { x: clientX - rect.left, width };
  }
  return null;
}

function formatClock(secs: number) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function MobileLmsPlayerChrome({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onSeek,
  lockSeek = false,
  onBlockedSeek,
  showAntiSeekNotice = false,
  volume = 50,
  muted = false,
  onVolumeChange,
  onToggleMute,
  isFullscreen = false,
  onToggleFullscreen,
  overlayVariant = 'default',
  startOverlayVisible = false,
  pausedCheckpointSec = null,
  rightSlot = null,
}: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek?: (seconds: number) => void;
  lockSeek?: boolean;
  onBlockedSeek?: () => void;
  showAntiSeekNotice?: boolean;
  volume?: number;
  muted?: boolean;
  onVolumeChange?: (value: number) => void;
  onToggleMute?: () => void;
  liveQuality?: string | null;
  qualityOptions?: string[];
  onSelectQuality?: (level: string) => void;
  onOpenQualityMenu?: () => void;
  showQuality?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Giống web LmsBrandedPlayerChrome overlayVariant="window". */
  overlayVariant?: 'default' | 'window';
  /** Màn chờ trước lần phát đầu (popup lộ trình — giống web overlayVisible). */
  startOverlayVisible?: boolean;
  /** Khi đang mở câu hỏi tương tác tại mốc giây X bên dưới video. */
  pausedCheckpointSec?: number | null;
  rightSlot?: React.ReactNode;
}) {
  const windowLook = overlayVariant === 'window';
  const { width: windowWidth } = useWindowDimensions();
  const showInlineVolSlider = windowWidth >= 520;
  const [barWidth, setBarWidth] = useState(0);
  const [volBarWidth, setVolBarWidth] = useState(0);
  const [volPopoverOpen, setVolPopoverOpen] = useState(false);
  const [seekingDrag, setSeekingDrag] = useState(false);
  const [volDragging, setVolDragging] = useState(false);
  const [chromeHovered, setChromeHovered] = useState(false);
  const [chromeTapped, setChromeTapped] = useState(false);
  const overlayRootRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const progressTrackRef = useRef<React.ComponentRef<typeof Pressable> | null>(null);
  const volTrackRef = useRef<React.ComponentRef<typeof Pressable> | null>(null);
  const volWrapRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockedDragNotifiedRef = useRef(false);

  const wakeChromeTemporarily = useCallback(() => {
    setChromeTapped(true);
    if (hideChromeTimerRef.current) clearTimeout(hideChromeTimerRef.current);
    hideChromeTimerRef.current = setTimeout(() => {
      setChromeTapped(false);
    }, 3200);
  }, []);

  useEffect(() => () => {
    if (hideChromeTimerRef.current) clearTimeout(hideChromeTimerRef.current);
  }, []);

  const safeDur = Math.max(0, Number(duration) || 0);
  const safeCurrent = Math.max(0, Number(currentTime) || 0);
  const displayTime = safeDur > 0 ? Math.min(safeCurrent, safeDur) : safeCurrent;
  const progressPct = safeDur > 0 ? Math.min(100, (displayTime / safeDur) * 100) : 0;
  const safeVol = Number.isFinite(Number(volume)) ? Math.max(0, Math.min(100, Number(volume))) : 50;
  const volPct = muted ? 0 : Math.round(safeVol);
  const VolIcon = muted || volPct === 0 ? VolumeX : volPct < 50 ? Volume1 : Volume2;

  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const onVolBarLayout = useCallback((e: LayoutChangeEvent) => {
    setVolBarWidth(e.nativeEvent.layout.width);
  }, []);

  const seekFromEvent = useCallback((e: TrackPressEvent) => {
    if (!onSeek || safeDur <= 0) return;
    const pos = resolveTrackPosition(e, progressTrackRef, barWidth);
    if (!pos) return;
    const ratio = Math.min(1, Math.max(0, pos.x / pos.width));
    if (Number.isFinite(ratio)) onSeek(ratio * safeDur);
  }, [barWidth, onSeek, safeDur]);

  const volumeFromEvent = useCallback((e: TrackPressEvent) => {
    if (!onVolumeChange) return;
    const pos = resolveTrackPosition(e, volTrackRef, volBarWidth);
    if (!pos) return;
    const ratio = Math.min(1, Math.max(0, pos.x / pos.width));
    const nextVol = Math.round(ratio * 100);
    if (Number.isFinite(nextVol)) onVolumeChange(nextVol);
  }, [onVolumeChange, volBarWidth]);

  useEffect(() => {
    if (!seekingDrag || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const readClientX = (ev: MouseEvent | TouchEvent) => (
      'touches' in ev ? (ev.touches[0]?.clientX ?? ev.changedTouches?.[0]?.clientX) : ev.clientX
    );
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (lockSeek) {
        if (!blockedDragNotifiedRef.current) {
          blockedDragNotifiedRef.current = true;
          onBlockedSeek?.();
        }
        return;
      }
      const clientX = readClientX(ev);
      if (typeof clientX !== 'number') return;
      const node = progressTrackRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
      const rect = node?.getBoundingClientRect?.();
      if (!rect || rect.width <= 0) return;
      if (safeDur <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek?.(ratio * safeDur);
    };
    const onUp = () => {
      blockedDragNotifiedRef.current = false;
      setSeekingDrag(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [seekingDrag, lockSeek, onBlockedSeek, onSeek, safeDur]);

  useEffect(() => {
    if (!volDragging || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const readClientX = (ev: MouseEvent | TouchEvent) => (
      'touches' in ev ? (ev.touches[0]?.clientX ?? ev.changedTouches?.[0]?.clientX) : ev.clientX
    );
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = readClientX(ev);
      if (typeof clientX !== 'number') return;
      const node = volTrackRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
      const rect = node?.getBoundingClientRect?.();
      if (!rect || rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onVolumeChange?.(Math.round(ratio * 100));
    };
    const onUp = () => setVolDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [volDragging, onVolumeChange]);

  useEffect(() => {
    if (!(volPopoverOpen || chromeHovered || chromeTapped) || Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }
    const handleOutside = (ev: MouseEvent | TouchEvent) => {
      const wrapNode = volWrapRef.current as unknown as { contains?: (target: EventTarget | null) => boolean } | null;
      if (volPopoverOpen && !wrapNode?.contains?.(ev.target)) {
        setVolPopoverOpen(false);
      }
      const overlayNode = overlayRootRef.current as unknown as { contains?: (target: EventTarget | null) => boolean } | null;
      if (!overlayNode?.contains?.(ev.target)) {
        setChromeHovered(false);
        setChromeTapped(false);
      }
    };
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('touchstart', handleOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('touchstart', handleOutside, true);
    };
  }, [volPopoverOpen, chromeHovered, chromeTapped]);

  const showBottomChrome = !startOverlayVisible && (
    chromeHovered || chromeTapped || seekingDrag || volDragging || volPopoverOpen
  );
  const webHoverProps = Platform.OS === 'web'
    ? ({
      onMouseEnter: () => setChromeHovered(true),
      onMouseMove: () => setChromeHovered(true),
    } as never)
    : {};

  return (
    <View
      ref={overlayRootRef}
      style={styles.overlayRoot}
      pointerEvents="box-none"
      {...(Platform.OS === 'web'
        ? ({
          ...webHoverProps,
          onMouseLeave: () => {
            setChromeHovered(false);
            setChromeTapped(false);
          },
        } as never)
        : {})}
    >
      {!startOverlayVisible ? (
        <Pressable
          onPressIn={() => wakeChromeTemporarily()}
          onPress={() => {
            wakeChromeTemporarily();
            if (volPopoverOpen) {
              setVolPopoverOpen(false);
              return;
            }
            if (isPlaying) onPause();
            else onPlay();
          }}
          {...webHoverProps}
          style={styles.tapLayer}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Tạm dừng video' : 'Phát video'}
        />
      ) : null}
      {startOverlayVisible && windowLook ? (
        <View style={styles.startOverlayWindow}>
          <Pressable
            onPress={onPlay}
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Phát video"
          />
          {onToggleFullscreen ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onToggleFullscreen();
              }}
              style={styles.startFullscreenBtn}
              accessibilityRole="button"
              accessibilityLabel={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} color="#FFFFFF" /> : <Maximize2 size={16} color="#FFFFFF" />}
            </Pressable>
          ) : null}
          <View pointerEvents="none" style={[styles.centerPlay, styles.centerPlayWindow]}>
            <Play size={40} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 6 }} />
          </View>
        </View>
      ) : null}

      {!isPlaying && !startOverlayVisible ? (
        pausedCheckpointSec !== null && pausedCheckpointSec !== undefined ? (
          <View pointerEvents="none" style={styles.checkpointPausedWrap}>
            <View style={styles.checkpointPausedPill}>
              <Pause size={13} color="#34D399" />
              <Text style={styles.checkpointPausedText}>
                {`Tạm dừng mốc ${pausedCheckpointSec}s · Trả lời câu hỏi bên dưới`}
              </Text>
            </View>
          </View>
        ) : (
          <View pointerEvents="none" style={styles.centerPlayWrap}>
            <View style={[styles.centerPlay, windowLook && styles.centerPlayWindow]}>
              <Play
                size={windowLook ? 36 : 34}
                color="#FFFFFF"
                fill="#FFFFFF"
                style={{ marginLeft: windowLook ? 5 : 4 }}
              />
            </View>
          </View>
        )
      ) : null}

      {showAntiSeekNotice ? (
        <View pointerEvents="none" style={styles.antiSeekHudWrap}>
          <View style={styles.antiSeekHudPill}>
            <View style={styles.antiSeekHudIcon}>
              <Text style={styles.antiSeekHudIconText}>!</Text>
            </View>
            <Text style={styles.antiSeekHudText}>Chống tua video</Text>
          </View>
        </View>
      ) : null}

      {!startOverlayVisible ? (
        <View
          style={[
            styles.bottomChrome,
            Platform.OS === 'web'
              ? ({
                backgroundColor: 'transparent',
                backgroundImage: 'linear-gradient(to top, rgba(8,15,28,0.95) 0%, rgba(8,15,28,0.65) 60%, transparent 100%)',
                transition: 'opacity 180ms ease',
              } as never)
              : null,
            { opacity: showBottomChrome ? 1 : 0 },
          ]}
          pointerEvents={showBottomChrome ? 'auto' : 'none'}
          {...webHoverProps}
        >
          <Pressable
            ref={progressTrackRef}
            onLayout={onBarLayout}
            onPressIn={(e) => {
              wakeChromeTemporarily();
              if (volPopoverOpen) setVolPopoverOpen(false);
              blockedDragNotifiedRef.current = false;
              setSeekingDrag(true);
              if (lockSeek) {
                blockedDragNotifiedRef.current = true;
                onBlockedSeek?.();
                return;
              }
              seekFromEvent(e as unknown as TrackPressEvent);
            }}
            onPressOut={() => {
              blockedDragNotifiedRef.current = false;
              setSeekingDrag(false);
            }}
            onPress={(e) => {
              if (lockSeek) {
                onBlockedSeek?.();
                return;
              }
              seekFromEvent(e as unknown as TrackPressEvent);
            }}
            onTouchMove={(e) => {
              if (lockSeek) {
                if (!blockedDragNotifiedRef.current) {
                  blockedDragNotifiedRef.current = true;
                  onBlockedSeek?.();
                }
                return;
              }
              seekFromEvent(e as unknown as TrackPressEvent);
            }}
            {...(Platform.OS === 'web'
              ? {
                onMouseDown: (e: unknown) => {
                  wakeChromeTemporarily();
                  blockedDragNotifiedRef.current = false;
                  setSeekingDrag(true);
                  if (lockSeek) {
                    blockedDragNotifiedRef.current = true;
                    onBlockedSeek?.();
                  } else {
                    seekFromEvent(e as TrackPressEvent);
                  }
                },
              }
              : {})}
            style={[styles.progressTrack, Platform.OS === 'web' && ({ cursor: lockSeek ? 'not-allowed' : 'pointer' } as never)]}
            accessibilityRole="adjustable"
            accessibilityLabel="Tiến độ video"
          >
            <View style={styles.progressBg} />
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            <View style={[styles.progressThumb, { left: `${progressPct}%` }]} />
          </Pressable>

          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => {
                wakeChromeTemporarily();
                if (volPopoverOpen) setVolPopoverOpen(false);
                if (isPlaying) onPause();
                else onPlay();
              }}
              style={styles.playBtn}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying ? (
                <Pause size={16} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={16} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </Pressable>

            <Text style={styles.timeText}>{formatClock(displayTime)}</Text>
            <Text style={styles.timeTextMuted}>/ {formatClock(safeDur)}</Text>

            <View style={styles.flexSpacer} />

            {rightSlot}

            {onToggleFullscreen ? (
              <Pressable
                onPress={() => {
                  wakeChromeTemporarily();
                  if (volPopoverOpen) setVolPopoverOpen(false);
                  onToggleFullscreen();
                }}
                style={styles.roundIconBtn}
                accessibilityRole="button"
                accessibilityLabel={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 size={16} color="#FFFFFF" /> : <Maximize2 size={16} color="#FFFFFF" />}
              </Pressable>
            ) : null}

            {onToggleMute ? (
              <View
                ref={volWrapRef}
                style={styles.volWrap}
                {...(Platform.OS === 'web' && showInlineVolSlider
                  ? {
                    onMouseEnter: () => onVolumeChange && setVolPopoverOpen(true),
                    onMouseLeave: () => setVolPopoverOpen(false),
                  }
                  : {})}
              >
                {!showInlineVolSlider && onVolumeChange && volPopoverOpen ? (
                  <View style={styles.volPopover}>
                    <Pressable
                      onPress={onToggleMute}
                      style={styles.volMuteQuickBtn}
                      accessibilityRole="button"
                      accessibilityLabel={muted ? 'Bật tiếng' : 'Tắt tiếng'}
                    >
                      <VolIcon size={13} color="#FFFFFF" />
                    </Pressable>
                    <Pressable
                      ref={volTrackRef}
                      onLayout={onVolBarLayout}
                      onPressIn={(e) => {
                        setVolDragging(true);
                        volumeFromEvent(e as unknown as TrackPressEvent);
                      }}
                      onPressOut={() => setVolDragging(false)}
                      onPress={(e) => volumeFromEvent(e as unknown as TrackPressEvent)}
                      onTouchMove={(e) => volumeFromEvent(e as unknown as TrackPressEvent)}
                      {...(Platform.OS === 'web'
                        ? {
                          onMouseDown: (e: unknown) => {
                            setVolDragging(true);
                            volumeFromEvent(e as TrackPressEvent);
                          },
                        }
                        : {})}
                      style={[styles.volumeTrack, Platform.OS === 'web' && ({ cursor: 'pointer' } as never)]}
                      accessibilityRole="adjustable"
                      accessibilityLabel="Âm lượng"
                    >
                      <View style={styles.volumeBg} />
                      <View style={[styles.volumeFill, { width: `${volPct}%` }]} />
                      <View style={[styles.volumeThumb, { left: `${volPct}%` }]} />
                    </Pressable>
                    <Text style={styles.volPctText}>{`${volPct}%`}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => {
                    wakeChromeTemporarily();
                    if (!showInlineVolSlider && onVolumeChange) {
                      setVolPopoverOpen((prev) => !prev);
                    } else {
                      onToggleMute();
                    }
                  }}
                  onLongPress={onToggleMute}
                  style={styles.roundIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={!showInlineVolSlider && onVolumeChange ? 'Điều chỉnh âm lượng' : (muted ? 'Bật tiếng' : 'Tắt tiếng')}
                >
                  <VolIcon size={15} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}

            {onVolumeChange && showInlineVolSlider ? (
              <Pressable
                ref={volTrackRef}
                onLayout={onVolBarLayout}
                onPressIn={(e) => {
                  setVolDragging(true);
                  volumeFromEvent(e as unknown as TrackPressEvent);
                }}
                onPressOut={() => setVolDragging(false)}
                onPress={(e) => volumeFromEvent(e as unknown as TrackPressEvent)}
                {...(Platform.OS === 'web'
                  ? {
                    onMouseDown: (e: unknown) => {
                      setVolDragging(true);
                      volumeFromEvent(e as TrackPressEvent);
                    },
                  }
                  : {})}
                style={[styles.volumeTrack, Platform.OS === 'web' && ({ cursor: 'pointer' } as never)]}
                accessibilityRole="adjustable"
                accessibilityLabel="Âm lượng"
              >
                <View style={styles.volumeBg} />
                <View style={[styles.volumeFill, { width: `${volPct}%` }]} />
                <View style={[styles.volumeThumb, { left: `${volPct}%` }]} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    ...(Platform.OS === 'android' ? { elevation: 50 } : null),
  },
  antiSeekHudWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    ...(Platform.OS === 'android' ? { elevation: 60 } : null),
  },
  antiSeekHudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  antiSeekHudIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  antiSeekHudIconText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  antiSeekHudText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tapLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 12,
  },
  centerPlayWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 14,
  },
  checkpointPausedWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(8,15,28,0.42)',
    zIndex: 14,
  },
  checkpointPausedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8,15,28,0.9)',
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  checkpointPausedText: {
    color: '#ECFDF5',
    fontSize: 12,
    fontWeight: '800',
  },
  startOverlayWindow: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 18,
    backgroundColor: '#23262E',
  },
  startFullscreenBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 19,
  },
  centerPlay: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#6EE7B7',
    borderBottomWidth: 5,
    borderBottomColor: '#047857',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  centerPlayWindow: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  bottomChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: 'rgba(8,15,28,0.72)',
  },
  progressTrack: {
    height: 18,
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressBg: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    top: 2,
    transform: [{ translateX: -7 }],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeTextMuted: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  flexSpacer: { flex: 1, minWidth: 4 },
  qualityPill: {
    height: 32,
    minWidth: 52,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  qualityPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  roundIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  volWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volPopover: {
    position: 'absolute',
    bottom: 40,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(110,231,183,0.4)',
    zIndex: 30,
  },
  volMuteQuickBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.45)',
  },
  volPctText: {
    minWidth: 30,
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  volumeTrack: {
    width: 72,
    height: 28,
    justifyContent: 'center',
  },
  volumeBg: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  volumeFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#34D399',
  },
  volumeThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    top: 8,
    transform: [{ translateX: -6 }],
  },
  qualityBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  qualitySheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 16,
    maxHeight: '50%',
  },
  qualitySheetTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 12,
  },
  qualityRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  qualityRowSelected: {
    backgroundColor: 'rgba(16, 185, 129,0.15)',
  },
  qualityRowText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  qualityRowTextSelected: {
    color: '#34D399',
    fontWeight: '900',
  },
});
