import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Play } from 'lucide-react-native';
import { Mascot } from '../dailyPractice/Mascot';
import { DuoButton } from './DuoButton';

interface DuoHeroCardProps {
  playedToday?: boolean;
  streak?: number;
  stageTitle?: string;
  stageSubtitle?: string;
  lessonSubtitle?: string;
  progressPercent?: number;
  progress?: number;
  onPressContinue?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  mascotReaction?: 'happy' | 'determined' | 'studying' | string;
  isBrandStudent?: boolean;
}

export function DuoHeroCard({
  playedToday = false,
  streak = 0,
  stageTitle = 'Windows cơ bản · Chặng 1',
  stageSubtitle = 'Bắt đầu làm quen với chuột & bàn phím',
  lessonSubtitle,
  progressPercent,
  progress,
  onPressContinue,
  onContinue,
  continueLabel,
  mascotReaction,
  isBrandStudent = false,
}: DuoHeroCardProps) {
  const finalSubtitle = lessonSubtitle || stageSubtitle;
  const finalProgress = progressPercent ?? progress ?? 40;
  const finalOnContinue = onContinue || onPressContinue;
  const finalBtnLabel = continueLabel || (playedToday ? 'LUYỆN TẬP THÊM' : 'TIẾP TỤC HỌC');

  const mascotMood = (mascotReaction as any) || (playedToday ? 'happy' : streak > 0 ? 'determined' : 'studying');

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.mascotBox, isBrandStudent && { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }]}>
          <Mascot mood={mascotMood} size={76} />
        </View>
        <View style={styles.infoCol}>
          <View style={styles.badgeRow}>
            <View style={[styles.eyebrowBadge, isBrandStudent && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <Text style={[styles.eyebrowText, isBrandStudent && { color: '#059669' }]}>
                {playedToday ? 'ĐÃ HOÀN THÀNH HÔM NAY' : 'BÀI HỌC HIỆN TẠI'}
              </Text>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {stageTitle}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {finalSubtitle}
          </Text>
        </View>
      </View>

      {/* Progress Track */}
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, isBrandStudent && { backgroundColor: '#10B981' }, { width: `${Math.min(100, Math.max(5, finalProgress))}%` }]} />
        </View>
        <Text style={[styles.progressText, isBrandStudent && { color: '#059669' }]}>{`${Math.round(finalProgress)}%`}</Text>
      </View>

      {/* Big Tactile 3D Action Button */}
      <DuoButton
        variant={playedToday ? 'accent' : (isBrandStudent ? 'danger' : 'primary')}
        size="lg"
        fullWidth
        icon={<Play size={18} color="#FFFFFF" fill="#FFFFFF" />}
        text={finalBtnLabel}
        onPress={finalOnContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mascotBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  eyebrowBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  track: {
    flex: 1,
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
    width: 36,
    textAlign: 'right',
  },
});
