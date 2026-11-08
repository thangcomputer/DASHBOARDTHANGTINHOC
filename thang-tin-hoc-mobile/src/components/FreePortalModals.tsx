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
  Award,
  Briefcase,
  Calendar,
  Check,
  Clock,
  FolderOpen,
  Headphones,
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
import { subscriptionApi, type SubscriptionOverview, type SubscriptionPlan, type SubscriptionPlanId } from '../services/subscriptionApi';
import { mobileApiRequest, resolveMobilePublicUrl } from '../services/apiClient';
import type { DemoEnrollment, DemoUser } from '../types';

export const FREE_PORTAL_COURSE_NAME = 'Tài khoản miễn phí';

export function hasRealCourseEnrollment(
  user?: DemoUser | null,
  enrollmentsOverride?: DemoEnrollment[] | null,
): boolean {
  const list = enrollmentsOverride ?? user?.enrollments;
  if (!Array.isArray(list)) return false;
  return list.some((enrollment) => {
    const label = String(enrollment?.courseName || '').trim().toLocaleLowerCase('vi');
    if (!label || label === FREE_PORTAL_COURSE_NAME.toLocaleLowerCase('vi')) return false;
    return enrollment.status === 'Đang học';
  });
}

export function isFreePortalMenu(
  user?: DemoUser | null,
  enrollmentsOverride?: DemoEnrollment[] | null,
): boolean {
  if (!user || user.role !== 'student') return false;
  if (hasRealCourseEnrollment(user, enrollmentsOverride)) return false;
  return (
    user.freePortal === true
    || String(user.course || '').trim().toLocaleLowerCase('vi') === FREE_PORTAL_COURSE_NAME.toLocaleLowerCase('vi')
  );
}

export function isFreePortalLocked(
  user?: DemoUser | null,
  enrollmentsOverride?: DemoEnrollment[] | null,
): boolean {
  return isFreePortalMenu(user, enrollmentsOverride) && user?.freeUnlocked !== true;
}

const LOCKED_ITEMS = [
  { key: 'support', label: 'Hỗ trợ', Icon: Headphones },
  { key: 'inbox', label: 'Tin nhắn', Icon: MessageCircle },
  { key: 'exam', label: 'Phòng thi', Icon: Award },
  { key: 'materials-files', label: 'Bài tập', Icon: FolderOpen },
] as const;

const MEET_SLOTS = [
  { key: 'morning', label: 'Sáng', time: '9h – 12h' },
  { key: 'afternoon', label: 'Chiều', time: '14h – 16h' },
  { key: 'evening', label: 'Tối', time: '19h – 21h' },
] as const;

const PLAN_HIGHLIGHTS: Record<string, { badge?: string }> = {
  '1m': {},
  '3m': { badge: 'Tiết kiệm' },
  '6m': { badge: 'Phổ biến' },
  '12m': { badge: 'Tốt nhất' },
  lifetime: { badge: 'Trọn đời' },
};

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
  const [data, setData] = useState<SubscriptionOverview | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>('3m');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState<CoursePaymentCheckout | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    subscriptionApi
      .overview()
      .then((overview) => {
        if (cancelled) return;
        setData(overview);
        const plans = overview.plans || [];
        if (plans.some((p) => p.id === '3m')) setSelectedPlan('3m');
        else if (plans[0]?.id) setSelectedPlan(plans[0].id);
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

  const plans: SubscriptionPlan[] = (data?.plans || []).filter((p) => Number(p.price) > 0);
  const activePlan = plans.find((p) => p.id === selectedPlan) || plans[0] || null;
  const teacherAvatarUri = resolveMobilePublicUrl('/linh-vat-2.png');

  const handleCheckout = async (planItem: SubscriptionPlan | null = activePlan) => {
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

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, styles.meetDialog]}>
          <View style={styles.meetHeader}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={styles.meetHeaderRow}>
              <View style={styles.teacherAvatarWrap}>
                {teacherAvatarUri ? (
                  <Image source={{ uri: teacherAvatarUri }} style={styles.teacherAvatar} resizeMode="contain" />
                ) : (
                  <Video size={26} color="#FBBF24" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meetTitle}>Học trực tiếp cùng thầy Phí Văn Thắng</Text>
                <Text style={styles.meetSubtitle}>300 XP mỗi ngày · Google Meet</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.meetBody} contentContainerStyle={styles.meetBodyContent}>
            <View style={styles.benefitGrid}>
              <View style={styles.benefitAmberCard}>
                <View style={styles.benefitIconAmber}>
                  <Zap size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>300 XP mỗi ngày</Text>
                  <Text style={styles.benefitSub}>Luyện tập và học bài thoải mái</Text>
                </View>
              </View>
              <View style={styles.benefitBlueCard}>
                <View style={styles.benefitIconBlue}>
                  <Video size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>Lớp Google Meet</Text>
                  <Text style={styles.benefitSub}>Tương tác trực tiếp với giảng viên</Text>
                </View>
              </View>
            </View>

            <View style={styles.slotSection}>
              <View style={styles.slotTitleRow}>
                <Clock size={14} color="#DC2626" />
                <Text style={styles.slotSectionLabel}>CHỌN 1 TRONG 3 CA HỌC MỖI NGÀY</Text>
              </View>
              <View style={styles.slotGrid}>
                {MEET_SLOTS.map((slot) => (
                  <View key={slot.key} style={styles.slotCard}>
                    <Text style={styles.slotLabel}>{slot.label.toUpperCase()}</Text>
                    <Text style={styles.slotTime}>{slot.time}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.unlockStrip}>
              <View style={styles.unlockStripHeader}>
                <Unlock size={14} color="#059669" />
                <Text style={styles.unlockStripTitle}>Mở toàn bộ mục đang khóa</Text>
              </View>
              <View style={styles.unlockBadgeWrap}>
                {LOCKED_ITEMS.map(({ key, label, Icon }) => (
                  <View key={key} style={styles.unlockPill}>
                    <Icon size={13} color="#059669" />
                    <Text style={styles.unlockPillText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.planSection}>
              <Text style={styles.slotSectionLabel}>CHỌN THỜI HẠN GÓI</Text>
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#DC2626" />
                </View>
              ) : (
                <View style={styles.planGrid}>
                  {plans.map((p) => {
                    const selected = p.id === selectedPlan;
                    const badge = PLAN_HIGHLIGHTS[p.id]?.badge;
                    const perMonth = p.months && p.months > 1 ? Math.round(p.price / p.months) : null;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setSelectedPlan(p.id)}
                        style={[styles.planCard, selected && styles.planCardSelected]}
                      >
                        {badge ? (
                          <View style={[styles.planBadge, selected && styles.planBadgeSelected]}>
                            <Text style={[styles.planBadgeText, selected && styles.planBadgeTextSelected]}>
                              {badge}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.planCardHeader}>
                          <Text style={[styles.planCardLabel, selected && styles.planCardLabelSelected]}>
                            {p.label}
                          </Text>
                          <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
                            {selected ? <Check size={12} color="#FFFFFF" /> : null}
                          </View>
                        </View>
                        <Text style={styles.planPrice}>{formatVnd(p.price)}</Text>
                        <Text style={styles.planPerMonth}>
                          {perMonth ? `~${formatVnd(perMonth)}/tháng` : p.id === 'lifetime' ? 'Không giới hạn' : '30 ngày'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => void handleCheckout(activePlan)}
              disabled={!activePlan || buying || loading}
              style={[styles.primaryCta, (!activePlan || buying || loading) && styles.disabledBtn]}
            >
              {buying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Sparkles size={16} color="#FFFFFF" />
              )}
              <Text style={styles.primaryCtaText}>
                {activePlan ? `Chọn gói học · ${formatVnd(activePlan.price)}` : 'Chọn gói học'}
              </Text>
            </Pressable>
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
                    <Icon size={16} color="#DC2626" />
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
              <Text style={styles.lockSubtitle}>Tài khoản miễn phí có sẵn Bài giảng và Luyện tập</Text>
            </View>
            <View style={styles.lockBody}>
              <View style={styles.lockedGrid}>
                {LOCKED_ITEMS.map(({ key, label, Icon }) => (
                  <View key={key} style={styles.lockedItemRow}>
                    <View style={styles.lockedItemIcon}>
                      <Icon size={16} color="#DC2626" />
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
    backgroundColor: '#DC2626',
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
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
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
    backgroundColor: '#DC2626',
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
    color: '#B91C1C',
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
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
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
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  occChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  occChipTextActive: {
    color: '#B91C1C',
  },
});
