import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Copy, Gift } from 'lucide-react-native';
import { dailyPracticeApi, type DpReferralInfo } from '../services/dailyPracticeApi';

type ReferralRewardCardProps = {
  referral: DpReferralInfo;
  onRedeemed?: () => void;
};

/** Thẻ giới thiệu bạn bè nhận thưởng XP trên Tổng quan học viên — đồng bộ Web StudentOverviewTab. */
export function ReferralRewardCard({ referral, onRedeemed }: ReferralRewardCardProps) {
  const [referralInput, setReferralInput] = useState('');
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: '' | 'success' | 'error'; text: string }>({
    type: '',
    text: '',
  });
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const markCopied = () => {
    setReferralCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setReferralCopied(false), 2000);
  };

  const handleCopy = async () => {
    if (!referral.code) return;
    if (Platform.OS === 'web') {
      try {
        await globalThis.navigator?.clipboard?.writeText(referral.code);
        markCopied();
        return;
      } catch {
        setFeedback({ type: 'error', text: `Mã của bạn là ${referral.code}` });
        return;
      }
    }
    try {
      await Share.share({
        title: 'Mã giới thiệu DewSkill',
        message: `Nhập mã giới thiệu ${referral.code} trên DewSkill để nhận ngay +${referral.rewardXp} XP!`,
      });
      markCopied();
    } catch {
      setFeedback({ type: 'error', text: `Mã của bạn là ${referral.code}` });
    }
  };

  const handleRedeem = async () => {
    const cleaned = referralInput.trim();
    if (!cleaned || referralBusy) return;
    setReferralBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      const data = await dailyPracticeApi.redeemReferral(cleaned);
      setReferralInput('');
      setFeedback({
        type: 'success',
        text: `Đã nhận +${data.rewardXp} XP cho cả bạn và ${data.referrerName}!`,
      });
      onRedeemed?.();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error && err.message ? err.message : 'Không thể áp dụng mã giới thiệu',
      });
    } finally {
      setReferralBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Gift size={17} color="#F59E0B" />
            <Text style={styles.title}>Giới thiệu bạn bè · Nhận thưởng XP</Text>
          </View>
          <Text style={styles.subtitle}>
            Gửi mã cho bạn bè cùng học — cả 2 nhận ngay{' '}
            <Text style={styles.rewardStrong}>{`+${referral.rewardXp} XP`}</Text>!
          </Text>
        </View>
        <View style={styles.statsPill}>
          <Text style={styles.statsPillText}>
            {`${referral.referralCount || 0} bạn · +${referral.referralXpEarned || 0} XP`}
          </Text>
        </View>
      </View>

      <View style={styles.codeBox}>
        <View style={styles.codeCol}>
          <Text style={styles.codeLabel}>MÃ CỦA BẠN</Text>
          <Text selectable style={styles.codeValue} numberOfLines={1}>
            {referral.code}
          </Text>
        </View>
        <Pressable
          onPress={() => { void handleCopy(); }}
          style={({ pressed }) => [styles.copyBtn, pressed && styles.copyBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Sao chép mã giới thiệu"
        >
          <Copy size={13} color="#FFFFFF" />
          <Text style={styles.copyBtnText}>{referralCopied ? 'Đã sao chép' : 'Sao chép'}</Text>
        </Pressable>
      </View>

      {referral.redeemed ? (
        <View style={styles.redeemedBox}>
          <Text style={styles.redeemedText}>
            {`✓ Đã áp dụng mã giới thiệu ${referral.referredByCode || ''}.`}
          </Text>
        </View>
      ) : (
        <View style={styles.redeemRow}>
          <TextInput
            value={referralInput}
            onChangeText={(value) => setReferralInput(value.toUpperCase())}
            placeholder="Nhập mã bạn bè (VD: DEW-XXXXXX)"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
            returnKeyType="done"
            onSubmitEditing={() => { void handleRedeem(); }}
            style={styles.input}
            accessibilityLabel="Nhập mã giới thiệu bạn bè"
          />
          <Pressable
            onPress={() => { void handleRedeem(); }}
            disabled={referralBusy || !referralInput.trim()}
            style={({ pressed }) => [
              styles.submitBtn,
              (referralBusy || !referralInput.trim()) && styles.submitBtnDisabled,
              pressed && !(referralBusy || !referralInput.trim()) && styles.submitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Nhận thưởng XP từ mã giới thiệu"
          >
            <Text style={styles.submitBtnText}>{referralBusy ? 'Đang gửi...' : 'Nhận XP'}</Text>
          </Pressable>
        </View>
      )}

      {feedback.text ? (
        <View
          style={[
            styles.feedbackBox,
            feedback.type === 'success' ? styles.feedbackSuccessBox : styles.feedbackErrorBox,
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              feedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
            ]}
          >
            {feedback.text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(135deg, rgba(255,251,235,0.85) 0%, #FFFFFF 55%, rgba(236,253,245,0.6) 100%)',
        }
      : {}),
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  } as never,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    color: '#64748B',
  },
  rewardStrong: {
    fontWeight: '900',
    color: '#047857',
  },
  statsPill: {
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statsPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400E',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#94A3B8',
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#0F172A',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  copyBtnPressed: {
    backgroundColor: '#047857',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  redeemedBox: {
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  redeemedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  redeemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  submitBtn: {
    flexShrink: 0,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  submitBtnPressed: {
    backgroundColor: '#D97706',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  feedbackBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  feedbackSuccessBox: {
    backgroundColor: '#ECFDF5',
  },
  feedbackErrorBox: {
    backgroundColor: '#FFF1F2',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackSuccessText: {
    color: '#047857',
  },
  feedbackErrorText: {
    color: '#BE123C',
  },
});

