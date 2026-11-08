import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { CheckCircle2, Clapperboard, ExternalLink, Lock, Play } from 'lucide-react-native';
import { VideoPlayerFrame, type VideoPlayerApi } from '../../screens/VideoPlayerFrame';
import { resolveMobilePublicUrl } from '../../services/apiClient';
import { embeddedVideoUrl, isDirectVideoUrl, playableVideoUrl } from '../../utils/videoSource';
import { dailyPracticeApi, type DpPathUnit, type DpUnitVideos } from '../../services/dailyPracticeApi';
import { noteStudyMediaProgress } from '../../services/studyActivity';
import type { GameSound } from './useGameSounds';
import { spacing } from '../../theme/tokens';

type PlaylistItem = { id: string; title: string; url: string; source: 'unit' | 'step' | 'lesson'; locked: boolean; stepLabel?: string };

/**
 * Popup video của chặng — mở ngay trên màn lộ trình, đóng lại là về đúng chỗ đang xem.
 * Danh sách phát: video riêng của chặng + video buổi bài giảng đã gắn (vẫn có nút mở trang bài giảng).
 */
export function PathVideoModal({ unit, initialVideoId = '', color, userId, play, onClose, onWatched, onOpenLesson }: {
  unit: DpPathUnit;
  initialVideoId?: string;
  color: { from: string; to: string };
  userId: string;
  play: (s: GameSound) => void;
  onClose: () => void;
  onWatched: (videoId: string) => Promise<void>;
  onOpenLesson: (lesson: { subjectId: string; unitId: string }) => void;
}) {
  const [data, setData] = useState<DpUnitVideos | null>(null);
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState(initialVideoId);
  const [started, setStarted] = useState(Boolean(initialVideoId));
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => new Set());
  const playerApiRef = useRef<VideoPlayerApi | null>(null);

  useEffect(() => {
    let alive = true;
    dailyPracticeApi.unitVideos(unit.id)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setWatchedIds(new Set(res.videos.filter((video) => video.state === 'completed').map((video) => video.id)));
      })
      .catch((err: unknown) => { if (alive) setError(err instanceof Error ? err.message : 'Không tải được video của chặng'); });
    return () => { alive = false; };
  }, [unit.id]);

  const playlist = useMemo<PlaylistItem[]>(() => [
    ...(data?.videos || []).map((video) => ({
      id: video.id,
      title: video.title,
      url: video.url,
      source: (video.source === 'step' ? 'step' : 'unit') as 'unit' | 'step',
      locked: video.state === 'locked',
      stepLabel: video.stepLabel,
    })),
    ...(data?.lesson?.videos || []).map((video) => ({ ...video, source: 'lesson' as const, locked: false })),
  ], [data]);
  const current = playlist.find((video) => video.id === currentId && !video.locked) || playlist.find((video) => !video.locked) || null;
  const lesson = data?.lesson || null;
  const watched = current ? (current.source === 'unit' || current.source === 'step') && watchedIds.has(current.id) : false;
  const rawUrl = current?.url || '';
  const url = playableVideoUrl(rawUrl) || (rawUrl.startsWith('/uploads/') ? rawUrl : '');
  const embedded = embeddedVideoUrl(url);
  const playable = Boolean(embedded || isDirectVideoUrl(url) || url.startsWith('/uploads/'));

  const markWatched = async () => {
    if (!current || current.source === 'lesson' || watchedIds.has(current.id)) return true;
    const videoId = current.id;
    setWatchedIds((prev) => new Set(prev).add(videoId));
    play('correct');
    try {
      await onWatched(videoId);
    } catch {
      // lần sau xem lại sẽ ghi tiếp
    }
    return true;
  };

  const select = (video: PlaylistItem) => {
    if (video.locked) return;
    play('tap');
    setCurrentId(video.id);
    setStarted(true);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.backdrop}>
        <BlurView
          intensity={Platform.OS === 'android' ? 72 : 56}
          tint="light"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.backdropTint} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text
              numberOfLines={1}
              style={[styles.unitChip, { backgroundColor: color.to, backgroundImage: `linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%)` } as never]}
            >
              {`CHẶNG ${unit.index} · ${unit.title.toUpperCase()}`}
            </Text>
            <View style={styles.titleRow}>
              <Clapperboard size={15} color="#F87171" />
              <Text numberOfLines={2} style={styles.title}>{current?.title || 'Video của chặng'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Đóng">
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>

          <View style={styles.frame}>
            {!data && !error ? (
              <View style={styles.startOverlay}><ActivityIndicator color="#FFFFFF" /><Text style={styles.startLabel}>Đang tải video…</Text></View>
            ) : error ? (
              <View style={styles.startOverlay}><Text style={[styles.startLabel, { color: '#FCD34D' }]}>{error}</Text></View>
            ) : !current ? (
              <View style={styles.startOverlay}>
                <Lock size={22} color="rgba(255,255,255,0.75)" />
                <Text style={styles.startLabel}>{lesson?.locked ? lesson.message : 'Chặng này chưa có video.'}</Text>
              </View>
            ) : started && playable ? (
              <VideoPlayerFrame
                key={current.id}
                videoUrl={resolveMobilePublicUrl(url)}
                embeddedUrl={embedded}
                title={current.title}
                lessonId={`dp-${userId || 'anon'}-${unit.id}-${current.id}`}
                antiSeekEnabled={false}
                done={watched}
                playerApiRef={playerApiRef}
                onProgress={(progress) => noteStudyMediaProgress(progress.playing)}
                onWatched={markWatched}
              />
            ) : (
              <View style={styles.startOverlay}>
                <Pressable
                  onPress={() => { if (playable) { play('tap'); setStarted(true); } }}
                  disabled={!playable}
                  style={[styles.startButton, !playable && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Phát video"
                >
                  <Play size={38} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 6 }} />
                </Pressable>
                {!playable ? <Text style={styles.startLabel}>Liên kết video chưa đúng — trung tâm sẽ cập nhật sớm</Text> : null}
              </View>
            )}
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {playlist.length ? <Text style={styles.listTitle}>{`DANH SÁCH VIDEO (${playlist.length})`}</Text> : null}
            {playlist.map((video, index) => {
              const active = current?.id === video.id;
              const done = (video.source === 'unit' || video.source === 'step') && watchedIds.has(video.id);
              return (
                <Pressable
                  key={video.id}
                  onPress={() => select(video)}
                  disabled={video.locked}
                  style={[styles.item, active && styles.itemActive, video.locked && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: video.locked }}
                >
                  <View style={[styles.itemIndex, { backgroundColor: active ? '#EF3B36' : 'rgba(255,255,255,0.12)' }]}>
                    {video.locked ? <Lock size={12} color="#FFFFFF" /> : active ? <Play size={12} color="#FFFFFF" fill="#FFFFFF" /> : <Text style={styles.itemIndexText}>{index + 1}</Text>}
                  </View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.itemTitle}>{video.title}</Text>
                    <Text numberOfLines={1} style={styles.itemMeta}>{video.source === 'lesson' ? `Bài giảng · ${lesson?.title || ''}` : 'Video của chặng'}</Text>
                  </View>
                  {done ? <CheckCircle2 size={16} color="#34D399" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            {current?.source === 'unit' || current?.source === 'step' ? (
              watched ? (
                <View style={styles.watched}>
                  <CheckCircle2 size={14} color="#6EE7B7" />
                  <Text style={styles.watchedText}>Đã xem</Text>
                </View>
              ) : null
            ) : <View style={styles.flex} />}
            {lesson ? (
              <Pressable onPress={() => { onClose(); onOpenLesson(lesson); }} style={styles.lessonButton} accessibilityRole="button">
                <ExternalLink size={14} color="#FFFFFF" />
                <Text style={styles.doneText}>Bài giảng</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.sm, overflow: 'hidden' },
  backdropTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.38)' },
  card: {
    maxHeight: '94%', borderRadius: 20, overflow: 'hidden', backgroundColor: '#1C1F26',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0px 24px 48px rgba(15,23,42,0.28)',
  } as never,
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, backgroundColor: '#16181E',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  unitChip: {
    maxWidth: '42%', color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, overflow: 'hidden',
  },
  titleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  title: { flexShrink: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '900', textAlign: 'left' },
  close: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#DC2626' },
  closeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#23262E', overflow: 'hidden' },
  startOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#23262E' },
  startButton: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF3B36',
    boxShadow: '0px 0px 32px rgba(220,38,38,0.5)',
  } as never,
  startLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingHorizontal: spacing.lg },
  list: { maxHeight: 220 },
  listContent: { gap: 4, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  listTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  itemActive: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  itemIndex: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  itemIndexText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  itemTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  itemMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  watched: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  watchedText: { color: '#6EE7B7', fontSize: 12, fontWeight: '900' },
  hint: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  lessonButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 'auto' },
  doneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
