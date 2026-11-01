import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Eye, EyeOff, GraduationCap, UserRound } from 'lucide-react-native';
import { FormField, PrimaryButton } from '../components/ui';
import { useAuth } from '../app/AuthContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { UserRole } from '../types';

export function LoginScreen() {
  const { signIn, isSigningIn, authError } = useAuth();
  const [role, setRole] = useState<UserRole>('student');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const chooseRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setError('');
  };

  const submit = async () => {
    setError('');
    try {
      await signIn(role, phone, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandMark}><BookOpen color="#FFFFFF" size={27} strokeWidth={2.2} /></View>
          <Text style={styles.brandName}>THẮNG TIN HỌC</Text>
          <Text style={styles.eyebrow}>HỌC TẬP, THEO CÁCH CỦA BẠN</Text>
          <Text style={styles.welcome}>Chào mừng{'\n'}bạn quay trở lại</Text>
          <Text style={styles.intro}>Dùng số điện thoại và mật khẩu thật đang sử dụng trên website.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Bạn đang đăng nhập với vai trò</Text>
            <View style={styles.roleSwitch}>
              <RoleButton active={role === 'student'} title="Học viên" icon={<GraduationCap size={18} color={role === 'student' ? colors.brandDark : colors.muted} />} onPress={() => chooseRole('student')} />
              <RoleButton active={role === 'teacher'} title="Giảng viên" icon={<UserRound size={18} color={role === 'teacher' ? colors.brandDark : colors.muted} />} onPress={() => chooseRole('teacher')} />
            </View>

            <FormField
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              placeholder="Số điện thoại tài khoản Web"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              accessibilityLabel="Số điện thoại"
            />
            <View style={styles.passwordField}>
              <FormField
                label="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                placeholder="Nhập mật khẩu"
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                accessibilityLabel="Mật khẩu"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((shown) => !shown)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={19} color={colors.muted} /> : <Eye size={19} color={colors.muted} />}
              </Pressable>
            </View>
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <PrimaryButton title="Đăng nhập" onPress={submit} loading={isSigningIn} />

            <Pressable
              onPress={() => Alert.alert('Quên mật khẩu', 'Vui lòng liên hệ trung tâm để được hỗ trợ đặt lại mật khẩu.')}
              accessibilityRole="button"
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>{Platform.OS === 'web'
            ? 'Phiên đăng nhập được giữ trong tab trình duyệt hiện tại'
            : 'Đăng nhập an toàn bằng phiên mobile của hệ thống'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleButton({
  active,
  title,
  icon,
  onPress,
}: {
  active: boolean;
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.roleButton, active && styles.roleButtonActive]}
    >
      <View style={[styles.roleIcon, active && styles.roleIconActive]}>{icon}</View>
      <Text style={[styles.roleText, active && styles.roleTextActive]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  brandMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  brandName: { color: colors.brandDark, fontWeight: '900', fontSize: typography.small, letterSpacing: 1.8 },
  eyebrow: { color: colors.brand, fontWeight: '800', fontSize: typography.micro, letterSpacing: 1.4, marginTop: spacing.xxxl },
  welcome: { color: colors.ink, fontSize: typography.hero, lineHeight: 40, letterSpacing: -1, fontWeight: '800', marginTop: spacing.md },
  intro: { color: colors.muted, fontSize: typography.body, marginTop: spacing.sm, lineHeight: 22 },
  form: { marginTop: spacing.xxl, gap: spacing.lg },
  label: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  roleSwitch: { flexDirection: 'row', gap: spacing.md },
  roleButton: { flex: 1, minHeight: 58, borderRadius: radius.sm, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  roleButtonActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  roleIcon: {},
  roleIconActive: {},
  roleText: { color: colors.muted, fontSize: typography.small, fontWeight: '600' },
  roleTextActive: { color: colors.brandDark, fontWeight: '800' },
  passwordField: { position: 'relative' },
  eyeButton: { position: 'absolute', right: spacing.md, bottom: 7, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red, fontSize: typography.small },
  forgot: { alignSelf: 'center', padding: spacing.sm },
  forgotText: { color: colors.brandDark, fontWeight: '700', fontSize: typography.small },
  footer: { color: colors.muted, fontSize: typography.caption, textAlign: 'center', marginTop: spacing.xxxl },
});
