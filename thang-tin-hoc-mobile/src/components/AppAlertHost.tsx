import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AlertButton,
} from 'react-native';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import { setAppAlertHandler, type AppAlertPayload } from '../i18n/appAlertBus';
import { useLanguage } from '../i18n/LanguageContext';

const SUCCESS_RE = /thành công|đã tạo|đã xóa|đã lưu|đã cập nhật|kích hoạt|thanh toán thành công|khôi phục|success|saved|activated|restored|created/i;
const ERROR_RE = /lỗi|không thể|thất bại|hết hạn|không hợp lệ|không tìm thấy|sai|chưa|thiếu|error|failed|unable|invalid|expired|missing|cannot/i;

function resolveAlertTone(title: string, message?: string, buttons?: AlertButton[]) {
  if (Array.isArray(buttons) && buttons.some((b) => b?.style === 'destructive')) {
    return 'danger';
  }
  const combined = `${title || ''} ${message || ''}`;
  if (ERROR_RE.test(combined)) return 'danger';
  if (SUCCESS_RE.test(combined)) return 'success';
  return 'info';
}

/** Popup tùy chỉnh thay thế toàn bộ hộp thoại Alert.alert mặc định trên Mobile App. */
export function AppAlertHost() {
  const { language } = useLanguage();
  const [queue, setQueue] = useState<AppAlertPayload[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    setAppAlertHandler((payload) => {
      setQueue((prev) => [...prev, payload]);
    });
    return () => setAppAlertHandler(null);
  }, []);

  const dismissCurrent = () => {
    setQueue((prev) => prev.slice(1));
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !current) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (current.options?.cancelable === false) return;
      event.preventDefault();
      dismissCurrent();
      const cancelBtn = current.buttons?.find((b) => b?.style === 'cancel');
      if (cancelBtn?.onPress) cancelBtn.onPress();
      else current.options?.onDismiss?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current]);

  if (!current) return null;

  const tone = resolveAlertTone(current.title, current.message, current.buttons);
  const rawButtons = Array.isArray(current.buttons) && current.buttons.length > 0
    ? current.buttons
    : [{ text: language === 'en' ? 'OK' : 'Đã hiểu' }];

  const handleBackdropPress = () => {
    if (current.options?.cancelable === false) return;
    dismissCurrent();
    const cancelBtn = rawButtons.find((b) => b?.style === 'cancel');
    if (cancelBtn?.onPress) cancelBtn.onPress();
    else current.options?.onDismiss?.();
  };

  const handleButtonPress = (btn: AlertButton) => {
    dismissCurrent();
    btn?.onPress?.();
  };

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertCircle : Info;
  const iconColor = tone === 'success' ? '#059669' : tone === 'danger' ? '#DC2626' : '#0284C7';
  const badgeStyle = tone === 'success'
    ? styles.badgeSuccess
    : tone === 'danger'
      ? styles.badgeDanger
      : styles.badgeInfo;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityRole="button"
          accessibilityLabel={language === 'en' ? 'Close alert' : 'Đóng thông báo'}
        />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.topRow}>
            <View style={[styles.badge, badgeStyle]}>
              <Icon size={22} color={iconColor} strokeWidth={2.4} />
            </View>
            {current.options?.cancelable !== false ? (
              <Pressable
                onPress={handleBackdropPress}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={language === 'en' ? 'Close' : 'Đóng'}
              >
                <X size={16} color="#64748B" />
              </Pressable>
            ) : null}
          </View>

          {current.title ? (
            <Text style={styles.title}>{current.title}</Text>
          ) : null}
          {current.message ? (
            <Text style={styles.message}>{current.message}</Text>
          ) : null}

          <View style={[styles.actions, rawButtons.length > 2 && styles.actionsColumn]}>
            {rawButtons.map((btn, idx) => {
              const isCancel = btn?.style === 'cancel';
              const isDestructive = btn?.style === 'destructive';
              const label = btn?.text || (isCancel ? (language === 'en' ? 'Cancel' : 'Hủy') : (language === 'en' ? 'OK' : 'Đồng ý'));
              return (
                <Pressable
                  key={`${label}-${idx}`}
                  onPress={() => handleButtonPress(btn)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.btn,
                    rawButtons.length <= 2 && styles.btnFlex,
                    isCancel
                      ? styles.btnCancel
                      : isDestructive
                        ? styles.btnDanger
                        : styles.btnPrimary,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isCancel ? styles.btnCancelText : styles.btnSolidText,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeInfo: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
  },
  message: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    fontWeight: '500',
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  actionsColumn: {
    flexDirection: 'column-reverse',
  },
  btn: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFlex: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderBottomWidth: 3.5,
    borderBottomColor: '#047857',
  },
  btnDanger: {
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderBottomWidth: 3.5,
    borderBottomColor: '#B91C1C',
  },
  btnCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderBottomWidth: 3,
    borderBottomColor: '#94A3B8',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  btnSolidText: {
    color: '#FFFFFF',
  },
  btnCancelText: {
    color: '#475569',
  },
});
