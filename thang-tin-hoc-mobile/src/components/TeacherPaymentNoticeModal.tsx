import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, DeviceEventEmitter, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, FileText, X } from 'lucide-react-native';
import { SOCKET_EVENTS } from '../services/socketService';
import { PIN_LOCK_STATE_EVENT, isPinLockedNow } from '../services/pinLock';
import {
  getTeacherPaymentNotices,
  markTeacherPaymentNoticeSeen,
  parseTeacherPaymentNotice,
  type TeacherPaymentNotice,
} from '../services/teacherPaymentNoticeApi';
import { colors, radius, spacing } from '../theme/tokens';
import type { DemoUser } from '../types';

function formatVnd(value: number) {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;
}

/** Popup "Bạn vừa nhận được thanh toán": mỗi phiếu lương hiện đúng một lần, kể cả khi GV offline lúc Admin chi. */
export function TeacherPaymentNoticeModal({ user, onViewFinance }: { user: DemoUser; onViewFinance: () => void }) {
  const [queue, setQueue] = useState<TeacherPaymentNotice[]>([]);
  const [pinLocked, setPinLocked] = useState(isPinLockedNow());
  const enabled = user.role === 'teacher' && !user.previewMode;

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(PIN_LOCK_STATE_EVENT, (locked: boolean) => setPinLocked(Boolean(locked)));
    return () => subscription.remove();
  }, []);
  const current = queue[0] || null;
  const pop = useRef(new Animated.Value(0)).current;
  const drops = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  const enqueue = useCallback((notices: TeacherPaymentNotice[]) => {
    if (!notices.length) return;
    setQueue((existing) => {
      const known = new Set(existing.map((notice) => notice.id));
      const fresh = notices.filter((notice) => !known.has(notice.id));
      return fresh.length ? [...existing, ...fresh] : existing;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => {
      getTeacherPaymentNotices().then((notices) => { if (alive) enqueue(notices); }).catch(() => {});
    };
    load();
    const realtime = DeviceEventEmitter.addListener(SOCKET_EVENTS.TEACHER_PAYMENT_RECEIVED, (raw: unknown) => {
      const notice = parseTeacherPaymentNotice(raw);
      if (!notice) return;
      if (notice.teacherId && notice.teacherId !== user.id) return;
      enqueue([notice]);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      alive = false;
      realtime.remove();
      appState.remove();
    };
  }, [enabled, enqueue, user.id]);

  useEffect(() => {
    if (!current || pinLocked) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    drops.forEach((drop, index) => {
      drop.setValue(0);
      Animated.timing(drop, {
        toValue: 1,
        duration: 1100,
        delay: index * 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [current, drops, pinLocked, pop]);

  const dismiss = useCallback(() => {
    if (!current) return;
    markTeacherPaymentNoticeSeen(current.id).catch(() => {});
    setQueue((existing) => existing.filter((notice) => notice.id !== current.id));
  }, [current]);

  if (!enabled || !current || pinLocked) return null;
  const remaining = queue.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Đóng thông báo thanh toán">
        <Animated.View
          style={[styles.card, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}
          onStartShouldSetResponder={() => true}
          accessibilityRole="alert"
        >
          <View style={styles.hero}>
            <Pressable onPress={dismiss} style={styles.close} accessibilityRole="button" accessibilityLabel="Đóng thông báo thanh toán">
              <X size={18} color={colors.muted} />
            </Pressable>
            <View style={styles.badgeWrap}>
              {drops.map((drop, index) => (
                <Animated.Text
                  key={index}
                  style={[
                    styles.drop,
                    {
                      left: `${50 + (index - 2) * 16}%`,
                      opacity: drop.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                      transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-24, 64] }) }],
                    },
                  ]}
                >
                  ₫
                </Animated.Text>
              ))}
              <View style={styles.badge}><CheckCircle2 size={52} color="#10B981" /></View>
            </View>
            <Text style={styles.eyebrow}>Bạn vừa nhận được thanh toán</Text>
            <Text style={styles.amount}>{formatVnd(current.amount)}</Text>
            <Text style={styles.subtitle}>
              Admin đã chuyển tiền hoa hồng cho bạn{current.month ? ` (${current.month})` : ''}.
            </Text>
            {remaining > 0 ? <Text style={styles.remaining}>{`Còn ${remaining} lần thanh toán khác — đóng để xem tiếp.`}</Text> : null}
            <View style={styles.stats}>
              <View style={[styles.stat, styles.statSessions]}>
                <Text style={styles.statLabel}>Số buổi</Text>
                <Text style={styles.statValue}>{`${current.sessions} buổi`}</Text>
              </View>
              <View style={[styles.stat, styles.statBonus]}>
                <Text style={styles.statLabel}>Thưởng sao</Text>
                <Text style={[styles.statValue, styles.statBonusValue]}>{formatVnd(current.starBonusAmount)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={dismiss} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Đóng</Text>
            </Pressable>
            <Pressable
              onPress={() => { dismiss(); onViewFinance(); }}
              style={styles.primary}
              accessibilityRole="button"
            >
              <FileText size={16} color="#FFFFFF" />
              <Text style={styles.primaryText}>Xem tài chính</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 400, borderRadius: 28, backgroundColor: colors.surface, overflow: 'hidden', boxShadow: '0px 24px 48px rgba(2, 44, 34, 0.25)' },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 28,
    paddingBottom: spacing.xl,
    backgroundColor: '#ECFDF5',
    backgroundImage: 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 50%, #FFFBEB 100%)',
  } as never,
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 2,
  },
  badgeWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  drop: { position: 'absolute', top: 0, marginLeft: -6, color: '#059669', fontSize: 18, fontWeight: '900' },
  badge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: '#A7F3D0',
    boxShadow: '0px 10px 22px rgba(16, 185, 129, 0.18), inset 0px 3px 4px rgba(255, 255, 255, 1)',
  },
  eyebrow: { marginTop: spacing.lg, color: '#059669', fontSize: 11, fontWeight: '800', letterSpacing: 2.2 },
  amount: { marginTop: spacing.sm, color: colors.ink, fontSize: 32, fontWeight: '900' },
  subtitle: { marginTop: spacing.sm, color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  remaining: { marginTop: spacing.sm, color: '#047857', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, alignSelf: 'stretch' },
  stat: { flex: 1, borderRadius: 14, borderWidth: 1, padding: spacing.md, backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  statSessions: { borderColor: '#D1FAE5' },
  statBonus: { borderColor: '#FEF3C7' },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: { marginTop: 4, color: colors.ink, fontSize: 14, fontWeight: '800' },
  statBonusValue: { color: '#B45309' },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  secondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  primary: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    backgroundImage: 'linear-gradient(180deg, #F05252 0%, #DC2626 55%, #B91C1C 100%)',
    boxShadow: '0px 8px 18px rgba(185, 28, 28, 0.3), inset 0px 2px 3px rgba(255, 255, 255, 0.35), inset 0px -3px 6px rgba(127, 29, 29, 0.45)',
  } as never,
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
