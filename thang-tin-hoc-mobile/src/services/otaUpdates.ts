import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type * as UpdatesType from 'expo-updates';

function getUpdatesModule(): typeof UpdatesType | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as typeof UpdatesType;
  } catch {
    return null;
  }
}

export type OtaUpdateCheckStatus =
  | 'unsupported_web'
  | 'unsupported_dev'
  | 'up_to_date'
  | 'available'
  | 'downloaded'
  | 'error';

export type OtaUpdateStatusInfo = {
  enabled: boolean;
  channel: string;
  runtimeVersion: string;
  updateId: string;
  isEmbeddedLaunch: boolean;
  appVersion: string;
};

export function getOtaUpdateInfo(): OtaUpdateStatusInfo {
  const Updates = getUpdatesModule();
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  if (!Updates || Platform.OS === 'web') {
    return {
      enabled: false,
      channel: 'web',
      runtimeVersion: appVersion,
      updateId: '',
      isEmbeddedLaunch: true,
      appVersion,
    };
  }
  return {
    enabled: Boolean(Updates.isEnabled),
    channel: Updates.channel || (__DEV__ ? 'development' : 'production'),
    runtimeVersion: Updates.runtimeVersion || appVersion,
    updateId: Updates.updateId || '',
    isEmbeddedLaunch: Boolean(Updates.isEmbeddedLaunch),
    appVersion,
  };
}

export async function checkAndApplyOtaUpdate(): Promise<{
  status: OtaUpdateCheckStatus;
  message: string;
  requiresReload?: boolean;
}> {
  if (Platform.OS === 'web') {
    return {
      status: 'unsupported_web',
      message: 'Bản web luôn tải phiên bản mới nhất khi làm mới trình duyệt.',
    };
  }
  const Updates = getUpdatesModule();
  if (!Updates || !Updates.isEnabled || __DEV__) {
    return {
      status: 'unsupported_dev',
      message: 'EAS Update OTA hoạt động trên bản dựng preview / production (không bật trong chế độ Metro Dev / Expo Go).',
    };
  }
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      return {
        status: 'up_to_date',
        message: 'Ứng dụng đang ở phiên bản mới nhất.',
      };
    }
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) {
      return {
        status: 'downloaded',
        requiresReload: true,
        message: 'Đã tải xong bản vá lỗi OTA mới. Nhấn khởi động lại để áp dụng ngay!',
      };
    }
    return {
      status: 'up_to_date',
      message: 'Ứng dụng đang dùng bản mới nhất.',
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Không thể kiểm tra cập nhật OTA lúc này.',
    };
  }
}

export async function reloadAppForOtaUpdate(): Promise<void> {
  const Updates = getUpdatesModule();
  if (!Updates || Platform.OS === 'web') return;
  await Updates.reloadAsync();
}

