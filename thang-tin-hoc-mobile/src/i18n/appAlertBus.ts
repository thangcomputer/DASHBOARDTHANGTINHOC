import type { AlertButton, AlertOptions } from 'react-native';

export type AppAlertPayload = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

type AppAlertHandler = (payload: AppAlertPayload) => void;

let registeredHandler: AppAlertHandler | null = null;

/** Đăng ký modal host để hiển thị mọi Alert.alert bằng popup tùy chỉnh. */
export function setAppAlertHandler(handler: AppAlertHandler | null): void {
  registeredHandler = handler;
}

/** Gửi cảnh báo tới AppAlertHost; trả về false nếu chưa mount để fallback an toàn. */
export function dispatchAppAlert(payload: AppAlertPayload): boolean {
  if (!registeredHandler) return false;
  registeredHandler(payload);
  return true;
}
