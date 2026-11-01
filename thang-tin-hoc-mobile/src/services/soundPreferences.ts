import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const soundPreferenceKey = 'mobile_sound_enabled';
const soundPreferenceEvent = 'mobile:sound-preference-changed';

export async function getMobileSoundEnabled() {
  try {
    return (await AsyncStorage.getItem(soundPreferenceKey)) !== 'false';
  } catch (error) {
    console.error('Không thể tải tùy chọn âm thanh.', error);
    throw error;
  }
}

export async function setMobileSoundEnabled(enabled: boolean) {
  try {
    await AsyncStorage.setItem(soundPreferenceKey, String(enabled));
    DeviceEventEmitter.emit(soundPreferenceEvent, enabled);
  } catch (error) {
    console.error('Không thể lưu tùy chọn âm thanh.', error);
    throw error;
  }
}

export function subscribeToMobileSoundPreference(listener: (enabled: boolean) => void) {
  const subscription = DeviceEventEmitter.addListener(soundPreferenceEvent, listener);
  return () => subscription.remove();
}
