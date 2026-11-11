import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Crown, Flame, Zap } from 'lucide-react-native';
import { useAuth } from '../../app/AuthContext';

const DEWSKILL_LOGO = require('../../../assets/logo.webp');
const LMS_LOGO = require('../../../assets/logo-lms.png');

interface DuoHeaderBarProps {
  streak?: number;
  xpTotal?: number;
  onPressStreak?: () => void;
  onPressXp?: () => void;
  onPressSubscription?: () => void;
  /** Logo đã có trên BrandingTopBar — chỉ hiển thị pill streak/XP/gói. */
  showBrand?: boolean;
}

export function DuoHeaderBar({
  streak = 0,
  xpTotal = 0,
  onPressStreak,
  onPressXp,
  onPressSubscription,
  showBrand = false,
}: DuoHeaderBarProps) {
  const { user, subscription } = useAuth();
  const subState = subscription?.subscription;
  const isMeetActive = subState?.state === 'active' || subState?.state === 'lifetime';

  // Quy tắc hiển thị logo:
  // - Học viên đăng ký tài khoản miễn phí -> Logo DewSkill (xanh lá cây)
  // - Học viên đăng ký theo khóa học LMS -> Logo LMS Thắng Tin Học (đỏ)
  const hasRealEnrollment = Array.isArray(user?.enrollments) && user.enrollments.some((e) => {
    const label = String(e?.courseName || '').trim().toLocaleLowerCase('vi');
    return Boolean(label) && label !== 'tài khoản miễn phí' && e.status === 'Đang học';
  });
  const isFreeStudent = !hasRealEnrollment && (user?.freePortal === true || String(user?.course || '').trim().toLocaleLowerCase('vi') === 'tài khoản miễn phí');
  const logoSource = isFreeStudent ? DEWSKILL_LOGO : LMS_LOGO;

  return (
    <View style={[styles.container, !showBrand && styles.containerPillsOnly]}>
      {showBrand ? (
        <View style={styles.brandCol}>
          <Image source={logoSource} style={styles.brandLogo} resizeMode="contain" />
        </View>
      ) : null}

      <View style={[styles.pillsRow, !showBrand && styles.pillsRowEnd]}>
        {/* Streak Flame Pill */}
        <Pressable
          onPress={onPressStreak}
          style={({ pressed }) => [styles.pill, styles.streakPill, pressed && styles.pillPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Chuỗi ${streak} ngày`}
        >
          <Flame size={16} color="#EA580C" fill="#FB923C" />
          <Text style={styles.streakText}>{streak}</Text>
        </Pressable>

        {/* XP Lightning Pill */}
        <Pressable
          onPress={onPressXp}
          style={({ pressed }) => [styles.pill, styles.xpPill, pressed && styles.pillPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Ví ${xpTotal} XP`}
        >
          <Zap size={15} color="#D97706" fill="#F59E0B" />
          <Text style={styles.xpText}>{xpTotal.toLocaleString('vi-VN')}</Text>
        </Pressable>

        {/* Crown / Package Status Pill */}
        <Pressable
          onPress={onPressSubscription}
          style={({ pressed }) => [
            styles.pill,
            isMeetActive ? styles.crownPillActive : styles.crownPillNormal,
            pressed && styles.pillPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Trạng thái gói học"
        >
          <Crown size={14} color={isMeetActive ? '#D97706' : '#64748B'} fill={isMeetActive ? '#FCD34D' : 'transparent'} />
          <Text style={[styles.crownText, isMeetActive && styles.crownTextActive]}>
            {subState?.planLabel || ((user as any)?.freePortal ? 'Miễn phí' : 'Học viên')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  containerPillsOnly: {
    justifyContent: 'flex-end',
    paddingTop: 4,
    paddingBottom: 4,
  },
  pillsRowEnd: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  brandCol: {
    justifyContent: 'center',
  },
  brandLogo: {
    height: 30,
    width: 105,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderBottomWidth: 2,
  },
  pillPressed: {
    transform: [{ translateY: 1 }],
    borderBottomWidth: 1,
  },
  streakPill: {
    backgroundColor: '#FFF7ED',
    borderBottomColor: '#FED7AA',
    borderColor: '#FFEDD5',
    borderWidth: 1,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#C2410C',
  },
  xpPill: {
    backgroundColor: '#FFFBEB',
    borderBottomColor: '#FDE68A',
    borderColor: '#FEF3C7',
    borderWidth: 1,
  },
  xpText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B45309',
  },
  crownPillActive: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FCD34D',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  crownPillNormal: {
    backgroundColor: '#F8FAFC',
    borderBottomColor: '#E2E8F0',
    borderColor: '#F1F5F9',
    borderWidth: 1,
  },
  crownText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  crownTextActive: {
    color: '#92400E',
  },
});
