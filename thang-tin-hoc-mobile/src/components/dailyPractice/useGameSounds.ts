import { useCallback, useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { getMobileSoundEnabled, subscribeToMobileSoundPreference } from '../../services/soundPreferences';

export type GameSound = 'tap' | 'pick' | 'drop' | 'correct' | 'wrong' | 'hint' | 'win' | 'sad' | 'lightning' | 'mascotVictory';

type Note = { freq: number; at?: number; dur?: number; slideTo?: number };
const WEB_NOTES: Record<GameSound, [Note[], OscillatorType, number]> = {
  tap: [[{ freq: 660, dur: 0.05 }], 'triangle', 0.08],
  pick: [[{ freq: 520, dur: 0.06, slideTo: 760 }], 'triangle', 0.1],
  drop: [[{ freq: 760, dur: 0.07, slideTo: 440 }], 'triangle', 0.1],
  correct: [[{ freq: 659, dur: 0.12 }, { freq: 880, at: 0.09, dur: 0.12 }, { freq: 1319, at: 0.18, dur: 0.22 }], 'triangle', 0.16],
  wrong: [[{ freq: 330, dur: 0.2, slideTo: 247 }, { freq: 247, at: 0.18, dur: 0.32, slideTo: 165 }], 'sawtooth', 0.07],
  hint: [[{ freq: 988, dur: 0.1 }, { freq: 1319, at: 0.07, dur: 0.16 }], 'sine', 0.12],
  win: [[{ freq: 523, dur: 0.14 }, { freq: 659, at: 0.12, dur: 0.14 }, { freq: 784, at: 0.24, dur: 0.14 }, { freq: 1047, at: 0.36, dur: 0.34 }, { freq: 1319, at: 0.5, dur: 0.4 }], 'triangle', 0.16],
  sad: [[{ freq: 392, dur: 0.28 }, { freq: 349, at: 0.26, dur: 0.28 }, { freq: 311, at: 0.52, dur: 0.5, slideTo: 262 }], 'sine', 0.14],
  lightning: [
    [
      { freq: 1400, dur: 0.12, slideTo: 180 },
      { freq: 523, at: 0.08, dur: 0.12 },
      { freq: 659, at: 0.15, dur: 0.12 },
      { freq: 784, at: 0.22, dur: 0.14 },
      { freq: 1046, at: 0.30, dur: 0.35 },
      { freq: 1319, at: 0.40, dur: 0.40 },
    ],
    'sawtooth',
    0.20,
  ],
  mascotVictory: [
    [
      { freq: 523, at: 0.0, dur: 0.16 },
      { freq: 659, at: 0.14, dur: 0.16 },
      { freq: 784, at: 0.28, dur: 0.16 },
      { freq: 1046, at: 0.42, dur: 0.24 },
      { freq: 1318, at: 0.58, dur: 0.28 },
      { freq: 1568, at: 0.74, dur: 0.55 },
    ],
    'triangle',
    0.24,
  ],
};

let webCtx: AudioContext | null = null;
function playWeb(name: GameSound) {
  try {
    const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    webCtx = webCtx || new Ctor();
    if (webCtx.state === 'suspended') void webCtx.resume();
    const [notes, type, volume] = WEB_NOTES[name];
    const start = webCtx.currentTime;
    for (const { freq, at = 0, dur = 0.14, slideTo } of notes) {
      const osc = webCtx.createOscillator();
      const gain = webCtx.createGain();
      const t = start + at;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(webCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
  } catch {
    /* trình duyệt chặn âm thanh - bỏ qua */
  }
}

/** Âm thanh + rung cho trò chơi luyện tập; tôn trọng nút tắt âm thanh của app. */
export function useGameSounds() {
  const players = {
    tap: useAudioPlayer(require('../../assets/audio/game-tap.wav')),
    pick: useAudioPlayer(require('../../assets/audio/game-pick.wav')),
    drop: useAudioPlayer(require('../../assets/audio/game-drop.wav')),
    correct: useAudioPlayer(require('../../assets/audio/game-correct.wav')),
    wrong: useAudioPlayer(require('../../assets/audio/game-wrong.wav')),
    hint: useAudioPlayer(require('../../assets/audio/game-hint.wav')),
    win: useAudioPlayer(require('../../assets/audio/game-win.wav')),
    sad: useAudioPlayer(require('../../assets/audio/game-sad.wav')),
  };
  const playersRef = useRef(players);
  playersRef.current = players;
  const enabledRef = useRef(true);

  useEffect(() => {
    let active = true;
    getMobileSoundEnabled().then((enabled) => { if (active) enabledRef.current = enabled; }).catch(() => { });
    const unsubscribe = subscribeToMobileSoundPreference((enabled) => { enabledRef.current = enabled; });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return useCallback((name: GameSound) => {
    if (Platform.OS !== 'web') {
      if (name === 'wrong' || name === 'sad') {
        Vibration.vibrate(name === 'wrong' ? 120 : [0, 80, 60, 80]);
      } else if (name === 'lightning') {
        Vibration.vibrate([0, 50, 40, 100]);
      } else if (name === 'mascotVictory') {
        Vibration.vibrate([0, 100, 60, 140]);
      }
    }
    if (!enabledRef.current) return;
    if (Platform.OS === 'web') {
      playWeb(name);
      return;
    }
    const player = playersRef.current[name as keyof typeof playersRef.current] || playersRef.current.win;
    void player.seekTo(0).then(() => player.play()).catch(() => { });
  }, []);
}
