import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  LogIn,
  MessageCircle,
  Phone,
  ScanFace,
  Share2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import { mobileApiRequest } from '../services/apiClient';
import { getBiometricAvailability, type BiometricAvailability } from '../services/biometricAuth';
import { getWebLogoUrl } from '../services/webSettingsApi';
import type { UserRole } from '../types';

const ADMIN_ZALO_PHONE = String(process.env.EXPO_PUBLIC_SUPPORT_PHONE || '0935758462').replace(/\D/g, '');
const SUPPORT_HOTLINE_LABEL = '093 5758 462';

const DEWSKILL_LOGO = require('../../assets/logo.webp');
const MASCOT_OFFICE = require('../../assets/mascot/wor-excel-powerpoint-mascot.gif');

/** Bảng màu Phương án B — Sinh động, Game hóa (Vibrant Gamified DewSkill). */
const bTheme = {
  heroBg: '#059669',
  heroDark: '#047857',
  heroBorder: '#065F46',
  creamBg: '#FFFBF2',
  surface: '#FFFFFF',
  surfaceBorder: '#E2E8F0',
  surfaceDepth: '#CBD5E1',
  inputBg: '#FFFDF5',
  inputBorder: '#FDE68A',
  trackBg: '#FEF3C7',
  trackBorder: '#FDE68A',
  brand: '#10B981',
  brandDark: '#047857',
  brandSoft: '#D1FAE5',
  brandSoftBorder: '#6EE7B7',
  brandText: '#065F46',
  ink: '#1E293B',
  muted: '#64748B',
  subtle: '#94A3B8',
  amberText: '#92400E',
  errorBg: '#FEE2E2',
  errorBorder: '#FCA5A5',
  errorText: '#B91C1C',
  skyBg: '#E0F2FE',
  skyBorder: '#7DD3FC',
  skyText: '#0369A1',
  white: '#FFFFFF',
};

const EMAIL_RE = /^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/;

/** Chuẩn hóa SĐT Việt Nam (0… hoặc +84…, đầu số 3/5/7/8/9) đồng bộ với web validator. */
function normalizePhone(value: string) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s.\-()]+$/.test(raw) || raw.slice(1).includes('+')) return '';
  const compact = raw.replace(/[\s.\-()]/g, '');
  const canonical = compact.startsWith('+84') ? `0${compact.slice(3)}` : compact.startsWith('+') ? '' : compact;
  return /^0[35789]\d{8}$/.test(canonical) ? canonical : '';
}

function roleLabel(role: UserRole) {
  return role === 'teacher' ? 'Giảng viên' : 'Học viên';
}

function forgotPasswordMessage(role: UserRole, contact: { type: 'phone' | 'email'; value: string }) {
  const contactLine = contact.type === 'phone' ? `SĐT: ${contact.value}` : `Gmail: ${contact.value}`;
  return '[THẮNG TIN HỌC] Yêu cầu cấp lại mật khẩu\n\n'
    + `Vai trò: ${roleLabel(role)}\n`
    + 'Họ tên: (chưa rõ tên)\n'
    + `${contactLine}\n\n`
    + 'Anh/chị Admin vui lòng cấp mật khẩu mới giúp em. Xin cảm ơn!';
}

function openAdminZalo(message = '') {
  const base = `https://zalo.me/${ADMIN_ZALO_PHONE}`;
  void Linking.openURL(message ? `${base}?text=${encodeURIComponent(message)}` : base);
}

/**
 * Màn hình Đăng nhập & Phân luồng vai trò — thiết kế theo Phương án B (Sinh động · Game hóa).
 * Giữ nguyên toàn bộ luồng Đăng nhập (HV/GV), Đăng ký dùng thử Free Portal, Sinh trắc học và Quên mật khẩu.
 */
export function LoginScreen() {
  const { signIn, signInWithBiometrics, isSigningIn, authError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('student');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<'name' | 'age' | 'phone' | 'password' | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState<BiometricAvailability | null>(null);
  const [saveBiometric, setSaveBiometric] = useState(true);

  const mascotBob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBob, {
          toValue: -4,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(mascotBob, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mascotBob]);

  useEffect(() => {
    let alive = true;
    getWebLogoUrl().then((url) => { if (alive) setLogoUrl(url); }).catch(() => { });
    getBiometricAvailability().then((info) => { if (alive) setBiometricInfo(info); }).catch(() => { });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    // Giữ chữ tối rõ trên nền input kem ấm khi trình duyệt tự điền (autofill).
    const style = document.createElement('style');
    style.textContent = 'input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active'
      + '{-webkit-text-fill-color:#1E293B;caret-color:#059669;transition:background-color 600000s 0s,color 600000s 0s;}';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const chooseRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setError('');
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    if (nextMode === 'register') setRole('student');
  };

  const submit = async () => {
    setError('');
    const rawContact = phone.trim();
    const normalizedPhone = normalizePhone(rawContact);
    const normalizedEmail = EMAIL_RE.test(rawContact.toLowerCase()) ? rawContact.toLowerCase() : '';
    const contact = normalizedPhone
      ? { type: 'phone' as const, value: normalizedPhone }
      : normalizedEmail
        ? { type: 'email' as const, value: normalizedEmail }
        : null;

    if (mode === 'register') {
      const trimmedName = fullName.trim();
      const parsedAge = Number.parseInt(age.trim(), 10);
      if (trimmedName.length < 2) {
        setError('Hãy nhập họ và tên (ít nhất 2 ký tự)');
        return;
      }
      if (!Number.isFinite(parsedAge) || parsedAge < 10 || parsedAge > 80) {
        setError('Tuổi hợp lệ từ 10 đến 80');
        return;
      }
      if (!contact) {
        setError('Vui lòng nhập số điện thoại hoặc Gmail hợp lệ');
        return;
      }
      if (password.length < 6) {
        setError('Mật khẩu cần ít nhất 6 ký tự');
        return;
      }
      setIsRegistering(true);
      try {
        await mobileApiRequest(
          '/auth/register-free',
          {
            method: 'POST',
            body: JSON.stringify({
              name: trimmedName,
              age: parsedAge,
              ...(contact.type === 'phone' ? { phone: contact.value } : { email: contact.value }),
              password,
            }),
          },
          false,
        );
        await signIn('student', contact.value, password);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Không thể tạo tài khoản mới.');
      } finally {
        setIsRegistering(false);
      }
      return;
    }

    if (!contact) {
      setError('Vui lòng nhập số điện thoại hoặc Gmail hợp lệ');
      return;
    }
    try {
      await signIn(role, contact.value, password, {
        saveBiometric: Boolean(biometricInfo?.enrolled && saveBiometric),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.');
    }
  };

  const submitBiometric = async () => {
    setError('');
    try {
      await signInWithBiometrics();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập bằng sinh trắc học.');
    }
  };

  const busy = isSigningIn || isRegistering;
  const message = error || authError;
  const heroSubtitle = mode === 'register'
    ? 'Đăng ký 30 giây để trải nghiệm lộ trình Excel, Word miễn phí.'
    : role === 'teacher'
      ? 'Quản lý lịch dạy, điểm danh và theo dõi thu nhập giảng dạy.'
      : 'Đồng bộ lộ trình video, luyện tập XP và lịch kèm 1-1.';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.topSafeArea} edges={['top']} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Phần đầu thương hiệu nổi bật với linh vật DewSkill */}
          <View style={styles.heroBand}>
            <View style={styles.heroInner}>
              <View style={styles.brandRow}>
                <View style={styles.logoCard}>
                  <Image
                    source={logoUrl && !logoFailed ? { uri: logoUrl } : DEWSKILL_LOGO}
                    style={styles.logo}
                    resizeMode="contain"
                    accessibilityLabel="Thắng Tin Học"
                    onError={() => { if (logoUrl && !logoFailed) setLogoFailed(true); }}
                  />
                </View>
                <View style={styles.brandCopy}>
                  <Text style={styles.brandName}>THẮNG TIN HỌC</Text>
                  <Text style={styles.brandTagline} numberOfLines={1}>Học Tin học văn phòng & MOS</Text>
                </View>
                <Animated.View style={[styles.mascotBox, { transform: [{ translateY: mascotBob }] }]}>
                  <Image
                    source={MASCOT_OFFICE}
                    style={styles.mascotImg}
                    resizeMode="contain"
                    accessibilityLabel="Linh vật Bé Đậu Tin Học"
                  />
                </Animated.View>
              </View>

              <Text style={styles.heroTitle}>
                {mode === 'register' ? 'Tạo tài khoản miễn phí' : 'Đăng nhập tài khoản'}
              </Text>
              <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
            </View>
          </View>

          {/* Vùng thao tác chính trên nền kem ấm Phương án B */}
          <View style={styles.bodyWrap}>
            {mode === 'login' ? (
              <View
                style={styles.roleTrack}
                accessibilityRole="tablist"
                accessibilityLabel="Chọn vai trò đăng nhập"
              >
                {(['student', 'teacher'] as const).map((value) => {
                  const active = role === value;
                  const Icon = value === 'teacher' ? UserRound : GraduationCap;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => chooseRole(value)}
                      style={({ pressed }) => [
                        styles.roleTab,
                        active && styles.roleTabActive,
                        pressed && !active && styles.roleTabPressed,
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Icon size={16} color={active ? bTheme.white : bTheme.amberText} />
                      <Text style={[styles.roleTabText, active && styles.roleTabTextActive]}>
                        {roleLabel(value)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.registerPill}>
                <Sparkles size={14} color={bTheme.brandText} />
                <Text style={styles.registerPillText}>Tài khoản Trải nghiệm Miễn phí · Tự kích hoạt</Text>
              </View>
            )}

            <View style={styles.formCard}>
              {message ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <AlertCircle size={18} color={bTheme.errorText} />
                  <Text style={styles.errorText}>{message}</Text>
                </View>
              ) : null}

              {mode === 'register' ? (
                <View style={styles.rowFields}>
                  <View style={[styles.fieldGroup, styles.nameCol]}>
                    <Text style={styles.label}>Họ và tên</Text>
                    <View style={[styles.inputWrap, focused === 'name' && styles.inputWrapFocused]}>
                      <UserRound size={17} color={focused === 'name' ? bTheme.brandDark : bTheme.muted} />
                      <TextInput
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="VD: Nguyễn Minh Anh"
                        placeholderTextColor={bTheme.subtle}
                        autoComplete="name"
                        textContentType="name"
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused(null)}
                        style={styles.input}
                        accessibilityLabel="Họ và tên"
                      />
                    </View>
                  </View>
                  <View style={[styles.fieldGroup, styles.ageCol]}>
                    <Text style={styles.label}>Tuổi</Text>
                    <View style={[styles.inputWrap, focused === 'age' && styles.inputWrapFocused]}>
                      <TextInput
                        value={age}
                        onChangeText={(value) => setAge(value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="20"
                        placeholderTextColor={bTheme.subtle}
                        keyboardType="number-pad"
                        maxLength={2}
                        onFocus={() => setFocused('age')}
                        onBlur={() => setFocused(null)}
                        style={styles.input}
                        accessibilityLabel="Tuổi"
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Số điện thoại hoặc Gmail</Text>
                <View style={[styles.inputWrap, focused === 'phone' && styles.inputWrapFocused]}>
                  <UserRound size={17} color={focused === 'phone' ? bTheme.brandDark : bTheme.muted} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="0912345678 hoặc ten@gmail.com"
                    placeholderTextColor={bTheme.subtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    onFocus={() => setFocused('phone')}
                    onBlur={() => setFocused(null)}
                    style={styles.input}
                    accessibilityLabel="Số điện thoại hoặc Gmail"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    {mode === 'register' ? 'Mật khẩu (tối thiểu 6 ký tự)' : 'Mật khẩu'}
                  </Text>
                  {mode === 'login' ? (
                    <Pressable onPress={() => setForgotOpen(true)} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.forgotInlineLink}>Quên mật khẩu?</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocused]}>
                  <Lock size={17} color={focused === 'password' ? bTheme.brandDark : bTheme.muted} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor={bTheme.subtle}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    textContentType="password"
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={() => { void submit(); }}
                    returnKeyType="go"
                    style={styles.input}
                    accessibilityLabel="Mật khẩu"
                  />
                  <Pressable
                    onPress={() => setShowPassword((shown) => !shown)}
                    hitSlop={10}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={16} color={bTheme.muted} /> : <Eye size={16} color={bTheme.muted} />}
                    <Text style={styles.eyeBtnText}>{showPassword ? 'Ẩn' : 'Hiện'}</Text>
                  </Pressable>
                </View>
              </View>

              {mode === 'login' && biometricInfo?.enrolled ? (
                <Pressable
                  onPress={() => setSaveBiometric((prev) => !prev)}
                  style={styles.biometricRememberRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: saveBiometric }}
                >
                  <View style={[styles.biometricCheckbox, saveBiometric && styles.biometricCheckboxChecked]}>
                    {saveBiometric ? <CheckCircle2 size={12} color={bTheme.white} /> : null}
                  </View>
                  <Text style={styles.biometricRememberText}>Lưu đăng nhập bằng {biometricInfo.label}</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => { void submit(); }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.submitBtn,
                  (pressed || busy) && styles.submitBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={mode === 'register' ? 'Tạo tài khoản ngay' : 'Đăng nhập ngay'}
              >
                {busy ? <ActivityIndicator color={bTheme.white} /> : mode === 'register' ? (
                  <>
                    <UserPlus size={18} color={bTheme.white} />
                    <Text style={styles.submitText}>Tạo tài khoản ngay</Text>
                  </>
                ) : (
                  <>
                    <LogIn size={18} color={bTheme.white} />
                    <Text style={styles.submitText}>Đăng nhập ngay</Text>
                  </>
                )}
              </Pressable>

              {mode === 'login' && biometricInfo?.hasSavedCredential && biometricInfo.enrolled ? (
                <Pressable
                  onPress={() => { void submitBiometric(); }}
                  disabled={busy}
                  style={({ pressed }) => [styles.biometricButton, (pressed || busy) && styles.submitBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Đăng nhập nhanh bằng ${biometricInfo.label}`}
                >
                  <ScanFace size={18} color={bTheme.heroBg} />
                  <View style={styles.flex}>
                    <Text style={styles.biometricButtonText}>Đăng nhập bằng {biometricInfo.label}</Text>
                    <Text style={styles.biometricButtonSub} numberOfLines={1}>
                      {biometricInfo.savedDisplayName || biometricInfo.savedContact}
                    </Text>
                  </View>
                  <ShieldCheck size={16} color={bTheme.heroBg} />
                </Pressable>
              ) : null}
            </View>

            {/* Thẻ phân luồng Dùng thử / Quay lại đăng nhập / Cấp TK Giảng viên */}
            <View style={styles.branchCard}>
              {mode === 'register' ? (
                <>
                  <View style={styles.branchCopy}>
                    <Text style={styles.branchTitle}>Đã có tài khoản học viên?</Text>
                    <Text style={styles.branchSub}>Quay lại để đăng nhập vào lớp học của bạn</Text>
                  </View>
                  <Pressable
                    onPress={() => switchMode('login')}
                    style={({ pressed }) => [styles.branchBtn, pressed && styles.branchBtnPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.branchBtnText}>Đăng nhập</Text>
                  </Pressable>
                </>
              ) : role === 'teacher' ? (
                <>
                  <View style={styles.branchCopy}>
                    <Text style={styles.branchTitle}>Giảng viên mới tại trung tâm?</Text>
                    <Text style={styles.branchSub}>Liên hệ Học vụ để được cấp tài khoản giảng dạy</Text>
                  </View>
                  <Pressable
                    onPress={() => openAdminZalo('[THẮNG TIN HỌC] Yêu cầu cấp tài khoản Giảng viên mới')}
                    style={({ pressed }) => [styles.branchBtn, pressed && styles.branchBtnPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.branchBtnText}>Liên hệ</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.branchCopy}>
                    <Text style={styles.branchTitle}>Chưa có tài khoản học?</Text>
                    <Text style={styles.branchSub}>Trải nghiệm thử lộ trình Excel/Word miễn phí</Text>
                  </View>
                  <Pressable
                    onPress={() => switchMode('register')}
                    style={({ pressed }) => [styles.branchBtn, pressed && styles.branchBtnPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.branchBtnText}>Dùng thử</Text>
                  </Pressable>
                </>
              )}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Cần hỗ trợ kích hoạt?{' '}
                <Text style={styles.footerLink} onPress={() => openAdminZalo()} accessibilityRole="link">
                  Chat Zalo Admin ({SUPPORT_HOTLINE_LABEL})
                </Text>
              </Text>
            </View>
          </View>

          <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea} />
        </ScrollView>
      </KeyboardAvoidingView>
      <ForgotPasswordModal visible={forgotOpen} initialRole={role} onClose={() => setForgotOpen(false)} />
    </View>
  );
}

function ForgotPasswordModal({ visible, initialRole, onClose }: { visible: boolean; initialRole: UserRole; onClose: () => void }) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState('');

  useEffect(() => {
    if (!visible) return;
    setRole(initialRole);
    setPhone('');
    setError('');
    setSentMessage('');
  }, [initialRole, visible]);

  const rawContact = phone.trim();
  const normalizedPhone = normalizePhone(rawContact);
  const normalizedEmail = EMAIL_RE.test(rawContact.toLowerCase()) ? rawContact.toLowerCase() : '';
  const contact = normalizedPhone
    ? { type: 'phone' as const, value: normalizedPhone }
    : normalizedEmail
      ? { type: 'email' as const, value: normalizedEmail }
      : null;

  const confirm = async () => {
    if (!contact) {
      setError('Số điện thoại hoặc Gmail không hợp lệ');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mobileApiRequest('/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: contact.value,
          ...(contact.type === 'phone' ? { phone: contact.value } : { email: contact.value }),
          role,
        }),
      }, false);
      setSentMessage(forgotPasswordMessage(role, contact));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không gửi được yêu cầu. Thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIcon}><KeyRound size={20} color={bTheme.white} /></View>
            <View style={styles.flex}>
              <Text style={styles.modalTitle}>Quên mật khẩu</Text>
              <Text style={styles.modalSubtitle}>{sentMessage ? 'Tin nhắn đã sẵn - chỉ việc gửi' : 'Nhập SĐT hoặc Gmail › xác nhận'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={16} color={bTheme.white} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            {!sentMessage ? (
              <>
                <Text style={styles.modalLabel}>Vai trò tài khoản</Text>
                <View style={styles.modalRoleRow}>
                  {(['student', 'teacher'] as const).map((value) => {
                    const active = role === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setRole(value)}
                        style={[styles.modalRole, active && styles.modalRoleActive]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.modalRoleText, active && styles.modalRoleTextActive]}>{roleLabel(value)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.modalLabel}>Số điện thoại hoặc Gmail đăng ký</Text>
                <View style={styles.modalInputWrap}>
                  <Phone size={16} color={bTheme.muted} />
                  <TextInput
                    value={phone}
                    onChangeText={(value) => { setPhone(value); setError(''); }}
                    placeholder="0912345678 hoặc ten@gmail.com"
                    placeholderTextColor={bTheme.subtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    accessibilityLabel="Số điện thoại hoặc Gmail đăng ký"
                  />
                </View>
                {contact ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmLabel}>Xác nhận thông tin</Text>
                    <Text style={styles.confirmText}>{`${roleLabel(role)} · ${contact.type === 'phone' ? 'SĐT' : 'Gmail'} ${contact.value}`}</Text>
                  </View>
                ) : (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintText}>Nhập SĐT hoặc Gmail đăng ký — hệ thống sẽ tạo sẵn nội dung gửi Admin.</Text>
                  </View>
                )}
                {error ? (
                  <View style={styles.errorBox}>
                    <AlertCircle size={15} color={bTheme.errorText} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => { void confirm(); }}
                  disabled={loading || !contact}
                  style={[styles.modalPrimary, (loading || !contact) && styles.modalPrimaryDisabled]}
                  accessibilityRole="button"
                >
                  {loading ? <ActivityIndicator color={bTheme.white} /> : (
                    <>
                      <CheckCircle2 size={16} color={bTheme.white} />
                      <Text style={styles.modalPrimaryText}>Xác nhận yêu cầu</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.sentHeader}>
                  <View style={styles.sentIcon}><CheckCircle2 size={28} color={bTheme.heroBg} /></View>
                  <Text style={styles.sentTitle}>Đã ghi nhận yêu cầu</Text>
                  <Text style={styles.sentSubtitle}>{`${roleLabel(role)}: ${contact?.value || ''}`}</Text>
                </View>
                <View style={styles.messageBox}>
                  <Text style={styles.modalLabel}>Nội dung gửi Admin</Text>
                  <Text style={styles.messageText} selectable>{sentMessage}</Text>
                </View>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => { void Share.share({ message: sentMessage }); }}
                    style={styles.modalSecondary}
                    accessibilityRole="button"
                  >
                    <Share2 size={16} color={bTheme.ink} />
                    <Text style={styles.modalSecondaryText}>Chia sẻ</Text>
                  </Pressable>
                  <Pressable onPress={() => openAdminZalo(sentMessage)} style={[styles.modalPrimary, styles.flex]} accessibilityRole="button">
                    <MessageCircle size={16} color={bTheme.white} />
                    <Text style={styles.modalPrimaryText}>Zalo Admin</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => setSentMessage('')} style={styles.modalBack} accessibilityRole="button">
                  <Text style={styles.modalBackText}>Quay lại</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bTheme.creamBg },
  topSafeArea: { backgroundColor: bTheme.heroBg },
  bottomSafeArea: { backgroundColor: bTheme.creamBg },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: bTheme.creamBg,
  },
  heroBand: {
    backgroundColor: bTheme.heroBg,
    borderBottomWidth: 4,
    borderBottomColor: bTheme.heroDark,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  heroInner: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCard: {
    backgroundColor: bTheme.white,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 3,
    borderBottomColor: bTheme.heroDark,
  },
  logo: {
    width: 72,
    height: 30,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: bTheme.white,
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  brandTagline: {
    color: '#D1FAE5',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  mascotBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascotImg: {
    width: 46,
    height: 46,
  },
  heroTitle: {
    color: bTheme.white,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 14,
  },
  heroSubtitle: {
    color: '#ECFDF5',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
  },
  bodyWrap: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },
  roleTrack: {
    flexDirection: 'row',
    backgroundColor: bTheme.trackBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: bTheme.trackBorder,
    padding: 4,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
  },
  roleTabActive: {
    backgroundColor: bTheme.brand,
    borderBottomWidth: 3,
    borderBottomColor: bTheme.brandDark,
  },
  roleTabPressed: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  roleTabText: {
    color: bTheme.amberText,
    fontSize: 13.5,
    fontWeight: '700',
  },
  roleTabTextActive: {
    color: bTheme.white,
    fontWeight: '800',
  },
  registerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: bTheme.brandSoft,
    borderWidth: 1.5,
    borderColor: bTheme.brandSoftBorder,
  },
  registerPillText: {
    color: bTheme.brandText,
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: bTheme.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: bTheme.surfaceBorder,
    borderBottomWidth: 5,
    borderBottomColor: bTheme.surfaceDepth,
    padding: 16,
    gap: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: bTheme.errorBg,
    borderWidth: 1.5,
    borderColor: bTheme.errorBorder,
  },
  errorText: {
    flex: 1,
    color: bTheme.errorText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  nameCol: { flex: 1, minWidth: 0 },
  ageCol: { width: 88 },
  fieldGroup: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: bTheme.ink,
    fontSize: 12.5,
    fontWeight: '700',
  },
  forgotInlineLink: {
    color: bTheme.heroBg,
    fontSize: 12.5,
    fontWeight: '800',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: bTheme.inputBorder,
    backgroundColor: bTheme.inputBg,
  },
  inputWrapFocused: {
    borderColor: bTheme.brand,
    backgroundColor: bTheme.white,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: bTheme.ink,
    fontSize: 14.5,
    fontWeight: '600',
    paddingVertical: 10,
    outlineStyle: 'none',
  } as never,
  eyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  eyeBtnText: {
    color: bTheme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  biometricRememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  biometricCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: bTheme.surfaceDepth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bTheme.surface,
  },
  biometricCheckboxChecked: {
    backgroundColor: bTheme.brand,
    borderColor: bTheme.brandDark,
  },
  biometricRememberText: {
    color: bTheme.ink,
    fontSize: 12.5,
    fontWeight: '700',
  },
  submitBtn: {
    minHeight: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: bTheme.brand,
    borderBottomWidth: 4,
    borderBottomColor: bTheme.brandDark,
    marginTop: 2,
  },
  submitBtnPressed: {
    opacity: 0.92,
    borderBottomWidth: 2,
    marginTop: 4,
  },
  submitText: {
    color: bTheme.white,
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  biometricButton: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: bTheme.brandSoftBorder,
    borderBottomWidth: 4,
  },
  biometricButtonText: {
    color: bTheme.brandText,
    fontSize: 13,
    fontWeight: '800',
  },
  biometricButtonSub: {
    color: bTheme.heroBg,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: bTheme.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: bTheme.surfaceDepth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  branchCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  branchTitle: {
    color: bTheme.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  branchSub: {
    color: bTheme.muted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  branchBtn: {
    backgroundColor: bTheme.brandSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: bTheme.brandSoftBorder,
    borderBottomWidth: 3,
  },
  branchBtnPressed: {
    opacity: 0.85,
  },
  branchBtnText: {
    color: bTheme.brandText,
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 10,
  },
  footerText: {
    color: bTheme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerLink: {
    color: bTheme.heroBg,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: bTheme.white,
    borderWidth: 2,
    borderColor: bTheme.surfaceBorder,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: bTheme.heroBg,
    borderBottomWidth: 3,
    borderBottomColor: bTheme.heroDark,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { color: bTheme.white, fontSize: 17, fontWeight: '900' },
  modalSubtitle: { color: '#D1FAE5', fontSize: 12, fontWeight: '600' },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: 18, gap: 12 },
  modalLabel: { color: bTheme.ink, fontSize: 12.5, fontWeight: '700' },
  modalRoleRow: { flexDirection: 'row', gap: 8 },
  modalRole: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: bTheme.surfaceBorder,
    backgroundColor: bTheme.creamBg,
    alignItems: 'center',
  },
  modalRoleActive: {
    borderColor: bTheme.brand,
    backgroundColor: bTheme.brandSoft,
  },
  modalRoleText: { color: bTheme.muted, fontSize: 13.5, fontWeight: '700' },
  modalRoleTextActive: { color: bTheme.brandText, fontWeight: '800' },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: bTheme.inputBorder,
    backgroundColor: bTheme.inputBg,
  },
  confirmBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: bTheme.brandSoftBorder,
    gap: 2,
  },
  confirmLabel: { color: bTheme.heroBg, fontSize: 11, fontWeight: '800' },
  confirmText: { color: bTheme.brandText, fontSize: 13.5, fontWeight: '700' },
  hintBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: bTheme.skyBg,
    borderWidth: 1.5,
    borderColor: bTheme.skyBorder,
  },
  hintText: { color: bTheme.skyText, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  modalPrimary: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: bTheme.brand,
    borderBottomWidth: 4,
    borderBottomColor: bTheme.brandDark,
  },
  modalPrimaryDisabled: { opacity: 0.45 },
  modalPrimaryText: { color: bTheme.white, fontSize: 14, fontWeight: '800' },
  sentHeader: { alignItems: 'center', gap: 6 },
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: bTheme.brandSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentTitle: { color: bTheme.ink, fontSize: 16, fontWeight: '900' },
  sentSubtitle: { color: bTheme.muted, fontSize: 13.5, fontWeight: '600' },
  messageBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: bTheme.creamBg,
    borderWidth: 1.5,
    borderColor: bTheme.surfaceBorder,
    gap: 6,
  },
  messageText: {
    color: bTheme.ink,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: bTheme.surfaceBorder,
    backgroundColor: bTheme.creamBg,
  },
  modalSecondaryText: { color: bTheme.ink, fontSize: 14, fontWeight: '700' },
  modalBack: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: bTheme.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackText: { color: bTheme.muted, fontSize: 13.5, fontWeight: '700' },
});
