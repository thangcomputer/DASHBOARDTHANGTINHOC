import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import {
  Maximize2, Minimize2, Pause, Play, Volume1, Volume2, VolumeX,
} from 'lucide-react-native';
import { qualityButtonLabel, youtubeQualityLabel } from '../../utils/youtubeQuality';

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
  liveQuality = null,
  qualityOptions = [],
  onSelectQuality,
  onOpenQualityMenu,
  showQuality = false,
  isFullscreen = false,
  onToggleFullscreen,
  overlayVariant = 'default',
  startOverlayVisible = false,
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
}) {
  const windowLook = overlayVariant === 'window';
  const [barWidth, setBarWidth] = useState(0);
  const [volBarWidth, setVolBarWidth] = useState(0);
  const [qualityOpen, setQualityOpen] = useState(false);
  const safeDur = Math.max(0, duration);
  const displayTime = safeDur > 0 ? Math.min(currentTime, safeDur) : currentTime;
  const progressPct = safeDur > 0 ? Math.min(100, (displayTime / safeDur) * 100) : 0;
  const volPct = muted ? 0 : Math.max(0, Math.min(100, volume));
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const qualityLabel = qualityButtonLabel(liveQuality);

  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const onVolBarLayout = useCallback((e: LayoutChangeEvent) => {
    setVolBarWidth(e.nativeEvent.layout.width);
  }, []);

  const seekFromX = useCallback((x: number) => {
    if (!onSeek || safeDur <= 0 || barWidth <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / barWidth));
    onSeek(ratio * safeDur);
  }, [barWidth, onSeek, safeDur]);

  const volumeFromX = useCallback((x: number) => {
    if (!onVolumeChange || volBarWidth <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / volBarWidth));
    onVolumeChange(Math.round(ratio * 100));
  }, [onVolumeChange, volBarWidth]);

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      {!startOverlayVisible ? (
        <Pressable
          onPress={() => (isPlaying ? onPause() : onPlay())}
          style={styles.tapLayer}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Tạm dừng video' : 'Phát video'}
        />
      ) : null}
      {startOverlayVisible && windowLook ? (
        <Pressable
          onPress={onPlay}
          style={styles.startOverlayWindow}
          accessibilityRole="button"
          accessibilityLabel="Phát video"
        >
          <View style={[styles.centerPlay, styles.centerPlayWindow]}>
            <Play size={40} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 6 }} />
          </View>
        </Pressable>
      ) : null}

      {!isPlaying && !startOverlayVisible ? (
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
      <View style={styles.bottomChrome} pointerEvents="box-none">
        <Pressable
          onLayout={onBarLayout}
          onPress={(e) => {
            if (lockSeek) {
              onBlockedSeek?.();
              return;
            }
            seekFromX(e.nativeEvent.locationX);
          }}
          style={styles.progressTrack}
          accessibilityRole="adjustable"
          accessibilityLabel="Tiến độ video"
        >
          <View style={styles.progressBg} />
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          <View style={[styles.progressThumb, { left: `${progressPct}%` }]} />
        </Pressable>

        <View style={styles.controlsRow}>
          <Pressable
            onPress={() => (isPlaying ? onPause() : onPlay())}
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

          {showQuality ? (
            <Pressable
              onPress={() => {
                onOpenQualityMenu?.();
                setQualityOpen(true);
              }}
              style={styles.qualityPill}
              accessibilityRole="button"
              accessibilityLabel={`Độ phân giải ${qualityLabel}`}
            >
              <Text style={styles.qualityPillText}>{qualityLabel}</Text>
            </Pressable>
          ) : null}

          {onToggleFullscreen ? (
            <Pressable
              onPress={onToggleFullscreen}
              style={styles.roundIconBtn}
              accessibilityRole="button"
              accessibilityLabel={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} color="#FFFFFF" /> : <Maximize2 size={16} color="#FFFFFF" />}
            </Pressable>
          ) : null}

          {onToggleMute ? (
            <Pressable
              onPress={onToggleMute}
              style={styles.roundIconBtn}
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Bật tiếng' : 'Tắt tiếng'}
            >
              <VolIcon size={16} color="#FFFFFF" />
            </Pressable>
          ) : null}

          {onVolumeChange ? (
            <Pressable
              onLayout={onVolBarLayout}
              onPress={(e) => volumeFromX(e.nativeEvent.locationX)}
              style={styles.volumeTrack}
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

      <Modal visible={qualityOpen} transparent animationType="fade" onRequestClose={() => setQualityOpen(false)}>
        <Pressable style={styles.qualityBackdrop} onPress={() => setQualityOpen(false)}>
          <View style={styles.qualitySheet}>
            <Text style={styles.qualitySheetTitle}>Chất lượng video</Text>
            <ScrollView>
              {(qualityOptions.length ? qualityOptions : ['default']).map((level) => {
                const selected = (liveQuality || 'default') === level
                  || (level === 'default' && (!liveQuality || liveQuality === 'default'));
                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      setQualityOpen(false);
                      onSelectQuality?.(level);
                    }}
                    style={[styles.qualityRow, selected && styles.qualityRowSelected]}
                  >
                    <Text style={[styles.qualityRowText, selected && styles.qualityRowTextSelected]}>
                      {youtubeQualityLabel(level)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    ...(Platform.OS === 'android' ? { elevation: 50 } : null),
  },
  antiSeekHudWrap: {
    ...StyleSheet.absoluteFillObject,
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
    borderColor: '#EF4444',
  },
  antiSeekHudIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
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
    ...StyleSheet.absoluteFillObject,
    bottom: 88,
    zIndex: 12,
  },
  centerPlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 14,
  },
  startOverlayWindow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 18,
    backgroundColor: '#23262E',
  },
  centerPlay: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF3B36',
    shadowColor: '#DC2626',
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
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: 'rgba(8,15,28,0.94)',
  },
  progressTrack: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 8,
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
    backgroundColor: '#EF4444',
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FECACA',
    top: 5,
    transform: [{ translateX: -7 }],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
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
    height: 36,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: 18,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    backgroundColor: '#F87171',
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
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  qualityRowText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  qualityRowTextSelected: {
    color: '#FCA5A5',
    fontWeight: '900',
  },
});
