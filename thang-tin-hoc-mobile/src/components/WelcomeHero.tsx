import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, GraduationCap, Presentation, Sparkles, Video, type LucideIcon } from 'lucide-react-native';
import { colors, spacing } from '../theme/tokens';

const HERO_HEIGHT = 168;
const HERO_WIDTH = Math.round(HERO_HEIGHT * (238 / 542));
const JOIN_SPACE = 42;
const FIGURE_WIDTH = 140;
const FIGURE_RIGHT = 8;

const VARIANTS = {
  student: {
    image: require('../assets/student-hero.png'),
    eyebrow: 'TRUNG TÂM THẮNG TIN HỌC',
    eyebrowIcon: GraduationCap,
    fallbackName: 'Học viên',
    joinLabel: 'Vào học ngay',
    quotes: [
      'Học hôm nay, thành công mai sau.',
      'Mỗi ngày một chút, giỏi lên từng ngày.',
      'Kiến thức là hành trang theo bạn suốt đời.',
      'Chăm chỉ hôm nay là tự tin ngày mai.',
      'Không có gì là khó nếu bạn bắt đầu.',
      'Thành thạo tin học - mở rộng cơ hội.',
      'Kiên trì là chìa khóa của thành công.',
    ],
  },
  teacher: {
    image: require('../assets/teacher-hero.png'),
    eyebrow: 'KHÔNG GIAN GIẢNG DẠY',
    eyebrowIcon: Presentation,
    fallbackName: 'Giảng viên',
    joinLabel: 'Vào dạy ngay',
    quotes: [
      'Mỗi buổi dạy là một hạt giống tri thức.',
      'Người thầy giỏi thắp lên niềm đam mê học tập.',
      'Dạy bằng tâm, học viên sẽ nhớ bằng tim.',
      'Một lời khen đúng lúc giúp học viên tiến xa.',
      'Kiên nhẫn là phẩm chất quý nhất của người thầy.',
      'Học viên tiến bộ là niềm vui của người dạy.',
      'Truyền cảm hứng trước, truyền kiến thức sau.',
    ],
  },
} as const;

export type WelcomeChip = { icon?: LucideIcon; label?: string; live?: boolean };

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Giờ Việt Nam tính thủ công - Hermes không phải lúc nào cũng có đủ dữ liệu múi giờ cho Intl. */
function vnNow() {
  const vn = new Date(Date.now() + 7 * 3600e3);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hour: vn.getUTCHours(),
    date: `${WEEKDAYS[vn.getUTCDay()]}, ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`,
    dayIndex: Math.floor(vn.getTime() / 86400e3),
  };
}

function greetingFor(hour: number) {
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 13) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/** Thẻ chào mừng Tổng quan (giống web): tên đầy đủ, hình hoạt hình theo vai trò, nút vào lớp trên đầu nhân vật. */
export function WelcomeHero({ role = 'student', name, chips = [], joinUrl = '', joinHint = '', onJoin, showJoin = true }: {
  role?: 'student' | 'teacher';
  name: string;
  chips?: WelcomeChip[];
  joinUrl?: string;
  joinHint?: string;
  onJoin?: (url: string) => void;
  showJoin?: boolean;
}) {
  const variant = VARIANTS[role];
  const EyebrowIcon = variant.eyebrowIcon;
  const { hour, date, dayIndex } = vnNow();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!joinUrl) return undefined;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => { loop.stop(); pulse.setValue(0); };
  }, [joinUrl, pulse]);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.decor} pointerEvents="none">
          <View style={styles.blob} />
          <View style={styles.ring} />
          <View style={styles.glow} />
        </View>

        <View style={styles.content}>
          <View style={styles.eyebrow}>
            <EyebrowIcon size={12} color={colors.brand} />
            <Text style={styles.eyebrowText}>{variant.eyebrow}</Text>
          </View>
          <Text style={styles.greeting}>{`${greetingFor(hour)} 👋`}</Text>
          <Text style={styles.name}>{name || variant.fallbackName}</Text>
          <View style={styles.quoteRow}>
            <Sparkles size={13} color="#F59E0B" />
            <Text style={styles.quote}>{`“${variant.quotes[dayIndex % variant.quotes.length]}”`}</Text>
          </View>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <CalendarDays size={12} color={colors.brand} />
              <Text style={styles.chipText}>{date}</Text>
            </View>
            {chips.filter((chip) => chip.label).map(({ icon: Icon, label, live }) => (
              <View key={label} style={[styles.chip, live && styles.chipLive]}>
                {live ? <View style={styles.liveDot} /> : Icon ? <Icon size={12} color={colors.brand} /> : null}
                <Text numberOfLines={1} style={[styles.chipText, styles.chipCourse, live && styles.chipLiveText]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.figure, !showJoin && styles.figureNoJoin]}>
        {showJoin ? (
        <View style={styles.joinSlot}>
          {joinUrl ? (
            <Pressable onPress={() => onJoin?.(joinUrl)} style={styles.joinActive} accessibilityRole="button" accessibilityLabel={variant.joinLabel}>
              <Animated.View
                pointerEvents="none"
                style={[styles.joinPulse, {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
                }]}
              />
              <Video size={14} color="#FFFFFF" />
              <Text style={styles.joinActiveText}>{variant.joinLabel}</Text>
            </Pressable>
          ) : joinHint ? (
            <View style={styles.joinIdle} accessibilityState={{ disabled: true }} accessibilityLabel={joinHint}>
              <Video size={14} color="#334155" style={{ opacity: 0.7 }} />
              <Text style={styles.joinIdleText}>{joinHint}</Text>
            </View>
          ) : null}
        </View>
        ) : null}
        <View style={styles.heroBox}>
          <View style={styles.shadow} />
          <Image source={variant.image} style={styles.hero} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  card: {
    minHeight: HERO_HEIGHT + JOIN_SPACE + 10,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E2F1EB',
    backgroundColor: '#F4FBF8',
    backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #ECFDF5 55%, #F0FDF4 100%)',
    boxShadow: '0px 10px 24px rgba(4, 120, 87, 0.08)',
  } as never,
  decor: { ...StyleSheet.absoluteFill, borderRadius: 26, overflow: 'hidden' },
  blob: {
    position: 'absolute', right: -60, bottom: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(5, 150, 105, 0.12)',
    backgroundImage: 'linear-gradient(135deg, rgba(5,150,105,0.18) 0%, rgba(16,185,129,0.14) 50%, rgba(245,158,11,0.18) 100%)',
  } as never,
  ring: { position: 'absolute', right: 18, bottom: -30, width: 140, height: 140, borderRadius: 70, borderWidth: 8, borderColor: 'rgba(255,255,255,0.7)' },
  glow: { position: 'absolute', left: -40, top: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(167, 243, 208, 0.35)' },
  content: { paddingVertical: spacing.lg, paddingLeft: spacing.lg, paddingRight: FIGURE_RIGHT + (FIGURE_WIDTH + HERO_WIDTH) / 2 + 6, gap: 4 },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: '#E2F1EB',
  },
  eyebrowText: { color: colors.brand, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  greeting: { marginTop: 6, color: colors.muted, fontSize: 13, fontWeight: '700' },
  name: { color: colors.brandDark, fontSize: 24, fontWeight: '900', lineHeight: 29 },
  quoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  quote: { flex: 1, color: colors.muted, fontSize: 12, fontStyle: 'italic', lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F1F5F9',
  },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '800' },
  chipCourse: { flexShrink: 1 },
  chipLive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipLiveText: { color: '#FFFFFF' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6EE7B7' },
  figure: { position: 'absolute', right: FIGURE_RIGHT, bottom: 0, width: FIGURE_WIDTH, alignItems: 'center' },
  figureNoJoin: { bottom: 4 },
  joinSlot: { height: JOIN_SPACE, justifyContent: 'center', alignItems: 'center' },
  heroBox: { width: HERO_WIDTH, height: HERO_HEIGHT, alignItems: 'center' },
  shadow: { position: 'absolute', bottom: 2, width: 70, height: 8, borderRadius: 999, backgroundColor: 'rgba(15, 23, 42, 0.14)' },
  hero: { width: HERO_WIDTH, height: HERO_HEIGHT },
  joinActive: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: colors.brand,
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 55%, #047857 100%)',
    boxShadow: '0px 8px 16px rgba(4, 120, 87, 0.35)',
  } as never,
  joinPulse: { ...StyleSheet.absoluteFill, borderRadius: 999, backgroundColor: 'rgba(52, 211, 153, 0.6)' },
  joinActiveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  joinIdle: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: FIGURE_WIDTH, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  joinIdleText: { flexShrink: 1, color: '#334155', fontSize: 11, fontWeight: '900' },
});
