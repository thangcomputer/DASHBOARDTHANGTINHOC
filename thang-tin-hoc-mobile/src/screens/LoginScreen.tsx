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
  AlertCircle, Award, BookOpen, CheckCircle2, Eye, EyeOff, GraduationCap, Headphones, KeyRound, Lock, LogIn,
  MessageCircle, Monitor, Phone, Share2, Sparkles, UserPlus, UserRound, X,
} from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import { mobileApiRequest } from '../services/apiClient';
import { getWebLogoUrl } from '../services/webSettingsApi';
import type { UserRole } from '../types';

const ADMIN_ZALO_PHONE = String(process.env.EXPO_PUBLIC_SUPPORT_PHONE || '0935758462').replace(/\D/g, '');
const SUPPORT_HOTLINE_LABEL = '093 5758 462';

const palette = {
  page: '#0F172A',
  panel: '#1E293B',
  field: 'rgba(30, 41, 59, 0.5)',
  fieldFocus: '#1E293B',
  border: 'rgba(255, 255, 255, 0.1)',
  white: '#FFFFFF',
  text: '#E2E8F0',
  muted: '#94A3B8',
  subtle: '#64748B',
  brand: '#059669',
  brandSoft: 'rgba(5, 150, 105, 0.12)',
  brandBorder: 'rgba(16, 185, 129, 0.28)',
  brandText: '#34D399',
  red: '#10B981',
  redSoft: 'rgba(16, 185, 129, 0.1)',
  redBorder: 'rgba(16, 185, 129, 0.2)',
  redText: '#34D399',
  emeraldSoft: 'rgba(16, 185, 129, 0.1)',
  emeraldBorder: 'rgba(16, 185, 129, 0.25)',
  emeraldText: '#A7F3D0',
  skySoft: 'rgba(14, 165, 233, 0.1)',
  skyBorder: 'rgba(14, 165, 233, 0.2)',
  skyText: '#7DD3FC',
};

const EMAIL_RE = /^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/;

/** Same rule as web validators.normalizePhone: 0… or +84…, mobile prefixes 3/5/7/8/9. */
function normalizePhone(value: string) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s.\-()]+$/.test(raw) || raw.slice(1).includes('+')) return '';
  const compact = raw.replace(/[\s.\-()]/g, '');
  const canonical = compact.startsWith('+84') ? `0${compact.slice(3)}` : compact.startsWith('+') ? '' : compact;
  return /^0[35789]\d{8}$/.test(canonical) ? canonical : '';
}

const PHONE_MAX_DIGITS = 11;

/** Same rule as web validators.limitPhoneInput: digits only (leading "+" allowed), at most 11 digits. */
function limitPhoneInput(value: string) {
  const raw = String(value || '');
  const plus = raw.trimStart().startsWith('+') ? '+' : '';
  return plus + raw.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
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

export function LoginScreen() {
  const { signIn, isSigningIn, authError } = useAuth();
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

  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  useEffect(() => {
    let alive = true;
    getWebLogoUrl().then((url) => { if (alive) setLogoUrl(url); }).catch(() => { });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    // Chrome autofill tô nền xanh nhạt + chữ đen lên ô nhập nền tối.
    const style = document.createElement('style');
    style.textContent = 'input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active'
      + '{-webkit-text-fill-color:#fff;caret-color:#fff;transition:background-color 600000s 0s,color 600000s 0s;}';
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
      await signIn(role, contact.value, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.');
    }
  };

  const busy = isSigningIn || isRegistering;
  const message = error || authError;
  const auraScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const auraOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.backdrop} pointerEvents="none">
        <Animated.View style={[styles.aura, styles.auraRed, { opacity: auraOpacity, transform: [{ scale: auraScale }] }]} />
        <Animated.View style={[styles.aura, styles.auraBlue, { opacity: auraOpacity }]} />
        <View style={[styles.aura, styles.auraCenter]} />
        <View style={styles.ringTopLeft} />
        <View style={styles.ringBottomRight} />
        <View style={styles.ringInner} />
        <GraduationCap size={64} color="rgba(110,231,183,0.06)" style={[styles.motif, { top: '8%', left: '6%', transform: [{ rotate: '-14deg' }] }]} />
        <BookOpen size={52} color="rgba(255,255,255,0.05)" style={[styles.motif, { top: '28%', right: '5%', transform: [{ rotate: '12deg' }] }]} />
        <Award size={48} color="rgba(56,189,248,0.05)" style={[styles.motif, { bottom: '20%', left: '4%', transform: [{ rotate: '10deg' }] }]} />
        <Monitor size={56} color="rgba(255,255,255,0.045)" style={[styles.motif, { bottom: '6%', right: '8%', transform: [{ rotate: '-8deg' }] }]} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoDroplet}>
            {logoUrl && !logoFailed ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="DewSkill"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="DewSkill"
              />
            )}
            <View style={styles.dropletShine} pointerEvents="none" />
          </View>

          <View style={styles.card}>
            <View style={styles.chip}>
              <GraduationCap size={14} color="#6EE7B7" />
              <Text style={styles.chipText}>Nền tảng học Tin học văn phòng</Text>
            </View>
            <Text style={styles.title}>{mode === 'register' ? 'Tạo tài khoản mới' : 'Đăng nhập tài khoản'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'register'
                ? 'Đăng ký miễn phí để bắt đầu học và luyện tập ngay.'
                : 'Chào mừng trở lại! Vui lòng nhập thông tin của bạn.'}
            </Text>

            {mode === 'login' ? (
              <View style={styles.roleTabs} accessibilityRole="tablist" accessibilityLabel="Chọn vai trò đăng nhập">
                {(['student', 'teacher'] as const).map((value) => {
                  const active = role === value;
                  const Icon = value === 'teacher' ? UserRound : GraduationCap;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => chooseRole(value)}
                      style={[styles.roleTab, active && styles.roleTabActive]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Icon size={16} color={active ? palette.white : palette.muted} />
                      <Text style={[styles.roleTabText, active && styles.roleTabTextActive]}>{roleLabel(value)}</Text>
                      {active ? <View style={styles.dropletShine} pointerEvents="none" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {message ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <AlertCircle size={18} color={palette.redText} />
                <Text style={styles.errorText}>{message}</Text>
              </View>
            ) : null}

            {mode === 'register' ? (
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, styles.nameCol]}>
                  <Text style={styles.label}>Họ và tên</Text>
                  <View style={[styles.inputWrap, focused === 'name' && styles.inputWrapFocused]}>
                    <UserRound size={17} color={focused === 'name' ? palette.brand : palette.muted} />
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="VD: Nguyễn Văn A"
                      placeholderTextColor={palette.muted}
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
                    <Sparkles size={16} color={focused === 'age' ? palette.brand : palette.muted} />
                    <TextInput
                      value={age}
                      onChangeText={(value) => setAge(value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="18"
                      placeholderTextColor={palette.muted}
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
                <UserRound size={18} color={focused === 'phone' ? palette.brand : palette.muted} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="VD: 0912345678 hoặc ten@gmail.com"
                  placeholderTextColor={palette.muted}
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
              <Text style={styles.label}>{mode === 'register' ? 'Mật khẩu (tối thiểu 6 ký tự)' : 'Mật khẩu'}</Text>
              <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocused]}>
                <Lock size={18} color={focused === 'password' ? palette.brand : palette.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={palette.muted}
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
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} color={palette.muted} /> : <Eye size={18} color={palette.muted} />}
                </Pressable>
              </View>
            </View>

            {mode === 'login' ? (
              <Pressable onPress={() => setForgotOpen(true)} style={styles.forgotLink} accessibilityRole="button">
                <KeyRound size={12} color={palette.muted} />
                <Text style={styles.forgotLinkText}>Quên mật khẩu?</Text>
              </Pressable>
            ) : (
              <View style={styles.registerSpacer} />
            )}

            <Pressable
              onPress={() => { void submit(); }}
              disabled={busy}
              style={({ pressed }) => [styles.submit, (pressed || busy) && styles.submitPressed]}
              accessibilityRole="button"
              accessibilityLabel={mode === 'register' ? 'Tạo tài khoản ngay' : 'Đăng nhập ngay'}
            >
              <View style={styles.submitShine} pointerEvents="none" />
              {busy ? <ActivityIndicator color={palette.white} /> : mode === 'register' ? (
                <>
                  <UserPlus size={18} color={palette.white} />
                  <Text style={styles.submitText}>Tạo tài khoản ngay</Text>
                </>
              ) : (
                <>
                  <LogIn size={18} color={palette.white} />
                  <Text style={styles.submitText}>Đăng nhập ngay</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.highlights}>
            {[
              { icon: BookOpen, label: 'Học mọi lúc' },
              { icon: Award, label: 'Thi chứng nhận' },
              { icon: Headphones, label: 'Hỗ trợ tận tâm' },
            ].map(({ icon: Icon, label }) => (
              <View key={label} style={styles.highlight}>
                <View style={styles.highlightIcon}><Icon size={15} color="#6EE7B7" /></View>
                <Text style={styles.highlightText}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            {mode === 'login' ? (
              <Text style={styles.footerText}>
                Chưa có tài khoản?{' '}
                <Text style={styles.footerCreateLink} onPress={() => switchMode('register')} accessibilityRole="button">
                  Tạo tài khoản mới
                </Text>
              </Text>
            ) : (
              <Text style={styles.footerText}>
                Đã có tài khoản?{' '}
                <Text style={styles.footerCreateLink} onPress={() => switchMode('login')} accessibilityRole="button">
                  Đăng nhập ngay
                </Text>
              </Text>
            )}
            <Text style={styles.footerSubText}>
              Cần hỗ trợ?{' '}
              <Text style={styles.footerLink} onPress={() => openAdminZalo()} accessibilityRole="link">Liên hệ Admin</Text>
            </Text>
            <Text style={styles.supportTitle}>Hỗ trợ kỹ thuật</Text>
            <Text style={styles.supportText}>Hotline: {SUPPORT_HOTLINE_LABEL}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ForgotPasswordModal visible={forgotOpen} initialRole={role} onClose={() => setForgotOpen(false)} />
    </SafeAreaView>
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
            <View style={styles.modalHeaderIcon}><KeyRound size={20} color={palette.white} /></View>
            <View style={styles.flex}>
              <Text style={styles.modalTitle}>Quên mật khẩu</Text>
              <Text style={styles.modalSubtitle}>{sentMessage ? 'Tin nhắn đã sẵn - chỉ việc gửi' : 'Nhập SĐT hoặc Gmail › xác nhận'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={16} color={palette.white} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            {!sentMessage ? (
              <>
                <Text style={styles.modalLabel}>Vai trò</Text>
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
                  <Phone size={16} color={palette.subtle} />
                  <TextInput
                    value={phone}
                    onChangeText={(value) => { setPhone(value); setError(''); }}
                    placeholder="VD: 0912345678 hoặc ten@gmail.com"
                    placeholderTextColor={palette.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    accessibilityLabel="Số điện thoại hoặc Gmail đăng ký"
                  />
                </View>
                {contact ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmLabel}>Dòng xác nhận</Text>
                    <Text style={styles.confirmText}>{`Xác nhận: ${roleLabel(role)} · ${contact.type === 'phone' ? 'SĐT' : 'Gmail'} ${contact.value}`}</Text>
                  </View>
                ) : (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintText}>Nhập SĐT hoặc Gmail đăng ký - sẽ hiện dòng xác nhận trước khi tạo tin nhắn gửi Admin.</Text>
                  </View>
                )}
                {error ? (
                  <View style={styles.errorBox}>
                    <AlertCircle size={14} color={palette.redText} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => { void confirm(); }}
                  disabled={loading || !contact}
                  style={[styles.modalPrimary, (loading || !contact) && styles.modalPrimaryDisabled]}
                  accessibilityRole="button"
                >
                  {loading ? <ActivityIndicator color={palette.white} /> : (
                    <>
                      <CheckCircle2 size={16} color={palette.white} />
                      <Text style={styles.modalPrimaryText}>Xác nhận</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.sentHeader}>
                  <View style={styles.sentIcon}><CheckCircle2 size={28} color="#34D399" /></View>
                  <Text style={styles.sentTitle}>Đã ghi nhận yêu cầu</Text>
                  <Text style={styles.sentSubtitle}>{`${roleLabel(role)}: ${contact?.value || ''}`}</Text>
                </View>
                <View style={styles.messageBox}>
                  <Text style={styles.modalLabel}>Nội dung tin nhắn</Text>
                  <Text style={styles.messageText} selectable>{sentMessage}</Text>
                </View>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => { void Share.share({ message: sentMessage }); }}
                    style={styles.modalSecondary}
                    accessibilityRole="button"
                  >
                    <Share2 size={16} color={palette.white} />
                    <Text style={styles.modalSecondaryText}>Chia sẻ</Text>
                  </Pressable>
                  <Pressable onPress={() => openAdminZalo(sentMessage)} style={[styles.modalPrimary, styles.flex]} accessibilityRole="button">
                    <MessageCircle size={16} color={palette.white} />
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
  safe: { flex: 1, backgroundColor: palette.page },
  flex: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: '#091122',
    backgroundImage: 'linear-gradient(160deg, #07121E 0%, #0D192F 46%, #0B1F24 100%)',
  } as never,
  aura: { position: 'absolute', width: 420, height: 420, borderRadius: 210 },
  auraRed: {
    top: -160,
    right: -140,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    backgroundImage: 'radial-gradient(circle, rgba(16, 185, 129, 0.36) 0%, rgba(16, 185, 129, 0) 68%)',
  } as never,
  auraBlue: {
    bottom: -180,
    left: -160,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    backgroundImage: 'radial-gradient(circle, rgba(14, 165, 233, 0.28) 0%, rgba(14, 165, 233, 0) 68%)',
  } as never,
  auraCenter: {
    top: '10%',
    left: '50%',
    marginLeft: -210,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    backgroundImage: 'radial-gradient(circle, rgba(52, 211, 153, 0.14) 0%, rgba(52, 211, 153, 0) 65%)',
  } as never,
  ringTopLeft: {
    position: 'absolute',
    top: -90,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.08)',
  },
  ringBottomRight: {
    position: 'absolute',
    bottom: -110,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.08)',
  },
  ringInner: {
    position: 'absolute',
    top: '18%',
    right: -130,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  motif: { position: 'absolute' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  logoDroplet: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    marginBottom: 22,
    overflow: 'hidden',
    boxShadow: '0px 10px 26px rgba(2, 6, 23, 0.55), 0px 0px 0px 4px rgba(255, 255, 255, 0.06), inset 0px 3px 4px rgba(255, 255, 255, 1), inset 0px -4px 8px rgba(148, 163, 184, 0.35)',
  },
  dropletShine: {
    position: 'absolute',
    top: 2,
    left: '12%',
    right: '12%',
    height: '42%',
    borderRadius: 999,
    backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0))',
  } as never,
  logo: { width: 176, height: 46 },
  logoFallback: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.brand, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: palette.brand, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  card: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    boxShadow: '0px 28px 56px rgba(2, 6, 23, 0.6), inset 0px 1px 0px rgba(255, 255, 255, 0.1), inset 0px -1px 0px rgba(255, 255, 255, 0.03)',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  chipText: { color: '#6EE7B7', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  roleTabs: {
    flexDirection: 'row',
    padding: 5,
    gap: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    marginBottom: 18,
    boxShadow: 'inset 0px 2px 6px rgba(0, 0, 0, 0.55), inset 0px -1px 0px rgba(255, 255, 255, 0.06)',
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    overflow: 'hidden',
  },
  roleTabActive: {
    backgroundColor: palette.brand,
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 55%, #047857 100%)',
    boxShadow: '0px 8px 18px rgba(4, 120, 87, 0.45), inset 0px 2px 3px rgba(255, 255, 255, 0.4), inset 0px -3px 6px rgba(4, 120, 87, 0.55)',
  } as never,
  roleTabText: { color: palette.muted, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  roleTabTextActive: { color: palette.white },
  title: { color: palette.white, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: palette.muted, fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 20 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: palette.redSoft,
    borderWidth: 1,
    borderColor: palette.redBorder,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: palette.redText, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  fieldGroup: { marginBottom: 14, gap: 6 },
  rowFields: { flexDirection: 'row', gap: 10 },
  nameCol: { flex: 1, minWidth: 0 },
  ageCol: { width: 92 },
  registerSpacer: { height: 6 },
  label: { color: palette.muted, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    boxShadow: 'inset 0px 2px 6px rgba(0, 0, 0, 0.45), inset 0px -1px 0px rgba(255, 255, 255, 0.05)',
  },
  inputWrapFocused: {
    borderColor: 'rgba(16, 185, 129, 0.75)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    boxShadow: '0px 0px 0px 4px rgba(16, 185, 129, 0.16), inset 0px 2px 6px rgba(0, 0, 0, 0.45)',
  },
  input: { flex: 1, color: palette.white, fontSize: 16, fontWeight: '600', paddingVertical: 12, outlineStyle: 'none' } as never,
  forgotLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', paddingVertical: 4, marginBottom: 16 },
  forgotLinkText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  submit: {
    minHeight: 56,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: palette.brand,
    backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 55%, #047857 100%)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0px 14px 28px rgba(4, 120, 87, 0.45), inset 0px 2px 4px rgba(255, 255, 255, 0.4), inset 0px -4px 8px rgba(4, 120, 87, 0.55)',
  } as never,
  submitShine: {
    position: 'absolute',
    top: 3,
    left: '8%',
    right: '8%',
    height: '45%',
    borderRadius: 999,
    backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0))',
  } as never,
  submitPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  submitText: { color: palette.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.8 },
  highlights: { flexDirection: 'row', gap: 8, marginTop: 18 },
  highlight: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.07)',
  },
  highlightIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.18)',
    boxShadow: 'inset 0px 2px 3px rgba(255, 255, 255, 0.12), inset 0px -2px 4px rgba(0, 0, 0, 0.25)',
  },
  highlightText: { color: palette.text, fontSize: 11, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 22, gap: 6 },
  footerText: { color: palette.muted, fontSize: 14, fontWeight: '500' },
  footerCreateLink: { color: '#34D399', fontWeight: '900' },
  footerSubText: { color: palette.subtle, fontSize: 13, fontWeight: '500', marginTop: 2 },
  footerLink: { color: palette.white, fontWeight: '900' },
  supportTitle: { color: palette.subtle, fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginTop: 18 },
  supportText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 24, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: palette.brand,
    backgroundImage: 'linear-gradient(90deg, #059669, #0D9488)',
  } as never,
  modalHeaderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: palette.white, fontSize: 18, fontWeight: '900' },
  modalSubtitle: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 12, fontWeight: '500' },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.12)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20, gap: 12 },
  modalLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  modalRoleRow: { flexDirection: 'row', gap: 8 },
  modalRole: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: palette.border, alignItems: 'center' },
  modalRoleActive: { borderColor: '#10B981', backgroundColor: palette.brandSoft },
  modalRoleText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
  modalRoleTextActive: { color: palette.brandText },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.page,
  },
  confirmBox: { padding: 12, borderRadius: 12, backgroundColor: palette.emeraldSoft, borderWidth: 1, borderColor: palette.emeraldBorder, gap: 2 },
  confirmLabel: { color: 'rgba(52, 211, 153, 0.8)', fontSize: 11, fontWeight: '700' },
  confirmText: { color: palette.emeraldText, fontSize: 14, fontWeight: '700' },
  hintBox: { padding: 12, borderRadius: 12, backgroundColor: palette.skySoft, borderWidth: 1, borderColor: palette.skyBorder },
  hintText: { color: palette.skyText, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  modalPrimary: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.brand,
    backgroundImage: 'linear-gradient(90deg, #059669, #0D9488)',
  } as never,
  modalPrimaryDisabled: { opacity: 0.5 },
  modalPrimaryText: { color: palette.white, fontSize: 14, fontWeight: '900' },
  sentHeader: { alignItems: 'center', gap: 6 },
  sentIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { color: palette.white, fontSize: 16, fontWeight: '800' },
  sentSubtitle: { color: palette.muted, fontSize: 14 },
  messageBox: { padding: 12, borderRadius: 12, backgroundColor: palette.page, borderWidth: 1, borderColor: palette.border, gap: 6 },
  messageText: { color: palette.text, fontSize: 12, lineHeight: 18, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalSecondaryText: { color: palette.white, fontSize: 14, fontWeight: '700' },
  modalBack: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  modalBackText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
});
