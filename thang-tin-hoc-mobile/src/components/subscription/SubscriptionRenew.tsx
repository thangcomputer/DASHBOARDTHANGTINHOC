import React, { useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarClock, CalendarX2, Check, ChevronDown, Crown, History, KeyRound, LogOut, Ticket, Zap } from 'lucide-react-native';
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
import { StandardBottomSheet } from '../StandardBottomSheet';
import { isFreePortalMenu } from '../../utils/freePortalHelper';
import { colors, radius, spacing, tabularNums } from '../../theme/tokens';
import { DAILY_PRACTICE_STATS_EVENT, dailyPracticeApi, type DpStats, type DpXpPack } from '../../services/dailyPracticeApi';
import { isDailyXpExhausted, resolveTodayXpSidebar } from '../../../../shared/subscription/xpDailyLine.mjs';

const PLAN_HINTS: Record<string, string> = {
  '1m': 'Làm quen',
  '3m': 'Nền tảng vững',
  '6m': 'Học chắc',
  '12m': 'Tiết kiệm nhất',
  lifetime: 'Học đến khi thành thạo',
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

  const extOverview = overview as SubscriptionOverview & {
    xpConfig?: { freeAccountXp?: number; resetCycle?: string; planXp?: Record<string, number> };
    subscription: SubscriptionOverview['subscription'] & { resetCycle?: string };
  };
  const extPlans = (overview.plans || []) as Array<SubscriptionPlan & { dailyXp?: number; resetCycle?: string }>;
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => (
    extPlans.find((p) => p.id === '3m' && Number(p.price) > 0)?.id
    || extPlans.find((p) => Number(p.price) > 0)?.id
    || extPlans[0]?.id
    || '3m'
  ));

  useEffect(() => {
    if (!extPlans.length) return;
    if (!extPlans.some((p) => p.id === selectedPlanId)) {
      const next = extPlans.find((p) => p.id === '3m' && Number(p.price) > 0)?.id
        || extPlans.find((p) => Number(p.price) > 0)?.id
        || extPlans[0].id;
      setSelectedPlanId(next);
    }
  }, [extPlans, selectedPlanId]);

  const xpCfg = extOverview.xpConfig;
  const resetCycle = xpCfg?.resetCycle || extPlans[0]?.resetCycle || extOverview.subscription?.resetCycle || 'daily';
  const cycleText = resetCycle === 'monthly' ? 'mỗi tháng' : resetCycle === 'never' ? 'tặng kèm' : 'mỗi ngày';
  const freeXp = xpCfg?.freeAccountXp ?? 60;
  const planXps = extPlans
    .map((p) => Number(xpCfg?.planXp?.[p.id] ?? p.dailyXp))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const minXp = planXps.length ? Math.min(...planXps) : 400;
  const maxXp = planXps.length ? Math.max(...planXps) : 1000;
  const rangeText = minXp === maxXp ? `${minXp} XP` : `${minXp}–${maxXp} XP`;

  const selectedPlan = extPlans.find((p) => p.id === selectedPlanId && Number(p.price) > 0)
    || extPlans.find((p) => p.id === '3m' && Number(p.price) > 0)
    || extPlans.find((p) => Number(p.price) > 0)
    || null;

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
          <View style={styles.headRow}><Crown size={16} color="#F59E0B" /><Text style={styles.sectionTitle}>Chọn gói học Meet</Text></View>
          <View style={styles.planGrid}>
            {extPlans.map((plan) => {
              const sellable = Number(plan.price) > 0;
              const isPopular = plan.id === '3m';
              const isSelected = Boolean(sellable && selectedPlan?.id === plan.id);
              const planXp = xpCfg?.planXp?.[plan.id] ?? plan.dailyXp;
              const planCycleKey = xpCfg?.resetCycle || plan.resetCycle || resetCycle;
              const planCycle = planCycleKey === 'monthly' ? 'mỗi tháng' : planCycleKey === 'never' ? 'tặng kèm' : 'mỗi ngày';
              const hint = PLAN_HINTS[plan.id] || (plan.months ? `${plan.months} tháng học` : 'Trọn khóa');
              const xpText = planXp != null ? `Meet · ${planXp} XP ${planCycle}` : 'Học qua Google Meet';

              return (
                <Pressable
                  key={plan.id}
                  onPress={() => { if (sellable) setSelectedPlanId(plan.id); }}
                  disabled={!sellable}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: !sellable }}
                  accessibilityLabel={`${plan.label}, ${sellable ? formatVnd(plan.price) : 'Kích hoạt bằng mã'}`}
                  style={({ pressed }) => [
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    !sellable && styles.planCardDisabled,
                    pressed && sellable && styles.planCardPressed,
                  ]}
                >
                  {isPopular ? (
                    <View style={styles.planPopularBadge}>
                      <Text style={styles.planPopularBadgeText}>★ Nên chọn</Text>
                    </View>
                  ) : null}

                  <View style={styles.planCardTop}>
                    <View style={[styles.planRadio, isSelected && styles.planRadioActive]}>
                      {isSelected ? <Check size={11} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                    <Text style={[styles.planLabelText, isSelected && styles.planLabelTextActive]} numberOfLines={1}>
                      {plan.label}
                    </Text>
                  </View>

                  <View style={[styles.planHintPill, isSelected && styles.planHintPillActive]}>
                    <Text style={[styles.planHintText, isSelected && styles.planHintTextActive]} numberOfLines={1}>
                      {hint}
                    </Text>
                  </View>

                  <Text style={styles.planXpText} numberOfLines={1}>
                    {xpText}
                  </Text>

                  <Text style={[styles.planPriceText, !sellable && styles.planPriceMuted]}>
                    {sellable ? formatVnd(plan.price) : 'Nhập mã'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <DuoButton
            variant="primary"
            size="lg"
            fullWidth
            text={selectedPlan ? `Gia hạn ${selectedPlan.label} (${formatVnd(selectedPlan.price)}) →` : 'Chọn gói để gia hạn'}
            loading={Boolean(busyPlan)}
            disabled={!selectedPlan || Boolean(busyPlan)}
            onPress={() => { if (selectedPlan) void buy(selectedPlan); }}
            accessibilityLabel={selectedPlan ? `Gia hạn gói ${selectedPlan.label}` : 'Gia hạn'}
          />

          <Text style={styles.muted}>
            {`Thanh toán hoặc nhập mã đều kích hoạt gói Meet. Thời gian mới cộng tiếp từ hạn hiện tại. Trong hạn gói, ${cycleText === 'tặng kèm' ? `nhận ${rangeText} tặng kèm` : `${cycleText} có ${rangeText}`}. Hết hạn thì tài khoản Dewskill về ${freeXp} XP ${cycleText}. XP đã mua vẫn được giữ.`}
          </Text>
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

const FALLBACK_XP_PACKS: DpXpPack[] = [
  { id: 'xp_100', xp: 100, priceVnd: 10000, label: '100 XP · 10.000đ' },
  { id: 'xp_300', xp: 300, priceVnd: 25000, label: '300 XP · 25.000đ' },
  { id: 'xp_800', xp: 800, priceVnd: 59000, label: '800 XP · 59.000đ' },
];

/** Thẻ hạn dùng cho Hồ sơ / drawer; bấm Gia hạn mở popup chọn gói + nhập mã, hết XP hiện nút Mua XP. */
export const SubscriptionStatusCard = React.memo(function SubscriptionStatusCard({
  compact = false,
  variant = 'default',
}: {
  compact?: boolean;
  variant?: 'default' | 'drawer';
}) {
  const { user, subscription, refreshSubscription } = useAuth();
  const [open, setOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [dpStats, setDpStats] = useState<DpStats | null>(() => dailyPracticeApi.peekOverview()?.stats ?? null);
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const [selectedXpPackId, setSelectedXpPackId] = useState('');
  const [xpCheckout, setXpCheckout] = useState<CoursePaymentCheckout | null>(null);
  const [xpBusy, setXpBusy] = useState(false);

  useEffect(() => {
    const subEv = DeviceEventEmitter.addListener(
      DAILY_PRACTICE_STATS_EVENT,
      (detail?: Partial<DpStats> & { stats?: Partial<DpStats> }) => {
        const patch = detail?.stats ? { ...detail.stats } : detail;
        if (patch) setDpStats((prev) => ({ ...prev, ...patch } as DpStats));
      },
    );
    if (!user || user.role !== 'student' || user.previewMode) {
      return () => subEv.remove();
    }
    const cachedStats = dailyPracticeApi.peekOverview()?.stats;
    if (cachedStats) {
      setDpStats((prev) => prev || cachedStats);
      return () => subEv.remove();
    }
    let alive = true;
    dailyPracticeApi.overview()
      .then((data) => {
        if (alive && data?.stats) setDpStats(data.stats);
      })
      .catch(() => {});
    return () => {
      alive = false;
      subEv.remove();
    };
  }, [user?.id, user?.role, user?.previewMode]);

  if (!subscription) return null;

  const isBrandStudent = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const sub = subscription.subscription;
  const expiring = sub.state === 'expiring';
  const isLifetime = sub.state === 'lifetime' && (!sub.freeTier || Boolean(sub.meetLifetime) || isBrandStudent);
  const hasActivePaid = (sub.state === 'active' || sub.state === 'expiring') || isLifetime || isBrandStudent;
  const isFree = !isBrandStudent && (sub.freeTier === true || (!hasActivePaid && !isLifetime));
  const isDrawer = variant === 'drawer';

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
  const sidebarXpLine = resolveTodayXpSidebar(dpStats, sub).line;
  const daysLine = (isFree || isBrandStudent || isLifetime)
    ? sidebarXpLine
    : `Còn ${sub.daysLeft ?? 0} ngày`;
  const isXpExhausted = isDailyXpExhausted(dpStats);
  const showBuyXpAction = (isBrandStudent || isLifetime) && isXpExhausted;

  const xpPacks = dpStats?.xpPacks?.length ? dpStats.xpPacks : FALLBACK_XP_PACKS;
  const activeXpPack = xpPacks.find((p) => (p.id || `xp_${p.xp}`) === selectedXpPackId) || xpPacks[0];

  const startXpCheckout = async () => {
    if (!activeXpPack || xpBusy) return;
    setXpBusy(true);
    try {
      const packId = activeXpPack.id || `xp_${activeXpPack.xp}`;
      const order = await dailyPracticeApi.buyXp(packId);
      setBuyXpOpen(false);
      setXpCheckout({
        sessionId: order.sessionId || '',
        ref: order.ref || order.orderCode || '',
        amount: order.amount || activeXpPack.priceVnd,
        courseTitle: `Mua +${order.xp || activeXpPack.xp} XP luyện tập`,
      });
    } catch (error) {
      Alert.alert('Không tạo được đơn mua XP', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setXpBusy(false);
    }
  };

  const xpPurchaseUi = (buyXpOpen || xpCheckout) ? (
    <>
      {buyXpOpen ? (
        <StandardBottomSheet
          visible={buyXpOpen}
          onClose={() => setBuyXpOpen(false)}
          title="Mua thêm XP luyện tập"
          subtitle="Nạp nhanh XP để tiếp tục làm bài trên lộ trình"
          icon={<Zap size={18} color="#D97706" />}
        >
          <View style={styles.gapSm}>
            {xpPacks.map((pack) => {
              const pid = pack.id || `xp_${pack.xp}`;
              const active = (activeXpPack?.id || `xp_${activeXpPack?.xp}`) === pid;
              return (
                <Pressable
                  key={pid}
                  onPress={() => setSelectedXpPackId(pid)}
                  style={[styles.buyXpPackRow, active && styles.buyXpPackActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.planRadio, active && { borderColor: '#D97706', backgroundColor: '#F59E0B' }]}>
                    {active ? <Check size={11} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.buyXpPackTitle}>{`+${pack.xp} XP`}</Text>
                    <Text style={styles.muted}>{`Đủ khoảng ${Math.max(1, Math.round(pack.xp / 20))} lượt luyện`}</Text>
                  </View>
                  <Text style={styles.buyXpPackPrice}>{formatVnd(pack.priceVnd)}</Text>
                </Pressable>
              );
            })}
            <DuoButton
              variant="gold"
              size="lg"
              fullWidth
              text={activeXpPack ? `Mua ${activeXpPack.xp} XP (${formatVnd(activeXpPack.priceVnd)})` : 'Mua XP'}
              loading={xpBusy}
              disabled={!activeXpPack || xpBusy}
              onPress={() => { void startXpCheckout(); }}
            />
          </View>
        </StandardBottomSheet>
      ) : null}
      {xpCheckout ? (
        <CoursePaymentModal
          checkout={xpCheckout}
          title="Mua XP luyện tập"
          getSession={(sessionId) => dailyPracticeApi.xpPurchaseStatus(sessionId).then((res) => ({
            paid: res.paid === true || res.status === 'paid',
          }))}
          simulate={(sessionId) => dailyPracticeApi.simulateXpPaid(sessionId)}
          onClose={() => setXpCheckout(null)}
          onPaid={() => {
            setXpCheckout(null);
            void dailyPracticeApi.overview()
              .then((res) => { if (res?.stats) setDpStats(res.stats); })
              .catch(() => {});
            Alert.alert('Thanh toán thành công', 'Ví XP của bạn đã được cập nhật.');
          }}
        />
      ) : null}
    </>
  ) : null;

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
                    showBuyXpAction
                      ? { color: '#FCD34D' }
                      : isBrandStudent
                        ? { color: '#34D399' }
                        : null,
                  ]}
                >
                  {daysLine}
                </Text>
                {showBuyXpAction ? (
                  <Pressable
                    onPress={() => setBuyXpOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Mua XP"
                    style={({ pressed }) => [
                      styles.drawerBuyXpCta,
                      pressed && { transform: [{ translateY: 1 }], borderBottomWidth: 1 },
                    ]}
                  >
                    <Zap size={10} color="#451A03" fill="#451A03" />
                    <Text style={styles.drawerBuyXpCtaText}>Mua XP</Text>
                  </Pressable>
                ) : isLifetime && !isBrandStudent ? (
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

        {open ? (
          <StandardBottomSheet
            visible={open}
            onClose={() => setOpen(false)}
            title={`${actionLabel} tài khoản`}
            subtitle="Chọn gói phù hợp hoặc nhập mã kích hoạt"
            icon={<Crown size={18} color={colors.brand} />}
          >
            <SubscriptionRenewPanel
              overview={subscription}
              onRenewed={() => {
                setOpen(false);
                void refreshSubscription();
              }}
            />
          </StandardBottomSheet>
        ) : null}
        {xpPurchaseUi}
      </>
    );
  }

  const history = subscription.history || [];

  return (
    <>
      {compact ? (
        <View style={[styles.statusCard, styles.statusCardCompact, expiring && styles.statusCardExpiring]}>
          <View style={[styles.statusIcon, isBrandStudent ? gradient('#10B981', '#059669') : isLifetime ? gradient('#10B981', '#047857') : expiring ? gradient('#FBBF24', '#EA580C') : gradient('#10B981', '#059669')]}>
            <CalendarClock size={16} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.statusTitle}>{planTitle}</Text>
            <Text numberOfLines={1} style={[styles.statusDaysGreen, showBuyXpAction ? { color: '#D97706' } : isBrandStudent && { color: '#059669' }]}>{daysLine}</Text>
          </View>
          {showBuyXpAction ? (
            <DuoButton variant="gold" size="sm" text="Mua XP" icon={<Zap size={12} color="#FFFFFF" />} onPress={() => setBuyXpOpen(true)} accessibilityLabel="Mua XP" />
          ) : !isLifetime && !isBrandStudent ? (
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
            <View style={[styles.profileSubIcon, isBrandStudent ? gradient('#10B981', '#059669') : isLifetime ? gradient('#10B981', '#047857') : expiring ? gradient('#FBBF24', '#EA580C') : gradient('#10B981', '#059669')]}>
              <CalendarClock size={22} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.statusTitle}>{planTitle}</Text>
              <Text numberOfLines={1} style={[styles.statusDaysGreen, showBuyXpAction ? { color: '#D97706' } : isBrandStudent && { color: '#059669' }]}>{daysLine}</Text>
            </View>
            {showBuyXpAction ? (
              <DuoButton variant="gold" size="sm" text="Mua XP" icon={<Zap size={12} color="#FFFFFF" />} onPress={() => setBuyXpOpen(true)} accessibilityLabel="Mua XP" />
            ) : (!isLifetime || isFree) && !isBrandStudent ? (
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
      {open ? (
        <StandardBottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title={`${actionLabel} tài khoản`}
          subtitle="Chọn gói phù hợp hoặc nhập mã kích hoạt"
          icon={<Crown size={18} color={colors.brand} />}
        >
          <SubscriptionRenewPanel
            overview={subscription}
            onRenewed={() => {
              setOpen(false);
              void refreshSubscription();
            }}
          />
        </StandardBottomSheet>
      ) : null}
      {xpPurchaseUi}
    </>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: spacing.lg },
  gapSm: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: 8 },
  planCard: {
    position: 'relative',
    width: '47%',
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 6,
  },
  planCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  planCardDisabled: {
    opacity: 0.55,
  },
  planCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  planPopularBadge: {
    position: 'absolute',
    top: -10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  planPopularBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  planLabelText: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  planLabelTextActive: {
    color: '#065F46',
  },
  planHintPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  planHintPillActive: {
    backgroundColor: '#D1FAE5',
  },
  planHintText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  planHintTextActive: {
    color: '#047857',
  },
  planXpText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
    ...tabularNums,
  },
  planPriceText: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
    ...tabularNums,
  },
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
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  codeBox: { gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  codeInput: { flex: 1, minHeight: 40, color: colors.ink, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  codeButton: { minWidth: 108 },
  screen: { flex: 1, backgroundColor: '#ECFDF5' },
  screenContent: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#A7F3D0' },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroText: { color: '#475569', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  outline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  outlineText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
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
    ...tabularNums,
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
  statusTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', ...tabularNums },
  statusText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  statusDaysGreen: { color: '#059669', fontSize: 12, fontWeight: '700', marginTop: 2, ...tabularNums },
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
  renewChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

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
    fontWeight: '700',
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
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
    fontWeight: '700',
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
    ...tabularNums,
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
    fontWeight: '800',
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
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  drawerBuyXpCta: {
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderBottomWidth: 2,
    borderBottomColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  drawerBuyXpCtaText: {
    color: '#451A03',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  buyXpPackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  buyXpPackActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  buyXpPackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  buyXpPackPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
    ...tabularNums,
  },
});
