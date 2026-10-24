import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronLeft, ChevronRight, CircleAlert, Inbox, Search } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useAuth } from '../app/AuthContext';
import type { Assignment, ScheduleItem } from '../types';

export function AppScreen({
  children,
  scroll = true,
  contentStyle,
}: React.PropsWithChildren<{ scroll?: boolean; contentStyle?: ViewStyle }>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const parentNavigation = navigation.getParent();
  const isMainTab = ['Home', 'Schedule', 'Students', 'Messages', 'Notifications', 'Profile'].includes(route.name);
  const canGoBack = !isMainTab && (navigation.canGoBack() || Boolean(parentNavigation?.canGoBack()));
  const handleBack = onBack || (canGoBack ? () => {
    if (navigation.canGoBack()) navigation.goBack();
    else parentNavigation?.goBack();
  } : undefined);

  return (
    <View style={styles.header}>
      {handleBack ? (
        <Pressable onPress={handleBack} style={styles.headerAction} accessibilityRole="button" accessibilityLabel="Quay lại">
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {user?.role === 'student' ? (
        <Pressable
          onPress={() => {
            if (isMainTab) navigation.navigate('Notifications' as never);
            else navigation.navigate('NotificationCenter' as never);
          }}
          style={styles.notificationButton}
          accessibilityRole="button"
          accessibilityLabel="Mở thông báo"
        >
          <Bell size={19} color={colors.ink} />
          <View style={styles.notificationDot} />
        </Pressable>
      ) : right}
    </View>
  );
}

export function Card({ children, style }: React.PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onPress} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const badgePalette: Record<string, { backgroundColor: string; color: string }> = {
  'Đang học': { backgroundColor: colors.greenSoft, color: colors.green },
  'Hoàn thành': { backgroundColor: colors.blueSoft, color: colors.blue },
  'Đã nộp': { backgroundColor: colors.greenSoft, color: colors.green },
  'Chưa làm': { backgroundColor: colors.goldSoft, color: '#9A6C0A' },
  'Quá hạn': { backgroundColor: colors.redSoft, color: colors.red },
  'Cần chấm': { backgroundColor: colors.purpleSoft, color: colors.purple },
  'Cần hỗ trợ': { backgroundColor: colors.redSoft, color: colors.red },
  'Thôi học': { backgroundColor: colors.redSoft, color: colors.red },
  'Đã chấm': { backgroundColor: colors.greenSoft, color: colors.green },
  'Đã nhận': { backgroundColor: colors.greenSoft, color: colors.green },
  'Chưa nhận': { backgroundColor: colors.goldSoft, color: '#9A6C0A' },
  'Tốt': { backgroundColor: colors.greenSoft, color: colors.green },
  'Có mặt': { backgroundColor: colors.greenSoft, color: colors.green },
  'Vắng': { backgroundColor: colors.redSoft, color: colors.red },
  'Đi trễ': { backgroundColor: colors.goldSoft, color: '#9A6C0A' },
  'Có phép': { backgroundColor: colors.blueSoft, color: colors.blue },
  upcoming: { backgroundColor: colors.brandSoft, color: colors.brandDark },
  completed: { backgroundColor: colors.greenSoft, color: colors.green },
  cancelled: { backgroundColor: colors.redSoft, color: colors.red },
};

export function StatusBadge({ label }: { label: string }) {
  const palette = badgePalette[label] || { backgroundColor: colors.canvas, color: colors.muted };
  const displayLabel = ({
    upcoming: 'Sắp tới',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  } as Record<string, string>)[label] || label;
  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]} accessibilityLabel={`Trạng thái: ${displayLabel}`}>
      <Text style={[styles.badgeText, { color: palette.color }]}>{displayLabel}</Text>
    </View>
  );
}

export function Avatar({ name, color = colors.brandSoft, size = 48 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(13, size * 0.3) }]}>{initials}</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
}) {
  const secondary = variant === 'secondary';
  const quiet = variant === 'quiet';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        quiet && styles.buttonQuiet,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={secondary || quiet ? colors.brand : '#FFFFFF'} /> : (
        <Text style={[styles.buttonText, (secondary || quiet) && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Tìm kiếm',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <Search size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        blurOnSubmit
      />
    </View>
  );
}

export function FormField({
  label,
  inputStyle,
  ...props
}: TextInputProps & { label: string; inputStyle?: TextStyle }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, inputStyle]}
        {...props}
      />
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card style={styles.stateCard}>
      <View style={styles.stateIcon}><Inbox size={22} color={colors.brand} /></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
    </Card>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card style={styles.stateCard}>
      <View style={[styles.stateIcon, { backgroundColor: colors.redSoft }]}><CircleAlert size={22} color={colors.red} /></View>
      <Text style={styles.stateTitle}>Chưa thể tải nội dung</Text>
      <Text style={styles.stateMessage}>Đây là trạng thái lỗi minh họa trong bản demo.</Text>
      <PrimaryButton title="Thử lại" variant="secondary" onPress={onRetry} />
    </Card>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Đang tải" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonLines}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View
      style={styles.progressTrack}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      accessibilityLabel={`Tiến độ ${value}%`}
    >
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

export function ScheduleCard({ item }: { item: ScheduleItem }) {
  return (
    <Card style={styles.scheduleCard}>
      <View style={[styles.scheduleRail, { backgroundColor: item.color }]} />
      <View style={styles.scheduleBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardEyebrow}>{item.dateLabel} · {item.time}</Text>
          <StatusBadge label={item.status} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.bodyMuted}>{item.person}  ·  {item.location}</Text>
      </View>
    </Card>
  );
}

export function AssignmentCard({ item }: { item: Assignment }) {
  return (
    <Card style={styles.listCard}>
      <View style={styles.assignmentIcon}><Text style={styles.assignmentIconText}>Aa</Text></View>
      <View style={styles.listCardBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardEyebrow}>{item.subject}</Text>
          <StatusBadge label={item.status} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.bodyMuted}>{item.teacher}  ·  {item.deadline}</Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Card>
  );
}

export function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  destructive = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuRow} accessibilityRole="button">
      <View style={styles.menuIcon}>{icon}</View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuTitle, destructive && { color: colors.red }]}>{title}</Text>
        {subtitle ? <Text style={styles.bodyMuted}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  body: { color: colors.ink, fontSize: typography.body, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  screenContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  headerText: { flex: 1 },
  headerTitle: { color: colors.ink, fontSize: typography.title, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: colors.muted, fontSize: typography.small, marginTop: 3 },
  headerAction: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  notificationButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 5, right: 5, width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.red, borderWidth: 1.5, borderColor: colors.surface },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '700' },
  sectionAction: { color: colors.brand, fontSize: typography.small, fontWeight: '700' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center' },
  badgeText: { fontSize: typography.caption, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brandDark, fontWeight: '800' },
  button: { minHeight: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: colors.brand },
  buttonSecondary: { backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#C6E8E6' },
  buttonQuiet: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: typography.body },
  buttonTextSecondary: { color: colors.brandDark },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.lg },
  searchInput: { flex: 1, color: colors.ink, fontSize: typography.body, paddingVertical: spacing.md },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  input: { minHeight: 52, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.lg, fontSize: typography.body },
  stateCard: { alignItems: 'center', paddingVertical: spacing.xxxl },
  stateIcon: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.heading, textAlign: 'center' },
  stateMessage: { color: colors.muted, fontSize: typography.small, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  skeletonCard: { height: 84, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  skeletonCircle: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: '#EAF0F1' },
  skeletonLines: { flex: 1, gap: spacing.sm },
  skeletonLine: { height: 11, borderRadius: radius.pill, backgroundColor: '#EAF0F1', width: '75%' },
  skeletonShort: { width: '45%', height: 9 },
  progressTrack: { height: 8, backgroundColor: '#E9EFF0', borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand },
  scheduleCard: { flexDirection: 'row', padding: 0, overflow: 'hidden', gap: 0 },
  scheduleRail: { width: 5 },
  scheduleBody: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  cardEyebrow: { color: colors.muted, fontSize: typography.caption, fontWeight: '600', flexShrink: 1 },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.body, lineHeight: 21 },
  bodyMuted: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listCardBody: { flex: 1, gap: spacing.xs },
  assignmentIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  assignmentIconText: { fontSize: typography.small, fontWeight: '800', color: colors.brandDark },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.line },
  menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: 2 },
  menuTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '600' },
});
