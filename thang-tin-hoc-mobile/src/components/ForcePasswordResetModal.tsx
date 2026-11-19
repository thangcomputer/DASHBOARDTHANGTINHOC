import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, LogOut, ShieldCheck } from 'lucide-react-native';
import { authService } from '../services/mockService';
import { clearBiometricCredential } from '../services/biometricAuth';
import { brandScale, ink, semantic, surface } from '../theme/tokens';

type Props = {
  visible: boolean;
  userName?: string;
  onCompleted: () => Promise<void>;
  onSignOut: () => void;
};

/**
 * Màn hình / Modal bắt buộc đặt mật khẩu mới ngay sau khi vào app bằng mã OTP Quên mật khẩu.
 */
export function ForcePasswordResetModal({ visible, userName, onCompleted, onSignOut }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
    setError('');
    setSaved(false);
  }, [visible]);

  if (!visible) return null;

  const submit = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới chưa khớp.');
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword('', newPassword);
      await clearBiometricCredential().catch(() => { });
      setSaved(true);
      await new Promise((resolve) => setTimeout(resolve, 900));
      await onCompleted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật mật khẩu mới.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { }}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={styles.keyboardWrap}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Lock size={20} color="#FFFFFF" />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle}>Đặt lại mật khẩu mới</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {userName ? `Xin chào ${userName} · Xác thực OTP thành công` : 'Xác thực OTP thành công'}
                </Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {saved ? (
                <View style={styles.successState}>
                  <View style={styles.successIcon}>
                    <CheckCircle2 size={34} color={brandScale[600]} />
                  </View>
                  <Text style={styles.successTitle}>Đã lưu mật khẩu mới!</Text>
                  <Text style={styles.successSub}>Đang đưa bạn vào giao diện học tập…</Text>
                </View>
              ) : (
                <>
                  <View style={styles.noticeBox}>
                    <ShieldCheck size={17} color={brandScale[700]} />
                    <Text style={styles.noticeText}>
                      Hãy tạo mật khẩu mới cho tài khoản của bạn. Lần đăng nhập sau hãy dùng mật khẩu mới này.
                    </Text>
                  </View>

                  {error ? (
                    <View style={styles.errorBox} accessibilityRole="alert">
                      <AlertCircle size={16} color={semantic.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Mật khẩu mới (tối thiểu 6 ký tự)</Text>
                    <View style={styles.inputWrap}>
                      <Lock size={16} color={ink.ink400} />
                      <TextInput
                        value={newPassword}
                        onChangeText={(value) => { setNewPassword(value); setError(''); }}
                        placeholder="Nhập mật khẩu mới"
                        placeholderTextColor={ink.ink400}
                        secureTextEntry={!showNew}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        textContentType="newPassword"
                        style={styles.input}
                        accessibilityLabel="Mật khẩu mới"
                      />
                      <Pressable
                        onPress={() => setShowNew((prev) => !prev)}
                        hitSlop={8}
                        style={styles.eyeBtn}
                        accessibilityRole="button"
                        accessibilityLabel={showNew ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                      >
                        {showNew ? <EyeOff size={15} color={ink.ink600} /> : <Eye size={15} color={ink.ink600} />}
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Nhập lại mật khẩu mới</Text>
                    <View style={styles.inputWrap}>
                      <Lock size={16} color={ink.ink400} />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={(value) => { setConfirmPassword(value); setError(''); }}
                        placeholder="Nhập lại mật khẩu mới"
                        placeholderTextColor={ink.ink400}
                        secureTextEntry={!showConfirm}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        textContentType="newPassword"
                        onSubmitEditing={() => { void submit(); }}
                        returnKeyType="done"
                        style={styles.input}
                        accessibilityLabel="Nhập lại mật khẩu mới"
                      />
                      <Pressable
                        onPress={() => setShowConfirm((prev) => !prev)}
                        hitSlop={8}
                        style={styles.eyeBtn}
                        accessibilityRole="button"
                        accessibilityLabel={showConfirm ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                      >
                        {showConfirm ? <EyeOff size={15} color={ink.ink600} /> : <Eye size={15} color={ink.ink600} />}
                      </Pressable>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => { void submit(); }}
                    disabled={saving}
                    style={({ pressed }) => [styles.primaryBtn, (pressed || saving) && styles.btnPressed]}
                    accessibilityRole="button"
                  >
                    {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <CheckCircle2 size={17} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Lưu mật khẩu mới</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={onSignOut}
                    disabled={saving}
                    style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                  >
                    <LogOut size={14} color={ink.ink600} />
                    <Text style={styles.signOutText}>Đăng xuất về trang đăng nhập</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 18,
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: surface.surface0,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCECE5',
    shadowColor: brandScale[900],
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  header: {
    backgroundColor: brandScale[700],
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#D1FAE5',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  body: {
    padding: 18,
    gap: 13,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: brandScale[50],
    borderWidth: 1,
    borderColor: brandScale[200],
  },
  noticeText: {
    flex: 1,
    color: brandScale[800],
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: semantic.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: semantic.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: ink.ink700,
    fontSize: 13,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: surface.surface1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: ink.ink900,
    fontSize: 14.5,
    fontWeight: '600',
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  eyeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: surface.surface2,
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: brandScale[600],
    borderBottomWidth: 3,
    borderBottomColor: brandScale[700],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  btnPressed: {
    opacity: 0.88,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  signOutBtn: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signOutText: {
    color: ink.ink600,
    fontSize: 12.5,
    fontWeight: '700',
  },
  successState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: brandScale[50],
    borderWidth: 1.5,
    borderColor: brandScale[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    color: ink.ink900,
    fontSize: 17,
    fontWeight: '800',
  },
  successSub: {
    color: ink.ink600,
    fontSize: 13,
    fontWeight: '600',
  },
});
