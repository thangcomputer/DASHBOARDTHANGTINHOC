import { useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { SOCKET_EVENTS } from '../services/socketService';
import { getMobileSoundEnabled, subscribeToMobileSoundPreference } from '../services/soundPreferences';

export function MobileSoundEffects({ incomingCall }: { incomingCall: boolean }) {
  const messagePlayer = useAudioPlayer(require('../assets/audio/message.wav'));
  const notificationPlayer = useAudioPlayer(require('../assets/audio/notification.wav'));
  const ringtonePlayer = useAudioPlayer(require('../assets/audio/incoming-call-ringtone.wav'));
  const [soundEnabled, setSoundEnabled] = useState<boolean | null>(null);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const lastMessageSoundAt = useRef(0);
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

    let stopped = false;
    ringtonePlayer.loop = true;
    void ringtonePlayer.seekTo(0)
      .then(() => {
        if (!stopped) ringtonePlayer.play();
      })
      .catch((error: unknown) => {
        console.warn('Không thể phát nhạc chuông cuộc gọi đến.', error);
      });
    return () => {
      stopped = true;
      ringtonePlayer.pause();
      void ringtonePlayer.seekTo(0).catch((error: unknown) => {
        console.warn('Không thể dừng nhạc chuông cuộc gọi đến.', error);
      });
    };
  }, [appIsActive, incomingCall, ringtonePlayer, soundEnabled]);

  useEffect(() => {
    if (soundEnabled !== true) return undefined;
    const playMessageSound = () => {
      if (!appIsActive) return;
      const now = Date.now();
      if (now - lastMessageSoundAt.current < 900) return;
      lastMessageSoundAt.current = now;
      messagePlayer.volume = 0.8;
      void messagePlayer.seekTo(0)
        .then(() => messagePlayer.play())
        .catch((error: unknown) => {
          console.warn('Không thể phát âm thanh tin nhắn.', error);
        });
    };
    const playNotificationSound = () => {
      if (!appIsActive) return;
      const now = Date.now();
      if (now - lastNotificationSoundAt.current < 1200) return;
      lastNotificationSoundAt.current = now;
      notificationPlayer.volume = 0.75;
      void notificationPlayer.seekTo(0)
        .then(() => notificationPlayer.play())
        .catch((error: unknown) => {
          console.warn('Không thể phát âm thanh thông báo.', error);
        });
    };
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION, playNotificationSound),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED, playMessageSound),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [appIsActive, messagePlayer, notificationPlayer, soundEnabled]);

  return null;
}
