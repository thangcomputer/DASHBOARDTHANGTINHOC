let muted = localStorage.getItem('thvp_muted') === 'true';

/** Chỉ tạo AudioContext sau gesture người dùng (tránh cảnh báo autoplay Chrome) */
let audioCtx = null;
let audioUnlocked = false;

export const isSoundMuted = () => muted;

export const setSoundMuted = (val) => {
  muted = val;
  localStorage.setItem('thvp_muted', val ? 'true' : 'false');
};

/** Gọi sau click/touch đầu tiên để bật được âm thanh (Chrome/Safari autoplay policy) */
export const unlockAudio = () => {
  audioUnlocked = true;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
  } catch {
    /* noop */
  }
};

const playTone = (frequency = 440, type = 'sine', duration = 0.1, volume = 0.5) => {
  if (muted || !audioUnlocked) return;
  try {
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
let lastNotifySoundAt = 0;

export const playMessageSound = () => {
  const now = Date.now();
  if (now - lastMessageSoundAt < 350) return;
  lastMessageSoundAt = now;
  playTone(1046.50, 'sine', 0.1, 0.2);
  setTimeout(() => playTone(1318.51, 'sine', 0.15, 0.2), 100);
};

export const playNotifySound = () => {
  const now = Date.now();
  if (now - lastNotifySoundAt < 1200) return;
  lastNotifySoundAt = now;
  playTone(880.00, 'triangle', 0.1, 0.2);
  setTimeout(() => playTone(1174.66, 'triangle', 0.2, 0.2), 150);
};

const playExamWarningBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(660, ctx.currentTime);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.18);
      } catch { /* ignore */ }
    }, 120);
  } catch {
    playTone(880, 'square', 0.14, 0.35);
  }
};

let currentWarningAudio = null;

/** Cảnh báo phòng thi: file Admin tải lên; không có thì beep. */
export const playExamWarningSound = (customUrl = '') => {
  unlockAudio();
  if (muted) return;
  
  if (currentWarningAudio) {
    try {
      currentWarningAudio.pause();
      currentWarningAudio.currentTime = 0;
    } catch { /* ignore */ }
  }

  const url = String(customUrl || '').trim();
  if (url) {
    try {
      currentWarningAudio = new Audio(url);
      currentWarningAudio.volume = 0.7;
      void currentWarningAudio.play().catch(() => {
        currentWarningAudio = null;
        playExamWarningBeep();
      });
      return;
    } catch {
      currentWarningAudio = null;
      /* fall through to beep */
    }
  }
  playExamWarningBeep();
};

export const stopExamWarningSound = () => {
  if (currentWarningAudio) {
    try {
      currentWarningAudio.pause();
      currentWarningAudio.currentTime = 0;
    } catch { /* ignore */ }
    currentWarningAudio = null;
  }
};
