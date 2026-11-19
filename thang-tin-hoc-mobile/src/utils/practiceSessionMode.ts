import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

export const MOBILE_PRACTICE_SESSION_ACTIVE_EVENT = 'mobile:practice-session-active';

let practiceSessionActive = false;

/** Kiểm tra học viên có đang ở trong phiên làm bài luyện tập trên Mobile App hay không. */
export function isMobilePracticeSessionActive(): boolean {
  return practiceSessionActive;
}

/** Bật/tắt trạng thái đang làm bài luyện tập để ẩn thanh điều hướng dưới và chrome nổi. */
export function setMobilePracticeSessionActive(next: boolean): boolean {
  const value = Boolean(next);
  if (practiceSessionActive === value) return practiceSessionActive;
  practiceSessionActive = value;
  DeviceEventEmitter.emit(MOBILE_PRACTICE_SESSION_ACTIVE_EVENT, value);
  return practiceSessionActive;
}

/** Hook theo dõi trạng thái đang làm bài luyện tập trên Mobile App. */
export function useMobilePracticeSessionActive(): boolean {
  const [active, setActive] = useState<boolean>(isMobilePracticeSessionActive);

  useEffect(() => {
    setActive(isMobilePracticeSessionActive());
    const sub = DeviceEventEmitter.addListener(MOBILE_PRACTICE_SESSION_ACTIVE_EVENT, (next: boolean) => {
      setActive(Boolean(next));
    });
    return () => sub.remove();
  }, []);

  return active;
}
