import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

export const MOBILE_FOCUS_MODE_EVENT = 'mobile:focus-mode-changed';

let focusModeActive = false;

export function isMobileFocusMode(): boolean {
  return focusModeActive;
}

export function setMobileFocusMode(next: boolean): boolean {
  const value = Boolean(next);
  if (focusModeActive === value) return focusModeActive;
  focusModeActive = value;
  DeviceEventEmitter.emit(MOBILE_FOCUS_MODE_EVENT, value);
  DeviceEventEmitter.emit('mobile:branding-header-visibility', !value);
  DeviceEventEmitter.emit('mobile:navigation-bar-visibility', !value);
  return focusModeActive;
}

export function toggleMobileFocusMode(): boolean {
  return setMobileFocusMode(!focusModeActive);
}

/** Đồng bộ trạng thái Chế độ tập trung trên mọi component Mobile. */
export function useMobileFocusMode() {
  const [focusMode, setFocusModeState] = useState<boolean>(isMobileFocusMode);

  useEffect(() => {
    setFocusModeState(isMobileFocusMode());
    const sub = DeviceEventEmitter.addListener(MOBILE_FOCUS_MODE_EVENT, (next: boolean) => {
      setFocusModeState(Boolean(next));
    });
    return () => sub.remove();
  }, []);

  return {
    focusMode,
    setFocusMode: setMobileFocusMode,
    toggle: toggleMobileFocusMode,
  };
}

