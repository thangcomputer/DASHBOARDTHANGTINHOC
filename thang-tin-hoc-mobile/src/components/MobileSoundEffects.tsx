import { useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { SOCKET_EVENTS } from '../services/socketService';
import { getMobileSoundEnabled, subscribeToMobileSoundPreference } from '../services/soundPreferences';

const CALL_RING_PATTERN_MS = [0, 360, 720, 3000, 3360, 3720];
const CALL_RING_PATTERN_INTERVAL_MS = 4500;

export function MobileSoundEffects({ incomingCall }: { incomingCall: boolean }) {
  const notificationPlayer = useAudioPlayer(require('../assets/audio/practice-correct.wav'));
  const ringtonePlayer = useAudioPlayer(require('../assets/audio/call-ringback.wav'));
  const [soundEnabled, setSoundEnabled] = useState<boolean | null>(null);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const lastNotificationSoundAt = useRef(0);

  useEffect(() => {
    let active = true;
    getMobileSoundEnabled()
      .then((enabled) => {
        if (active) setSoundEnabled(enabled);
      })
      .catch((error: unknown) => {
        console.error('Không thể tải tùy chọn âm thanh thông báo.', error);
        if (active) setSoundEnabled(false);
      });
    const unsubscribe = subscribeToMobileSoundPreference(setSoundEnabled);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch((error: unknown) => {
      console.warn('Không thể bật chế độ âm thanh thông báo.', error);
    });
  }, []);

  useEffect(() => {
    if (soundEnabled !== true || !incomingCall || !appIsActive) {
      ringtonePlayer.pause();
      void ringtonePlayer.seekTo(0).catch((error: unknown) => {
        console.warn('Không thể dừng nhạc chuông cuộc gọi đến.', error);
      });
      return undefined;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let stopped = false;
    const schedulePattern = () => {
      for (const delay of CALL_RING_PATTERN_MS) {
        timers.push(setTimeout(() => {
          if (stopped) return;
          void ringtonePlayer.seekTo(0)
            .then(() => {
              if (!stopped) ringtonePlayer.play();
            })
            .catch((error: unknown) => {
              console.warn('Không thể phát nhạc chuông cuộc gọi đến.', error);
            });
        }, delay));
      }
    };
    schedulePattern();
    const interval = setInterval(schedulePattern, CALL_RING_PATTERN_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
      timers.forEach(clearTimeout);
      ringtonePlayer.pause();
      void ringtonePlayer.seekTo(0).catch((error: unknown) => {
        console.warn('Không thể dừng nhạc chuông cuộc gọi đến.', error);
      });
    };
  }, [appIsActive, incomingCall, ringtonePlayer, soundEnabled]);

  useEffect(() => {
    if (soundEnabled !== true) return undefined;
    const playNotificationSound = () => {
      if (!appIsActive) return;
      const now = Date.now();
      if (now - lastNotificationSoundAt.current < 900) return;
      lastNotificationSoundAt.current = now;
      void notificationPlayer.seekTo(0)
        .then(() => notificationPlayer.play())
        .catch((error: unknown) => {
          console.warn('Không thể phát âm thanh thông báo.', error);
        });
    };
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION, playNotificationSound),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED, playNotificationSound),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [appIsActive, notificationPlayer, soundEnabled]);

  return null;
}
