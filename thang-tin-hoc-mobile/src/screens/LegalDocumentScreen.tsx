import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Phone,
  Scale,
  ShieldCheck,
} from 'lucide-react-native';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, surfaces, typography } from '../theme/tokens';
import { LEGAL_META, getLegalDocument } from '../../../shared/legal/termsAndPrivacy.mjs';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type LegalRoute = RouteProp<AppStackParamList, 'LegalDocument'>;

const EXTERNAL_PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://thangtinhoc.vn/bao-mat';
const EXTERNAL_TERMS_URL =
  process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL || 'https://thangtinhoc.vn/dieu-khoan';

export function LegalDocumentScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<LegalRoute>();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const initialTab = route.params?.tab === 'privacy' ? 'privacy' : 'terms';
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route.params?.tab]);

  const doc = getLegalDocument(activeTab);
  const externalUrl = activeTab === 'privacy' ? EXTERNAL_PRIVACY_URL : EXTERNAL_TERMS_URL;

  const switchTab = (nextTab: 'terms' | 'privacy') => {
    setActiveTab(nextTab);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const openWebVersion = () => {
    void Linking.openURL(externalUrl).catch(() => {});
  };

  const callHotline = (phone: string) => {
    const clean = phone.replace(/\s+/g, '');
    void Linking.openURL(`tel:${clean}`).catch(() => {});
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      {/* Thanh điều hướng trên cùng */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressedSoft]}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={18} color={colors.ink} />
          <Text style={styles.backText}>Quay lại</Text>
        </Pressable>

        <View style={styles.topCenter}>
          <Text style={styles.topBrand} numberOfLines={1}>
            {LEGAL_META.brandName} · Pháp lý
          </Text>
        </View>

        <Pressable
          onPress={openWebVersion}
          style={({ pressed }) => [styles.webButton, pressed && styles.pressedSoft]}
          accessibilityRole="link"
          accessibilityLabel="Mở bản web"
        >
          <ExternalLink size={15} color={colors.brand} />
          <Text style={styles.webButtonText}>Bản web</Text>
        </Pressable>
      </View>

      {/* Chuyển nhanh Điều khoản / Bảo mật */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabsPill}>
          <Pressable
            onPress={() => switchTab('terms')}
            style={[styles.tabButton, activeTab === 'terms' && styles.tabButtonActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'terms' }}
          >
            <Scale size={15} color={activeTab === 'terms' ? '#FFFFFF' : colors.muted} />
            <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
              Điều khoản sử dụng
            </Text>
          </Pressable>

          <Pressable
            onPress={() => switchTab('privacy')}
            style={[styles.tabButton, activeTab === 'privacy' && styles.tabButtonActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'privacy' }}
          >
            <ShieldCheck size={15} color={activeTab === 'privacy' ? '#FFFFFF' : colors.muted} />
            <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
              Chính sách bảo mật
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Tiêu đề tài liệu & tóm tắt */}
        <View style={[surfaces.card, styles.heroCard]}>
          <View style={styles.badge}>
            {activeTab === 'privacy' ? (
              <ShieldCheck size={14} color={colors.brandDark} />
            ) : (
              <FileText size={14} color={colors.brandDark} />
            )}
            <Text style={styles.badgeText}>
              Hiệu lực từ {doc.updatedAt} · Phiên bản {LEGAL_META.version}
            </Text>
          </View>

          <Text style={styles.docTitle}>{doc.title}</Text>
          <Text style={styles.docSubtitle}>{doc.subtitle}</Text>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Điểm cốt lõi cần biết</Text>
            {doc.summaryBullets.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <CheckCircle2 size={15} color={colors.brand} style={styles.bulletIcon} />
                <Text style={styles.summaryBulletText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Các mục chi tiết */}
        {doc.sections.map((section) => (
          <View key={section.id} style={[surfaces.card, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.paragraphs?.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}

            {Array.isArray(section.bullets) && section.bullets.length > 0 ? (
              <View style={styles.sectionBulletsWrap}>
                {section.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={styles.dot} />
                    <Text style={styles.sectionBulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {/* Kênh hỗ trợ & liên hệ */}
        <View style={[surfaces.card, styles.contactCard]}>
          <View style={styles.contactHeader}>
            <Phone size={16} color={colors.brandDark} />
            <Text style={styles.contactTitle}>Hỗ trợ & Giải đáp pháp lý</Text>
          </View>
          <Text style={styles.contactDesc}>
            Nếu bạn cần hỗ trợ tài khoản, quyền riêng tư hoặc gửi yêu cầu xóa dữ liệu, vui lòng liên hệ trực tiếp đội ngũ {LEGAL_META.operatorName}:
          </Text>
          <View style={styles.contactButtons}>
            <Pressable
              onPress={() => callHotline(LEGAL_META.supportHotline)}
              style={({ pressed }) => [styles.hotlineBtn, pressed && styles.pressedSoft]}
              accessibilityRole="button"
            >
              <Text style={styles.hotlineLabel}>Kỹ thuật LMS</Text>
              <Text style={styles.hotlineNumber}>{LEGAL_META.supportHotline}</Text>
            </Pressable>
            <Pressable
              onPress={() => callHotline(LEGAL_META.consultHotline)}
              style={({ pressed }) => [styles.hotlineBtn, pressed && styles.pressedSoft]}
              accessibilityRole="button"
            >
              <Text style={styles.hotlineLabel}>Tư vấn học tập</Text>
              <Text style={styles.hotlineNumber}>{LEGAL_META.consultHotline}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footerCopyright}>
          © 2026 {LEGAL_META.brandName} · {LEGAL_META.operatorName}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  backText: {
    fontSize: typography.secondary,
    fontWeight: '700',
    color: colors.ink,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  topBrand: {
    fontSize: typography.small,
    fontWeight: '800',
    color: colors.ink,
  },
  webButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: colors.brandSoft,
  },
  webButtonText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.brandDark,
  },
  pressedSoft: {
    opacity: 0.78,
  },
  tabsWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.canvas,
  },
  tabsPill: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: colors.brand,
  },
  tabText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  heroCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeText: {
    fontSize: typography.micro,
    fontWeight: '700',
    color: colors.brandDark,
  },
  docTitle: {
    fontSize: typography.title,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2,
  },
  docSubtitle: {
    fontSize: typography.small,
    lineHeight: 20,
    color: colors.muted,
  },
  summaryBox: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: spacing.sm,
  },
  summaryTitle: {
    fontSize: typography.caption,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletIcon: {
    marginTop: 2,
  },
  summaryBulletText: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: 19,
    color: colors.ink,
  },
  sectionCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: colors.ink,
  },
  paragraph: {
    fontSize: typography.small,
    lineHeight: 22,
    color: '#334155',
  },
  sectionBulletsWrap: {
    marginTop: 4,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginTop: 7,
  },
  sectionBulletText: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: 20,
    color: '#334155',
  },
  contactCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.brandSoft,
    borderColor: '#A7F3D0',
    gap: spacing.sm,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.brandDark,
  },
  contactDesc: {
    fontSize: typography.secondary,
    lineHeight: 20,
    color: '#334155',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  hotlineBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 2,
  },
  hotlineLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
    color: colors.muted,
  },
  hotlineNumber: {
    fontSize: typography.small,
    fontWeight: '800',
    color: colors.brandDark,
  },
  footerCopyright: {
    textAlign: 'center',
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: spacing.xs,
  },
});
