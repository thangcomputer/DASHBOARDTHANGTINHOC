import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarClock, CalendarX2, Crown, KeyRound, LogOut, Ticket, X } from 'lucide-react-native';
import { useAuth } from '../../app/AuthContext';
import { CoursePaymentModal, type CoursePaymentCheckout } from '../CoursePaymentModal';
import {
  formatActivationCodeInput,
  formatExpiryDate,
  subscriptionApi,
  subscriptionShortLabel,
  type SubscriptionOverview,
  type SubscriptionPlan,
} from '../../services/subscriptionApi';
import { colors, radius, spacing } from '../../theme/tokens';

const PLAN_TONES: Record<string, [string, string]> = {
  '1m': ['#38BDF8', '#2563EB'],
  '3m': ['#34D399', '#0D9488'],
  '6m': ['#A78BFA', '#7C3AED'],
  '12m': ['#FBBF24', '#EA580C'],
  lifetime: ['#EF4444', '#BE123C'],
};
const gradient = (from: string, to: string) => ({ backgroundColor: to, backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` } as never);
const formatVnd = (value: number) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;

/** Chọn gói (thanh toán QR SePay) hoặc nhập mã kích hoạt — dùng ở màn khóa và popup gia hạn. */
export function SubscriptionRenewPanel({ overview, onRenewed }: { overview: SubscriptionOverview; onRenewed: () => void }) {
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [busyPlan, setBusyPlan] = useState('');
  const [checkout, setCheckout] = useState<CoursePaymentCheckout | null>(null);
  const isLifetime = overview.subscription.state === 'lifetime';

  const redeem = async () => {
    if (code.length < 13 || redeeming) return;
    setRedeeming(true);
    try {
      const result = await subscriptionApi.redeem(code);
      Alert.alert('Kích hoạt thành công', `Tài khoản đã được gia hạn gói ${result.redeemedPlanLabel || result.planLabel}.`);
      setCode('');
      onRenewed();
    } catch (error) {
      Alert.alert('Không kích hoạt được', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRedeeming(false);
    }
  };

  const buy = async (plan: SubscriptionPlan) => {
    if (busyPlan) return;
    setBusyPlan(plan.id);
    try {
      const session = await subscriptionApi.checkout(plan.id);
      setCheckout({ sessionId: session.sessionId, ref: session.ref, amount: session.amount, courseTitle: `Gia hạn tài khoản ${plan.label}` });
    } catch (error) {
      Alert.alert('Không tạo được thanh toán', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setBusyPlan('');
    }
  };

  return (
    <View style={styles.gap}>
      {!isLifetime ? (
        <View style={styles.gapSm}>
          <View style={styles.headRow}><Crown size={16} color="#F59E0B" /><Text style={styles.sectionTitle}>Chọn gói gia hạn</Text></View>
          <View style={styles.planGrid}>
            {overview.plans.map((plan) => {
              const sellable = Number(plan.price) > 0;
              const [from, to] = PLAN_TONES[plan.id] || PLAN_TONES['1m'];
              return (
                <View key={plan.id} style={[styles.plan, plan.id === 'lifetime' && styles.planHighlight]}>
                  <View style={[styles.planHead, gradient(from, to)]}>
                    <Text style={styles.planLabel}>{plan.label}</Text>
                    <Text style={styles.planSub}>{plan.months ? `${plan.months} tháng học` : 'Học mãi mãi'}</Text>
                  </View>
                  <View style={styles.planBody}>
                    <Text style={[styles.planPrice, !sellable && styles.planPriceMuted]}>{sellable ? formatVnd(plan.price) : 'Kích hoạt bằng mã'}</Text>
                    <Pressable
                      onPress={() => { void buy(plan); }}
                      disabled={!sellable || Boolean(busyPlan)}
                      style={[styles.primary, (!sellable || Boolean(busyPlan)) && styles.disabled]}
                      accessibilityRole="button"
                      accessibilityLabel={`Gia hạn gói ${plan.label}`}
                    >
                      {busyPlan === plan.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Gia hạn</Text>}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.muted}>Thời gian mới cộng tiếp từ ngày hết hạn hiện tại (hoặc từ hôm nay nếu đã hết hạn). Thanh toán xong hệ thống tự gia hạn.</Text>
        </View>
      ) : null}

      <View style={styles.codeBox}>
        <View style={styles.headRow}><Ticket size={16} color={colors.brand} /><Text style={styles.sectionTitle}>Có mã kích hoạt?</Text></View>
        <View style={styles.codeRow}>
          <View style={styles.codeInputWrap}>
            <KeyRound size={16} color="#94A3B8" />
            <TextInput
              value={code}
              onChangeText={(value) => setCode(formatActivationCodeInput(value))}
              placeholder="TTH-XXXX-XXXX"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.codeInput}
              accessibilityLabel="Mã kích hoạt"
            />
          </View>
          <Pressable onPress={() => { void redeem(); }} disabled={code.length < 13 || redeeming} style={[styles.primary, styles.codeButton, (code.length < 13 || redeeming) && styles.disabled]} accessibilityRole="button">
            {redeeming ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Kích hoạt</Text>}
          </Pressable>
        </View>
        <Text style={styles.muted}>Mã do trung tâm cấp khi bạn đăng ký gói (1, 3, 6, 12 tháng hoặc vĩnh viễn).</Text>
      </View>

      <CoursePaymentModal
        checkout={checkout}
        title="Gia hạn tài khoản"
        getSession={subscriptionApi.session}
        simulate={subscriptionApi.simulatePaid}
        onClose={() => setCheckout(null)}
        onPaid={() => {
          setCheckout(null);
          Alert.alert('Thanh toán thành công', 'Tài khoản đã được gia hạn.');
          onRenewed();
        }}
      />
    </View>
  );
}

/** Màn khóa khi hết hạn: chỉ còn gia hạn / nhập mã / đăng xuất. */
export function SubscriptionExpiredScreen() {
  const { subscription, refreshSubscription, signOut, user } = useAuth();
  if (!subscription) return null;
  const neverActivated = !subscription.subscription.activated;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, gradient('#EF4444', '#B91C1C')]}><CalendarX2 size={30} color="#FFFFFF" /></View>
        <Text style={styles.heroTitle}>{neverActivated ? 'Tài khoản chưa được kích hoạt' : 'Tài khoản đã hết hạn'}</Text>
        <Text style={styles.heroText}>
          {neverActivated
            ? 'Nhập mã kích hoạt trung tâm cấp hoặc chọn gói để bắt đầu học.'
            : `Gói tài khoản của ${user?.name || 'bạn'} đã hết hạn ngày ${formatExpiryDate(subscription.subscription.expiresAt)}. Gia hạn để tiếp tục học — tiến độ học vẫn được giữ nguyên.`}
        </Text>
        <Pressable onPress={() => { void signOut(); }} style={styles.outline} accessibilityRole="button">
          <LogOut size={15} color={colors.ink} /><Text style={styles.outlineText}>Đăng xuất</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <SubscriptionRenewPanel overview={subscription} onRenewed={() => { void refreshSubscription(); }} />
      </View>
    </ScrollView>
  );
}

/** Thẻ hạn dùng cho Hồ sơ / drawer; bấm Gia hạn mở popup chọn gói + nhập mã. */
export function SubscriptionStatusCard({ compact = false }: { compact?: boolean }) {
  const { subscription, refreshSubscription } = useAuth();
  const [open, setOpen] = useState(false);
  if (!subscription) return null;
  const sub = subscription.subscription;
  const expiring = sub.state === 'expiring';
  const isLifetime = sub.state === 'lifetime';
  return (
    <>
      <View style={[styles.statusCard, compact && styles.statusCardCompact, expiring && styles.statusCardExpiring]}>
        <View style={[styles.statusIcon, isLifetime ? gradient('#EF4444', '#BE123C') : expiring ? gradient('#FBBF24', '#EA580C') : gradient('#34D399', '#0D9488')]}>
          <CalendarClock size={compact ? 16 : 20} color="#FFFFFF" />
        </View>
        <View style={styles.flex}>
          {!compact ? <Text style={styles.statusTitle}>{`Gói ${sub.planLabel}`}</Text> : null}
          <Text numberOfLines={1} style={[styles.statusText, expiring && styles.statusTextExpiring]}>{subscriptionShortLabel(sub)}</Text>
        </View>
        {!isLifetime ? (
          <Pressable onPress={() => setOpen(true)} style={styles.renewChip} accessibilityRole="button" accessibilityLabel="Gia hạn tài khoản">
            <Text style={styles.renewChipText}>Gia hạn</Text>
          </Pressable>
        ) : null}
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Gia hạn tài khoản</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Đóng"><X size={20} color={colors.muted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <SubscriptionRenewPanel
                overview={subscription}
                onRenewed={() => {
                  setOpen(false);
                  void refreshSubscription();
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: spacing.lg },
  gapSm: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  plan: { width: '48%', flexGrow: 1, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  planHighlight: { borderColor: '#FECACA' },
  planHead: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  planLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  planSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  planBody: { padding: spacing.sm, gap: spacing.xs, alignItems: 'stretch' },
  planPrice: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  planPriceMuted: { color: '#94A3B8', fontSize: 12 },
  primary: { minHeight: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, paddingHorizontal: spacing.md },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  codeBox: { gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  codeInput: { flex: 1, minHeight: 40, color: colors.ink, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  codeButton: { minWidth: 96 },
  screen: { flex: 1, backgroundColor: '#FEF2F2' },
  screenContent: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#FECACA' },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  heroText: { color: '#475569', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  outline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  outlineText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  card: { padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  statusCardCompact: { padding: spacing.sm, borderRadius: 12 },
  statusCardExpiring: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  statusIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  statusText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  statusTextExpiring: { color: '#EA580C' },
  renewChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.brand },
  renewChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.5)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  sheetBody: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
});
