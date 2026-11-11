import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowRight,
  Award,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Crown,
  FolderOpen,
  Headphones,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Sparkles,
  Unlock,
  Video,
  X,
  Zap,
} from 'lucide-react-native';
import { CoursePaymentModal, type CoursePaymentCheckout } from './CoursePaymentModal';
import {
  formatActivationCodeInput,
  subscriptionApi,
  type SubscriptionOverview,
  type SubscriptionPlanId,
} from '../services/subscriptionApi';
import { mobileApiRequest, resolveMobilePublicUrl } from '../services/apiClient';
import type { DemoEnrollment, DemoUser } from '../types';
import { colors } from '../theme/tokens';
import { DuoButton } from './duo/DuoButton';

const DEWSKILL_LOGO = require('../../assets/logo.webp');
const TEACHER_AVATAR = require('../../assets/giang-vien-phi-van-thang.png');
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
  { key: 'morning', icon: '☀️', label: 'Sáng', time: '9h – 12h' },
  { key: 'afternoon', icon: '⛅', label: 'Chiều', time: '14h – 16h' },
  { key: 'evening', icon: '🌜', label: 'Tối', time: '19h – 21h' },
] as const;

const MEET_BENEFITS = [
  'Học trực tiếp cùng giảng viên',
  'Hỏi đáp ngay trong buổi học',
  'Không giới hạn số lần hỏi lại',
  'Có video xem lại sau buổi học',
  'Hỗ trợ đến khi làm được',
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, styles.newMeetDialog]}>
          {/* Nút Đóng góc trên bên phải */}
          <Pressable onPress={onClose} style={styles.meetPillCloseBtn} hitSlop={10} accessibilityLabel="Đóng popup">
            <Text style={styles.meetPillCloseText}>Đóng</Text>
          </Pressable>

          {/* Logo DewSkill ở đỉnh giữa */}
          <View style={styles.meetLogoHeader}>
            <Image source={DEWSKILL_LOGO} style={styles.meetBrandLogo} resizeMode="contain" />
          </View>

          <ScrollView
            style={styles.meetBody}
            contentContainerStyle={styles.meetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* KHỐI TRÊN: GIẢNG VIÊN + TIÊU ĐỀ + QUYỀN LỢI */}
            <View style={styles.topSectionCard}>
              {/* Thẻ Giảng viên */}
              <View style={styles.teacherIntroCard}>
                <View style={styles.teacherAvatarContainer}>
                  <Image source={TEACHER_AVATAR} style={styles.teacherAvatarImg} resizeMode="cover" />
                </View>
                <View style={styles.teacherNameBadge}>
                  <Text style={styles.teacherEyebrow}>GIẢNG VIÊN</Text>
                  <Text style={styles.teacherName}>Phí Văn Thắng</Text>
                </View>
                <Text style={styles.teacherDesc}>8 năm kinh nghiệm đào tạo tin học văn phòng.</Text>
              </View>

              {/* Thẻ Tiêu đề & Giới thiệu khóa học */}
              <View style={styles.courseIntroCard}>
                <View style={styles.courseTitleRow}>
                  <Text style={styles.courseMainTitle}>HỌC TIN HỌC CÙNG GIẢNG VIÊN QUA</Text>
                  <View style={styles.googleMeetBadge}>
                    <Image source={GOOGLE_MEET_LOGO} style={styles.googleMeetIcon} resizeMode="contain" />
                    <Text style={styles.googleMeetText}>Google Meet</Text>
                  </View>
                </View>

                <View style={styles.methodPill}>
                  <Text style={styles.methodPillText}>Học trực tiếp – dễ hiểu – được hướng dẫn từng bước</Text>
                </View>

                <Text style={styles.courseTargetDesc}>
                  Phù hợp cho người mới bắt đầu, người mất gốc, người cần học Word – Excel – PowerPoint bài bản.
                </Text>

                <View style={styles.officeAndMascotRow}>
                  <View style={styles.officeBadges}>
                    <View style={[styles.officeBadge, { backgroundColor: '#2563EB' }]}>
                      <Text style={styles.officeBadgeText}>W</Text>
                    </View>
                    <View style={[styles.officeBadge, { backgroundColor: '#16A34A' }]}>
                      <Text style={styles.officeBadgeText}>X</Text>
                    </View>
                    <View style={[styles.officeBadge, { backgroundColor: '#EA580C' }]}>
                      <Text style={styles.officeBadgeText}>P</Text>
                    </View>
                  </View>
                  <Image source={MASCOT_STUDY} style={styles.mascotStudyImg} resizeMode="contain" />
                </View>
              </View>

              {/* Thẻ Quyền lợi nổi bật (Xanh ngọc đậm) */}
              <View style={styles.benefitsCard}>
                <View style={styles.benefitsHeader}>
                  <Crown size={15} color="#FBBF24" />
                  <Text style={styles.benefitsHeaderText}>QUYỀN LỢI</Text>
                </View>
                <View style={styles.benefitsList}>
                  {MEET_BENEFITS.map((item) => (
                    <View key={item} style={styles.benefitRow}>
                      <View style={styles.benefitCheckCircle}>
                        <Check size={10} color="#064E3B" strokeWidth={3.5} />
                      </View>
                      <Text style={styles.benefitText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* KHỐI 3 CA HỌC */}
            <View style={styles.slotGridRow}>
              {MEET_SLOTS.map((slot) => (
                <View key={slot.key} style={styles.slotPillCard}>
                  <Text style={styles.slotEmoji}>{slot.icon}</Text>
                  <Text style={styles.slotPillText}>
                    {slot.label} <Text style={styles.slotPillTime}>{slot.time}</Text>
                  </Text>
                </View>
              ))}
            </View>

            {/* KHỐI 5 GÓI HỌC (VUỐT NGANG) */}
            <View style={styles.plansSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.plansScrollList}
              >
                {plans.map((p) => {
                  const isSelected = p.id === selectedPlan;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedPlan(p.id)}
                      style={[styles.planCardNew, isSelected && styles.planCardNewSelected]}
                    >
                      {p.featured ? (
                        <View style={styles.featuredBadge}>
                          <Text style={styles.featuredBadgeText}>⭐ Nên chọn</Text>
                        </View>
                      ) : null}

                      <View style={styles.planMeetRow}>
                        <Image source={GOOGLE_MEET_LOGO} style={styles.planMeetIconMini} resizeMode="contain" />
                        <Text style={styles.planMeetTextMini}>Học qua Meet</Text>
                      </View>

                      <View style={styles.planNameRow}>
                        <Calendar size={13} color="#334155" />
                        <Text style={styles.planNameText}>{p.label}</Text>
                      </View>

                      <View style={[styles.planHintPill, isSelected && styles.planHintPillSelected]}>
                        <Text style={[styles.planHintText, isSelected && styles.planHintTextSelected]}>
                          {p.hint}
                        </Text>
                      </View>

                      <View style={styles.planDivider} />

                      <View style={styles.planTeacherSubRow}>
                        <Text style={styles.planTeacherSubEmoji}>👥</Text>
                        <Text style={styles.planTeacherSubText}>Đăng ký học cùng giảng viên</Text>
                      </View>

                      <Text style={[styles.planPriceNew, isSelected && styles.planPriceNewSelected]}>
                        {formatVnd(p.price)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* KHỐI NHẬP MÃ KÍCH HOẠT */}
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
                />
              </View>
              <DuoButton
                variant="primary"
                size="md"
                disabled={activating || !activationCode.trim()}
                loading={activating}
                text="Kích hoạt"
                onPress={() => void handleRedeem()}
                style={{ minWidth: 100 }}
              />
            </View>

            {/* THÔNG BÁO LỖI HOẶC THÀNH CÔNG */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {activateSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{activateSuccess}</Text>
              </View>
            ) : null}

            {/* NÚT ĐĂNG KÝ HỌC NGAY DUY NHẤT (CHUẨN 3D DUOLINGO) */}
            <DuoButton
              variant="primary"
              size="lg"
              fullWidth
              loading={buying}
              disabled={!activePlan || buying || loading}
              icon={<Crown size={18} color="#FFFFFF" />}
              text={activePlan ? `ĐĂNG KÝ HỌC NGAY (${formatVnd(activePlan.price)})` : 'ĐĂNG KÝ HỌC NGAY'}
              rightIcon={<ArrowRight size={18} color="#FFFFFF" />}
              onPress={() => void handleCheckout(activePlan)}
              style={{ marginTop: 10 }}
            />
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
  const mascotUri = resolveMobilePublicUrl('/linh-vat-2.png');

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
              {mascotUri ? (
                <Image source={{ uri: mascotUri }} style={styles.lockMascot} resizeMode="contain" />
              ) : (
                <Lock size={34} color="#FBBF24" />
              )}
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

const OCCUPATIONS = [
  'Học sinh / Sinh viên',
  'Nhân viên văn phòng',
  'Giáo viên / Đào tạo',
  'Kinh doanh tự do',
  'Đang tìm việc',
  'Khác',
];

export function FreeSurveyModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState<'survey' | 'guide'>('survey');
  const [fromWhere, setFromWhere] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [occupation, setOccupation] = useState('');
  const [customOccupation, setCustomOccupation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mascotUri = resolveMobilePublicUrl('/linh-vat-2.png');

  const finalOccupation = occupation === 'Khác' ? customOccupation.trim() : occupation.trim();

  const handleSubmit = async () => {
    setError('');
    const place = fromWhere.trim();
    const year = Number(birthYear);
    const maxYear = new Date().getFullYear() - 4;
    if (place.length < 2) {
      setError('Vui lòng nhập tỉnh/thành phố bạn đang ở.');
      return;
    }
    if (!Number.isInteger(year) || year < 1940 || year > maxYear) {
      setError(`Vui lòng nhập năm sinh hợp lệ (1940 - ${maxYear}).`);
      return;
    }
    if (finalOccupation.length < 2) {
      setError('Vui lòng chọn hoặc nhập nghề nghiệp hiện tại.');
      return;
    }
    setSaving(true);
    try {
      await mobileApiRequest('/auth/free-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWhere: place,
          birthYear: year,
          occupation: finalOccupation,
        }),
      });
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
                {mascotUri ? (
                  <Image source={{ uri: mascotUri }} style={styles.lockMascot} resizeMode="contain" />
                ) : (
                  <Sparkles size={34} color="#FBBF24" />
                )}
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
                {mascotUri ? (
                  <Image source={{ uri: mascotUri }} style={styles.teacherAvatar} resizeMode="contain" />
                ) : (
                  <Sparkles size={24} color="#FBBF24" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meetTitle}>Chào mừng bạn!</Text>
                <Text style={styles.meetSubtitle}>Trả lời 3 câu ngắn để mở bài học và luyện tập</Text>
              </View>
            </View>
            <ScrollView style={styles.meetBody} contentContainerStyle={styles.meetBodyContent}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <MapPin size={14} color="#EF4444" />
                  <Text style={styles.fieldLabel}>Bạn đến từ đâu?</Text>
                </View>
                <TextInput
                  value={fromWhere}
                  onChangeText={setFromWhere}
                  placeholder="Ví dụ: TP. Hồ Chí Minh, Hà Nội, Đà Nẵng..."
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Calendar size={14} color="#EF4444" />
                  <Text style={styles.fieldLabel}>Năm sinh</Text>
                </View>
                <TextInput
                  value={birthYear}
                  onChangeText={setBirthYear}
                  placeholder="Ví dụ: 2002"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Briefcase size={14} color="#EF4444" />
                  <Text style={styles.fieldLabel}>Nghề nghiệp</Text>
                </View>
                <View style={styles.occGrid}>
                  {OCCUPATIONS.map((item) => {
                    const active = occupation === item;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => setOccupation(item)}
                        style={[styles.occChip, active && styles.occChipActive]}
                      >
                        <Text style={[styles.occChipText, active && styles.occChipTextActive]}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {occupation === 'Khác' ? (
                  <TextInput
                    value={customOccupation}
                    onChangeText={setCustomOccupation}
                    placeholder="Nhập nghề nghiệp của bạn..."
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, { marginTop: 8 }]}
                  />
                ) : null}
              </View>

              <Pressable
                onPress={() => void handleSubmit()}
                disabled={saving}
                style={[styles.primaryCta, saving && styles.disabledBtn]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Sparkles size={16} color="#FFFFFF" />
                )}
                <Text style={styles.primaryCtaText}>{saving ? 'Đang lưu...' : 'Bắt đầu học miễn phí'}</Text>
              </Pressable>
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
  newMeetDialog: {
    maxWidth: 620,
    maxHeight: '94%',
    backgroundColor: '#F2FCF6',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 26,
    position: 'relative',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  meetPillCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  meetPillCloseText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
  },
  meetLogoHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 6,
  },
  meetBrandLogo: {
    width: 125,
    height: 30,
  },
  meetScrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 12,
  },
  topSectionCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
  },
  teacherIntroCard: {
    flexBasis: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: '#10B981',
    overflow: 'hidden',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 6,
  },
  teacherAvatarImg: {
    width: '100%',
    height: '100%',
  },
  teacherNameBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  teacherEyebrow: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.6,
  },
  teacherName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  teacherDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
  courseIntroCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  courseTitleRow: {
    alignItems: 'center',
    gap: 4,
  },
  courseMainTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  googleMeetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleMeetIcon: {
    width: 14,
    height: 14,
  },
  googleMeetText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E293B',
  },
  methodPill: {
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  methodPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#065F46',
    textAlign: 'center',
  },
  courseTargetDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 15,
  },
  officeAndMascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 2,
  },
  officeBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  officeBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  mascotStudyImg: {
    width: 38,
    height: 38,
  },
  benefitsCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#047857',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderRadius: 18,
    padding: 12,
    justifyContent: 'space-between',
    gap: 8,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingBottom: 6,
  },
  benefitsHeaderText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  benefitsList: {
    gap: 6,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitCheckCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  slotGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotPillCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  slotEmoji: {
    fontSize: 12,
  },
  slotPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  slotPillTime: {
    color: '#059669',
    fontWeight: '900',
  },
  plansSection: {
    marginVertical: 4,
  },
  plansScrollList: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  planCardNew: {
    width: 130,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planCardNewSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    shadowColor: '#059669',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredBadge: {
    position: 'absolute',
    top: -9,
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  featuredBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  planMeetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  planMeetIconMini: {
    width: 11,
    height: 11,
  },
  planMeetTextMini: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  planNameText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  planHintPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 3,
  },
  planHintPillSelected: {
    backgroundColor: '#D1FAE5',
  },
  planHintText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  planHintTextSelected: {
    color: '#047857',
  },
  planDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  planTeacherSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  planTeacherSubEmoji: {
    fontSize: 9,
  },
  planTeacherSubText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  planPriceNew: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
  planPriceNewSelected: {
    color: '#047857',
  },
  activationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 6,
    paddingLeft: 10,
  },
  activationInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activationInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 4,
  },
  activationBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activationBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
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
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryCtaNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#059669',
    paddingVertical: 13,
    paddingHorizontal: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 4,
  },
  primaryCtaNewEmoji: {
    fontSize: 16,
  },
  primaryCtaNewText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
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
    backgroundColor: '#FEF2F2',
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
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
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
