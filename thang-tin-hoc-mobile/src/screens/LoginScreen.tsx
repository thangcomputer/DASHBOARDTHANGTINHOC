import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import { MobileApiError, mobileApiRequest } from '../services/apiClient';
import { authService } from '../services/mockService';
import { getBiometricAvailability, type BiometricAvailability } from '../services/biometricAuth';
import { getWebLogoUrl } from '../services/webSettingsApi';
import { brandScale, ink, semantic, surface } from '../theme/tokens';
import type { UserRole } from '../types';

const ADMIN_ZALO_PHONE = String(process.env.EXPO_PUBLIC_SUPPORT_PHONE || '0935758462').replace(/\D/g, '');
const SUPPORT_HOTLINE_LABEL = '093 5758 462';
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://thangtinhoc.vn/privacy-policy';
const TERMS_OF_SERVICE_URL = process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL || 'https://thangtinhoc.vn/terms-of-service';

const DEWSKILL_LOGO = require('../../assets/logo.webp');
const MASCOT_OFFICE = require('../../assets/mascot/wor-excel-powerpoint-mascot.gif');

/** Bảng màu DewSkill Emerald & Mint Slate thống nhất với hệ design tokens Web/Mobile. */
const loginPalette = {
  heroBg: brandScale[600],
  heroDeep: brandScale[700],
  heroBorder: brandScale[800],
  canvas: surface.canvas,
  surface: surface.surface0,
  surfaceMuted: surface.surface1,
  trackBg: surface.surface2,
  border: '#E2E8F0',
  mintBorder: '#DCECE5',
  brand: brandScale[600],
  brandBright: brandScale[500],
  brandDark: brandScale[700],
  brandSoft: brandScale[50],
  brandSoftBorder: brandScale[200],
  brandText: brandScale[800],
  ink: ink.ink900,
  inkBody: ink.ink700,
  muted: ink.ink600,
  subtle: ink.ink400,
  errorBg: semantic.dangerSoft,
  errorBorder: '#FECACA',
  errorText: semantic.danger,
  white: '#FFFFFF',
  shadow: brandScale[900],
};

const LOGIN_HIGHLIGHTS = [
  { key: 'video', Icon: PlayCircle, title: 'Video & 1-1', sub: 'Học mọi lúc' },
  { key: 'mos', Icon: Award, title: 'Luyện tập XP', sub: 'Chuẩn MOS' },
  { key: 'sync', Icon: ShieldCheck, title: 'Đồng bộ Web', sub: 'Lưu tiến độ' },
] as const;

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

function openAdminZalo(message = '') {
  const base = `https://zalo.me/${ADMIN_ZALO_PHONE}`;
  void Linking.openURL(message ? `${base}?text=${encodeURIComponent(message)}` : base);
}

/**
 * Màn hình Đăng nhập & Phân luồng vai trò — thiết kế hiện đại đồng bộ thương hiệu DewSkill / Thắng Tin Học.
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
  const [errorCode, setErrorCode] = useState<'ACCOUNT_NOT_FOUND' | 'ACCOUNT_ALREADY_EXISTS' | ''>('');
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [lockDurationSeconds, setLockDurationSeconds] = useState(900);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [focused, setFocused] = useState<'name' | 'age' | 'phone' | 'password' | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState<BiometricAvailability | null>(null);
  const [saveBiometric, setSaveBiometric] = useState(true);
  const [registerOtpStep, setRegisterOtpStep] = useState(false);
  const [registerOtpCode, setRegisterOtpCode] = useState('');
  const [registerCooldown, setRegisterCooldown] = useState(0);
  const [registerResending, setRegisterResending] = useState(false);
  const [registerTargetContact, setRegisterTargetContact] = useState<{ type: 'phone' | 'email'; value: string } | null>(null);
  const [registerDeliveryMeta, setRegisterDeliveryMeta] = useState<{
    channel: 'email' | 'sms';
    channelConfigured: boolean;
    devOtp?: string;
  } | null>(null);

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
    // Giữ chữ tối rõ và nền slate trung tính khi trình duyệt tự điền (autofill).
    const style = document.createElement('style');
    style.textContent = 'input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active'
      + '{-webkit-text-fill-color:#0F172A;caret-color:#059669;-webkit-box-shadow:0 0 0 1000px #F8FAFC inset;'
      + 'transition:background-color 600000s 0s,color 600000s 0s;}';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  useEffect(() => {
    if (registerCooldown <= 0) return undefined;
    const timer = setTimeout(() => {
      setRegisterCooldown((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [registerCooldown]);

  useEffect(() => {
    if (lockSecondsLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setLockSecondsLeft((sec) => (sec > 1 ? sec - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockSecondsLeft]);

  const resetLoginLockHint = () => {
    setLockSecondsLeft(0);
    setRemainingAttempts(null);
  };

  const applyLoginFailureMeta = (reason: unknown) => {
    if (!(reason instanceof MobileApiError)) {
      resetLoginLockHint();
      return;
    }
    if (typeof reason.lockDurationSeconds === 'number' && reason.lockDurationSeconds > 0) {
      setLockDurationSeconds(Math.ceil(reason.lockDurationSeconds));
    }
    if (typeof reason.maxAttempts === 'number' && reason.maxAttempts > 0) {
      setMaxAttempts(reason.maxAttempts);
    }
    if ((reason.status === 403 || reason.status === 429) && typeof reason.retryAfterSeconds === 'number' && reason.retryAfterSeconds > 0) {
      setLockSecondsLeft(Math.ceil(reason.retryAfterSeconds));
      setRemainingAttempts(0);
      return;
    }
    if (typeof reason.remainingAttempts === 'number' && reason.remainingAttempts >= 0) {
      setRemainingAttempts(reason.remainingAttempts);
      setLockSecondsLeft(0);
      return;
    }
    resetLoginLockHint();
  };

  const chooseRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setError('');
    setErrorCode('');
    resetLoginLockHint();
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    setErrorCode('');
    resetLoginLockHint();
    setRegisterOtpStep(false);
    setRegisterOtpCode('');
    setRegisterCooldown(0);
    setRegisterTargetContact(null);
    setRegisterDeliveryMeta(null);
    if (nextMode === 'register') setRole('student');
  };

  const verifyRegisterOtp = async () => {
    const cleanOtp = registerOtpCode.replace(/\D/g, '');
    if (!registerTargetContact || cleanOtp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số mã xác thực');
      return;
    }
    setIsRegistering(true);
    setError('');
    try {
      await mobileApiRequest(
        '/auth/free-portal/verify-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: registerTargetContact.value,
            ...(registerTargetContact.type === 'phone'
              ? { phone: registerTargetContact.value }
              : { email: registerTargetContact.value }),
            otp: cleanOtp,
          }),
        },
        false,
      );
      await signIn('student', registerTargetContact.value, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Mã xác thực không chính xác hoặc đã hết hạn.');
    } finally {
      setIsRegistering(false);
    }
  };

  const resendRegisterOtp = async () => {
    if (!registerTargetContact || registerCooldown > 0 || registerResending) return;
    setRegisterResending(true);
    setError('');
    try {
      const res = await mobileApiRequest<{
        channel?: 'email' | 'sms';
        channelConfigured?: boolean;
        resendAfterSec?: number;
        devOtp?: string;
      }>(
        '/auth/free-portal/resend-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: registerTargetContact.value,
            ...(registerTargetContact.type === 'phone'
              ? { phone: registerTargetContact.value }
              : { email: registerTargetContact.value }),
          }),
        },
        false,
      );
      setRegisterCooldown(Number(res.resendAfterSec || 45));
      setRegisterDeliveryMeta({
        channel: res.channel || (registerTargetContact.type === 'email' ? 'email' : 'sms'),
        channelConfigured: res.channelConfigured !== false,
        devOtp: res.devOtp,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa thể gửi lại mã xác thực.');
    } finally {
      setRegisterResending(false);
    }
  };

  const submit = async () => {
    setError('');
    setErrorCode('');
    if (mode === 'register' && registerOtpStep) {
      await verifyRegisterOtp();
      return;
    }

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
        const res = await mobileApiRequest<{
          channel?: 'email' | 'sms';
          channelConfigured?: boolean;
          resendAfterSec?: number;
          devOtp?: string;
        }>(
          '/auth/free-portal/send-otp',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: trimmedName,
              age: parsedAge,
              identifier: contact.value,
              ...(contact.type === 'phone' ? { phone: contact.value } : { email: contact.value }),
              password,
            }),
          },
          false,
        );
        setRegisterTargetContact(contact);
        setRegisterDeliveryMeta({
          channel: res.channel || (contact.type === 'email' ? 'email' : 'sms'),
          channelConfigured: res.channelConfigured !== false,
          devOtp: res.devOtp,
        });
        setRegisterCooldown(Number(res.resendAfterSec || 45));
        setRegisterOtpCode('');
        setRegisterOtpStep(true);
      } catch (reason) {
        if (reason instanceof MobileApiError && (reason.code === 'ACCOUNT_ALREADY_EXISTS' || reason.status === 409)) {
          setErrorCode('ACCOUNT_ALREADY_EXISTS');
        }
        setError(reason instanceof Error ? reason.message : 'Không thể gửi mã xác thực đăng ký.');
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
      resetLoginLockHint();
    } catch (reason) {
      if (reason instanceof MobileApiError && reason.code === 'DEVICE_CONFLICT') {
        Alert.alert(
          'Phát hiện đăng nhập khác',
          'Tài khoản đang hoạt động trên thiết bị khác. Tiếp tục sẽ đăng xuất phiên đó. Thiết bị đã đăng ký vẫn được giữ.',
          [
            { text: 'Hủy bỏ', style: 'cancel' },
            {
              text: 'Đăng xuất máy kia và vào',
              style: 'destructive',
              onPress: () => {
                void signIn(role, contact.value, password, {
                  saveBiometric: Boolean(biometricInfo?.enrolled && saveBiometric),
                  force: true,
                }).catch((retryErr) => {
                  applyLoginFailureMeta(retryErr);
                  setError(retryErr instanceof Error ? retryErr.message : 'Không thể đăng nhập.');
                });
              },
            },
          ],
        );
        return;
      }
      if (reason instanceof MobileApiError && (reason.code === 'ACCOUNT_NOT_FOUND' || reason.status === 404)) {
        setErrorCode('ACCOUNT_NOT_FOUND');
      }
      applyLoginFailureMeta(reason);
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.');
    }
  };

  const submitBiometric = async () => {
    setError('');
    try {
      await signInWithBiometrics();
      resetLoginLockHint();
    } catch (reason) {
      applyLoginFailureMeta(reason);
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
          {/* Phần đầu thương hiệu bo cong mềm, tạo nền chuyển mượt vào thẻ đăng nhập */}
          <View style={styles.heroBand}>
            <View style={[styles.heroGlowCircle, styles.heroGlowRight]} pointerEvents="none" />
            <View style={[styles.heroGlowCircle, styles.heroGlowLeft]} pointerEvents="none" />

            <View style={styles.heroInner}>
              <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                <LanguageSwitcher variant="pill" theme="dark" />
              </View>
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
                <Animated.View style={[styles.mascotHalo, { transform: [{ translateY: mascotBob }] }]}>
                  <Image
                    source={MASCOT_OFFICE}
                    style={styles.mascotImg}
                    resizeMode="contain"
                    accessibilityLabel="Linh vật Bé Đậu Tin Học"
                  />
                </Animated.View>
              </View>

              <View style={styles.heroBadge}>
                <ShieldCheck size={13} color="#D1FAE5" />
                <Text style={styles.heroBadgeText}>
                  {mode === 'register' ? 'Cổng trải nghiệm miễn phí' : 'Hệ thống học tập trực tuyến LMS'}
                </Text>
              </View>

              <Text style={styles.heroTitle}>
                {mode === 'register' ? 'Tạo tài khoản miễn phí' : 'Đăng nhập tài khoản'}
              </Text>
              <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
            </View>
          </View>

          <View style={styles.bodyWrap}>
            <View style={styles.mainStack}>
              {/* Thẻ đăng nhập nổi lồng lên hero header */}
              <View style={styles.formCard}>
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
                          <Icon size={16} color={active ? loginPalette.brand : loginPalette.muted} />
                          <Text style={[styles.roleTabText, active && styles.roleTabTextActive]}>
                            {roleLabel(value)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.registerPill}>
                    <Sparkles size={14} color={loginPalette.brandText} />
                    <Text style={styles.registerPillText}>Tài khoản Trải nghiệm Miễn phí · Tự kích hoạt</Text>
                  </View>
                )}

                {message ? (
                  <View style={styles.errorStack} accessibilityRole="alert">
                    <View style={styles.errorBox}>
                      <AlertCircle size={18} color={loginPalette.errorText} />
                      <Text style={styles.errorText}>{message}</Text>
                    </View>
                    {mode === 'login' && lockSecondsLeft > 0 ? (
                      <View style={styles.lockWarnBanner}>
                        <Clock size={14} color="#92400E" />
                        <Text style={styles.lockWarnText}>
                          {`Tạm khóa ${lockDurationSeconds} giây — thử lại sau ${lockSecondsLeft}s.`}
                        </Text>
                      </View>
                    ) : mode === 'login' && remainingAttempts !== null && remainingAttempts > 0 ? (
                      <View style={styles.lockWarnBanner}>
                        <Text style={styles.lockWarnText}>
                          {`Còn ${remainingAttempts}/${maxAttempts} lần thử (khóa ${lockDurationSeconds} giây).`}
                        </Text>
                      </View>
                    ) : null}
                    {errorCode === 'ACCOUNT_NOT_FOUND' && mode === 'login' && role === 'student' ? (
                      <Pressable
                        onPress={() => switchMode('register')}
                        style={({ pressed }) => [styles.errorActionBtn, pressed && { opacity: 0.85 }]}
                        accessibilityRole="button"
                      >
                        <UserPlus size={15} color={loginPalette.white} />
                        <Text style={styles.errorActionText}>Đăng ký tài khoản ngay</Text>
                        <ArrowRight size={14} color={loginPalette.white} />
                      </Pressable>
                    ) : null}
                    {errorCode === 'ACCOUNT_ALREADY_EXISTS' && mode === 'register' ? (
                      <Pressable
                        onPress={() => switchMode('login')}
                        style={({ pressed }) => [styles.errorActionBtn, pressed && { opacity: 0.85 }]}
                        accessibilityRole="button"
                      >
                        <LogIn size={15} color={loginPalette.white} />
                        <Text style={styles.errorActionText}>Chuyển sang Đăng nhập</Text>
                        <ArrowRight size={14} color={loginPalette.white} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {mode === 'register' && registerOtpStep ? (
                  <>
                    <View style={registerDeliveryMeta?.channelConfigured ? styles.confirmBox : styles.warnBox}>
                      <Text style={registerDeliveryMeta?.channelConfigured ? styles.confirmLabel : styles.warnLabel}>
                        {`Xác thực đăng ký · ${registerTargetContact?.value || ''}`}
                      </Text>
                      <Text style={registerDeliveryMeta?.channelConfigured ? styles.confirmSub : styles.warnText}>
                        {registerDeliveryMeta?.channelConfigured
                          ? registerDeliveryMeta.channel === 'email'
                            ? 'Mã xác thực 6 số đã được gửi về Gmail (kiểm tra Hộp thư đến hoặc Spam). Hiệu lực 5 phút.'
                            : 'Mã xác thực 6 số đã được gửi về tin nhắn điện thoại của bạn. Hiệu lực 5 phút.'
                          : registerDeliveryMeta?.channel === 'email'
                            ? 'Máy chủ chưa cấu hình SMTP/Gmail trong .env — dùng mã thử nghiệm (Dev) hoặc xem log server.'
                            : 'Máy chủ chưa cấu hình cổng SMS trong .env — dùng mã thử nghiệm (Dev) hoặc xem log server.'}
                      </Text>
                    </View>

                    {registerDeliveryMeta?.devOtp ? (
                      <Pressable
                        onPress={() => { setRegisterOtpCode(registerDeliveryMeta.devOtp || ''); setError(''); }}
                        style={styles.devOtpBanner}
                        accessibilityRole="button"
                      >
                        <Text style={styles.devOtpText}>
                          {`Mã thử nghiệm (Dev): ${registerDeliveryMeta.devOtp}  ·  Nhấn để điền`}
                        </Text>
                      </Pressable>
                    ) : null}

                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Mã xác thực 6 chữ số</Text>
                      <View style={styles.otpInputWrap}>
                        <TextInput
                          value={registerOtpCode}
                          onChangeText={(value) => { setRegisterOtpCode(value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                          placeholder="••••••"
                          placeholderTextColor={loginPalette.subtle}
                          keyboardType="number-pad"
                          maxLength={6}
                          textContentType="oneTimeCode"
                          onSubmitEditing={() => { void verifyRegisterOtp(); }}
                          returnKeyType="go"
                          style={styles.otpInput}
                          accessibilityLabel="Mã xác thực đăng ký 6 chữ số"
                        />
                      </View>
                    </View>

                    <Pressable
                      onPress={() => { void verifyRegisterOtp(); }}
                      disabled={busy || registerOtpCode.length !== 6}
                      style={({ pressed }) => [
                        styles.submitBtn,
                        (busy || registerOtpCode.length !== 6) && styles.modalPrimaryDisabled,
                        pressed && styles.submitBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Xác nhận mã và vào học ngay"
                    >
                      {busy ? <ActivityIndicator color={loginPalette.white} /> : (
                        <>
                          <ShieldCheck size={18} color={loginPalette.white} />
                          <Text style={styles.submitText}>Xác nhận mã &amp; Vào học ngay</Text>
                          <ArrowRight size={16} color={loginPalette.white} />
                        </>
                      )}
                    </Pressable>

                    <View style={styles.modalActions}>
                      <Pressable
                        onPress={() => { setRegisterOtpStep(false); setRegisterOtpCode(''); setError(''); }}
                        style={styles.modalSecondary}
                        accessibilityRole="button"
                      >
                        <Text style={styles.modalSecondaryText}>Sửa thông tin</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { void resendRegisterOtp(); }}
                        disabled={registerResending || registerCooldown > 0}
                        style={[styles.modalResendBtn, (registerResending || registerCooldown > 0) && styles.modalPrimaryDisabled]}
                        accessibilityRole="button"
                      >
                        <RefreshCw size={14} color={loginPalette.brandDark} />
                        <Text style={styles.modalResendText}>
                          {registerCooldown > 0 ? `Gửi lại (${registerCooldown}s)` : 'Gửi lại mã'}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    {mode === 'register' ? (
                      <View style={styles.rowFields}>
                        <View style={[styles.fieldGroup, styles.nameCol]}>
                          <Text style={styles.label}>Họ và tên</Text>
                          <View
                            style={[
                              styles.inputWrap,
                              focused === 'name' && styles.inputWrapFocused,
                              focused === 'name' && webFocusRingStyle,
                            ]}
                          >
                            <UserRound size={17} color={focused === 'name' ? loginPalette.brand : loginPalette.subtle} />
                            <TextInput
                              value={fullName}
                              onChangeText={setFullName}
                              placeholder="VD: Nguyễn Minh Anh"
                              placeholderTextColor={loginPalette.subtle}
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
                          <View
                            style={[
                              styles.inputWrap,
                              focused === 'age' && styles.inputWrapFocused,
                              focused === 'age' && webFocusRingStyle,
                            ]}
                          >
                            <TextInput
                              value={age}
                              onChangeText={(value) => setAge(value.replace(/\D/g, '').slice(0, 2))}
                              placeholder="20"
                              placeholderTextColor={loginPalette.subtle}
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
                      <View
                        style={[
                          styles.inputWrap,
                          focused === 'phone' && styles.inputWrapFocused,
                          focused === 'phone' && webFocusRingStyle,
                        ]}
                      >
                        <UserRound size={17} color={focused === 'phone' ? loginPalette.brand : loginPalette.subtle} />
                        <TextInput
                          value={phone}
                          onChangeText={(value) => { setPhone(value); setErrorCode(''); resetLoginLockHint(); }}
                          placeholder="0912345678 hoặc ten@gmail.com"
                          placeholderTextColor={loginPalette.subtle}
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
                      <View
                        style={[
                          styles.inputWrap,
                          focused === 'password' && styles.inputWrapFocused,
                          focused === 'password' && webFocusRingStyle,
                        ]}
                      >
                        <Lock size={17} color={focused === 'password' ? loginPalette.brand : loginPalette.subtle} />
                        <TextInput
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Nhập mật khẩu"
                          placeholderTextColor={loginPalette.subtle}
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
                          style={({ pressed }) => [styles.eyeBtn, pressed && styles.eyeBtnPressed]}
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? <EyeOff size={15} color={loginPalette.muted} /> : <Eye size={15} color={loginPalette.muted} />}
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
                          {saveBiometric ? <CheckCircle2 size={12} color={loginPalette.white} /> : null}
                        </View>
                        <Text style={styles.biometricRememberText}>Lưu đăng nhập bằng {biometricInfo.label}</Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={() => { void submit(); }}
                      disabled={busy || (mode === 'login' && lockSecondsLeft > 0)}
                      style={({ pressed }) => [
                        styles.submitBtn,
                        (pressed || busy || (mode === 'login' && lockSecondsLeft > 0)) && styles.submitBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={mode === 'register' ? 'Tạo tài khoản ngay' : 'Đăng nhập ngay'}
                    >
                      {busy ? <ActivityIndicator color={loginPalette.white} /> : mode === 'register' ? (
                        <>
                          <UserPlus size={18} color={loginPalette.white} />
                          <Text style={styles.submitText}>Tạo tài khoản ngay</Text>
                          <ArrowRight size={16} color={loginPalette.white} />
                        </>
                      ) : lockSecondsLeft > 0 ? (
                        <>
                          <Clock size={18} color={loginPalette.white} />
                          <Text style={styles.submitText}>{`Thử lại sau ${lockSecondsLeft}s`}</Text>
                        </>
                      ) : (
                        <>
                          <LogIn size={18} color={loginPalette.white} />
                          <Text style={styles.submitText}>Đăng nhập ngay</Text>
                          <ArrowRight size={16} color={loginPalette.white} />
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
                        <ScanFace size={18} color={loginPalette.brand} />
                        <View style={styles.flex}>
                          <Text style={styles.biometricButtonText}>Đăng nhập bằng {biometricInfo.label}</Text>
                          <Text style={styles.biometricButtonSub} numberOfLines={1}>
                            {biometricInfo.savedDisplayName || biometricInfo.savedContact}
                          </Text>
                        </View>
                        <ShieldCheck size={16} color={loginPalette.brand} />
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>

              {/* Thẻ phân luồng Dùng thử / Quay lại đăng nhập / Cấp TK Giảng viên */}
              <View style={styles.branchCard}>
                {mode === 'register' ? (
                  <>
                    <View style={styles.branchIconBadge}>
                      <LogIn size={18} color={loginPalette.brand} />
                    </View>
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
                    <View style={styles.branchIconBadge}>
                      <UserRound size={18} color={loginPalette.brand} />
                    </View>
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
                    <View style={styles.branchIconBadge}>
                      <Sparkles size={18} color={loginPalette.brand} />
                    </View>
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

              {/* Dải điểm nổi bật LMS giúp bố cục cân đối và tăng độ tin cậy */}
              <View style={styles.highlightsRow}>
                {LOGIN_HIGHLIGHTS.map(({ key, Icon, title, sub }) => (
                  <View key={key} style={styles.highlightChip}>
                    <View style={styles.highlightIconWrap}>
                      <Icon size={15} color={loginPalette.brand} />
                    </View>
                    <Text style={styles.highlightTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.highlightSub} numberOfLines={1}>{sub}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.footer}>
              <Pressable
                onPress={() => openAdminZalo()}
                style={({ pressed }) => [styles.supportPill, pressed && styles.supportPillPressed]}
                accessibilityRole="link"
                accessibilityLabel={`Chat Zalo Admin ${SUPPORT_HOTLINE_LABEL}`}
              >
                <MessageCircle size={15} color={loginPalette.brand} />
                <Text style={styles.footerText}>
                  Đăng ký tin học văn phòng 1 kèm 1{' '}
                  <Text style={styles.footerLink}>Chat Zalo</Text>
                </Text>
              </Pressable>

              <View style={styles.legalRow}>
                <Pressable onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL); }} hitSlop={8} accessibilityRole="link">
                  <Text style={styles.legalLink}>Chính sách bảo mật</Text>
                </Pressable>
                <Text style={styles.legalDot}>·</Text>
                <Pressable onPress={() => { void Linking.openURL(TERMS_OF_SERVICE_URL); }} hitSlop={8} accessibilityRole="link">
                  <Text style={styles.legalLink}>Điều khoản sử dụng</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea} />
        </ScrollView>
      </KeyboardAvoidingView>
      <ForgotPasswordModal
        visible={forgotOpen}
        initialRole={role}
        onClose={() => setForgotOpen(false)}
        onSwitchToRegister={(prefillContact) => {
          setForgotOpen(false);
          switchMode('register');
          if (prefillContact) setPhone(prefillContact);
        }}
      />
    </View>
  );
}

function ForgotPasswordModal({
  visible,
  initialRole,
  onClose,
  onSwitchToRegister,
}: {
  visible: boolean;
  initialRole: UserRole;
  onClose: () => void;
  onSwitchToRegister: (prefillContact: string) => void;
}) {
  const { verifyForgotPasswordOtp } = useAuth();
  const [step, setStep] = useState<'contact' | 'otp'>('contact');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notFoundAccount, setNotFoundAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [deliveryMeta, setDeliveryMeta] = useState<{
    channel: 'email' | 'sms';
    channelConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep('contact');
    setRole(initialRole);
    setPhone('');
    setOtp('');
    setError('');
    setNotFoundAccount(false);
    setResendCooldown(0);
    setDeliveryMeta(null);
  }, [initialRole, visible]);

  useEffect(() => {
    if (!visible || resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => {
      setResendCooldown((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [visible, resendCooldown]);

  const rawContact = phone.trim();
  const normalizedPhone = normalizePhone(rawContact);
  const normalizedEmail = EMAIL_RE.test(rawContact.toLowerCase()) ? rawContact.toLowerCase() : '';
  const contact = normalizedPhone
    ? { type: 'phone' as const, value: normalizedPhone }
    : normalizedEmail
      ? { type: 'email' as const, value: normalizedEmail }
      : null;

  const requestOtp = async (isResend = false) => {
    if (!contact) {
      setError('Số điện thoại hoặc Gmail không hợp lệ');
      return;
    }
    if (isResend) setResending(true);
    else setLoading(true);
    setError('');
    setNotFoundAccount(false);
    try {
      const res = await authService.requestForgotPasswordOtp(role, contact.value);
      setDeliveryMeta({
        channel: res.channel || (contact.type === 'email' ? 'email' : 'sms'),
        channelConfigured: res.channelConfigured !== false,
      });
      setResendCooldown(Number(res.resendAfterSec || 45));
      setStep('otp');
    } catch (reason) {
      if (reason instanceof MobileApiError && (reason.code === 'ACCOUNT_NOT_FOUND' || reason.status === 404)) {
        setNotFoundAccount(true);
      }
      setError(reason instanceof Error ? reason.message : 'Không gửi được mã xác nhận. Thử lại sau.');
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const verifyOtpAndEnter = async () => {
    const cleanOtp = otp.replace(/\D/g, '');
    if (!contact || cleanOtp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số mã xác nhận.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyForgotPasswordOtp(role, contact.value, cleanOtp);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Mã xác nhận không đúng hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboardWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}><KeyRound size={20} color={loginPalette.white} /></View>
              <View style={styles.flex}>
                <Text style={styles.modalTitle}>Quên mật khẩu</Text>
                <Text style={styles.modalSubtitle}>
                  {step === 'contact' ? 'Nhận mã xác nhận qua Gmail hoặc SĐT' : 'Nhập mã 6 số để vào đặt mật khẩu mới'}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Đóng">
                <X size={16} color={loginPalette.white} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              {step === 'contact' ? (
                <>
                  <Text style={styles.modalLabel}>Vai trò tài khoản</Text>
                  <View style={styles.modalRoleRow}>
                    {(['student', 'teacher'] as const).map((value) => {
                      const active = role === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => { setRole(value); setError(''); setNotFoundAccount(false); }}
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
                    {contact?.type === 'email' ? (
                      <Mail size={16} color={loginPalette.brand} />
                    ) : (
                      <Phone size={16} color={loginPalette.muted} />
                    )}
                    <TextInput
                      value={phone}
                      onChangeText={(value) => { setPhone(value); setError(''); setNotFoundAccount(false); }}
                      placeholder="0912345678 hoặc ten@gmail.com"
                      placeholderTextColor={loginPalette.subtle}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                      accessibilityLabel="Số điện thoại hoặc Gmail đăng ký"
                    />
                  </View>
                  {contact ? (
                    <View style={styles.confirmBox}>
                      <Text style={styles.confirmLabel}>Kênh nhận mã xác nhận</Text>
                      <Text style={styles.confirmText}>
                        {`${roleLabel(role)} · ${contact.type === 'email' ? 'Gửi Gmail' : 'Gửi tin nhắn SĐT'}: ${contact.value}`}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.hintBox}>
                      <Text style={styles.hintText}>
                        Nhập Gmail hoặc SĐT đã đăng ký — hệ thống sẽ gửi mã 6 số để bạn vào app đặt mật khẩu mới.
                      </Text>
                    </View>
                  )}
                  {error ? (
                    <View style={styles.errorStack} accessibilityRole="alert">
                      <View style={styles.errorBox}>
                        <AlertCircle size={15} color={loginPalette.errorText} />
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                      {notFoundAccount && role === 'student' ? (
                        <Pressable
                          onPress={() => onSwitchToRegister(contact?.value || rawContact)}
                          style={({ pressed }) => [styles.errorActionBtn, pressed && { opacity: 0.85 }]}
                          accessibilityRole="button"
                        >
                          <UserPlus size={15} color={loginPalette.white} />
                          <Text style={styles.errorActionText}>Đăng ký tài khoản ngay</Text>
                          <ArrowRight size={14} color={loginPalette.white} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => { void requestOtp(false); }}
                    disabled={loading || !contact}
                    style={[styles.modalPrimary, (loading || !contact) && styles.modalPrimaryDisabled]}
                    accessibilityRole="button"
                  >
                    {loading ? <ActivityIndicator color={loginPalette.white} /> : (
                      <>
                        <CheckCircle2 size={16} color={loginPalette.white} />
                        <Text style={styles.modalPrimaryText}>Gửi mã xác nhận</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={deliveryMeta?.channelConfigured ? styles.confirmBox : styles.warnBox}>
                    <Text style={deliveryMeta?.channelConfigured ? styles.confirmLabel : styles.warnLabel}>
                      {`${roleLabel(role)} · ${contact?.value || ''}`}
                    </Text>
                    <Text style={deliveryMeta?.channelConfigured ? styles.confirmSub : styles.warnText}>
                      {deliveryMeta?.channelConfigured
                        ? deliveryMeta.channel === 'email'
                          ? 'Mã xác nhận 6 số đã được gửi tới Gmail (kiểm tra Hộp thư đến hoặc Spam). Hiệu lực 5 phút.'
                          : 'Mã xác nhận 6 số đã được gửi về tin nhắn điện thoại của bạn. Hiệu lực 5 phút.'
                        : deliveryMeta?.channel === 'email'
                          ? 'Máy chủ chưa cấu hình SMTP/Gmail để gửi email tự động. Khi chạy cục bộ có thể xem OTP ở log server hoặc nhắn Zalo Admin.'
                          : 'Máy chủ chưa cấu hình cổng SMS gửi tin nhắn điện thoại. Hãy thử nhập Gmail đã đăng ký (nếu SMTP đã bật), xem log server dev hoặc nhắn Zalo Admin.'}
                    </Text>
                  </View>

                  <Text style={styles.modalLabel}>Mã xác nhận 6 chữ số</Text>
                  <View style={styles.otpInputWrap}>
                    <TextInput
                      value={otp}
                      onChangeText={(value) => { setOtp(value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      placeholder="••••••"
                      placeholderTextColor={loginPalette.subtle}
                      keyboardType="number-pad"
                      maxLength={6}
                      textContentType="oneTimeCode"
                      onSubmitEditing={() => { void verifyOtpAndEnter(); }}
                      returnKeyType="go"
                      style={styles.otpInput}
                      accessibilityLabel="Mã xác nhận 6 chữ số"
                    />
                  </View>

                  {error ? (
                    <View style={styles.errorStack} accessibilityRole="alert">
                      <View style={styles.errorBox}>
                        <AlertCircle size={15} color={loginPalette.errorText} />
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                      {notFoundAccount && role === 'student' ? (
                        <Pressable
                          onPress={() => onSwitchToRegister(contact?.value || rawContact)}
                          style={({ pressed }) => [styles.errorActionBtn, pressed && { opacity: 0.85 }]}
                          accessibilityRole="button"
                        >
                          <UserPlus size={15} color={loginPalette.white} />
                          <Text style={styles.errorActionText}>Đăng ký tài khoản ngay</Text>
                          <ArrowRight size={14} color={loginPalette.white} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => { void verifyOtpAndEnter(); }}
                    disabled={loading || otp.length !== 6}
                    style={[styles.modalPrimary, (loading || otp.length !== 6) && styles.modalPrimaryDisabled]}
                    accessibilityRole="button"
                  >
                    {loading ? <ActivityIndicator color={loginPalette.white} /> : (
                      <>
                        <ShieldCheck size={16} color={loginPalette.white} />
                        <Text style={styles.modalPrimaryText}>Xác nhận mã &amp; Đổi mật khẩu</Text>
                        <ArrowRight size={15} color={loginPalette.white} />
                      </>
                    )}
                  </Pressable>

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={() => { setStep('contact'); setOtp(''); setError(''); }}
                      style={styles.modalSecondary}
                      accessibilityRole="button"
                    >
                      <Text style={styles.modalSecondaryText}>Đổi SĐT / Gmail</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { void requestOtp(true); }}
                      disabled={resending || resendCooldown > 0}
                      style={[styles.modalResendBtn, (resending || resendCooldown > 0) && styles.modalPrimaryDisabled]}
                      accessibilityRole="button"
                    >
                      <RefreshCw size={14} color={loginPalette.brandDark} />
                      <Text style={styles.modalResendText}>
                        {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : 'Gửi lại mã'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}

              <Pressable
                onPress={() => openAdminZalo('[THẮNG TIN HỌC] Hỗ trợ khôi phục mật khẩu')}
                style={styles.modalSupportLink}
                accessibilityRole="link"
              >
                <MessageCircle size={14} color={loginPalette.brand} />
                <Text style={styles.modalSupportText}>Cần Admin hỗ trợ? Chat Zalo Admin</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const webFocusRingStyle = Platform.OS === 'web'
  ? ({ boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.14)' } as object)
  : null;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: loginPalette.canvas },
  topSafeArea: { backgroundColor: loginPalette.heroBg },
  bottomSafeArea: { backgroundColor: loginPalette.canvas },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: loginPalette.canvas,
  },
  heroBand: {
    backgroundColor: loginPalette.heroBg,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 56,
    position: 'relative',
  },
  heroGlowCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroGlowRight: {
    width: 190,
    height: 190,
    top: -54,
    right: -40,
  },
  heroGlowLeft: {
    width: 140,
    height: 140,
    bottom: -48,
    left: -34,
    backgroundColor: 'rgba(4, 120, 87, 0.45)',
  },
  heroInner: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  logoCard: {
    backgroundColor: loginPalette.white,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: loginPalette.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  logo: {
    width: 84,
    height: 28,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: loginPalette.white,
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  brandTagline: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  mascotHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mascotImg: {
    width: 44,
    height: 44,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 78, 59, 0.36)',
    borderWidth: 1,
    borderColor: 'rgba(209, 250, 229, 0.24)',
    marginBottom: 8,
  },
  heroBadgeText: {
    color: '#ECFDF5',
    fontSize: 11.5,
    fontWeight: '700',
  },
  heroTitle: {
    color: loginPalette.white,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  heroSubtitle: {
    color: '#ECFDF5',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 19.5,
    marginTop: 4,
    opacity: 0.94,
  },
  bodyWrap: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    marginTop: -34,
    paddingHorizontal: 16,
    paddingBottom: 20,
    justifyContent: 'space-between',
    gap: 18,
  },
  mainStack: {
    gap: 14,
  },
  formCard: {
    backgroundColor: loginPalette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: loginPalette.mintBorder,
    padding: 20,
    gap: 15,
    shadowColor: loginPalette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  roleTrack: {
    flexDirection: 'row',
    backgroundColor: loginPalette.trackBg,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: loginPalette.border,
  },
  roleTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  roleTabActive: {
    backgroundColor: loginPalette.white,
    borderWidth: 1,
    borderColor: loginPalette.mintBorder,
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roleTabPressed: {
    opacity: 0.78,
  },
  roleTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: loginPalette.muted,
  },
  roleTabTextActive: {
    color: loginPalette.brandText,
    fontWeight: '800',
  },
  registerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: loginPalette.brandSoft,
    borderWidth: 1,
    borderColor: loginPalette.brandSoftBorder,
    paddingHorizontal: 12,
  },
  registerPillText: {
    color: loginPalette.brandText,
    fontSize: 12.5,
    fontWeight: '700',
  },
  errorStack: {
    gap: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: loginPalette.errorBg,
    borderWidth: 1,
    borderColor: loginPalette.errorBorder,
  },
  errorText: {
    flex: 1,
    color: loginPalette.errorText,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  lockWarnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lockWarnText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  errorActionBtn: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: loginPalette.brand,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  errorActionText: {
    color: loginPalette.white,
    fontSize: 13.5,
    fontWeight: '800',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  nameCol: {
    flex: 1,
  },
  ageCol: {
    width: 82,
  },
  fieldGroup: {
    gap: 7,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: loginPalette.inkBody,
    fontSize: 13,
    fontWeight: '700',
  },
  forgotInlineLink: {
    color: loginPalette.brand,
    fontSize: 13,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: loginPalette.surfaceMuted,
    borderWidth: 1.5,
    borderColor: loginPalette.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrapFocused: {
    backgroundColor: loginPalette.white,
    borderColor: loginPalette.brand,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: loginPalette.ink,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  eyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: loginPalette.trackBg,
  },
  eyeBtnPressed: {
    opacity: 0.75,
  },
  eyeBtnText: {
    color: loginPalette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: loginPalette.brand,
    borderBottomWidth: 3,
    borderBottomColor: loginPalette.brandDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 2,
    shadowColor: loginPalette.brand,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  submitText: {
    color: loginPalette.white,
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  biometricRememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  biometricCheckbox: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: loginPalette.brandSoftBorder,
    backgroundColor: loginPalette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricCheckboxChecked: {
    backgroundColor: loginPalette.brand,
    borderColor: loginPalette.brand,
  },
  biometricRememberText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: loginPalette.muted,
  },
  biometricButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: loginPalette.brandSoftBorder,
    backgroundColor: loginPalette.brandSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  biometricButtonText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: loginPalette.brandText,
  },
  biometricButtonSub: {
    fontSize: 12,
    color: loginPalette.brandDark,
    marginTop: 1,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: loginPalette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: loginPalette.mintBorder,
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: loginPalette.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  branchIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: loginPalette.brandSoft,
    borderWidth: 1,
    borderColor: loginPalette.brandSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchCopy: {
    flex: 1,
    minWidth: 0,
  },
  branchTitle: {
    color: loginPalette.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  branchSub: {
    color: loginPalette.muted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16.5,
  },
  branchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: loginPalette.brandSoft,
    borderWidth: 1,
    borderColor: loginPalette.brandSoftBorder,
  },
  branchBtnPressed: {
    opacity: 0.8,
  },
  branchBtnText: {
    color: loginPalette.brandDark,
    fontSize: 13,
    fontWeight: '800',
  },
  highlightsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  highlightChip: {
    flex: 1,
    backgroundColor: loginPalette.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: loginPalette.mintBorder,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
  },
  highlightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: loginPalette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  highlightTitle: {
    color: loginPalette.ink,
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  highlightSub: {
    color: loginPalette.muted,
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  supportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: loginPalette.surface,
    borderWidth: 1,
    borderColor: loginPalette.mintBorder,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  supportPillPressed: {
    opacity: 0.8,
  },
  footerText: {
    color: loginPalette.muted,
    fontSize: 12.5,
    fontWeight: '600',
  },
  footerLink: {
    color: loginPalette.brandDark,
    fontWeight: '800',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legalLink: {
    color: loginPalette.subtle,
    fontSize: 11.5,
    fontWeight: '600',
  },
  legalDot: {
    color: loginPalette.subtle,
    fontSize: 11.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    justifyContent: 'center',
    padding: 18,
  },
  modalKeyboardWrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: loginPalette.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: loginPalette.mintBorder,
  },
  modalHeader: {
    backgroundColor: loginPalette.heroDeep,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { color: loginPalette.white, fontSize: 16, fontWeight: '800' },
  modalSubtitle: { color: '#D1FAE5', fontSize: 12, fontWeight: '600', marginTop: 1 },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: 18, gap: 12 },
  modalLabel: { color: loginPalette.inkBody, fontSize: 13, fontWeight: '700' },
  modalRoleRow: {
    flexDirection: 'row',
    backgroundColor: loginPalette.trackBg,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: loginPalette.border,
  },
  modalRole: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoleActive: {
    backgroundColor: loginPalette.white,
    borderWidth: 1,
    borderColor: loginPalette.mintBorder,
  },
  modalRoleText: { color: loginPalette.muted, fontSize: 13.5, fontWeight: '700' },
  modalRoleTextActive: { color: loginPalette.brandText, fontWeight: '800' },
  modalInputWrap: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: loginPalette.surfaceMuted,
    borderWidth: 1.5,
    borderColor: loginPalette.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmBox: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: loginPalette.brandSoft,
    borderWidth: 1,
    borderColor: loginPalette.brandSoftBorder,
    gap: 3,
  },
  confirmLabel: { color: loginPalette.brandText, fontSize: 11.5, fontWeight: '800' },
  confirmText: { color: loginPalette.ink, fontSize: 13.5, fontWeight: '700' },
  confirmSub: { color: loginPalette.brandDark, fontSize: 12.5, lineHeight: 17.5, fontWeight: '600' },
  warnBox: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 3,
  },
  warnLabel: { color: '#92400E', fontSize: 11.5, fontWeight: '800' },
  warnText: { color: '#B45309', fontSize: 12, lineHeight: 17.5, fontWeight: '600' },
  devOtpBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
  },
  devOtpText: {
    color: '#92400E',
    fontSize: 12.5,
    fontWeight: '800',
  },
  otpInputWrap: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: loginPalette.surfaceMuted,
    borderWidth: 1.5,
    borderColor: loginPalette.mintBorder,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  otpInput: {
    color: loginPalette.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  hintBox: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: loginPalette.surfaceMuted,
    borderWidth: 1,
    borderColor: loginPalette.border,
  },
  hintText: { color: loginPalette.muted, fontSize: 12.5, lineHeight: 17.5, fontWeight: '600' },
  modalPrimary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: loginPalette.brand,
    borderBottomWidth: 3,
    borderBottomColor: loginPalette.brandDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalPrimaryDisabled: { opacity: 0.45 },
  modalPrimaryText: { color: loginPalette.white, fontSize: 14.5, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: loginPalette.border,
    backgroundColor: loginPalette.surfaceMuted,
  },
  modalSecondaryText: { color: loginPalette.ink, fontSize: 13, fontWeight: '700' },
  modalResendBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: loginPalette.brandSoftBorder,
    backgroundColor: loginPalette.brandSoft,
  },
  modalResendText: { color: loginPalette.brandDark, fontSize: 13, fontWeight: '800' },
  modalSupportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: loginPalette.border,
  },
  modalSupportText: { color: loginPalette.brandDark, fontSize: 12.5, fontWeight: '700' },
});
