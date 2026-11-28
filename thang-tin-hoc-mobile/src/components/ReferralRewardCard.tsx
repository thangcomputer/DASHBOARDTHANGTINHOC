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

function formatShortVnd(amount: number) {
  const val = Math.max(0, Math.round(Number(amount) || 0));
  if (val === 0) return '0đ';
  if (val >= 1000 && val % 1000 === 0) return `${val / 1000}K`;
  return `${val.toLocaleString('vi-VN')}đ`;
}

/** Thẻ giới thiệu bạn bè giảm học phí trên Tổng quan học viên — đồng bộ Web StudentOverviewTab. */
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

  if (referral.enabled === false) {
    return null;
  }

  const discountVnd = Math.max(0, Math.round(Number(referral.discountAmountVnd ?? 50000)));
  const referrerVnd = Math.max(0, Math.round(Number(referral.referrerRewardVnd ?? 50000)));
  const availableVnd = Math.max(0, Math.round(Number(referral.availableDiscountVnd || 0)));
  const shortDiscount = formatShortVnd(discountVnd);
  const shortReferrer = formatShortVnd(referrerVnd);

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
        message: discountVnd > 0
          ? `Nhập mã giới thiệu ${referral.code} trên DewSkill để được giảm ${discountVnd.toLocaleString('vi-VN')}đ khi đăng ký khóa học!`
          : `Nhập mã giới thiệu ${referral.code} trên DewSkill để cùng học nhé!`,
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
      const gained = Math.max(0, Math.round(Number(data.discountAmountVnd ?? discountVnd)));
      setFeedback({
        type: 'success',
        text: gained > 0
          ? `Đã áp mã từ ${data.referrerName}! Bạn nhận ngay ưu đãi giảm ${gained.toLocaleString('vi-VN')}đ khi đăng ký khóa học.`
          : `Đã áp dụng mã giới thiệu từ ${data.referrerName}!`,
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
            <Text style={styles.title}>
              {discountVnd > 0 ? `Giới thiệu bạn bè · Giảm ${shortDiscount}` : 'Giới thiệu bạn bè'}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {discountVnd > 0 ? (
              <>
                Giảm ngay{' '}
                <Text style={styles.rewardStrong}>{`${discountVnd.toLocaleString('vi-VN')}đ`}</Text>
                {' khi được giới thiệu'}
                {referrerVnd > 0 ? ` · Người giới thiệu nhận giảm ${shortReferrer}` : ''}
                {Number(referral.minOrderAmountVnd) > 0
                  ? ` (khóa từ ${formatShortVnd(Number(referral.minOrderAmountVnd))})`
                  : ''}.
              </>
            ) : (
              'Chia sẻ mã để giới thiệu bạn bè cùng học tại DewSkill.'
            )}
          </Text>
        </View>
        {(availableVnd > 0 || (referral.referralCount || 0) > 0) ? (
          <View style={styles.statsPill}>
            <Text style={styles.statsPillText}>
              {availableVnd > 0
                ? `Đang có -${availableVnd.toLocaleString('vi-VN')}đ`
                : `${referral.referralCount || 0} bạn`}
            </Text>
          </View>
        ) : null}
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
            {availableVnd > 0
              ? `✓ Đã áp dụng mã giới thiệu ${referral.referredByCode || ''} · Còn ưu đãi giảm ${availableVnd.toLocaleString('vi-VN')}đ (tự động trừ khi đăng ký khóa học).`
              : `✓ Đã áp dụng mã giới thiệu ${referral.referredByCode || ''}.`}
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
            accessibilityLabel={discountVnd > 0 ? `Nhận giảm ${shortDiscount} từ mã giới thiệu` : 'Áp dụng mã giới thiệu'}
          >
            <Text style={styles.submitBtnText}>
              {referralBusy ? 'Đang gửi...' : discountVnd > 0 ? `Nhận giảm ${shortDiscount}` : 'Áp dụng'}
            </Text>
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

