let muted = localStorage.getItem('thvp_muted') === 'true';

/** AudioContext dùng chung — trình duyệt chặn phát nếu chưa có tương tác người dùng */
let audioCtx = null;

export const isSoundMuted = () => muted;

export const setSoundMuted = (val) => {
  muted = val;
  localStorage.setItem('thvp_muted', val ? 'true' : 'false');
};

/** Gọi sau click/touch đầu tiên để bật được âm thanh (Chrome/Safari autoplay policy) */
export const unlockAudio = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch {
    /* noop */
  }
};

const playTone = (frequency = 440, type = 'sine', duration = 0.1, volume = 0.5) => {
  if (muted) return;
  try {
    unlockAudio();
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch {
    /* noop */
  }
};

let lastMessageSoundAt = 0;

export const playMessageSound = () => {
  const now = Date.now();
  if (now - lastMessageSoundAt < 350) return;
  lastMessageSoundAt = now;
  playTone(1046.50, 'sine', 0.1, 0.2);
  setTimeout(() => playTone(1318.51, 'sine', 0.15, 0.2), 100);
};

export const playNotifySound = () => {
  playTone(880.00, 'triangle', 0.1, 0.2);
  setTimeout(() => playTone(1174.66, 'triangle', 0.2, 0.2), 150);
};
