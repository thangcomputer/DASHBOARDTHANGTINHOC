import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type * as LocalAuthType from 'expo-local-authentication';
import type { UserRole } from '../types';

const BIOMETRIC_CRED_KEY = 'thangtinhoc.biometric.cred.v1';

export type BiometricCredentialSnapshot = {
  role: UserRole;
  contact: string;
  password: string;
  displayName?: string;
  updatedAt: string;
};

export type BiometricAvailability = {
  supported: boolean;
  enrolled: boolean;
  hasSavedCredential: boolean;
  label: string;
  savedContact?: string;
  savedRole?: UserRole;
  savedDisplayName?: string;
};

function getLocalAuthModule(): typeof LocalAuthType | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as typeof LocalAuthType;
  } catch {
    return null;
  }
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      enrolled: false,
      hasSavedCredential: false,
      label: 'Sinh trắc học',
    };
  }
  const LocalAuth = getLocalAuthModule();
  if (!LocalAuth) {
    return {
      supported: false,
      enrolled: false,
      hasSavedCredential: false,
      label: 'Sinh trắc học',
    };
  }
  try {
    const [hasHardware, isEnrolled, types, saved] = await Promise.all([
      LocalAuth.hasHardwareAsync(),
      LocalAuth.isEnrolledAsync(),
      LocalAuth.supportedAuthenticationTypesAsync(),
      loadSavedBiometricCredential(),
    ]);
    const hasFace = types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION);
    const hasFinger = types.includes(LocalAuth.AuthenticationType.FINGERPRINT);
    const label = hasFace && hasFinger
      ? 'Face ID / Vân tay'
      : hasFace
        ? (Platform.OS === 'ios' ? 'Face ID' : 'Nhận diện khuôn mặt')
        : hasFinger
          ? (Platform.OS === 'ios' ? 'Touch ID' : 'Vân tay')
          : 'Sinh trắc học';
    return {
      supported: Boolean(hasHardware),
      enrolled: Boolean(hasHardware && isEnrolled),
      hasSavedCredential: Boolean(saved?.contact && saved?.password),
      label,
      savedContact: saved?.contact,
      savedRole: saved?.role,
      savedDisplayName: saved?.displayName,
    };
  } catch {
    return {
      supported: false,
      enrolled: false,
      hasSavedCredential: false,
      label: 'Sinh trắc học',
    };
  }
}

export async function loadSavedBiometricCredential(): Promise<BiometricCredentialSnapshot | null> {
  if (Platform.OS === 'web') return null;
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BiometricCredentialSnapshot>;
    if (!parsed?.contact || !parsed?.password || (parsed.role !== 'student' && parsed.role !== 'teacher')) {
      return null;
    }
    return {
      role: parsed.role,
      contact: String(parsed.contact),
      password: String(parsed.password),
      displayName: parsed.displayName ? String(parsed.displayName) : undefined,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export async function saveBiometricCredential(snapshot: Omit<BiometricCredentialSnapshot, 'updatedAt'>): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!snapshot.contact || !snapshot.password) return false;
  try {
    await SecureStore.setItemAsync(
      BIOMETRIC_CRED_KEY,
      JSON.stringify({
        ...snapshot,
        updatedAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function clearBiometricCredential(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(BIOMETRIC_CRED_KEY).catch(() => undefined);
}

export async function authenticateWithBiometrics(promptMessage = 'Xác thực sinh trắc học để đăng nhập Thắng Tin Học'): Promise<{
  ok: boolean;
  error?: string;
  credential?: BiometricCredentialSnapshot;
}> {
  if (Platform.OS === 'web') {
    return { ok: false, error: 'Đăng nhập sinh trắc học chỉ khả dụng trên ứng dụng di động.' };
  }
  const LocalAuth = getLocalAuthModule();
  if (!LocalAuth) {
    return { ok: false, error: 'Thiết bị chưa hỗ trợ mô-đun sinh trắc học.' };
  }
  const availability = await getBiometricAvailability();
  if (!availability.supported || !availability.enrolled) {
    return {
      ok: false,
      error: 'Thiết bị chưa bật Face ID / Vân tay. Hãy cài đặt trong phần Bảo mật của máy.',
    };
  }
  const credential = await loadSavedBiometricCredential();
  if (!credential) {
    return {
      ok: false,
      error: 'Chưa lưu tài khoản để mở khóa sinh trắc học. Hãy đăng nhập bằng mật khẩu và chọn "Lưu đăng nhập Vân tay / Face ID".',
    };
  }
  const result = await LocalAuth.authenticateAsync({
    promptMessage,
    cancelLabel: 'Hủy',
    fallbackLabel: 'Dùng mật khẩu',
    disableDeviceFallback: false,
  });
  if (!result.success) {
    if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
      return { ok: false, error: 'Đã hủy xác thực sinh trắc học.' };
    }
    return { ok: false, error: 'Xác thực sinh trắc học không thành công. Vui lòng thử lại.' };
  }
  return { ok: true, credential };
}

