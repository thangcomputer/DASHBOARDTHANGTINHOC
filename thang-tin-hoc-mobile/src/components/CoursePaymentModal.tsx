import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw, X } from 'lucide-react-native';
import { PrimaryButton } from './ui';
import {
  buildVietQrUrl,
  getCenterBankAccount,
  getCoursePurchaseSession,
  simulateCoursePurchase,
  type CenterBankAccount,
} from '../services/courseVideoApi';
import { restoreMobileBillingPurchases } from '../services/subscriptionApi';
import { colors, radius, spacing, typography } from '../theme/tokens';

const POLL_MS = 3000;

export type CoursePaymentCheckout = {
  sessionId: string;
  ref: string;
  amount: number;
  courseTitle: string;
};

function formatVnd(value: number) {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;
}

export function CoursePaymentModal({
  checkout,
  onClose,
  onPaid,
  title = 'Thanh toán mua khóa học',
  getSession = getCoursePurchaseSession,
  simulate = simulateCoursePurchase,
}: {
  checkout: CoursePaymentCheckout | null;
  onClose: () => void;
  onPaid: () => void;
  title?: string;
  getSession?: (sessionId: string) => Promise<{ paid: boolean }>;
  simulate?: (sessionId: string) => Promise<unknown>;
}) {
  const isNativeStoreApp = Platform.OS === 'ios' || Platform.OS === 'android';
  const nativeIapReady = process.env.EXPO_PUBLIC_NATIVE_IAP_ENABLED === 'true';
  const companionReadOnly = isNativeStoreApp && !nativeIapReady;

  const getSessionRef = useRef(getSession);
  getSessionRef.current = getSession;
  const [bank, setBank] = useState<CenterBankAccount | null>(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const firedRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const sessionId = checkout?.sessionId || '';

  useEffect(() => {
    if (!sessionId || companionReadOnly) {
      setLoadingBank(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingBank(true);
    getCenterBankAccount()
      .then((account) => { if (!cancelled) setBank(account); })
      .catch(() => { if (!cancelled) setBank(null); })
      .finally(() => { if (!cancelled) setLoadingBank(false); });
    return () => { cancelled = true; };
  }, [sessionId, companionReadOnly]);

  useEffect(() => {
    if (!sessionId || companionReadOnly) return undefined;
    firedRef.current = false;
    setSeconds(0);
    const markPaid = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      onPaidRef.current();
    };
    const tick = async () => {
      try {
        const session = await getSessionRef.current(sessionId);
        if (session.paid) markPaid();
      } catch { /* thử lại ở lượt sau */ }
    };
    tick();
    const poll = setInterval(tick, POLL_MS);
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(timer);
    };
  }, [sessionId, companionReadOnly]);

  const handleSimulate = async () => {
    if (!sessionId) return;
    setSimulating(true);
    try {
      await simulate(sessionId);
      if (!firedRef.current) {
        firedRef.current = true;
        onPaidRef.current();
      }
    } finally {
      setSimulating(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const res = await restoreMobileBillingPurchases();
      Alert.alert('Khôi phục giao dịch mua', res.message);
      if (res.data.reconciledCount > 0 || res.data.restoredCourseIds.length > 0) {
        onPaidRef.current();
      }
    } catch (error) {
      Alert.alert('Không thể khôi phục', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRestoring(false);
    }
  };

  const qrUrl = bank && checkout && !companionReadOnly ? buildVietQrUrl(bank, checkout.amount, checkout.ref) : null;

  return (
    <Modal visible={Boolean(checkout)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{companionReadOnly ? 'Đồng bộ quyền truy cập' : title}</Text>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Đóng thanh toán">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          {checkout ? <Text style={styles.course} numberOfLines={2}>{checkout.courseTitle}</Text> : null}
          {companionReadOnly ? (
            <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.ink }}>
                Để tuân thủ chính sách thanh toán nội dung số của App Store và Google Play, giao dịch mua trực tiếp trong ứng dụng chỉ mở khi sản phẩm cửa hàng (Apple IAP / Google Play Billing) đã được kích hoạt.
              </Text>
              <Text style={styles.muted}>
                Nếu bạn đã có quyền truy cập hợp lệ trên tài khoản học viên, bấm nút bên dưới để đồng bộ lại khóa học và gói của bạn.
              </Text>
              <PrimaryButton
                title={restoring ? 'Đang khôi phục…' : 'Khôi phục giao dịch mua'}
                onPress={() => { void handleRestorePurchases(); }}
                loading={restoring}
              />
            </View>
          ) : loadingBank ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.muted}>Đang tải thông tin thanh toán…</Text>
            </View>
          ) : !qrUrl || !bank || !checkout ? (
            <Text style={styles.error}>Chưa cấu hình tài khoản ngân hàng trung tâm. Không tạo được mã QR.</Text>
          ) : (
            <>
              <Image source={{ uri: qrUrl }} style={styles.qr} resizeMode="contain" accessibilityLabel="Mã QR chuyển khoản" />
              <InfoRow label="Ngân hàng" value={bank.bankName} />
              <InfoRow label="Số tài khoản" value={bank.accountNumber} />
              <InfoRow label="Chủ tài khoản" value={bank.accountName} />
              <InfoRow label="Số tiền" value={formatVnd(checkout.amount)} strong />
              <InfoRow label="Nội dung" value={checkout.ref} strong />
              <View style={styles.polling}>
                <RefreshCw size={13} color={colors.blue} />
                <Text style={styles.muted}>{`Đang tự động kiểm tra thanh toán… (${seconds}s)`}</Text>
              </View>
              {__DEV__ ? (
                <PrimaryButton title={simulating ? 'Đang giả lập thanh toán…' : 'Đã thanh toán (test - chỉ dev)'} onPress={handleSimulate} loading={simulating} variant="secondary" />
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: typography.heading, fontWeight: '900', color: colors.ink },
  close: { padding: spacing.xs },
  course: { fontSize: typography.small, fontWeight: '700', color: colors.brandDark },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  muted: { fontSize: 12, color: colors.muted },
  error: { fontSize: typography.caption, color: colors.red, paddingVertical: spacing.lg, textAlign: 'center' },
  qr: { width: 220, height: 220, alignSelf: 'center', marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 13, color: colors.ink, textAlign: 'right', flexShrink: 1 },
  rowValueStrong: { fontWeight: '900', color: colors.brandDark },
  polling: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingVertical: spacing.sm, marginTop: spacing.xs },
});
