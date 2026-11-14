import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarClock, CalendarX2, ChevronDown, Crown, History, KeyRound, LogOut, Ticket, X } from 'lucide-react-native';
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
import { DuoButton } from '../duo/DuoButton';
import { isFreePortalMenu } from '../../utils/freePortalHelper';
import { colors, radius, spacing } from '../../theme/tokens';
import { DAILY_PRACTICE_STATS_EVENT, dailyPracticeApi, type DpStats } from '../../services/dailyPracticeApi';
import { resolveTodayXpSidebar } from '../../../../shared/subscription/xpDailyLine.mjs';

const PLAN_TONES: Record<string, [string, string]> = {
  '1m': ['#38BDF8', '#2563EB'],
  '3m': ['#34D399', '#0D9488'],
  '6m': ['#A78BFA', '#7C3AED'],
  '12m': ['#FBBF24', '#EA580C'],
  lifetime: ['#10B981', '#BE123C'],
};
const gradient = (from: string, to: string) => ({ backgroundColor: to, backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` } as never);
const formatVnd = (value: number) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;

/** Chọn gói (thanh toán QR SePay) hoặc nhập mã kích hoạt - dùng ở màn khóa và popup gia hạn. */
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
                    <DuoButton
                      variant="primary"
                      size="md"
                      fullWidth
                      text="Gia hạn"
                      loading={busyPlan === plan.id}
                      disabled={!sellable || Boolean(busyPlan)}
                      onPress={() => { void buy(plan); }}
                      accessibilityLabel={`Gia hạn gói ${plan.label}`}
                    />
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
          <DuoButton
            variant="primary"
            size="md"
            text="Kích hoạt"
            loading={redeeming}
            disabled={code.length < 13 || redeeming}
            onPress={() => { void redeem(); }}
            style={styles.codeButton}
          />
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
        <View style={[styles.heroIcon, gradient('#10B981', '#047857')]}><CalendarX2 size={30} color="#FFFFFF" /></View>
        <Text style={styles.heroTitle}>{neverActivated ? 'Tài khoản chưa được kích hoạt' : 'Tài khoản đã hết hạn'}</Text>
        <Text style={styles.heroText}>
          {neverActivated
            ? 'Nhập mã kích hoạt trung tâm cấp hoặc chọn gói để bắt đầu học.'
            : `Gói tài khoản của ${user?.name || 'bạn'} đã hết hạn ngày ${formatExpiryDate(subscription.subscription.expiresAt)}. Gia hạn để tiếp tục học - tiến độ học vẫn được giữ nguyên.`}
        </Text>
        <DuoButton
          variant="secondary"
          size="md"
          text="Đăng xuất"
          icon={<LogOut size={15} color={colors.ink} />}
          onPress={() => { void signOut(); }}
        />
      </View>
      <View style={styles.card}>
        <SubscriptionRenewPanel overview={subscription} onRenewed={() => { void refreshSubscription(); }} />
      </View>
    </ScrollView>
  );
}

/** Thẻ hạn dùng cho Hồ sơ / drawer; bấm Gia hạn mở popup chọn gói + nhập mã. */
export function SubscriptionStatusCard({
  compact = false,
  variant = 'default',
}: {
  compact?: boolean;
  variant?: 'default' | 'drawer';
}) {
  const { user, subscription, refreshSubscription } = useAuth();
  const isBrandStudent = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const [open, setOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  if (!subscription) return null;
  const sub = subscription.subscription;
  const expiring = sub.state === 'expiring';
  const isLifetime = sub.state === 'lifetime' && (!sub.freeTier || Boolean(sub.meetLifetime) || isBrandStudent);
  const hasActivePaid = (sub.state === 'active' || sub.state === 'expiring') || isLifetime || isBrandStudent;
  const isFree = !isBrandStudent && (sub.freeTier === true || (!hasActivePaid && !isLifetime));
  const isDrawer = variant === 'drawer';
  const [dpStats, setDpStats] = useState<DpStats | null>(null);

  useEffect(() => {
    let alive = true;
    dailyPracticeApi.overview()
      .then((data) => {
        if (alive && data?.stats) setDpStats(data.stats);
      })
      .catch(() => {});
    const subEv = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, (detail?: Partial<DpStats> & { stats?: Partial<DpStats> }) => {
      const patch = detail?.stats ? { ...detail.stats } : detail;
      if (patch) setDpStats((prev) => ({ ...prev, ...patch } as DpStats));
    });
    return () => {
      alive = false;
      subEv.remove();
    };
  }, []);

  const daysLeftNum = sub.daysLeft != null ? Number(sub.daysLeft) : null;
  const isNearExpiry = daysLeftNum != null ? daysLeftNum <= 7 : expiring;
  const actionLabel = isFree ? 'Nâng cấp' : isNearExpiry ? 'Gia hạn' : 'Đổi gói';
  const rawPlanLabel = String(sub.planLabel || 'học').trim();
  const planTitle = isFree
    ? 'Gói miễn phí'
    : isBrandStudent
      ? 'Gói Khóa học'
      : isLifetime
        ? 'Gói Vĩnh viễn'
        : rawPlanLabel.toLowerCase().startsWith('gói')
          ? rawPlanLabel
          : `Gói ${rawPlanLabel}`;
  const daysLine = isFree
    ? resolveTodayXpSidebar(dpStats, sub).line
    : isBrandStudent
      ? 'Khóa chính thức'
      : isLifetime
        ? 'Không giới hạn'
        : `Còn ${sub.daysLeft ?? 0} ngày`;

  if (isDrawer) {
    return (
      <>
        <View
          style={[
            styles.drawerSubCard,
            isLifetime
              ? (isBrandStudent ? styles.drawerSubCardBrand : styles.drawerSubCardLifetime)
              : expiring
                ? styles.drawerSubCardExpiring
                : isBrandStudent
                  ? styles.drawerSubCardBrand
                  : styles.drawerSubCardActive,
          ]}
        >
          <View style={styles.drawerSubMain}>
            <View
              style={[
                styles.drawerSubIconBox,
                isLifetime
                  ? (isBrandStudent ? { backgroundColor: 'rgba(16, 185, 129, 0.2)' } : styles.drawerSubIconLifetime)
                  : expiring
                    ? styles.drawerSubIconExpiring
                    : isBrandStudent
                      ? { backgroundColor: 'rgba(16, 185, 129, 0.2)' }
                      : styles.drawerSubIconActive,
              ]}
            >
              {isLifetime && !isBrandStudent ? (
                <Crown size={13} color="#FBBF24" />
              ) : (
                <CalendarClock size={13} color={isBrandStudent ? '#10B981' : (expiring ? '#FB923C' : '#34D399')} />
              )}
            </View>
            <View style={styles.drawerSubCopy}>
              <Text
                numberOfLines={2}
                style={[
                  styles.drawerSubTitle,
                  isLifetime && !isBrandStudent && styles.drawerSubTextLifetime,
                  isBrandStudent && { color: '#D1FAE5' },
                ]}
              >
                {planTitle}
              </Text>
              <View style={styles.drawerSubMetaRow}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.drawerSubDays,
                    styles.drawerSubDaysFlex,
                    isBrandStudent && { color: '#34D399' },
                  ]}
                >
                  {daysLine}
                </Text>
                {isLifetime && !isBrandStudent ? (
                  <View style={styles.drawerSubTag}>
                    <Text style={styles.drawerSubTagText}>VĨNH VIỄN</Text>
                  </View>
                ) : isBrandStudent ? null : (
                  <Pressable
                    onPress={() => setOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    style={({ pressed }) => [
                      styles.drawerSubCta,
                      pressed && { transform: [{ translateY: 1 }], borderBottomWidth: 1 },
                    ]}
                  >
                    <Text style={styles.drawerSubCtaText}>{actionLabel}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>

        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>{actionLabel} tài khoản</Text>
                <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Đóng">
                  <X size={20} color={colors.muted} />
                </Pressable>
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

  const history = subscription.history || [];

  return (
    <>
      {compact ? (
        <View style={[styles.statusCard, styles.statusCardCompact, expiring && styles.statusCardExpiring]}>
          <View style={[styles.statusIcon, isBrandStudent ? gradient('#10B981', '#059669') : isLifetime ? gradient('#10B981', '#BE123C') : expiring ? gradient('#FBBF24', '#EA580C') : gradient('#10B981', '#059669')]}>
            <CalendarClock size={16} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.statusTitle}>{planTitle}</Text>
            <Text numberOfLines={1} style={[styles.statusDaysGreen, isBrandStudent && { color: '#059669' }]}>{daysLine}</Text>
          </View>
          {!isLifetime && !isBrandStudent ? (
            <DuoButton variant="primary" size="sm" text={actionLabel} onPress={() => setOpen(true)} accessibilityLabel={actionLabel} />
          ) : null}
        </View>
      ) : (
        <View style={styles.profileSubCard}>
          <View style={styles.profileSubHeader}>
            <Crown size={18} color={isBrandStudent ? '#10B981' : (isFree ? '#10B981' : '#F59E0B')} />
            <Text style={[styles.profileSubHeaderTitle, isBrandStudent && { color: '#0F172A' }]}>
              {isFree ? 'Gói miễn phí' : (isBrandStudent ? 'Gói Khóa học' : 'Gói học Meet')}
            </Text>
          </View>

          <View style={[styles.profileSubInnerBox, expiring && styles.statusCardExpiring]}>
            <View style={[styles.profileSubIcon, isBrandStudent ? gradient('#10B981', '#059669') : isLifetime ? gradient('#10B981', '#BE123C') : expiring ? gradient('#FBBF24', '#EA580C') : gradient('#10B981', '#059669')]}>
              <CalendarClock size={22} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.statusTitle}>{planTitle}</Text>
              <Text numberOfLines={1} style={[styles.statusDaysGreen, isBrandStudent && { color: '#059669' }]}>{daysLine}</Text>
            </View>
            {(!isLifetime || isFree) && !isBrandStudent ? (
              <DuoButton variant="primary" size="sm" text={actionLabel} onPress={() => setOpen(true)} accessibilityLabel={actionLabel} />
            ) : null}
          </View>

          {history.length > 0 ? (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <History size={14} color="#64748B" />
                <Text style={styles.historyHeaderText}>Lịch sử gia hạn</Text>
              </View>
              <View style={styles.historyList}>
                {(showAllHistory ? history : history.slice(0, 3)).map((h, idx) => {
                  const sourceText = h.source === 'code'
                    ? 'Mã kích hoạt'
                    : h.source === 'admin'
                      ? 'Trung tâm cập nhật'
                      : 'Thanh toán';
                  const rowLabel = `${sourceText} · ${h.planLabel || h.plan || 'Gói học'}${h.amount ? ` · ${formatVnd(h.amount)}` : ''}`;
                  return (
                    <View key={h.id || String(idx)} style={[styles.historyRow, idx > 0 && styles.historyRowDivider]}>
                      <Text numberOfLines={1} style={styles.historyRowLeft}>{rowLabel}</Text>
                      <Text style={styles.historyRowDate}>{h.createdAt ? formatExpiryDate(h.createdAt) : '-'}</Text>
                    </View>
                  );
                })}
              </View>
              {history.length > 3 ? (
                <Pressable
                  onPress={() => setShowAllHistory((prev) => !prev)}
                  style={styles.historyToggleBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showAllHistory ? 'Thu gọn lịch sử gia hạn' : 'Xem thêm lịch sử gia hạn'}
                >
                  <Text style={styles.historyToggleText}>
                    {showAllHistory ? 'Thu gọn' : `Xem thêm (${history.length - 3})`}
                  </Text>
                  <View style={showAllHistory ? styles.chevronRotated : undefined}>
                    <ChevronDown size={14} color="#059669" />
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{actionLabel} tài khoản</Text>
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
  planHighlight: { borderColor: '#A7F3D0' },
  planHead: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  planLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  planSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  planBody: { padding: spacing.sm, gap: spacing.xs, alignItems: 'stretch' },
  planPrice: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  planPriceMuted: { color: '#94A3B8', fontSize: 12 },
  primary: {
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#34D399',
    borderBottomWidth: 3,
    borderBottomColor: '#059669',
    paddingHorizontal: spacing.md,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  codeBox: { gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  codeInput: { flex: 1, minHeight: 40, color: colors.ink, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  codeButton: { minWidth: 108 },
  screen: { flex: 1, backgroundColor: '#ECFDF5' },
  screenContent: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#A7F3D0' },
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
  profileSubCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  profileSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileSubHeaderTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '800',
  },
  profileSubInnerBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileSubIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  historyHeaderText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  historyList: {
    gap: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  historyRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyRowLeft: {
    flex: 1,
    paddingRight: 8,
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  historyRowDate: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  historyToggleBtn: {
    marginTop: 6,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  historyToggleText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  statusTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  statusText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  statusDaysGreen: { color: '#059669', fontSize: 12, fontWeight: '700', marginTop: 2 },
  statusTextExpiring: { color: '#EA580C' },
  renewChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#34D399',
    borderBottomWidth: 3,
    borderBottomColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  renewChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.5)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  sheetBody: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },

  /* Drawer Glass Styles */
  drawerSubCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  drawerSubMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  drawerSubCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    gap: 2,
  },
  drawerSubMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 24,
    minWidth: 0,
  },
  drawerSubCta: {
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#34D399',
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
  },
  drawerSubCtaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  drawerSubCardLifetime: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  drawerSubCardExpiring: {
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  drawerSubCardBrand: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  drawerSubCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  drawerSubIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerSubIconLifetime: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  drawerSubIconExpiring: {
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
  },
  drawerSubIconActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
  },
  drawerSubText: {
    fontSize: 11,
    fontWeight: '700',
  },
  drawerSubTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
    lineHeight: 14,
  },
  drawerSubTitleFlex: {
    flex: 1,
    minWidth: 0,
  },
  drawerSubDays: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
    lineHeight: 14,
    flexShrink: 0,
  },
  drawerSubDaysFlex: {
    flex: 1,
    minWidth: 0,
  },
  drawerSubTextLifetime: {
    color: '#FEF3C7',
  },
  drawerSubTextExpiring: {
    color: '#FDBA74',
  },
  drawerSubTextActive: {
    color: '#E2E8F0',
  },
  drawerSubTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  drawerSubTagText: {
    color: '#FDE68A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  drawerRenewBtn: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderBottomWidth: 3,
    borderBottomColor: '#D97706',
  },
  drawerRenewBtnText: {
    color: '#78350F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
