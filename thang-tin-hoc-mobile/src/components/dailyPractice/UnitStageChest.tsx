import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Gift, Lock, Sparkles } from 'lucide-react-native';
import type { GameSound } from './useGameSounds';
import { DpPathUnit, dailyPracticeApi, UNIT_CHEST_REWARD_XP } from '../../services/dailyPracticeApi';

function unitStepProgress(unit: DpPathUnit) {
  const steps = unit.steps || [];
  const totalSteps = steps.length;
  const doneSteps = steps.filter((step) => step.state === 'completed').length;
  return { doneSteps, totalSteps };
}

type Props = {
  unit: DpPathUnit;
  play?: (sound: GameSound) => void;
  onClaimed?: () => void;
};

export function UnitStageChest({ unit, play, onClaimed }: Props) {
  const { doneSteps, totalSteps } = unitStepProgress(unit);
  const rewardXp = unit.chestRewardXp ?? UNIT_CHEST_REWARD_XP;
  const complete = unit.state === 'completed' || (totalSteps > 0 && doneSteps >= totalSteps);
  const claimed = Boolean(unit.chestClaimed);
  const claimable = complete && !claimed;
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const doneStyle = complete && !claimed;
  const claimedStyle = claimed;

  const onPress = async () => {
    if (!claimable || claiming) return;
    setError('');
    setClaiming(true);
    play?.('tap');
    try {
      const result = await dailyPracticeApi.claimUnitChest(unit.id);
      if (result?.xp > 0) play?.('win');
      onClaimed?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không mở được rương');
    } finally {
      setClaiming(false);
    }
  };

  const content = (
  <>
      <View style={[styles.iconBox, claimedStyle ? styles.iconClaimed : doneStyle ? styles.iconDone : styles.iconPending]}>
        {claimedStyle ? <Check size={20} color="#FFFFFF" strokeWidth={3} /> : <Gift size={20} color={doneStyle ? '#FFFFFF' : '#94A3B8'} strokeWidth={2.5} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, (claimedStyle || doneStyle) && (claimedStyle ? styles.titleClaimed : styles.titleDone)]}>
          {claimedStyle
            ? `Đã mở rương · +${rewardXp} XP`
            : doneStyle
              ? `Mở rương chặng · +${rewardXp} XP`
              : `Rương phần thưởng chặng (${doneSteps}/${totalSteps})`}
        </Text>
        <Text style={styles.sub}>
          {claimedStyle
            ? 'Phần thưởng đã vào ví XP của bạn'
            : doneStyle
              ? 'Chúc mừng bạn đã chinh phục toàn bộ chặng!'
              : 'Hoàn thành các bài tập để nhận quà'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      {claimedStyle ? (
        <View style={[styles.badge, styles.badgeClaimed]}>
          <Sparkles size={14} color="#059669" />
        </View>
      ) : doneStyle ? (
        <View style={styles.badge}>
          {claiming ? <ActivityIndicator size="small" color="#D97706" /> : <Sparkles size={14} color="#D97706" />}
        </View>
      ) : (
        <Lock size={16} color="#CBD5E1" />
      )}
    </>
  );

  return (
    <View style={styles.wrap}>
      {claimable ? (
        <Pressable
          onPress={onPress}
          disabled={claiming}
          style={[styles.box, styles.boxDone, claiming && styles.boxBusy]}
          accessibilityRole="button"
          accessibilityLabel={`Mở rương chặng, nhận ${rewardXp} XP`}
        >
          {content}
        </Pressable>
      ) : (
        <View style={[styles.box, claimedStyle ? styles.boxClaimed : doneStyle ? styles.boxDone : styles.boxPending]}>
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  box: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  boxPending: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  boxDone: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  boxClaimed: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  boxBusy: { opacity: 0.85 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPending: { backgroundColor: '#E2E8F0' },
  iconDone: { backgroundColor: '#F59E0B' },
  iconClaimed: { backgroundColor: '#10B981' },
  title: { fontSize: 14, fontWeight: '800', color: '#475569' },
  titleDone: { color: '#92400E' },
  titleClaimed: { color: '#065F46' },
  sub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  error: { fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: '600' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeClaimed: { backgroundColor: '#D1FAE5' },
});
