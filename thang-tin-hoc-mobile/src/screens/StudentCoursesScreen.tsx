import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Gamepad2,
  Lock,
  RefreshCw,
  Search,
  Trophy,
  X,
} from 'lucide-react-native';
import { AppHeader, AppScreen, Card } from '../components/ui';
import { mobileApiRequest } from '../services/apiClient';
import { colors, radius, spacing } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type LinkedTopic = {
  _id: string;
  name: string;
  icon?: string;
  color?: string;
};

type LinkedCertCourse = {
  _id: string;
  name: string;
  slug?: string;
};

type DewskillClassItem = {
  _id: string;
  name: string;
  code?: string;
  tier: string;
  grade?: number | null;
  track?: string;
  curriculumSource?: string;
  badge?: string;
  shortDescription?: string;
  description?: string;
  accentColor?: string;
  price?: number;
  originalPrice?: number;
  allowTrial?: boolean;
  allowRegistration?: boolean;
  freePreviewTopics?: number;
  accessLevel?: 'full' | 'preview';
  accessExpiresAt?: string | null;
  dailyPracticeTopicIds?: LinkedTopic[];
  certPrepCourseIds?: LinkedCertCourse[];
};

type CheckoutSessionState = {
  sessionId: string;
  ref: string;
  amount: number;
  classId: string;
  courseName: string;
  status: 'pending' | 'paid' | 'expired' | 'not_found';
  paid: boolean;
  unlockedByAdmin?: boolean;
  qrUrl?: string | null;
  bankInfo?: {
    bankCode?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
};

type TierOption = {
  id: string;
  label: string;
  shortLabel: string;
};

const TIER_META: Record<string, { label: string; shortLabel: string; tagline: string; accent: string }> = {
  'cap-1': {
    label: 'Tin học Cấp 1 (Lớp 1–5)',
    shortLabel: 'Cấp 1',
    tagline: 'Làm quen máy tính, gõ phím & lập trình kéo thả chuẩn SGK Kết nối tri thức.',
    accent: '#0EA5E9',
  },
  'cap-2': {
    label: 'Tin học Cấp 2 (Lớp 6–9)',
    shortLabel: 'Cấp 2',
    tagline: 'Internet, Word, Excel, PowerPoint & thuật toán theo chương trình Kết nối tri thức.',
    accent: '#10B981',
  },
  'cap-3': {
    label: 'Tin học Cấp 3 (Lớp 10–12)',
    shortLabel: 'Cấp 3',
    tagline: 'Định hướng ICT & Khoa học máy tính (CS), Python, CSDL & ôn thi THPT.',
    accent: '#8B5CF6',
  },
  mos: {
    label: 'Học & Luyện thi MOS',
    shortLabel: 'MOS',
    tagline: '3 chặng Học – Luyện – Thi thử 50 phút chuẩn thang 1000 Certiport / IIG.',
    accent: '#F59E0B',
  },
  'hs-sv': {
    label: 'Tin học cho HS – Sinh viên',
    shortLabel: 'HS – SV',
    tagline: 'Báo cáo tiểu luận, bảng tính số liệu & chuẩn đầu ra CNTT.',
    accent: '#4F46E5',
  },
  'nguoi-di-lam': {
    label: 'Tin học cho Người đi làm',
    shortLabel: 'Người đi làm',
    tagline: 'Excel thực chiến Kế toán – Nhân sự & kỹ năng văn phòng chuyên nghiệp.',
    accent: '#0D9488',
  },
  'chung-chi': {
    label: 'Chứng chỉ khác (IC3 / TT03 / THPT)',
    shortLabel: 'Chứng chỉ',
    tagline: 'Luyện thi IC3, Ứng dụng CNTT Thông tư 03 và Tốt nghiệp THPT môn Tin.',
    accent: '#F43F5E',
  },
};

export function StudentCoursesScreen() {
  const navigation = useNavigation<Navigation>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<DewskillClassItem[]>([]);
  const [tierOptions, setTierOptions] = useState<TierOption[]>([]);
  const [activeTier, setActiveTier] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<DewskillClassItem | null>(null);
  const [registeringId, setRegisteringId] = useState('');
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSessionState | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const checkoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mobileApiRequest<{
        success: boolean;
        data?: DewskillClassItem[];
        meta?: { tiers?: TierOption[] };
      }>('/dewskill-classes/my-visible');
      setItems(Array.isArray(res.data) ? res.data : []);
      setTierOptions(Array.isArray(res.meta?.tiers) ? res.meta.tiers : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh mục khóa học.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const refreshCheckoutSession = useCallback(async (sessionId: string, manual = false) => {
    if (!sessionId) return;
    if (manual) setCheckingPayment(true);
    try {
      const res = await mobileApiRequest<{
        success: boolean;
        data?: CheckoutSessionState;
      }>(`/dewskill-classes/my/payment-sessions/${encodeURIComponent(sessionId)}`);
      const next = res?.data;
      if (next) {
        setCheckoutSession(next);
        if (next.paid || next.status === 'paid') {
          void loadClasses();
        }
      }
    } catch (err) {
      if (manual) {
        Alert.alert('Thông báo', err instanceof Error ? err.message : 'Không kiểm tra được trạng thái thanh toán');
      }
    } finally {
      if (manual) setCheckingPayment(false);
    }
  }, [loadClasses]);

  useEffect(() => {
    if (!checkoutSession?.sessionId || checkoutSession.paid || checkoutSession.status === 'paid' || checkoutSession.status === 'expired') {
      if (checkoutTimerRef.current) {
        clearInterval(checkoutTimerRef.current);
        checkoutTimerRef.current = null;
      }
      return undefined;
    }
    const sid = checkoutSession.sessionId;
    checkoutTimerRef.current = setInterval(() => {
      void refreshCheckoutSession(sid, false);
    }, 3000);
    return () => {
      if (checkoutTimerRef.current) {
        clearInterval(checkoutTimerRef.current);
        checkoutTimerRef.current = null;
      }
    };
  }, [checkoutSession?.sessionId, checkoutSession?.paid, checkoutSession?.status, refreshCheckoutSession]);

  const handleRegisterClass = useCallback(async (cls: DewskillClassItem) => {
    if (!cls?._id || registeringId) return;
    setRegisteringId(cls._id);
    try {
      const res = await mobileApiRequest<{
        success: boolean;
        data?: {
          owned?: boolean;
          sessionId?: string;
          ref?: string;
          amount?: number;
          classId?: string;
          courseTitle?: string;
          qrUrl?: string | null;
          bankInfo?: CheckoutSessionState['bankInfo'];
        };
      }>('/dewskill-classes/my/checkout', {
        method: 'POST',
        body: JSON.stringify({ classId: cls._id }),
      });
      const data = res?.data;
      if (data?.owned) {
        setSelectedClass(null);
        await loadClasses();
        Alert.alert('Đã mở khóa', 'Lớp học này đã được mở toàn bộ cho tài khoản của bạn.');
        return;
      }
      if (data?.sessionId) {
        setSelectedClass(null);
        setCheckoutSession({
          sessionId: data.sessionId,
          ref: data.ref || '',
          amount: Number(data.amount) || 0,
          classId: data.classId || cls._id,
          courseName: data.courseTitle || cls.name,
          status: 'pending',
          paid: false,
          qrUrl: data.qrUrl || null,
          bankInfo: data.bankInfo || {},
        });
      }
    } catch (err) {
      Alert.alert('Không thể đăng ký', err instanceof Error ? err.message : 'Vui lòng thử lại sau.');
    } finally {
      setRegisteringId('');
    }
  }, [registeringId, loadClasses]);

  const orderedTiers = useMemo(() => {
    if (tierOptions.length > 0) return tierOptions;
    return Object.entries(TIER_META).map(([id, meta]) => ({
      id,
      label: meta.label,
      shortLabel: meta.shortLabel,
    }));
  }, [tierOptions]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((cls) => {
      if (activeTier !== 'all' && cls.tier !== activeTier) return false;
      if (q) {
        const hay = [cls.name, cls.code, cls.badge, cls.shortDescription]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, activeTier, searchQuery]);

  const activeTierMeta = activeTier !== 'all' ? TIER_META[activeTier] : null;

  return (
    <AppScreen>
      <AppHeader
        title="Danh mục khóa học"
        subtitle="Phân theo cấp độ & lộ trình DewSkill"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Thanh phân cấp độ ngang */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tierScroll}
        >
          <TouchableOpacity
            onPress={() => setActiveTier('all')}
            style={[styles.tierTab, activeTier === 'all' && styles.tierTabActive]}
          >
            <Text style={[styles.tierTabText, activeTier === 'all' && styles.tierTabTextActive]}>
              Tất cả
            </Text>
          </TouchableOpacity>

          {orderedTiers.map((t) => {
            const active = activeTier === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveTier(t.id)}
                style={[styles.tierTab, active && styles.tierTabActive]}
              >
                <Text style={[styles.tierTabText, active && styles.tierTabTextActive]}>
                  {t.shortLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Ô tìm kiếm */}
        <View style={styles.searchWrap}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm lớp học hoặc môn học..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        {/* Dải mô tả cấp độ đang chọn */}
        {activeTierMeta ? (
          <View style={styles.tierBanner}>
            <Text style={styles.tierBannerTitle}>{activeTierMeta.label}</Text>
            <Text style={styles.tierBannerDesc}>{activeTierMeta.tagline}</Text>
          </View>
        ) : null}

        {/* Danh sách lớp học */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.mutedText}>Đang tải danh mục khóa học...</Text>
          </View>
        ) : error ? (
          <Card>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadClasses} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Chưa có lớp học nào được mở</Text>
            <Text style={styles.emptyDesc}>
              Admin sẽ cấp quyền hiển thị lớp học phù hợp cho tài khoản của bạn. Trong lúc chờ, bạn có thể vào khu Luyện tập chung.
            </Text>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Không tìm thấy lớp học phù hợp</Text>
            <TouchableOpacity
              onPress={() => {
                setActiveTier('all');
                setSearchQuery('');
              }}
            >
              <Text style={styles.resetLink}>Xem tất cả lớp đang mở</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <View style={styles.listWrap}>
            {filteredItems.map((cls) => {
              const meta = TIER_META[cls.tier] || TIER_META['cap-2'];
              const topicCount = (cls.dailyPracticeTopicIds || []).length;
              const certCount = (cls.certPrepCourseIds || []).length;
              const isFull = cls.accessLevel === 'full';
              const allowTrial = cls.allowTrial !== false;
              const allowReg = cls.allowRegistration !== false;
              const priceNum = Math.round(Number(cls.price) || 0);
              const origPriceNum = Math.round(Number(cls.originalPrice) || 0);
              const isRegistering = registeringId === cls._id;
              return (
                <TouchableOpacity
                  key={cls._id}
                  activeOpacity={0.9}
                  onPress={() => setSelectedClass(cls)}
                  style={styles.classCard}
                >
                  <View style={[styles.topAccent, { backgroundColor: meta.accent }]} />
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeRow}>
                      <View style={styles.tierPill}>
                        <Text style={styles.tierPillText}>{meta.shortLabel}</Text>
                      </View>
                      {cls.badge ? (
                        <View style={styles.subPill}>
                          <Text style={styles.subPillText}>{cls.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.accessPill, isFull ? styles.accessFull : styles.accessPreview]}>
                      <Text style={[styles.accessText, isFull ? styles.accessTextFull : styles.accessTextPreview]}>
                        {isFull ? 'Đã mở khóa' : 'Học thử'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.classTitle}>{cls.name}</Text>
                  <Text style={styles.classDesc} numberOfLines={2}>
                    {cls.shortDescription || meta.tagline}
                  </Text>

                  <View style={styles.metaChips}>
                    <View style={styles.metaChip}>
                      <BookOpen size={12} color="#059669" />
                      <Text style={styles.metaChipText}>
                        {topicCount > 0 ? `${topicCount} chủ đề` : 'Lộ trình'}
                      </Text>
                    </View>
                    {certCount > 0 ? (
                      <View style={styles.metaChip}>
                        <Trophy size={12} color="#D97706" />
                        <Text style={styles.metaChipText}>{certCount} phòng thi</Text>
                      </View>
                    ) : null}
                  </View>

                  {!isFull ? (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceText}>
                        {priceNum > 0 ? `${priceNum.toLocaleString('vi-VN')}đ` : 'Đăng ký mở toàn bộ lớp'}
                      </Text>
                      {priceNum > 0 && origPriceNum > priceNum ? (
                        <Text style={styles.originalPriceText}>{origPriceNum.toLocaleString('vi-VN')}đ</Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.cardActionsRow}>
                    {isFull ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setSelectedClass(cls)}
                        style={[styles.enterChip, { flex: 1, justifyContent: 'center', paddingVertical: 9 }]}
                      >
                        <Text style={styles.enterChipText}>Vào lớp học</Text>
                        <ChevronRight size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : (
                      <>
                        {allowTrial ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setSelectedClass(cls)}
                            style={styles.trialBtn}
                          >
                            <Text style={styles.trialBtnText}>Học thử</Text>
                          </TouchableOpacity>
                        ) : null}
                        {allowReg ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={isRegistering}
                            onPress={() => void handleRegisterClass(cls)}
                            style={styles.registerBtn}
                          >
                            {isRegistering ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <CreditCard size={13} color="#FFFFFF" />
                                <Text style={styles.enterChipText}>Đăng ký</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : null}
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal chi tiết lớp học */}
      <Modal
        visible={Boolean(selectedClass)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedClass(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedClass(null)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            {selectedClass ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTierLabel}>
                      {(TIER_META[selectedClass.tier] || TIER_META['cap-2']).label}
                    </Text>
                    <Text style={styles.modalTitle}>{selectedClass.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedClass(null)} style={styles.closeBtn}>
                    <X size={18} color="#475569" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {selectedClass.accessLevel !== 'full' && selectedClass.allowRegistration !== false ? (
                    <View style={styles.trialBanner}>
                      <Text style={styles.trialBannerTitle}>
                        Đang học thử ({Math.max(0, Number(selectedClass.freePreviewTopics ?? 1))} chủ đề đầu)
                      </Text>
                      <Text style={styles.trialBannerDesc}>
                        Đăng ký mở toàn bộ chủ đề luyện tập và phòng thi chứng chỉ
                        {Number(selectedClass.price) > 0
                          ? ` (${Math.round(Number(selectedClass.price)).toLocaleString('vi-VN')}đ)`
                          : ''}
                        .
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => void handleRegisterClass(selectedClass)}
                        style={styles.trialBannerCta}
                      >
                        <CreditCard size={14} color="#FFFFFF" />
                        <Text style={styles.enterChipText}>Đăng ký &amp; Chuyển khoản</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {selectedClass.description || selectedClass.shortDescription ? (
                    <Text style={styles.modalDesc}>
                      {selectedClass.description || selectedClass.shortDescription}
                    </Text>
                  ) : null}

                  <Text style={styles.sectionLabel}>Chủ đề bài học &amp; Luyện tập</Text>
                  {(selectedClass.dailyPracticeTopicIds || []).length === 0 ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedClass(null);
                        navigation.navigate('MainTabs', { screen: 'DailyPractice' });
                      }}
                      style={styles.modalCtaBtn}
                    >
                      <Gamepad2 size={16} color="#FFFFFF" />
                      <Text style={styles.modalCtaText}>Đi tới khu Luyện tập chung</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.modalList}>
                      {(selectedClass.dailyPracticeTopicIds || []).map((t, i) => {
                        const isFull = selectedClass.accessLevel === 'full';
                        const previewCap = Math.max(0, Number(selectedClass.freePreviewTopics ?? 1));
                        const locked = !isFull && i >= previewCap;
                        return (
                          <TouchableOpacity
                            key={t._id}
                            onPress={() => {
                              if (locked && selectedClass.allowRegistration !== false) {
                                void handleRegisterClass(selectedClass);
                                return;
                              }
                              const tid = String(t._id);
                              setSelectedClass(null);
                              navigation.navigate('MainTabs', { screen: 'DailyPractice', params: { topicId: tid } });
                            }}
                            style={[styles.topicRow, locked && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                          >
                            <View style={[styles.topicBadge, locked && { backgroundColor: '#FEF3C7' }]}>
                              {locked ? <Lock size={13} color="#B45309" /> : <Text style={styles.topicBadgeText}>{i + 1}</Text>}
                            </View>
                            <Text style={styles.topicTitle}>{t.name}</Text>
                            <ChevronRight size={16} color={locked ? '#D97706' : '#059669'} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {(selectedClass.certPrepCourseIds || []).length > 0 ? (
                    <>
                      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Phòng thi chứng chỉ</Text>
                      <View style={styles.modalList}>
                        {(selectedClass.certPrepCourseIds || []).map((c) => {
                          const isFull = selectedClass.accessLevel === 'full';
                          return (
                            <TouchableOpacity
                              key={c._id}
                              onPress={() => {
                                if (!isFull && selectedClass.allowRegistration !== false) {
                                  void handleRegisterClass(selectedClass);
                                  return;
                                }
                                setSelectedClass(null);
                                navigation.navigate('CertPrepCatalog');
                              }}
                              style={styles.certRow}
                            >
                              {!isFull ? <Lock size={16} color="#D97706" /> : <Award size={17} color="#D97706" />}
                              <Text style={styles.topicTitle}>{c.name}</Text>
                              <Text style={styles.certGoText}>{!isFull ? 'Đăng ký' : 'Vào thi'}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chuyển khoản VietQR */}
      <Modal
        visible={Boolean(checkoutSession)}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckoutSession(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCheckoutSession(null)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            {checkoutSession ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTierLabel}>Chuyển khoản đăng ký lớp học</Text>
                    <Text style={styles.modalTitle}>{checkoutSession.courseName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setCheckoutSession(null)} style={styles.closeBtn}>
                    <X size={18} color="#475569" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {checkoutSession.paid || checkoutSession.status === 'paid' ? (
                    <View style={styles.paidSuccessBox}>
                      <CheckCircle2 size={46} color="#059669" />
                      <Text style={styles.paidSuccessTitle}>
                        {checkoutSession.unlockedByAdmin ? 'Admin đã mở khóa lớp!' : 'Mở khóa lớp học thành công!'}
                      </Text>
                      <Text style={styles.paidSuccessDesc}>
                        Quyền truy cập toàn bộ lớp học đã được kích hoạt trên tài khoản của bạn.
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          const cid = checkoutSession.classId;
                          setCheckoutSession(null);
                          const opened = items.find((i) => String(i._id) === String(cid));
                          if (opened) setSelectedClass({ ...opened, accessLevel: 'full' });
                        }}
                        style={[styles.modalCtaBtn, { width: '100%', marginTop: 8 }]}
                      >
                        <Text style={styles.modalCtaText}>Vào lớp học ngay</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      <View style={styles.amountBox}>
                        <Text style={styles.amountLabel}>Số tiền chuyển khoản</Text>
                        <Text style={styles.amountValue}>
                          {checkoutSession.amount > 0
                            ? `${checkoutSession.amount.toLocaleString('vi-VN')}đ`
                            : 'Theo thông báo trung tâm'}
                        </Text>
                      </View>

                      {checkoutSession.qrUrl ? (
                        <View style={styles.qrCard}>
                          <Image source={{ uri: checkoutSession.qrUrl }} style={styles.qrImg} resizeMode="contain" />
                        </View>
                      ) : (
                        <View style={styles.bankMissingBox}>
                          <Text style={styles.bankMissingText}>
                            Chưa cấu hình tài khoản ngân hàng VietQR. Vui lòng liên hệ Admin để mở khóa.
                          </Text>
                        </View>
                      )}

                      <View style={styles.bankInfoBox}>
                        <Text style={styles.bankLine}>Ngân hàng: {checkoutSession.bankInfo?.bankName || checkoutSession.bankInfo?.bankCode || '—'}</Text>
                        <Text style={styles.bankLine}>Số TK: {checkoutSession.bankInfo?.accountNumber || '—'}</Text>
                        <Text style={styles.bankLine}>Chủ TK: {checkoutSession.bankInfo?.accountName || '—'}</Text>
                        <Text style={styles.bankRefLine}>Nội dung CK: {checkoutSession.ref}</Text>
                      </View>

                      <View style={styles.pollRow}>
                        <RefreshCw size={14} color="#059669" />
                        <Text style={styles.pollText}>Tự động kiểm tra thanh toán mỗi 3 giây…</Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={checkingPayment}
                        onPress={() => void refreshCheckoutSession(checkoutSession.sessionId, true)}
                        style={styles.modalCtaBtn}
                      >
                        {checkingPayment ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.modalCtaText}>Tôi đã chuyển khoản · Kiểm tra ngay</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 36,
    gap: 14,
  },
  tierScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  tierTab: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierTabActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  tierTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  tierTabTextActive: {
    color: '#FFFFFF',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  tierBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  tierBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tierBannerDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  centerBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  mutedText: {
    fontSize: 13,
    color: '#64748B',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  retryBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyDesc: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  resetLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  listWrap: {
    gap: 12,
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 15,
    gap: 8,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  cardHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  subPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  subPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  accessPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  accessFull: {
    backgroundColor: '#DCFCE7',
  },
  accessPreview: {
    backgroundColor: '#E0F2FE',
  },
  accessText: {
    fontSize: 11,
    fontWeight: '700',
  },
  accessTextFull: {
    color: '#15803D',
  },
  accessTextPreview: {
    color: '#0369A1',
  },
  classTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  classDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  enterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  enterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  modalHeaderText: {
    flex: 1,
    gap: 3,
  },
  modalTierLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  modalBody: {
    padding: 18,
  },
  modalDesc: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  modalList: {
    gap: 8,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  topicBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  topicTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
  },
  certGoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  modalCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingVertical: 12,
  },
  modalCtaText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 2,
  },
  priceText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#047857',
  },
  originalPriceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  cardActionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trialBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingVertical: 9,
  },
  trialBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#047857',
  },
  registerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#059669',
    paddingVertical: 9,
  },
  trialBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 14,
    gap: 6,
  },
  trialBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#92400E',
  },
  trialBannerDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  trialBannerCta: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingVertical: 9,
  },
  paidSuccessBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  paidSuccessTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
    textAlign: 'center',
  },
  paidSuccessDesc: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  amountBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#065F46',
  },
  qrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
  },
  qrImg: {
    width: 220,
    height: 220,
  },
  bankMissingBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
  },
  bankMissingText: {
    fontSize: 12.5,
    color: '#B45309',
    textAlign: 'center',
  },
  bankInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
  },
  bankLine: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  bankRefLine: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#B45309',
  },
  pollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pollText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
});
