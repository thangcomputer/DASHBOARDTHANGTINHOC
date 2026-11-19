import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CloudSun,
  Crown,
  FolderOpen,
  Headphones,
  KeyRound,
  Layers,
  Lock,
  MessageCircle,
  MessageCircleQuestion,
  Moon,
  Rocket,
  Sparkles,
  Sun,
  Ticket,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { CoursePaymentModal, type CoursePaymentCheckout } from './CoursePaymentModal';
import {
  formatActivationCodeInput,
  subscriptionApi,
  type SubscriptionPlanId,
} from '../services/subscriptionApi';
import { mobileApiRequest } from '../services/apiClient';
import { colors, tabularNums } from '../theme/tokens';
import { DuoButton } from './duo/DuoButton';

const GOOGLE_MEET_LOGO = require('../../assets/google-meet.webp');
const MASCOT_STUDY = require('../../assets/mascot/cam-xuc-hoc-bai.gif');

import {
  FREE_PORTAL_COURSE_NAME,
  hasRealCourseEnrollment,
  isFreePortalLocked,
  isFreePortalMenu,
} from '../utils/freePortalHelper';

export {
  FREE_PORTAL_COURSE_NAME,
  hasRealCourseEnrollment,
  isFreePortalLocked,
  isFreePortalMenu,
};

const LOCKED_ITEMS = [
  { key: 'support', label: 'Hỗ trợ', Icon: Headphones },
  { key: 'inbox', label: 'Tin nhắn', Icon: MessageCircle },
  { key: 'exam', label: 'Phòng thi', Icon: Award },
  { key: 'materials-files', label: 'Bài tập', Icon: FolderOpen },
] as const;

const MEET_SLOTS = [
  { key: 'morning', label: 'Sáng', time: '9:00 – 12:00', Icon: Sun, iconColor: '#F59E0B' },
  { key: 'afternoon', label: 'Chiều', time: '14:00 – 16:00', Icon: CloudSun, iconColor: '#F97316' },
  { key: 'evening', label: 'Tối', time: '19:00 – 21:00', Icon: Moon, iconColor: '#6366F1' },
] as const;

const MEET_BENEFITS = [
  'Học trực tiếp cùng giảng viên qua Google Meet',
  'Hỏi đáp ngay trong buổi học, không giới hạn lượt hỏi',
  'Có video ghi hình xem lại sau mỗi buổi học',
  'Thực hành bài bản Word · Excel · PowerPoint',
  'Đồng hành hỗ trợ đến khi làm thành thạo',
] as const;

const OFFICE_APPS = [
  { short: 'W', name: 'Word', bg: '#2B579A' },
  { short: 'X', name: 'Excel', bg: '#217346' },
  { short: 'P', name: 'PowerPoint', bg: '#D24726' },
] as const;

type OfferPlan = {
  id: SubscriptionPlanId;
  label: string;
  hint: string;
  price: number;
  featured?: boolean;
};

const DEFAULT_OFFER_PLANS: OfferPlan[] = [
  { id: '1m', label: '1 tháng', hint: 'Làm quen', price: 199000 },
  { id: '3m', label: '3 tháng', hint: 'Nền tảng vững', price: 399000, featured: true },
  { id: '6m', label: '6 tháng', hint: 'Học chắc', price: 599000 },
  { id: '12m', label: '1 năm', hint: 'Tiết kiệm nhất', price: 999000 },
  { id: 'lifetime', label: 'Trọn khóa', hint: 'Học đến khi thành thạo', price: 1500000 },
];

function formatVnd(n: number) {
  return `${Math.max(0, Number(n) || 0).toLocaleString('vi-VN')}đ`;
}

export function FreeMeetPlanModal({
  visible,
  onClose,
  onUnlocked,
}: {
  visible: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 620;
  const planColumns = width >= 720 ? 5 : width >= 540 ? 3 : 2;

  const [plans, setPlans] = useState<OfferPlan[]>(DEFAULT_OFFER_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>('3m');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState<CoursePaymentCheckout | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateSuccess, setActivateSuccess] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setActivateSuccess('');
    subscriptionApi
      .overview()
      .then((overview) => {
        if (cancelled) return;
        const serverPlans = overview?.plans || [];
        if (serverPlans.length > 0) {
          const map = new Map(serverPlans.map((p) => [p.id, p]));
          setPlans((prev) =>
            prev.map((item) => {
              const sp = map.get(item.id);
              return sp && Number(sp.price) > 0 ? { ...item, price: Number(sp.price) } : item;
            }),
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được gói học.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const activePlan = plans.find((p) => p.id === selectedPlan) || plans[1] || plans[0];

  const handleCheckout = async (planItem: OfferPlan = activePlan) => {
    if (!planItem || buying) return;
    setBuying(true);
    setError('');
    try {
      const session = await subscriptionApi.checkout(planItem.id);
      setCheckout({
        sessionId: session.sessionId,
        ref: session.ref,
        amount: session.amount ?? planItem.price,
        courseTitle: `Gói Meet ${session.planLabel || planItem.label}`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tạo được đơn thanh toán.');
    } finally {
      setBuying(false);
    }
  };

  const handleRedeem = async () => {
    const code = activationCode.trim();
    if (!code) {
      setError('Vui lòng nhập mã kích hoạt.');
      return;
    }
    setActivating(true);
    setError('');
    try {
      const res = await subscriptionApi.redeem(code);
      setActivateSuccess(`Kích hoạt thành công gói ${res.redeemedPlanLabel || res.planLabel || 'Meet'}!`);
      DeviceEventEmitter.emit('mobile:free-portal-unlocked');
      onUnlocked?.();
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mã kích hoạt không đúng hoặc đã hết hạn.');
    } finally {
      setActivating(false);
    }
  };

  if (!visible) return null;

  const planBasis = planColumns === 5 ? '18%' : planColumns === 3 ? '31%' : '47%';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, isWide && { padding: 20 }]}>
        <View
          style={[
            styles.dialog,
            styles.meetPlanDialog,
            {
              maxWidth: isWide ? 780 : 480,
              maxHeight: Math.min(Math.round(height * 0.92), 840),
            },
          ]}
        >
          {/* Header cố định gọn gàng */}
          <View style={[styles.meetPlanHeader, isWide && { paddingHorizontal: 22, paddingVertical: 15 }]}>
            <View style={styles.meetPlanHeaderLeft}>
              <View style={styles.meetPlanIconBox}>
                <Image source={GOOGLE_MEET_LOGO} style={styles.meetPlanIconImg} resizeMode="contain" />
              </View>
              <View style={styles.meetPlanHeaderTextWrap}>
                <View style={styles.meetPlanTitleRow}>
                  <Text style={[styles.meetPlanTitle, isWide && { fontSize: 17 }]} numberOfLines={2}>
                    Học tin học cùng giảng viên qua Google Meet
                  </Text>
                  <View style={styles.meetBrandPill}>
                    <Text style={styles.meetBrandPillText}>DewSkill</Text>
                  </View>
                </View>
                <Text style={styles.meetPlanSubtitle}>
                  Word · Excel · PowerPoint bài bản — Hướng dẫn thực hành từng bước
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.meetCloseCircleBtn, pressed && { opacity: 0.75 }]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Đóng popup"
            >
              <X size={16} color="#475569" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.meetPlanScroll}
            contentContainerStyle={[
              styles.meetPlanScrollContent,
              isWide && { paddingHorizontal: 22, paddingVertical: 18, gap: 16 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Khối giới thiệu lộ trình, lịch 3 ca học & quyền lợi (cân đối 2 cột trên màn rộng, xếp dọc trên mobile) */}
            <View style={[styles.meetInfoSection, isWide && styles.meetInfoSectionWide]}>
              <View style={[styles.meetOverviewCard, isWide && { flex: 1.15 }]}>
                <View style={styles.meetOverviewTop}>
                  <View style={styles.meetEyebrowPill}>
                    <Text style={styles.meetEyebrowText}>LỘ TRÌNH KÈM TRỰC TIẾP</Text>
                  </View>
                  <View style={styles.officeBadges}>
                    {OFFICE_APPS.map((app) => (
                      <View key={app.short} style={[styles.officeBadge, { backgroundColor: app.bg }]}>
                        <Text style={styles.officeBadgeText}>{app.short}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Text style={styles.meetOverviewHeading}>
                  Thực hành trực tiếp & hỏi đáp ngay trong ca học
                </Text>
                <Text style={styles.meetOverviewDesc}>
                  Phù hợp cho người mới bắt đầu, người mất gốc hoặc cần chuẩn hóa kỹ năng văn phòng bài bản.
                </Text>

                <View style={styles.slotDivider} />

                <View style={styles.slotGridRow}>
                  {MEET_SLOTS.map(({ key, label, time, Icon, iconColor }) => (
                    <View key={key} style={styles.slotPillCard}>
                      <View style={styles.slotPillTop}>
                        <Icon size={12} color={iconColor} />
                        <Text style={styles.slotPillLabel}>{label}</Text>
                      </View>
                      <Text style={styles.slotPillTime} numberOfLines={1}>
                        {time}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.meetBenefitsCard, isWide && { flex: 1 }]}>
                <View style={styles.meetBenefitsHeader}>
                  <Crown size={14} color="#059669" />
                  <Text style={styles.meetBenefitsHeaderText}>QUYỀN LỢI GÓI MEET</Text>
                </View>
                <View style={styles.meetBenefitsList}>
                  {MEET_BENEFITS.map((item) => (
                    <View key={item} style={styles.meetBenefitRow}>
                      <View style={styles.meetBenefitCheckCircle}>
                        <Check size={10} color="#FFFFFF" strokeWidth={3.2} />
                      </View>
                      <Text style={styles.meetBenefitText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Khối chọn gói học dạng lưới responsive (không bị cắt khuất thẻ) */}
            <View style={styles.plansSectionWrap}>
              <View style={styles.plansSectionHeader}>
                <Text style={styles.plansSectionHeading}>CHỌN GÓI HỌC PHÙ HỢP</Text>
                <Text style={styles.plansSectionHint}>Chạm vào gói để chọn</Text>
              </View>

              <View style={styles.plansGrid} accessibilityRole="radiogroup">
                {plans.map((p) => {
                  const isSelected = p.id === selectedPlan;
                  const sellable = Number(p.price) > 0;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setSelectedPlan(p.id);
                        if (error) setError('');
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${p.label}, ${sellable ? formatVnd(p.price) : 'Chỉ dùng mã'}`}
                      style={({ pressed }) => [
                        styles.planGridCard,
                        { flexBasis: planBasis, flexGrow: 1 },
                        isSelected && styles.planGridCardSelected,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      {p.featured ? (
                        <View style={styles.featuredBadge}>
                          <Text style={styles.featuredBadgeText}>★ Nên chọn</Text>
                        </View>
                      ) : null}

                      <View style={styles.planCardTopRow}>
                        <Text style={[styles.planNameText, isSelected && styles.planNameTextSelected]} numberOfLines={1}>
                          {p.label}
                        </Text>
                        <View style={[styles.planRadioDot, isSelected && styles.planRadioDotSelected]}>
                          {isSelected ? <Check size={10} color="#FFFFFF" strokeWidth={3} /> : null}
                        </View>
                      </View>

                      <View style={[styles.planHintPill, isSelected && styles.planHintPillSelected]}>
                        <Text style={[styles.planHintText, isSelected && styles.planHintTextSelected]} numberOfLines={1}>
                          {p.hint}
                        </Text>
                      </View>

                      <View style={[styles.planDivider, isSelected && styles.planDividerSelected]} />

                      <Text style={[styles.planPriceNew, isSelected && styles.planPriceNewSelected]}>
                        {sellable ? formatVnd(p.price) : 'Chỉ dùng mã'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Thông báo lỗi hoặc kích hoạt thành công */}
            {error ? (
              <View style={styles.meetErrorBox}>
                <Text style={styles.meetErrorText}>{error}</Text>
              </View>
            ) : null}

            {activateSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{activateSuccess}</Text>
              </View>
            ) : null}

            {/* Nút hành động chính */}
            <DuoButton
              variant="primary"
              size="lg"
              fullWidth
              loading={buying}
              disabled={!activePlan || buying || loading}
              icon={<Crown size={17} color="#FFFFFF" />}
              text={activePlan ? `ĐĂNG KÝ GÓI ${activePlan.label.toUpperCase()} (${formatVnd(activePlan.price)})` : 'ĐĂNG KÝ HỌC NGAY'}
              rightIcon={<ArrowRight size={17} color="#FFFFFF" />}
              onPress={() => void handleCheckout(activePlan)}
            />

            {/* Khối nhập mã kích hoạt gọn gàng bên dưới */}
            <View style={styles.activationBox}>
              <View style={styles.activationLabelRow}>
                <Ticket size={14} color="#059669" />
                <Text style={styles.activationTitle}>Đã có mã kích hoạt? Nhập mã trung tâm cấp (TTH-XXXX-XXXX)</Text>
              </View>
              <View style={styles.activationRow}>
                <View style={styles.activationInputWrap}>
                  <KeyRound size={15} color="#64748B" />
                  <TextInput
                    value={activationCode}
                    onChangeText={(val) => setActivationCode(formatActivationCodeInput(val))}
                    placeholder="TTH-XXXX-XXXX"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={13}
                    style={styles.activationInput}
                    accessibilityLabel="Mã kích hoạt"
                  />
                </View>
                <DuoButton
                  variant="primary"
                  size="md"
                  disabled={activating || activationCode.trim().length < 13}
                  loading={activating}
                  text="Kích hoạt"
                  onPress={() => void handleRedeem()}
                  style={{ minWidth: 102 }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      <CoursePaymentModal
        checkout={checkout}
        title="Đăng ký gói Meet"
        getSession={subscriptionApi.session}
        simulate={subscriptionApi.simulatePaid}
        onClose={() => setCheckout(null)}
        onPaid={() => {
          setCheckout(null);
          DeviceEventEmitter.emit('mobile:free-portal-unlocked');
          onUnlocked?.();
          onClose();
        }}
      />
    </Modal>
  );
}

export function FreeFeatureLockModal({
  visible,
  onClose,
  onUnlocked,
}: {
  visible: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
}) {
  const [meetModalOpen, setMeetModalOpen] = useState(false);

  useEffect(() => {
    if (!visible) setMeetModalOpen(false);
  }, [visible]);

  if (!visible) return null;

  if (meetModalOpen) {
    return (
      <FreeMeetPlanModal
        visible={visible}
        onClose={() => {
          setMeetModalOpen(false);
          onClose();
        }}
        onUnlocked={onUnlocked}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.lockHeader}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={styles.lockMascotWrap}>
              <Image source={MASCOT_STUDY} style={styles.lockMascot} resizeMode="contain" />
              <View style={styles.lockCornerBadge}>
                <Lock size={14} color="#0F172A" />
              </View>
            </View>
            <Text style={styles.lockTitle}>Mục này đang khóa</Text>
            <Text style={styles.lockSubtitle}>Đăng ký gói Meet để mở các mục đang khóa</Text>
          </View>

          <View style={styles.lockBody}>
            <View style={styles.lockedGrid}>
              {LOCKED_ITEMS.map(({ key, label, Icon }) => (
                <View key={key} style={styles.lockedItemRow}>
                  <View style={styles.lockedItemIcon}>
                    <Icon size={16} color={colors.brand} />
                  </View>
                  <Text style={styles.lockedItemLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => setMeetModalOpen(true)} style={styles.primaryCta}>
              <Sparkles size={16} color="#FFFFFF" />
              <Text style={styles.primaryCtaText}>Đăng ký gói Meet</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const SURVEY_SOURCES = [
  { id: 'google', label: 'Tìm kiếm Google', hint: 'Qua tìm kiếm trên mạng' },
  { id: 'tiktok', label: 'TikTok', hint: 'Qua video ngắn & chia sẻ mẹo hay' },
  { id: 'facebook', label: 'Facebook', hint: 'Qua fanpage, bài viết hoặc nhóm' },
  { id: 'referral', label: 'Bạn bè / Người thân', hint: 'Được người quen giới thiệu' },
  { id: 'other', label: 'Nguồn khác', hint: 'YouTube, hội thảo, diễn đàn...' },
];

const SURVEY_LEVELS = [
  { id: 'beginner', label: 'Mới bắt đầu từ con số 0', hint: 'Chưa quen thao tác máy tính, muốn học từng bước.' },
  { id: 'some', label: 'Đã biết cơ bản, muốn học cho vững', hint: 'Dùng được Word/Excel sơ sơ nhưng vẫn hay lúng túng.' },
  { id: 'advanced', label: 'Đã có nền tảng, muốn luyện nâng cao', hint: 'Muốn tăng tốc và chuẩn hóa kỹ năng văn phòng.' },
];

const SURVEY_FEARS = [
  { id: 'scam', label: 'Lo ngại về độ uy tín & chất lượng khóa học' },
  { id: 'no_guidance', label: 'Ngại đăng ký xong lại phải tự học một mình' },
  { id: 'not_understand', label: 'Sợ học online xem video xong không hiểu bài' },
  { id: 'no_support', label: 'Sợ gặp chỗ khó không có người giải đáp ngay' },
  { id: 'none', label: 'Mình rất hào hứng, chỉ muốn học thử ngay!' },
];

const FEAR_NOTES: Record<string, string> = {
  scam: 'An tâm nhé: bạn đang trải nghiệm học thử miễn phí hoàn toàn, chưa cần đóng bất kỳ khoản phí nào.',
  no_guidance: 'Phần luyện tập luôn mở sẵn. Khi đăng ký khóa chính thức, giảng viên sẽ đồng hành hướng dẫn sát sao.',
  not_understand: 'Mỗi video đều có điểm dừng tương tác, bài tập thực hành và gợi ý từng bước khi bạn làm chưa đúng.',
  no_support: 'Bạn luôn có Trợ lý AI hỗ trợ trong bài học, và có thể đăng ký lớp 1 kèm 1 bất cứ lúc nào cần.',
  none: 'Tuyệt vời! Chúc bạn có những giờ học thật hứng khởi — khi nào cần người kèm riêng, tụi mình luôn sẵn sàng.',
};

export function FreeSurveyModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState<'survey' | 'guide'>('survey');
  const [surveyStep, setSurveyStep] = useState(0);
  const [source, setSource] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [level, setLevel] = useState('');
  const [fear, setFear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleNext = () => {
    if (surveyStep === 0) {
      if (!source) {
        setError('Vui lòng chọn một kênh bạn biết đến chúng tôi nhé.');
        return;
      }
      if (source === 'other' && sourceNote.trim().length < 2) {
        setError('Bạn ghi giúp tụi mình nguồn bạn biết đến nhé (ví dụ: YouTube...).');
        return;
      }
    }
    if (surveyStep === 1 && !level) {
      setError('Hãy chọn mức độ hiện tại để hệ thống gợi ý bài học phù hợp.');
      return;
    }
    setError('');
    setSurveyStep((cur) => Math.min(2, cur + 1));
  };

  const handleSubmit = async () => {
    if (!source || !level || !fear) {
      setError('Bạn chọn giúp mình đầy đủ cả 3 bước nhé.');
      return;
    }
    if (source === 'other' && sourceNote.trim().length < 2) {
      setError('Bạn ghi giúp tụi mình nguồn bạn biết đến nhé.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await mobileApiRequest('/auth/free-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          sourceNote: sourceNote.trim(),
          level,
          fear,
        }),
      });
      await AsyncStorage.setItem('dewskill_survey_level', level).catch(() => {});
      if (Platform.OS === 'web') {
        try { globalThis.localStorage?.setItem('dewskill_survey_level', level); } catch { /* ignore */ }
      }
      setStep('guide');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể lưu thông tin. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        {step === 'guide' ? (
          <View style={styles.dialog}>
            <View style={styles.lockHeader}>
              <View style={styles.lockMascotWrap}>
                <Image source={MASCOT_STUDY} style={styles.lockMascot} resizeMode="contain" />
              </View>
              <Text style={styles.lockTitle}>Cách mở các mục đang khóa</Text>
              <Text style={styles.lockSubtitle}>Tài khoản miễn phí có sẵn Luyện tập</Text>
            </View>
            <View style={styles.lockBody}>
              <View style={styles.lockedGrid}>
                {LOCKED_ITEMS.map(({ key, label, Icon }) => (
                  <View key={key} style={styles.lockedItemRow}>
                    <View style={styles.lockedItemIcon}>
                      <Icon size={16} color={colors.brand} />
                    </View>
                    <Text style={styles.lockedItemLabel}>{label}</Text>
                    <Lock size={13} color="#94A3B8" style={{ marginLeft: 'auto' }} />
                  </View>
                ))}
              </View>
              <View style={styles.guideHintBox}>
                <Zap size={18} color="#D97706" />
                <Text style={styles.guideHintText}>
                  Mua gói XP bất kỳ trong phần <Text style={{ fontWeight: '800' }}>Luyện tập</Text> là mở ngay toàn bộ 4 mục trên.
                </Text>
              </View>
              <Pressable onPress={onDone} style={styles.primaryCta}>
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.primaryCtaText}>Đã hiểu, bắt đầu học</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.dialog, styles.meetDialog]}>
            <View style={styles.surveyHeader}>
              <View style={styles.surveyMascotBox}>
                <Image source={MASCOT_STUDY} style={styles.teacherAvatar} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meetTitle}>Cá nhân hóa lộ trình · Bước {surveyStep + 1}/3</Text>
                <Text style={styles.meetSubtitle}>Cùng DewSkill thiết kế lộ trình dành riêng cho bạn</Text>
              </View>
            </View>
            <ScrollView style={styles.meetBody} contentContainerStyle={styles.meetBodyContent}>
              {error ? (
                <View style={[styles.errorBox, { borderColor: '#FECDD3', backgroundColor: '#FFF1F2' }]}>
                  <Text style={[styles.errorText, { color: '#BE123C' }]}>{error}</Text>
                </View>
              ) : null}

              {surveyStep === 0 ? (
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Users size={14} color="#10B981" />
                    <Text style={styles.fieldLabel}>Cơ duyên nào đưa bạn đến với Thắng Tin Học?</Text>
                  </View>
                  <View style={styles.occGrid}>
                    {SURVEY_SOURCES.map((item) => {
                      const active = source === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => { setSource(item.id); setError(''); }}
                          style={[styles.occChip, active && styles.occChipActive, { width: '100%' }]}
                        >
                          <Text style={[styles.occChipText, active && styles.occChipTextActive]}>{item.label}</Text>
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{item.hint}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {source === 'other' ? (
                    <TextInput
                      value={sourceNote}
                      onChangeText={(t) => { setSourceNote(t); if (error) setError(''); }}
                      placeholder="Ví dụ: YouTube, nhóm học tập, hội thảo..."
                      placeholderTextColor="#94A3B8"
                      style={[styles.input, { marginTop: 8 }]}
                    />
                  ) : null}
                </View>
              ) : surveyStep === 1 ? (
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Layers size={14} color="#10B981" />
                    <Text style={styles.fieldLabel}>Hiện tại, kỹ năng Tin học của bạn đang ở mức nào?</Text>
                  </View>
                  <View style={styles.occGrid}>
                    {SURVEY_LEVELS.map((item) => {
                      const active = level === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => { setLevel(item.id); setError(''); }}
                          style={[styles.occChip, active && styles.occChipActive, { width: '100%' }]}
                        >
                          <Text style={[styles.occChipText, active && styles.occChipTextActive]}>{item.label}</Text>
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{item.hint}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <MessageCircleQuestion size={14} color="#10B981" />
                    <Text style={styles.fieldLabel}>Điều gì khiến bạn còn băn khoăn nhất khi học online?</Text>
                  </View>
                  <View style={styles.occGrid}>
                    {SURVEY_FEARS.map((item) => {
                      const active = fear === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => { setFear(item.id); setError(''); }}
                          style={[styles.occChip, active && styles.occChipActive, { width: '100%' }]}
                        >
                          <Text style={[styles.occChipText, active && styles.occChipTextActive]}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {fear && FEAR_NOTES[fear] ? (
                    <View style={[styles.errorBox, { marginTop: 8 }]}>
                      <Text style={styles.errorText}>{FEAR_NOTES[fear]}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                {surveyStep > 0 ? (
                  <Pressable
                    onPress={() => { setError(''); setSurveyStep((cur) => Math.max(0, cur - 1)); }}
                    style={[styles.occChip, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12 }]}
                  >
                    <ArrowLeft size={15} color="#475569" />
                    <Text style={styles.occChipText}>Quay lại</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => { if (surveyStep < 2) handleNext(); else void handleSubmit(); }}
                  disabled={saving}
                  style={[styles.primaryCta, { flex: 1 }, saving && styles.disabledBtn]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : surveyStep < 2 ? (
                    <ArrowRight size={16} color="#FFFFFF" />
                  ) : (
                    <Rocket size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.primaryCtaText}>
                    {saving ? 'Đang thiết lập...' : surveyStep < 2 ? 'Tiếp tục' : 'Bắt đầu học ngay'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  meetPlanDialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  meetPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#F2FCF7',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  meetPlanHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minWidth: 0,
  },
  meetPlanIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meetPlanIconImg: {
    width: 22,
    height: 22,
  },
  meetPlanHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  meetPlanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  meetPlanTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
    flexShrink: 1,
  },
  meetBrandPill: {
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  meetBrandPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  meetPlanSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 16,
  },
  meetCloseCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meetPlanScroll: {
    flexShrink: 1,
  },
  meetPlanScrollContent: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    gap: 14,
  },
  meetInfoSection: {
    flexDirection: 'column',
    gap: 10,
  },
  meetInfoSectionWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  meetOverviewCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 13,
    gap: 8,
    justifyContent: 'space-between',
  },
  meetOverviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meetEyebrowPill: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  meetEyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
  officeBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  officeBadge: {
    width: 21,
    height: 21,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  meetOverviewHeading: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 19,
  },
  meetOverviewDesc: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 16.5,
  },
  slotDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 2,
  },
  slotGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotPillCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 4,
    gap: 2,
  },
  slotPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotPillLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  slotPillTime: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    ...tabularNums,
  },
  meetBenefitsCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 18,
    padding: 13,
    gap: 10,
  },
  meetBenefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meetBenefitsHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.6,
  },
  meetBenefitsList: {
    gap: 7.5,
  },
  meetBenefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  meetBenefitCheckCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    marginTop: 1,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meetBenefitText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 16.5,
  },
  plansSectionWrap: {
    gap: 6,
  },
  plansSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  plansSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  plansSectionHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  plansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingTop: 10,
  },
  planGridCard: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 11,
    justifyContent: 'space-between',
    gap: 6,
  },
  planGridCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1.5,
  },
  featuredBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400E',
  },
  planCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  planNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  planNameTextSelected: {
    color: '#065F46',
  },
  planRadioDot: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planRadioDotSelected: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  planHintPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  planHintPillSelected: {
    backgroundColor: '#D1FAE5',
  },
  planHintText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  planHintTextSelected: {
    color: '#047857',
  },
  planDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 2,
  },
  planDividerSelected: {
    backgroundColor: '#A7F3D0',
  },
  planPriceNew: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0F172A',
    ...tabularNums,
  },
  planPriceNewSelected: {
    color: '#047857',
  },
  meetErrorBox: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  meetErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BE123C',
    textAlign: 'center',
  },
  activationBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 11,
    gap: 8,
  },
  activationLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activationTitle: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  activationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activationInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 42,
  },
  activationInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 6,
    letterSpacing: 0.8,
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  successText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  meetDialog: {
    maxWidth: 520,
    maxHeight: '90%',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  lockHeader: {
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
  },
  lockMascotWrap: {
    position: 'relative',
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockMascot: {
    width: 72,
    height: 72,
  },
  lockCornerBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  lockSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  lockBody: {
    padding: 20,
    gap: 14,
  },
  lockedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  lockedItemRow: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lockedItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedItemLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  meetHeader: {
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  meetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 28,
  },
  teacherAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatar: {
    width: 46,
    height: 46,
  },
  meetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  meetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#FDE68A',
  },
  meetBody: {
    maxHeight: 500,
  },
  meetBodyContent: {
    padding: 18,
    gap: 14,
  },
  benefitGrid: {
    gap: 10,
  },
  benefitAmberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 12,
  },
  benefitIconAmber: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitBlueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    padding: 12,
  },
  benefitIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  benefitSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  slotSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 10,
  },
  slotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotSectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.4,
  },
  slotGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  slotCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  slotTime: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  unlockStrip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 12,
    gap: 8,
  },
  unlockStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unlockStripTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#065F46',
  },
  unlockBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unlockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  unlockPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#064E3B',
  },
  planSection: {
    gap: 8,
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  planBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  planBadgeSelected: {
    backgroundColor: colors.brand,
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#334155',
    textTransform: 'uppercase',
  },
  planBadgeTextSelected: {
    color: '#FFFFFF',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#334155',
  },
  planCardLabelSelected: {
    color: colors.brandDark,
  },
  planRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  planPrice: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  planPerMonth: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  guideHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 12,
  },
  guideHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 18,
  },
  surveyHeader: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  surveyMascotBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  occGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  occChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  occChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  occChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  occChipTextActive: {
    color: colors.brandDark,
  },
});
