import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';

const BEEP_TIMES_MS = [0, 360, 720, 3000, 3360, 3720];

export function CallRingback({ active }: { active: boolean }) {
  const player = useAudioPlayer(require('../assets/audio/call-ringback.wav'));

  useEffect(() => {
    if (!active) {
      player.pause();
      return undefined;
    }

    let cancelled = false;
    const timers = BEEP_TIMES_MS.map((delay) => setTimeout(() => {
      if (cancelled) return;
      void player.seekTo(0)
        .then(() => {
          if (!cancelled) player.play();
        })
        .catch((error: unknown) => {
          console.warn('Không thể phát âm báo kết nối cuộc gọi.', error);
        });
    }, delay));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      player.pause();
      void player.seekTo(0).catch((error: unknown) => {
        console.warn('Không thể dừng âm báo kết nối cuộc gọi.', error);
      });
    };
  }, [active, player]);

  return null;
}
